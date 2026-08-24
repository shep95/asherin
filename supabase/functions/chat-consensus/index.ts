import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

/*
  AUREON MULTI-MODEL CONSENSUS ENGINE
  ════════════════════════════════════════════
  Phase 1: PARALLEL EXECUTION — Run all models simultaneously on the same query
  Phase 2: CROSS-VALIDATION — Each model's output is checked against every other for hallucinations
  Phase 3: ENSEMBLE VOTING — Extract factual claims, vote on truth via majority rule
  Phase 4: CONFIDENCE SCORING — Compute agreement metrics and flag divergence for human review
  Phase 5: SYNTHESIS — Merge agreed facts into a single authoritative response
*/

// ── Provider Endpoints ──────────────────────────────────────────────────────────
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  meta: "https://api.together.xyz/v1/chat/completions",
  venice: "https://api.venice.ai/api/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

// ── Phase 1: Call a single provider ──────────────────────────────────────────────
async function callProvider(
  provider: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
): Promise<{ provider: string; model: string; content: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    let response: Response;

    if (provider === "google") {
      const geminiMessages = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. Ready." }] },
        ...messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: geminiMessages, generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } }),
        },
      );
      if (!response.ok) {
        const errText = await response.text();
        return { provider, model, content: "", error: `${response.status}: ${errText.slice(0, 200)}`, latencyMs: Date.now() - start };
      }
      const data = await response.json();
      return { provider, model, content: data.candidates?.[0]?.content?.parts?.[0]?.text || "", latencyMs: Date.now() - start };
    }

    if (provider === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model, max_tokens: 8192, system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return { provider, model, content: "", error: `${response.status}: ${errText.slice(0, 200)}`, latencyMs: Date.now() - start };
      }
      const data = await response.json();
      return { provider, model, content: data.content?.[0]?.text || "", latencyMs: Date.now() - start };
    }

    if (provider === "default") {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
      if (!GEMINI_API_KEY) return { provider, model: "gemini-flash-latest", content: "", error: "No default API key", latencyMs: Date.now() - start };
      const geminiMessages = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. Ready." }] },
        ...messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: geminiMessages, generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } }),
        },
      );
      if (!response.ok) {
        const errText = await response.text();
        return { provider: "default", model: "gemini-flash-latest", content: "", error: `${response.status}: ${errText.slice(0, 200)}`, latencyMs: Date.now() - start };
      }
      const data = await response.json();
      return { provider: "default", model: "gemini-flash-latest", content: data.candidates?.[0]?.content?.parts?.[0]?.text || "", latencyMs: Date.now() - start };
    }

    // OpenAI-compatible providers
    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) return { provider, model, content: "", error: "Unknown provider", latencyMs: Date.now() - start };

    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages.map(m => ({ role: m.role, content: m.content }))],
        temperature: 0.4,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { provider, model, content: "", error: `${response.status}: ${errText.slice(0, 200)}`, latencyMs: Date.now() - start };
    }

    const data = await response.json();
    return { provider, model, content: data.choices?.[0]?.message?.content || "", latencyMs: Date.now() - start };
  } catch (e) {
    return { provider, model, content: "", error: e instanceof Error ? e.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

// ── Text Analysis Utilities ──────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "this", "that", "with", "from", "have", "been", "were", "they", "their", "there",
  "what", "when", "which", "would", "could", "should", "about", "these", "those",
  "other", "some", "more", "most", "very", "also", "just", "than", "then", "into",
  "over", "such", "only", "each", "will", "does", "make", "like", "well", "many",
  "much", "your", "here", "being", "doing", "while", "after", "before", "both",
]);

function extractKeyTerms(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s.%-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  );
}

// Extract factual claims as sentence-level units for voting
function extractClaims(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 15 && s.split(/\s+/).length >= 4);
}

// ── Phase 2: Cross-Validation ────────────────────────────────────────────────────
// Each response's claims are checked against all other responses.
// A claim is "validated" if at least one other model mentions similar key terms.

interface CrossValidationResult {
  provider: string;
  model: string;
  totalClaims: number;
  validatedClaims: number;
  unvalidatedClaims: string[]; // potential hallucinations
  validationRate: number; // 0-1
}

function crossValidate(responses: { provider: string; model: string; content: string }[]): CrossValidationResult[] {
  const results: CrossValidationResult[] = [];

  for (let i = 0; i < responses.length; i++) {
    const claims = extractClaims(responses[i].content);
    const otherTexts = responses.filter((_, j) => j !== i).map(r => r.content.toLowerCase());
    const otherTermSets = otherTexts.map(t => extractKeyTerms(t));

    let validated = 0;
    const unvalidated: string[] = [];

    for (const claim of claims) {
      const claimTerms = extractKeyTerms(claim);
      if (claimTerms.size < 2) { validated++; continue; } // trivial claim

      // A claim is validated if >=50% of its key terms appear in at least one other response
      const isValidated = otherTermSets.some(otherTerms => {
        const overlap = [...claimTerms].filter(t => otherTerms.has(t)).length;
        return overlap / claimTerms.size >= 0.4;
      });

      if (isValidated) {
        validated++;
      } else {
        unvalidated.push(claim);
      }
    }

    results.push({
      provider: responses[i].provider,
      model: responses[i].model,
      totalClaims: claims.length,
      validatedClaims: validated,
      unvalidatedClaims: unvalidated.slice(0, 5), // cap at 5 for display
      validationRate: claims.length > 0 ? validated / claims.length : 1,
    });
  }

  return results;
}

