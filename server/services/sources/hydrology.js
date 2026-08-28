/**
 * Rivers, seas and oceans, via the Wikidata Query Service (SPARQL).
 * https://query.wikidata.org  (free, no key)
 *
 * The plain Wikidata source searches and walks generic properties, which is
 * the wrong shape for water: the Danube alone declares 313 tributaries, and
 * what makes a river network interesting is following them. SPARQL lets us ask
 * for exactly the hydrological relations and traverse them level by level.
 *
 * Edges are normalised to the direction water actually flows. Wikidata states
 * "Danube -> has tributary -> Inn"; this source emits "Inn -> flows into ->
 * Danube", so arrows in the graph trace the drainage network downstream.
 */

const { runSparql, truncate, topByCount } = require('./http');
const { searchWikipedia, fetchEntities, claimTargets } = require('./wikidata');

/** Hydrological properties, and how each maps onto a directed edge. */
const FORWARD = {
  // property: [edge label, reverse?]  - reverse means the edge runs target->source
  P974: ['flows into', true],    // has tributary
  P403: ['flows into', false],   // mouth of the watercourse
  P200: ['flows into', true],    // inflows
  P201: ['flows into', false],   // lake outflow
  P885: ['originates at', false],
  P4614: ['drainage basin', false],
  P469: ['lake on watercourse', false],
  P361: ['part of', false],
  P17: ['country', false]
};

/** Wikidata classes to WorldGraph entity types. */
const TYPES = {
  Q4022: 'River', Q47521: 'Stream', Q355304: 'Watercourse', Q1247867: 'River',
  Q165: 'Sea', Q9430: 'Ocean', Q23397: 'Lake', Q39594: 'Bay',
  Q37901: 'Strait', Q12284: 'Canal', Q166620: 'Drainage basin',
  Q6256: 'Country', Q3624078: 'Country', Q23442: 'Island',
  Q40080: 'Beach', Q185113: 'Cape', Q184358: 'Gulf', Q45776: 'Reservoir',
  Q131681: 'Reservoir', Q43501: 'Zoo'
};

const WATER_TYPES = new Set(['River', 'Stream', 'Watercourse', 'Sea', 'Ocean', 'Lake', 'Bay', 'Strait', 'Canal', 'Gulf', 'Reservoir']);

/**
 * P18 comes back from SPARQL already as a Commons Special:FilePath URL, so it
 * only needs a width so we are not pulling full-resolution originals.
 */
function imageUrl(binding) {
  const value = binding?.value;
  return typeof value === 'string' && value ? `${value}?width=400` : null;
}

/** Only genuine Q-ids; literal-valued properties must not leak through. */
function qid(binding) {
  const value = typeof binding === 'string' ? binding : binding?.value;
  if (typeof value !== 'string') return null;
  if (binding && typeof binding === 'object' && binding.type && binding.type !== 'uri') return null;
  const id = value.split('/').pop();
  return /^Q\d+$/.test(id) ? id : null;
}

/** Property ids are P-ids, not Q-ids. */
function propId(binding) {
  const id = typeof binding?.value === 'string' ? binding.value.split('/').pop() : null;
  return id && /^P\d+$/.test(id) ? id : null;
}

/** Relations pointing away from the given entities. */
function forwardQuery(qids, limit) {
  const values = qids.map(q => `wd:${q}`).join(' ');
  const props = Object.keys(FORWARD).map(p => `wdt:${p}`).join(' ');
  return `
SELECT ?src ?srcCls ?srcClsLabel ?p ?tgt ?tgtLabel ?tgtDescription ?cls ?clsLabel ?img WHERE {
  VALUES ?src { ${values} }
  VALUES ?p { ${props} }
  ?src ?p ?tgt .
  OPTIONAL { ?src wdt:P31 ?srcCls . }
  OPTIONAL { ?tgt wdt:P31 ?cls . }
  OPTIONAL { ?tgt wdt:P18 ?img . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${limit}`;
}

