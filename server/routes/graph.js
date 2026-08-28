const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');

// Get complete graph with filters
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      types, 
      maxYear, 
      minYear,
      workspace = 'default',
      tags,
      page = 1,
      limit = 1000,
      includeMetadata = false
    } = req.query;
    
    // Build node query
    let nodeQuery = { workspace };
    
    if (search) {
      nodeQuery.$or = [
        { label: { $regex: search, $options: 'i' } },
        { info: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (types) {
      const typeArray = types.split(',').map(t => t.trim());
      nodeQuery.group = { $in: typeArray };
    }
    
    if (maxYear || minYear) {
      const range = {};
      if (maxYear) {
        range.$lte = parseInt(maxYear);
      }
      if (minYear) {
        range.$gte = parseInt(minYear);
      }
      // Undated nodes stay visible. Most ingested concepts ("convolutional
      // neural network") carry no inception date, and a plain range query
      // excludes missing fields - which would hide the bulk of the graph the
      // moment the timeline is touched. Use $and so this composes with the
      // $or that `search` may already have set.
      nodeQuery.$and = [{ $or: [{ year: range }, { year: { $exists: false } }, { year: null }] }];
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      nodeQuery.tags = { $in: tagArray };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCount = await Node.countDocuments(nodeQuery);

    // Get filtered nodes with pagination
    const nodes = await Node.find(nodeQuery)
      .sort({ year: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const nodeIds = nodes.map(n => {
      const id = n._id || n.id;
      return id.toString ? id.toString() : String(id);
    });

    // Get edges only between visible nodes
    const edges = await Edge.find({
      workspace,
      from: { $in: nodeIds },
      to: { $in: nodeIds }
    }).populate('from to', 'label group year info');

    // Format for vis-network
    const formattedNodes = nodes.map(node => {
      const nodeData = {
        id: node._id.toString(),
        label: node.label,
        group: node.group,
        year: node.year,
        info: node.info,
        tags: node.tags || []
      };
      
      if (includeMetadata === 'true' && node.metadata) {
        nodeData.metadata = Object.fromEntries(node.metadata);
      }
      
      return nodeData;
    });

    const formattedEdges = edges.map(edge => {
      const fromId = edge.from?._id?.toString() || edge.from?.toString() || edge.from;
      const toId = edge.to?._id?.toString() || edge.to?.toString() || edge.to;
      
      const edgeData = {
        id: edge._id.toString(),
        from: fromId,
        to: toId,
        label: edge.label,
        weight: edge.weight || 1
      };
      
      if (includeMetadata === 'true' && edge.metadata) {
        edgeData.metadata = Object.fromEntries(edge.metadata);
      }
      
      return edgeData;
    });

    res.json({
      nodes: formattedNodes,
      edges: formattedEdges,
      count: nodes.length,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get graph statistics
/**
 * A node's neighbourhood, as a subgraph.
 * GET /api/graph/neighborhood?workspace=&nodeId=&hops=2&limit=300
 *
 * Rendering a whole workspace puts hundreds of nodes on screen at once, which
 * is a picture rather than something you can read. Focusing on one node and
 * walking outwards a hop at a time is what makes a large graph explorable.
 */
router.get('/neighborhood', async (req, res) => {
  try {
    const { workspace = 'default', nodeId, hops = 2, limit = 300 } = req.query;
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    const centre = await Node.findOne({ _id: nodeId, workspace });
    if (!centre) {
      return res.status(404).json({ error: 'Node not found in this workspace' });
    }

    const maxNodes = Math.min(parseInt(limit, 10) || 300, 600);
    const maxHops = Math.min(Math.max(parseInt(hops, 10) || 2, 1), 3);

    // Breadth-first over the edge collection, one hop per query rather than
    // one per node - a hop is a single $in lookup however wide it is.
    const included = new Set([centre._id.toString()]);
    const distance = new Map([[centre._id.toString(), 0]]);
    let frontier = [centre._id];

    for (let hop = 1; hop <= maxHops && frontier.length > 0 && included.size < maxNodes; hop++) {
      const touching = await Edge.find({
        workspace,
        $or: [{ from: { $in: frontier } }, { to: { $in: frontier } }]
      }).select('from to');

      const next = [];
      for (const edge of touching) {
        for (const endpoint of [edge.from, edge.to]) {
          const id = endpoint.toString();
          if (included.has(id)) continue;
          if (included.size >= maxNodes) break;
          included.add(id);
          distance.set(id, hop);
          next.push(endpoint);
        }
      }
      frontier = next;
    }

    const ids = [...included];
    const [nodes, edges] = await Promise.all([
      Node.find({ _id: { $in: ids }, workspace }),
      Edge.find({ workspace, from: { $in: ids }, to: { $in: ids } })
    ]);

    res.json({
      nodes: nodes.map(node => ({
        id: node._id.toString(),
        label: node.label,
        group: node.group,
        year: node.year,
        info: node.info,
        tags: node.tags || [],
        // Lets the client style the centre and fade distant nodes.
        hop: distance.get(node._id.toString()) ?? maxHops
      })),
      edges: edges.map(edge => ({
        id: edge._id.toString(),
        from: edge.from.toString(),
        to: edge.to.toString(),
        label: edge.label,
        weight: edge.weight || 1
      })),
      focus: {
        id: centre._id.toString(),
        label: centre.label,
        group: centre.group
      },
      count: nodes.length,
      hops: maxHops,
      truncated: included.size >= maxNodes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Everything one node connects to, with the relation and its direction.
 * GET /api/graph/connections?workspace=&nodeId=&limit=200
 *
 * Answers "what is this thing attached to?" without depending on what the
 * canvas currently has loaded.
 */
router.get('/connections', async (req, res) => {
  try {
    const { workspace = 'default', nodeId, limit = 200 } = req.query;
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });

    const node = await Node.findOne({ _id: nodeId, workspace });
    if (!node) return res.status(404).json({ error: 'Node not found in this workspace' });

    const edges = await Edge.find({
      workspace,
      $or: [{ from: nodeId }, { to: nodeId }]
    })
      .limit(Math.min(parseInt(limit, 10) || 200, 500))
      .populate('from to', 'label group year metadata');

    const connections = edges.map(edge => {
      const outgoing = edge.from?._id?.toString() === nodeId;
      const other = outgoing ? edge.to : edge.from;
      if (!other?._id) return null;
      return {
        id: other._id.toString(),
        label: other.label,
        group: other.group,
        year: other.year,
        image: other.metadata?.get?.('image') || undefined,
        relation: edge.label,
        // "out" reads node -> other; "in" reads other -> node.
        direction: outgoing ? 'out' : 'in'
      };
    }).filter(Boolean);

    res.json({
      node: {
        id: node._id.toString(),
        label: node.label,
        group: node.group,
        year: node.year,
        info: node.info,
        tags: node.tags || [],
        image: node.metadata?.get?.('image') || undefined
      },
      connections,
      count: connections.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find nodes by name, for jump-to-node.
 * GET /api/graph/find?workspace=&q=&limit=10
 *
 * Deliberately separate from the main graph query: searching should locate a
 * node so you can focus on it, not replace the graph with the search results.
 */
router.get('/find', async (req, res) => {
  try {
    const { workspace = 'default', q, limit = 10 } = req.query;
    if (!q || !q.trim()) return res.json({ matches: [] });

    // Escape regex metacharacters so a query like "C++" is a literal search.
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const want = Math.min(parseInt(limit, 10) || 10, 25);
    // Over-fetch, then rank: a substring match alone puts "A Commentary on the
    // UNIX Operating System" above "Unix", which is never what was meant.
    const found = await Node.find(
      { workspace, label: { $regex: safe, $options: 'i' } },
      { label: 1, group: 1, year: 1, metadata: 1 }
    ).limit(want * 6);

    const needle = q.trim().toLowerCase();
    const rank = (label) => {
      const l = String(label).toLowerCase();
      if (l === needle) return 0;
      if (l.startsWith(needle)) return 1;
      if (new RegExp(`\\b${safe.toLowerCase()}`, 'i').test(l)) return 2;
      return 3;
    };

    const matches = found
      .sort((a, b) => rank(a.label) - rank(b.label) || a.label.length - b.label.length)
      .slice(0, want);

    res.json({
      matches: matches.map(n => ({
        id: n._id.toString(),
        label: n.label,
        group: n.group,
        year: n.year,
        image: n.metadata?.get?.('image') || undefined
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List every workspace that currently holds data, so the UI can offer them
// as a choice rather than making the user recall the exact name.
router.get('/workspaces', async (req, res) => {
  try {
    const [nodeCounts, edgeCounts] = await Promise.all([
      Node.aggregate([{ $group: { _id: '$workspace', nodeCount: { $sum: 1 } } }]),
      Edge.aggregate([{ $group: { _id: '$workspace', edgeCount: { $sum: 1 } } }])
    ]);

    const edgesByWorkspace = new Map(edgeCounts.map(e => [e._id, e.edgeCount]));
    const workspaces = nodeCounts
      .filter(w => w._id)
      .map(w => ({
        name: w._id,
        nodeCount: w.nodeCount,
        edgeCount: edgesByWorkspace.get(w._id) || 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 'default' should always be selectable, even before anything is loaded.
    if (!workspaces.some(w => w.name === 'default')) {
      workspaces.unshift({ name: 'default', nodeCount: 0, edgeCount: 0 });
    }

    res.json({ workspaces, count: workspaces.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { workspace = 'default' } = req.query;
    
    const nodeCount = await Node.countDocuments({ workspace });
    const edgeCount = await Edge.countDocuments({ workspace });
    
    const groupStats = await Node.aggregate([
      { $match: { workspace } },
      { $group: { _id: '$group', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const yearRange = await Node.aggregate([
      { $match: { workspace, year: { $exists: true, $ne: null } } },
      { $group: {
        _id: null,
        minYear: { $min: '$year' },
        maxYear: { $max: '$year' }
      }}
    ]);
    
    const avgDegree = edgeCount > 0 && nodeCount > 0 
      ? (edgeCount * 2 / nodeCount).toFixed(2)
      : 0;
    
    res.json({
      nodeCount,
      edgeCount,
      groupStats,
      yearRange: yearRange[0] || { minYear: null, maxYear: null },
      avgDegree: parseFloat(avgDegree)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find shortest path between two nodes
router.get('/path', async (req, res) => {
  try {
    const { from, to, workspace = 'default', maxDepth = 5 } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to node IDs are required' });
    }
    
    // BFS to find shortest path
    const visited = new Set();
    const queue = [[from, [from]]];
    visited.add(from.toString());
    
    let path = null;
    let depth = 0;
    
    while (queue.length > 0 && depth < parseInt(maxDepth)) {
      const levelSize = queue.length;
      
      for (let i = 0; i < levelSize; i++) {
        const [currentId, currentPath] = queue.shift();
        
        if (currentId.toString() === to.toString()) {
          path = currentPath;
          break;
        }
        
        // Get all edges from and to this node
        const edges = await Edge.find({
          workspace,
          $or: [
            { from: currentId },
            { to: currentId }
          ]
        });
        
        for (const edge of edges) {
          const nextId = edge.from.toString() === currentId.toString() 
            ? edge.to.toString() 
            : edge.from.toString();
          
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push([nextId, [...currentPath, nextId]]);
          }
        }
      }
      
      if (path) break;
      depth++;
    }
    
    if (!path) {
      return res.json({ path: null, message: 'No path found within max depth' });
    }
    
    // Get node details for path
    const nodes = await Node.find({ 
      _id: { $in: path },
      workspace 
    });
    
    res.json({ path, nodes, depth: path.length - 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


