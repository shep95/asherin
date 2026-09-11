// compute runtime — deterministic in-page transforms for data artifacts.
//
// This runs a pure transform over supplied rows. It does not fetch anything,
// does not execute arbitrary code, and reports honestly when the artifact
// carries no data to transform.

import type { Observation } from "../types";

export interface ComputeInput {
  /** rows the caller genuinely has. never fabricated here. */
  rows: Array<Record<string, unknown>>;
  /** column to group or summarise by, when the contract asked for one. */
  groupBy?: string;
  valueKey?: string;
}

export interface ComputeResult {
  ok: boolean;
  columns: string[];
  rows: string[][];
  observations: Observation[];
  reason?: string;
}

export function computeTable(input: ComputeInput): ComputeResult {
  const started = performance.now?.() ?? 0;
  if (!input.rows.length) {
    return { ok: false, columns: [], rows: [], observations: [], reason: "no rows were supplied, so nothing can be computed" };
  }

  let columns: string[];
  let rows: string[][];

  if (input.groupBy && input.rows[0] && input.groupBy in input.rows[0]) {
    const buckets = new Map<string, number>();
    for (const r of input.rows) {
      const key = String(r[input.groupBy] ?? "—");
      const raw = input.valueKey ? Number(r[input.valueKey]) : 1;
      const add = Number.isFinite(raw) ? raw : 0;
      buckets.set(key, (buckets.get(key) ?? 0) + add);
    }
    columns = [input.groupBy, input.valueKey ? `sum(${input.valueKey})` : "count"];
    rows = Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, String(v)]);
  } else {
    columns = Object.keys(input.rows[0]);
    rows = input.rows.map((r) => columns.map((c) => String(r[c] ?? "")));
  }

  const ms = Math.max(0, Math.round(((performance.now?.() ?? 0) - started) * 100) / 100);
  return {
    ok: true,
    columns,
    rows,
    observations: [
      {
        channel: "state",
        source: "compute runtime",
        level: "info",
        message: `computed ${rows.length} row(s) across ${columns.length} column(s)`,
        observedAt: new Date().toISOString(),
      },
      {
        channel: "performance",
        source: "compute runtime",
        level: "info",
        message: `transform took ${ms}ms`,
        observedAt: new Date().toISOString(),
      },
    ],
  };
}
