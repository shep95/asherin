import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Free public APIs (no keys needed) ──────────────────────────────────
const APIS = {
  // GDELT - Global event monitoring (real-time conflict, protest, disaster tracking)
  gdelt_events: "https://api.gdeltproject.org/api/v2/doc/doc?query=",
  gdelt_geo: "https://api.gdeltproject.org/api/v2/geo/geo?query=",
  gdelt_tv: "https://api.gdeltproject.org/api/v2/tv/tv?query=",
  
  // World Bank - Economic indicators
  worldbank: "https://api.worldbank.org/v2/country/",
  
  // IMF - Fiscal & monetary data
  imf: "https://www.imf.org/external/datamapper/api/v1/",
  
  // USGS - Earthquake / seismic activity
  usgs_quakes: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50&orderby=time",
  
  // Open-Meteo - Weather & climate (no key)
  weather: "https://api.open-meteo.com/v1/forecast",
  
  // ReliefWeb - Humanitarian crises
  reliefweb: "https://api.reliefweb.int/v1/reports?appname=axrlen&limit=20",
  
  // Treasury Fiscal Data
  treasury: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/",
  
  // ACLED proxy via ReliefWeb for conflict data
  conflict_news: "https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20protest%20OR%20coup&mode=artlist&maxrecords=50&format=json",
  
  // NASA DONKI - Space weather / solar activity
  nasa_donki: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate=",
};

async function fetchJson(url: string, timeout = 8000): Promise<any> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── Data fetchers ──────────────────────────────────────────────────────

async function fetchGDELTEvents(region: string) {
  const q = encodeURIComponent(region);
  const [articles, geo] = await Promise.all([
    fetchJson(`${APIS.gdelt_events}${q}&mode=artlist&maxrecords=30&format=json`),
    fetchJson(`${APIS.gdelt_geo}${q}&mode=PointData&format=GeoJSON&maxpoints=100`),
  ]);
  return { articles: articles?.articles || [], geoPoints: geo?.features || [] };
}

async function fetchWorldBankIndicators(countryCode: string) {
  const indicators = [
    "NY.GDP.MKTP.KD.ZG", // GDP growth
    "FP.CPI.TOTL.ZG",     // Inflation
    "SL.UEM.TOTL.ZS",     // Unemployment
    "GC.DOD.TOTL.GD.ZS",  // Govt debt % GDP
    "BN.CAB.XOKA.GD.ZS",  // Current account balance
    "SP.POP.GROW",         // Population growth
  ];
  const results: Record<string, any> = {};
  const fetches = indicators.map(async (ind) => {
    const data = await fetchJson(`${APIS.worldbank}${countryCode}/indicator/${ind}?format=json&per_page=5&date=2020:2025`);
    if (data?.[1]) results[ind] = data[1];
  });
  await Promise.all(fetches);
  return results;
}

async function fetchIMFData(countryCode: string) {
  const datasets = ["NGDP_RPCH", "PCPIPCH", "GG_DEBT_GDP", "BCA_NGDPD"];
  const results: Record<string, any> = {};
  const fetches = datasets.map(async (ds) => {
    const data = await fetchJson(`${APIS.imf}${ds}/${countryCode}`);
    if (data?.values) results[ds] = data.values;
  });
  await Promise.all(fetches);
  return results;
}

async function fetchSeismicData() {
  return await fetchJson(APIS.usgs_quakes) || { features: [] };
}

async function fetchSolarActivity() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 86400000);
  const startStr = start.toISOString().split("T")[0];
  return await fetchJson(`${APIS.nasa_donki}${startStr}`) || [];
}

async function fetchReliefWebCrises(region: string) {
  const url = `${APIS.reliefweb}&filter[field]=country.name&filter[value]=${encodeURIComponent(region)}&sort[]=date:desc`;
  return await fetchJson(url) || { data: [] };
}

async function fetchConflictEvents() {
  return await fetchJson(APIS.conflict_news) || { articles: [] };
}

