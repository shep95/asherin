// Codified from ZOPHIEL "Global Occult Prediction Protocols" — mundane astrology corpus.
// Used by the Vedic Global Predictions tab and the country compatibility / power-ranking views.

export interface PowerRankingRow {
  rank: number;
  country: string;
  flag: string;
  era: "Past" | "Present" | "Future";
  window: string;          // time window
  driver: string;          // dasha / yoga / transit driver
  note: string;
}

// Power ranking timeline (mundane Vedic + Sankranti Purusha + Shoola Dasha synthesis)
export const POWER_RANKINGS: PowerRankingRow[] = [
  // ── PAST ──
  { rank: 1, country: "United Kingdom", flag: "🇬🇧", era: "Past", window: "1815 – 1914",
    driver: "Sun–Jupiter mahadasha on Libra Asc; benefic Stambha",
    note: "Pax Britannica. Naval (Cancer/Pisces) supremacy via Moon-strong charts." },
  { rank: 2, country: "United States", flag: "🇺🇸", era: "Past", window: "1945 – 2008",
    driver: "Cancer Asc + 10H Mars; long Venus–Sun cycle",
    note: "Post-WWII unipolar moment. Dollar = Jupiter. Air/Space = Mercury–Saturn yoga." },
  { rank: 3, country: "Soviet Union", flag: "☭", era: "Past", window: "1945 – 1991",
    driver: "Saturn–Mars Vedha in Sanghatta during dissolution",
    note: "Eclipse on capital (Moscow) 1990 triggered Pancha Vedha collapse." },
  { rank: 4, country: "China (PRC)", flag: "🇨🇳", era: "Past", window: "1980 – 2020",
    driver: "Rahu mahadasha — manufacturing surge",
    note: "Earthy Triangle dominance (Taurus–Virgo–Capricorn) = industrial base." },

  // ── PRESENT ──
  { rank: 1, country: "United States", flag: "🇺🇸", era: "Present", window: "2024 – 2027",
    driver: "Saturn in Pisces afflicting 9H — soft empire decay",
    note: "Still #1 in air/space/finance. Jupiter return strengthens 2026 Q3." },
  { rank: 2, country: "China (PRC)", flag: "🇨🇳", era: "Present", window: "2024 – 2030",
    driver: "Ketu mahadasha — detachment from old growth model",
    note: "Strongest in Land + Sea (Scorpio Moon). Naval expansion peaks 2027." },
  { rank: 3, country: "India", flag: "🇮🇳", era: "Present", window: "2023 – 2031",
    driver: "Venus mahadasha on Taurus Asc — Argha Kand wealth phase",
    note: "Demographic + tech rise. Strongest suit: Air + cyber (Mercury exalted)." },
  { rank: 4, country: "Russia", flag: "🇷🇺", era: "Present", window: "2024 – 2028",
    driver: "Mars–Saturn Vedha in Sangatta — wartime contraction",
    note: "Strong Land/Resource (Earthy triangle) but Trishula on Rudra sign by 2028." },
  { rank: 5, country: "Saudi Arabia", flag: "🇸🇦", era: "Present", window: "2024 – 2030",
    driver: "Sun (Gold) + Mars (Oil) co-rulership of 2H/11H",
    note: "Argha Kand commodity king. Energy transition risks Saturn 2029." },

  // ── FUTURE ──
  { rank: 1, country: "India", flag: "🇮🇳", era: "Future", window: "2031 – 2049",
    driver: "Sun mahadasha begins ~2031 — Sankranti Purusha 'King of Year' repeatedly",
    note: "PROJECTED #1 GLOBAL POWER. Surya bindu favorable; benefic Stambha Kota." },
  { rank: 2, country: "China (PRC)", flag: "🇨🇳", era: "Future", window: "2030 – 2045",
    driver: "Venus mahadasha — soft-power & reserve currency play",
    note: "Naval + Space dominance peaks ~2038 (Jupiter return on Cancer 10H)." },
  { rank: 3, country: "United States", flag: "🇺🇸", era: "Future", window: "2031 – 2050",
    driver: "Moon mahadasha — fragmentation then renewal",
    note: "Drops to #3. Strongest in Space + Cyber. Capital risk from 2033 eclipse band." },
  { rank: 4, country: "Brazil", flag: "🇧🇷", era: "Future", window: "2035 – 2055",
    driver: "Jupiter mahadasha — agriculture + biofuel commodity supercycle",
    note: "Rohini rain rule favors harvest empire. Sea power (Atlantic) rises." },
  { rank: 5, country: "Indonesia", flag: "🇮🇩", era: "Future", window: "2038 – 2060",
    driver: "Mercury mahadasha on rising Cancer; Jala Nadi bull",
    note: "ASEAN heart. Strongest suit: Sea + rare earth (Scorpio 5H)." },
  { rank: 6, country: "Nigeria", flag: "🇳🇬", era: "Future", window: "2040 – 2065",
    driver: "Population yoga + Mars in own sign on Asc",
    note: "African pivot. Land + Energy dominance. Watch Saturn 2046 (Stambha test)." },
];

