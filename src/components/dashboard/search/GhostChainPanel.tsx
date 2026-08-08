// GhostChainPanel — renders the ported Zophiel v2 Ghost Chain report.
// Origin: https://github.com/shep95/zophiel_search_engine.v2 (MIT © shep95)

import { useState } from "react";
import { Ghost, Loader2, Link as LinkIcon, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ghostChainScrape, type GhostChainReport } from "@/lib/zophielGhostChain";

interface Props {
  initialUrl?: string;
}

const GhostChainPanel = ({ initialUrl = "" }: Props) => {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GhostChainReport | null>(null);

  const run = async () => {
    if (loading) return;
    const target = url.trim();
    if (!target) return;
    setLoading(true);
    setReport(null);
    try {
      const r = await ghostChainScrape(target);
      setReport(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ghost Chain failed";
      toast({ title: "Ghost Chain error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Ghost className="h-4 w-4 text-accent" strokeWidth={1.4} />
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Zophiel v2 · Ghost Chain Protocol
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) void run(); }}
          placeholder="https://target-url.example.com"
          className="bg-background/40 border-border/30 text-sm"
          disabled={loading}
        />
        <Button onClick={run} disabled={loading || !url.trim()} className="min-w-[110px]">
          {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Scanning</> : "Investigate"}
        </Button>
      </div>

      {loading && (
        <div className="border border-border/20 rounded-lg p-6 text-center text-xs text-muted-foreground animate-pulse">
          Ingress → Execution → Distillation → Learning → Output…
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="border border-border/20 rounded-lg p-4 bg-card/30">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">Target</div>
            <a href={report.target} target="_blank" rel="noopener noreferrer" className="text-sm text-accent inline-flex items-center gap-1 hover:underline">
              {report.title} <ArrowUpRight className="h-3 w-3" />
            </a>
            <div className="text-xs text-muted-foreground/70 mt-1 truncate">{report.target}</div>
            {report.snippet && <p className="text-xs text-foreground/70 mt-3 leading-relaxed">{report.snippet}</p>}
          </div>

          {report.report && (
            <div className="border border-border/20 rounded-lg p-4 bg-card/30">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">Intelligence Report</div>
              <pre className="text-xs text-foreground/85 whitespace-pre-wrap font-sans leading-relaxed">{report.report}</pre>
            </div>
          )}

          {report.warnings?.length > 0 && (
            <div role="status" className="border border-border/30 rounded-lg px-4 py-3 bg-muted/20 text-xs text-muted-foreground">
              {report.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}

          {report.entities.length > 0 && (
            <div className="border border-border/20 rounded-lg p-4 bg-card/30">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">Entities ({report.entities.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {report.entities.map((e, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded border border-border/30 bg-background/40 text-foreground/80">
                    <span className="opacity-50 mr-1">{e.type[0].toUpperCase()}</span>{e.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.keywords.length > 0 && (
            <div className="border border-border/20 rounded-lg p-4 bg-card/30">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">Signal Keywords</div>
              <div className="flex flex-wrap gap-1.5">
                {report.keywords.map((k) => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/80 border border-accent/20">{k}</span>
                ))}
              </div>
            </div>
          )}

          {report.links.length > 0 && (
            <div className="border border-border/20 rounded-lg p-4 bg-card/30">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> Discovered Links ({report.links.length})
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {report.links.slice(0, 40).map((l) => (
                  <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-muted-foreground hover:text-accent truncate">
                    {l}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground/50 text-center">
            Pipeline mode: {report.mode} · {report.mode === "remote" ? "Full Playwright stack (user-hosted v2 service)" : "Deno-static port · no browser render"}
          </div>
        </div>
      )}
    </div>
  );
};

export default GhostChainPanel;
