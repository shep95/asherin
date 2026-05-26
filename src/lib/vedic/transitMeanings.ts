/**
 * TRANSIT MEANINGS — deterministic, non-AI interpretations.
 * Built from classical Vedic significations (karaka) combined with house themes.
 * No probabilistic text — pure lookup so the same input always returns the same reading.
 */

export const PLANET_TONE: Record<string, { tone: string; karaka: string; favors: string; warns: string }> = {
  Sun:     { tone: "spotlight, authority, ego",           karaka: "self, vitality, father, government",        favors: "leadership, recognition, asserting your truth",       warns: "ego clashes, burnout, conflict with authority" },
  Moon:    { tone: "emotion, public mood, instinct",      karaka: "mind, mother, public, comfort",             favors: "rest, intuition, reading the room",                  warns: "mood swings, over-attachment, sleep disruption" },
  Mars:    { tone: "drive, friction, action",             karaka: "energy, courage, brothers, conflict",        favors: "execution, training, surgical decisions",            warns: "anger, accidents, picking fights you'll regret" },
  Mercury: { tone: "thought, words, deal-making",         karaka: "speech, intellect, commerce, contracts",    favors: "writing, negotiation, study, short trips",           warns: "miscommunication, gossip, hasty contracts" },
  Jupiter: { tone: "expansion, wisdom, grace",            karaka: "wealth, teachers, dharma, children",         favors: "study, mentorship, signing big deals, marriage",     warns: "overconfidence, weight gain, excess" },
  Venus:   { tone: "love, beauty, value",                 karaka: "partner, art, money, luxury",                favors: "romance, design, fashion, finalizing partnerships",  warns: "indulgence, vanity, financial leakage" },
  Saturn:  { tone: "discipline, delay, structure",        karaka: "time, labor, elders, karma",                 favors: "long-term builds, structure, hard work paying off",  warns: "delays, isolation, depression, chronic strain" },
  Rahu:    { tone: "obsession, illusion, foreign",        karaka: "ambition, technology, scandal, outsiders",  favors: "innovation, breakthroughs, foreign opportunities",   warns: "deception, addiction, getting lost in fantasy" },
  Ketu:    { tone: "detachment, mysticism, cut-off",      karaka: "moksha, occult, past-life skills",          favors: "spiritual practice, research, finishing the past",   warns: "isolation, confusion, sudden endings, losses" },
};

export const HOUSE_THEME: Record<number, { title: string; domain: string; positive: string; negative: string }> = {
  1:  { title: "Self / Body",                domain: "identity, appearance, vitality",            positive: "reinvention, personal momentum, visibility",        negative: "health strain, identity crisis, body weight shifts" },
  2:  { title: "Wealth & Family",            domain: "money, savings, speech, family",            positive: "income spikes, family gains, persuasive speech",    negative: "expenditure, family friction, harsh words" },
  3:  { title: "Courage & Siblings",         domain: "willpower, siblings, short trips, skills",  positive: "bold moves, new skills, allies in siblings",        negative: "sibling conflict, restlessness, risky bravado" },
  4:  { title: "Home & Heart",               domain: "mother, real estate, vehicles, emotions",   positive: "home upgrade, property gain, emotional roots",      negative: "domestic conflict, moving stress, mother's health" },
  5:  { title: "Creativity & Children",      domain: "romance, children, intellect, speculation", positive: "creative output, fertility, lucky breaks",          negative: "speculative losses, drama with kids/lovers" },
  6:  { title: "Enemies, Health, Service",   domain: "debts, disease, daily work, rivals",        positive: "defeating enemies, healing routines, work wins",    negative: "illness, debt, workplace conflict" },
  7:  { title: "Partners",                   domain: "spouse, business partners, public",         positive: "partnerships, marriage prospects, deal closures",   negative: "partnership friction, divorce risk, public disputes" },
  8:  { title: "Occult & Transformation",    domain: "death, sex, inheritance, secrets",          positive: "deep insight, inheritance, transformative repair",  negative: "scandal, sudden loss, chronic illness, accidents" },
  9:  { title: "Dharma & Fortune",           domain: "father, gurus, long trips, philosophy",     positive: "luck, mentors appear, pilgrimage, higher learning", negative: "loss of faith, father's health, legal drag" },
  10: { title: "Career & Public Standing",   domain: "career, status, authority, action",         positive: "promotion, public recognition, big moves",          negative: "career stall, scandal, conflict with bosses" },
  11: { title: "Gains & Network",            domain: "income, elder siblings, large groups",      positive: "income, friends bring opportunities, goals close",  negative: "false friends, unrealized gains, network drain" },
  12: { title: "Loss, Spirituality, Foreign",domain: "expenses, hidden enemies, foreign lands",   positive: "spiritual depth, foreign success, hidden support",  negative: "losses, isolation, hospital, hidden enemies" },
};

