/**
 * VEDIC CONTEXT BUILDER — server-side (Deno) port of the client GlobalChartTab.
 *
 * Produces a deterministic JSON snapshot of the current world mundane sky:
 *   - Live sidereal (Lahiri) longitudes of the 9 grahas.
 *   - The most recent Mesha Sankranti moon → global Vimshottari dasha
 *     (Mahadasha → Antardasha → Pratyantardasha), computed via the
 *     Bishop / dasha.ts algorithm (pure JS, no dependencies).
 *   - Top affected nations from COUNTRY_CORE — for each nation we compute
 *     that country's natal Sun sidereal sign once, then count how many
 *     transiting planets fall in angular (1/4/7/10) or dusthana (6/8/12)
 *     signs from that sun sign, weighted by malefic/benefic character
 *     and slow-planet dominance.
 *
 * The output is designed to be inlined into the AXRLEN prompt so Gemini
 * receives Vedic timing as DATA, not as instructions to hallucinate.
 */
import * as A from "https://esm.sh/astronomy-engine@2.1.19";

// ─────────────────────────── Ephemeris helpers ───────────────────────────

const OBLIQUITY = 23.4367; // deg, mean obliquity, good to arcmin over 21st century

/** Lahiri (Chitrapaksha) ayanamsa, arcsec drift ~50.29"/year from J2000. */
function lahiriAyanamsa(date: Date): number {
  const jd = A.MakeTime(date).ut + 2451545.0;
  const yearsFromJ2000 = (jd - 2451545.0) / 365.25;
  return 23.85 + (yearsFromJ2000 * 50.2564) / 3600;
}

/** Mean longitude of Moon's ascending node (Rahu), deg — Meeus formula. */
function meanNodeLongitude(date: Date): number {
  const T = (A.MakeTime(date).ut) / 36525;
  // Ω = 125.0445222 − 1934.1362608*T + 0.0020708*T² + T³/450000
  let om = 125.0445222 - 1934.1362608 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  return ((om % 360) + 360) % 360;
}

const norm360 = (d: number) => ((d % 360) + 360) % 360;

export interface SiderealPlanet {
  name: string;
  symbol: string;
  siderealLon: number; // 0..360 sidereal Lahiri
  signIndex: number;   // 0..11 (0=Aries)
  signName: string;
  degInSign: number;
  retrograde: boolean;
}

const RASHIS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SYMS: Record<string, string> = {
  Sun: "☉", Moon: "☾", Mars: "♂", Mercury: "☿", Jupiter: "♃",
  Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};

/** Compute the 9 grahas at `date` in sidereal Lahiri longitude. */
export function computeGrahas(date: Date): SiderealPlanet[] {
  const ay = lahiriAyanamsa(date);
  const out: SiderealPlanet[] = [];
  const bodies: Array<{ name: string; body: A.Body }> = [
    { name: "Sun", body: A.Body.Sun },
    { name: "Moon", body: A.Body.Moon },
    { name: "Mercury", body: A.Body.Mercury },
    { name: "Venus", body: A.Body.Venus },
    { name: "Mars", body: A.Body.Mars },
    { name: "Jupiter", body: A.Body.Jupiter },
    { name: "Saturn", body: A.Body.Saturn },
  ];
  for (const { name, body } of bodies) {
    const eq = A.Ecliptic(A.GeoVector(body, date, true));
    // Retrograde detection: compare longitude 6 hours ahead
    const eq2 = A.Ecliptic(A.GeoVector(body, new Date(date.getTime() + 6 * 3600_000), true));
    const dLon = ((eq2.elon - eq.elon + 540) % 360) - 180;
    const retro = name !== "Sun" && name !== "Moon" && dLon < 0;
    const sid = norm360(eq.elon - ay);
    out.push({
      name, symbol: SYMS[name], siderealLon: sid,
      signIndex: Math.floor(sid / 30), signName: RASHIS[Math.floor(sid / 30)],
      degInSign: sid % 30, retrograde: retro,
    });
  }
  // Rahu / Ketu — mean node (true node would need SearchMoonNode, negligible for mundane use)
  const nodeTrop = meanNodeLongitude(date);
  const rahuSid = norm360(nodeTrop - ay);
  out.push({
    name: "Rahu", symbol: SYMS.Rahu, siderealLon: rahuSid,
    signIndex: Math.floor(rahuSid / 30), signName: RASHIS[Math.floor(rahuSid / 30)],
    degInSign: rahuSid % 30, retrograde: true,
  });
  const ketuSid = norm360(rahuSid + 180);
  out.push({
    name: "Ketu", symbol: SYMS.Ketu, siderealLon: ketuSid,
    signIndex: Math.floor(ketuSid / 30), signName: RASHIS[Math.floor(ketuSid / 30)],
    degInSign: ketuSid % 30, retrograde: true,
  });
  return out;
}

