// IndexedDB-backed location history for Asherin Shield.
// All data is stored locally in the user's browser — never transmitted.

const DB_NAME = "asherin-shield";
const DB_VERSION = 1;
const STORE = "location_history";

export interface GeoFix {
  ts: number;       // epoch ms
  lat: number;
  lon: number;
  acc: number;      // meters
  source: "manual" | "watch";
  ipCountry?: string;
  ipCity?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "ts" });
        store.createIndex("by_ts", "ts");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function recordFix(fix: GeoFix): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(fix);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listFixes(limit = 200): Promise<GeoFix[]> {
  const db = await open();
  const fixes = await new Promise<GeoFix[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const out: GeoFix[] = [];
    const cursorReq = tx.objectStore(STORE).index("by_ts").openCursor(null, "prev");
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && out.length < limit) { out.push(cursor.value as GeoFix); cursor.continue(); }
      else resolve(out);
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  db.close();
  return fixes;
}

export async function clearFixes(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// Haversine in km — used to detect impossible jumps.
export function haversineKm(a: GeoFix, b: GeoFix): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
