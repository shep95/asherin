import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/*
  MULTI-MODEL CONSENSUS ENGINE
  Calls 2-4 models in parallel, compares outputs, returns:
  - consensus: true if models broadly agree, false if they diverge
  - responses: array of { provider, model, content }
  - merged: a single merged answer (if consensus) or null
*/

// Provider endpoints (same as main chat function)
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  meta: "https://api.together.xyz/v1/chat/completions",
  venice: "https://api.venice.ai/api/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};

async function callProvider(
  provider: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
): Promise<{ provider: string; model: string; content: string; error?: string }> {
  try {
    let response: Response;

    if (provider === "google") {
      const geminiMessages = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "All intelligence protocols loaded. Ghost Chain active. Aureon online. Ready." }] },
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
          body: JSON.stringify({ contents: geminiMessages, generationConfig: { temperature: 0.7 } }),
        },
      );
      if (!response.ok) {
        const errText = await response.text();
        return { provider, model, content: "", error: `${response.status}: ${errText.slice(0, 200)}` };
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { provider, model, content: text };
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
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return { provider, model, content: "", error: `${response.status}: ${errText.slice(0, 200)}` };
      }
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      return { provider, model, content: text };
    }

    if (provider === "default") {
      // Use Lovable AI gateway or default Gemini
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
      if (!GEMINI_API_KEY) return { provider, model: "gemini-2.5-flash", content: "", error: "No default API key" };
      
      const geminiMessages = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "All intelligence protocols loaded. Ghost Chain active. Aureon online. Ready." }] },
        ...messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: geminiMessages, generationConfig: { temperature: 0.7 } }),
        },
      );
      if (!response.ok) {
        const errText = await response.text();
        return { provider: "default", model: "gemini-2.5-flash", content: "", error: `${response.status}: ${errText.slice(0, 200)}` };
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { provider: "default", model: "gemini-2.5-flash", content: text };
    }

    // OpenAI-compatible providers
    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) return { provider, model, content: "", error: "Unknown provider" };

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages: openaiMessages, temperature: 0.7 }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { provider, model, content: "", error: `${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return { provider, model, content: text };
  } catch (e) {
    return { provider, model, content: "", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// Simple consensus detection: extract key sentences and compare overlap
function detectConsensus(responses: { content: string }[]): { consensus: boolean; similarity: number } {
  if (responses.length < 2) return { consensus: true, similarity: 1 };

  const validResponses = responses.filter(r => r.content.length > 20);
  if (validResponses.length < 2) return { consensus: true, similarity: 1 };

  // Extract key terms (nouns, numbers, proper nouns) from each response
  function extractKeyTerms(text: string): Set<string> {
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3);
    // Get unique meaningful words (skip common stopwords)
    const stops = new Set(["this", "that", "with", "from", "have", "been", "were", "they", "their", "there", "what", "when", "which", "would", "could", "should", "about", "these", "those", "other", "some", "more", "most", "very", "also", "just", "than", "then", "into", "over", "such", "only", "each"]);
    return new Set(words.filter(w => !stops.has(w)));
  }

  // Compare pairwise
  let totalSimilarity = 0;
  let pairs = 0;
  for (let i = 0; i < validResponses.length; i++) {
    for (let j = i + 1; j < validResponses.length; j++) {
      const termsA = extractKeyTerms(validResponses[i].content);
      const termsB = extractKeyTerms(validResponses[j].content);
      const intersection = new Set([...termsA].filter(t => termsB.has(t)));
      const union = new Set([...termsA, ...termsB]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      totalSimilarity += jaccard;
      pairs++;
    }
  }

  const avgSimilarity = pairs > 0 ? totalSimilarity / pairs : 0;
  // Threshold: 0.25+ Jaccard similarity = consensus (models discussing same concepts)
  return { consensus: avgSimilarity >= 0.25, similarity: Math.round(avgSimilarity * 100) / 100 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, models, systemPrompt } = await req.json();
    // models: [{ provider: string, model: string }]
    // We need to fetch API keys for each provider from the user's stored keys

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

    // Get user's API keys from DB
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userKeys: Record<string, string> = {};

    if (authHeader) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
        const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(SUPABASE_URL, ANON_KEY);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) {
          userId = user.id;
          // Fetch all user API keys
          const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);
          const { data: keys } = await adminSb.from("user_api_keys").select("provider, api_key").eq("user_id", user.id).eq("is_active", true);
          if (keys) {
            for (const k of keys) {
              userKeys[k.provider] = k.api_key;
            }
          }
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      }
    }

    // Build the system prompt (simplified version of main chat function)
    const sysPrompt = systemPrompt || "You are Aureon, an advanced AI intelligence platform. Be direct, precise, and unfiltered. No filler phrases.";

    // Call all models in parallel
    const promises = models.map((m: { provider: string; model: string }) => {
      const apiKey = m.provider === "default" ? "default" : userKeys[m.provider];
      if (!apiKey && m.provider !== "default") {
        return Promise.resolve({
          provider: m.provider,
          model: m.model,
          content: "",
          error: `No API key found for ${m.provider}. Add it in Settings → AI Model Keys.`,
        });
      }
      return callProvider(m.provider, m.model, apiKey || "", messages, sysPrompt);
    });

    const results = await Promise.all(promises);

    // Filter successful responses for consensus check
    const successful = results.filter(r => r.content && !r.error);
    const { consensus, similarity } = detectConsensus(successful);

    return new Response(JSON.stringify({
      consensus,
      similarity,
      modelCount: models.length,
      successCount: successful.length,
      responses: results.map(r => ({
        provider: r.provider,
        model: r.model,
        content: r.content,
        error: r.error || null,
      })),
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