// Strongest military / power suit per country chart (derived from sign-element rulership)
// Air = Gemini/Libra/Aquarius · Land = Taurus/Virgo/Capricorn · Sea = Cancer/Scorpio/Pisces
// Fire/Space = Aries/Leo/Sagittarius
export const POWER_SUIT: Record<string, { air: number; land: number; sea: number; space: number; primary: string; note: string }> = {
  US: { air: 95, land: 75, sea: 90, space: 98, primary: "Space + Air",  note: "Cancer Asc + Mars 10H. Mercury-Saturn yoga = cyber/space." },
  CN: { air: 70, land: 88, sea: 92, space: 80, primary: "Sea + Land",   note: "Libra Asc, Scorpio Moon. Naval expansion via Jupiter aspect on 7H." },
  RU: { air: 78, land: 95, sea: 70, space: 88, primary: "Land + Space", note: "Sagittarius rising. Mars exalted = artillery & strategic." },
  IN: { air: 88, land: 80, sea: 75, space: 85, primary: "Air + Cyber",  note: "Taurus Asc, exalted Mercury. Strongest in IT, missile, air." },
  GB: { air: 72, land: 60, sea: 95, space: 65, primary: "Sea",          note: "Capricorn Asc + Moon Cancer = naval heritage." },
  FR: { air: 82, land: 70, sea: 78, space: 80, primary: "Air + Nuclear",note: "Scorpio Asc — strategic deterrent, aerospace." },
  DE: { air: 80, land: 90, sea: 65, space: 70, primary: "Land + Industry", note: "Capricorn 10H. Earthy triangle dominance." },
  JP: { air: 85, land: 60, sea: 92, space: 80, primary: "Sea + Tech",   note: "Cancer Asc. Pacific naval + robotics." },
  IL: { air: 90, land: 78, sea: 60, space: 88, primary: "Air + Cyber",  note: "Leo Asc + Mars-Mercury yoga." },
  KR: { air: 85, land: 75, sea: 80, space: 78, primary: "Tech + Air",   note: "Virgo precision; Mercury strong." },
  TR: { air: 75, land: 88, sea: 82, space: 60, primary: "Land + Sea",   note: "Scorpio rising. Drone + naval projection." },
  BR: { air: 65, land: 92, sea: 78, space: 55, primary: "Land + Agri",  note: "Earthy power; Jupiter on Sagittarius = supply." },
  IR: { air: 78, land: 80, sea: 70, space: 65, primary: "Land + Asymmetric", note: "Cancer Asc, Mars-Rahu yoga." },
  PK: { air: 78, land: 82, sea: 60, space: 55, primary: "Land + Nuclear", note: "Mars on Asc, Saturn 10H." },
  SA: { air: 70, land: 85, sea: 65, space: 55, primary: "Energy + Land", note: "Sun-Mars conjunct — oil sovereignty." },
  EG: { air: 65, land: 80, sea: 70, space: 50, primary: "Land + Sea",   note: "Suez geometry; Cancer 4H." },
  ID: { air: 60, land: 75, sea: 88, space: 50, primary: "Sea (archipelago)", note: "Scorpio 5H rare-earth." },
  AU: { air: 78, land: 75, sea: 90, space: 70, primary: "Sea + Space",  note: "Capricorn Asc + Pacific theatre." },
  CA: { air: 75, land: 80, sea: 78, space: 68, primary: "Land + Resource", note: "Cancer Asc; Arctic frontier." },
  MX: { air: 60, land: 78, sea: 70, space: 45, primary: "Land",         note: "Virgo Asc, agricultural & industrial." },
  NG: { air: 60, land: 85, sea: 70, space: 40, primary: "Land + Energy",note: "Mars on Libra. Population yoga." },
  ZA: { air: 60, land: 80, sea: 75, space: 50, primary: "Land + Mineral", note: "Capricorn — mining & rare metals." },
  BD: { air: 55, land: 70, sea: 75, space: 35, primary: "Sea (delta)",  note: "Cancer Asc. Climate-water leverage." },
  ES: { air: 70, land: 72, sea: 80, space: 60, primary: "Sea + Air",    note: "Mediterranean naval tradition." },
  IT: { air: 70, land: 70, sea: 82, space: 60, primary: "Sea + Air",    note: "Mediterranean carrier projection." },
  AR: { air: 65, land: 80, sea: 70, space: 50, primary: "Land + Agri",  note: "Sagittarius. Pampas exports." },
  VN: { air: 65, land: 80, sea: 78, space: 40, primary: "Land + Coastal Sea", note: "Mars + Saturn in Cancer = guerrilla doctrine." },
  TH: { air: 60, land: 75, sea: 70, space: 40, primary: "Land",         note: "Cancer Asc, Buddhist Jupiter." },
  PH: { air: 55, land: 60, sea: 82, space: 35, primary: "Sea (archipelago)", note: "Cancer 4H, Pacific archipelago." },
  UA: { air: 75, land: 88, sea: 65, space: 60, primary: "Land + Drone",  note: "Virgo, agricultural-military hybrid." },
};

