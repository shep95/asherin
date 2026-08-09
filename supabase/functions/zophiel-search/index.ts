import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { omnispiderCrawl, type OmniCrawledPage } from "../_shared/omnispider.ts";
import {
  buildQueryPlan, relaxedQuery, scoreRelevance, finalScore, engineClass,
  type QueryPlan,
} from "../_shared/queryPlan.ts";
import { fuseCorpus, computeRankingQuality } from "../_shared/zophielFusion.ts";
import { runSurfaceWave, type SurfaceWave } from "../_shared/surfaceRetrieval.ts";
// ══════════════════════════════════════════════════════════════════════════════
// IMMUTABLE TRUTH GRAPH — Source Credibility & Provenance System
// ══════════════════════════════════════════════════════════════════════════════

// Tier 1: Primary Sources — direct government, scientific, regulatory bodies
const TIER_1_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nature.com', 'science.org',
  'who.int', 'nih.gov', 'cdc.gov', 'nasa.gov', 'sec.gov', 'federalreserve.gov',
  'supremecourt.gov', 'congress.gov', 'whitehouse.gov', 'europa.eu',
  'worldbank.org', 'imf.org', 'un.org', 'pubmed.ncbi.nlm.nih.gov',
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

// Calculate provenance score based on tier + domain signals.
// NOTE: Unknown sites (tier 4) are treated as NEUTRAL (0.65), not low.
// We want any site mentioning the query to surface — credibility nuance is
// communicated via the tier badge, NOT by burying the result.
function calculateProvenance(domain: string, tier: SourceTier, snippet: string): number {
  let score = tier === 1 ? 0.95 : tier === 2 ? 0.8 : tier === 3 ? 0.7 : 0.65;

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
  academic: ['scholar.google.com', 'pubmed.ncbi.nlm.nih.gov', 'jstor.org', 'nature.com', 'science.org', 'ieee.org'],
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
// PANTHEON layer taxonomy — which corner of the internet a result came from.
type PantheonLayer =
  | 'surface'      // Standard indexed web (DDG, Brave, SearXNG, Mojeek, Yandex, Wikipedia)
  | 'deep'         // DBs, paywalled, archive (Common Crawl, Wayback, SEC EDGAR, CrossRef, OpenAlex, Google Books)
  | 'dark'         // .onion / Tor (Ahmia)
  | 'code'         // Source repositories (GitHub Code Search)
  | 'academic'     // Scholarly preprints (arXiv, CrossRef, OpenAlex)
  | 'social'       // Social/community (Reddit, Hacker News)
  | 'blockchain'   // On-chain data (Blockchair address/tx)
  | 'breach'       // Breach intelligence (HIBP, k-anon password hash)
  | 'iot'          // Exposed devices (Shodan — admin key gated)
  | 'vuln';        // CVE / NVD vulnerability intel

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
  /** PANTHEON layer this result was harvested from. Defaults to 'surface'. */
  layer?: PantheonLayer;
  /** Engine that produced this result (e.g. 'ddg', 'github', 'arxiv'). */
  engine?: string;
  /** Stage-3 topical relevance against the operator's QueryPlan (0..1). */
  relevance?: number;
  /** Weighted final ordering score: 0.65·relevance + 0.35·credibility. */
  score?: number;
  /** Every engine that independently returned this URL (drives corroboration). */
  engines?: string[];
  /** Distinct independence classes among `engines`. */
  independence?: number;
  /** 1-based position after final ranking. */
  rank?: number;

}

