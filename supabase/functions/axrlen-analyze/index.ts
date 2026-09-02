import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { retiredSurfaceResponse } from "../_shared/retiredSurfaces.ts";
import { nexusPrimeCore, AXRLEN_SPECIFICITY_ADDENDUM } from "../_shared/axrlenSystemPrompt.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// ── News & Topic-Relevant Sources (no government/scientific APIs) ──────
const APIS = {
  // GDELT — the world's largest open news monitoring platform (250M+ articles)
  gdelt_news: "https://api.gdeltproject.org/api/v2/doc/doc?query=",
  gdelt_geo: "https://api.gdeltproject.org/api/v2/geo/geo?query=",
  gdelt_tv: "https://api.gdeltproject.org/api/v2/tv/tv?query=",
  // GDELT Context — trending themes and narratives
  gdelt_context: "https://api.gdeltproject.org/api/v2/context/context?query=",
  // WikiMedia — recent current events from Wikipedia
  wiki_current: "https://en.wikipedia.org/w/api.php?action=parse&page=Portal:Current_events&prop=text&format=json",
  // EventRegistry — global event tracking (free tier)
  event_registry: "https://eventregistry.org/api/v1/article/getArticles",
};

async function fetchJson(url: string, timeout = 10000): Promise<any> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── GDELT News Intelligence (primary source) ──────────────────────────

async function fetchGDELTNews(topic: string, mode: string = "artlist") {
  const q = encodeURIComponent(topic);
  const url = `${APIS.gdelt_news}${q}&mode=${mode}&maxrecords=75&format=json&sort=DateDesc&timespan=7d`;
  return await fetchJson(url) || { articles: [] };
}

async function fetchGDELTToneAnalysis(topic: string) {
  const q = encodeURIComponent(topic);
  const url = `${APIS.gdelt_news}${q}&mode=ToneChart&format=json&timespan=30d`;
  return await fetchJson(url) || {};
}

async function fetchGDELTTimeline(topic: string) {
  const q = encodeURIComponent(topic);
  const url = `${APIS.gdelt_news}${q}&mode=TimelineVolInfo&format=json&timespan=30d`;
  return await fetchJson(url) || {};
}

async function fetchGDELTGeo(topic: string) {
  const q = encodeURIComponent(topic);
  const url = `${APIS.gdelt_geo}${q}&mode=PointData&format=GeoJSON&maxpoints=200&timespan=7d`;
  return await fetchJson(url) || { features: [] };
}

async function fetchGDELTTVMentions(topic: string) {
  const q = encodeURIComponent(topic);
  const url = `${APIS.gdelt_tv}${q}&mode=TimelineVol&format=json&last24=yes`;
  return await fetchJson(url) || {};
}

// ── Topic-Specific News Searches ──────────────────────────────────────

async function fetchConflictNews(region: string) {
  const q = encodeURIComponent(`${region} (conflict OR war OR military OR attack OR strike OR bombing)`);
  return await fetchJson(`${APIS.gdelt_news}${q}&mode=artlist&maxrecords=30&format=json&sort=DateDesc&timespan=7d`) || { articles: [] };
}

async function fetchEconomicNews(region: string) {
  const q = encodeURIComponent(`${region} (economy OR recession OR inflation OR market OR trade OR sanctions OR GDP)`);
  return await fetchJson(`${APIS.gdelt_news}${q}&mode=artlist&maxrecords=30&format=json&sort=DateDesc&timespan=7d`) || { articles: [] };
}

async function fetchPoliticalNews(region: string) {
  const q = encodeURIComponent(`${region} (election OR government OR president OR prime minister OR parliament OR coup OR protest OR regime)`);
  return await fetchJson(`${APIS.gdelt_news}${q}&mode=artlist&maxrecords=30&format=json&sort=DateDesc&timespan=7d`) || { articles: [] };
}

async function fetchTechNews(region: string) {
  const q = encodeURIComponent(`${region} (technology OR AI OR cyber OR hack OR surveillance OR drone OR nuclear)`);
  return await fetchJson(`${APIS.gdelt_news}${q}&mode=artlist&maxrecords=20&format=json&sort=DateDesc&timespan=7d`) || { articles: [] };
}

async function fetchCrisisNews(region: string) {
  const q = encodeURIComponent(`${region} (crisis OR disaster OR humanitarian OR famine OR refugees OR epidemic)`);
  return await fetchJson(`${APIS.gdelt_news}${q}&mode=artlist&maxrecords=20&format=json&sort=DateDesc&timespan=7d`) || { articles: [] };
}

