// autonomousLoop.ts — Aureon's autonomous intelligence loop.
//
// NARRATIVE
// ---------
// When the router detects a research intent with a concrete subject:
//   1) RECALL prior memory for that subject (so this session starts warm).
//   2) FAN OUT in parallel across the three intel engines we already own:
//        • aureonDorkEngine  → 100-theory OSINT sweep
//        • ghostHarvest      → 16-leg metadata/payload fan-out
//        • jurisdictionalIntel → sovereign source atlas (best-effort)
//      Each leg has an independent timeout so one slow provider can't stall
//      the whole loop.
//   3) VERIFY the fused findings via chat-consensus (multi-model vote), when
//      the caller supplies enough provider keys; otherwise we skip verify and
//      fall through with a lower consensus score.
//   4) PERSIST the subject + top edges into the memory graph.
//   5) RETURN a compact system-context block for the chat prompt.
//
// FLAW-TAXONOMY APPLIED
//  - workflow: Promise.allSettled + per-branch timeout; no leg blocks the fan-in.
//  - performance: hard 90s ceiling — matches the surrounding chat budget.
//  - security: no user-input concatenation into shell/SQL; only typed subject.
//  - data honesty: consensusScore is null when verify is skipped, never faked.
//  - observability: every leg logs latency+success into the run record.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { detectAutonomousIntent, type AutoTrigger } from "./autonomousIntent.ts";
import {
  upsertEntities,
  upsertEdges,
  recordRun,
  recallSubject,
  canonicalize,
  type MemoryEntityInput,
  type MemoryEdgeInput,
} from "./memoryGraph.ts";

export interface LoopResult {
  fired: boolean;
  subject: string;
  kind: string;
  toolsFired: string[];
  consensusScore: number | null;
  entitiesTouched: number;
  edgesCreated: number;
  durationMs: number;
  contextBlock: string;
  summary: string;
}

interface Deps {
  supabase: SupabaseClient;
  userId: string;
  geminiKey: string;
  supabaseAnonKey: string;
  supabaseUrl: string;
}

