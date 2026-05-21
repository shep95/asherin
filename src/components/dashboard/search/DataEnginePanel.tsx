import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, Upload, Loader2, Search, Trash2, FileText, FileJson, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { listDocs, saveDoc, deleteDoc, clearAll, extractText, searchAll, type DataDoc, type SearchHit } from "@/lib/dataEngine/store";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB per file
const ACCEPTED = ".csv,.json,.txt,.md,.log,.tsv,.xml,.yaml,.yml,.sql,application/json,text/csv,text/plain,text/markdown";

const iconFor = (mime: string, name: string) => {
  const n = name.toLowerCase();
  if (n.endsWith(".csv") || n.endsWith(".tsv")) return <FileSpreadsheet className="h-3.5 w-3.5" />;
  if (n.endsWith(".json")) return <FileJson className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
};

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const highlight = (text: string, query: string) => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-accent/30 text-accent rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>
  );
};

const DataEnginePanel = () => {
  const [docs, setDocs] = useState<DataDoc[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setDocs(await listDocs());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const totalSize = useMemo(() => docs.reduce((s, d) => s + d.size, 0), [docs]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          setError(`"${file.name}" is larger than 25MB and was skipped.`);
          continue;
        }
        const { text, rows } = await extractText(file);
        const doc: DataDoc = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          mime: file.type || "text/plain",
          size: file.size,
          uploadedAt: Date.now(),
          text,
          rows,
        };
        await saveDoc(doc);
      }
      await refresh();
      if (query.trim()) runSearch(query);
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [refresh, query]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setHits([]); return; }
    setSearching(true);
    try {
      setHits(await searchAll(q));
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search-as-you-type
  useEffect(() => {
    const id = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(id);
  }, [query, runSearch]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeDoc = async (id: string) => {
    await deleteDoc(id); await refresh(); if (query.trim()) runSearch(query);
  };

  const wipeAll = async () => {
    if (!confirm("Delete every document from your DataEngine? This cannot be undone.")) return;
    await clearAll(); await refresh(); setHits([]);
  };

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Database className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">DataEngine — Your Personal Search Engine</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Drop CSV, JSON, TXT, MD, LOG, TSV, XML, YAML, SQL files. Everything stays on <strong className="text-foreground/80">your device</strong> (IndexedDB) — nothing is uploaded.
            Search across all of your documents at once.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl px-4 py-3 flex items-center gap-3 focus-within:border-accent/40 transition-colors">
        <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={docs.length === 0 ? "Upload data below first…" : `Search across ${docs.length} document${docs.length === 1 ? "" : "s"}…`}
          className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          disabled={docs.length === 0}
        />
        {query && (
          <button onClick={() => setQuery("")} className="p-1 text-muted-foreground/50 hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all px-6 py-8 flex flex-col items-center gap-2 ${
          dragOver ? "border-accent/60 bg-accent/10" : "border-border/30 bg-card/20 hover:border-border/50 hover:bg-card/30"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground/60" />
        )}
        <p className="text-[11px] font-light text-foreground/80">
          {uploading ? "Indexing…" : "Drop files or click to upload"}
        </p>
        <p className="text-[10px] font-extralight text-muted-foreground/60">
          CSV · JSON · TXT · MD · LOG · TSV · XML · YAML · SQL — up to 25MB each
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] font-light text-amber-200">{error}</p>
        </div>
      )}

      {/* Search results */}
      {query.trim() && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
              {hits.length} match{hits.length === 1 ? "" : "es"}
            </p>
          </div>
          {hits.length === 0 && !searching && (
            <div className="rounded-xl border border-border/20 bg-card/20 px-4 py-6 text-center">
              <p className="text-[11px] font-light text-muted-foreground">No matches across your uploaded data.</p>
            </div>
          )}
          {hits.map((h) => (
            <div key={h.doc.id} className="rounded-xl border border-border/20 bg-card/30 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-accent/80">{iconFor(h.doc.mime, h.doc.name)}</span>
                <p className="text-[12px] font-light text-foreground truncate flex-1">{h.doc.name}</p>
                <span className="text-[9px] uppercase tracking-wider text-accent/70 shrink-0">score {h.score}</span>
              </div>
              <div className="space-y-1">
                {h.snippets.map((s, i) => (
                  <div key={i} className="flex gap-2 text-[11px] font-light leading-relaxed">
                    {s.line && <span className="text-muted-foreground/40 shrink-0 font-mono">L{s.line}</span>}
                    <span className="text-foreground/85">{highlight(s.text, query)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document library */}
      {docs.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
              Library — {docs.length} doc{docs.length === 1 ? "" : "s"} · {fmtBytes(totalSize)}
            </p>
            <button
              onClick={wipeAll}
              className="text-[10px] text-muted-foreground/50 hover:text-amber-400 transition-colors inline-flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Wipe all
            </button>
          </div>
          <div className="space-y-1.5">
            {docs.map((d) => (
              <div key={d.id} className="rounded-lg border border-border/15 bg-card/20 px-3 py-2 flex items-center gap-3">
                <span className="text-muted-foreground/70">{iconFor(d.mime, d.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-light text-foreground truncate">{d.name}</p>
                  <p className="text-[9px] text-muted-foreground/50">
                    {fmtBytes(d.size)} · {new Date(d.uploadedAt).toLocaleString()}
                    {d.rows && ` · ${d.rows.length} rows`}
                  </p>
                </div>
                <button
                  onClick={() => removeDoc(d.id)}
                  className="p-1 text-muted-foreground/40 hover:text-amber-400 transition-colors"
                  title="Remove from library"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataEnginePanel;
