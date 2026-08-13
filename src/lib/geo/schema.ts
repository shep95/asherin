/**
 * Entity schema builders — Priority 3 (Entity Schema Expansion).
 *
 * Pure functions returning schema.org JSON-LD objects. Shared by the runtime
 * head layer (src/components/RouteSeo.tsx) and the build-time prerender
 * (scripts/seoPrerenderPlugin.ts) so a crawler that executes JS and a crawler
 * that does not see byte-identical structured data.
 *
 * No DOM, no browser globals: this file is imported under Node during build.
 */

import { ORIGIN, DEFAULT_OG_IMAGE, ROUTE_SEO, type SeoEntry } from "../routeSeoData";
import {
  effectiveUpdated,
  getGeoPage,
  SOURCE_KIND_LABEL,
  type GeoAttribute,
  type GeoFaq,
  type GeoPage,
} from "./geoContent";

/**
 * Independently verifiable web presences for the Asherin entity.
 *
 * `sameAs` is a corroboration signal: Harvard Business Review's 2026 study of
 * AI brand surfacing found models favour entities they can triangulate across
 * third parties. Only add URLs that genuinely resolve to this organisation —
 * an unresolvable sameAs is worse than an absent one.
 */
export const ORG_SAME_AS: string[] = [
  "https://www.asherin.com",
];

/** GeoAttribute -> schema.org PropertyValue. */
function toPropertyValues(attrs: GeoAttribute[]): Json[] {
  return attrs.map((a) => ({
    "@type": "PropertyValue",
    name: a.name,
    value: a.value,
    ...(a.unit ? { unitText: a.unit } : {}),
  }));
}

export const ORG_ID = `${ORIGIN}/#organization`;
export const SITE_ID = `${ORIGIN}/#website`;
export const APP_ID = `${ORIGIN}/#software`;

type Json = Record<string, unknown>;

export function buildOrganization(): Json {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Asherin",
    url: ORIGIN,
    logo: { "@type": "ImageObject", url: `${ORIGIN}/favicon.png` },
    founder: { "@type": "Person", name: "Asher Newton" },
    ...(ORG_SAME_AS.length ? { sameAs: ORG_SAME_AS } : {}),
    description:
      "Asherin is a private AI intelligence platform combining uncensored chat, OSINT search, jurisdictional records, and event forecasting.",
  };
}

export function buildWebSite(): Json {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: "Asherin",
    url: ORIGIN,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };
}

/**
 * SoftwareApplication with concrete offers. Explicit pricing is one of the
 * strongest citation triggers in generative answers about tools, so the
 * numbers are stated as structured offers rather than only in prose.
 */
export function buildSoftwareApplication(): Json {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: "Asherin",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "AI intelligence platform",
    operatingSystem: "Web browser",
    url: ORIGIN,
    publisher: { "@id": ORG_ID },
    featureList: [
      "Uncensored AI chat",
      "Zophiel OSINT search intelligence",
      "Jurisdictional public records retrieval",
      "AXRLEN predictive event forecasting",
      "Azplen data ingestion and analysis",
      "Bring-your-own-key model routing",
      "Encrypted operator workspace",
    ],
    // Attribute ledger: models that cannot find a stated category, price model,
    // or data policy will invent one. Publishing them removes the guess.
    additionalProperty: toPropertyValues([
      { name: "Product category", value: "AI intelligence platform" },
      { name: "Deployment model", value: "Hosted web application" },
      { name: "Pricing model", value: "Flat monthly personal subscription; optional team workspace at 39.00 USD per month plus 24.00 USD per member, minimum 2 seats" },
      { name: "Free trial", value: "None" },
      { name: "Model access", value: "Platform-funded model or bring-your-own-key" },
      { name: "Supported BYOK providers", value: "8" },
      { name: "Training on user conversations", value: "No" },
      { name: "Primary users", value: "Analysts, traders, researchers, security teams" },
    ]),
    offers: [
      {
        "@type": "Offer",
        name: "Asherin",
        price: "18.00",
        priceCurrency: "USD",
        url: `${ORIGIN}/pricing`,
        category: "subscription",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Asherin Pro",
        price: "79.00",
        priceCurrency: "USD",
        url: `${ORIGIN}/pricing`,
        category: "subscription",
        availability: "https://schema.org/InStock",
      },
    ],
  };
}