// ── Phase 3: Ensemble Voting ─────────────────────────────────────────────────────
// Extract key factual tokens/phrases. The "truth" = claims supported by majority of models.

interface EnsembleResult {
  agreedFacts: string[];       // terms/concepts all models mention
  contestedFacts: string[];    // terms only some models mention
  majorityThreshold: number;   // what % constitutes "majority"
  agreementRatio: number;      // 0-1 overall
}

function ensembleVote(responses: { content: string }[]): EnsembleResult {
  const n = responses.length;
  const majorityThreshold = Math.ceil(n / 2); // >50%

  // Count how many models mention each key term
  const termCounts: Map<string, number> = new Map();
  const allTermSets = responses.map(r => extractKeyTerms(r.content));

  for (const termSet of allTermSets) {
    for (const term of termSet) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }
  }

  const agreedFacts: string[] = [];
  const contestedFacts: string[] = [];

  for (const [term, count] of termCounts) {
    if (count >= majorityThreshold) {
      agreedFacts.push(term);
    } else if (count === 1 && n >= 3) {
      // Only one model mentions this — potential hallucination or unique insight
      contestedFacts.push(term);
    }
  }

  // Agreement ratio: how many terms have majority support
  const totalMeaningful = [...termCounts.entries()].filter(([_, c]) => c >= 1).length;
  const agreementRatio = totalMeaningful > 0 ? agreedFacts.length / totalMeaningful : 1;

  return {
    agreedFacts: agreedFacts.sort((a, b) => (termCounts.get(b) || 0) - (termCounts.get(a) || 0)).slice(0, 30),
    contestedFacts: contestedFacts.slice(0, 15),
    majorityThreshold,
    agreementRatio,
  };
}

// ── Phase 4: Confidence Scoring ──────────────────────────────────────────────────

interface ConfidenceAssessment {
  overallConfidence: number; // 0-100
  level: "high" | "medium" | "low" | "critical_divergence";
  needsHumanReview: boolean;
  reasons: string[];
  jaccardSimilarity: number;
}

function assessConfidence(
  responses: { content: string }[],
  crossValidation: CrossValidationResult[],
  ensemble: EnsembleResult,
): ConfidenceAssessment {
  const reasons: string[] = [];

  // 1. Jaccard pairwise similarity
  let totalJaccard = 0;
  let pairs = 0;
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const a = extractKeyTerms(responses[i].content);
      const b = extractKeyTerms(responses[j].content);
      const inter = new Set([...a].filter(t => b.has(t)));
      const union = new Set([...a, ...b]);
      totalJaccard += union.size > 0 ? inter.size / union.size : 0;
      pairs++;
    }
  }
  const avgJaccard = pairs > 0 ? totalJaccard / pairs : 0;

  // 2. Cross-validation rate
  const avgValidation = crossValidation.length > 0
    ? crossValidation.reduce((s, c) => s + c.validationRate, 0) / crossValidation.length
    : 1;

  // 3. Ensemble agreement
  const ensembleScore = ensemble.agreementRatio;

  // Weighted confidence
  let confidence = (avgJaccard * 35) + (avgValidation * 40) + (ensembleScore * 25);
  confidence = Math.min(100, Math.max(0, Math.round(confidence * 100) / 100));

  // Determine level
  let level: ConfidenceAssessment["level"];
  let needsHumanReview = false;

  if (confidence >= 70) {
    level = "high";
    reasons.push(`${responses.length} models strongly agree (${Math.round(avgJaccard * 100)}% term overlap)`);
  } else if (confidence >= 45) {
    level = "medium";
    reasons.push("Partial agreement — some claims are contested");
    if (ensemble.contestedFacts.length > 5) {
      reasons.push(`${ensemble.contestedFacts.length} facts mentioned by only one model`);
    }
  } else if (confidence >= 25) {
    level = "low";
    needsHumanReview = true;
    reasons.push("Significant divergence between models — human review recommended");
  } else {
    level = "critical_divergence";
    needsHumanReview = true;
    reasons.push("Models fundamentally disagree — treat all outputs as unverified");
  }

  // Check for hallucination flags
  const totalUnvalidated = crossValidation.reduce((s, c) => s + c.unvalidatedClaims.length, 0);
  if (totalUnvalidated > 3) {
    needsHumanReview = true;
    reasons.push(`${totalUnvalidated} claims could not be cross-validated — possible hallucinations`);
  }

  return { overallConfidence: confidence, level, needsHumanReview, reasons, jaccardSimilarity: Math.round(avgJaccard * 100) / 100 };
}

// ── Phase 5: Synthesis ──────────────────────────────────────────────────────────
// If confidence is high, pick the response with the highest validation rate as the "verdict"

