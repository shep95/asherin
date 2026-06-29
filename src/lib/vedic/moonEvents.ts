/**
 * MOON EVENTS — 100% Moon-driven monthly/weekly forecast.
 *
 * Two event types within [start, end]:
 *  1. House Ingress  — transiting Moon crosses a whole-sign house cusp anchored
 *                       on the natal Ascendant (life-area changes).
 *  2. Conjunction    — transiting Moon's sidereal longitude crosses within
 *                       orb of a natal planet's sidereal longitude (direct hit).
 *
 * Both event timestamps are bisected to ~1-minute precision using Swiss
 * Ephemeris (Lahiri sidereal). The Date objects returned are absolute UTC
 * instants; the caller renders them with `toLocaleString(undefined, …)` so
 * each user sees their own local time + zone abbreviation.
 */
import { siderealMoonAt } from "./sweChart";

export interface NatalPlanetRef {
  name: string; // Sun | Moon | Mercury | Venus | Mars | Jupiter | Saturn | Rahu | Ketu
  sid: number;  // sidereal longitude 0..360
}

export interface MoonEvent {
  id: string;
  kind: "house-ingress" | "conjunction";
  at: Date;             // absolute UTC instant — render with toLocaleString()
  house?: number;       // 1..12 (house-ingress)
  planet?: string;      // natal planet name (conjunction)
  tone: "good" | "bad" | "mixed";
  label: string;        // e.g. "House 10 — Career & Status" or "Natal Saturn"
  headline: string;     // one-liner ("Moon enters House 10 — career visibility")
  expect: string;       // "what to expect" narrative
}

// ── HOUSE MEANINGS (Moon transiting natal houses 1..12) ──────────────────────
const HOUSE_MEANINGS: Record<number, { label: string; tone: "good" | "bad" | "mixed"; headline: string; expect: string }> = {
  1:  { label: "House 1 — Self & Body",            tone: "mixed", headline: "Mood reset — you are the room's center of gravity.",
        expect: "Energy + self-focus spike. Identity, body, appearance, first impressions matter. Expect emotional self-awareness, restlessness, and a pull to start something personal. Avoid major decisions made purely on mood." },
  2:  { label: "House 2 — Money, Family, Speech",  tone: "mixed", headline: "Cashflow + voice + family chatter come online.",
        expect: "Money conversations, small purchases, food, and what you say carry weight. Expect family calls, comfort eating, and a sensitivity around savings or possessions." },
  3:  { label: "House 3 — Courage & Communication",tone: "good",  headline: "Initiative window — send the message, take the short trip.",
        expect: "Bold messaging, sibling/peer contact, short trips, content output. Expect a wave of confidence, faster decisions, and a willingness to push." },
  4:  { label: "House 4 — Home & Mother",          tone: "mixed", headline: "Pull toward home, comfort, mom.",
        expect: "Nesting urge, mother on the mind, emotional refuge needed. Expect domestic chores, real-estate thoughts, sentimental memories, and tender moods." },
  5:  { label: "House 5 — Romance, Children, Play",tone: "good",  headline: "Creative + romantic spark.",
        expect: "Playful, flirty, creative period. Expect dates, kids' news, creative output, speculation interest. Avoid impulsive gambling." },
  6:  { label: "House 6 — Health, Work, Conflict", tone: "bad",   headline: "Task pile-up — guard health and arguments.",
        expect: "Minor irritations spike. Expect a busy work queue, small health flares, diet slip-ups, and short-fuse arguments. Don't pick fights, hydrate, sleep early." },
  7:  { label: "House 7 — Partnership & Public",   tone: "mixed", headline: "Partner-facing day — meetings, dates, public eyes.",
        expect: "One-on-one interactions intensify. Expect partner conversations, client meetings, negotiations, and emotional reads of the other person." },
  8:  { label: "House 8 — Transformation & Hidden",tone: "bad",   headline: "Deep emotions surface — intimacy, secrets, sudden shifts.",
        expect: "Old wounds, intimacy, joint resources, occult pull. Expect intense moods, sexual energy, hidden info coming up, and possible sudden changes. Don't sign legal docs blindly." },
  9:  { label: "House 9 — Luck, Travel, Teachers", tone: "good",  headline: "Optimism, meaningful conversation, travel pull.",
        expect: "Long-range vision, teachers, philosophy, foreign contact. Expect lucky breaks, mentor texts, travel ideas, and a desire to expand the worldview." },
  10: { label: "House 10 — Career & Status",       tone: "good",  headline: "Visibility at work — reputation moment.",
        expect: "Public eye on the career. Expect bosses noticing, status conversations, promotions discussed, and a need to perform. Show up sharp." },
  11: { label: "House 11 — Gains & Network",       tone: "good",  headline: "Income + friends + opportunities arriving.",
        expect: "Network activates. Expect group chats firing, intros, gain notifications, payouts, and friends bringing wins. Say yes to social invites." },
  12: { label: "House 12 — Loss, Rest, Foreign",   tone: "mixed", headline: "Withdraw — sleep, dreams, expenses.",
        expect: "Low-energy rest day. Expect vivid dreams, foreign-land thoughts, expenses you didn't plan, urge to be alone. Don't fight it — recharge." },
};

