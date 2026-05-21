/**
 * SENSITIVE POINTS — chart-specific anchors that determine WHY a transit matters.
 *
 * A transit reading without these is generic ("Jupiter in 9th = luck").
 * With these we can say: "Jupiter is walking into Cancer — the sign of your
 * Upapada Lagna. Jupiter activating UL = spouse manifestation window."
 *
 * Sensitive points we compute from the natal chart:
 *   - Lagna (Ascendant sign)
 *   - Chandra Lagna (Moon sign)
 *   - Surya Lagna (Sun sign)
 *   - Atmakaraka (AK) sign — planet with highest deg-in-sign (Jaimini, 7-planet system, no Rahu)
 *   - Darakaraka (DK) sign — planet with lowest deg-in-sign (spouse-significator)
 *   - Upapada Lagna (UL) sign — 12th from the sign of the 2nd-house lord (Jaimini spouse point)
 *   - 7th-lord sign — sign occupied by the lord of the 7th house from Lagna
 *
 * For each transiting planet, we then check: does its current sign coincide
 * with one of these points? If so, the transit gets a personalized "WHY THIS
 * MATTERS TO YOU" sentence pulled from PLANET_X_POINT lookup.
 */

import type { SweVedicPlanet } from "./sweChart";
import { rashis } from "@/data/nakshatraData";

// 0=Aries, 1=Taurus, ..., 11=Pisces
const SIGN_LORD: Record<number, string> = {
  0: "Mars",     // Aries
  1: "Venus",    // Taurus
  2: "Mercury",  // Gemini
  3: "Moon",     // Cancer
  4: "Sun",      // Leo
  5: "Mercury",  // Virgo
  6: "Venus",    // Libra
  7: "Mars",     // Scorpio (Ketu co-rules — keep classical)
  8: "Jupiter",  // Sagittarius
  9: "Saturn",   // Capricorn
  10: "Saturn",  // Aquarius
  11: "Jupiter", // Pisces
};

export type PointCode = "Lagna" | "Chandra" | "Surya" | "AK" | "DK" | "UL" | "L7" | "L2" | "L5" | "L9" | "L11";

export interface SensitivePoint {
  code: PointCode;
  label: string;
  signIndex: number;        // 0..11
  signName: string;
  /** Plain-English description of what this point IS in your chart. */
  explanation: string;
}

export interface SensitivePoints {
  byCode: Record<PointCode, SensitivePoint>;
  /** Convenient lookup: signIndex → all points sitting in that sign */
  bySign: Map<number, SensitivePoint[]>;
}

function signOf(deg: number) { return Math.floor(((deg % 360) + 360) % 360 / 30); }
function degInSign(deg: number) { return ((deg % 30) + 30) % 30; }

