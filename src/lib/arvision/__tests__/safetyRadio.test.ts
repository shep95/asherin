import { describe, it, expect, beforeEach } from "vitest";
import { classifyDevice } from "@/lib/arvision/ble/classify";
import { localizeDevice, rssiToMeters, CLOCK_SKEW_LIMIT_MS } from "@/lib/arvision/ble/localize";
import { associationKey, BleTracker } from "@/lib/arvision/ble/tracker";
import { projectToCamera, type CameraPose } from "@/lib/arvision/ble/project";
import { parseBleObservation, parseScannerDecl } from "@/lib/arvision/sensors/adapters/bridge";
import type { BleObservation, BleScanner } from "@/lib/arvision/ble/types";
import { defaultRules, evaluateSeverity, sanitizeRules, isForbiddenSignal, type RuleFiring, type SafetyRule } from "@/lib/arvision/safety/rules";
import { IncidentStore } from "@/lib/arvision/safety/incidents";
import { createDetector, heartbeat, sweepDetectors, falsePositiveRate } from "@/lib/arvision/safety/detectors";
import { RollingFrameBuffer, captureEvidence, applyRetention, UNCONFIGURED_STORAGE, type EvidenceStorage } from "@/lib/arvision/safety/evidenceCapture";

const obs = (o: Partial<BleObservation> & { scannerId: string; rssi: number; atMs: number }): BleObservation => ({
  receivedAtMs: o.atMs,
  address: null,
  addressType: "unknown",
  txPower: null,
  localName: null,
  serviceUuids: [],
  manufacturerIds: [],
  serviceDataKeys: [],
  appearance: null,
  provenance: "test",
  ...o,
});

const scanner = (id: string, p: { x: number; y: number; z: number } | null, calibrated = true): BleScanner => ({
  id,
  label: id,
  position: p,
  positionAccuracyM: 0.5,
  txRefDbm: calibrated ? -59 : null,
  pathLossN: calibrated ? 2.2 : null,
  calibrated,
  zoneId: null,
  lastObservationMs: null,
  health: "live",
  adapter: "edge_bridge",
});

describe("bluetooth classification is evidence bound", () => {
  it("stays unknown when the advertisement carries nothing identifying", () => {
    const c = classifyDevice([obs({ scannerId: "s1", rssi: -60, atMs: 1000 })]);
    expect(c.category).toBe("unknown");
    expect(c.confidence).toBeLessThanOrEqual(0.1);
    expect(c.evidence.join(" ")).toMatch(/no company identifier|no broadcast fact/);
  });

  it("names the exact broadcast fact behind every conclusion", () => {
    const c = classifyDevice([
      obs({ scannerId: "s1", rssi: -55, atMs: 1000, manufacturerIds: [0x004c], serviceUuids: ["fe2c"], localName: "Studio Buds" }),
    ]);
    expect(c.category).toBe("audio");
    expect(c.vendor).toBe("Apple, Inc.");
    expect(c.evidence.some((e) => e.includes("0x004c"))).toBe(true);
    expect(c.evidence.some((e) => e.includes("fe2c"))).toBe(true);
    expect(c.confidence).toBeGreaterThan(0.4);
  });
});

