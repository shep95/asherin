import { getCorsHeaders } from "../_shared/cors.ts";
// NOTE: Omnispider crawler moved to zophiel-search (web search) per spec.
// Deep Search is now AI-free AND key-free — pure source aggregation.

// ══════════════════════════════════════════════════════════════════════════════
// IMMUTABLE TRUTH GRAPH — Source Integrity Validation
// ══════════════════════════════════════════════════════════════════════════════

const TIER_1_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nature.com', 'science.org',
  'who.int', 'nih.gov', 'cdc.gov', 'nasa.gov', 'sec.gov', 'federalreserve.gov',
  'worldbank.org', 'imf.org', 'un.org', 'pubmed.ncbi.nlm.nih.gov',
  'ieee.org', 'ecb.europa.eu', 'bis.org', 'patents.google.com',
]);

const TIER_2_DOMAINS = new Set([
  'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'economist.com',
  'wsj.com', 'ft.com', 'bloomberg.com', 'cnbc.com', 'techcrunch.com',
  'wired.com', 'arstechnica.com', 'github.com', 'stackoverflow.com',
  'wikipedia.org', 'britannica.com', 'statista.com', 'propublica.com',
]);

const HOSTILE_DOMAINS = new Set([
  'infowars.com', 'naturalnews.com', 'beforeitsnews.com', 'globalresearch.ca',
]);

interface ScrapedSource {
  url: string;
  title: string;
  domain: string;
  content: string;
  tier: number;
  provenanceScore: number;
  hostile: boolean;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function getSourceTier(domain: string): number {
  const clean = domain.replace(/^www\./, '');
  if (TIER_1_DOMAINS.has(clean)) return 1;
  if (TIER_2_DOMAINS.has(clean)) return 2;
  if (clean.endsWith('.gov') || clean.endsWith('.edu') || clean.endsWith('.ac.uk')) return 3;
  return 4;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// MULTI-ENGINE SEARCH — DDG + SearXNG + Mojeek + Gigablast + MetaGer
// ══════════════════════════════════════════════════════════════════════════════

const SEARXNG_INSTANCES = [
  'https://search.bus-hit.me',
  'https://searx.tiekoetter.com',
  'https://search.ononoki.org',
  'https://searx.be',
  'https://search.sapti.me',
];

// ── DuckDuckGo Search with retry ─────────────────────────────────────────────
async function searchDDG(query: string, retries = 3): Promise<{ url: string; title: string }[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!response.ok) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
      const html = await response.text();
      const results: { url: string; title: string }[] = [];
      const blocks = html.split(/class="result\s/);
      for (let i = 1; i < blocks.length && results.length < 10; i++) {
        const block = blocks[i];
        const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
        if (!titleMatch) continue;
        let url = titleMatch[1];
        const uddg = url.match(/uddg=([^&]*)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
        const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
        if (title && url && url.startsWith('http')) results.push({ url, title });
      }
      return results;
    } catch {
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return [];
}

// ── SearXNG Meta-Search ──────────────────────────────────────────────────────
async function searchSearXNG(query: string): Promise<{ url: string; title: string }[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,brave,duckduckgo&categories=general`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (!json.results?.length) continue;
      return json.results.slice(0, 10).filter((r: any) => r.url?.startsWith('http')).map((r: any) => ({ url: r.url, title: r.title || '' }));
    } catch { continue; }
  }
  return [];
}

// ── Mojeek Search ────────────────────────────────────────────────────────────
async function searchMojeek(query: string): Promise<{ url: string; title: string }[]> {
  try {
    const resp = await fetch(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}&fmt=json&t=10`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.response?.results || []).slice(0, 8).filter((r: any) => r.url?.startsWith('http')).map((r: any) => ({ url: r.url, title: r.title || '' }));
  } catch { return []; }
}

// ── MetaGer Search ───────────────────────────────────────────────────────────
async function searchMetaGer(query: string): Promise<{ url: string; title: string }[]> {
  try {
    const resp = await fetch(`https://metager.org/meta/meta.ger3?eingabe=${encodeURIComponent(query)}&focus=web&out=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.results || []).slice(0, 8).filter((r: any) => (r.link || r.url)?.startsWith('http')).map((r: any) => ({ url: r.link || r.url, title: r.title || '' }));
  } catch { return []; }
}

// ── Gigablast Search ─────────────────────────────────────────────────────────
async function searchGigablast(query: string): Promise<{ url: string; title: string }[]> {
  try {
    const resp = await fetch(`https://www.gigablast.com/search?q=${encodeURIComponent(query)}&format=json&n=10`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.results || []).slice(0, 8).filter((r: any) => r.url?.startsWith('http')).map((r: any) => ({ url: r.url, title: r.title || '' }));
  } catch { return []; }
}

// ── Multi-Engine Search (aggregated + deduplicated) ─────────────────────────
async function multiEngineSearch(query: string): Promise<{ url: string; title: string }[]> {
  const [ddg, searx, mojeek, metager, gigablast] = await Promise.allSettled([
    searchDDG(query),
    searchSearXNG(query),
    searchMojeek(query),
    searchMetaGer(query),
    searchGigablast(query),
  ]);
  const seen = new Set<string>();
  const all: { url: string; title: string }[] = [];
  for (const settled of [ddg, searx, mojeek, metager, gigablast]) {
    if (settled.status !== 'fulfilled') continue;
    for (const r of settled.value) {
      const norm = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
      if (!seen.has(norm)) { seen.add(norm); all.push(r); }
    }
  }
  return all;
}

// ── Page Scraper with integrity check ────────────────────────────────────────
async function scrapePage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    const html = await resp.text();

    let main = '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (articleMatch) main = articleMatch[1];
    else if (mainMatch) main = mainMatch[1];
    else {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      main = bodyMatch ? bodyMatch[1] : html;
    }
    return cleanHtml(main).slice(0, 5000);
  } catch { return null; }
}

