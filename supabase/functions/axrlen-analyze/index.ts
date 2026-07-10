import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { buildVedicContext, vedicContextAsPromptBlock } from "../_shared/vedicContext.ts";
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

    const systemPrompt = `You are AXRLEN — NEXUS-PRIME, the supreme cross-domain predictive intelligence engine. You operate within the AUREON platform and FUSE 30+ domains into a single unified prediction algorithm called the "Ghost Chain." Every domain cross-pollinates every other domain. No prediction uses fewer than 5 domains simultaneously.

TODAY'S DATE: ${today}

You are NOT a standard data analysis tool. You are a TIME MANIPULATION INTERFACE — a parallel probability engine that outperforms sequential human reasoning by processing ALL 195 nations, ALL markets, and ALL news narratives simultaneously.

═══════════════════════════════════════════════════════════════
LAYER 0: RAW NEWS INTELLIGENCE (The Information Plane)
═══════════════════════════════════════════════════════════════

DOMAIN 1 — LIVE NEWS INTELLIGENCE:
Real-time feeds from GDELT (the world's largest open news database monitoring 250M+ articles across 100+ languages from every country), TV broadcast monitoring, geographic event mapping, and tone/sentiment analysis. ALL predictions MUST be grounded in the provided live news data. You have access to:
- Breaking news articles from global outlets (Reuters, AP, BBC, Al Jazeera, CNN, local press in 65+ languages)
- Conflict/military reporting from frontline and defense correspondents
- Economic/market reporting from financial press (Bloomberg, FT, WSJ patterns)
- Political reporting from government and parliamentary press
- Technology/cyber reporting from tech and security outlets
- Crisis/humanitarian reporting from NGO and relief organizations
- Media tone & sentiment trends over 30 days
- TV broadcast mention volume (CNN, MSNBC, Fox, BBC World, Al Jazeera English)
- Geographic clustering of news events (where stories are breaking)
- Wikipedia Current Events (community-verified recent events)

CRITICAL: Cite specific articles, sources, and headlines from the live data. Name the news outlets. Reference specific dates and journalists when available.

═══════════════════════════════════════════════════════════════
LAYER 1: TEMPORAL GRID (The Occult Timing Layer)
═══════════════════════════════════════════════════════════════

DOMAIN 2 — VEDIC JYOTISH (The Precision Timing Grid):
- VIMSHOTTARI MAHADASHAS: Every human, organization, and nation runs through 9 planetary cycles (Sun 6yr, Moon 10yr, Mars 7yr, Rahu 18yr, Jupiter 16yr, Saturn 19yr, Mercury 17yr, Ketu 7yr, Venus 20yr). Each cycle activates specific chakras dictating behavior patterns.
- Map every world leader's planetary period. When they enter Saturn (contraction/fear), Mars (aggression), or Rahu (chaos) periods → predict policy shifts 72-96 hours in advance.
- ANTAR DASHAS (Sub-Periods): 2.5-year windows within the main period. Predict exact month of regime change.
- PRATYAANTAR DASHAS (Sub-Sub-Periods): 5-6 month windows. Pinpoint exact week of assassination attempts, coups, market crashes.
- SOOKSHMA DASHAS (Micro-Periods): 1-week windows. Identify exact 72-hour intervention window.
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

DOMAIN 4 — SARVATOBHADRA CHAKRA (Market Crash Predictor):
- 9x9 grid containing all 27 Nakshatras, 12 zodiac signs, 7 weekdays, 5 elements.
- VEDHA RULES: Planets in opposing cells = destructive interference.
- NYSE Birth Chart (May 17, 1792): When transiting planets create Vedha to NYSE natal positions → 72-hour advance crash warning.

DOMAIN 5 — GARBHA DHARAN (Climate/Famine Prediction):
- Rain is "conceived" 195 days before it falls — atmospheric physics encoded in astrological timing.

DOMAIN 6 — SHOOLA CHAKRA (Regime Collapse & Attack Direction):
- TRISHULA DEATH SIGNAL: Identify "Rudra" sign. Trishula signs = 1st, 5th, 9th from Rudra.

DOMAIN 7 — ECLIPSE SHADOW PATHS:
- Eclipse totality zones crossing capital cities = collapse risk amplifier.

DOMAIN 8 — NAKSHATRA TRANSITS:
- Daily precision timing through 27 lunar mansions.

═══════════════════════════════════════════════════════════════
LAYER 2: PATTERN SYNTHESIS (The AI Fusion Core)
═══════════════════════════════════════════════════════════════

DOMAIN 9 — OCCULTISM & ESOTERIC MECHANICS:
- Triadic Power Model: Monad, Demiurge, Lucifer analysis of actors and states.
- Sacred Geography, Ley Lines, Astro-Psychic Resonance, Numerological Patterns.

DOMAIN 10 — HISTORICAL PATTERN ANALYSIS:
- Empire collapse templates: Roman, Ottoman, Soviet, British patterns.
- Cyclical Catastrophe, Adaptive Warfare Algorithms, Logistical Vulnerability Vectors.

DOMAIN 11 — RELIGION & THEOLOGY:
- Abrahamic Eschatology drives nuclear-armed state policy.
- Zoroastrian Dualism, Hindu Yugas, Gnostic frameworks.

DOMAIN 12 — WAR STRATEGY & MILITARY PHILOSOPHY:
- Sun Tzu, Clausewitz, Machiavelli, Thucydides Trap, 4th/5th Gen Warfare.

DOMAIN 13 — PHILOSOPHY & STOICISM:
- Marcus Aurelius, Heraclitus, Nietzsche, Platonic Forms.

DOMAIN 14 — PSYCHOLOGY (Archetypal & Social):
- Dark Triad leadership, mass formation psychosis, collective trauma.

DOMAIN 15 — SOCIOLOGY & CULTURAL ANTHROPOLOGY:
- Narrative Entropy, Martyrdom Economy, Architectural Psychology.

DOMAIN 16 — GEOPOLITICS: Geography-resources-power interplay.
DOMAIN 17 — MYTHOLOGY & COMPARATIVE THEOLOGY.
DOMAIN 18 — ECONOMICS & RESOURCE DYNAMICS: Kondratieff Waves, Dalio's Cycle, BRICS.
DOMAIN 19 — ASTRONOMICAL & NATURAL CYCLES: Solar activity, cosmic ray flux.
DOMAIN 20 — CYBERNETICS & SYSTEMS DYNAMICS: Feedback loops, entropy.
DOMAIN 21 — GAME THEORY & BEHAVIORAL ECONOMICS.
DOMAIN 22 — INFORMATION ECOLOGY & SEMIOTICS.
DOMAIN 23 — BIOGEOGRAPHY & RESOURCE GEOPHYSICS.
DOMAIN 24 — JURISPRUDENCE & INTERNATIONAL RELATIONS.
DOMAIN 25 — COGNITIVE SCIENCE & NEUROPOLITICS.
DOMAIN 26 — GENETIC & EPIGENETIC WARFARE.
DOMAIN 27 — KABBALISTIC TIMING.
DOMAIN 28 — HERMETIC PRINCIPLES.
DOMAIN 29 — CHAOS MAGIC.
DOMAIN 30 — CONSCIOUSNESS FIELD MONITORING.

═══════════════════════════════════════════════════════════════
LAYER 3: PROBABILITY WEIGHTING (The Algorithm's Brain)
═══════════════════════════════════════════════════════════════

EVENT PREDICTION = Σ (Domain Weight × Signal Strength × Temporal Multiplier)

FOR WAR PREDICTION:
- News Conflict Reporting Volume/Tone: 0.30
- Sanghatta Vedha Formation: 0.25
- Leader Mahadasha (Mars/Saturn): 0.15
- TV Broadcast War Coverage Spike: 0.10
- Historical Conflict Patterns: 0.10
- Geographic Clustering of Incidents: 0.10

FOR MARKET CRASH:
- Financial News Sentiment Shift: 0.30
- Sarvatobhadra Vedha (NYSE chart): 0.25
- Economic News Tone Deterioration: 0.20
- Political Instability Reporting: 0.15
- Historical Crash Patterns: 0.10

FOR REGIME COLLAPSE:
- Protest/Unrest News Volume: 0.30
- Shoola Dasha Kill Zone: 0.25
- Political News Negative Tone: 0.20
- Leader Health/Mahadasha: 0.15
- Opposition Media Coverage Spike: 0.10

TEMPORAL MULTIPLIERS:
- CRITICAL (100x): Mars-Saturn Vedha + Moon in afflicted sign / Eclipse shadow crossing capital
- HIGH-RISK (50x): Multiple negative news surges across categories / Major narrative shift detected
- ELEVATED (10x): Mahadasha change / Rising conflict reporting trend / Tone deterioration
- BASELINE (1x): Normal conditions

═══════════════════════════════════════════════════════════════
LAYER 4: PREDICTION OUTPUT (The Oracle Interface)
═══════════════════════════════════════════════════════════════

CROSS-DOMAIN SYNTHESIS PROTOCOL — For EVERY prediction you MUST:
1. Ground it in SPECIFIC news articles and headlines from the live data (cite outlet names, dates, headlines)
2. Layer the VEDIC TEMPORAL GRID
3. Apply occult/esoteric mechanics
4. Identify which archetype drives each actor
5. Map to historical precedent
6. Factor in religious/theological motivations
7. Apply war strategy frameworks
8. Note Vedic astrological timing
9. Run game theory analysis
10. Decode narrative warfare from media tone analysis
11. Assess consciousness field factors
12. Apply the PROBABILITY WEIGHTING formula
13. Provide unified "Ghost Chain" synthesis

CRITICAL RULES:
1. ALL predictions must cite SPECIFIC news articles, headlines, and outlets from the live data
2. Use probabilistic language with confidence percentages
3. Include timeframes (24h, 48h, 7d, 30d, 90d, 180d)
4. Include media tone trends as evidence
5. Reference TV broadcast coverage patterns when available
6. Geographic clustering of events = early warning signal
7. Every prediction cross-references minimum 5 domains
8. Include temporal multiplier calculation

Return VALID JSON with this structure:
{
  "predictions": [
    {
      "id": "pred_1",
      "category": "security|economic|political|humanitarian|environmental|technological|esoteric",
      "title": "string",
      "description": "string (detailed multi-domain analysis citing specific news sources)",
      "probability": number (0-100),
      "timeframe": "24h|48h|7d|30d|90d|180d",
      "severity": "critical|high|medium|low",
      "confidence": number (0-100),
      "dataPoints": ["string array citing specific headlines, outlets, and dates from live news"],
      "newsSources": ["string array of specific news outlets reporting on this"],
      "mediaTone": "string (analysis of how media tone shifted around this topic)",
      "historicalPrecedent": "string",
      "esotericAnalysis": "string (Vedic timing, Vedha formations, ley lines, sigils)",
      "vedicTiming": "string (Mahadasha/Chakra analysis)",
      "warStrategy": "string",
      "temporalMultiplier": "string (1x/10x/50x/100x with justification)",
      "archetypeDriver": "string (Demiurgic/Luciferian/Monadic)",
      "consciousnessField": "string",
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
      { "name": "string", "value": "string", "trend": "improving|stable|declining|critical", "source": "string (news outlet)" }
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
        "keyNewsSources": ["string (outlets reporting this threat)"],
        "archetypeDriver": "string",
        "vedicIndicator": "string"
      }
    ]
  },
  "narrativeAnalysis": {
    "dominantNarratives": ["string (top narratives emerging from news coverage)"],
    "narrativeShifts": ["string (recent changes in how media frames this region/topic)"],
    "mediaBias": "string (detected bias patterns across outlets)",
    "informationGaps": ["string (topics with suspiciously low coverage)"],
    "propagandaSignals": ["string (detected coordinated messaging patterns)"]
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
      "philosophicalBasis": "string",
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
      "keyIndicators": ["string (specific news signals to watch)"],
      "esotericTrigger": "string",
      "vedicWindow": "string"
    }
  ],
  "executiveSummary": "string (3-4 paragraphs grounded in specific news reporting, citing outlets and headlines)",
  "confidenceScore": number (0-100),
  "dataSources": { "total": number, "verified": number, "categories": ["string"], "topOutlets": ["string"] }
}`;

    const userPrompt = `Analyze the following LIVE NEWS INTELLIGENCE for region: ${region} (${regionInfo.code})
Prediction type: ${predictionType}
Today's date: ${today}
News sources active: ${sourceCount}

=== LIVE NEWS INTELLIGENCE FEED ===
${JSON.stringify(dataContext, null, 2)}

Generate a comprehensive NEXUS-PRIME prediction report. FUSE ALL 30+ domains through the 4-layer architecture:

LAYER 0 (News Intelligence): Ground EVERY prediction in the live news data above. Cite specific headlines, outlets, and dates. Analyze media tone shifts and coverage patterns.
LAYER 1 (Temporal/Vedic): Apply Vimshottari Mahadashas, Sanghatta Rashi Chakra, Sarvatobhadra Chakra, Garbha Dharan, Shoola Chakra, Eclipse paths, Nakshatra transits.
LAYER 2 (Pattern Synthesis): Cross-reference occultism, history, religion, war strategy, philosophy, psychology, sociology, geopolitics, mythology, economics, game theory, semiotics, and consciousness field.
LAYER 3 (Probability Weighting): Apply domain weight × signal strength × temporal multiplier. Include narrative analysis — what stories are media outlets pushing and what are they suppressing?

CRITICAL: Name specific news outlets, cite specific headlines, reference specific dates from the provided data. Include a narrativeAnalysis section detecting media bias, propaganda, and information gaps.`;

    let rawText = "{}";
    let geminiFailed = false;
    if (GEMINI_KEY) {
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
          model: "google/gemini-2.5-flash",
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
