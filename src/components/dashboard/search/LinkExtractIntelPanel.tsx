import { useEffect, useRef, useState } from "react";
import { Network, MessageSquare, Loader2, X, Send, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import ReactMarkdown from "react-markdown";

interface Props {
  targetUrl: string;
  /** The full extraction payload from LinkExtractView. */
  dossier: unknown;
  onClose: () => void;
}

interface IntelMap { nodes: any[]; edges: any[]; usedModel?: string | null; aiError?: string | null; }
interface ChatMsg { role: "user" | "assistant"; content: string; }

const LinkExtractIntelPanel = ({ targetUrl, dossier, onClose }: Props) => {
  const [tab, setTab] = useState<"map" | "chat">("map");
  const [map, setMap] = useState<IntelMap | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [brains, setBrains] = useState<{ id: string; name: string }[]>([]);
  const [activeBrainIds, setActiveBrainIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build intel map on mount
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

  // Load user's brains
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("axrlen_brains")
          .select("id, name")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(20);
        setBrains((data as any) || []);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const byok = getActiveIntelMapByok();
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/link-extract-chat`;
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: next,
          dossier,
          intelMap: map,
          brainIds: activeBrainIds,
          byok,
        }),
      });
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        throw new Error(errText || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `_Chat failed: ${e?.message || e}_` }]);
    } finally {
      setSending(false);
    }
  };

  const toggleBrain = (id: string) => {
    setActiveBrainIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="absolute inset-0 z-40 flex bg-background/80 backdrop-blur-md">
      <div className="ml-auto h-full w-full max-w-3xl border-l border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-foreground/[0.04] border border-border/30">
              <Network className="h-4 w-4 text-foreground/80" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">Link Intel</div>
              <div className="text-sm font-light text-foreground truncate max-w-[400px]">{targetUrl}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/20">
          {(["map", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2.5 text-[11px] font-light tracking-[0.18em] uppercase transition-colors ${
                tab === t ? "text-foreground border-b border-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "map" ? <span className="inline-flex items-center gap-1.5"><Network className="h-3 w-3" /> Intel Map</span>
                           : <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Brain Chat</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        {tab === "map" && (
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
        )}

        {tab === "chat" && (
          <>
            {/* Brain selector */}
            <div className="border-b border-border/20 px-5 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">Active Brains</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brains.length === 0 && <span className="text-[10px] font-light text-muted-foreground/60">No brains saved.</span>}
                {brains.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => toggleBrain(b.id)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-light transition-colors ${
                      activeBrainIds.includes(b.id)
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/40 bg-background/50 text-foreground/80 hover:border-foreground/40"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-[11px] font-light text-muted-foreground">
                  Ask anything about <span className="text-foreground">{targetUrl}</span>. Try: "list everything you found", "who hosts this", "any leaks?".
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`rounded-xl border px-3 py-2 text-[12px] font-light leading-relaxed ${
                  m.role === "user"
                    ? "border-border/40 bg-background/60 text-foreground"
                    : "border-border/30 bg-foreground/[0.03] text-foreground/90"
                }`}>
                  {m.role === "assistant"
                    ? <div className="prose prose-sm dark:prose-invert max-w-none [&_*]:font-light"><ReactMarkdown>{m.content || "…"}</ReactMarkdown></div>
                    : m.content}
                </div>
              ))}
              {sending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            <div className="border-t border-border/20 p-3 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the assistant…"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40"
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-light bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LinkExtractIntelPanel;
