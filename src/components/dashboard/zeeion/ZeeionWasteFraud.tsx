import { useState, useCallback } from "react";
import { Loader2, AlertTriangle, Search, Shield, DollarSign, Users, FileWarning, Layers, ChevronRight, Send, Sparkles, X, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/ai";
import ZeeionWasteTracker, { type WasteItem, type WasteStatus } from "./ZeeionWasteTracker";
import ZeeionWasteExport from "./ZeeionWasteExport";
import ReactMarkdown from "react-markdown";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "PE", name: "Peru" },
  { code: "MX", name: "Mexico" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "ID", name: "Indonesia" },
];

interface WasteResult {
  totalWaste: number;
  percentOfBudget: number;
  patterns: {
    type: string;
    description: string;
    estimatedWaste: number;
    severity: "high" | "medium" | "low";
    evidence: string;
    recommendation: string;
  }[];
  executiveSummary: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string }

const fmtUsd = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
};

const severityConfig = {
  high: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10 border-red-500/10", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  medium: { label: "High Priority", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/10", icon: <FileWarning className="h-3.5 w-3.5" /> },
  low: { label: "Monitor", color: "text-muted-foreground/50", bg: "bg-foreground/[0.04] border-border/[0.06]", icon: <Search className="h-3.5 w-3.5" /> },
};