// ── CONJUNCTION MEANINGS (Moon hitting a natal planet) ───────────────────────
const CONJ_MEANINGS: Record<string, { tone: "good" | "bad" | "mixed"; headline: string; expect: string }> = {
  Sun:     { tone: "good",  headline: "Identity activated — visibility + vitality surge.",
             expect: "Ego pinged, father/authority on the mind. Expect a visibility moment, a check on who you are, and a confidence boost (or test). Good for public moves." },
  Mercury: { tone: "good",  headline: "Mind activated — important messages, deals, decisions.",
             expect: "Mental clarity spike. Expect key calls, signed papers, smart conversations, and a sharp memory. Best window of the week for negotiation." },
  Venus:   { tone: "good",  headline: "Love + comfort surge — sweetness in the air.",
             expect: "Beauty, romance, gifts, sweet food, harmony. Expect tender feelings, attraction moments, art/music pull, and easy conversations. Reach out to the person you like." },
  Mars:    { tone: "bad",   headline: "Drive + conflict — impulsive action, watch the temper.",
             expect: "Physical energy spike, libido up, short-fuse. Expect arguments, impulsive moves, accidents if rushing, and a craving for spicy food. Channel it into exercise, not fights." },
  Jupiter: { tone: "good",  headline: "Blessing window — good news, mentors, lucky break.",
             expect: "Optimism floods in. Expect mentor contact, generous gestures, opportunity ping, and a sense that things are working. Ask for what you want." },
  Saturn:  { tone: "bad",   headline: "Weight lands — serious mood, slow day, responsibility.",
             expect: "Heaviness, fatigue, isolation pull. Expect a sober mood, work pressure, delays, bones/joints achy, and old fears surfacing. Don't quit — just go slow." },
  Rahu:    { tone: "mixed", headline: "Obsession + craving — unusual desires, distraction.",
             expect: "Intensity, foreign pull, weird cravings, addictive scrolling. Expect a magnetism toward something risky/unfamiliar. Notice the loop before you fall in." },
  Ketu:    { tone: "mixed", headline: "Detachment + release — spiritual pull, sudden endings.",
             expect: "Withdrawal urge, intuition flash, things falling away effortlessly. Expect a meditative mood, a finished chapter, or a quiet knowing. Don't grasp — let it pass through." },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function signedDiff(a: number, b: number) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function houseOf(sid: number, ascSignStart: number): number {
  const rel = (((sid - ascSignStart) % 360) + 360) % 360;
  return Math.floor(rel / 30) + 1; // 1..12
}

async function bisectIngress(
  loMs: number, hiMs: number, lat: number, lon: number,
  ascSignStart: number, targetHouse: number,
): Promise<Date> {
  let lo = loMs, hi = hiMs;
  for (let i = 0; i < 14; i++) {
    if (hi - lo < 60_000) break;
    const midMs = (lo + hi) / 2;
    const sid = await siderealMoonAt(new Date(midMs), lat, lon);
    const h = houseOf(sid, ascSignStart);
    if (h === targetHouse) hi = midMs; else lo = midMs;
  }
  return new Date(hi);
}

async function bisectConjunction(
  loMs: number, hiMs: number, lat: number, lon: number, targetSid: number,
): Promise<Date> {
  let lo = loMs, hi = hiMs;
  let dLo = signedDiff(await siderealMoonAt(new Date(lo), lat, lon), targetSid);
  for (let i = 0; i < 16; i++) {
    if (hi - lo < 60_000) break;
    const mid = (lo + hi) / 2;
    const dMid = signedDiff(await siderealMoonAt(new Date(mid), lat, lon), targetSid);
    const crossedInLow = (dLo <= 0 && dMid >= 0) || (dLo >= 0 && dMid <= 0);
    if (crossedInLow) { hi = mid; } else { lo = mid; dLo = dMid; }
  }
  return new Date((lo + hi) / 2);
}

/**
 * Compute every Moon house-ingress and Moon-to-natal-planet conjunction
 * within [start, end] for the given natal chart (ascendant + planets).
 *
 * Sampling: 1-hour Moon probes (~744 calls for a 31-day month). Moon moves
 * ~0.5°/hour so every 30° boundary and every conjunction zero-crossing is
 * detected, then bisected to ~1-minute precision.
 */
export async function computeMoonEvents(
  start: Date,
  end: Date,
  natalAscendant: number,
  natalPlanets: NatalPlanetRef[],
  lat: number,
  lon: number,
): Promise<MoonEvent[]> {
  if (end.getTime() <= start.getTime()) return [];
  const ascSignStart = Math.floor(natalAscendant / 30) * 30;

  const STEP = 60 * 60_000; // 1 hour
  const samples: Array<{ t: number; sid: number }> = [];
  for (let t = start.getTime(); t <= end.getTime(); t += STEP) {
    samples.push({ t, sid: await siderealMoonAt(new Date(t), lat, lon) });
  }
  if (samples.length < 2) return [];

  const events: MoonEvent[] = [];

  // House ingresses
  for (let i = 1; i < samples.length; i++) {
    const hPrev = houseOf(samples[i - 1].sid, ascSignStart);
    const hNow = houseOf(samples[i].sid, ascSignStart);
    if (hPrev === hNow) continue;
    const at = await bisectIngress(samples[i - 1].t, samples[i].t, lat, lon, ascSignStart, hNow);
    if (at.getTime() < start.getTime() || at.getTime() > end.getTime()) continue;
    const meta = HOUSE_MEANINGS[hNow];
    events.push({
      id: `house-${hNow}-${at.getTime()}`,
      kind: "house-ingress",
      at,
      house: hNow,
      tone: meta.tone,
      label: meta.label,
      headline: `Moon enters ${meta.label} — ${meta.headline}`,
      expect: meta.expect,
    });
  }

  // Conjunctions with each natal planet
  for (const np of natalPlanets) {
    const meta = CONJ_MEANINGS[np.name];
    if (!meta || typeof np.sid !== "number") continue;
    let prev = signedDiff(samples[0].sid, np.sid);
    for (let i = 1; i < samples.length; i++) {
      const cur = signedDiff(samples[i].sid, np.sid);
      const crossed = (prev <= 0 && cur >= 0) || (prev >= 0 && cur <= 0);
      // Reject the 180° wrap (opposition) — only accept true conjunction crossings
      // where the moon was within ~10° of the target on at least one side.
      if (crossed && (Math.abs(prev) < 10 || Math.abs(cur) < 10)) {
        const at = await bisectConjunction(samples[i - 1].t, samples[i].t, lat, lon, np.sid);
        if (at.getTime() >= start.getTime() && at.getTime() <= end.getTime()) {
          events.push({
            id: `conj-${np.name}-${at.getTime()}`,
            kind: "conjunction",
            at,
            planet: np.name,
            tone: meta.tone,
            label: `Natal ${np.name}`,
            headline: `Moon conjuncts natal ${np.name} — ${meta.headline}`,
            expect: meta.expect,
          });
        }
      }
      prev = cur;
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return events;
}

/** Format an absolute UTC instant in the viewer's local timezone with zone abbr. */
export function formatLocal(at: Date): string {
  return at.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}