export type Verdict = "yes-strong" | "yes" | "possible" | "delayed" | "unlikely";

export interface LifePrediction {
  question: string;
  verdict: Verdict;
  answer: string;       // short verdict phrase
  detail: string;       // why — references planet + house
}

export interface TransitReading {
  headline: string;
  meaning: string;
  favors: string;
  warns: string;
  weight: "high" | "medium" | "low";
  predictions: LifePrediction[];
  manifests: string[];  // concrete real-world events this transit tends to trigger
}

const HIGH_IMPACT = new Set(["Saturn", "Jupiter", "Rahu", "Ketu"]);
const LOW_IMPACT = new Set(["Moon"]);

// ── Specific life-area predictions ──────────────────────────────────────────
// For each area: which houses light it up, which planets boost vs block.
interface LifeArea {
  question: string;
  houses: number[];
  boosters: string[];
  blockers: string[];
  wild?: string[];     // unpredictable — Rahu-style
  inverted?: boolean;  // for health: malefics in dushtana = bad health
  boostText: string;
  blockText: string;
  wildText?: string;
}

const LIFE_AREAS: LifeArea[] = [
  {
    question: "Will you find love?",
    houses: [5, 7, 11],
    boosters: ["Venus", "Jupiter", "Moon"],
    blockers: ["Saturn", "Ketu", "Mars"],
    wild: ["Rahu"],
    boostText: "Romance is actively favored. Expect introductions, dates, or a relationship reaching a new stage.",
    blockText: "Love is delayed, cooled, or under stress. Existing bonds may feel distant; new ones struggle to ignite.",
    wildText: "Unusual or unconventional attractions — foreign, online, or someone outside your normal circle. Don't trust the high.",
  },
  {
    question: "Will you make money?",
    houses: [2, 11],
    boosters: ["Jupiter", "Venus", "Mercury", "Sun"],
    blockers: ["Saturn", "Ketu"],
    wild: ["Rahu", "Mars"],
    boostText: "Yes — active income flows in. Raises, side deals, bonuses, or new clients are all in play.",
    blockText: "Income tightens. Delays in payment, frozen deals, or shrinking pipeline. Conserve, don't spend.",
    wildText: "Money comes in sudden, irregular bursts — speculation, crypto, foreign deals, or commission. Volatile.",
  },
  {
    question: "Will you become wealthy / accumulate assets?",
    houses: [2, 4, 9, 11],
    boosters: ["Jupiter", "Venus"],
    blockers: ["Saturn", "Ketu", "Rahu"],
    boostText: "Long-term wealth building is supported — investments, property, savings compound visibly.",
    blockText: "Assets stagnate or leak. Avoid new debt and big-ticket purchases until this clears.",
  },
  {
    question: "Will your career advance?",
    houses: [1, 6, 10, 11],
    boosters: ["Sun", "Saturn", "Jupiter", "Mars"],
    blockers: ["Ketu", "Moon"],
    wild: ["Rahu"],
    boostText: "Career is being pushed forward — promotion, recognition, or a step up in responsibility.",
    blockText: "Career stalls or drifts. Motivation drops; visibility from leadership fades.",
    wildText: "An unexpected pivot — sudden offer, scandal, foreign role, or a leap into something new.",
  },
  {
    question: "Will your health hold up?",
    houses: [1, 6, 8, 12],
    boosters: ["Jupiter", "Venus"],
    blockers: ["Saturn", "Mars", "Rahu", "Ketu", "Sun"],
    inverted: true,
    boostText: "Healing and recovery favored. Good time to start a regimen, surgery if needed, or restore vitality.",
    blockText: "Strain on the body — chronic conditions flare, sleep suffers, accident risk rises. Slow down.",
  },
  {
    question: "Will you travel or relocate abroad?",
    houses: [3, 9, 12],
    boosters: ["Jupiter", "Mercury", "Moon"],
    blockers: ["Saturn", "Ketu"],
    wild: ["Rahu"],
    boostText: "Travel is supported — trips, study abroad, or a meaningful pilgrimage.",
    blockText: "Trips get cancelled, visas delay, or you're forced to stay put.",
    wildText: "Sudden, obsessive pull toward a foreign place — possible relocation or extended overseas stint.",
  },
  {
    question: "Will marriage or a major partnership form?",
    houses: [2, 7, 11],
    boosters: ["Jupiter", "Venus"],
    blockers: ["Saturn", "Mars", "Rahu", "Ketu"],
    boostText: "Strong window for engagement, marriage, or signing a major business partnership.",
    blockText: "Commitment delays, partner conflict, or a partnership in stress-test. Don't force a vow now.",
  },
  {
    question: "Will you grow spiritually or undergo transformation?",
    houses: [4, 8, 9, 12],
    boosters: ["Jupiter", "Ketu", "Saturn"],
    blockers: ["Venus", "Mercury"],
    boostText: "A real spiritual deepening — meditation, study, ritual, or genuine inner shift takes hold.",
    blockText: "Surface distractions pull you away from inner work. Hard to sit still.",
  },
  {
    question: "Will children, creativity, or speculation pay off?",
    houses: [5],
    boosters: ["Jupiter", "Venus", "Sun"],
    blockers: ["Saturn", "Ketu", "Mars", "Rahu"],
    boostText: "Creative projects land, fertility is favored, or a calculated bet pays off.",
    blockText: "Avoid speculation, gambling, or risky investments. Drama with children or lovers possible.",
  },
  {
    question: "Will education / learning / certifications advance?",
    houses: [2, 4, 5, 9],
    boosters: ["Jupiter", "Mercury", "Sun"],
    blockers: ["Saturn", "Rahu", "Ketu"],
    boostText: "Study, exams, certifications, or a teacher/mentor appears. Knowledge sticks.",
    blockText: "Concentration breaks, exams stall, or coursework drags. Push deadlines if possible.",
  },
  {
    question: "Will legal / contract / court matters resolve?",
    houses: [6, 7, 8, 9, 12],
    boosters: ["Jupiter", "Sun"],
    blockers: ["Saturn", "Mars", "Rahu", "Ketu"],
    boostText: "Verdicts swing your way, contracts get signed cleanly, disputes settle.",
    blockText: "Lawsuits drag, contracts hit friction, or a hidden clause backfires. Read everything twice.",
  },
  {
    question: "Will family / parents / home life be supported?",
    houses: [2, 4, 9],
    boosters: ["Jupiter", "Venus", "Moon", "Sun"],
    blockers: ["Saturn", "Mars", "Rahu", "Ketu"],
    boostText: "Family ties strengthen — visits, reconciliations, parent's health stable, home upgrades.",
    blockText: "Family friction, parent's health concern, or a domestic shake-up. Old wounds resurface.",
  },
  {
    question: "Will fame, reputation, or public visibility rise?",
    houses: [1, 7, 10],
    boosters: ["Sun", "Jupiter", "Venus"],
    blockers: ["Saturn", "Ketu"],
    wild: ["Rahu"],
    boostText: "Recognition arrives — press, awards, viral moment, or peer respect peaks.",
    blockText: "Visibility shrinks, reputation cooled, or you fade from the public eye for now.",
    wildText: "Sudden notoriety — could be viral fame or viral scandal. Knife-edge.",
  },
  {
    question: "Will real estate, property, or vehicles change?",
    houses: [4],
    boosters: ["Mars", "Venus", "Jupiter", "Moon"],
    blockers: ["Saturn", "Ketu", "Rahu"],
    boostText: "Property deal, move, or vehicle upgrade. Lease/purchase windows open.",
    blockText: "Sale stalls, move delays, or property/vehicle repair costs hit hard.",
  },
  {
    question: "Will enemies, rivals, or workplace conflict bite?",
    houses: [3, 6, 8, 11],
    boosters: ["Mars", "Sun", "Saturn"],
    blockers: ["Venus", "Moon", "Jupiter"],
    inverted: true,
    boostText: "You defeat rivals or out-maneuver hostile parties. Conflict resolves in your favor.",
    blockText: "Open conflict, betrayal by a 'friend,' or a workplace rival makes a move. Guard your back.",
  },
  {
    question: "Will technology, innovation, or breakthrough projects ignite?",
    houses: [3, 5, 11],
    boosters: ["Mercury", "Mars"],
    blockers: ["Ketu", "Saturn"],
    wild: ["Rahu"],
    boostText: "Builds ship, prototypes work, code clicks. Tech bets pay off.",
    blockText: "Tools break, deploys fail, or a side-project rots on the vine.",
    wildText: "Wild experimental territory — AI, crypto, fringe tech. Could 10x or zero out.",
  },
  {
    question: "Will mental health, mood, and sleep hold?",
    houses: [1, 4, 8, 12],
    boosters: ["Jupiter", "Moon", "Venus"],
    blockers: ["Saturn", "Rahu", "Ketu", "Mars"],
    inverted: true,
    boostText: "Mind settles, sleep restores, anxiety eases. Therapy/practice lands well.",
    blockText: "Anxiety spikes, sleep fragments, intrusive thoughts circle. Reduce inputs, get outside.",
  },
  {
    question: "Will friendships, networking, and community grow?",
    houses: [3, 7, 11],
    boosters: ["Jupiter", "Venus", "Mercury"],
    blockers: ["Saturn", "Ketu"],
    wild: ["Rahu"],
    boostText: "New friends, useful intros, group/community traction. Your circle expands.",
    blockText: "Friends drift, group projects collapse, or you outgrow a circle.",
    wildText: "Strange new crowd — online, foreign, or subculture pull. Could be cult-energy.",
  },
  {
    question: "Will hidden enemies, scandal, or secret losses surface?",
    houses: [6, 8, 12],
    boosters: ["Mars", "Saturn", "Rahu", "Ketu"],
    blockers: ["Jupiter", "Venus"],
    inverted: true,
    boostText: "Whatever was hidden stays buried. No leaks, no scandal, no surprise drain.",
    blockText: "A secret leaks, a hidden enemy moves, or an unexpected expense/loss hits sideways.",
  },
  {
    question: "Will addictions, escapism, or self-sabotage flare?",
    houses: [6, 8, 12],
    boosters: ["Saturn", "Jupiter"],
    blockers: ["Venus", "Moon", "Rahu", "Ketu"],
    inverted: true,
    boostText: "Discipline holds — easy to stay sober, focused, and off the dopamine drip.",
    blockText: "Cravings spike, doom-scroll loops, substance pull. Pre-commit; lock the apps.",
  },
];

