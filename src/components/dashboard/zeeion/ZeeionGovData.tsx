import { useState, useEffect, useCallback } from "react";
import { Globe, Loader2, TrendingUp, TrendingDown, DollarSign, Users, Shield, GraduationCap, Heart, BarChart3, RefreshCw, ChevronRight, Sparkles, Send, X, Search, Bot, PieChart, AlertTriangle, FileText, Download, ArrowRight, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/ai";
import ZeeionWasteFraud from "./ZeeionWasteFraud";
import ZeeionJobOptimization from "./ZeeionJobOptimization";
import ZeeionBudgetOptimizer from "./ZeeionBudgetOptimizer";

/* ── Country registry ── */
const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸", iso3: "USA" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", iso3: "GBR" },
  { code: "DE", name: "Germany", flag: "🇩🇪", iso3: "DEU" },
  { code: "FR", name: "France", flag: "🇫🇷", iso3: "FRA" },
  { code: "JP", name: "Japan", flag: "🇯🇵", iso3: "JPN" },
  { code: "CN", name: "China", flag: "🇨🇳", iso3: "CHN" },
  { code: "IN", name: "India", flag: "🇮🇳", iso3: "IND" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", iso3: "BRA" },
  { code: "CA", name: "Canada", flag: "🇨🇦", iso3: "CAN" },
  { code: "AU", name: "Australia", flag: "🇦🇺", iso3: "AUS" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", iso3: "KOR" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", iso3: "MEX" },
  { code: "IT", name: "Italy", flag: "🇮🇹", iso3: "ITA" },
  { code: "ES", name: "Spain", flag: "🇪🇸", iso3: "ESP" },
  { code: "PE", name: "Peru", flag: "🇵🇪", iso3: "PER" },
  { code: "RU", name: "Russia", flag: "🇷🇺", iso3: "RUS" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", iso3: "ZAF" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", iso3: "NGA" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", iso3: "SAU" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", iso3: "IDN" },
];

const INDICATORS = [
  { id: "GC.XPN.TOTL.GD.ZS", label: "Govt Expense (% GDP)", icon: <DollarSign className="h-3 w-3" /> },
  { id: "GC.REV.XGRT.GD.ZS", label: "Govt Revenue (% GDP)", icon: <TrendingUp className="h-3 w-3" /> },
  { id: "GC.DOD.TOTL.GD.ZS", label: "Govt Debt (% GDP)", icon: <TrendingDown className="h-3 w-3" /> },
  { id: "MS.MIL.XPND.GD.ZS", label: "Military (% GDP)", icon: <Shield className="h-3 w-3" /> },
  { id: "SH.XPD.CHEX.GD.ZS", label: "Health (% GDP)", icon: <Heart className="h-3 w-3" /> },
  { id: "SE.XPD.TOTL.GD.ZS", label: "Education (% GDP)", icon: <GraduationCap className="h-3 w-3" /> },
];

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

type SubTab = "landing" | "overview" | "comparison" | "usa_detail" | "waste_fraud" | "jobs" | "budget_optimize" | "aureon";

interface ChatMsg { role: "user" | "assistant"; content: string }

