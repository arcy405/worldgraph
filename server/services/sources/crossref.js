/**
 * Crossref - the DOI registration agency's metadata API.
 * https://api.crossref.org  (free, no key)
 *
 * Overlaps OpenAlex on papers, but reaches material OpenAlex indexes thinly
 * (books, standards, conference proceedings) and carries publisher/journal
 * structure that OpenAlex flattens.
 */

const { fetchJson, truncate } = require('./http');

const API = 'https://api.crossref.org';

/** Crossref has no author ids unless an ORCID is registered, so fall back to a
 *  normalised name. That conflates genuine namesakes - the tradeoff is
 *  accepted here because the alternative is no author nodes at all. */
function authorKey(author) {
  if (author.ORCID) return `O:${author.ORCID.split('/').pop()}`;
  const name = `${author.given || ''} ${author.family || ''}`.trim().toLowerCase();
  return name ? `N:${name.replace(/[^a-z0-9]+/g, '-')}` : null;
}

function authorName(author) {
  return `${author.given || ''} ${author.family || ''}`.trim() || author.name || 'Unknown';
}

function issuedYear(item) {
  const parts = item.issued?.['date-parts']?.[0];
  const year = Array.isArray(parts) ? Number(parts[0]) : NaN;
  return Number.isFinite(year) && year > 1000 ? year : undefined;
}

async function buildGraph({ topic, seeds = 25, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  onProgress(`Searching Crossref for "${topic}"...`);

  const params = new URLSearchParams({
    query: topic,
    rows: String(Math.min(seeds, 50)),
    select: 'DOI,title,author,issued,container-title,publisher,type,is-referenced-by-count,reference'
  });

  const data = await fetchJson(`${API}/works?${params}`);
  const items = data.message?.items || [];
  if (items.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no Crossref matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const addNode = n => { if (n && !nodes.has(n.externalId)) nodes.set(n.externalId, n); };
  const addEdge = (from, to, label) => {
    if (from && to && from !== to) edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'crossref' } });
  };

  onProgress(`Building ${items.length} works, authors and publishers...`);

  const knownDois = new Set(items.map(i => (i.DOI || '').toLowerCase()).filter(Boolean));

  for (const item of items) {
    const doi = (item.DOI || '').toLowerCase();
    if (!doi) continue;

    const title = Array.isArray(item.title) ? item.title[0] : item.title;
    const journal = Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'];

    addNode({
      externalId: `D:${doi}`,
      label: truncate(title || doi, 200),
      group: 'Paper',
      year: issuedYear(item),
      info: truncate([
        (item.type || '').replace(/-/g, ' '),
        journal,
        item['is-referenced-by-count'] ? `cited ${item['is-referenced-by-count']} times` : null
      ].filter(Boolean).join(' · ') || title),
      tags: [item.type].filter(Boolean),
      metadata: { doi, url: `https://doi.org/${doi}`, citedByCount: item['is-referenced-by-count'] }
    });

    for (const author of (item.author || []).slice(0, 8)) {
      const key = authorKey(author);
      if (!key) continue;
      addNode({
        externalId: `A:${key}`,
        label: authorName(author),
        group: 'Person',
        info: truncate(`Author${author.ORCID ? ` · ORCID ${author.ORCID.split('/').pop()}` : ''}`),
        tags: [],
        metadata: author.ORCID ? { orcid: author.ORCID } : {}
      });
      addEdge(`D:${doi}`, `A:${key}`, 'author');
    }

    // Reports and preprints sometimes repeat the title as the container name,
    // which would otherwise produce a "published in itself" edge.
    const journalIsTitle = journal && title &&
      journal.trim().toLowerCase() === title.trim().toLowerCase();

    if (journal && !journalIsTitle) {
      const journalKey = `J:${journal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
      addNode({
        externalId: journalKey,
        label: truncate(journal, 150),
        group: 'Publication',
        info: truncate(`Journal or series${item.publisher ? ` · published by ${item.publisher}` : ''}`),
        tags: [],
        metadata: {}
      });
      addEdge(`D:${doi}`, journalKey, 'published in');

      if (item.publisher) {
        const pubKey = `P:${item.publisher.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
        addNode({
          externalId: pubKey,
          label: truncate(item.publisher, 150),
          group: 'Organization',
          info: truncate('Publisher'),
          tags: [],
          metadata: {}
        });
        addEdge(journalKey, pubKey, 'publisher');
      }
    }

    // Crossref returns the reference list only for publishers that deposit it,
    // so citation edges here are sparser than OpenAlex's.
    if (depth >= 2) {
      for (const ref of (item.reference || []).slice(0, 30)) {
        const refDoi = (ref.DOI || '').toLowerCase();
        if (refDoi && knownDois.has(refDoi)) addEdge(`D:${doi}`, `D:${refDoi}`, 'cites');
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
      seeds: items.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      citationEdges: keptEdges.filter(e => e.label === 'cites').length,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'crossref',
  label: 'Crossref',
  description: 'DOI records: works, authors, journals and publishers',
  placeholder: 'e.g. graph neural network, climate attribution',
  buildGraph
};