function applyRetro(verdict: Verdict, retro: boolean): { verdict: Verdict; tag: string } {
  if (!retro) return { verdict, tag: "" };
  if (verdict === "yes-strong") return { verdict: "yes", tag: " (revisit — slower than expected)" };
  if (verdict === "yes") return { verdict: "possible", tag: " (on/off — comes back to be reworked)" };
  if (verdict === "possible") return { verdict: "delayed", tag: " (loops back — needs second pass)" };
  return { verdict, tag: " (old patterns resurface)" };
}

const VERDICT_LABEL: Record<Verdict, string> = {
  "yes-strong": "Yes — strong window",
  "yes": "Yes — likely",
  "possible": "Possible",
  "delayed": "Delayed / unlikely now",
  "unlikely": "No — not this transit",
};

export function lifePredictions(planet: string, house: number, retrograde: boolean): LifePrediction[] {
  const out: LifePrediction[] = [];
  for (const area of LIFE_AREAS) {
    if (!area.houses.includes(house)) continue;
    let baseVerdict: Verdict;
    let detail: string;
    if (area.wild?.includes(planet)) {
      baseVerdict = "possible";
      detail = area.wildText ?? area.boostText;
    } else if (area.inverted) {
      // Health area: blockers (malefics) in dushtana = bad
      if (area.blockers.includes(planet)) { baseVerdict = "delayed"; detail = area.blockText; }
      else if (area.boosters.includes(planet)) { baseVerdict = "yes"; detail = area.boostText; }
      else { baseVerdict = "possible"; detail = "Neutral pressure on this area — depends on supporting transits."; }
    } else {
      if (area.boosters.includes(planet)) {
        baseVerdict = HIGH_IMPACT.has(planet) ? "yes-strong" : "yes";
        detail = area.boostText;
      } else if (area.blockers.includes(planet)) {
        baseVerdict = HIGH_IMPACT.has(planet) ? "delayed" : "unlikely";
        detail = area.blockText;
      } else {
        baseVerdict = "possible";
        detail = "Background influence only — no strong push either way.";
      }
    }
    const { verdict, tag } = applyRetro(baseVerdict, retrograde);
    const houseTheme = HOUSE_THEME[house]?.title ?? `House ${house}`;
    out.push({
      question: area.question,
      verdict,
      answer: VERDICT_LABEL[verdict] + tag,
      detail: `${detail} (${planet}${retrograde ? " retrograde" : ""} in your ${houseTheme} field.)`,
    });
  }
  return out;
}

