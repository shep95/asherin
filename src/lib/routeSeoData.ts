// Shared per-route SEO source of truth.
// Consumed at runtime by src/components/RouteSeo.tsx and at build time by
// scripts/seoPrerenderPlugin.ts, which bakes these tags into static per-route
// HTML so non-JS crawlers (social previews, plain fetchers) see them too.

export const ORIGIN = "https://asherin.com";
export const DEFAULT_OG_IMAGE = "https://asherin.com/og-image.png";

export type SeoEntry = {
  title: string;
  description: string;
  ogType?: "website" | "article" | "product";
  /** ISO date (YYYY-MM-DD) — required for editorial routes so Article JSON-LD is valid. */
  datePublished?: string;
  dateModified?: string;
  noindex?: boolean;
};

export const ROUTE_SEO: Record<string, SeoEntry> = ;

// NOTE: /asher is intentionally NOT skipped — it has a SEO entry and is in the sitemap;
// skipping it caused the static index.html canonical (pointing to "/") to leak through,
// making crawlers treat /asher as a duplicate of the homepage and drop it.
export const SKIP_PREFIXES = ["/dashboard", "/asher-dashboard"];
