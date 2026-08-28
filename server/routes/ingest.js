const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const { getSource, listSources } = require('../services/sources');
const { searchWikipedia } = require('../services/sources/wikidata');

const MAX_NODES_CEILING = 500;

/** GET /api/ingest/sources - what the UI can offer. */
router.get('/sources', (req, res) => {
  res.json({ sources: listSources() });
});

/**
 * Preview the Wikipedia pages a topic would seed, without writing anything.
 * GET /api/ingest/preview?topic=...&seeds=10
 */
router.get('/preview', async (req, res) => {
  try {
    const { topic, seeds = 10 } = req.query;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const pages = await searchWikipedia(topic.trim(), parseInt(seeds, 10) || 10);
    res.json({
      topic,
      count: pages.length,
      pages: pages.map(p => ({ title: p.title, qid: p.qid, summary: p.extract.slice(0, 200) }))
    });
  } catch (error) {
    res.status(502).json({ error: `Wikipedia lookup failed: ${error.message}` });
  }
});

/**
 * Persist a built graph. Shared by every source: nodes are keyed on
 * (workspace, source, externalId) so re-running a topic refreshes rather than
 * duplicates.
 */
async function persist(graph, { workspace, sourceId }) {
  const nodeOps = graph.nodes.map(node => {
    const set = {
      label: node.label,
      group: node.group,
      info: node.info || node.label,
      tags: node.tags || [],
      metadata: node.metadata || {},
      source: sourceId,
      workspace
    };
    // Never $set an undefined year - it would clear a value already stored.
    if (node.year !== undefined && node.year !== null) set.year = node.year;

    return {
      updateOne: {
        filter: { workspace, source: sourceId, externalId: node.externalId },
        update: { $set: set, $setOnInsert: { externalId: node.externalId } },
        upsert: true
      }
    };
  });

  const nodeResult = nodeOps.length
    ? await Node.bulkWrite(nodeOps, { ordered: false })
    : { upsertedCount: 0, modifiedCount: 0 };

  // Resolve external ids to the ObjectIds the Edge model references.
  const stored = await Node.find(
    { workspace, source: sourceId, externalId: { $in: graph.nodes.map(n => n.externalId) } },
    { externalId: 1 }
  );
  const idByExternal = new Map(stored.map(n => [n.externalId, n._id]));

  // The Edge unique index is (workspace, from, to) and excludes `label`, so a
  // node pair holds exactly one relation. $setOnInsert keeps whichever arrived
  // first rather than churning the label on every re-ingest.
  const edgeOps = [];
  let unresolved = 0;
  for (const edge of graph.edges) {
    const from = idByExternal.get(edge.fromExternalId);
    const to = idByExternal.get(edge.toExternalId);
    if (!from || !to) {
      unresolved++;
      continue;
    }
    edgeOps.push({
      updateOne: {
        filter: { workspace, from, to },
        update: {
          $setOnInsert: {
            workspace, from, to,
            label: edge.label,
            weight: 1,
            metadata: edge.metadata || {},
            source: sourceId
          }
        },
        upsert: true
      }
    });
  }

  const edgeResult = edgeOps.length
    ? await Edge.bulkWrite(edgeOps, { ordered: false })
    : { upsertedCount: 0, modifiedCount: 0 };

  return {
    nodesCreated: nodeResult.upsertedCount || 0,
    nodesUpdated: nodeResult.modifiedCount || 0,
    edgesCreated: edgeResult.upsertedCount || 0,
    edgesSkippedUnresolved: unresolved,
    // Relations dropped because that node pair already held an edge.
    edgesDeduped: graph.edges.length - unresolved - (edgeResult.upsertedCount || 0)
  };
}

/**
 * POST /api/ingest/:source  { topic, seeds?, maxNodes?, depth?, workspace? }
 * Ingest a topic from any registered source.
 */
router.post('/:source', async (req, res) => {
  const sourceId = req.params.source;
  const source = getSource(sourceId);

  if (!source) {
    return res.status(404).json({
      error: `Unknown source "${sourceId}"`,
      available: listSources().map(s => s.id)
    });
  }

  const {
    topic,
    seeds = 20,
    maxNodes = 250,
    depth = 1,
    workspace = 'default'
  } = req.body || {};

  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ error: 'topic is required' });
  }

  const log = [];
  try {
    const graph = await source.buildGraph({
      topic: String(topic).trim(),
      seeds: Math.min(parseInt(seeds, 10) || 20, 50),
      maxNodes: Math.min(parseInt(maxNodes, 10) || 250, MAX_NODES_CEILING),
      depth: Math.min(Math.max(parseInt(depth, 10) || 1, 1), 3),
      onProgress: message => log.push(message)
    });

    if (graph.nodes.length === 0) {
      return res.status(404).json({
        error: graph.stats?.reason || `No ${source.label} results for "${topic}"`,
        stats: graph.stats
      });
    }

    const written = await persist(graph, { workspace, sourceId });

    res.json({
      success: true,
      source: { id: source.id, label: source.label },
      topic,
      workspace,
      log,
      stats: { ...graph.stats, ...written }
    });
  } catch (error) {
    console.error(`Ingest failed (${sourceId}):`, error);
    res.status(500).json({ error: error.message, log });
  }
});

module.exports = router;