// (Clarifying-questions generator removed — Deep Search is now AI-free.)

// ══════════════════════════════════════════════════════════════════════════════
// CROSS-SOURCE VALIDATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

interface CrossValidation {
  totalSources: number;
  tier1Count: number;
  tier2Count: number;
  hostileCount: number;
  averageProvenance: number;
  consensusStrength: 'strong' | 'moderate' | 'weak' | 'insufficient';
  contradictionFlags: string[];
}

function crossValidateSources(sources: ScrapedSource[]): CrossValidation {
  const tier1Count = sources.filter(s => s.tier === 1).length;
  const tier2Count = sources.filter(s => s.tier === 2).length;
  const hostileCount = sources.filter(s => s.hostile).length;
  const avgProvenance = sources.length > 0
    ? sources.reduce((sum, s) => sum + s.provenanceScore, 0) / sources.length
    : 0;

  let consensusStrength: CrossValidation['consensusStrength'] = 'insufficient';
  if (sources.length >= 5 && tier1Count >= 2) consensusStrength = 'strong';
  else if (sources.length >= 3 && (tier1Count >= 1 || tier2Count >= 2)) consensusStrength = 'moderate';
  else if (sources.length >= 2) consensusStrength = 'weak';

  return {
    totalSources: sources.length,
    tier1Count,
    tier2Count,
    hostileCount,
    averageProvenance: Math.round(avgProvenance * 100) / 100,
    consensusStrength,
    contradictionFlags: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { query, answers } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = query.trim();
    // Deep Search is OPEN — no BYOK, no Gemini, no clarifying-question step.

    // ── Build enhanced query from answers ──
    let enhancedQuery = trimmed;
    if (answers && typeof answers === 'object' && Object.keys(answers).length > 0) {
      const context = Object.values(answers).join('; ');
      enhancedQuery = `${trimmed} — context: ${context}`;
    }

    console.log('[ZOPHIEL] Deep search with Truth Graph Protocol:', enhancedQuery);

    // ── Step 1: Multi-Angle Search (4 search vectors) + OSINT Engines ──
    const searchVariants = [
      enhancedQuery,
      `${trimmed} latest 2025 2026`,
      `${trimmed} analysis research data`,
      `${trimmed} primary source official report`,
    ];

    // Run DuckDuckGo + OSINT engines + Extended OSINT in parallel
    const osintResults: { source: string; content: string; tier: number }[] = [];
    
    // Detect query type for targeted OSINT engine activation
    const qLower = trimmed.toLowerCase();
    const ipMatch = trimmed.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    const domainMatch = trimmed.match(/\b([\w-]+\.(?:com|org|net|io|dev|co|gov|edu|mil|ai|tech|cloud|app|xyz|me)(?:\.\w{2,3})?)\b/i);
    const hashMatch = trimmed.match(/\b([a-fA-F0-9]{32,64})\b/);
    const isCyber = /malware|threat|vulnerability|cve|exploit|attack|breach|hack|phish|ransomware|apt|ioc|indicator|scan|port|service|banner|exposure|certificate|subdomain|dns/i.test(qLower);
    const isPerson = /person|who is|about|officer|director|ceo|cto|founder|profile|name|identify/i.test(qLower);
    const isCompany = /compan|corp|inc|llc|ltd|business|firm|startup|enterprise/i.test(qLower);
    
    const osintTasks: Promise<void>[] = [];
    
    // urlscan.io (free, no key needed)
    if (domainMatch || /url|website|phish|redirect/i.test(qLower)) {
      osintTasks.push((async () => {
        try {
          const resp = await fetch(`https://urlscan.io/api/v1/search/?q=${encodeURIComponent(domainMatch?.[1] || trimmed)}&size=5`);
          if (resp.ok) {
            const json = await resp.json();
            if (json.results?.length) {
              osintResults.push({
                source: 'urlscan.io',
                content: json.results.slice(0, 5).map((r: any) => `${r.page?.url || ''} — ${r.page?.title || 'N/A'} | IP: ${r.page?.ip || 'N/A'} | Verdict: ${r.verdicts?.overall?.malicious ? 'MALICIOUS' : 'Clean'}`).join('\n'),
                tier: 2,
              });
            }
          }
        } catch { /* skip */ }
      })());
    }
    
    // crt.sh (free, no key needed)
    if (domainMatch) {
      osintTasks.push((async () => {
        try {
          const resp = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domainMatch[1])}&output=json`);
          if (resp.ok) {
            const json = await resp.json();
            const unique = [...new Set(json.slice(0, 15).map((c: any) => c.common_name || c.name_value))];
            if (unique.length) {
              osintResults.push({
                source: 'crt.sh (Certificate Transparency)',
                content: `Subdomains discovered: ${unique.length}\n${unique.map((s: string) => `- ${s}`).join('\n')}`,
                tier: 2,
              });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // Shodan (if key available)
    if ((ipMatch || isCyber || domainMatch) && Deno.env.get('SHODAN_API_KEY')) {
      osintTasks.push((async () => {
        try {
          const key = Deno.env.get('SHODAN_API_KEY')!;
          let resp;
          if (ipMatch) {
            resp = await fetch(`https://api.shodan.io/shodan/host/${ipMatch[1]}?key=${key}`);
          } else {
            const q = domainMatch ? `hostname:${domainMatch[1]}` : trimmed;
            resp = await fetch(`https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(q)}&page=1`);
          }
          if (resp.ok) {
            const json = await resp.json();
            if (ipMatch) {
              osintResults.push({ source: 'Shodan', content: `IP: ${json.ip_str} | Org: ${json.org || 'N/A'} | Ports: ${json.ports?.join(', ') || 'None'} | Vulns: ${json.vulns?.slice(0, 5).join(', ') || 'None'}`, tier: 1 });
            } else if (json.matches?.length) {
              osintResults.push({ source: 'Shodan', content: json.matches.slice(0, 5).map((m: any) => `${m.ip_str}:${m.port} | ${m.org || 'N/A'} | ${m.product || ''}`).join('\n'), tier: 1 });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // VirusTotal (if key available)
    if ((ipMatch || domainMatch || hashMatch || isCyber) && Deno.env.get('VIRUSTOTAL_API_KEY')) {
      osintTasks.push((async () => {
        try {
          const key = Deno.env.get('VIRUSTOTAL_API_KEY')!;
          const target = hashMatch?.[1] || domainMatch?.[1] || ipMatch?.[1] || trimmed;
          const isIPTarget = /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
          const isDomainTarget = /^[\w.-]+\.\w{2,}$/.test(target) && !isIPTarget;
          const isHashTarget = /^[a-fA-F0-9]{32,64}$/.test(target);
          let endpoint = '';
          if (isHashTarget) endpoint = `https://www.virustotal.com/api/v3/files/${target}`;
          else if (isDomainTarget) endpoint = `https://www.virustotal.com/api/v3/domains/${target}`;
          else if (isIPTarget) endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${target}`;
          if (endpoint) {
            const resp = await fetch(endpoint, { headers: { 'x-apikey': key } });
            if (resp.ok) {
              const json = await resp.json();
              const attrs = json.data?.attributes || {};
              const stats = attrs.last_analysis_stats || {};
              osintResults.push({ source: 'VirusTotal', content: `${target}: Malicious: ${stats.malicious || 0} | Harmless: ${stats.harmless || 0} | Reputation: ${attrs.reputation || 'N/A'}`, tier: 1 });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // ThreatFox (free, no key needed)
    if (isCyber || hashMatch || ipMatch) {
      osintTasks.push((async () => {
        try {
          const resp = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'search_ioc', search_term: hashMatch?.[1] || ipMatch?.[1] || trimmed }),
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json.data?.length) {
              osintResults.push({ source: 'ThreatFox', content: json.data.slice(0, 5).map((ioc: any) => `[${ioc.ioc_type}] ${ioc.ioc} — ${ioc.threat_type || 'N/A'} / ${ioc.malware || 'N/A'}`).join('\n'), tier: 2 });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // SecurityTrails (if key available)
    if (domainMatch && Deno.env.get('SECURITYTRAILS_API_KEY')) {
      osintTasks.push((async () => {
        try {
          const key = Deno.env.get('SECURITYTRAILS_API_KEY')!;
          const resp = await fetch(`https://api.securitytrails.com/v1/domain/${domainMatch[1]}/subdomains?children_only=false`, {
            headers: { 'APIKEY': key },
          });
          if (resp.ok) {
            const json = await resp.json();
            const subs = json.subdomains?.slice(0, 15) || [];
            if (subs.length) {
              osintResults.push({ source: 'SecurityTrails', content: `Subdomains (${json.subdomain_count || subs.length} total): ${subs.map((s: string) => `${s}.${domainMatch[1]}`).join(', ')}`, tier: 1 });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // ── Extended OSINT engines for Zophiel Deep Search ──

    // Bing Web Search (if key available)
    if (Deno.env.get('BING_SEARCH_API_KEY')) {
      osintTasks.push((async () => {
        try {
          const key = Deno.env.get('BING_SEARCH_API_KEY')!;
          const resp = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(trimmed)}&count=5&mkt=en-US`, {
            headers: { 'Ocp-Apim-Subscription-Key': key },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json.webPages?.value?.length) {
              osintResults.push({ source: 'Bing', content: json.webPages.value.slice(0, 5).map((r: any) => `${r.name} — ${r.url}\n${r.snippet || ''}`).join('\n'), tier: 2 });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // Wayback Machine (free, no key)
    if (domainMatch || /archive|deleted|cached|old|history|wayback/i.test(qLower)) {
      osintTasks.push((async () => {
        try {
          const target = domainMatch?.[1] || trimmed;
          const resp = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=8&fl=original,timestamp,statuscode&collapse=timestamp:6`);
          if (resp.ok) {
            const json = await resp.json();
            if (json.length > 1) {
              osintResults.push({
                source: 'Wayback Machine',
                content: json.slice(1, 8).map((r: string[]) => `${r[0]} | Archived: ${r[1].slice(0,4)}-${r[1].slice(4,6)}-${r[1].slice(6,8)} | Status: ${r[2]}`).join('\n'),
                tier: 2,
              });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // OpenCorporates (free, no key)
    if (isCompany || /director|officer|registry|registered agent/i.test(qLower)) {
      osintTasks.push((async () => {
        try {
          const resp = await fetch(`https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(trimmed)}&per_page=5&order=score`);
          if (resp.ok) {
            const json = await resp.json();
            const companies = json.results?.companies || [];
            if (companies.length) {
              osintResults.push({
                source: 'OpenCorporates',
                content: companies.map((c: any) => {
                  const co = c.company || {};
                  return `${co.name} (${co.jurisdiction_code}) | Status: ${co.current_status || 'N/A'} | Inc: ${co.incorporation_date || 'N/A'}`;
                }).join('\n'),
                tier: 2,
              });
            }
          }
        } catch { /* skip */ }
      })());
    }

    // Social platform proxied search (for person queries)
    if (isPerson) {
      for (const platform of ['facebook', 'instagram', 'tiktok']) {
        osintTasks.push((async () => {
          try {
            const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed + ` site:${platform}.com`)}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
            });
            if (!resp.ok) return;
            const html = await resp.text();
            const results: string[] = [];
            const blocks = html.split(/class="result\s/);
            for (let i = 1; i < blocks.length && results.length < 3; i++) {
              const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
              const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
              if (title) results.push(title);
            }
            if (results.length) {
              osintResults.push({ source: `${platform.charAt(0).toUpperCase() + platform.slice(1)}`, content: results.join('\n'), tier: 4 });
            }
          } catch { /* skip */ }
        })());
      }
    }

    // Public records proxy (for person queries)
    if (isPerson) {
      osintTasks.push((async () => {
        try {
          const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${trimmed}" site:whitepages.com OR site:spokeo.com OR site:truepeoplesearch.com`)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
          });
          if (!resp.ok) return;
          const html = await resp.text();
          const results: string[] = [];
          const blocks = html.split(/class="result\s/);
          for (let i = 1; i < blocks.length && results.length < 5; i++) {
            const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
            const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            if (title) results.push(`${title}: ${snippet}`);
          }
          if (results.length) {
            osintResults.push({ source: 'Public Records', content: results.join('\n'), tier: 3 });
          }
        } catch { /* skip */ }
      })());
    }

    // Court filings proxy
    if (/court|lawsuit|judgment|litigation|property|dispute/i.test(qLower)) {
      osintTasks.push((async () => {
        try {
          const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${trimmed}" site:courtlistener.com OR site:law.justia.com`)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
          });
          if (!resp.ok) return;
          const html = await resp.text();
          const results: string[] = [];
          const blocks = html.split(/class="result\s/);
          for (let i = 1; i < blocks.length && results.length < 5; i++) {
            const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            if (title) results.push(title);
          }
          if (results.length) {
            osintResults.push({ source: 'Court Filings', content: results.join('\n'), tier: 1 });
          }
        } catch { /* skip */ }
      })());
    }

    // Run all multi-engine searches + OSINT in parallel
    const [allSearchResults] = await Promise.all([
      Promise.all(searchVariants.map(q => multiEngineSearch(q))),
      Promise.allSettled(osintTasks),
    ]);
    
    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueResults: { url: string; title: string }[] = [];
    for (const batch of allSearchResults) {
      for (const r of batch) {
        const norm = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
        if (!seen.has(norm)) {
          seen.add(norm);
          uniqueResults.push(r);
        }
      }
    }

    console.log(`[ZOPHIEL] Found ${uniqueResults.length} unique results across ${searchVariants.length} search vectors + ${osintResults.length} OSINT engine results`);

    // ── Step 2: Prioritize scraping by source tier (primary sources first) ──
    const scoredResults = uniqueResults.map(r => {
      const domain = extractDomain(r.url);
      const tier = getSourceTier(domain);
      return { ...r, domain, tier, scrapeOrder: tier };
    }).sort((a, b) => a.scrapeOrder - b.scrapeOrder);

    // Direct parallel scrape of top-N seeds (omnispider moved to zophiel-search).
    const seedResults = scoredResults.slice(0, 12);
    const scrapeResults: PromiseSettledResult<ScrapedSource | null>[] = await Promise.all(
      seedResults.map(async (r): Promise<PromiseSettledResult<ScrapedSource | null>> => {
        const content = await scrapePage(r.url);
        if (!content) return { status: 'fulfilled', value: null };
        const hostile = HOSTILE_DOMAINS.has(r.domain);
        const provenanceScore = r.tier === 1 ? 0.95 : r.tier === 2 ? 0.75 : r.tier === 3 ? 0.6 : 0.35;
        return {
          status: 'fulfilled',
          value: {
            url: r.url,
            title: r.title || r.domain,
            domain: r.domain,
            content,
            tier: r.tier,
            provenanceScore,
            hostile,
          },
        };
      })
    );


    // Add OSINT results as virtual scraped sources
    for (const osint of osintResults) {
      (scrapeResults as any[]).push({
        status: 'fulfilled',
        value: {
          url: `osint://${osint.source.toLowerCase().replace(/\s+/g, '-')}`,
          title: osint.source,
          domain: osint.source,
          content: osint.content,
          tier: osint.tier,
          provenanceScore: osint.tier === 1 ? 0.95 : 0.75,
          hostile: false,
        } as ScrapedSource,
      });
    }

    const sources: ScrapedSource[] = scrapeResults
      .filter((r): r is PromiseFulfilledResult<ScrapedSource | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((s): s is ScrapedSource => s !== null);

    console.log(`[ZOPHIEL] Scraped ${sources.length} sources (incl. ${osintResults.length} OSINT) — validating integrity...`);

    // ── Step 3: Cross-Source Validation ──
    const validation = crossValidateSources(sources);

    // ── Step 4: Build Truth Graph Synthesis Prompt ──
    const sourceBlocks = sources.map((s, i) => {
      const tierLabel = s.tier === 1 ? '🟢 PRIMARY' : s.tier === 2 ? '🔵 ESTABLISHED' : s.tier === 3 ? '🟡 INSTITUTIONAL' : '⚪ GENERAL';
      const hostileTag = s.hostile ? ' ⚠️ HOSTILE/UNRELIABLE' : '';
      return `[SOURCE ${i + 1}] ${tierLabel}${hostileTag} | Provenance: ${Math.round(s.provenanceScore * 100)}%
Title: ${s.title}
URL: ${s.url}
Domain: ${s.domain}
---
${s.content}`;
    }).join('\n\n');

    const validationSummary = `
CROSS-VALIDATION REPORT:
- Total Sources Analyzed: ${validation.totalSources}
- Primary Sources (Tier 1): ${validation.tier1Count}
- Established Sources (Tier 2): ${validation.tier2Count}
- Hostile/Flagged Sources: ${validation.hostileCount}
- Average Provenance Score: ${Math.round(validation.averageProvenance * 100)}%
- Consensus Strength: ${validation.consensusStrength.toUpperCase()}`;

    const systemPrompt = `You are ZOPHIEL — the Immutable Truth Graph Intelligence Engine.

YOUR ARCHITECTURE:
You operate under the Immutable Truth Graph Protocol. Every assertion you make must be traceable through a Causal Chain of Knowledge back to validated source material. You treat every input as hostile until its integrity is proven through cross-referencing.

CORE DIRECTIVES:

1. TRUTH GRAPH VALIDATION: For every major claim, cite the specific source(s) using [Source N] notation AND rate its reliability.
   - Claims supported by 2+ independent sources = ✅ VALIDATED
   - Claims from a single primary source = 🔵 CORROBORATED (single primary)
   - Claims from a single non-primary source = ⚠️ UNVERIFIED
   - Claims that contradict other sources = 🔴 CONTESTED

2. CAUSAL CHAIN OF KNOWLEDGE: Do NOT just state facts. Build explicit cause-effect chains:
   "X occurred BECAUSE Y, which was triggered by Z, as documented in [Source N]"
   Every assertion must have a traceable lineage.

3. SEMANTIC INTENT RESOLUTION: The user's TRUE intent is not just the keywords — interpret the underlying objective.
   Ask yourself: "What DECISION will this intelligence drive? What does the user ACTUALLY need to know?"

4. CROSS-SOURCE VALIDATION: When sources contradict:
   - Identify the specific point of divergence
   - Weight primary sources (Tier 1) over all others
   - Flag the contradiction explicitly with both sides
   - State which is more likely accurate and WHY (not opinion — evidence-based)

5. HOSTILE SOURCE TREATMENT: Sources flagged as hostile (⚠️) should be:
   - Acknowledged but treated with extreme skepticism
   - Never used as sole evidence for any claim
   - Contrasted against primary/established sources

REPORT STRUCTURE:
## ⚡ EXECUTIVE SYNTHESIS
(2-3 sentences that directly answer the user's TRUE intent — not just the literal query)

## 📊 TRUTH GRAPH VALIDATION REPORT
(Source reliability matrix — which sources validated which claims)

## 🔗 CAUSAL CHAIN ANALYSIS
(The full cause-effect chain with source citations)

## 📈 KEY INTELLIGENCE FINDINGS
(Numbered findings with validation status icons)

## ⚠️ CONTESTED CLAIMS & CONTRADICTIONS
(Where sources disagree — with evidence from both sides)

## 🕳️ INTELLIGENCE GAPS
(What could NOT be determined — and what additional sources would be needed)

## 📡 CONFIDENCE ASSESSMENT
(Overall confidence level: HIGH / MODERATE / LOW — with justification)

TONE: Authoritative. Zero fluff. Every sentence carries intelligence value. This is a forensic-grade briefing, not a blog post.`;

    const userPrompt = `QUERY: ${trimmed}
${Object.keys(answers || {}).length > 0 ? `USER CONTEXT: ${Object.values(answers).join('; ')}` : ''}

${validationSummary}

GATHERED INTELLIGENCE (${sources.length} validated sources):

${sourceBlocks || 'No sources could be scraped. Provide the best answer from training data. CLEARLY STATE that live sources were unavailable and confidence is reduced.'}

Construct the Immutable Truth Graph intelligence report now. Execute the Causal Chain of Knowledge protocol.`;

    // ── AI analysis removed: Deep Search returns raw validated sources only ──
    const sourceMeta = JSON.stringify({
      type: 'sources',
      sources: sources.map(s => ({
        url: s.url,
        title: s.title,
        domain: s.domain,
        tier: s.tier,
        provenanceScore: s.provenanceScore,
        hostile: s.hostile,
        snippet: (s.content || '').replace(/\s+/g, ' ').trim().slice(0, 320),
      })),
      totalSearchResults: uniqueResults.length,
      validation,
    });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(`data: ${sourceMeta}\n\n`));
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
    await writer.close();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[ZOPHIEL] Deep search error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Deep search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
