import { useState, useMemo } from "react";
import { Globe, Loader2, Search, ExternalLink, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Category { category: string; count: number; urls: string[]; }
interface MapResult {
  domain: string;
  origin: string;
  totalUnique: number;
  sources: { source: string; found: number }[];
  categories: Category[];
  truncated?: boolean;
}

const DomainMapPanel = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MapResult | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

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
    if (!result) return [];
    const cat = result.categories.find((c) => c.category === activeCat);
    const list = cat ? cat.urls : result.categories.flatMap((c) => c.urls);
    if (!filter.trim()) return list;
    const f = filter.toLowerCase();
    return list.filter((u) => u.toLowerCase().includes(f));
  }, [result, activeCat, filter]);

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
            <span className="text-[10px] font-light text-muted-foreground/60">{currentUrls.length}</span>
          </div>

          {/* URL list */}
          <div className="rounded-xl border border-border/20 bg-background/30 divide-y divide-border/10 max-h-[420px] overflow-y-auto">
            {currentUrls.slice(0, 800).map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-light text-foreground/85 hover:bg-foreground/[0.04] transition"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="truncate">{u}</span>
              </a>
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
    </div>
  );
};

export default DomainMapPanel;
