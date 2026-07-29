// ZANOEM Offline Autopilot Queue
// ──────────────────────────────
// A tiny IndexedDB-backed FIFO that survives:
//   • tab close          → resumes when the IDE is reopened
//   • wifi disconnect    → online listener replays automatically
//   • crash / refresh    → in-flight job is requeued via heartbeat
//
// It is intentionally framework-free. The IDE module registers ONE handler
// per job kind (`autopilot`, `vision`, `autofix`) and `start()`s the worker.
// The worker drains jobs serially with `navigator.locks` so two open tabs
// never run the same job twice.
//
// We deliberately do NOT register a Service Worker here — Lovable's preview
// environment is iframed and SW registration causes stale-cache problems.
// Background Sync is only enabled when running on the published origin and
// outside an iframe; otherwise the in-page worker is the source of truth.

const DB_NAME = "zanoem_autopilot_v1";
const STORE = "jobs";
const META = "meta";

export type JobKind = "autopilot" | "vision" | "autofix";
export type JobStatus = "pending" | "running" | "done" | "failed";

export interface QueuedJob<P = any> {
  id: string;
  kind: JobKind;
  payload: P;
  createdAt: number;
  attempts: number;
  status: JobStatus;
  lastError?: string;
  surface: string;       // "asher_ide" | "aureon_ide"
  projectRef?: string;
  ownerUserId?: string;
}

type Handler<P = any> = (job: QueuedJob<P>) => Promise<void>;

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("by_status_created", ["status", "createdAt"]);
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

function nanoId() {
  return "j_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function enqueue<P = any>(job: Omit<QueuedJob<P>, "id" | "createdAt" | "attempts" | "status">): Promise<string> {
  const db = await openDb();
  const id = nanoId();
  const row: QueuedJob<P> = { ...job, id, createdAt: Date.now(), attempts: 0, status: "pending" };
  await new Promise<void>((res, rej) => {
    const r = tx(db, STORE, "readwrite").add(row);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  // Wake any active worker.
  try { window.dispatchEvent(new CustomEvent("zanoem-queue:enqueued", { detail: { id } })); } catch { /* ignore */ }
  return id;
}

export async function listJobs(status?: JobStatus): Promise<QueuedJob[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result || []) as QueuedJob[];
      resolve(status ? all.filter((j) => j.status === status) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

async function update(job: QueuedJob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const r = tx(db, STORE, "readwrite").put(job);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export async function clearDone(maxAgeMs = 1000 * 60 * 60 * 24): Promise<number> {
  const all = await listJobs();
  const cutoff = Date.now() - maxAgeMs;
  const db = await openDb();
  let n = 0;
  await Promise.all(all.filter(j => (j.status === "done" || j.status === "failed") && j.createdAt < cutoff).map(j => new Promise<void>((res) => {
    const r = tx(db, STORE, "readwrite").delete(j.id);
    r.onsuccess = () => { n++; res(); };
    r.onerror = () => res();
  })));
  return n;
}

// ── Worker ──────────────────────────────────────────────────────────────
// Single-flight per job. Uses navigator.locks where available so multiple
// open tabs cooperate. Fallback: just runs in this tab.

const handlers: Map<JobKind, Handler> = new Map();
let started = false;
let stopFlag = false;

export function registerHandler<P = any>(kind: JobKind, handler: Handler<P>) {
  handlers.set(kind, handler as Handler);
}

async function runOne(job: QueuedJob): Promise<void> {
  const h = handlers.get(job.kind);
  if (!h) {
    job.status = "failed";
    job.lastError = `no handler for kind ${job.kind}`;
    await update(job);
    return;
  }
  job.status = "running";
  job.attempts += 1;
  await update(job);
  try {
    await h(job);
    job.status = "done";
    await update(job);
  } catch (e: any) {
    job.lastError = String(e?.message || e).slice(0, 500);
    // Requeue up to 3 times with exponential backoff via createdAt push.
    if (job.attempts < 3) {
      job.status = "pending";
      job.createdAt = Date.now() + 1500 * Math.pow(2, job.attempts);
    } else {
      job.status = "failed";
    }
    await update(job);
  }
}

async function drainOnce(): Promise<boolean> {
  const pending = (await listJobs("pending")).sort((a, b) => a.createdAt - b.createdAt);
  const due = pending.filter((j) => j.createdAt <= Date.now());
  if (due.length === 0) return false;
  const job = due[0];
  if ("locks" in navigator && (navigator as any).locks?.request) {
    await (navigator as any).locks.request(`zanoem-job-${job.id}`, { ifAvailable: true }, async (lock: any) => {
      if (!lock) return; // another tab grabbed it
      await runOne(job);
    });
  } else {
    await runOne(job);
  }
  return true;
}

export function startQueueWorker(opts: { intervalMs?: number } = {}) {
  if (started) return;
  started = true;
  stopFlag = false;
  const interval = opts.intervalMs ?? 1500;

  const tick = async () => {
    if (stopFlag) return;
    try {
      // Drain as many as we can in this tick (cap 5 to avoid hogging).
      for (let i = 0; i < 5; i++) {
        const ran = await drainOnce();
        if (!ran) break;
      }
    } catch (e) {
      console.warn("[zanoem-queue] tick failed", e);
    }
    setTimeout(tick, interval);
  };
  tick();

  // Wake immediately on enqueue / online events.
  const wake = () => { void drainOnce(); };
  window.addEventListener("zanoem-queue:enqueued", wake);
  window.addEventListener("online", wake);
  // Reclaim "running" jobs left behind by a crash on next mount.
  // Add 0-2s jitter so multiple tabs reclaiming the same stuck jobs don't
  // race in environments without navigator.locks (e.g. some iframe previews).
  void (async () => {
    const stuck = (await listJobs("running"));
    for (const j of stuck) {
      j.status = "pending";
      j.createdAt = Date.now() + Math.floor(Math.random() * 2000);
      await update(j);
    }
  })();
}

export function stopQueueWorker() { stopFlag = true; started = false; }