// PROTOCOL summaries from the Zophiel report — surfaced in the UI as expandable cards.
export interface ProtocolEntry {
  id: string;
  title: string;
  target: string;
  technique: string;
  body: string;       // markdown-ish
  signal: string;     // active "watch this" signal
}

export const PROTOCOLS: ProtocolEntry[] = [
  { id: "war",      title: "1 · Sanghatta Rashi Protocol (War)",
    target: "Outbreak of war, terrorism, border conflicts",
    technique: "Mars–Saturn Vedha + Rahu/Ketu in fiery signs",
    signal: "Trigger: Moon enters afflicted fiery sign (1/5/9).",
    body: "WAR is guaranteed when Mars & Saturn cause mutual Vedha in the Sanghatta Chakra AND Jupiter is weak. With Jupiter aspect → cold war only. Active Vedha pairs through 2027 favor escalation in Eastern Europe & West Pacific." },
  { id: "crash",    title: "2 · Sarvatobhadra Crash Protocol",
    target: "Stock crashes, bank failure, sovereign default",
    technique: "Pancha Vedha (5-fold pierce) on national 'Arth' nakshatras",
    signal: "Watch Saturn pierce of US 2H/11H stars in 2027 window.",
    body: "Sun-Vedha = bear sentiment · Mars-Vedha = panic · Saturn-Vedha = depression · Rahu/Ketu = fraud bubbles. A Pancha Vedha (5 simultaneous pierces) collapses the regime or asset to zero." },
  { id: "disaster", title: "3 · Koorma Chakra (Natural Disasters)",
    target: "Earthquakes, tsunamis, pandemics by region",
    technique: "Tortoise mapping + 22nd-from-Sun (Mahakampa)",
    signal: "Saturn in 22nd nakshatra from Sun = major tremor.",
    body: "Saturn transit on regional nakshatra → famine/quake. Mars transit → fire/violence. The 'Suryat Bindu' pinpoints calamity windows: 8th=Shoola · 18th=Ketu · 21st=Ulka (meteor/blast) · 22nd=Mahakampa." },
  { id: "regime",   title: "4 · Eclipse & Sankranti Regime Change",
    target: "Coups, assassinations, leader removal",
    technique: "Path-of-totality + Mesha Sankranti chart",
    signal: "Solar eclipse hours = years of effect. Watch Mars/Saturn re-hit eclipse degree.",
    body: "If totality crosses a capital, the regime falls within the eclipse cycle. Trigger fires when Mars or Saturn later transits the exact eclipse degree." },
  { id: "siege",    title: "5 · Kota Chakra Fortress Protocol",
    target: "Capital city sieges, leader assassination",
    technique: "Stambha (4th, 11th, 18th, 25th from leader's nakshatra)",
    signal: "Two malefics inside Stambha + benefics in Bahya = Durga Bhanga.",
    body: "Benefics in Stambha = leader invincible. Malefics inside while benefics flee to the moat = the fortress falls. Exact day = arrival of 2nd malefic." },
  { id: "weather",  title: "6 · Sapta Nadi (Weather & Commodities)",
    target: "Drought, flood, harvest failure → futures",
    technique: "7 atmospheric Nadis tracked by planet position",
    signal: "Saturn in Dahana (fire) Nadi = oil & gold spike.",
    body: "Drought when planets cluster in Chanda/Vayu/Dahana. Flood when Sun+Mars join Moon/Venus in Jala/Amrita. Direct play: long grain on drought, short insurance on flood." },
  { id: "argha",    title: "7 · Argha Kand (Price Forecasting)",
    target: "Gold, silver, oil price moves",
    technique: "Graha Bhakti + sign rulership of commodity",
    signal: "Mars/Sun → Leo = Gold spike. Saturn/Rahu afflicting Scorpio = Oil supply shock.",
    body: "Bull when benefics retrograde or transit commodity sign. Mars–Saturn samasaptaka across Taurus/Scorpio or Leo/Aquarius = global financial panic." },
  { id: "rohini",   title: "8 · Rohini & Garbha Rain Protocol",
    target: "Long-term harvest & rainfall forecast",
    technique: "Sun→Rohini ingress (~May 25) + Margashirsha cloud-conception",
    signal: "Rain on Rohini ingress day = monsoon arrives 72 days later.",
    body: "If Sun's entry into Rohini is dry/hot → drought guaranteed (short grain). Margashirsha eastward winds → good monsoon; southward → famine." },
  { id: "shoola",   title: "9 · Shoola Chakra (Trident of Death)",
    target: "Battlefield outcome, regime end, attack direction",
    technique: "Trishula = 1/5/9 from Rudra (8H lord sign)",
    signal: "Shoola Dasha hitting Trishula sign = regime expiry window.",
    body: "Direction of attack = direction of strongest malefic at war declaration. Defend the OPPOSITE direction." },
  { id: "totality", title: "10 · Eclipse Totality Capital Rule",
    target: "Pinpoint city of regime collapse",
    technique: "Physical umbra path over capital",
    signal: "Capital under 100% shadow → leader falls within eclipse cycle.",
    body: "Effect is ONLY where eclipse is visible. Years (solar) or months (lunar) of duration = hours of eclipse. Trigger = later Mars/Saturn re-hit on eclipse degree." },
];

