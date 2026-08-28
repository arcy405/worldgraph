/**
 * Stars and exoplanets, via the NASA Exoplanet Archive TAP service.
 * https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html
 * (free, no key)
 *
 * Chosen over SIMBAD and Wikidata because it is genuinely relational: every
 * planet names its host star, its discovery method and the facility that found
 * it, so a query returns a graph rather than a table. It also carries
 * `disc_year` on every row, which makes it the first source here where the
 * timeline filter is meaningful for the whole graph rather than a fraction.
 *
 * ~6,350 confirmed planets at time of writing.
 */

const { fetchJson, truncate } = require('./http');

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

const COLUMNS = [
  'pl_name', 'hostname', 'sy_pnum', 'sy_snum', 'disc_year', 'discoverymethod',
  'disc_facility', 'st_spectype', 'st_teff', 'sy_dist', 'pl_rade', 'pl_orbper'
].join(',');

/** ADQL string literals are single-quoted, so a quote in the topic would break
 *  the query. Strip them rather than attempting to escape. */
function sanitise(text) {
  return String(text).replace(/'/g, '').trim();
}

async function runAdql(query) {
  const params = new URLSearchParams({ query, format: 'json' });
  const rows = await fetchJson(`${TAP}?${params}`, { timeoutMs: 60000 });
  return Array.isArray(rows) ? rows : [];
}

/** Spectral type strings look like "G2 V" or "M8V"; the leading letter is the class. */
function spectralClass(spectype) {
  const match = /^\s*([OBAFGKMLTY])/i.exec(spectype || '');
  return match ? match[1].toUpperCase() : null;
}

const SPECTRAL_NAMES = {
  O: 'O — blue, very hot', B: 'B — blue-white', A: 'A — white',
  F: 'F — yellow-white', G: 'G — yellow, Sun-like', K: 'K — orange',
  M: 'M — red dwarf', L: 'L — brown dwarf', T: 'T — cool brown dwarf',
  Y: 'Y — coolest brown dwarf'
};

async function buildGraph({ topic, seeds = 25, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  const needle = sanitise(topic);
  onProgress(`Querying the NASA Exoplanet Archive for "${needle}"...`);

  // Match a host star, a discovery method or an observatory - all three are
  // things a person might reasonably type.
  const rowLimit = Math.min(Math.max(seeds * 12, 120), 900);
  const filter =
    `upper(hostname) like upper('%${needle}%') ` +
    `or upper(discoverymethod) like upper('%${needle}%') ` +
    `or upper(disc_facility) like upper('%${needle}%')`;

  let rows = await runAdql(
    `select top ${rowLimit} ${COLUMNS} from ps where default_flag=1 and (${filter})`
  );

  // Nothing matched by name - fall back to the richest multi-planet systems so
  // a broad topic like "stars" still returns a meaningful graph.
  let fellBack = false;
  if (rows.length === 0) {
    onProgress('No name match — showing the richest multi-planet systems instead...');
    fellBack = true;
    rows = await runAdql(
      `select top ${rowLimit} ${COLUMNS} from ps where default_flag=1 and sy_pnum >= 4 order by sy_pnum desc`
    );
  }

  if (rows.length === 0) {
    return { nodes: [], edges: [], stats: { topic, seeds: 0, reason: 'no Exoplanet Archive matches' } };
  }

  const nodes = new Map();
  const edges = [];
  const seenEdge = new Set();
  const addNode = n => { if (n && !nodes.has(n.externalId)) nodes.set(n.externalId, n); };
  const addEdge = (from, to, label) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${label}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'nasa-exoplanet-archive' } });
  };

  // A star's own "year" is the earliest year one of its planets was found -
  // when the system entered the catalogue. Recorded explicitly in `info` so it
  // is not mistaken for the star's age.
  const firstDetection = new Map();
  for (const row of rows) {
    if (!row.hostname || !row.disc_year) continue;
    const current = firstDetection.get(row.hostname);
    if (!current || row.disc_year < current) firstDetection.set(row.hostname, row.disc_year);
  }

  onProgress(`Building ${rows.length} planets and their systems...`);

  const facilities = new Set();

  for (const row of rows) {
    if (nodes.size >= maxNodes) break;

    const host = row.hostname;
    const starId = host ? `S:${host}` : null;

    if (starId) {
      const distance = row.sy_dist != null ? `${Number(row.sy_dist).toFixed(0)} parsecs away` : null;
      const temperature = row.st_teff != null ? `${Number(row.st_teff).toFixed(0)} K` : null;
      addNode({
        externalId: starId,
        label: host,
        group: 'Star',
        year: firstDetection.get(host),
        info: truncate([
          row.st_spectype ? `Spectral type ${row.st_spectype}` : 'Host star',
          temperature,
          distance,
          `${row.sy_pnum} known planet${row.sy_pnum === 1 ? '' : 's'}`,
          row.sy_snum > 1 ? `${row.sy_snum}-star system` : null,
          firstDetection.get(host) ? `first planet found ${firstDetection.get(host)}` : null
        ].filter(Boolean).join(' · ')),
        tags: [row.st_spectype].filter(Boolean),
        metadata: {
          spectralType: row.st_spectype || undefined,
          effectiveTempK: row.st_teff || undefined,
          distanceParsecs: row.sy_dist || undefined,
          planetCount: row.sy_pnum
        }
      });
    }

    if (row.pl_name) {
      const planetId = `P:${row.pl_name}`;
      addNode({
        externalId: planetId,
        label: row.pl_name,
        group: 'Exoplanet',
        year: row.disc_year || undefined,
        info: truncate([
          row.discoverymethod ? `Found by ${row.discoverymethod.toLowerCase()}` : null,
          row.disc_year ? `in ${row.disc_year}` : null,
          row.pl_rade != null ? `${Number(row.pl_rade).toFixed(2)}x Earth radius` : null,
          row.pl_orbper != null ? `orbits in ${Number(row.pl_orbper).toFixed(1)} days` : null
        ].filter(Boolean).join(' · ') || row.pl_name),
        tags: [row.discoverymethod].filter(Boolean),
        metadata: {
          hostStar: host || undefined,
          discoveryYear: row.disc_year || undefined,
          earthRadii: row.pl_rade || undefined,
          orbitalPeriodDays: row.pl_orbper || undefined
        }
      });
      if (starId) addEdge(planetId, starId, 'orbits');

      if (row.discoverymethod) {
        const methodId = `M:${row.discoverymethod}`;
        addNode({
          externalId: methodId,
          label: row.discoverymethod,
          group: 'Detection method',
          info: truncate(`Technique used to detect exoplanets`),
          tags: [],
          metadata: {}
        });
        addEdge(planetId, methodId, 'detected by');
      }

      if (row.disc_facility) {
        const facilityId = `F:${row.disc_facility}`;
        facilities.add(row.disc_facility);
        addNode({
          externalId: facilityId,
          label: row.disc_facility,
          group: 'Observatory',
          info: truncate('Observatory or mission credited with the discovery'),
          tags: [],
          metadata: {}
        });
        addEdge(planetId, facilityId, 'discovered at');
      }
    }

    const cls = spectralClass(row.st_spectype);
    if (cls && starId) {
      const classId = `C:${cls}`;
      addNode({
        externalId: classId,
        label: `Class ${cls}`,
        group: 'Spectral class',
        info: truncate(SPECTRAL_NAMES[cls] || `Spectral class ${cls}`),
        tags: [],
        metadata: {}
      });
      addEdge(starId, classId, 'spectral class');
    }
  }

  const nodeList = [...nodes.values()];
  const keep = new Set(nodeList.map(n => n.externalId));
  const keptEdges = edges.filter(e => keep.has(e.fromExternalId) && keep.has(e.toExternalId));

  return {
    nodes: nodeList,
    edges: keptEdges,
    stats: {
      topic,
      seeds: rows.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      planets: nodeList.filter(n => n.group === 'Exoplanet').length,
      stars: nodeList.filter(n => n.group === 'Star').length,
      observatories: facilities.size,
      matchedByName: !fellBack,
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'astronomy',
  label: 'Stars & Exoplanets',
  description: 'Host stars, their planets, detection methods and observatories',
  placeholder: 'e.g. TRAPPIST, Kepler, radial velocity, TESS',
  buildGraph
};
