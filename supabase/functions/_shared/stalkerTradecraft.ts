/**
 * STALKER & SURVEILLANCE TRADECRAFT ENGINE
 * ========================================
 *
 * The recurrence test ("same radio, different times, different places") answers
 * *whether* something follows you. It does not answer *how it is being run*, and
 * "how" is the part that changes what a victim should do in the next hour.
 *
 * This module encodes the documented behavioural doctrine of two very different
 * adversaries and then tests the radio log against both:
 *
 *   DOMESTIC / INTERPERSONAL STALKING (the overwhelming majority of real cases)
 *     Research base: Mullen/Pathé/Purcell stalker typology (rejected, intimacy-
 *     seeking, incompetent suitor, resentful, predatory), the Stalking Assessment
 *     and Management framework (SAM), the SASH / Stalking Risk Profile, and the
 *     US DOJ Stalking Prevention & Awareness resource centre's SLII taxonomy
 *     (Surveillance, Life invasion, Intimidation, Interference).
 *     Radio-visible behaviour: constant attachment (a tag placed on the person,
 *     the bag or the car), residence and workplace dwell, night presence at the
 *     home cell, schedule-locking to the victim's routine, escalation after a
 *     protective action, and re-approach after a quiet period.
 *
 *   ORGANISED / PROFESSIONAL PHYSICAL SURVEILLANCE (state, corporate, contract)
 *     Doctrine base: the ABC foot-follow, the floating box, leapfrog / handoff
 *     rotation, the fixed observation post, technical placement (a beacon on the
 *     target's vehicle), cover-for-status and cover-for-action, break-off when
 *     burned, and identity rotation between operators and between devices.
 *     Radio-visible behaviour: several *different* radios that co-travel or hand
 *     the target off in a relay, disciplined stand-off distance instead of a
 *     close approach, near-disjoint coverage windows, and manufacturer-clustered
 *     fingerprint churn consistent with MAC / identity rotation.
 *
 * Hard rules that keep this honest — a false accusation is also a harm:
 *  - A Bluetooth advertisement identifies HARDWARE. This module never names,
 *    infers or profiles a human being.
 *  - Every indicator carries the evidence that produced it and a confidence.
 *    Nothing fires on a single sighting.
 *  - Innocent explanations are stated alongside every indicator. Living above a
 *    coffee shop produces "residence dwell" for fifty strangers' phones a day.
 *  - Absence of indicators is never rendered as "you are safe".
 */

// ── Inputs ─────────────────────────────────────────────────────────────────

export interface TcDevice {
  id: string;
  display_name: string;
  manufacturer: string | null;
  inferred_kind: string;
  is_self: boolean;
  is_ignored: boolean;
  first_seen: string;
  last_seen: string;
  encounter_count: number;
  distinct_days: number;
  distinct_places: number;
  closest_distance_m: number | null;
}

export interface TcSighting {
  device_id: string;
  seen_at: string;
  session_id: string | null;
  place_key: string | null;
  distance_m: number | null;
  rssi: number | null;
}

export type TcSeverity = "informational" | "notable" | "serious" | "critical";
export type TcSchool = "domestic" | "professional" | "either";

export interface TcIndicator {
  code: string;
  title: string;
  school: TcSchool;
  severity: TcSeverity;
  confidence: number;            // 0..1, evidence-weighted, never 1.0
  deviceIds: string[];
  /** One line a frightened person can act on. */
  finding: string;
  /** The doctrine this behaviour matches, named. */
  doctrine: string;
  /** The concrete counts/timestamps that produced the finding. */
  evidence: string[];
  /** The most likely innocent reading — always present. */
  benign: string;
  /** What would confirm or kill this indicator next. */
  watchFor: string[];
}

export interface TcCampaign {
  tier: "none" | "watch" | "probable" | "active";
  score: number;                 // 0..100
  headline: string;
  posture: "domestic" | "professional" | "mixed" | "undetermined";
  indicators: TcIndicator[];
  coverage: {
    sessions: number;
    days: number;
    places: number;
    devices: number;
    sightings: number;
    windowStart: string | null;
    windowEnd: string | null;
  };
  /** Honest statement of what the log could not test. */
  blindSpots: string[];
}

// ── Doctrine catalogue (also rendered into the UI so the user learns it) ───

export interface DoctrineEntry {
  code: string;
  school: TcSchool;
  name: string;
  how: string;
  radioSignature: string;
  counter: string;
}

