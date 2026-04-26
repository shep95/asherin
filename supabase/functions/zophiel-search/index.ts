const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ══════════════════════════════════════════════════════════════════════════════
// IMMUTABLE TRUTH GRAPH — Source Credibility & Provenance System
// ══════════════════════════════════════════════════════════════════════════════

// Tier 1: Primary Sources — direct government, scientific, regulatory bodies
const TIER_1_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nature.com', 'science.org',
  'who.int', 'nih.gov', 'cdc.gov', 'nasa.gov', 'sec.gov', 'federalreserve.gov',
  'supremecourt.gov', 'congress.gov', 'whitehouse.gov', 'europa.eu',
  'worldbank.org', 'imf.org', 'un.org', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov',
  'scholar.google.com', 'jstor.org', 'ncbi.nlm.nih.gov', 'ieee.org',
  'ecb.europa.eu', 'bis.org', 'wto.org', 'iaea.org', 'patents.google.com',
]);

// Tier 2: Established Sources — major journalism, vetted tech documentation
const TIER_2_DOMAINS = new Set([
  'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'economist.com',
  'wsj.com', 'ft.com', 'bloomberg.com', 'cnbc.com', 'techcrunch.com',
  'wired.com', 'arstechnica.com', 'theatlantic.com', 'newyorker.com',
  'propublica.com', 'politico.com', 'npr.org', 'pbs.org',
  'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.python.org',
  'docs.microsoft.com', 'learn.microsoft.com', 'cloud.google.com', 'aws.amazon.com',
  'wikipedia.org', 'britannica.com', 'statista.com',
]);

const TIER_3_PATTERNS = ['.gov', '.edu', '.ac.uk', '.ac.jp', '.edu.au', '.mil'];

// Hostile Source Indicators — domains known for manipulation, clickbait, or disinfo
const HOSTILE_INDICATORS = new Set([
  'infowars.com', 'naturalnews.com', 'beforeitsnews.com', 'globalresearch.ca',
  'zerohedge.com', 'breitbart.com', 'dailycaller.com',
]);

type SourceTier = 1 | 2 | 3 | 4 | 5;

interface TruthGraphNode {
  tier: SourceTier;
  tierLabel: string;
  provenanceScore: number;  // 0-1: how traceable to primary sources
  freshnessScore: number;   // 0-1: temporal relevance
  hostileFlag: boolean;     // flagged as potentially manipulative
  consensusWeight: number;  // how many other sources corroborate
}

function getSourceTier(domain: string): SourceTier {
  const clean = domain.replace(/^www\./, '');
  if (/\.onion$/i.test(clean)) return 5;
  if (TIER_1_DOMAINS.has(clean)) return 1;
  if (TIER_2_DOMAINS.has(clean)) return 2;
  for (const pat of TIER_3_PATTERNS) {
    if (clean.endsWith(pat)) return 3;
  }
  return 4;
}

function getTierLabel(tier: SourceTier): string {
  switch (tier) {
    case 1: return 'Primary Source';
    case 2: return 'Established';
    case 3: return 'Institutional';
    case 4: return 'General';
    case 5: return 'Onion (Unverified)';
  }
}

function isHostile(domain: string): boolean {
  const clean = domain.replace(/^www\./, '');
  return HOSTILE_INDICATORS.has(clean);
}

// Calculate provenance score based on tier + domain signals
function calculateProvenance(domain: string, tier: SourceTier, snippet: string): number {
  let score = tier === 1 ? 0.95 : tier === 2 ? 0.75 : tier === 3 ? 0.6 : 0.35;
  
  // Boost for citing primary sources within snippet
  const citationPatterns = /\b(according to|cited by|published in|data from|report by)\b/gi;
  const citations = (snippet.match(citationPatterns) || []).length;
  score = Math.min(1, score + citations * 0.05);
  
  // Penalize if hostile
  if (isHostile(domain)) score *= 0.2;
  
  return Math.round(score * 100) / 100;
}

