// Zaxin Falcon — Identity sighting ring + driver↔vehicle linker
// ---------------------------------------------------------------
// A parallel ring buffer for identity captures (vs. the plate ring in
// sightings.ts). Every identity capture is temporally correlated to the
// nearest plate sighting within LINK_WINDOW_MS — this is the "driver of
// vehicle" graph that makes Falcon > standalone ALPR.
//
// Plaintext PII lives only in this in-memory ring. Persistence is by hash.

import { allSightings, type Sighting } from "../sightings";

export interface IdSighting {
  idHash: string;                  // SHA-256(licenseNumber+dob) or MRZ doc#+dob
  fullName?: string;               // plaintext, in-memory only
  dob?: string;
  documentNumber?: string;         // plaintext, in-memory only
  jurisdiction?: string;
  ts: number;
  verifyStatus?: "clean" | "review" | "tamper_suspected";
  verifyScore?: number;
  source: "pdf417" | "mrz" | "ocr";
  linkedPlateSightingTs?: number;  // ts of the closest vehicle sighting
  linkedPlate?: string;            // plaintext
}

const MAX = 500;
const LINK_WINDOW_MS = 30_000;

const RING: IdSighting[] = [];
const SUBS = new Set<(all: IdSighting[]) => void>();

export function subscribeIdSightings(cb: (all: IdSighting[]) => void): () => void {
  SUBS.add(cb);
  cb([...RING]);
  return () => { SUBS.delete(cb); };
}

function nearestPlate(ts: number): Sighting | null {
  const all = allSightings();
  let best: Sighting | null = null;
  let bestDt = Infinity;
  for (const s of all) {
    const dt = Math.abs(s.ts - ts);
    if (dt < bestDt && dt <= LINK_WINDOW_MS) { best = s; bestDt = dt; }
  }
  return best;
}

export function logIdSighting(input: Omit<IdSighting, "linkedPlateSightingTs" | "linkedPlate">): IdSighting {
  // Dedupe: same idHash within 15s = skip
  const recent = RING.slice(-5).find((r) => r.idHash === input.idHash && (input.ts - r.ts) < 15_000);
  if (recent) return recent;

  const near = nearestPlate(input.ts);
  const rec: IdSighting = {
    ...input,
    linkedPlateSightingTs: near?.ts,
    linkedPlate: near?.plate,
  };
  RING.push(rec);
  if (RING.length > MAX) RING.splice(0, RING.length - MAX);
  SUBS.forEach((cb) => { try { cb([...RING]); } catch { /* */ } });
  return rec;
}

export function allIdSightings(): IdSighting[] {
  return [...RING];
}

export function clearIdSightings(): void {
  RING.length = 0;
  SUBS.forEach((cb) => { try { cb([]); } catch { /* */ } });
}
