/**
 * OpenAlex - open catalogue of scholarly works, authors and institutions.
 * https://docs.openalex.org  (free, no key required)
 *
 * The reason this source matters: it carries *citation* edges. Wikidata knows
 * "Hinton - employer -> Google" but has essentially no record of which paper
 * cites which, and a citation network is the structure the insights engine is
 * actually looking for - many independent paths between the same two nodes.
 */

const { fetchJson, truncate, topByCount } = require('./http');

const API = 'https://api.openalex.org';

/** OpenAlex ids arrive as URLs ("https://openalex.org/W123"); we want the key. */
function shortId(id) {
  return typeof id === 'string' ? id.split('/').pop() : null;
}

/**
 * OpenAlex sometimes reports a much later `publication_year` because it dates
 * the newest version it has seen - "Attention Is All You Need" comes back as
 * 2025. `created_date` is when OpenAlex first indexed the work, which is too
 * late for genuinely old papers but correct for recent ones. Taking the
 * earlier of the two is right in both directions.
 */
function resolveYear(work) {
  const candidates = [];
  if (work.publication_year) candidates.push(Number(work.publication_year));
  const created = /^(\d{4})/.exec(work.created_date || '');
  if (created) candidates.push(Number(created[1]));
  const valid = candidates.filter(y => Number.isFinite(y) && y > 1000);
  return valid.length ? Math.min(...valid) : undefined;
}

function workNode(work) {
  const id = shortId(work.id);
  const venue = work.primary_location?.source?.display_name;
  const summary = [
    work.type ? work.type.replace(/_/g, ' ') : null,
    venue,
    work.cited_by_count ? `cited ${work.cited_by_count} times` : null
  ].filter(Boolean).join(' · ');

  return {
    externalId: `W:${id}`,
    label: truncate(work.display_name || work.title || id, 200),
    group: 'Paper',
    year: resolveYear(work),
    info: truncate(summary || work.display_name || id),
    tags: (work.topics || []).slice(0, 4).map(t => t.display_name).filter(Boolean),
    metadata: {
      openalexId: id,
      doi: work.doi || undefined,
      citedByCount: work.cited_by_count,
      venue: venue || undefined,
      url: work.id
    }
  };
}

