/**
 * ZOPHIEL ORCHESTRATOR — the chain that turns thirteen islands into one product.
 * ---------------------------------------------------------------------------
 * Previously the operator ran search, then opened XKEYSCORE, then opened the
 * Intelligence Suite, and each stage re-derived the corpus from scratch with a
 * different extractor. Nothing carried forward: entities found in stage 2 never
 * informed stage 3, and a contradiction found in stage 3 never re-queried.
 *
 * This function is the chain:
 *   1. RETRIEVE   zophiel-search (ranked corpus + fusion analysis)
 *   2. RESOLVE    zophiel-xkeyscore (identity resolution, hop rings, timeline)
 *   3. PIVOT      the highest-centrality unresolved entity becomes a follow-up
 *                 query, executed once, and merged back into the corpus
 *   4. JUDGE      claim-level veracity + contradictions recomputed over the
 *                 MERGED corpus, so a pivot can settle a disagreement
 *   5. REPORT     one artefact with a stated confidence and its own gaps
 *
 * Every stage is bounded and failure-isolated: a dead stage degrades the report
 * (and says so in `gaps`) rather than failing the run.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  fuseCorpus, computeRankingQuality,
  type FusionDoc, type Claim, type Contradiction,
} from "../_shared/zophielFusion.ts";

const STAGE_TIMEOUT_MS = 30_000;
const PIVOT_TIMEOUT_MS = 20_000;
const MAX_PIVOTS = 2;

interface OrchestratorStage {
  stage: string;
  status: "ok" | "degraded" | "failed" | "skipped";
  ms: number;
  detail: string;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} exceeded ${ms}ms`)), ms)),
  ]);
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** Confidence is derived, never asserted: independence × corroboration × agreement. */
function assessConfidence(
  docs: FusionDoc[],
  claims: Claim[],
  contradictions: Contradiction[],
): { level: "high" | "moderate" | "low"; score: number; basis: string[] } {
  const basis: string[] = [];
  const domains = new Set(docs.map((d) => d.domain)).size;
  const tier12 = docs.filter((d) => d.tier <= 2).length;
  const strongClaims = claims.filter((c) => c.veracity >= 60).length;
  const highContradictions = contradictions.filter((c) => c.severity === "high").length;

  let score = 0;
  if (domains >= 8) { score += 30; basis.push(`${domains} distinct domains in corpus`); }
  else if (domains >= 4) { score += 18; basis.push(`${domains} distinct domains — thin but usable`); }
  else basis.push(`Only ${domains} distinct domains — single-source risk`);

  if (tier12 >= 3) { score += 25; basis.push(`${tier12} tier-1/2 sources`); }
  else if (tier12 >= 1) { score += 12; basis.push(`${tier12} tier-1/2 source(s)`); }
  else basis.push("No tier-1/2 sources — corpus is unvetted");

  if (strongClaims >= 5) { score += 30; basis.push(`${strongClaims} claims corroborated across independent classes`); }
  else if (strongClaims >= 2) { score += 16; basis.push(`${strongClaims} corroborated claims`); }
  else basis.push("Few corroborated claims — most assertions are single-source");

  if (highContradictions === 0) { score += 15; basis.push("No high-severity source disagreement"); }
  else { score -= 10 * highContradictions; basis.push(`${highContradictions} high-severity contradiction(s) unresolved`); }

  score = Math.max(0, Math.min(100, score));
  return { level: score >= 70 ? "high" : score >= 40 ? "moderate" : "low", score, basis };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const started = Date.now();
  const stages: OrchestratorStage[] = [];
  const gaps: string[] = [];

  try {
    const body = await req.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const mode = typeof body?.mode === "string" ? body.mode : "web";
    const maxPivots = Math.min(MAX_PIVOTS, Math.max(0, Number(body?.maxPivots ?? 1)));
    const doHarvest = body?.harvest !== false;

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ success: false, error: "query is required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? `Bearer ${ANON}`;
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });

    const invoke = async <T>(fn: string, payload: unknown, ms: number): Promise<T | null> => {
      const t0 = Date.now();
      try {
        const { data, error } = await withTimeout(
          sb.functions.invoke(fn, { body: payload }) as Promise<{ data: T; error: unknown }>,
          ms, fn,
        );
        if (error) throw error;
        stages.push({ stage: fn, status: "ok", ms: Date.now() - t0, detail: "completed" });
        return data;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        stages.push({ stage: fn, status: "failed", ms: Date.now() - t0, detail });
        gaps.push(`${fn} did not return — this report is missing its contribution (${detail}).`);
        return null;
      }
    };

    // ── STAGE 1: RETRIEVE ──────────────────────────────────────────────────
    const search = await invoke<any>("zophiel-search", { query, mode, page: 1 }, STAGE_TIMEOUT_MS);
    const rawResults: any[] = Array.isArray(search?.results) ? search.results : [];

    if (rawResults.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "retrieval returned an empty corpus — nothing downstream can be computed",
        stages, gaps,
      }), { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const toDoc = (r: any): FusionDoc => ({
      url: String(r.url),
      title: String(r.title ?? ""),
      snippet: String(r.snippet ?? ""),
      domain: r.domain || domainOf(String(r.url)),
      tier: Number(r.tier ?? 4),
      engine: r.engine,
      engines: r.engines,
      layer: r.layer,
      onion: !!r.onion,
      publishDate: r.publishDate,
      relevance: r.relevance,
      veracity: r.veracity,
    } as FusionDoc & { relevance?: number; veracity?: number });

    const corpus = new Map<string, FusionDoc>();
    for (const r of rawResults) corpus.set(String(r.url), toDoc(r));

    // ── STAGE 2: RESOLVE ───────────────────────────────────────────────────
    const xk = await invoke<any>("zophiel-xkeyscore", {
      query,
      results: [...corpus.values()].slice(0, 40).map((d) => ({ title: d.title, url: d.url, snippet: d.snippet })),
      harvest: doHarvest,
    }, STAGE_TIMEOUT_MS);
    const serpIntel = xk?.intel ?? null;

    // ── STAGE 3: PIVOT ─────────────────────────────────────────────────────
    // The highest-centrality entity that the corpus mentions but never explains
    // is the gap worth spending a round-trip on. Selection is deterministic.
    const pivotsRun: { term: string; reason: string; added: number }[] = [];
    let fusion = fuseCorpus(query, [...corpus.values()]);

    for (let i = 0; i < maxPivots; i++) {
      const candidate = fusion.centrality.find((c) => {
        if (c.pagerank <= 0) return false;
        if (query.toLowerCase().includes(c.label.toLowerCase())) return false;
        if (!["person", "org", "organization", "location", "handle", "company"].includes(String(c.kind).toLowerCase())) return false;
        const backing = fusion.intel.entities.find((e) => e.id === c.id)?.sources?.length ?? 0;
        // Load-bearing in the graph, yet thinly sourced — exactly the gap.
        return backing <= 2 && !pivotsRun.some((p) => p.term === c.label);
      });
      if (!candidate) break;

      const pivotQuery = `"${candidate.label}" ${query}`.slice(0, 220);
      const t0 = Date.now();
      const pivot = await invoke<any>("zophiel-search", { query: pivotQuery, mode, page: 1, fast: true }, PIVOT_TIMEOUT_MS);
      let added = 0;
      for (const r of (Array.isArray(pivot?.results) ? pivot.results : [])) {
        const url = String(r.url);
        if (corpus.has(url)) continue;
        corpus.set(url, toDoc(r));
        added++;
      }
      pivotsRun.push({
        term: candidate.label,
        reason: `PageRank ${candidate.pagerank} with ≤2 backing sources — load-bearing but unexplained.`,
        added,
      });
      stages.push({
        stage: `pivot:${candidate.label}`,
        status: added > 0 ? "ok" : "degraded",
        ms: Date.now() - t0,
        detail: `${added} new documents merged`,
      });
      if (added > 0) fusion = fuseCorpus(query, [...corpus.values()]);
    }

    // ── STAGE 4: JUDGE ─────────────────────────────────────────────────────
    const docs = [...corpus.values()];
    const rankingQuality = computeRankingQuality(docs as any);
    const confidence = assessConfidence(docs, fusion.claims, fusion.contradictions);

    if (fusion.contradictions.length > 0) {
      gaps.push(`${fusion.contradictions.length} unresolved source disagreement(s) — treat the affected values as contested, not settled.`);
    }
    if (fusion.anomalies.benford.conforms === false) {
      gaps.push("Numeric distribution in this corpus fails Benford conformity — figures may be fabricated or machine-generated.");
    }
    if (rankingQuality.onTargetRate < 0.4) {
      gaps.push(`Only ${Math.round(rankingQuality.onTargetRate * 100)}% of results cleared the relevance floor — the query may be under-specified.`);
    }
    const snippetOnly = docs.filter((d) => !d.body).length;
    if (snippetOnly === docs.length) {
      gaps.push("No page bodies were harvested — every claim rests on search-engine snippets alone.");
    }

    const elapsed = Date.now() - started;

    console.log(JSON.stringify({
      fn: "zophiel-orchestrator",
      query: query.slice(0, 80),
      docs: docs.length,
      pivots: pivotsRun.length,
      claims: fusion.claims.length,
      contradictions: fusion.contradictions.length,
      confidence: confidence.level,
      ms: elapsed,
    }));

    return new Response(JSON.stringify({
      success: true,
      query,
      mode,
      elapsedMs: elapsed,
      stages,
      corpusSize: docs.length,
      results: docs,
      pivots: pivotsRun,
      // Deterministic analysis over the MERGED corpus
      entities: fusion.intel.entities.slice(0, 60),
      identities: fusion.intel.identities?.slice(0, 20) ?? [],
      timeline: fusion.intel.timeline ?? [],
      centrality: fusion.centrality.slice(0, 40),
      clusters: fusion.clusters.slice(0, 20),
      claims: fusion.claims,
      contradictions: fusion.contradictions,
      anomalies: fusion.anomalies,
      hopRings: serpIntel?.coverage ?? null,
      rankingQuality,
      confidence,
      gaps,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("zophiel-orchestrator failed", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({
      success: false,
      error: "orchestration failed",
      stages, gaps,
    }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