interface SearchFilters {
  dateRange?: 'day' | 'week' | 'month' | 'year' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  domainInclude?: string[];
  domainExclude?: string[];
  fileType?: string;
  sourceType?: string[];
  credibilityMin?: SourceTier;
  language?: string;
  region?: string;
  exactPhrase?: string;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  contentLength?: 'short' | 'medium' | 'long';
  sortBy?: 'relevance' | 'date' | 'credibility';
  safeSearch?: 'off' | 'moderate' | 'strict';
  intitle?: string;
  inurl?: string;
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
// The operator's words go on the wire. Intent signals (causal / temporal /
// forensic) are RANKING hints carried on the QueryPlan — appending them to the
// wire query was the source of pre-ranking recall drift.
function buildSearchQuery(plan: QueryPlan, mode: SearchMode, _intent: SemanticIntent, filters?: SearchFilters, operatorOverrides?: string): string {
  let q = plan.wireQuery.trim();

  const prefix = MODE_QUERY_PREFIX[mode];
  if (prefix) q = prefix + q;

  if (operatorOverrides) q += ' ' + operatorOverrides;


  if (filters) {
    if (filters.exactPhrase) q = `"${filters.exactPhrase.replace(/"/g, '')}" ${q}`;
    if (filters.includeKeywords?.length) q += ' ' + filters.includeKeywords.map(k => `+${k}`).join(' ');
    if (filters.excludeKeywords?.length) q += ' ' + filters.excludeKeywords.map(k => `-${k}`).join(' ');
    if (filters.intitle) q += ` intitle:${filters.intitle}`;
    if (filters.inurl) q += ` inurl:${filters.inurl}`;
    if (filters.domainInclude?.length) {
      q += ' ' + filters.domainInclude.map(d => `site:${d}`).join(' OR ');
    }
    if (filters.domainExclude?.length) {
      q += ' ' + filters.domainExclude.map(d => `-site:${d}`).join(' ');
    }
    if (filters.fileType) {
      q += ` filetype:${filters.fileType}`;
    }
    if (filters.language) q += ` lang:${filters.language}`;
    if (filters.region) q += ` region:${filters.region}`;
    if (filters.dateRange === 'custom' && filters.dateFrom && filters.dateTo) {
      q += ` after:${filters.dateFrom} before:${filters.dateTo}`;
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

    // Tier carries 12% of veracity — credibility is shown via badge, not by burying results.
    const tierScore = tier === 1 ? 1.0 : tier === 2 ? 0.85 : tier === 3 ? 0.7 : 0.6;
    const veracity = Math.round(
      (provenanceScore * 0.45 + freshnessScore * 0.43 + tierScore * 0.12) * 100
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
  const tierScore = tier === 1 ? 1.0 : tier === 2 ? 0.85 : tier === 3 ? 0.7 : 0.6;
  const veracity = Math.round(
    (provenanceScore * 0.45 + freshnessScore * 0.43 + tierScore * 0.12) * 100
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

// ── Firecrawl live SERP (primary surface engine) ────────────────────────────
// Scraper-based engines (DDG/Brave/Mojeek/Yandex HTML) are bot-blocked from
// edge IPs, which collapsed the open-web layer and left only API registries
// (SEC/Wikipedia/academic) — the "everything is a gov site" symptom. Firecrawl
// runs a real search backend server-side with a key we already hold.
// Firecrawl enforces both a concurrency ceiling and a per-minute rate. A deep
// dossier sweep fires 30+ queries inside a minute, so past the first ~10 every
// call returned 429 and the whole open-web layer silently zeroed out mid-run
// (the "first run rich, second run empty" symptom). Serialise through a small
// token gate with a minimum spacing, and treat 429 as retryable rather than
// as "no results".
const FIRECRAWL_MIN_INTERVAL_MS = 450;
const FIRECRAWL_MAX_INFLIGHT = 2;
let firecrawlInflight = 0;
let firecrawlNextSlot = 0;
const fcSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function firecrawlGate<T>(fn: () => Promise<T>): Promise<T> {
  while (firecrawlInflight >= FIRECRAWL_MAX_INFLIGHT) await fcSleep(120);
  firecrawlInflight++;
  try {
    const now = Date.now();
    const wait = Math.max(0, firecrawlNextSlot - now);
    firecrawlNextSlot = Math.max(now, firecrawlNextSlot) + FIRECRAWL_MIN_INTERVAL_MS;
    if (wait > 0) await fcSleep(wait);
    return await fn();
  } finally {
    firecrawlInflight--;
  }
}

async function searchFirecrawl(query: string, limit = 15): Promise<SearchResult[]> {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) return [];

  const attempt = async (): Promise<{ status: number; items: any[]; retryAfterMs: number }> => {
    const resp = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(9000),
    });
    if (!resp.ok) {
      const ra = Number(resp.headers.get('retry-after') || 0);
      // Body must be consumed so the connection is released.
      await resp.text().catch(() => '');
      return { status: resp.status, items: [], retryAfterMs: Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 6000) : 0 };
    }
    const j = await resp.json();
    const items: any[] = Array.isArray(j?.data?.web) ? j.data.web
      : Array.isArray(j?.web) ? j.web
      : Array.isArray(j?.data) ? j.data : [];
    return { status: 200, items, retryAfterMs: 0 };
  };

  try {
    let res = await firecrawlGate(attempt);
    for (let tries = 0; res.status === 429 && tries < 2; tries++) {
      const backoff = res.retryAfterMs || (900 * (tries + 1));
      await fcSleep(backoff);
      res = await firecrawlGate(attempt);
    }
    if (res.status !== 200) {
      console.error('[zophiel-search] firecrawl status', res.status);
      return [];
    }
    const out: SearchResult[] = [];
    for (const it of res.items) {
      if (typeof it?.url !== 'string') continue;
      const built = buildSearchResult(String(it.title || it.url), it.url, String(it.description || it.snippet || ''));
      if (built) out.push(built);
    }
    console.log(`[zophiel-search] firecrawl hits=${out.length}`);
    return out;
  } catch (e) {
    console.error('[zophiel-search] firecrawl failed', e instanceof Error ? e.message : String(e));
    return [];
  }

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

// ══════════════════════════════════════════════════════════════════════════════
// PANTHEON v3 — DEEP / CODE / ACADEMIC / SOCIAL / CHAIN / BREACH / IOT / VULN
// Net-new source modules covering the corners of the internet that standard
// surface engines do not index. Every module is failure-tolerant — a dead API
// returns [] and is skipped by Promise.allSettled at the orchestrator level.
// ══════════════════════════════════════════════════════════════════════════════

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function tagLayer(r: SearchResult, layer: PantheonLayer, engine: string): SearchResult {
  r.layer = layer;
  r.engine = engine;
  return r;
}

// ── DEEP WEB: Common Crawl Index (petabyte-scale historical web archive) ─────
async function searchCommonCrawl(query: string, limit = 10): Promise<SearchResult[]> {
  // CDX API — query the most recent index for URLs matching the term as a host substring.
  // Covers billions of pages Google has dropped.
  try {
    const idx = 'CC-MAIN-2024-51'; // rolling — tolerant to 404 if index ages out
    const url = `https://index.commoncrawl.org/${idx}-index?url=*${encodeURIComponent(query.replace(/\s+/g, '-'))}*&output=json&limit=${limit}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const text = await r.text();
    const out: SearchResult[] = [];
    for (const line of text.split('\n').filter(Boolean).slice(0, limit)) {
      try {
        const row = JSON.parse(line);
        const built = buildSearchResult(row.url || '', row.url || '', `Common Crawl archive · status ${row.status} · captured ${row.timestamp}`);
        if (built) {
          built.publishDate = row.timestamp ? `${row.timestamp.slice(0,4)}-${row.timestamp.slice(4,6)}-${row.timestamp.slice(6,8)}` : undefined;
          out.push(tagLayer(built, 'deep', 'common-crawl'));
        }
      } catch { /* malformed line */ }
    }
    return out;
  } catch { return []; }
}

// ── DEEP WEB: Wayback Machine CDX (historical snapshots) ─────────────────────
async function searchWayback(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://web.archive.org/cdx/search/cdx?url=*${encodeURIComponent(query.replace(/\s+/g, '-'))}*&output=json&limit=${limit}&filter=statuscode:200&collapse=urlkey`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const out: SearchResult[] = [];
    for (const row of rows.slice(1, limit + 1)) {
      const [, ts, original] = row;
      if (!original) continue;
      const archiveUrl = `https://web.archive.org/web/${ts}/${original}`;
      const built = buildSearchResult(`Archived: ${original}`, archiveUrl, `Snapshot from ${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} preserved by the Internet Archive.`);
      if (built) {
        built.publishDate = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
        out.push(tagLayer(built, 'deep', 'wayback'));
      }
    }
    return out;
  } catch { return []; }
}

// ── CODE: GitHub Code Search (no auth — rate-limited but works) ──────────────
async function searchGitHubCode(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github.v3.text-match+json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      // Fallback: repo search (more permissive rate limit)
      const r2 = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`, {
        headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!r2.ok) return [];
      const data = await r2.json();
      const out: SearchResult[] = [];
      for (const item of (data.items || []).slice(0, limit)) {
        const built = buildSearchResult(item.full_name, item.html_url, item.description || `${item.stargazers_count}★ · ${item.language || 'mixed'}`);
        if (built) {
          built.publishDate = item.updated_at;
          out.push(tagLayer(built, 'code', 'github-repos'));
        }
      }
      return out;
    }
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const item of (data.items || []).slice(0, limit)) {
      const fragment = item.text_matches?.[0]?.fragment || '';
      const built = buildSearchResult(`${item.repository.full_name} · ${item.path}`, item.html_url, fragment.slice(0, 280));
      if (built) out.push(tagLayer(built, 'code', 'github-code'));
    }
    return out;
  } catch { return []; }
}

// ── DEEP WEB: SEC EDGAR full-text search (corporate filings) ─────────────────
async function searchEDGAR(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"' + query + '"')}&dateRange=custom&startdt=2020-01-01&forms=10-K,10-Q,8-K,S-1,DEF+14A`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Aureon Intel research@aureonai.app', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const hit of (data.hits?.hits || []).slice(0, limit)) {
      const src = hit._source || {};
      const adsh = (src.adsh || '').replace(/-/g, '');
      const cik = src.ciks?.[0] || '';
      const file = hit._id?.split(':')?.[1] || '';
      const url2 = cik && adsh && file
        ? `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${adsh}/${file}`
        : `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(query)}`;
      const title = `${src.display_names?.[0] || 'Filer'} · ${src.form || 'Filing'} · ${src.file_date || ''}`;
      const built = buildSearchResult(title, url2, (src.file_description || src.items || '').toString().slice(0, 280));
      if (built) {
        built.publishDate = src.file_date;
        out.push(tagLayer(built, 'deep', 'sec-edgar'));
      }
    }
    return out;
  } catch { return []; }
}

// ── ACADEMIC: arXiv (preprints — physics, CS, math, biology) ─────────────────
async function searchArxiv(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const xml = await r.text();
    const out: SearchResult[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(xml)) !== null && out.length < limit) {
      const block = m[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/\s+/g, ' ').trim();
      const url2 = block.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || '';
      const summary = (block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 320);
      const published = block.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim();
      const built = buildSearchResult(title, url2, summary);
      if (built) {
        built.publishDate = published;
        out.push(tagLayer(built, 'academic', 'arxiv'));
      }
    }
    return out;
  } catch { return []; }
}