export function readTransit(planet: string, natalHouse: number, retrograde: boolean): TransitReading {
  const p = PLANET_TONE[planet];
  const h = HOUSE_THEME[natalHouse];
  if (!p || !h) {
    return { headline: `${planet} → House ${natalHouse}`, meaning: "No interpretation available.", favors: "", warns: "", weight: "low", predictions: [] };
  }
  const retroNote = retrograde
    ? " Retrograde — themes turn inward, revisit, repeat. Old chapters of this house resurface for review."
    : "";
  const meaning =
    `${planet} (${p.tone}) is currently activating your ${h.title.toLowerCase()} house — the field of ${h.domain}. ` +
    `Energy of "${p.karaka}" pours into this area of life.${retroNote}`;
  const favors = `${h.positive}; ${p.favors} — especially in matters of ${h.domain}.`;
  const warns = `Watch for ${h.negative}; ${planet} also tends to provoke ${p.warns}.`;
  const weight: TransitReading["weight"] = HIGH_IMPACT.has(planet) ? "high" : LOW_IMPACT.has(planet) ? "low" : "medium";
  return {
    headline: `${planet}${retrograde ? " ʀ" : ""} transiting House ${natalHouse} — ${h.title}`,
    meaning, favors, warns, weight,
    predictions: lifePredictions(planet, natalHouse, retrograde),
  };
}
