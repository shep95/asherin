import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { emitPull } from "../_shared/connectPull.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AGENT-SCHEDULER] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cron-only endpoint: require shared secret to prevent unauthenticated invocation
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const supabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    logStep("Scheduler triggered");

    const now = new Date().toISOString();

    // Find all active scheduled agents whose next_run has passed (or is null — first run)
    const { data: agents, error } = await supabaseClient
      .from("automated_agents")
      .select("id, name, user_id, next_run, trigger_type, trigger_config")
      .eq("status", "active")
      .eq("trigger_type", "schedule");

    if (error) throw error;
    if (!agents || agents.length === 0) {
      logStep("No scheduled agents found");
      return new Response(JSON.stringify({ executed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dueAgents = agents.filter(a => {
      if (!a.next_run) return true; // Never run before, execute now
      return new Date(a.next_run) <= new Date(now);
    });

    logStep(`Found ${dueAgents.length} due agents out of ${agents.length} total`);

    const executionResults: any[] = [];

    for (const agent of dueAgents) {
      try {
        logStep(`Executing agent: ${agent.name}`, { id: agent.id });

        // Call agent-execute with cronMode
        const resp = await fetch(`${supabaseUrl}/functions/v1/agent-execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ agentId: agent.id, cronMode: true }),
        });

        const result = await resp.json();

        // The schedule tick is itself an event in the execution log: the
        // Connect graph must be able to show that a run was due, fired, and
        // how it landed — not just that a run happened at some point.
        void emitPull(agent.user_id, {
          organ: "zahten",
          capability: "schedule",
          fromSurface: "scheduler",
          status: resp.ok && result?.status !== "failed" ? "ok" : "fail",
          quote: agent.name,
          meta: { agent_id: agent.id, run_status: String(result?.status ?? (resp.ok ? "unknown" : "failed")) },
        });

        executionResults.push({
          agentId: agent.id,
          name: agent.name,
          success: resp.ok,
          result: resp.ok ? "executed" : result.error,
        });

        logStep(`Agent ${agent.name} execution ${resp.ok ? "succeeded" : "failed"}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logStep(`Agent ${agent.name} execution error: ${errMsg}`);
        void emitPull(agent.user_id, {
          organ: "zahten", capability: "schedule", fromSurface: "scheduler",
          status: "fail", quote: agent.name, meta: { agent_id: agent.id, error: errMsg.slice(0, 120) },
        });
        executionResults.push({
          agentId: agent.id,
          name: agent.name,
          success: false,
          result: errMsg,
        });
      }
    }

    logStep(`Scheduler complete: ${executionResults.filter(r => r.success).length}/${dueAgents.length} successful`);

    return new Response(JSON.stringify({
      executed: dueAgents.length,
      results: executionResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("SCHEDULER ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