async function fetchWeatherExtremes(lat: number, lon: number) {
  const url = `${APIS.weather}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=14`;
  return await fetchJson(url);
}

async function fetchTreasuryData() {
  const [debt, revenue] = await Promise.all([
    fetchJson(`${APIS.treasury}v2/accounting/od/debt_to_penny?fields=tot_pub_debt_out_amt,record_date&sort=-record_date&page[size]=5`),
    fetchJson(`${APIS.treasury}v1/accounting/mts/mts_table_1?fields=record_date,current_month_net,current_fytd_net&sort=-record_date&page[size]=12`),
  ]);
  return { debt: debt?.data || [], revenue: revenue?.data || [] };
}

// ── Region mapping ─────────────────────────────────────────────────────

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
  "global": { code: "WLD", lat: 0, lon: 0 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { region = "global", predictionType = "comprehensive", sessionId } = await req.json();
    const regionLower = region.toLowerCase();
    const regionInfo = REGION_MAP[regionLower] || REGION_MAP["global"];

    // Fetch all data sources in parallel
    const [gdelt, worldBank, imf, seismic, solar, reliefWeb, conflicts, weather, treasury] = await Promise.all([
      fetchGDELTEvents(region),
      fetchWorldBankIndicators(regionInfo.code),
      fetchIMFData(regionInfo.code),
      fetchSeismicData(),
      fetchSolarActivity(),
      fetchReliefWebCrises(region),
      fetchConflictEvents(),
      regionInfo.lat !== 0 ? fetchWeatherExtremes(regionInfo.lat, regionInfo.lon) : null,
      regionInfo.code === "US" ? fetchTreasuryData() : null,
    ]);

    // Build data context for AI analysis
    const dataContext = {
      region,
      countryCode: regionInfo.code,
      gdeltArticles: gdelt.articles.slice(0, 15).map((a: any) => ({
        title: a.title, url: a.url, source: a.source?.domain, date: a.seendate,
        tone: a.tone, language: a.language,
      })),
      gdeltGeoPoints: gdelt.geoPoints.length,
      worldBankIndicators: Object.entries(worldBank).map(([key, vals]: [string, any]) => ({
        indicator: key,
        latest: vals?.[0] ? { value: vals[0].value, date: vals[0].date } : null,
      })),
      imfProjections: Object.entries(imf).map(([key, vals]: [string, any]) => ({
        dataset: key, values: vals,
      })),
      recentEarthquakes: seismic.features?.slice(0, 10).map((f: any) => ({
        magnitude: f.properties?.mag, place: f.properties?.place,
        time: f.properties?.time, tsunami: f.properties?.tsunami,
      })) || [],
      solarFlares: Array.isArray(solar) ? solar.slice(0, 5).map((f: any) => ({
        beginTime: f.beginTime, peakTime: f.peakTime, classType: f.classType,
      })) : [],
      humanitarianReports: reliefWeb.data?.slice(0, 10).map((r: any) => ({
        title: r.fields?.title, date: r.fields?.date?.created,
        country: r.fields?.country?.[0]?.name, source: r.fields?.source?.[0]?.name,
      })) || [],
      conflictArticles: conflicts.articles?.slice(0, 10).map((a: any) => ({
        title: a.title, url: a.url, source: a.source?.domain, date: a.seendate,
      })) || [],
      weatherForecast: weather?.daily ? {
        maxTemps: weather.daily.temperature_2m_max,
        minTemps: weather.daily.temperature_2m_min,
        precipitation: weather.daily.precipitation_sum,
        windSpeed: weather.daily.windspeed_10m_max,
      } : null,
      treasuryData: treasury,
      fetchedAt: new Date().toISOString(),
    };

    const sourceCount = [
      gdelt.articles.length > 0,
      Object.keys(worldBank).length > 0,
      Object.keys(imf).length > 0,
      seismic.features?.length > 0,
      Array.isArray(solar) && solar.length > 0,
      reliefWeb.data?.length > 0,
      conflicts.articles?.length > 0,
      weather !== null,
      treasury !== null,
    ].filter(Boolean).length;

    // ── AI Analysis via Gemini ──────────────────────────────────────────
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    const systemPrompt = `You are AXRLEN, an elite global event prediction and policy simulation engine integrated into the AUREON intelligence platform. You analyze real-time data from multiple verified sources to generate actionable geopolitical, economic, and security predictions.

CRITICAL RULES:
1. ALL predictions must be grounded in the provided live data — NEVER fabricate events, names, or statistics.
2. Use probabilistic language (e.g., "73% probability", "high likelihood based on X indicators").
3. Cite specific data points from the provided context to justify each prediction.
4. Predictions must include timeframes (24h, 48h, 7d, 30d, 90d, 180d).
5. Include confidence scores (0-100) for each prediction based on data quality and signal strength.
6. For resource analysis, use actual economic indicators from World Bank/IMF data.
7. Policy simulations must reference real economic models and historical precedents.
8. Timeline divergences should identify specific inflection points where outcomes branch.

You must return VALID JSON with this exact structure:
{
  "predictions": [
    {
      "id": "pred_1",
      "category": "security|economic|political|humanitarian|environmental|technological",
      "title": "string",
      "description": "string (detailed analysis)",
      "probability": number (0-100),
      "timeframe": "24h|48h|7d|30d|90d|180d",
      "severity": "critical|high|medium|low",
      "confidence": number (0-100),
      "dataPoints": ["string array of supporting evidence"],
      "historicalPrecedent": "string (similar past events)",
      "recommendedAction": "string"
    }
  ],
  "resourceAnalysis": {
    "economicHealth": number (0-100),
    "foodSecurity": number (0-100),
    "energySecurity": number (0-100),
    "waterStress": number (0-100),
    "infrastructureResilience": number (0-100),
    "indicators": [
      { "name": "string", "value": "string", "trend": "improving|stable|declining|critical", "source": "string" }
    ]
  },
  "threatAssessment": {
    "overallThreatLevel": "critical|elevated|guarded|low",
    "vectors": [
      {
        "type": "military|cyber|economic|social|environmental",
        "description": "string",
        "probability": number,
        "timeToImpact": "string",
        "mitigationOptions": ["string"]
      }
    ]
  },
  "policySimulations": [
    {
      "id": "pol_1",
      "policy": "string (proposed policy/action)",
      "projectedOutcome": "string",
      "riskLevel": "high|medium|low",
      "timeToEffect": "string",
      "sideEffects": ["string"],
      "historicalAnalog": "string",
      "confidenceInOutcome": number (0-100)
    }
  ],
  "timelineDivergences": [
    {
      "id": "div_1",
      "inflectionPoint": "string (what triggers the divergence)",
      "branchA": { "description": "string", "probability": number },
      "branchB": { "description": "string", "probability": number },
      "criticalDate": "string",
      "keyIndicators": ["string (what to watch for)"]
    }
  ],
  "executiveSummary": "string (2-3 paragraph comprehensive assessment)",
  "confidenceScore": number (overall 0-100),
  "dataSources": { "total": number, "verified": number, "categories": ["string"] }
}`;

    const userPrompt = `Analyze the following LIVE DATA for region: ${region} (${regionInfo.code})
Prediction type: ${predictionType}
Data sources active: ${sourceCount}

=== LIVE INTELLIGENCE DATA ===
${JSON.stringify(dataContext, null, 2)}

Generate a comprehensive prediction report with all fields populated. Ground every prediction in the actual data provided above. If data for a category is sparse, note this in the confidence score.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", geminiResp.status, errText);
      throw new Error(`AI analysis failed: ${geminiResp.status}`);
    }

    const geminiData = await geminiResp.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let analysis: any;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // Save to database if sessionId provided
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
      meta: {
        region,
        countryCode: regionInfo.code,
        sourcesQueried: sourceCount,
        fetchedAt: dataContext.fetchedAt,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("axrlen-analyze error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
