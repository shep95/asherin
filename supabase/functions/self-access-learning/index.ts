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

// Simulated codebase manifest — real file paths in the project
const CODEBASE_FILES = [
  { path: "src/App.tsx", domain: "Frontend", desc: "Root app with routing" },
  { path: "src/pages/Dashboard.tsx", domain: "Frontend", desc: "Main dashboard orchestrator with 30+ views" },
  { path: "src/pages/Index.tsx", domain: "Frontend", desc: "Landing page" },
  { path: "src/contexts/AuthContext.tsx", domain: "Security", desc: "Auth state management" },
  { path: "src/contexts/SubscriptionContext.tsx", domain: "Backend", desc: "Subscription tier gating" },
  { path: "src/lib/ai.ts", domain: "AI/ML", desc: "Streaming AI chat client" },
  { path: "src/lib/encryption.ts", domain: "Security", desc: "Client-side encryption utilities" },
  { path: "src/lib/file-security.ts", domain: "Security", desc: "File validation and sanitization" },
  { path: "src/lib/messageQueue.ts", domain: "Backend", desc: "Offline message queue with retry" },
  { path: "src/components/dashboard/ChatView.tsx", domain: "Frontend", desc: "Main chat interface" },
  { path: "src/components/dashboard/asha/AshaView.tsx", domain: "Data", desc: "Asha data intelligence hub" },
  { path: "src/components/dashboard/zali/ZaliView.tsx", domain: "Design", desc: "ZALI engineering design lab" },
  { path: "src/components/dashboard/NomadView.tsx", domain: "Intelligence", desc: "OSINT investigation agent" },
  { path: "src/components/dashboard/SecurityDashboardView.tsx", domain: "Security", desc: "8-system security command center" },
  { path: "src/components/dashboard/ElionView.tsx", domain: "Intelligence", desc: "Elion/Zohar forensic toolkit" },
  { path: "src/components/dashboard/ide/AureonIdeView.tsx", domain: "IDE", desc: "Full IDE with file tree and terminal" },
  { path: "src/components/ProtectedRoute.tsx", domain: "Security", desc: "Route protection wrapper" },
  { path: "supabase/functions/chat/index.ts", domain: "Backend", desc: "AI chat edge function" },
  { path: "supabase/functions/security-gateway/index.ts", domain: "Security", desc: "WAF and security gateway" },
  { path: "supabase/functions/self-learning-loop/index.ts", domain: "AI/ML", desc: "Self-learning autonomous loop" },
  { path: "supabase/functions/asha-analyze/index.ts", domain: "Data", desc: "Asha dataset analysis" },
  { path: "supabase/functions/zali-analyze/index.ts", domain: "Design", desc: "ZALI engineering analysis" },
  { path: "supabase/functions/nomad-investigate/index.ts", domain: "Intelligence", desc: "NOMAD investigation engine" },
  { path: "supabase/functions/generate-predictions/index.ts", domain: "AI/ML", desc: "Predictive intelligence" },
  { path: "src/integrations/supabase/client.ts", domain: "Backend", desc: "Supabase client config" },
  { path: "src/components/dashboard/DashboardSidebar.tsx", domain: "Frontend", desc: "Sidebar nav with access control" },
];

