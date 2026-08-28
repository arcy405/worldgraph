/**
 * Open Library - the Internet Archive's open book catalogue.
 * https://openlibrary.org/developers/api  (free, no key)
 */

const { fetchJson, truncate } = require('./http');

const API = 'https://openlibrary.org';

async function buildGraph({ topic, seeds = 25, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  onProgress(`Searching Open Library for "${topic}"...`);

  const params = new URLSearchParams({
    q: topic,
    limit: String(Math.min(seeds, 50)),
    fields: 'key,title,author_name,author_key,first_publish_year,subject,publisher,language,edition_count'
  });

  const data = await fetchJson(`${API}/search.json?${params}`);
  const docs = data.docs || [];
  if (docs.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no Open Library matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const addNode = n => { if (n && !nodes.has(n.externalId)) nodes.set(n.externalId, n); };
  const addEdge = (from, to, label) => {
    if (from && to && from !== to) edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'openlibrary' } });
  };

  onProgress(`Building ${docs.length} books, authors and subjects...`);

  // Subjects are the connective tissue here - they are what makes two
  // unrelated books share a path - so favour the ones several books agree on.
  const subjectCounts = new Map();
  for (const doc of docs) {
    for (const subject of (doc.subject || []).slice(0, 25)) {
      subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
    }
  }
  const sharedSubjects = new Set(
    [...subjectCounts.entries()].filter(([, n]) => n >= 2).map(([s]) => s)
  );

  for (const doc of docs) {
    const key = (doc.key || '').replace('/works/', '');
    if (!key) continue;

    addNode({
      externalId: `B:${key}`,
      label: truncate(doc.title || key, 200),
      group: 'Book',
      year: Number.isFinite(doc.first_publish_year) ? doc.first_publish_year : undefined,
      info: truncate([
        doc.author_name?.length ? `by ${doc.author_name.slice(0, 3).join(', ')}` : null,
        doc.first_publish_year ? `first published ${doc.first_publish_year}` : null,
        doc.edition_count ? `${doc.edition_count} editions` : null
      ].filter(Boolean).join(' · ') || doc.title),
      tags: (doc.subject || []).slice(0, 5),
      metadata: { openLibraryKey: key, url: `${API}${doc.key}` }
    });

    (doc.author_key || []).slice(0, 4).forEach((authorKey, i) => {
      const name = doc.author_name?.[i];
      if (!name) return;
      addNode({
        externalId: `A:${authorKey}`,
        label: name,
        group: 'Person',
        info: truncate('Author'),
        tags: [],
        metadata: { openLibraryKey: authorKey, url: `${API}/authors/${authorKey}` }
      });
      addEdge(`B:${key}`, `A:${authorKey}`, 'author');
    });

    for (const subject of (doc.subject || []).slice(0, 25)) {
      if (!sharedSubjects.has(subject)) continue;
      const subjectKey = `S:${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
      addNode({
        externalId: subjectKey,
        label: truncate(subject, 120),
        group: 'Subject',
        info: truncate(`Subject heading · ${subjectCounts.get(subject)} matching books`),
        tags: [],
        metadata: {}
      });
      addEdge(`B:${key}`, subjectKey, 'subject');
    }

    for (const publisher of (doc.publisher || []).slice(0, depth >= 2 ? 2 : 0)) {
      const pubKey = `P:${publisher.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
      addNode({
        externalId: pubKey,
        label: truncate(publisher, 120),
        group: 'Organization',
        info: truncate('Publisher'),
        tags: [],
        metadata: {}
      });
      addEdge(`B:${key}`, pubKey, 'publisher');
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
      seeds: docs.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      sharedSubjects: sharedSubjects.size,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'openlibrary',
  label: 'Open Library',
  description: 'Books, authors and shared subject headings',
  placeholder: 'e.g. cyberpunk, Ursula K. Le Guin, thermodynamics',
  buildGraph
};
