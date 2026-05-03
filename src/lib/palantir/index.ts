// PALANTIR-INSPIRED TS UTILITIES
// Concept ports of: dialogue (HTTP retry/backoff), tritium (lightweight tracing),
// human-readable-types (durations + bytes), atlasdb (in-memory KV with TTL),
// hadoop-crypto (AES-256-GCM streaming), conjure-java-runtime-api (typed errors),
// bulldozer (auto-merge predicate). Pure TS, runs in browser AND Deno.

// ─── tritium: tracing ────────────────────────────────────────────────
export interface Span { id: string; parent?: string; name: string; t0: number; t1?: number; tags: Record<string, unknown>; }
const _spans: Span[] = [];
export function startSpan(name: string, parent?: string, tags: Record<string, unknown> = {}): Span {
  const s: Span = { id: crypto.randomUUID(), parent, name, t0: performance.now(), tags };
  _spans.push(s); return s;
}
export function endSpan(s: Span, extra: Record<string, unknown> = {}) { s.t1 = performance.now(); Object.assign(s.tags, extra); }
export function getSpans(): readonly Span[] { return _spans; }
export function clearSpans() { _spans.length = 0; }

// ─── dialogue: retry + exponential backoff + jitter + circuit ────────
export interface DialogueOpts {
  retries?: number;          // default 4
  baseMs?: number;           // default 250
  maxMs?: number;            // default 8_000
  retryOn?: (err: unknown, status?: number) => boolean;
  signal?: AbortSignal;
  spanName?: string;
}
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
export const defaultRetryOn = (err: unknown, status?: number) =>
  (status !== undefined && RETRYABLE_STATUS.has(status)) ||
  (err instanceof TypeError); // network failures

export async function dialogueFetch(input: RequestInfo | URL, init: RequestInit = {}, opts: DialogueOpts = {}): Promise<Response> {
  const { retries = 4, baseMs = 250, maxMs = 8_000, retryOn = defaultRetryOn, signal, spanName } = opts;
  const span = startSpan(spanName ?? `fetch ${typeof input === "string" ? input : (input as URL).toString?.() ?? "req"}`);
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(input, { ...init, signal: signal ?? init.signal });
      if (res.ok || !retryOn(undefined, res.status) || attempt >= retries) {
        endSpan(span, { status: res.status, attempts: attempt + 1 });
        return res;
      }
    } catch (err) {
      if (!retryOn(err) || attempt >= retries) { endSpan(span, { error: String(err), attempts: attempt + 1 }); throw err; }
    }
    const delay = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + Math.random());
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
  }
}

// ─── human-readable-types ────────────────────────────────────────────
const D_UNITS: [number, string][] = [[31536e6, "y"], [2592e6, "mo"], [864e5, "d"], [36e5, "h"], [6e4, "m"], [1e3, "s"], [1, "ms"]];
export function humanDuration(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "0ms";
  for (const [n, u] of D_UNITS) if (ms >= n) return `${(ms / n).toFixed(ms / n >= 10 ? 0 : 1)}${u}`;
  return `${ms}ms`;
}
const B_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];
export function humanBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return "0B";
  const i = Math.min(B_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)}${B_UNITS[i]}`;
}

// ─── atlasdb: tiny ACID-ish in-memory KV with TTL + optimistic CAS ───
interface KVEntry<V> { v: V; exp?: number; rev: number; }
export class AtlasKV<V = unknown> {
  private m = new Map<string, KVEntry<V>>();
  put(k: string, v: V, ttlMs?: number): number {
    const prev = this.m.get(k); const rev = (prev?.rev ?? 0) + 1;
    this.m.set(k, { v, rev, exp: ttlMs ? Date.now() + ttlMs : undefined });
    return rev;
  }
  get(k: string): V | undefined {
    const e = this.m.get(k); if (!e) return undefined;
    if (e.exp && e.exp < Date.now()) { this.m.delete(k); return undefined; }
    return e.v;
  }
  cas(k: string, expectedRev: number, v: V, ttlMs?: number): boolean {
    const e = this.m.get(k); if ((e?.rev ?? 0) !== expectedRev) return false;
    this.put(k, v, ttlMs); return true;
  }
  del(k: string) { this.m.delete(k); }
  keys() { return Array.from(this.m.keys()); }
  size() { return this.m.size; }
}

// ─── hadoop-crypto: AES-256-GCM streaming-style encrypt/decrypt ──────
export async function aesGcmEncrypt(plaintext: ArrayBuffer | string, password: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array; salt: Uint8Array; }> {
  const enc = new TextEncoder();
  const data = (typeof plaintext === "string" ? enc.encode(plaintext) : new Uint8Array(plaintext)) as BufferSource;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { ciphertext, iv, salt };
}
export async function aesGcmDecrypt(ciphertext: ArrayBuffer, password: string, iv: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

// ─── conjure-java-runtime-api: typed remote errors ───────────────────
export class RemoteException extends Error {
  constructor(public errorCode: string, public errorName: string, public status: number, public params: Record<string, unknown> = {}) {
    super(`${errorName} [${status}] ${errorCode}`);
  }
}
export async function unwrapJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  if (!res.ok) throw new RemoteException(body?.errorCode ?? "UNKNOWN", body?.errorName ?? "RemoteError", res.status, body?.parameters ?? { raw: text.slice(0, 500) });
  return body as T;
}

// ─── bulldozer: auto-merge predicate (safe-to-apply check) ───────────
export interface MergeCandidate { passingChecks: boolean; conflicts: number; requiredApprovals: number; approvals: number; ageMs: number; allowedAuthors?: string[]; author?: string; }
export function bulldozerCanMerge(c: MergeCandidate, opts: { minAgeMs?: number } = {}): { ok: boolean; reason?: string } {
  if (!c.passingChecks) return { ok: false, reason: "checks_failing" };
  if (c.conflicts > 0) return { ok: false, reason: "conflicts" };
  if (c.approvals < c.requiredApprovals) return { ok: false, reason: "needs_approval" };
  if (opts.minAgeMs && c.ageMs < opts.minAgeMs) return { ok: false, reason: "too_young" };
  if (c.allowedAuthors && c.author && !c.allowedAuthors.includes(c.author)) return { ok: false, reason: "author_not_allowed" };
  return { ok: true };
}

export const PALANTIR_CREDITS = [
  "palantir/atlasdb", "palantir/dialogue", "palantir/tritium",
  "palantir/conjure-java-runtime-api", "palantir/bulldozer",
  "palantir/human-readable-types", "palantir/hadoop-crypto",
] as const;
