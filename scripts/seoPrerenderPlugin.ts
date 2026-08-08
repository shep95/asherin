/**
 * Build-time head prerender.
 *
 * This app is a client-rendered SPA: every URL is served the same index.html,
 * so crawlers that do not execute JS (social previews, plain HTTP fetchers,
 * most SEO scanners) see one title, one description, and one canonical for
 * every route. RouteSeo.tsx fixes that only after hydration.
 *
 * After the bundle is written, this plugin emits one static HTML file per known
 * route with the correct <title>, description, canonical, og:*, twitter:*, and
 * JSON-LD baked into the markup. The runtime layer still runs and produces the
 * identical values, so client navigation and first load agree.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import { ORIGIN, ROUTE_SEO, type SeoEntry } from "../src/lib/routeSeoData";
import { buildRouteGraph } from "../src/lib/geo/schema";
import {
  effectiveUpdated,
  getGeoPage,
  SOURCE_KIND_LABEL,
  type GeoSourceKind,
} from "../src/lib/geo/geoContent";


/** Hard ceiling so route growth can never push the build past publish limits. */
const MAX_PRERENDER_PAGES = 2000;

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Replace an existing tag matched by `pattern`, or append `tag` to <head>. */
function upsertTag(html: string, pattern: RegExp, tag: string) {
  // Patterns are built per-call and used once, so no lastIndex state to carry.
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n</head>`);
}

function metaPattern(attr: "name" | "property", key: string) {
  return new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, "i");
}

function buildJsonLd(path: string, entry: SeoEntry) {
  // </script> inside JSON would close the tag early; JSON-LD escapes it as <\/script>.
  return `<script type="application/ld+json" id="route-seo-jsonld">${JSON.stringify(
    buildRouteGraph(path, entry),
  ).replace(/</g, "\\u003c")}</script>`;
}


function renderRouteHtml(template: string, path: string, entry: SeoEntry) {
  const canonical = `${ORIGIN}${path}`;
  const title = escapeAttr(entry.title);
  const description = escapeAttr(entry.description);

  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = upsertTag(
    html,
    metaPattern("name", "description"),
    `<meta name="description" content="${description}" />`,
  );
  html = upsertTag(
    html,
    /<link[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = upsertTag(
    html,
    metaPattern("property", "og:title"),
    `<meta property="og:title" content="${title}" />`,
  );
  html = upsertTag(
    html,
    metaPattern("property", "og:description"),
    `<meta property="og:description" content="${description}" />`,
  );
  html = upsertTag(
    html,
    metaPattern("property", "og:url"),
    `<meta property="og:url" content="${canonical}" />`,
  );
  html = upsertTag(
    html,
    metaPattern("property", "og:type"),
    `<meta property="og:type" content="${entry.ogType ?? "website"}" />`,
  );
  html = upsertTag(
    html,
    metaPattern("name", "twitter:title"),
    `<meta name="twitter:title" content="${title}" />`,
  );
  html = upsertTag(
    html,
    metaPattern("name", "twitter:description"),
    `<meta name="twitter:description" content="${description}" />`,
  );

  // Private routes must not be indexed even when fetched without JS.
  const robots = entry.noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  html = upsertTag(
    html,
    metaPattern("name", "robots"),
    `<meta name="robots" content="${robots}" />`,
  );
  if (entry.noindex) {
    html = upsertTag(
      html,
      metaPattern("name", "googlebot"),
      `<meta name="googlebot" content="noindex,nofollow" />`,
    );
  }

  html = html.replace("</head>", `  ${buildJsonLd(path, entry)}\n</head>`);
  html = injectGeoBody(html, path);
  return html;
}

/**
 * GeoBlock renders client-side, so a crawler that does not execute JS would see
 * the head metadata but none of the extractable answer or sourced statistics.
 * Mirror that block as static markup *inside* #root: React's createRoot render
 * discards the container's children on mount, so the live app is untouched
 * while JS-less fetchers get the full absorption unit.
 */
function injectGeoBody(html: string, path: string) {
  const geo = getGeoPage(path);
  if (!geo) return html;

  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const stats = (geo.stats ?? [])
    .map(
      (s) =>
        `<tr><th scope="row">${esc(s.label)}</th><td>${esc(s.value)}</td>` +
        `<td>${esc(s.source)}<span>as of <time datetime="${esc(s.asOf)}">${esc(
          s.asOf,
        )}</time></span></td></tr>`,
    )
    .join("");

  const attributes = (geo.attributes ?? [])
    .map(
      (a) =>
        `<div data-geo-attribute="${escapeAttr(a.name)}"><dt>${esc(a.name)}</dt>` +
        `<dd>${esc(a.value)}${a.unit ? ` ${esc(a.unit)}` : ""}</dd></div>`,
    )
    .join("");

  // The institutional class travels in the visible text, not only the JSON-LD,
  // so a text-only extractor keeps the government/academic/press signal.
  const kindTag = (kind?: string) => (kind ? `<span data-geo-source-kind="${escapeAttr(kind)}">${esc(SOURCE_KIND_LABEL[kind as GeoSourceKind] ?? kind)}</span> ` : "");

  const corroboration = (geo.corroboration ?? [])
    .map(
      (c) =>
        `<li>${kindTag(c.kind)}<a href="${escapeAttr(c.url)}" rel="noopener">${esc(c.label)}</a> — ${esc(
          c.confirms,
        )}</li>`,
    )
    .join("");

  const comparisons = (geo.comparisons ?? [])
    .map(
      (c) =>
        `<tr data-geo-comparison="${escapeAttr(c.versus)}"><th scope="row">${esc(c.versus)}</th>` +
        `<td>${esc(c.dimension)}</td><td>${esc(c.asherin)}</td><td>${esc(c.other)}</td></tr>`,
    )
    .join("");

  const revisions = (geo.revisions ?? [])
    .map(
      (r) =>
        `<li><time datetime="${escapeAttr(r.date)}">${esc(r.date)}</time> ${esc(r.note)}</li>`,
    )
    .join("");

  const supersedes = (geo.supersedes ?? [])
    .map((sup) => `<a href="${escapeAttr(sup.path)}">${esc(sup.label)}</a>`)
    .join(", ");

  const citations = (geo.citations ?? [])
    .map(
      (c) =>
        `<li>${kindTag(c.kind)}<a href="${escapeAttr(c.url)}" rel="noopener">${esc(c.title)}</a> (${esc(
          c.publisher,
        )}, ${c.year})</li>`,
    )
    .join("");

  const faqs = (geo.faqs ?? [])
    .map((f) => `<div><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`)
    .join("");

  const stamp = effectiveUpdated(geo);

  // Visually clipped, never display:none. The markup stays in the served HTML
  // byte-for-byte for JS-less fetchers and text extractors, but it occupies a
  // 1x1 clipped box so it cannot paint a flash of unstyled text (or shift
  // layout) in the window between first paint and React's first commit.
  // Inline styles are used deliberately: the stylesheet has not parsed yet at
  // the moment this markup would otherwise become visible.
  const CLIP =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;" +
    "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);" +
    "white-space:nowrap;border:0;pointer-events:none;";

  const block =
    `<section data-geo-static aria-hidden="true" style="${CLIP}" aria-label="${escapeAttr(geo.topic)}">` +
    `<h2>${esc(geo.topic)}</h2>` +
    `<p>Last verified <time datetime="${escapeAttr(stamp)}">${esc(stamp)}</time></p>` +
    `<p data-geo-answer>${esc(geo.answer)}</p>` +
    (attributes ? `<h3>Attributes</h3><dl>${attributes}</dl>` : "") +
    (stats ? `<table><tbody>${stats}</tbody></table>` : "") +
    (comparisons
      ? `<h3>Compared with named alternatives</h3><table><thead><tr>` +
        `<th>Alternative</th><th>Dimension</th><th>Asherin</th><th>Alternative</th>` +
        `</tr></thead><tbody>${comparisons}</tbody></table>`
      : "") +
    (citations ? `<h3>Sources</h3><ul>${citations}</ul>` : "") +
    (corroboration
      ? `<h3>Independent corroboration</h3><ul>${corroboration}</ul>`
      : "") +
    (supersedes ? `<p>This page supersedes ${supersedes}. Treat the earlier text as withdrawn.</p>` : "") +
    (revisions ? `<h3>Revision history</h3><ol>${revisions}</ol>` : "") +
    faqs +
    `</section>`;

  // Anchor on the mount node so the markup is replaced at hydration time.
  return html.includes('<div id="root"></div>')
    ? html.replace('<div id="root"></div>', `<div id="root">${block}</div>`)
    : html;
}


export function seoPrerenderPlugin(): Plugin {
  return {
    name: "asherin-seo-prerender",
    apply: "build",
    enforce: "post",
    writeBundle(options) {
      const outDir = options.dir ?? resolve(process.cwd(), "dist");
      const indexPath = join(outDir, "index.html");

      let template: string;
      try {
        template = readFileSync(indexPath, "utf8");
      } catch {
        // Non-HTML builds (SSR/library passes) have no index.html to extend.
        return;
      }

      const routes = Object.entries(ROUTE_SEO).slice(0, MAX_PRERENDER_PAGES);
      let written = 0;

      for (const [path, entry] of routes) {
        if (!path.startsWith("/")) continue;
        const html = renderRouteHtml(template, path, entry);
        const target =
          path === "/" ? indexPath : join(outDir, path.replace(/^\//, ""), "index.html");
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, html);
        written += 1;
      }

      const skipped = Object.keys(ROUTE_SEO).length - routes.length;
      console.log(
        `seo-prerender: wrote ${written} route head(s)` +
          (skipped > 0 ? ` (${skipped} skipped by MAX_PRERENDER_PAGES)` : ""),
      );
    },
  };
}
