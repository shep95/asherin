import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, X, ArrowDown, Copy, Check, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AxrlenSession } from "./AxrlenView";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  session: AxrlenSession;
  onClose: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/axrlen-chat`;

const AxrlenChat = ({ session, onClose }: Props) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
    setShowScrollBtn(!atBottom);
  }, []);

  const copyMsg = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const sessionContext = {
        title: session.title,
        region: session.region,
        confidenceScore: session.confidenceScore,
        status: session.status,
        aiSummary: session.aiSummary,
        predictions: session.predictions,
        threatAssessment: session.threatAssessment,
        resourceAnalysis: session.resourceAnalysis,
        policySimulations: session.policySimulations,
        timelineDivergences: session.timelineDivergences,
        dataSources: session.dataSources,
      };

      let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.access_token) authToken = s.access_token;
      } catch {}

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {}
        }
      }
    } catch (err: any) {
      upsert(`\n\n⚠️ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "What are the highest risk predictions?",
    "Summarize the threat assessment",
    "What actions should be taken first?",
    "Compare the timeline divergences",
    "What data sources were used?",
  ];

  return (
    <div className="w-[340px] border-l border-border/[0.08] flex flex-col bg-background/95 backdrop-blur-md">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-foreground/40" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-foreground/60 font-medium">AUREON Intelligence</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-foreground/[0.06] transition-all">
          <X className="h-3.5 w-3.5 text-muted-foreground/40" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 space-y-3 relative">
        {messages.length === 0 && (
          <div className="space-y-4 py-6">
            <p className="text-[10px] text-muted-foreground/30 text-center font-light">
              Ask AUREON about this session's predictions, threats, and analysis
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); }}
                  className="w-full text-left px-3 py-2 rounded-xl border border-border/[0.08] bg-foreground/[0.02] text-[9px] text-foreground/50 hover:bg-foreground/[0.05] transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`group ${m.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
            <div className={`relative max-w-[90%] rounded-xl px-3 py-2.5 text-[12px] leading-relaxed ${
              m.role === "user"
                ? "bg-foreground/[0.08] text-foreground/80"
                : "bg-foreground/[0.03] border border-border/[0.08] text-foreground/70"
            }`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none select-text [&_p]:mb-1.5 [&_p]:last:mb-0 [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_pre]:bg-black/40 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-[10px] [&_ul]:space-y-0.5 [&_li]:text-[11px] [&_h3]:text-[11px] [&_h3]:font-medium [&_h3]:text-foreground/70 [&_strong]:text-foreground/80">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="select-text">{m.content}</span>
              )}
              <div className="flex items-center justify-end mt-1">
                <button onClick={() => copyMsg(m.content, i)}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-80 transition p-0.5" title="Copy">
                  {copiedIdx === i ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
            <span className="text-[9px] text-muted-foreground/30">Analyzing session data...</span>
          </div>
        )}

        <div ref={endRef} />

        {showScrollBtn && (
          <button onClick={() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); setShowScrollBtn(false); }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-foreground/[0.1] text-[9px] text-foreground/50 font-medium shadow-lg hover:bg-foreground/[0.15] transition z-10">
            <ArrowDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-border/[0.06]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about this session..."
            className="flex-1 bg-foreground/[0.03] border border-border/[0.08] rounded-xl px-3 py-2 text-[11px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none focus:border-foreground/[0.15] transition-all"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-xl bg-foreground/[0.06] border border-border/[0.08] hover:bg-foreground/[0.1] disabled:opacity-30 transition-all">
            <Send className="h-3.5 w-3.5 text-foreground/50" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AxrlenChat;
