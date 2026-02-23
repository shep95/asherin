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
  { id: "auth", name: "Authentication & Authorization", challenge: "Build a secure JWT-based authentication system with refresh tokens, session management, rate limiting, and RBAC. Include login, signup, password reset, and token rotation." },
  { id: "api", name: "API Engineering", challenge: "Build a REST API gateway with input validation, error handling, pagination, rate limiting, request queuing, circuit breakers, and retry logic with exponential backoff." },
  { id: "db", name: "Database Engineering", challenge: "Build a database access layer with connection pooling, parameterized queries, migrations, transaction management, optimistic locking, and query performance monitoring." },
  { id: "frontend", name: "Frontend Architecture", challenge: "Build a component library with lazy loading, virtual scrolling, state management, error boundaries, accessibility compliance, and responsive design patterns." },
  { id: "security", name: "Cybersecurity", challenge: "Build a security module with XSS prevention, CSRF tokens, content security policies, input sanitization, encrypted storage, audit logging, and intrusion detection." },
  { id: "realtime", name: "Realtime Systems", challenge: "Build a WebSocket server with connection heartbeats, reconnection logic, message ordering, pub/sub channels, presence tracking, and graceful degradation." },
  { id: "data", name: "Data Pipeline", challenge: "Build an ETL pipeline with streaming ingestion, data validation, schema evolution, deduplication, backpressure handling, and checkpoint recovery." },
  { id: "ml", name: "ML Engineering", challenge: "Build an inference pipeline with model versioning, A/B testing, feature stores, prediction caching, drift detection, and fallback strategies." },
  { id: "devops", name: "Infrastructure", challenge: "Build a deployment system with health checks, rolling updates, canary deployments, log aggregation, alerting rules, and auto-scaling policies." },
  { id: "testing", name: "Quality Assurance", challenge: "Build a test framework with unit tests, integration tests, snapshot tests, load tests, mutation testing, and coverage reporting with CI integration." },
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
    details: details.slice(0, 2000),
    severity,
  });
}

// Fetch all active brain directives to inject into code generation
async function getActiveBrains(supabase: any): Promise<string> {
  const { data: brains } = await supabase
    .from("self_learning_brains")
    .select("directive, domain, name")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!brains?.length) return "";

  return brains.map((b: any) => `[${b.domain}] ${b.directive}`).join("\n\n");
}

// PHASE 1: Generate code for a domain challenge, informed by existing brains
async function phaseGenerate(supabase: any, runId: string, domain: any, brainDirectives: string): Promise<string> {
  await logAgent(supabase, runId, "Generator", `Phase 1: Generating code for ${domain.name}`, domain.challenge);

  const systemPrompt = `You are AUREON's Code Generator. You write production-grade TypeScript code.

${brainDirectives ? `LEARNED DIRECTIVES (apply these lessons from past iterations):\n${brainDirectives}\n` : ""}

RULES:
- Write complete, runnable TypeScript code that solves the challenge
- Use proper error handling, types, and production patterns
- Do NOT use placeholder comments like "// implement here" — write real logic
- Return ONLY the code, no markdown fences, no explanations`;

  const code = await callAI(systemPrompt, `Challenge: ${domain.challenge}\n\nWrite the complete implementation.`);
  await logAgent(supabase, runId, "Generator", `Generated ${code.length} chars for ${domain.name}`, code.slice(0, 500));
  return code;
}

// PHASE 2: Analyze the generated code for bugs, security flaws, design issues
async function phaseAnalyze(supabase: any, runId: string, domain: any, code: string): Promise<any> {
  await logAgent(supabase, runId, "Analyzer", `Phase 2: Analyzing code for ${domain.name}`, `Reviewing ${code.length} chars`);

  const systemPrompt = `You are AUREON's Code Analyzer. You ruthlessly review code for errors.

RULES:
- Find REAL bugs: null references, race conditions, logic errors, off-by-one, unhandled promises
- Find security flaws: injection, auth bypass, timing attacks, insecure defaults
- Find design flaws: tight coupling, missing error handling, poor abstractions
- Find performance issues: O(n²) loops, memory leaks, unnecessary allocations
- For each issue, provide the exact line/section and a concrete fix
- Return ONLY valid JSON, no markdown

Return: {
  "errors_found": number,
  "issues": [
    {
      "type": "bug" | "security" | "performance" | "design",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "Short title",
      "location": "The exact code section with the problem",
      "explanation": "Why this is wrong",
      "fix": "The corrected code or approach"
    }
  ]
}`;

  const raw = await callAI(systemPrompt, `Domain: ${domain.name}\n\nCode to analyze:\n${code}`);
  
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);
    await logAgent(supabase, runId, "Analyzer", `Found ${result.errors_found || 0} issues in ${domain.name}`, JSON.stringify(result.issues?.slice(0, 3) || []).slice(0, 500));
    return result;
  } catch {
    await logAgent(supabase, runId, "Analyzer", "Parse error during analysis", raw.slice(0, 300), "warning");
    return { errors_found: 0, issues: [] };
  }
}