describe("localization is gated on receiver evidence", () => {
  it("refuses any location when no scanner is calibrated", () => {
    const scanners = new Map([["s1", scanner("s1", { x: 0, y: 0, z: 0 }, false)]]);
    const l = localizeDevice([obs({ scannerId: "s1", rssi: -60, atMs: 1000 })], scanners, 1000);
    expect(l.mode).toBe("none");
    expect(l.position).toBeNull();
    expect(l.limitation).toMatch(/neither a range nor a position/);
  });

  it("gives range without direction from a single receiver", () => {
    const scanners = new Map([["s1", scanner("s1", { x: 0, y: 0, z: 0 })]]);
    const l = localizeDevice(
      [obs({ scannerId: "s1", rssi: -70, atMs: 1000 }), obs({ scannerId: "s1", rssi: -68, atMs: 1500 })],
      scanners,
      1600,
    );
    expect(l.mode).toBe("range_only");
    expect(l.position).toBeNull();
    expect(l.rangeM).toBeGreaterThan(0);
    expect(l.uncertaintyM).toBeGreaterThan(0);
    expect(l.limitation).toMatch(/no position marker/);
  });

  it("still refuses a point from two receivers", () => {
    const scanners = new Map([
      ["s1", scanner("s1", { x: 0, y: 0, z: 0 })],
      ["s2", scanner("s2", { x: 6, y: 0, z: 0 })],
    ]);
    const l = localizeDevice(
      [obs({ scannerId: "s1", rssi: -65, atMs: 1000 }), obs({ scannerId: "s2", rssi: -66, atMs: 1000 })],
      scanners,
      1000,
    );
    expect(l.mode).toBe("range_only");
    expect(l.limitation).toMatch(/three surveyed calibrated receivers/);
  });

  it("solves a position from three calibrated surveyed receivers and states the uncertainty", () => {
    const scanners = new Map([
      ["s1", scanner("s1", { x: 0, y: 0, z: 0 })],
      ["s2", scanner("s2", { x: 10, y: 0, z: 0 })],
      ["s3", scanner("s3", { x: 0, y: 10, z: 0 })],
    ]);
    const truth = { x: 3, y: 4, z: 0 };
    const rssiFor = (s: BleScanner) => {
      const d = Math.hypot(truth.x - s.position!.x, truth.y - s.position!.y);
      return -59 - 10 * 2.2 * Math.log10(d);
    };
    const list = [...scanners.values()].map((s) => obs({ scannerId: s.id, rssi: rssiFor(s), atMs: 1000 }));
    const l = localizeDevice(list, scanners, 1000);
    expect(l.mode).toBe("multilateration");
    expect(l.position).not.toBeNull();
    expect(Math.hypot(l.position!.x - truth.x, l.position!.y - truth.y)).toBeLessThan(2);
    expect(l.uncertaintyM).toBeGreaterThan(0);
    expect(l.scannerCount).toBe(3);
  });

  it("drops observations from a scanner whose clock is skewed", () => {
    const scanners = new Map([["s1", scanner("s1", { x: 0, y: 0, z: 0 })]]);
    const skewed = obs({ scannerId: "s1", rssi: -60, atMs: 1000 });
    skewed.receivedAtMs = 1000 + CLOCK_SKEW_LIMIT_MS + 1000;
    const l = localizeDevice([skewed], scanners, skewed.receivedAtMs);
    expect(l.mode).toBe("none");
    expect(l.evidence.join(" ")).toMatch(/clock differs/);
  });

  it("ignores observations older than the staleness window", () => {
    const scanners = new Map([["s1", scanner("s1", { x: 0, y: 0, z: 0 })]]);
    const l = localizeDevice([obs({ scannerId: "s1", rssi: -60, atMs: 1000 })], scanners, 1000 + 60_000);
    expect(l.mode).toBe("none");
  });

  it("converts signal strength to distance monotonically", () => {
    expect(rssiToMeters(-59, -59, 2.2)).toBeCloseTo(1, 1);
    expect(rssiToMeters(-80, -59, 2.2)).toBeGreaterThan(rssiToMeters(-70, -59, 2.2));
  });
});

