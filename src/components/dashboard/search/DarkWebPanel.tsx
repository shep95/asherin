// Asher Dashboard / Zophiel Engine — Dark Web (Robin / darkgoogle) panel.
// Renders Gemini-refined query, harvested onion links, and an OSINT brief.
import { useState } from "react";
import { Loader2, Skull, ExternalLink, ShieldAlert, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

interface DarkHit { title: string; link: string; engine: string }

const DarkWebPanel = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refined, setRefined] = useState("");
  const [results, setResults] = useState<DarkHit[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setError(null); setResults([]); setSummary(""); setRefined(""); setRan(true);
    try {
      const byok = getActiveIntelMapByok();
      const { data, error: invErr } = await supabase.functions.invoke("zophiel-darkweb", {
        body: { query: q, ...(byok ? { byok } : {}) },
      });
      if (invErr) throw invErr;
      if (!data?.success) throw new Error(data?.error || "Darkweb sweep failed");
      setRefined(data.refined || "");
      setResults(Array.isArray(data.results) ? data.results : []);
      setSummary(data.summary || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Darkweb sweep failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header / disclaimer — matches Asher dashboard glass theme */}
      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl px-4 py-3 flex items-start gap-3">
        <Skull className="h-5 w-5 text-accent shrink-0 mt-0.5" strokeWidth={1.4} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground tracking-wide">DARK WEB SWEEP — Robin Pipeline</p>
          <p className="text-[10px] font-extralight text-muted-foreground mt-0.5">
            Operator prompt → Gemini-refined query → fan-out across 6 onion search engines via public Tor2Web gateways → forensic brief.
            Routed through clearnet gateways (not native Tor) — treat as <span className="text-accent">unattributed but not anonymous</span>.
          </p>
        </div>
      </div>

      {/* Prompt bar */}
      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl px-4 py-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
          placeholder="Describe the intelligence target (natural language)…"
          className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
        <button
          onClick={run}
          disabled={loading || !query.trim()}
          className="rounded-xl bg-accent/20 px-4 py-1.5 text-xs font-light text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 inline-flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowRight className="h-4 w-4" /> Sweep</>}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] font-light text-destructive">
          {error}
        </div>
      )}

      {loading && !refined && (
        <div className="flex items-center gap-2 text-[11px] font-light text-muted-foreground/70 px-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Refining query through ZOPHIEL architect…
        </div>
      )}

      {refined && (
        <div className="rounded-xl border border-border/20 bg-card/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Refined Query</p>
          <p className="text-xs font-light text-foreground/90">{refined}</p>
        </div>
      )}

      {summary && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent/80 mb-2">Intelligence Brief</p>
          <pre className="whitespace-pre-wrap text-[12px] font-light text-foreground/90 leading-relaxed font-sans">{summary}</pre>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 px-1">Harvested Onion Results · {results.length}</p>
          {results.map((r, i) => (
            <div key={r.link + i} className="rounded-xl border border-border/20 bg-card/30 px-3 py-2 hover:border-border/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-light text-foreground truncate">[{i + 1}] {r.title || "(untitled)"}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{r.link}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] uppercase tracking-wider text-accent/70">{r.engine}</span>
                  <a href={r.link} target="_blank" rel="noreferrer" className="text-muted-foreground/60 hover:text-foreground" title="Open (requires Tor browser)">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ran && !loading && results.length === 0 && !error && (
        <p className="text-[11px] font-light text-muted-foreground/60 px-1">No results returned. Tor2Web gateways throttle aggressively — retry in a moment or refine the prompt.</p>
      )}
    </div>
  );
};

export default DarkWebPanel;