// ─────────────────────────── Vimshottari Dasha ───────────────────────────
// Ported verbatim from src/lib/vedic/dasha.ts (Bishop algorithm).

const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"] as const;
type DashaLord = typeof DASHA_ORDER[number];
const DASHA_YEARS: Record<DashaLord, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
const NAK_LORDS: DashaLord[] = [
  ...DASHA_ORDER, ...DASHA_ORDER, ...DASHA_ORDER,
];
const NAK_SPAN = 360 / 27;
const SID_YR_MS = 365.25636 * 86400_000;

export interface DashaLevel {
  lord: DashaLord;
  start: string; // ISO
  end: string;   // ISO
  years: number;
}

function subdivide(parentLord: DashaLord, startMs: number, endMs: number): Array<{ lord: DashaLord; start: number; end: number }> {
  const pIdx = DASHA_ORDER.indexOf(parentLord);
  const total = endMs - startMs;
  const out: Array<{ lord: DashaLord; start: number; end: number }> = [];
  let cursor = startMs;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(pIdx + i) % 9];
    const dur = (DASHA_YEARS[lord] / 120) * total;
    out.push({ lord, start: cursor, end: cursor + dur });
    cursor += dur;
  }
  return out;
}

export interface DashaSnapshot {
  epochUtc: string;
  moonSidereal: number;
  maha: DashaLevel;
  antar: DashaLevel;
  pratyantar: DashaLevel;
}

/** Compute the currently active Maha/Antar/Pratyantar from a natal moon. */
export function currentDasha(birthUtc: Date, moonSidDeg: number, nowMs = Date.now()): DashaSnapshot {
  const deg = norm360(moonSidDeg);
  const nakIdx = Math.min(Math.floor(deg / NAK_SPAN), 26);
  const birthLord = NAK_LORDS[nakIdx];
  const elapsed = (deg - nakIdx * NAK_SPAN) / NAK_SPAN;
  const remainYears = DASHA_YEARS[birthLord] * (1 - elapsed);
  const startIdx = DASHA_ORDER.indexOf(birthLord);

  let cursorMs = birthUtc.getTime();
  // Build maha list until we bracket nowMs
  const mahas: Array<{ lord: DashaLord; start: number; end: number; years: number }> = [];
  {
    const dur = remainYears * SID_YR_MS;
    mahas.push({ lord: birthLord, start: cursorMs, end: cursorMs + dur, years: remainYears });
    cursorMs += dur;
  }
  for (let i = 1; i < 30 && cursorMs < nowMs + SID_YR_MS * 20; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const dur = DASHA_YEARS[lord] * SID_YR_MS;
    mahas.push({ lord, start: cursorMs, end: cursorMs + dur, years: DASHA_YEARS[lord] });
    cursorMs += dur;
  }
  const maha = mahas.find((m) => nowMs >= m.start && nowMs < m.end)!;
  const antars = subdivide(maha.lord, maha.start, maha.end);
  const antar = antars.find((a) => nowMs >= a.start && nowMs < a.end)!;
  const praty = subdivide(antar.lord, antar.start, antar.end);
  const p = praty.find((x) => nowMs >= x.start && nowMs < x.end)!;
  const toLvl = (x: { lord: DashaLord; start: number; end: number; years?: number }): DashaLevel => ({
    lord: x.lord, start: new Date(x.start).toISOString(), end: new Date(x.end).toISOString(),
    years: (x.end - x.start) / SID_YR_MS,
  });
  return {
    epochUtc: birthUtc.toISOString(),
    moonSidereal: deg,
    maha: toLvl(maha), antar: toLvl(antar), pratyantar: toLvl(p),
  };
}

// ─────────────────── Mesha Sankranti (world natal moon) ──────────────────

/**
 * Most recent Mesha Sankranti = when the sidereal Sun crosses 0° Aries.
 * We bisect around Apr 12–16 UTC using computeGrahas().
 */
export function meshaSankrantiEpoch(now = new Date()): Date {
  const year = now.getUTCFullYear();
  // Search window Apr 12 00:00 → Apr 16 23:59 UTC of current year; if now < that, go previous year.
  let lo = Date.UTC(year, 3, 12);
  let hi = Date.UTC(year, 3, 16, 23, 59);
  if (now.getTime() < lo) {
    lo = Date.UTC(year - 1, 3, 12);
    hi = Date.UTC(year - 1, 3, 16, 23, 59);
  }
  // Bisect where Sun sidereal longitude crosses from ~359 → ~0
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const sun = computeGrahas(new Date(mid)).find((p) => p.name === "Sun")!;
    if (sun.siderealLon > 180) lo = mid; else hi = mid;
    if (hi - lo < 60_000) break;
  }
  return new Date((lo + hi) / 2);
}