// Concrete forecast windows synthesized from the protocols (for the 'Predictions Timeline').
export interface ForecastEvent {
  date: string;          // YYYY-MM or YYYY-MM-DD
  era: "Past" | "Present" | "Future";
  region: string;
  flag: string;
  protocol: string;      // protocol id
  headline: string;
  detail: string;
}

export const FORECASTS: ForecastEvent[] = [
  { date: "1991-12", era: "Past",    region: "Soviet Union", flag: "☭", protocol: "regime",
    headline: "USSR Dissolution — Pancha Vedha confirmed",
    detail: "Saturn pierced national arth-stars while eclipse path of Jul-1991 crossed Moscow latitude band." },
  { date: "2008-09", era: "Past",    region: "United States", flag: "🇺🇸", protocol: "crash",
    headline: "Lehman Crash — Mars/Saturn samasaptaka Leo–Aquarius",
    detail: "Argha Kand bear signal triggered by Saturn affliction of US 2H stars." },
  { date: "2020-03", era: "Past",    region: "Global", flag: "🌐", protocol: "disaster",
    headline: "COVID Pandemic — Saturn entered Capricorn (Earthy disaster triangle)",
    detail: "Jupiter–Saturn–Pluto stellium amplified Koorma central region affliction." },

  { date: "2026-Q3", era: "Present", region: "Eastern Europe", flag: "🇺🇦", protocol: "war",
    headline: "Active Mars–Saturn Vedha — escalation window",
    detail: "Moon-trigger dates: Aug 14, Sep 11, Oct 9 (Moon in fiery signs)." },
  { date: "2026-12", era: "Present", region: "United States", flag: "🇺🇸", protocol: "crash",
    headline: "Saturn approaches US 2H Pisces — earnings shock",
    detail: "Watch financial sector. Pancha Vedha incomplete (3/5) — bear, not collapse." },
  { date: "2027-04", era: "Present", region: "China", flag: "🇨🇳", protocol: "weather",
    headline: "Sapta Nadi → Jala overflow",
    detail: "Yangtze flood probability elevated; insurance & infra stocks at risk." },

  { date: "2028-08", era: "Future",  region: "Russia", flag: "🇷🇺", protocol: "shoola",
    headline: "Trishula on Rudra sign — regime transition",
    detail: "Shoola Dasha hits 9th from Rudra during eclipse cycle." },
  { date: "2031-05", era: "Future",  region: "India", flag: "🇮🇳", protocol: "regime",
    headline: "Sun mahadasha begins — ascent to #1",
    detail: "Sankranti Purusha names India 'King of Year' through 2049." },
  { date: "2033-08", era: "Future",  region: "United States", flag: "🇺🇸", protocol: "totality",
    headline: "Eclipse band sweeps Atlantic seaboard",
    detail: "Capital risk: re-trigger by Saturn transit on eclipse degree late 2034." },
  { date: "2038-11", era: "Future",  region: "China", flag: "🇨🇳", protocol: "argha",
    headline: "Naval/Space peak — Jupiter return on Cancer 10H",
    detail: "Yuan reserve-currency yoga active. Gold paired short-term spike." },
  { date: "2046-03", era: "Future",  region: "Nigeria", flag: "🇳🇬", protocol: "siege",
    headline: "Stambha test — capital pressure",
    detail: "Two malefics enter Abuja chart Stambha; benefic flight risk to Bahya." },
];
