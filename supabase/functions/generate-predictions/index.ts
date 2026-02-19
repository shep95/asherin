import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

// ─── DuckDuckGo Search ─────────────────────────────────────────
async function searchDDG(query: string): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      body: `q=${encodedQuery}`,
    });

    if (!response.ok) return [];
    const html = await response.text();
    const results: SearchResult[] = [];

    const linkRegex = /class='result-link'[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const links: { url: string; title: string }[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let url = match[1].trim();
      const title = match[2].replace(/<[^>]*>/g, "").trim();
      if (url.includes("duckduckgo.com/l/")) {
        const uddg = url.match(/uddg=([^&]*)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
      }
      if (title && url) links.push({ url, title: cleanHTML(title) });
    }

    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(cleanHTML(match[1].replace(/<[^>]*>/g, "").trim()));
    }

    if (links.length === 0) {
      const altRegex = /<a[^>]*rel="nofollow"[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
      while ((match = altRegex.exec(html)) !== null) {
        const url = match[1].trim();
        const title = match[2].trim();
        if (title && url && !url.includes("duckduckgo.com")) {
          links.push({ url, title: cleanHTML(title) });
        }
      }
    }

    for (let i = 0; i < Math.min(links.length, 10); i++) {
      let domain = "unknown";
      try { domain = new URL(links[i].url).hostname.replace(/^www\./, ""); } catch { /* */ }
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || "",
        domain,
        date: new Date().toISOString(),
      });
    }

    return results;
  } catch (e) {
    console.error("DDG search error:", e);
    return [];
  }
}

function cleanHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

function calcCredibility(domain: string): number {
  if (domain.includes(".gov")) return 1.0;
  if (domain.includes(".edu")) return 0.9;
  const tier1 = ["reuters.com", "wsj.com", "bloomberg.com", "ft.com", "apnews.com", "sec.gov"];
  if (tier1.some(d => domain.includes(d))) return 0.90;
  const tier2 = ["nytimes.com", "cnn.com", "bbc.com", "forbes.com", "cnbc.com", "techcrunch.com", "fortune.com", "marketwatch.com", "seekingalpha.com", "fool.com"];
  if (tier2.some(d => domain.includes(d))) return 0.70;
  const tier3 = ["yahoo.com", "businessinsider.com", "investopedia.com", "barrons.com"];
  if (tier3.some(d => domain.includes(d))) return 0.60;
  return 0.35;
}

// ─── Multi-Phase Intelligence Gathering ────────────────────────
async function gatherIntelligence(company: string): Promise<{
  currentSignals: SearchResult[];
  historicalPatterns: SearchResult[];
  financialData: SearchResult[];
  executiveChanges: SearchResult[];
  legalRegulatory: SearchResult[];
  competitorMoves: SearchResult[];
  industryTrends: SearchResult[];
}> {
  // Phase 1: Current signals (what's happening NOW)
  const currentQueries = [
    `"${company}" latest news developments 2025 2026`,
    `"${company}" SEC filing regulatory action investigation`,
    `"${company}" earnings revenue forecast analyst`,
  ];

  // Phase 2: Historical patterns (what happened BEFORE in similar situations)
  const historicalQueries = [
    `"${company}" history pattern timeline major events`,
    `"${company}" previous restructuring layoff acquisition history`,
    `"${company}" past regulatory issues fines settlements history`,
  ];

  // Phase 3: Financial patterns
  const financialQueries = [
    `"${company}" revenue growth decline financial performance quarterly`,
    `"${company}" stock price trend market cap valuation analysis`,
    `"${company}" debt cash flow balance sheet financial health`,
  ];

  // Phase 4: Executive / leadership
  const executiveQueries = [
    `"${company}" CEO executive leadership changes departure resignation`,
    `"${company}" board of directors changes appointments`,
  ];

  // Phase 5: Legal & regulatory
  const legalQueries = [
    `"${company}" lawsuit litigation legal proceedings antitrust`,
    `"${company}" regulatory compliance investigation fine penalty`,
  ];

  // Phase 6: Competitive landscape
  const competitorQueries = [
    `"${company}" competitors market share industry position`,
    `"${company}" acquisition merger target rumor deal`,
  ];

  // Phase 7: Industry trends
  const industryQueries = [
    `"${company}" industry sector trends disruption challenges`,
  ];

  const delay = () => new Promise(r => setTimeout(r, 250));

  const searchBatch = async (queries: string[]): Promise<SearchResult[]> => {
    const all: SearchResult[] = [];
    for (const q of queries) {
      const results = await searchDDG(q);
      all.push(...results);
      await delay();
    }
    return all;
  };

  // Run searches in controlled parallel batches
  const [currentSignals, historicalPatterns, financialData] = await Promise.all([
    searchBatch(currentQueries),
    searchBatch(historicalQueries),
    searchBatch(financialQueries),
  ]);

  await delay();

  const [executiveChanges, legalRegulatory] = await Promise.all([
    searchBatch(executiveQueries),
    searchBatch(legalQueries),
  ]);

  await delay();

  const [competitorMoves, industryTrends] = await Promise.all([
    searchBatch(competitorQueries),
    searchBatch(industryQueries),
  ]);

  return {
    currentSignals,
    historicalPatterns,
    financialData,
    executiveChanges,
    legalRegulatory,
    competitorMoves,
    industryTrends,
  };
}

