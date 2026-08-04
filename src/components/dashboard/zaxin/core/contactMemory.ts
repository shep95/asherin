// ZAXIN CONTACT MEMORY — offline-first persistence & recall.
// ─────────────────────────────────────────────────────────
// Before this module, every AR Vision session started blind: contacts, their
// dossiers, and the visual anchors all lived in React state and evaporated on
// reload. An operator could walk the same corridor twice and the engine had no
// idea it had already characterised every emitter in it.
//
// This gives Zaxin a durable, device-local memory:
//   • Every sighting is folded into a persistent dossier (IndexedDB).
//   • Behaviour classifications accumulate as a histogram, so a device that
//     read "vehicle-mounted" once during a bad RSSI burst does not overwrite
//     forty stationary reads.
//   • Returning emitters raise a RE-ACQUISITION alert with the exact dwell gap.
//   • Nothing leaves the device. Purge is one call.
//
// Failure posture: IndexedDB is unavailable in some private-browsing modes and
// inside sandboxed iframes. Every path degrades to an in-memory map instead of
// throwing, so AR Vision never breaks because storage was denied.

import type { Contact } from "./types";
import type { DeviceBehavior } from "./visionAi";

const DB_NAME = "zaxin-memory";
const DB_VERSION = 1;
const STORE = "contacts";

/** Gap after which a returning emitter counts as a re-acquisition. */
const REACQUIRE_GAP_MS = 10 * 60 * 1000;
/** Dossiers untouched for this long are pruned on boot. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Write coalescing window — AR runs at 8 Hz, IndexedDB should not. */
const FLUSH_MS = 4_000;

export interface ContactDossier {
  id: string;
  displayName: string;
  manufacturer: string | null;
  inferredKind: string | null;
  firstSeen: number;
  lastSeen: number;
  /** Number of distinct AR sessions this emitter has appeared in. */
  sessions: number;
  /** Total fusion cycles it has been observed in. */
  sightings: number;
  /** Strongest RSSI ever recorded — a proxy for closest approach. */
  bestRssi: number | null;
  /** Closest filtered range ever recorded, metres. */
  closestRangeM: number | null;
  /** Behaviour classification histogram — majority vote beats last-write. */
  behavior: Partial<Record<DeviceBehavior, number>>;
  lastBearing: number | null;
  lastRangeM: number | null;
  threatTier: string;
  watchlisted: boolean;
  /** Operator note, survives reloads. */
  note?: string;
}

export interface Reacquisition {
  id: string;
  displayName: string;
  /** Milliseconds between the previous sighting and this one. */
  gapMs: number;
  sessions: number;
  sightings: number;
  dossier: ContactDossier;
}

export interface MemoryStats {
  total: number;
  backend: "indexeddb" | "memory";
  oldest: number | null;
  watchlisted: number;
}