export function computeSensitivePoints(planets: SweVedicPlanet[], ascendant: number): SensitivePoints {
  const ascSign = signOf(ascendant);
  const moon = planets.find((p) => p.name === "Moon");
  const sun  = planets.find((p) => p.name === "Sun");
  const moonSign = moon ? signOf(moon.sid) : ascSign;
  const sunSign  = sun ? signOf(sun.sid) : ascSign;

  // Jaimini karakas — use Sun..Saturn (7-planet system, no nodes)
  const karakaCandidates = planets.filter((p) =>
    ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"].includes(p.name)
  );
  const sorted = [...karakaCandidates].sort((a, b) => degInSign(b.sid) - degInSign(a.sid));
  const ak = sorted[0];
  const dk = sorted[sorted.length - 1];

  // 2nd house from Lagna
  const sign2 = (ascSign + 1) % 12;
  const lord2Name = SIGN_LORD[sign2];
  const lord2Planet = planets.find((p) => p.name === lord2Name);
  const lord2Sign = lord2Planet ? signOf(lord2Planet.sid) : sign2;
  // UL: classical = 12th from sign of 2nd lord
  const ulSign = (lord2Sign + 11) % 12;

  // Generic helper: sign of the lord of house N (1..12)
  const lordSignOfHouse = (houseN: number): number => {
    const sign = (ascSign + (houseN - 1)) % 12;
    const lordName = SIGN_LORD[sign];
    const lordPlanet = planets.find((p) => p.name === lordName);
    return lordPlanet ? signOf(lordPlanet.sid) : sign;
  };
  const lord2Sign_ = lord2Sign;
  const lord5Sign = lordSignOfHouse(5);
  const lord7Sign = lordSignOfHouse(7);
  const lord9Sign = lordSignOfHouse(9);
  const lord11Sign = lordSignOfHouse(11);

  const mk = (code: PointCode, label: string, signIndex: number, explanation: string): SensitivePoint => ({
    code, label, signIndex, signName: rashis[signIndex].name, explanation,
  });

  const byCode: Record<PointCode, SensitivePoint> = {
    Lagna:   mk("Lagna",   "Ascendant (Lagna)",         ascSign,  "The sign rising at your birth — directly your body, identity, vitality, and how the world meets you."),
    Chandra: mk("Chandra", "Moon Sign (Chandra Lagna)", moonSign, "Where your Moon sits — emotional weather, the daily mind, mother, public-facing comfort."),
    Surya:   mk("Surya",   "Sun Sign (Surya Lagna)",    sunSign,  "Where your Sun sits — soul-vitality, ego, father, authority signature."),
    AK:      mk("AK",      `Atmakaraka — ${ak?.name ?? "—"}`, ak ? signOf(ak.sid) : ascSign,
              `Your Atmakaraka is ${ak?.name ?? "—"} — the planet that took the highest degree at your birth. It carries the deepest agenda of this incarnation. Transits through its sign move the soul-mission directly.`),
    DK:      mk("DK",      `Darakaraka — ${dk?.name ?? "—"}`, dk ? signOf(dk.sid) : ascSign,
              `Your Darakaraka is ${dk?.name ?? "—"} — the planet at the lowest degree. In Jaimini, it describes the nature of your spouse / serious partner.`),
    UL:      mk("UL",      "Upapada Lagna (UL)",        ulSign,
              "The Upapada Lagna is the most precise spouse / soulmate indicator in Jaimini astrology. It is NOT a house — it is a calculated sensitive sign that describes who your spouse is and when they arrive. When a planet (especially Jupiter or Venus) transits this sign, the energy of that sign — your spouse — gets lit up in real life."),
    L7:      mk("L7",      "Lord of 7th",               lord7Sign,
              "The sign where your 7th-house lord currently resides — the field where partnerships, marriage, and one-on-one alliances actually play out for you."),
    L2:      mk("L2",      "Lord of 2nd (Dhana)",       lord2Sign_,
              "Sign where your 2nd-house lord (Dhana — accumulated wealth, savings, family money) currently lives. Benefic transits here = the savings vault is being filled."),
    L5:      mk("L5",      "Lord of 5th (Purva Punya)", lord5Sign,
              "Sign where your 5th-house lord (purva punya — past-life merit, speculation, intelligence, children) lives. Benefic transits here unlock lucky breaks, speculative wins, and creative income."),
    L9:      mk("L9",      "Lord of 9th (Bhagya)",      lord9Sign,
              "Sign where your 9th-house lord (Bhagya — fortune, dharma, divine grace, father) lives. The single most important wealth-luck axis. Benefic transits here = the fortune engine turns on."),
    L11:     mk("L11",     "Lord of 11th (Labha)",      lord11Sign,
              "Sign where your 11th-house lord (Labha — large gains, fulfilment of desires, network income) lives. Benefic transits here = income streams swell; big payouts arrive."),
  };

  const bySign = new Map<number, SensitivePoint[]>();
  for (const sp of Object.values(byCode)) {
    const list = bySign.get(sp.signIndex) ?? [];
    list.push(sp);
    bySign.set(sp.signIndex, list);
  }
  return { byCode, bySign };
}

// ── Why-this-matters narrative for transit × sensitive-point combos ──
// Keyed by `${planet}|${pointCode}`. If a combo isn't here, we fall back to a
// generic line built from the point's explanation.

