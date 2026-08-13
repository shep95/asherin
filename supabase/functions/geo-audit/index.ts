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
/** Search fan-out is slower than a page fetch; 13s round trips are normal. */
const SEARCH_TIMEOUT_MS = 35_000;

/**
 * Hedge phrasing in the answer block. Mirrors HEDGE_PATTERNS in
 * src/lib/geo/geoContent.ts — duplicated because Deno cannot import from src/.
 * Keep the two lists in step when either changes.
 */
const HEDGE_PATTERNS: RegExp[] = [
  /\b(?:may|might|could|can)\s+(?:help|assist|enable|allow|provide|improve|support)\b/i,
  /\b(?:aims?|seeks?|strives?|hopes?)\s+to\b/i,
  /\b(?:designed|intended|meant)\s+to\b/i,
  /\b(?:potentially|possibly|arguably|generally|typically|often|usually|somewhat)\b/i,
  /\b(?:one of the|among the)\s+(?:best|leading|top|most)\b/i,
  /\bwe believe\b|\bit is thought\b|\bsome say\b/i,
];

interface RouteScore {
  route: string;
  url: string;
  status: number;
  score: number;
  maxScore: number;
  checks: { id: string; label: string; pass: boolean; detail: string }[];
}

/**
 * Selection vs absorption.
 *
 * Retrieval (`found`, `rank`) is selection: the engine fetched the page.
 * Absorption is what fraction of the page's own distinctive language survives
 * into the synthesised answer. Some engines select and cite; others absorb
 * the language and never cite, so a selection-only metric under-reports the
 * second class of engine entirely.
 */
interface AbsorptionResult {
  /** null when the absorption stage did not run (no model key, or not selected). */
  ran: boolean;
  reason?: string;
  /** Model named asherin.com or Asherin in the synthesised answer. */
  attributed: boolean;
  /** Share of the page's distinctive trigrams present in the answer, 0-1. */
  coverage: number;
  /** Page figures (prices, counts) that survived into the answer. */
  liftedFigures: string[];
  answerExcerpt: string;
}

