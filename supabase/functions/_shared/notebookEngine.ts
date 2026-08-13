// Asherin Notebooks — compute core.
//
// Design constraints (non-negotiable, they are the product):
//  1. A cell run is bounded: hard wall-clock timeout + hard row cap. A notebook
//     can never hold an edge worker hostage or ship a million rows to a browser.
//  2. Nothing secret ever reaches cell output. Sources are addressed BY ID
//     (dataset / library file / azplen table), never by pasted credentials, and
//     every emitted string is redacted before it leaves this module.
//  3. Output is a typed envelope, not a blob of prose. The UI renders tables and
//     charts from `columns` + `rows`; text is only a fallback.

export const MAX_ROWS = 500;
export const MAX_CELL_MS = 20_000;
export const DEFAULT_CELL_MS = 12_000;

export type Row = Record<string, string | number | null>;

export interface CellResult {
  kind: "table" | "text" | "error";
  text?: string;
  columns: string[];
  rows: Row[];
  rowCount: number;
  scanned: number;
  truncated: boolean;
  elapsedMs: number;
  source: string | null;
  /** Chart cells carry a resolved spec the UI can render directly. */
  chart?: { type: "bar" | "line" | "area" | "pie"; x: string; y: string[]; title?: string } | null;
}

/* ------------------------------------------------------------------ *
 * Secret hygiene — Jupyter's worst habit is echoing env into a cell.
 * ------------------------------------------------------------------ */

const SECRET_PATTERNS: RegExp[] = [
  /\b(sk|pk|rk|api|key|token|bearer|secret|pat|ghp|gho|ghu|ghs|xoxb|xoxp)[-_a-z]*[=:\s]*["']?[A-Za-z0-9_\-]{16,}/gi,
  /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g,
  /\bAIza[0-9A-Za-z_\-]{20,}\b/g,
  /\b(?:password|passphrase|totp|otp|seed|mnemonic|private[_-]?key)\s*[:=]\s*\S+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

/** Column names that are never returned, whatever the source holds. */
const BANNED_COLUMN = /(^|_)(api_?key|secret|token|password|passphrase|credential|private_?key|access_?token|refresh_?token|totp|otp_seed)($|_)/i;

export function redact(value: unknown): string {
  let s = String(value ?? "");
  for (const re of SECRET_PATTERNS) s = s.replace(re, "[redacted]");
  return s;
}

function scrubCell(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return redact(JSON.stringify(v)).slice(0, 2000);
  const s = redact(v);
  return s.length > 2000 ? `${s.slice(0, 1997)}…` : s;
}

/** Drop credential-shaped columns, redact every remaining value. */
export function scrubRows(rows: Record<string, unknown>[]): { columns: string[]; rows: Row[] } {
  const columns: string[] = [];
  for (const r of rows.slice(0, 50)) {
    for (const k of Object.keys(r)) {
      if (BANNED_COLUMN.test(k)) continue;
      if (!columns.includes(k)) columns.push(k);
    }
  }
  const out: Row[] = rows.map((r) => {
    const o: Row = {};
    for (const c of columns) o[c] = scrubCell(r[c]);
    return o;
  });
  return { columns, rows: out };
}

/* ------------------------------------------------------------------ *
 * Timeout — a cell is a bounded promise, always.
 * ------------------------------------------------------------------ */

export class CellTimeout extends Error {
  constructor(ms: number) {
    super(`Cell timed out after ${ms}ms — narrow the query or lower the row count.`);
    this.name = "CellTimeout";
  }
}

export function clampTimeout(requested?: unknown): number {
  const n = typeof requested === "number" && Number.isFinite(requested) ? requested : DEFAULT_CELL_MS;
  return Math.max(1_000, Math.min(MAX_CELL_MS, Math.round(n)));
}

export async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  let timer: number | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new CellTimeout(ms));
    }, ms) as unknown as number;
  });
  try {
    return await Promise.race([run(ctrl.signal), guard]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { fields.push(current.trim()); current = ""; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length === 0 || !lines[0]) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").replace(/^"|"$/g, ""); });
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * SQL — a deliberately small, read-only dialect over an in-memory table.
 * No engine, no eval, no injection surface: the query is parsed into a plan
 * and the plan runs over rows already scoped to the caller.
 * ------------------------------------------------------------------ */

const WRITE_KEYWORDS = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge)\b/i;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function compare(a: unknown, b: unknown): number {
  const an = num(a), bn = num(b);
  if (an !== null && bn !== null) return an - bn;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

interface Agg { fn: string; col: string; alias: string }

function matchWhere(row: Record<string, unknown>, clause: string): boolean {
  // AND-joined simple predicates only: col OP value, plus LIKE and IS NULL.
  const parts = clause.split(/\s+AND\s+/i);
  return parts.every((raw) => {
    const p = raw.trim();
    let m = p.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
    if (m) {
      const empty = row[m[1]] == null || row[m[1]] === "";
      return m[2] ? !empty : empty;
    }
    m = p.match(/^(\w+)\s+(NOT\s+)?LIKE\s+'([^']*)'$/i);
    if (m) {
      const pattern = m[3].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
      const hit = new RegExp(`^${pattern}$`, "i").test(String(row[m[1]] ?? ""));
      return m[2] ? !hit : hit;
    }
    m = p.match(/^(\w+)\s*(>=|<=|!=|<>|=|>|<)\s*'?([^']*?)'?$/);
    if (!m) return true; // unparsed predicate never silently filters everything out
    const [, col, op, rawVal] = m;
    const cmp = compare(row[col], rawVal);
    switch (op) {
      case "=": return String(row[col] ?? "").toLowerCase() === rawVal.toLowerCase();
      case "!=": case "<>": return String(row[col] ?? "").toLowerCase() !== rawVal.toLowerCase();
      case ">": return cmp > 0;
      case "<": return cmp < 0;
      case ">=": return cmp >= 0;
      case "<=": return cmp <= 0;
      default: return true;
    }
  });
}

