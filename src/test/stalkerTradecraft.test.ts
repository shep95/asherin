import { describe, it, expect } from "vitest";
import {
  analyzeTradecraft,
  deterministicCase,
  tradecraftBriefFor,
  TRADECRAFT_DOCTRINE,
  type TcDevice,
  type TcSighting,
} from "../../supabase/functions/_shared/stalkerTradecraft";

/**
 * The engine is judged on two failure modes, and the second matters more:
 *  1. missing a real following pattern, and
 *  2. manufacturing one out of an ordinary commute.
 * Every scenario below is a synthetic radio log with a known ground truth.
 */

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const BASE = Date.UTC(2026, 6, 1, 9, 0, 0); // Wed 1 Jul 2026 09:00Z

const dev = (id: string, over: Partial<TcDevice> = {}): TcDevice => ({
  id,
  display_name: `Radio ${id}`,
  manufacturer: null,
  inferred_kind: "unknown",
  is_self: false,
  is_ignored: false,
  first_seen: new Date(BASE).toISOString(),
  last_seen: new Date(BASE).toISOString(),
  encounter_count: 0,
  distinct_days: 0,
  distinct_places: 0,
  closest_distance_m: null,
  ...over,
});

const sight = (deviceId: string, at: number, session: string, place: string | null, distance: number | null): TcSighting => ({
  device_id: deviceId,
  seen_at: new Date(at).toISOString(),
  session_id: session,
  place_key: place,
  distance_m: distance,
  rssi: distance == null ? null : -Math.round(40 + distance),
});

const codes = (c: ReturnType<typeof analyzeTradecraft>) => c.indicators.map((i) => i.code);

describe("tradecraft engine — true positives", () => {
  it("flags a tag travelling with the subject as constant attachment", () => {
    const d = dev("tag", { display_name: "AirTag", inferred_kind: "tracker" });
    const s: TcSighting[] = [];
    // Eight sessions, five different places, always within a few metres.
    for (let i = 0; i < 8; i++) {
      s.push(sight("tag", BASE + i * 6 * HOUR, `s${i}`, `place-${i % 5}`, 3 + (i % 3)));
      // Ambient noise so the presence ratio is a real ratio, not a tautology.
      s.push(sight("noise", BASE + i * 6 * HOUR, `s${i}`, `place-${i % 5}`, 40));
    }
    const c = analyzeTradecraft([d, dev("noise")], s, BASE + 9 * DAY);
    expect(codes(c)).toContain("TECH_PLACEMENT");
    expect(["probable", "active"]).toContain(c.tier);
  });

  it("flags night presence at the dominant home cell", () => {
    const s: TcSighting[] = [];
    for (let day = 0; day < 4; day++) {
      // 23:30 local-clock sightings at the home cell across four nights.
      const at = new Date(Date.UTC(2026, 6, 1 + day, 23, 30)).getTime();
      s.push(sight("watcher", at, `n${day}`, "home", 30));
      s.push(sight("watcher", at + 20 * 60_000, `n${day}`, "home", 30));
    }
    // Home really is the dominant cell.
    for (let i = 0; i < 6; i++) s.push(sight("self-ish", BASE + i * HOUR, `d${i}`, "home", 5));
    const c = analyzeTradecraft([dev("watcher"), dev("self-ish", { is_self: true })], s, BASE + 6 * DAY);
    expect(codes(c)).toContain("RESIDENCE_WATCH");
  });

  it("flags a closing approach distance", () => {
    const s: TcSighting[] = [];
    const dists = [60, 58, 55, 52, 30, 20, 10, 6];
    dists.forEach((d, i) => s.push(sight("closer", BASE + i * 12 * HOUR, `c${i}`, `p${i % 3}`, d)));
    const c = analyzeTradecraft([dev("closer", { closest_distance_m: 6 })], s, BASE + 6 * DAY);
    expect(codes(c)).toContain("LIFE_INVASION");
    // Severity keys off the robust late-window median (15 m here), not the
    // single closest sample — one lucky ping must not escalate a case.
    expect(c.indicators.find((i) => i.code === "LIFE_INVASION")!.severity).toBe("serious");
  });

  it("escalates a closing approach to critical once the late median is intimate range", () => {
    const s: TcSighting[] = [];
    [60, 55, 50, 45, 7, 6, 5, 4].forEach((d, i) => s.push(sight("closer", BASE + i * 12 * HOUR, `c${i}`, `p${i % 3}`, d)));
    const c = analyzeTradecraft([dev("closer", { closest_distance_m: 4 })], s, BASE + 6 * DAY);
    expect(c.indicators.find((i) => i.code === "LIFE_INVASION")!.severity).toBe("critical");
    expect(c.tier).toBe("active");
  });

  it("flags a co-travelling cluster as an ABC / box pattern", () => {
    const s: TcSighting[] = [];
    for (const id of ["a", "b", "c"]) {
      for (let i = 0; i < 4; i++) s.push(sight(id, BASE + i * 8 * HOUR, `k${i}`, `place-${i % 3}`, 35));
    }
    const c = analyzeTradecraft(["a", "b", "c"].map((i) => dev(i)), s, BASE + 4 * DAY);
    expect(codes(c)).toContain("ABC_FOOT");
  });

  it("flags a leapfrog relay chain", () => {
    const s: TcSighting[] = [];
    // Three radios, each holding ~25 minutes, each picking up as the last drops.
    const starts = [0, 30, 60];
    ["r1", "r2", "r3"].forEach((id, n) => {
      s.push(sight(id, BASE + starts[n] * 60_000, "walk", "route", 25));
      s.push(sight(id, BASE + (starts[n] + 25) * 60_000, "walk", "route", 25));
    });
    const c = analyzeTradecraft(["r1", "r2", "r3"].map((i) => dev(i)), s, BASE + DAY);
    expect(codes(c)).toContain("LEAPFROG");
  });

  it("flags break-off then return", () => {
    const s: TcSighting[] = [
      sight("burn", BASE, "b1", "p1", 20),
      sight("burn", BASE + 2 * HOUR, "b1", "p1", 20),
      sight("burn", BASE + 12 * DAY, "b2", "p2", 20),
      sight("burn", BASE + 12 * DAY + HOUR, "b2", "p2", 20),
    ];
    const c = analyzeTradecraft([dev("burn")], s, BASE + 13 * DAY);
    expect(codes(c)).toContain("BURN_BREAK");
  });

  it("flags a new-actor surge", () => {
    const s: TcSighting[] = [];
    for (let i = 0; i < 4; i++) s.push(sight("new", BASE + i * 6 * HOUR, `x${i}`, `p${i}`, 25));
    const c = analyzeTradecraft([dev("new")], s, BASE + 2 * DAY);
    expect(codes(c)).toContain("SURGE");
  });

  it("flags schedule locking", () => {
    const s: TcSighting[] = [];
    for (let day = 0; day < 5; day++) {
      const at = new Date(2026, 6, 1 + day, 8, 15).getTime(); // local 08:15
      s.push(sight("commute", at, `w${day}`, `p${day % 2}`, 30));
    }
    const c = analyzeTradecraft([dev("commute")], s, BASE + 6 * DAY);
    expect(codes(c)).toContain("SCHEDULE_LOCK");
  });
});

