// ZOPHIEL SHADOW — forgotten/un-indexed live host discovery UI.
// Anchors on a seed (domain or keyword) and shows the fused, obscurity-scored
// wall of hosts the passive layer + probe pass actually reached.
import { useCallback, useState } from "react";
import { Ghost, Loader2, ExternalLink, ShieldAlert, Radar, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ShadowHit {
  url: string; host: string; port: number; scheme: "http"|"https";
  status: number; server?: string; title?: string;
  bytes: number; contentType?: string;
  openDirectory: boolean; obscureTld: boolean; nonStandardPort: boolean;
  latencyMs: number; obscurity: number; signals: string[];
}
interface ShadowResp {
  success: boolean;
  seed: string;
  seedType: "domain" | "keyword";
  hostsDiscovered: number;
  hostsAlive: number;
  elapsedMs: number;
  legs: Record<string, { ok: boolean; count: number; ms: number; error?: string }>;
  hits: ShadowHit[];
}

const ShadowPanel = () => {
  const [seed, setSeed] = useState("");
  const [shodanKey, setShodanKey] = useState("");
  const [fofaKey, setFofaKey] = useState("");
  const [fofaEmail, setFofaEmail] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShadowResp | null>(null);

  const run = useCallback(async () => {
    const s = seed.trim();
    if (!s) return;
    setLoading(true); setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("zophiel-shadow", {
        body: {
          seed: s,
          ...(shodanKey.trim() ? { shodanKey: shodanKey.trim() } : {}),
          ...(fofaKey.trim() && fofaEmail.trim() ? { fofaKey: fofaKey.trim(), fofaEmail: fofaEmail.trim() } : {}),
        },
      });
      if (error) throw error;
      if (!res?.success) throw new Error("Shadow sweep failed");
      setData(res as ShadowResp);
    } catch (e) {
      toast({ title: "Shadow sweep failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setLoading(false); }
  }, [seed, shodanKey, fofaKey, fofaEmail]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/20 bg-card/40 backdrop-blur-md p-4">
        <div className="flex items-start gap-3">
          <Ghost className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent/80">Zophiel Shadow Layer</p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Discovery of live hosts standard search never sees — passive-DNS + certificate transparency +
              archive-once URLs + code-leak strings, fused and probed on HTTP-adjacent ports only.
              Ranked by obscurity, not popularity.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && run()}
            placeholder="Seed: a domain (example.com) or a keyword (weather-station-mt)"
            className="flex-1 rounded-lg bg-background/40 border border-border/40 px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <button
            onClick={run}
            disabled={loading || !seed.trim()}
            className="rounded-lg bg-accent/20 border border-accent/40 text-accent px-4 py-2 text-xs uppercase tracking-[0.2em] hover:bg-accent/30 disabled:opacity-40 flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
            Sweep
          </button>
        </div>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60 hover:text-foreground"
        >
          {showAdvanced ? "hide" : "advanced"} · BYOK (Shodan / FOFA)
        </button>
        {showAdvanced && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input value={shodanKey} onChange={e => setShodanKey(e.target.value)} placeholder="Shodan API key (optional)" className="rounded-lg bg-background/40 border border-border/40 px-3 py-2 text-xs" />
            <input value={fofaEmail} onChange={e => setFofaEmail(e.target.value)} placeholder="FOFA email (optional)" className="rounded-lg bg-background/40 border border-border/40 px-3 py-2 text-xs" />
            <input value={fofaKey} onChange={e => setFofaKey(e.target.value)} placeholder="FOFA key (optional)" className="rounded-lg bg-background/40 border border-border/40 px-3 py-2 text-xs" />
          </div>
        )}
      </div>

      {data && (
        <div className="space-y-3">
          {/* leg status */}
          <div className="rounded-lg border border-border/30 bg-card/30 p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">Legs</span>
              <span className="text-[10px] text-muted-foreground/60">{data.hostsDiscovered} hosts discovered · {data.hostsAlive} alive · {data.elapsedMs} ms</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.legs).map(([name, s]) => (
                <span key={name} className={`text-[10px] px-2 py-0.5 rounded border ${s.ok ? "border-emerald-500/30 text-emerald-400/80" : "border-red-500/30 text-red-400/70"}`}>
                  {name} · {s.count} · {s.ms}ms{s.error ? ` · ${s.error}` : ""}
                </span>
              ))}
            </div>
          </div>

          {data.hits.length === 0 && (
            <div className="rounded-lg border border-border/30 bg-card/30 p-6 text-center text-xs text-muted-foreground/70 flex items-center justify-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5" /> No live shadow hosts survived probe. Try a broader seed.
            </div>
          )}

          <div className="grid gap-2">
            {data.hits.map((h) => (
              <div key={h.url} className="rounded-lg border border-border/30 bg-card/30 p-3 hover:border-accent/40 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={h.url} target="_blank" rel="noreferrer noopener" className="text-sm text-accent hover:underline truncate">
                        {h.url}
                      </a>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground/60">{h.status} · {h.latencyMs}ms · {(h.bytes/1024).toFixed(1)}KB</span>
                    </div>
                    {h.title && <div className="text-xs text-foreground/80 mt-0.5 truncate">{h.title}</div>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.signals.map(s => (
                        <span key={s} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-accent/30 text-accent/80">{s}</span>
                      ))}
                      {h.server && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/70">srv:{h.server.slice(0,24)}</span>}
                      {h.contentType && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/70">{h.contentType.split(";")[0]}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">obscurity</div>
                    <div className={`text-lg font-light ${h.obscurity >= 60 ? "text-accent" : "text-foreground/70"}`}>{h.obscurity}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(h.url); toast({ title: "Copied" }); }}
                      className="mt-1 text-[9px] text-muted-foreground/60 hover:text-foreground inline-flex items-center gap-1"
                    ><Copy className="h-2.5 w-2.5" /> copy</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShadowPanel;
