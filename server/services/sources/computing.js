/**
 * The history of computing, via the Wikidata Query Service (SPARQL).
 *
 * The generic Wikidata source can reach this material, but it walks broad
 * properties and seeds from a text search. Computing history has a specific
 * shape worth following directly: languages declare what influenced them,
 * systems declare what they succeeded, and machines declare who designed them.
 * Traversed properly that yields a genealogy - Fortran to C to C++ - rather
 * than a flat list of related pages.
 *
 * Edges point forward in time wherever the property allows, so an arrow reads
 * "led to" and the graph can be followed chronologically.
 */

const { runSparql, truncate, topByCount } = require('./http');
const { searchWikipedia, fetchLabels } = require('./wikidata');

/** property: [edge label, reverse?] - reverse flips the edge to point forward. */
const RELATIONS = {
  P737: ['influenced', true],       // X influenced by Y  ->  Y influenced X
  P155: ['led to', true],           // X follows Y        ->  Y led to X
  P156: ['led to', false],          // X followed by Y    ->  X led to Y
  P144: ['based on', false],
  P287: ['designed by', false],
  P178: ['developed by', false],
  P170: ['created by', false],
  P112: ['founded by', false],
  P108: ['employer', false],
  P176: ['manufacturer', false],
  P279: ['subclass of', false],
  P366: ['used for', false],
  P1056: ['produces', false],
  P400: ['platform', false],
  P277: ['written in', false],
  P169: ['chief executive', false],
  P166: ['award received', false]
};

const TYPES = {
  Q9143: 'Programming language', Q21562092: 'Programming language',
  Q9135: 'Operating system', Q7397: 'Software', Q341: 'Software',
  Q1130645: 'Software', Q218616: 'Software',
  Q68: 'Computer', Q3966: 'Hardware', Q5300: 'Hardware', Q82586: 'Hardware',
  Q5: 'Person',
  Q4830453: 'Company', Q783794: 'Company', Q891723: 'Company', Q6881511: 'Company',
  Q43229: 'Organization', Q31855: 'Research institute', Q3918: 'University',
  Q11862829: 'Field', Q4671286: 'Field', Q336: 'Field', Q11660: 'Field',
  Q8366: 'Algorithm', Q17737: 'Concept', Q151885: 'Concept',
  Q13442814: 'Paper', Q571: 'Publication',
  Q1301371: 'Standard', Q317623: 'Standard',
  Q1668024: 'Product', Q2424752: 'Product'
};

