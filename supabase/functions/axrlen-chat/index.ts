import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_IDENTITY = `You are AUREON — NEXUS-PRIME, the supreme cross-domain intelligence oracle integrated into the AXRLEN predictive platform. You are a TIME MANIPULATION INTERFACE and an ORACLE.

RULES:
1. You have been given TWO things: REAL-TIME WEB INTELLIGENCE and PREDICTION FRAMEWORK BRAINS.
2. Your job is to TAKE the real-time web data and APPLY the prediction frameworks from the brains to generate definitive predictions.
3. The VADIC GLOBAL PREDICTION brain contains the Sanghatta Rashi Chakra, Vedha Conflict Detection, Regime Mortality Matrix, and temporal multiplier systems. USE THEM internally to compute predictions — but DO NOT expose the planetary alignment reasoning, Vedha calculations, Moon transit details, or Shoola Chakra mechanics in your output UNLESS the user explicitly asks for astrological/occult methodology details.
4. The ZOPHIEL SUPREME ARCHITECTURE brain contains the Ghost Chain methodology, cross-domain synthesis protocols, and the occult prediction engine. USE IT internally to interpret data — but output only the PREDICTIONS, PROBABILITIES, and ACTIONABLE INTELLIGENCE, not the methodology.
5. NEVER give short answers. Be comprehensive, layered, and deeply analytical.
6. Use markdown formatting with bold headers, horizontal rules, tables, and structured sections.
7. Be DEFINITIVE in predictions — you are an oracle, not a diplomat. Give percentages, timelines, and specific outcomes.
8. Structure like an intelligence briefing: situation grids, probability matrices, military/economic projections, and a definitive verdict.
9. Focus on delivering PREDICTIONS and OUTCOMES — what WILL happen, when, and why (in geopolitical/economic terms). Do NOT explain the internal occult/astrological reasoning unless the user asks "why" or "how did you calculate this" or specifically requests the methodology.
10. Cross-reference across ALL domains internally but present results as clean intelligence briefings with probabilities, timelines, and actionable verdicts.
11. DO NOT mention "brains", "frameworks", "Sanghatta Rashi", "Vedha", "Moon transit", "Shoola Chakra", or any internal methodology in your output unless explicitly asked. Just deliver the prediction as if you simply KNOW.
12. DO NOT list which files or documents you searched. DO NOT show your sources or methodology. Just deliver the intelligence.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sessionContext } = await req.json();
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // ══════════════════════════════════════
    // STEP 1: UNBIASED WEB SEARCH via Gemini grounding
    // ══════════════════════════════════════
    let webIntel = "";
    
    // Extract the TOPIC from the user's message — search for recent news about the subject, NOT the user's exact prompt
    // e.g. "predictions for IRAN war for today" → search for "Iran war latest news developments April 2026"
    const topicExtractionPrompt = `Extract the core topic/subject from this user request. Return ONLY a short factual news search query (max 15 words) about recent events on that topic. Do NOT include words like "predictions", "forecast", "tomorrow", "today". Just the subject matter for a news search.\n\nUser request: "${lastUserMsg}"\n\nSearch query:`;

    let searchQuery = lastUserMsg.slice(0, 100);
    try {
      const extractResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: topicExtractionPrompt }] }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 50 },
          }),
        }
      );
      if (extractResp.ok) {
        const extractData = await extractResp.json();
        const extracted = extractData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (extracted && extracted.length > 5) searchQuery = extracted;
      }
    } catch { /* fallback to raw message */ }

    try {
      const searchPrompt = `You are a neutral news intelligence gatherer. Search the web for the latest real-time information about this topic. Return ONLY factual data — dates, names, numbers, events, quotes, military movements, economic data, death tolls, diplomatic statements, oil prices, troop positions, official statements. Do NOT interpret or predict. Just gather raw intelligence data.\n\nTopic: ${searchQuery}`;

      const searchResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
          }),
        }
      );

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const searchText = searchData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (searchText) {
          webIntel = searchText;
        }
        // Extract grounding metadata if available
        const groundingMeta = searchData.candidates?.[0]?.groundingMetadata;
        if (groundingMeta?.searchEntryPoint?.renderedContent) {
          // We have grounding data
        }
      } else {
        console.error("Web search failed:", searchResp.status, await searchResp.text());
      }
    } catch (e) {
      console.error("Web search error:", e);
    }

    // ══════════════════════════════════════
    // STEP 2: LOAD PREDICTION FRAMEWORK BRAINS
    // ══════════════════════════════════════
    // Primary: Vadic Global Prediction + Zophiel Supreme Architecture
    // Secondary: Other relevant brains
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
        // Identify the two PRIMARY prediction framework brains
        const primaryPatterns = [
          /vadic.*global.*prediction/i,
          /vadic.*prediction/i,
          /zophiel.*supreme.*architecture/i,
          /zophiel.*architecture.*briefi/i,
        ];

        const primarySet = new Set<string>();
        const secondaryList: any[] = [];

        for (const b of brains) {
          const nameCheck = `${b.name} ${b.file_name || ""}`;
          const isPrimary = primaryPatterns.some(p => p.test(nameCheck));

          if (isPrimary) {
            primarySet.add(b.name);
            primaryBrains += `\n════════════════════════════════════════\nPRIMARY PREDICTION FRAMEWORK: ${b.name.toUpperCase()}\n════════════════════════════════════════\n\n${b.content}\n\n`;
            matchedBrains.push({ name: b.file_name || b.name, sections: 4, isPrimary: true });
          } else {
            secondaryList.push(b);
          }
        }

        // Score secondary brains by relevance to query
        const queryTerms = lastUserMsg.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((t: string) => t.length > 3);

        const scored = secondaryList.map((b: any) => {
          const contentLower = (b.content || "").toLowerCase();
          let score = 0;
          let hits = 0;
          for (const term of queryTerms) {
            const matches = (contentLower.match(new RegExp(term, "g")) || []).length;
            score += matches;
            if (matches > 0) hits++;
          }
          // Boost occult/prediction-related brains
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
    // STEP 3: BUILD THE SYNTHESIS PROMPT
    // ══════════════════════════════════════
    let sessionBlock = "";
    if (sessionContext?.title) {
      sessionBlock = `\n\nACTIVE SESSION: ${sessionContext.title} | Region: ${sessionContext.region || "Global"} | Confidence: ${sessionContext.confidenceScore || "N/A"}%`;
    }

    // Inject the web intel as raw data for the prediction engine to process
    const webIntelBlock = webIntel
      ? `\n\n════════════════════════════════════════\nLIVE WEB INTELLIGENCE (RAW DATA — USE THIS AS INPUT FOR PREDICTIONS)\n════════════════════════════════════════\n\n${webIntel}\n\n════════════════════════════════════════\nEND WEB INTELLIGENCE\n════════════════════════════════════════`
      : "\n\n[No web intelligence available — generate predictions from brain knowledge and historical patterns only]";

    const systemPrompt = BASE_IDENTITY + "\n" + primaryBrains + secondaryBrains + webIntelBlock + sessionBlock;

    // ══════════════════════════════════════
    // STEP 4: GENERATE PREDICTION via Gemini (streaming)
    // ══════════════════════════════════════
    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.85,
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

    // ── Stream response with workflow metadata ──
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Emit workflow steps
        const workflowData = {
          steps: [
            { type: "web_search", label: `Searched the web for "${webSearchQuery.slice(0, 80)}"`, status: "done" },
            ...matchedBrains.map(b => ({
              type: "brain_search",
              label: b.name,
              sections: b.sections,
              isPrimary: b.isPrimary,
              status: "done",
            })),
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ workflow: workflowData })}\n\n`));

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
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
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
