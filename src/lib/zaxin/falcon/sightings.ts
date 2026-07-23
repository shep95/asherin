// Zaxin Falcon — Sighting log + Convoy/Co-travel detector
// ---------------------------------------------------------
// In-memory ring buffer of confirmed plate sightings. When two plates repeatedly
// appear within a short window of each other, they're flagged as a co-travel
// pair (Flock calls this "Convoy Search"). Fully local-first, backend sync is
// a separate concern.

export interface Sighting {
  plateHash: string;
  plate: string;            // plaintext (kept on-device only)
  ts: number;
  lat?: number;
  lng?: number;
  bearingDeg?: number | null;
  color?: string;
  bodyClass?: string;
}

export interface ConvoyPair {
  a: { hash: string; plate: string };
  b: { hash: string; plate: string };
  coOccurrences: number;
  lastTs: number;
}

const MAX_SIGHTINGS = 5000;
const CO_WINDOW_MS = 60_000; // vehicles seen within 60s of each other = co-travel candidate
const CONFIRM_COUNT = 2;     // needs ≥2 co-occurrences to be considered a "pair"

const RING: Sighting[] = [];
const SUBS = new Set<(all: Sighting[]) => void>();

export function subscribeSightings(cb: (all: Sighting[]) => void): () => void {
  SUBS.add(cb);
  cb([...RING]);
  return () => { SUBS.delete(cb); };
}

export function logSighting(s: Sighting): void {
  // Dedupe: if the same plate was logged within the last 20s, drop it.
  const recent = RING.length ? RING[RING.length - 1] : null;
  const recentSame = RING.slice(-15).find((r) => r.plateHash === s.plateHash && (s.ts - r.ts) < 20_000);
  if (recentSame) return;
  void recent;
  RING.push(s);
  if (RING.length > MAX_SIGHTINGS) RING.splice(0, RING.length - MAX_SIGHTINGS);
  SUBS.forEach((cb) => { try { cb([...RING]); } catch { /* */ } });
}

export function allSightings(): Sighting[] {
  return [...RING];
}

/** Detect co-travel pairs: for every sighting, look at other sightings
 *  within CO_WINDOW_MS of it (excluding self) and count co-occurrences. */
export function detectConvoys(): ConvoyPair[] {
  const pairCounts = new Map<string, ConvoyPair>();
  for (let i = 0; i < RING.length; i++) {
    const a = RING[i];
    for (let j = i + 1; j < RING.length; j++) {
      const b = RING[j];
      const dt = b.ts - a.ts;
      if (dt > CO_WINDOW_MS) break; // ring is chronological
      if (a.plateHash === b.plateHash) continue;
      const [h1, h2, p1, p2] = a.plateHash < b.plateHash
        ? [a.plateHash, b.plateHash, a.plate, b.plate]
        : [b.plateHash, a.plateHash, b.plate, a.plate];
      const key = `${h1}|${h2}`;
      const cur = pairCounts.get(key);
      if (cur) { cur.coOccurrences++; cur.lastTs = Math.max(cur.lastTs, b.ts); }
      else pairCounts.set(key, {
        a: { hash: h1, plate: p1 },
        b: { hash: h2, plate: p2 },
        coOccurrences: 1,
        lastTs: b.ts,
      });
    }
  }
  return [...pairCounts.values()]
    .filter((p) => p.coOccurrences >= CONFIRM_COUNT)
    .sort((a, b) => b.coOccurrences - a.coOccurrences);
}

export function clearSightings(): void {
  RING.length = 0;
  SUBS.forEach((cb) => { try { cb([]); } catch { /* */ } });
}
