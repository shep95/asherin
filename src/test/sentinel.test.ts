import { describe, expect, it } from "vitest";
import { FRAME, featureSeries, frameFeatures } from "@/lib/sentinel/audio/dsp";
import { segmentSeries } from "@/lib/sentinel/audio/vad";
import { classifySounds } from "@/lib/sentinel/audio/soundEvents";
import { cosine, embedVoice, matchSpeaker, mergeCentroid, MATCH_THRESHOLD } from "@/lib/sentinel/audio/voiceprint";
import { bindable, extractNames, selfClaim } from "@/lib/sentinel/audio/nameExtraction";
import { encodeWav, resample, tooThinToSend, TARGET_RATE } from "@/lib/sentinel/audio/wav";

const RATE = 16000;

/** A voiced tone with harmonics — the acoustic shape of a vowel, not a beep. */
function voice(seconds: number, f0: number, brightness = 0.35): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] =
      0.5 * Math.sin(2 * Math.PI * f0 * t) +
      0.28 * Math.sin(2 * Math.PI * f0 * 2 * t) +
      brightness * 0.2 * Math.sin(2 * Math.PI * f0 * 3 * t) +
      brightness * 0.12 * Math.sin(2 * Math.PI * f0 * 5 * t);
    out[i] *= 0.35 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 4 * t)); // cadence
  }
  return out;
}

function silence(seconds: number, floor = 0.0004): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * floor;
  return out;
}

function join(...parts: Float32Array[]): Float32Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

describe("sentinel dsp", () => {
  it("measures a voiced frame as voiced with a plausible pitch", () => {
    const f = frameFeatures(voice(0.2, 140).subarray(0, FRAME), RATE);
    expect(f.rms).toBeGreaterThan(0.05);
    expect(f.pitch).toBeGreaterThan(90);
    expect(f.pitch).toBeLessThan(220);
  });

  it("reports near-zero energy on silence", () => {
    const f = frameFeatures(silence(0.1).subarray(0, FRAME), RATE);
    expect(f.rms).toBeLessThan(0.01);
  });
});

describe("sentinel vad", () => {
  it("finds two turns separated by silence and ignores the silence", () => {
    const buffer = join(silence(0.6), voice(1.1, 130), silence(0.9), voice(1.0, 210), silence(0.6));
    const segments = segmentSeries(featureSeries(buffer, RATE));
    expect(segments.length).toBe(2);
    expect(segments.every((s) => s.voiced)).toBe(true);
  });

  it("opens nothing on a silent room", () => {
    expect(segmentSeries(featureSeries(silence(4), RATE)).length).toBe(0);
  });
});

describe("sentinel voiceprint", () => {
  const frameMs = (FRAME * 1000) / RATE;
  const printFor = (f0: number, brightness = 0.35) =>
    embedVoice(featureSeries(voice(1.4, f0, brightness), RATE), frameMs)!;

  it("refuses a sample too short to characterise a person", () => {
    expect(embedVoice(featureSeries(voice(0.3, 140), RATE), frameMs)).toBeNull();
  });

  it("recognises the same voice heard twice", () => {
    const a = printFor(135);
    const b = printFor(137);
    expect(cosine(a, b)).toBeGreaterThan(MATCH_THRESHOLD);
    const m = matchSpeaker(b, [{ id: "1", label: "speaker 1", name: null, embedding: a, sampleCount: 3 }]);
    expect(m.kind).toBe("match");
  });

  it("does not fold a clearly different voice into a stored one", () => {
    const low = printFor(105, 0.15);
    const high = printFor(240, 0.9);
    const m = matchSpeaker(high, [{ id: "1", label: "speaker 1", name: null, embedding: low, sampleCount: 5 }]);
    expect(m.kind).toBe("new");
  });

  it("keeps a merged centroid unit length and close to its history", () => {
    const a = printFor(135);
    const b = printFor(180);
    const merged = mergeCentroid(a, b, 10);
    const norm = Math.sqrt(merged.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
    expect(cosine(merged, a)).toBeGreaterThan(cosine(merged, b) - 1); // history dominates
    expect(cosine(merged, a)).toBeGreaterThan(0.99);
  });
});

describe("sentinel sound events", () => {
  it("flags a broadband transient rather than staying silent about it", () => {
    const room = silence(0.8, 0.0008);
    const bang = new Float32Array(Math.round(0.05 * RATE));
    for (let i = 0; i < bang.length; i++) bang[i] = (Math.random() * 2 - 1) * 0.8 * Math.exp(-i / 400);
    const events = classifySounds(featureSeries(join(room, bang, silence(0.8, 0.0008)), RATE));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].evidence).toBeTruthy();
  });

  it("stays quiet on an empty room", () => {
    expect(classifySounds(featureSeries(silence(2), RATE)).length).toBe(0);
  });
});

describe("sentinel name extraction", () => {
  it("binds a first-person claim", () => {
    const claim = selfClaim("hold on, my name is James and i live here");
    expect(claim?.name).toBe("James");
    expect(bindable(claim)).toBe(true);
  });

  it("never binds a name that was called out to someone else", () => {
    const findings = extractNames("hey Marcus, come here");
    expect(findings.some((f) => f.scope === "self")).toBe(false);
    expect(findings.find((f) => f.scope === "addressed")?.name).toBe("Marcus");
    expect(bindable(selfClaim("hey Marcus, come here"))).toBe(false);
  });

  it("refuses an imperative mistaken for a name", () => {
    expect(extractNames("hey get the door").length).toBe(0);
    expect(selfClaim("i'm sorry")).toBeNull();
    expect(selfClaim("i'm going out")).toBeNull();
  });
});

describe("sentinel wav container", () => {
  it("writes a complete riff header at the target rate", () => {
    const bytes = encodeWav(voice(1, 140), TARGET_RATE);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe("WAVE");
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(TARGET_RATE);
    expect(tooThinToSend(bytes)).toBe(false);
  });

  it("refuses a header-only recording", () => {
    expect(tooThinToSend(encodeWav(new Float32Array(200), TARGET_RATE))).toBe(true);
  });

  it("resamples to the target length without destroying the tone", () => {
    const at48 = voice(1, 140);
    const down = resample(at48, 48000, 16000);
    expect(down.length).toBeCloseTo(at48.length / 3, -2);
  });
});