/**
 * Relations pointing *at* the given entities. Essential for seas and oceans:
 * a sea rarely lists what drains into it, but every river names its mouth.
 */
function inverseQuery(qids, limit) {
  const values = qids.map(q => `wd:${q}`).join(' ');
  return `
SELECT ?src ?p ?tgt ?tgtLabel ?tgtDescription ?cls ?clsLabel ?img WHERE {
  VALUES ?src { ${values} }
  VALUES ?p { wdt:P403 wdt:P361 wdt:P201 }
  ?tgt ?p ?src .
  OPTIONAL { ?tgt wdt:P31 ?cls . }
  OPTIONAL { ?tgt wdt:P18 ?img . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${limit}`;
}

/**
 * Wikidata types water far more finely than a filter sidebar can use -
 * "mountain river", "source river" and "brook" are all, for our purposes,
 * rivers and streams. Fold the obvious families together.
 */
function normaliseType(label) {
  const l = label.toLowerCase();
  if (/\b(ocean)\b/.test(l)) return 'Ocean';
  if (/\b(sea)\b/.test(l)) return 'Sea';
  if (/\b(river|watercourse)\b/.test(l)) return 'River';
  if (/\b(stream|brook|creek)\b/.test(l)) return 'Stream';
  if (/\b(lake|reservoir|pond)\b/.test(l)) return 'Lake';
  if (/\b(bay|gulf|fjord)\b/.test(l)) return 'Bay';
  if (/\b(strait|channel)\b/.test(l)) return 'Strait';
  if (/\b(canal)\b/.test(l)) return 'Canal';
  if (/\b(basin|catchment)\b/.test(l)) return 'Drainage basin';
  if (/\b(country|state|republic)\b/.test(l)) return 'Country';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function typeOf(clsQid, clsLabel) {
  if (clsQid && TYPES[clsQid]) return TYPES[clsQid];
  if (clsLabel && !/^Q\d+$/.test(clsLabel)) return normaliseType(clsLabel);
  return 'Water body';
}

async function buildGraph({ topic, seeds = 6, maxNodes = 250, depth = 2, onProgress = () => {} }) {
  onProgress(`Finding water bodies matching "${topic}"...`);

  const hits = await searchWikipedia(topic, Math.min(seeds * 3, 20));
  if (hits.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no Wikipedia matches' } };
  }

  // A text search for "Atlantic Ocean" also returns "Atlantic Ocean Road".
  // Check each candidate's P31/P279 and keep only actual water bodies.
  onProgress('Checking which results are water bodies...');
  const entities = await fetchEntities(hits.map(h => h.qid));
  const isWater = (q) => {
    const entity = entities[q];
    if (!entity) return false;
    const classes = [...claimTargets(entity, 'P31'), ...claimTargets(entity, 'P279')];
    return classes.some(c => WATER_TYPES.has(TYPES[c]));
  };

  let pages = hits.filter(h => isWater(h.qid)).slice(0, seeds);
  // If nothing passes (an obscure class, say) fall back to the top hit rather
  // than returning an empty graph.
  if (pages.length === 0) pages = hits.slice(0, 1);

  const nodes = new Map();
  const edges = [];
  const seenEdge = new Set();
  const typeHints = new Map();

  const addNode = (id, label, { type, description, isSeed, extract, image } = {}) => {
    if (!id || !label) return;
    const existing = nodes.get(id);
    if (existing) {
      if (type && existing.group === 'Water body') existing.group = type;
      if (image && !existing.metadata.image) existing.metadata.image = image;
      return;
    }
    nodes.set(id, {
      externalId: id,
      label,
      group: type || 'Water body',
      info: truncate(extract || description || label),
      tags: [],
      metadata: {
        wikidataId: id,
        wikidataUrl: `https://www.wikidata.org/wiki/${id}`,
        ...(image ? { image } : {})
      }
    });
  };

  const addEdge = (from, to, label) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${label}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'wikidata-sparql' } });
  };

  for (const page of pages) {
    addNode(page.qid, page.title, { isSeed: true, extract: page.extract, image: page.thumbnail });
  }

  let frontier = pages.map(p => p.qid);
  const expanded = new Set();

  for (let level = 0; level < Math.max(1, depth) && frontier.length > 0; level++) {
    const batch = frontier.filter(q => !expanded.has(q)).slice(0, 40);
    if (batch.length === 0) break;
    batch.forEach(q => expanded.add(q));

    onProgress(`Level ${level + 1}: tracing ${batch.length} water bodies...`);

    const budget = Math.max(0, maxNodes - nodes.size);
    const limit = Math.min(600, Math.max(120, budget * 3));

    const [forward, inverse] = await Promise.all([
      runSparql(forwardQuery(batch, limit)),
      runSparql(inverseQuery(batch, Math.min(limit, 300)))
    ]);

    const nextCounts = new Map();

    const ingestRow = (row, isInverse) => {
      const src = qid(row.src);
      const tgt = qid(row.tgt);
      const prop = propId(row.p);
      if (!src || !tgt || !prop) return;

      const label = row.tgtLabel?.value;
      // The label service returns the bare Q-id when no English label exists.
      if (!label || /^Q\d+$/.test(label)) return;

      // The forward query also reports the source's class; use it so seed
      // nodes are typed instead of staying a generic "Water body".
      const srcType = row.srcClsLabel?.value
        ? typeOf(qid(row.srcCls), row.srcClsLabel.value)
        : null;
      if (srcType && nodes.has(src) && nodes.get(src).group === 'Water body') {
        nodes.get(src).group = srcType;
      }

      const type = typeOf(qid(row.cls), row.clsLabel?.value);

      // Inverse "part of" on an ocean matches every shipwreck, dive site and
      // beach within it. Only water bodies belong in a hydrology graph.
      if (isInverse && !WATER_TYPES.has(type)) return;

      // "Part of" points the other way too: the Atlantic is part of Earth.
      // Containment is only meaningful here between bodies of water.
      if (prop === 'P361' && !WATER_TYPES.has(type)) return;

      typeHints.set(tgt, type);
      addNode(tgt, label, { type, description: row.tgtDescription?.value, image: imageUrl(row.img) });

      if (isInverse) {
        // The row's ?tgt is the subject: "tgt --P--> src".
        const [edgeLabel, reverse] = FORWARD[prop] || ['related to', false];
        if (reverse) addEdge(src, tgt, edgeLabel);
        else addEdge(tgt, src, edgeLabel);
      } else {
        const [edgeLabel, reverse] = FORWARD[prop] || ['related to', false];
        if (reverse) addEdge(tgt, src, edgeLabel);
        else addEdge(src, tgt, edgeLabel);
      }

      // Only water bodies are worth expanding further - countries and basins
      // are leaves, and following them would drag in unrelated geography.
      if (WATER_TYPES.has(type) && !expanded.has(tgt)) {
        nextCounts.set(tgt, (nextCounts.get(tgt) || 0) + 1);
      }
    };

    forward.forEach(r => ingestRow(r, false));
    inverse.forEach(r => ingestRow(r, true));

    if (nodes.size >= maxNodes) break;
    frontier = topByCount(nextCounts, Math.min(40, maxNodes - nodes.size));
  }

  const nodeList = [...nodes.values()].slice(0, maxNodes);
  const keep = new Set(nodeList.map(n => n.externalId));
  const keptEdges = edges.filter(e => keep.has(e.fromExternalId) && keep.has(e.toExternalId));

  return {
    nodes: nodeList,
    edges: keptEdges,
    stats: {
      topic,
      seeds: pages.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      waterBodies: nodeList.filter(n => WATER_TYPES.has(n.group)).length,
      flowEdges: keptEdges.filter(e => e.label === 'flows into').length,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'hydrology',
  label: 'Rivers & Oceans',
  description: 'Drainage networks: tributaries, mouths, basins, seas and oceans',
  placeholder: 'e.g. Danube, Amazon River, North Sea, Atlantic Ocean',
  buildGraph
};