async function fetchWikiCurrentEvents() {
  const data = await fetchJson(APIS.wiki_current);
  if (!data?.parse?.text?.["*"]) return null;
  // Extract plain text from the HTML (crude but effective)
  const html = data.parse.text["*"];
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 5000);
  return stripped;
}

// ── Helper: extract article data ──────────────────────────────────────

function extractArticles(data: any, limit = 20) {
  return (data?.articles || []).slice(0, limit).map((a: any) => ({
    title: a.title,
    url: a.url,
    source: a.source?.domain || a.domain || "unknown",
    date: a.seendate || a.dateadded,
    tone: a.tone,
    language: a.language,
    socialImage: a.socialimage,
  }));
}

const REGION_MAP: Record<string, { code: string; lat: number; lon: number }> = {
  "united states": { code: "US", lat: 38.9, lon: -77.0 },
  "usa": { code: "US", lat: 38.9, lon: -77.0 },
  "china": { code: "CN", lat: 39.9, lon: 116.4 },
  "russia": { code: "RU", lat: 55.75, lon: 37.6 },
  "india": { code: "IN", lat: 28.6, lon: 77.2 },
  "brazil": { code: "BR", lat: -15.8, lon: -47.9 },
  "germany": { code: "DE", lat: 52.5, lon: 13.4 },
  "france": { code: "FR", lat: 48.9, lon: 2.3 },
  "united kingdom": { code: "GB", lat: 51.5, lon: -0.1 },
  "uk": { code: "GB", lat: 51.5, lon: -0.1 },
  "japan": { code: "JP", lat: 35.7, lon: 139.7 },
  "south korea": { code: "KR", lat: 37.6, lon: 127.0 },
  "mexico": { code: "MX", lat: 19.4, lon: -99.1 },
  "nigeria": { code: "NG", lat: 9.1, lon: 7.5 },
  "south africa": { code: "ZA", lat: -25.7, lon: 28.2 },
  "egypt": { code: "EG", lat: 30.0, lon: 31.2 },
  "turkey": { code: "TR", lat: 39.9, lon: 32.9 },
  "iran": { code: "IR", lat: 35.7, lon: 51.4 },
  "saudi arabia": { code: "SA", lat: 24.7, lon: 46.7 },
  "australia": { code: "AU", lat: -33.9, lon: 151.2 },
  "indonesia": { code: "ID", lat: -6.2, lon: 106.8 },
  "pakistan": { code: "PK", lat: 33.7, lon: 73.0 },
  "peru": { code: "PE", lat: -12.0, lon: -77.0 },
  "canada": { code: "CA", lat: 45.4, lon: -75.7 },
  "ukraine": { code: "UA", lat: 50.4, lon: 30.5 },
  "israel": { code: "IL", lat: 31.8, lon: 35.2 },
  "palestine": { code: "PS", lat: 31.9, lon: 35.2 },
  "taiwan": { code: "TW", lat: 25.0, lon: 121.5 },
  "north korea": { code: "KP", lat: 39.0, lon: 125.8 },
  "syria": { code: "SY", lat: 33.5, lon: 36.3 },
  "global": { code: "WLD", lat: 0, lon: 0 },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const retired = retiredSurfaceResponse(req, "axrlen");
  if (retired) return retired;

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
    const { region = "global", predictionType = "comprehensive", sessionId } = await req.json();
    const regionLower = region.toLowerCase();
    const regionInfo = REGION_MAP[regionLower] || REGION_MAP["global"];
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // ── Parallel news intelligence gathering ──────────────────────────
    const [
      generalNews,
      conflictNews,
      economicNews,
      politicalNews,
      techNews,
      crisisNews,
      toneAnalysis,
      timeline,
      geoData,
      tvMentions,
      wikiEvents,
    ] = await Promise.all([
      fetchGDELTNews(region),
      fetchConflictNews(region),
      fetchEconomicNews(region),
      fetchPoliticalNews(region),
      fetchTechNews(region),
      fetchCrisisNews(region),
      fetchGDELTToneAnalysis(region),
      fetchGDELTTimeline(region),
      fetchGDELTGeo(region),
      fetchGDELTTVMentions(region),
      fetchWikiCurrentEvents(),
    ]);

    const dataContext = {
      region,
      countryCode: regionInfo.code,
      todaysDate: today,

      // General breaking news
      breakingNews: extractArticles(generalNews, 25),

      // Topic-specific intelligence feeds
      conflictIntelligence: extractArticles(conflictNews, 15),
      economicIntelligence: extractArticles(economicNews, 15),
      politicalIntelligence: extractArticles(politicalNews, 15),
      technologyIntelligence: extractArticles(techNews, 10),
      crisisIntelligence: extractArticles(crisisNews, 10),

      // Sentiment & narrative analysis
      mediaToneAnalysis: toneAnalysis,
      coverageTimeline: timeline,

      // Geographic spread of news events
      geoSpread: {
        totalPoints: geoData?.features?.length || 0,
        hotspots: (geoData?.features || []).slice(0, 20).map((f: any) => ({
          name: f.properties?.name,
          type: f.properties?.type,
          count: f.properties?.count,
          lat: f.geometry?.coordinates?.[1],
          lon: f.geometry?.coordinates?.[0],
        })),
      },

      // TV news broadcast mentions (last 24h)
      tvBroadcastMentions: tvMentions,

      // Wikipedia current events summary
      wikiCurrentEvents: wikiEvents?.slice(0, 3000) || null,

      // Source metadata
      fetchedAt: new Date().toISOString(),
      sourceTypes: ["GDELT Global News (250M+ articles)", "GDELT TV Broadcast Monitoring", "GDELT Tone & Sentiment", "GDELT Geographic Intelligence", "Wikipedia Current Events"],
    };

    const sourceCount = [
      (generalNews?.articles?.length || 0) > 0,
      (conflictNews?.articles?.length || 0) > 0,
      (economicNews?.articles?.length || 0) > 0,
      (politicalNews?.articles?.length || 0) > 0,
      (techNews?.articles?.length || 0) > 0,
      (crisisNews?.articles?.length || 0) > 0,
      toneAnalysis && Object.keys(toneAnalysis).length > 0,
      timeline && Object.keys(timeline).length > 0,
      (geoData?.features?.length || 0) > 0,
      tvMentions && Object.keys(tvMentions).length > 0,
      wikiEvents !== null,
    ].filter(Boolean).length;

    // AXRLEN admin key takes priority — dedicated Gemini key just for AXRLEN
    // admins, so their traffic never touches Lovable AI credits or the shared
    // platform Gemini key. Falls back to the platform keys if unset.
    const GEMINI_KEY =
      Deno.env.get("AXRLEN_GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY_APP");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_KEY && !LOVABLE_KEY) throw new Error("No AI key configured (AXRLEN_GEMINI_API_KEY / GEMINI_API_KEY / LOVABLE_API_KEY)");

    // Shared NEXUS-PRIME doctrine (identical to the inline axrlenBridge core)
    // + this endpoint's structured JSON output contract.
    const systemPrompt = nexusPrimeCore(today) + AXRLEN_SPECIFICITY_ADDENDUM + `

═══════════════════════════════════════════════════════════════
OUTPUT CONTRACT — STRUCTURED JSON (this endpoint only)
═══════════════════════════════════════════════════════════════

Return VALID JSON with this exact structure:
{
  "predictions": [
    {
      "id": "pred_1",
      "category": "security|economic|political|humanitarian|environmental|technological|informational",
      "title": "string",
      "description": "string (detailed multi-domain analysis citing specific news sources)",
      "probability": number,
      "timeframe": "24h|48h|7d|30d|90d|180d",
      "severity": "critical|high|medium|low",
      "confidence": number,
      "dataPoints": ["string array citing specific headlines, outlets, and dates from live news"],
      "newsSources": ["string array of outlets"],
      "mediaTone": "string",
      "historicalPrecedent": "string",
      "structuralAnalysis": "string (institutional, logistical and economic mechanics behind the call)",
      "timingWindow": "string (the exact scheduled dates inside the horizon that drive the timing)",
      "warStrategy": "string",
      "temporalMultiplier": "string (1x/10x/50x/100x with justification)",
      "actorIncentive": "string (what the named actor gains or loses, and why they move)",
      "publicSentiment": "string (measured opinion / narrative state, with source)",
      "recommendedAction": "string"
    }
  ],
  "resourceAnalysis": {
    "economicHealth": number, "foodSecurity": number, "energySecurity": number, "waterStress": number, "infrastructureResilience": number,
    "indicators": [{ "name": "string", "value": "string", "trend": "improving|stable|declining|critical", "source": "string" }]
  },
  "threatAssessment": {
    "overallThreatLevel": "critical|elevated|guarded|low",
    "vectors": [{
      "type": "military|cyber|economic|social|environmental|political|informational",
      "description": "string", "probability": number, "timeToImpact": "string",
      "mitigationOptions": ["string"], "keyNewsSources": ["string"],
      "actorIncentive": "string", "leadingIndicator": "string"
    }]
  },
  "narrativeAnalysis": {
    "dominantNarratives": ["string"], "narrativeShifts": ["string"],
    "mediaBias": "string", "informationGaps": ["string"], "propagandaSignals": ["string"]
  },
  "policySimulations": [{
    "id": "pol_1", "policy": "string", "projectedOutcome": "string",
    "riskLevel": "high|medium|low", "timeToEffect": "string", "sideEffects": ["string"],
    "historicalAnalog": "string", "philosophicalBasis": "string", "confidenceInOutcome": number
  }],
  "timelineDivergences": [{
    "id": "div_1", "inflectionPoint": "string",
    "branchA": { "description": "string", "probability": number },
    "branchB": { "description": "string", "probability": number },
    "criticalDate": "string", "keyIndicators": ["string"],
    "structuralTrigger": "string", "decisionWindow": "string"
  }],
  "executiveSummary": "string (3-4 paragraphs)",
  "confidenceScore": number,
  "dataSources": { "total": number, "verified": number, "categories": ["string"], "topOutlets": ["string"] }
}`;

    const userPrompt = `Analyze the following LIVE INTELLIGENCE for region: ${region} (${regionInfo.code})
Prediction type: ${predictionType}
Today's date: ${today}
News sources active: ${sourceCount}

=== LIVE NEWS INTELLIGENCE FEED ===
${JSON.stringify(dataContext, null, 2)}

Generate a comprehensive NEXUS-PRIME prediction report. FUSE ALL 30+ domains through the 4-layer architecture:

LAYER 0 (News Intelligence): Ground EVERY prediction in the live news data above. Cite specific headlines, outlets, and dates.
LAYER 1 (Empirical Timing): Use the real scheduled calendar inside the horizon — elections, central-bank meetings, budget/treaty deadlines, expiries, harvest and mobilisation windows. Name exact dates. Do NOT use astrology, numerology or any occult timing framework.
LAYER 2 (Pattern Synthesis): Cross-reference base rates, history, ideology as a political variable, war strategy, philosophy, geopolitics, game theory.
LAYER 3 (Probability Weighting): Apply domain weight × signal strength × temporal multiplier. Anchor to the historical base rate for the reference class, then justify every departure from it.

CRITICAL: Name specific news outlets and cite specific dates. Every claim must be traceable to the evidence above or to a stated historical base rate. Never fabricate a source or a statistic.`;

    let rawText = "{}";
    let geminiFailed = false;
    if (GEMINI_KEY) {
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 65536,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!geminiResp.ok) {
        const errText = await geminiResp.text();
        console.error("Gemini error:", geminiResp.status, errText);
        if (LOVABLE_KEY) {
          geminiFailed = true; // fall through to Lovable AI Gateway
        } else {
          throw new Error(`AI analysis failed: ${geminiResp.status}`);
        }
      } else {
        const geminiData = await geminiResp.json();
        rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      }
    }
    if ((!GEMINI_KEY || geminiFailed) && LOVABLE_KEY) {
      // Lovable AI Gateway fallback
      const lovResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-flash-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });
      if (!lovResp.ok) {
        const errText = await lovResp.text();
        console.error("Lovable AI error:", lovResp.status, errText);
        if (lovResp.status === 429) throw new Error("AI rate limit — try again shortly.");
        if (lovResp.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
        throw new Error(`AI analysis failed: ${lovResp.status}`);
      }
      const lovData = await lovResp.json();
      rawText = lovData.choices?.[0]?.message?.content || "{}";
    }


    
    let analysis: any;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    if (sessionId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      await sb.from("axrlen_sessions").update({
        status: "complete",
        predictions: analysis.predictions,
        resource_analysis: analysis.resourceAnalysis,
        threat_assessment: analysis.threatAssessment,
        policy_simulations: analysis.policySimulations,
        timeline_divergences: analysis.timelineDivergences,
        data_sources: analysis.dataSources,
        confidence_score: analysis.confidenceScore,
        ai_summary: analysis.executiveSummary,
      }).eq("id", sessionId);
    }

    return new Response(JSON.stringify({
      success: true,
      analysis,
      meta: { sourceCount, region, predictionType, fetchedAt: dataContext.fetchedAt },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("axrlen-analyze error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