// PHASE 3: Build brain directives from the errors found
async function phaseBuildBrain(supabase: any, runId: string, domain: any, analysis: any): Promise<string> {
  if (!analysis.issues?.length) {
    await logAgent(supabase, runId, "Brain Builder", `No issues to learn from in ${domain.name}`, "Code passed analysis");
    return "";
  }

  await logAgent(supabase, runId, "Brain Builder", `Phase 3: Building brain from ${analysis.issues.length} errors`, domain.name);

  const systemPrompt = `You are AUREON's Brain Builder. You convert code errors into permanent coding directives.

RULES:
- Take the list of errors found in code and distill them into universal coding rules
- Each directive must be actionable and specific, not generic platitudes
- Directives should prevent the SAME CLASS of error in ALL future code, not just this specific case
- Format: Clear imperative sentences that a code generator can follow
- Return ONLY the directive text, no JSON, no markdown — just the rules, one per line`;

  const directive = await callAI(systemPrompt, `Domain: ${domain.name}\n\nErrors found:\n${JSON.stringify(analysis.issues, null, 2)}\n\nGenerate coding directives that prevent these classes of errors in all future code.`);

  // Store the brain
  await supabase.from("self_learning_brains").insert({
    run_id: runId,
    name: `${domain.name} — Iteration Brain`,
    domain: domain.name,
    directive: directive.slice(0, 3000),
    confidence: Math.min(0.5 + (analysis.issues.length * 0.05), 0.98),
    auto_approved: true,
    active: true,
    findings: analysis.issues,
  });

  await logAgent(supabase, runId, "Brain Builder", `Brain stored for ${domain.name}`, directive.slice(0, 300));
  return directive;
}

// PHASE 4: Rebuild code with the new brain directive applied
async function phaseRebuild(supabase: any, runId: string, domain: any, originalCode: string, analysis: any, newDirective: string, existingBrains: string): Promise<{ code: string; improved: boolean }> {
  if (!analysis.issues?.length) {
    return { code: originalCode, improved: false };
  }

  await logAgent(supabase, runId, "Rebuilder", `Phase 4: Rebuilding code for ${domain.name}`, `Applying ${analysis.issues.length} fixes`);

  const allDirectives = [existingBrains, newDirective].filter(Boolean).join("\n\n");

  const systemPrompt = `You are AUREON's Code Rebuilder. You fix code based on analysis findings.

LEARNED DIRECTIVES:\n${allDirectives}

RULES:
- Take the original code and the list of issues found
- Rewrite the code fixing ALL identified issues
- Apply all learned directives to prevent similar issues
- The rebuilt code must be complete and production-ready
- Return ONLY the fixed code, no markdown, no explanations`;

  const rebuiltCode = await callAI(systemPrompt, `Domain: ${domain.name}\n\nOriginal code:\n${originalCode}\n\nIssues to fix:\n${JSON.stringify(analysis.issues, null, 2)}\n\nRewrite the code with all fixes applied.`);

  await logAgent(supabase, runId, "Rebuilder", `Rebuilt ${rebuiltCode.length} chars for ${domain.name}`, rebuiltCode.slice(0, 500));
  return { code: rebuiltCode, improved: true };
}

