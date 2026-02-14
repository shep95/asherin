import { useState } from "react";
import { Send, Sparkles, Table2, BarChart3, Loader2 } from "lucide-react";

interface QueryResult {
  type: "text" | "table" | "chart";
  content: string;
}

const EXAMPLE_QUERIES = [
  "Which customers spent the most in Q4?",
  "Is there a correlation between marketing spend and signups?",
  "Find unusual patterns in last month's transactions",
  "Compare revenue by region year-over-year",
  "Which customers haven't ordered in 90 days?",
  "Show me everything connected to customer ID 4721",
];

const QueryBar = () => {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<{ query: string; result: QueryResult }[]>([]);
  const [loading, setLoading] = useState(false);

  const submitQuery = () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    const q = query;
    setQuery("");

    // Simulate AI response
    setTimeout(() => {
      setHistory((prev) => [
        ...prev,
        {
          query: q,
          result: {
            type: "text",
            content: `Based on analysis of your uploaded datasets, here's what I found for "${q}":\n\n• Top 5 customers by Q4 spend: Alice Chen ($42,100), Bob Martinez ($38,750), Carol Williams ($35,200), David Kim ($31,890), Eva Novak ($29,440)\n• Total Q4 revenue: $2.4M across 47,832 transactions\n• Enterprise segment drives 62% of total revenue\n• Average transaction value: $502.30\n\nWould you like me to chart this data or drill deeper into any segment?`,
          },
        },
      ]);
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="flex h-full flex-col max-w-3xl mx-auto">
      {/* Query history */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {history.length === 0 && (
          <div className="text-center py-12 space-y-6">
            <div>
              <Sparkles className="h-8 w-8 text-accent/40 mx-auto mb-3" />
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Ask Asha Anything</h2>
              <p className="text-xs font-extralight text-muted-foreground mt-2">Query your data in plain English. No SQL required.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {EXAMPLE_QUERIES.map((eq) => (
                <button
                  key={eq}
                  onClick={() => { setQuery(eq); }}
                  className="rounded-xl border border-border/20 bg-card/20 px-3 py-2.5 text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors text-left"
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((item, i) => (
          <div key={i} className="space-y-3">
            {/* User query */}
            <div className="flex justify-end">
              <div className="rounded-xl bg-foreground/10 px-4 py-2.5 max-w-md">
                <p className="text-sm font-light text-foreground">{item.query}</p>
              </div>
            </div>
            {/* Asha response */}
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="text-[10px] text-accent font-light">Asha</span>
              </div>
              <p className="text-xs font-light text-foreground leading-relaxed whitespace-pre-wrap">{item.result.content}</p>
              <div className="flex items-center gap-2 mt-3">
                <button className="rounded-md bg-foreground/10 px-3 py-1 text-[10px] text-foreground hover:bg-foreground/15 transition-colors flex items-center gap-1">
                  <Table2 className="h-2.5 w-2.5" />
                  View as Table
                </button>
                <button className="rounded-md bg-foreground/10 px-3 py-1 text-[10px] text-foreground hover:bg-foreground/15 transition-colors flex items-center gap-1">
                  <BarChart3 className="h-2.5 w-2.5" />
                  Chart It
                </button>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            Asha is analyzing your data…
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border/20">
        <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-3">
          <Sparkles className="h-4 w-4 text-accent/40 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitQuery()}
            placeholder="Ask anything about your data…"
            className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
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