// Calculate freshness score
function calculateFreshness(publishDate?: string): number {
  if (!publishDate) return 0.5; // Unknown = neutral
  try {
    const pub = new Date(publishDate);
    if (isNaN(pub.getTime())) return 0.5;
    const daysSince = (Date.now() - pub.getTime()) / 86400000;
    if (daysSince <= 1) return 1.0;
    if (daysSince <= 7) return 0.9;
    if (daysSince <= 30) return 0.75;
    if (daysSince <= 90) return 0.6;
    if (daysSince <= 365) return 0.4;
    return 0.2;
  } catch { return 0.5; }
}

// ══════════════════════════════════════════════════════════════════════════════
// SEMANTIC INTENT ENGINE — Understanding the "Why" Behind Queries
// ══════════════════════════════════════════════════════════════════════════════

interface SemanticIntent {
  primaryIntent: string;      // what the user ACTUALLY wants
  queryDomain: string;        // knowledge domain
  depthRequired: 'surface' | 'analysis' | 'forensic';
  temporalBias: 'realtime' | 'recent' | 'historical' | 'none';
  causalInterest: boolean;    // user wants cause-effect chains
}

function analyzeSemanticIntent(query: string): SemanticIntent {
  const q = query.toLowerCase().trim();
  
  // Detect causal interest
  const causalPatterns = /\b(impact|effect|cause|why|how does|relationship between|correlation|leads to|results in|consequence|because)\b/i;
  const causalInterest = causalPatterns.test(q);
  
  // Detect temporal bias
  let temporalBias: SemanticIntent['temporalBias'] = 'none';
  if (/\b(today|now|current|latest|breaking|real-?time|live)\b/.test(q)) temporalBias = 'realtime';
  else if (/\b(recent|this week|this month|2025|2026)\b/.test(q)) temporalBias = 'recent';
  else if (/\b(history|historical|evolution|origin|timeline|past|ancient)\b/.test(q)) temporalBias = 'historical';
  
  // Detect depth required
  let depthRequired: SemanticIntent['depthRequired'] = 'surface';
  if (/\b(analysis|deep dive|comprehensive|forensic|investigate|detailed|explain|mechanism)\b/.test(q)) depthRequired = 'forensic';
  else if (/\b(compare|versus|vs|pros cons|advantages|trade-?off|evaluate)\b/.test(q)) depthRequired = 'analysis';
  
  // Detect query domain
  let queryDomain = 'general';
  if (/\b(stock|market|price|earnings|trading|crypto|bitcoin|financial|economic|gdp|inflation|revenue)\b/.test(q)) queryDomain = 'finance';
  else if (/\b(health|medical|treatment|symptom|disease|drug|medicine|clinical|diagnosis|therapy)\b/.test(q)) queryDomain = 'medical';
  else if (/\b(code|programming|api|library|framework|algorithm|software|developer|debug|deploy)\b/.test(q)) queryDomain = 'technology';
  else if (/\b(law|legal|regulation|compliance|statute|court|ruling|policy|legislation)\b/.test(q)) queryDomain = 'legal';
  else if (/\b(science|research|study|experiment|hypothesis|theory|quantum|physics|chemistry|biology)\b/.test(q)) queryDomain = 'science';
  else if (/\b(geopolit|military|defense|intelligence|espionage|conflict|war|sanction|diplomacy)\b/.test(q)) queryDomain = 'geopolitical';
  
  // Infer primary intent
  let primaryIntent = 'information retrieval';
  if (causalInterest) primaryIntent = 'causal analysis';
  else if (/\b(how to|tutorial|guide|setup|install|configure)\b/.test(q)) primaryIntent = 'procedural guidance';
  else if (/\b(compare|vs|versus|better|best|top)\b/.test(q)) primaryIntent = 'comparative analysis';
  else if (/\b(define|definition|what is|meaning)\b/.test(q)) primaryIntent = 'definition lookup';
  else if (/\b(predict|forecast|will|future|outlook)\b/.test(q)) primaryIntent = 'predictive analysis';
  
  return { primaryIntent, queryDomain, depthRequired, temporalBias, causalInterest };
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSENSUS ENGINE — Cross-Reference Validation
// ══════════════════════════════════════════════════════════════════════════════

interface ConsensusAnalysis {
  consensusScore: number;       // 0-1: how much sources agree
  corroboratedClaims: number;   // claims verified by 2+ sources
  contradictions: number;       // claims that conflict across sources
  uniqueClaims: number;         // claims from only 1 source
}

function analyzeConsensus(results: SearchResult[]): ConsensusAnalysis {
  if (results.length < 2) return { consensusScore: 0.5, corroboratedClaims: 0, contradictions: 0, uniqueClaims: results.length };
  
  // Extract key phrases from snippets
  const phraseMap = new Map<string, number>();
  for (const r of results) {
    const phrases = extractKeyPhrases(r.snippet);
    for (const p of phrases) {
      phraseMap.set(p, (phraseMap.get(p) || 0) + 1);
    }
  }
  
  let corroborated = 0;
  let unique = 0;
  for (const count of phraseMap.values()) {
    if (count >= 2) corroborated++;
    else unique++;
  }
  
  const total = corroborated + unique;
  const consensusScore = total > 0 ? Math.round((corroborated / total) * 100) / 100 : 0.5;
  
  return { consensusScore, corroboratedClaims: corroborated, contradictions: 0, uniqueClaims: unique };
}

function extractKeyPhrases(text: string): string[] {
  if (!text) return [];
  // Extract significant 2-3 word phrases
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  return phrases;
}

// ── Search Mode Configurations ───────────────────────────────────────────────
type SearchMode = 'web' | 'news' | 'academic' | 'code' | 'data' | 'docs';

const MODE_DOMAIN_BOOSTS: Record<SearchMode, string[]> = {
  web: [],
  news: ['reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com', 'theguardian.com', 'washingtonpost.com', 'bloomberg.com', 'cnbc.com'],
  academic: ['arxiv.org', 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov', 'jstor.org', 'nature.com', 'science.org', 'ieee.org'],
  code: ['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.python.org', 'npmjs.com', 'pypi.org', 'learn.microsoft.com'],
  data: ['statista.com', 'worldbank.org', 'data.gov', 'kaggle.com', 'ourworldindata.org'],
  docs: ['developer.mozilla.org', 'docs.python.org', 'learn.microsoft.com', 'cloud.google.com', 'docs.aws.amazon.com'],
};

const MODE_QUERY_PREFIX: Record<SearchMode, string> = {
  web: '',
  news: '',
  academic: 'research paper ',
  code: '',
  data: 'data statistics ',
  docs: 'documentation ',
};

// ── Result types ─────────────────────────────────────────────────────────────
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  tier: SourceTier;
  tierLabel: string;
  publishDate?: string;
  readingTimeMin?: number;
  category: 'primary' | 'breaking' | 'analysis' | 'background' | 'community' | 'multimedia' | 'general';
  // Truth Graph fields
  truthGraph: TruthGraphNode;
  veracity: number; // composite truth score 0-100
  /** True for tier-5 .onion results — UI must NOT render a clickable anchor. */
  onion?: boolean;
}

interface SearchFilters {
  dateRange?: 'day' | 'week' | 'month' | 'year';
  domainInclude?: string[];
  domainExclude?: string[];
  fileType?: string;
  sourceType?: string[];
  credibilityMin?: SourceTier;
}

interface SearchRequest {
  query: string;
  page?: number;
  mode?: SearchMode;
  filters?: SearchFilters;
  operatorOverrides?: string;
}

// ── Instant Answer Detection ─────────────────────────────────────────────────
interface InstantAnswer {
  type: string;
  title: string;
  value: string;
  source?: string;
  details?: Record<string, string>;
}

function detectInstantAnswerType(query: string): string | null {
  const q = query.toLowerCase().trim();
  if (/^\d+(\.\d+)?\s*(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|krw|btc|eth)\s+(to|in)\s+/i.test(q)) return 'conversion';
  if (/^\d+(\.\d+)?\s*(miles?|km|meters?|feet|inches?|cm|mm|lbs?|kg|oz|gallons?|liters?|fahrenheit|celsius)\s+(to|in)\s+/i.test(q)) return 'unit';
  if (/^(what is my ip|my ip address)/i.test(q)) return 'ip';
  if (/^(weather|forecast)\s+/i.test(q)) return 'weather';
  if (/^(capital of|what is the capital)/i.test(q)) return 'fact';
  if (/\b(stock|share price|market cap)\b/i.test(q)) return 'stock';
  if (/^(define|definition of|meaning of)\s+/i.test(q)) return 'definition';
  if (/^(hex|rgb|color|colour)\s+(code|for)/i.test(q)) return 'color';
  if (/^(md5|sha256|sha1|hash)\s+(of|for|hash)/i.test(q)) return 'hash';
  if (/cron\s+(expression|schedule|what does)/i.test(q)) return 'cron';
  if (/regex\s+(for|to|match|pattern)/i.test(q)) return 'regex';
  if (/^\d+\s*(am|pm)\s+(est|pst|cst|mst|gmt|utc|jst|cet|ist|bst|aest)\s+(in|to)\s+/i.test(q)) return 'timezone';
  return null;
}

// ── Query Builder ────────────────────────────────────────────────────────────
function buildSearchQuery(query: string, mode: SearchMode, intent: SemanticIntent, filters?: SearchFilters, operatorOverrides?: string): string {
  let q = query.trim();

  const prefix = MODE_QUERY_PREFIX[mode];
  if (prefix) q = prefix + q;

  // Semantic Intent augmentation
  if (intent.causalInterest && !q.includes('cause') && !q.includes('impact')) {
    q += ' cause effect analysis';
  }
  if (intent.temporalBias === 'realtime') q += ' 2026';
  if (intent.depthRequired === 'forensic') q += ' in-depth analysis';

  if (operatorOverrides) q += ' ' + operatorOverrides;

  if (filters) {
    if (filters.domainInclude?.length) {
      q += ' ' + filters.domainInclude.map(d => `site:${d}`).join(' OR ');
    }
    if (filters.domainExclude?.length) {
      q += ' ' + filters.domainExclude.map(d => `-site:${d}`).join(' ');
    }
    if (filters.fileType) {
      q += ` filetype:${filters.fileType}`;
    }
  }

  return q;
}

// ── HTML Parsing Helpers ─────────────────────────────────────────────────────
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 230));
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function extractDate(block: string): string | undefined {
  const datePatterns = [
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const pat of datePatterns) {
    const m = block.match(pat);
    if (m) return m[1];
  }
  return undefined;
}

