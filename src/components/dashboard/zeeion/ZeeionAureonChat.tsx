import { useState, useRef, useEffect } from "react";
import { Send, X, Sparkles, Loader2, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/ai";
import type { AnalysisResult } from "./ZeeionView";

interface Props {
  analysis: AnalysisResult;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const ZeeionAureonChat = ({ analysis }: Props) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Build context from analysis
  const buildContext = () => {
    const s = analysis.summary;
    const parts: string[] = [];
    parts.push(`File: ${analysis.fileName}`);
    if (s) {
      parts.push(`Total Spending: $${s.totalSpending.toLocaleString()}`);
      parts.push(`Potential Savings: $${s.potentialSavings.toLocaleString()}`);
      parts.push(`Efficiency Score: ${s.efficiencyScore}/100`);
      parts.push(`Anomalies: ${s.anomalyCount}`);
      parts.push(`Wasteful Spending: $${s.wastefulSpending.toLocaleString()}`);
      parts.push(`Records: ${s.totalRecords.toLocaleString()}`);
      parts.push(`Departments: ${s.departmentCount}`);
    }
    if (analysis.executiveSummary) parts.push(`Executive Summary: ${analysis.executiveSummary}`);
    if (analysis.wastefulItems?.length) {
      parts.push("Wasteful Items: " + analysis.wastefulItems.map(w => `${w.description} ($${w.annualCost.toLocaleString()}/yr, ${w.severity})`).join("; "));
    }
    if (analysis.savingsOpportunities?.length) {
      parts.push("Savings: " + analysis.savingsOpportunities.map(o => `${o.description} (save $${o.projectedSavings.toLocaleString()}/yr, ${o.confidence}% conf)`).join("; "));
    }
    if (analysis.departmentPerformance?.length) {
      parts.push("Departments: " + analysis.departmentPerformance.map(d => `${d.department}: $${d.totalSpending.toLocaleString()} spent, ${d.efficiencyScore}/100 score, ${d.variance.toFixed(1)}% variance`).join("; "));
    }
    if (analysis.categoryBreakdown?.length) {
      parts.push("Categories: " + analysis.categoryBreakdown.map(c => `${c.category}: $${c.amount.toLocaleString()} (${c.percentage}%)`).join("; "));
    }
    if (analysis.anomalies?.length) {
      parts.push("Anomalies: " + analysis.anomalies.map(a => `[${a.severity}] ${a.description}`).join("; "));
    }
    return parts.join("\n");
  };

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: ChatMsg = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    let assistantContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    const systemContext = buildContext();
    const apiMessages = [
      { role: "user" as const, content: `[ZEEION FINANCIAL CONTEXT]\n${systemContext}\n\n---\nYou are Aureon, an expert AI financial analyst embedded in Zeeion Financial Intelligence. Answer questions about this financial data with specific numbers, actionable recommendations, and clear analysis. Be concise but thorough. Use the data provided above to answer accurately.` },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: msg },
    ];

    try {
      await streamChat({
        messages: apiMessages,
        mode: "research",
        signal: controller.signal,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            }
            return [...prev, { role: "assistant", content: assistantContent }];
          });
        },
        onDone: () => setLoading(false),
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error analyzing this data. Please try again." }]);
      }
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "Savings", q: "What are the biggest savings opportunities and how do I capture them?" },
    { label: "Risks", q: "What are the most concerning spending patterns or anomalies?" },
    { label: "Departments", q: "Which departments are performing well and which need attention?" },
    { label: "Summary", q: "Give me a concise executive summary with key action items." },
  ];

  return (
    <div className={`flex flex-col rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm overflow-hidden transition-all ${expanded ? "fixed inset-4 z-50 bg-background/98" : "h-[500px]"}`}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
          <span className="text-[10px] font-light tracking-wider text-foreground/60">AUREON ANALYST</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors">
            {expanded ? <Minimize2 className="h-3 w-3 text-muted-foreground/40" /> : <Maximize2 className="h-3 w-3 text-muted-foreground/40" />}
          </button>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors">
              <X className="h-3 w-3 text-muted-foreground/40" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="shrink-0 px-4 py-3 border-b border-border/[0.04]">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={() => send(a.q)}
                className="px-2.5 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03] text-[9px] text-foreground/50 hover:bg-foreground/[0.06] transition-all"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/15" />
            <div>
              <p className="text-[11px] font-light text-foreground/40">Ask Aureon about your financial data</p>
              <p className="text-[9px] text-muted-foreground/25 mt-1">I have full context of your analysis results</p>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
              m.role === "user"
                ? "bg-foreground/[0.08] border border-border/[0.08] text-foreground/70"
                : "bg-foreground/[0.03] border border-border/[0.05] text-foreground/60"
            }`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-[10px] leading-relaxed font-light [&_p]:my-1 [&_li]:my-0.5 [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[10px] [&_code]:text-[9px] [&_strong]:text-foreground/70">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[10px] font-light">{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 text-muted-foreground/30 animate-spin" />
            <span className="text-[9px] text-muted-foreground/30">Analyzing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2.5 border-t border-border/[0.06]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about spending, savings, departments..."
            className="flex-1 bg-transparent text-[10px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none font-light"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] disabled:opacity-30 transition-all"
          >
            <Send className="h-3 w-3 text-foreground/50" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZeeionAureonChat;
