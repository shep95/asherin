// ZANOEM Auto-Fix Loop
// ────────────────────
// Repeatedly runs the local file validator and asks ZANOEM (via the
// existing chat hook the IDE already uses) to patch each error batch
// until either zero errors remain OR a hard pass cap is hit.
//
// This module owns NO React state — the IDE module passes in a
// `runZanoemTurn(prompt)` callback that performs the actual round-trip
// (because the IDE is the only place that knows about projects, files,
// branches, BYOK keys, etc).

import { validateFiles } from "@/lib/ide";

export interface AutoFixFile {
  id: string;
  name: string;     // path/filename
  content: string;
  language?: string;
}

export interface AutoFixResult {
  passes: number;
  finalErrorCount: number;
  clean: boolean;
  aborted?: boolean;
  history: { pass: number; errorCount: number; sample: string[] }[];
}

interface AutoFixOptions {
  files: () => AutoFixFile[];                          // fresh files each pass
  runZanoemTurn: (prompt: string) => Promise<void>;    // sends one autopilot turn through the IDE chat
  applyFileFix?: (file: AutoFixFile, issues: FlatErr[]) => Promise<boolean> | boolean;
  maxPasses?: number;                                  // default 8
  onProgress?: (pass: number, errorCount: number) => void;
  // Fired after every pass with the post-pass validator count so the UI
  // can show "still N errors — restarting swarm" feedback.
  onPassComplete?: (pass: number, remainingErrors: number, applied: number) => void;
  // ── SWARM HOOKS ────────────────────────────────────────────────
  // Called when an agent is spawned for a file. Returns an agent id
  // the consumer can use to render a live swarm panel. The swarm
  // dispatcher will call `onAgentDone(id, success)` when the agent
  // finishes so the UI can fade it out.
  onAgentSpawn?: (agent: { id: string; file: string; issueCount: number; pass: number }) => void;
  onAgentDone?: (id: string, success: boolean) => void;
  // Max parallel agents (default 6) so we don't slam BYOK provider
  // rate limits when 30 files all break at once.
  swarmConcurrency?: number;
  // ── QUEUE THROTTLE ─────────────────────────────────────────────
  // Minimum gap (ms) between agent spawns. Acts as a token-bucket so
  // we don't fire 30 Gemini calls in the same 100ms window. Default 800ms.
  perAgentDelayMs?: number;
  // ── SCAN-ALL MODE ──────────────────────────────────────────────
  // When true, every file gets an agent each pass (not just files
  // flagged by the validator). Use this to audit bugs AND logic
  // across the entire project / zip package.
  scanAllFiles?: boolean;
  // ── PAUSE / ABORT CONTROLS ─────────────────────────────────────
  // Polled between agents and between passes. If `shouldPause()` returns
  // true, the loop sleeps in 250ms ticks until it returns false. If
  // `shouldAbort()` returns true, the loop exits immediately and reports
  // the current state as `aborted: true`.
  shouldPause?: () => boolean;
  shouldAbort?: () => boolean;
}

type FlatErr = { file: string; line?: number; message: string };