const ZeeionGovData = () => {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [wbData, setWbData] = useState<any>(null);
  const [usaAgencies, setUsaAgencies] = useState<any>(null);
  const [usaDebt, setUsaDebt] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [compIndicator, setCompIndicator] = useState("GC.XPN.TOTL.GD.ZS");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const callGov = useCallback(async (action: string, params?: any) => {
    const { data, error } = await supabase.functions.invoke("gov-data", {
      body: { action, params },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  /* ── Fetch World Bank data for selected country ── */
  const fetchCountryData = useCallback(async (code: string) => {
    setLoading(p => ({ ...p, wb: true }));
    try {
      const data = await callGov("world_bank_indicators", { countryCode: code });
      setWbData(data);
    } catch (e) { console.error(e); }
    setLoading(p => ({ ...p, wb: false }));
  }, [callGov]);

  /* ── Fetch USA agencies ── */
  const fetchUSAAgencies = useCallback(async () => {
    setLoading(p => ({ ...p, usa: true }));
    try {
      const data = await callGov("spending_by_agency");
      setUsaAgencies(data);
    } catch (e) { console.error(e); }
    setLoading(p => ({ ...p, usa: false }));
  }, [callGov]);

  /* ── Fetch US debt ── */
  const fetchDebt = useCallback(async () => {
    setLoading(p => ({ ...p, debt: true }));
    try {
      const data = await callGov("treasury_debt");
      setUsaDebt(data);
    } catch (e) { console.error(e); }
    setLoading(p => ({ ...p, debt: false }));
  }, [callGov]);

  /* ── Fetch comparison ── */
  const fetchComparison = useCallback(async (indicator: string) => {
    setLoading(p => ({ ...p, comp: true }));
    try {
      const data = await callGov("country_comparison", {
        countries: COUNTRIES.map(c => c.code),
        indicator,
      });
      setComparisonData(data);
    } catch (e) { console.error(e); }
    setLoading(p => ({ ...p, comp: false }));
  }, [callGov]);

  useEffect(() => { fetchCountryData(selectedCountry); }, [selectedCountry, fetchCountryData]);
  useEffect(() => { if (subTab === "usa_detail" && !usaAgencies) { fetchUSAAgencies(); fetchDebt(); } }, [subTab, usaAgencies, fetchUSAAgencies, fetchDebt]);
  useEffect(() => { if (subTab === "comparison") fetchComparison(compIndicator); }, [subTab, compIndicator, fetchComparison]);

  /* ── Helpers ── */
  const latestValue = (indicatorId: string) => {
    const arr = wbData?.indicators?.[indicatorId];
    if (!arr?.length) return null;
    return arr[0];
  };

  const fmt = (v: number | null, decimals = 1) => v != null ? v.toFixed(decimals) : "—";
  const fmtUsd = (v: number) => {
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toLocaleString()}`;
  };

  const countryObj = COUNTRIES.find(c => c.code === selectedCountry);

  /* ── Aureon Chat ── */
  const sendChat = async (text?: string) => {
    const msg = text || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMsg = { role: "user", content: msg };
    setChatMsgs(p => [...p, userMsg]);
    setChatLoading(true);
    let content = "";

    // Build context from loaded data
    const ctxParts: string[] = [];
    ctxParts.push(`Selected Country: ${countryObj?.name} (${selectedCountry})`);
    if (wbData?.indicators) {
      INDICATORS.forEach(ind => {
        const v = latestValue(ind.id);
        if (v) ctxParts.push(`${ind.label}: ${v.value?.toFixed(2)}% (${v.date})`);
      });
      const gdpV = latestValue("NY.GDP.MKTP.CD");
      if (gdpV) ctxParts.push(`GDP: ${fmtUsd(gdpV.value)} (${gdpV.date})`);
      const popV = latestValue("SP.POP.TOTL");
      if (popV) ctxParts.push(`Population: ${(popV.value / 1e6).toFixed(1)}M (${popV.date})`);
    }
    if (usaAgencies?.agencies) {
      ctxParts.push(`USA Federal Budget: ${fmtUsd(usaAgencies.totalBudget)}`);
      ctxParts.push("Top US Agencies: " + usaAgencies.agencies.slice(0, 10).map((a: any) => `${a.name}: ${fmtUsd(a.budgetAuthority)}`).join("; "));
    }
    if (usaDebt?.debtData?.[0]) {
      ctxParts.push(`US National Debt: ${fmtUsd(usaDebt.debtData[0].totalDebt)} (${usaDebt.debtData[0].date})`);
    }
    if (comparisonData?.countries?.length) {
      ctxParts.push(`Country Comparison (${comparisonData.indicatorName}): ` + comparisonData.countries.slice(0, 10).map((c: any) => `${c.countryName}: ${c.value?.toFixed(2)}%`).join("; "));
    }

    const apiMsgs = [
      { role: "user" as const, content: `[GOVERNMENT FINANCIAL DATA CONTEXT]\n${ctxParts.join("\n")}\n\n---\nYou are Aureon, an expert government finance analyst. Answer questions about government spending, budgets, debt, and fiscal policy using the data above. Be specific with numbers. Identify waste, inefficiencies, and opportunities. Compare countries when relevant.` },
      ...chatMsgs.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: msg },
    ];

    try {
      await streamChat({
        messages: apiMsgs,
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
      setChatMsgs(p => [...p, { role: "assistant", content: "Error analyzing data. Please try again." }]);
      setChatLoading(false);
    }
  };

  /* ── Render ── */
  const tabs: { id: SubTab; label: string; icon?: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Globe className="h-3 w-3" /> },
    { id: "comparison", label: "Compare", icon: <BarChart3 className="h-3 w-3" /> },
    { id: "usa_detail", label: "USA Deep Dive", icon: <DollarSign className="h-3 w-3" /> },
    { id: "waste_fraud", label: "Waste & Fraud", icon: <Search className="h-3 w-3" /> },
    { id: "jobs", label: "Job Optimization", icon: <Bot className="h-3 w-3" /> },
    { id: "budget_optimize", label: "Budget Optimizer", icon: <PieChart className="h-3 w-3" /> },
    { id: "aureon", label: "Ask Aureon", icon: <Sparkles className="h-3 w-3" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] tracking-wide transition-all ${subTab === t.id ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70" : "border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {subTab === "overview" && (
        <div className="space-y-5">
          {/* Country Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Globe className="h-4 w-4 text-muted-foreground/40" />
            <div className="flex flex-wrap gap-1">
              {COUNTRIES.map(c => (
                <button key={c.code} onClick={() => setSelectedCountry(c.code)} className={`px-2 py-1 rounded-lg text-[9px] transition-all ${selectedCountry === c.code ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/70" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
                  {c.flag} {c.name}
                </button>
              ))}
            </div>
          </div>

          {loading.wb ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground/30">Fetching data from World Bank...</span>
            </div>
          ) : wbData ? (
            <>
              {/* Headline Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const gdpV = latestValue("NY.GDP.MKTP.CD");
                  const popV = latestValue("SP.POP.TOTL");
                  const expV = latestValue("GC.XPN.TOTL.GD.ZS");
                  const debtV = latestValue("GC.DOD.TOTL.GD.ZS");
                  return [
                    { label: "GDP", value: gdpV ? fmtUsd(gdpV.value) : "—", year: gdpV?.date },
                    { label: "Population", value: popV ? `${(popV.value / 1e6).toFixed(1)}M` : "—", year: popV?.date },
                    { label: "Govt Expense", value: expV ? `${expV.value.toFixed(1)}% GDP` : "—", year: expV?.date },
                    { label: "Govt Debt", value: debtV ? `${debtV.value.toFixed(1)}% GDP` : "—", year: debtV?.date },
                  ].map((m, i) => (
                    <div key={i} className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                      <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">{m.label}</p>
                      <p className="text-lg font-light text-foreground/60">{m.value}</p>
                      {m.year && <p className="text-[7px] text-muted-foreground/20 mt-0.5">{m.year}</p>}
                    </div>
                  ));
                })()}
              </div>

              {/* Indicator Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INDICATORS.map(ind => {
                  const v = latestValue(ind.id);
                  return (
                    <div key={ind.id} className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-muted-foreground/40">{ind.icon}</span>
                        <span className="text-[8px] text-muted-foreground/40">{ind.label}</span>
                      </div>
                      <p className="text-xl font-light text-foreground/60">{v ? `${v.value.toFixed(2)}%` : "—"}</p>
                      {v && <p className="text-[7px] text-muted-foreground/20">{v.date}</p>}
                    </div>
                  );
                })}
              </div>

              {/* Historical trend chart for expense */}
              {(() => {
                const expArr = wbData.indicators?.["GC.XPN.TOTL.GD.ZS"];
                if (!expArr?.length) return null;
                const chartData = [...expArr].reverse().map((d: any) => ({ year: d.date, value: d.value }));
                return (
                  <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
                    <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Government Expense (% GDP) — Historical</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="year" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.3)" }} />
                        <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.3)" }} />
                        <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--background))", border: "1px solid hsl(var(--border) / 0.1)" }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((_: any, i: number) => <Cell key={i} fill={`hsl(var(--primary) / ${0.3 + (i / chartData.length) * 0.5})`} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground/30 text-center py-12">Select a country to load data</p>
          )}
        </div>
      )}

      {/* ═══ COMPARISON ═══ */}
      {subTab === "comparison" && (
        <div className="space-y-5">
          {/* Indicator selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[8px] text-muted-foreground/30">Compare by:</span>
            {INDICATORS.map(ind => (
              <button key={ind.id} onClick={() => setCompIndicator(ind.id)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] transition-all ${compIndicator === ind.id ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/60" : "border border-border/[0.06] text-muted-foreground/35 hover:bg-foreground/[0.04]"}`}>
                {ind.icon} {ind.label}
              </button>
            ))}
          </div>

          {loading.comp ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground/30">Loading comparison data...</span>
            </div>
          ) : comparisonData?.countries?.length ? (
            <div className="space-y-4">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">{comparisonData.indicatorName} ({comparisonData.year})</h3>

              {/* Bar chart */}
              <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
                <ResponsiveContainer width="100%" height={Math.max(300, comparisonData.countries.length * 32)}>
                  <BarChart data={comparisonData.countries} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.3)" }} />
                    <YAxis type="category" dataKey="countryName" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground) / 0.5)" }} width={100} />
                    <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--background))", border: "1px solid hsl(var(--border) / 0.1)" }} formatter={(v: number) => `${v.toFixed(2)}%`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {comparisonData.countries.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-border/[0.06]">
                      <th className="text-left px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">Rank</th>
                      <th className="text-left px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">Country</th>
                      <th className="text-right px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">Value (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.countries.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-border/[0.03] hover:bg-foreground/[0.02]">
                        <td className="px-4 py-2 text-muted-foreground/40">{i + 1}</td>
                        <td className="px-4 py-2 text-foreground/60">{c.countryName}</td>
                        <td className="px-4 py-2 text-right text-foreground/60 font-medium">{c.value?.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/30 text-center py-12">No comparison data available</p>
          )}
        </div>
      )}

      {/* ═══ USA DETAIL ═══ */}
      {subTab === "usa_detail" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">🇺🇸 United States Federal Budget</h3>
            <button onClick={() => { fetchUSAAgencies(); fetchDebt(); }} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/[0.06] text-[8px] text-muted-foreground/30 hover:bg-foreground/[0.04]">
              <RefreshCw className="h-2.5 w-2.5" /> Refresh
            </button>
          </div>

          {loading.usa ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground/30">Fetching from USASpending.gov...</span>
            </div>
          ) : (
            <>
              {/* Total budget card */}
              {usaAgencies && (
                <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
                  <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">Total Federal Budget Authority</p>
                  <p className="text-3xl font-light text-foreground/60">{fmtUsd(usaAgencies.totalBudget)}</p>
                  <p className="text-[7px] text-muted-foreground/20 mt-1">Source: {usaAgencies.source}</p>
                </div>
              )}

              {/* Debt card */}
              {usaDebt?.debtData?.[0] && (
                <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-5">
                  <p className="text-[7px] uppercase tracking-[0.2em] text-red-400/50 mb-1">National Debt</p>
                  <p className="text-3xl font-light text-red-400/70">{fmtUsd(usaDebt.debtData[0].totalDebt)}</p>
                  <div className="flex gap-6 mt-2">
                    <div>
                      <p className="text-[7px] text-muted-foreground/25">Public Debt</p>
                      <p className="text-[10px] text-foreground/50">{fmtUsd(usaDebt.debtData[0].publicDebt)}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-muted-foreground/25">Intragovernmental</p>
                      <p className="text-[10px] text-foreground/50">{fmtUsd(usaDebt.debtData[0].intragov)}</p>
                    </div>
                  </div>
                  <p className="text-[7px] text-muted-foreground/20 mt-2">As of {usaDebt.debtData[0].date} — Source: US Treasury</p>
                </div>
              )}

              {/* Agency spending chart */}
              {usaAgencies?.agencies?.length > 0 && (
                <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
                  <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Top Federal Agencies by Budget Authority</h3>
                  <ResponsiveContainer width="100%" height={Math.max(300, usaAgencies.agencies.slice(0, 15).length * 28)}>
                    <BarChart data={usaAgencies.agencies.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                      <XAxis type="number" tick={{ fontSize: 7, fill: "hsl(var(--muted-foreground) / 0.3)" }} tickFormatter={(v: number) => fmtUsd(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.5)" }} width={180} />
                      <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--background))", border: "1px solid hsl(var(--border) / 0.1)" }} formatter={(v: number) => fmtUsd(v)} />
                      <Bar dataKey="budgetAuthority" radius={[0, 4, 4, 0]}>
                        {usaAgencies.agencies.slice(0, 15).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Debt trend */}
              {usaDebt?.debtData?.length > 1 && (
                <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
                  <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">National Debt Trend (Last 30 Records)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[...usaDebt.debtData].reverse()}>
                      <XAxis dataKey="date" tick={{ fontSize: 6, fill: "hsl(var(--muted-foreground) / 0.2)" }} interval={4} />
                      <YAxis tick={{ fontSize: 7, fill: "hsl(var(--muted-foreground) / 0.3)" }} tickFormatter={(v: number) => fmtUsd(v)} />
                      <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--background))", border: "1px solid hsl(var(--border) / 0.1)" }} formatter={(v: number) => fmtUsd(v)} />
                      <Bar dataKey="totalDebt" fill="hsl(var(--destructive) / 0.5)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Agency table */}
              {usaAgencies?.agencies?.length > 0 && (
                <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-border/[0.06]">
                        <th className="text-left px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">Agency</th>
                        <th className="text-right px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">Budget Authority</th>
                        <th className="text-right px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">Obligated</th>
                        <th className="text-right px-4 py-2 text-muted-foreground/30 font-light uppercase tracking-wider">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usaAgencies.agencies.map((a: any, i: number) => (
                        <tr key={i} className="border-b border-border/[0.03] hover:bg-foreground/[0.02]">
                          <td className="px-4 py-2 text-foreground/60">{a.abbreviation ? `${a.name} (${a.abbreviation})` : a.name}</td>
                          <td className="px-4 py-2 text-right text-foreground/60">{fmtUsd(a.budgetAuthority)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground/40">{fmtUsd(a.obligatedAmount || 0)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground/40">{((a.budgetAuthority / usaAgencies.totalBudget) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ WASTE & FRAUD ═══ */}
      {subTab === "waste_fraud" && <ZeeionWasteFraud />}

      {/* ═══ JOB OPTIMIZATION ═══ */}
      {subTab === "jobs" && <ZeeionJobOptimization />}

      {/* ═══ BUDGET OPTIMIZER ═══ */}
      {subTab === "budget_optimize" && <ZeeionBudgetOptimizer />}

      {/* ═══ AUREON ═══ */}
      {subTab === "aureon" && (
        <div className="flex flex-col rounded-2xl border border-border/[0.08] bg-foreground/[0.02] h-[600px] overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
              <span className="text-[10px] font-light tracking-wider text-foreground/60">AUREON GOV ANALYST</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
            </div>
            {chatMsgs.length > 0 && (
              <button onClick={() => setChatMsgs([])} className="p-1.5 rounded-lg hover:bg-foreground/[0.06]">
                <X className="h-3 w-3 text-muted-foreground/40" />
              </button>
            )}
          </div>

          {/* Quick actions */}
          {chatMsgs.length === 0 && (
            <div className="shrink-0 px-4 py-3 border-b border-border/[0.04] flex flex-wrap gap-1.5">
              {[
                { l: "💰 Waste", q: "What are the biggest areas of government waste and inefficiency?" },
                { l: "📊 Compare", q: "How does the US government spending compare to other major economies?" },
                { l: "💳 Debt", q: "Analyze the national debt trajectory and its implications." },
                { l: "🏥 Healthcare", q: "Why is US healthcare spending so high compared to other countries?" },
                { l: "🛡️ Defense", q: "Analyze defense spending across major world powers." },
                { l: "📚 Education", q: "Which countries invest the most in education and what are the outcomes?" },
              ].map(a => (
                <button key={a.l} onClick={() => sendChat(a.q)} className="px-2.5 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03] text-[9px] text-foreground/50 hover:bg-foreground/[0.06]">
                  {a.l}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMsgs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Globe className="h-6 w-6 text-muted-foreground/15" />
                <p className="text-[11px] font-light text-foreground/40">Ask about government finances worldwide</p>
                <p className="text-[9px] text-muted-foreground/25">I have access to World Bank, US Treasury, and USASpending data</p>
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === "user" ? "bg-foreground/[0.08] border border-border/[0.08] text-foreground/70" : "bg-foreground/[0.03] border border-border/[0.05] text-foreground/60"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-[10px] leading-relaxed font-light [&_p]:my-1 [&_li]:my-0.5 [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[10px] [&_strong]:text-foreground/70">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[10px] font-light">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && chatMsgs[chatMsgs.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 text-muted-foreground/30 animate-spin" />
                <span className="text-[9px] text-muted-foreground/30">Analyzing...</span>
              </div>
            )}
          </div>

          <div className="shrink-0 px-3 py-2.5 border-t border-border/[0.06]">
            <div className="flex items-center gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()} placeholder="Ask about government spending, debt, budgets..." className="flex-1 bg-transparent text-[10px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none font-light" disabled={chatLoading} />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading} className="p-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] disabled:opacity-30">
                <Send className="h-3 w-3 text-foreground/50" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZeeionGovData;
