import { useState, useMemo, useEffect } from "react";
import { Globe, Loader2, Search, ExternalLink, Filter, Download, Package, FileArchive, Eye, X, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


const MAX_ZIP_URLS = 250;

const fmtBytes = (n: number) => {
  if (!n || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
};

interface Estimate {
  scanned: number; ok: number; failed: number; unknownSize: number;
  totalBytes: number;
  byType: Record<string, { count: number; bytes: number }>;
  capped: boolean;
}

interface Category { category: string; count: number; urls: string[]; }
interface MapResult {
  domain: string;
  origin: string;
  totalUnique: number;
  sources: { source: string; found: number }[];
  categories: Category[];
  truncated?: boolean;
}

interface HarvestResult {
  domain: string;
  origin: string;
  pagesCrawled: number;
  totalDocs: number;
  truncated: boolean;
  maxPages: number;
  maxDepth: number;
  extTally: Record<string, number>;
  categories: Record<string, { ext: string; count: number; urls: string[] }[]>;
  allDocs: string[];
}

const DomainMapPanel = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MapResult | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipMsg, setZipMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blobUrl?: string; contentType?: string; loading: boolean; error?: string; textSnippet?: string } | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvest, setHarvest] = useState<HarvestResult | null>(null);
  const [harvestErr, setHarvestErr] = useState<string | null>(null);
  const [activeHarvestCat, setActiveHarvestCat] = useState<string | null>(null);
  const [activeExt, setActiveExt] = useState<string | null>(null);

  const runHarvest = async () => {
    if (!result) return;
    setHarvesting(true); setHarvestErr(null); setHarvest(null);
    setActiveHarvestCat(null); setActiveExt(null);
    try {
      // Use the top ~120 mapped URLs as seeds so the crawler starts from
      // every major path category, not just the homepage.
      const seedUrls = result.categories.flatMap((c) => c.urls.slice(0, 12)).slice(0, 120);
      const { data, error: invErr } = await supabase.functions.invoke("domain-harvest", {
        body: { domain: result.domain, seedUrls },
      });
      if (invErr) throw new Error(invErr.message || String(invErr));
      if (!data?.success) throw new Error(data?.error || "Harvest failed");
      const h = data as HarvestResult;
      setHarvest(h);
      const firstCat = Object.keys(h.categories)[0] || null;
      setActiveHarvestCat(firstCat);
    } catch (err: any) {
      setHarvestErr(err?.message || "Harvest failed");
    } finally { setHarvesting(false); }
  };


  // Load file when preview opens
  useEffect(() => {
    if (!preview || preview.blobUrl || preview.error) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const auth = sessionData?.session?.access_token;
        const res = await fetch(`https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/domain-zip`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3hnenFidHJycmJ0amNlbWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzIyNTQsImV4cCI6MjA4NjY0ODI1NH0.PXItSIWoCByiMjDObhyc8QryuH2wNwMAIFyzWXzYJac",
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          },
          body: JSON.stringify({ mode: "fetch", url: preview.url }),
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
          throw new Error(msg);
        }
        const ct = res.headers.get("content-type") || "application/octet-stream";
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        let textSnippet: string | undefined;
        if (/^text\/|application\/json|application\/xml/i.test(ct)) {
          textSnippet = (await blob.text()).slice(0, 20000);
        }
        setPreview((p) => p && p.url === preview.url ? { ...p, blobUrl: createdUrl!, contentType: ct, loading: false, textSnippet } : p);
      } catch (err: any) {
        if (!cancelled) setPreview((p) => p && p.url === preview.url ? { ...p, loading: false, error: err?.message || "Preview failed" } : p);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [preview?.url]);


  const runEstimate = async (urls: string[]) => {
    setEstimating(true); setEstimate(null); setZipMsg(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("domain-zip", {
        body: { mode: "estimate", urls: urls.slice(0, MAX_ZIP_URLS) },
      });
      if (invErr) throw new Error(invErr.message || String(invErr));
      if (!data?.success) throw new Error(data?.error || "Estimate failed");
      setEstimate(data as Estimate);
    } catch (err: any) {
      setZipMsg(err?.message || "Failed to estimate");
    } finally { setEstimating(false); }
  };

  const downloadZip = async (urls: string[]) => {
    setZipping(true); setZipMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const auth = sessionData?.session?.access_token;
      const url = `https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/domain-zip`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3hnenFidHJycmJ0amNlbWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzIyNTQsImV4cCI6MjA4NjY0ODI1NH0.PXItSIWoCByiMjDObhyc8QryuH2wNwMAIFyzWXzYJac",
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        body: JSON.stringify({
          mode: "download",
          urls: urls.slice(0, MAX_ZIP_URLS),
          zipName: `${result?.domain || "domain"}-bundle.zip`,
        }),
      });
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const dl = document.createElement("a");
      dl.href = URL.createObjectURL(blob);
      dl.download = `${result?.domain || "domain"}-bundle.zip`;
      document.body.appendChild(dl); dl.click(); dl.remove();
      setTimeout(() => URL.revokeObjectURL(dl.href), 4000);
      setZipMsg(`Downloaded ${fmtBytes(blob.size)} — ${res.headers.get("X-Aureon-Files") || "?"} files.`);
    } catch (err: any) {
      setZipMsg(err?.message || "Download failed");
    } finally { setZipping(false); }
  };

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const d = input.trim();
    if (!d) return;
    setLoading(true); setError(null); setResult(null); setActiveCat(null); setFilter("");
    try {
      const { data, error: invErr } = await supabase.functions.invoke("domain-map", {
        body: { domain: d },
      });
      if (invErr) throw new Error(invErr.message || String(invErr));
      if (!data?.success) throw new Error(data?.error || "Map failed");
      setResult(data as MapResult);
      setActiveCat((data as MapResult).categories[0]?.category ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to map domain");
    } finally { setLoading(false); }
  };

  const currentUrls = useMemo(() => {
    let list: string[] = [];
    if (harvest) {
      if (activeHarvestCat && activeExt) {
        const grp = harvest.categories[activeHarvestCat]?.find((g) => g.ext === activeExt);
        list = grp?.urls ?? [];
      } else if (activeHarvestCat) {
        list = (harvest.categories[activeHarvestCat] || []).flatMap((g) => g.urls);
      } else {
        list = harvest.allDocs;
      }
    } else if (result) {
      const cat = result.categories.find((c) => c.category === activeCat);
      list = cat ? cat.urls : result.categories.flatMap((c) => c.urls);
    }
    if (!filter.trim()) return list;
    const f = filter.toLowerCase();
    return list.filter((u) => u.toLowerCase().includes(f));
  }, [result, activeCat, filter, harvest, activeHarvestCat, activeExt]);


  return (
    <div className="rounded-2xl border border-border/20 bg-gradient-to-br from-card/40 via-card/20 to-card/10 backdrop-blur-xl px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-foreground/[0.04] border border-border/30 flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-foreground/80" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-light tracking-wide text-foreground">Domain URL Mapper</h2>
          <p className="text-[10px] font-extralight text-muted-foreground/70">
            Enter a root domain — get every URL on it, grouped by path type (e.g. <span className="text-foreground/80">/document/</span>, <span className="text-foreground/80">/user/</span>, <span className="text-foreground/80">/book/</span>).
          </p>
        </div>
      </div>

      <form onSubmit={run} className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 px-3 py-2 focus-within:border-foreground/40 transition-colors">
        <Globe className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          placeholder="scribd.com or https://www.scribd.com/"
          className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/15 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-medium tracking-wide text-foreground transition-colors"
        >
          {loading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />MAPPING</>) : (<><Search className="h-3.5 w-3.5" />MAP DOMAIN</>)}
        </button>
      </form>

      {error && <p className="text-[10px] font-light text-red-400/80">{error}</p>}

      {result && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-extralight tracking-wider text-muted-foreground/70 uppercase">
            <span className="text-foreground/80">{result.domain}</span>
            <span>•</span>
            <span>{result.totalUnique.toLocaleString()} unique URLs</span>
            <span>•</span>
            <span>{result.categories.length} categories</span>
            {result.truncated && <span className="text-amber-300/80">• truncated</span>}
            <span className="ml-auto flex gap-2">
              {result.sources.map((s) => (
                <span key={s.source} className="rounded border border-border/30 px-1.5 py-0.5">
                  {s.source}: {s.found}
                </span>
              ))}
            </span>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCat(null)}
              className={`px-2 py-1 rounded-md text-[10px] font-light tracking-wide border transition ${
                activeCat === null
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/40 bg-background/40 text-foreground/70 hover:border-foreground/60"
              }`}
            >
              ALL · {result.totalUnique}
            </button>
            {result.categories.map((c) => (
              <button
                key={c.category}
                onClick={() => setActiveCat(c.category)}
                className={`px-2 py-1 rounded-md text-[10px] font-light tracking-wide border transition ${
                  activeCat === c.category
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/40 bg-background/40 text-foreground/70 hover:border-foreground/60"
                }`}
              >
                /{c.category} · {c.count}
              </button>
            ))}
          </div>

          {/* Substring filter */}
          <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 px-3 py-1.5">
            <Filter className="h-3 w-3 text-muted-foreground/50" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter URLs (e.g. 886522804, quantum, .pdf)…"
              className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>

          {/* ZIP download toolbar */}
          <div className="rounded-xl border border-border/30 bg-background/40 px-3 py-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <FileArchive className="h-3.5 w-3.5 text-foreground/70" />
              <span className="text-[10px] font-light tracking-[0.2em] uppercase text-foreground/80">
                Bundle as ZIP
              </span>
              <span className="text-[10px] font-light text-muted-foreground/60">
                {Math.min(currentUrls.length, MAX_ZIP_URLS)} of {currentUrls.length} files
                {currentUrls.length > MAX_ZIP_URLS && <span className="text-amber-300/80"> (capped at {MAX_ZIP_URLS})</span>}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => runEstimate(currentUrls)}
                  disabled={estimating || zipping || currentUrls.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-background/40 hover:border-foreground/60 disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1 text-[10px] font-light tracking-wide text-foreground/80 transition"
                >
                  {estimating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
                  ESTIMATE SIZE
                </button>
                <button
                  onClick={() => downloadZip(currentUrls)}
                  disabled={zipping || estimating || currentUrls.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1 text-[10px] font-medium tracking-wide text-background transition"
                >
                  {zipping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  {zipping ? "BUILDING ZIP…" : "DOWNLOAD ZIP"}
                </button>
              </div>
            </div>

            {estimate && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-light text-muted-foreground/80">
                  <span className="text-foreground/90">~{fmtBytes(estimate.totalBytes)}</span> estimated total
                  <span>•</span>
                  <span>{estimate.ok} reachable</span>
                  <span>•</span>
                  <span className="text-red-300/80">{estimate.failed} failed</span>
                  {estimate.unknownSize > 0 && (<><span>•</span><span className="text-amber-300/80">{estimate.unknownSize} unknown size</span></>)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(estimate.byType)
                    .sort((a, b) => b[1].bytes - a[1].bytes)
                    .map(([ext, v]) => (
                      <span key={ext} className="rounded border border-border/30 bg-background/40 px-1.5 py-0.5 text-[10px] font-light text-foreground/80">
                        .{ext} <span className="text-muted-foreground/70">· {v.count} · {fmtBytes(v.bytes)}</span>
                      </span>
                    ))}
                </div>
              </div>
            )}

            {zipMsg && (
              <p className={`text-[10px] font-light ${zipMsg.toLowerCase().includes("fail") || zipMsg.toLowerCase().includes("error") ? "text-red-400/80" : "text-emerald-300/80"}`}>
                {zipMsg}
              </p>
            )}
          </div>

          {/* URL list */}
          <div className="rounded-xl border border-border/20 bg-background/30 divide-y divide-border/10 max-h-[420px] overflow-y-auto">
            {currentUrls.slice(0, 800).map((u) => (
              <div
                key={u}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-light text-foreground/85 hover:bg-foreground/[0.04] transition group"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <a href={u} target="_blank" rel="noopener noreferrer" className="truncate flex-1 hover:underline">{u}</a>
                <button
                  type="button"
                  onClick={() => setPreview({ url: u, loading: true })}
                  className="opacity-60 group-hover:opacity-100 inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 hover:border-foreground/60 px-2 py-0.5 text-[10px] font-light tracking-wide text-foreground/80 transition shrink-0"
                  title="Preview document"
                >
                  <Eye className="h-3 w-3" />
                  PREVIEW
                </button>
              </div>
            ))}
            {currentUrls.length === 0 && (
              <div className="px-3 py-6 text-center text-[11px] font-light text-muted-foreground/60">No URLs match.</div>
            )}
            {currentUrls.length > 800 && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/50 text-center">…showing first 800 of {currentUrls.length}</div>
            )}
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative w-full max-w-5xl h-[85vh] rounded-2xl border border-border/30 bg-card/95 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
              <Eye className="h-4 w-4 text-foreground/70 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/70">Document Preview</p>
                <p className="text-[11px] font-light text-foreground/90 truncate">{preview.url}</p>
              </div>
              {preview.contentType && (
                <span className="text-[10px] font-light text-muted-foreground/70 hidden sm:inline">{preview.contentType.split(";")[0]}</span>
              )}
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 hover:border-foreground/60 px-2 py-1 text-[10px] font-light text-foreground/80 transition"
              >
                <ExternalLink className="h-3 w-3" /> OPEN
              </a>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-md border border-border/40 bg-background/60 hover:border-foreground/60 p-1 text-foreground/80 transition"
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-background/40 overflow-auto">
              {preview.loading && !preview.blobUrl && !preview.error && (
                <div className="h-full flex items-center justify-center text-[11px] font-light text-muted-foreground/70">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Fetching document…
                </div>
              )}
              {preview.error && (
                <div className="h-full flex items-center justify-center px-6 text-center text-[11px] font-light text-red-400/80">
                  {preview.error}
                </div>
              )}
              {preview.blobUrl && preview.contentType && (() => {
                const ct = preview.contentType.toLowerCase();
                if (ct.startsWith("image/")) {
                  return <img src={preview.blobUrl} alt="Preview" className="max-w-full max-h-full mx-auto block" />;
                }
                if (ct.includes("pdf") || ct.startsWith("text/html")) {
                  return <iframe src={preview.blobUrl} title="Preview" className="w-full h-full border-0 bg-white" />;
                }
                if (preview.textSnippet !== undefined) {
                  return (
                    <pre className="p-4 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground/85">
                      {preview.textSnippet}
                    </pre>
                  );
                }
                return (
                  <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-[11px] font-light text-muted-foreground/80">
                      Inline preview not supported for <span className="text-foreground/90">{ct}</span> — download to view.
                    </p>
                    <a
                      href={preview.blobUrl}
                      download
                      className="inline-flex items-center gap-1.5 rounded-md bg-foreground hover:bg-foreground/90 px-3 py-1.5 text-[10px] font-medium tracking-wide text-background transition"
                    >
                      <Download className="h-3 w-3" /> DOWNLOAD FILE
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainMapPanel;
