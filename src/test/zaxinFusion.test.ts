// Live-fire simulation for the AR Vision fusion stack.
// Drives FusionTracker, ContactMemory, and reasonScene with a synthetic but
// physically plausible scenario: an operator panning while a person carrying a
// phone walks from 12m to 2m, with noisy RSSI and intermittent optical hits.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FusionTracker } from "@/components/dashboard/zaxin/core/fusionEngine";
import { ContactMemory } from "@/components/dashboard/zaxin/core/contactMemory";
import { reasonScene } from "@/components/dashboard/zaxin/core/sceneReasoner";
import type { Contact, RssiSample } from "@/components/dashboard/zaxin/core/types";
import type { OpticalContact } from "@/components/dashboard/zaxin/core/opticalContacts";

const TX = -59;
const N = 2.2;
const rssiFor = (m: number) => TX - 10 * N * Math.log10(Math.max(0.1, m));

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: "dev-1",
    displayName: "Pixel 8",
    rawName: "Pixel 8",
    nameSource: "broadcast",
    manufacturer: "Google",
    inferredKind: "phone",
    serviceUuids: [],
    rssi: -70,
    distanceMeters: null,
    distanceLabel: "",
    zone: "far",
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    samples: [],
    behavior: "active",
    threatTier: "unknown",
    watchlisted: false,
    source: "local",
    bearing: null,
    bearingConfidence: 0.4,
    intel: null,
    ...over,
  };
}

/** Deterministic pseudo-noise so the suite never flakes. */
function noise(seed: number, amp: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amp;
}

describe("FusionTracker", () => {
  it("converges on the true bearing better than the raw noisy measurement", () => {
    const tracker = new FusionTracker({ fov: 62 });
    const truthBearing = 100;
    let rawErr = 0;
    let fusedErr = 0;
    let samples: RssiSample[] = [];

    for (let k = 0; k < 60; k++) {
      const heading = 90 + Math.sin(k / 8) * 12; // operator panning
      const measured = truthBearing + noise(k, 22);
      const rssi = rssiFor(8) + noise(k + 500, 4);
      samples = [...samples, { ts: Date.now() + k * 125, rssi }].slice(-24);
      const c = makeContact({ bearing: measured, rssi, bearingConfidence: 0.5, samples });
      const [out] = tracker.step([c], [], heading);
      if (k >= 20) {
        rawErr += Math.abs(measured - truthBearing);
        fusedErr += Math.abs(((out.bearing! - truthBearing + 540) % 360) - 180);
      }
    }
    expect(fusedErr).toBeLessThan(rawErr);
  });

  it("estimates range in log-space and reports a closing rate", () => {
    const tracker = new FusionTracker();
    let samples: RssiSample[] = [];
    let last: ReturnType<FusionTracker["step"]>[number] | undefined;

    for (let k = 0; k < 80; k++) {
      const trueRange = Math.max(2, 12 - k * 0.125);   // walking in
      const rssi = rssiFor(trueRange) + noise(k, 3);
      samples = [...samples, { ts: Date.now() + k * 125, rssi }].slice(-24);
      const c = makeContact({ rssi, samples, bearing: 100 });
      [last] = tracker.step([c], [], 100);
    }
    expect(last!.track.rangeM).toBeGreaterThan(1);
    expect(last!.track.rangeM).toBeLessThan(4.5);      // truth ends at 2m
    expect(last!.track.rangeRateMS).toBeLessThan(0);   // closing
    expect(last!.track.state).toBe("confirmed");
  });

  it("decays confidence while coasting instead of holding its best-ever value", () => {
    const tracker = new FusionTracker();
    let peak = 0;
    for (let k = 0; k < 20; k++) {
      const [o] = tracker.step([makeContact({ bearing: 90, bearingConfidence: 0.9, rssi: -60 })], [], 90);
      peak = Math.max(peak, o.track.confidence);
    }
    // Contact drops off the air; the engine must coast, not freeze.
    let coastConf = peak;
    for (let k = 0; k < 5; k++) {
      tracker.step([], [], 90);
      const [o] = tracker.step([makeContact({ bearing: null, rssi: null, bearingConfidence: 0 })], [], 90);
      coastConf = o.track.confidence;
    }
    expect(coastConf).toBeLessThan(peak);
  });

  it("binds an optical detection to the radio track and tightens the bearing", () => {
    const tracker = new FusionTracker({ fov: 62 });
    const heading = 100;
    const optical: OpticalContact[] = [
      { id: "opt-1", label: "cell phone", kind: "device", score: 0.82, x: 0.46, y: 0.4, w: 0.08, h: 0.14, ts: Date.now() },
    ];
    let out;
    for (let k = 0; k < 15; k++) {
      const c = makeContact({ bearing: 101 + noise(k, 10), rssi: rssiFor(4), bearingConfidence: 0.4 });
      [out] = tracker.step([c], optical, heading);
    }
    expect(out!.track.opticalId).toBe("opt-1");
    expect(out!.track.opticalCorrected).toBe(true);
    expect(out!.track.bearingSigmaDeg).toBeLessThan(12);
  });
});

