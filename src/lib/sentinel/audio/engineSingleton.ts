// asherin.sentinel — one watch per browser, not one per mounted view.
//
// NARRATIVE CHECK. The room used to own the engine and tear it down on unmount,
// so the watch died the moment the operator opened another room — while the
// copy promised the capture survived a backgrounded tab. Both cannot be true.
// The engine therefore lives at module scope: it outlives every mount, every
// route change, and every tab switch inside this browser, and it stops only
// when the operator presses stop or the browser itself is closed.
//
// Restraints that keep that honest:
//   • one instance, created lazily, never recreated while listening.
//   • fan-out listeners with explicit unsubscribe, so an unmounted view stops
//     receiving without stopping the capture.
//   • the last status and the notes are retained here, so a view that mounts
//     later shows what already happened instead of an empty "idle".
//   • the browser is warned before an unload that closes a live watch, because
//     the one thing this layer genuinely cannot survive is the tab going away.

import { SentinelEngine, type EngineStatus } from "./captureEngine";
import type { IngestResult } from "./sync";
import type { VadSensitivity } from "./vad";

type StatusFn = (s: EngineStatus) => void;
type IngestFn = (r: IngestResult) => void;
type NoteFn = (n: string) => void;

const statusFns = new Set<StatusFn>();
const ingestFns = new Set<IngestFn>();
const noteFns = new Set<NoteFn>();

let engine: SentinelEngine | null = null;
let lastStatus: EngineStatus | null = null;
const noteLog: string[] = [];
let unloadGuardAttached = false;

function attachUnloadGuard(): void {
  if (unloadGuardAttached || typeof window === "undefined") return;
  unloadGuardAttached = true;
  window.addEventListener("beforeunload", (e) => {
    if (lastStatus?.state !== "listening") return;
    // A live capture ends with the tab. The operator gets told, once, rather
    // than discovering the gap in the timeline later.
    e.preventDefault();
    e.returnValue = "";
  });
}

export function sentinelEngine(): SentinelEngine {
  if (!engine) {
    engine = new SentinelEngine({
      onStatus: (s) => {
        lastStatus = s;
        statusFns.forEach((fn) => fn(s));
      },
      onIngest: (r) => ingestFns.forEach((fn) => fn(r)),
      onNote: (n) => {
        if (!noteLog.includes(n)) noteLog.unshift(n);
        noteLog.splice(8);
        noteFns.forEach((fn) => fn(n));
      },
    });
    attachUnloadGuard();
  }
  return engine;
}

export const sentinelStatus = (): EngineStatus | null => (lastStatus ? { ...lastStatus } : null);
export const sentinelNotes = (): string[] => [...noteLog];
export const sentinelListening = (): boolean => lastStatus?.state === "listening";

export function subscribeSentinel(handlers: { onStatus?: StatusFn; onIngest?: IngestFn; onNote?: NoteFn }): () => void {
  if (handlers.onStatus) statusFns.add(handlers.onStatus);
  if (handlers.onIngest) ingestFns.add(handlers.onIngest);
  if (handlers.onNote) noteFns.add(handlers.onNote);
  return () => {
    if (handlers.onStatus) statusFns.delete(handlers.onStatus);
    if (handlers.onIngest) ingestFns.delete(handlers.onIngest);
    if (handlers.onNote) noteFns.delete(handlers.onNote);
  };
}

export const setSentinelSensitivity = (s: VadSensitivity) => engine?.setSensitivity(s);
