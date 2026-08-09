// aureon-dork — the 100-theory Google-dork battery for the Asherin Engine.
//
// Called by Aureon chat when it detects a dork intent, and by the Asherin
// Engine UI's "Dork Battery" tab. Delegates all generation + testing to
// _shared/aureonDorkEngine.ts, persists a compact record to ghost_ledger
// so the same intelligence surfaces in Asherin Engine → History.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { runAureonDork, formatDorkContext, type DorkTarget } from "../_shared/aureonDorkEngine.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { target, byok, testCap, skipBrief, persist } = body as {
      target?: Partial<DorkTarget> & { subject?: string };
      byok?: unknown;
      testCap?: number;
      skipBrief?: boolean;
      persist?: boolean;
    };

    if (!target?.subject || typeof target.subject !== "string" || target.subject.trim().length < 2) {
      return new Response(JSON.stringify({ error: "target.subject required (min 2 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolved;
    try { resolved = await resolveKey(req, byok); }
    catch (e: any) { return byokErrorResponse(e, corsHeaders); }
    const geminiKey = resolved.geminiKey || "";
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "no_ai_key", message: "Provide a Gemini BYOK in Settings → API Keys." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kind = (["person", "domain", "organization", "topic"] as const).includes((target.kind as any))
      ? (target.kind as DorkTarget["kind"]) : "person";
    const t: DorkTarget = {
      subject: target.subject.trim().slice(0, 200),
      kind,
      hints: target.hints || {},
    };

    console.log("[aureon-dork] running", t.kind, "→", t.subject);
    const report = await runAureonDork(t, {
      geminiKey,
      testCap: Math.max(10, Math.min(200, Number(testCap) || 999)),
      concurrency: 15,
      perQueryTimeoutMs: 16000,
      skipBrief: !!skipBrief,
    });

    // Persist to ghost_ledger so Asherin Engine History picks it up.
    if (persist !== false && SUPABASE_URL && SERVICE_ROLE_KEY) {
      try {
        const authH = req.headers.get("Authorization") || "";
        let userId: string | null = null;
        if (authH) {
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
          const { data: u } = await sb.auth.getUser(authH.replace(/^Bearer\s+/i, ""));
          userId = u?.user?.id || null;
        }
        if (userId) {
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
          await sb.from("ghost_entity_history").insert({
            user_id: userId,
            entity_key: `dork:${t.subject.toLowerCase()}`,
            entity_kind: `dork_${t.kind}`,
            entity_label: `Dork battery — ${t.subject}`,
            query: t.subject,
            scope: "asherin_engine_dork",
            leads_found: report.totalHits,
            probed: report.theoriesTested,
            anomalies: report.topExposures.filter((x) => x.yieldScore >= 40).length,
            elapsed_ms: report.elapsedMs,
            results: {
              topExposures: report.topExposures.slice(0, 20),
              byCategoryCounts: Object.fromEntries(
                Object.entries(report.byCategory).map(([k, v]) => [k, v.length]),
              ),
            },
            summary: {
              brief: report.brief?.slice(0, 2000) || "",
              defensiveGuidance: report.defensiveGuidance?.slice(0, 1500) || "",
              via: report.via,
              theoriesGenerated: report.theoriesGenerated,
            },
          });
        }
      } catch (e) {
        console.warn("[aureon-dork] ledger insert skipped:", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      report,
      context: formatDorkContext(report),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[aureon-dork] fail:", (e as Error).message);
    return new Response(JSON.stringify({ error: "internal", message: (e as Error).message?.slice(0, 400) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