export function runQuery(source: Record<string, unknown>[], sql: string): { columns: string[]; rows: Row[]; scanned: number; truncated: boolean } {
  const clean = sql.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim().replace(/;+$/, "");
  if (!clean) throw new Error("Empty query.");
  if (WRITE_KEYWORDS.test(clean)) throw new Error("Notebooks are read-only. Only SELECT is allowed.");
  if (!/^select\b/i.test(clean)) throw new Error("Query must start with SELECT.");

  const scanned = source.length;
  let rows = source;

  const whereM = clean.match(/\bWHERE\s+(.*?)(?=\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/i);
  if (whereM) rows = rows.filter((r) => matchWhere(r, whereM[1]));

  const selectM = clean.match(/^SELECT\s+(.*?)\s+FROM\b/i) ?? clean.match(/^SELECT\s+(.*?)(?=\s+WHERE\b|\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/i);
  const selectList = (selectM?.[1] ?? "*").trim();

  const groupM = clean.match(/\bGROUP\s+BY\s+([\w\s,]+?)(?=\s+ORDER\s+BY\b|\s+LIMIT\b|$)/i);
  const groupCols = groupM ? groupM[1].split(",").map((c) => c.trim()).filter(Boolean) : [];

  const aggs: Agg[] = [];
  const plainCols: string[] = [];
  for (const item of selectList.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean)) {
    const am = item.match(/^(count|sum|avg|min|max)\s*\(\s*([\w*]+)\s*\)(?:\s+AS\s+(\w+))?$/i);
    if (am) aggs.push({ fn: am[1].toLowerCase(), col: am[2], alias: am[3] ?? `${am[1].toLowerCase()}_${am[2] === "*" ? "all" : am[2]}` });
    else plainCols.push(item.replace(/^["`]|["`]$/g, ""));
  }

  let projected: Record<string, unknown>[];

  if (aggs.length > 0) {
    const buckets = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      const key = groupCols.map((c) => String(r[c] ?? "")).join("\u0001");
      const bucket = buckets.get(key);
      if (bucket) bucket.push(r); else buckets.set(key, [r]);
    }
    projected = [...buckets.values()].map((bucket) => {
      const out: Record<string, unknown> = {};
      for (const c of groupCols) out[c] = bucket[0][c] ?? null;
      for (const a of aggs) {
        if (a.fn === "count") { out[a.alias] = a.col === "*" ? bucket.length : bucket.filter((r) => r[a.col] != null && r[a.col] !== "").length; continue; }
        const nums = bucket.map((r) => num(r[a.col])).filter((n): n is number => n !== null);
        if (nums.length === 0) { out[a.alias] = null; continue; }
        out[a.alias] =
          a.fn === "sum" ? nums.reduce((s, n) => s + n, 0)
          : a.fn === "avg" ? Number((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(6))
          : a.fn === "min" ? Math.min(...nums)
          : Math.max(...nums);
      }
      return out;
    });
  } else if (plainCols.length === 1 && plainCols[0] === "*") {
    projected = rows.slice();
  } else {
    projected = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of plainCols) o[c] = r[c] ?? null;
      return o;
    });
  }

  const orderM = clean.match(/\bORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
  if (orderM) {
    const [, col, dir] = orderM;
    const desc = (dir ?? "").toUpperCase() === "DESC";
    projected.sort((a, b) => (desc ? -1 : 1) * compare(a[col], b[col]));
  }

  const limitM = clean.match(/\bLIMIT\s+(\d+)/i);
  const limit = Math.min(limitM ? parseInt(limitM[1], 10) : MAX_ROWS, MAX_ROWS);
  const truncated = projected.length > limit;
  const scrubbed = scrubRows(projected.slice(0, limit) as Record<string, unknown>[]);
  return { ...scrubbed, scanned, truncated };
}

/* ------------------------------------------------------------------ *
 * Chart cells — declarative spec, resolved against the same source.
 * ------------------------------------------------------------------ */

export function parseChartSpec(content: string): { type: CellResult["chart"] extends infer _ ? "bar" | "line" | "area" | "pie" : never; x: string; y: string[]; title?: string; query?: string } {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const type = String(parsed.type ?? "bar").toLowerCase();
    const y = Array.isArray(parsed.y) ? parsed.y.map(String) : parsed.y ? [String(parsed.y)] : [];
    if (!parsed.x || y.length === 0) throw new Error('Chart needs "x" and "y". Example: {"type":"bar","x":"city","y":["count"]}');
    return {
      type: (["bar", "line", "area", "pie"].includes(type) ? type : "bar") as "bar",
      x: String(parsed.x),
      y,
      title: parsed.title ? String(parsed.title) : undefined,
      query: parsed.query ? String(parsed.query) : undefined,
    };
  }
  // key: value shorthand
  const cfg: Record<string, string> = {};
  for (const line of trimmed.split("\n")) {
    const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (m) cfg[m[1].toLowerCase()] = m[2];
  }
  if (!cfg.x || !cfg.y) throw new Error('Chart needs "x:" and "y:" lines, or a JSON spec.');
  const t = (cfg.type ?? "bar").toLowerCase();
  return {
    type: (["bar", "line", "area", "pie"].includes(t) ? t : "bar") as "bar",
    x: cfg.x,
    y: cfg.y.split(",").map((s) => s.trim()).filter(Boolean),
    title: cfg.title,
    query: cfg.query,
  };
}
