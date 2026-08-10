export type SourceTier = 1 | 2 | 3 | 4 | 5;
export type SearchMode = 'web' | 'news' | 'academic' | 'code' | 'data' | 'docs' | 'deep' | 'imagine' | 'extract' | 'audit' | 'face' | 'darkweb' | 'leaks' | 'archive' | 'vpn' | 'dataengine' | 'harvest' | 'scribd' | 'dork' | 'ghostchain' | 'zophielv2' | 'shadow';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  tier: SourceTier;
  tierLabel: string;
  publishDate?: string;
  readingTimeMin?: number;
  category: 'primary' | 'breaking' | 'analysis' | 'background' | 'community' | 'multimedia' | 'general';
  /** Tier-5 onion result. URL is a .onion address — UI must NOT render a clickable anchor. */
  onion?: boolean;


}

export interface InstantAnswer {
  type: string;
  title: string;
  value: string;
  source?: string;
  details?: Record<string, string>;
}

export interface FreshnessAlert {
  message: string;
  severity: 'warning' | 'info';
}

export interface SearchFilters {
  dateRange?: 'day' | 'week' | 'month' | 'year' | 'custom';
  dateFrom?: string; // YYYY-MM-DD (custom)
  dateTo?: string;   // YYYY-MM-DD (custom)
  domainInclude?: string[];
  domainExclude?: string[];
  fileType?: string;        // pdf | doc | xls | ppt | txt | csv
  sourceType?: string[];    // news | academic | gov | blog | forum | social | video
  credibilityMin?: SourceTier;
  language?: string;        // ISO 639-1: en, es, fr, de, ja, zh, ar, ru…
  region?: string;          // ISO 3166-1 alpha-2: US, GB, FR…
  exactPhrase?: string;     // wraps as "..."
  includeKeywords?: string[];
  excludeKeywords?: string[];
  contentLength?: 'short' | 'medium' | 'long';
  sortBy?: 'relevance' | 'date' | 'credibility';
  safeSearch?: 'off' | 'moderate' | 'strict';
  intitle?: string;
  inurl?: string;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  builtQuery: string;
  mode: SearchMode;
  instantAnswer: InstantAnswer | null;
  instantAnswerType: string | null;
  results: SearchResult[];
  grouped: Record<string, SearchResult[]>;
  freshnessAlerts: Record<string, FreshnessAlert>;
  page: number;
  totalResults: number;
  error?: string;
}

export interface PagePreview {
  success: boolean;
  title: string;
  description: string;
  content: string;
  wordCount: number;
  readingTimeMin: number;
  isPaywalled: boolean;
  fetchedAt: string;
  error?: string;
}

export interface BlockedDomain {
  domain: string;
  blockedAt: string;
}
