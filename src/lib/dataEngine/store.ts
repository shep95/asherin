// DataEngine — client-side personal data search engine.
// All documents are stored in IndexedDB on the user's device. Nothing is uploaded to the server.

const DB_NAME = "zophiel_dataengine";
const STORE = "documents";
const DB_VERSION = 1;

export interface DataDoc {
  id: string;
  name: string;
  mime: string;
  size: number;
  uploadedAt: number;
  // Raw text content extracted from the file (the searchable corpus).
  text: string;
  // Optional source rows for CSV/JSON for structured display.
  rows?: Record<string, string>[];
}

export interface SearchHit {
  doc: DataDoc;
  score: number;
  // Highlighted snippets around the match.
  snippets: { text: string; line?: number }[];
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listDocs(): Promise<DataDoc[]> {
  const all = await tx<DataDoc[]>("readonly", (s) => s.getAll() as IDBRequest<DataDoc[]>);
  return (all || []).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function saveDoc(doc: DataDoc): Promise<void> {
  await tx("readwrite", (s) => s.put(doc));
}

export async function deleteDoc(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearAll(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}

// ---------- Extraction ----------

export async function extractText(file: File): Promise<{ text: string; rows?: Record<string, string>[] }> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  const isJson = name.endsWith(".json") || file.type === "application/json";

  const raw = await file.text();

  if (isCsv) {
    const rows = parseCsv(raw);
    const text = rows.map((r) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" | ")).join("\n");
    return { text, rows };
  }
  if (isJson) {
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const rows: Record<string, string>[] = arr.map((o) => flatten(o));
      const text = rows.map((r) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" | ")).join("\n");
      return { text, rows };
    } catch {
      return { text: raw };
    }
  }
  return { text: raw };
}

function flatten(obj: any, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") { out[prefix || "value"] = String(obj); return out; }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else if (Array.isArray(v)) {
      out[key] = v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
    } else {
      out[key] = v === null || v === undefined ? "" : String(v);
    }
  }
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQ = !inQ; cur += ch; continue; }
    if (ch === "\n" && !inQ) { lines.push(cur); cur = ""; continue; }
    if (ch === "\r" && !inQ) continue;
    cur += ch;
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) return [];
  const splitRow = (row: string): string[] => {
    const out: string[] = []; let v = ""; let q = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        if (q && row[i + 1] === '"') { v += '"'; i++; }
        else q = !q;
      } else if (c === "," && !q) { out.push(v); v = ""; }
      else v += c;
    }
    out.push(v);
    return out;
  };
  const headers = splitRow(lines[0]).map((h) => h.trim());
  return lines.slice(1).filter((l) => l.trim().length > 0).map((l) => {
    const cells = splitRow(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h || `col${i}`] = (cells[i] ?? "").trim()));
    return row;
  });
}

// ---------- Search ----------

export async function searchAll(query: string): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const docs = await listDocs();
  const hits: SearchHit[] = [];

  for (const doc of docs) {
    const lowered = doc.text.toLowerCase();
    let score = 0;
    for (const t of terms) {
      const matches = lowered.split(t).length - 1;
      if (matches === 0) { score = 0; break; }
      score += matches;
    }
    if (score === 0) continue;

    // Build snippets: lines containing any of the terms.
    const lines = doc.text.split(/\r?\n/);
    const snippets: { text: string; line?: number }[] = [];
    for (let i = 0; i < lines.length && snippets.length < 5; i++) {
      const lower = lines[i].toLowerCase();
      if (terms.some((t) => lower.includes(t))) {
        snippets.push({ text: lines[i].slice(0, 320), line: i + 1 });
      }
    }
    hits.push({ doc, score, snippets });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits;
}
