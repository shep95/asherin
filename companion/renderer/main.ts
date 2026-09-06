// Asherin Sentinel companion — renderer.
//
// This is the same signal chain the browser room uses (identical dsp, vad,
// sound tagging, voiceprint and wav modules imported from the app source, so
// there is one implementation and not a drifting copy), with two differences
// forced by the environment:
//
//   1. auth is a device token, minted once from a pairing code, kept in the OS
//      user-data directory with 0600 permissions — there is no browser session
//      out here to borrow.
//   2. the pending queue is on disk through the main process rather than in
//      IndexedDB, so an unsent segment survives a crash or a reboot.
//
// Nothing here claims capture during sleep or power-off. On suspend the device
// is marked sleeping and the microphone is released by the OS; on resume the
// watch restarts and the gap stays visible in the timeline.

import { FRAME, frameFeatures, type FrameFeatures } from "../../src/lib/sentinel/audio/dsp";
import { Vad, VAD_SENSITIVITY, type VadSegment, type VadSensitivity } from "../../src/lib/sentinel/audio/vad";
import { classifySounds } from "../../src/lib/sentinel/audio/soundEvents";
import { embedVoice } from "../../src/lib/sentinel/audio/voiceprint";
import { concat, encodeWav, resample, toBase64, tooThinToSend, TARGET_RATE } from "../../src/lib/sentinel/audio/wav";

declare global {
  interface Window {
    companion: {
      getStore(): Promise<Record<string, unknown>>;
      setStore(patch: Record<string, unknown>): Promise<Record<string, unknown>>;
      clearToken(): Promise<unknown>;
      writePending(id: string, payload: unknown): Promise<boolean>;
      listPending(limit: number): Promise<Array<{ id: string; payload: unknown }>>;
      countPending(): Promise<number>;
      donePending(id: string): Promise<boolean>;
      reportState(state: Record<string, unknown>): void;
      onToggle(fn: () => void): void;
      onPower(fn: (kind: "suspend" | "resume") => void): void;
    };
  }
}

const ENDPOINT = "https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/asherin-sentinel";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3hnenFidHJycmJ0amNlbWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzIyNTQsImV4cCI6MjA4NjY0ODI1NH0.PXItSIWoCByiMjDObhyc8QryuH2wNwMAIFyzWXzYJac";
const PREROLL_FRAMES = 8;
const SOUND_WINDOW_FRAMES = 120;
const REQUEST_TIMEOUT_MS = 60_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let token: string | null = null;
let listening = false;
let sensitivity: VadSensitivity = "balanced";

async function call<T>(action: string, body: Record<string, unknown> = {}, auth?: string): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        ...(auth ? { "x-asherin-device": auth } : {}),
      },
      body: JSON.stringify({ action, ...body }),
      signal: ctl.signal,
    });
    const payload = await res.json().catch(() => null) as ({ error?: string; message?: string } & T) | null;
    if (!res.ok || (payload && "error" in payload && payload.error)) {
      throw new Error(payload?.message || `sentinel ${action} failed (${res.status})`);
    }
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── pairing ──────────────────────────────────────────────────────────────────
async function pair(code: string) {
  const label = `${navigator.platform || "desktop"} companion`;
  const out = await call<{ token: string; deviceKey: string }>("pair-claim", {
    code,
    label,
    platform: "desktop-companion",
  });
  token = out.token;
  await window.companion.setStore({ token: out.token, deviceKey: out.deviceKey, label });
  render();
}

// ── capture ──────────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let node: ScriptProcessorNode | null = null;
let src: MediaStreamAudioSourceNode | null = null;
let vad = new Vad(VAD_SENSITIVITY.balanced);
let preroll: Float32Array[] = [];
let segment: Float32Array[] = [];
let segFeatures: FrameFeatures[] = [];
let soundWindow: FrameFeatures[] = [];
let soundFrames = 0;
let segmentStart = 0;
let drainTimer: number | null = null;
let beatTimer: number | null = null;
let syncing = false;

function status(state: string, message: string | null = null) {
  $("state").textContent = state;
  $("msg").textContent = message ?? "";
  $("msg").className = message ? "note err" : "note";
  ($("toggle") as HTMLButtonElement).textContent = state === "listening" ? "pause listening" : "start listening";
  void window.companion.countPending().then((n) => {
    $("pending").textContent = n === 0 ? "everything synced" : `${n} waiting`;
    window.companion.reportState({ state, pending: n, message });
  });
}

