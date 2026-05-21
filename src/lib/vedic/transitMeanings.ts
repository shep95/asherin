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

export interface TransitReading {
  headline: string;
  meaning: string;
  favors: string;
  warns: string;
  weight: "high" | "medium" | "low";  // slow planets = high impact
}

const HIGH_IMPACT = new Set(["Saturn", "Jupiter", "Rahu", "Ketu"]);
const LOW_IMPACT = new Set(["Moon"]);

export function readTransit(planet: string, natalHouse: number, retrograde: boolean): TransitReading {
  const p = PLANET_TONE[planet];
  const h = HOUSE_THEME[natalHouse];
  if (!p || !h) {
    return { headline: `${planet} → House ${natalHouse}`, meaning: "No interpretation available.", favors: "", warns: "", weight: "low" };
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
  };
}
