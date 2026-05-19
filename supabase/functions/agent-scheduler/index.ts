import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AGENT-SCHEDULER] ${step}${detailsStr}`);
};

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
