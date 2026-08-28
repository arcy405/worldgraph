/**
 * SEC EDGAR - US public company filings.
 * https://www.sec.gov/search-filings/edgar-application-programming-interfaces
 *
 * Free and unauthenticated, but the SEC rejects any request whose User-Agent
 * does not carry a contact address (a plain descriptive UA gets a 403). Set
 * SEC_CONTACT_EMAIL in the server environment to your own address - the
 * default placeholder works but is poor API citizenship, and the SEC may
 * throttle traffic it cannot attribute.
 */

const { fetchJson, truncate } = require('./http');

const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SUBMISSIONS_URL = 'https://data.sec.gov/submissions';

const CONTACT = process.env.SEC_CONTACT_EMAIL || 'worldgraph@example.com';
const SEC_HEADERS = { 'User-Agent': `WorldGraph Research Tool ${CONTACT}` };

// The full company list is ~1MB and changes rarely; cache it for the process.
let tickerCache = null;

async function loadCompanies() {
  if (tickerCache) return tickerCache;
  const data = await fetchJson(TICKERS_URL, { headers: SEC_HEADERS, timeoutMs: 40000 });
  tickerCache = Object.values(data || {});
  return tickerCache;
}

function padCik(cik) {
  return String(cik).padStart(10, '0');
}

async function buildGraph({ topic, seeds = 8, maxNodes = 250, depth = 1, onProgress = () => {} }) {
  onProgress('Loading the SEC company index...');
  const companies = await loadCompanies();

  const needle = topic.trim().toLowerCase();
  const matches = companies
    .filter(c =>
      String(c.title || '').toLowerCase().includes(needle) ||
      String(c.ticker || '').toLowerCase() === needle
    )
    .slice(0, Math.min(seeds, 12));

  if (matches.length === 0) {
    return {
      nodes: [], edges: [],
      stats: { topic, seeds: 0, reason: `no SEC registrant matches "${topic}"` }
    };
  }

  const nodes = new Map();
  const edges = [];
  const addNode = n => { if (n && !nodes.has(n.externalId)) nodes.set(n.externalId, n); };
  const addEdge = (from, to, label) => {
    if (from && to && from !== to) edges.push({ fromExternalId: from, toExternalId: to, label, metadata: { source: 'sec' } });
  };

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    onProgress(`Fetching ${match.title} (${i + 1}/${matches.length})...`);

    let submission;
    try {
      submission = await fetchJson(
        `${SUBMISSIONS_URL}/CIK${padCik(match.cik_str)}.json`,
        { headers: SEC_HEADERS, timeoutMs: 30000 }
      );
    } catch (error) {
      continue;
    }

    const cik = padCik(match.cik_str);
    const companyId = `C:${cik}`;
    const state = submission.addresses?.business?.stateOrCountryDescription;

    addNode({
      externalId: companyId,
      label: submission.name || match.title,
      group: 'Company',
      info: truncate([
        submission.sicDescription,
        submission.tickers?.length ? `tickers ${submission.tickers.join(', ')}` : null,
        state ? `based in ${state}` : null,
        submission.entityType
      ].filter(Boolean).join(' · ')),
      tags: (submission.tickers || []).slice(0, 4),
      metadata: {
        cik,
        sic: submission.sic || undefined,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`
      }
    });

    if (submission.sic && submission.sicDescription) {
      const industryId = `S:${submission.sic}`;
      addNode({
        externalId: industryId,
        label: submission.sicDescription,
        group: 'Industry',
        info: truncate(`SIC ${submission.sic} · standard industrial classification`),
        tags: [],
        metadata: { sic: submission.sic }
      });
      addEdge(companyId, industryId, 'industry');
    }

    for (const exchange of [...new Set(submission.exchanges || [])]) {
      if (!exchange) continue;
      const exchangeId = `X:${String(exchange).toLowerCase()}`;
      addNode({
        externalId: exchangeId,
        label: exchange,
        group: 'Exchange',
        info: truncate(`Securities exchange`),
        tags: [],
        metadata: {}
      });
      addEdge(companyId, exchangeId, 'listed on');
    }

    if (state) {
      const placeId = `L:${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      addNode({
        externalId: placeId,
        label: state,
        group: 'Place',
        info: truncate('Registrant business location'),
        tags: [],
        metadata: {}
      });
      addEdge(companyId, placeId, 'headquarters location');
    }

    // Former names capture mergers and rebrands - genuinely useful history.
    for (const former of (submission.formerNames || []).slice(0, 3)) {
      if (!former.name) continue;
      const formerId = `F:${former.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
      addNode({
        externalId: formerId,
        label: former.name,
        group: 'Former name',
        info: truncate(`Former registrant name${former.from ? `, used from ${former.from.slice(0, 10)}` : ''}`),
        tags: [],
        metadata: {}
      });
      addEdge(companyId, formerId, 'formerly known as');
    }

    if (depth >= 2) {
      const recent = submission.filings?.recent;
      const forms = recent?.form || [];
      let added = 0;
      for (let f = 0; f < forms.length && added < 8; f++) {
        // Annual and quarterly reports only - EDGAR is dominated by Form 4s.
        if (!['10-K', '10-Q', '8-K', '20-F', 'S-1'].includes(forms[f])) continue;
        const accession = recent.accessionNumber?.[f];
        const filed = recent.filingDate?.[f];
        if (!accession) continue;

        const filingId = `R:${accession}`;
        addNode({
          externalId: filingId,
          label: `${forms[f]} · ${submission.name || match.title} · ${String(filed).slice(0, 4)}`,
          group: 'Filing',
          year: filed ? Number(String(filed).slice(0, 4)) : undefined,
          info: truncate(`${forms[f]} filed ${filed} by ${submission.name || match.title}`),
          tags: [forms[f]],
          metadata: { accession, form: forms[f] }
        });
        addEdge(companyId, filingId, 'filed');
        added++;
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
      seeds: matches.length,
      nodes: nodeList.length,
      edges: keptEdges.length,
      contact: CONTACT === 'worldgraph@example.com' ? 'default placeholder (set SEC_CONTACT_EMAIL)' : 'configured',
      types: [...new Set(nodeList.map(n => n.group))].length
    }
  };
}

module.exports = {
  id: 'sec',
  label: 'SEC EDGAR',
  description: 'US public companies, industries, exchanges and filings',
  placeholder: 'e.g. nvidia, pharmaceutical, bank',
  buildGraph
};
