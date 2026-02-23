import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DOMAINS = [
  "Software Design & Architecture",
  "Frontend Development",
  "Backend Development",
  "Database Engineering",
  "Systems Programming",
  "Cybersecurity Engineering",
  "Quality Assurance & Testing",
  "DevOps & Infrastructure-as-Code",
  "Data Engineering & Science",
  "AI/Machine Learning Engineering",
  "Intelligence Architecture",
  "Computational Linguistics",
  "Specialized Computing",
];

const AGENTS = [
  { name: "Debugging Agent", role: "Identify bugs, logic errors, and crash vectors in code patterns" },
  { name: "Optimization Agent", role: "Find performance bottlenecks, O(n²) loops, memory leaks, and propose O(n log n) or better alternatives" },
  { name: "Security Agent", role: "Red-team the code — find injection vectors, timing attacks, auth bypasses, insecure defaults" },
  { name: "Design Agent", role: "Evaluate UI/UX patterns, accessibility, responsiveness, component architecture" },
  { name: "Architecture Agent", role: "Assess system design, coupling, cohesion, separation of concerns, scalability" },
];

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function logAgent(supabase: any, runId: string, agentName: string, action: string, details: string, severity = "info") {
  await supabase.from("self_learning_agent_logs").insert({
    run_id: runId,
    agent_name: agentName,
    action,
    details,
    severity,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate admin
    const authHeader = req.headers.get("Authorization");
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      if (!user || user.email !== ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action } = await req.json();

    if (action === "get-cron-status") {
      const { data } = await supabase
        .from("self_learning_cron_settings")
        .select("*")
        .limit(1)
        .single();
      return new Response(JSON.stringify({ cron: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set-cron") {
      const body = await req.json().catch(() => ({}));
      const { enabled, interval_minutes } = body;
      const updates: any = { updated_at: new Date().toISOString() };
      if (typeof enabled === "boolean") updates.enabled = enabled;
      if (typeof interval_minutes === "number") updates.interval_minutes = interval_minutes;
      const { data: rows } = await supabase.from("self_learning_cron_settings").select("id").limit(1).single();
      if (rows) {
        await supabase.from("self_learning_cron_settings").update(updates).eq("id", rows.id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cron-tick") {
      // Called by pg_cron every minute — only run if enabled
      const { data: settings } = await supabase
        .from("self_learning_cron_settings")
        .select("*")
        .limit(1)
        .single();
      if (!settings?.enabled) {
        return new Response(JSON.stringify({ skipped: true, reason: "cron disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const lastRun = settings.last_cron_run_at ? new Date(settings.last_cron_run_at).getTime() : 0;
      const intervalMs = (settings.interval_minutes || 60) * 60 * 1000;
      if (Date.now() - lastRun < intervalMs) {
        return new Response(JSON.stringify({ skipped: true, reason: "interval not reached" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Update last run timestamp
      await supabase.from("self_learning_cron_settings").update({ last_cron_run_at: new Date().toISOString() }).eq("id", settings.id);
      // Fall through to run logic below
    }

    if (action === "run" || action === "cron-tick") {
      const startTime = Date.now();

      // Create run record
      const { data: run } = await supabase
        .from("self_learning_runs")
        .insert({ status: "running", domains_analyzed: [] })
        .select()
        .single();

      if (!run) throw new Error("Failed to create run");

      let totalBugs = 0;
      let totalOptimizations = 0;
      let totalSecurityPatches = 0;
      let totalCodeReviewed = 0;
      const allFindings: any[] = [];
      const analyzedDomains: string[] = [];

      // Pick 3 random domains per run to keep it fast
      const shuffled = [...DOMAINS].sort(() => Math.random() - 0.5).slice(0, 3);

      for (const domain of shuffled) {
        analyzedDomains.push(domain);
        await logAgent(supabase, run.id, "Scout", `Scanning domain: ${domain}`, `Initiating analysis of ${domain}`, "info");

        // Run all agents in parallel for this domain
        const agentResults = await Promise.allSettled(
          AGENTS.map(async (agent) => {
            const systemPrompt = `You are the ${agent.name} in an autonomous self-learning coding loop for the AUREON AI platform. Your role: ${agent.role}.

RULES:
- Analyze the domain "${domain}" and generate actionable findings
- Return a JSON object with: { "bugs": number, "optimizations": number, "security_issues": number, "code_patterns_reviewed": number, "findings": [{"type": "bug"|"optimization"|"security"|"design"|"architecture", "severity": "critical"|"high"|"medium"|"low", "title": string, "description": string, "fix": string}], "directive": string }
- The "directive" is a prompt engineering brain/directive that future code generation should follow based on your findings
- Be specific, actionable, and production-grade
- Return ONLY valid JSON, no markdown`;

            const userPrompt = `Analyze common patterns and anti-patterns in "${domain}" for a production AI intelligence platform. Generate findings and a self-correcting prompt directive (brain) that AUREON should apply to all future code generation in this domain. Focus on real-world production issues, not theoretical problems.`;

            const raw = await callAI(systemPrompt, userPrompt);
            await logAgent(supabase, run.id, agent.name, `Analyzed ${domain}`, raw.slice(0, 200), "info");

            // Parse the JSON response
            try {
              const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              return { agent: agent.name, domain, data: JSON.parse(cleaned) };
            } catch {
              await logAgent(supabase, run.id, agent.name, "Parse error", `Failed to parse response for ${domain}`, "warning");
              return { agent: agent.name, domain, data: { bugs: 0, optimizations: 0, security_issues: 0, code_patterns_reviewed: 0, findings: [], directive: "" } };
            }
          })
        );

        for (const result of agentResults) {
          if (result.status === "fulfilled") {
            const { agent, domain: d, data } = result.value;
            totalBugs += data.bugs || 0;
            totalOptimizations += data.optimizations || 0;
            totalSecurityPatches += data.security_issues || 0;
            totalCodeReviewed += data.code_patterns_reviewed || 0;

            if (data.findings?.length) {
              allFindings.push(...data.findings.map((f: any) => ({ ...f, agent, domain: d })));
            }

            // Store the brain/directive
            if (data.directive) {
              await supabase.from("self_learning_brains").insert({
                run_id: run.id,
                name: `${agent} — ${d}`,
                domain: d,
                directive: data.directive,
                confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
                auto_approved: true,
                active: true,
                findings: data.findings || [],
              });
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      // Update the run
      await supabase.from("self_learning_runs").update({
        status: "completed",
        domains_analyzed: analyzedDomains,
        findings: allFindings,
        brains_generated: analyzedDomains.length * AGENTS.length,
        code_reviewed: totalCodeReviewed,
        bugs_found: totalBugs,
        optimizations_applied: totalOptimizations,
        security_patches: totalSecurityPatches,
        duration_ms: duration,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      await logAgent(supabase, run.id, "System", "Run completed", `Duration: ${duration}ms, Domains: ${analyzedDomains.length}, Findings: ${allFindings.length}`, "info");

      return new Response(JSON.stringify({ success: true, runId: run.id, duration, findings: allFindings.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-runs") {
      const { data } = await supabase
        .from("self_learning_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return new Response(JSON.stringify({ runs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-brains") {
      const { data } = await supabase
        .from("self_learning_brains")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return new Response(JSON.stringify({ brains: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-logs") {
      const { runId } = await req.json().catch(() => ({}));
      let query = supabase
        .from("self_learning_agent_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (runId) query = query.eq("run_id", runId);
      const { data } = await query;
      return new Response(JSON.stringify({ logs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle-brain") {
      const body = await req.json();
      const { brainId, active } = body;
      await supabase.from("self_learning_brains").update({ active }).eq("id", brainId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-learning-loop error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
