// Zaxin Falcon — Identity hotlist (hashed, IndexedDB, session-scoped plaintext)
// -----------------------------------------------------------------------------
// Parallel to plate hotlist. Stores SHA-256(licenseNumber|dob) hashes with a
// short human label + reason + severity. Compliance-by-design: raw name/DOB
// never persist. Plaintext label lives only in the on-device row for the
// operator's own reference, keyed by hash.

const DB_NAME = "zaxin_falcon";
const STORE = "id_hotlist";
const DB_VER = 2; // bumped from hotlist.ts's v1

export interface IdHotlistEntry {
  idHash: string;
  label: string;                        // e.g. "J. DOE — DL M4567 — BOLO"
  reason: string;
  severity: "watch" | "alert" | "critical";
  addedTs: number;
  addedBy?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("hotlist")) {
        db.createObjectStore("hotlist", { keyPath: "plateHash" });
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "idHash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let CACHE = new Map<string, IdHotlistEntry>();
let LOADED = false;

async function loadCache(): Promise<Map<string, IdHotlistEntry>> {
  if (LOADED) return CACHE;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    const rows: IdHotlistEntry[] = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as IdHotlistEntry[]);
      req.onerror = () => reject(req.error);
    });
    CACHE = new Map(rows.map((r) => [r.idHash, r]));
    LOADED = true;
  } catch (e) {
    console.warn("[falcon-id-hotlist] load failed", e);
    LOADED = true;
  }
  return CACHE;
}

export async function warmIdHotlist(): Promise<void> { await loadCache(); }

export function matchIdHashSync(idHash: string): IdHotlistEntry | null {
  return CACHE.get(idHash) ?? null;
}

export async function addIdHotlistEntry(
  idHash: string, label: string, reason: string,
  severity: IdHotlistEntry["severity"] = "alert", addedBy?: string
): Promise<IdHotlistEntry> {
  if (!idHash || idHash.length < 8) throw new Error("invalid id hash");
  const entry: IdHotlistEntry = {
    idHash,
    label: label.slice(0, 120),
    reason: reason.slice(0, 240),
    severity,
    addedTs: Date.now(),
    addedBy,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  CACHE.set(idHash, entry);
  return entry;
}

export async function removeIdHotlistEntry(idHash: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(idHash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  CACHE.delete(idHash);
}

export async function listIdHotlist(): Promise<IdHotlistEntry[]> {
  await loadCache();
  return [...CACHE.values()].sort((a, b) => b.addedTs - a.addedTs);
}