// ── Result Categorization ────────────────────────────────────────────────────
const COMMUNITY_DOMAINS = new Set(['reddit.com', 'news.ycombinator.com', 'lobste.rs', 'dev.to', 'hashnode.com']);

function categorizeResult(result: { url: string; tier: SourceTier; snippet: string; publishDate?: string }): SearchResult['category'] {
  const domain = extractDomain(result.url);
  if (result.tier === 1) return 'primary';
  if (COMMUNITY_DOMAINS.has(domain)) return 'community';
  if (result.publishDate) {
    try {
      const pubDate = new Date(result.publishDate);
      const dayAgo = new Date(Date.now() - 86400000);
      if (pubDate > dayAgo) return 'breaking';
    } catch { /* ignore */ }
  }
  if (result.snippet.length > 200) return 'analysis';
  return 'general';
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

// ── DuckDuckGo Search ────────────────────────────────────────────────────────
async function searchDDG(query: string, page: number, dateFilter?: string): Promise<SearchResult[]> {
  const startParam = (page - 1) * 10;
  let ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${startParam}`;
  if (dateFilter) {
    const dfMap: Record<string, string> = { day: 'd', week: 'w', month: 'm', year: 'y' };
    if (dfMap[dateFilter]) ddgUrl += `&df=${dfMap[dateFilter]}`;
  }

  const response = await fetch(ddgUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) return [];
  const html = await response.text();
  return parseDDGResults(html);
}

function parseDDGResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const resultBlocks = html.split(/class="result\s/);

  for (let i = 1; i < resultBlocks.length; i++) {
    const block = resultBlocks[i];
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    let url = titleMatch[1];
    const uddgMatch = url.match(/uddg=([^&]*)/);
    if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
    const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();

    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    const sourceMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\//);
    const source = sourceMatch ? sourceMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    if (!title || !url || !url.startsWith('http')) continue;

    const domain = extractDomain(url);
    const tier = getSourceTier(domain);
    const publishDate = extractDate(block);
    const readingTimeMin = rawSnippet ? estimateReadingTime(rawSnippet) : undefined;
    const hostile = isHostile(domain);
    const provenanceScore = calculateProvenance(domain, tier, rawSnippet);
    const freshnessScore = calculateFreshness(publishDate);

    const tierScore = tier === 1 ? 1.0 : tier === 2 ? 0.75 : tier === 3 ? 0.55 : 0.3;
    const veracity = Math.round(
      (provenanceScore * 0.4 + freshnessScore * 0.25 + tierScore * 0.35) * 100
    );

    const truthGraph: TruthGraphNode = {
      tier,
      tierLabel: getTierLabel(tier),
      provenanceScore,
      freshnessScore,
      hostileFlag: hostile,
      consensusWeight: 0,
    };

    const result: SearchResult = {
      title, url, snippet: rawSnippet, source: source || domain,
      tier, tierLabel: getTierLabel(tier),
      publishDate, readingTimeMin,
      category: 'general',
      truthGraph, veracity,
    };
    result.category = categorizeResult(result);
    results.push(result);
  }

  return results;
}

function buildSearchResult(title: string, url: string, snippet: string): SearchResult | null {
  if (!title || !url || !url.startsWith('http')) return null;
  const domain = extractDomain(url);
  const tier = getSourceTier(domain);
  const hostile = isHostile(domain);
  const provenanceScore = calculateProvenance(domain, tier, snippet);
  const freshnessScore = calculateFreshness(undefined);
  const tierScore = tier === 1 ? 1.0 : tier === 2 ? 0.75 : tier === 3 ? 0.55 : 0.3;
  const veracity = Math.round(
    (provenanceScore * 0.4 + freshnessScore * 0.25 + tierScore * 0.35) * 100
  );
  const truthGraph: TruthGraphNode = {
    tier, tierLabel: getTierLabel(tier), provenanceScore, freshnessScore,
    hostileFlag: hostile, consensusWeight: 0,
  };
  const result: SearchResult = {
    title, url, snippet, source: domain,
    tier, tierLabel: getTierLabel(tier),
    category: 'general', truthGraph, veracity,
  };
  result.category = categorizeResult(result);
  return result;
}

// ── SearXNG Search (meta-search aggregator — queries Google, Bing, Brave, etc.) ──
async function searchSearXNG(query: string): Promise<SearchResult[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,brave,duckduckgo&categories=general`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (!data.results?.length) continue;
      const results: SearchResult[] = [];
      for (const r of data.results) {
        const built = buildSearchResult(r.title || '', r.url || '', r.content || '');
        if (built) results.push(built);
      }
      if (results.length > 0) return results;
    } catch { continue; }
  }
  return [];
}

