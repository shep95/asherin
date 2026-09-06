// asherin.sentinel — the daemon, and the honest edge of it.
//
// NARRATIVE CHECK, written before the code, because this is the layer where a
// product like this normally lies to its user:
//
// The claim "runs when the screen is off, whether you are present or not" is
// true of a signed OS service. It is NOT true of a web page, and no amount of
// javascript changes that: when a tab is discarded the microphone is released
// by the operating system, and no page can reacquire it unprompted. What IS
// true in a browser, and what this engine actually delivers:
//
//   • capture survives the tab being backgrounded and the window being covered
//     — an active getUserMedia stream is exempt from timer throttling.
//   • capture survives the screen locking on desktop while the browser lives.
//   • a screen wake lock keeps a phone's display from cutting the session short
//     when the operator asked for a long watch.
//   • capture does NOT survive the tab closing, the browser quitting, or the
//     phone sleeping the browser process. The room says so on its face, and the
//     device row goes to `offline` instead of pretending to still listen.
//
// So the engine is built to be resumable and lossless rather than immortal:
// every closed segment is encrypted to disk before any upload, uploads retry,
// and the timeline is authoritative in the account, not in this tab.

import { FRAME, frameFeatures, type FrameFeatures } from "./dsp";
import { Vad, VAD_DEFAULTS, VAD_SENSITIVITY, type VadSegment, type VadSensitivity } from "./vad";
import { classifySounds, type SoundEvent } from "./soundEvents";
import { embedVoice } from "./voiceprint";
import { concat, encodeWav, resample, toBase64, tooThinToSend, TARGET_RATE } from "./wav";
import { markAttempt, markSynced, pendingSegments, purge, readPayload, writeSegment, type SegmentPayload } from "./localBuffer";
import { heartbeat, ingest, registerDevice, type IngestResult } from "./sync";

const DEVICE_KEY_STORAGE = "asherin.sentinel.ambient.deviceKey";
/** pre-roll kept so a segment never starts mid-word */
const PREROLL_FRAMES = 8;
/** how often the sound pipeline judges its rolling window */
const SOUND_WINDOW_FRAMES = 120;

export type EngineState = "idle" | "starting" | "listening" | "denied" | "error" | "stopped";

export interface EngineStatus {
  state: EngineState;
  message: string | null;
  /** live meter values so the UI shows measurement, not decoration */
  level: number;
  noiseFloor: number;
  speaking: boolean;
  segmentsCaptured: number;
  pendingUploads: number;
  lastSyncAt: number | null;
  deviceKey: string;
  sampleRate: number;
}

export interface EngineEvents {
  onStatus?: (s: EngineStatus) => void;
  onIngest?: (r: IngestResult) => void;
  onNote?: (note: string) => void;
}

function deviceKey(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (existing && existing.length >= 16) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_STORAGE, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "android"
    : /iPhone|iPad/i.test(ua)
      ? "ios"
      : /Mac OS X/i.test(ua)
        ? "mac"
        : /Windows/i.test(ua)
          ? "windows"
          : /Linux/i.test(ua)
            ? "linux"
            : "device";
  const browser = /Edg\//.test(ua) ? "edge" : /Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : /Firefox\//.test(ua) ? "firefox" : "browser";
  return `${os} · ${browser}`;
}

export function devicePlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad/i.test(ua)) return "ios";
  return "web";
}

