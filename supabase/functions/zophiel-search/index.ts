const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Source Credibility Tiers ──────────────────────────────────────────────────
const TIER_1_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nature.com', 'science.org',
  'who.int', 'nih.gov', 'cdc.gov', 'nasa.gov', 'sec.gov', 'federalreserve.gov',
  'supremecourt.gov', 'congress.gov', 'whitehouse.gov', 'europa.eu',
  'worldbank.org', 'imf.org', 'un.org', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov',
  'scholar.google.com', 'jstor.org', 'ncbi.nlm.nih.gov', 'ieee.org',
]);

const TIER_2_DOMAINS = new Set([
  'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'economist.com',
  'wsj.com', 'ft.com', 'bloomberg.com', 'cnbc.com', 'techcrunch.com',
  'wired.com', 'arstechnica.com', 'theatlantic.com', 'newyorker.com',
  'propublica.com', 'politico.com', 'npr.org', 'pbs.org',
  'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.python.org',
  'docs.microsoft.com', 'learn.microsoft.com', 'cloud.google.com', 'aws.amazon.com',
  'wikipedia.org', 'britannica.com', 'statista.com',
]);

const TIER_3_PATTERNS = ['.gov', '.edu', '.ac.uk', '.ac.jp', '.edu.au'];

type SourceTier = 1 | 2 | 3 | 4;

function getSourceTier(domain: string): SourceTier {
  const clean = domain.replace(/^www\./, '');
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
  }
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
function buildSearchQuery(query: string, mode: SearchMode, filters?: SearchFilters, operatorOverrides?: string): string {
  let q = query.trim();

  // Apply mode prefix
  const prefix = MODE_QUERY_PREFIX[mode];
  if (prefix) q = prefix + q;

  // Apply operator overrides (raw search operators from the panel)
  if (operatorOverrides) q += ' ' + operatorOverrides;

  // Apply filters
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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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
  // Try to find dates in various formats
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
  
  // Check if it's recent news (within last 24h based on date)
  if (result.publishDate) {
    try {
      const pubDate = new Date(result.publishDate);
      const dayAgo = new Date(Date.now() - 86400000);
      if (pubDate > dayAgo) return 'breaking';
    } catch { /* ignore */ }
  }
  
  // Long snippets suggest analysis
  if (result.snippet.length > 200) return 'analysis';
  
  return 'general';
}

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
  const results: SearchResult[] = [];
  const resultBlocks = html.split(/class="result\s/);

  for (let i = 1; i < resultBlocks.length && results.length < 20; i++) {
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

    const result: SearchResult = {
      title,
      url,
      snippet: rawSnippet,
      source: source || domain,
      tier,
      tierLabel: getTierLabel(tier),
      publishDate,
      readingTimeMin,
      category: 'general',
    };
    result.category = categorizeResult(result);
    results.push(result);
  }

  return results;
}

// ── Page Content Extraction (Custom Scraper) ─────────────────────────────────
async function extractPageContent(url: string): Promise<{ content: string; readingTimeMin: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await resp.text();

    // Extract main content - try article/main tags first, then body
    let mainHtml = '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    
    if (articleMatch) mainHtml = articleMatch[1];
    else if (mainMatch) mainHtml = mainMatch[1];
    else {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      mainHtml = bodyMatch ? bodyMatch[1] : html;
    }

    const content = cleanHtml(mainHtml).slice(0, 5000); // Cap at 5k chars
    const readingTimeMin = estimateReadingTime(content);

    return { content, readingTimeMin };
  } catch {
    return null;
  }
}

// ── Instant Answer from DDG API ──────────────────────────────────────────────
async function fetchInstantAnswer(query: string): Promise<InstantAnswer | null> {
  try {
    const iaResp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!iaResp.ok) return null;
    const iaData = await iaResp.json();

    if (iaData.AbstractText) {
      return {
        type: 'abstract',
        title: iaData.Heading || query,
        value: iaData.AbstractText,
        source: iaData.AbstractSource,
        details: iaData.AbstractURL ? { url: iaData.AbstractURL } : undefined,
      };
    }
    if (iaData.Answer) {
      return {
        type: 'answer',
        title: query,
        value: iaData.Answer,
        source: iaData.AnswerType || 'DuckDuckGo',
      };
    }
    if (iaData.Definition) {
      return {
        type: 'definition',
        title: iaData.Heading || query,
        value: iaData.Definition,
        source: iaData.DefinitionSource,
      };
    }
    return null;
  } catch {
    return null;
  }
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

    // Finance/markets — stale after 7 days
    if (/\b(stock|market|price|earnings|trading|crypto|bitcoin|eth)\b/.test(q) && diffDays > 7) {
      return { message: `This result is ${diffDays} days old. Financial data may have changed.`, severity: 'warning' };
    }
    // News — stale after 3 days
    if (/\b(news|breaking|latest|update|today)\b/.test(q) && diffDays > 3) {
      return { message: `Published ${diffDays} days ago. Newer coverage may be available.`, severity: 'info' };
    }
    // Tech — stale after 180 days
    if (/\b(tutorial|guide|how to|install|setup|config|version)\b/.test(q) && diffDays > 180) {
      return { message: `This article is ${Math.floor(diffDays / 30)} months old. Tech info may be outdated.`, severity: 'warning' };
    }
    // Medical — stale after 365 days
    if (/\b(health|medical|treatment|symptom|disease|drug|medicine)\b/.test(q) && diffDays > 365) {
      return { message: `Published over a year ago. Medical guidance may have changed.`, severity: 'warning' };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────
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
    const builtQuery = buildSearchQuery(trimmed, mode, filters, operatorOverrides);

    // Detect instant answer type
    const instantAnswerType = detectInstantAnswerType(trimmed);

    // Run search + instant answer in parallel
    const [searchResults, instantAnswer] = await Promise.all([
      searchDDG(builtQuery, page, filters?.dateRange),
      fetchInstantAnswer(trimmed),
    ]);

    // Apply credibility filter
    let filtered = searchResults;
    if (filters?.credibilityMin) {
      filtered = filtered.filter(r => r.tier <= filters.credibilityMin!);
    }

    // Boost mode-relevant domains to the top
    const boostDomains = new Set(MODE_DOMAIN_BOOSTS[mode] || []);
    if (boostDomains.size > 0) {
      filtered.sort((a, b) => {
        const aBoost = boostDomains.has(extractDomain(a.url)) ? 0 : 1;
        const bBoost = boostDomains.has(extractDomain(b.url)) ? 0 : 1;
        return aBoost - bBoost;
      });
    }

    // Group results by category
    const grouped: Record<string, SearchResult[]> = {};
    for (const r of filtered) {
      const cat = r.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }

    // Add freshness alerts
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
