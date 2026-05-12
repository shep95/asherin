import { useEffect, useState } from "react";
import { Network, Loader2, X, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import AureonChatFloat from "./AureonChatFloat";

interface Props {
  targetUrl: string;
  dossier: unknown;
  onClose: () => void;
}

interface IntelMap { nodes: any[]; edges: any[]; usedModel?: string | null; aiError?: string | null; }

const LinkExtractIntelPanel = ({ targetUrl, dossier, onClose }: Props) => {
  const [map, setMap] = useState<IntelMap | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setMapLoading(true);
      setMapError(null);
      try {
        const byok = getActiveIntelMapByok();
        const { data, error } = await supabase.functions.invoke("link-intel-map", {
          body: { targetUrl, payload: dossier, byok },
        });
        if (cancel) return;
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed to build map");
        setMap({ nodes: data.nodes || [], edges: data.edges || [], usedModel: data.usedModel, aiError: data.aiError });
      } catch (e: any) {
        if (cancel) return;
        const msg = e?.message || "Map failed";
        if (msg.includes("BYOK_REQUIRED") || e?.context?.error === "BYOK_REQUIRED") {
          setMapError("Bring your own Gemini key — open the BYOK panel above.");
        } else {
          setMapError(msg);
        }
      } finally {
        if (!cancel) setMapLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetUrl, dossier]);

  return (
    <>
      {/* Side popout for the map */}
      <div className="absolute inset-y-0 right-0 z-40 flex">
        <div className="h-full w-full max-w-3xl border-l border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-foreground/[0.04] border border-border/30">
                <Network className="h-4 w-4 text-foreground/80" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">Link Intel Map</div>
                <div className="text-sm font-light text-foreground truncate max-w-[400px]">{targetUrl}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-light tracking-[0.18em] uppercase border transition-colors ${
                  chatOpen
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/40 bg-background/50 text-foreground/80 hover:border-foreground/60"
                }`}
              >
                <MessageSquare className="h-3 w-3" /> Aureon Chat
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {mapLoading && (
              <div className="flex items-center gap-2 text-xs font-light text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building intel graph…
              </div>
            )}
            {mapError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] font-light text-destructive">
                {mapError}
              </div>
            )}
            {map && map.nodes.length > 0 && (
              <>
                <div className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground">
                  {map.nodes.length} entities · {map.edges.length} relationships {map.usedModel ? `· ${map.usedModel}` : ""}
                </div>
                {(["host", "cert", "domain", "tech", "org", "path", "leak", "archive"] as const).map((type) => {
                  const items = map.nodes.filter((n) => n.type === type);
                  if (!items.length) return null;
                  return (
                    <div key={type} className="rounded-xl border border-border/30 bg-foreground/[0.02] p-3">
                      <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground mb-2">{type}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((n) => (
                          <span key={n.id} title={n.context || ""} className="inline-block rounded-md border border-border/40 bg-background/60 px-2 py-1 text-[11px] font-light text-foreground">
                            {n.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-xl border border-border/30 bg-foreground/[0.02] p-3">
                  <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground mb-2">Relationships</div>
                  <ul className="space-y-1 text-[11px] font-light text-foreground/85">
                    {map.edges.slice(0, 60).map((e, i) => {
                      const from = map.nodes.find((n) => n.id === e.source)?.label || e.source;
                      const to = map.nodes.find((n) => n.id === e.target)?.label || e.target;
                      return <li key={i}>{from} <span className="text-muted-foreground">— {e.label} →</span> {to}</li>;
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {chatOpen && (
        <AureonChatFloat
          targetUrl={targetUrl}
          dossier={dossier}
          intelMap={map}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
};

export default LinkExtractIntelPanel;