describe("association never claims identity", () => {
  it("groups a stable address directly and marks it non pseudonymous", () => {
    const a = associationKey(obs({ scannerId: "s", rssi: -50, atMs: 1, address: "aa:bb:cc:dd:ee:ff", addressType: "public" }));
    expect(a.key).toBe("AA:BB:CC:DD:EE:FF");
    expect(a.pseudonymous).toBe(false);
  });

  it("groups a rotating address pseudonymously and only on broadcast traits", () => {
    const one = associationKey(
      obs({ scannerId: "s", rssi: -50, atMs: 1, address: "11:22:33:44:55:66", addressType: "random_resolvable", localName: "Watch", manufacturerIds: [0x0075] }),
    );
    const two = associationKey(
      obs({ scannerId: "s", rssi: -52, atMs: 2, address: "77:88:99:aa:bb:cc", addressType: "random_resolvable", localName: "Watch", manufacturerIds: [0x0075] }),
    );
    expect(one.pseudonymous).toBe(true);
    expect(one.key).toBe(two.key);
    expect(one.key.startsWith("pseudo:")).toBe(true);
  });

  it("treats a featureless rotating address as a new device each rotation", () => {
    const one = associationKey(obs({ scannerId: "s", rssi: -50, atMs: 1, address: "11:22:33:44:55:66", addressType: "random_nonresolvable" }));
    const two = associationKey(obs({ scannerId: "s", rssi: -50, atMs: 2, address: "aa:22:33:44:55:66", addressType: "random_nonresolvable" }));
    expect(one.key).not.toBe(two.key);
  });
});

describe("tracker ledger", () => {
  it("refuses observations from a scanner that is not authorized", () => {
    const t = new BleTracker();
    expect(t.ingest(obs({ scannerId: "rogue", rssi: -50, atMs: 1000 }))).toBeNull();
  });

  it("writes provenance stamped timeline lines and ages silence", () => {
    const t = new BleTracker();
    t.upsertScanner(scanner("s1", { x: 0, y: 0, z: 0 }));
    const rec = t.ingest(obs({ scannerId: "s1", rssi: -55, atMs: 1000, address: "AA:BB:CC:DD:EE:01", addressType: "public" }))!;
    expect(rec.timeline[0].kind).toBe("first_seen");
    expect(rec.timeline[0].provenance).toContain("s1");
    t.sweep(1000 + 120_000);
    const after = t.devicesList()[0];
    expect(after.stale).toBe(true);
    expect(after.timeline.some((e) => e.kind === "lost")).toBe(true);
  });

  it("records address rotation as normal privacy behaviour", () => {
    const t = new BleTracker();
    t.upsertScanner(scanner("s1", null));
    const base = { scannerId: "s1", rssi: -60, addressType: "random_resolvable" as const, localName: "Buds", manufacturerIds: [0x004c] };
    t.ingest(obs({ ...base, atMs: 1000, address: "11:11:11:11:11:11" }));
    const rec = t.ingest(obs({ ...base, atMs: 2000, address: "22:22:22:22:22:22" }))!;
    expect(rec.addresses.length).toBe(2);
    expect(rec.timeline.some((e) => e.kind === "address_rotated")).toBe(true);
    expect(rec.pseudonymous).toBe(true);
  });
});

describe("camera registration", () => {
  const pose = (hfov: number | null): CameraPose => ({
    position: { x: 0, y: 0, z: 1.5 },
    yawDeg: 0,
    pitchDeg: 0,
    hfovDeg: hfov,
    aspect: 16 / 9,
    source: "test survey",
  });

  it("draws nothing when the lens never reported a field of view", () => {
    const p = projectToCamera(pose(null), { x: 0, y: 5, z: 1.5 }, 1);
    expect(p.state).toBe("unavailable");
  });

  it("places a point ahead in the centre with an uncertainty sized marker", () => {
    const p = projectToCamera(pose(70), { x: 0, y: 8, z: 1.5 }, 2);
    expect(p.state).toBe("on_screen");
    if (p.state !== "on_screen") return;
    expect(p.x).toBeCloseTo(0.5, 1);
    expect(p.radius).toBeGreaterThan(0);
    const tighter = projectToCamera(pose(70), { x: 0, y: 8, z: 1.5 }, 0.5);
    if (tighter.state === "on_screen") expect(tighter.radius).toBeLessThan(p.radius);
  });

  it("returns an edge indicator with a bearing when the point is behind the camera", () => {
    const p = projectToCamera(pose(70), { x: 0, y: -8, z: 1.5 }, 1);
    expect(p.state).toBe("off_screen");
    if (p.state !== "off_screen") return;
    expect(Math.abs(p.offAxisDeg)).toBeGreaterThan(35);
  });
});

