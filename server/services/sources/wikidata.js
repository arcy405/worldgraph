/**
 * Wikipedia + Wikidata ingestion.
 *
 * Wikipedia supplies the human-readable description and the seed set; Wikidata
 * supplies the typed relations. We only keep `wikibase-item` claims (real links
 * to other entities) and `time` claims (dates) - the bulk of a Wikidata entity
 * is `external-id` cross-references, which carry no graph value.
 */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WD_API = 'https://www.wikidata.org/w/api.php';

// Wikimedia's API etiquette requires a descriptive User-Agent on every request.
const USER_AGENT = 'WorldGraph/3.0 (knowledge graph ingest; https://github.com/worldgraph)';

// wbgetentities accepts at most 50 ids per call.
const ENTITY_BATCH = 50;

/**
 * Relation properties worth drawing an edge for, mapped to a readable label.
 * Deliberately an allowlist: Wikidata has ~12k properties and most of them
 * ("described by source", "different from", "Commons category") produce edges
 * that make the graph noisier without making it more informative.
 */
const RELATION_PROPS = {
  P279: 'subclass of',
  P31: 'instance of',
  P361: 'part of',
  P527: 'has part',
  P155: 'follows',
  P156: 'followed by',
  P144: 'based on',
  P2283: 'uses',
  P366: 'has use',
  P178: 'developer',
  P176: 'manufacturer',
  P170: 'creator',
  P61: 'discoverer or inventor',
  P50: 'author',
  P2093: 'author',
  P108: 'employer',
  P69: 'educated at',
  P1066: 'student of',
  P802: 'student',
  P184: 'doctoral advisor',
  P185: 'doctoral student',
  P112: 'founded by',
  P1830: 'owner of',
  P127: 'owned by',
  P749: 'parent organization',
  P355: 'subsidiary',
  P800: 'notable work',
  P101: 'field of work',
  P135: 'movement',
  P737: 'influenced by',
  P3342: 'significant person',
  P166: 'award received',
  P159: 'headquarters location',
  P17: 'country',
  P495: 'country of origin',
  P463: 'member of',
  P1269: 'facet of',
  P921: 'main subject',
  P275: 'license',
  P348: 'software version',
  P400: 'platform'
};

/** Properties used only to type a node, never to draw an edge. */
const TYPING_PROPS = ['P31', 'P279'];

/** Date properties, in the order we prefer them for a node's `year`. */
const DATE_PROPS = ['P571', 'P569', 'P577', 'P575', 'P580', 'P585'];

/**
 * Wikidata class QID -> WorldGraph entity type. Anything not listed falls back
 * to the English label of its own P31/P279 target, which keeps the type system
 * open (as the Node schema intends) without hardcoding a taxonomy.
 */
const TYPE_MAP = {
  Q5: 'Person',
  Q43229: 'Organization',
  Q4830453: 'Organization',
  Q891723: 'Organization',
  Q6881511: 'Organization',
  Q783794: 'Organization',
  Q3918: 'Organization',
  Q31855: 'Organization',
  Q1664720: 'Organization',
  Q2385804: 'Organization',
  Q327333: 'Organization',
  Q13442814: 'Paper',
  Q591041: 'Paper',
  Q13136: 'Paper',
  Q571: 'Publication',
  Q7397: 'Software',
  Q9143: 'Software',
  Q341: 'Software',
  Q1130645: 'Software',
  Q21127166: 'Software',
  Q24529444: 'Model',
  Q2989397: 'Model',
  Q11660: 'Field',
  Q11862829: 'Field',
  Q4671286: 'Field',
  Q1047113: 'Field',
  Q336: 'Field',
  Q17737: 'Concept',
  Q151885: 'Concept',
  Q7184903: 'Concept',
  Q1149275: 'Concept',
  Q205663: 'Method',
  Q1379672: 'Method',
  Q8366: 'Algorithm',
  Q1412694: 'Algorithm',
  Q6423319: 'Method',
  Q2374463: 'Dataset',
  Q1172284: 'Dataset',
  Q6256: 'Place',
  Q515: 'Place',
  Q1187811: 'Award',
  Q618779: 'Award',
  Q11424: 'Work',
  Q838948: 'Work',
  Q1656682: 'Event',
  Q2020153: 'Event'
};