export class SentinelEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private vad = new Vad(VAD_DEFAULTS);
  private sensitivity: VadSensitivity = "balanced";

  private preroll: Float32Array[] = [];
  private segment: Float32Array[] = [];
  private segmentFeatures: FrameFeatures[] = [];
  private soundWindow: FrameFeatures[] = [];
  private soundPcmFrames = 0;
  private segmentStart = 0;
  private frameIndex = 0;
  private syncing = false;
  private timer: number | null = null;
  private heartbeatTimer: number | null = null;
  private registered = false;

  private status: EngineStatus = {
    state: "idle",
    message: null,
    level: 0,
    noiseFloor: 0,
    speaking: false,
    segmentsCaptured: 0,
    pendingUploads: 0,
    lastSyncAt: null,
    deviceKey: deviceKey(),
    sampleRate: 0,
  };

  constructor(private readonly events: EngineEvents = {}) {}

  getStatus(): EngineStatus {
    return { ...this.status };
  }

  /** Live-switch the pickup sensitivity. Safe mid-listen: the open segment
   * closes at the next natural pause and the fresh floor adapts within a
   * second of room tone. */
  setSensitivity(s: VadSensitivity): void {
    if (s === this.sensitivity) return;
    this.sensitivity = s;
    this.vad = new Vad(VAD_SENSITIVITY[s]);
    this.note(`pickup sensitivity is now ${s}.`);
  }

  private emit(patch: Partial<EngineStatus>) {
    this.status = { ...this.status, ...patch };
    this.events.onStatus?.(this.getStatus());
  }

  private note(n: string) {
    this.events.onNote?.(n);
  }

  async start(): Promise<boolean> {
    if (this.status.state === "listening" || this.status.state === "starting") return true;
    this.emit({ state: "starting", message: "asking for the microphone" });

    try {
      await registerDevice(this.status.deviceKey, deviceLabel(), devicePlatform());
      this.registered = true;
    } catch (e) {
      // A registration failure must not silently downgrade to a local-only
      // watch that the operator believes is syncing.
      this.emit({ state: "error", message: e instanceof Error ? e.message : "could not register this device" });
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      this.emit({
        state: denied ? "denied" : "error",
        message: denied
          ? "the microphone was refused. sentinel cannot listen without it, and it will not ask again until you press start."
          : "no microphone is available on this device.",
      });
      return false;
    }

    const Ctx: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but universally present, and the whole job
    // here is 512-sample feature extraction on the main thread's idle time —
    // an AudioWorklet would need a second copy of the dsp code shipped as a
    // module url for no measurable gain at this frame budget.
    this.node = this.ctx.createScriptProcessor(2048, 1, 1);
    this.node.onaudioprocess = (ev) => this.onAudio(ev.inputBuffer.getChannelData(0));
    this.source.connect(this.node);
    // A ScriptProcessor only pulls when connected to a sink. Route through a
    // muted gain so nothing is ever played back into the room (feedback).
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute);
    mute.connect(this.ctx.destination);

    this.emit({ state: "listening", message: null, sampleRate: this.ctx.sampleRate });
    void this.requestWakeLock();
    void purge();

    this.timer = window.setInterval(() => void this.drain(), 6000);
    this.heartbeatTimer = window.setInterval(() => {
      void heartbeat(this.status.deviceKey, "active").catch(() => {});
    }, 60_000);
    void heartbeat(this.status.deviceKey, "active").catch(() => {});
    return true;
  }

  async stop(): Promise<void> {
    if (this.timer) window.clearInterval(this.timer);
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.timer = null;
    this.heartbeatTimer = null;

    // Never drop the open tail: close it, buffer it, then release the radio.
    const tail = this.vad.flush();
    if (tail) await this.closeSegment(tail);

    try {
      this.node?.disconnect();
      this.source?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      await this.ctx?.close();
    } catch {
      /* teardown is best-effort; the tracks stop either way */
    }
    this.node = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
    await this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    this.vad = new Vad(VAD_DEFAULTS);
    this.preroll = [];
    this.segment = [];
    this.segmentFeatures = [];
    this.soundWindow = [];
    if (this.registered) void heartbeat(this.status.deviceKey, "offline").catch(() => {});
    this.emit({ state: "stopped", speaking: false, level: 0, message: null });
    void this.drain();
  }

  private async requestWakeLock() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (!nav.wakeLock) return;
      this.wakeLock = await nav.wakeLock.request("screen");
    } catch {
      this.note("this browser would not hold a screen wake lock — a locked phone may suspend the watch.");
    }
  }

  private onAudio(input: Float32Array) {
    if (!this.ctx) return;
    const rate = this.ctx.sampleRate;
    // Copy: the buffer is recycled by the audio thread on the next callback.
    const block = new Float32Array(input);

    for (let off = 0; off + FRAME <= block.length; off += FRAME) {
      const frame = block.subarray(off, off + FRAME);
      const f = frameFeatures(frame, rate);
      this.frameIndex++;

      this.soundWindow.push(f);
      this.soundPcmFrames++;
      if (this.soundWindow.length > SOUND_WINDOW_FRAMES) this.soundWindow.shift();

      const { verdict, segment } = this.vad.push(f);
      const owned = new Float32Array(frame);

      if (verdict === "silence") {
        this.preroll.push(owned);
        if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift();
      } else {
        if (this.segment.length === 0) {
          this.segment = [...this.preroll, owned];
          this.segmentFeatures = [f];
          this.segmentStart = Date.now() - ((this.preroll.length + 1) * FRAME * 1000) / rate;
          this.preroll = [];
        } else {
          this.segment.push(owned);
          this.segmentFeatures.push(f);
        }
      }

      if (segment) void this.closeSegment(segment);

      this.emit({
        level: f.rms,
        noiseFloor: this.vad.noiseFloor,
        speaking: verdict === "speech" || verdict === "opening",
      });
    }

    // Judge background sound on a rolling window, separately from voice.
    if (this.soundPcmFrames >= SOUND_WINDOW_FRAMES) {
      this.soundPcmFrames = 0;
      const events = classifySounds(this.soundWindow);
      for (const ev of events) void this.writeSound(ev, rate);
    }
  }

  private async writeSound(ev: SoundEvent, rate: number) {
    const framesBack = this.soundWindow.length - ev.atFrame;
    const startedAt = new Date(Date.now() - (framesBack * FRAME * 1000) / rate).toISOString();
    const payload: SegmentPayload = {
      kind: "sound",
      startedAt,
      durationMs: Math.round((ev.durationFrames * FRAME * 1000) / rate),
      tag: ev.tag,
      confidence: ev.confidence,
      evidence: ev.evidence,
    };
    try {
      await writeSegment(payload);
      this.emit({ segmentsCaptured: this.status.segmentsCaptured + 1 });
      void this.drain();
    } catch {
      this.note("this browser refused local storage — sound events cannot be buffered here.");
    }
  }

  private async closeSegment(seg: VadSegment) {
    const pcmFrames = this.segment;
    const features = this.segmentFeatures;
    const rate = this.ctx?.sampleRate ?? 48000;
    this.segment = [];
    this.segmentFeatures = [];
    if (!pcmFrames.length) return;

    const raw = concat(pcmFrames);
    const pcm = resample(raw, rate, TARGET_RATE);
    const wav = encodeWav(pcm, TARGET_RATE);
    if (tooThinToSend(wav)) return; // a header with nothing in it proves nothing

    const frameMs = (FRAME * 1000) / rate;
    const embedding = seg.voiced ? embedVoice(features, frameMs) : null;
    const payload: SegmentPayload = {
      kind: "speech",
      startedAt: new Date(this.segmentStart).toISOString(),
      durationMs: Math.round((pcm.length / TARGET_RATE) * 1000),
      audio: toBase64(wav),
      embedding: embedding ?? undefined,
      peakRms: seg.peakRms,
    };
    try {
      await writeSegment(payload);
      this.emit({ segmentsCaptured: this.status.segmentsCaptured + 1 });
      void this.drain();
    } catch {
      this.note("this browser refused local storage — the segment could not be buffered.");
    }
  }

  /** Ship buffered rows. Serialised: one flight at a time, retried on failure. */
  async drain(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const rows = await pendingSegments(3);
      this.emit({ pendingUploads: rows.length });
      if (!rows.length) return;
      const payloads: unknown[] = [];
      const ids: string[] = [];
      for (const row of rows) {
        const payload = await readPayload(row);
        if (!payload) {
          await markSynced(row.id); // unreadable: drop, never invent
          continue;
        }
        payloads.push(payload);
        ids.push(row.id);
      }
      if (!payloads.length) return;
      try {
        const result = await ingest(this.status.deviceKey, payloads);
        for (const id of ids) await markSynced(id);
        this.emit({ lastSyncAt: Date.now(), pendingUploads: Math.max(0, rows.length - ids.length) });
        this.events.onIngest?.(result);
        for (const n of result.notes ?? []) this.note(n);
      } catch (e) {
        for (const id of ids) await markAttempt(id);
        this.note(e instanceof Error ? e.message : "sync failed; the segments are still on this device.");
      }
      await purge();
    } finally {
      this.syncing = false;
    }
  }
}
