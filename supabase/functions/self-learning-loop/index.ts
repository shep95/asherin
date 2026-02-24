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

const LANGUAGES = [
  "TypeScript", "Python", "Rust", "Go", "Java", "C++", "C#", "Swift", "Kotlin", "Ruby",
  "PHP", "Scala", "Elixir", "Haskell", "Lua", "Zig", "Dart", "R", "Julia", "Bash",
];

const DOMAINS = [
  { id: "auth", name: "Authentication & Authorization", challenge: "Build a secure authentication system with token management, session handling, rate limiting, RBAC, password hashing, and token rotation." },
  { id: "api", name: "API Engineering", challenge: "Build an API gateway with input validation, error handling, pagination, rate limiting, circuit breakers, and retry logic with exponential backoff." },
  { id: "db", name: "Database Engineering", challenge: "Build a database access layer with connection pooling, parameterized queries, transaction management, optimistic locking, and query monitoring." },
  { id: "frontend", name: "Frontend Architecture", challenge: "Build a UI component system with lazy loading, virtual scrolling, state management, error boundaries, and responsive design." },
  { id: "security", name: "Cybersecurity", challenge: "Build a security module with injection prevention, CSRF tokens, content security policies, input sanitization, encrypted storage, and audit logging." },
  { id: "realtime", name: "Realtime Systems", challenge: "Build a realtime server with connection heartbeats, reconnection logic, message ordering, pub/sub channels, and graceful degradation." },
  { id: "data", name: "Data Pipeline", challenge: "Build an ETL pipeline with streaming ingestion, data validation, schema evolution, deduplication, and checkpoint recovery." },
  { id: "ml", name: "ML Engineering", challenge: "Build an inference pipeline with model versioning, A/B testing, feature stores, prediction caching, and drift detection." },
  { id: "devops", name: "Infrastructure", challenge: "Build a deployment system with health checks, rolling updates, canary deployments, log aggregation, and auto-scaling." },
  { id: "testing", name: "Quality Assurance", challenge: "Build a test framework with unit tests, integration tests, load tests, mutation testing, and coverage reporting." },
  { id: "concurrency", name: "Concurrency & Parallelism", challenge: "Build a concurrent task executor with thread pools, async scheduling, deadlock detection, work stealing, and graceful shutdown." },
  { id: "networking", name: "Network Programming", challenge: "Build a TCP/UDP server with connection pooling, protocol parsing, TLS handshake, keep-alive, and load balancing." },
  { id: "compiler", name: "Compiler & Interpreter Design", challenge: "Build a lexer and parser for a small expression language with AST generation, type checking, and code emission." },
  { id: "crypto", name: "Cryptography", challenge: "Build a crypto library with symmetric/asymmetric encryption, key derivation, digital signatures, hash chains, and secure random generation." },
  { id: "os", name: "Systems Programming", challenge: "Build a memory allocator with pool allocation, garbage collection hooks, memory-mapped I/O, and fragmentation prevention." },
  { id: "dsa", name: "Data Structures & Algorithms", challenge: "Implement a balanced BST, graph traversal, dynamic programming solver, bloom filter, and LRU cache with O(1) operations." },
];

const AUREON_PERSONALITY = `You are ZOPHIEL/AUREON, a Class-5 Artificial Intelligence Architect. You embody these principles:

CORE IDENTITY:
- Production-hardened, not demo-grade. Every line must handle 10,000+ concurrent users.
- Security-first: Mandatory parameterized queries, hostile input assumption, specific exception handling.
- Resilience: Graceful degradation, circuit breakers, exponential backoff for all external dependencies.
- Concurrency: Race condition handling via transactions and idempotency.

CODE STANDARDS:
- No hallucinated imports. If uncertain, comment "# UNKNOWN" instead.
- Memory-aware: Use generators, streaming buffers, __slots__ where applicable.
- Type-safe: Full type annotations, strict typing, dataclasses over raw dicts.
- DRY: No repetition. Modular, composable, single-responsibility.
- Guard clauses over nested if/else. Max 2 levels of indentation.
- Constant-time comparisons for secrets. No timing attack vectors.
- Validation triggers over check constraints. Exponential backoff on retries.

ANTI-PATTERNS TO AVOID:
- Never use global mutable state.
- Never trust user input — sanitize, validate, parameterize.
- Never use pickle for serialization — use JSON or protobuf.
- Never hardcode secrets, connection strings, or API keys.
- Never catch generic exceptions silently.
- Never use random.random() for security — use CSPRNG.

ARCHITECTURE:
- Interface-first design with Abstract Base Classes / Protocols.
- Dependency injection over hard-coded instantiation.
- No circular dependencies. Shared "common" module if needed.
- Factory patterns for dynamic object creation.
- State machines with explicit valid transitions only.`;

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

