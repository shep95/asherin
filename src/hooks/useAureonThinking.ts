import { useSyncExternalStore } from "react";

/**
 * useAureonThinking — view-state layer for the Ghost Chain two-phase stream.
 *
 * The transport (`streamChat`) pushes reasoning tokens here; components merely
 * subscribe. No fetch logic, no JSX-side business logic — per the coding rules
 * the display layer never owns the stream.
 */

export type ThinkingPhase = "idle" | "thinking" | "answering" | "done" | "error";

export interface ThinkingState {
  text: string;
  phase: ThinkingPhase;
  /** ms spent inside the reasoning pass, filled when it closes */
  durationMs?: number;
  error?: string;
}

const EMPTY: ThinkingState = { text: "", phase: "idle" };

const states = new Map<string, ThinkingState>();
const listeners = new Set<() => void>();
const startedAt = new Map<string, number>();

const emit = () => { listeners.forEach((l) => l()); };

const set = (id: string, patch: Partial<ThinkingState>) => {
  const prev = states.get(id) ?? EMPTY;
  states.set(id, { ...prev, ...patch });
  emit();
};

export const thinkingStore = {
  begin(id: string) {
    startedAt.set(id, Date.now());
    states.set(id, { text: "", phase: "thinking" });
    emit();
  },
  append(id: string, chunk: string) {
    if (!chunk) return;
    const prev = states.get(id) ?? EMPTY;
    // Bounded buffer: reasoning is scratch work, never a memory sink.
    const next = (prev.text + chunk).slice(-20000);
    states.set(id, { ...prev, text: next, phase: "thinking" });
    emit();
  },
  /** Reasoning closed; the answer pass is now filling. */
  answering(id: string) {
    const started = startedAt.get(id);
    set(id, { phase: "answering", durationMs: started ? Date.now() - started : undefined });
  },
  finish(id: string) {
    const prev = states.get(id);
    if (!prev) return;
    const started = startedAt.get(id);
    states.set(id, {
      ...prev,
      phase: "done",
      durationMs: prev.durationMs ?? (started ? Date.now() - started : undefined),
    });
    startedAt.delete(id);
    emit();
  },
  fail(id: string, error: string) {
    set(id, { phase: "error", error });
    startedAt.delete(id);
  },
  clear(id: string) {
    if (!states.delete(id)) return;
    startedAt.delete(id);
    emit();
  },
  snapshot(id: string): ThinkingState {
    return states.get(id) ?? EMPTY;
  },
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export function useAureonThinking(messageId: string | undefined): ThinkingState {
  return useSyncExternalStore(
    subscribe,
    () => (messageId ? states.get(messageId) ?? EMPTY : EMPTY),
    () => EMPTY,
  );
}