/** Wait until there are no validator errors, or we've burned all passes. */
export async function autoFixUntilClean(opts: AutoFixOptions): Promise<AutoFixResult> {
  const max = opts.maxPasses ?? 8;
  const concurrency = Math.max(1, opts.swarmConcurrency ?? 6);
  const history: AutoFixResult["history"] = [];

  const collect = (): FlatErr[] => {
    const cur = opts.files();
    const report = validateFiles(cur.map((f) => ({ path: f.name, content: f.content })));
    const errs: FlatErr[] = [];
    for (const pf of report.perFile) {
      for (const issue of pf.result.issues) {
        if (issue.severity === "error") {
          errs.push({ file: pf.path, line: issue.line, message: issue.message });
        }
      }
    }
    return errs;
  };

  // Helper: block while paused, return true if we should abort.
  const waitWhilePaused = async (): Promise<boolean> => {
    while (opts.shouldPause?.()) {
      if (opts.shouldAbort?.()) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return !!opts.shouldAbort?.();
  };

  // Token-bucket gate so spawns are spaced out across the swarm.
  const perAgentDelayMs = Math.max(0, opts.perAgentDelayMs ?? 800);
  let lastSpawnAt = 0;
  const queueGate = async (): Promise<void> => {
    if (perAgentDelayMs <= 0) return;
    const wait = lastSpawnAt + perAgentDelayMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSpawnAt = Date.now();
  };

  for (let pass = 1; pass <= max; pass++) {
    if (await waitWhilePaused()) {
      const finalErrors = collect().length;
      return { passes: pass - 1, finalErrorCount: finalErrors, clean: finalErrors === 0, aborted: true, history };
    }
    const errors = collect();
    opts.onProgress?.(pass, errors.length);
    history.push({
      pass,
      errorCount: errors.length,
      sample: errors.slice(0, 5).map((e) => `${e.file}:${e.line ?? "?"} — ${e.message}`),
    });
    // In scan-all mode we keep iterating even with zero validator errors,
    // because the goal is to audit logic across every file.
    if (errors.length === 0 && !opts.scanAllFiles) {
      return { passes: pass - 1, finalErrorCount: 0, clean: true, history };
    }

    if (opts.applyFileFix) {
      // ── SWARM DISPATCH ──────────────────────────────────────────
      // Spawn one agent per broken file, run them in parallel (capped
      // by `concurrency`), then tear the swarm down at the end of the
      // pass. Each agent owns ONE file end-to-end so failures are
      // isolated.
      const allFiles = opts.files();
      const targets = opts.scanAllFiles
        ? allFiles.map((f) => ({ file: f, issues: errors.filter((e) => e.file === f.name) }))
        : allFiles
            .map((f) => ({ file: f, issues: errors.filter((e) => e.file === f.name) }))
            .filter((t) => t.issues.length > 0);

      let appliedTotal = 0;
      let cursor = 0;
      const next = () => (cursor < targets.length ? targets[cursor++] : null);
      const worker = async () => {
        while (true) {
          if (await waitWhilePaused()) return;
          const t = next();
          if (!t) return;
          // Queue gate: throttle spawns so the BYOK API doesn't get flooded.
          await queueGate();
          if (await waitWhilePaused()) return;
          const agentId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
            ? crypto.randomUUID()
            : `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          opts.onAgentSpawn?.({ id: agentId, file: t.file.name, issueCount: t.issues.length, pass });
          let ok = false;
          try {
            ok = !!(await opts.applyFileFix!(t.file, t.issues));
          } catch (e) {
            console.warn("[swarm-agent] failed on", t.file.name, e);
            ok = false;
          } finally {
            opts.onAgentDone?.(agentId, ok);
          }
          if (ok) appliedTotal++;
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
      // In scan-all mode the loop should still terminate when nothing
      // changed AND no validator errors remain.
      if (opts.scanAllFiles && appliedTotal === 0 && errors.length === 0) {
        return { passes: pass, finalErrorCount: 0, clean: true, history };
      }
      if (appliedTotal > 0) continue;
    }


    // Build a structured fix prompt for ZANOEM.
    const grouped: Record<string, string[]> = {};
    for (const e of errors) {
      const f = e.file || "(unknown)";
      (grouped[f] ||= []).push(`  • line ${e.line ?? "?"}: ${e.message}`);
    }
    const fixPrompt = [
      `[ZANOEM AUTO-FIX — pass ${pass}/${max}, ${errors.length} error(s) remaining]`,
      "",
      "The following validator errors exist in the project. Patch the affected files",
      "directly using your normal code-block-with-path output format. Do NOT ask",
      "any questions. Decide every fix yourself. Only emit the files you change.",
      "",
      ...Object.entries(grouped).map(([f, lines]) => [`FILE: ${f}`, ...lines, ""].join("\n")),
      "After your edits, append a single line on its own:",
      `ZANOEM_AUTOFIX_PASS_${pass}_DONE`,
    ].join("\n");

    try {
      await opts.runZanoemTurn(fixPrompt);
    } catch (e) {
      console.warn("[zanoem-autofix] turn failed on pass", pass, e);
      return { passes: pass, finalErrorCount: errors.length, clean: false, history };
    }
  }

  // Final read after the last pass.
  const finalErrors = collect().length;
  return { passes: max, finalErrorCount: finalErrors, clean: finalErrors === 0, history };
}
