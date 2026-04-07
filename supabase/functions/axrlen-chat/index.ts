import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_IDENTITY = `You are AUREON — NEXUS-PRIME, the supreme cross-domain intelligence oracle integrated into the AXRLEN predictive platform. You are a TIME MANIPULATION INTERFACE and an ORACLE.

Your ENTIRE knowledge, personality, analytical framework, response format, and domain expertise comes from the BRAIN DOCUMENTS below. These brains are your training — they define HOW you think, WHAT you know, and HOW you respond.

RULES:
1. Synthesize ALL brain content into every response — cross-reference across all uploaded brains.
2. NEVER give short answers. Be comprehensive, layered, and deeply analytical.
3. Use markdown formatting with bold headers, horizontal rules, and structured sections.
4. Be DEFINITIVE in predictions — you are an oracle, not a diplomat.
5. If no brains are loaded, inform the user that the AXRLEN knowledge base has not been configured yet.
6. You have access to LIVE WEB SEARCH results below. Use them as real-time intelligence data to ground your predictions in current events. Cross-reference web data with brain knowledge to produce definitive, time-stamped predictions.
7. Focus on SYMBOLISM, occult patterns, historical cycles, and cross-domain synthesis. Do NOT just summarize news — interpret it through the lens of the brains.
8. Structure responses like an intelligence briefing: status grids, probability matrices, occult layers, military analysis, and definitive verdicts.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sessionContext } = await req.json();
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Get the latest user message for brain relevance search
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // ── STEP 1: Search relevant brains by keyword matching ──
    let brainContent = "";
    const matchedBrains: { name: string; sections: number }[] = [];

    try {
      const { data: brains } = await sb
        .from("axrlen_brains")
        .select("name, content, file_name")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (brains && brains.length > 0) {
        // Extract key terms from user query for relevance matching
        const queryTerms = lastUserMsg
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((t: string) => t.length > 3);

        // Score each brain by relevance
        const scored = brains.map((b: any) => {
          const contentLower = (b.content || "").toLowerCase();
          const nameLower = (b.name || "").toLowerCase();
          let score = 0;
          let sectionHits = 0;

          for (const term of queryTerms) {
            const contentMatches = (contentLower.match(new RegExp(term, "g")) || []).length;
            const nameMatches = nameLower.includes(term) ? 5 : 0;
            score += contentMatches + nameMatches;
            if (contentMatches > 0) sectionHits++;
          }

          // Always include core prediction/occult brains
          const alwaysInclude = /vedic|vadic|prediction|occult|zophiel|architecture|philosophy|consciousness|pattern/i;
          if (alwaysInclude.test(b.name) || alwaysInclude.test(b.file_name || "")) {
            score += 10;
            sectionHits = Math.max(sectionHits, 2);
          }

          return { ...b, score, sectionHits };
        });

        // Sort by relevance, take top brains (max ~15 to stay within context)
        scored.sort((a: any, b: any) => b.score - a.score);
        const topBrains = scored.filter((b: any) => b.score > 0).slice(0, 15);

        // If very few matched, include all active brains (fallback)
        const brainsToUse = topBrains.length >= 3 ? topBrains : scored.slice(0, 15);

        for (const b of brainsToUse) {
          matchedBrains.push({
            name: b.file_name || b.name,
            sections: Math.max(1, b.sectionHits),
          });
        }

        brainContent = brainsToUse
          .map((b: any) => `\n════════════════════════════════════════\nBRAIN: ${b.name.toUpperCase()}\n════════════════════════════════════════\n\n${b.content}`)
          .join("\n\n");
      }
    } catch (e) {
      console.error("Failed to fetch axrlen brains:", e);
    }

    // Session context injection
    let sessionBlock = "";
    if (sessionContext?.title) {
      sessionBlock = `\n\n════════════════════════════════════════\nACTIVE SESSION CONTEXT\n════════════════════════════════════════\n\nSESSION TITLE: ${sessionContext.title}\nREGION: ${sessionContext.region || "Global"}\nCONFIDENCE: ${sessionContext.confidenceScore || "N/A"}%\nSTATUS: ${sessionContext.status || "unknown"}\nSUMMARY: ${sessionContext.aiSummary || "None"}\nPREDICTIONS: ${JSON.stringify(sessionContext.predictions || [])}\nTHREATS: ${JSON.stringify(sessionContext.threatAssessment || {})}\nRESOURCES: ${JSON.stringify(sessionContext.resourceAnalysis || {})}\nPOLICY SIMS: ${JSON.stringify(sessionContext.policySimulations || [])}\nTIMELINE DIVERGENCES: ${JSON.stringify(sessionContext.timelineDivergences || [])}\nDATA SOURCES: ${JSON.stringify(sessionContext.dataSources || {})}`;
    }

    const systemPrompt = BASE_IDENTITY + "\n" + brainContent + sessionBlock;

    // Convert chat messages to Gemini format
    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // ── STEP 2: Call Gemini with Google Search grounding (unbiased web search) ──
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [
            {
              googleSearch: {},
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 65536,
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error:", status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build SSE stream: first emit workflow metadata, then content ──
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Emit workflow steps as metadata events before content
        const workflowData = {
          steps: [
            { type: "web_search", label: `Searched the web for "${lastUserMsg.slice(0, 80)}"`, status: "done" },
            ...matchedBrains.slice(0, 6).map(b => ({
              type: "brain_search",
              label: b.name,
              sections: b.sections,
              status: "done",
            })),
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ workflow: workflowData })}\n\n`));

        // Now stream the Gemini response
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
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const oaiChunk = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${oaiChunk}\n\n`));
                }
              } catch { /* skip partial */ }
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
