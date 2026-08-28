/**
 * Registry of ingestion sources.
 *
 * Every source exports the same contract so the route never has to know which
 * one it is talking to:
 *
 *   id, label, description, placeholder
 *   buildGraph({ topic, seeds, maxNodes, depth, onProgress })
 *     -> { nodes: [{ externalId, label, group, year?, info, tags[], metadata{} }],
 *          edges: [{ fromExternalId, toExternalId, label, metadata{} }],
 *          stats: {...} }
 *
 * `externalId` only has to be unique within a source - the Node index is
 * (workspace, source, externalId) - so sources are free to use their own
 * native identifiers.
 */

const sources = [
  require('./wikidata'),
  require('./openalex'),
  require('./crossref'),
  require('./arxiv'),
  require('./musicbrainz'),
  require('./openlibrary'),
  require('./sec'),
  require('./hydrology'),
  require('./astronomy'),
  require('./computing')
];

const byId = new Map(sources.map(s => [s.id, s]));

// Back-compat: the first version of the ingest API was Wikipedia-only and
// lived at /api/ingest/wikipedia.
const ALIASES = { wikipedia: 'wikidata', openalex_works: 'openalex' };

function getSource(id) {
  return byId.get(id) || byId.get(ALIASES[id]) || null;
}

/** Serialisable descriptions for the UI's source picker. */
function listSources() {
  return sources.map(s => ({
    id: s.id,
    label: s.label,
    description: s.description,
    placeholder: s.placeholder || 'Enter a topic'
  }));
}

module.exports = { getSource, listSources, sources };