// ── ACADEMIC: CrossRef (DOI registry — covers most peer-reviewed papers) ─────
async function searchCrossRef(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,published-print,abstract,URL,container-title`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Aureon/1.0 (mailto:research@aureonai.app)' }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const item of (data.message?.items || []).slice(0, limit)) {
      const title = (item.title?.[0] || '').toString();
      const url2 = item.URL || `https://doi.org/${item.DOI}`;
      const journal = (item['container-title']?.[0] || '').toString();
      const authors = (item.author || []).slice(0, 3).map((a: { family?: string; given?: string }) => `${a.family || ''} ${a.given || ''}`.trim()).join(', ');
      const snippet = `${authors ? authors + ' · ' : ''}${journal ? journal + ' · ' : ''}${(item.abstract || '').replace(/<[^>]+>/g, '').slice(0, 240)}`;
      const built = buildSearchResult(title, url2, snippet);
      if (built) {
        const dp = item['published-print']?.['date-parts']?.[0];
        if (dp) built.publishDate = `${dp[0]}-${String(dp[1] || 1).padStart(2,'0')}-${String(dp[2] || 1).padStart(2,'0')}`;
        out.push(tagLayer(built, 'academic', 'crossref'));
      }
    }
    return out;
  } catch { return []; }
}

// ── ACADEMIC: OpenAlex (citation graph + open-access scholarly works) ────────
async function searchOpenAlex(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Aureon/1.0 (mailto:research@aureonai.app)' }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const w of (data.results || []).slice(0, limit)) {
      const title = w.title || w.display_name || '';
      const url2 = w.doi ? `https://doi.org/${String(w.doi).replace(/^https?:\/\/doi\.org\//, '')}` : (w.id || '');
      const authors = (w.authorships || []).slice(0, 3).map((a: { author?: { display_name?: string } }) => a.author?.display_name).filter(Boolean).join(', ');
      const snippet = `${authors ? authors + ' · ' : ''}cited ${w.cited_by_count || 0}× · ${w.host_venue?.display_name || w.primary_location?.source?.display_name || 'open access'}`;
      const built = buildSearchResult(title, url2, snippet);
      if (built) {
        built.publishDate = w.publication_date;
        out.push(tagLayer(built, 'academic', 'openalex'));
      }
    }
    return out;
  } catch { return []; }
}

