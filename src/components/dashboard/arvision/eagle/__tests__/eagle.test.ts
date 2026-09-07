import { describe, expect, it } from "vitest";
import { IouTracker, toEngineLandmarks } from "../detector";
import { applyEdge, applyLowLight, applyThermal } from "../filters";
import { manifestFor, EVIDENCE_DISCLAIMER, type EvidenceRecord } from "../evidence";
import { ARVisionUtils } from "../engine";

// the filter maths is pure pixel work; node has no canvas, so a minimal
// ImageData stand-in lets it be tested without a browser.
if (typeof globalThis.ImageData === "undefined") {
  class ShimImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(a: Uint8ClampedArray | number, b: number, c?: number) {
      if (typeof a === "number") {
        this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4);
      } else {
        this.data = a; this.width = b; this.height = c ?? a.length / 4 / b;
      }
    }
  }
  (globalThis as unknown as { ImageData: unknown }).ImageData = ShimImageData;
}

const box = (x: number, y: number, w = 40, h = 90) => ({ x, y, width: w, height: h });

describe("iou tracker", () => {
  it("keeps a stable id while a person walks across the frame", () => {
    const t = new IouTracker();
    const a = t.step([box(100, 100)], 0);
    const b = t.step([box(112, 102)], 200);
    const c = t.step([box(126, 104)], 400);
    expect(a[0].trackId).toBe(b[0].trackId);
    expect(b[0].trackId).toBe(c[0].trackId);
    expect(c[0].speed).toBeGreaterThan(0);
  });

  it("issues distinct ids to two separated people", () => {
    const t = new IouTracker();
    const out = t.step([box(20, 20), box(600, 30)], 0);
    expect(new Set(out.map((o) => o.trackId)).size).toBe(2);
  });

  it("survives a short occlusion instead of minting a new identity", () => {
    const t = new IouTracker();
    const first = t.step([box(200, 100)], 0)[0].trackId;
    for (let i = 1; i <= 5; i++) t.step([], i * 100);
    const back = t.step([box(205, 100)], 700)[0].trackId;
    expect(back).toBe(first);
  });

  it("retires a track after the miss budget", () => {
    const t = new IouTracker();
    t.step([box(200, 100)], 0);
    for (let i = 1; i <= 20; i++) t.step([], i * 100);
    expect(t.size).toBe(0);
  });
});

describe("pose mapping", () => {
  const kp = (name: string, x: number, y: number, score = 0.9) => ({ name, x, y, score });

  it("returns undefined when no shoulder is confidently seen", () => {
    expect(toEngineLandmarks([kp("left_shoulder", 1, 1, 0.05), kp("right_shoulder", 2, 2, 0.02)])).toBeUndefined();
  });

  it("derives finger points along the forearm direction", () => {
    const lm = toEngineLandmarks([
      kp("left_shoulder", 100, 100), kp("right_shoulder", 140, 100),
      kp("left_elbow", 100, 140), kp("left_wrist", 100, 180),
    ])!;
    expect(lm).toBeDefined();
    expect(lm.leftIndex.y).toBeGreaterThan(lm.leftWrist.y);
    expect(lm.leftPinky.confidence).toBe(lm.leftWrist.confidence);
  });
});

function testImage(w = 8, h = 8): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = (i * 7) % 256;
    d[i * 4 + 1] = (i * 13) % 256;
    d[i * 4 + 2] = (i * 3) % 256;
    d[i * 4 + 3] = 255;
  }
  return new ImageData(d, w, h);
}

describe("filters", () => {
  it("thermal preserves dimensions and returns opaque pixels", () => {
    const out = applyThermal(testImage());
    expect(out.width).toBe(8);
    expect(out.data[3]).toBe(255);
  });

  it("low light lifts a dark pixel rather than leaving it black", () => {
    const src = new ImageData(new Uint8ClampedArray([20, 20, 20, 255]), 1, 1);
    const out = applyLowLight(src);
    expect(out.data[1]).toBeGreaterThan(20);
  });

  it("edge trace returns a light field with dark boundaries", () => {
    const out = applyEdge(testImage());
    expect(out.data.length).toBe(8 * 8 * 4);
  });
});

describe("evidence manifest", () => {
  const record: EvidenceRecord = {
    recordId: "evd_1", eventId: "evt_1", cameraId: "cam", cameraLabel: "front door",
    trackId: "trk_1", tier: "high", score: 62, patterns: ["loitering"],
    reason: "dwell far above the baseline for this zone",
    context: {
      capturedAtMs: 0, isoUtc: "1970-01-01T00:00:00.000Z", isoLocal: "1970-01-01T00:00:00+00:00",
      timezone: "UTC", utcOffsetMinutes: 0, coords: null, coordsStatus: "denied",
      coordsSource: "location permission was refused for this site",
      ipAddress: null, ipStatus: "unavailable", ipSource: "unavailable",
    },
    variants: [{ key: "clean", label: "clean frame", note: "unmodified", dataUrl: "data:,", sha256: "abc" }],
    reviewState: "unreviewed", reviewNote: "", reviewedAtMs: null, createdAtMs: 0,
  };

  it("never claims an identity", () => {
    const m = manifestFor(record);
    expect(m.subjectIdentity).toMatch(/no identification/);
    expect(m.limitations).toBe(EVIDENCE_DISCLAIMER);
  });

  it("records refused location honestly instead of a zero coordinate", () => {
    const m = manifestFor(record);
    expect(m.capture.coordinates).toBeNull();
    expect(m.capture.coordinatesStatus).toBe("denied");
    expect(m.capture.ipAddress).toBeNull();
  });

  it("carries a hash for every file", () => {
    expect(manifestFor(record).files.every((f) => f.sha256.length > 0)).toBe(true);
  });
});

describe("engine scoring stays reachable through the adapter", () => {
  it("maps a score to a tier", () => {
    expect(ARVisionUtils.scoreToTier(0)).toBe("observation");
    expect(ARVisionUtils.scoreToTier(100)).toBe("critical");
  });
});