async function buildGraph({ topic, seeds = 25, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  onProgress(`Searching OpenAlex for "${topic}"...`);

  const params = new URLSearchParams({
    search: topic,
    per_page: String(Math.min(seeds, 50)),
    sort: 'relevance_score:desc',
    select: [
      'id', 'display_name', 'publication_year', 'created_date', 'type', 'doi',
      'cited_by_count', 'authorships', 'topics', 'referenced_works',
      'related_works', 'primary_location'
    ].join(',')
  });

  const data = await fetchJson(`${API}/works?${params}`);
  const works = data.results || [];
  if (works.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no OpenAlex matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const addNode = node => {
    if (node && !nodes.has(node.externalId)) nodes.set(node.externalId, node);
  };
  const addEdge = (from, to, label, metadata) => {
    if (from && to && from !== to) edges.push({ fromExternalId: from, toExternalId: to, label, metadata });
  };

  // Order matters: citation structure is the reason to use this source, so
  // cited works claim the node budget before author/institution leaves do.
  // Authors fan out fast (20 papers x 12 authors filled a 200-node budget on
  // its own, leaving nothing for references and yielding 10 citation edges).
  onProgress(`Building ${works.length} papers...`);
  for (const work of works) addNode(workNode(work));

  if (depth >= 2) {
    const referenceCounts = new Map();
    for (const work of works) {
      for (const ref of work.referenced_works || []) {
        const id = shortId(ref);
        if (!id || nodes.has(`W:${id}`)) continue;
        referenceCounts.set(id, (referenceCounts.get(id) || 0) + 1);
      }
    }

    const refBudget = Math.min(
      depth >= 3 ? 120 : 60,
      Math.max(0, Math.floor(maxNodes * 0.45))
    );
    const wanted = topByCount(referenceCounts, refBudget);

    if (wanted.length > 0) {
      onProgress(`Fetching ${wanted.length} most-cited references...`);
      for (let i = 0; i < wanted.length; i += 50) {
        const chunk = wanted.slice(i, i + 50);
        const refParams = new URLSearchParams({
          filter: `openalex_id:${chunk.map(id => `https://openalex.org/${id}`).join('|')}`,
          per_page: String(chunk.length),
          select: 'id,display_name,publication_year,created_date,type,doi,cited_by_count,topics,primary_location'
        });
        const refData = await fetchJson(`${API}/works?${refParams}`);
        for (const ref of refData.results || []) addNode(workNode(ref));
      }
    }
  }

  onProgress('Linking citations...');
  for (const work of works) {
    const fromId = `W:${shortId(work.id)}`;
    for (const ref of work.referenced_works || []) {
      const toId = `W:${shortId(ref)}`;
      if (nodes.has(toId)) addEdge(fromId, toId, 'cites', { source: 'openalex' });
    }
    for (const rel of (work.related_works || []).slice(0, 5)) {
      const toId = `W:${shortId(rel)}`;
      if (nodes.has(toId)) addEdge(fromId, toId, 'related to', { source: 'openalex' });
    }
  }

  // Whatever budget survives goes to people, institutions and topics.
  onProgress('Adding authors, institutions and topics...');
  for (const work of works) {
    const workId = `W:${shortId(work.id)}`;

    for (const t of (work.topics || []).slice(0, 3)) {
      const topicId = shortId(t.id);
      if (!topicId) continue;
      addNode({
        externalId: `T:${topicId}`,
        label: t.display_name,
        group: 'Field',
        info: truncate(`Research topic${t.field?.display_name ? ` · ${t.field.display_name}` : ''}`),
        tags: [t.domain?.display_name].filter(Boolean),
        metadata: { openalexId: topicId }
      });
      addEdge(workId, `T:${topicId}`, 'main subject', { source: 'openalex' });
    }

    if (nodes.size >= maxNodes) continue;

    for (const authorship of (work.authorships || []).slice(0, 6)) {
      const authorId = shortId(authorship.author?.id);
      if (!authorId) continue;
      if (nodes.size >= maxNodes && !nodes.has(`A:${authorId}`)) break;

      const institutions = authorship.institutions || [];
      addNode({
        externalId: `A:${authorId}`,
        label: authorship.author.display_name,
        group: 'Person',
        info: truncate(`Researcher · ${institutions.map(i => i.display_name).join(', ') || 'no listed affiliation'}`),
        tags: [],
        metadata: { openalexId: authorId, url: authorship.author.id }
      });
      addEdge(workId, `A:${authorId}`, 'author', { source: 'openalex' });

      for (const institution of institutions.slice(0, 1)) {
        const instId = shortId(institution.id);
        if (!instId) continue;
        addNode({
          externalId: `I:${instId}`,
          label: institution.display_name,
          group: 'Organization',
          info: truncate(`${institution.type || 'Institution'}${institution.country_code ? ` · ${institution.country_code}` : ''}`),
          tags: [institution.country_code].filter(Boolean),
          metadata: { openalexId: instId, url: institution.id }
        });
        addEdge(`A:${authorId}`, `I:${instId}`, 'affiliated with', { source: 'openalex' });
      }
    }
  }

  const nodeList = [...nodes.values()];
  const citationEdges = edges.filter(e => e.label === 'cites').length;

  return {
    nodes: nodeList,
    edges,
    stats: {
      topic,
      seeds: works.length,
      nodes: nodeList.length,
      edges: edges.length,
      citationEdges,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'openalex',
  label: 'OpenAlex',
  description: 'Scholarly papers, authors, institutions and citation edges',
  placeholder: 'e.g. transformer architecture, CRISPR off-target',
  buildGraph
};