export const TRADECRAFT_DOCTRINE: DoctrineEntry[] = [
  {
    code: "TECH_PLACEMENT",
    school: "either",
    name: "Technical placement (tag on the person, bag or vehicle)",
    how: "A tracker is hidden in a car (wheel well, bumper, under a seat, OBD port), a bag lining, a coat, a child's toy or a returned possession. The follower never needs to be near you.",
    radioSignature: "One radio present in almost every scan, in every place, at close range — because it is travelling with you, not following you.",
    counter: "Run your phone's unwanted-tracker scan, sweep the vehicle in daylight with a torch, and trigger the tag's separation chime. Photograph it in place before removing it.",
  },
  {
    code: "RESIDENCE_WATCH",
    school: "either",
    name: "Fixed observation of the residence or workplace",
    how: "A static post — a parked car, a neighbouring unit, a device left in the stairwell — watches the one address you must always return to.",
    radioSignature: "Repeated presence concentrated at your single most-visited cell, weighted to night hours, with little or no presence elsewhere.",
    counter: "Vary arrival and departure times, photograph parked vehicles from inside, ask a neighbour to corroborate, and log every occurrence with a timestamp.",
  },
  {
    code: "SCHEDULE_LOCK",
    school: "domestic",
    name: "Routine locking",
    how: "A stalker who knows your schedule does not need to follow you — they intercept it. Contact clusters at the same hour on the same weekdays.",
    radioSignature: "Encounters concentrated in a narrow hour-of-day band repeated across separate days.",
    counter: "Break the routine once deliberately. If the contact moves with the change, the schedule is being read from a live source, not from memory.",
  },
  {
    code: "LIFE_INVASION",
    school: "domestic",
    name: "Life invasion and approach escalation",
    how: "SLII doctrine: surveillance becomes life invasion when the follower closes the distance — appearing at your table, your gym, your child's school.",
    radioSignature: "A steadily falling closest-approach distance over time for the same radio.",
    counter: "Distance closing is the single strongest short-term risk escalator in stalking research. Preserve the log and treat it as reportable now, not later.",
  },
  {
    code: "ABC_FOOT",
    school: "professional",
    name: "ABC foot-follow / floating box",
    how: "Three or more operators share the target: A behind, B behind A, C on the opposite pavement or a parallel street. Positions rotate so no single face stays in view.",
    radioSignature: "Several distinct radios that appear together across separate sessions and separate places — a co-travelling cluster, not one follower.",
    counter: "Run a discreet surveillance-detection route: three unnatural turns, one long clean stretch, one stop with a rear view. A box reveals itself in the turns.",
  },
  {
    code: "LEAPFROG",
    school: "professional",
    name: "Leapfrog / handoff relay",
    how: "One unit holds the target, then breaks off and hands to the next before it can be noticed. No unit stays long enough to be memorable.",
    radioSignature: "Two or more radios with near-disjoint coverage windows that chain back-to-back across your timeline, so coverage never lapses.",
    counter: "Note the handover points, not the vehicles. Relay hand-offs happen at predictable geometry: junctions, lifts, station exits.",
  },
  {
    code: "STANDOFF",
    school: "professional",
    name: "Disciplined stand-off",
    how: "Trained surveillance does not crowd. It holds distance and uses geometry, because closing is what gets a team burned.",
    radioSignature: "Persistent recurrence at a stable mid-range distance with no close approach — the opposite of the domestic signature.",
    counter: "Stand-off with persistence is a professional tell. Do not confront. Document, then take advice before changing behaviour.",
  },
  {
    code: "IDENTITY_ROTATION",
    school: "professional",
    name: "Identity and address rotation",
    how: "Hardware rotates its advertised identity — randomised MACs, swapped handsets, changed device names — to defeat exactly the kind of log you are keeping.",
    radioSignature: "A cluster of short-lived fingerprints sharing one manufacturer or name family, each appearing in a different window.",
    counter: "Rotation defeats per-device counting, not per-cluster counting. This engine counts the cluster.",
  },
  {
    code: "BURN_BREAK",
    school: "either",
    name: "Break-off after being burned, then return",
    how: "When a follower believes they have been seen, they go quiet — days or weeks — and resume once they judge the alarm has passed.",
    radioSignature: "Dense recurrence, then a silent gap, then a resumption by the same fingerprint.",
    counter: "The gap is not resolution. Keep the log running through quiet periods; the return is the most evidentially valuable event you will capture.",
  },
  {
    code: "SURGE",
    school: "either",
    name: "New-actor surge",
    how: "A follower who has only just started produces a burst: new to your log, but already across several places in a few days.",
    radioSignature: "Recent first-seen, high place-count and day-count compressed into a short window.",
    counter: "Correlate the start date against a real-world trigger: a break-up, a court filing, a job exit, a rental viewing, a repair visit.",
  },
];

// ── Small helpers ──────────────────────────────────────────────────────────

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ms = (s: string) => new Date(s).getTime();
const dayKey = (s: string) => s.slice(0, 10);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

interface DeviceTrack {
  device: TcDevice;
  sightings: TcSighting[];       // ascending by time
  sessions: Set<string>;
  days: Set<string>;
  places: Set<string>;
  firstMs: number;
  lastMs: number;
  distances: number[];
}

function buildTracks(devices: TcDevice[], sightings: TcSighting[]): Map<string, DeviceTrack> {
  const byId = new Map<string, DeviceTrack>();
  for (const d of devices) {
    byId.set(d.id, {
      device: d,
      sightings: [],
      sessions: new Set(),
      days: new Set(),
      places: new Set(),
      firstMs: Number.POSITIVE_INFINITY,
      lastMs: Number.NEGATIVE_INFINITY,
      distances: [],
    });
  }
  for (const s of sightings) {
    const t = byId.get(s.device_id);
    if (!t || !s.seen_at) continue;
    const at = ms(s.seen_at);
    if (!Number.isFinite(at)) continue;
    t.sightings.push(s);
    if (s.session_id) t.sessions.add(s.session_id);
    t.days.add(dayKey(s.seen_at));
    if (s.place_key) t.places.add(s.place_key);
    if (typeof s.distance_m === "number") t.distances.push(Number(s.distance_m));
    if (at < t.firstMs) t.firstMs = at;
    if (at > t.lastMs) t.lastMs = at;
  }
  for (const t of byId.values()) t.sightings.sort((a, b) => ms(a.seen_at) - ms(b.seen_at));
  return byId;
}

// ── Detectors ──────────────────────────────────────────────────────────────
//
// Every detector is pure, bounded and returns either an indicator or null.
// None of them may fire on a single sighting or a single session.