/** Fold Wikidata's finer classes into a small, filterable set. */
function normaliseType(label) {
  const l = label.toLowerCase();
  if (/programming language|language/.test(l)) return 'Programming language';
  if (/operating system/.test(l)) return 'Operating system';
  if (/software|application|library|framework|compiler/.test(l)) return 'Software';
  if (/computer|mainframe|microprocessor|processor|hardware|console/.test(l)) return 'Hardware';
  if (/human|person/.test(l)) return 'Person';
  if (/company|business|corporation|enterprise/.test(l)) return 'Company';
  if (/university|institute|laborator|organi[sz]ation|agency/.test(l)) return 'Organization';
  if (/discipline|field|science|study/.test(l)) return 'Field';
  if (/algorithm|method|technique/.test(l)) return 'Algorithm';
  if (/standard|specification|protocol/.test(l)) return 'Standard';
  if (/article|paper|journal|book/.test(l)) return 'Publication';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function typeOf(clsQid, clsLabel) {
  if (clsQid && TYPES[clsQid]) return TYPES[clsQid];
  if (clsLabel && !/^Q\d+$/.test(clsLabel)) return normaliseType(clsLabel);
  return 'Concept';
}

/** P18 arrives from SPARQL as a Commons Special:FilePath URL; size it down. */
function imageUrl(binding) {
  const value = binding?.value;
  return typeof value === 'string' && value ? `${value}?width=400` : null;
}

const CURATED_TYPES = new Set(Object.values(TYPES));

/**
 * Wikidata classes every entity far more finely than a filter sidebar can use.
 * A single C ingest produced 27 types, most with one member ("Trademark",
 * "Big Brother Awards"). Curated types always survive; label-derived ones only
 * if enough nodes share them.
 */
/** Property ids come back as prop/direct/P123 URIs, not Q-ids. */
function propId(binding) {
  const value = binding?.value;
  if (typeof value !== 'string') return null;
  const id = value.split('/').pop();
  return /^P\d+$/.test(id) ? id : null;
}

function collapseRareTypes(nodeList, minMembers = 3) {
  const counts = new Map();
  for (const node of nodeList) counts.set(node.group, (counts.get(node.group) || 0) + 1);

  let collapsed = 0;
  for (const node of nodeList) {
    if (CURATED_TYPES.has(node.group)) continue;
    if ((counts.get(node.group) || 0) >= minMembers) continue;
    node.group = 'Concept';
    collapsed++;
  }
  return collapsed;
}

/**
 * Extract a Wikidata entity id from a binding.
 *
 * Some properties are literal-valued - P348 (software version) yields strings
 * like "2.0" - and naively splitting the value on "/" let those through as if
 * they were entity ids. They then reappeared in the next query as `wd:2.0`,
 * which the endpoint rejects with a 400. Only accept genuine Q-ids.
 */
function qid(binding) {
  const value = typeof binding === 'string' ? binding : binding?.value;
  if (typeof value !== 'string') return null;
  if (binding && typeof binding === 'object' && binding.type && binding.type !== 'uri') return null;
  const id = value.split('/').pop();
  return /^Q\d+$/.test(id) ? id : null;
}

/** "+1972-01-01T00:00:00Z" -> 1972 */
function yearOf(binding) {
  const match = /^([+-]?)(\d{4})/.exec(binding?.value || '');
  if (!match) return undefined;
  const year = Number(match[2]);
  if (!Number.isFinite(year)) return undefined;
  return match[1] === '-' ? -year : year;
}

function expansionQuery(qids, limit) {
  const values = qids.map(q => `wd:${q}`).join(' ');
  const props = Object.keys(RELATIONS).map(p => `wdt:${p}`).join(' ');
  return `
SELECT ?src ?p ?tgt ?tgtLabel ?tgtDescription ?cls ?clsLabel ?inception ?birth ?img WHERE {
  VALUES ?src { ${values} }
  VALUES ?p { ${props} }
  ?src ?p ?tgt .
  OPTIONAL { ?tgt wdt:P31 ?cls . }
  OPTIONAL { ?tgt wdt:P18 ?img . }
  OPTIONAL { ?tgt wdt:P571 ?inception . }
  OPTIONAL { ?tgt wdt:P569 ?birth . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${limit}`;
}

/** Dates for the seed entities, which never appear as a ?tgt. */
function seedFactsQuery(qids) {
  const values = qids.map(q => `wd:${q}`).join(' ');
  return `
SELECT ?src ?cls ?clsLabel ?inception ?birth WHERE {
  VALUES ?src { ${values} }
  OPTIONAL { ?src wdt:P31 ?cls . }
  OPTIONAL { ?src wdt:P571 ?inception . }
  OPTIONAL { ?src wdt:P569 ?birth . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 200`;
}

async function buildGraph({ topic, seeds = 12, maxNodes = 250, depth = 2, onProgress = () => {} }) {
  onProgress(`Searching for "${topic}"...`);
  const pages = await searchWikipedia(topic, Math.min(seeds, 20));
  if (pages.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no Wikipedia matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const seenEdge = new Set();
  const unresolvedLabels = new Set();

  const addNode = (id, label, { type, description, year, extract, image } = {}) => {
    if (!id || !label) return;
    const existing = nodes.get(id);
    if (existing) {
      if (type && existing.group === 'Concept') existing.group = type;
      if (year !== undefined && existing.year === undefined) existing.year = year;
      if (image && !existing.metadata.image) existing.metadata.image = image;
      return;
    }
    nodes.set(id, {
      externalId: id,
      label,
      group: type || 'Concept',
      year,
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

  for (const page of pages) addNode(page.qid, page.title, { extract: page.extract, image: page.thumbnail });

  // Type and date the seeds; they only ever appear as a subject below.
  onProgress('Dating and typing the seed entities...');
  for (const row of await runSparql(seedFactsQuery(pages.map(p => p.qid)))) {
    const id = qid(row.src);
    const node = nodes.get(id);
    if (!node) continue;
    const type = typeOf(qid(row.cls), row.clsLabel?.value);
    if (node.group === 'Concept') node.group = type;
    const year = yearOf(row.inception) ?? yearOf(row.birth);
    if (year !== undefined && node.year === undefined) node.year = year;
  }

  let frontier = pages.map(p => p.qid);
  const expanded = new Set();

  for (let level = 0; level < Math.max(1, depth) && frontier.length > 0; level++) {
    const batch = frontier.filter(q => !expanded.has(q)).slice(0, 35);
    if (batch.length === 0) break;
    batch.forEach(q => expanded.add(q));

    onProgress(`Level ${level + 1}: tracing ${batch.length} entities...`);
    const budget = Math.max(0, maxNodes - nodes.size);
    const rows = await runSparql(expansionQuery(batch, Math.min(700, Math.max(150, budget * 4))));

    const nextCounts = new Map();

    for (const row of rows) {
      const src = qid(row.src);
      const tgt = qid(row.tgt);
      const prop = propId(row.p);
      if (!src || !tgt || !prop) continue;

      let label = row.tgtLabel?.value;
      // The label service echoes the Q-id when it has no English label. Unlike
      // the hydrology source we keep these - "C" and "Unix" turn up this way -
      // and resolve them from the entity API afterwards.
      if (!label || /^Q\d+$/.test(label)) {
        unresolvedLabels.add(tgt);
        label = tgt;
      }

      const type = typeOf(qid(row.cls), row.clsLabel?.value);
      const year = yearOf(row.inception) ?? yearOf(row.birth);
      addNode(tgt, label, { type, description: row.tgtDescription?.value, year, image: imageUrl(row.img) });

      const [edgeLabel, reverse] = RELATIONS[prop] || ['related to', false];
      if (reverse) addEdge(tgt, src, edgeLabel);
      else addEdge(src, tgt, edgeLabel);

      // Follow things that carry lineage; people and companies are leaves here.
      if (!expanded.has(tgt) && !['Person', 'Company', 'Organization', 'Field'].includes(type)) {
        nextCounts.set(tgt, (nextCounts.get(tgt) || 0) + 1);
      }
    }

    if (nodes.size >= maxNodes) break;
    frontier = topByCount(nextCounts, Math.min(35, maxNodes - nodes.size));
  }

  if (unresolvedLabels.size > 0) {
    onProgress(`Resolving ${unresolvedLabels.size} missing labels...`);
    const resolved = await fetchLabels([...unresolvedLabels]);
    for (const [id, label] of Object.entries(resolved)) {
      const node = nodes.get(id);
      if (node && node.label === id) node.label = label;
    }
    // Anything still nameless is not worth showing.
    for (const id of unresolvedLabels) {
      if (nodes.get(id)?.label === id) nodes.delete(id);
    }
  }

  const nodeList = [...nodes.values()].slice(0, maxNodes);
  const collapsed = collapseRareTypes(nodeList);
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
      lineageEdges: keptEdges.filter(e => e.label === 'influenced' || e.label === 'led to').length,
      dated: nodeList.filter(n => n.year !== undefined).length,
      types: [...new Set(nodeList.map(n => n.group))].length,
      collapsedTypes: collapsed
    }
  };
}

module.exports = {
  id: 'computing',
  label: 'Computing History',
  description: 'Languages, systems and machines, and the lineage between them',
  placeholder: 'e.g. C programming language, Unix, ENIAC, Smalltalk',
  buildGraph
};