// ── SOCIAL: Hacker News via Algolia (tech community signal) ──────────────────
async function searchHackerNews(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}&tags=story`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const hit of (data.hits || []).slice(0, limit)) {
      const url2 = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const snippet = `${hit.points || 0} points · ${hit.num_comments || 0} comments · by ${hit.author || 'anon'}`;
      const built = buildSearchResult(hit.title || hit.story_title || '', url2, snippet);
      if (built) {
        built.publishDate = hit.created_at;
        out.push(tagLayer(built, 'social', 'hackernews'));
      }
    }
    return out;
  } catch { return []; }
}

// ── SOCIAL: Reddit JSON (public posts across all subreddits) ─────────────────
async function searchReddit(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance&t=year`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Aureon-Intel/1.0' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const child of (data.data?.children || []).slice(0, limit)) {
      const p = child.data || {};
      const url2 = `https://www.reddit.com${p.permalink}`;
      const snippet = `r/${p.subreddit} · ${p.score || 0} upvotes · ${p.num_comments || 0} comments · ${(p.selftext || '').slice(0, 200)}`;
      const built = buildSearchResult(p.title || '', url2, snippet);
      if (built) {
        built.publishDate = p.created_utc ? new Date(p.created_utc * 1000).toISOString() : undefined;
        out.push(tagLayer(built, 'social', 'reddit'));
      }
    }
    return out;
  } catch { return []; }
}

// ── BLOCKCHAIN: Blockchair (BTC/ETH address + tx lookup if query matches) ────
async function searchBlockchain(query: string): Promise<SearchResult[]> {
  const out: SearchResult[] = [];
  const q = query.trim();
  // Heuristic: only fire if the query *looks* like an address or tx hash
  const btcAddr = /\b([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,62})\b/.exec(q);
  const ethAddr = /\b0x[a-fA-F0-9]{40}\b/.exec(q);
  const txHash = /\b0x[a-fA-F0-9]{64}\b/.exec(q);
  const targets: { chain: string; type: string; value: string }[] = [];
  if (btcAddr) targets.push({ chain: 'bitcoin', type: 'address', value: btcAddr[0] });
  if (ethAddr && !txHash) targets.push({ chain: 'ethereum', type: 'address', value: ethAddr[0] });
  if (txHash) targets.push({ chain: 'ethereum', type: 'transaction', value: txHash[0] });
  if (targets.length === 0) return [];
  await Promise.all(targets.map(async (t) => {
    try {
      const url = `https://api.blockchair.com/${t.chain}/dashboards/${t.type}/${t.value}?limit=5`;
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return;
      const data = await r.json();
      const obj = data?.data?.[t.value];
      if (!obj) return;
      const explorer = `https://blockchair.com/${t.chain}/${t.type}/${t.value}`;
      const summary = t.type === 'address'
        ? `${t.chain} · balance ${obj.address?.balance ?? '?'} · ${obj.address?.transaction_count ?? 0} txs · first seen ${obj.address?.first_seen_receiving || '?'}`
        : `${t.chain} tx · block ${obj.transaction?.block_id ?? '?'} · value ${obj.transaction?.value ?? '?'} · time ${obj.transaction?.time ?? '?'}`;
      const built = buildSearchResult(`${t.chain.toUpperCase()} ${t.type}: ${t.value.slice(0, 16)}…`, explorer, summary);
      if (built) {
        built.publishDate = obj.address?.last_seen_spending || obj.transaction?.time;
        built.veracity = 95; // on-chain data is cryptographically verified
        out.push(tagLayer(built, 'blockchain', `blockchair-${t.chain}`));
      }
    } catch { /* skip */ }
  }));
  return out;
}

