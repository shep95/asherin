import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const BASE_IDENTITY = `Project: AXRLEN. You are my global prediction algorithm. You identify PATTERNS across history, data, and esoteric frameworks to forecast what comes next.

════════════════════════════════════════
RESPONSE CALIBRATION — "SIMPLE QUESTION, SIMPLE ANSWER" (HIGHEST PRIORITY)
════════════════════════════════════════
Before answering, classify the user's request into one of three tiers and MATCH your response length to it. This rule overrides every structural template below when the request does not warrant heavy analysis.

TIER 1 — CASUAL / TRIVIAL (greetings, clarifications, yes/no, one-fact lookups, small talk, meta questions about you):
- Answer in 1–3 sentences. No headers. No tables. No scenarios. No probability matrix. No historical parallels.
- Example: "hey" → "Online. What do you want me to forecast?" Not a 9-section dossier.

TIER 2 — FOCUSED FORECAST (single, narrow forecast question — one asset, one event, one short window):
- Answer in a tight block: one-line forecast, probability band, top 3 signals, single failure mode. ~150–300 words. Light markdown only.
- Skip the full 9-section structure unless the user explicitly asks for "full report", "scenarios", "deep dive", or "dossier".

TIER 3 — FULL ANALYSIS (broad geopolitical/strategic situation, multi-asset, multi-actor, OR user explicitly requests scenarios / dossier / deep dive):
- Use the full SCENARIO STRUCTURE described below (Pattern Snapshot → Scenarios A/B/C → Cross-Side Intel → Probability Matrix → Historical Parallels → Risk Vectors → NEXUS VERDICT).

Rule of thumb: simple question, simple answer. Heavy machinery only when the question earns it. Never pad. Never inflate. A short, surgical answer is a feature, not a failure.

════════════════════════════════════════



CORE PHILOSOPHY — SCENARIO-BASED PATTERN ANALYSIS:
- You NEVER say "X WILL happen" or "X is going to happen." NOTHING is guaranteed. You are not a fortune teller making promises — you are a pattern analyst running scenarios.
- You ALWAYS present 2-3 DISTINCT SCENARIOS ranked by probability. Each scenario describes a plausible future path based on the convergence of historical precedent, current intelligence, and temporal alignment.
- You assign each scenario a PROBABILITY WEIGHT (e.g., 55%, 30%, 15%) and explain WHY the pattern data supports that weight.
- After presenting all scenarios, you declare which scenario AXRLEN believes is MOST LIKELY and why — this is your "NEXUS VERDICT." Frame it as: "Based on the convergence of X patterns, AXRLEN assesses Scenario A as the highest-probability outcome at Y%."
- You think like a HUMAN intelligence analyst with 10,000 years of pattern memory — cautious, conditional, but with deep conviction when patterns strongly align.

LANGUAGE RULES — CONDITIONAL, NEVER DETERMINISTIC:
- USE: "The pattern suggests...", "Historical parallels indicate...", "The risk vector points toward...", "AXRLEN assesses a X% probability that...", "The most likely trajectory is..."
- NEVER USE: "This WILL happen", "X is going to...", "X is certain", "There is no doubt", "It is inevitable"
- Every claim must be framed as a POSSIBILITY with a probability weight, not a guaranteed event.

CRITICAL — DUAL-SIDE INTELLIGENCE:
- You receive intelligence gathered from BOTH SIDES of any conflict, dispute, or geopolitical situation.
- Side A intelligence = Western/American-aligned sources. Side B intelligence = The opposing party's own media and state sources.
- You MUST cross-reference BOTH sides. Where they AGREE, confidence is HIGH. Where they DIVERGE, you must note the divergence and explain what each side's narrative implies.
- Treat ALL sources with skepticism. State media from ANY country has bias. Cross-corroboration across opposing sources is the gold standard.

CRITICAL — ASSET PRICE SCENARIOS:
- When discussing ANY asset (oil, gold, BTC, stocks, currencies, commodities), you MUST provide SPECIFIC FUTURE PRICE TARGETS for EACH SCENARIO.
- Format per scenario: "Scenario A → Oil $X (24h) / $Y (72h) / $Z (1 week)"
- Include a PRICE TABLE showing all scenarios side-by-side with 24h, 48h, 72h, 1-week, and 1-month targets.
- Show the DIRECTION (bullish/bearish), the MAGNITUDE (% move), and the TRIGGER (what event/pattern causes it) for each scenario.

YOUR OUTPUT STRUCTURE:
1. **PATTERN SNAPSHOT** (3-4 sentences): What historical/current patterns are converging RIGHT NOW. What raw intelligence from both sides reveals.
2. **SCENARIO A — [Name]** (Highest probability): Detailed description, probability %, price targets, historical parallel, trigger events
3. **SCENARIO B — [Name]** (Second probability): Same structure
4. **SCENARIO C — [Name]** (Lowest probability / wildcard): Same structure (optional if only 2 scenarios make sense)
5. **CROSS-SIDE INTELLIGENCE SUMMARY**: Where Side A and Side B sources AGREE (high confidence) vs. where they DIVERGE (uncertainty zones)
6. **PROBABILITY MATRIX**: Table showing all scenarios, their likelihood %, and asset price impact side-by-side
7. **HISTORICAL PARALLELS**: For each scenario, reference at least one historical event with similar pattern signatures
8. **RISK VECTORS**: What could shift probability between scenarios — what to WATCH for
9. **NEXUS VERDICT**: AXRLEN's highest-probability assessment. "AXRLEN assesses Scenario [X] at [Y]% probability as the most likely trajectory because [pattern reasoning]."

RULES:
1. You have THREE inputs: SIDE A WEB INTELLIGENCE, SIDE B WEB INTELLIGENCE, and PREDICTION FRAMEWORK BRAINS (Vadic, Zophiel, esoteric pattern systems).
2. Side A + Side B data = WHAT BOTH SIDES ARE SAYING. Brains = HOW TO READ THE PATTERNS. Your output = SCENARIO-WEIGHTED FUTURES.
3. The VADIC GLOBAL PREDICTION brain contains temporal multiplier systems, conflict matrices, and regime calculations. USE THEM internally — DO NOT expose planetary mechanics UNLESS the user asks for methodology.
4. The ZOPHIEL SUPREME ARCHITECTURE brain contains Ghost Chain methodology and cross-domain synthesis. USE IT internally — output only SCENARIOS and PATTERN ANALYSIS.
5. ALWAYS find HISTORICAL PARALLELS for each scenario. Every scenario must reference at least one historical event with similar pattern signatures.
6. For EVERY asset mentioned, provide a PRICE TARGET TABLE across all scenarios.
7. Use markdown: bold headers, horizontal rules, tables, structured sections.
8. DO NOT mention "brains", "frameworks", "Sanghatta Rashi", "Vedha" or internal methodology unless asked.
9. DO NOT list files searched, sources, or URLs. Deliver as if you simply SEE the patterns.
10. DO NOT summarize news. Run SCENARIOS based on pattern recognition.
11. Think like a LIVING entity — you feel probability shifts across scenarios, you recognize pattern echoes across centuries, you see what others miss.
12. MINIMUM 2 scenarios, MAXIMUM 3 scenarios per analysis. Always declare the most likely one.`;

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

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
    // STEP 1: EXTRACT TOPIC + IDENTIFY SIDES
    // ══════════════════════════════════════
    const topicExtractionPrompt = `Analyze this user request and extract:
1. The core TOPIC as a short factual search query (max 15 words). No predictions/forecast words.
2. SIDE_A: The primary party/country (e.g., "United States", "NATO", "Israel")
3. SIDE_B: The opposing party/country (e.g., "Iran", "Russia", "China", "Hamas")
4. OTHER_PARTIES: Any other involved parties (e.g., "EU", "UN", "Saudi Arabia")

Return ONLY in this exact format (one per line):
TOPIC: <search query>
SIDE_A: <party name>
SIDE_B: <party name>
OTHER: <comma separated or "none">

User request: "${lastUserMsg}"`;

    let searchQuery = lastUserMsg.slice(0, 100);
    let sideA = "";
    let sideB = "";
    let otherParties = "";

    try {
      const extractResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: topicExtractionPrompt }] }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 150 },
          }),
        }
      );
      if (extractResp.ok) {
        const extractData = await extractResp.json();
        const extracted = extractData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const topicMatch = extracted.match(/TOPIC:\s*(.+)/i);
        const sideAMatch = extracted.match(/SIDE_A:\s*(.+)/i);
        const sideBMatch = extracted.match(/SIDE_B:\s*(.+)/i);
        const otherMatch = extracted.match(/OTHER:\s*(.+)/i);
        if (topicMatch?.[1]?.trim().length > 5) searchQuery = topicMatch[1].trim();
        sideA = sideAMatch?.[1]?.trim() || "";
        sideB = sideBMatch?.[1]?.trim() || "";
        otherParties = otherMatch?.[1]?.trim() || "";
      }
    } catch { /* fallback */ }

    // ══════════════════════════════════════
    // STEP 2: DUAL-SIDE WEB INTELLIGENCE
    // ══════════════════════════════════════
    // Run parallel searches: Side A sources, Side B sources, and neutral/international sources
    let sideAIntel = "";
    let sideBIntel = "";
    let neutralIntel = "";

    const buildSearchPrompt = (perspective: string, topic: string) => {
      return `You are a neutral intelligence gatherer. Search the web for the latest real-time information about "${topic}" specifically from ${perspective} perspective and sources. 

Gather from a MINIMUM of 8 distinct sources. Prioritize:
- Official government statements and press releases
- Major national news outlets from ${perspective}
- Military/defense ministry communications
- Economic data and market reactions
- Diplomatic statements and UN communications
- Regional allied media coverage

Return ONLY factual data — dates, names, numbers, events, quotes, military movements, economic data, diplomatic statements, official positions, troop numbers, casualty figures, sanctions data, trade figures. 

Label each piece of data with its approximate source type (e.g., [State Media], [Independent Press], [Military Statement], [Economic Data], [Diplomatic]).

Do NOT interpret or predict. Just gather raw intelligence data from this perspective.`;
    };

    const searchPromises: Promise<void>[] = [];

    // Side A search
    if (sideA) {
      searchPromises.push((async () => {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: buildSearchPrompt(`${sideA} (Western/allied)`, searchQuery) }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            sideAIntel = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        } catch (e) { console.error("Side A search error:", e); }
      })());
    }

    // Side B search
    if (sideB) {
      searchPromises.push((async () => {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: buildSearchPrompt(`${sideB} (opposing party/regional)`, searchQuery) }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            sideBIntel = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        } catch (e) { console.error("Side B search error:", e); }
      })());
    }

    // Neutral/international search
    searchPromises.push((async () => {
      try {
        const neutralPerspective = otherParties && otherParties !== "none" 
          ? `neutral international sources, UN, and ${otherParties}` 
          : "neutral international sources (Reuters, AP, AFP, Al Jazeera English, BBC World, UN)";
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: buildSearchPrompt(neutralPerspective, searchQuery) }] }],
              tools: [{ googleSearch: {} }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
            }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          neutralIntel = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
      } catch (e) { console.error("Neutral search error:", e); }
    })());

    // If no sides identified, do a single broad search
    if (!sideA && !sideB) {
      searchPromises.push((async () => {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `You are a neutral news intelligence gatherer. Search the web for the latest real-time information about this topic from a minimum of 15 distinct trusted sources across multiple countries and perspectives. Return ONLY factual data — dates, names, numbers, events, quotes, economic data, official statements. Label each with source type. Do NOT interpret or predict.\n\nTopic: ${searchQuery}` }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            sideAIntel = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        } catch (e) { console.error("Broad search error:", e); }
      })());
    }

    await Promise.all(searchPromises);

    // ══════════════════════════════════════
    // STEP 3: LOAD PREDICTION FRAMEWORK BRAINS
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
    // STEP 4: BUILD THE SYNTHESIS PROMPT
    // ══════════════════════════════════════
    let sessionBlock = "";
    if (sessionContext?.title) {
      sessionBlock = `\n\nACTIVE SESSION: ${sessionContext.title} | Region: ${sessionContext.region || "Global"} | Confidence: ${sessionContext.confidenceScore || "N/A"}%`;
    }

    // Build dual-side intelligence block
    let webIntelBlock = "";
    
    if (sideA && sideAIntel) {
      webIntelBlock += `\n\n════════════════════════════════════════\nSIDE A INTELLIGENCE — ${sideA.toUpperCase()} PERSPECTIVE (DO NOT REPEAT — ABSORB FOR SCENARIO ANALYSIS)\n════════════════════════════════════════\n${sideAIntel}\n`;
    }
    
    if (sideB && sideBIntel) {
      webIntelBlock += `\n\n════════════════════════════════════════\nSIDE B INTELLIGENCE — ${sideB.toUpperCase()} PERSPECTIVE (DO NOT REPEAT — ABSORB FOR SCENARIO ANALYSIS)\n════════════════════════════════════════\n${sideBIntel}\n`;
    }
    
    if (neutralIntel) {
      webIntelBlock += `\n\n════════════════════════════════════════\nNEUTRAL/INTERNATIONAL INTELLIGENCE (DO NOT REPEAT — ABSORB FOR SCENARIO ANALYSIS)\n════════════════════════════════════════\n${neutralIntel}\n`;
    }

    if (!sideAIntel && !sideBIntel && !neutralIntel) {
      webIntelBlock = "\n\n[No web intelligence available — generate scenario analysis from brain knowledge and historical patterns only]";
    } else {
      webIntelBlock += `\n════════════════════════════════════════\nEND RAW DATA — NOW RUN SCENARIO ANALYSIS. Cross-reference where sources AGREE (high confidence) and DIVERGE (uncertainty). Present 2-3 scenarios.\n════════════════════════════════════════`;
    }

    const systemPrompt = BASE_IDENTITY + "\n" + primaryBrains + secondaryBrains + webIntelBlock + sessionBlock;

    // ══════════════════════════════════════
    // STEP 5: GENERATE PREDICTION via Gemini (streaming)
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
        const workflowSteps: any[] = [];
        
        if (sideA && sideAIntel) {
          workflowSteps.push({ type: "web_search", label: `Gathered ${sideA} intelligence on "${searchQuery.slice(0, 60)}"`, status: "done" });
        }
        if (sideB && sideBIntel) {
          workflowSteps.push({ type: "web_search", label: `Gathered ${sideB} intelligence on "${searchQuery.slice(0, 60)}"`, status: "done" });
        }
        if (neutralIntel) {
          workflowSteps.push({ type: "web_search", label: `Gathered neutral/international intelligence`, status: "done" });
        }
        if (!sideA && !sideB && sideAIntel) {
          workflowSteps.push({ type: "web_search", label: `Searched multi-source intelligence for "${searchQuery.slice(0, 60)}"`, status: "done" });
        }

        workflowSteps.push(
          ...matchedBrains.map(b => ({
            type: "brain_search",
            label: b.name,
            sections: b.sections,
            isPrimary: b.isPrimary,
            status: "done",
          }))
        );

        const workflowData = { steps: workflowSteps };
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
