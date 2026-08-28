/**
 * Shared HTTP helpers for the ingest sources.
 *
 * Every public API here is free and unauthenticated, but each one publishes
 * usage rules - MusicBrainz enforces one request per second and will start
 * returning 503 if you exceed it; SEC EDGAR rejects any User-Agent that does
 * not carry a contact address. Centralising the politeness means a new source
 * only has to declare its limits.
 */

const DEFAULT_USER_AGENT = 'WorldGraph/3.0 (knowledge graph research tool)';

// Minimum milliseconds between requests to a given host.
const HOST_MIN_INTERVAL = {
  'musicbrainz.org': 1100,
  'query.wikidata.org': 400,
  'www.sec.gov': 120,
  'data.sec.gov': 120
};

const lastRequestAt = new Map();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Wait out the per-host interval so we never breach a published rate limit. */
async function throttle(host) {
  const interval = HOST_MIN_INTERVAL[host];
  if (!interval) return;

  const last = lastRequestAt.get(host) || 0;
  const wait = interval - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

/**
 * Fetch with throttling, a descriptive User-Agent, and one retry on the
 * transient statuses these APIs use for backpressure.
 */
async function politeFetch(url, { headers = {}, retries = 2, timeoutMs = 25000, method, body } = {}) {
  const host = new URL(url).host;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: method || 'GET',
        body,
        headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json', ...headers },
        signal: controller.signal
      });

      // 429/503 mean "slow down", not "give up".
      if ((res.status === 429 || res.status === 503) && attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        throw new Error(`${host} returned ${res.status} ${res.statusText}`);
      }
      return res;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (attempt < retries) continue;
        throw new Error(`${host} timed out after ${timeoutMs}ms`);
      }
      if (attempt >= retries) throw error;
      await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`${host} failed after ${retries + 1} attempts`);
}

async function fetchJson(url, options) {
  const res = await politeFetch(url, options);
  return res.json();
}

async function fetchText(url, options = {}) {
  const res = await politeFetch(url, {
    ...options,
    headers: { Accept: 'application/xml', ...(options.headers || {}) }
  });
  return res.text();
}

/** Run an ADQL/SPARQL query against the Wikidata Query Service. */
async function runSparql(query) {
  const res = await politeFetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ query }),
    timeoutMs: 60000
  });
  const data = await res.json();
  return data.results?.bindings || [];
}

/** Trim overlong descriptions so a node stays readable in the inspector. */
function truncate(text, limit = 1200) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}

/** Decode the handful of XML entities that appear in ATOM feeds. */
function decodeXml(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Keep only the best-connected candidates when a build would exceed its node
 * budget. The shared hubs are what make a graph connected; the single-reference
 * leaves are fringe, so they are the right thing to drop first.
 */
function topByCount(counts, budget) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, budget))
    .map(([key]) => key);
}

module.exports = {
  politeFetch,
  runSparql,
  fetchJson,
  fetchText,
  truncate,
  decodeXml,
  topByCount,
  sleep,
  DEFAULT_USER_AGENT
};
