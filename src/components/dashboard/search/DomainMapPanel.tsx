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

// Parse a free-form input (newlines, commas, spaces) into a unique list
// of domain entries. Each entry preserves the raw URL the user typed so
// the harvester can use it as the priority seed (e.g. /search?query=...).
function parseDomainEntries(raw: string): { entryUrl: string; domain: string }[] {
  const parts = raw.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: { entryUrl: string; domain: string }[] = [];
  for (const p of parts) {
    try {
      const u = new URL(/^https?:\/\//i.test(p) ? p : `https://${p}`);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      const key = u.toString();
      if (!host || seen.has(key)) continue;
      seen.add(key);
      out.push({ entryUrl: u.toString(), domain: host });
    } catch { /* skip invalid */ }
  }
  return out;
}

interface DomainMapPanelProps {
  defaultInput?: string;
  presets?: { label: string; value: string }[];
  title?: string;
  subtitle?: string;
}

const DomainMapPanel = ({ defaultInput = "", presets, title, subtitle }: DomainMapPanelProps = {}) => {
  const [input, setInput] = useState(defaultInput);
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
  // Focus filter intentionally removed — harvest returns every document
  // discovered on the user's exact input domain with no taxonomy gating.
  // Batch tracking — every input line is preserved so harvest can use the
  // exact URL the user typed as the priority seed for each domain.
  const [batchEntries, setBatchEntries] = useState<{ entryUrl: string; domain: string }[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; phase: "map" | "harvest" | null }>({ done: 0, total: 0, phase: null });

  const runHarvest = async () => {
    if (!result || batchEntries.length === 0) return;
    setHarvesting(true); setHarvestErr(null); setHarvest(null);
    setActiveHarvestCat(null); setActiveExt(null);
    setBatchProgress({ done: 0, total: batchEntries.length, phase: "harvest" });
    try {
      // Map each entry's host to seeds derived from THAT domain's mapped URLs.
      const seedsByDomain: Record<string, string[]> = {};
      for (const c of result.categories) {
        for (const u of c.urls) {
          try {
            const h = new URL(u).hostname.replace(/^www\./, "").toLowerCase();
            (seedsByDomain[h] ||= []).push(u);
          } catch { /* ignore */ }
        }
      }
      const docPathPatterns = result.categories.map((c) => c.category);

      // Run all per-domain harvests in parallel (gated to 3 at a time so
      // we don't overwhelm tiny edge-function CPU budgets).
      const merged: HarvestResult = {
        domain: batchEntries.map((b) => b.domain).join(", "),
        origin: "",
        pagesCrawled: 0,
        totalDocs: 0,
        truncated: false,
        maxPages: 0,
        maxDepth: 0,
        extTally: {},
        categories: {},
        allDocs: [],
      };
      const seenDoc = new Set<string>();
      const CONC = 3;
      const queue = [...batchEntries];
      let done = 0;
      async function worker() {
        while (queue.length) {
          const entry = queue.shift();
          if (!entry) break;
          const seeds = (seedsByDomain[entry.domain] || []).slice(0, 80);
          try {
            const { data, error: invErr } = await supabase.functions.invoke("domain-harvest", {
              body: {
                domain: entry.domain,
                entryUrl: entry.entryUrl,
                seedUrls: [entry.entryUrl, ...seeds],
                docPathPatterns,
                maxDepth: 4,
                maxPages: 200,
              },
            });
            if (invErr || !data?.success) throw new Error(invErr?.message || data?.error || "Harvest failed");
            const h = data as HarvestResult;
            merged.pagesCrawled += h.pagesCrawled;
            merged.truncated = merged.truncated || h.truncated;
            merged.maxPages = Math.max(merged.maxPages, h.maxPages);
            merged.maxDepth = Math.max(merged.maxDepth, h.maxDepth);
            for (const [ext, n] of Object.entries(h.extTally || {})) {
              merged.extTally[ext] = (merged.extTally[ext] || 0) + (n as number);
            }
            for (const [cat, groups] of Object.entries(h.categories || {})) {
              merged.categories[cat] ||= [];
              for (const g of groups) {
                let bucket = merged.categories[cat].find((x) => x.ext === g.ext);
                if (!bucket) {
                  bucket = { ext: g.ext, count: 0, urls: [] };
                  merged.categories[cat].push(bucket);
                }
                for (const u of g.urls) {
                  if (seenDoc.has(u)) continue;
                  seenDoc.add(u);
                  bucket.urls.push(u);
                  bucket.count++;
                  merged.totalDocs++;
                  merged.allDocs.push(u);
                }
              }
            }
          } catch (err) {
            console.warn("[harvest]", entry.domain, err);
          } finally {
            done++;
            setBatchProgress({ done, total: batchEntries.length, phase: "harvest" });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, batchEntries.length) }, worker));
      // Sort categories' groups by descending count for nicer chip ordering
      for (const cat of Object.keys(merged.categories)) {
        merged.categories[cat].sort((a, b) => b.count - a.count);
      }
      merged.allDocs.sort();
      setHarvest(merged);
      const firstCat = Object.keys(merged.categories)[0] || null;
      setActiveHarvestCat(firstCat);
    } catch (err: any) {
      setHarvestErr(err?.message || "Harvest failed");
    } finally {
      setHarvesting(false);
      setBatchProgress((p) => ({ ...p, phase: null }));
    }
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
    const entries = parseDomainEntries(input);
    if (entries.length === 0) { setError("Enter at least one domain or URL."); return; }
    setBatchEntries(entries);
    setLoading(true); setError(null); setResult(null); setHarvest(null);
    setActiveCat(null); setFilter("");
    setBatchProgress({ done: 0, total: entries.length, phase: "map" });
    try {
      // Map all domains in parallel (up to 4 at once) and MERGE the
      // results into one combined MapResult so every downstream feature
      // (filter, harvest, ZIP, focus) sees one unified URL pool.
      const merged: MapResult = {
        domain: entries.map((e2) => e2.domain).join(", "),
        origin: "",
        totalUnique: 0,
        sources: [],
        categories: [],
        truncated: false,
      };
      const catMap = new Map<string, { category: string; count: number; urls: string[]; seen: Set<string> }>();
      const sourceMap = new Map<string, number>();
      const errs: string[] = [];

      const CONC = 4;
      const queue = [...entries];
      let done = 0;
      async function worker() {
        while (queue.length) {
          const entry = queue.shift();
          if (!entry) break;
          try {
            const { data, error: invErr } = await supabase.functions.invoke("domain-map", {
              body: { domain: entry.entryUrl },
            });
            if (invErr || !data?.success) throw new Error(invErr?.message || data?.error || "Map failed");
            const m = data as MapResult;
            merged.truncated = merged.truncated || !!m.truncated;
            for (const s of m.sources || []) {
              sourceMap.set(s.source, (sourceMap.get(s.source) || 0) + s.found);
            }
            for (const c of m.categories || []) {
              let bucket = catMap.get(c.category);
              if (!bucket) {
                bucket = { category: c.category, count: 0, urls: [], seen: new Set() };
                catMap.set(c.category, bucket);
              }
              for (const u of c.urls) {
                if (bucket.seen.has(u)) continue;
                bucket.seen.add(u);
                bucket.urls.push(u);
                bucket.count++;
              }
            }
          } catch (err: any) {
            errs.push(`${entry.domain}: ${err?.message || err}`);
          } finally {
            done++;
            setBatchProgress({ done, total: entries.length, phase: "map" });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, entries.length) }, worker));

      merged.categories = [...catMap.values()]
        .map(({ seen: _seen, ...rest }) => rest)
        .sort((a, b) => b.count - a.count);
      merged.totalUnique = merged.categories.reduce((s, c) => s + c.count, 0);
      merged.sources = [...sourceMap.entries()].map(([source, found]) => ({ source, found }));

      if (merged.totalUnique === 0 && errs.length) {
        throw new Error(errs.join(" • "));
      }
      setResult(merged);
      setActiveCat(merged.categories[0]?.category ?? null);
      if (errs.length) setError(`Some domains failed: ${errs.slice(0, 3).join(" • ")}`);
    } catch (err: any) {
      setError(err?.message || "Failed to map domain");
    } finally {
      setLoading(false);
      setBatchProgress((p) => ({ ...p, phase: null }));
    }
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
          <h2 className="text-sm font-light tracking-wide text-foreground">{title ?? "Domain URL Mapper"}</h2>
          <p className="text-[10px] font-extralight text-muted-foreground/70">
            {subtitle ?? "Enter one or many domains / URLs — one per line or comma-separated — and every match is mapped and harvested in a single batch."}
          </p>
        </div>
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={loading}
              onClick={() => { setInput(p.value); setError(null); }}
              className="text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded border border-border/25 hover:border-foreground/50 hover:bg-foreground/5 transition disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={run} className="rounded-xl border border-border/30 bg-background/40 px-3 py-2 focus-within:border-foreground/40 transition-colors space-y-2">
        <div className="flex items-start gap-2">
          <Globe className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            placeholder={"scribd.com\nhttps://www.scribd.com/search?query=military\narxiv.org\nissuu.com"}
            rows={Math.min(8, Math.max(2, input.split(/\n/).length))}
            className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none resize-y min-h-[44px]"
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between gap-2 pl-6">
          <span className="text-[10px] font-extralight text-muted-foreground/60">
            {(() => {
              const n = parseDomainEntries(input).length;
              return n === 0 ? "No domains detected yet." : `${n} domain${n === 1 ? "" : "s"} queued.`;
            })()}
          </span>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/15 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-medium tracking-wide text-foreground transition-colors"
          >
            {loading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />MAPPING</>) : (<><Search className="h-3.5 w-3.5" />MAP BATCH</>)}
          </button>
        </div>
      </form>

      {batchProgress.phase && batchProgress.total > 0 && (
        <div className="rounded-lg border border-border/20 bg-background/40 px-3 py-1.5 flex items-center gap-2 text-[10px] font-light text-muted-foreground/80">
          <Loader2 className="h-3 w-3 animate-spin text-foreground/70" />
          <span className="uppercase tracking-[0.2em] text-foreground/80">{batchProgress.phase}</span>
          <span>{batchProgress.done} / {batchProgress.total}</span>
          <div className="ml-auto flex-1 max-w-[40%] h-1 rounded bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-foreground/70 transition-all"
              style={{ width: `${Math.round((batchProgress.done / Math.max(1, batchProgress.total)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-[10px] font-light text-red-400/80">{error}</p>}

      {/* Knowledge Focus Filter removed — harvester now returns every
          document found on the user's exact input domain. */}



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

          {/* ── DOCUMENT HARVEST ─────────────────────────────────────── */}
          <div className="rounded-xl border border-border/30 bg-background/40 px-3 py-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
              <span className="text-[10px] font-light tracking-[0.2em] uppercase text-foreground/80">
                Harvest Documents
              </span>
              <span className="text-[10px] font-light text-muted-foreground/60">
                Deep-crawl sub-pages and pull every PDF / Word / Excel / eBook link.
              </span>
              <button
                onClick={runHarvest}
                disabled={harvesting || !result}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-foreground hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1 text-[10px] font-medium tracking-wide text-background transition"
              >
                {harvesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                {harvesting ? "HARVESTING…" : harvest ? "RE-HARVEST" : "HARVEST DOCS"}
              </button>
            </div>

            {harvestErr && <p className="text-[10px] font-light text-red-400/80">{harvestErr}</p>}

            {harvest && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-extralight tracking-wider text-muted-foreground/70 uppercase">
                  <span className="text-foreground/90">{harvest.totalDocs.toLocaleString()} documents</span>
                  <span>•</span>
                  <span>{harvest.pagesCrawled} pages crawled</span>
                  <span>•</span>
                  <span>{Object.keys(harvest.categories).length} categories</span>
                  {harvest.truncated && <span className="text-amber-300/80">• truncated</span>}
                </div>

                {/* Category chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setActiveHarvestCat(null); setActiveExt(null); }}
                    className={`px-2 py-1 rounded-md text-[10px] font-light tracking-wide border transition ${
                      activeHarvestCat === null
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/40 bg-background/40 text-foreground/70 hover:border-foreground/60"
                    }`}
                  >
                    ALL · {harvest.totalDocs}
                  </button>
                  {Object.entries(harvest.categories).map(([cat, groups]) => {
                    const count = groups.reduce((s, g) => s + g.count, 0);
                    return (
                      <button
                        key={cat}
                        onClick={() => { setActiveHarvestCat(cat); setActiveExt(null); }}
                        className={`px-2 py-1 rounded-md text-[10px] font-light tracking-wide border transition ${
                          activeHarvestCat === cat
                            ? "border-foreground bg-foreground text-background"
                            : "border-border/40 bg-background/40 text-foreground/70 hover:border-foreground/60"
                        }`}
                      >
                        {cat} · {count}
                      </button>
                    );
                  })}
                </div>

                {/* Extension chips within active category */}
                {activeHarvestCat && (harvest.categories[activeHarvestCat] || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setActiveExt(null)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-light border transition ${
                        activeExt === null
                          ? "border-foreground/80 bg-foreground/15 text-foreground"
                          : "border-border/30 bg-background/40 text-muted-foreground/80 hover:border-foreground/40"
                      }`}
                    >
                      all
                    </button>
                    {harvest.categories[activeHarvestCat].map((g) => (
                      <button
                        key={g.ext}
                        onClick={() => setActiveExt(g.ext)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-light border transition ${
                          activeExt === g.ext
                            ? "border-foreground/80 bg-foreground/15 text-foreground"
                            : "border-border/30 bg-background/40 text-muted-foreground/80 hover:border-foreground/40"
                        }`}
                      >
                        .{g.ext} · {g.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