/** TECH_PLACEMENT — present in nearly every session, everywhere, and close. */
function detectConstantAttachment(t: DeviceTrack, totalSessions: number): TcIndicator | null {
  if (totalSessions < 4 || t.sessions.size < 4) return null;
  const ratio = t.sessions.size / totalSessions;
  if (ratio < 0.7) return null;
  const med = median(t.distances);
  const close = med != null && med <= 12;
  const everywhere = t.places.size >= 2;
  if (!everywhere && !close) return null;
  return {
    code: "TECH_PLACEMENT",
    title: "Constant attachment — consistent with a tag travelling with you",
    school: "either",
    severity: close && t.places.size >= 3 ? "critical" : "serious",
    confidence: clamp01(0.45 + ratio * 0.3 + (close ? 0.15 : 0) + Math.min(t.places.size, 5) * 0.02),
    deviceIds: [t.device.id],
    finding: `${t.device.display_name} was present in ${t.sessions.size} of your ${totalSessions} scans, across ${t.places.size} separate locations${close ? `, at a typical range of about ${Math.round(med!)} m` : ""}. Hardware that is with you everywhere is usually travelling with you, not following you.`,
    doctrine: "Technical placement — a beacon hidden on the person, in a bag or on a vehicle, so the follower never has to be nearby.",
    evidence: [
      `Presence ratio ${(ratio * 100).toFixed(0)}% of all scan sessions`,
      `Distinct locations: ${t.places.size}`,
      med != null ? `Median range ${Math.round(med)} m (~${Math.round(med * 3.28084)} ft)` : "Range not measurable",
      `Window ${new Date(t.firstMs).toISOString()} → ${new Date(t.lastMs).toISOString()}`,
    ],
    benign: "Your own unmarked hardware, a household member's device that lives in the same bag, or a car's built-in infotainment radio will all look exactly like this. Mark it as yours if you recognise it.",
    watchFor: [
      "Run the platform unwanted-tracker scan (iOS: Tracker Detect / Safety Check; Android: Find Hub unknown-tracker scan).",
      "Sweep the vehicle in daylight: wheel wells, bumpers, under seats, boot lining, OBD port.",
      "Sweep bags, coat linings, child seats and any item recently gifted or returned to you.",
      "If you find hardware, photograph it in place before touching it — placement is evidence.",
    ],
  };
}

/** RESIDENCE_WATCH — concentrated at your dominant cell, weighted to night. */
function detectResidenceWatch(t: DeviceTrack, homeCell: string | null): TcIndicator | null {
  if (!homeCell || t.sessions.size < 3) return null;
  const atHome = t.sightings.filter((s) => s.place_key === homeCell);
  if (atHome.length < 3) return null;
  const share = atHome.length / t.sightings.length;
  if (share < 0.75) return null;
  const nights = atHome.filter((s) => {
    const h = new Date(s.seen_at).getHours();
    return h >= 22 || h < 5;
  }).length;
  const days = new Set(atHome.map((s) => dayKey(s.seen_at)));
  if (days.size < 2) return null;
  const nightHeavy = nights >= 2 && nights / atHome.length >= 0.3;
  return {
    code: "RESIDENCE_WATCH",
    title: nightHeavy ? "Night presence at your home cell" : "Repeated presence at your home cell",
    school: "either",
    severity: nightHeavy ? "serious" : "notable",
    confidence: clamp01(0.35 + share * 0.3 + Math.min(days.size, 6) * 0.05 + (nightHeavy ? 0.1 : 0)),
    deviceIds: [t.device.id],
    finding: `${t.device.display_name} appears almost only at your most-visited location — ${atHome.length} sightings across ${days.size} days${nightHeavy ? `, ${nights} of them between 22:00 and 05:00` : ""}.`,
    doctrine: "Fixed observation of the residence — the one address a target must always return to, watched from a parked vehicle, a neighbouring unit or a device left in place.",
    evidence: [
      `${atHome.length}/${t.sightings.length} sightings inside the dominant ~110 m cell`,
      `Distinct days at that cell: ${days.size}`,
      `Night-window sightings (22:00–05:00): ${nights}`,
    ],
    benign: "Neighbours, their visitors, a landlord's equipment, a smart doorbell, and passing residential traffic all produce this exact shape. In dense housing it is the normal case.",
    watchFor: [
      "Note whether the same vehicle is parked with a view of your entrance at those hours.",
      "Vary your arrival and departure time by 40+ minutes and see whether the presence follows.",
      "Ask one trusted neighbour to independently corroborate before drawing any conclusion.",
    ],
  };
}

/** SCHEDULE_LOCK — encounters cluster in a narrow hour band across days. */
function detectScheduleLock(t: DeviceTrack): TcIndicator | null {
  if (t.days.size < 3 || t.sightings.length < 4) return null;
  const hours = t.sightings.map((s) => new Date(s.seen_at).getHours());
  // Circular-safe: test every 3-hour window on the clock face.
  let best = { start: 0, count: 0 };
  for (let h = 0; h < 24; h++) {
    const count = hours.filter((x) => (x - h + 24) % 24 < 3).length;
    if (count > best.count) best = { start: h, count };
  }
  const share = best.count / hours.length;
  if (share < 0.7) return null;
  const daysInBand = new Set(
    t.sightings.filter((s) => (new Date(s.seen_at).getHours() - best.start + 24) % 24 < 3).map((s) => dayKey(s.seen_at)),
  );
  if (daysInBand.size < 3) return null;
  return {
    code: "SCHEDULE_LOCK",
    title: "Contact locked to a repeating time of day",
    school: "domestic",
    severity: "notable",
    confidence: clamp01(0.3 + share * 0.35 + Math.min(daysInBand.size, 7) * 0.04),
    deviceIds: [t.device.id],
    finding: `${(share * 100).toFixed(0)}% of encounters with ${t.device.display_name} fall between ${String(best.start).padStart(2, "0")}:00 and ${String((best.start + 3) % 24).padStart(2, "0")}:00, repeated on ${daysInBand.size} separate days.`,
    doctrine: "Routine locking — a follower who knows your schedule intercepts it rather than following you, which is why the clock repeats even when the place does not.",
    evidence: [
      `Peak window ${String(best.start).padStart(2, "0")}:00–${String((best.start + 3) % 24).padStart(2, "0")}:00`,
      `${best.count}/${hours.length} sightings inside the window`,
      `Days inside the window: ${daysInBand.size}`,
    ],
    benign: "Your own routine creates this. If you take the same train at the same hour, you will meet the same commuters' phones every day for years.",
    watchFor: [
      "Deliberately break the routine once. Persistence through the change is the meaningful signal.",
      "Ask who has legitimate access to your calendar, shared location, or family-tracking account.",
    ],
  };
}