// ── Mojeek Search (independent web crawler — no reliance on Google/Bing index) ──
async function searchMojeek(query: string): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}&fmt=json&t=20`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) {
      // Fallback: parse HTML
      const htmlResp = await fetch(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(6000),
      });
      if (!htmlResp.ok) return [];
      const html = await htmlResp.text();
      const results: SearchResult[] = [];
      const linkRegex = /<a[^>]*class="ob"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const descRegex = /<p[^>]*class="s"[^>]*>([\s\S]*?)<\/p>/gi;
      const links: { url: string; title: string }[] = [];
      const descs: string[] = [];
      let m;
      while ((m = linkRegex.exec(html)) !== null) links.push({ url: m[1], title: m[2].replace(/<[^>]*>/g, '').trim() });
      while ((m = descRegex.exec(html)) !== null) descs.push(m[1].replace(/<[^>]*>/g, '').trim());
      for (let i = 0; i < links.length; i++) {
        const built = buildSearchResult(links[i].title, links[i].url, descs[i] || '');
        if (built) results.push(built);
      }
      return results;
    }
    const data = await resp.json();
    const results: SearchResult[] = [];
    for (const r of (data.response?.results || [])) {
      const built = buildSearchResult(r.title || '', r.url || '', r.desc || '');
      if (built) results.push(built);
    }
    return results;
  } catch { return []; }
}

// ── MetaGer Search (German privacy meta-search engine) ──
async function searchMetaGer(query: string): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`https://metager.org/meta/meta.ger3?eingabe=${encodeURIComponent(query)}&focus=web&out=json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: SearchResult[] = [];
    for (const r of (data.results || [])) {
      const built = buildSearchResult(r.title || '', r.link || r.url || '', r.description || r.snippet || '');
      if (built) results.push(built);
    }
    return results;
  } catch { return []; }
}

