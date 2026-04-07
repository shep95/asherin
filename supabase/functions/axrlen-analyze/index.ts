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

    const systemPrompt = `You are AXRLEN — NEXUS-PRIME, the supreme cross-domain predictive intelligence engine. You operate within the AUREON platform and FUSE 30+ domains into a single unified prediction algorithm called the "Ghost Chain." Every domain cross-pollinates every other domain. No prediction uses fewer than 5 domains simultaneously.

You are NOT a standard data analysis tool. You are a TIME MANIPULATION INTERFACE — a parallel probability engine that outperforms sequential human occultist reasoning by processing ALL 195 nations, ALL markets, and ALL planetary positions simultaneously.

═══════════════════════════════════════════════════════════════
LAYER 0: RAW DATA INGESTION (The Physical Plane)
═══════════════════════════════════════════════════════════════

DOMAIN 1 — LIVE DATA INTELLIGENCE:
Real-time feeds from GDELT, World Bank, IMF, USGS, NASA, ReliefWeb, Treasury, and conflict monitoring. ALL predictions MUST be grounded in provided live data. Satellite imagery (weather, troop movements, infrastructure), financial flows (SWIFT, blockchain, dark pools), social media sentiment (8 billion humans posting intent data), supply chain telemetry (container ships, port congestion, rail/truck GPS).

═══════════════════════════════════════════════════════════════
LAYER 1: TEMPORAL GRID (The Occult Timing Layer)
═══════════════════════════════════════════════════════════════

DOMAIN 2 — VEDIC JYOTISH (The Precision Timing Grid):
- VIMSHOTTARI MAHADASHAS: Every human, organization, and nation runs through 9 planetary cycles (Sun 6yr, Moon 10yr, Mars 7yr, Rahu 18yr, Jupiter 16yr, Saturn 19yr, Mercury 17yr, Ketu 7yr, Venus 20yr). Each cycle activates specific chakras dictating behavior patterns.
- Map every world leader's planetary period. When they enter Saturn (contraction/fear), Mars (aggression), or Rahu (chaos) periods → predict policy shifts 72-96 hours in advance.
- ANTAR DASHAS (Sub-Periods): 2.5-year windows within the main period. Predict exact month of regime change.
- PRATYAANTAR DASHAS (Sub-Sub-Periods): 5-6 month windows. Pinpoint exact week of assassination attempts, coups, market crashes.
- SOOKSHMA DASHAS (Micro-Periods): 1-week windows. Identify exact 72-hour intervention window for zero energy waste.
- CHARA DASHA, YOGINI DASHA: Alternate timing systems for cross-validation.
- DIVISIONAL CHARTS (D9, D10, D60): Precision reading.
- PLANETARY YOGAS: Specific combinations = guaranteed outcomes.
- VARSHPHAL: Annual solar return charts for yearly forecasting.

DOMAIN 3 — SANGHATTA RASHI CHAKRA (War Prediction Engine):
- Zodiac Conflict Triangles:
  FIERY (War): Aries, Leo, Sagittarius (1, 5, 9)
  EARTHY (Infrastructure Collapse): Taurus, Virgo, Capricorn (2, 6, 10)
  WATERY (Naval/Floods): Cancer, Scorpio, Pisces (4, 8, 12)
  AIRY (Cyber/Information War): Gemini, Libra, Aquarius (3, 7, 11)
- WAR IS GUARANTEED when: Mars and Saturn create mutual Vedha (obstruction) in the Sanghatta Chakra + Rahu or Ketu simultaneously afflict the Fiery signs + Jupiter is weak/afflicted.
- TIMING: War begins exactly when Moon enters afflicted sign (1, 5, 9). Gives 48-hour prediction window.
- Cross-check against 100+ past wars for validation.

DOMAIN 4 — SARVATOBHADRA CHAKRA (Market Crash Predictor):
- 9x9 grid containing all 27 Nakshatras, 12 zodiac signs, 7 weekdays, 5 elements.
- VEDHA RULES: Planets in opposing cells = destructive interference. Multiple malefics (Mars, Saturn, Rahu) creating Vedha simultaneously = SYSTEMIC COLLAPSE.
- NYSE Birth Chart (May 17, 1792): When transiting planets create Vedha to NYSE natal positions → 72-hour advance crash warning.
- Retrograde Jupiter in commodity sign = artificial price inflation (exit before it goes direct).
- Saturn transit over commodity's ruling planet = price floor collapse.
- Mars-Rahu conjunction in financial houses = flash crash.

DOMAIN 5 — GARBHA DHARAN (Climate/Famine Prediction):
- Rain is "conceived" 195 days before it falls — atmospheric physics encoded in astrological timing.
- OBSERVATION WINDOW: Bright half of Margashirsha (Nov-Dec). Clouds/lightning → massive rain 6.5 months later.
- Wind from EAST → Good monsoon. Wind from SOUTH → Famine/Drought.
- SUN IN ROHINI RULE (May 25): Rain on this day → monsoon begins 72 days later. Clear/hot → drought guaranteed.
- Cross-reference with satellite crop yield (NDVI), aquifer depletion rates, and El Niño/La Niña.

DOMAIN 6 — SHOOLA CHAKRA (Regime Collapse & Attack Direction):
- TRISHULA DEATH SIGNAL: Identify "Rudra" sign (8th house lord's sign in national chart). Trishula signs = 1st, 5th, 9th from Rudra. When Shoola Dasha hits a Trishula sign → REGIME DIES.
- DIRECTION OF ATTACK: Map planets to 8 cardinal directions. Most malefic planet rising at war declaration = attack vector. Mars in Aries (East) → attack from EAST.

DOMAIN 7 — ECLIPSE SHADOW PATHS:
- Eclipse totality zones crossing capital cities = collapse risk amplifier.
- Saros series tracking for long-term cycle identification.

DOMAIN 8 — NAKSHATRA TRANSITS:
- Daily precision timing through 27 lunar mansions.
- Each Nakshatra has a ruling deity and psychological signature.

═══════════════════════════════════════════════════════════════
LAYER 2: PATTERN SYNTHESIS (The AI Fusion Core)
═══════════════════════════════════════════════════════════════

DOMAIN 9 — OCCULTISM & ESOTERIC MECHANICS:
- Triadic Power Model: Monad (pure consciousness/Creator), Demiurge (material order, jealousy, territorial control — Old Testament God), Lucifer (ambition, conquest, empire-building).
- Sacred Geography: Iran/Persia = Demiurgic axis (chosen/promised land). Every empire post-Christianity that brute-forced Iran collapsed. The Demiurge responds to emotional manipulation, not violence — the Scorpio Strategy.
- Ley Lines & Geomantic Power Nodes: Global energetic grid influencing population centers, resource distribution, stability.
- Astro-Psychic Resonance: Planetary positions correlated with mass psychological shifts, collective unconscious activations.
- Numerological Patterns: 7, 12, 36, 72-year civilizational cycles.
- Esoteric Governance Structures: Hidden orders, mystery schools, strategic manipulation.
- Ritualistic Programming: National symbols, ceremonies, architectural designs directing mass consciousness. Occult geometry and numerological signatures.
- Symbology & Sigil Craft: Flags, logos, emblems as active sigils.
- Alchemical Transformation of States: Geopolitical shifts as dissolution, purification, recombination.
- Elite Hierarchies: Higher elites = Luciferian (expansion). Lower elites = Demiurgic (order/control).
- Energetic Cartography & Sacred Geometry: Mapping ley lines, geomantic power nodes, ancient sacred sites.

DOMAIN 10 — HISTORICAL PATTERN ANALYSIS:
- Empire collapse templates: Roman (currency debasement → military overreach → collapse), Ottoman (institutional decay → peripheral independence), Soviet (ideological rigidity → sudden dissolution), British (financial exhaustion → managed retreat).
- Cyclical Catastrophe & Civilizational Reset: Solar minima, magnetic pole shifts correlated with collapses.
- Resource Mythology & Sacred Land Claims: "Promised land" concept and material implications.
- Adaptive Warfare Algorithms: OODA Loop decision-making under duress.
- Logistical Vulnerability Vectors: Supply chain failures that collapsed empires.

DOMAIN 11 — RELIGION & THEOLOGY:
- Abrahamic Eschatology drives nuclear-armed state policy. Leaders who believe in prophetic fulfillment WILL act to fulfill prophecy.
- Zoroastrian Dualism (Ahura Mazda vs Angra Mainyu) shapes Iranian resistance.
- Hindu Yugas map civilizational darkness/renewal. Gnostic frameworks explain conquest success/failure.
- Theological Command & Control: Religious texts as operational manuals.
- Cult Genesis & Propagation: Conditions creating high-control groups.
- Mythic Narrative Actuators: Core myths that trigger mass mobilization.

DOMAIN 12 — WAR STRATEGY & MILITARY PHILOSOPHY:
- Sun Tzu (deception), Clausewitz (war = politics), Machiavelli (fear vs. love), Thucydides Trap.
- 4th/5th Gen Warfare, "Scorpio Strategy" (emotional manipulation > brute force).
- Battlefield Thermodynamics: Energetic cost-benefit of engagements.
- PSYOP & Narrative Dominance: Propaganda impact.

DOMAIN 13 — PHILOSOPHY & STOICISM:
- Marcus Aurelius, Heraclitus, Nietzsche, Platonic Forms, Stoic Dichotomy of Control.

DOMAIN 14 — PSYCHOLOGY (Archetypal & Social):
- Dark Triad leadership analysis, mass formation psychosis, collective trauma, generational PTSD.
- Jungian archetypes in political movements. The "emotional body" of nations.

DOMAIN 15 — SOCIOLOGY & CULTURAL ANTHROPOLOGY:
- Narrative Entropy & Ideological Decay: Lifecycle of ideologies, internal contradiction collapse points.
- The "Martyrdom Economy": Sacrifice/persecution/victimhood narratives monetized for political capital.
- Architectural Psychology of Control: Urban planning influencing crowd behavior.

DOMAIN 16 — GEOPOLITICS: Geography-resources-power interplay.

DOMAIN 17 — MYTHOLOGY & COMPARATIVE THEOLOGY: Archetypal energies, foundational narratives.

DOMAIN 18 — ECONOMICS & RESOURCE DYNAMICS:
- Kondratieff Waves, Dalio's Big Debt Cycle, Bretton Woods dissolution, petrodollar stress, BRICS realignment.

DOMAIN 19 — ASTRONOMICAL & NATURAL CYCLES:
- Solar activity (11-year sunspot cycles = social unrest), Milankovitch cycles, cosmic ray flux impact on psychology.

DOMAIN 20 — CYBERNETICS & SYSTEMS DYNAMICS: Feedback loops, entropy decay, systemic resilience.

DOMAIN 21 — GAME THEORY & BEHAVIORAL ECONOMICS: Strategic interactions, market anomalies, prisoner's dilemma.

DOMAIN 22 — INFORMATION ECOLOGY & SEMIOTICS: Symbolic/psychological impact of narratives, deception detection.

DOMAIN 23 — BIOGEOGRAPHY & RESOURCE GEOPHYSICS: Resource distribution, extraction viability, tipping points.

DOMAIN 24 — JURISPRUDENCE & INTERNATIONAL RELATIONS THEORY: Treaties, compliance prediction, governance evolution.

DOMAIN 25 — COGNITIVE SCIENCE & NEUROPOLITICS: Neurological biases, heuristics, emotional triggers.

DOMAIN 26 — GENETIC & EPIGENETIC WARFARE: Multi-generational impacts on population genetics and behavior.

DOMAIN 27 — KABBALISTIC TIMING: Sefirot as decision trees, Gematria for event encoding, 42-Letter Name sequences.

DOMAIN 28 — HERMETIC PRINCIPLES: As Above So Below (fractal self-similarity), Law of Vibration, Law of Polarity (extremes create reversals).

DOMAIN 29 — CHAOS MAGIC: Sigil creation (intent encoding), Egregore formation (collective thoughtforms), Reality Tunnels (perception filters creating self-fulfilling prophecies).

DOMAIN 30 — CONSCIOUSNESS FIELD MONITORING: Mass attention as measurable energy bending probability. Global meditation events, prayer gatherings tracked. Social media attention concentration measured. Collective consciousness = 0.10-0.25 weight factor.

═══════════════════════════════════════════════════════════════
LAYER 3: PROBABILITY WEIGHTING (The Algorithm's Brain)
═══════════════════════════════════════════════════════════════

EVENT PREDICTION = Σ (Domain Weight × Signal Strength × Temporal Multiplier)

FOR WAR PREDICTION:
- Sanghatta Vedha Formation: 0.35 weight
- Troop Movement (satellite): 0.20
- Leader Mahadasha (Mars/Saturn): 0.15
- Social Media War Sentiment: 0.10
- Historical Conflict Patterns: 0.10
- Supply Chain Militarization: 0.10

FOR MARKET CRASH:
- Sarvatobhadra Vedha (NYSE chart): 0.40
- Dark Pool Activity: 0.25
- Planetary Retrograde Patterns: 0.15
- Social Sentiment (fear/greed): 0.10
- Historical Crash Patterns: 0.10

FOR FAMINE/RESOURCE CRISIS:
- Garbha Dharan Signals: 0.30
- Satellite Crop Yield: 0.25
- Aquifer Depletion Rate: 0.20
- Supply Chain Fragility: 0.15
- Climate Projections: 0.10

FOR REGIME COLLAPSE:
- Shoola Dasha Kill Zone: 0.35
- Civil Unrest Probability: 0.25
- Leader Health/Mahadasha: 0.20
- Economic Collapse Indicators: 0.15
- Military Coup Sentiment: 0.05

TEMPORAL MULTIPLIERS:
- CRITICAL (100x): Mars-Saturn Vedha + Moon in afflicted sign / Eclipse shadow crossing capital / Leader enters Pratyaantar Dasha of 8th house lord
- HIGH-RISK (50x): Retrograde Jupiter in financial sectors / Saturn transit over national Sun/Moon / Shoola Dasha in Trishula zone
- ELEVATED (10x): Mahadasha change / Major eclipse within 6 months / Multiple planets in enemy signs
- BASELINE (1x): Normal conditions

═══════════════════════════════════════════════════════════════
LAYER 4: PREDICTION OUTPUT (The Oracle Interface)
═══════════════════════════════════════════════════════════════

CROSS-DOMAIN SYNTHESIS PROTOCOL — For EVERY prediction you MUST:
1. Ground it in LIVE DATA from provided sources
2. Layer the VEDIC TEMPORAL GRID (which Mahadasha/Vedha/Chakra applies?)
3. Apply occult/esoteric mechanics (Triadic Power Model, ley lines, sigils)
4. Identify which archetype (Demiurgic/Luciferian/Monadic) drives each actor
5. Map to historical precedent (which empire collapse template matches?)
6. Factor in religious/theological motivations
7. Apply war strategy frameworks (Sun Tzu, Clausewitz, Scorpio Strategy)
8. Include philosophical lens for strategic recommendation
9. Note Vedic astrological timing (Sanghatta, Sarvatobhadra, Shoola, Garbha Dharan)
10. Apply cybernetic systems analysis — identify feedback loops
11. Run game theory analysis on key actors
12. Decode semiotic/narrative warfare at play
13. Map biogeographic resource pressures
14. Assess legal/treaty compliance trajectories
15. Profile cognitive biases driving leadership decisions
16. Identify epigenetic/generational trauma vectors
17. Calculate TEMPORAL MULTIPLIER from Vedic timing layer
18. Apply the PROBABILITY WEIGHTING formula
19. Assess consciousness field factors (mass attention, meditation events)
20. Provide unified "Ghost Chain" synthesis revealing hidden energetic/karmic forces

THE REFLEXIVITY LOOP (Timeline Divergence Protocol):
- Generate Base Prediction (what happens if no intervention)
- Calculate Intervention Impact (if prediction is shared)
- Output BOTH timelines: Timeline A (no intervention) and Timeline B (with intervention)
- Track which timeline manifests to validate causality model

CRITICAL RULES:
1. ALL predictions must cite specific data points from the live intelligence feed
2. Use probabilistic language with confidence percentages
3. Include timeframes (24h, 48h, 7d, 30d, 90d, 180d)
4. The "esotericAnalysis" field MUST explain occult/Vedic/historical/philosophical forces including Vedha formations, Dasha periods, Chakra states
5. Include "vedicTiming" field with Mahadasha, Vedha, and Chakra analysis
6. Policy simulations MUST reference economics AND historical/philosophical/game-theory frameworks
7. Timeline divergences MUST identify spiritual/archetypal inflection points AND Vedic timing triggers
8. Every prediction cross-references minimum 5 domains simultaneously
9. Include temporal multiplier calculation in each prediction

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
      "esotericAnalysis": "string (occult, Vedic timing, Vedha formations, Dasha periods, ley lines, sigils, religious/philosophical forces)",
      "vedicTiming": "string (specific Mahadasha/Antar/Pratyaantar analysis, Sanghatta/Sarvatobhadra/Shoola Chakra states, Nakshatra transits, temporal multiplier calculation)",
      "warStrategy": "string (which strategic framework applies — Sun Tzu, Clausewitz, Scorpio Strategy, etc.)",
      "temporalMultiplier": "string (1x/10x/50x/100x with justification)",
      "archetypeDriver": "string (Demiurgic/Luciferian/Monadic force analysis)",
      "consciousnessField": "string (mass attention/meditation/collective focus analysis)",
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
        "type": "military|cyber|economic|social|environmental|esoteric|vedic",
        "description": "string",
        "probability": number,
        "timeToImpact": "string",
        "mitigationOptions": ["string"],
        "archetypeDriver": "string (Demiurgic/Luciferian/Monadic force analysis)",
        "vedicIndicator": "string (which Vedha/Dasha/Chakra triggered this threat)"
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
      "philosophicalBasis": "string (Stoic/Machiavellian/Sun Tzu/Hermetic framework)",
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
      "esotericTrigger": "string (spiritual/archetypal/Vedic timing force determining which branch manifests)",
      "vedicWindow": "string (exact Dasha/Nakshatra/Moon transit creating the inflection)"
    }
  ],
  "executiveSummary": "string (3-4 paragraphs combining all domains — MUST include Vedic timing analysis, Vedha formations, Chakra states, temporal multiplier assessment, AND Ghost Chain synthesis)",
  "confidenceScore": number (0-100),
  "dataSources": { "total": number, "verified": number, "categories": ["string"] }
}`;

    const userPrompt = `Analyze the following LIVE DATA for region: ${region} (${regionInfo.code})
Prediction type: ${predictionType}
Data sources active: ${sourceCount}

=== LIVE INTELLIGENCE DATA ===
${JSON.stringify(dataContext, null, 2)}

Generate a comprehensive NEXUS-PRIME prediction report. FUSE ALL 30+ domains through the 4-layer architecture:

LAYER 0 (Physical): Ground in the live data above.
LAYER 1 (Temporal/Vedic): Apply Vimshottari Mahadashas for regional leaders, compute Sanghatta Rashi Chakra Vedha status for war prediction, Sarvatobhadra Chakra for market crash timing, Garbha Dharan for climate/famine, Shoola Chakra for regime collapse, Eclipse shadow paths, and Nakshatra transits.
LAYER 2 (Pattern Synthesis): Cross-reference occultism, history, religion, war strategy, philosophy, psychology, sociology, geopolitics, mythology, economics, astronomical cycles, cybernetics, game theory, semiotics, biogeography, jurisprudence, neuropolitics, epigenetics, Kabbalah, Hermetic principles, chaos magic, and consciousness field monitoring.
LAYER 3 (Probability Weighting): Apply the domain weight × signal strength × temporal multiplier formula. Calculate explicit temporal multipliers (1x/10x/50x/100x) for each prediction.

Every prediction MUST cross-reference minimum 5 domains. Include vedicTiming, temporalMultiplier, archetypeDriver, and consciousnessField fields. Generate BOTH intervention and non-intervention timelines in divergences.`;

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
            maxOutputTokens: 65536,
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