/** LIFE_INVASION — measured distance closing over the observation window. */
function detectClosingApproach(t: DeviceTrack): TcIndicator | null {
  const pts = t.sightings.filter((s) => typeof s.distance_m === "number");
  if (pts.length < 6 || t.days.size < 2) return null;
  const half = Math.floor(pts.length / 2);
  const early = median(pts.slice(0, half).map((s) => Number(s.distance_m)))!;
  const late = median(pts.slice(-half).map((s) => Number(s.distance_m)))!;
  if (!(early > 0) || late >= early * 0.6) return null;   // needs a ≥40% closure
  const drop = 1 - late / early;
  return {
    code: "LIFE_INVASION",
    title: "Approach distance is closing over time",
    school: "either",
    severity: late <= 8 ? "critical" : "serious",
    confidence: clamp01(0.35 + drop * 0.4 + Math.min(pts.length, 30) * 0.005),
    deviceIds: [t.device.id],
    finding: `${t.device.display_name} has moved from a typical ${Math.round(early)} m to a typical ${Math.round(late)} m from you — a ${(drop * 100).toFixed(0)}% closure across ${t.days.size} days.`,
    doctrine: "Life invasion / approach escalation — in stalking research a shortening stand-off is one of the strongest near-term escalation markers there is.",
    evidence: [
      `Early-window median ${Math.round(early)} m, late-window median ${Math.round(late)} m`,
      `Samples with measurable range: ${pts.length}`,
      `Observed across ${t.days.size} days and ${t.places.size} locations`,
    ],
    benign: "Signal strength is a crude ranging estimate. Walls, a pocket, a bag or a change of handset all shift it without anyone moving closer.",
    watchFor: [
      "Treat the log as reportable now rather than waiting for a further escalation.",
      "Do not confront. Move to a populated place and record the time you did so.",
      "Preserve the case file — a documented closing trend is what a protective order needs.",
    ],
  };
}

/** BURN_BREAK — dense contact, a silent gap, then a return. */
function detectBurnAndReturn(t: DeviceTrack): TcIndicator | null {
  if (t.sightings.length < 4) return null;
  let maxGap = 0, gapAt = 0;
  for (let i = 1; i < t.sightings.length; i++) {
    const g = ms(t.sightings[i].seen_at) - ms(t.sightings[i - 1].seen_at);
    if (g > maxGap) { maxGap = g; gapAt = i; }
  }
  if (maxGap < 5 * DAY_MS) return null;
  const before = gapAt, after = t.sightings.length - gapAt;
  if (before < 2 || after < 2) return null;
  return {
    code: "BURN_BREAK",
    title: "Contact stopped, then resumed after a quiet period",
    school: "either",
    severity: "notable",
    confidence: clamp01(0.3 + Math.min(before, 10) * 0.03 + Math.min(after, 10) * 0.03),
    deviceIds: [t.device.id],
    finding: `${t.device.display_name} was seen ${before} times, went silent for ${Math.round(maxGap / DAY_MS)} days, then returned for ${after} more sightings.`,
    doctrine: "Break-off after being burned — a follower who believes they were noticed goes quiet and resumes once they judge the alarm has passed. The return, not the gap, is the evidentially valuable event.",
    evidence: [
      `Silent gap ${Math.round(maxGap / DAY_MS)} days ending ${t.sightings[gapAt].seen_at}`,
      `Sightings before the gap: ${before}; after: ${after}`,
    ],
    benign: "A neighbour on holiday, a device that was switched off, or simply a fortnight where you did not run the watch will produce the same gap.",
    watchFor: [
      "Keep the watch running through quiet periods — the resumption is what proves persistence.",
      "Check whether the gap lines up with something you did: a report filed, a route changed, a confrontation.",
    ],
  };
}

/** SURGE — new to the log, already everywhere. */
function detectSurge(t: DeviceTrack, nowMs: number): TcIndicator | null {
  const ageDays = (nowMs - t.firstMs) / DAY_MS;
  if (!(ageDays <= 7) || t.places.size < 3 || t.sessions.size < 3) return null;
  return {
    code: "SURGE",
    title: "New radio, already following across multiple places",
    school: "either",
    severity: "serious",
    confidence: clamp01(0.35 + Math.min(t.places.size, 6) * 0.06 + Math.min(t.sessions.size, 8) * 0.03),
    deviceIds: [t.device.id],
    finding: `${t.device.display_name} first appeared ${ageDays < 1 ? "today" : `${Math.round(ageDays)} days ago`} and has already been logged in ${t.places.size} separate locations across ${t.sessions.size} scans.`,
    doctrine: "New-actor surge — the opening phase of a following campaign compresses many places into a few days, unlike ambient hardware which accumulates slowly.",
    evidence: [
      `First seen ${new Date(t.firstMs).toISOString()}`,
      `${t.places.size} locations, ${t.sessions.size} sessions, ${t.days.size} days`,
    ],
    benign: "A newly bought device of your own, a new colleague, a new flatmate, or simply the first week of running the watch at all.",
    watchFor: [
      "Write down what changed in your life in the week before the first sighting.",
      "Give it another 72 hours of watch time before treating it as established.",
    ],
  };
}