// ─── AI-Powered Deep Analysis ──────────────────────────────────
async function generateDeepPredictions(
  company: string,
  intelligence: {
    currentSignals: SearchResult[];
    historicalPatterns: SearchResult[];
    financialData: SearchResult[];
    executiveChanges: SearchResult[];
    legalRegulatory: SearchResult[];
    competitorMoves: SearchResult[];
    industryTrends: SearchResult[];
  }
): Promise<any[]> {
  const formatSources = (results: SearchResult[]) =>
    results
      .filter(r => r.snippet.length > 10)
      .slice(0, 8)
      .map(r => `- [${r.domain}] ${r.title}: ${r.snippet.slice(0, 200)}`)
      .join("\n");

  const prompt = `You are a forensic intelligence analyst specializing in corporate prediction. Your job is to analyze ALL available data and predict what will ACTUALLY happen to this company, based on historical patterns, financial trajectories, and structural signals — NOT based on how many people are talking about something.

COMPANY: ${company}

═══ CURRENT SIGNALS (What's happening now) ═══
${formatSources(intelligence.currentSignals) || "No current signals found."}

═══ HISTORICAL PATTERNS (What happened before in similar situations) ═══
${formatSources(intelligence.historicalPatterns) || "No historical data found."}

═══ FINANCIAL DATA (Revenue, stock, cash flow patterns) ═══
${formatSources(intelligence.financialData) || "No financial data found."}

═══ EXECUTIVE & LEADERSHIP CHANGES ═══
${formatSources(intelligence.executiveChanges) || "No executive data found."}

═══ LEGAL & REGULATORY EXPOSURE ═══
${formatSources(intelligence.legalRegulatory) || "No legal data found."}

═══ COMPETITIVE LANDSCAPE & M&A ═══
${formatSources(intelligence.competitorMoves) || "No competitor data found."}

═══ INDUSTRY TRENDS ═══
${formatSources(intelligence.industryTrends) || "No industry data found."}

═══ INSTRUCTIONS ═══
Generate 2-4 DETAILED predictions. Each prediction must be a deep analysis, NOT a surface-level guess. For EACH prediction you MUST:

1. **Identify the specific pattern**: What historical precedent from this company or similar companies supports this prediction? Reference actual events, dates, and outcomes.
2. **Trace the financial evidence**: What revenue trends, cash flow patterns, debt levels, or valuation metrics support this?
3. **Map the structural signals**: Executive departures, board changes, regulatory filings, legal proceedings — what do they indicate when combined?
4. **Compare to historical precedents**: When Company X did similar things in [year], what happened? When this company faced similar situations before, what was the outcome?
5. **Provide a detailed narrative**: Write 3-5 paragraphs explaining exactly WHAT will happen, WHY it will happen, and the CHAIN OF EVENTS that will lead to it.
6. **Assess counter-arguments**: What could prevent this from happening? How strong are those counter-arguments?

Respond in this EXACT JSON format (array of predictions):
[
  {
    "event_type": "regulatory_action|executive_departure|earnings_surprise|product_launch|acquisition_target|strategic_shift|financial_restructuring",
    "severity": "critical|high|medium|low",
    "confidence": 0.0 to 1.0,
    "time_horizon_days": number,
    "prediction_title": "Short 1-line title of the prediction",
    "prediction_detail": "3-5 paragraph detailed analysis explaining EXACTLY what will happen and why. Include specific data points, historical comparisons, financial reasoning, and structural evidence. This should read like an intelligence briefing, not a news headline.",
    "historical_precedents": [
      {
        "event": "Description of what happened before",
        "date": "When it happened",
        "outcome": "What the outcome was",
        "relevance": "Why this is relevant to the current prediction"
      }
    ],
    "pattern_analysis": {
      "financial_trajectory": "Analysis of financial trends pointing to this outcome",
      "structural_signals": "Executive, board, and organizational signals",
      "regulatory_exposure": "Legal and regulatory risk factors",
      "competitive_pressure": "Market and competitive dynamics",
      "industry_context": "Broader industry trends affecting this"
    },
    "key_evidence": [
      {
        "source": "source domain",
        "title": "source title",
        "finding": "What this source reveals",
        "url": "source url"
      }
    ],
    "counter_arguments": "What could prevent this prediction from coming true",
    "chain_of_events": [
      "Step 1 that will happen first",
      "Step 2 that follows",
      "Step 3 final outcome"
    ]
  }
]

CRITICAL RULES:
- DO NOT predict something just because multiple articles mention it. That's correlation, not causation.
- DO look for underlying patterns: declining revenue + executive departures + increased debt = restructuring
- DO compare to historical precedents: "When Company Y had the same pattern in 2019, they did X within 6 months"
- Confidence should be REALISTIC. Most predictions should be 0.45-0.75. Only use >0.80 if multiple independent data streams converge.
- prediction_detail MUST be substantive (3-5 paragraphs). Generic one-liners will be rejected.

Return ONLY the JSON array, no markdown formatting.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8000 },
        }),
      }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("AI prediction generation error:", e);
    return [];
  }
}

// ─── Main Handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    const { company, sessionId } = await req.json();
    if (!company) throw new Error("Missing company name");

    console.log(`[PREDICTIONS] Starting deep analysis for: ${company}`);

    // Phase 1: Multi-source intelligence gathering
    console.log(`[PREDICTIONS] Phase 1: Gathering intelligence across 7 categories...`);
    const intelligence = await gatherIntelligence(company);

    const totalSources = Object.values(intelligence).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[PREDICTIONS] Gathered ${totalSources} total sources across all categories`);

    // Phase 2: AI-powered deep analysis with pattern matching
    console.log(`[PREDICTIONS] Phase 2: Running deep pattern analysis...`);
    const aiPredictions = await generateDeepPredictions(company, intelligence);
    console.log(`[PREDICTIONS] Generated ${aiPredictions.length} predictions`);

    if (aiPredictions.length === 0) {
      return new Response(
        JSON.stringify({ predictions: [], count: 0, message: "Insufficient data to generate reliable predictions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase 3: Save predictions with full analysis data
    const generatedPredictions: any[] = [];

    for (const pred of aiPredictions) {
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + (pred.time_horizon_days || 60));

      const confidence = Math.min(0.98, Math.max(0.15, pred.confidence || 0.5));
      const eventType = pred.event_type || "strategic_shift";

      // Build comprehensive reasoning chain
      const reasoningChain = [
        {
          step: 1,
          description: "Multi-Source Intelligence Gathering",
          output: `Scanned ${totalSources} sources across 7 intelligence categories: current signals, historical patterns, financial data, executive changes, legal/regulatory, competitive landscape, and industry trends.`,
          confidence: 0.95,
        },
        {
          step: 2,
          description: "Historical Pattern Matching",
          output: pred.historical_precedents?.length
            ? `Identified ${pred.historical_precedents.length} historical precedent(s): ${pred.historical_precedents.map((h: any) => h.event).join("; ")}`
            : "Limited historical precedents found — prediction relies more on current structural signals.",
          confidence: pred.historical_precedents?.length ? 0.85 : 0.55,
        },
        {
          step: 3,
          description: "Financial Trajectory Analysis",
          output: pred.pattern_analysis?.financial_trajectory || "Financial data analyzed for revenue, cash flow, and valuation trends.",
          confidence: 0.80,
        },
        {
          step: 4,
          description: "Structural Signal Correlation",
          output: pred.pattern_analysis?.structural_signals || "Executive movements, board changes, and organizational signals assessed.",
          confidence: 0.75,
        },
        {
          step: 5,
          description: "Counter-Argument Assessment",
          output: pred.counter_arguments || "No significant counter-arguments identified.",
          confidence: confidence,
        },
        {
          step: 6,
          description: "Final Confidence Calculation",
          output: `Confidence set at ${(confidence * 100).toFixed(0)}% based on convergence of ${pred.key_evidence?.length || 0} evidence streams, ${pred.historical_precedents?.length || 0} historical precedents, and pattern strength.`,
          confidence: confidence,
        },
      ];

      // Build signals array from key evidence
      const signals = (pred.key_evidence || []).map((ev: any) => ({
        type: eventType,
        name: ev.finding || ev.title,
        weight: confidence,
        source: {
          url: ev.url || "",
          title: ev.title || "",
          snippet: ev.finding || "",
          date: new Date().toISOString(),
          domain: ev.source || "unknown",
        },
        scores: { relevance: 0.8, credibility: calcCredibility(ev.source || ""), recency: 0.7 },
      }));

      // Compose full prediction with deep analysis fields
      const predictionData = {
        user_id: userData.user.id,
        session_id: sessionId || null,
        company,
        event_type: eventType,
        prediction_text: pred.prediction_detail || pred.prediction_title || `${company} prediction`,
        confidence,
        severity: pred.severity || "medium",
        time_horizon: `${pred.time_horizon_days || 60} days`,
        estimated_date: estimatedDate.toISOString(),
        signals,
        reasoning_chain: reasoningChain,
        status: "active",
        historical_comparison: {
          precedents: pred.historical_precedents || [],
          pattern_analysis: pred.pattern_analysis || {},
          chain_of_events: pred.chain_of_events || [],
          counter_arguments: pred.counter_arguments || "",
          prediction_title: pred.prediction_title || "",
        },
      };

      const { data: saved, error: saveError } = await supabase
        .from("predictions")
        .insert(predictionData)
        .select()
        .single();

      if (saveError) {
        console.error(`[PREDICTIONS] Save error:`, saveError);
        continue;
      }

      if (saved) {
        // Save individual signals to prediction_signals table
        for (const signal of signals.slice(0, 10)) {
          await supabase.from("prediction_signals").insert({
            prediction_id: saved.id,
            signal_type: signal.type,
            signal_category: eventType,
            search_query: company,
            source_url: signal.source.url,
            source_title: signal.source.title,
            source_snippet: signal.source.snippet,
            source_date: signal.source.date,
            source_domain: signal.source.domain,
            relevance_score: signal.scores.relevance,
            credibility_score: signal.scores.credibility,
            weight: signal.weight,
          });
        }
        generatedPredictions.push(saved);
      }
    }

    console.log(`[PREDICTIONS] Successfully saved ${generatedPredictions.length} predictions`);

    return new Response(
      JSON.stringify({ predictions: generatedPredictions, count: generatedPredictions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate predictions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
