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
import { getGeoPage, type GeoFaq, type GeoPage } from "./geoContent";

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
        price: "399.00",
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
  const dateModified = geo?.updated ?? entry.dateModified ?? entry.datePublished;

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
  };

  if (isArticle) {
    return {
      ...base,
      "@type": "Article",
      datePublished: entry.datePublished,
      author: { "@type": "Person", name: "Asher Newton" },
      image: DEFAULT_OG_IMAGE,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
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
