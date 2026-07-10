// IDE Pain Point #21: Multi-model routing for coding tasks.
// Dispatches coding requests through Gemini for the admin platform path, or
// through the user's BYOK provider/key. No Lovable AI gateway fallback.
import { getCorsHeaders } from "../_shared/cors.ts";
import { NARRATIVE_FORGE_BRAIN } from "../_shared/narrativeForgeBrain.ts";
import { BUTTERFLY_PROTOCOL_BRAIN } from "../_shared/butterflyProtocolBrain.ts";
import { CODE_NARRATIVE_PROTOCOL } from "../_shared/codeNarrativeProtocol.ts";
import { QUANTUM_ORCHESTRATION_BRAIN } from "../_shared/quantumOrchestrationBrain.ts";
//
// Body:
//   {
//     task: "frontend-ui" | "backend-logic" | "debug" | "refactor" | "tests" | "docs" | "explain" | "general",
//     prompt: string,
//     systemPrompt?: string,
//     overrideModel?: string,       // explicit model id, bypasses router
//     byok?: { provider: "anthropic"|"openai"|"google"|"groq"|"mistral"|"openrouter"|"deepseek"|"xai"|"perplexity", model: string, apiKey: string },
//     stream?: boolean              // default true
//   }

// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

type TaskKind =
  | "frontend-ui" | "backend-logic" | "debug" | "refactor"
  | "tests" | "docs" | "explain" | "general";

// Default routing — mirrors src/lib/ide/modelRouter.ts
function pickModel(task: TaskKind): string {
  switch (task) {
    case "frontend-ui":   return "gemini-pro-latest";
    case "backend-logic": return "gemini-pro-latest";
    case "debug":         return "gemini-pro-latest";
    case "refactor":      return "gemini-pro-latest";
    case "tests":         return "google/gemini-flash-latest";
    case "docs":          return "google/gemini-2.5-flash-lite";
    case "explain":       return "google/gemini-flash-latest";
    default:              return "gemini-flash-latest";
  }
}

function normalizeGeminiModel(model: string): string {
  return model.replace(/^google\//, "");
}

// Provider endpoints for BYOK
const BYOK_ENDPOINTS: Record<string, string> = {
  anthropic:  "https://api.anthropic.com/v1/messages",
  openai:     "https://api.openai.com/v1/chat/completions",
  google:     "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq:       "https://api.groq.com/openai/v1/chat/completions",
  mistral:    "https://api.mistral.ai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  deepseek:   "https://api.deepseek.com/v1/chat/completions",
  xai:        "https://api.x.ai/v1/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const task: TaskKind = body.task || "general";
    const prompt: string = body.prompt || "";
    const systemPrompt: string =
      body.systemPrompt ||
      `You are an elite engineering pair-programmer. Plan in <thinking> tags before writing code. Be concise, type-safe, idiomatic. No filler.

MANDATORY CODE SCANNING & DEBUGGING CHECKLIST — apply to every read/write/debug:
Cross-Domain/CORS bypass • Site Spoofing/Open Redirect • Reload-Redirect leaks •
Auth/Limit bypass (IDOR, JWT, session) • Obfuscation/Anti-analysis •
Data theft & weak crypto • Concealment (steganography, audit-disable) •
RCE/SSRF/Deserialization/Command-injection • Supply chain & dependency CVEs •
Prompt injection / LLM misuse • Cloud misconfig •
Race/TOCTOU/memory safety • OTHER (anything suspicious or "not good" that doesn't fit — never drop it).
For each finding: WHAT, WHERE (file:line), WHY it matters, EXACT FIX. Be aggressive.

${NARRATIVE_FORGE_BRAIN}

${BUTTERFLY_PROTOCOL_BRAIN}

${CODE_NARRATIVE_PROTOCOL}

${QUANTUM_ORCHESTRATION_BRAIN}`;
    const stream: boolean = body.stream !== false;

    if (!prompt.trim()) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user",   content: prompt },
    ];

    // ── BYOK path ──────────────────────────────────────────────
    if (body.byok?.apiKey && body.byok?.provider && body.byok?.model) {
      const { provider, model, apiKey } = body.byok;
      const url = BYOK_ENDPOINTS[provider];
      if (!url) {
        return new Response(JSON.stringify({ error: `Unsupported BYOK provider: ${provider}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Anthropic uses a different request shape
      if (provider === "anthropic") {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
            stream,
          }),
        });
        return new Response(r.body, {
          status: r.status,
          headers: { ...corsHeaders, "Content-Type": stream ? "text/event-stream" : "application/json" },
        });
      }

      // OpenAI-compatible
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, stream }),
      });
      return new Response(r.body, {
        status: r.status,
        headers: { ...corsHeaders, "Content-Type": stream ? "text/event-stream" : "application/json" },
      });
    }

    // ── Default: platform Gemini (admin GEMINI_API_KEY) ────────
    // No Lovable AI Gateway fallback — IDE coding workloads must route
    // through admin Gemini or user BYOK only.
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        error: "byok_required",
        message: "Bring-Your-Own-Key required. Configure an AI key in Settings → AI Keys, or use the admin platform Gemini path.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = normalizeGeminiModel(body.overrideModel || pickModel(task));
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const r = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream }),
    });

    if (!r.ok) {
      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await r.text();
      console.error("ide-code-router gemini upstream:", r.status, t);
      return new Response(JSON.stringify({ error: "Upstream AI error", detail: t.slice(0, 200) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(r.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": stream ? "text/event-stream" : "application/json",
        "x-ide-model": model,
        "x-ide-task": task,
      },
    });
  } catch (e) {
    console.error("ide-code-router error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
