import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { NotepadData, NotepadChatMessage } from "./types";

interface NotepadChatProps {
  data: NotepadData;
  onAiSort: () => void;
  sorting: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const NotepadChat = ({ data, onAiSort, sorting }: NotepadChatProps) => {
  const [messages, setMessages] = useState<NotepadChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const allNotesText = () => {
    const lines: string[] = [];
    data.branches.forEach(b => {
      lines.push(`[Branch: ${b.name}]`);
      b.notes.forEach(n => lines.push(`  - ${n.content}`));
    });
    if (data.unsorted.length) {
      lines.push("[Unsorted]");
      data.unsorted.forEach(n => lines.push(`  - ${n.content}`));
    }
    return lines.join("\n");
  };

  const askAureon = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    const userMsg: NotepadChatMessage = { role: "user", content: trimmed };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    try {
      let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) authToken = session.access_token;
      } catch { /* fallback */ }

      const notesCtx = allNotesText();
      const systemPrompt = `You are Aureon, an intelligent note-taking assistant. The user has the following notes in their notepad:\n\n${notesCtx}\n\nAnswer questions about these notes. Be concise, insightful, and reference specific notes when relevant. If they ask for summaries, patterns, or connections, analyze the notes deeply.`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: systemPrompt },
            { role: "assistant", content: "I've loaded your notes. What would you like to know?" },
            ...newMsgs.map(m => ({ role: m.role, content: m.content })),
          ],
          mode: "chat",
        }),
      });

      if (!resp.ok) throw new Error("AI request failed");

      // Stream response
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";

      const aiMsg: NotepadChatMessage = { role: "assistant", content: "" };
      setMessages(prev => [...prev, aiMsg]);

      if (reader) {
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let nlIdx: number;
          while ((nlIdx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nlIdx);
            buf = buf.slice(nlIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: full };
                  return copy;
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* AI Sort button */}
      <div className="px-3 pt-2 pb-1.5 border-b border-border/10">
        <button
          onClick={onAiSort}
          disabled={sorting}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500/80 text-[11px] font-medium transition-all disabled:opacity-40"
        >
          {sorting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {sorting ? "Sorting notes…" : "✨ Auto-sort notes into branches"}
        </button>
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-6 text-muted-foreground/25">
            <p className="text-[11px] font-light">Ask Aureon about your notes</p>
            <p className="text-[9px] mt-1 font-light italic">"Summarize my notes" · "Find connections" · "What am I missing?"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] font-light leading-relaxed ${
              msg.role === "user"
                ? "bg-primary/15 text-foreground"
                : "bg-muted/20 text-foreground/80"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-xs prose-invert max-w-none [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:font-light [&_li]:text-[11px] [&_strong]:font-medium">
                  <ReactMarkdown>{msg.content || "…"}</ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-muted/20 rounded-xl px-3 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-amber-500/50" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/10">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAureon(); } }}
          placeholder="Ask about your notes…"
          className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
          disabled={loading}
        />
        <button onClick={askAureon} disabled={loading || !input.trim()} className="p-1 rounded text-amber-500/60 hover:text-amber-500 disabled:opacity-30 transition-colors">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default NotepadChat;