async function wikiFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Wikimedia API ${res.status} ${res.statusText} for ${url.split('?')[0]}`);
  }
  return res.json();
}

/**
 * Search Wikipedia and return the seed pages, each already carrying its
 * Wikidata QID and intro extract. One request instead of three.
 */
async function searchWikipedia(topic, limit) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: topic,
    gsrlimit: String(Math.min(limit, 50)),
    prop: 'pageprops|extracts|pageimages',
    ppprop: 'wikibase_item',
    piprop: 'thumbnail',
    pithumbsize: '400',
    exintro: '1',
    explaintext: '1',
    format: 'json',
    formatversion: '1'
  });

  const data = await wikiFetch(`${WIKI_API}?${params}`);
  const pages = Object.values(data?.query?.pages || {});

  return pages
    .filter(p => p.pageprops?.wikibase_item)
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map(p => ({
      qid: p.pageprops.wikibase_item,
      title: p.title,
      extract: (p.extract || '').trim(),
      thumbnail: p.thumbnail?.source || null,
      url: `https://en.wikipedia.org/?curid=${p.pageid}`
    }));
}

/** Fetch full Wikidata entities in batches of 50. */
async function fetchEntities(qids) {
  const unique = [...new Set(qids)].filter(Boolean);
  const entities = {};

  for (let i = 0; i < unique.length; i += ENTITY_BATCH) {
    const chunk = unique.slice(i, i + ENTITY_BATCH);
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: chunk.join('|'),
      props: 'labels|descriptions|claims',
      languages: 'en',
      format: 'json'
    });
    const data = await wikiFetch(`${WD_API}?${params}`);
    Object.assign(entities, data.entities || {});
  }

  return entities;
}

/** Fetch labels only - used for class QIDs, where we never need the claims. */
async function fetchLabels(qids) {
  const unique = [...new Set(qids)].filter(Boolean);
  const labels = {};

  for (let i = 0; i < unique.length; i += ENTITY_BATCH) {
    const chunk = unique.slice(i, i + ENTITY_BATCH);
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: chunk.join('|'),
      props: 'labels',
      languages: 'en',
      format: 'json'
    });
    const data = await wikiFetch(`${WD_API}?${params}`);
    for (const [qid, entity] of Object.entries(data.entities || {})) {
      const label = entity.labels?.en?.value;
      if (label) labels[qid] = label;
    }
  }

  return labels;
}

/**
 * The entity's image, as a Commons file-path URL.
 *
 * P18 stores a bare filename ("Alan Turing (1951) (crop).jpg"); Special:FilePath
 * resolves that to the actual file and honours a width parameter, so no extra
 * API call is needed to turn it into a usable thumbnail.
 */
function claimImage(entity, width = 400) {
  for (const claim of entity.claims?.P18 || []) {
    const file = claim.mainsnak?.datavalue?.value;
    if (typeof file !== 'string' || !file) continue;
    const encoded = encodeURIComponent(file.replace(/ /g, '_'));
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
  }
  return null;
}

/** All QIDs a claim list points at, for `wikibase-item` claims only. */
function claimTargets(entity, prop) {
  return (entity.claims?.[prop] || [])
    .filter(c => c.mainsnak?.snaktype === 'value' && c.mainsnak?.datatype === 'wikibase-item')
    .map(c => c.mainsnak.datavalue?.value?.id)
    .filter(Boolean);
}

/**
 * Wikidata times look like "+1950-01-01T00:00:00Z", with a leading sign and a
 * `precision` field. We only want the year, and only when precision is at least
 * year-level (9) - anything coarser is a century estimate, not a date.
 */
function claimYear(entity) {
  for (const prop of DATE_PROPS) {
    for (const claim of entity.claims?.[prop] || []) {
      const snak = claim.mainsnak;
      if (snak?.snaktype !== 'value' || snak?.datatype !== 'time') continue;
      const { time, precision } = snak.datavalue?.value || {};
      if (!time || precision < 9) continue;
      const match = /^([+-])(\d{4})/.exec(time);
      if (!match) continue;
      const year = parseInt(match[2], 10);
      return match[1] === '-' ? -year : year;
    }
  }
  return undefined;
}

/**
 * Resolve an entity's WorldGraph type from its P31/P279 targets.
 * Reports whether the type came from the curated map, because label-derived
 * types are far less trustworthy and get collapsed if they stay rare.
 */
function resolveType(entity, classLabels) {
  const candidates = [];
  for (const prop of TYPING_PROPS) {
    candidates.push(...claimTargets(entity, prop));
  }

  // Prefer an explicitly mapped class.
  for (const qid of candidates) {
    if (TYPE_MAP[qid]) return { type: TYPE_MAP[qid], mapped: true };
  }

  // Otherwise fall back to the class's own label, so the type system stays open
  // rather than collapsing everything unmapped into one bucket.
  for (const qid of candidates) {
    const label = classLabels?.[qid];
    if (label) {
      return { type: label.charAt(0).toUpperCase() + label.slice(1), mapped: false };
    }
  }

  return { type: 'Concept', mapped: false };
}

/**
 * Wikidata's class hierarchy is far finer-grained than a filter sidebar can
 * use - a raw ingest yields dozens of types with a single member each
 * ("Metaclass", "Second-order class", "Hypergraph"). Curated types always
 * survive; label-derived ones only if enough nodes share them.
 */
function collapseRareTypes(nodes, minMembers = 2) {
  const counts = new Map();
  for (const node of nodes) {
    counts.set(node.group, (counts.get(node.group) || 0) + 1);
  }

  let collapsed = 0;
  for (const node of nodes) {
    if (node.mappedType) continue;
    if (counts.get(node.group) >= minMembers) continue;
    node.group = 'Concept';
    collapsed++;
  }
  return collapsed;
}

/** Every relation edge this entity asserts, as {prop, label, target}. */
function extractRelations(entity) {
  const relations = [];
  for (const [prop, label] of Object.entries(RELATION_PROPS)) {
    for (const target of claimTargets(entity, prop)) {
      relations.push({ prop, label, target });
    }
  }
  return relations;
}

/**
 * Assemble a connected graph around a topic.
 *
 * Seeds come from a Wikipedia search; their Wikidata relations point at
 * neighbours. When we have more neighbours than `maxNodes` allows, we keep the
 * ones the most seeds point at - the shared hubs are what make the graph
 * connected, whereas the single-reference leaves are just fringe.
 */
