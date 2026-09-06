import { describe, expect, it } from "vitest";
import { FRAME, featureSeries, frameFeatures } from "@/lib/sentinel/audio/dsp";
import { segmentSeries } from "@/lib/sentinel/audio/vad";
import { classifySounds } from "@/lib/sentinel/audio/soundEvents";
import { cosine, embedVoice, matchSpeaker, mergeCentroid, MATCH_THRESHOLD } from "@/lib/sentinel/audio/voiceprint";
import { bindable, extractNames, selfClaim } from "@/lib/sentinel/audio/nameExtraction";
import { encodeWav, resample, tooThinToSend, TARGET_RATE } from "@/lib/sentinel/audio/wav";

const RATE = 16000;

/**
 * A synthetic vowel: a glottal pitch driving three formants. Real speech puts
 * most of its energy in the 300-3000hz formant bands, and a bare sine tone does
 * not — testing the detector against a beep would have proved nothing.
 */
function voice(seconds: number, f0: number, formants: [number, number, number] = [520, 1480, 2560]): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const glottal = 0.5 + 0.5 * Math.sin(2 * Math.PI * f0 * t);
    out[i] =
      (0.22 * Math.sin(2 * Math.PI * f0 * t) +
        0.5 * glottal * Math.sin(2 * Math.PI * formants[0] * t) +
        0.34 * glottal * Math.sin(2 * Math.PI * formants[1] * t) +
        0.16 * glottal * Math.sin(2 * Math.PI * formants[2] * t)) *
      0.3 *
      (0.85 + 0.15 * Math.sin(2 * Math.PI * 4 * t)); // cadence
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
    const buffer = join(silence(0.6), voice(1.1, 128), silence(0.9), voice(1.0, 215, [700, 1900, 2900]), silence(0.6));
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
  const printFor = (f0: number, formants?: [number, number, number]) =>
    embedVoice(featureSeries(voice(1.4, f0, formants), RATE), frameMs)!;

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
    const low = printFor(105, [380, 1050, 2200]);
    const high = printFor(240, [760, 2100, 3100]);
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

describe("sentinel pickup sensitivity presets", () => {
  it("far opens on quieter speech than near, and near rejects what far accepts", async () => {
    const { Vad, VAD_SENSITIVITY } = await import("@/lib/sentinel/audio/vad");
    const { frameFeatures, FRAME, TARGET_RATE } = await import("@/lib/sentinel/audio/dsp");
    // Quiet formant-rich voice: loud enough for "far", below the "near" floor.
    const mk = (amp: number) => {
      const frames = [];
      for (let i = 0; i < 30; i++) {
        const s = new Float32Array(FRAME);
        for (let j = 0; j < FRAME; j++) {
          const t = (i * FRAME + j) / TARGET_RATE;
          s[j] = amp * (Math.sin(2 * Math.PI * 140 * t) + 0.6 * Math.sin(2 * Math.PI * 700 * t) + 0.3 * Math.sin(2 * Math.PI * 2400 * t)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5 * t));
        }
        frames.push(frameFeatures(s, TARGET_RATE));
      }
      return frames;
    };
    const quiet = mk(0.006); // rms ≈ 0.004 — above far floor (0.0012), below near floor (0.005)
    // Room tone first: the floor seeds from opening frames, so feed silence
    // before the voice, exactly as a real capture begins.
    const silence = Array.from({ length: 20 }, () => frameFeatures(new Float32Array(FRAME).map(() => (Math.random() - 0.5) * 0.001), TARGET_RATE));
    const farVad = new Vad(VAD_SENSITIVITY.far);
    const nearVad = new Vad(VAD_SENSITIVITY.near);
    for (const f of silence) { farVad.push(f); nearVad.push(f); }
    let farOpened = false, nearOpened = false;
    for (const f of quiet) {
      if (farVad.push(f).verdict !== "silence") farOpened = true;
      if (nearVad.push(f).verdict !== "silence") nearOpened = true;
    }
    expect(farOpened).toBe(true);
    expect(nearOpened).toBe(false);
    // Ordering invariant: the nearer the preset, the higher the floor.
    expect(VAD_SENSITIVITY.near.absoluteFloor).toBeGreaterThan(VAD_SENSITIVITY.balanced.absoluteFloor);
    expect(VAD_SENSITIVITY.balanced.absoluteFloor).toBeGreaterThan(VAD_SENSITIVITY.far.absoluteFloor);
  });
});