describe("ContactMemory", () => {
  let mem: ContactMemory;
  beforeEach(async () => {
    mem = new ContactMemory();
    await mem.boot(); // no IndexedDB under vitest → in-memory fallback, must not throw
  });

  it("accumulates dossiers and votes on behaviour rather than last-write", () => {
    const c = makeContact({ rssi: -55, distanceMeters: 3 });
    for (let i = 0; i < 10; i++) mem.ingest([c], () => (i === 4 ? "vehicle-mounted" : "stationary-beacon"));
    const d = mem.get("dev-1")!;
    expect(d.sightings).toBe(10);
    expect(mem.dominantBehavior("dev-1").behavior).toBe("stationary-beacon");
    expect(d.bestRssi).toBe(-55);
    expect(d.closestRangeM).toBe(3);
  });

  it("raises a re-acquisition alert when an emitter returns after a long silence", () => {
    const c = makeContact();
    expect(mem.ingest([c])).toHaveLength(0);
    // Rewind the stored dossier to simulate a 40-minute gap.
    mem.get("dev-1")!.lastSeen = Date.now() - 40 * 60 * 1000;
    const returns = mem.ingest([c]);
    expect(returns).toHaveLength(1);
    expect(returns[0].gapMs).toBeGreaterThan(35 * 60 * 1000);
    // A second cycle must not re-fire the same alert.
    expect(mem.ingest([c])).toHaveLength(0);
  });

  it("recalls dossiers by free-text search and purges cleanly", async () => {
    mem.ingest([makeContact({ id: "a", displayName: "Pixel 8" })]);
    mem.ingest([makeContact({ id: "b", displayName: "Tile Tracker", manufacturer: "Tile" })]);
    expect(mem.search("tile").map((d) => d.id)).toEqual(["b"]);
    await mem.purge();
    expect(mem.stats().total).toBe(0);
  });
});

describe("reasonScene", () => {
  const tracker = new FusionTracker({ fov: 62 });

  it("flags a close, closing, watchlisted emitter as high threat with cited anchors", () => {
    let fused;
    for (let k = 0; k < 40; k++) {
      const trueRange = Math.max(1.5, 10 - k * 0.25);
      fused = tracker.step(
        [makeContact({ watchlisted: true, threatTier: "priority", bearing: 100, rssi: rssiFor(trueRange) + noise(k, 2) })],
        [],
        100,
      );
    }
    const a = reasonScene({
      contacts: fused!, optical: [], idents: [], env: null, heading: 100, fov: 62,
      watchlist: ["dev-1"], knownIds: new Set(),
    });
    expect(a.entities).toHaveLength(1);
    expect(["high", "elevated"]).toContain(a.entities[0].threat);
    expect(a.posture === "critical" || a.posture === "elevated").toBe(true);
    expect(a.entities[0].anchors.join(" ")).toMatch(/watchlist/i);
    expect(a.entities[0].anchors.join(" ")).toMatch(/range/i);
  });

  it("reports a concealed emitter when radio is close but optics see nothing", () => {
    const t2 = new FusionTracker({ fov: 62 });
    let fused;
    for (let k = 0; k < 20; k++) {
      fused = t2.step([makeContact({ bearing: 100, rssi: rssiFor(3) })], [
        { id: "opt-9", label: "chair", kind: "object", score: 0.7, x: 0.05, y: 0.6, w: 0.1, h: 0.2, ts: Date.now() },
      ], 100);
    }
    const a = reasonScene({
      contacts: fused!,
      optical: [{ id: "opt-9", label: "chair", kind: "object", score: 0.7, x: 0.05, y: 0.6, w: 0.1, h: 0.2, ts: Date.now() }],
      idents: [], env: null, heading: 100, fov: 62, knownIds: new Set(),
    });
    expect(a.discrepancies.join(" ")).toMatch(/no line of sight/i);
  });

  it("never invents entities and logs obstructions when sensors are degraded", () => {
    const a = reasonScene({
      contacts: [], optical: [], idents: [{ label: "drone", _ts: Date.now() }],
      env: { occupants: 3, lighting: { intensity_lux_est: 20 }, visibility_m: 4 },
      heading: null, fov: 62, knownIds: new Set(),
    });
    expect(a.entities).toHaveLength(0);
    expect(a.posture).toBe("clear");
    expect(a.cannotResolve.join(" ")).toMatch(/drone/);
    expect(a.cannotResolve.join(" ")).toMatch(/3 occupants/);
    expect(a.summary).toMatch(/Obstructions/);
  });
});
