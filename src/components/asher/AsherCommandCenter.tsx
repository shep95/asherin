// ASHER AI · Command Center — native dark-themed chat that streams from
// the asher-ai edge function (Gemini, BYOK or admin key). Matches the
// Asher Dashboard theme exactly: black, monochrome, minimal, surgical.
// Active brains from ASHER BRAINS are auto-injected into the system prompt.

import { useEffect, useRef, useState } from "react";
import { Brain, Send, Loader2, Trash2, Sparkles, ShieldCheck, Database, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAsherEvent } from "@/lib/asherAudit";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { buildBrainContext } from "@/lib/asherBrains";
import { useAuth } from "@/contexts/AuthContext";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "asher_command_center_history_v2";
const ADMIN_EMAIL = "ashernewtonx@gmail.com";

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "**ASHER AI · Online**\n\nDirect tactical co-pilot. No filler. No moralizing.\n\nAsk me anything — strategy, OSINT reasoning, code, doctrine, intel synthesis. " +
    "Active personality + knowledge brains are loaded into context automatically.",
};

const AsherCommandCenter = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [WELCOME];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeBrainCount, setActiveBrainCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { document.title = "ASHER AI — Command Center"; }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch {}
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Surface active-brain count for the operator (admin only).
  useEffect(() => {
    if (!isAdmin) { setActiveBrainCount(null); return; }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("asher_brains")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (!cancelled) setActiveBrainCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, messages.length]);

  const reset = () => {
    setMessages([WELCOME]);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setBusy(true);
    logAsherEvent("module_open", { module: "asher_command_send", chars: text.length });

    try {
      // Pull active brains (admin only — RLS returns [] for others).
      const brainContext = await buildBrainContext().catch(() => null);
      const byok = getActiveIntelMapByok();

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-ai`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          ...(byok ? { "x-byok-gemini-key": byok.apiKey } : {}),
        },
        body: JSON.stringify({
          messages: [
            ...messages.filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
          mapContext: { surface: "command_center" },
          brainContext,
        }),
      });

      if (resp.status === 429) { toast.error("Rate limit — slow down."); setBusy(false); return; }
      if (resp.status === 401) { toast.error("ASHER AI key invalid. Add a BYOK Gemini key in Settings."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setBusy(false); return; }
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(`Stream failed (${resp.status}) ${t.slice(0, 120)}`);
      }

      const assistantId = crypto.randomUUID();
      let assistantText = "";
      setMessages((p) => [...p, { id: assistantId, role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantText += delta.content;
              setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m));
            }
          } catch {
            buf = line + "\n" + buf; break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "ASHER AI failed");
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: `_Stream failed: ${e?.message || e}_` }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-background text-foreground">
      {/* Toolbar — matches Asher dashboard theme */}
      <div className="shrink-0 flex items-center justify-between border-b border-border/15 px-4 py-2.5 bg-card/30 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <Brain className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase truncate">
            ASHER AI · Command Center
          </p>
          <span className="text-[9px] font-light tracking-[0.25em] text-emerald-400/70 uppercase">Live</span>
        </div>
        <div className="flex items-center gap-2">
          {activeBrainCount !== null && (
            <span
              title="Active brains injected into the system prompt"
              className="flex items-center gap-1 rounded-md border border-border/20 bg-foreground/5 px-2 py-0.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase"
            >
              <Database className="h-2.5 w-2.5" strokeWidth={1.8} />
              {activeBrainCount} Brains
            </span>
          )}
          <span
            title="Encrypted in transit · Audit logged"
            className="flex items-center gap-1 rounded-md border border-border/20 bg-foreground/5 px-2 py-0.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase"
          >
            <ShieldCheck className="h-2.5 w-2.5" strokeWidth={1.8} />
            Secure
          </span>
          <button
            onClick={reset}
            title="Clear conversation"
            className="flex items-center gap-1 rounded-md border border-border/20 bg-foreground/5 px-2 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/10 uppercase"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
            Reset
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-[13px] font-light leading-relaxed ${
                  m.role === "user"
                    ? "bg-foreground/10 text-foreground border border-border/15"
                    : "bg-card/40 text-foreground/90 border border-border/10 backdrop-blur-sm"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2 opacity-60">
                    <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                    <span className="text-[8px] font-light tracking-[0.3em] uppercase">Asher</span>
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-light prose-headings:tracking-wide prose-strong:font-normal prose-strong:text-foreground prose-code:text-foreground/90 prose-code:bg-foreground/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/60 prose-pre:border prose-pre:border-border/20 prose-table:text-[11px] prose-th:font-light prose-th:tracking-wide prose-th:uppercase prose-th:text-muted-foreground prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 prose-li:my-0.5">
                  <ReactMarkdown>{m.content || (busy ? "…" : " ")}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-border/10 bg-card/40 backdrop-blur-sm px-4 py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/15 bg-card/30 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-xl border border-border/20 bg-background/40 px-3 py-2 focus-within:border-foreground/30 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Speak to ASHER…  (Enter to send · Shift+Enter for newline)"
              rows={1}
              disabled={busy}
              className="flex-1 resize-none bg-transparent text-[13px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none max-h-40 leading-relaxed disabled:opacity-50"
              style={{ height: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
            />
            <button
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-foreground/90 px-3 py-2 text-[10px] font-light tracking-[0.2em] text-background uppercase hover:bg-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Send
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
            <span className="flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" strokeWidth={1.8} /> Audit-logged · No filler responses
            </span>
            <span>{messages.length - 1} messages</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsherCommandCenter;
