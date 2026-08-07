/**
 * geo-audit — Priority 4 (GEO Measurement).
 *
 * Two independent measurements, both against live data, never simulated:
 *
 *   mode "readiness": fetches the *published* HTML for a route and scores what
 *     a non-JS generative crawler actually receives — extractable answer block,
 *     answer length band, sourced statistics, entity graph types, freshness
 *     stamp, title and description length. This also proves the build-time
 *     prerender shipped, because the score is read off the wire, not the repo.
 *
 *   mode "citation": runs a real search for a prompt and reports whether
 *     asherin.com is in the retrieved set and at what rank. Retrieval is the
 *     necessary condition for absorption: a page an engine never fetches can
 *     never be quoted.
 *
 * Hard caps on both modes so one call can never fan out unbounded.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";

const ORIGIN = "https://asherin.com";
const MAX_ROUTES = 25;
const MAX_PROMPTS = 10;
const FETCH_TIMEOUT_MS = 12_000;

interface RouteScore {
  route: string;
  url: string;
  status: number;
  score: number;
  maxScore: number;
  checks: { id: string; label: string; pass: boolean; detail: string }[];
}

interface CitationResult {
  prompt: string;
  found: boolean;
  rank: number | null;
  matchedUrl: string | null;
  totalResults: number;
  competitors: string[];
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function textBetween(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function collectJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].replace(/\\u003c/g, "<"));
      const nodes = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      for (const n of nodes) if (n && typeof n["@type"] === "string") types.add(n["@type"]);
    } catch {
      // A malformed block is itself a finding; surfaced by the missing type.
    }
  }
  return [...types];
}

function scoreRoute(route: string, status: number, html: string): RouteScore {
  const answer = textBetween(html, /<p[^>]*data-geo-answer[^>]*>([\s\S]*?)<\/p>/i);
  const answerText = answer ? answer.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
  const answerWords = answerText ? answerText.split(" ").length : 0;
  const title = textBetween(html, /<title>([\s\S]*?)<\/title>/i)?.trim() ?? "";
  const description =
    textBetween(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ?? "";
  const types = collectJsonLdTypes(html);
  const statRows = (html.match(/as of <time/gi) || []).length;
  const hasFreshness = /Last verified/i.test(html) || /"dateModified"/.test(html);
  const canonical =
    textBetween(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ?? "";

  const checks = [
    {
      id: "reachable",
      label: "Page returns 200 to a plain fetch",
      pass: status === 200,
      detail: `HTTP ${status}`,
    },
    {
      id: "answer",
      label: "Extractable answer block present",
      pass: answerWords > 0,
      detail: answerWords > 0 ? `${answerWords} words` : "no [data-geo-answer] paragraph",
    },
    {
      id: "answer-band",
      label: "Answer inside the 40-60 word absorption band",
      pass: answerWords >= 40 && answerWords <= 60,
      detail: answerWords ? `${answerWords} words` : "n/a",
    },
    {
      id: "stats",
      label: "Statistics carry a source and an as-of date",
      pass: statRows > 0,
      detail: `${statRows} sourced figures`,
    },
    {
      id: "freshness",
      label: "Freshness signal present",
      pass: hasFreshness,
      detail: hasFreshness ? "visible stamp or dateModified" : "none",
    },
    {
      id: "entity",
      label: "Entity graph resolves (Organization + WebSite)",
      pass: types.includes("Organization") && types.includes("WebSite"),
      detail: types.length ? types.join(", ") : "no JSON-LD",
    },
    {
      id: "page-entity",
      label: "Page-level entity emitted (WebPage or Article)",
      pass: types.includes("WebPage") || types.includes("Article"),
      detail: types.length ? types.join(", ") : "no JSON-LD",
    },
    {
      id: "breadcrumbs",
      label: "BreadcrumbList emitted",
      pass: types.includes("BreadcrumbList") || route === "/",
      detail: route === "/" ? "n/a — home is the root" : types.join(", ") || "none",
    },
    {
      id: "title",
      label: "Title under 60 characters",
      pass: title.length > 0 && title.length <= 60,
      detail: `${title.length} chars`,
    },
    {
      id: "description",
      label: "Description under 160 characters",
      pass: description.length > 0 && description.length <= 160,
      detail: `${description.length} chars`,
    },
    {
      id: "canonical",
      label: "Canonical self-references this route",
      pass: canonical === `${ORIGIN}${route}` || canonical === `${ORIGIN}${route}/`,
      detail: canonical || "missing",
    },
  ];

  return {
    route,
    url: `${ORIGIN}${route}`,
    status,
    score: checks.filter((c) => c.pass).length,
    maxScore: checks.length,
    checks,
  };
}

async function auditRoute(route: string): Promise<RouteScore> {
  try {
    const res = await fetchWithTimeout(`${ORIGIN}${route}`, {
      headers: {
        // Identify as a plain fetcher: this is exactly the JS-less view.
        "User-Agent": "AsherinGeoAudit/1.0 (+https://asherin.com)",
        Accept: "text/html",
      },
    });
    const html = await res.text();
    return scoreRoute(route, res.status, html);
  } catch (e) {
    return {
      route,
      url: `${ORIGIN}${route}`,
      status: 0,
      score: 0,
      maxScore: 11,
      checks: [
        {
          id: "reachable",
          label: "Page returns 200 to a plain fetch",
          pass: false,
          detail: e instanceof Error ? e.message : "fetch failed",
        },
      ],
    };
  }
}

/**
 * Retrieval is measured against the same engine the product uses. zophiel-search
 * is Firecrawl-backed and survives the bot blocks that make a bare DuckDuckGo
 * scrape return an empty set from server egress; ddg-search stays as a fallback
 * so a Firecrawl outage degrades the probe instead of failing it.
 */
