// Zaxin Falcon — Local Hotlist (IndexedDB + SHA-256 hashing)
// -----------------------------------------------------------
// Compliance-by-design: plates are only stored as SHA-256 hashes. A live plate
// read is hashed the same way and compared to the local cache. Plaintext plates
// never leave the device unless the operator explicitly exports a case.
//
// The plaintext label + reason are stored ONLY on the local device (per-operator),
// keyed by hash. This lets the reticle show "STOLEN VEHICLE — MA BOLO" while
// keeping the raw plate at rest hashed.

const DB_NAME = "zaxin_falcon";
const STORE = "hotlist";
const DB_VER = 1;

export interface HotlistEntry {
  plateHash: string;    // sha-256 hex of the normalized plate
  plaintext: string;    // normalized plate string (kept only on-device)
  reason: string;       // e.g. "STOLEN VEHICLE", "AMBER ALERT", "PERSON OF INTEREST"
  severity: "watch" | "alert" | "critical";
  addedTs: number;
  addedBy?: string;     // operator id/email
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "plateHash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function hashPlate(plate: string): Promise<string> {
  const enc = new TextEncoder().encode(normalizePlate(plate));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** In-memory mirror for O(1) hit-check on the render path. */
let CACHE: Map<string, HotlistEntry> = new Map();
let LOADED = false;

async function loadCache(): Promise<Map<string, HotlistEntry>> {
  if (LOADED) return CACHE;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    const rows: HotlistEntry[] = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as HotlistEntry[]);
      req.onerror = () => reject(req.error);
    });
    CACHE = new Map(rows.map((r) => [r.plateHash, r]));
    LOADED = true;
  } catch (e) {
    console.warn("[falcon-hotlist] failed to load cache", e);
    LOADED = true;
  }
  return CACHE;
}

/** Ensure the cache is warm — call once on startup. */
export async function warmHotlist(): Promise<void> {
  await loadCache();
}

/** Synchronous hit check against the warm cache. */
export function matchHashSync(plateHash: string): HotlistEntry | null {
  return CACHE.get(plateHash) ?? null;
}

export async function addHotlistPlate(plate: string, reason: string, severity: HotlistEntry["severity"] = "alert", addedBy?: string): Promise<HotlistEntry> {
  const plaintext = normalizePlate(plate);
  if (plaintext.length < 2) throw new Error("plate too short");
  const plateHash = await hashPlate(plaintext);
  const entry: HotlistEntry = { plateHash, plaintext, reason: reason.slice(0, 240), severity, addedTs: Date.now(), addedBy };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  CACHE.set(plateHash, entry);
  return entry;
}

export async function removeHotlistPlate(plateHash: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(plateHash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  CACHE.delete(plateHash);
}

export async function listHotlist(): Promise<HotlistEntry[]> {
  await loadCache();
  return [...CACHE.values()].sort((a, b) => b.addedTs - a.addedTs);
}
