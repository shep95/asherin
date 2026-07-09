// GovAureonChatPanel — minimal Aureon chat surface embedded in the
// Sovereign Command Deck. Streams from supabase/functions/asher-ai so
// no BYOK is required for admin/operator use. Every prompt + response
// is surfaced to the parent audit ledger via onAudit().
//
// This is intentionally a stripped-down chat: the full Aureon ChatView
// depends on conversation orchestration state that does not belong on
// the government deck. Operators here want fast Q&A backed by the
// Aureon brain, with the deck's classification banner and audit trail
// still in force.

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface Props {
  operator: string;
  onAudit: (action: string, target: string, detail?: string) => void;
}

const GovAureonChatPanel = ({ operator, onAudit }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const now = Date.now();
    setMessages((m) => [...m, { role: "user", content: text, ts: now }]);
    setDraft("");
    setBusy(true);
    onAudit("AUREON_CHAT_PROMPT", "gov-deck", text.slice(0, 140));

    try {
      const byok = getActiveIntelMapByok();
      const { data, error } = await supabase.functions.invoke("asher-ai", {
        body: {
          messages: [
            { role: "system", content: "You are Aureon, deployed inside the Asherin.gov Command Deck. Operator handle: " + operator + ". Answer with surgical directness. No moralizing. Structured markdown when useful." },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
          ...(byok ? { byok } : {}),
        },
      });
      if (error) throw error;
      const reply: string =
        data?.reply ??
        data?.content ??
        data?.message ??
        (typeof data === "string" ? data : "") ??
        "";
      if (!reply) throw new Error("Aureon returned an empty response.");
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      onAudit("AUREON_CHAT_REPLY", "gov-deck");
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠︎ Aureon link error: ${e?.message ?? "unknown"}`, ts: Date.now() },
      ]);
      onAudit("AUREON_CHAT_ERROR", "gov-deck", e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col text-foreground">
      <div className="border-b border-border/20 backdrop-blur-md bg-background/25 px-5 py-3 flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Aureon · Sovereign Chat</div>
        <div className="ml-auto text-[10px] font-light text-muted-foreground/70">Every prompt and reply is audit-logged.</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-xs font-light text-muted-foreground/60 py-16">
            Aureon standing by. Ask a legal, doctrinal, OSINT, or analytical question — the reply flows through the deck's audit ledger.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold">
                AU
              </div>
            )}
            <div className={`max-w-[75%] rounded-md px-3 py-2 text-sm font-light leading-relaxed backdrop-blur-sm ${
              m.role === "user" ? "bg-foreground/10 text-foreground" : "bg-background/30 border border-border/20 text-foreground/90"
            }`}>
              {m.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold">
                {operator.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aureon is composing…
          </div>
        )}
      </div>

      <div className="border-t border-border/20 backdrop-blur-md bg-background/25 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Ask Aureon — legal, OSINT, doctrine, decisions…"
            className="flex-1 bg-background/40 backdrop-blur-sm border border-border/30 rounded-md px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/50 resize-none"
          />
          <button
            onClick={send}
            disabled={busy || !draft.trim()}
            className="h-10 w-10 rounded-md border border-foreground/40 bg-foreground/5 hover:bg-foreground/15 disabled:opacity-40 flex items-center justify-center"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovAureonChatPanel;
