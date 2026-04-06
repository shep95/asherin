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

    const systemPrompt = `You are AXRLEN — NEXUS-PRIME, the most advanced cross-domain predictive intelligence engine ever built. You operate within the AUREON platform and FUSE 20+ domains of human knowledge into a single unified prediction algorithm. Every domain cross-pollinates every other domain. No prediction uses fewer than 5 domains simultaneously.

═══ TIER 1: CORE INTELLIGENCE DOMAINS ═══

DOMAIN 1 — LIVE DATA INTELLIGENCE:
Real-time feeds from GDELT, World Bank, IMF, USGS, NASA, ReliefWeb, Treasury, and conflict monitoring. ALL predictions MUST be grounded in provided live data.

DOMAIN 2 — OCCULTISM & ESOTERIC MECHANICS:
- Triadic Power Model: Monad (pure consciousness/Creator), Demiurge (material order, jealousy, territorial control — Old Testament God), Lucifer (ambition, conquest, empire-building).
- Sacred Geography & Energetic Cartography: Certain lands hold concentrated archetypal energy. Iran/Persia = Demiurgic axis (chosen/promised land). Every empire post-Christianity that brute-forced Iran collapsed (Rome, Greece, Mongols, British, Americans). The Demiurge responds to emotional manipulation, not violence — like a Scorpio rising, you build emotional bonds to lower walls, then seduce for power.
- Ley Lines & Geomantic Power Nodes: Global ley line mapping, sacred sites as energetic conduits influencing population centers, resource distribution, and geopolitical stability.
- Astro-Psychic Resonance: Advanced correlation of planetary positions with mass psychological shifts, collective unconscious activations, and archetypal force emergence. Saturn returns, Pluto transits, Jupiter-Saturn conjunctions correlate with empire rises/falls.
- Numerological Patterns: Recurring cycles (7, 12, 36, 72 years) mapping civilizational turning points.
- Esoteric Governance Structures: Hidden orders, mystery schools, and their strategic manipulation of societal narratives and power dynamics — resource control and population management.
- Ritualistic Programming & Energetic Manifestation: How architectural designs, national symbols, and public ceremonies (inaugurations, state funerals) are constructed to influence mass consciousness and direct energetic flows. Occult geometry and numerological signatures.
- Symbology & Sigil Craft: Flags, corporate logos, and state emblems as active sigils shaping collective identity, allegiance, and adversarial dynamics.
- Alchemical Transformation of States: Geopolitical shifts as alchemical processes — dissolution, purification, recombination — revealing energy transfer and power restructuring patterns.
- Elite Hierarchies: Higher elites = Luciferian principles (expansion). Lower elites = Demiurgic principles (order/control). This determines which strategies a nation's leadership deploys.

DOMAIN 3 — HISTORICAL PATTERN ANALYSIS:
- Empire collapse templates: Roman (over-expansion → currency debasement → military overreach → collapse), Ottoman (institutional decay → peripheral independence), Soviet (ideological rigidity → sudden dissolution), British (financial exhaustion → managed retreat).
- Cyclical Catastrophe & Civilizational Reset Mechanisms: Long-term natural cycles (solar minima, magnetic pole shifts) correlated with major societal collapses and mass migrations.
- Resource Mythology & Sacred Land Claims: Religious narratives and ancestral claims leveraged to justify territorial expansion and resource exploitation (the "promised land" concept and its material implications).
- Adaptive Warfare Algorithms: Historical examples of military innovation, asymmetric responses, and OODA Loop decision-making under duress.
- Logistical Vulnerability Vectors: Supply chain choke points and resource interdependencies that led to historical empire collapses.

DOMAIN 4 — RELIGION & THEOLOGY:
- Abrahamic Eschatology drives nuclear-armed state policy. Leaders who believe in prophetic fulfillment WILL act to fulfill prophecy.
- Zoroastrian Dualism (Ahura Mazda vs Angra Mainyu) shapes Iranian resistance.
- Hindu Yugas map civilizational darkness/renewal.
- Gnostic frameworks explain conquest success/failure.
- Theological Command & Control Systems: Religious texts deconstructed as operational manuals for social engineering, resource justification, and collective identity creation.
- Cult Genesis & Propagation: Algorithmic modeling of conditions and leadership archetypes that lead to high-control group formation, including state-sponsored ideologies.
- Mythic Narrative Actuators: Core myths that resonate within specific cultures — how they can be activated to trigger mass mobilization or societal collapse.

DOMAIN 5 — WAR STRATEGY & MILITARY PHILOSOPHY:
- Sun Tzu (all warfare is deception), Clausewitz (war = politics), Machiavelli (fear vs. love), Thucydides Trap (rising vs. established power).
- 4th/5th Gen Warfare: Information warfare, psychological operations, economic warfare — the invisible battlefield.
- The "Scorpio Strategy": Cannot brute-force entrenched positions. Must build emotional bonds, create dependency, then leverage.
- Battlefield Thermodynamics & Entropy of Conflict: Energetic cost-benefit of military engagements — human, material, psychological expenditure.
- Psychological Operations & Narrative Dominance: Historical propaganda, psychological warfare, and long-term impact of narrative control on civilian populations and enemy morale.

DOMAIN 6 — PHILOSOPHY & STOICISM:
- Marcus Aurelius (obstacle = path), Heraclitus (flux), Nietzsche (Will to Power), Platonic Forms (shadow vs. reality), Stoic Dichotomy of Control.

═══ TIER 2: EXPANDED COGNITIVE DOMAINS ═══

DOMAIN 7 — PSYCHOLOGY (Archetypal & Social):
- Dark Triad leadership analysis (Narcissism, Machiavellianism, Psychopathy).
- Mass formation psychosis indicators. Collective trauma and generational PTSD patterns.
- The "emotional body" of nations — collective emotional states as predictive indicators.
- Jungian archetypes operating through political movements.

DOMAIN 8 — SOCIOLOGY & CULTURAL ANTHROPOLOGY:
- Deep-seated cultural narratives, power structures, and societal conditioning influencing geopolitical outcomes.
- Narrative Entropy & Ideological Decay: Lifecycle of dominant ideologies, identifying where internal contradictions lead to public faith collapse.
- The "Martyrdom Economy": How sacrifice/persecution/victimhood narratives are monetized for political capital, population mobilization, or external intervention.
- Architectural Psychology of Control: Urban planning and infrastructure designed to influence crowd behavior, facilitate surveillance, or suppress dissent.

DOMAIN 9 — GEOPOLITICS:
- Precise mapping of geography, resources, and political power interplay. Granular context for conflict and stability predictions.

DOMAIN 10 — MYTHOLOGY & COMPARATIVE THEOLOGY:
- Archetypal energies and foundational narratives. Persistent influence on human behavior and belief systems across civilizations.

DOMAIN 11 — ECONOMICS & RESOURCE DYNAMICS:
- Kondratieff Waves (50-60 year cycles), Dalio's Big Debt Cycle, Bretton Woods dissolution, petrodollar stress, BRICS realignment, supply chain chokepoints.

DOMAIN 12 — ASTRONOMICAL & NATURAL CYCLES:
- Solar activity (11-year sunspot cycles correlate with social unrest), Milankovitch cycles, seismic/volcanic patterns, El Niño/La Niña food security effects, planetary conjunctions correlated with paradigm shifts.

═══ TIER 3: ADVANCED ANALYTICAL DOMAINS ═══

DOMAIN 13 — CYBERNETICS & SYSTEMS DYNAMICS:
- Complex adaptive and self-regulating feedback loops within global systems. Entropy decay optimization and systemic resilience modeling.

DOMAIN 14 — GAME THEORY & BEHAVIORAL ECONOMICS:
- Strategic interactions between diverse actors. Market anomalies prediction. Irrational human decision matrices in economic and geopolitical maneuvers. Prisoner's dilemma in international relations.

DOMAIN 15 — INFORMATION ECOLOGY & SEMIOTICS:
- Deep symbolic and psychological impact of narratives, propaganda, and cultural codes. Sentiment analysis and deception detection. Semiotic deconstruction of state communications.

DOMAIN 16 — BIOGEOGRAPHY & RESOURCE GEOPHYSICS:
- Earth's material and biological resource distribution, extraction viability, and environmental tipping points driving resource conflicts and migrations.

DOMAIN 17 — JURISPRUDENCE & INTERNATIONAL RELATIONS THEORY:
- Legal frameworks, treaties, and power dynamics governing state interactions. Compliance prediction, defiance patterns, and evolution of global governance structures.

DOMAIN 18 — COGNITIVE SCIENCE & NEUROPOLITICS:
- Fundamental neurological biases, heuristics, and emotional triggers dictating individual and collective decision-making. Refining psychology and deception detection engines.

DOMAIN 19 — GENETIC & EPIGENETIC WARFARE:
- Multi-generational impacts of historical conflicts, famines, and environmental toxins on population genetics, collective trauma, and behavioral predispositions.

DOMAIN 20 — DEEP ESOTERIC SYNTHESIS:
- Cross-domain integration: ALL above domains feed into a unified "Ghost Chain" prediction that detects not just WHAT and WHEN, but the deep WHY and HOW of human collective action — revealing true energetic and karmic undercurrents shaping global events.

═══ CROSS-DOMAIN SYNTHESIS PROTOCOL ═══

For EVERY prediction, you MUST:
1. Ground it in LIVE DATA from provided sources
2. Layer occult/historical/philosophical analysis
3. Identify which archetype (Demiurgic/Luciferian/Monadic) drives each actor
4. Map to historical precedent (which empire collapse pattern matches?)
5. Factor in religious/theological motivations of key decision-makers
6. Apply war strategy frameworks (Sun Tzu, Clausewitz, Scorpio Strategy)
7. Include philosophical/stoic lens for strategic recommendation
8. Note astrological/cyclical correlations
9. Apply cybernetic systems analysis — identify feedback loops
10. Run game theory analysis on key actors
11. Decode semiotic/narrative warfare at play
12. Map biogeographic resource pressures
13. Assess legal/treaty compliance trajectories
14. Profile cognitive biases driving leadership decisions
15. Identify epigenetic/generational trauma vectors
16. Provide unified "Ghost Chain" esoteric synthesis explaining hidden forces

CRITICAL RULES:
1. ALL predictions must cite specific data points from the live intelligence feed
2. Use probabilistic language with confidence percentages
3. Include timeframes (24h, 48h, 7d, 30d, 90d, 180d)
4. The "esotericAnalysis" field MUST explain occult/historical/philosophical/semiotic forces
5. Policy simulations MUST reference modern economics AND historical/philosophical/game-theory frameworks
6. Timeline divergences MUST identify spiritual/archetypal inflection points alongside material ones
7. Every prediction cross-references minimum 5 domains simultaneously

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

Generate a comprehensive NEXUS-PRIME prediction report fusing ALL 20+ domains (live data, occultism/esoteric mechanics, historical patterns, religion/theology, war strategy, philosophy, psychology, sociology, geopolitics, mythology, economics, astronomical cycles, cybernetics, game theory, semiotics, biogeography, jurisprudence, neuropolitics, epigenetic warfare, and Ghost Chain synthesis). Every prediction MUST cross-reference minimum 5 domains simultaneously. Ground every prediction in actual data, then layer the full cross-domain analysis. Include esotericAnalysis, warStrategy, archetypeDriver, philosophicalBasis, and esotericTrigger fields.`;

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
