// ZophielV2Panel — two-pass "gather → refine" UI backed by zophiel-v2-search
// edge function. Mirrors the CLI's operator semantics (site:/intitle:/inurl:/
// filetype: + quoted phrases + "in <country>" region hints).
//
// Origin of the semantics: https://github.com/shep95/zophiel_search_engine.v2

import { useState } from "react";
import { Loader2, Radar, Filter, MapPin, ArrowUpRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ResultRow { title: string; url: string; snippet: string; score: number; matched: string[] }
interface V2Response {
  success: boolean;
  operators: { site: string[]; filetype: string[]; intitle: string[]; inurl: string[]; phrases: string[]; freeText: string };
  location: { country: string | null; region: string | null };
  pass1_gathered: number;
  pass2_refined: number;
  results: ResultRow[];
  error?: string;
}

const EXAMPLES = [
  'site:linkedin.com intitle:engineer wei zhang',
  'filetype:pdf "annual report" site:sec.gov',
  'maria silva who lives in brazil',
  'inurl:profile sydney australia',
];

interface Props { initialQuery?: string }

const ZophielV2Panel = ({ initialQuery = "" }: Props) => {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<V2Response | null>(null);

  const run = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setData(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke<V2Response>("zophiel-v2-search", { body: { query: q } });
      if (error) throw error;
      if (!resp?.success) throw new Error(resp?.error || "Search failed");
      setData(resp);
    } catch (e) {
      toast({ title: "Zophiel v2 error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const hasOp = (arr: string[]) => arr.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-accent" strokeWidth={1.4} />
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Zophiel v2 · Two-Pass Gather &amp; Refine
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
          placeholder='site:linkedin.com intitle:engineer  wei zhang who lives in china'
          className="bg-background/40 border-border/30 text-sm font-mono"
          disabled={loading}
        />
        <Button onClick={run} disabled={loading || !query.trim()} className="min-w-[110px]">
          {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Searching</> : "Investigate"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setQuery(ex)}
            className="text-[10px] font-mono border border-border/20 rounded px-2 py-1 text-muted-foreground/80 hover:text-foreground hover:border-accent/40 transition"
            disabled={loading}
          >
            {ex}
          </button>
        ))}
      </div>

      {loading && (
        <div className="border border-border/20 rounded-lg p-6 text-center text-xs text-muted-foreground animate-pulse">
          Pass 1 · Gathering region-aware SERP → Pass 2 · Applying operators…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
            <div className="border border-border/20 rounded p-2">
              <div className="text-muted-foreground/60 uppercase tracking-wider">Pass 1 Gathered</div>
              <div className="text-foreground/90 text-lg font-light">{data.pass1_gathered}</div>
            </div>
            <div className="border border-border/20 rounded p-2">
              <div className="text-muted-foreground/60 uppercase tracking-wider">Pass 2 Refined</div>
              <div className="text-accent text-lg font-light">{data.pass2_refined}</div>
            </div>
            <div className="border border-border/20 rounded p-2">
              <div className="text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1"><MapPin className="h-3 w-3" /> Region</div>
              <div className="text-foreground/90">{data.location.country ? `${data.location.country} · ${data.location.region}` : "—"}</div>
            </div>
            <div className="border border-border/20 rounded p-2">
              <div className="text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1"><Filter className="h-3 w-3" /> Operators</div>
              <div className="text-foreground/90 truncate">
                {[
                  hasOp(data.operators.site) && `site:${data.operators.site.join(",")}`,
                  hasOp(data.operators.filetype) && `type:${data.operators.filetype.join(",")}`,
                  hasOp(data.operators.intitle) && `title:${data.operators.intitle.join(",")}`,
                  hasOp(data.operators.inurl) && `url:${data.operators.inurl.join(",")}`,
                ].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          </div>

          {data.results.length === 0 ? (
            <div className="border border-border/20 rounded-lg p-6 text-center text-xs text-muted-foreground">
              Nothing in the gathered corpus survived Pass 2 filters. Try loosening operators or removing a `site:` clause.
            </div>
          ) : (
            <div className="space-y-2">
              {data.results.map((r, i) => (
                <div key={r.url + i} className="border border-border/20 rounded-lg p-3 bg-card/30 hover:border-accent/30 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:text-accent inline-flex items-center gap-1 truncate">
                        {r.title || r.url} <ArrowUpRight className="h-3 w-3 shrink-0" />
                      </a>
                      <div className="text-[10px] font-mono text-muted-foreground/60 truncate mt-0.5">{r.url}</div>
                      {r.snippet && <p className="text-xs text-foreground/70 mt-2 leading-relaxed">{r.snippet}</p>}
                      {r.matched.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.matched.map((m) => (
                            <span key={m} className="text-[9px] uppercase tracking-wider text-accent/80 border border-accent/20 rounded px-1.5 py-0.5">{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-accent/90">score {r.score}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(r.url); toast({ title: "URL copied" }); }}
                        className="text-muted-foreground/60 hover:text-foreground transition"
                        aria-label="Copy URL"
                      ><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ZophielV2Panel;