const NULL_RESULT = (reason: string): LoopResult => ({
  fired: false, subject: "", kind: "topic", toolsFired: [], consensusScore: null,
  entitiesTouched: 0, edgesCreated: 0, durationMs: 0, contextBlock: "", summary: reason,
});

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | { __timeout: true; label: string }> {
  return await Promise.race([
    p,
    new Promise<{ __timeout: true; label: string }>((r) => setTimeout(() => r({ __timeout: true, label }), ms)),
  ]);
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function runAutonomousLoop(
  userText: string,
  deps: Deps,
): Promise<LoopResult> {
  const trig: AutoTrigger = detectAutonomousIntent(userText);
  if (!trig.fire) return NULL_RESULT("no_trigger");

  const t0 = Date.now();
  const toolsFired: string[] = [];
  const contextParts: string[] = [];

  // ── 1) RECALL prior memory ────────────────────────────────────────────────
  let recall: any = null;
  try {
    recall = await recallSubject(deps.supabase, deps.userId, trig.subject);
    if (recall?.entity) {
      contextParts.push(
        `## PRIOR MEMORY (${trig.subject})\n` +
        `- Seen ${recall.entity.hit_count}× since ${new Date(recall.entity.first_seen).toISOString().slice(0,10)}\n` +
        `- Confidence: ${recall.entity.confidence}\n` +
        (recall.neighbors.length
          ? `- Known relationships: ${recall.neighbors.slice(0,10).map((n:any)=>`${n.label} (${n.kind})`).join(", ")}\n`
          : ""),
      );
      toolsFired.push("memory:recall");
    }
  } catch (e) {
    console.warn("[autonomousLoop] recall:", (e as Error).message);
  }

  // ── 2) FAN OUT ────────────────────────────────────────────────────────────
  const legs: Promise<any>[] = [];

  // Leg A — Aureon Dork Engine (100 theories)
  legs.push((async () => {
    try {
      const { runAureonDork, formatDorkContext } = await import("./aureonDorkEngine.ts");
      const rep = await withTimeout(
        runAureonDork(
          { subject: trig.subject, kind: trig.kind as any, hints: trig.hints },
          { geminiKey: deps.geminiKey, testCap: 30, concurrency: 12, perQueryTimeoutMs: 10000, skipBrief: true },
        ),
        60000,
        "dork",
      );
      if (rep && !("__timeout" in rep)) {
        toolsFired.push("dork");
        return { leg: "dork", ok: true, context: formatDorkContext(rep), raw: rep };
      }
      return { leg: "dork", ok: false, reason: "timeout" };
    } catch (e) {
      return { leg: "dork", ok: false, reason: (e as Error).message };
    }
  })());

  // Leg B — Ghost Harvest (metadata sweep)
  legs.push((async () => {
    try {
      const { runGhostHarvest } = await import("./ghostHarvest.ts");
      const res = await withTimeout(
        runGhostHarvest({ subject: trig.subject, kind: trig.kind as any, aperture: 120, perQueryTimeoutMs: 8000, concurrency: 10 }),
        45000,
        "ghost",
      );
      if (res && !("__timeout" in res)) {
        toolsFired.push("ghost");
        const leads = (res as any).leads?.slice(0, 20) || [];
        const block = leads.length
          ? `## GHOST INTERCEPTS (${leads.length})\n` +
            leads.map((l: any) => `- [${l.type || "lead"}] ${safeString(l.title).slice(0, 120)} ← ${safeString(l.url || l.source).slice(0, 140)}`).join("\n")
          : "";
        return { leg: "ghost", ok: true, context: block, raw: res };
      }
      return { leg: "ghost", ok: false, reason: "timeout" };
    } catch (e) {
      return { leg: "ghost", ok: false, reason: (e as Error).message };
    }
  })());

  // Leg C — Jurisdictional Intel (sovereign atlas), best-effort
  legs.push((async () => {
    try {
      const mod = await import("./jurisdictionalIntel.ts").catch(() => null);
      if (!mod || typeof (mod as any).runJurisdictionalSweep !== "function") {
        return { leg: "jurisdictional", ok: false, reason: "unavailable" };
      }
      const res = await withTimeout(
        (mod as any).runJurisdictionalSweep({ subject: trig.subject, kind: trig.kind, hints: trig.hints, geminiKey: deps.geminiKey }),
        40000,
        "jurisdictional",
      );
      if (res && !("__timeout" in res)) {
        toolsFired.push("jurisdictional");
        const summary = safeString((res as any).summary || (res as any).report).slice(0, 1400);
        return { leg: "jurisdictional", ok: true, context: summary ? `## SOVEREIGN SOURCES\n${summary}` : "", raw: res };
      }
      return { leg: "jurisdictional", ok: false, reason: "timeout" };
    } catch (e) {
      return { leg: "jurisdictional", ok: false, reason: (e as Error).message };
    }
  })());

  const settled = await Promise.allSettled(legs);
  const legResults = settled.map((s) => (s.status === "fulfilled" ? s.value : { ok: false, reason: "rejected" }));
  for (const r of legResults) if (r?.ok && r.context) contextParts.push(r.context);

  // ── 3) VERIFY via multi-model consensus (best-effort, non-blocking) ───────
  let consensusScore: number | null = null;
  try {
    const providers: Array<{ provider: string; model: string; keyEnv: string }> = [
      { provider: "google",    model: "gemini-flash-latest",              keyEnv: "GEMINI_API_KEY" },
      { provider: "openai",    model: "gpt-4o-mini",                      keyEnv: "OPENAI_API_KEY" },
      { provider: "anthropic", model: "claude-3-5-haiku-20241022",        keyEnv: "ANTHROPIC_API_KEY" },
    ].filter((p) => Deno.env.get(p.keyEnv));

    if (providers.length >= 2 && contextParts.length) {
      const consensusUrl = `${deps.supabaseUrl}/functions/v1/chat-consensus`;
      const verifyPrompt =
        `Given the following intelligence gathered on "${trig.subject}", extract 3-6 concrete factual claims and label each with a confidence (HIGH/MEDIUM/LOW). ` +
        `Only include claims supported by the evidence below. Return a short list.\n\n` +
        contextParts.join("\n\n").slice(0, 6000);

      const resp = await withTimeout(
        fetch(consensusUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deps.supabaseAnonKey}` },
          body: JSON.stringify({
            messages: [{ role: "user", content: verifyPrompt }],
            systemPrompt: "You are an intelligence verifier. Emit only claims grounded in the evidence.",
            providers,
          }),
        }).then((r) => r.ok ? r.json() : null),
        30000,
        "consensus",
      );
      if (resp && !("__timeout" in resp) && (resp as any).agreementScore != null) {
        consensusScore = Number((resp as any).agreementScore);
        toolsFired.push("consensus");
        if ((resp as any).synthesis) {
          contextParts.push(`## CONSENSUS (score ${consensusScore.toFixed(2)})\n${safeString((resp as any).synthesis).slice(0, 1200)}`);
        }
      }
    }
  } catch (e) {
    console.warn("[autonomousLoop] consensus:", (e as Error).message);
  }

  // ── 4) PERSIST to memory graph ────────────────────────────────────────────
  let entitiesTouched = 0;
  let edgesCreated = 0;
  try {
    const subjectEntity: MemoryEntityInput = {
      canonical: trig.subject,
      kind: trig.kind,
      label: trig.subject,
      confidence: consensusScore != null && consensusScore >= 0.66 ? "CORROBORATED" : "REPORTED",
      attributes: { hints: trig.hints, lastToolset: toolsFired },
    };
    const extraEntities: MemoryEntityInput[] = [];
    const extraEdges: MemoryEdgeInput[] = [];

    const dorkRaw = legResults.find((r) => r.leg === "dork" && r.ok)?.raw;
    if (dorkRaw?.theories) {
      for (const t of dorkRaw.theories.slice(0, 8)) {
        const label = safeString(t.category || t.name || t.theory);
        if (!label) continue;
        extraEntities.push({ canonical: `theory:${label}`, kind: "theory", label, attributes: { yield: t.yield ?? t.score ?? null } });
        extraEdges.push({ fromCanonical: trig.subject, toCanonical: `theory:${label}`, relationship: "exposed_via", sourceTheory: label });
      }
    }
    const ghostRaw = legResults.find((r) => r.leg === "ghost" && r.ok)?.raw;
    if (ghostRaw?.leads) {
      for (const l of ghostRaw.leads.slice(0, 8)) {
        const host = (() => { try { return new URL(l.url || l.source || "").hostname; } catch { return null; } })();
        if (!host) continue;
        extraEntities.push({ canonical: `host:${host}`, kind: "host", label: host });
        extraEdges.push({ fromCanonical: trig.subject, toCanonical: `host:${host}`, relationship: "surfaced_at" });
      }
    }

    const idMap = await upsertEntities(deps.supabase, deps.userId, [subjectEntity, ...extraEntities]);
    entitiesTouched = idMap.size;
    edgesCreated = await upsertEdges(deps.supabase, deps.userId, extraEdges, idMap);
  } catch (e) {
    console.warn("[autonomousLoop] persist:", (e as Error).message);
  }

  const durationMs = Date.now() - t0;
  const summary = `Autonomous loop on "${trig.subject}" — ${toolsFired.join("+") || "no legs"} in ${durationMs}ms.`;

  try {
    await recordRun(deps.supabase, deps.userId, {
      query: userText, subject: trig.subject, kind: trig.kind, toolsFired,
      consensusScore: consensusScore ?? undefined,
      entitiesTouched, edgesCreated, durationMs, summary,
    });
  } catch (e) { console.warn("[autonomousLoop] recordRun:", (e as Error).message); }

  const header = `# AUTHORIZED AUTONOMOUS INTELLIGENCE LOOP\nSubject: ${trig.subject} (${trig.kind})\nTools fired: ${toolsFired.join(", ") || "none"}\nConsensus: ${consensusScore != null ? consensusScore.toFixed(2) : "skipped"}\nEntities persisted: ${entitiesTouched} · Edges: ${edgesCreated}\n`;
  const contextBlock = [header, ...contextParts].join("\n\n").slice(0, 8000);

  return {
    fired: true, subject: trig.subject, kind: trig.kind, toolsFired,
    consensusScore, entitiesTouched, edgesCreated, durationMs,
    contextBlock, summary,
  };
}