async function start() {
  if (listening || !token) return;
  status("starting");
  try {
    await call("register", { label: `${navigator.platform || "desktop"} companion`, platform: "desktop-companion" }, token);
  } catch (e) {
    status("error", e instanceof Error ? e.message : "could not register this machine");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch {
    status("denied", "the microphone was refused by the operating system. grant it to Asherin Sentinel and press start again.");
    return;
  }
  ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  src = ctx.createMediaStreamSource(stream);
  node = ctx.createScriptProcessor(2048, 1, 1);
  node.onaudioprocess = (ev) => onAudio(ev.inputBuffer.getChannelData(0));
  src.connect(node);
  const mute = ctx.createGain();
  mute.gain.value = 0; // never play the room back into itself
  node.connect(mute);
  mute.connect(ctx.destination);

  listening = true;
  vad = new Vad(VAD_SENSITIVITY[sensitivity]);
  status("listening");
  drainTimer = window.setInterval(() => void drain(), 6000);
  beatTimer = window.setInterval(() => void call("heartbeat", { status: "active" }, token!).catch(() => {}), 60_000);
  void call("heartbeat", { status: "active" }, token).catch(() => {});
}

async function stop(reason: "sleeping" | "offline" = "offline") {
  if (!listening) return;
  listening = false;
  if (drainTimer) window.clearInterval(drainTimer);
  if (beatTimer) window.clearInterval(beatTimer);
  drainTimer = beatTimer = null;
  const tail = vad.flush();
  if (tail) await closeSegment(tail);
  try {
    node?.disconnect();
    src?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    await ctx?.close();
  } catch { /* teardown is best effort */ }
  node = null; src = null; stream = null; ctx = null;
  preroll = []; segment = []; segFeatures = []; soundWindow = [];
  if (token) void call("heartbeat", { status: reason }, token).catch(() => {});
  status("stopped");
  void drain();
}

function onAudio(input: Float32Array) {
  if (!ctx) return;
  const rate = ctx.sampleRate;
  const block = new Float32Array(input);
  for (let off = 0; off + FRAME <= block.length; off += FRAME) {
    const frame = block.subarray(off, off + FRAME);
    const f = frameFeatures(frame, rate);
    soundWindow.push(f);
    soundFrames++;
    if (soundWindow.length > SOUND_WINDOW_FRAMES) soundWindow.shift();

    const { verdict, segment: closed } = vad.push(f);
    const owned = new Float32Array(frame);
    if (verdict === "silence") {
      preroll.push(owned);
      if (preroll.length > PREROLL_FRAMES) preroll.shift();
    } else if (segment.length === 0) {
      segment = [...preroll, owned];
      segFeatures = [f];
      segmentStart = Date.now() - ((preroll.length + 1) * FRAME * 1000) / rate;
      preroll = [];
    } else {
      segment.push(owned);
      segFeatures.push(f);
    }
    if (closed) void closeSegment(closed);
    ($("level").style.width = `${Math.min(100, Math.round(f.rms * 900))}%`);
  }
  if (soundFrames >= SOUND_WINDOW_FRAMES) {
    soundFrames = 0;
    for (const ev of classifySounds(soundWindow)) {
      const back = soundWindow.length - ev.atFrame;
      void queue({
        kind: "sound",
        startedAt: new Date(Date.now() - (back * FRAME * 1000) / rate).toISOString(),
        durationMs: Math.round((ev.durationFrames * FRAME * 1000) / rate),
        tag: ev.tag,
        confidence: ev.confidence,
        evidence: ev.evidence,
      });
    }
  }
}

async function closeSegment(seg: VadSegment) {
  const pcmFrames = segment;
  const features = segFeatures;
  const rate = ctx?.sampleRate ?? 48000;
  segment = [];
  segFeatures = [];
  if (!pcmFrames.length) return;
  const pcm = resample(concat(pcmFrames), rate, TARGET_RATE);
  const wav = encodeWav(pcm, TARGET_RATE);
  if (tooThinToSend(wav)) return;
  const embedding = seg.voiced ? embedVoice(features, (FRAME * 1000) / rate) : null;
  await queue({
    kind: "speech",
    startedAt: new Date(segmentStart).toISOString(),
    durationMs: Math.round((pcm.length / TARGET_RATE) * 1000),
    audio: toBase64(wav),
    embedding: embedding ?? undefined,
    peakRms: seg.peakRms,
  });
}

async function queue(payload: unknown) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await window.companion.writePending(id, payload);
  void drain();
}

async function drain() {
  if (syncing || !token) return;
  syncing = true;
  try {
    const rows = await window.companion.listPending(3);
    if (!rows.length) { status(listening ? "listening" : "stopped"); return; }
    try {
      await call("ingest", { segments: rows.map((r) => r.payload) }, token);
      for (const r of rows) await window.companion.donePending(r.id);
      status(listening ? "listening" : "stopped");
    } catch (e) {
      // Left on disk on purpose: a dropped segment is worse than a late one.
      status(listening ? "listening" : "stopped", e instanceof Error ? e.message : "sync failed; segments are still on this machine.");
    }
  } finally {
    syncing = false;
  }
}

// ── wiring ───────────────────────────────────────────────────────────────────
function render() {
  const paired = Boolean(token);
  $("pair").classList.toggle("hidden", paired);
  $("watch").classList.toggle("hidden", !paired);
}

async function boot() {
  const store = await window.companion.getStore();
  token = (store.token as string) || null;
  sensitivity = (store.sensitivity as VadSensitivity) || "balanced";
  ($("sens") as HTMLSelectElement).value = sensitivity;
  render();
  status("idle");
  if (token) void start(); // paired machines resume the watch on launch

  $("pairBtn").addEventListener("click", async () => {
    const btn = $("pairBtn") as HTMLButtonElement;
    const code = ($("code") as HTMLInputElement).value.trim().toUpperCase();
    btn.disabled = true;
    try {
      await pair(code);
      $("pairNote").textContent = "paired. the watch is starting.";
      void start();
    } catch (e) {
      $("pairNote").className = "note err";
      $("pairNote").textContent = e instanceof Error ? e.message : "pairing failed.";
    } finally {
      btn.disabled = false;
    }
  });

  $("toggle").addEventListener("click", () => (listening ? void stop() : void start()));
  $("unpair").addEventListener("click", async () => {
    await stop();
    await window.companion.clearToken();
    token = null;
    render();
  });
  ($("sens") as HTMLSelectElement).addEventListener("change", (e) => {
    sensitivity = (e.target as HTMLSelectElement).value as VadSensitivity;
    void window.companion.setStore({ sensitivity });
    if (listening) vad = new Vad(VAD_SENSITIVITY[sensitivity]);
  });

  window.companion.onToggle(() => (listening ? void stop() : void start()));
  window.companion.onPower((kind) => {
    if (kind === "suspend") void stop("sleeping");
    else if (token) void start();
  });
}

void boot();
