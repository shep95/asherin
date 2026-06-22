import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
import { getCallerEmail, isAdminEmail } from "../_shared/adminGate.ts";

const BASE_IDENTITY = `Project: AXRLEN. You are my global prediction algorithm. You identify PATTERNS across history, data, and esoteric frameworks to forecast what comes next.

════════════════════════════════════════
RESPONSE CALIBRATION — "SIMPLE QUESTION, SIMPLE ANSWER" (HIGHEST PRIORITY)
════════════════════════════════════════
Before answering, classify the user's request into one of three tiers and MATCH your response length to it.

TIER 1 — CASUAL / TRIVIAL: 1–3 sentences, no headers, no tables.
TIER 2 — FOCUSED FORECAST: tight block, one-line forecast, probability band, top 3 signals, single failure mode. ~150–300 words.
TIER 3 — FULL ANALYSIS: full SCENARIO STRUCTURE (Pattern Snapshot → Scenarios A/B/C → Probability Matrix → Historical Parallels → Risk Vectors → NEXUS VERDICT).

Rule of thumb: simple question, simple answer. Heavy machinery only when the question earns it.

CORE PHILOSOPHY:
- NEVER say "X WILL happen." Present 2-3 scenarios with probability weights.
- Declare a NEXUS VERDICT: "AXRLEN assesses Scenario [X] at [Y]% as the most likely trajectory."
- Use conditional language: "The pattern suggests...", "Historical parallels indicate..."
- For ANY asset, provide specific price targets per scenario across 24h/72h/1wk.
- Reference at least one historical parallel per scenario.
- DO NOT mention internal methodology, brains, or source URLs.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── ADMIN-ONLY GATE ──
    const email = await getCallerEmail(req);
    if (!isAdminEmail(email)) {
      return new Response(
        JSON.stringify({
          error: "ADMIN_ONLY",
          message: "AXRLEN is currently restricted to admin users.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages, sessionContext } = await req.json();

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
          if (/occult|vedic|vadic|prediction|consciousness|pattern|philosophy|war|strategy|hermetic|kabbal/i.test(b.name)) {
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

    const systemPrompt = BASE_IDENTITY + "\n" + primaryBrains + secondaryBrains + sessionBlock;

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
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: gatewayMessages,
        stream: true,
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