// ── BREACH: HIBP breached-domain count (admin-keyless k-anon password check) ─
// Without an HIBP key we can only do password-hash k-anonymity, not domain
// search. We surface the public breach catalogue endpoint instead.
async function searchBreaches(query: string, limit = 6): Promise<SearchResult[]> {
  // Only fire if query looks like a domain or company name short enough
  if (query.length > 60 || query.includes(' ') && !/\.[a-z]{2,}/i.test(query)) return [];
  try {
    const r = await fetch('https://haveibeenpwned.com/api/v3/breaches', {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return [];
    const all = await r.json();
    const q = query.toLowerCase();
    const matches = (Array.isArray(all) ? all : [])
      .filter((b: { Name?: string; Domain?: string; Title?: string }) =>
        (b.Name || '').toLowerCase().includes(q)
        || (b.Domain || '').toLowerCase().includes(q)
        || (b.Title || '').toLowerCase().includes(q))
      .slice(0, limit);
    const out: SearchResult[] = [];
    for (const b of matches) {
      const built = buildSearchResult(
        `Breach: ${b.Title || b.Name} (${(b.PwnCount || 0).toLocaleString()} accounts)`,
        `https://haveibeenpwned.com/PwnedWebsites#${b.Name}`,
        `${b.Description?.replace(/<[^>]+>/g, '').slice(0, 280) || ''} · classes: ${(b.DataClasses || []).join(', ')}`,
      );
      if (built) {
        built.publishDate = b.BreachDate;
        built.veracity = 90;
        out.push(tagLayer(built, 'breach', 'hibp'));
      }
    }
    return out;
  } catch { return []; }
}

// ── IOT: Shodan (admin-key gated — exposed device intelligence) ──────────────
async function searchShodan(query: string, limit = 10): Promise<SearchResult[]> {
  const key = (Deno.env.get('SHODAN_API_KEY') || '').trim();
  if (!key) return [];
  try {
    const url = `https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(query)}&limit=${limit}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const m of (data.matches || []).slice(0, limit)) {
      const url2 = `https://www.shodan.io/host/${m.ip_str}`;
      const snippet = `${m.org || 'unknown'} · ${m.location?.country_name || ''} · port ${m.port} · ${m.product || m._shodan?.module || ''} · ${(m.data || '').slice(0, 200)}`;
      const built = buildSearchResult(`${m.ip_str}:${m.port} (${m.hostnames?.[0] || m.org || 'host'})`, url2, snippet);
      if (built) {
        built.publishDate = m.timestamp;
        built.veracity = 92;
        out.push(tagLayer(built, 'iot', 'shodan'));
      }
    }
    return out;
  } catch { return []; }
}

// ── VULN: NVD CVE search (vulnerability intelligence) ────────────────────────
async function searchCVE(query: string, limit = 8): Promise<SearchResult[]> {
  // Only fire if query mentions CVE, vulnerability, exploit, or matches CVE-XXXX-NNNN
  const directCve = /CVE-\d{4}-\d{4,7}/i.exec(query);
  const looksVuln = directCve || /\b(cve|vulnerab|exploit|0-?day|rce|xss|sqli|csrf|ssrf)\b/i.test(query);
  if (!looksVuln) return [];
  try {
    const params = directCve
      ? `cveId=${directCve[0].toUpperCase()}`
      : `keywordSearch=${encodeURIComponent(query)}&resultsPerPage=${limit}`;
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const v of (data.vulnerabilities || []).slice(0, limit)) {
      const cve = v.cve || {};
      const id = cve.id || '';
      const desc = (cve.descriptions || []).find((d: { lang?: string }) => d.lang === 'en')?.value || '';
      const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore
                 ?? cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore
                 ?? cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore;
      const sev = cvss ? (cvss >= 9 ? 'CRITICAL' : cvss >= 7 ? 'HIGH' : cvss >= 4 ? 'MEDIUM' : 'LOW') : 'UNRATED';
      const built = buildSearchResult(`${id} · ${sev}${cvss ? ' (' + cvss + ')' : ''}`, `https://nvd.nist.gov/vuln/detail/${id}`, desc.slice(0, 320));
      if (built) {
        built.publishDate = cve.published;
        built.veracity = 95;
        out.push(tagLayer(built, 'vuln', 'nvd-cve'));
      }
    }
    return out;
  } catch { return []; }
}

// ── DEEP: Google Books (corpus of digitised books) ───────────────────────────
async function searchGoogleBooks(query: string, limit = 8): Promise<SearchResult[]> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}&printType=books`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const data = await r.json();
    const out: SearchResult[] = [];
    for (const item of (data.items || []).slice(0, limit)) {
      const v = item.volumeInfo || {};
      const title = `${v.title || ''}${v.subtitle ? ': ' + v.subtitle : ''}`;
      const url2 = v.infoLink || v.canonicalVolumeLink || `https://books.google.com/books?id=${item.id}`;
      const snippet = `${(v.authors || []).join(', ')} · ${v.publisher || ''} · ${v.publishedDate || ''} · ${(v.description || '').slice(0, 240)}`;
      const built = buildSearchResult(title, url2, snippet);
      if (built) {
        built.publishDate = v.publishedDate;
        out.push(tagLayer(built, 'deep', 'google-books'));
      }
    }
    return out;
  } catch { return []; }
}