interface CitationResult {
  prompt: string;
  found: boolean;
  rank: number | null;
  matchedUrl: string | null;
  totalResults: number;
  competitors: string[];
  absorption: AbsorptionResult;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
  const attrRows = (html.match(/data-geo-attribute=/gi) || []).length;
  const hasCorroboration = /Independent corroboration/i.test(html) || /"citation"/.test(html);
  // Lead-sentence contract: short, literal, anchored (UIUC/IISc retriever-bias study).
  const leadSentence = (() => {
    const m = answerText.match(/^[\s\S]*?[.!?](?=\s+[A-Z"(])/);
    return (m ? m[0] : answerText).trim();
  })();
  const leadWords = leadSentence ? leadSentence.split(/\s+/).filter(Boolean).length : 0;
  const hasFreshness = /Last verified/i.test(html) || /"dateModified"/.test(html);
  const canonical =
    textBetween(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ?? "";

  // Gatekeeper factors from the Ansal/Sprinklr controlled trial: a page missing
  // a price, a comparison or confident phrasing is largely ineligible for
  // citation regardless of how well the rest of it reads.
  const hasPrice = /\$\s?\d/.test(html) || /data-geo-attribute="[^"]*[Pp]rice/.test(html);
  const comparisonRows = (html.match(/data-geo-comparison=/gi) || []).length;
  const institutionalRefs = (
    html.match(/data-geo-source-kind="(?:government|academic|standards|press)"/gi) || []
  ).length;
  const hedges = HEDGE_PATTERNS.map((re) => answerText.match(re)?.[0])
    .filter((v): v is string => Boolean(v));

  // --- Structural features, GEO-SFE (arXiv:2603.29979) -------------------
  // Scored off the served HTML rather than off the content model, because the
  // model can declare a procedure that the renderer never emits. The audit's
  // job is to see what a retriever sees.
  const chunks = [...html.matchAll(/data-geo-chunk="([^"]+)"/gi)].map((m) => m[1]);
  const chunkSet = new Set(chunks);
  // Every chunk needs its own fragment target, or a retriever can only cite
  // the page. Counting ids that sit on chunk elements, not ids in general.
  const anchoredChunks = (html.match(/id="geo-[a-z-]+"[^>]*data-geo-chunk=/gi) || []).length +
    (html.match(/data-geo-chunk="[^"]+"[^>]*id="geo-[a-z-]+"/gi) || []).length;
  const procedureSteps = (html.match(/data-geo-step=/gi) || []).length;
  const relatedLinks = (html.match(/data-geo-related=/gi) || []).length;

  // Evidence genres (arXiv:2604.25707). Absorption needs at least three of the
  // four; a page carrying one genre gets selected but not quoted.
  const genres = {
    definition: /\b(?:is|are|means|refers to)\b/i.test(answerText),
    numeric: statRows > 0 || /\d/.test(answerText),
    comparison: comparisonRows > 0,
    procedural: procedureSteps > 0,
  };
  const genreCount = Object.values(genres).filter(Boolean).length;




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
    {
      id: "attributes",
      label: "Attribute ledger published (machine-readable entity facts)",
      pass: attrRows >= 3,
      detail: `${attrRows} attributes`,
    },
    {
      id: "lead-brevity",
      label: "Lead sentence under 25 words (retriever brevity bias)",
      pass: leadWords > 0 && leadWords <= 25,
      detail: leadWords ? `${leadWords} words` : "no answer block",
    },
    {
      id: "corroboration",
      label: "Third-party corroboration or citation graph present",
      pass: hasCorroboration,
      detail: hasCorroboration ? "citation/corroboration found" : "none",
    },
    // --- Gatekeeper factors, Ansal University / Sprinklr (arXiv:2605.25517) ---
    {
      id: "price",
      label: "Explicit price published on the page (gatekeeper factor)",
      pass: hasPrice,
      detail: hasPrice ? "price literal found" : "no currency figure in the block",
    },
    {
      id: "comparison",
      label: "Head-to-head comparison against a named alternative",
      pass: comparisonRows > 0,
      detail: comparisonRows ? `${comparisonRows} rows` : "none",
    },
    {
      id: "confidence",
      label: "Answer block is declarative (no hedging)",
      pass: hedges.length === 0,
      detail: hedges.length ? `hedged: ${hedges.join("; ")}` : "declarative",
    },
    {
      id: "institutional",
      label: "At least one government, academic, standards or press source",
      pass: institutionalRefs > 0,
      detail: institutionalRefs
        ? `${institutionalRefs} institutional refs`
        : "vendor/first-party only",
    },
    // --- Structural + evidential factors ---------------------------------
    {
      id: "chunking",
      label: "Content splits into named, heading-led retrieval chunks",
      pass: chunkSet.size >= 4,
      detail: chunkSet.size ? `${chunkSet.size} chunks: ${[...chunkSet].join(", ")}` : "none",
    },
    {
      id: "chunk-anchors",
      label: "Every chunk carries a stable fragment id",
      pass: chunks.length > 0 && anchoredChunks >= chunks.length,
      detail: `${anchoredChunks}/${chunks.length} anchored`,
    },
    {
      id: "procedure",
      label: "Ordered procedural steps published (fourth evidence genre)",
      pass: procedureSteps >= 3,
      detail: procedureSteps ? `${procedureSteps} steps` : "none",
    },
    {
      id: "internal-links",
      label: "Page links into its topical cluster (macro structure)",
      pass: relatedLinks >= 2,
      detail: relatedLinks ? `${relatedLinks} related links` : "orphan page",
    },
    {
      id: "evidence-genres",
      label: "At least three of four evidence genres present",
      pass: genreCount >= 3,
      detail: `${genreCount}/4 — ${Object.entries(genres)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ") || "none"}`,
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

/**
 * The check-list length, derived rather than typed.
 *
 * The unreachable-route branch below has to report a denominator without ever
 * running the checks. Hard-coding it means every new check silently makes the
 * two paths disagree, so it is computed once by scoring an empty document.
 */
const MAX_ROUTE_SCORE = scoreRoute("/", 0, "").checks.length;



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
      maxScore: MAX_ROUTE_SCORE,
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
interface SearchHit {
  url?: string;
  title?: string;
  snippet?: string;
  content?: string;
}

async function searchOnce(
  fn: string,
  body: Record<string, unknown>,
): Promise<SearchHit[]> {
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
    }, SEARCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

const STOPWORDS = new Set(
  "the a an and or of to in for on with is are be as by at from that this it its our your you we".split(" "),
);

/** Content trigrams, stopword-stripped, so scoring rewards distinctive phrasing. */
function trigrams(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9$.\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) out.push(words.slice(i, i + 3).join(" "));
  return out;
}

/** Currency and percentage literals — the units an engine lifts verbatim. */
function figures(text: string): string[] {
  return [...new Set(text.match(/\$\s?[\d,.]+|\b\d+(?:\.\d+)?\s?%/g) ?? [])].map((f) =>
    f.replace(/\s/g, ""),
  );
}

const NO_ABSORPTION = (reason: string): AbsorptionResult => ({
  ran: false,
  reason,
  attributed: false,
  coverage: 0,
  liftedFigures: [],
  answerExcerpt: "",
});

/**
 * Stage two: synthesise an answer from the retrieved set the way a generative
 * engine would, then measure how much of our own page survived into it.
 *
 * This is deliberately grounded on the *same* retrieved snippets the selection
 * stage produced — no extra retrieval, no model browsing — so the number
 * isolates absorption from selection instead of conflating the two.
 */
async function measureAbsorption(
  prompt: string,
  pageUrl: string,
  snippets: SearchHit[],
): Promise<AbsorptionResult> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";
  if (!geminiKey) return NO_ABSORPTION("no platform model key configured");

  let pageText = "";
  try {
    const res = await fetchWithTimeout(pageUrl, {
      headers: { "User-Agent": "AsherinGeoAudit/1.0 (+https://asherin.com)", Accept: "text/html" },
    });
    if (!res.ok) return NO_ABSORPTION(`page fetch returned ${res.status}`);
    const html = await res.text();
    const block = html.match(/<section[^>]*data-geo-static[\s\S]*?<\/section>/i)?.[0] ?? "";
    pageText = (block || html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch (e) {
    return NO_ABSORPTION(e instanceof Error ? e.message : "page fetch failed");
  }
  if (pageText.length < 80) return NO_ABSORPTION("page carried no extractable text");

  const context = snippets
    .slice(0, 8)
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title ?? ""}\nURL: ${s.url ?? ""}\n${(s.snippet ?? s.content ?? "").slice(0, 700)}`,
    )
    .join("\n\n");

  let answer = "";
  try {
    const res = await fetchWithTimeout(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Answer the question using only the numbered sources below. ` +
                    `Write 120-180 words. Include concrete figures where the sources give them. ` +
                    `Name the organisation behind any claim you use.\n\n` +
                    `Question: ${prompt}\n\nSources:\n${context}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      },
      30_000,
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`absorption model call failed [${res.status}]: ${body.slice(0, 300)}`);
      return NO_ABSORPTION(`model returned ${res.status}`);
    }
    const data = await res.json();
    answer = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join(" ")
      .trim();
  } catch (e) {
    return NO_ABSORPTION(e instanceof Error ? e.message : "model call failed");
  }
  if (!answer) return NO_ABSORPTION("model returned an empty answer");

  const answerLower = answer.toLowerCase();
  const pageGrams = [...new Set(trigrams(pageText))];
  const answerGrams = new Set(trigrams(answer));
  const hits = pageGrams.filter((g) => answerGrams.has(g)).length;
  const coverage = pageGrams.length ? hits / pageGrams.length : 0;
  const answerFigures = new Set(figures(answer));
  const liftedFigures = figures(pageText).filter((f) => answerFigures.has(f));

  return {
    ran: true,
    attributed: answerLower.includes("asherin"),
    // Trigram overlap against a 6k-char page is small by construction; the
    // useful signal is movement over time and across prompts, not the absolute.
    coverage: Number(coverage.toFixed(4)),
    liftedFigures,
    answerExcerpt: answer.slice(0, 400),
  };
}

/**
 * `counterfactualUrl` measures absorption for a page that was *not* selected.
 * It answers "if the engine had our page, would our language survive?", which
 * is the only way to separate a retrieval problem from a phrasing problem
 * before indexing catches up. Absent it, absorption requires real selection.
 */
async function probePrompt(
  prompt: string,
  withAbsorption: boolean,
  counterfactualUrl?: string,
): Promise<CitationResult> {
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
  const matchedUrl = idx >= 0 ? (results[idx].url ?? null) : null;

  let absorption: AbsorptionResult;
  if (!withAbsorption) {
    absorption = NO_ABSORPTION("absorption stage not requested");
  } else if (!matchedUrl && !counterfactualUrl) {
    // Not selected, so there is nothing to absorb. Reported, not silently zero.
    absorption = NO_ABSORPTION("not selected — absorption requires retrieval first");
  } else {
    const target = matchedUrl ?? counterfactualUrl!;
    const measured = await measureAbsorption(prompt, target, results);
    // Only annotate a *successful* counterfactual: overwriting `reason` on a
    // failed run would hide why the measurement did not happen.
    absorption =
      matchedUrl || !measured.ran
        ? measured
        : { ...measured, reason: `counterfactual against ${target}` };
  }

  return {
    prompt,
    found: idx >= 0,
    rank: idx >= 0 ? idx + 1 : null,
    matchedUrl,
    totalResults: results.length,
    competitors: [...new Set(hosts.filter(Boolean))].slice(0, 8),
    absorption,
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

    // Absorption costs a model call per selected prompt, so it is opt-in and
    // the batch narrows to 2 at a time when it is on.
    const withAbsorption = body?.absorption === true;
    // Only same-origin counterfactual targets: never let a caller point the
    // fetcher at an arbitrary host (SSRF).
    const rawCf = typeof body?.counterfactualUrl === "string" ? body.counterfactualUrl : "";
    let counterfactualUrl: string | undefined;
    if (rawCf) {
      try {
        const u = new URL(rawCf, ORIGIN);
        if (u.origin === ORIGIN) counterfactualUrl = u.toString();
      } catch { /* ignore malformed override */ }
    }
    const stride = withAbsorption ? 2 : 3;

    const results: CitationResult[] = [];
    for (let i = 0; i < cleanPrompts.length; i += stride) {
      const batch = await Promise.all(
        cleanPrompts.slice(i, i + stride).map((p) => probePrompt(p, withAbsorption, counterfactualUrl)),
      );
      results.push(...batch);
    }
    const measured = results.filter((r) => r.absorption.ran);
    return json({
      mode,
      ranAt: new Date().toISOString(),
      results,
      // Selection and absorption reported separately: a page can be retrieved
      // often and absorbed rarely, and the fix for each is different.
      summary: {
        selectionRate: results.length
          ? Number((results.filter((r) => r.found).length / results.length).toFixed(3))
          : 0,
        absorptionMeasured: measured.length,
        attributionRate: measured.length
          ? Number((measured.filter((r) => r.absorption.attributed).length / measured.length).toFixed(3))
          : null,
        meanCoverage: measured.length
          ? Number((measured.reduce((s, r) => s + r.absorption.coverage, 0) / measured.length).toFixed(4))
          : null,
      },
    });
  } catch (e) {
    console.error("geo-audit error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Audit failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