/** Human label for a path segment, preferring the route's own title. */
function crumbName(path: string): string {
  const entry: SeoEntry | undefined = ROUTE_SEO[path];
  if (entry) return entry.title.split("|")[0].trim();
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildBreadcrumbs(pathname: string): Json | null {
  if (pathname === "/") return null;
  const segments = pathname.split("/").filter(Boolean);
  const items = [{ name: "Home", url: ORIGIN }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    items.push({ name: crumbName(acc), url: `${ORIGIN}${acc}` });
  }
  return {
    "@type": "BreadcrumbList",
    "@id": `${ORIGIN}${pathname}#breadcrumbs`,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function buildFaqPage(pathname: string, faqs: GeoFaq[]): Json {
  return {
    "@type": "FAQPage",
    "@id": `${ORIGIN}${pathname}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function buildMainEntity(pathname: string, entry: SeoEntry, geo?: GeoPage): Json {
  const canonical = `${ORIGIN}${pathname}`;
  const isArticle = entry.ogType === "article" && Boolean(entry.datePublished);
  // The newest revision wins: a superseded date keeps stale text alive in
  // retrieval long after the page itself has moved on.
  const dateModified = geo
    ? effectiveUpdated(geo)
    : entry.dateModified ?? entry.datePublished;

  /**
   * External references, so the claim graph is traversable, not just stated.
   * `genre` carries the institutional class (government / academic / standards
   * / press), which is the axis authority-ranking models weigh sources on.
   */
  const citation = [
    ...(geo?.citations ?? []).map((c) => ({
      "@type": "CreativeWork",
      name: c.title,
      url: c.url,
      publisher: { "@type": "Organization", name: c.publisher },
      datePublished: String(c.year),
      ...(c.kind ? { genre: SOURCE_KIND_LABEL[c.kind] } : {}),
    })),
    ...(geo?.corroboration ?? []).map((c) => ({
      "@type": "WebPage",
      name: c.label,
      url: c.url,
      description: c.confirms,
      ...(c.kind ? { genre: SOURCE_KIND_LABEL[c.kind] } : {}),
    })),
  ];

  /**
   * Comparison rows as flat properties. schema.org has no head-to-head type,
   * and a PropertyValue is read by every consumer that already reads the
   * attribute ledger, so the rows land in the same place as the other facts.
   */
  const comparisonProps = (geo?.comparisons ?? []).map((c) => ({
    "@type": "PropertyValue",
    name: `vs ${c.versus} — ${c.dimension}`,
    value: `Asherin: ${c.asherin}. ${c.versus}: ${c.other}.`,
  }));


  const supersedes = (geo?.supersedes ?? []).map((s) => ({
    "@type": "WebPage",
    "@id": `${ORIGIN}${s.path}#page`,
    url: `${ORIGIN}${s.path}`,
    name: s.label,
  }));

  const base: Json = {
    "@id": `${canonical}#page`,
    url: canonical,
    name: entry.title,
    headline: entry.title,
    description: entry.description,
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
    ...(dateModified ? { dateModified } : {}),
    // sdDatePublished states when the *structured data* was last confirmed,
    // which is what a retriever needs to rank two versions of the same claim.
    ...(dateModified ? { sdDatePublished: dateModified } : {}),
    ...(citation.length ? { citation } : {}),
    ...(supersedes.length ? { replacee: supersedes } : {}),
    ...(geo?.attributes?.length || comparisonProps.length
      ? {
          additionalProperty: [
            ...toPropertyValues(geo?.attributes ?? []),
            ...comparisonProps,
          ],
        }
      : {}),
  };

  if (isArticle) {
    return {
      ...base,
      "@type": "Article",
      datePublished: entry.datePublished,
      author: { "@type": "Person", name: "Asher Newton" },
      image: DEFAULT_OG_IMAGE,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      ...(geo ? { abstract: geo.answer, about: { "@type": "Thing", name: geo.topic } } : {}),
    };
  }

  return {
    ...base,
    "@type": "WebPage",
    ...(geo
      ? {
          about: { "@type": "Thing", name: geo.topic },
          // The extractable answer, restated for engines that read schema only.
          abstract: geo.answer,
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["[data-geo-answer]"],
          },
        }
      : {}),
  };
}


/**
 * Full @graph for a route: main entity + breadcrumbs + FAQ + (on product
 * pages) the SoftwareApplication entity. One script tag, one connected graph,
 * so the site resolves as an entity rather than a pile of loose nodes.
 */
export function buildRouteGraph(pathname: string, entry: SeoEntry): Json {
  const geo = getGeoPage(pathname);
  const graph: Json[] = [buildMainEntity(pathname, entry, geo)];

  const crumbs = buildBreadcrumbs(pathname);
  if (crumbs) graph.push(crumbs);

  if (geo?.faqs?.length) graph.push(buildFaqPage(pathname, geo.faqs));
  if (geo?.isProductPage) graph.push(buildSoftwareApplication());

  return { "@context": "https://schema.org", "@graph": graph };
}