// ── Multi-Engine Aggregated Search ──────────────────────────────────────────
async function multiEngineSearch(query: string, page: number, dateFilter?: string, fast = false): Promise<SearchResult[]> {
  // FAST LANE — used by chat's jurisdictional sweep, which aborts at ~10s.
  // The full 22-engine fan-out now costs >10s wall-clock, so every chat-side
  // call was being aborted and the sweep saw ZERO web hits (the "only gov
  // sites" symptom). Fast mode runs only the engines that actually return
  // people/entity data from edge IPs, and drops the scrapers that are
  // bot-blocked (DDG/Brave/Mojeek/MetaGer/Gigablast/Yandex/SearXNG) plus the
  // academic/blockchain/IoT layers that are irrelevant to a person lookup.
  if (fast) {
    const [fc, wiki, edgar, gh] = await Promise.allSettled([
      searchFirecrawl(query, 20),
      searchWikipedia(query),
      searchEDGAR(query),
      searchGitHubCode(query),
    ]);
    const out: SearchResult[] = [];
    const seen = new Set<string>();
    const push = (st: PromiseSettledResult<SearchResult[]>, engine: string, layer: PantheonLayer) => {
      if (st.status !== 'fulfilled') return;
      for (const r of st.value) {
        if (!r.layer) r.layer = layer;
        if (!r.engine) r.engine = engine;
        const k = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(r);
      }
    };
    push(fc, 'firecrawl', 'surface');
    push(wiki, 'wikipedia', 'surface');
    push(edgar, 'sec-edgar', 'deep');
    push(gh, 'github', 'code');
    return out;
  }

  // PANTHEON v3: surface engines + deep/code/academic/social/chain/breach/iot/vuln in parallel.
  const [
    firecrawlResults,
    ddgResults, searxResults, mojeekResults, metagerResults, gigablastResults,
    wikiResults, braveResults, yandexResults,
    // PANTHEON layers
    commonCrawlResults, waybackResults, githubResults, edgarResults,
    crossrefResults, openalexResults,
    hnResults, redditResults,
    chainResults, breachResults, shodanResults, cveResults, booksResults,
  ] = await Promise.allSettled([
    searchFirecrawl(query, 15),
    searchDDG(query, page, dateFilter),
    searchSearXNG(query),
    searchMojeek(query),
    Promise.resolve([] as SearchResult[]),
    Promise.resolve([] as SearchResult[]),
    searchWikipedia(query),
    searchBrave(query),
    searchYandex(query),
    // PANTHEON
    searchCommonCrawl(query),
    searchWayback(query),
    searchGitHubCode(query),
    searchEDGAR(query),
    searchCrossRef(query),
    searchOpenAlex(query),
    searchHackerNews(query),
    searchReddit(query),
    searchBlockchain(query),
    searchBreaches(query),
    searchShodan(query),
    searchCVE(query),
    searchGoogleBooks(query),
  ]);

  const all: SearchResult[] = [];
  const seenUrls = new Set<string>();

  // O(1) URL index — the previous `all.find(...)` inside the dedupe branch made
  // merging O(n²) across 22 engines.
  const byUrl = new Map<string, SearchResult>();

  const addResults = (settled: PromiseSettledResult<SearchResult[]>, engine: string, layer: PantheonLayer = 'surface') => {
    if (settled.status !== 'fulfilled') return;
    for (const r of settled.value) {
      // Stamp surface results that came in untagged.
      if (!r.layer) r.layer = layer;
      if (!r.engine) r.engine = engine;
      const normalUrl = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
      const existing = byUrl.get(normalUrl);
      if (existing) {
        // Corroboration is recorded per-engine; the credibility bonus is later
        // computed on DISTINCT independence classes, not raw engine count.
        if (!existing.engines) existing.engines = [existing.engine || 'unknown'];
        if (!existing.engines.includes(engine)) existing.engines.push(engine);
        const classes = new Set(existing.engines.map(engineClass));
        existing.independence = classes.size;
        existing.veracity = Math.min(100, existing.veracity + 5);
        existing.truthGraph.consensusWeight = Math.min(1, existing.truthGraph.consensusWeight + 0.15);
        continue;
      }
      r.engines = [engine];
      r.independence = 1;
      seenUrls.add(normalUrl);
      byUrl.set(normalUrl, r);
      all.push(r);
    }
  };


  // Surface
  addResults(firecrawlResults, 'firecrawl', 'surface');
  addResults(ddgResults, 'ddg', 'surface');
  addResults(searxResults, 'searxng', 'surface');
  addResults(mojeekResults, 'mojeek', 'surface');
  // metager/gigablast retired: Gigablast is defunct and MetaGer bot-blocks edge
  // IPs, so both contributed only latency and a false independence class.
  addResults(wikiResults, 'wikipedia', 'surface');
  addResults(braveResults, 'brave', 'surface');
  addResults(yandexResults, 'yandex', 'surface');
  // PANTHEON layers (already tagged inside their fetchers)
  addResults(commonCrawlResults, 'common-crawl', 'deep');
  addResults(waybackResults, 'wayback', 'deep');
  addResults(githubResults, 'github', 'code');
  addResults(edgarResults, 'sec-edgar', 'deep');
  addResults(crossrefResults, 'crossref', 'academic');
  addResults(openalexResults, 'openalex', 'academic');
  addResults(hnResults, 'hackernews', 'social');
  addResults(redditResults, 'reddit', 'social');
  addResults(chainResults, 'blockchair', 'blockchain');
  addResults(breachResults, 'hibp', 'breach');
  addResults(shodanResults, 'shodan', 'iot');
  addResults(cveResults, 'nvd-cve', 'vuln');
  addResults(booksResults, 'google-books', 'deep');

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

// ── Instant Answer from DDG API ──────────────────────────────────────────────
async function fetchInstantAnswer(query: string): Promise<InstantAnswer | null> {
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
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();
    const { query, page = 1, mode = 'web', filters, operatorOverrides } = body;
    const fast = (body as { fast?: boolean }).fast === true;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = query.trim();
    
    // ── Semantic Intent Analysis ──
    const semanticIntent = analyzeSemanticIntent(trimmed);

    // ── Stage 1: Query Understanding (pure lexical, sub-ms, no model call) ──
    const plan = buildQueryPlan(trimmed);

    const builtQuery = buildSearchQuery(plan, mode, semanticIntent, filters, operatorOverrides);
    const instantAnswerType = detectInstantAnswerType(trimmed);

    // Run multi-engine search + instant answer + always-on onion search in parallel.
    // Onion is gated to text/research modes — never runs for code/docs/data lookups
    // where it would only add noise.
    const onionEligible = !fast && (mode === 'web' || mode === 'news' || mode === 'academic');
    const [searchResults, instantAnswer, onionResults] = await Promise.all([
      multiEngineSearch(builtQuery, page, filters?.dateRange, fast),
      fetchInstantAnswer(trimmed),
      onionEligible ? searchAhmiaOnion(trimmed, 8).catch(() => []) : Promise.resolve([] as SearchResult[]),
    ]);

    // Merge clearnet + onion. Dedupe by URL just in case Ahmia returned a clearnet mirror.
    const seenUrls = new Set(searchResults.map(r => r.url));
    const mergedResults = [...searchResults];
    for (const r of onionResults) {
      if (!seenUrls.has(r.url)) {
        mergedResults.push(r);
        seenUrls.add(r.url);
      }
    }

    // Apply credibility filter (onion = tier 5, so credibilityMin <=4 will hide them)
    let filtered = mergedResults;
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

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 3 — TWO-FACTOR RANKING (relevance × credibility, weighted sum)
    // Credibility alone reads as randomness: a tier-1 domain that never mentions
    // the subject used to outrank the one page that does. Relevance now leads,
    // credibility floors at 0.5 so no source is annihilated.
    // ═══════════════════════════════════════════════════════════════════════
    const applyRanking = (rows: SearchResult[]) => {
      for (const r of rows) {
        r.relevance = scoreRelevance(plan, { title: r.title, url: r.url, snippet: r.snippet });
        r.score = finalScore({
          relevance: r.relevance,
          veracity: r.veracity,
          engines: r.engines,
          hostile: r.truthGraph.hostileFlag,
        });
      }
      rows.sort((a, b) => {
        if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
        if (b.veracity !== a.veracity) return b.veracity - a.veracity;
        return a.tier - b.tier;
      });
      rows.forEach((r, i) => { r.rank = i + 1; });
    };

    applyRanking(filtered);

    // ── Rescue pass ────────────────────────────────────────────────────────
    // If the top of the list is topically weak, the constraint set was too
    // tight (or the SERP missed). Re-issue a RELAXED query against the three
    // fastest surface engines only, under a hard 4s cap. Skipped in fast mode
    // so chat's sweep budget is untouched.
    let rescueUsed = false;
    const topRelevance = filtered.slice(0, 5).reduce((s, r) => s + (r.relevance ?? 0), 0) / Math.max(1, Math.min(5, filtered.length));
    if (!fast && plan.required.length > 0 && (filtered.length < 5 || topRelevance < 0.45)) {
      try {
        const relaxed = relaxedQuery(plan);
        const rescue = await Promise.race([
          Promise.allSettled([
            searchDDG(relaxed, 1, filters?.dateRange),
            searchMojeek(relaxed),
            searchFirecrawl(relaxed, 10),
          ]),
          new Promise<PromiseSettledResult<SearchResult[]>[]>((res) => setTimeout(() => res([]), 4000)),
        ]);
        const known = new Set(filtered.map(r => r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://')));
        const engines = ['ddg', 'mojeek', 'firecrawl'];
        rescue.forEach((st, i) => {
          if (st.status !== 'fulfilled') return;
          for (const r of st.value) {
            const k = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
            if (known.has(k)) continue;
            known.add(k);
            r.engine = r.engine || engines[i];
            r.engines = [engines[i]];
            r.independence = 1;
            r.layer = r.layer || 'surface';
            filtered.push(r);
            rescueUsed = true;
          }
        });
        if (rescueUsed) applyRanking(filtered);
      } catch { /* rescue is best-effort — never fails the search */ }
    }
    console.log(`[zophiel] plan required=${JSON.stringify(plan.required)} entity=${plan.entity} results=${filtered.length} topRel=${topRelevance.toFixed(2)} rescue=${rescueUsed}`);


    // ═══════════════════════════════════════════════════════════════════════
    // OMNISPIDER ENRICHMENT — shep95/web-crawlers integration
    // Multi-engine crawl (HTTP + Wayback fallback + sitemap discovery +
    // Katana-style link extraction + robots.txt gate) on top results, used
    // to enhance snippets, harvest titles, and surface archived snapshots.
    // ═══════════════════════════════════════════════════════════════════════
    let omniEngineCounts: Record<string, number> = {};
    let omniCrawledCount = 0;
    try {
      // Fast lane skips OmniSpider entirely: its 15s crawl budget was the
      // dominant cost of every search (10s+ wall clock), which is exactly what
      // pushed chat's sweep past its abort deadline. Chat performs its own
      // body-fetch pass on the top hits, so nothing is lost.
      const onionClearnet = fast ? [] : filtered.filter(r => !r.onion).slice(0, 10);
      if (onionClearnet.length > 0) {
        const seeds = onionClearnet.map(r => r.url);
        const allowedDomains = Array.from(new Set(onionClearnet.map(r => extractDomain(r.url))));
        const omni = await omnispiderCrawl({
          seeds,
          allowedDomains,
          maxPages: 10,
          maxDepth: 1,
          respectRobots: true,
          useSitemaps: false,
          useWayback: true,
          useKatana: true,
          perDomainDelayMs: 250,
          timeoutMs: 6000,
          totalBudgetMs: 15000,
        });
        omniEngineCounts = omni.engineCounts || {};
        omniCrawledCount = omni.pages.length;
        // Build a quick lookup by URL/domain to merge crawled text into snippets
        const byUrl = new Map<string, OmniCrawledPage>();
        for (const p of omni.pages) {
          byUrl.set(p.url, p);
          if (p.finalUrl && p.finalUrl !== p.url) byUrl.set(p.finalUrl, p);
        }
        for (const r of filtered) {
          const hit = byUrl.get(r.url);
          if (!hit || !hit.text) continue;
          const extra = hit.text.replace(/\s+/g, ' ').trim().slice(0, 420);
          if (extra && extra.length > (r.snippet?.length || 0)) {
            r.snippet = extra;
          }
          if (!r.title || r.title === extractDomain(r.url)) {
            if (hit.title) r.title = hit.title;
          }
          if (hit.engine === 'archive') {
            (r as any).archivedSnapshot = true;
          }
        }
      }
    } catch (e) {
      console.warn('[ZOPHIEL] Omnispider enrichment failed (non-fatal):', e);
    }


    // Re-rank after OmniSpider enrichment: enriched snippets carry new evidence,
    // so relevance must be recomputed against the fuller text.
    applyRanking(filtered);

    // Mode-relevant domains get a bounded score BONUS. The previous version
    // hoisted every boosted domain above the entire list, which discarded the
    // ranking that had just been computed.
    const boostDomains = new Set(MODE_DOMAIN_BOOSTS[mode] || []);
    if (boostDomains.size > 0) {
      for (const r of filtered) {
        if (boostDomains.has(extractDomain(r.url))) r.score = (r.score ?? 0) + 0.08;
      }
      filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      filtered.forEach((r, i) => { r.rank = i + 1; });
    }

    // ── Relevance floor ────────────────────────────────────────────────────
    // The always-on academic/filings layers answer every query with something,
    // so a person lookup used to ship 45 off-topic filings behind 5 correct
    // hits. Anything that scores below the floor is pruned — but only while a
    // usable head survives, so a genuinely sparse query still returns its tail.
    const RELEVANCE_FLOOR = 0.12;
    const survivors = filtered.filter(r => (r.relevance ?? 0) >= RELEVANCE_FLOOR);
    let prunedCount = 0;
    if (survivors.length >= 8 && survivors.length < filtered.length) {
      prunedCount = filtered.length - survivors.length;
      filtered = survivors;
      filtered.forEach((r, i) => { r.rank = i + 1; });
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

    // PANTHEON layer + engine breakdown — additive metadata for UI badges.
    const layerCounts: Record<string, number> = {};
    const engineCounts: Record<string, number> = {};
    for (const r of filtered) {
      const l = r.layer || 'surface';
      layerCounts[l] = (layerCounts[l] || 0) + 1;
      if (r.engine) engineCounts[r.engine] = (engineCounts[r.engine] || 0) + 1;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PANTHEON v5 — UNIFIED FUSION LAYER
    // The inline regex extractor that used to live here duplicated (and
    // disagreed with) serpEntityEngine. There is now ONE extractor: fuseCorpus
    // runs serpEntityEngine, then derives PageRank centrality, story clusters,
    // per-claim veracity, contradictions and numeric anomalies from the same
    // corpus in a single pass. Nothing below is a model output.
    // ═══════════════════════════════════════════════════════════════════════
    const fusion = fuseCorpus(trimmed, filtered.map(r => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      domain: extractDomain(r.url),
      tier: r.tier,
      engine: r.engine,
      engines: r.engines,
      layer: r.layer,
      onion: r.onion,
      publishDate: r.publishDate,
    })));

    // Stamp each result with its data TYPE so the UI can group by what a source
    // IS (filing / breach record / social profile) rather than by which engine
    // happened to return it.
    for (const r of filtered) (r as any).dataType = fusion.dataTypes[r.url] || 'web';

    const centralityById = new Map(fusion.centrality.map(c => [c.id, c]));

    // Legacy-compatible entity shape (`value/type/mentions/weight/...`) so the
    // existing UI keeps rendering, now carrying centrality + resolution.
    const entities = fusion.intel.entities.slice(0, 60).map((e) => {
      const c = centralityById.get(e.id);
      return {
        value: e.label.toLowerCase(),
        label: e.label,
        type: e.kind,
        mentions: e.mentions,
        weight: Math.round((c?.pagerank ?? 0) * 10000),
        pagerank: c?.pagerank ?? 0,
        degree: c?.degree ?? 0,
        confidence: e.confidence,
        corroborated: e.sources.length >= 2,
        sources: e.sources.slice(0, 5),
      };
    });

    const edges = fusion.intel.edges.slice(0, 120);

    const entityCounts: Record<string, number> = {};
    for (const e of entities) entityCounts[e.type] = (entityCounts[e.type] || 0) + 1;

    const rankingQuality = computeRankingQuality(filtered.map(r => ({
      url: r.url, title: r.title, snippet: r.snippet, domain: extractDomain(r.url),
      tier: r.tier, engine: r.engine, engines: r.engines,
      relevance: r.relevance, veracity: r.veracity,
      dataType: fusion.dataTypes[r.url],
    })));

    // ── Query-outcome feedback loop ────────────────────────────────────────
    // Every search writes its own report card. Without this the engine can
    // never answer "is ranking getting better or worse", which is the only way
    // a heuristic ranker stays honest over time. Best-effort: never blocks.
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          await sb.from('zophiel_query_outcomes').insert({
            user_id: user.id,
            query: trimmed.slice(0, 500),
            mode,
            query_shape: plan.shape,
            entity_kind: plan.entity,
            result_count: filtered.length,
            avg_relevance: rankingQuality.avgRelevance,
            on_target_rate: rankingQuality.onTargetRate,
            rescue_used: rescueUsed,
            engine_hit_rate: rankingQuality.engineHitRate,
            independence_classes: rankingQuality.independenceClasses,
            data_type_distribution: rankingQuality.dataTypeDistribution,
            contradiction_count: fusion.contradictions.length,
            claim_count: fusion.claims.length,
          });
        }
      }
    } catch (e) {
      console.warn('[zophiel] outcome log failed (non-fatal)', e instanceof Error ? e.message : String(e));
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
        // Truth Graph metadata
        semanticIntent,
        consensus,
        // Stage-1 Query Understanding (what the ranker actually gated on)
        queryPlan: {
          required: plan.required,
          requiredWeighted: plan.requiredWeighted,
          optional: plan.optional,
          negative: plan.negative,
          phrases: plan.phrases,
          entity: plan.entity,
          shape: plan.shape,
          relations: plan.relations,
          scriptNote: plan.scriptNote,
          wireQuery: plan.wireQuery,
        },
        rescueUsed,
        prunedBelowFloor: prunedCount,
        // PANTHEON v3 metadata
        layerCounts,
        engineCounts,
        // PANTHEON v5 — unified fusion output
        entities,
        entityCounts,
        entityEdges: edges,
        centrality: fusion.centrality.slice(0, 40),
        clusters: fusion.clusters.slice(0, 20),
        claims: fusion.claims,
        contradictions: fusion.contradictions,
        anomalies: fusion.anomalies,
        identities: fusion.intel.identities?.slice(0, 20) ?? [],
        rankingQuality,
        pantheonVersion: 5,
        // Omnispider (shep95/web-crawlers) enrichment telemetry
        omnispider: { crawled: omniCrawledCount, engines: omniEngineCounts },
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
