// GovAxrlenPanel — Sovereign AXRLEN Forecast console.
//
// Interactive prompt → question → streamed answer, wired to the
// `axrlen-chat` edge function (Gemini). Backgrounds are transparent
// so the deck wallpaper reads through; only hairline borders and
// glass tints remain.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Shield, Radio, Clock, Loader2,
  AlertTriangle, FileCheck2, Signal, Send, Sparkles, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Session {
  id: string;
  title: string | null;
  region: string | null;
  prediction_type: string | null;
  status: string | null;
  predictions: any;
  data_sources: any;
  confidence_score: number | null;
  ai_summary: string | null;
  updated_at: string;
  created_at: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string; }

interface Props {
  operator: string;
  serverName?: string | null;
  onAudit: (action: string, target: string, detail?: string) => void;
}

const DOMAIN_ORDER = ["regulatory", "market", "geopolitical", "event"] as const;

function classifyDomain(s: Session): string {
  const t = `${s.prediction_type ?? ""} ${s.region ?? ""}`.toLowerCase();
  if (/reg|law|policy|compl/.test(t)) return "regulatory";
  if (/mkt|market|price|econ|fin|trade/.test(t)) return "market";
  if (/geo|nato|treaty|state|diplom|border/.test(t)) return "geopolitical";
  return "event";
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / (60 * 24))}d ago`;
}

export default function GovAxrlenPanel({ operator, serverName, onAudit }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>("all");

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatErr, setChatErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      const { data, error } = await supabase
        .from("axrlen_sessions")
        .select("id,title,region,prediction_type,status,predictions,data_sources,confidence_score,ai_summary,updated_at,created_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (!alive) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      setSessions((data ?? []) as Session[]);
      setActiveId(prev => prev ?? (data?.[0]?.id ?? null));
      setLoading(false);
      onAudit("AXRLEN_INGEST", "axrlen_sessions", `${data?.length ?? 0} sessions`);
    })();
    return () => { alive = false; abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { regulatory: 0, market: 0, geopolitical: 0, event: 0 };
    for (const s of sessions) c[classifyDomain(s)] = (c[classifyDomain(s)] ?? 0) + 1;
    return c;
  }, [sessions]);

  const visible = useMemo(() => {
    if (domain === "all") return sessions;
    return sessions.filter(s => classifyDomain(s) === domain);
  }, [sessions, domain]);

  const active = useMemo(
    () => sessions.find(s => s.id === activeId) ?? visible[0] ?? null,
    [sessions, activeId, visible]
  );

  const fleetMedian = useMemo(() => {
    const vals = sessions.map(s => Number(s.confidence_score ?? 0)).filter(v => v > 0).sort((a, b) => a - b);
    if (!vals.length) return 0;
    return vals[Math.floor(vals.length / 2)];
  }, [sessions]);

  function switchSession(id: string) {
    setActiveId(id);
    setMessages([]);
    setChatErr(null);
    onAudit("AXRLEN_OPEN_SESSION", id);
  }

  async function ask() {
    const q = prompt.trim();
    if (!q || streaming) return;
    setChatErr(null);
    setPrompt("");
    const next: ChatMsg[] = [...messages, { role: "user", content: q }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);
    onAudit("AXRLEN_ASK", active?.id ?? "adhoc", q.slice(0, 120));

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/axrlen-chat`;
      const res = await fetch(url, {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: next.filter(m => m.content || m.role === "user").slice(0, -1),
          sessionContext: active ? {
            title: active.title,
            region: active.region,
            confidenceScore: active.confidence_score,
          } : undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages(prev => {
                const copy = prev.slice();
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setChatErr(e?.message || "AXRLEN request failed");
        setMessages(prev => prev.slice(0, -1)); // drop empty assistant
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setChatErr(null);
  }

  return (
    <div className="h-full w-full flex flex-col text-foreground">
      {/* CLASSIFICATION HEADER */}
      <div className="shrink-0 border-b border-border/20 backdrop-blur-md bg-background/30">
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/15">
          <div className="flex items-center gap-3 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70">
            <Shield className="h-3 w-3" />
            <span>SECRET // NOFORN // AXRLEN-EYES</span>
            <span className="opacity-30">·</span>
            <span>{serverName ?? "SOVEREIGN"}</span>
          </div>
          <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/50">
            OPERATOR · {operator}
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="h-9 w-9 rounded border border-border/25 flex items-center justify-center">
            <Activity className="h-4 w-4 text-foreground/70" strokeWidth={1.4} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-light tracking-[0.35em] uppercase">AXRLEN</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-border/25 tracking-[0.25em] uppercase text-muted-foreground/70">Nexus Prime</span>
            </div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/50 mt-0.5">
              Prompt-driven Predictive Intelligence · Verification-Planned Forecasts
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/50">Fleet Median</div>
              <div className="text-[13px] font-light tracking-wide">
                {fleetMedian ? `${fleetMedian.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/25 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              <span className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70">Live · {sessions.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 min-h-0 grid grid-cols-[200px_minmax(0,1fr)_280px]">
        {/* LEFT RAIL */}
        <aside className="border-r border-border/20 backdrop-blur-sm bg-background/20 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border/15 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
            Domain Families
          </div>
          <nav className="p-1.5">
            <DomainRow label="All Domains" count={sessions.length} active={domain === "all"} onClick={() => setDomain("all")} />
            {DOMAIN_ORDER.map(d => (
              <DomainRow key={d} label={d} count={counts[d] ?? 0} active={domain === d} onClick={() => setDomain(d)} />
            ))}
          </nav>

          <div className="px-3 pt-4 pb-2 border-t border-border/15 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
            Sessions
          </div>
          <div className="px-1.5 pb-3 space-y-0.5">
            {loading && (
              <div className="flex items-center gap-2 px-2 py-2 text-[10px] text-muted-foreground/60">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="px-2 py-2 text-[10px] text-muted-foreground/50">No sessions in domain.</div>
            )}
            {visible.map(s => {
              const isActive = active?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={`w-full text-left px-2 py-1.5 rounded border transition ${
                    isActive
                      ? "border-border/40 bg-foreground/5"
                      : "border-transparent hover:border-border/20 hover:bg-foreground/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-light truncate">
                      {s.title || "Untitled forecast"}
                    </span>
                    {typeof s.confidence_score === "number" && (
                      <span className="text-[9px] font-mono text-muted-foreground/60">
                        {Number(s.confidence_score).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/40 mt-0.5">
                    {classifyDomain(s)} · {fmtWhen(s.updated_at)}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN — INTERACTIVE PROMPT / STREAM */}
        <main className="flex flex-col min-h-0">
          {err && (
            <div className="m-4 flex items-start gap-2 rounded border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm p-3 text-[11px] text-amber-300/90">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
              <div>
                <div className="font-medium">AXRLEN feed unavailable</div>
                <div className="text-amber-300/70 mt-0.5">{err}</div>
              </div>
            </div>
          )}

          {/* Active brief chip */}
          {active && (
            <div className="px-5 pt-4 pb-2 border-b border-border/15">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
                    Session Context · {classifyDomain(active)}
                  </div>
                  <h2 className="text-[15px] font-light tracking-tight mt-0.5 truncate">
                    {active.title || "Untitled forecast"}
                  </h2>
                  <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtWhen(active.updated_at)}</span>
                    {active.region && (
                      <span className="inline-flex items-center gap-1"><Radio className="h-3 w-3" /> {active.region}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">Confidence</div>
                  <div className="text-[22px] font-extralight tracking-tight leading-none mt-1">
                    {typeof active.confidence_score === "number" ? `${Number(active.confidence_score).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="h-full min-h-[240px] flex items-center justify-center text-center">
                <div className="max-w-md">
                  <Sparkles className="h-5 w-5 mx-auto text-muted-foreground/50" strokeWidth={1.4} />
                  <div className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground/70 mt-3">
                    Query AXRLEN Nexus Prime
                  </div>
                  <p className="text-[10.5px] text-muted-foreground/55 mt-2 leading-relaxed">
                    Ask a direct question — a name, a lean, a probability. For a full scenario matrix, request "deep analysis" or "full report".
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {[
                      "Who wins the next NATO election cycle?",
                      "BTC direction next 72h?",
                      "Full analysis: Taiwan Strait Q1",
                    ].map(s => (
                      <button
                        key={s}
                        onClick={() => setPrompt(s)}
                        className="text-[10px] px-2 py-1 rounded border border-border/25 hover:border-border/50 hover:bg-foreground/[0.04] transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded border px-3 py-2 text-[11.5px] leading-relaxed whitespace-pre-wrap backdrop-blur-sm ${
                    m.role === "user"
                      ? "border-border/40 bg-foreground/10 text-foreground"
                      : "border-border/20 bg-background/30 text-foreground/90"
                  }`}
                >
                  <div className="text-[8.5px] tracking-[0.3em] uppercase text-muted-foreground/50 mb-1">
                    {m.role === "user" ? operator : "AXRLEN"}
                  </div>
                  {m.content || (streaming && i === messages.length - 1
                    ? <span className="inline-flex items-center gap-1.5 text-muted-foreground/60"><Loader2 className="h-3 w-3 animate-spin" /> forecasting…</span>
                    : null)}
                </div>
              </div>
            ))}

            {chatErr && (
              <div className="flex items-start gap-2 rounded border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm p-2.5 text-[11px] text-amber-300/90">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                <div>{chatErr}</div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-border/20 backdrop-blur-md bg-background/30 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
                }}
                rows={2}
                placeholder="Ask AXRLEN — a question, a pick, a scenario request…"
                className="flex-1 resize-none rounded border border-border/25 bg-background/40 backdrop-blur-sm px-3 py-2 text-[11.5px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/60"
                disabled={streaming}
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={ask}
                  disabled={streaming || !prompt.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border/40 hover:border-foreground/60 bg-foreground/5 hover:bg-foreground/10 text-[10.5px] tracking-[0.25em] uppercase disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  {streaming ? "Streaming" : "Send"}
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border/20 hover:border-border/40 text-[9.5px] tracking-[0.25em] uppercase text-muted-foreground/70 hover:text-foreground transition"
                  >
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1.5 text-[9px] tracking-[0.2em] uppercase text-muted-foreground/40">
              Enter to send · Shift+Enter for newline · Session context auto-attached
            </div>
          </div>
        </main>

        {/* RIGHT RAIL — LEDGER */}
        <aside className="border-l border-border/20 backdrop-blur-sm bg-background/20 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border/15 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60 flex items-center gap-2">
            <FileCheck2 className="h-3 w-3" /> Forecast Ledger
          </div>
          <div className="p-2 space-y-1.5">
            {sessions.slice(0, 8).map(s => {
              const c = Number(s.confidence_score ?? 0);
              const delta = c - fleetMedian;
              const sign = delta >= 0 ? "+" : "";
              return (
                <button
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className="w-full text-left rounded border border-border/15 bg-background/25 backdrop-blur-sm hover:border-border/40 px-2.5 py-2 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono tracking-widest text-muted-foreground/60">
                      {new Date(s.updated_at).toISOString().slice(5, 16).replace("T", " ")}Z
                    </span>
                    <span className={`text-[9px] font-mono ${delta >= 0 ? "text-emerald-400/80" : "text-amber-400/80"}`}>
                      {sign}{delta.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[10.5px] font-light text-foreground/85 mt-1 truncate">
                    {s.title || "Untitled forecast"}
                  </div>
                  <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/45 mt-0.5">
                    {classifyDomain(s)} · {c ? `${c.toFixed(0)}% conf` : "no conf"}
                  </div>
                </button>
              );
            })}
            {!loading && sessions.length === 0 && (
              <div className="px-2 py-3 text-[10px] text-muted-foreground/50 flex items-center gap-2">
                <Signal className="h-3 w-3" /> Ledger empty.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DomainRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[10.5px] tracking-[0.15em] uppercase transition ${
        active
          ? "bg-foreground/5 text-foreground border-l border-foreground/60"
          : "text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] border-l border-transparent"
      }`}
    >
      <span className="font-light">{label}</span>
      <span className="text-[9px] font-mono text-muted-foreground/50">{String(count).padStart(2, "0")}</span>
    </button>
  );
}
