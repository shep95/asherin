import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

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
    const { messages, sessionContext } = await req.json();
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    const OPENAI_HEADERS = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const compact = (value: string, max = 12000) => value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;

    // ── Helper: extract aggregated text from a /v1/responses payload ──
    const extractResponsesText = (data: any): string => {
      if (typeof data?.output_text === "string" && data.output_text.length > 0) {
        return data.output_text;
      }
      const out: string[] = [];
      for (const item of data?.output ?? []) {
        for (const c of item?.content ?? []) {
          if (typeof c?.text === "string") out.push(c.text);
          else if (typeof c?.text?.value === "string") out.push(c.text.value);
        }
      }
      return out.join("\n");
    };

    // ══════════════════════════════════════
    // STEP 1: EXTRACT TOPIC + IDENTIFY SIDES (local heuristics; avoids extra OpenAI calls)
    // ══════════════════════════════════════
    const actorNames = [
      "United States", "America", "NATO", "European Union", "United Kingdom", "Russia", "Ukraine", "China", "Taiwan",
      "Israel", "Iran", "Hamas", "Hezbollah", "Saudi Arabia", "India", "Pakistan", "North Korea", "South Korea",
      "Japan", "Peru", "Brazil", "Mexico", "Venezuela", "Turkey", "Syria", "Yemen", "Egypt", "France", "Germany",
    ];
    const cleanQuery = lastUserMsg
      .replace(/\b(predict|forecast|scenario|scenarios|what happens|will|going to|tell me|analyze|analysis)\b/gi, " ")
      .replace(/[^\p{L}\p{N}\s$.-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    let searchQuery = (cleanQuery || lastUserMsg).slice(0, 140);
    const mentionedActors = actorNames.filter((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lastUserMsg));
    let sideA = mentionedActors[0] || "";
    let sideB = mentionedActors.find((name) => name !== sideA) || "";
    let otherParties = mentionedActors.slice(2).join(", ") || "none";

    // ══════════════════════════════════════
    // STEP 2: DUAL-SIDE WEB INTELLIGENCE (OpenAI Responses API + web_search)
    // ══════════════════════════════════════
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

    const runWebSearch = async (prompt: string): Promise<string> => {
      try {
        const resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: OPENAI_HEADERS,
          body: JSON.stringify({
            model: "gpt-4o-mini",
            tools: [{ type: "web_search" }],
            input: prompt,
          }),
        });
        if (!resp.ok) {
          console.error("OpenAI web_search error:", resp.status, await resp.text());
          return "";
        }
        const data = await resp.json();
        return extractResponsesText(data);
      } catch (e) {
        console.error("OpenAI web_search exception:", e);
        return "";
      }
    };

    const searchPromises: Promise<void>[] = [];

    if (sideA) {
      searchPromises.push((async () => {
        sideAIntel = await runWebSearch(buildSearchPrompt(`${sideA} (Western/allied)`, searchQuery));
      })());
    }

    if (sideB) {
      searchPromises.push((async () => {
        sideBIntel = await runWebSearch(buildSearchPrompt(`${sideB} (opposing party/regional)`, searchQuery));
      })());
    }

    searchPromises.push((async () => {
      const neutralPerspective = otherParties && otherParties !== "none"
        ? `neutral international sources, UN, and ${otherParties}`
        : "neutral international sources (Reuters, AP, AFP, Al Jazeera English, BBC World, UN)";
      neutralIntel = await runWebSearch(buildSearchPrompt(neutralPerspective, searchQuery));
    })());

    if (!sideA && !sideB) {
      searchPromises.push((async () => {
        sideAIntel = await runWebSearch(
          `You are a neutral news intelligence gatherer. Search the web for the latest real-time information about this topic from a minimum of 15 distinct trusted sources across multiple countries and perspectives. Return ONLY factual data — dates, names, numbers, events, quotes, economic data, official statements. Label each with source type. Do NOT interpret or predict.\n\nTopic: ${searchQuery}`
        );
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
    // STEP 5: GENERATE PREDICTION via OpenAI (streaming)
    // ══════════════════════════════════════
    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: OPENAI_HEADERS,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        temperature: 0.85,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI API error:", status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Stream response with workflow metadata ──
    // OpenAI already emits SSE in `choices[0].delta.content` shape, which is
    // exactly what the frontend expects — pass it through verbatim after the
    // workflow header chunk.
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
                const text = parsed.choices?.[0]?.delta?.content;
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