/* ── Storage layer ─────────────────────────────────────────────────── */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: "id" });
          os.createIndex("lastSeen", "lastSeen");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      // Some environments never fire either handler (blocked upgrade).
      setTimeout(() => resolve(req.readyState === "done" ? req.result ?? null : null), 3_000);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) { resolve(null); return; }
        try {
          const t = db.transaction(STORE, mode);
          const req = fn(t.objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/* ── Engine ────────────────────────────────────────────────────────── */

export class ContactMemory {
  private cache = new Map<string, ContactDossier>();
  private dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;
  private backend: "indexeddb" | "memory" = "memory";
  /** Ids already credited with a session this mount — prevents double counting. */
  private sessionCredited = new Set<string>();
  /** Ids already reported as re-acquired this mount — one alert per return. */
  private announced = new Set<string>();

  /** Load prior dossiers. Safe to call repeatedly; only the first run reads. */
  async boot(): Promise<ContactDossier[]> {
    if (this.ready) return [...this.cache.values()];
    const all = await tx<ContactDossier[]>("readonly", (s) => s.getAll() as IDBRequest<ContactDossier[]>);
    this.backend = all == null ? "memory" : "indexeddb";
    const now = Date.now();
    for (const d of all ?? []) {
      if (!d?.id) continue;
      if (now - (d.lastSeen ?? 0) > RETENTION_MS) { void this.forget(d.id); continue; }
      this.cache.set(d.id, d);
    }
    this.ready = true;
    return [...this.cache.values()];
  }

  /**
   * Fold one fusion cycle into memory.
   * Returns any emitters that just came back after a long silence.
   */
  ingest(
    contacts: Array<Contact & { track?: { rangeM: number | null; bearing: number | null } }>,
    behaviorOf?: (c: Contact) => DeviceBehavior,
  ): Reacquisition[] {
    const now = Date.now();
    const out: Reacquisition[] = [];

    for (const c of contacts) {
      const prior = this.cache.get(c.id);
      const rangeM = c.track?.rangeM ?? c.distanceMeters ?? null;
      const bearing = c.track?.bearing ?? c.bearing ?? null;

      if (!prior) {
        const fresh: ContactDossier = {
          id: c.id,
          displayName: c.displayName,
          manufacturer: c.manufacturer,
          inferredKind: c.inferredKind,
          firstSeen: c.firstSeen || now,
          lastSeen: now,
          sessions: 1,
          sightings: 1,
          bestRssi: c.rssi ?? null,
          closestRangeM: rangeM,
          behavior: behaviorOf ? { [behaviorOf(c)]: 1 } : {},
          lastBearing: bearing,
          lastRangeM: rangeM,
          threatTier: c.threatTier,
          watchlisted: c.watchlisted,
        };
        this.cache.set(c.id, fresh);
        this.sessionCredited.add(c.id);
        this.mark(c.id);
        continue;
      }

      const gap = now - prior.lastSeen;
      if (!this.sessionCredited.has(c.id)) {
        this.sessionCredited.add(c.id);
        prior.sessions += 1;
      }
      if (gap > REACQUIRE_GAP_MS && !this.announced.has(c.id)) {
        this.announced.add(c.id);
        out.push({
          id: c.id,
          displayName: prior.displayName || c.displayName,
          gapMs: gap,
          sessions: prior.sessions,
          sightings: prior.sightings,
          dossier: prior,
        });
      }

      prior.lastSeen = now;
      prior.sightings += 1;
      // Prefer a real broadcast name over an id-suffix placeholder.
      if (c.nameSource !== "id-suffix" || !prior.displayName) prior.displayName = c.displayName;
      if (c.manufacturer) prior.manufacturer = c.manufacturer;
      if (c.inferredKind) prior.inferredKind = c.inferredKind;
      if (c.rssi != null && (prior.bestRssi == null || c.rssi > prior.bestRssi)) prior.bestRssi = c.rssi;
      if (rangeM != null && (prior.closestRangeM == null || rangeM < prior.closestRangeM)) prior.closestRangeM = rangeM;
      prior.lastBearing = bearing ?? prior.lastBearing;
      prior.lastRangeM = rangeM ?? prior.lastRangeM;
      prior.threatTier = c.threatTier;
      prior.watchlisted = c.watchlisted;
      if (behaviorOf) {
        const b = behaviorOf(c);
        prior.behavior[b] = (prior.behavior[b] ?? 0) + 1;
      }
      this.mark(c.id);
    }

    return out;
  }

  /** Majority-vote behaviour across the emitter's whole recorded history. */
  dominantBehavior(id: string): { behavior: DeviceBehavior | null; share: number } {
    const d = this.cache.get(id);
    if (!d) return { behavior: null, share: 0 };
    const entries = Object.entries(d.behavior) as Array<[DeviceBehavior, number]>;
    if (!entries.length) return { behavior: null, share: 0 };
    const total = entries.reduce((a, [, n]) => a + n, 0);
    const [best, n] = entries.sort((a, b) => b[1] - a[1])[0];
    return { behavior: best, share: total ? n / total : 0 };
  }

  get(id: string): ContactDossier | null { return this.cache.get(id) ?? null; }

  /** Free-text recall across every dossier ever recorded on this device. */
  search(q: string, limit = 40): ContactDossier[] {
    const needle = q.trim().toLowerCase();
    const all = [...this.cache.values()];
    const pool = needle
      ? all.filter((d) =>
          d.displayName.toLowerCase().includes(needle) ||
          (d.manufacturer ?? "").toLowerCase().includes(needle) ||
          (d.inferredKind ?? "").toLowerCase().includes(needle) ||
          d.id.toLowerCase().includes(needle))
      : all;
    return pool.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, limit);
  }

  setNote(id: string, note: string) {
    const d = this.cache.get(id);
    if (!d) return;
    d.note = note.slice(0, 500);
    this.mark(id);
  }

  stats(): MemoryStats {
    const all = [...this.cache.values()];
    return {
      total: all.length,
      backend: this.backend,
      oldest: all.length ? Math.min(...all.map((d) => d.firstSeen)) : null,
      watchlisted: all.filter((d) => d.watchlisted).length,
    };
  }

  async forget(id: string) {
    this.cache.delete(id);
    this.dirty.delete(id);
    await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  }

  async purge() {
    this.cache.clear();
    this.dirty.clear();
    this.sessionCredited.clear();
    this.announced.clear();
    await tx("readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
  }

  /** Flush pending writes immediately (call on unmount / visibilitychange). */
  async flush() {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (!this.dirty.size) return;
    const batch = [...this.dirty].map((id) => this.cache.get(id)).filter(Boolean) as ContactDossier[];
    this.dirty.clear();
    const db = await openDb();
    if (!db) return;
    try {
      const t = db.transaction(STORE, "readwrite");
      const store = t.objectStore(STORE);
      for (const d of batch) store.put(d);
    } catch {
      /* storage denied mid-session — memory cache still authoritative */
    }
  }

  private mark(id: string) {
    this.dirty.add(id);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, FLUSH_MS);
  }
}

export function formatGap(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
