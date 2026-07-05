import { useState, useCallback } from "react";
import { Loader2, Users, Bot, DollarSign, Zap, ChevronRight, Send, Sparkles, X, Clock, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/ai";
import ReactMarkdown from "react-markdown";
import ZeeionDeepDive from "./ZeeionDeepDive";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "PE", name: "Peru" },
  { code: "JP", name: "Japan" },
  { code: "MX", name: "Mexico" },
];

interface JobCategory {
  title: string;
  positionCount: number;
  currentCost: number;
  automationCost: number;
  annualSavings: number;
  automationRate: number;
  implementation: string;
  retrainingOption: string;
  solution: string;
}

interface JobResult {
  totalAutomatablePositions: number;
  totalAnnualSavings: number;
  categories: JobCategory[];
  transitionPlan: string;
  executiveSummary: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string }

const fmtUsd = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

const ZeeionJobOptimization = () => {
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobResult | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [expandedCat, setExpandedCat] = useState<number | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setChatMsgs([]);
    try {
      const [wbRes, agencyRes] = await Promise.all([
        supabase.functions.invoke("gov-data", { body: { action: "world_bank_indicators", params: { countryCode: country } } }),
        supabase.functions.invoke("gov-data", { body: { action: "spending_by_agency" } }),
      ]);
      const govData = { wb: wbRes.data, agencies: agencyRes.data };
      setRawData(govData);

      const countryName = COUNTRIES.find(c => c.code === country)?.name || country;
      const ctx: string[] = [`Country: ${countryName}`];
      if (govData.wb?.indicators) {
        const gdp = govData.wb.indicators["NY.GDP.MKTP.CD"]?.[0];
        const pop = govData.wb.indicators["SP.POP.TOTL"]?.[0];
        if (gdp) ctx.push(`GDP: $${(gdp.value / 1e12).toFixed(2)}T`);
        if (pop) ctx.push(`Population: ${(pop.value / 1e6).toFixed(1)}M`);
      }
      if (govData.agencies?.agencies && country === "US") {
        ctx.push(`Federal Budget: ${fmtUsd(govData.agencies.totalBudget)}`);
        ctx.push("Agencies: " + govData.agencies.agencies.slice(0, 10).map((a: any) => `${a.name}: ${fmtUsd(a.budgetAuthority)}`).join("; "));
      }

      let aiContent = "";
      await streamChat({
        messages: [
          { role: "user", content: `[GOV DATA]\n${ctx.join("\n")}\n\n---\nYou are Aureon's Government Workforce Optimization Engine. Analyze ${countryName}'s government workforce and identify positions that can be automated or eliminated using AI/technology.\n\nReturn JSON with this EXACT structure:\n{\n  "totalAutomatablePositions": <number>,\n  "totalAnnualSavings": <number USD>,\n  "categories": [\n    {\n      "title": "<job category name>",\n      "positionCount": <number>,\n      "currentCost": <annual cost USD>,\n      "automationCost": <one-time cost USD>,\n      "annualSavings": <annual savings USD>,\n      "automationRate": <percentage 0-100>,\n      "implementation": "<timeline e.g. '6 months'>",\n      "retrainingOption": "<what affected workers can do>",\n      "solution": "<how AI/tech replaces this>"\n    }\n  ],\n  "transitionPlan": "<3-phase transition plan>",\n  "executiveSummary": "<executive summary>"\n}\n\nInclude 8-12 job categories. Be realistic with numbers based on ${countryName}'s government size and budget. Consider data entry clerks, permit processors, invoice processors, customer service, tax preparation, document review, scheduling, procurement, compliance checking, report generation, etc.` },
        ],
        mode: "research",
        onDelta: (chunk) => { aiContent += chunk; },
        onReplace: (text) => { aiContent = text; },
        onDone: () => {},
      });

      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) setResult(JSON.parse(jsonMatch[0]));
      } catch {
        setResult({ totalAutomatablePositions: 0, totalAnnualSavings: 0, categories: [], transitionPlan: "", executiveSummary: aiContent });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [country]);

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMsgs(p => [...p, { role: "user", content: msg }]);
    setChatLoading(true);
    let content = "";
    try {
      await streamChat({
        messages: [
          { role: "user", content: `[CONTEXT]\n${JSON.stringify(rawData).substring(0, 6000)}\nJob Analysis: ${JSON.stringify(result).substring(0, 4000)}\n\nYou are Aureon's workforce optimization consultant. Answer questions about automatable government positions.` },
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
        onReplace: (text) => {
          content = text;
          setChatMsgs(p => {
            const last = p[p.length - 1];
            if (last?.role === "assistant") return p.map((m, i) => i === p.length - 1 ? { ...m, content } : m);
            return [...p, { role: "assistant", content }];
          });
        },
        onDone: () => setChatLoading(false),
      });
    } catch {
      setChatMsgs(p => [...p, { role: "assistant", content: "Error. Try again." }]);
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xs font-light tracking-wider text-foreground/60">Workforce Optimization Scanner</h2>
        <p className="text-[8px] text-muted-foreground/30 mt-0.5">Identify automatable government positions & estimate savings</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {COUNTRIES.map(c => (
            <button key={c.code} onClick={() => setCountry(c.code)} className={`px-2 py-1 rounded-lg text-[9px] transition-all ${country === c.code ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/70" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <button onClick={runAnalysis} disabled={loading} className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary/80 text-[10px] tracking-wide hover:bg-primary/20 disabled:opacity-40 flex items-center gap-2">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
          {loading ? "Scanning Workforce..." : "Scan for Automation"}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          <p className="text-[10px] text-muted-foreground/30">Analyzing government workforce for automation opportunities...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-primary/40 mb-1">Automatable Positions</p>
              <p className="text-xl font-light text-primary/70">{result.totalAutomatablePositions.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-emerald-400/40 mb-1">Annual Savings</p>
              <p className="text-xl font-light text-emerald-400/70">{fmtUsd(result.totalAnnualSavings)}</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Job Categories</p>
              <p className="text-xl font-light text-foreground/60">{result.categories.length}</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Avg Automation</p>
              <p className="text-xl font-light text-foreground/60">{result.categories.length ? Math.round(result.categories.reduce((s, c) => s + c.automationRate, 0) / result.categories.length) : 0}%</p>
            </div>
          </div>

          {/* Executive Summary */}
          {result.executiveSummary && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Executive Summary</h3>
              <div className="text-[11px] leading-relaxed text-foreground/60 font-light prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{result.executiveSummary}</ReactMarkdown></div>
            </div>
          )}

          {/* Categories */}
          {result.categories.length > 0 && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Automation Opportunities by Category</h3>
              <div className="space-y-2">
                {result.categories.sort((a, b) => b.annualSavings - a.annualSavings).map((cat, i) => {
                  const expanded = expandedCat === i;
                  return (
                    <button key={i} onClick={() => setExpandedCat(expanded ? null : i)} className="w-full text-left p-4 rounded-xl bg-foreground/[0.03] border border-border/[0.05] hover:bg-foreground/[0.06] transition-all">
                      <div className="flex items-start gap-3">
                        <Bot className="h-4 w-4 text-primary/40 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-foreground/60">{cat.title}</span>
                            <span className="text-[9px] text-emerald-400/60">{fmtUsd(cat.annualSavings)}/yr</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[8px] text-muted-foreground/30">
                            <span>{cat.positionCount.toLocaleString()} positions</span>
                            <span>•</span>
                            <span>{cat.automationRate}% automatable</span>
                            <span>•</span>
                            <span>{cat.implementation}</span>
                          </div>

                          {/* Automation bar */}
                          <div className="w-full h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden mt-2">
                            <div className="h-full rounded-full bg-primary/30 transition-all" style={{ width: `${cat.automationRate}%` }} />
                          </div>

                          {expanded && (
                            <div className="mt-3 space-y-2 border-t border-border/[0.06] pt-3 text-[9px]">
                              <div className="grid grid-cols-2 gap-3">
                                <div><p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Current Cost</p><p className="text-foreground/50">{fmtUsd(cat.currentCost)}/yr</p></div>
                                <div><p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Automation Cost</p><p className="text-foreground/50">{fmtUsd(cat.automationCost)} (one-time)</p></div>
                              </div>
                              <div><p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">AI Solution</p><p className="text-foreground/50 font-light">{cat.solution}</p></div>
                              <div><p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Retraining</p><p className="text-foreground/50 font-light">{cat.retrainingOption}</p></div>
                              <ZeeionDeepDive
                                category={"Automatable Positions: " + cat.title}
                                context={"Job category: " + cat.title + ". Positions: " + cat.positionCount + ". Current cost: " + fmtUsd(cat.currentCost) + ". Automation rate: " + cat.automationRate + "%. Solution: " + cat.solution}
                                columnHint={"columns: employee_id, position_title, department, location, annual_salary, years_in_role, automation_feasibility_pct, replacement_tool, retraining_path, transition_date. Generate 15-20 specific employee records showing individual positions that can be automated with IDs like EMP-" + cat.title.substring(0, 3).toUpperCase() + "-XXXX."}
                                label="Deep Dive — Show Individual Positions"
                              />
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

          {/* Transition Plan */}
          {result.transitionPlan && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Transition Plan</h3>
              <div className="text-[11px] leading-relaxed text-foreground/60 font-light prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{result.transitionPlan}</ReactMarkdown></div>
            </div>
          )}

          {/* Chat */}
          <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
              <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-foreground/40" /><span className="text-[10px] font-light tracking-wider text-foreground/60">AUREON WORKFORCE ANALYST</span></div>
              {chatMsgs.length > 0 && <button onClick={() => setChatMsgs([])} className="p-1 rounded-lg hover:bg-foreground/[0.06]"><X className="h-3 w-3 text-muted-foreground/40" /></button>}
            </div>
            <div className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-3">
              {chatMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === "user" ? "bg-foreground/[0.08] border border-border/[0.08] text-foreground/70" : "bg-foreground/[0.03] border border-border/[0.05] text-foreground/60"}`}>
                    {m.role === "assistant" ? <div className="prose prose-sm dark:prose-invert max-w-none text-[10px] leading-relaxed font-light"><ReactMarkdown>{m.content}</ReactMarkdown></div> : <p className="text-[10px] font-light">{m.content}</p>}
                  </div>
                </div>
              ))}
              {chatLoading && chatMsgs[chatMsgs.length - 1]?.role !== "assistant" && <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30" /></div>}
            </div>
            <div className="px-3 py-2.5 border-t border-border/[0.06]">
              <div className="flex items-center gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Ask about automation opportunities..." className="flex-1 bg-transparent text-[10px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none font-light" disabled={chatLoading} />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} className="p-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] disabled:opacity-30"><Send className="h-3 w-3 text-foreground/50" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZeeionJobOptimization;