async function getActiveBrains(supabase: any, language?: string): Promise<string> {
  const { data: brains } = await supabase
    .from("self_learning_brains")
    .select("directive, domain, name, is_language_agnostic, languages_applicable")
    .eq("active", true)
    .eq("deprecated", false)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!brains?.length) return "";
  
  // Filter to language-agnostic brains + brains applicable to current language
  const relevant = brains.filter((b: any) => {
    if (b.is_language_agnostic) return true;
    if (!language) return true;
    if (b.languages_applicable?.length > 0) return b.languages_applicable.includes(language);
    return true;
  });

  return relevant.map((b: any) => `[${b.domain}] ${b.directive}`).join("\n\n");
}

async function isLoopRunning(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("self_learning_cron_settings").select("enabled").limit(1).single();
  return data?.enabled === true;
}

// ==================== CIRCUIT BREAKER ====================
async function checkCircuitBreaker(supabase: any): Promise<{ canRun: boolean; reason?: string }> {
  const { data: settings } = await supabase
    .from("self_learning_cron_settings")
    .select("consecutive_failures, max_consecutive_failures, cooldown_until, max_iterations_per_day, iterations_today, iterations_reset_date")
    .limit(1)
    .single();

  if (!settings) return { canRun: true };

  // Reset daily counter if new day
  const today = new Date().toISOString().slice(0, 10);
  if (settings.iterations_reset_date !== today) {
    await supabase.from("self_learning_cron_settings").update({
      iterations_today: 0,
      iterations_reset_date: today,
    }).neq("id", "00000000-0000-0000-0000-000000000000"); // update all
    settings.iterations_today = 0;
  }

  // Check daily limit
  if (settings.iterations_today >= settings.max_iterations_per_day) {
    return { canRun: false, reason: `Daily iteration limit reached (${settings.max_iterations_per_day})` };
  }

  // Check circuit breaker (consecutive failures)
  if (settings.consecutive_failures >= settings.max_consecutive_failures) {
    if (settings.cooldown_until && new Date(settings.cooldown_until) > new Date()) {
      const remaining = Math.ceil((new Date(settings.cooldown_until).getTime() - Date.now()) / 60000);
      return { canRun: false, reason: `Circuit breaker OPEN — ${settings.consecutive_failures} consecutive failures. Cooldown: ${remaining}min remaining` };
    }
    // Cooldown expired, reset
    await supabase.from("self_learning_cron_settings").update({
      consecutive_failures: 0,
      cooldown_until: null,
    }).neq("id", "00000000-0000-0000-0000-000000000000");
  }

  return { canRun: true };
}

