// mapCases — operation (case-folder) partitioning and immutable audit for the
// Intelligence Map overlay.
//
// NARRATIVE
// A single flat annotation list is a consumer artefact: two investigations
// contaminate each other and there is no record of who changed what. An
// operations model partitions the overlay by case, snapshots it so any prior
// state can be restored, and appends an immutable audit entry for every
// mutation. Storage stays local-first so the layer survives reloads without a
// backend round-trip, and every write is quota-safe.
//
// FLAWS THIS MODULE IS BUILT AGAINST
//  - Silent data loss when localStorage is full or disabled → every write is
//    wrapped and, on quota failure, sheds the oldest snapshots before retrying.
//  - Cross-case bleed → annotations are stored under a per-case key, never a
//    shared array, and the active case id is validated on load.
//  - Unbounded growth → snapshots capped per case, audit capped globally, both
//    trimmed oldest-first.
//  - Corrupt payloads → every read is defensive and degrades to a fresh case
//    rather than throwing inside a render tree.

import { type MapAnnotation, isValidAnnotation } from "@/lib/asher/mapAnnotations";

export interface MapCase {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  classification: "UNCLASSIFIED" | "SENSITIVE" | "RESTRICTED";
}

export interface MapSnapshot {
  id: string;
  caseId: string;
  label: string;
  takenAt: number;
  annotations: MapAnnotation[];
}

export interface AuditEntry {
  id: string;
  caseId: string;
  at: number;
  actor: "operator" | "asher-ai" | "system";
  action: string;
  detail?: string;
}

const K_CASES = "asher:map:cases:v1";
const K_ACTIVE = "asher:map:case:active:v1";
const K_SNAPS = "asher:map:snapshots:v1";
const K_AUDIT = "asher:map:audit:v1";
const K_ANNO_PREFIX = "asher:map:annotations:case:";
/** Pre-case storage key. Migrated into the first case exactly once. */
const K_LEGACY_ANNO = "asher:map:annotations:v1";

const MAX_SNAPSHOTS_PER_CASE = 12;
const MAX_AUDIT = 400;

const hasWindow = () => typeof window !== "undefined";
const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

function read<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** Quota-safe write: on failure, shed snapshots (the largest, least critical
 *  payload) and retry once before giving up silently. */
