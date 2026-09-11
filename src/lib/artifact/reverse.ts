// reverse reconstruction — for an artifact that already exists.
//
// intent -> narrative -> state -> workflow -> flows -> invariants ->
// expected model -> observed model -> difference -> hypotheses ->
// discriminating tests -> root cause.
//
// Nothing here guesses at an observation. The observed model is built only
// from observations that were actually captured.

import type { ArtifactContract, ArtifactFile, ObservationSet } from "./types";

export interface ReverseReport {
  intent: string;
  narrative: string;
  state: string[];
  workflow: string[];
  dataFlow: string[];
  controlFlow: string[];
  temporalFlow: string[];
  invariants: string[];
  expected: string[];
  observed: string[];
  differences: string[];
  hypotheses: string[];
  discriminatingTests: Array<{ hypothesis: string; test: string; runnable: boolean; why?: string }>;
  rootCause: string | null;
}

export interface ReverseInput {
  intent: string;
  files: ArtifactFile[];
  contract?: ArtifactContract | null;
  observations?: ObservationSet | null;
}

export function reverseReconstruct(input: ReverseInput): ReverseReport {
  const body = input.files.map((f) => f.content).join("\n");
  const state = unique(matchAll(body, /\b(?:useState|let|const)\s+\[?([A-Za-z_$][\w$]*)/g)).slice(0, 20);
  const workflow = unique(matchAll(body, /\bfunction\s+([A-Za-z_$][\w$]*)|\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g)).slice(0, 20);
  const handlers = unique(matchAll(body, /\bon([A-Z][A-Za-z]+)\s*=/g)).slice(0, 15);
  const timers = unique(matchAll(body, /\b(setInterval|setTimeout|requestAnimationFrame)\b/g));

  const expected = [
    ...(input.contract?.expectedBehavior ?? []),
    ...(input.contract?.acceptance ?? []),
  ];
  const observed = input.observations
    ? input.observations.observations.map((o) => `${o.channel}/${o.level}: ${o.message}`)
    : [];

  const differences = expected.length && observed.length
    ? expected.filter((e) => !observed.some((o) => o.toLowerCase().includes(firstKeyword(e))))
        .map((e) => `expected "${e}" — nothing observed confirming it`)
    : observed.filter((o) => o.includes("error:")).map((o) => `unexpected: ${o}`);

  const hyps = differences.slice(0, 5).map((d) => hypothesisFor(d, state, handlers, timers.length > 0));

  const tests = hyps.map((h) => ({
    hypothesis: h,
    test: `re-run the artifact and watch for ${firstKeyword(h)} on the runtime and console channels`,
    runnable: Boolean(input.observations && input.observations.observations.length > 0),
    why: input.observations && input.observations.observations.length > 0 ? undefined : "no observation channel captured anything for this artifact",
  }));

  const rootCause = differences.length === 1 && hyps.length === 1 ? hyps[0] : null;

  return {
    intent: input.intent,
    narrative: narrate(input.intent, workflow, state, handlers),
    state,
    workflow,
    dataFlow: state.map((s) => `${s} flows into render output`),
    controlFlow: handlers.map((h) => `on${h} drives a state transition`),
    temporalFlow: timers.length ? timers.map((t) => `${t} drives time-based updates`) : ["no time-driven behaviour found"],
    invariants: input.contract?.invariants ?? [],
    expected,
    observed,
    differences,
    hypotheses: hyps,
    discriminatingTests: tests,
    rootCause,
  };
}

function narrate(intent: string, workflow: string[], state: string[], handlers: string[]): string {
  return [
    `the artifact exists to ${intent.replace(/\.$/, "")}.`,
    workflow.length ? `it is organised around ${workflow.slice(0, 5).join(", ")}.` : "it declares no named procedures.",
    state.length ? `it holds ${state.length} piece(s) of state.` : "it holds no explicit state.",
    handlers.length ? `it reacts to ${handlers.slice(0, 5).map((h) => `on${h}`).join(", ")}.` : "it reacts to no events.",
  ].join(" ");
}

function hypothesisFor(difference: string, state: string[], handlers: string[], hasTimer: boolean): string {
  if (/error/i.test(difference)) return `${difference} — a value is read before it is initialised`;
  if (hasTimer) return `${difference} — the timed update never fires or is cleared too early`;
  if (handlers.length) return `${difference} — the handler runs but the state it writes is not the state that renders`;
  if (state.length) return `${difference} — the state exists but nothing renders it`;
  return `${difference} — the behaviour was never implemented`;
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(re)) out.push(m[1] ?? m[2] ?? m[0]);
  return out.filter(Boolean);
}

function firstKeyword(text: string): string {
  return (text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? ["change"])[0];
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list));
}
