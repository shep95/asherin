// ZAHTEN RUNTIME — durable step execution for Agent Forge (shared module).
//
// The shape borrowed from durable-job engines (Trigger.dev checkpoints,
// Temporal retry policy, Inngest human-in-the-loop pause) without the second
// vendor: a run is a list of steps, each step is attempted under a retry
// policy, and the outcome of every finished step is written back to
// agent_executions.results.checkpoint before the next one starts. A run that
// dies mid-flight resumes from the last committed step instead of replaying
// side effects.
//
// Two hard rules the rest of the file exists to enforce:
//   1. An agent is a procedure pack plus real tools. There is no
//      "you are the X agent" costume — a persona sentence changes the tone of
//      the output and nothing about what actually ran.
//   2. A step that did not run is never recorded as success. Zapier's silent
//      fail is the failure mode we are pricing against: unbound runners report
//      `skipped`, broken ones report `failed`, and the run inherits the worst
//      status of its steps.

import { emitPull } from "./connectPull.ts";

export type StepStatus = "success" | "failed" | "skipped";
export type RunStatus = "started" | "running" | "awaiting_approval" | "success" | "partial" | "failed";

export interface StepRecord {
  type: string;
  order: number;
  status: StepStatus;
  output: string;
  attempts: number;
  durationMs: number;
  error?: string;
  /** Which organ actually served this step, when a real tool ran. */
  organ?: string;
}

export interface RetryPolicy {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export function resolveRetryPolicy(settings: unknown): RetryPolicy {
  const s = (settings ?? {}) as Record<string, unknown>;
  const enabled = s.retryOnFailure !== false;
  const raw = Number(s.maxRetries ?? 3);
  // maxRetries is retries, not attempts. One attempt always happens.
  const retries = Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.floor(raw))) : 3;
  return {
    enabled,
    maxAttempts: enabled ? retries + 1 : 1,
    baseDelayMs: 800,
    maxDelayMs: 15_000,
  };
}

/** Full jitter exponential backoff — retries of a stampeded API do not re-stampede. */
export function backoffDelay(attempt: number, p: RetryPolicy): number {
  const ceiling = Math.min(p.maxDelayMs, p.baseDelayMs * Math.pow(2, attempt - 1));
  return Math.floor(Math.random() * ceiling);
}

/** Errors that will fail again no matter how many times we ask. */
export function isPermanent(message: string): boolean {
  return /\b(400|401|403|404|not configured|no email address|no phone number|no channel|invalid|unsupported|forbidden)\b/i
    .test(message);
}

export interface RunAttemptCtx {
  userId: string;
  agentName: string;
  executionId: string;
}

/**
 * Attempt one step under the retry policy. Every retry is a real Connect row
 * so a run that limped to success still shows the limp.
 */
export async function attemptStep<T>(
  ctx: RunAttemptCtx,
  stepType: string,
  policy: RetryPolicy,
  run: (attempt: number) => Promise<T>,
): Promise<{ value?: T; error?: string; attempts: number; durationMs: number }> {
  const started = Date.now();
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const value = await run(attempt);
      return { value, attempts: attempt, durationMs: Date.now() - started };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const permanent = isPermanent(lastError);
      const last = attempt >= policy.maxAttempts;
      if (permanent || last) break;

      const wait = backoffDelay(attempt, policy);
      void emitPull(ctx.userId, {
        organ: "zahten",
        capability: "retry",
        fromSurface: "zahten",
        status: "fail",
        quote: ctx.agentName,
        meta: { step: stepType, attempt, wait_ms: wait, execution_id: ctx.executionId },
      });
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  return { error: lastError, attempts: policy.maxAttempts, durationMs: Date.now() - started };
}

/**
 * Procedure packs. Each entry is instruction text describing the work — the
 * shape of the answer, the constraints, the honesty rule. None of them assign
 * an identity, because an identity is not a capability.
 */
export const PROCEDURE_PACKS: Record<string, string> = {
  ai_generate: [
    "Carry out the task exactly as written. Do not restate it back.",
    "Structure the answer so it can be acted on: findings first, then what follows from them.",
    "Where a claim depends on information you were not given, say so in one clause instead of filling the gap.",
  ].join("\n"),
  generate_report: [
    "Produce a report on the named subject: what changed, what it implies, what to do next.",
    "Separate observation from inference. Anything you could not verify is marked unverified rather than dropped.",
    "No filler sections. If a section has nothing in it, omit the section.",
  ].join("\n"),
  generate_content: [
    "Draft the requested pieces of content. Vary the openings; no template repetition across items.",
    "Number each piece so it can be picked out and edited on its own.",
  ].join("\n"),
  generate_analytics: [
    "Summarise the supplied figures: level, direction, anomaly, and the one number that matters most.",
    "State plainly when a movement is inside normal variance rather than calling it a trend.",
    "Never invent metrics that were not provided.",
  ].join("\n"),
  send_email: [
    "Write the email body only — no subject line, no signature block.",
    "One purpose per message, the ask in the first two sentences.",
  ].join("\n"),
  send_reminder: [
    "Write one short reminder line for the named routine. Direct, no motivational padding.",
  ].join("\n"),
};

export const DEFAULT_PACK = PROCEDURE_PACKS.ai_generate;

/** Steps that have no runner bound in this deployment. Honest skip, never a green tick. */
export const UNBOUND_STEPS: Record<string, string> = {
  run_tests: "no test runner is bound to this agent — nothing was executed",
  deploy: "no deployment target is bound to this agent — nothing was released",
  analyze_video: "no video pipeline is bound to this agent",
  process_image: "no image pipeline is bound to this agent",
  compare_changes: "no previous snapshot is stored for this agent, so there was nothing to diff",
  format_report: "formatting is applied at delivery; this step is a no-op",
  format_alert: "formatting is applied at delivery; this step is a no-op",
};

/**
 * Calls another Asherin edge function as a child of this run and traces it
 * under that organ, with from_surface=zahten. This is what makes the Connect
 * graph read Chat → Zahten → (Zophiel | Maps | …) instead of a flat list.
 */
export async function callChildTool(
  ctx: RunAttemptCtx,
  fnName: string,
  organ: string,
  body: Record<string, unknown>,
  timeoutMs = 45_000,
): Promise<string> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) throw new Error(`${fnName} is not reachable from this runtime`);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const r = await fetch(`${url}/functions/v1/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${fnName} returned ${r.status}: ${text.slice(0, 200)}`);
    void emitPull(ctx.userId, {
      organ,
      capability: fnName,
      fromSurface: "zahten",
      status: "ok",
      latencyMs: Date.now() - started,
      quote: ctx.agentName,
      meta: { execution_id: ctx.executionId },
    });
    return text;
  } catch (err) {
    void emitPull(ctx.userId, {
      organ,
      capability: fnName,
      fromSurface: "zahten",
      status: "fail",
      latencyMs: Date.now() - started,
      quote: err instanceof Error ? err.message : "child tool failed",
      meta: { execution_id: ctx.executionId },
    });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Worst-of aggregation — one failed step cannot be averaged into a green run. */
export function rollUpStatus(steps: StepRecord[], deliveryOk: boolean | null): RunStatus {
  const anyFailed = steps.some((s) => s.status === "failed") || deliveryOk === false;
  const anySkipped = steps.some((s) => s.status === "skipped");
  const anySuccess = steps.some((s) => s.status === "success");
  if (anyFailed) return anySuccess ? "partial" : "failed";
  if (anySkipped) return "partial";
  return "success";
}