function write(key: string, value: unknown): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    try {
      const snaps = read<MapSnapshot[]>(K_SNAPS, []);
      window.localStorage.setItem(K_SNAPS, JSON.stringify(snaps.slice(-3)));
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

/* ── Cases ──────────────────────────────────────────────────────────────── */

function seedCase(): MapCase {
  const now = Date.now();
  return { id: uid(), name: "Operation 01", createdAt: now, updatedAt: now, classification: "UNCLASSIFIED" };
}

export function listCases(): MapCase[] {
  const raw = read<MapCase[]>(K_CASES, []);
  const valid = Array.isArray(raw)
    ? raw.filter((c) => c && typeof c.id === "string" && typeof c.name === "string")
    : [];
  if (valid.length) return valid;

  // Bootstrap: create the first case and migrate any pre-case overlay into it.
  const first = seedCase();
  write(K_CASES, [first]);
  write(K_ACTIVE, first.id);
  const legacy = read<unknown[]>(K_LEGACY_ANNO, []);
  if (Array.isArray(legacy) && legacy.length) {
    const migrated = legacy.filter(isValidAnnotation) as MapAnnotation[];
    if (migrated.length) {
      write(K_ANNO_PREFIX + first.id, migrated);
      appendAudit({ caseId: first.id, actor: "system", action: "migrate", detail: `${migrated.length} legacy objects imported` });
    }
  }
  return [first];
}

export function getActiveCaseId(): string {
  const cases = listCases();
  const active = read<string>(K_ACTIVE, "");
  if (active && cases.some((c) => c.id === active)) return active;
  write(K_ACTIVE, cases[0].id);
  return cases[0].id;
}

export function setActiveCaseId(id: string): void {
  if (!listCases().some((c) => c.id === id)) return;
  write(K_ACTIVE, id);
}

export function createCase(name: string): MapCase {
  const now = Date.now();
  const c: MapCase = {
    id: uid(),
    name: name.trim().slice(0, 60) || `Operation ${listCases().length + 1}`,
    createdAt: now, updatedAt: now, classification: "UNCLASSIFIED",
  };
  write(K_CASES, [...listCases(), c]);
  write(K_ANNO_PREFIX + c.id, []);
  write(K_ACTIVE, c.id);
  appendAudit({ caseId: c.id, actor: "operator", action: "create_case", detail: c.name });
  return c;
}

export function renameCase(id: string, name: string): void {
  const next = listCases().map((c) => (c.id === id ? { ...c, name: name.trim().slice(0, 60) || c.name, updatedAt: Date.now() } : c));
  write(K_CASES, next);
  appendAudit({ caseId: id, actor: "operator", action: "rename_case", detail: name });
}

export function setCaseClassification(id: string, classification: MapCase["classification"]): void {
  write(K_CASES, listCases().map((c) => (c.id === id ? { ...c, classification, updatedAt: Date.now() } : c)));
  appendAudit({ caseId: id, actor: "operator", action: "classify", detail: classification });
}

/** Deleting the last case is a no-op: the map always has exactly one home. */
export function deleteCase(id: string): string {
  const cases = listCases();
  if (cases.length <= 1) return cases[0].id;
  const next = cases.filter((c) => c.id !== id);
  write(K_CASES, next);
  if (hasWindow()) { try { window.localStorage.removeItem(K_ANNO_PREFIX + id); } catch { /* noop */ } }
  write(K_SNAPS, read<MapSnapshot[]>(K_SNAPS, []).filter((s) => s.caseId !== id));
  const nextActive = next[0].id;
  write(K_ACTIVE, nextActive);
  appendAudit({ caseId: nextActive, actor: "operator", action: "delete_case", detail: id });
  return nextActive;
}

/* ── Per-case annotations ───────────────────────────────────────────────── */

export function loadCaseAnnotations(caseId: string): MapAnnotation[] {
  const raw = read<unknown[]>(K_ANNO_PREFIX + caseId, []);
  return Array.isArray(raw) ? (raw.filter(isValidAnnotation) as MapAnnotation[]).slice(0, 500) : [];
}

export function saveCaseAnnotations(caseId: string, list: MapAnnotation[]): void {
  write(K_ANNO_PREFIX + caseId, list.slice(0, 500));
  write(K_CASES, listCases().map((c) => (c.id === caseId ? { ...c, updatedAt: Date.now() } : c)));
}

/* ── Snapshots ──────────────────────────────────────────────────────────── */

export function listSnapshots(caseId: string): MapSnapshot[] {
  return read<MapSnapshot[]>(K_SNAPS, []).filter((s) => s?.caseId === caseId).sort((a, b) => b.takenAt - a.takenAt);
}

export function takeSnapshot(caseId: string, label: string, annotations: MapAnnotation[]): MapSnapshot {
  const snap: MapSnapshot = { id: uid(), caseId, label: label.slice(0, 60) || "Snapshot", takenAt: Date.now(), annotations };
  const all = read<MapSnapshot[]>(K_SNAPS, []);
  const mine = all.filter((s) => s.caseId === caseId).sort((a, b) => a.takenAt - b.takenAt);
  const shed = mine.slice(0, Math.max(0, mine.length + 1 - MAX_SNAPSHOTS_PER_CASE)).map((s) => s.id);
  write(K_SNAPS, [...all.filter((s) => !shed.includes(s.id)), snap]);
  appendAudit({ caseId, actor: "operator", action: "snapshot", detail: snap.label });
  return snap;
}

export function deleteSnapshot(id: string): void {
  write(K_SNAPS, read<MapSnapshot[]>(K_SNAPS, []).filter((s) => s.id !== id));
}

/* ── Audit ──────────────────────────────────────────────────────────────── */

export function appendAudit(e: Omit<AuditEntry, "id" | "at">): void {
  const entry: AuditEntry = { ...e, id: uid(), at: Date.now() };
  const all = read<AuditEntry[]>(K_AUDIT, []);
  write(K_AUDIT, [...all, entry].slice(-MAX_AUDIT));
}

export function listAudit(caseId?: string, limit = 60): AuditEntry[] {
  const all = read<AuditEntry[]>(K_AUDIT, []);
  return all.filter((e) => !caseId || e.caseId === caseId).sort((a, b) => b.at - a.at).slice(0, limit);
}