async function searchOnce(
  fn: string,
  body: Record<string, unknown>,
): Promise<{ url?: string }[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

async function probePrompt(prompt: string): Promise<CitationResult> {
  let results = await searchOnce("zophiel-search", { query: prompt, mode: "web", page: 1 });
  if (results.length === 0) {
    results = await searchOnce("ddg-search", { query: prompt, numResults: 10 });
  }
  results = results.slice(0, 15);
  const hosts = results.map((r) => {

    try {
      return new URL(r.url ?? "").hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  });
  const idx = hosts.findIndex((h) => h === "asherin.com");

  return {
    prompt,
    found: idx >= 0,
    rank: idx >= 0 ? idx + 1 : null,
    matchedUrl: idx >= 0 ? (results[idx].url ?? null) : null,
    totalResults: results.length,
    competitors: [...new Set(hosts.filter(Boolean))].slice(0, 8),
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireUser(req);
  } catch (e) {
    return authErrorResponse(e, corsHeaders);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "citation" ? "citation" : "readiness";
    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (mode === "readiness") {
      const routes: string[] = Array.isArray(body?.routes) ? body.routes : [];
      const clean = routes
        .filter((r) => typeof r === "string" && r.startsWith("/") && !r.includes(".."))
        .slice(0, MAX_ROUTES);
      if (clean.length === 0) return json({ error: "No routes supplied" }, 400);

      // Bounded fan-out: 4 at a time so the origin is never hammered.
      const out: RouteScore[] = [];
      for (let i = 0; i < clean.length; i += 4) {
        const batch = await Promise.all(clean.slice(i, i + 4).map(auditRoute));
        out.push(...batch);
      }
      return json({ mode, ranAt: new Date().toISOString(), routes: out });
    }

    const prompts: string[] = Array.isArray(body?.prompts) ? body.prompts : [];
    const cleanPrompts = prompts
      .filter((p) => typeof p === "string" && p.trim().length > 2)
      .map((p) => p.trim().slice(0, 200))
      .slice(0, MAX_PROMPTS);
    if (cleanPrompts.length === 0) return json({ error: "No prompts supplied" }, 400);

    const results: CitationResult[] = [];
    for (let i = 0; i < cleanPrompts.length; i += 3) {
      const batch = await Promise.all(cleanPrompts.slice(i, i + 3).map(probePrompt));
      results.push(...batch);
    }
    return json({ mode, ranAt: new Date().toISOString(), results });
  } catch (e) {
    console.error("geo-audit error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Audit failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