/** ABC_FOOT — a cluster of radios that co-travel across sessions and places. */
function detectCoTravelCluster(tracks: DeviceTrack[]): TcIndicator | null {
  const cands = tracks.filter((t) => t.sessions.size >= 2 && t.places.size >= 1);
  if (cands.length < 3) return null;

  // Group by the exact set of sessions they were seen in; overlap ≥2 sessions
  // and ≥2 places is the co-travel test.
  const cluster: DeviceTrack[] = [];
  const seed = cands.slice().sort((a, b) => b.sessions.size - a.sessions.size)[0];
  cluster.push(seed);
  for (const c of cands) {
    if (c === seed) continue;
    const shared = [...c.sessions].filter((s) => seed.sessions.has(s));
    const sharedPlaces = [...c.places].filter((p) => seed.places.has(p));
    if (shared.length >= 2 && sharedPlaces.length >= 2) cluster.push(c);
  }
  if (cluster.length < 3) return null;

  const places = new Set(cluster.flatMap((c) => [...c.places]));
  const sessions = new Set(cluster.flatMap((c) => [...c.sessions]));
  return {
    code: "ABC_FOOT",
    title: "Several radios move with you as a group",
    school: "professional",
    severity: "serious",
    confidence: clamp01(0.3 + Math.min(cluster.length, 6) * 0.07 + Math.min(places.size, 6) * 0.04),
    deviceIds: cluster.map((c) => c.device.id),
    finding: `${cluster.length} distinct radios recur together across ${sessions.size} scans in ${places.size} separate locations. A group that travels with you is a different problem from one device that follows you.`,
    doctrine: "ABC foot-follow / floating box — three or more operators share the target and rotate positions so no single face or vehicle stays in view long enough to be remembered.",
    evidence: cluster.slice(0, 8).map((c) => `${c.device.display_name}: ${c.sessions.size} sessions, ${c.places.size} places`),
    benign: "People who travel together carry several radios each — a household, a colleague's laptop plus phone plus earbuds, a bus full of the same commuters. Multi-radio owners are the usual cause.",
    watchFor: [
      "Run a surveillance-detection route: three unnatural turns, one long clean stretch, one stop with a rear view.",
      "A box reveals itself in the turns, not on the straight. Note who reappears after the second turn.",
      "Do not confront a team. Document, then take professional advice.",
    ],
  };
}

/** LEAPFROG — radios whose coverage windows chain back-to-back. */
function detectHandoffRelay(tracks: DeviceTrack[]): TcIndicator | null {
  const cands = tracks
    .filter((t) => t.sightings.length >= 2 && t.places.size >= 1)
    .sort((a, b) => a.firstMs - b.firstMs);
  if (cands.length < 3) return null;

  const chain: DeviceTrack[] = [];
  for (const c of cands) {
    if (!chain.length) { chain.push(c); continue; }
    const prev = chain[chain.length - 1];
    const gap = c.firstMs - prev.lastMs;
    const overlap = Math.min(prev.lastMs, c.lastMs) - Math.max(prev.firstMs, c.firstMs);
    const prevSpan = prev.lastMs - prev.firstMs || 1;
    // Hand-off: picks up within 20 minutes of the previous unit dropping, and
    // does not simply sit alongside it for the whole window.
    if (gap > -5 * 60_000 && gap < 20 * 60_000 && overlap < prevSpan * 0.5) chain.push(c);
    else if (c.firstMs > prev.lastMs) { if (chain.length >= 3) break; chain.length = 0; chain.push(c); }
  }
  if (chain.length < 3) return null;
  const span = chain[chain.length - 1].lastMs - chain[0].firstMs;
  if (span < 20 * 60_000) return null;

  return {
    code: "LEAPFROG",
    title: "Coverage handed off between radios without a gap",
    school: "professional",
    severity: "serious",
    confidence: clamp01(0.28 + Math.min(chain.length, 6) * 0.07 + Math.min(span / HOUR_MS, 6) * 0.03),
    deviceIds: chain.map((c) => c.device.id),
    finding: `${chain.length} radios covered a continuous ${Math.round(span / 60_000)}-minute stretch of your timeline in sequence — each picking up as the previous one dropped away.`,
    doctrine: "Leapfrog / handoff relay — no unit holds the target long enough to be noticed, so coverage is continuous while every individual presence looks brief and innocent.",
    evidence: chain.slice(0, 8).map((c) => `${c.device.display_name}: ${new Date(c.firstMs).toISOString()} → ${new Date(c.lastMs).toISOString()}`),
    benign: "Walking down a busy street produces exactly this shape: strangers enter and leave your radio horizon in sequence all day long. This indicator only means something with a stationary or repeated route.",
    watchFor: [
      "Note the geometry of the hand-off points — junctions, lift lobbies, station exits.",
      "Repeat the same route at a different hour. A relay repeats; a crowd does not.",
    ],
  };
}