// ─────────────────────────── Country impact ──────────────────────────────
// Sub-set of COUNTRY_CHARTS covering the geopolitically active nations.
// (Full list lives in src/data/vedic/countryCharts.ts; we ship the top ~35
// here to keep the edge function lean — enough for AXRLEN's regions.)

interface CountryCore {
  code: string; name: string; flag: string; birthDate: string; tzOffset: number;
}
const COUNTRY_CORE: CountryCore[] = [
  { code: "US", name: "United States", flag: "🇺🇸", birthDate: "1776-07-04", tzOffset: -5 },
  { code: "CN", name: "China (PRC)", flag: "🇨🇳", birthDate: "1949-10-01", tzOffset: 8 },
  { code: "RU", name: "Russian Federation", flag: "🇷🇺", birthDate: "1991-12-25", tzOffset: 3 },
  { code: "IN", name: "India", flag: "🇮🇳", birthDate: "1947-08-15", tzOffset: 5.5 },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", birthDate: "1801-01-01", tzOffset: 0 },
  { code: "FR", name: "France", flag: "🇫🇷", birthDate: "1958-10-05", tzOffset: 1 },
  { code: "DE", name: "Germany", flag: "🇩🇪", birthDate: "1990-10-03", tzOffset: 1 },
  { code: "JP", name: "Japan", flag: "🇯🇵", birthDate: "1947-05-03", tzOffset: 9 },
  { code: "IL", name: "Israel", flag: "🇮🇱", birthDate: "1948-05-14", tzOffset: 2 },
  { code: "IR", name: "Iran", flag: "🇮🇷", birthDate: "1979-04-01", tzOffset: 3.5 },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", birthDate: "1932-09-23", tzOffset: 3 },
  { code: "TR", name: "Turkey", flag: "🇹🇷", birthDate: "1923-10-29", tzOffset: 2 },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", birthDate: "1991-08-24", tzOffset: 2 },
  { code: "KP", name: "North Korea", flag: "🇰🇵", birthDate: "1948-09-09", tzOffset: 9 },
  { code: "KR", name: "South Korea", flag: "🇰🇷", birthDate: "1948-08-15", tzOffset: 9 },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", birthDate: "1949-12-07", tzOffset: 8 },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", birthDate: "1947-08-14", tzOffset: 5.5 },
  { code: "BR", name: "Brazil", flag: "🇧🇷", birthDate: "1822-09-07", tzOffset: -3 },
  { code: "MX", name: "Mexico", flag: "🇲🇽", birthDate: "1810-09-16", tzOffset: -6 },
  { code: "CA", name: "Canada", flag: "🇨🇦", birthDate: "1867-07-01", tzOffset: -5 },
  { code: "AU", name: "Australia", flag: "🇦🇺", birthDate: "1901-01-01", tzOffset: 10 },
  { code: "EG", name: "Egypt", flag: "🇪🇬", birthDate: "1952-07-23", tzOffset: 2 },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", birthDate: "1994-04-27", tzOffset: 2 },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", birthDate: "1960-10-01", tzOffset: 1 },
  { code: "SY", name: "Syria", flag: "🇸🇾", birthDate: "1946-04-17", tzOffset: 2 },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", birthDate: "1811-07-05", tzOffset: -4 },
  { code: "PE", name: "Peru", flag: "🇵🇪", birthDate: "1821-07-28", tzOffset: -5 },
  { code: "AR", name: "Argentina", flag: "🇦🇷", birthDate: "1816-07-09", tzOffset: -3 },
  { code: "PS", name: "Palestine", flag: "🇵🇸", birthDate: "1988-11-15", tzOffset: 2 },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫", birthDate: "1919-08-19", tzOffset: 4.5 },
];

const MALEFICS = new Set(["Saturn", "Mars", "Rahu", "Ketu"]);
const BENEFICS = new Set(["Jupiter", "Venus"]);
const SLOW = new Set(["Saturn", "Jupiter", "Rahu", "Ketu"]);
// house index (1..12) → { weight, kind }
const HOUSE_WEIGHT: Record<number, { w: number; kind: "benefic" | "malefic" | "neutral" }> = {
  1: { w: 3, kind: "neutral" }, 2: { w: 2, kind: "benefic" }, 3: { w: 1, kind: "neutral" },
  4: { w: 3, kind: "neutral" }, 5: { w: 2, kind: "benefic" }, 6: { w: 2, kind: "malefic" },
  7: { w: 3, kind: "neutral" }, 8: { w: 3, kind: "malefic" }, 9: { w: 2, kind: "benefic" },
  10: { w: 3, kind: "neutral" }, 11: { w: 2, kind: "benefic" }, 12: { w: 2, kind: "malefic" },
};

