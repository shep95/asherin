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

interface DetectedSignal {
  type: string;
  name: string;
  weight: number;
  query: string;
  source: { url: string; title: string; snippet: string; date: string; domain: string };
  scores: { relevance: number; credibility: number; recency: number };
  detectedAt: string;
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

    // Fallback parsing
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

    for (let i = 0; i < Math.min(links.length, 8); i++) {
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

// ─── Scoring Functions ─────────────────────────────────────────
function calcRelevance(result: SearchResult, keywords: string[]): number {
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  const matches = keywords.filter(k => text.includes(k.toLowerCase())).length;
  const titleMatches = keywords.filter(k => result.title.toLowerCase().includes(k.toLowerCase())).length;
  return Math.min(1, (matches * 0.1) + (titleMatches * 0.2) + 0.3);
}

function calcCredibility(domain: string): number {
  if (domain.includes(".gov")) return 1.0;
  if (domain.includes(".edu")) return 0.9;
  const high = ["reuters.com", "wsj.com", "bloomberg.com", "ft.com", "nytimes.com", "apnews.com"];
  if (high.some(d => domain.includes(d))) return 0.85;
  const med = ["cnn.com", "bbc.com", "forbes.com", "fortune.com", "techcrunch.com", "cnbc.com"];
  if (med.some(d => domain.includes(d))) return 0.65;
  return 0.4;
}

function calcRecency(dateString: string): number {
  const daysAgo = (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.exp(-daysAgo / 30));
}

function getSignalCategory(signalType: string): string {
  if (["cid_issuance", "congressional_hearing", "agency_statements", "whistleblower", "fcc_filings"].includes(signalType)) return "regulatory";
  if (["insider_sales", "linkedin_activity", "sentiment_analysis", "board_meetings", "board_changes"].includes(signalType)) return "personnel";
  if (["web_traffic", "hiring_velocity", "supplier_orders", "product_launches", "revenue_decline"].includes(signalType)) return "financial";
  if (["patent_filings", "leaks_rumors", "market_positioning", "advisor_hiring"].includes(signalType)) return "strategic";
  return "general";
}

// ─── Signal Detection ──────────────────────────────────────────
async function detectSignals(
  company: string,
  signalDefs: any[]
): Promise<DetectedSignal[]> {
  const allSignals: DetectedSignal[] = [];

  for (const def of signalDefs) {
    const queries = (def.search_queries as string[]).map(q => q.replace(/\{company\}/g, company));

    for (const query of queries.slice(0, 2)) {
      try {
        const results = await searchDDG(query);
        const companyLower = company.toLowerCase();
        const keywords = def.keywords as string[];

        for (const result of results) {
          const text = `${result.title} ${result.snippet}`.toLowerCase();
          if (!text.includes(companyLower)) continue;
          if (!keywords.some(k => text.includes(k.toLowerCase()))) continue;

          const relevance = calcRelevance(result, keywords);
          const credibility = calcCredibility(result.domain);
          const recency = calcRecency(result.date);

          if (relevance > 0.4 && credibility > 0.3) {
            allSignals.push({
              type: def.signal_type,
              name: def.signal_name,
              weight: Number(def.base_weight),
              query,
              source: { url: result.url, title: result.title, snippet: result.snippet, date: result.date, domain: result.domain },
              scores: { relevance, credibility, recency },
              detectedAt: new Date().toISOString(),
            });
          }
        }
        // Rate limit between searches
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`Signal detection error for query "${query}":`, e);
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return allSignals.filter(s => {
    if (seen.has(s.source.url)) return false;
    seen.add(s.source.url);
    return true;
  });
}

// ─── Confidence Calculation ────────────────────────────────────
function calcConfidence(signals: DetectedSignal[], eventType: string): number {
  if (signals.length === 0) return 0;

  const signalStrength = Math.min(1, signals.length / 5);
  const avgRelevance = signals.reduce((s, sig) => s + sig.scores.relevance, 0) / signals.length;
  const avgCredibility = signals.reduce((s, sig) => s + sig.scores.credibility, 0) / signals.length;
  const avgRecency = signals.reduce((s, sig) => s + sig.scores.recency, 0) / signals.length;

  const base = signalStrength * 0.30 + avgRelevance * 0.25 + avgCredibility * 0.20 + avgRecency * 0.15 + 0.10;

  const modifiers: Record<string, number> = {
    regulatory_action: 1.1, executive_departure: 0.9, earnings_surprise: 0.85,
    product_launch: 0.95, acquisition_target: 0.8,
  };

  return Math.min(0.98, Math.max(0.1, base * (modifiers[eventType] || 1.0)));
}

function determineSeverity(eventType: string, confidence: number): string {
  const baseSeverity: Record<string, string> = {
    regulatory_action: "critical", executive_departure: "high", earnings_surprise: "medium",
    product_launch: "low", acquisition_target: "high",
  };
  const base = baseSeverity[eventType] || "medium";
  if (confidence > 0.8 && base !== "critical") {
    const levels = ["low", "medium", "high", "critical"];
    const idx = levels.indexOf(base);
    return levels[Math.min(idx + 1, 3)];
  }
  return base;
}

// ─── AI Prediction Text ────────────────────────────────────────
async function generatePredictionText(
  company: string, eventType: string, signals: DetectedSignal[], confidence: number
): Promise<string> {
  const topSignals = signals.sort((a, b) => b.scores.relevance - a.scores.relevance).slice(0, 3);
  const prompt = `Generate a single professional prediction statement for intelligence analysts.

Company: ${company}
Event Type: ${eventType.replace(/_/g, " ")}
Confidence: ${(confidence * 100).toFixed(0)}%
Top Signals:
${topSignals.map(s => `• ${s.name}: ${s.source.title}`).join("\n")}

Requirements:
1. One sentence only, specific and actionable
2. Include timeframe estimate
3. Professional intelligence tone
4. No disclaimers or hedging language

Example: "NHTSA will likely issue formal recall order for Tesla Autopilot within 45 days based on escalating CID activity."

Generate prediction:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 150 },
        }),
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `${company} ${eventType.replace(/_/g, " ")} predicted with ${(confidence * 100).toFixed(0)}% confidence.`;
  } catch {
    return `${company} ${eventType.replace(/_/g, " ")} predicted with ${(confidence * 100).toFixed(0)}% confidence.`;
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

    console.log(`Generating predictions for: ${company}`);

    // Get signal definitions
    const { data: signalDefs } = await supabase
      .from("signal_definitions")
      .select("*")
      .eq("enabled", true);

    if (!signalDefs || signalDefs.length === 0) {
      return new Response(
        JSON.stringify({ predictions: [], count: 0, message: "No signal definitions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group definitions by event type
    const eventGroups = new Map<string, any[]>();
    for (const def of signalDefs) {
      const group = eventGroups.get(def.event_type) || [];
      group.push(def);
      eventGroups.set(def.event_type, group);
    }

    const generatedPredictions: any[] = [];

    for (const [eventType, defs] of eventGroups) {
      try {
        console.log(`Detecting signals for ${eventType}...`);
        const signals = await detectSignals(company, defs);
        console.log(`Found ${signals.length} signals for ${eventType}`);

        if (signals.length < 1) continue;

        const confidence = calcConfidence(signals, eventType);
        if (confidence < 0.3) continue;

        const severity = determineSeverity(eventType, confidence);
        const predictionText = await generatePredictionText(company, eventType, signals, confidence);

        const estimatedDays = eventType === "regulatory_action" ? 45 : eventType === "executive_departure" ? 90 : 60;
        const estimatedDate = new Date();
        estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

        const reasoningChain = [
          { step: 1, description: "Detect signals from web sources", output: `Found ${signals.length} relevant signals from ${new Set(signals.map(s => s.source.domain)).size} unique sources`, confidence: 0.95 },
          { step: 2, description: "Filter and score signals", output: `Kept ${signals.filter(s => s.scores.relevance > 0.5).length} high-quality signals after filtering`, confidence: 0.90 },
          { step: 3, description: "Calculate prediction confidence", output: `Final confidence: ${(confidence * 100).toFixed(0)}% based on signal strength, quality, and source credibility`, confidence },
          { step: 4, description: "Generate prediction statement", output: predictionText, confidence },
        ];

        const { data: saved } = await supabase
          .from("predictions")
          .insert({
            user_id: userData.user.id,
            session_id: sessionId || null,
            company,
            event_type: eventType,
            prediction_text: predictionText,
            confidence,
            severity,
            time_horizon: `${estimatedDays} days`,
            estimated_date: estimatedDate.toISOString(),
            signals: signals.map(s => ({ type: s.type, name: s.name, weight: s.weight, source: s.source, scores: s.scores })),
            reasoning_chain: reasoningChain,
            status: "active",
          })
          .select()
          .single();

        if (saved) {
          // Save individual signals
          for (const signal of signals) {
            await supabase.from("prediction_signals").insert({
              prediction_id: saved.id,
              signal_type: signal.type,
              signal_category: getSignalCategory(signal.type),
              search_query: signal.query,
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
      } catch (e) {
        console.error(`Error for ${eventType}:`, e);
      }
    }

    console.log(`Generated ${generatedPredictions.length} predictions`);

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