const ANALYSIS_AGENTS = [
  { name: "Debugging Agent", focus: "Identify bugs, logic errors, null pointer risks, race conditions, and crash vectors. Trace data flow and find where variables could be undefined." },
  { name: "Optimization Agent", focus: "Find performance bottlenecks: O(n²) loops, unnecessary re-renders, memory leaks, bundle size issues, redundant API calls, missing memoization." },
  { name: "Security Agent", focus: "Red-team the architecture: find injection vectors, auth bypasses, XSS risks, insecure defaults, missing input validation, exposed secrets, CORS misconfigs." },
  { name: "Architecture Agent", focus: "Assess coupling, cohesion, separation of concerns, component size (god-components), circular dependencies, scalability limits, and maintainability." },
  { name: "Design Agent", focus: "Evaluate UI/UX patterns: accessibility gaps, responsive breakpoints, inconsistent theming, missing loading/error states, poor component composition." },
];

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, scope } = body;

    if (action === "analyze") {
      const startTime = Date.now();

      // Get user id from auth
      const token = authHeader?.replace("Bearer ", "") || "";
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      if (!user) throw new Error("No user");

      // Create run
      const { data: run } = await supabase
        .from("self_access_runs")
        .insert({ user_id: user.id, status: "running", scan_scope: scope || "full" })
        .select().single();
      if (!run) throw new Error("Failed to create run");

      // Filter files by scope
      let files = CODEBASE_FILES;
      if (scope === "frontend") files = files.filter(f => f.domain === "Frontend" || f.domain === "Design");
      else if (scope === "backend") files = files.filter(f => f.domain === "Backend" || f.domain === "Data" || f.domain === "AI/ML");
      else if (scope === "security") files = files.filter(f => f.domain === "Security");

      // Pick random subset per run (max 8 files to keep it fast)
      const selectedFiles = [...files].sort(() => Math.random() - 0.5).slice(0, 8);

      // Run 2 random agents across all selected files
      const selectedAgents = [...ANALYSIS_AGENTS].sort(() => Math.random() - 0.5).slice(0, 2);
      const allFindings: any[] = [];

      for (const agent of selectedAgents) {
        const fileList = selectedFiles.map(f => `- ${f.path} (${f.domain}): ${f.desc}`).join("\n");

        const systemPrompt = `You are the ${agent.name} in AUREON's Self-Access Learning system — an autonomous intelligence that analyzes its own codebase.
Your focus: ${agent.focus}

CRITICAL RULES:
- You are analyzing a REAL production codebase (React + TypeScript + Supabase + Tailwind).
- Generate ACTIONABLE findings with REAL fixes. Not theoretical — production-grade.
- For each finding, provide the EXACT code change needed.
- Never auto-apply. You produce recommendations for the human creator.
- Return ONLY valid JSON array, no markdown.

Each finding must be:
{
  "file_path": "exact/path/to/file",
  "finding_type": "bug"|"optimization"|"security"|"architecture"|"design",
  "severity": "critical"|"high"|"medium"|"low",
  "title": "Short descriptive title",
  "finding": "What you found — the specific issue",
  "reasoning": "Deep analysis of WHY this is a problem, tracing through the code logic",
  "recommendation": "What should be done to fix it",
  "reason_needs_fix": "Impact if left unfixed — production consequences",
  "output_code": "The exact code snippet or diff to apply as the fix"
}`;

        const userPrompt = `Analyze these files from the AUREON AI intelligence platform codebase. Generate 2-4 high-quality findings:

${fileList}

Context: This is a production AI platform with chat, data intelligence (ASHA), engineering design (ZALI), OSINT (NOMAD), predictive intel, IDE, security command center, and self-learning capabilities. It uses React 18, Supabase edge functions, Tailwind CSS, and the Lovable AI gateway.

Focus on REAL issues you'd find in a codebase of this complexity. Be specific about file paths and code patterns.`;

        try {
          const raw = await callAI(systemPrompt, userPrompt);
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const findings = JSON.parse(cleaned);
          if (Array.isArray(findings)) {
            allFindings.push(...findings.map((f: any) => ({
              ...f,
              user_id: user.id,
              run_id: run.id,
            })));
          }
        } catch (e) {
          console.error(`Agent ${agent.name} parse error:`, e);
        }
      }

      // Store findings
      if (allFindings.length > 0) {
        await supabase.from("self_access_findings").insert(allFindings);
      }

      const duration = Date.now() - startTime;
      await supabase.from("self_access_runs").update({
        status: "completed",
        files_analyzed: selectedFiles.length,
        findings_count: allFindings.length,
        duration_ms: duration,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true, runId: run.id, findings: allFindings.length, duration,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get-runs") {
      const { data } = await supabase
        .from("self_access_runs").select("*")
        .order("created_at", { ascending: false }).limit(50);
      return new Response(JSON.stringify({ runs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-findings") {
      const { runId, status: filterStatus } = body;
      let query = supabase.from("self_access_findings").select("*")
        .order("created_at", { ascending: false }).limit(200);
      if (runId) query = query.eq("run_id", runId);
      if (filterStatus) query = query.eq("status", filterStatus);
      const { data } = await query;
      return new Response(JSON.stringify({ findings: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-finding") {
      const { findingId, status: newStatus } = body;
      await supabase.from("self_access_findings").update({ status: newStatus }).eq("id", findingId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-access-learning error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