export interface CountryImpact {
  code: string; name: string; flag: string;
  natalSunSign: string;
  benefits: number; stresses: number;
  kind: "malefic" | "benefic" | "mixed";
  hits: string[];
}

/** Score every country using its natal-Sun-sign as the H1 reference. */
export function scoreCountries(transits: SiderealPlanet[]): CountryImpact[] {
  const rows: CountryImpact[] = COUNTRY_CORE.map((c) => {
    const natal = new Date(`${c.birthDate}T12:00:00Z`);
    const natalSun = computeGrahas(natal).find((p) => p.name === "Sun")!;
    const asc = natalSun.signIndex * 30; // proxy: sun sign = H1
    let benefits = 0, stresses = 0;
    const hits: string[] = [];
    for (const p of transits) {
      if (p.name === "Moon") continue;
      const house = ((Math.floor(p.siderealLon / 30) - Math.floor(asc / 30) + 12) % 12) + 1;
      const hw = HOUSE_WEIGHT[house]; if (!hw) continue;
      const slow = SLOW.has(p.name) ? 2 : 1;
      const impact = hw.w * slow;
      const isMal = MALEFICS.has(p.name), isBen = BENEFICS.has(p.name);
      if (hw.kind === "malefic" && isMal) { stresses += impact; hits.push(`${p.symbol}H${house}`); }
      else if (hw.kind === "benefic" && isBen) { benefits += impact; hits.push(`${p.symbol}H${house}`); }
      else if (hw.kind === "neutral" && (isMal || isBen)) {
        if (isMal) stresses += Math.floor(impact / 2); else benefits += Math.floor(impact / 2);
        hits.push(`${p.symbol}H${house}`);
      }
    }
    const kind: CountryImpact["kind"] =
      stresses > benefits * 1.3 ? "malefic" :
      benefits > stresses * 1.3 ? "benefic" : "mixed";
    return { code: c.code, name: c.name, flag: c.flag, natalSunSign: natalSun.signName, benefits, stresses, kind, hits: hits.slice(0, 5) };
  });
  return rows.sort((a, b) => (b.stresses + b.benefits) - (a.stresses + a.benefits)).slice(0, 10);
}

// ─────────────────────────── Top-level builder ───────────────────────────

export interface VedicContext {
  builtAt: string;
  ayanamsa: number;
  meshaSankranti: { epochUtc: string; moonSign: string; moonSiderealDeg: number };
  globalDasha: DashaSnapshot;
  liveTransits: SiderealPlanet[];
  topAffectedNations: CountryImpact[];
  regionFocus?: {
    code: string; name: string;
    natalSunSign: string;
    activeHouses: Array<{ planet: string; house: number; sign: string; retrograde: boolean; kind: string }>;
  };
}

const MUNDANE_MEANING: Record<DashaLord, string> = {
  Sun: "Sovereigns, heads of state, executive power",
  Moon: "Public mood, crowds, food supply, women, water",
  Mercury: "Trade, commerce, communications, treaties",
  Venus: "Diplomacy, luxury, alliances, arts",
  Mars: "War, military, industry, fire, surgery",
  Jupiter: "Law, religion, judiciary, banks, expansion",
  Saturn: "Labor, scarcity, elderly, discipline, delays",
  Rahu: "Foreign powers, technology, disruption, pandemics",
  Ketu: "Endings, spiritual movements, sudden reversals",
};

