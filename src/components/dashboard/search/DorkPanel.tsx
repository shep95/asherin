// DORK — cross-domain OSINT dorking surface.
// Plans a battery of high-yield search-operator queries from a single target
// (person + locality, or a domain) and runs them in parallel against the open
// web. Surfaces only what the public index already contains.
import { useCallback, useState } from "react";
import { Crosshair, Loader2, Search, Sparkles, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { emitPull } from "@/lib/connect/emitPull";

interface DorkHit { title: string; url: string; snippet: string }
interface DorkBucket { query: string; rationale: string; hits: DorkHit[] }
interface DorkResponse {
  success: boolean;
  target: string;
  profile: string;
  buckets: DorkBucket[];
  totalHits: number;
  brief: string;
  notice: string;
}

const PROFILES = [
  { id: "auto",   label: "Auto-detect" },
  { id: "person", label: "Person" },
  { id: "domain", label: "Domain" },
  { id: "topic",  label: "Topic" },
] as const;

const PLACEHOLDER_BY_PROFILE: Record<string, string> = {
  auto:   "John Doe    —or—    example.com",
  person: "Full name, city, employer (e.g. Jane Doe, Austin TX, Acme Corp)",
  domain: "example.com",
  topic:  "Topic / quoted phrase to dork across the open web",
};

const DorkPanel = () => {
  const [target, setTarget] = useState("");
  const [profile, setProfile] = useState<typeof PROFILES[number]["id"]>("auto");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DorkResponse | null>(null);

  const run = useCallback(async () => {
    const t = target.trim();
    if (!t) return;
    setLoading(true);
    setData(null);
    const started = performance.now();
    try {
      const byok = getActiveIntelMapByok();
      const { data: res, error } = await supabase.functions.invoke("zophiel-dork", {
        body: { target: t, profile, ...(byok ? { byok } : {}) },
      });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || "dork failed");
      setData(res as DorkResponse);
      const hits = (res as DorkResponse).totalHits ?? 0;
      void emitPull({
        organ: "zophiel",
        capability: "dork",
        fromSurface: "zophiel-dork",
        status: hits ? "ok" : "skip",
        latencyMs: Math.round(performance.now() - started),
        quote: t,
        meta: { hits, buckets: (res as DorkResponse).buckets?.length ?? 0 },
      });
    } catch (e) {
      console.error("[dork]", e);
      void emitPull({
        organ: "zophiel",
        capability: "dork",
        fromSurface: "zophiel-dork",
        status: "fail",
        latencyMs: Math.round(performance.now() - started),
        quote: e instanceof Error ? e.message : "dork failed",
      });
      toast({
        title: "Dork sweep failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [target, profile]);

  const copyQuery = (q: string) => {
    navigator.clipboard.writeText(q);
    toast({ title: "Copied", description: "Dork query copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      {/* Briefing strip */}
      <div className="rounded-xl border border-accent/20 bg-card/40 backdrop-blur-md p-4">
        <div className="flex items-start gap-3">
          <Crosshair className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent/80">Dork Battery</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter a person (<span className="text-foreground">name + locality + employer</span>) or a
              <span className="text-foreground"> domain</span>. AXRLEN expands the target into 12-18 high-yield
              search-operator queries (<code className="text-accent/80">site:</code>,
              <code className="text-accent/80"> filetype:</code>, <code className="text-accent/80">intitle:</code>,
              <code className="text-accent/80"> inurl:</code>, paste/leak sweeps, public-records sweeps) and
              executes them in parallel. Open-web indexes only.
            </p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-md p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => setProfile(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-light border transition ${
                profile === p.id
                  ? "border-accent/50 bg-accent/20 text-accent"
                  : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) run(); }}
              placeholder={PLACEHOLDER_BY_PROFILE[profile]}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
          <button
            onClick={run}
            disabled={loading || !target.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent/20 border border-accent/40 text-accent text-xs font-light hover:bg-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Sweeping…" : "Run Dork Sweep"}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!data && !loading && (
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-md p-8 text-center">
          <ShieldAlert className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60">No sweep yet</p>
          <p className="text-xs text-muted-foreground/70 mt-2 max-w-md mx-auto">
            Example targets: <span className="text-foreground/80">"John Doe, Austin TX"</span>,
            <span className="text-foreground/80"> "acme.com"</span>,
            <span className="text-foreground/80"> "Operation Mockingbird filetype:pdf"</span>.
          </p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em]">
              <span className="text-accent/80">Profile: {data.profile}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-muted-foreground">{data.buckets.length} dorks</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-muted-foreground">{data.totalHits} hits</span>
            </div>
            <p className="text-[10px] text-muted-foreground/50 max-w-md text-right">{data.notice}</p>
          </div>

          {data.brief && (
            <div className="rounded-xl border border-accent/25 bg-accent/5 backdrop-blur-md p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent/80 mb-2">Analyst Brief</p>
              <div className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap font-light">
                {data.brief}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {data.buckets.map((b, i) => {
              const encoded = encodeURIComponent(b.query);
              const googleUrl = `https://www.google.com/search?q=${encoded}`;
              const ddgUrl = `https://duckduckgo.com/?q=${encoded}`;
              const bingUrl = `https://www.bing.com/search?q=${encoded}`;
              return (
              <div key={i} className="rounded-xl border border-border/25 bg-card/30 backdrop-blur-md overflow-hidden">
                <div className="px-4 py-3 border-b border-border/15 bg-background/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-accent/70">Bucket {i + 1}</span>
                        <span className="text-[10px] text-muted-foreground/60">· {b.hits.length} hits</span>
                      </div>
                      <code className="text-xs text-foreground font-mono break-all">{b.query}</code>
                      {b.rationale && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{b.rationale}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <a href={googleUrl} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-accent/30 bg-accent/10 text-accent text-[10px] uppercase tracking-[0.15em] hover:bg-accent/20 transition">
                          <ExternalLink className="h-3 w-3" /> Google
                        </a>
                        <a href={ddgUrl} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/30 bg-background/40 text-foreground/80 text-[10px] uppercase tracking-[0.15em] hover:bg-foreground/5 transition">
                          <ExternalLink className="h-3 w-3" /> DuckDuckGo
                        </a>
                        <a href={bingUrl} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/30 bg-background/40 text-foreground/80 text-[10px] uppercase tracking-[0.15em] hover:bg-foreground/5 transition">
                          <ExternalLink className="h-3 w-3" /> Bing
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => copyQuery(b.query)}
                      className="shrink-0 p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition"
                      title="Copy query"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {b.hits.length === 0 ? (
                  <div className="px-4 py-3 text-[11px] text-muted-foreground/50 italic">
                    No public results returned. Open the query on Google / DuckDuckGo / Bing above to sweep it live.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/10">
                    {b.hits.map((h, j) => {
                      let host = "";
                      try { host = new URL(h.url).hostname.replace(/^www\./, ""); } catch { host = h.url; }
                      return (
                      <li key={j} className="px-4 py-3 hover:bg-foreground/5 transition">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-accent mt-1 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.15em] text-accent/80 shrink-0">{host}</span>
                                <span className="text-[10px] text-muted-foreground/40">↗</span>
                              </div>
                              <p className="text-xs text-foreground group-hover:text-accent transition line-clamp-1 mt-0.5">
                                {h.title || h.url}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60 break-all font-mono mt-0.5 underline decoration-dotted underline-offset-2">
                                {h.url}
                              </p>
                              {h.snippet && (
                                <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2 leading-relaxed">
                                  {h.snippet}
                                </p>
                              )}
                            </div>
                          </div>
                        </a>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DorkPanel;
