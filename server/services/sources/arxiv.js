/**
 * arXiv - preprints in physics, maths, CS and quantitative biology.
 * https://info.arxiv.org/help/api  (free, no key)
 *
 * The API answers in Atom XML. The feed is small and highly regular, so it is
 * parsed here with targeted regexes rather than by adding an XML dependency;
 * anything more complex than this feed should get a real parser instead.
 */

const { fetchText, decodeXml, truncate } = require('./http');

const API = 'https://export.arxiv.org/api/query';

/** Pull every <entry> block out of the Atom feed. */
function splitEntries(xml) {
  return xml.split(/<entry>/).slice(1).map(chunk => chunk.split(/<\/entry>/)[0]);
}

function tagText(entry, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(entry);
  return match ? decodeXml(match[1]).replace(/\s+/g, ' ').trim() : null;
}

function allAttr(entry, tag, attr) {
  const out = [];
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`, 'g');
  let m;
  while ((m = re.exec(entry)) !== null) out.push(decodeXml(m[1]));
  return out;
}

function authorNames(entry) {
  const out = [];
  const re = /<author>([\s\S]*?)<\/author>/g;
  let m;
  while ((m = re.exec(entry)) !== null) {
    const name = tagText(m[1] + '</name>', 'name') || tagText(m[1], 'name');
    if (name) out.push(name);
  }
  return out;
}

/** "http://arxiv.org/abs/2201.00978v1" -> "2201.00978" */
function arxivId(idUrl) {
  const m = /abs\/([^v\s]+)/.exec(idUrl || '');
  return m ? m[1] : null;
}

async function buildGraph({ topic, seeds = 25, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  onProgress(`Searching arXiv for "${topic}"...`);

  const params = new URLSearchParams({
    search_query: `all:${topic}`,
    max_results: String(Math.min(seeds, 60)),
    sortBy: 'relevance',
    sortOrder: 'descending'
  });

  // arXiv's query endpoint is frequently slow to respond; 25s is not enough.
  const xml = await fetchText(`${API}?${params}`, { timeoutMs: 60000, retries: 2 });
  const entries = splitEntries(xml);
  if (entries.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no arXiv matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const addNode = n => { if (n && !nodes.has(n.externalId)) nodes.set(n.externalId, n); };
  const addEdge = (from, to, label) => {
    if (from && to && from !== to) edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'arxiv' } });
  };

  onProgress(`Building ${entries.length} preprints, authors and categories...`);

  const paperIds = new Set();
  const parsed = [];

  for (const entry of entries) {
    const id = arxivId(tagText(entry, 'id'));
    if (!id) continue;
    const title = tagText(entry, 'title');
    const summary = tagText(entry, 'summary');
    const published = tagText(entry, 'published');
    const year = published ? Number(published.slice(0, 4)) : undefined;
    const categories = allAttr(entry, 'category', 'term');
    const comment = tagText(entry, 'arxiv:comment') || '';

    paperIds.add(id);
    parsed.push({ id, entry, comment, summary });

    addNode({
      externalId: `P:${id}`,
      label: truncate(title || id, 200),
      group: 'Paper',
      year: Number.isFinite(year) ? year : undefined,
      info: truncate(summary || title || id),
      tags: categories.slice(0, 4),
      metadata: { arxivId: id, url: `https://arxiv.org/abs/${id}` }
    });

    for (const name of authorNames(entry).slice(0, 8)) {
      const key = `A:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      addNode({
        externalId: key,
        label: name,
        group: 'Person',
        info: truncate(`arXiv author`),
        tags: [],
        metadata: {}
      });
      addEdge(`P:${id}`, key, 'author');
    }

    for (const category of categories.slice(0, 3)) {
      const key = `C:${category}`;
      addNode({
        externalId: key,
        label: category,
        group: 'Field',
        info: truncate(`arXiv subject category ${category}`),
        tags: [],
        metadata: {}
      });
      addEdge(`P:${id}`, key, 'category');
    }
  }

  // arXiv has no reference list, but papers routinely cite each other by id in
  // the abstract or the comment field ("an extension of arXiv:2103.00112").
  if (depth >= 2) {
    onProgress('Scanning abstracts for arXiv cross-references...');
    for (const { id, comment, summary } of parsed) {
      const text = `${comment} ${summary || ''}`;
      const re = /arxiv:\s*(\d{4}\.\d{4,5})/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (paperIds.has(m[1])) addEdge(`P:${id}`, `P:${m[1]}`, 'references');
      }
    }
  }

  const nodeList = [...nodes.values()].slice(0, maxNodes);
  const keep = new Set(nodeList.map(n => n.externalId));
  const keptEdges = edges.filter(e => keep.has(e.fromExternalId) && keep.has(e.toExternalId));

  return {
    nodes: nodeList,
    edges: keptEdges,
    stats: {
      topic,
      seeds: parsed.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'arxiv',
  label: 'arXiv',
  description: 'Preprints with authors and subject categories',
  placeholder: 'e.g. diffusion models, topological insulator',
  buildGraph
};