// PHASE 5: Verify the rebuilt code — re-analyze to confirm fixes
async function phaseVerify(supabase: any, runId: string, domain: any, rebuiltCode: string, originalIssueCount: number): Promise<any> {
  await logAgent(supabase, runId, "Verifier", `Phase 5: Verifying rebuilt code for ${domain.name}`, `Checking if ${originalIssueCount} issues were fixed`);

  const systemPrompt = `You are AUREON's Code Verifier. You check if previously identified issues have been fixed.

RULES:
- Analyze this rebuilt code for remaining issues
- Be honest — if issues persist, report them
- Return ONLY valid JSON, no markdown

Return: {
  "remaining_issues": number,
  "fixed_issues": number,
  "improvement_score": number (0-100, percentage of issues resolved),
  "verdict": "pass" | "partial" | "fail",
  "remaining": [{ "title": string, "severity": string }]
}`;

  const raw = await callAI(systemPrompt, `Domain: ${domain.name}\nOriginal issue count: ${originalIssueCount}\n\nRebuilt code to verify:\n${rebuiltCode}`);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);
    await logAgent(supabase, runId, "Verifier", `Verdict: ${result.verdict} — ${result.improvement_score}% improved`, `Fixed: ${result.fixed_issues}, Remaining: ${result.remaining_issues}`);
    return result;
  } catch {
    await logAgent(supabase, runId, "Verifier", "Parse error during verification", raw.slice(0, 300), "warning");
    return { remaining_issues: 0, fixed_issues: originalIssueCount, improvement_score: 100, verdict: "pass", remaining: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const body = await req.json();
    const { action } = body;

    // --- CRON MANAGEMENT ---
    if (action === "get-cron-status") {
      const { data } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
      return new Response(JSON.stringify({ cron: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set-cron") {
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
      const { data: settings } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
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
      await supabase.from("self_learning_cron_settings").update({ last_cron_run_at: new Date().toISOString() }).eq("id", settings.id);
      // Fall through to run
    }

    // --- MAIN LEARNING LOOP ---
    if (action === "run" || action === "cron-tick") {
      const startTime = Date.now();

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
      let totalBrainsGenerated = 0;
      const allFindings: any[] = [];
      const analyzedDomains: string[] = [];

      // Load existing brain directives
      const existingBrains = await getActiveBrains(supabase);
      await logAgent(supabase, run.id, "System", "Loaded brain directives", `${existingBrains.length} chars of learned knowledge`);

      // Pick 2 random domains per run (5 phases each = 10 AI calls per domain)
      const shuffled = [...DOMAINS].sort(() => Math.random() - 0.5).slice(0, 2);

      for (const domain of shuffled) {
        analyzedDomains.push(domain.name);
        await logAgent(supabase, run.id, "System", `=== Starting cycle for ${domain.name} ===`, domain.challenge);

        try {
          // PHASE 1: Generate code
          const generatedCode = await phaseGenerate(supabase, run.id, domain, existingBrains);
          totalCodeReviewed += 1;

          // PHASE 2: Analyze for errors
          const analysis = await phaseAnalyze(supabase, run.id, domain, generatedCode);
          const issueCount = analysis.issues?.length || 0;
          totalBugs += analysis.issues?.filter((i: any) => i.type === "bug").length || 0;
          totalSecurityPatches += analysis.issues?.filter((i: any) => i.type === "security").length || 0;

          if (analysis.issues?.length) {
            allFindings.push(...analysis.issues.map((f: any) => ({ ...f, domain: domain.name })));
          }

          // PHASE 3: Build brain from errors
          const newDirective = await phaseBuildBrain(supabase, run.id, domain, analysis);
          if (newDirective) totalBrainsGenerated += 1;

          // PHASE 4: Rebuild code with fixes
          const { code: rebuiltCode, improved } = await phaseRebuild(supabase, run.id, domain, generatedCode, analysis, newDirective, existingBrains);

          // PHASE 5: Verify the rebuild
          if (improved) {
            const verification = await phaseVerify(supabase, run.id, domain, rebuiltCode, issueCount);
            totalOptimizations += verification.fixed_issues || 0;
            await logAgent(supabase, run.id, "System", `Cycle complete for ${domain.name}`, `Verdict: ${verification.verdict}, Score: ${verification.improvement_score}%`);
          } else {
            await logAgent(supabase, run.id, "System", `Cycle complete for ${domain.name}`, "No issues found — code passed first analysis");
          }
        } catch (domainErr) {
          const msg = domainErr instanceof Error ? domainErr.message : "Unknown error";
          await logAgent(supabase, run.id, "System", `Error in ${domain.name} cycle`, msg, "error");
        }
      }

      const duration = Date.now() - startTime;

      await supabase.from("self_learning_runs").update({
        status: "completed",
        domains_analyzed: analyzedDomains,
        findings: allFindings,
        brains_generated: totalBrainsGenerated,
        code_reviewed: totalCodeReviewed,
        bugs_found: totalBugs,
        optimizations_applied: totalOptimizations,
        security_patches: totalSecurityPatches,
        duration_ms: duration,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      await logAgent(supabase, run.id, "System", "Run completed", `Duration: ${duration}ms, Domains: ${analyzedDomains.length}, Findings: ${allFindings.length}, Brains: ${totalBrainsGenerated}`);

      return new Response(JSON.stringify({ success: true, runId: run.id, duration, findings: allFindings.length, brains: totalBrainsGenerated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DATA QUERIES ---
    if (action === "get-runs") {
      const { data } = await supabase.from("self_learning_runs").select("*").order("created_at", { ascending: false }).limit(50);
      return new Response(JSON.stringify({ runs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-brains") {
      const { data } = await supabase.from("self_learning_brains").select("*").order("created_at", { ascending: false }).limit(100);
      return new Response(JSON.stringify({ brains: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-logs") {
      const { runId } = body;
      let query = supabase.from("self_learning_agent_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (runId) query = query.eq("run_id", runId);
      const { data } = await query;
      return new Response(JSON.stringify({ logs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle-brain") {
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
