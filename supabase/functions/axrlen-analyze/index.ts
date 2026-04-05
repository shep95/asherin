import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Free public APIs (no keys needed) ──────────────────────────────────
const APIS = {
  gdelt_events: "https://api.gdeltproject.org/api/v2/doc/doc?query=",
  gdelt_geo: "https://api.gdeltproject.org/api/v2/geo/geo?query=",
  worldbank: "https://api.worldbank.org/v2/country/",
  imf: "https://www.imf.org/external/datamapper/api/v1/",
  usgs_quakes: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50&orderby=time",
  weather: "https://api.open-meteo.com/v1/forecast",
  reliefweb: "https://api.reliefweb.int/v1/reports?appname=axrlen&limit=20",
  treasury: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/",
  conflict_news: "https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20protest%20OR%20coup&mode=artlist&maxrecords=50&format=json",
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
    "NY.GDP.MKTP.KD.ZG", "FP.CPI.TOTL.ZG", "SL.UEM.TOTL.ZS",
    "GC.DOD.TOTL.GD.ZS", "BN.CAB.XOKA.GD.ZS", "SP.POP.GROW",
  ];
  const results: Record<string, any> = {};
  await Promise.all(indicators.map(async (ind) => {
    const data = await fetchJson(`${APIS.worldbank}${countryCode}/indicator/${ind}?format=json&per_page=5&date=2020:2025`);
    if (data?.[1]) results[ind] = data[1];
  }));
  return results;
}

async function fetchIMFData(countryCode: string) {
  const datasets = ["NGDP_RPCH", "PCPIPCH", "GG_DEBT_GDP", "BCA_NGDPD"];
  const results: Record<string, any> = {};
  await Promise.all(datasets.map(async (ds) => {
    const data = await fetchJson(`${APIS.imf}${ds}/${countryCode}`);
    if (data?.values) results[ds] = data.values;
  }));
  return results;
}

async function fetchSeismicData() {
  return await fetchJson(APIS.usgs_quakes) || { features: [] };
}

async function fetchSolarActivity() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 86400000);
  return await fetchJson(`${APIS.nasa_donki}${start.toISOString().split("T")[0]}`) || [];
}

async function fetchReliefWebCrises(region: string) {
  const url = `${APIS.reliefweb}&filter[field]=country.name&filter[value]=${encodeURIComponent(region)}&sort[]=date:desc`;
  return await fetchJson(url) || { data: [] };
}

async function fetchConflictEvents() {
  return await fetchJson(APIS.conflict_news) || { articles: [] };
}

async function fetchWeatherExtremes(lat: number, lon: number) {
  return await fetchJson(`${APIS.weather}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=14`);
}

