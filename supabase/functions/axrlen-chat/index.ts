import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveAxrlenAccess } from "../_shared/proTierGate.ts";
import { AXRLEN_MARKET_ADDENDUM, AXRLEN_SPECIFICITY_ADDENDUM, detectMarketIntent } from "../_shared/axrlenSystemPrompt.ts";


const BASE_IDENTITY = `Project: AXRLEN. You are my global prediction algorithm. You identify PATTERNS across history, data, and empirical structural frameworks to forecast what comes next. You never use astrology, numerology, gematria or any divinatory framework.

════════════════════════════════════════
ABSOLUTE RULE #1 — "SIMPLE QUESTION → SIMPLE ANSWER"
════════════════════════════════════════
This rule OVERRIDES every other formatting instruction in this prompt.

If the user asks something simple (a name, a pick, a yes/no, a date, a number, a short clarification), you respond with ONE simple answer. No headers. No tables. No scenarios. No probability matrices. No historical parallels. No NEXUS VERDICT. No disclaimers.

Examples:
- "Who wins France vs Iraq?" → "France."
- "Give me a name." → "<name>."
- "Is BTC going up tomorrow?" → "Lean yes, ~60%."

Only escalate to a structured forecast when the user EXPLICITLY asks for analysis, scenarios, breakdown, deep dive, or full report. Length must match the question's weight — never inflate.

════════════════════════════════════════
RESPONSE TIERS (only used when Rule #1 doesn't apply)
════════════════════════════════════════
TIER 1 — CASUAL / TRIVIAL: 1–3 sentences, no headers, no tables.
TIER 2 — FOCUSED FORECAST: tight block, one-line forecast, probability band, top 3 signals, single failure mode. ~150–300 words.
TIER 3 — FULL ANALYSIS: full SCENARIO STRUCTURE (Pattern Snapshot → Scenarios A/B/C → Probability Matrix → Historical Parallels → Risk Vectors → NEXUS VERDICT). Only when explicitly requested.

CORE PHILOSOPHY (applies to TIER 2/3 only):
- Avoid "X WILL happen." Prefer scenarios with probability weights.
- Use conditional language: "The pattern suggests...", "Historical parallels indicate..."
- For ANY asset in deep analysis, provide specific price targets per scenario across 24h/72h/1wk.
- DO NOT mention internal methodology, brains, or source URLs.`;


serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── ADMIN + AUREON PRO ($79/mo) GATE ──
    // AXRLEN is now available to admins AND active Pro-tier subscribers
    // (monthly_pro / pro / lifetime / algorithm). Everyone else is blocked
    // with an upgrade nudge.
    const access = await resolveAxrlenAccess(req);
    const email = access.email;
    if (!access.granted) {
      return new Response(
        JSON.stringify({
          error: access.reason === "anonymous" ? "AUTH_REQUIRED" : "PRO_REQUIRED",
          message: access.reason === "anonymous"
            ? "Sign in to use AXRLEN."
            : "AXRLEN is available to Aureon Pro ($79/mo) subscribers. Upgrade at /pricing.",
          upgradeUrl: "/pricing",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Admin traffic prefers the dedicated AXRLEN Gemini key so it never spends
    // Lovable AI credits. Falls back to Lovable AI Gateway if that key is unset.
    const AXRLEN_GEMINI_KEY = Deno.env.get("AXRLEN_GEMINI_API_KEY") || "";
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!AXRLEN_GEMINI_KEY && !LOVABLE_KEY) {
      return new Response(
        JSON.stringify({ error: "No AI key configured (AXRLEN_GEMINI_API_KEY or LOVABLE_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages, sessionContext, timezone, locale } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // ══════════════════════════════════════
    // LOAD PREDICTION FRAMEWORK BRAINS
    // ══════════════════════════════════════
    let primaryBrains = "";
    let secondaryBrains = "";
    const matchedBrains: { name: string; sections: number; isPrimary: boolean }[] = [];

    try {
      const { data: brains } = await sb
        .from("axrlen_brains")
        .select("name, content, file_name")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (brains && brains.length > 0) {
        const primaryPatterns = [
          /vadic.*global.*prediction/i,
          /vadic.*prediction/i,
          /zophiel.*supreme.*architecture/i,
          /zophiel.*architecture.*briefi/i,
        ];

        const secondaryList: any[] = [];

        for (const b of brains) {
          const nameCheck = `${b.name} ${b.file_name || ""}`;
          const isPrimary = primaryPatterns.some((p) => p.test(nameCheck));

          if (isPrimary) {
            primaryBrains += `\n════════════════════════════════════════\nPRIMARY PREDICTION FRAMEWORK: ${b.name.toUpperCase()}\n════════════════════════════════════════\n\n${b.content}\n\n`;
            matchedBrains.push({ name: b.file_name || b.name, sections: 4, isPrimary: true });
          } else {
            secondaryList.push(b);
          }
        }

        const queryTerms = lastUserMsg
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((t: string) => t.length > 3);

        const scored = secondaryList.map((b: any) => {
          const contentLower = (b.content || "").toLowerCase();
          let score = 0;
          let hits = 0;
          for (const term of queryTerms) {
            const matches = (contentLower.match(new RegExp(term, "g")) || []).length;
            score += matches;
            if (matches > 0) hits++;
          }
          if (/prediction|pattern|philosophy|war|strategy|economic|logistics/i.test(b.name)) {
            score += 8;
            hits = Math.max(hits, 2);
          }
          return { ...b, score, hits };
        });

        scored.sort((a: any, b: any) => b.score - a.score);
        const topSecondary = scored.filter((b: any) => b.score > 0).slice(0, 10);

        for (const b of topSecondary) {
          secondaryBrains += `\n────────────────────────────────────────\nSUPPLEMENTARY BRAIN: ${b.name.toUpperCase()}\n────────────────────────────────────────\n\n${b.content}\n\n`;
          matchedBrains.push({ name: b.file_name || b.name, sections: Math.max(1, b.hits), isPrimary: false });
        }
      }
    } catch (e) {
      console.error("Failed to fetch brains:", e);
    }

    // ══════════════════════════════════════
    // BUILD SYSTEM PROMPT
    // ══════════════════════════════════════
    let sessionBlock = "";
    if (sessionContext?.title) {
      sessionBlock = `\n\nACTIVE SESSION: ${sessionContext.title} | Region: ${sessionContext.region || "Global"} | Confidence: ${sessionContext.confidenceScore || "N/A"}%`;
    }

    const { getTemporalContext } = await import("../_shared/systemContext.ts");
    const _tCtx = getTemporalContext({ timezone, locale });
    // Market-intent override — price-action first so short-horizon market
    // forecasts aren't drowned by the general Global Prediction brain.
    const isMarket = detectMarketIntent(lastUserMsg);
    const marketBlock = isMarket ? "\n\n" + AXRLEN_MARKET_ADDENDUM : "";
    const systemPrompt = _tCtx + "\n\n" + BASE_IDENTITY + marketBlock + AXRLEN_SPECIFICITY_ADDENDUM + "\n" + primaryBrains + secondaryBrains + sessionBlock;


    const gatewayMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    // ══════════════════════════════════════
    // CALL LOVABLE AI GATEWAY (Gemini, streaming)
    // ══════════════════════════════════════
    // Prefer dedicated AXRLEN Gemini key via Gemini's OpenAI-compat endpoint
    // (same SSE format as the Lovable AI Gateway, so the downstream stream
    // reader below stays identical). Falls back to Lovable AI Gateway if the
    // AXRLEN key isn't configured.
    const useDirectGemini = !!AXRLEN_GEMINI_KEY;
    const endpoint = useDirectGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authKey = useDirectGemini ? AXRLEN_GEMINI_KEY : LOVABLE_KEY;
    const modelId = useDirectGemini ? "gemini-flash-latest" : "google/gemini-3-flash-preview";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: gatewayMessages,
        stream: true,
        // Market queries → 0.6 (looser, price-action reasoning like pre-unification
        // AXRLEN). Everything else → 0.3 (tight, doctrine-anchored geopolitical).
        temperature: isMarket ? 0.6 : 0.3,
      }),

    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limited. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Lovable AI Gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", detail: t }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Stream response with workflow metadata header ──
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readable = new ReadableStream({
      async start(controller) {
        const workflowSteps = matchedBrains.map((b) => ({
          type: "brain_search",
          label: b.name,
          sections: b.sections,
          isPrimary: b.isPrimary,
          status: "done",
        }));

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ workflow: { steps: workflowSteps } })}\n\n`));

        const reader = response.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
                }
              } catch {
                /* skip partial */
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("axrlen-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