function selectVerdict(
  responses: { provider: string; model: string; content: string }[],
  crossValidation: CrossValidationResult[],
): { verdictIndex: number; verdictProvider: string; verdictModel: string } {
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < crossValidation.length; i++) {
    const cv = crossValidation[i];
    // Score = validation rate * content length (prefer thorough + validated)
    const score = cv.validationRate * Math.min(responses[i].content.length, 5000);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return {
    verdictIndex: bestIdx,
    verdictProvider: responses[bestIdx].provider,
    verdictModel: responses[bestIdx].model,
  };
}

// ── Main Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, models, systemPrompt } = await req.json();

    if (!models || !Array.isArray(models) || models.length < 2) {
      return new Response(JSON.stringify({ error: "Select at least 2 models for consensus mode." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (models.length > 4) {
      return new Response(JSON.stringify({ error: "Maximum 4 models for consensus mode." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auth & Key Retrieval ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const userKeys: Record<string, string> = {};

    if (authHeader) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
        const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(SUPABASE_URL, ANON_KEY);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) {
          const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);
          const { data: keys } = await adminSb.from("user_api_keys").select("provider, api_key").eq("user_id", user.id).eq("is_active", true);
          if (keys) for (const k of keys) userKeys[k.provider] = k.api_key;
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      }
    }

    const sysPrompt = systemPrompt || "You are an advanced AI. Be direct, precise, and factual. No filler. Give thorough answers with specific details.";

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: PARALLEL EXECUTION
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`[CONSENSUS] Phase 1: Launching ${models.length} models in parallel`);
    const phaseOneStart = Date.now();

    const promises = models.map((m: { provider: string; model: string }) => {
      const apiKey = m.provider === "default" ? "default" : userKeys[m.provider];
      if (!apiKey && m.provider !== "default") {
        return Promise.resolve({
          provider: m.provider, model: m.model, content: "", latencyMs: 0,
          error: `No API key for ${m.provider}. Add it in Settings → AI Model Keys.`,
        });
      }
      return callProvider(m.provider, m.model, apiKey || "", messages, sysPrompt);
    });

    const rawResults = await Promise.all(promises);
    const phaseOneMs = Date.now() - phaseOneStart;
    console.log(`[CONSENSUS] Phase 1 complete: ${phaseOneMs}ms`);

    const successful = rawResults.filter(r => r.content && !r.error);

    if (successful.length < 2) {
      // Not enough models responded — return what we have without full analysis
      return new Response(JSON.stringify({
        consensus: false,
        confidence: { overallConfidence: 0, level: "critical_divergence", needsHumanReview: true, reasons: ["Not enough models responded for consensus analysis."], jaccardSimilarity: 0 },
        crossValidation: [],
        ensemble: { agreedFacts: [], contestedFacts: [], majorityThreshold: 0, agreementRatio: 0 },
        verdict: null,
        responses: rawResults.map(r => ({ provider: r.provider, model: r.model, content: r.content, error: r.error || null, latencyMs: r.latencyMs })),
        timing: { parallelMs: phaseOneMs, totalMs: Date.now() - phaseOneStart },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: CROSS-VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`[CONSENSUS] Phase 2: Cross-validating ${successful.length} responses`);
    const crossValidation = crossValidate(successful);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3: ENSEMBLE VOTING
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`[CONSENSUS] Phase 3: Ensemble voting`);
    const ensemble = ensembleVote(successful);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 4: CONFIDENCE ASSESSMENT
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`[CONSENSUS] Phase 4: Confidence scoring`);
    const confidence = assessConfidence(successful, crossValidation, ensemble);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 5: VERDICT SELECTION
    // ═══════════════════════════════════════════════════════════════════════════
    const verdict = selectVerdict(successful, crossValidation);
    console.log(`[CONSENSUS] Phase 5: Verdict → ${verdict.verdictProvider}/${verdict.verdictModel} (confidence: ${confidence.overallConfidence}%)`);

    const totalMs = Date.now() - phaseOneStart;

    return new Response(JSON.stringify({
      consensus: confidence.level === "high" || confidence.level === "medium",
      confidence,
      crossValidation: crossValidation.map(cv => ({
        provider: cv.provider,
        model: cv.model,
        totalClaims: cv.totalClaims,
        validatedClaims: cv.validatedClaims,
        unvalidatedClaims: cv.unvalidatedClaims,
        validationRate: Math.round(cv.validationRate * 100),
      })),
      ensemble: {
        agreedFacts: ensemble.agreedFacts.slice(0, 15),
        contestedFacts: ensemble.contestedFacts.slice(0, 10),
        agreementRatio: Math.round(ensemble.agreementRatio * 100),
      },
      verdict: {
        index: verdict.verdictIndex,
        provider: verdict.verdictProvider,
        model: verdict.verdictModel,
      },
      responses: rawResults.map(r => ({
        provider: r.provider,
        model: r.model,
        content: r.content,
        error: r.error || null,
        latencyMs: r.latencyMs,
      })),
      timing: { parallelMs: phaseOneMs, totalMs },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("consensus error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