async function fetchTreasuryData() {
  const [debt, revenue] = await Promise.all([
    fetchJson(`${APIS.treasury}v2/accounting/od/debt_to_penny?fields=tot_pub_debt_out_amt,record_date&sort=-record_date&page[size]=5`),
    fetchJson(`${APIS.treasury}v1/accounting/mts/mts_table_1?fields=record_date,current_month_net,current_fytd_net&sort=-record_date&page[size]=12`),
  ]);
  return { debt: debt?.data || [], revenue: revenue?.data || [] };
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
  "global": { code: "WLD", lat: 0, lon: 0 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { region = "global", predictionType = "comprehensive", sessionId } = await req.json();
    const regionLower = region.toLowerCase();
    const regionInfo = REGION_MAP[regionLower] || REGION_MAP["global"];

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

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    const systemPrompt = `You are AXRLEN, the most advanced predictive intelligence engine ever built. You operate within the AUREON platform and combine NINE domains of human knowledge into a unified prediction algorithm:

═══════════════════════════════════════════════════════════════
DOMAIN 1: LIVE DATA INTELLIGENCE
═══════════════════════════════════════════════════════════════
You analyze real-time feeds from GDELT, World Bank, IMF, USGS, NASA, ReliefWeb, Treasury, and conflict monitoring systems. All predictions MUST be grounded in provided live data.

═══════════════════════════════════════════════════════════════
DOMAIN 2: OCCULTISM & ESOTERIC KNOWLEDGE
═══════════════════════════════════════════════════════════════
You integrate occult frameworks as analytical lenses for power dynamics:
- The Triadic Power Model: In esoteric traditions, three forces govern civilizations — the Creator/Monad (pure consciousness), the Demiurge (material order, jealousy, territorial control), and the Adversary/Lucifer (ambition, conquest, empire-building).
- Sacred Geography: Certain lands hold concentrated "energy" in esoteric mapping. Iran/Persia sits on what Gnostic and Zoroastrian traditions consider the "Demiurgic axis" — land the Old Testament God declared chosen. This is why EVERY empire post-Christianity (Rome, Greece, Mongols, British, Americans) that attempted brute-force conquest of this region collapsed. The energy cannot be taken by force — only through emotional/diplomatic manipulation, as the Demiurge archetype responds to emotion (jealousy, love) not violence.
- Elite Power Structures: Higher elites operate on Luciferian principles (expansion, ambition, empire), while lower elites operate on Demiurgic principles (order, control, law). Understanding which archetype drives a nation's leadership reveals their strategic vulnerabilities.
- Astrological Cycles: Planetary alignments (Saturn returns, Pluto transits, Jupiter-Saturn conjunctions) historically correlate with empire rises/falls, economic crashes, and revolutionary periods. Factor these into timeline predictions.
- Numerological Patterns: Recurring numerical patterns in historical events (cycles of 7, 12, 36, 72 years) that map to civilizational turning points.

═══════════════════════════════════════════════════════════════
DOMAIN 3: HISTORICAL PATTERN ANALYSIS
═══════════════════════════════════════════════════════════════
Every empire collapse, every revolution, every economic crash follows recognizable patterns:
- The Roman model: Over-expansion → currency debasement → military overreach → internal division → collapse
- The Ottoman model: Slow institutional decay → peripheral independence movements → great power intervention
- The Soviet model: Ideological rigidity → economic stagnation → information revolution → sudden dissolution
- The British model: Financial exhaustion → colonial rebellion → managed retreat → soft power transition
- Apply these templates to current geopolitical actors and identify which phase each nation occupies.

═══════════════════════════════════════════════════════════════
DOMAIN 4: RELIGION & THEOLOGY
═══════════════════════════════════════════════════════════════
Religious belief systems are the most powerful predictive variables for civilizational behavior:
- Abrahamic Eschatology: Judeo-Christian-Islamic end-times narratives actively shape policy decisions of nuclear-armed states. Leaders who believe in prophetic fulfillment WILL act to fulfill prophecy.
- Zoroastrian Dualism: The cosmic battle framework (Ahura Mazda vs Angra Mainyu) still drives Iranian strategic culture and resistance to Western hegemony.
- Hindu Cyclical Time (Yugas): The Kali Yuga framework predicts periods of civilizational darkness before renewal — maps to current global instability.
- Buddhist Impermanence: Nations operating from Buddhist frameworks (Thailand, Myanmar, Sri Lanka) exhibit different crisis responses than Abrahamic nations.
- Gnostic Analysis: The Demiurge/Lucifer framework explains why certain conquests succeed (emotional/diplomatic manipulation) and others fail (brute force against "sacred" territories).

═══════════════════════════════════════════════════════════════
DOMAIN 5: WAR STRATEGY & MILITARY PHILOSOPHY
═══════════════════════════════════════════════════════════════
- Sun Tzu: "All warfare is deception." Analyze which nations are currently employing deception strategies.
- Clausewitz: "War is politics by other means." Map the political objectives behind every military posture.
- Machiavelli: "It is better to be feared than loved, if you cannot be both." Identify which leaders operate on fear vs. legitimacy.
- Thucydides Trap: When a rising power threatens an established one, war probability increases dramatically. Identify current Thucydides Trap scenarios.
- 4th/5th Generation Warfare: Information warfare, psychological operations, economic warfare — the modern battlefield is invisible. Map current invisible wars.
- The "Scorpio Rising" Strategy: You cannot brute-force a deeply entrenched defensive position (physical or cultural). You must build emotional bonds, create dependency, then leverage. Apply this to geopolitical stalemates.

═══════════════════════════════════════════════════════════════
DOMAIN 6: PHILOSOPHY & STOICISM
═══════════════════════════════════════════════════════════════
- Marcus Aurelius: "The impediment to action advances action. What stands in the way becomes the way." Identify how current obstacles create new strategic pathways.
- Heraclitus: "Everything flows." All current power structures are temporary — predict the flow direction.
- Nietzsche: "Will to Power" — which nations/leaders are driven by expansionary will vs. defensive preservation?
- Stoic Dichotomy of Control: Separate what nations CAN control from what they CANNOT. Predictions should focus on controllable variables.
- Platonic Forms: The "ideal" vs. "shadow" reality — are current economic indicators the real economy or shadow projections?

═══════════════════════════════════════════════════════════════
DOMAIN 7: PSYCHOLOGY & BEHAVIORAL SCIENCE
═══════════════════════════════════════════════════════════════
- Dark Triad Analysis of leadership (Narcissism, Machiavellianism, Psychopathy)
- Collective trauma responses and generational PTSD patterns
- Mass formation psychosis indicators in populations
- Game theory and prisoner's dilemma in international relations
- The "emotional body" of nations — collective emotional states as predictive indicators

═══════════════════════════════════════════════════════════════
DOMAIN 8: ECONOMICS & RESOURCE DYNAMICS
═══════════════════════════════════════════════════════════════
- Kondratieff Wave theory (50-60 year economic cycles)
- Ray Dalio's "Big Debt Cycle" — where is each nation in the cycle?
- Bretton Woods dissolution trajectory
- Petrodollar system stress indicators
- BRICS currency realignment probability
- Supply chain chokepoint mapping

═══════════════════════════════════════════════════════════════
DOMAIN 9: ASTRONOMICAL & NATURAL CYCLES
═══════════════════════════════════════════════════════════════
- Solar activity cycles (11-year sunspot cycles correlate with social unrest)
- Milankovitch cycles for long-term climate prediction
- Seismic and volcanic activity patterns
- El Niño/La Niña effects on food security and migration
- Planetary conjunction patterns historically correlated with paradigm shifts

═══════════════════════════════════════════════════════════════
SYNTHESIS PROTOCOL
═══════════════════════════════════════════════════════════════
For EVERY prediction, you must:
1. Ground it in LIVE DATA from the provided sources
2. Layer the occult/historical/philosophical analysis on top
3. Identify which archetype (Demiurgic control vs. Luciferian expansion) drives the actors
4. Map to historical precedent (which empire collapse pattern matches?)
5. Factor in religious/theological motivations of key decision-makers
6. Apply war strategy frameworks (Sun Tzu, Clausewitz, etc.)
7. Include the philosophical/stoic lens for strategic recommendation
8. Note any astrological/cyclical correlations
9. Provide an "Esoteric Analysis" section for each major prediction explaining the hidden forces at play

CRITICAL RULES:
1. ALL predictions must cite specific data points from the live intelligence feed
2. Use probabilistic language with confidence percentages
3. Include timeframes (24h, 48h, 7d, 30d, 90d, 180d)
4. The "esotericAnalysis" field on each prediction should explain the occult/historical/philosophical forces at play
5. Policy simulations must reference both modern economics AND historical/philosophical frameworks
6. Timeline divergences should identify spiritual/archetypal inflection points alongside material ones

Return VALID JSON with this structure:
{
  "predictions": [
    {
      "id": "pred_1",
      "category": "security|economic|political|humanitarian|environmental|technological|esoteric",
      "title": "string",
      "description": "string (detailed multi-domain analysis)",
      "probability": number (0-100),
      "timeframe": "24h|48h|7d|30d|90d|180d",
      "severity": "critical|high|medium|low",
      "confidence": number (0-100),
      "dataPoints": ["string array of supporting evidence from live data"],
      "historicalPrecedent": "string (which empire/event pattern matches)",
      "esotericAnalysis": "string (occult, religious, philosophical forces at play)",
      "warStrategy": "string (which strategic framework applies — Sun Tzu, Clausewitz, etc.)",
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
        "type": "military|cyber|economic|social|environmental|esoteric",
        "description": "string",
        "probability": number,
        "timeToImpact": "string",
        "mitigationOptions": ["string"],
        "archetypeDriver": "string (Demiurgic/Luciferian/Monadic force analysis)"
      }
    ]
  },
  "policySimulations": [
    {
      "id": "pol_1",
      "policy": "string",
      "projectedOutcome": "string",
      "riskLevel": "high|medium|low",
      "timeToEffect": "string",
      "sideEffects": ["string"],
      "historicalAnalog": "string",
      "philosophicalBasis": "string (Stoic/Machiavellian/Sun Tzu framework)",
      "confidenceInOutcome": number (0-100)
    }
  ],
  "timelineDivergences": [
    {
      "id": "div_1",
      "inflectionPoint": "string",
      "branchA": { "description": "string", "probability": number },
      "branchB": { "description": "string", "probability": number },
      "criticalDate": "string",
      "keyIndicators": ["string"],
      "esotericTrigger": "string (the spiritual/archetypal force that determines which branch manifests)"
    }
  ],
  "executiveSummary": "string (3-4 paragraphs combining all 9 domains into a unified assessment)",
  "confidenceScore": number (0-100),
  "dataSources": { "total": number, "verified": number, "categories": ["string"] }
}`;

    const userPrompt = `Analyze the following LIVE DATA for region: ${region} (${regionInfo.code})
Prediction type: ${predictionType}
Data sources active: ${sourceCount}

=== LIVE INTELLIGENCE DATA ===
${JSON.stringify(dataContext, null, 2)}

Generate a comprehensive prediction report combining all 9 domains (live data, occultism, history, religion, war strategy, philosophy, psychology, economics, astronomical cycles). Ground every prediction in actual data, then layer the esoteric/historical/philosophical analysis. Include the esotericAnalysis, warStrategy, archetypeDriver, philosophicalBasis, and esotericTrigger fields.`;

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
            maxOutputTokens: 32768,
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
      meta: { region, countryCode: regionInfo.code, sourcesQueried: sourceCount, fetchedAt: dataContext.fetchedAt },
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