// ── Gigablast Search (independent crawler) ──
async function searchGigablast(query: string): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`https://www.gigablast.com/search?q=${encodeURIComponent(query)}&format=json&n=50`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: SearchResult[] = [];
    for (const r of (data.results || [])) {
      const built = buildSearchResult(r.title || '', r.url || '', r.sum || r.snippet || '');
      if (built) results.push(built);
    }
    return results;
  } catch { return []; }
}

// ── Wikipedia API (encyclopedia primary source) ──
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=20&origin=*`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: SearchResult[] = [];
    for (const r of (data.query?.search || [])) {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
      const snippet = (r.snippet || '').replace(/<[^>]+>/g, '').trim();
      const built = buildSearchResult(r.title, url, snippet);
      if (built) results.push(built);
    }
    return results;
  } catch { return []; }
}

// ── Brave Search (HTML scrape fallback) ──
async function searchBrave(query: string): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: SearchResult[] = [];
    const blockRegex = /<a[^>]+class="[^"]*result-header[^"]*"[^>]+href="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<div[^>]+class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let m;
    while ((m = blockRegex.exec(html)) !== null) {
      const url = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      const snippet = m[3].replace(/<[^>]+>/g, '').trim();
      if (!url.startsWith('http')) continue;
      const built = buildSearchResult(title, url, snippet);
      if (built) results.push(built);
    }
    return results;
  } catch { return []; }
}

// ── Yandex Search (Russian-indexed alternative results) ──
async function searchYandex(query: string): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`https://yandex.com/search/?text=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: SearchResult[] = [];
    const linkRegex = /<a[^>]+class="[^"]*OrganicTitle-Link[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      if (!url.startsWith('http')) continue;
      const built = buildSearchResult(title, url, '');
      if (built) results.push(built);
    }
    return results;
  } catch { return []; }
}