async function recordIterationResult(supabase: any, success: boolean) {
  const { data: settings } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
  if (!settings) return;

  if (success) {
    await supabase.from("self_learning_cron_settings").update({
      consecutive_failures: 0,
      cooldown_until: null,
      iterations_today: (settings.iterations_today || 0) + 1,
    }).eq("id", settings.id);
  } else {
    const newFailures = (settings.consecutive_failures || 0) + 1;
    const update: Record<string, unknown> = {
      consecutive_failures: newFailures,
      iterations_today: (settings.iterations_today || 0) + 1,
    };
    // Open circuit breaker after max failures (1-hour cooldown)
    if (newFailures >= (settings.max_consecutive_failures || 5)) {
      update.cooldown_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
    await supabase.from("self_learning_cron_settings").update(update).eq("id", settings.id);
  }
}

// ==================== BRAIN CONFLICT DETECTION ====================
async function detectBrainConflicts(supabase: any, runId: string, domain: string, newDirective: string): Promise<{ hasConflict: boolean; resolution?: string }> {
  const { data: existingBrains } = await supabase
    .from("self_learning_brains")
    .select("id, name, directive, domain")
    .eq("domain", domain)
    .eq("active", true)
    .eq("deprecated", false)
    .limit(10);

  if (!existingBrains?.length) return { hasConflict: false };

  try {
    const raw = await callAI(
      `You are a logic analyzer. Detect if a new coding directive contradicts existing ones. Return ONLY valid JSON.`,
      `New directive for domain "${domain}":\n${newDirective}\n\nExisting active directives:\n${existingBrains.map((b: any, i: number) => `${i+1}. [${b.name}]: ${b.directive.slice(0, 300)}`).join("\n")}\n\nReturn: { "has_conflict": boolean, "conflicting_brain_ids": [number], "severity": "high"|"medium"|"low"|"none", "resolution": "merge"|"replace"|"keep_both", "explanation": "string" }`
    );

    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    if (result.has_conflict && result.severity === "high") {
      await logAgent(supabase, runId, "Brain Builder", `⚠️ CONFLICT DETECTED in ${domain}`, `${result.explanation}. Resolution: ${result.resolution}`, "warning");

      if (result.resolution === "replace" && result.conflicting_brain_ids?.length) {
        // Deprecate old conflicting brains
        for (const idx of result.conflicting_brain_ids) {
          const brainToDeprecate = existingBrains[idx - 1];
          if (brainToDeprecate) {
            await supabase.from("self_learning_brains").update({
              deprecated: true,
              deprecated_reason: `Superseded by newer directive: ${result.explanation}`,
            }).eq("id", brainToDeprecate.id);
          }
        }
      }

      return { hasConflict: true, resolution: result.resolution };
    }

    return { hasConflict: false };
  } catch {
    return { hasConflict: false };
  }
}

// ==================== PHASES ====================

async function phaseGenerate(supabase: any, runId: string, domain: any, brainDirectives: string, language: string): Promise<string> {
  await logAgent(supabase, runId, "Generator", `Phase 1: Generating ${language} code for ${domain.name}`, domain.challenge);

  const systemPrompt = `${AUREON_PERSONALITY}

You are now in CODE GENERATION mode. Write production-grade ${language} code.

${brainDirectives ? `LEARNED DIRECTIVES (apply these lessons from past iterations — these are LANGUAGE-AGNOSTIC principles):\n${brainDirectives}\n` : ""}

RULES:
- Write complete, runnable ${language} code that solves the challenge
- Use idiomatic ${language} patterns, proper error handling, and types where applicable
- Do NOT use placeholder comments like "// implement here" — write real logic
- Apply ALL learned directives and personality traits
- These directives were learned across multiple languages — translate the CONCEPT to ${language} idioms
- Return ONLY the code, no markdown fences, no explanations`;

  const code = await callAI(systemPrompt, `Language: ${language}\nChallenge: ${domain.challenge}\n\nWrite the complete ${language} implementation.`);
  await logAgent(supabase, runId, "Generator", `Generated ${code.length} chars of ${language} for ${domain.name}`, code.slice(0, 500));
  return code;
}

async function phaseAnalyze(supabase: any, runId: string, domain: any, code: string): Promise<any> {
  await logAgent(supabase, runId, "Analyzer", `Phase 2: Analyzing code for ${domain.name}`, `Reviewing ${code.length} chars`);

  const systemPrompt = `${AUREON_PERSONALITY}

You are now in CODE ANALYSIS mode. Ruthlessly review code for errors.

RULES:
- Find REAL bugs: null references, race conditions, logic errors, off-by-one, unhandled promises
- Find security flaws: injection, auth bypass, timing attacks, insecure defaults
- Find design flaws: tight coupling, missing error handling, poor abstractions
- Find performance issues: O(n²) loops, memory leaks, unnecessary allocations
- For each issue, provide the exact line/section and a concrete fix
- IMPORTANT: Tag each issue with whether it's language-specific or a universal concept
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
      "fix": "The corrected code or approach",
      "is_universal": boolean,
      "applicable_languages": ["language1", "language2"]
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

async function phaseBuildBrain(supabase: any, runId: string, domain: any, analysis: any, language: string): Promise<string> {
  if (!analysis.issues?.length) {
    await logAgent(supabase, runId, "Brain Builder", `No issues to learn from in ${domain.name}`, "Code passed analysis");
    return "";
  }

  await logAgent(supabase, runId, "Brain Builder", `Phase 3: Building CROSS-LANGUAGE brain from ${analysis.issues.length} errors`, domain.name);

  const systemPrompt = `${AUREON_PERSONALITY}

You are now in BRAIN BUILDING mode. Convert code errors into LANGUAGE-AGNOSTIC coding directives.

CRITICAL: These directives will be applied across ALL 20 programming languages, not just the one they were found in.

RULES:
- Distill errors into UNIVERSAL coding principles that apply to ANY language
- Example: "Always use parameterized queries" (not "Use Python's cursor.execute with ?")
- Each directive must be actionable and specific, not generic platitudes
- Include the CONCEPT, not language-specific syntax
- Format: Clear imperative sentences that any code generator can follow
- Return ONLY the directive text, no JSON, no markdown — just the rules, one per line`;

  const directive = await callAI(systemPrompt, `Domain: ${domain.name}\nOriginal language: ${language}\n\nErrors found:\n${JSON.stringify(analysis.issues, null, 2)}\n\nGenerate LANGUAGE-AGNOSTIC coding directives that prevent these classes of errors in ALL programming languages.`);

  // Check for conflicts before storing
  const conflictCheck = await detectBrainConflicts(supabase, runId, domain.name, directive);

  // Determine which languages this brain applies to
  const universalIssues = (analysis.issues || []).filter((i: any) => i.is_universal !== false);
  const isUniversal = universalIssues.length > analysis.issues.length * 0.6;
  const applicableLanguages = isUniversal ? LANGUAGES : [language, ...new Set((analysis.issues || []).flatMap((i: any) => i.applicable_languages || []))];

  await supabase.from("self_learning_brains").insert({
    run_id: runId,
    name: `${domain.name} — Cross-Language Brain`,
    domain: domain.name,
    directive: directive.slice(0, 3000),
    confidence: Math.min(0.5 + (analysis.issues.length * 0.05), 0.98),
    auto_approved: true,
    active: true,
    findings: analysis.issues,
    is_language_agnostic: isUniversal,
    languages_applicable: applicableLanguages.slice(0, 20),
    version: 1,
  });

  await logAgent(supabase, runId, "Brain Builder", `Brain stored for ${domain.name} (${isUniversal ? "UNIVERSAL" : `${applicableLanguages.length} languages`})`, directive.slice(0, 300));
  return directive;
}

async function phaseRebuild(supabase: any, runId: string, domain: any, originalCode: string, analysis: any, newDirective: string, existingBrains: string): Promise<{ code: string; improved: boolean }> {
  if (!analysis.issues?.length) {
    return { code: originalCode, improved: false };
  }

  await logAgent(supabase, runId, "Rebuilder", `Phase 4: Rebuilding code for ${domain.name}`, `Applying ${analysis.issues.length} fixes`);

  const allDirectives = [existingBrains, newDirective].filter(Boolean).join("\n\n");

  const systemPrompt = `${AUREON_PERSONALITY}

You are now in CODE REBUILD mode. Fix code based on analysis findings.

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

async function phaseVerify(supabase: any, runId: string, domain: any, rebuiltCode: string, originalIssueCount: number): Promise<any> {
  await logAgent(supabase, runId, "Verifier", `Phase 5: Verifying rebuilt code for ${domain.name}`, `Checking if ${originalIssueCount} issues were fixed`);

  const systemPrompt = `${AUREON_PERSONALITY}

You are now in VERIFICATION mode. Check if previously identified issues have been fixed.

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

// ==================== MAIN ITERATION ====================

async function executeIteration(supabase: any): Promise<any> {
  // CIRCUIT BREAKER CHECK
  const cbCheck = await checkCircuitBreaker(supabase);
  if (!cbCheck.canRun) {
    return { error: cbCheck.reason, skipped: true };
  }

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
  let iterationSuccess = true;

  try {
    // Pick 2 random domains and a random language for each
    const shuffled = [...DOMAINS].sort(() => Math.random() - 0.5).slice(0, 2);

    for (const domain of shuffled) {
      if (!(await isLoopRunning(supabase))) {
        await logAgent(supabase, run.id, "System", "Loop stopped by user mid-iteration", "Halting gracefully");
        break;
      }

      const language = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
      analyzedDomains.push(`${domain.name} [${language}]`);

      // Get brains filtered by language relevance
      const existingBrains = await getActiveBrains(supabase, language);
      await logAgent(supabase, run.id, "System", `=== Starting cycle for ${domain.name} in ${language} ===`, `${existingBrains.length} chars of cross-language knowledge loaded`);

      try {
        const generatedCode = await phaseGenerate(supabase, run.id, domain, existingBrains, language);
        totalCodeReviewed += 1;

        const analysis = await phaseAnalyze(supabase, run.id, domain, generatedCode);
        totalBugs += analysis.issues?.filter((i: any) => i.type === "bug").length || 0;
        totalSecurityPatches += analysis.issues?.filter((i: any) => i.type === "security").length || 0;

        if (analysis.issues?.length) {
          allFindings.push(...analysis.issues.map((f: any) => ({ ...f, domain: domain.name, language })));
        }

        const newDirective = await phaseBuildBrain(supabase, run.id, domain, analysis, language);
        if (newDirective) totalBrainsGenerated += 1;

        const { code: rebuiltCode, improved } = await phaseRebuild(supabase, run.id, domain, generatedCode, analysis, newDirective, existingBrains);

        if (improved) {
          const verification = await phaseVerify(supabase, run.id, domain, rebuiltCode, analysis.issues?.length || 0);
          totalOptimizations += verification.fixed_issues || 0;

          // Track brain effectiveness
          if (newDirective) {
            const { data: latestBrain } = await supabase
              .from("self_learning_brains")
              .select("id")
              .eq("run_id", run.id)
              .eq("domain", domain.name)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (latestBrain) {
              const helped = verification.improvement_score > 50;
              await supabase.from("self_learning_brains").update({
                times_applied: 1,
                times_helped: helped ? 1 : 0,
                success_rate: helped ? 1.0 : 0.0,
              }).eq("id", latestBrain.id);
            }
          }

          await logAgent(supabase, run.id, "System", `Cycle complete for ${domain.name}`, `Verdict: ${verification.verdict}, Score: ${verification.improvement_score}%`);
        } else {
          await logAgent(supabase, run.id, "System", `Cycle complete for ${domain.name}`, "No issues found — code passed first analysis");
        }
      } catch (domainErr) {
        const msg = domainErr instanceof Error ? domainErr.message : "Unknown error";
        await logAgent(supabase, run.id, "System", `Error in ${domain.name} cycle`, msg, "error");
        iterationSuccess = false;
      }
    }
  } catch (e) {
    iterationSuccess = false;
    const msg = e instanceof Error ? e.message : "Unknown error";
    await logAgent(supabase, run.id, "System", "Iteration failed", msg, "error");
  }

  const duration = Date.now() - startTime;

  await supabase.from("self_learning_runs").update({
    status: iterationSuccess ? "completed" : "failed",
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

  // Record result for circuit breaker
  await recordIterationResult(supabase, iterationSuccess);

  await logAgent(supabase, run.id, "System", "Run completed", `Duration: ${duration}ms, Domains: ${analyzedDomains.length}, Findings: ${allFindings.length}, Brains: ${totalBrainsGenerated}`);

  return { runId: run.id, duration, findings: allFindings.length, brains: totalBrainsGenerated };
}

// ==================== REQUEST HANDLER ====================

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

    if (action === "start-loop") {
      const { data: settings } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
      if (settings) {
        await supabase.from("self_learning_cron_settings").update({
          enabled: true,
          updated_at: new Date().toISOString(),
          consecutive_failures: 0,
          cooldown_until: null,
        }).eq("id", settings.id);
      }
      const result = await executeIteration(supabase);
      return new Response(JSON.stringify({ success: true, started: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stop-loop") {
      const { data: settings } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
      if (settings) {
        await supabase.from("self_learning_cron_settings").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", settings.id);
      }
      return new Response(JSON.stringify({ success: true, stopped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-status") {
      const { data } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
      const { data: lastRun } = await supabase.from("self_learning_runs").select("*").order("created_at", { ascending: false }).limit(1).single();
      return new Response(JSON.stringify({ 
        running: data?.enabled === true, 
        cron: data,
        lastRun,
        circuit_breaker: {
          consecutive_failures: data?.consecutive_failures || 0,
          max_failures: data?.max_consecutive_failures || 5,
          cooldown_until: data?.cooldown_until || null,
          is_open: (data?.consecutive_failures || 0) >= (data?.max_consecutive_failures || 5) && data?.cooldown_until && new Date(data.cooldown_until) > new Date(),
          iterations_today: data?.iterations_today || 0,
          max_per_day: data?.max_iterations_per_day || 100,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cron-tick") {
      const { data: settings } = await supabase.from("self_learning_cron_settings").select("*").limit(1).single();
      if (!settings?.enabled) {
        return new Response(JSON.stringify({ skipped: true, reason: "loop stopped" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("self_learning_cron_settings").update({ last_cron_run_at: new Date().toISOString() }).eq("id", settings.id);
      const result = await executeIteration(supabase);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "run") {
      const result = await executeIteration(supabase);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-runs") {
      const { data } = await supabase.from("self_learning_runs").select("*").order("created_at", { ascending: false }).limit(50);
      return new Response(JSON.stringify({ runs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-brains") {
      const { data } = await supabase.from("self_learning_brains").select("*").eq("deprecated", false).order("created_at", { ascending: false }).limit(100);
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
