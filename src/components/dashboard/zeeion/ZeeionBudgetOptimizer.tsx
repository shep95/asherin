import { useState, useCallback } from "react";
import { Loader2, PieChart, ArrowRight, DollarSign, TrendingUp, BarChart3, Send, Sparkles, X, ChevronRight } from "lucide-react";
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
  { code: "JP", name: "Japan" },
  { code: "PE", name: "Peru" },
  { code: "AU", name: "Australia" },
  { code: "FR", name: "France" },
];

interface Reallocation {
  department: string;
  currentBudget: number;
  recommendedBudget: number;
  change: number;
  changePercent: number;
  rationale: string;
}

interface BudgetResult {
  totalBudget: number;
  currentEfficiency: number;
  projectedEfficiency: number;
  totalSavingsFromWaste: number;
  reallocations: Reallocation[];
  executiveSummary: string;
  keyRecommendations: string[];
}

interface ChatMsg { role: "user" | "assistant"; content: string }

const fmtUsd = (v: number) => {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
};

const ZeeionBudgetOptimizer = () => {
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setChatMsgs([]);
    try {
      const [wbRes, agencyRes, compRes] = await Promise.all([
        supabase.functions.invoke("gov-data", { body: { action: "world_bank_indicators", params: { countryCode: country } } }),
        supabase.functions.invoke("gov-data", { body: { action: "spending_by_agency" } }),
        supabase.functions.invoke("gov-data", { body: { action: "country_comparison", params: { countries: [country, "US", "GB", "DE", "JP", "CA", "AU"], indicator: "GC.XPN.TOTL.GD.ZS" } } }),
      ]);
      const govData = { wb: wbRes.data, agencies: agencyRes.data, comparison: compRes.data };
      setRawData(govData);

      const countryName = COUNTRIES.find(c => c.code === country)?.name || country;
      const ctx: string[] = [`Country: ${countryName}`];
      if (govData.wb?.indicators) {
        const gdp = govData.wb.indicators["NY.GDP.MKTP.CD"]?.[0];
        const exp = govData.wb.indicators["GC.XPN.TOTL.GD.ZS"]?.[0];
        const rev = govData.wb.indicators["GC.REV.XGRT.GD.ZS"]?.[0];
        const debt = govData.wb.indicators["GC.DOD.TOTL.GD.ZS"]?.[0];
        const mil = govData.wb.indicators["MS.MIL.XPND.GD.ZS"]?.[0];
        const health = govData.wb.indicators["SH.XPD.CHEX.GD.ZS"]?.[0];
        const edu = govData.wb.indicators["SE.XPD.TOTL.GD.ZS"]?.[0];
        if (gdp) ctx.push(`GDP: $${(gdp.value / 1e12).toFixed(2)}T`);
        if (exp) ctx.push(`Govt Expense: ${exp.value.toFixed(2)}% GDP`);
        if (rev) ctx.push(`Govt Revenue: ${rev.value.toFixed(2)}% GDP`);
        if (debt) ctx.push(`Govt Debt: ${debt.value.toFixed(2)}% GDP`);
        if (mil) ctx.push(`Military: ${mil.value.toFixed(2)}% GDP`);
        if (health) ctx.push(`Health: ${health.value.toFixed(2)}% GDP`);
        if (edu) ctx.push(`Education: ${edu.value.toFixed(2)}% GDP`);
      }
      if (govData.agencies?.agencies && country === "US") {
        ctx.push(`Federal Budget: ${fmtUsd(govData.agencies.totalBudget)}`);
        ctx.push("Top Agencies:\n" + govData.agencies.agencies.slice(0, 15).map((a: any) => `- ${a.name}: ${fmtUsd(a.budgetAuthority)}`).join("\n"));
      }
      if (govData.comparison?.countries) {
        ctx.push("Peer Comparison: " + govData.comparison.countries.map((c: any) => `${c.countryName}: ${c.value?.toFixed(2)}%`).join("; "));
      }

      let aiContent = "";
      await streamChat({
        messages: [
          { role: "user", content: `[GOV DATA]\n${ctx.join("\n")}\n\n---\nYou are Asherin's Budget Optimization Engine. Analyze ${countryName}'s budget and recommend optimal reallocations to maximize efficiency while keeping the total budget the same.\n\nReturn JSON:\n{\n  "totalBudget": <number USD>,\n  "currentEfficiency": <0-100>,\n  "projectedEfficiency": <0-100 after optimization>,\n  "totalSavingsFromWaste": <USD saved from waste elimination>,\n  "reallocations": [\n    {\n      "department": "<name>",\n      "currentBudget": <USD>,\n      "recommendedBudget": <USD>,\n      "change": <USD difference>,\n      "changePercent": <percentage>,\n      "rationale": "<why>"\n    }\n  ],\n  "executiveSummary": "<3-4 paragraphs>",\n  "keyRecommendations": ["<rec1>", "<rec2>", ...]\n}\n\nInclude 8-12 department reallocations. Be data-driven. Reduce waste areas, increase underfunded areas. Compare to OECD benchmarks. The total budget should remain the same - just reallocate from wasteful to productive areas.` },
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
        setResult({ totalBudget: 0, currentEfficiency: 0, projectedEfficiency: 0, totalSavingsFromWaste: 0, reallocations: [], executiveSummary: aiContent, keyRecommendations: [] });
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
          { role: "user", content: `[CONTEXT]\n${JSON.stringify(rawData).substring(0, 6000)}\nBudget Analysis: ${JSON.stringify(result).substring(0, 4000)}\n\nYou are Asherin's budget optimization analyst. Answer questions.` },
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
        <h2 className="text-xs font-light tracking-wider text-foreground/60">Budget Optimization Engine</h2>
        <p className="text-[8px] text-muted-foreground/30 mt-0.5">AI-recommended budget reallocations for maximum efficiency</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {COUNTRIES.map(c => (
            <button key={c.code} onClick={() => setCountry(c.code)} className={`px-2 py-1 rounded-lg text-[9px] transition-all ${country === c.code ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/70" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <button onClick={runAnalysis} disabled={loading} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/80 text-[10px] tracking-wide hover:bg-emerald-500/20 disabled:opacity-40 flex items-center gap-2">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <PieChart className="h-3 w-3" />}
          {loading ? "Optimizing..." : "Optimize Budget"}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400/40" />
          <p className="text-[10px] text-muted-foreground/30">Analyzing budget allocations and benchmarking against peers...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Total Budget</p>
              <p className="text-xl font-light text-foreground/60">{fmtUsd(result.totalBudget)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-emerald-400/40 mb-1">Waste Savings</p>
              <p className="text-xl font-light text-emerald-400/70">{fmtUsd(result.totalSavingsFromWaste)}</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Current Efficiency</p>
              <p className="text-xl font-light text-foreground/60">{result.currentEfficiency}/100</p>
            </div>
            <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-primary/40 mb-1">Projected Efficiency</p>
              <p className="text-xl font-light text-primary/70">{result.projectedEfficiency}/100</p>
              <p className="text-[7px] text-emerald-400/50 mt-0.5">+{result.projectedEfficiency - result.currentEfficiency} pts</p>
            </div>
          </div>

          {/* Executive Summary */}
          {result.executiveSummary && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Executive Summary</h3>
              <div className="text-[11px] leading-relaxed text-foreground/60 font-light prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{result.executiveSummary}</ReactMarkdown></div>
            </div>
          )}

          {/* Reallocation Table */}
          {result.reallocations.length > 0 && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Recommended Reallocations</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-border/[0.06]">
                      <th className="text-left py-2 text-muted-foreground/40 font-light">Department</th>
                      <th className="text-right py-2 text-muted-foreground/40 font-light">Current</th>
                      <th className="text-center py-2 text-muted-foreground/40 font-light"></th>
                      <th className="text-right py-2 text-muted-foreground/40 font-light">Recommended</th>
                      <th className="text-right py-2 text-muted-foreground/40 font-light">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                     {result.reallocations.sort((a, b) => a.change - b.change).map((r, i) => (
                      <tr key={i} className="border-b border-border/[0.04] hover:bg-foreground/[0.03] transition-colors group">
                        <td className="py-2.5 text-foreground/60 font-light">
                          <p>{r.department}</p>
                          <p className="text-[7px] text-muted-foreground/25 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{r.rationale}</p>
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground/50">{fmtUsd(r.currentBudget)}</td>
                        <td className="py-2.5 text-center"><ArrowRight className="h-3 w-3 text-muted-foreground/20 mx-auto" /></td>
                        <td className="py-2.5 text-right text-foreground/60 font-medium">{fmtUsd(r.recommendedBudget)}</td>
                        <td className={`py-2.5 text-right font-medium ${r.change > 0 ? "text-emerald-400/70" : r.change < 0 ? "text-red-400/70" : "text-muted-foreground/40"}`}>
                          {r.change > 0 ? "+" : ""}{r.changePercent.toFixed(1)}%
                          <span className="block text-[7px] text-muted-foreground/30">{r.change > 0 ? "+" : ""}{fmtUsd(r.change)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ZeeionDeepDive
                category="Budget Reallocation Details"
                context={"Departments: " + result.reallocations.map(r => r.department + " (" + fmtUsd(r.currentBudget) + " -> " + fmtUsd(r.recommendedBudget) + ")").join(", ") + ". Total budget: " + fmtUsd(result.totalBudget)}
                columnHint="columns: line_item_id, department, program_name, current_allocation, recommended_allocation, change_amount, priority_score, justification, implementation_phase. Generate 15-20 specific budget line items showing where money should be moved from and to."
                label="Deep Dive — Show Line-Item Reallocations"
              />
            </div>
          )}

          {/* Key Recommendations */}
          {result.keyRecommendations?.length > 0 && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Key Recommendations</h3>
              <div className="space-y-2">
                {result.keyRecommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-foreground/[0.03]">
                    <span className="text-[9px] text-primary/50 font-medium mt-0.5">{i + 1}.</span>
                    <p className="text-[10px] text-foreground/60 font-light">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
              <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-foreground/40" /><span className="text-[10px] font-light tracking-wider text-foreground/60">ASHERIN BUDGET ANALYST</span></div>
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
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Ask about budget optimization..." className="flex-1 bg-transparent text-[10px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none font-light" disabled={chatLoading} />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} className="p-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] disabled:opacity-30"><Send className="h-3 w-3 text-foreground/50" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZeeionBudgetOptimizer;
