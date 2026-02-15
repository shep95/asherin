import { useState, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

interface QueryHistoryItem {
  id: string;
  query: string;
  response: string;
  response_type: string;
  created_at: string;
}

const EXAMPLE_QUERIES = [
  "Which columns have the most missing data?",
  "Summarize the key patterns in my datasets",
  "What are the potential data quality issues?",
  "Find relationships between my uploaded files",
  "What insights can you extract from my data?",
  "Suggest data cleaning steps",
];

const QueryBar = () => {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("asha_queries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setHistory(data as any);
      setInitialLoading(false);
    };
    load();
  }, [user]);

  const submitQuery = async () => {
    if (!query.trim() || loading) return;
    const q = query;
    setQuery("");
    setLoading(true);

    // Optimistic: add user query to history
    const tempId = crypto.randomUUID();
    setHistory((prev) => [...prev, { id: tempId, query: q, response: "", response_type: "text", created_at: new Date().toISOString() }]);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) throw new Error("Query failed");
      const result = await res.json();

      setHistory((prev) => prev.map((h) =>
        h.id === tempId ? { ...h, response: result.response, response_type: result.type } : h
      ));
    } catch (e) {
      setHistory((prev) => prev.map((h) =>
        h.id === tempId ? { ...h, response: "Failed to process query. Please try again." } : h
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!initialLoading && history.length === 0 && (
          <div className="text-center py-12 space-y-6">
            <div>
              <Sparkles className="h-8 w-8 text-accent/40 mx-auto mb-3" />
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Ask Asha Anything</h2>
              <p className="text-xs font-extralight text-muted-foreground mt-2">Query your data in plain English. No SQL required.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {EXAMPLE_QUERIES.map((eq) => (
                <button key={eq} onClick={() => setQuery(eq)} className="rounded-xl border border-border/20 bg-card/20 px-3 py-2.5 text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors text-left">
                  {eq}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((item) => (
          <div key={item.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="rounded-xl bg-foreground/10 px-4 py-2.5 max-w-md">
                <p className="text-sm font-light text-foreground">{item.query}</p>
              </div>
            </div>
            {item.response && (
              <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span className="text-[10px] text-accent font-light">Asha</span>
                </div>
                <div className="text-xs font-light text-foreground leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                  <ReactMarkdown>{item.response}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            Asha is analyzing your data…
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-border/20">
        <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-3">
          <Sparkles className="h-4 w-4 text-accent/40 shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitQuery()} placeholder="Ask anything about your data…" className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
          <button onClick={submitQuery} disabled={!query.trim() || loading} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 text-center mt-2">End-to-end encrypted · PII auto-masked</p>
      </div>
    </div>
  );
};

export default QueryBar;