async function buildGraph({
  topic,
  seeds = 20,
  maxNodes = 300,
  depth = 1,
  onProgress = () => {}
}) {
  onProgress(`Searching Wikipedia for "${topic}"...`);
  const pages = await searchWikipedia(topic, seeds);
  if (pages.length === 0) {
    return { nodes: [], edges: [], stats: { seeds: 0, reason: 'no Wikipedia matches' } };
  }

  const pageByQid = new Map(pages.map(p => [p.qid, p]));
  const seedQids = pages.map(p => p.qid);

  onProgress(`Fetching ${seedQids.length} seed entities from Wikidata...`);
  const entities = await fetchEntities(seedQids);
  const expanded = new Set(Object.keys(entities));

  // Count how many already-expanded entities point at each neighbour.
  const inDegree = new Map();
  const tally = qids => {
    for (const qid of qids) {
      if (expanded.has(qid)) continue;
      inDegree.set(qid, (inDegree.get(qid) || 0) + 1);
    }
  };
  for (const entity of Object.values(entities)) {
    tally(extractRelations(entity).map(r => r.target));
  }

  // Each extra depth level expands the best-connected unexpanded neighbours,
  // which pulls in their relations too and thickens the middle of the graph.
  for (let level = 1; level < depth; level++) {
    const budget = maxNodes - expanded.size;
    if (budget <= 0) break;

    const next = [...inDegree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(budget, 50))
      .map(([qid]) => qid)
      .filter(qid => !expanded.has(qid));
    if (next.length === 0) break;

    onProgress(`Depth ${level + 1}: expanding ${next.length} entities...`);
    const more = await fetchEntities(next);
    Object.assign(entities, more);
    for (const qid of Object.keys(more)) {
      expanded.add(qid);
      inDegree.delete(qid);
    }
    for (const entity of Object.values(more)) {
      tally(extractRelations(entity).map(r => r.target));
    }
  }

  // Fill the remaining budget with the best-connected neighbours.
  const budget = Math.max(0, maxNodes - expanded.size);
  const keptNeighbours = [...inDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, budget)
    .map(([qid]) => qid);

  if (keptNeighbours.length > 0) {
    onProgress(`Fetching ${keptNeighbours.length} connected neighbours...`);
    const neighbourEntities = await fetchEntities(keptNeighbours);
    Object.assign(entities, neighbourEntities);
  }

  const included = new Set(Object.keys(entities));

  // Resolve the class labels used for typing, in one batch.
  const classQids = new Set();
  for (const qid of included) {
    for (const prop of TYPING_PROPS) {
      for (const target of claimTargets(entities[qid], prop)) classQids.add(target);
    }
  }
  onProgress(`Resolving ${classQids.size} entity types...`);
  const classLabels = await fetchLabels([...classQids]);

  // Build nodes.
  const nodes = [];
  for (const qid of included) {
    const entity = entities[qid];
    const label = entity.labels?.en?.value;
    if (!label) continue; // no English label - nothing meaningful to show

    const page = pageByQid.get(qid);
    const description = entity.descriptions?.en?.value || '';
    const info = page?.extract || description || `${label} (Wikidata ${qid})`;

    const metadata = { wikidataId: qid, wikidataUrl: `https://www.wikidata.org/wiki/${qid}` };
    if (page?.url) metadata.wikipediaUrl = page.url;
    if (description) metadata.description = description;
    // Prefer the Wikipedia thumbnail (already sized and cropped for display);
    // fall back to the entity's own P18 image.
    const image = page?.thumbnail || claimImage(entity);
    if (image) metadata.image = image;

    const tags = [...new Set(
      TYPING_PROPS
        .flatMap(prop => claimTargets(entity, prop))
        .map(t => classLabels[t])
        .filter(Boolean)
    )].slice(0, 6);

    const { type, mapped } = resolveType(entity, classLabels);

    nodes.push({
      externalId: qid,
      source: 'wikidata',
      label,
      group: type,
      mappedType: mapped,
      year: claimYear(entity),
      info: info.length > 1200 ? `${info.slice(0, 1200)}...` : info,
      tags,
      metadata,
      isSeed: Boolean(page)
    });
  }

  const collapsed = collapseRareTypes(nodes);
  for (const node of nodes) delete node.mappedType;

  const nodeQids = new Set(nodes.map(n => n.externalId));

  // Build edges, keeping only those whose endpoints both survived the cut.
  const edges = [];
  const seenEdge = new Set();
  for (const qid of nodeQids) {
    for (const relation of extractRelations(entities[qid])) {
      if (!nodeQids.has(relation.target) || relation.target === qid) continue;
      const key = `${qid}->${relation.target}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push({
        fromExternalId: qid,
        toExternalId: relation.target,
        label: relation.label,
        metadata: { wikidataProperty: relation.prop, source: 'wikidata' }
      });
    }
  }

  return {
    nodes,
    edges,
    stats: {
      topic,
      seeds: pages.length,
      expanded: expanded.size,
      nodes: nodes.length,
      edges: edges.length,
      types: [...new Set(nodes.map(n => n.group))].length,
      collapsedTypes: collapsed
    }
  };
}

module.exports = {
  id: 'wikidata',
  label: 'Wikipedia + Wikidata',
  description: 'General knowledge: people, organisations, concepts and typed relations',
  placeholder: 'e.g. deep learning, Bauhaus, CRISPR',
  buildGraph,
  searchWikipedia,
  fetchEntities,
  fetchLabels,
  claimTargets,
  claimYear,
  claimImage,
  resolveType,
  collapseRareTypes,
  extractRelations,
  RELATION_PROPS,
  TYPE_MAP,
  TYPING_PROPS
};
