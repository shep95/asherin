import { useState, useRef, useEffect } from "react";
import { Search, Send, Loader2, Sparkles, Copy, Check, Download, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface NomadQuiverProps {
  entities: { type: string; value: string; confidence: number }[];
  investigations: { query: string; findings: string; created_at: string }[];
}

interface QMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const EXAMPLES = [
  "Who are the most connected entities in my investigations?",
  "What locations appear across multiple cases?",
  "Summarize all financial transactions discovered",
  "Which phone numbers link to multiple persons?",
  "Find patterns between the latest investigations",
];

const NomadQuiver = ({ entities, investigations }: NomadQuiverProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<QMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput("");

    const userMsg: QMsg = { id: crypto.randomUUID(), role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build context from entities and investigations
      const entitySummary = entities.slice(0, 50).map(e => `${e.type}: ${e.value} (${Math.round(e.confidence * 100)}%)`).join("\n");
      const invSummary = investigations.slice(0, 10).map(inv => `Query: ${inv.query}\nFindings: ${inv.findings.slice(0, 300)}`).join("\n---\n");

      const context = `ENTITY DATABASE (${entities.length} total):\n${entitySummary}\n\nINVESTIGATION HISTORY (${investigations.length} total):\n${invSummary}`;

      // Use nomad-investigate with quiver mode context
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      // Prepend context
      const messagesForAI: { role: "user" | "assistant"; content: string }[] = [];
      if (messages.length > 0) {
        messagesForAI.push(...history.slice(0, -1));
      }
      messagesForAI.push({ role: "user", content: `[QUIVER QUERY MODE]\nContext:\n${context}\n\nQuestion: ${query}` });

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nomad-investigate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: messagesForAI }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Query failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIdx);
          textBuffer = textBuffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  };

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex-shrink-0 px-6 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Quiver</h2>
        </div>
        <p className="text-xs font-extralight text-muted-foreground mt-1">Ask questions in plain language about your intelligence data.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-10">
            <Search className="h-8 w-8 text-muted-foreground/15 mb-4" />
            <p className="text-xs text-muted-foreground/40 mb-4">Query your intelligence graph</p>
            <div className="grid grid-cols-1 gap-1.5 w-full max-w-md">
              {EXAMPLES.map((q, i) => (
                <button key={i} onClick={() => setInput(q)} className="text-left px-3 py-2 rounded-xl border border-border/12 bg-card/15 text-[11px] font-light text-foreground/60 hover:border-border/25 hover:bg-foreground/[0.03] transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-foreground/[0.06] border border-border/25" : "bg-card/30 border border-border/15"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-[12px] font-light text-foreground/90 leading-relaxed mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-foreground font-medium">{children}</strong>,
                      li: ({ children }) => <li className="text-[12px] font-light text-foreground/80 ml-3">{children}</li>,
                    }}
                  >{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[12px] font-light text-foreground/90">{msg.content}</p>
              )}
              {msg.role === "assistant" && msg.content && (
                <div className="flex gap-1 mt-2 pt-1 border-t border-border/10">
                  <button onClick={() => copyMsg(msg.id, msg.content)} className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors">
                    {copiedId === msg.id ? <Check className="h-3 w-3 text-foreground" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card/30 border border-border/15">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
              <span className="text-[11px] text-muted-foreground/50">Querying intelligence graph…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-6 pb-6 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask about your intelligence data…"
            rows={1}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none resize-none"
          />
          <button onClick={handleSend} disabled={!input.trim() || loading} className="p-2 rounded-xl bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1] disabled:opacity-30 transition-all">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NomadQuiver;