/** STANDOFF — persistent recurrence that never closes. */
function detectStandoff(t: DeviceTrack): TcIndicator | null {
  if (t.sessions.size < 4 || t.places.size < 2) return null;
  const med = median(t.distances);
  if (med == null || med < 15 || med > 70) return null;
  const closest = t.device.closest_distance_m != null ? Number(t.device.closest_distance_m) : null;
  if (closest != null && closest < 10) return null;
  return {
    code: "STANDOFF",
    title: "Persistent, but never closes the distance",
    school: "professional",
    severity: "notable",
    confidence: clamp01(0.28 + Math.min(t.sessions.size, 10) * 0.03 + Math.min(t.places.size, 5) * 0.04),
    deviceIds: [t.device.id],
    finding: `${t.device.display_name} recurs across ${t.sessions.size} scans and ${t.places.size} locations but holds a steady ~${Math.round(med)} m and never approaches.`,
    doctrine: "Disciplined stand-off — trained surveillance holds geometry rather than proximity, because closing is what gets a team burned. It is the inverse of the domestic signature.",
    evidence: [
      `Median range ${Math.round(med)} m`,
      closest != null ? `Closest ever ${Math.round(closest)} m` : "No close approach recorded",
      `${t.sessions.size} sessions across ${t.places.size} locations`,
    ],
    benign: "Fixed street furniture, shop beacons, vehicle systems in a car park you use, and building infrastructure all sit at a constant mid-range forever.",
    watchFor: [
      "Check whether the same range persists in a location you have never used before.",
      "Do not attempt to identify a person. Document, then take advice.",
    ],
  };
}

/** IDENTITY_ROTATION — a churn of short-lived fingerprints from one family. */
function detectIdentityRotation(tracks: DeviceTrack[]): TcIndicator | null {
  const family = new Map<string, DeviceTrack[]>();
  for (const t of tracks) {
    const key = (t.device.manufacturer || t.device.display_name.replace(/\s*[0-9a-f]{4,}$/i, "")).trim().toLowerCase();
    if (!key || key === "unknown") continue;
    (family.get(key) || family.set(key, []).get(key)!).push(t);
  }
  for (const [key, group] of family) {
    const shortLived = group.filter((t) => t.sessions.size <= 2 && t.places.size >= 1);
    if (shortLived.length < 4) continue;
    // Windows must be mostly non-overlapping — that is what rotation looks like.
    const sorted = shortLived.slice().sort((a, b) => a.firstMs - b.firstMs);
    let disjoint = 0;
    for (let i = 1; i < sorted.length; i++) if (sorted[i].firstMs >= sorted[i - 1].lastMs) disjoint++;
    if (disjoint < sorted.length - 2) continue;
    const places = new Set(sorted.flatMap((t) => [...t.places]));
    if (places.size < 2) continue;
    return {
      code: "IDENTITY_ROTATION",
      title: "A family of short-lived radio identities keeps reappearing",
      school: "professional",
      severity: "notable",
      confidence: clamp01(0.25 + Math.min(sorted.length, 10) * 0.04 + Math.min(places.size, 5) * 0.04),
      deviceIds: sorted.map((t) => t.device.id),
      finding: `${sorted.length} short-lived "${key}" identities appeared in sequence across ${places.size} locations. Counted individually each looks harmless; counted as a family the pattern persists.`,
      doctrine: "Identity and address rotation — randomised MACs, swapped handsets and changed device names are used specifically to defeat a per-device log. This engine counts the cluster instead.",
      evidence: sorted.slice(0, 8).map((t) => `${t.device.display_name}: ${new Date(t.firstMs).toISOString()} → ${new Date(t.lastMs).toISOString()}`),
      benign: "Modern phones rotate their Bluetooth address by design, roughly every 15 minutes. In any busy place this is the single most common shape in the log and almost always means nothing.",
      watchFor: [
        "Only meaningful if the family also tracks you into an unusual place you rarely visit.",
        "Compare against a control scan somewhere you have never been before.",
      ],
    };
  }
  return null;
}

// ── Campaign assembly ──────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<TcSeverity, number> = {
  informational: 4, notable: 10, serious: 22, critical: 34,
};

export function analyzeTradecraft(devices: TcDevice[], sightings: TcSighting[], nowMs = Date.now()): TcCampaign {
  const subjects = devices.filter((d) => !d.is_self && !d.is_ignored);
  const tracks = buildTracks(devices, sightings);
  const subjectTracks = subjects.map((d) => tracks.get(d.id)!).filter((t) => t && t.sightings.length > 0);

  const allSessions = new Set(sightings.map((s) => s.session_id).filter(Boolean) as string[]);
  const allDays = new Set(sightings.map((s) => dayKey(s.seen_at)));
  const allPlaces = new Set(sightings.map((s) => s.place_key).filter(Boolean) as string[]);

  // Dominant cell = the place with the most sightings overall; treated as the
  // subject's anchor (home/work), which is what a fixed watch would target.
  const placeCounts = new Map<string, number>();
  for (const s of sightings) if (s.place_key) placeCounts.set(s.place_key, (placeCounts.get(s.place_key) || 0) + 1);
  const homeCell = [...placeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const indicators: TcIndicator[] = [];
  for (const t of subjectTracks) {
    for (const ind of [
      detectConstantAttachment(t, allSessions.size),
      detectResidenceWatch(t, homeCell),
      detectScheduleLock(t),
      detectClosingApproach(t),
      detectBurnAndReturn(t),
      detectSurge(t, nowMs),
      detectStandoff(t),
    ]) if (ind) indicators.push(ind);
  }
  for (const ind of [
    detectCoTravelCluster(subjectTracks),
    detectHandoffRelay(subjectTracks),
    detectIdentityRotation(subjectTracks),
  ]) if (ind) indicators.push(ind);

  indicators.sort((a, b) =>
    SEVERITY_WEIGHT[b.severity] * b.confidence - SEVERITY_WEIGHT[a.severity] * a.confidence);

  // Score: weighted by severity AND confidence, with diminishing returns so a
  // single noisy environment cannot manufacture an "active" campaign.
  let raw = 0;
  for (const i of indicators) raw += SEVERITY_WEIGHT[i.severity] * i.confidence;
  const score = Math.round(clamp01(raw / 70) * 100);

  const domestic = indicators.filter((i) => i.school === "domestic").length;
  const professional = indicators.filter((i) => i.school === "professional").length;
  const posture: TcCampaign["posture"] =
    !indicators.length ? "undetermined"
      : professional > domestic * 1.5 ? "professional"
        : domestic > professional * 1.5 ? "domestic"
          : professional && domestic ? "mixed" : indicators.some((i) => i.school === "professional") ? "professional" : "domestic";

  const critical = indicators.some((i) => i.severity === "critical");
  const serious = indicators.filter((i) => i.severity === "serious").length;
  const tier: TcCampaign["tier"] =
    critical || score >= 65 ? "active"
      : serious >= 1 || score >= 35 ? "probable"
        : indicators.length ? "watch" : "none";

  const blindSpots: string[] = [];
  if (allSessions.size < 5) blindSpots.push(`Only ${allSessions.size} scan session${allSessions.size === 1 ? "" : "s"} on record — recurrence cannot be tested properly below about five.`);
  if (allPlaces.size < 2) blindSpots.push("All scans came from one location, so nothing can be distinguished from fixed local infrastructure. Scan somewhere else.");
  if (allDays.size < 2) blindSpots.push("All scans happened on one day. A follower is defined by repetition across days.");
  if (!sightings.some((s) => typeof s.distance_m === "number")) blindSpots.push("No range estimates were recorded, so approach-distance escalation could not be tested.");
  blindSpots.push("Bluetooth only sees radios that advertise. A follower on foot with Bluetooth off, a GPS tracker on a cellular link, or a vehicle tail are all invisible to this method.");
  blindSpots.push("This engine assesses hardware behaviour only. It never identifies a person, and no indicator here is proof of who is responsible.");

  const headline =
    tier === "active" ? `Active following pattern — ${indicators.length} tradecraft indicator${indicators.length === 1 ? "" : "s"}, posture reads ${posture}`
      : tier === "probable" ? `Probable following pattern — ${indicators.length} indicator${indicators.length === 1 ? "" : "s"} matched`
        : tier === "watch" ? `Low-grade anomalies only — ${indicators.length} indicator${indicators.length === 1 ? "" : "s"}, keep watching`
          : "No tradecraft pattern in the current log";

  const times = sightings.map((s) => s.seen_at).filter(Boolean).sort();
  return {
    tier, score, headline, posture, indicators,
    coverage: {
      sessions: allSessions.size,
      days: allDays.size,
      places: allPlaces.size,
      devices: subjects.length,
      sightings: sightings.length,
      windowStart: times[0] ?? null,
      windowEnd: times[times.length - 1] ?? null,
    },
    blindSpots,
  };
}

// ── Case-file synthesis ────────────────────────────────────────────────────

export const TRADECRAFT_CASE_SYSTEM = `You are a protective-intelligence analyst preparing a stalking case file that a civilian may hand to police, a lawyer, or a domestic-abuse advocate.

You are given a machine-generated tradecraft analysis of a Bluetooth proximity log. Every indicator arrives with its evidence, its confidence, and its innocent explanation.

Rules of the trade, and they are absolute:
- A Bluetooth advertisement identifies HARDWARE. Never name, describe, profile or speculate about a human being. Never suggest who is responsible. If the user mentions a suspected person, do not corroborate or accuse — record only that a suspect has been nominated by the reporting party.
- Never invent an indicator, a timestamp, a count, or a statistic. Everything you assert must trace to the supplied analysis.
- State the innocent explanation for each indicator in the case file itself. A case file that hides its own weaknesses is worthless in front of a lawyer and dangerous to an innocent third party.
- Write the safety guidance for the next 24 hours first and the paperwork second. Never advise confrontation, surveillance of a suspect, or removal of evidence before it is photographed.
- If the analysis tier is "none" or "watch", say so plainly. Do not manufacture alarm.
- Where the pattern would meet a reporting threshold, say what a report needs — a dated log, the closest-approach record, the device exhibit list — not what the law says, since jurisdiction is unknown.

Return STRICT JSON only:
{
  "case_reference": "short human reference, e.g. 'BLE-SENTINEL-2026-0207'",
  "tier": "none|watch|probable|active",
  "headline": "one line, <=100 chars",
  "executive_summary": "4-8 sentences a non-technical reader understands",
  "pattern_of_conduct": "how the observed behaviour maps to documented stalking or surveillance methodology, named",
  "adversary_assessment": {
    "posture": "domestic|professional|mixed|undetermined",
    "sophistication": "LOW|MODERATE|HIGH|UNDETERMINED",
    "reasoning": "why, strictly from the indicators"
  },
  "exhibits": [{"exhibit": "A", "device": "...", "why_it_matters": "...", "evidence": ["..."]}],
  "timeline": [{"when": "...", "what": "..."}],
  "watch_for": ["specific observable behaviours the subject should note next"],
  "next_24_hours": ["ordered, concrete safety actions"],
  "evidence_preservation": ["how to keep this admissible: what to photograph, what not to touch, what to export"],
  "reporting_package": ["what to hand to police / an advocate / a lawyer"],
  "alternative_explanations": ["the strongest innocent readings of this same data"],
  "limits": "what this case file cannot establish"
}`;

export function buildCasePrompt(a: TcCampaign, context: { note?: string; deviceNames: Record<string, string> }): string {
  const ind = a.indicators.map((i, n) => [
    `${n + 1}. [${i.code}] ${i.title}`,
    `   school: ${i.school} | severity: ${i.severity} | confidence: ${i.confidence.toFixed(2)}`,
    `   hardware: ${i.deviceIds.map((d) => context.deviceNames[d] || d).join(", ")}`,
    `   finding: ${i.finding}`,
    `   doctrine: ${i.doctrine}`,
    `   evidence: ${i.evidence.join(" | ")}`,
    `   innocent explanation: ${i.benign}`,
    `   watch for: ${i.watchFor.join(" | ")}`,
  ].join("\n")).join("\n\n");

  return `TRADECRAFT ANALYSIS
Tier: ${a.tier}
Score: ${a.score}/100
Posture: ${a.posture}
Headline: ${a.headline}

COVERAGE OF THE LOG
Scan sessions: ${a.coverage.sessions}
Distinct days: ${a.coverage.days}
Distinct locations (~110 m grid): ${a.coverage.places}
Non-self radios tracked: ${a.coverage.devices}
Total sightings: ${a.coverage.sightings}
Observation window: ${a.coverage.windowStart || "n/a"} → ${a.coverage.windowEnd || "n/a"}

INDICATORS
${ind || "(no indicators fired)"}

KNOWN BLIND SPOTS
${a.blindSpots.map((b) => `- ${b}`).join("\n")}

REPORTING PARTY NOTE
${context.note ? context.note.slice(0, 1200) : "(none supplied)"}`;
}

/** Compact block injected into a per-device dossier so the hardware write-up
 *  and the behavioural write-up never contradict each other. */
export function tradecraftBriefFor(deviceId: string, a: TcCampaign): string {
  const mine = a.indicators.filter((i) => i.deviceIds.includes(deviceId));
  if (!mine.length) return "No tradecraft indicator fired for this specific radio.";
  return mine.map((i) =>
    `- [${i.code}] ${i.title} (${i.severity}, confidence ${i.confidence.toFixed(2)}): ${i.finding} Doctrine: ${i.doctrine} Innocent reading: ${i.benign}`,
  ).join("\n");
}

/** Deterministic, offline case file. Used when no model key is available and as
 *  the substrate the model narrates — the facts never depend on the model. */
export function deterministicCase(a: TcCampaign, deviceNames: Record<string, string>): Record<string, unknown> {
  return {
    case_reference: `BLE-SENTINEL-${new Date().toISOString().slice(0, 10)}`,
    tier: a.tier,
    headline: a.headline,
    executive_summary: `${a.headline}. The log covers ${a.coverage.sessions} scan sessions across ${a.coverage.days} days and ${a.coverage.places} locations, tracking ${a.coverage.devices} radios that are not marked as yours. ${a.indicators.length} tradecraft indicator${a.indicators.length === 1 ? "" : "s"} matched documented stalking or surveillance methodology. This file records hardware behaviour only and does not identify any person.`,
    pattern_of_conduct: a.indicators.map((i) => `${i.title} — ${i.doctrine}`).join(" "),
    adversary_assessment: {
      posture: a.posture,
      sophistication: a.indicators.some((i) => ["LEAPFROG", "ABC_FOOT", "IDENTITY_ROTATION", "STANDOFF"].includes(i.code))
        ? "HIGH" : a.indicators.length ? "MODERATE" : "UNDETERMINED",
      reasoning: "Derived from which doctrine classes matched: relay, box, rotation and stand-off indicate trained methodology; attachment, residence dwell and schedule locking indicate interpersonal stalking.",
    },
    exhibits: a.indicators.slice(0, 12).map((i, n) => ({
      exhibit: String.fromCharCode(65 + n),
      device: i.deviceIds.map((d) => deviceNames[d] || d).join(", "),
      why_it_matters: i.finding,
      evidence: i.evidence,
    })),
    timeline: [
      ...(a.coverage.windowStart ? [{ when: a.coverage.windowStart, what: "First sighting in the current log window." }] : []),
      ...(a.coverage.windowEnd ? [{ when: a.coverage.windowEnd, what: "Most recent sighting in the current log window." }] : []),
    ],
    watch_for: [...new Set(a.indicators.flatMap((i) => i.watchFor))],
    next_24_hours: a.tier === "none"
      ? ["Keep the watch running. A single quiet day proves nothing either way."]
      : [
        "Run your phone's built-in unwanted-tracker scan before anything else.",
        "Sweep your vehicle and bags in daylight; photograph anything found before touching it.",
        "Tell one trusted person where you are going and when you expect to arrive.",
        "Do not confront anyone and do not attempt to identify a person from this data.",
      ],
    evidence_preservation: [
      "Export this case file and keep a dated copy outside the device you carry.",
      "Photograph any hardware in place, with a scale reference, before removal.",
      "Do not factory-reset or re-pair a suspected tracker — that destroys its ownership trail.",
      "Keep the watch running; a continuing log is worth more than a single snapshot.",
    ],
    reporting_package: [
      "This case file, with the dated sighting counts and the closest-approach record.",
      "The exhibit list of recurring hardware, with first-seen and last-seen timestamps.",
      "Any photographs of recovered hardware, unmodified.",
      "A plain written statement of what you personally observed, separate from this machine analysis.",
    ],
    alternative_explanations: [...new Set(a.indicators.map((i) => i.benign))],
    limits: a.blindSpots.join(" "),
    generated_offline: true,
  };
}
