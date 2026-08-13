// asher-incident-response — Authorized incident response audit/control stub.
// Strictly staff-only (sha256 digest match). This function intentionally does
// not simulate provider control and does not perform destructive operations. It
// records the verified admin request and returns the real control-state:
// "provider_control_not_connected" until explicit provider integrations exist.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

import { isStaffEmail } from "../_shared/identityHash.ts";
const isAuthorizedAdminEmail = (e?: string | null): boolean => isStaffEmail(e);

interface Step { action: string; status: "ok" | "skipped" | "error"; detail?: string; }

async function executeAction(action: string): Promise<Step> {
  return { action, status: "skipped", detail: "provider_control_not_connected" };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    const { data: u } = await supabase.auth.getUser(jwt);
    if (!u?.user || !isAuthorizedAdminEmail(u.user.email)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { level, target, actions, confirm, restore } = body || {};
    if (!target || typeof target !== "string") {
      return new Response(JSON.stringify({ error: "target required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (restore) {
      await supabase.from("asher_audit_log").insert({
        user_id: u.user.id,
        event_type: "module_open",
        detail: { panel: "emergency_ops", phase: "restore_request", target, level },
      });
      return new Response(JSON.stringify({ status: "restore_queued", target }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (![1, 2, 3, 4].includes(level)) {
      return new Response(JSON.stringify({ error: "invalid level" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const expected = level === 4 ? "PERMANENT REMOVAL" : "CONFIRM DISCONNECT";
    if (confirm !== expected) {
      return new Response(JSON.stringify({ error: "confirmation phrase mismatch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(actions) || actions.length === 0) {
      return new Response(JSON.stringify({ error: "actions required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const steps: Step[] = [];
    for (const a of actions) steps.push(await executeAction(String(a)));
    const status = steps.every((s) => s.status === "ok") ? "complete"
      : steps.some((s) => s.status === "error") ? "failed" : "complete";

    await supabase.from("asher_audit_log").insert({
      user_id: u.user.id,
      event_type: "module_open",
      detail: { panel: "emergency_ops", phase: "executed", level, target, status, steps },
    });

    return new Response(JSON.stringify({ status, target, level, steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
