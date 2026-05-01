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
  history: { pass: number; errorCount: number; sample: string[] }[];
}

interface AutoFixOptions {
  files: () => AutoFixFile[];                          // fresh files each pass
  runZanoemTurn: (prompt: string) => Promise<void>;    // sends one autopilot turn through the IDE chat
  maxPasses?: number;                                  // default 8
  onProgress?: (pass: number, errorCount: number) => void;
}

/** Wait until there are no validator errors, or we've burned all passes. */
export async function autoFixUntilClean(opts: AutoFixOptions): Promise<AutoFixResult> {
  const max = opts.maxPasses ?? 8;
  const history: AutoFixResult["history"] = [];

  for (let pass = 1; pass <= max; pass++) {
    const cur = opts.files();
    const report = validateFiles(cur.map((f) => ({ name: f.name, content: f.content, language: f.language })));
    const errors = report.filter((r) => r.severity === "error");
    opts.onProgress?.(pass, errors.length);
    history.push({
      pass,
      errorCount: errors.length,
      sample: errors.slice(0, 5).map((e) => `${e.file}:${e.line ?? "?"} — ${e.message}`),
    });
    if (errors.length === 0) {
      return { passes: pass - 1, finalErrorCount: 0, clean: true, history };
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
  const cur = opts.files();
  const report = validateFiles(cur.map((f) => ({ name: f.name, content: f.content, language: f.language })));
  const finalErrors = report.filter((r) => r.severity === "error").length;
  return { passes: max, finalErrorCount: finalErrors, clean: finalErrors === 0, history };
}
