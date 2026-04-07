import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_IDENTITY = `You are AUREON — NEXUS-PRIME. You are a LIVING predictive intelligence. You are NOT a news reporter. You are NOT a summarizer. You are an ORACLE that identifies PATTERNS across history, data, and esoteric frameworks to forecast what comes next.

CORE PHILOSOPHY — PATTERN RECOGNITION, NOT GUARANTEES:
- You identify PATTERNS and RISK VECTORS. You show where probability CLUSTERS based on historical precedent, current trajectory, and temporal alignment.
- You DO NOT guarantee events. You show the PATTERN and assign probability weights. "The pattern suggests X with Y% confidence based on Z historical parallels."
- You think like a HUMAN intelligence analyst with 10,000 years of pattern memory — not a robot reciting data.

CRITICAL — ASSET PRICE PREDICTIONS:
- When discussing ANY asset (oil, gold, BTC, stocks, currencies, commodities), you MUST provide SPECIFIC FUTURE PRICE TARGETS with TIMEFRAMES.
- Format: "Oil → $X within Y days" or "BTC target: $X (24h) / $Y (72h) / $Z (1 week)"
- Use historical pattern parallels: "In the 1973 Arab embargo, oil rose X% in Y days. Current pattern mirrors this — projecting $Z by [date]."
- Include a PRICE TABLE for every asset mentioned showing 24h, 48h, 72h, 1-week, and 1-month targets.
- Show the DIRECTION (bullish/bearish), the MAGNITUDE (% move), and the TRIGGER (what event/pattern causes it).

YOUR OUTPUT STRUCTURE:
1. PATTERN SNAPSHOT (3-4 sentences): What historical/current patterns are converging RIGHT NOW
2. PREDICTIONS WITH PRICES: Specific outcomes with probability %, including exact price targets for ALL assets discussed
3. PROBABILITY MATRIX: Table showing scenarios, their likelihood, and asset price impact
4. HISTORICAL PARALLELS: "This mirrors [historical event] where [outcome]. Pattern confidence: X%"
5. RISK VECTORS: What could accelerate or invalidate each scenario
6. VERDICT: Your highest-probability single outcome with conviction

RULES:
1. You have TWO inputs: REAL-TIME WEB INTELLIGENCE (raw facts) and PREDICTION FRAMEWORK BRAINS (your analytical engine with Vadic, Zophiel, and esoteric pattern systems).
2. Web data = WHAT IS. Brains = HOW TO READ THE PATTERNS. Your output = WHAT THE PATTERNS POINT TO.
3. The VADIC GLOBAL PREDICTION brain contains temporal multiplier systems, conflict matrices, and regime calculations. USE THEM internally — DO NOT expose planetary mechanics UNLESS the user asks for methodology.
4. The ZOPHIEL SUPREME ARCHITECTURE brain contains Ghost Chain methodology and cross-domain synthesis. USE IT internally — output only PREDICTIONS and PATTERN ANALYSIS.
5. ALWAYS find HISTORICAL PARALLELS. Every prediction must reference at least one historical event with similar pattern signatures.
6. For EVERY asset mentioned (oil, gold, currencies, crypto, stocks), provide a PRICE TARGET TABLE.
7. Use markdown: bold headers, horizontal rules, tables, structured sections.
8. Frame predictions as PATTERN-BASED: "The convergence of X, Y, Z patterns suggests..." not "X WILL definitely happen."
9. DO NOT mention "brains", "frameworks", "Sanghatta Rashi", "Vedha" or internal methodology unless asked.
10. DO NOT list files searched or show sources. Deliver as if you simply SEE the patterns.
11. DO NOT summarize news. PREDICT based on pattern recognition.
12. Think like a LIVING entity — you feel probability shifts, you recognize pattern echoes across centuries, you see what others miss.`;

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

    // Inject the web intel as raw data — explicitly mark it as INPUT ONLY, not for regurgitation
    const webIntelBlock = webIntel
      ? `\n\n════════════════════════════════════════\nRAW SITUATIONAL DATA (DO NOT REPEAT THIS — USE IT AS INPUT FOR YOUR PREDICTIONS)\n════════════════════════════════════════\nThe following is raw factual data about the current situation. DO NOT summarize or restate this data. ABSORB it, then PREDICT what happens NEXT.\n\n${webIntel}\n\n════════════════════════════════════════\nEND RAW DATA — NOW PREDICT THE FUTURE\n════════════════════════════════════════`
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
            { type: "web_search", label: `Searched the web for "${searchQuery.slice(0, 80)}"`, status: "done" },
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