describe("tradecraft engine — false-positive discipline", () => {
  it("stays silent on an empty log", () => {
    const c = analyzeTradecraft([], []);
    expect(c.tier).toBe("none");
    expect(c.indicators).toHaveLength(0);
    expect(c.blindSpots.length).toBeGreaterThan(0);
  });

  it("does not flag hardware the user marked as their own or muted", () => {
    const s: TcSighting[] = [];
    for (let i = 0; i < 10; i++) {
      s.push(sight("mine", BASE + i * 4 * HOUR, `s${i}`, `p${i % 4}`, 2));
      s.push(sight("muted", BASE + i * 4 * HOUR, `s${i}`, `p${i % 4}`, 2));
    }
    const c = analyzeTradecraft(
      [dev("mine", { is_self: true }), dev("muted", { is_ignored: true })],
      s,
      BASE + 5 * DAY,
    );
    expect(c.indicators).toHaveLength(0);
    expect(c.tier).toBe("none");
  });

  it("does not manufacture a campaign from a single-place, single-day log", () => {
    const s: TcSighting[] = [];
    for (let i = 0; i < 12; i++) s.push(sight(`amb${i % 6}`, BASE + i * 5 * 60_000, "one", "cafe", 20));
    const devices = Array.from({ length: 6 }, (_, i) => dev(`amb${i}`));
    const c = analyzeTradecraft(devices, s, BASE + HOUR);
    expect(["none", "watch"]).toContain(c.tier);
    expect(c.blindSpots.join(" ")).toMatch(/one location|one day/i);
  });

  it("does not fire on a device seen once", () => {
    const c = analyzeTradecraft([dev("once")], [sight("once", BASE, "s1", "p1", 5)], BASE + HOUR);
    expect(c.indicators).toHaveLength(0);
  });

  it("keeps score bounded and every indicator honest", () => {
    const s: TcSighting[] = [];
    for (let i = 0; i < 30; i++) s.push(sight("tag", BASE + i * 3 * HOUR, `s${i}`, `p${i % 8}`, 2));
    const c = analyzeTradecraft([dev("tag", { closest_distance_m: 2 })], s, BASE + 10 * DAY);
    expect(c.score).toBeLessThanOrEqual(100);
    expect(c.score).toBeGreaterThan(0);
    for (const i of c.indicators) {
      expect(i.confidence).toBeGreaterThan(0);
      expect(i.confidence).toBeLessThanOrEqual(1);
      expect(i.benign.length).toBeGreaterThan(20);        // innocent reading always present
      expect(i.watchFor.length).toBeGreaterThan(0);
      expect(i.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("case-file synthesis", () => {
  it("produces a complete offline case file with alternatives and limits", () => {
    const s: TcSighting[] = [];
    for (let i = 0; i < 10; i++) s.push(sight("tag", BASE + i * 5 * HOUR, `s${i}`, `p${i % 4}`, 3));
    const c = analyzeTradecraft([dev("tag", { display_name: "AirTag", closest_distance_m: 3 })], s, BASE + 4 * DAY);
    const file = deterministicCase(c, { tag: "AirTag" }) as any;
    expect(file.tier).toBe(c.tier);
    expect(file.exhibits.length).toBeGreaterThan(0);
    expect(file.alternative_explanations.length).toBeGreaterThan(0);
    expect(file.next_24_hours.length).toBeGreaterThan(0);
    expect(String(file.limits)).toMatch(/never identifies a person/i);
    expect(tradecraftBriefFor("tag", c)).toMatch(/TECH_PLACEMENT/);
  });

  it("exposes a doctrine catalogue with counters for every entry", () => {
    expect(TRADECRAFT_DOCTRINE.length).toBeGreaterThanOrEqual(9);
    for (const d of TRADECRAFT_DOCTRINE) {
      expect(d.radioSignature.length).toBeGreaterThan(20);
      expect(d.counter.length).toBeGreaterThan(20);
    }
  });
});