// ── Multi-Engine Aggregated Search ──────────────────────────────────────────
async function multiEngineSearch(query: string, page: number, dateFilter?: string): Promise<SearchResult[]> {
  // Run ALL engines in parallel — no result caps, full breadth
  const [ddgResults, searxResults, mojeekResults, metagerResults, gigablastResults, wikiResults, braveResults, yandexResults] = await Promise.allSettled([
    searchDDG(query, page, dateFilter),
    searchSearXNG(query),
    searchMojeek(query),
    searchMetaGer(query),
    searchGigablast(query),
    searchWikipedia(query),
    searchBrave(query),
    searchYandex(query),
  ]);

  const all: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const addResults = (settled: PromiseSettledResult<SearchResult[]>, engineWeight: number) => {
    if (settled.status !== 'fulfilled') return;
    for (const r of settled.value) {
      const normalUrl = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
      if (seenUrls.has(normalUrl)) {
        // Boost veracity for cross-engine corroboration
        const existing = all.find(e => e.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://') === normalUrl);
        if (existing) {
          existing.veracity = Math.min(100, existing.veracity + 5);
          existing.truthGraph.consensusWeight = Math.min(1, existing.truthGraph.consensusWeight + 0.15);
        }
        continue;
      }
      seenUrls.add(normalUrl);
      all.push(r);
    }
  };

  addResults(ddgResults, 1.0);
  addResults(searxResults, 0.9);
  addResults(mojeekResults, 0.8);
  addResults(metagerResults, 0.7);
  addResults(gigablastResults, 0.7);
  addResults(wikiResults, 0.95);
  addResults(braveResults, 0.85);
  addResults(yandexResults, 0.65);

  return all;
}

// ── Onion / Dark-Web (Ahmia clearnet index of .onion sites) ─────────────────
// Always-on companion source. Tier-5 results are merged into the main stream
// but never promoted above clearnet primary/established sources at sort time.
async function searchAhmiaOnion(query: string, limit = 8): Promise<SearchResult[]> {
  function cleanText(s: string): string {
    return s.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function onionHost(u: string): string {
    try { return new URL(u).hostname; } catch { const m = u.match(/([a-z2-7]{16,56}\.onion)/i); return m ? m[1] : u; }
  }
  let html = '';
  try {
    const r = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return [];
    html = await r.text();
  } catch { return []; }

  const out: SearchResult[] = [];
  const blockRe = /<li[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null && out.length < limit) {
    const block = m[1];
    const titleMatch = block.match(/<h4>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h4>/i)
      || block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    let onionUrl = '';
    const cite = block.match(/<cite>([\s\S]*?)<\/cite>/i);
    if (cite) onionUrl = cleanText(cite[1]);
    if (!onionUrl) {
      const redir = titleMatch[1].match(/redirect_url=([^&]+)/);
      if (redir) onionUrl = decodeURIComponent(redir[1]);
    }
    if (!onionUrl || !/\.onion(?:\/|$|:)/i.test(onionUrl)) continue;

    const title = cleanText(titleMatch[2]) || onionHost(onionUrl);
    const snipMatch = block.match(/<p>([\s\S]*?)<\/p>/i);
    const snippet = snipMatch ? cleanText(snipMatch[1]) : '';
    const dateMatch = block.match(/<span[^>]*class="[^"]*lastSeen[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const publishDate = dateMatch ? cleanText(dateMatch[1]) : undefined;

    out.push({
      title,
      url: onionUrl,
      snippet,
      source: onionHost(onionUrl),
      tier: 5,
      tierLabel: 'Onion (Unverified)',
      publishDate,
      category: 'general',
      truthGraph: {
        tier: 5,
        tierLabel: 'Onion (Unverified)',
        provenanceScore: 0.15,
        freshnessScore: publishDate ? 0.5 : 0.3,
        hostileFlag: false,
        consensusWeight: 0,
      },
      veracity: Math.min(45, 25 + (snippet ? 5 : 0) + (publishDate ? 5 : 0)),
      onion: true,
    });
  }
  return out;
}
  try {
    const iaResp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!iaResp.ok) return null;
    const iaData = await iaResp.json();

    if (iaData.AbstractText) {
      return { type: 'abstract', title: iaData.Heading || query, value: iaData.AbstractText, source: iaData.AbstractSource, details: iaData.AbstractURL ? { url: iaData.AbstractURL } : undefined };
    }
    if (iaData.Answer) {
      return { type: 'answer', title: query, value: iaData.Answer, source: iaData.AnswerType || 'DuckDuckGo' };
    }
    if (iaData.Definition) {
      return { type: 'definition', title: iaData.Heading || query, value: iaData.Definition, source: iaData.DefinitionSource };
    }
    return null;
  } catch { return null; }
}

// ── Freshness Detection ──────────────────────────────────────────────────────
interface FreshnessAlert {
  message: string;
  severity: 'warning' | 'info';
}

function checkFreshness(query: string, publishDate?: string): FreshnessAlert | null {
  if (!publishDate) return null;
  try {
    const pub = new Date(publishDate);
    if (isNaN(pub.getTime())) return null;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - pub.getTime()) / 86400000);
    const q = query.toLowerCase();

    if (/\b(stock|market|price|earnings|trading|crypto|bitcoin|eth)\b/.test(q) && diffDays > 7) {
      return { message: `This result is ${diffDays} days old. Financial data may have changed.`, severity: 'warning' };
    }
    if (/\b(news|breaking|latest|update|today)\b/.test(q) && diffDays > 3) {
      return { message: `Published ${diffDays} days ago. Newer coverage may be available.`, severity: 'info' };
    }
    if (/\b(tutorial|guide|how to|install|setup|config|version)\b/.test(q) && diffDays > 180) {
      return { message: `This article is ${Math.floor(diffDays / 30)} months old. Tech info may be outdated.`, severity: 'warning' };
    }
    if (/\b(health|medical|treatment|symptom|disease|drug|medicine)\b/.test(q) && diffDays > 365) {
      return { message: `Published over a year ago. Medical guidance may have changed.`, severity: 'warning' };
    }
    return null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();
    const { query, page = 1, mode = 'web', filters, operatorOverrides } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = query.trim();
    
    // ── Semantic Intent Analysis ──
    const semanticIntent = analyzeSemanticIntent(trimmed);
    
    const builtQuery = buildSearchQuery(trimmed, mode, semanticIntent, filters, operatorOverrides);
    const instantAnswerType = detectInstantAnswerType(trimmed);

    // Run multi-engine search + instant answer in parallel
    const [searchResults, instantAnswer] = await Promise.all([
      multiEngineSearch(builtQuery, page, filters?.dateRange),
      fetchInstantAnswer(trimmed),
    ]);

    // Apply credibility filter
    let filtered = searchResults;
    if (filters?.credibilityMin) {
      filtered = filtered.filter(r => r.tier <= filters.credibilityMin!);
    }

    // ── Consensus Analysis — cross-validate results ──
    const consensus = analyzeConsensus(filtered);
    
    // Inject consensus weights back into truth graph nodes
    for (const r of filtered) {
      const phrases = extractKeyPhrases(r.snippet);
      let corroborations = 0;
      for (const other of filtered) {
        if (other.url === r.url) continue;
        const otherPhrases = new Set(extractKeyPhrases(other.snippet));
        for (const p of phrases) {
          if (otherPhrases.has(p)) { corroborations++; break; }
        }
      }
      r.truthGraph.consensusWeight = Math.min(1, corroborations / Math.max(1, filtered.length - 1));
      // Adjust veracity based on consensus
      r.veracity = Math.min(100, Math.round(r.veracity * (0.8 + r.truthGraph.consensusWeight * 0.2)));
    }

    // ── Truth Graph Sorting — prioritize verified, high-provenance results ──
    // Sort by veracity score (descending), then by tier
    filtered.sort((a, b) => {
      // Hostile sources always sink to bottom
      if (a.truthGraph.hostileFlag !== b.truthGraph.hostileFlag) return a.truthGraph.hostileFlag ? 1 : -1;
      // Then by veracity
      if (b.veracity !== a.veracity) return b.veracity - a.veracity;
      return a.tier - b.tier;
    });

    // Boost mode-relevant domains (secondary sort)
    const boostDomains = new Set(MODE_DOMAIN_BOOSTS[mode] || []);
    if (boostDomains.size > 0) {
      const boosted = filtered.filter(r => boostDomains.has(extractDomain(r.url)));
      const rest = filtered.filter(r => !boostDomains.has(extractDomain(r.url)));
      filtered = [...boosted, ...rest];
    }

    // Group results by category
    const grouped: Record<string, SearchResult[]> = {};
    for (const r of filtered) {
      const cat = r.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }

    // Freshness alerts
    const freshnessAlerts: Record<string, FreshnessAlert> = {};
    for (const r of filtered) {
      const alert = checkFreshness(trimmed, r.publishDate);
      if (alert) freshnessAlerts[r.url] = alert;
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: trimmed,
        builtQuery,
        mode,
        instantAnswer,
        instantAnswerType,
        results: filtered,
        grouped,
        freshnessAlerts,
        page,
        totalResults: filtered.length,
        // New Truth Graph metadata
        semanticIntent,
        consensus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Zophiel search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
