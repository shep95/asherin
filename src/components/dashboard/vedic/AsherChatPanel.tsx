import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send, Settings, StickyNote, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Note {
  id: string;
  note: string;
  chart_label: string;
  created_at: string;
}

interface Msg { role: "user" | "assistant"; content: string }

type Provider = "lovable" | "gemini" | "openai" | "anthropic";

interface ByokConfig {
  provider: Provider;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = "asher_vedic_byok_v1";
const PROVIDER_DEFAULTS: Record<Provider, string> = {
  lovable: "google/gemini-2.5-flash",
  gemini: "gemini-2.5-pro",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-20241022",
};
const PROVIDER_LABEL: Record<Provider, string> = {
  lovable: "Lovable AI (default)",
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
};

interface Props {
  open: boolean;
  onClose: () => void;
  chartKey: string | null;
  chartLabel: string;
  chartContext: string;
  onDatesExtracted?: (dates: string[]) => void;
}

export default function AsherChatPanel({ open, onClose, chartKey, chartLabel, chartContext, onDatesExtracted }: Props) {
  const [tab, setTab] = useState<"chat" | "notes">("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [byok, setByok] = useState<ByokConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ByokConfig;
    } catch { /* noop */ }
    return { provider: "lovable", model: PROVIDER_DEFAULTS.lovable, apiKey: "" };
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages([]); setInput(""); }, [chartKey]);

  const persistByok = (next: ByokConfig) => {
    setByok(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };

  const loadNotes = async () => {
    if (!chartKey) { setNotes([]); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNotes([]); return; }
    const { data } = await supabase
      .from("chart_notes")
      .select("id,note,chart_label,created_at")
      .eq("user_id", auth.user.id)
      .eq("chart_key", chartKey)
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
  };

  useEffect(() => { void loadNotes(); }, [chartKey, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || !chartKey || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const byokPayload = byok.provider === "lovable"
        ? { provider: "lovable", model: byok.model || PROVIDER_DEFAULTS.lovable }
        : (byok.apiKey.trim().length > 0
            ? { provider: byok.provider, model: byok.model || PROVIDER_DEFAULTS[byok.provider], apiKey: byok.apiKey.trim() }
            : null);

      const { data, error } = await supabase.functions.invoke("vedic-asher-chat", {
        body: { messages: next, chartContext, chartLabel, byok: byokPayload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const reply = (data?.reply as string) ?? "(no reply)";
      const note = data?.note as string | null;
      const dates = (data?.dates as string[] | undefined) ?? [];
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (dates.length > 0) onDatesExtracted?.(dates);
      if (note) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          await supabase.from("chart_notes").insert({
            user_id: auth.user.id, chart_key: chartKey, chart_label: chartLabel, note, source: "ai",
          });
          await loadNotes();
          toast.success("Note saved");
        }
      }
    } catch (e) {
      toast.error((e as Error).message || "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: "_Error reaching ASHER. Open settings to switch AI provider._" }]);
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("chart_notes").delete().eq("id", id);
    await loadNotes();
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] z-50 transform transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"} bg-background/95 backdrop-blur-xl border-l border-border/30 flex flex-col`}
      >
        <header className="px-4 py-3 border-b border-border/25 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full border border-border/30 bg-foreground/5 flex items-center justify-center">
              <MessageSquare className="h-3.5 w-3.5 text-foreground/70" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-light tracking-[0.2em] text-foreground uppercase">Asher AI</div>
              <div className="text-[10px] font-light text-muted-foreground truncate">{chartLabel || "No chart loaded"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`p-1.5 rounded-md transition ${showSettings ? "text-foreground bg-foreground/10" : "text-muted-foreground hover:text-foreground"}`}
              aria-label="AI provider settings"
              title={`Provider: ${PROVIDER_LABEL[byok.provider]}`}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {showSettings && (
          <div className="px-4 py-3 border-b border-border/20 bg-foreground/[0.02] space-y-2.5">
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">AI Provider</div>
            <select
              value={byok.provider}
              onChange={(e) => {
                const p = e.target.value as Provider;
                persistByok({ provider: p, model: PROVIDER_DEFAULTS[p], apiKey: byok.apiKey });
              }}
              className="w-full rounded-md border border-border/30 bg-background/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground/40"
            >
              {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
              ))}
            </select>
            <input
              value={byok.model}
              onChange={(e) => persistByok({ ...byok, model: e.target.value })}
              placeholder={`Model (e.g. ${PROVIDER_DEFAULTS[byok.provider]})`}
              className="w-full rounded-md border border-border/30 bg-background/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground/40"
            />
            {byok.provider !== "lovable" && (
              <input
                type="password"
                value={byok.apiKey}
                onChange={(e) => persistByok({ ...byok, apiKey: e.target.value })}
                placeholder={`${PROVIDER_LABEL[byok.provider]} API key`}
                className="w-full rounded-md border border-border/30 bg-background/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground/40"
              />
            )}
            <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Key stored locally in your browser only. Lovable AI uses platform credits — no key needed.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 border-b border-border/20 text-[10px] uppercase tracking-[0.2em]">
          {(["chat", "notes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 transition ${tab === t ? "text-foreground bg-foreground/[0.04] border-b border-foreground/40" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "chat" ? "Chat" : `Notes (${notes.length})`}
            </button>
          ))}
        </div>

        {tab === "chat" ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {!chartKey && (
                <div className="text-xs text-muted-foreground font-light">Load or generate a chart to start asking questions.</div>
              )}
              {chartKey && messages.length === 0 && (
                <div className="text-xs text-muted-foreground font-light leading-relaxed">
                  Ask about <span className="text-foreground/80">your dashas, houses, yogas, wealth indicators, marriage, career,</span> or any planet placement on this chart.
                  <div className="mt-2 text-muted-foreground/60">Tip: any dates ASHER mentions get auto-marked on the Vimshottari Timeline.</div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`text-xs leading-relaxed font-light ${m.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">{m.role === "user" ? "You" : "Asher"}</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>
              )}
            </div>
            <div className="p-3 border-t border-border/25 flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder={chartKey ? "Ask ASHER about this chart…" : "Load a chart first"}
                disabled={!chartKey || loading}
                rows={2}
                className="flex-1 resize-none rounded-md border border-border/30 bg-background/40 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-foreground/40 disabled:opacity-50"
              />
              <button
                onClick={() => void send()}
                disabled={!chartKey || loading || !input.trim()}
                className="rounded-md border border-foreground/20 bg-foreground/5 px-3 text-foreground hover:bg-foreground/10 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notes.length === 0 ? (
              <div className="text-xs text-muted-foreground font-light flex items-center gap-2">
                <StickyNote className="h-3.5 w-3.5" /> No notes yet for this chart.
              </div>
            ) : notes.map((n) => (
              <div key={n.id} className="rounded-md border border-border/25 bg-background/30 p-3 text-xs font-light">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-foreground/85 leading-relaxed">{n.note}</span>
                  <button onClick={() => void deleteNote(n.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Delete note">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