export function buildVedicContext(regionCode?: string, now = new Date()): VedicContext {
  const ay = lahiriAyanamsa(now);
  const mesha = meshaSankrantiEpoch(now);
  const meshaMoon = computeGrahas(mesha).find((p) => p.name === "Moon")!;
  const dasha = currentDasha(mesha, meshaMoon.siderealLon, now.getTime());
  const transits = computeGrahas(now);
  const topNations = scoreCountries(transits);

  let regionFocus: VedicContext["regionFocus"];
  if (regionCode) {
    const c = COUNTRY_CORE.find((x) => x.code.toUpperCase() === regionCode.toUpperCase());
    if (c) {
      const natalSun = computeGrahas(new Date(`${c.birthDate}T12:00:00Z`)).find((p) => p.name === "Sun")!;
      const ascSign = natalSun.signIndex;
      const activeHouses = transits
        .filter((p) => p.name !== "Moon")
        .map((p) => {
          const house = ((p.signIndex - ascSign + 12) % 12) + 1;
          const hw = HOUSE_WEIGHT[house];
          const kind = hw.kind === "malefic" && MALEFICS.has(p.name) ? "high stress"
            : hw.kind === "benefic" && BENEFICS.has(p.name) ? "supportive"
            : MALEFICS.has(p.name) ? "mild stress" : BENEFICS.has(p.name) ? "mild support" : "neutral";
          return { planet: p.name, house, sign: p.signName, retrograde: p.retrograde, kind };
        })
        .filter((x) => HOUSE_WEIGHT[x.house]?.w >= 2)
        .sort((a, b) => (HOUSE_WEIGHT[b.house]?.w || 0) - (HOUSE_WEIGHT[a.house]?.w || 0))
        .slice(0, 8);
      regionFocus = { code: c.code, name: c.name, natalSunSign: natalSun.signName, activeHouses };
    }
  }

  return {
    builtAt: now.toISOString(),
    ayanamsa: Number(ay.toFixed(4)),
    meshaSankranti: {
      epochUtc: mesha.toISOString(),
      moonSign: meshaMoon.signName,
      moonSiderealDeg: Number(meshaMoon.siderealLon.toFixed(3)),
    },
    globalDasha: dasha,
    liveTransits: transits.map((p) => ({
      ...p,
      siderealLon: Number(p.siderealLon.toFixed(3)),
      degInSign: Number(p.degInSign.toFixed(3)),
    })),
    topAffectedNations: topNations,
    regionFocus,
  };
}

/** Terse Markdown block for prompt injection. */
export function vedicContextAsPromptBlock(ctx: VedicContext): string {
  const lines: string[] = [];
  lines.push("=== VEDIC MUNDANE SNAPSHOT (computed, not narrative) ===");
  lines.push(`Built: ${ctx.builtAt}  |  Ayanamsa (Lahiri): ${ctx.ayanamsa}°`);
  lines.push(`Mesha Sankranti epoch: ${ctx.meshaSankranti.epochUtc}  |  World natal Moon in ${ctx.meshaSankranti.moonSign} @ ${ctx.meshaSankranti.moonSiderealDeg.toFixed(2)}°`);
  lines.push("");
  lines.push("GLOBAL VIMSHOTTARI DASHA (active lords ruling the current cycle):");
  const d = ctx.globalDasha;
  lines.push(`  Mahadasha:      ${d.maha.lord}   (${d.maha.start.slice(0,10)} → ${d.maha.end.slice(0,10)})  — ${MUNDANE_MEANING[d.maha.lord]}`);
  lines.push(`  Antardasha:     ${d.antar.lord}   (${d.antar.start.slice(0,10)} → ${d.antar.end.slice(0,10)})  — ${MUNDANE_MEANING[d.antar.lord]}`);
  lines.push(`  Pratyantardasha:${d.pratyantar.lord}   (${d.pratyantar.start.slice(0,10)} → ${d.pratyantar.end.slice(0,10)})  — ${MUNDANE_MEANING[d.pratyantar.lord]}`);
  lines.push("");
  lines.push("LIVE SIDEREAL TRANSITS (Lahiri):");
  for (const p of ctx.liveTransits) {
    lines.push(`  ${p.symbol} ${p.name.padEnd(8)} ${p.signName.padEnd(11)} ${p.degInSign.toFixed(2).padStart(6)}°${p.retrograde ? "  ℞" : ""}`);
  }
  lines.push("");
  lines.push("TOP 10 AFFECTED NATIONS (transits vs natal Sun sign; angles+dusthanas weighted):");
  for (const n of ctx.topAffectedNations) {
    lines.push(`  ${n.flag} ${n.name.padEnd(24)} [${n.kind.padEnd(7)}] +${n.benefits}/-${n.stresses}   ${n.hits.join(" ")}`);
  }
  if (ctx.regionFocus) {
    lines.push("");
    lines.push(`REGION FOCUS — ${ctx.regionFocus.name} (natal Sun in ${ctx.regionFocus.natalSunSign}):`);
    for (const h of ctx.regionFocus.activeHouses) {
      lines.push(`  ${h.planet.padEnd(8)} in H${h.house} (${h.sign})${h.retrograde ? " ℞" : ""} — ${h.kind}`);
    }
  }
  lines.push("");
  lines.push("USE THIS AS DATA. Ground every Vedic claim in these exact lords, houses, and dates. Do not invent alternate dasha lords.");
  return lines.join("\n");
}