describe("bridge payload validation", () => {
  it("discards malformed advertisements instead of coercing them", () => {
    expect(parseBleObservation({ rssi: -50 }, 1)).toBeNull();
    expect(parseBleObservation({ scannerId: "s", rssi: "loud" }, 1)).toBeNull();
    expect(parseBleObservation({ scannerId: "s", rssi: 400 }, 1)).toBeNull();
  });

  it("accepts a well formed advertisement and stamps receipt time", () => {
    const o = parseBleObservation({ scannerId: "s1", rssi: -61, atMs: 500, address: "aa:bb:cc:dd:ee:ff", addressType: "public" }, 900);
    expect(o).not.toBeNull();
    expect(o!.receivedAtMs).toBe(900);
    expect(o!.address).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("derives calibration rather than trusting the node's word for it", () => {
    const uncal = parseScannerDecl({ id: "s1", label: "front door" });
    expect(uncal!.calibrated).toBe(false);
    const cal = parseScannerDecl({ id: "s2", txRefDbm: -59, pathLossN: 2.3 });
    expect(cal!.calibrated).toBe(true);
  });
});

describe("severity comes only from observable events", () => {
  it("rejects every profiling signal by name", () => {
    for (const bad of ["body_language", "gaze", "intent", "suspicion", "appearance", "race"]) {
      expect(isForbiddenSignal(bad)).toBe(true);
    }
    expect(isForbiddenSignal("door_forced")).toBe(false);
  });

  it("drops a rule that tries to score a person", () => {
    const rules = [
      ...defaultRules(),
      { id: "bad", label: "nervous body_language", signal: "body_language", zoneId: null, threshold: 1, unit: "", weight: 1, dedupeWindowMs: 0, enabled: true, rationale: "" } as unknown as SafetyRule,
    ];
    const { rules: kept, rejected } = sanitizeRules(rules);
    expect(kept.some((r) => r.id === "bad")).toBe(false);
    expect(rejected[0]).toMatch(/refused/);
  });

  it("scores only rules whose configured threshold was exceeded", () => {
    const rules = defaultRules();
    const under: RuleFiring = { ruleId: "door_held", signal: "door_held_open", value: 10, atMs: 1, zoneId: null, provenance: "door sensor 4" };
    expect(evaluateSeverity(rules, [under]).contributions.length).toBe(0);
    const over: RuleFiring = { ...under, value: 45 };
    const res = evaluateSeverity(rules, [over]);
    expect(res.contributions.length).toBe(1);
    expect(res.contributions[0].detail).toContain("door sensor 4");
    expect(res.statement).toMatch(/not an assessment of any person/);
  });
});

describe("incident ledger", () => {
  let store: IncidentStore;
  beforeEach(() => { store = new IncidentStore(); });

  const firing = (atMs: number): RuleFiring => ({ ruleId: "door_forced", signal: "door_forced", value: 1, atMs, zoneId: "lobby", provenance: "door sensor 1" });
  const sev = () => evaluateSeverity(defaultRules(), [firing(1)]);

  it("collapses repeat firings of the same thing into one incident", () => {
    const a = store.record(firing(1000), sev(), 60_000, { label: "door forced", detectorId: "d1" });
    const b = store.record(firing(5000), sev(), 60_000, { label: "door forced", detectorId: "d1" });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(store.list().length).toBe(1);
    expect(store.list()[0].firings.length).toBe(2);
  });

  it("opens a new incident once the dedupe window has passed", () => {
    store.record(firing(1000), sev(), 10_000, { label: "door forced", detectorId: "d1" });
    const later = store.record(firing(100_000), sev(), 10_000, { label: "door forced", detectorId: "d1" });
    expect(later.created).toBe(true);
    expect(store.list().length).toBe(2);
  });

  it("opens needing review and only a person can move it", () => {
    const { incident } = store.record(firing(1000), sev(), 10_000, { label: "door forced", detectorId: "d1" });
    expect(incident.review).toBe("needs_review");
    store.review(incident.id, "false_positive", "operator abc", 2000, "delivery driver");
    expect(store.get(incident.id)!.review).toBe("false_positive");
    expect(store.falsePositiveCounts().d1).toBe(1);
  });
});

describe("detector health", () => {
  it("treats silence as unknown, never as all clear", () => {
    let d = createDetector("d1", "line crossing", "edge node", 5000);
    expect(d.state).toBe("unconfigured");
    d = heartbeat(d, 10_000);
    expect(sweepDetectors([d], 12_000)[0].state).toBe("healthy");
    expect(sweepDetectors([d], 25_000)[0].state).toBe("degraded");
    const failed = sweepDetectors([d], 60_000)[0];
    expect(failed.state).toBe("failed");
    expect(failed.detail).toMatch(/not as all-clear/);
  });

  it("reports a false positive rate only once something has fired", () => {
    const d = createDetector("d1", "line crossing", "edge node", 5000);
    expect(falsePositiveRate(d)).toBeNull();
    expect(falsePositiveRate({ ...d, firings: 4, falsePositives: 1 })).toBe(0.25);
  });
});

describe("evidence capture", () => {
  const frame = (atMs: number) => ({ atMs, dataUrl: `data:image/png;base64,AAA${atMs}`, width: 2, height: 2, overlay: { boxes: [] }, sourceId: "cam1" });

  it("keeps the seconds before a trigger and honours the cadence", () => {
    const buf = new RollingFrameBuffer({ preRollMs: 5000, postRollMs: 1000, intervalMs: 500, maxFrames: 40 });
    expect(buf.push(frame(1000))).toBe(true);
    expect(buf.push(frame(1100))).toBe(false);
    for (let t = 1500; t <= 6000; t += 500) buf.push(frame(t));
    const window = buf.window(6000);
    expect(window.length).toBeGreaterThan(5);
    expect(window[0].atMs).toBeGreaterThanOrEqual(1000);
  });

  it("says so plainly when nothing was buffered", async () => {
    const out = await captureEvidence(new RollingFrameBuffer(), "inc1", 1000, UNCONFIGURED_STORAGE);
    expect(out.ok).toBe(false);
    expect(out.state).toBe("no_frames");
  });

  it("marks a capture session only when no storage backend exists", async () => {
    const buf = new RollingFrameBuffer();
    buf.push(frame(1000));
    const out = await captureEvidence(buf, "inc1", 1000, UNCONFIGURED_STORAGE);
    expect(out.ok).toBe(true);
    expect(out.bundle).not.toBeNull();
    if (out.bundle) {
      expect(out.bundle.storage).toBe("session_only");
      expect(out.bundle.retentionUntilMs).toBe(0);
      expect(out.detail).toMatch(/not retained/);
      expect(out.bundle.frames[0].dataUrl).toBe(frame(1000).dataUrl);
      expect(out.bundle.frames[0].overlay).toEqual({ boxes: [] });
    }
  });

  it("surfaces a storage failure instead of claiming the capture was kept", async () => {
    const buf = new RollingFrameBuffer();
    buf.push(frame(1000));
    const failing: EvidenceStorage = {
      configured: true,
      detail: "backend",
      retentionMs: 3600_000,
      put: async () => ({ ok: false, detail: "the archive rejected the write: quota exceeded" }),
    };
    const out = await captureEvidence(buf, "inc1", 1000, failing);
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/quota exceeded/);
  });

  it("drops bundles past their retention deadline but keeps session only ones", () => {
    const kept = applyRetention(
      [
        { id: "a", retentionUntilMs: 0 } as never,
        { id: "b", retentionUntilMs: 500 } as never,
        { id: "c", retentionUntilMs: 5000 } as never,
      ],
      1000,
    );
    expect(kept.map((b) => b.id)).toEqual(["a", "c"]);
  });
});
