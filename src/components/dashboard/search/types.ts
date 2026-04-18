export type SourceTier = 1 | 2 | 3 | 4;
export type SearchMode = 'web' | 'news' | 'academic' | 'code' | 'data' | 'docs' | 'deep' | 'imagine' | 'extract';

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
  dateRange?: 'day' | 'week' | 'month' | 'year';
  domainInclude?: string[];
  domainExclude?: string[];
  fileType?: string;
  sourceType?: string[];
  credibilityMin?: SourceTier;
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