const COMBO_REASON: Record<string, string> = {
  // Jupiter — manifestation, expansion, blessing
  "Jupiter|UL":      "Jupiter is the planet of manifestation and blessing. Your Upapada Lagna is the spouse-point. Jupiter walking through this sign = the spouse energy in your chart is being illuminated in real life. Strongest spouse-arrival window of the cycle.",
  "Jupiter|DK":      "Jupiter is now in the sign of your Darakaraka — your spouse-significator. Marriage-quality opportunities, introductions, or the deepening of an existing partnership become possible.",
  "Jupiter|L7":      "Jupiter is transiting the sign your 7th-house lord lives in. The 'partnership theater' of your chart is being expanded and blessed — proposals, alliances, deal-closures.",
  "Jupiter|Lagna":   "Jupiter is on your Ascendant sign — body, identity, presence. People perceive you as more trustworthy, larger, wiser. A reinvention/expansion window for the self.",
  "Jupiter|Chandra": "Jupiter is transiting your Moon sign. Emotional expansion, peace, optimism, mother/home gains. Classically one of the most fortunate Jupiter transits.",
  "Jupiter|Surya":   "Jupiter is on your Sun sign — recognition, authority, father, dharma. Career visibility tied to your purpose grows.",
  "Jupiter|AK":      "Jupiter is in the sign of your Atmakaraka. Your soul-mission gets divine wind. Long-range purpose moves forward visibly.",

  // Venus — love, beauty, value
  "Venus|UL":     "Venus is on your Upapada Lagna sign — pure romantic activation of the spouse-point. Beauty, attraction, and romantic possibility lit up directly.",
  "Venus|DK":     "Venus is in the sign of your Darakaraka — your spouse-significator. A high romantic-magnetism window; partnership themes intensify.",
  "Venus|L7":     "Venus is in the sign where your 7th-lord lives — partnership pleasure, harmony with the other, and aesthetic upgrades to relationships.",
  "Venus|Lagna":  "Venus on your Ascendant sign — beauty, magnetism, body looks better, people are drawn to you.",
  "Venus|Chandra":"Venus on your Moon sign — emotional sweetness, indulgence, comfort, women-related gains.",

  // Saturn — discipline, delay, karma
  "Saturn|Chandra":"Saturn is transiting your Moon sign. This is the heart of Sade Sati — the famous 7.5-year karmic pressure cycle on your mind, emotions, and public life. Slow, structural rewrite of your inner world.",
  "Saturn|Lagna":  "Saturn is on your Ascendant sign — body and identity get pressure-tested. Aging, responsibility, restructuring of self. Hard but real.",
  "Saturn|UL":     "Saturn is in your Upapada Lagna sign. Spouse / serious partnership matters slow down, become more serious, or get karmically pruned. Marriages formed here are weighty and binding.",
  "Saturn|DK":     "Saturn is in your Darakaraka sign — testing the partnership karma. Existing bonds are stress-tested; new ones come with age, duty, or distance.",
  "Saturn|L7":     "Saturn is in the sign where your 7th-lord lives. Partnerships demand maturity, commitment, or hard work to maintain.",
  "Saturn|AK":     "Saturn is on your Atmakaraka sign — the soul-purpose is being structurally rebuilt. Slow, mandatory, character-forging.",

  // Rahu — obsession, foreign, breakthrough
  "Rahu|UL":     "Rahu is on your Upapada Lagna. Spouse arrival becomes unusual, foreign, online, or outside your normal circle. Intensity high; clarity low — verify before committing.",
  "Rahu|DK":     "Rahu is in your Darakaraka sign — magnetic, obsessive, unconventional pull toward partnership. Beware projection.",
  "Rahu|AK":     "Rahu is on your Atmakaraka — your soul-mission gets a Rahu-style amplifier: ambition, foreign opportunities, breakthroughs, but also illusion. Big leap energy.",
  "Rahu|Lagna":  "Rahu on your Ascendant — identity goes through a metamorphosis. New look, new circles, sometimes a feeling of 'not yourself'.",
  "Rahu|Chandra":"Rahu on your Moon sign — mind under foreign / obsessive influence. Sleep disrupted, cravings rise, intuition gets noisy.",

  // Ketu — detachment, mysticism, severance
  "Ketu|UL":     "Ketu in your Upapada Lagna — detachment from spouse-themes. Existing bonds may quietly dissolve; not a window to push for marriage.",
  "Ketu|DK":     "Ketu in your Darakaraka sign — partnerships feel hollow or finish a karmic chapter. Healing through endings.",
  "Ketu|AK":     "Ketu on your Atmakaraka — moksha pressure. The soul wants to drop the role it's been playing. Spiritual breakthroughs possible; worldly ambition feels empty.",
  "Ketu|Lagna":  "Ketu on your Ascendant — identity dissolves quietly. You stop caring about how you appear. A withdrawal phase.",
  "Ketu|Chandra":"Ketu on your Moon sign — emotional detachment, confusion, isolation pull. Spiritual practice carries you through.",

  // Mars
  "Mars|Lagna":  "Mars on your Ascendant — physical drive, courage, but also short fuse and accident risk. Move bodies, not arguments.",
  "Mars|UL":     "Mars in your Upapada Lagna — passion in spouse-matters, but also conflict. Use carefully.",

  // Sun
  "Sun|Lagna":   "Sun on your Ascendant sign — visibility, authority, ego forward. People see you.",
  "Sun|Surya":   "Sun returns to its natal sign — your annual 'solar return' field. Reset point for vitality and direction.",

  // Moon
  "Moon|Chandra":"Moon returns to your natal Moon sign — emotional 'home', clearer instincts, peak intuition for ~2.5 days.",
};

export interface WhyReason {
  pointCode: PointCode;
  pointLabel: string;
  signName: string;
  text: string;        // the personalized "why this matters TO YOU" sentence
  importance: "high" | "medium" | "low";
}

const HIGH_POINTS = new Set<PointCode>(["UL", "AK", "DK", "Chandra", "Lagna", "L9", "L11", "L2"]);

export function whyTransitMatters(
  planet: string,
  signIndex: number,
  points: SensitivePoints | null,
): WhyReason[] {
  if (!points) return [];
  const hits = points.bySign.get(signIndex) ?? [];
  return hits.map((sp) => {
    const key = `${planet}|${sp.code}`;
    const custom = COMBO_REASON[key];
    const importance: WhyReason["importance"] = HIGH_POINTS.has(sp.code) ? "high" : "medium";
    const text = custom
      ?? `${planet} is now transiting your ${sp.label} sign (${sp.signName}). ${sp.explanation} ${planet}'s energy gets routed directly into that field of your life.`;
    return { pointCode: sp.code, pointLabel: sp.label, signName: sp.signName, text, importance };
  });
}
