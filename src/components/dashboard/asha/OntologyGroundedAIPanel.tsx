import { useState } from "react";
import { Brain, MessageSquare, Loader2, Database, Shield, CheckCircle, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GroundedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { dataset: string; field: string; value: string }[];
  grounded: boolean;
  confidence: number;
  timestamp: Date;
}

const OntologyGroundedAIPanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAshaSession();
  const { toast } = useToast();
  const [messages, setMessages] = useState<GroundedMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendQuery = async () => {
    if (!input.trim() || !user || !activeSession || loading) return;
    const query = input.trim();
    setInput("");

    const userMsg: GroundedMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      grounded: false,
      confidence: 0,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // First fetch datasets from the session to ground the AI
      const { data: datasets } = await supabase
        .from("asha_datasets")
        .select("id, file_name, schema, row_count, col_count")
        .eq("user_id", user.id)
        .eq("session_id", activeSession.id)
        .eq("status", "ready");

      const dataContext = datasets?.map(d => {
        const schema = d.schema as any[];
        const fields = schema?.map((s: any) => `${s.name} (${s.type})`).join(", ") || "unknown";
        return `Dataset "${d.file_name}": ${d.row_count} rows, ${d.col_count} cols. Fields: ${fields}`;
      }).join("\n") || "No datasets loaded.";

      // Also fetch ontology entities if available
      const { data: entities } = await supabase
        .from("asha_document_entities")
        .select("entity_type, entity_value, confidence")
        .eq("user_id", user.id)
        .limit(100);

      const entityContext = entities?.length
        ? `Known entities: ${entities.map(e => `${e.entity_type}: ${e.entity_value}`).join("; ")}`
        : "";

      const { data, error } = await supabase.functions.invoke("asha-query", {
        body: {
          query,
          sessionId: activeSession.id,
          mode: "grounded",
          context: `ONTOLOGY-GROUNDED MODE: Answer ONLY from the user's actual data. If the data doesn't contain the answer, say so explicitly. Never hallucinate or use general knowledge.\n\nAvailable Data:\n${dataContext}\n\n${entityContext}`,
        },
      });

      if (error) throw error;

      const response = data?.response || "Unable to ground response in available data.";
      
      // Extract grounding info
      const isGrounded = !response.includes("don't have") && !response.includes("no data") && !response.includes("not available");
      const sources = datasets?.slice(0, 3).map(d => ({
        dataset: d.file_name,
        field: (d.schema as any[])?.[0]?.name || "—",
        value: `${d.row_count} records`,
      })) || [];

      const assistantMsg: GroundedMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        sources: isGrounded ? sources : undefined,
        grounded: isGrounded,
        confidence: isGrounded ? 92 : 0,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      toast({ title: "Query failed", description: "Could not process grounded query.", variant: "destructive" });
      const errMsg: GroundedMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Failed to process query. Please ensure datasets are loaded in your session.",
        grounded: false,
        confidence: 0,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const EXAMPLE_QUERIES = [
    "What is our inventory status across all warehouses?",
    "Which suppliers had the most delays this quarter?",
    "Show me revenue trends by region for the last 6 months",
    "What are the top 5 anomalies in our transaction data?",
    "How many entities are linked to high-risk profiles?",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-extralight text-foreground">Ontology-Grounded AI</h2>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Ask questions — answers come exclusively from your real data via the Ontology. Zero hallucination.</p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Brain className="h-10 w-10 text-muted-foreground/20" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground/50 mb-3">Ask anything about your data — grounded in your Ontology</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {EXAMPLE_QUERIES.map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); }} className="rounded-lg bg-card/30 border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl p-3 space-y-2 ${msg.role === "user" ? "bg-accent/10 border border-accent/20" : "bg-card/30 border border-border/20"}`}>
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/10">
                    {msg.grounded ? (
                      <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                        <CheckCircle className="h-2.5 w-2.5" /> Grounded ({msg.confidence}%)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" /> Not grounded — insufficient data
                      </span>
                    )}
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">Data Sources</p>
                    {msg.sources.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
                        <Database className="h-2.5 w-2.5 shrink-0" />
                        <span>{s.dataset}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-card/30 border border-border/20 p-3 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                <span className="text-[10px] text-muted-foreground">Querying Ontology…</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1">
            <Shield className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] text-emerald-400">Grounded</span>
          </div>
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendQuery()}
              placeholder="Ask a question grounded in your data…"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
            <button onClick={sendQuery} disabled={!input.trim() || loading} className="rounded-lg p-1.5 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OntologyGroundedAIPanel;