const ZeeionWasteFraud = () => {
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WasteResult | null>(null);
  const [rawGovData, setRawGovData] = useState<any>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);
  const [viewMode, setViewMode] = useState<"scan" | "tracker">("scan");
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);

  // Convert scan results to trackable waste items
  const convertToWasteItems = (res: WasteResult): WasteItem[] => {
    return res.patterns.map((p, i) => ({
      id: `waste-${Date.now()}-${i}`,
      type: p.type,
      description: p.description,
      amount: p.estimatedWaste,
      annualImpact: p.estimatedWaste,
      discoveredDate: new Date().toISOString().split("T")[0],
      status: "identified" as WasteStatus,
      confidence: p.severity === "high" ? 92 : p.severity === "medium" ? 78 : 60,
      severity: p.severity,
      evidence: p.evidence,
      recommendation: p.recommendation,
      progress: 0,
      timeline: [{
        date: new Date().toISOString().split("T")[0],
        status: "identified" as WasteStatus,
        action: "AI detected waste pattern",
        user: "Aureon AI"
      }],
      remediationPlan: null,
    }));
  };

  const handleUpdateStatus = (id: string, newStatus: WasteStatus) => {
    setWasteItems(prev => prev.map(w => w.id === id ? {
      ...w,
      status: newStatus,
      progress: newStatus === "fully_resolved" ? 100 : newStatus === "in_progress" ? 50 : newStatus === "under_review" ? 10 : w.progress,
      timeline: [...(w.timeline || []), { date: new Date().toISOString().split("T")[0], status: newStatus, action: `Status updated to ${newStatus.replace(/_/g, " ")}`, user: "User" }],
    } : w));
  };

  const handleCreatePlan = async (item: WasteItem) => {
    setGeneratingPlan(item.id);
    let planContent = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: `Generate a detailed step-by-step remediation plan for this government waste item:\n\nType: ${item.type}\nDescription: ${item.description}\nAnnual Impact: ${fmtUsd(item.annualImpact)}\nSeverity: ${item.severity}\nEvidence: ${item.evidence || "N/A"}\n\nReturn a JSON object with this structure (no markdown):\n{\n  "phases": [\n    {"name": "Investigation", "duration": "1-2 weeks", "steps": [{"action": "step desc", "responsible": "team", "timeline": "3 days", "status": "pending"}]},\n    {"name": "Solution Design", "duration": "1-2 weeks", "steps": [...]},\n    {"name": "Implementation", "duration": "4-8 weeks", "steps": [...]},\n    {"name": "Monitoring", "duration": "90 days", "steps": [...]}\n  ],\n  "totalCost": 50000,\n  "expectedSavings": ${item.annualImpact},\n  "roi": 500,\n  "paybackPeriod": "3 months",\n  "budgetRedirection": [\n    {"destination": "Debt Reduction", "amount": ${item.annualImpact * 0.3}, "percentage": 30, "rationale": "reason"},\n    {"destination": "Infrastructure", "amount": ${item.annualImpact * 0.25}, "percentage": 25, "rationale": "reason"},\n    {"destination": "Education/Healthcare", "amount": ${item.annualImpact * 0.25}, "percentage": 25, "rationale": "reason"},\n    {"destination": "Innovation Fund", "amount": ${item.annualImpact * 0.1}, "percentage": 10, "rationale": "reason"},\n    {"destination": "Emergency Reserve", "amount": ${item.annualImpact * 0.1}, "percentage": 10, "rationale": "reason"}\n  ]\n}` }],
        mode: "research",
        onDelta: (chunk) => { planContent += chunk; },
        onDone: () => {},
      });
      const jsonMatch = planContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        setWasteItems(prev => prev.map(w => w.id === item.id ? {
          ...w,
          status: "plan_created" as WasteStatus,
          remediationPlan: plan,
          timeline: [...(w.timeline || []), { date: new Date().toISOString().split("T")[0], status: "plan_created" as WasteStatus, action: "AI-generated remediation plan created", user: "Aureon AI" }],
        } : w));
      }
    } catch (e) { console.error("Plan generation failed:", e); }
    setGeneratingPlan(null);
  };

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setChatMsgs([]);
    try {
      // Fetch gov data
      const calls = [
        supabase.functions.invoke("gov-data", { body: { action: "world_bank_indicators", params: { countryCode: country } } }),
        supabase.functions.invoke("gov-data", { body: { action: "spending_by_agency" } }),
        supabase.functions.invoke("gov-data", { body: { action: "country_comparison", params: { countries: [country, "US", "GB", "DE", "JP"], indicator: "GC.XPN.TOTL.GD.ZS" } } }),
      ];
      const [wbRes, usaRes, compRes] = await Promise.all(calls);

      const govData = { worldBank: wbRes.data, usaSpending: usaRes.data, comparison: compRes.data };
      setRawGovData(govData);

      const countryName = COUNTRIES.find(c => c.code === country)?.name || country;

      // Build context for AI analysis
      const ctx: string[] = [];
      ctx.push(`Country: ${countryName} (${country})`);
      if (govData.worldBank?.indicators) {
        const gdp = govData.worldBank.indicators["NY.GDP.MKTP.CD"]?.[0];
        const exp = govData.worldBank.indicators["GC.XPN.TOTL.GD.ZS"]?.[0];
        const debt = govData.worldBank.indicators["GC.DOD.TOTL.GD.ZS"]?.[0];
        const mil = govData.worldBank.indicators["MS.MIL.XPND.GD.ZS"]?.[0];
        const health = govData.worldBank.indicators["SH.XPD.CHEX.GD.ZS"]?.[0];
        const edu = govData.worldBank.indicators["SE.XPD.TOTL.GD.ZS"]?.[0];
        if (gdp) ctx.push(`GDP: $${(gdp.value / 1e12).toFixed(2)}T (${gdp.date})`);
        if (exp) ctx.push(`Government Expense: ${exp.value.toFixed(2)}% of GDP`);
        if (debt) ctx.push(`Government Debt: ${debt.value.toFixed(2)}% of GDP`);
        if (mil) ctx.push(`Military Spending: ${mil.value.toFixed(2)}% of GDP`);
        if (health) ctx.push(`Health Spending: ${health.value.toFixed(2)}% of GDP`);
        if (edu) ctx.push(`Education Spending: ${edu.value.toFixed(2)}% of GDP`);
      }
      if (govData.usaSpending?.agencies && country === "US") {
        ctx.push(`Total Federal Budget: $${(govData.usaSpending.totalBudget / 1e12).toFixed(2)}T`);
        ctx.push("Top Agencies: " + govData.usaSpending.agencies.slice(0, 15).map((a: any) => `${a.name}: ${fmtUsd(a.budgetAuthority)}`).join("; "));
      }
      if (govData.comparison?.countries) {
        ctx.push("Peer Comparison (Govt Expense % GDP): " + govData.comparison.countries.map((c: any) => `${c.countryName}: ${c.value?.toFixed(2)}%`).join("; "));
      }

      // AI waste analysis
      let aiContent = "";
      await streamChat({
        messages: [
          { role: "user", content: `[GOV FINANCIAL DATA]\n${ctx.join("\n")}\n\n---\nYou are Aureon's Waste & Fraud Detection Engine. Analyze this government's financial data and identify ALL forms of waste, fraud, and inefficiency.\n\nReturn your analysis as a JSON object with this EXACT structure (no markdown, just JSON):\n{\n  "totalWaste": <number in USD>,\n  "percentOfBudget": <number>,\n  "patterns": [\n    {\n      "type": "duplicate_payments|ghost_employees|overpriced_contracts|inactive_programs|shell_companies|contract_splitting|administrative_overhead|procurement_fraud",\n      "description": "<detailed description>",\n      "estimatedWaste": <number in USD>,\n      "severity": "high|medium|low",\n      "evidence": "<specific evidence from data>",\n      "recommendation": "<actionable recommendation>"\n    }\n  ],\n  "executiveSummary": "<3-4 paragraph executive summary of waste findings>"\n}\n\nBe forensic and specific. Use real data patterns. Estimate real dollar amounts based on the budget data. Include at least 6-8 waste patterns. For ${countryName}, consider country-specific corruption patterns and governance issues.` },
        ],
        mode: "research",
        onDelta: (chunk) => { aiContent += chunk; },
        onDone: () => {},
      });

      // Parse result
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setResult(parsed);
          // Convert to trackable waste items
          const items = convertToWasteItems(parsed);
          setWasteItems(items);
        }
      } catch {
        setResult({
          totalWaste: 0,
          percentOfBudget: 0,
          patterns: [],
          executiveSummary: aiContent,
        });
      }
    } catch (e) {
      console.error("Waste analysis error:", e);
    }
    setLoading(false);
  }, [country]);

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMsgs(p => [...p, { role: "user", content: msg }]);
    setChatLoading(true);
    let content = "";

    const ctx = rawGovData ? JSON.stringify(rawGovData).substring(0, 8000) : "";
    const wasteCtx = result ? JSON.stringify(result).substring(0, 4000) : "";

    try {
      await streamChat({
        messages: [
          { role: "user", content: `[CONTEXT]\nGov Data: ${ctx}\nWaste Analysis: ${wasteCtx}\n\nYou are Aureon's fraud investigator. Answer follow-up questions about waste, fraud, and corruption using the data.` },
          ...chatMsgs.map(m => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: msg },
        ],
        mode: "research",
        onDelta: (chunk) => {
          content += chunk;
          setChatMsgs(p => {
            const last = p[p.length - 1];
            if (last?.role === "assistant") return p.map((m, i) => i === p.length - 1 ? { ...m, content } : m);
            return [...p, { role: "assistant", content }];
          });
        },
        onDone: () => setChatLoading(false),
      });
    } catch {
      setChatMsgs(p => [...p, { role: "assistant", content: "Analysis failed. Please try again." }]);
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-light tracking-wider text-foreground/60">Waste & Fraud Detection</h2>
          <p className="text-[8px] text-muted-foreground/30 mt-0.5">AI-powered forensic analysis of government spending</p>
        </div>
        {wasteItems.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setViewMode("scan")} className={`px-3 py-1.5 rounded-lg text-[9px] transition-all ${viewMode === "scan" ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/60" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
              <Search className="h-3 w-3 inline mr-1" />Scan Results
            </button>
            <button onClick={() => setViewMode("tracker")} className={`px-3 py-1.5 rounded-lg text-[9px] transition-all ${viewMode === "tracker" ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/60" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
              <BarChart3 className="h-3 w-3 inline mr-1" />Waste Tracker
            </button>
          </div>
        )}
      </div>

      {/* Country Selector + Run */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {COUNTRIES.map(c => (
            <button key={c.code} onClick={() => setCountry(c.code)} className={`px-2 py-1 rounded-lg text-[9px] transition-all ${country === c.code ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/70" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <button onClick={runAnalysis} disabled={loading} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400/80 text-[10px] tracking-wide hover:bg-red-500/20 disabled:opacity-40 flex items-center gap-2">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          {loading ? "Scanning..." : "Run Forensic Scan"}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-red-400/40" />
          <p className="text-[10px] text-muted-foreground/30">Analyzing government spending for waste & fraud patterns...</p>
          <p className="text-[8px] text-muted-foreground/20">Fetching data from World Bank, Treasury, and open APIs</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-red-400/40 mb-1">Total Waste Identified</p>
              <p className="text-xl font-light text-red-400/70">{fmtUsd(result.totalWaste)}</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">% of Budget</p>
              <p className="text-xl font-light text-foreground/60">{result.percentOfBudget.toFixed(2)}%</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Issues Found</p>
              <p className="text-xl font-light text-foreground/60">{result.patterns.length}</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Critical Issues</p>
              <p className="text-xl font-light text-red-400/70">{result.patterns.filter(p => p.severity === "high").length}</p>
            </div>
          </div>

          {/* Executive Summary */}
          {result.executiveSummary && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Executive Summary</h3>
              <div className="text-[11px] leading-relaxed text-foreground/60 font-light whitespace-pre-line prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result.executiveSummary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Waste Patterns */}
          {result.patterns.length > 0 && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Waste & Fraud Patterns Detected</h3>
              <div className="space-y-2">
                {result.patterns.sort((a, b) => b.estimatedWaste - a.estimatedWaste).map((pattern, i) => {
                  const cfg = severityConfig[pattern.severity];
                  const expanded = expandedPattern === i;
                  return (
                    <button key={i} onClick={() => setExpandedPattern(expanded ? null : i)} className={`w-full text-left p-4 rounded-xl border transition-all ${expanded ? cfg.bg : "bg-foreground/[0.03] border-border/[0.05] hover:bg-foreground/[0.06]"}`}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-foreground/60 font-light">{pattern.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-[10px] text-foreground/50 mt-1 font-light">{pattern.description}</p>
                          <p className="text-[9px] text-red-400/60 mt-1 font-medium">Estimated waste: {fmtUsd(pattern.estimatedWaste)}</p>

                          {expanded && (
                            <div className="mt-3 space-y-2 border-t border-border/[0.06] pt-3">
                              <div>
                                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Evidence</p>
                                <p className="text-[9px] text-foreground/50 font-light">{pattern.evidence}</p>
                              </div>
                              <div>
                                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Recommendation</p>
                                <p className="text-[9px] text-foreground/50 font-light">{pattern.recommendation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <ChevronRight className={`h-3 w-3 text-muted-foreground/20 mt-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Investigation Chat */}
          <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
                <span className="text-[10px] font-light tracking-wider text-foreground/60">INVESTIGATE WITH AUREON</span>
              </div>
              {chatMsgs.length > 0 && (
                <button onClick={() => setChatMsgs([])} className="p-1 rounded-lg hover:bg-foreground/[0.06]"><X className="h-3 w-3 text-muted-foreground/40" /></button>
              )}
            </div>

            {chatMsgs.length === 0 && (
              <div className="px-4 py-2 border-b border-border/[0.04] flex flex-wrap gap-1.5">
                {[
                  "Show me all duplicate payment patterns",
                  "Which agencies have the most waste?",
                  "How much can we save through automation?",
                  "Compare this country's waste to peers",
                ].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); setTimeout(() => { setChatInput(""); setChatMsgs(p => [...p, { role: "user", content: q }]); setChatLoading(true); /* trigger */ }, 0); }} className="px-2.5 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03] text-[8px] text-foreground/50 hover:bg-foreground/[0.06]">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-3">
              {chatMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === "user" ? "bg-foreground/[0.08] border border-border/[0.08] text-foreground/70" : "bg-foreground/[0.03] border border-border/[0.05] text-foreground/60"}`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[10px] leading-relaxed font-light"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    ) : (
                      <p className="text-[10px] font-light">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && chatMsgs[chatMsgs.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30" /><span className="text-[9px] text-muted-foreground/30">Investigating...</span></div>
              )}
            </div>

            <div className="px-3 py-2.5 border-t border-border/[0.06]">
              <div className="flex items-center gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Ask about waste, fraud, or inefficiency..." className="flex-1 bg-transparent text-[10px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none font-light" disabled={chatLoading} />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} className="p-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] disabled:opacity-30"><Send className="h-3 w-3 text-foreground/50" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZeeionWasteFraud;
