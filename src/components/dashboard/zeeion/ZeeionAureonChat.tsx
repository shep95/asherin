import { useState, useRef, useEffect, useMemo } from "react";
import { Send, X, Sparkles, Loader2, Maximize2, Minimize2, DollarSign, AlertTriangle, BarChart3, FileText, Search, TrendingUp } from "lucide-react";
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

const ZeeionAsherinChat = ({ analysis }: Props) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Context-aware suggestions based on analysis data
  const contextSuggestions = useMemo(() => {
    const suggestions: { text: string; type: "question" | "action" | "analysis" }[] = [];
    const s = analysis.summary;
    if (!s) return suggestions;

    // Savings-based
    if (s.potentialSavings > 0) {
      suggestions.push({ text: "What's the quickest win for savings?", type: "question" });
      suggestions.push({ text: "Create implementation plan for top 3 savings", type: "action" });
    }

    // Anomaly-based
    if (s.anomalyCount > 0) {
      suggestions.push({ text: "Explain these unusual transactions", type: "question" });
      suggestions.push({ text: "Are any anomalies concerning enough to escalate?", type: "question" });
    }

    // Department-based
    if (s.departmentCount > 1) {
      const overBudget = analysis.departmentPerformance?.filter(d => d.totalSpending > d.budget) || [];
      if (overBudget.length > 0) {
        suggestions.push({ text: `Why is ${overBudget[0].department} over budget?`, type: "question" });
        suggestions.push({ text: "Suggest budget reallocation across departments", type: "analysis" });
      }
    }

    // Wasteful spending
    if (analysis.wastefulItems?.length) {
      const highSeverity = analysis.wastefulItems.filter(w => w.severity === "high");
      if (highSeverity.length > 0) {
        suggestions.push({ text: "Show me all critical wasteful spending items", type: "question" });
      }
      suggestions.push({ text: "How much can we save by eliminating all waste?", type: "analysis" });
    }

    // Efficiency
    if (s.efficiencyScore < 75) {
      suggestions.push({ text: "How can we improve our efficiency score?", type: "question" });
    }

    // Category
    if (analysis.categoryBreakdown?.length) {
      const top = analysis.categoryBreakdown[0];
      suggestions.push({ text: `Why is ${top.category} our largest expense?`, type: "question" });
    }

    return suggestions.slice(0, 6);
  }, [analysis]);

  // Generate follow-up suggestions after each AI response
  const generateFollowUps = (lastUserMsg: string, responseContent: string) => {
    const fups: string[] = [];
    const lower = responseContent.toLowerCase();

    if (lower.includes("vendor") || lower.includes("supplier")) {
      fups.push("Which vendors should we consolidate?");
      fups.push("Compare vendor pricing to market rates");
    }
    if (lower.includes("duplicate") || lower.includes("duplicate payment")) {
      fups.push("Show me all duplicate payments");
      fups.push("How do we prevent future duplicates?");
    }
    if (lower.includes("savings") || lower.includes("save")) {
      fups.push("Create a detailed savings action plan");
      fups.push("What's the ROI timeline for these savings?");
    }
    if (lower.includes("department") || lower.includes("budget")) {
      fups.push("Compare department efficiency scores");
      fups.push("Which department needs the most attention?");
    }
    if (lower.includes("anomal") || lower.includes("unusual")) {
      fups.push("Should we escalate any of these?");
      fups.push("What controls can prevent this?");
    }
    if (lower.includes("contract") || lower.includes("renegotiat")) {
      fups.push("Generate negotiation talking points");
      fups.push("What alternatives exist?");
    }

    // Always add generic useful ones if we have few
    if (fups.length < 2) {
      fups.push("Give me a one-page executive summary");
      fups.push("What should I prioritize this week?");
    }

    setFollowUps(fups.slice(0, 3));
  };

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
    setFollowUps([]);

    const userMsg: ChatMsg = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    let assistantContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    const systemContext = buildContext();
    const apiMessages = [
      { role: "user" as const, content: `[ZEEION FINANCIAL CONTEXT]\n${systemContext}\n\n---\nYou are Asherin, an expert AI financial analyst embedded in Zeeion Financial Intelligence. Answer questions about this financial data with specific numbers, actionable recommendations, and clear analysis. Be concise but thorough. Use the data provided above to answer accurately. When relevant, suggest specific action items the user can take. Format your responses with headers, bullet points, and bold text for key figures.` },
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
        onReplace: (text) => {
          assistantContent = text;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            }
            return [...prev, { role: "assistant", content: assistantContent }];
          });
        },
        onDone: () => {
          setLoading(false);
          generateFollowUps(msg, assistantContent);
        },
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error analyzing this data. Please try again." }]);
      }
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "Savings", q: "What are the biggest savings opportunities and how do I capture them?", icon: <DollarSign className="h-2.5 w-2.5" /> },
    { label: "Risks", q: "What are the most concerning spending patterns or anomalies?", icon: <AlertTriangle className="h-2.5 w-2.5" /> },
    { label: "Departments", q: "Which departments are performing well and which need attention?", icon: <BarChart3 className="h-2.5 w-2.5" /> },
    { label: "Summary", q: "Give me a concise executive summary with key action items.", icon: <FileText className="h-2.5 w-2.5" /> },
    { label: "Vendors", q: "Analyze our top vendors — who is overpriced, who should we consolidate?", icon: <Search className="h-2.5 w-2.5" /> },
    { label: "Trends", q: "What spending trends should I be aware of and what do they mean for next quarter?", icon: <TrendingUp className="h-2.5 w-2.5" /> },
  ];

  return (
    <div className={`flex flex-col rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm overflow-hidden transition-all ${expanded ? "fixed inset-4 z-50 bg-background/98" : "h-[600px]"}`}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
          <span className="text-[10px] font-light tracking-wider text-foreground/60">ASHERIN ANALYST</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
          <span className="text-[8px] text-muted-foreground/25">Ready to help</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors">
            {expanded ? <Minimize2 className="h-3 w-3 text-muted-foreground/40" /> : <Maximize2 className="h-3 w-3 text-muted-foreground/40" />}
          </button>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setFollowUps([]); }} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors">
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03] text-[9px] text-foreground/50 hover:bg-foreground/[0.06] transition-all"
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Context-aware suggestions (shown when no messages and no quick actions active) */}
      {messages.length === 0 && contextSuggestions.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-border/[0.03]">
          <p className="text-[8px] text-muted-foreground/25 mb-1.5">Based on your data:</p>
          <div className="flex flex-wrap gap-1">
            {contextSuggestions.slice(0, 4).map((s, i) => (
              <button
                key={i}
                onClick={() => send(s.text)}
                className="px-2 py-0.5 rounded-md bg-foreground/[0.02] border border-border/[0.05] text-[8px] text-foreground/40 hover:bg-foreground/[0.05] transition-all"
              >
                {s.type === "action" ? "→ " : s.type === "analysis" ? "📊 " : ""}{s.text}
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
              <p className="text-[11px] font-light text-foreground/40">Ask Asherin about your financial data</p>
              <p className="text-[9px] text-muted-foreground/25 mt-1">I have full context of your {analysis.summary?.totalRecords.toLocaleString()} records across {analysis.summary?.departmentCount} departments</p>
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

        {/* Follow-up suggestions after AI response */}
        {!loading && followUps.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
          <div className="pt-1">
            <p className="text-[8px] text-muted-foreground/25 mb-1.5">You might want to ask:</p>
            <div className="flex flex-col gap-1">
              {followUps.map((f, i) => (
                <button
                  key={i}
                  onClick={() => send(f)}
                  className="text-left px-2.5 py-1.5 rounded-lg border border-border/[0.06] bg-foreground/[0.02] text-[9px] text-foreground/45 hover:bg-foreground/[0.05] hover:text-foreground/60 transition-all"
                >
                  {f}
                </button>
              ))}
            </div>
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

export default ZeeionAsherinChat;
