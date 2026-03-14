import { useState, useRef, useEffect } from "react";
import { Search, Send, Loader2, Sparkles, Database, Copy, Check, Download, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface QuiverMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  datasetsUsed?: string[];
}

const EXAMPLE_QUERIES = [
  "Which suppliers have the highest delay risk this quarter?",
  "Show me the top 10 records by revenue",
  "What are the data quality issues across all datasets?",
  "Compare trends between Q3 and Q4",
  "Which entities appear in multiple datasets?",
  "Summarize the key insights from my latest upload",
];

const QuiverPanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAshaSession();
  const { toast } = useToast();
  const [messages, setMessages] = useState<QuiverMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !activeSession || loading) return;
    const query = input.trim();
    setInput("");

    const userMsg: QuiverMessage = { id: crypto.randomUUID(), role: "user", content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Gather dataset context
      const { data: datasets } = await supabase
        .from("asha_datasets")
        .select("id, file_name, row_count, col_count, quality_score, schema, date_range, tags")
        .eq("user_id", user.id)
        .eq("session_id", activeSession.id)
        .eq("status", "ready");

      const datasetSummary = (datasets || []).map(ds => {
        const schema = (ds.schema as any[]) || [];
        return `Dataset "${ds.file_name}": ${ds.row_count} rows, ${ds.col_count} cols, quality ${ds.quality_score}%, columns: ${schema.map((c: any) => `${c.name}(${c.type})`).join(", ")}`;
      }).join("\n");

      const datasetNames = (datasets || []).map(d => d.file_name);

      // Call asha-query edge function
      const { data, error } = await supabase.functions.invoke("asha-query", {
        body: {
          query,
          sessionId: activeSession.id,
          datasetContext: datasetSummary,
          mode: "quiver",
        },
      });

      if (error) throw error;

      const answer = data?.response || data?.answer || "I could not generate an answer for that query.";

      const assistantMsg: QuiverMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        datasetsUsed: datasetNames,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Store query in asha_queries
      await supabase.from("asha_queries").insert({
        user_id: user.id,
        session_id: activeSession.id,
        query,
        response: answer,
        response_type: "quiver",
      });
    } catch (err: any) {
      const errMsg: QuiverMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err.message || "Failed to process query"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadAnswer = (content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiver-answer-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Quiver</h2>
        </div>
        <p className="text-xs font-extralight text-muted-foreground mt-1">Ask questions in plain language — get answers from all your connected datasets.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/15 mb-4" />
            <p className="text-sm font-extralight text-muted-foreground/40 mb-4">Ask anything about your data</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {EXAMPLE_QUERIES.map((q, i) => (
                <button key={i} onClick={() => setInput(q)} className="text-left px-3 py-2.5 rounded-xl border border-border/15 bg-card/20 text-[11px] font-light text-foreground/70 hover:border-accent/20 hover:bg-accent/5 transition-all">
                  <MessageSquare className="h-3 w-3 text-accent/40 mb-1" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-accent/10 border border-accent/20" : "bg-card/30 border border-border/15"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-[12px] font-light text-foreground/90 leading-relaxed mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-foreground font-medium">{children}</strong>,
                      li: ({ children }) => <li className="text-[12px] font-light text-foreground/80 ml-3">{children}</li>,
                      h3: ({ children }) => <h3 className="text-xs font-light text-foreground mt-3 mb-1">{children}</h3>,
                      code: ({ children }) => <code className="text-[10px] bg-foreground/5 px-1 py-0.5 rounded text-accent/80">{children}</code>,
                    }}
                  >{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[12px] font-light text-foreground/90">{msg.content}</p>
              )}

              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/10">
                  {msg.datasetsUsed && msg.datasetsUsed.length > 0 && (
                    <div className="flex items-center gap-1 text-[8px] text-muted-foreground/40">
                      <Database className="h-2.5 w-2.5" />
                      {msg.datasetsUsed.length} dataset{msg.datasetsUsed.length !== 1 ? "s" : ""} queried
                    </div>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => copyMessage(msg.id, msg.content)} className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors">
                      {copiedId === msg.id ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={() => downloadAnswer(msg.content)} className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors">
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card/30 border border-border/15">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              <span className="text-[11px] text-muted-foreground/50">Querying across datasets…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-6 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask a question about your data…"
            rows={1}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none resize-none"
          />
          <button onClick={handleSend} disabled={!input.trim() || loading} className="p-2 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-30 transition-all">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuiverPanel;
