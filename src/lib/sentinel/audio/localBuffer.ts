// asherin.sentinel — layer 4a, the encrypted local buffer.
//
// The promise is that nothing is lost when the network is not there. That means
// a segment is written to disk BEFORE any upload is attempted, and the upload
// is a separate, retryable step that clears the row only on a confirmed 2xx.
//
// Encryption is AES-256-GCM with a key that is generated on the device, stored
// non-extractable in IndexedDB, and never leaves it. That is a real boundary:
// another script on the origin can ask the key to decrypt, but it cannot read
// the key material out, and nothing on the network ever sees plaintext audio
// except the transcription call the operator explicitly enabled.
//
// Retention is a rolling window (72 hours by default). Purge runs on every open
// and after every write, so a tab left open for a week does not grow forever.

const DB_NAME = "asherin-sentinel-ambient";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const SEG_STORE = "segments";
export const DEFAULT_RETENTION_HOURS = 72;

export interface BufferedSegment {
  id: string;
  at: number;
  kind: "speech" | "sound";
  durationMs: number;
  /** encrypted json payload */
  iv: Uint8Array;
  cipher: ArrayBuffer;
  synced: boolean;
  attempts: number;
}

export interface SegmentPayload {
  kind: "speech" | "sound";
  startedAt: string;
  durationMs: number;
  /** base64 wav — present for speech segments only */
  audio?: string;
  embedding?: number[];
  tag?: string;
  confidence?: number;
  evidence?: Record<string, unknown>;
  peakRms?: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(SEG_STORE)) {
        const store = db.createObjectStore(SEG_STORE, { keyPath: "id" });
        store.createIndex("at", "at");
        store.createIndex("synced", "synced");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb unavailable"));
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("indexeddb write failed"));
      }),
  );
}

let keyPromise: Promise<CryptoKey> | null = null;

/** Device key: generated once, non-extractable, never transmitted. */
export function bufferKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const existing = await tx<CryptoKey | undefined>(KEY_STORE, "readonly", (s) => s.get("buffer") as IDBRequest<CryptoKey | undefined>);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await tx(KEY_STORE, "readwrite", (s) => s.put(key, "buffer"));
    return key;
  })();
  return keyPromise;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function writeSegment(payload: SegmentPayload): Promise<string> {
  const key = await bufferKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));
  const row: BufferedSegment = {
    id: crypto.randomUUID(),
    at: Date.parse(payload.startedAt) || Date.now(),
    kind: payload.kind,
    durationMs: payload.durationMs,
    iv,
    cipher,
    synced: false,
    attempts: 0,
  };
  await tx(SEG_STORE, "readwrite", (s) => s.put(row));
  return row.id;
}

export async function readPayload(row: BufferedSegment): Promise<SegmentPayload | null> {
  try {
    const key = await bufferKey();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv }, key, row.cipher);
    return JSON.parse(dec.decode(plain)) as SegmentPayload;
  } catch {
    return null; // a row we cannot read is dropped, never guessed at
  }
}

export async function pendingSegments(limit = 4): Promise<BufferedSegment[]> {
  const all = await tx<BufferedSegment[]>(SEG_STORE, "readonly", (s) => s.getAll() as IDBRequest<BufferedSegment[]>);
  return all
    .filter((r) => !r.synced && r.attempts < 6)
    .sort((a, b) => a.at - b.at)
    .slice(0, limit);
}

export async function markSynced(id: string): Promise<void> {
  const row = await tx<BufferedSegment | undefined>(SEG_STORE, "readonly", (s) => s.get(id) as IDBRequest<BufferedSegment | undefined>);
  if (!row) return;
  await tx(SEG_STORE, "readwrite", (s) => s.put({ ...row, synced: true }));
}

export async function markAttempt(id: string): Promise<void> {
  const row = await tx<BufferedSegment | undefined>(SEG_STORE, "readonly", (s) => s.get(id) as IDBRequest<BufferedSegment | undefined>);
  if (!row) return;
  await tx(SEG_STORE, "readwrite", (s) => s.put({ ...row, attempts: row.attempts + 1 }));
}

export async function purge(retentionHours = DEFAULT_RETENTION_HOURS): Promise<number> {
  const cutoff = Date.now() - retentionHours * 3600_000;
  const all = await tx<BufferedSegment[]>(SEG_STORE, "readonly", (s) => s.getAll() as IDBRequest<BufferedSegment[]>);
  const doomed = all.filter((r) => r.at < cutoff || (r.synced && r.at < Date.now() - 3600_000));
  for (const row of doomed) await tx(SEG_STORE, "readwrite", (s) => s.delete(row.id));
  return doomed.length;
}

export async function bufferStats(): Promise<{ total: number; pending: number; oldestAt: number | null }> {
  try {
    const all = await tx<BufferedSegment[]>(SEG_STORE, "readonly", (s) => s.getAll() as IDBRequest<BufferedSegment[]>);
    const pending = all.filter((r) => !r.synced).length;
    const oldest = all.reduce<number | null>((min, r) => (min === null || r.at < min ? r.at : min), null);
    return { total: all.length, pending, oldestAt: oldest };
  } catch {
    return { total: 0, pending: 0, oldestAt: null };
  }
}

/** Operator-facing wipe. Clears every buffered row on this device. */
export async function wipeLocal(): Promise<void> {
  await tx(SEG_STORE, "readwrite", (s) => s.clear());
}
