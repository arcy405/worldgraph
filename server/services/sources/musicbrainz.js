/**
 * MusicBrainz - open music encyclopedia.
 * https://musicbrainz.org/doc/MusicBrainz_API  (free, no key)
 *
 * The richest *typed* relation set of any source here: "member of band",
 * "founded", "produced", "married" are all first-class, directed relations
 * rather than the taxonomy links that dominate Wikidata.
 *
 * MusicBrainz enforces one request per second and will hand out 503s if you
 * exceed it, so seeds are kept small - the throttle lives in http.js.
 */

const { fetchJson, truncate } = require('./http');

const API = 'https://musicbrainz.org/ws/2';

/** Relation types that read well as graph edges. */
const USEFUL_RELATIONS = new Set([
  'member of band', 'collaboration', 'founder', 'is person', 'teacher',
  'composer', 'producer', 'engineer', 'married', 'sibling', 'parent',
  'supporting musician', 'tribute', 'artist rename', 'subgroup',
  'conductor', 'performer', 'vocal', 'instrumental supporting musician'
]);

function artistNode(artist) {
  const begin = artist['life-span']?.begin;
  const year = begin ? Number(String(begin).slice(0, 4)) : undefined;
  const area = artist.area?.name;

  return {
    externalId: `A:${artist.id}`,
    label: artist.name,
    group: artist.type === 'Person' ? 'Person' : (artist.type || 'Artist'),
    year: Number.isFinite(year) && year > 1000 ? year : undefined,
    info: truncate([
      artist.disambiguation,
      artist.type,
      area ? `from ${area}` : null,
      begin ? `active from ${begin}` : null
    ].filter(Boolean).join(' · ') || artist.name),
    tags: (artist.tags || []).slice(0, 5).map(t => t.name),
    metadata: { mbid: artist.id, url: `https://musicbrainz.org/artist/${artist.id}` }
  };
}

async function buildGraph({ topic, seeds = 10, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  onProgress(`Searching MusicBrainz for "${topic}"...`);

  // One request per second, so cap the seed count hard.
  const limit = Math.min(seeds, depth >= 2 ? 12 : 8);
  const search = await fetchJson(
    `${API}/artist?query=${encodeURIComponent(topic)}&fmt=json&limit=${limit}`
  );
  const found = search.artists || [];
  if (found.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no MusicBrainz matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const seenEdge = new Set();
  const addNode = n => { if (n && !nodes.has(n.externalId)) nodes.set(n.externalId, n); };
  const addEdge = (from, to, label) => {
    if (!from || !to || from === to) return;
    // MusicBrainz repeats a relation once per instrument and per date range -
    // Radiohead lists "member of band -> Colin Greenwood" four times.
    const key = `${from}|${to}|${label}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'musicbrainz' } });
  };

  for (let i = 0; i < found.length; i++) {
    const stub = found[i];
    if (nodes.size >= maxNodes) break;
    onProgress(`Fetching relations for ${stub.name} (${i + 1}/${found.length})...`);

    let artist;
    try {
      artist = await fetchJson(
        `${API}/artist/${stub.id}?inc=artist-rels+tags&fmt=json`
      );
    } catch (error) {
      continue; // one unavailable artist should not abort the whole build
    }

    addNode(artistNode(artist));

    for (const relation of artist.relations || []) {
      const target = relation.artist;
      if (!target || !USEFUL_RELATIONS.has(relation.type)) continue;

      addNode(artistNode(target));

      // `direction: backward` means the related artist is the subject of the
      // relation, so the edge points the other way.
      if (relation.direction === 'backward') {
        addEdge(`A:${target.id}`, `A:${artist.id}`, relation.type);
      } else {
        addEdge(`A:${artist.id}`, `A:${target.id}`, relation.type);
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
      seeds: found.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      relationTypes: [...new Set(keptEdges.map(e => e.label))].length,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'musicbrainz',
  label: 'MusicBrainz',
  description: 'Artists, bands and labels with richly typed relations',
  placeholder: 'e.g. Radiohead, Miles Davis, Motown',
  buildGraph
};
