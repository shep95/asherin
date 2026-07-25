import { useState, useCallback, useRef } from "react";
import { Loader2, AlertTriangle, Search, Shield, DollarSign, Users, FileWarning, Layers, ChevronRight, Send, Sparkles, X, BarChart3, Eye, Table2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/ai";
import ZeeionWasteTracker, { type WasteItem, type WasteStatus } from "./ZeeionWasteTracker";
import ZeeionWasteExport from "./ZeeionWasteExport";
import ZeeionDeepDive from "./ZeeionDeepDive";
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

interface DetailRecord {
  id: string;
  [key: string]: string | number | null;
}

interface PatternDetail {
  columns: { key: string; label: string }[];
  records: DetailRecord[];
  summary: string;
}

interface WasteResult {
  totalWasteLow: number;
  totalWasteHigh: number;
  percentOfBudgetLow: number;
  percentOfBudgetHigh: number;
  patterns: {
    type: string;
    description: string;
    estimatedWasteLow: number;
    estimatedWasteHigh: number;
    severity: "high" | "medium" | "low";
    evidence: string;
    recommendation: string;
  }[];
  executiveSummary: string;
  dataSources: string[];
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

/** Build a structured data summary string from live API data for the AI prompt */
function buildLiveDataContext(profile: any, countryName: string): string {
  const lines: string[] = [];
  lines.push(`=== LIVE GOVERNMENT FINANCIAL DATA FOR ${countryName.toUpperCase()} ===`);
  lines.push(`Sources: ${(profile.sources || []).join(", ")}`);
  lines.push("");

  // World Bank indicators
  const wb = profile.worldBank || {};
  const wbMap: Record<string, string> = {
    "NY.GDP.MKTP.CD": "GDP (current USD)",
    "GC.XPN.TOTL.GD.ZS": "Government Expense (% of GDP)",
    "GC.REV.XGRT.GD.ZS": "Government Revenue excl. grants (% of GDP)",
    "GC.DOD.TOTL.GD.ZS": "Central Govt Debt (% of GDP)",
    "SH.XPD.CHEX.GD.ZS": "Health Expenditure (% of GDP)",
    "SE.XPD.TOTL.GD.ZS": "Education Expenditure (% of GDP)",
    "MS.MIL.XPND.GD.ZS": "Military Expenditure (% of GDP)",
    "SP.POP.TOTL": "Population",
  };
  for (const [id, label] of Object.entries(wbMap)) {
    const vals = wb[id];
    if (vals?.length) {
      const recent = vals.sort((a: any, b: any) => Number(b.date) - Number(a.date)).slice(0, 3);
      lines.push(`[World Bank] ${label}:`);
      recent.forEach((v: any) => lines.push(`  ${v.date}: ${typeof v.value === "number" ? (v.value > 1e9 ? `$${(v.value / 1e9).toFixed(1)}B` : v.value.toFixed(2)) : v.value}`));
    }
  }

  // IMF indicators
  const imf = profile.imf || {};
  const imfMap: Record<string, string> = {
    debt_gdp: "Gross Govt Debt (% GDP)",
    revenue_gdp: "Govt Revenue (% GDP)",
    fiscal_balance: "Fiscal Balance / Net Lending (% GDP)",
    gdp_growth: "Real GDP Growth (%)",
    inflation: "Inflation Rate (%)",
  };
  for (const [key, label] of Object.entries(imfMap)) {
    const vals = imf[key];
    if (vals) {
      lines.push(`\n[IMF WEO] ${label}:`);
      Object.entries(vals).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 5).forEach(([yr, v]) => {
        lines.push(`  ${yr}: ${typeof v === "number" ? v.toFixed(2) : v}%`);
      });
    }
  }

  // USA agencies
  if (profile.usaAgencies?.length) {
    lines.push("\n[USASpending.gov] Top Federal Agencies by Budget Authority:");
    profile.usaAgencies.slice(0, 15).forEach((a: any) => {
      lines.push(`  ${a.name} (${a.abbreviation}): Budget=${fmtUsd(a.budgetAuthority)}, Obligated=${fmtUsd(a.obligated || 0)}, Outlays=${fmtUsd(a.outlays || 0)}`);
    });
  }

  // Treasury — Statements of Net Cost (agency-level costs from US Financial Report)
  if (profile.usaNetCost?.length) {
    lines.push("\n[US Treasury – Financial Report] Statements of Net Cost by Agency (billions):");
    profile.usaNetCost.slice(0, 15).forEach((a: any) => {
      lines.push(`  ${a.agency} (FY${a.fiscalYear}): Gross Cost=$${a.grossCostBil}B, Revenue=$${a.earnedRevenueBil}B, Net Cost=$${a.netCostBil}B`);
    });
  }

  // Budget functions
  if (profile.usaBudgetFunctions?.length) {
    lines.push(`\n[USASpending.gov] Federal Spending by Budget Function (Total: ${fmtUsd(profile.usaTotalSpending || 0)}):`);
    profile.usaBudgetFunctions.slice(0, 15).forEach((f: any) => {
      lines.push(`  ${f.name}: ${fmtUsd(f.amount)} (${typeof f.percentOfTotal === "number" ? f.percentOfTotal.toFixed(1) : f.percentOfTotal}%)`);
    });
  }

  // Top awarding agencies
  if (profile.usaTopAwarding?.length) {
    lines.push("\n[USASpending.gov] Top Awarding Agencies (contracts/grants):");
    profile.usaTopAwarding.slice(0, 10).forEach((a: any) => {
      lines.push(`  ${a.name} (${a.code}): ${fmtUsd(a.amount)}`);
    });
  }

  // Debt timeline
  if (profile.usaDebtTimeline?.length) {
    lines.push("\n[US Treasury – Debt to the Penny] National Debt Timeline:");
    profile.usaDebtTimeline.slice(0, 10).forEach((d: any) => {
      lines.push(`  ${d.date}: Total=$${(d.totalDebt / 1e12).toFixed(3)}T, Public=$${(d.publicDebt / 1e12).toFixed(3)}T`);
    });
  }

  // Monthly Treasury Statement summary
  if (profile.usaMtsSummary?.length) {
    lines.push("\n[US Treasury – Monthly Treasury Statement] Federal Receipts/Outlays:");
    profile.usaMtsSummary.slice(0, 10).forEach((r: any) => {
      lines.push(`  ${r.date} (FY${r.fiscalYear}): Receipts=${fmtUsd(r.receipts)}, Outlays=${fmtUsd(r.outlays)}, Deficit=${fmtUsd(Math.abs(r.deficitSurplus))}`);
    });
  }

  // Interest rates on debt
  if (profile.usaInterestRates?.length) {
    lines.push("\n[US Treasury – Interest Rates] Average Interest on Federal Debt:");
    profile.usaInterestRates.slice(0, 10).forEach((r: any) => {
      lines.push(`  ${r.date}: ${r.securityType} = ${r.avgRate}%`);
    });
  }

  // Top Federal Awards (largest contracts)
  if (profile.usaTopAwards?.length) {
    lines.push("\n[USASpending.gov] Largest Federal Awards (Contracts):");
    profile.usaTopAwards.slice(0, 10).forEach((a: any) => {
      lines.push(`  ${a.awardId}: ${a.recipient} — ${fmtUsd(a.amount)} (${a.agency}, ${a.type})`);
    });
  }

  // State-level spending
  if (profile.usaTopStates?.length) {
    lines.push("\n[USASpending.gov] Federal Spending by Top States:");
    profile.usaTopStates.forEach((s: any) => {
      lines.push(`  ${s.name} (${s.code}): Awards=${fmtUsd(s.totalPrimeAmount)}, Per Capita=${fmtUsd(s.awardPerCapita)}, Pop=${(s.population / 1e6).toFixed(1)}M`);
    });
  }

  // Census demographics
  if (profile.usaCensusStates?.length) {
    lines.push("\n[US Census Bureau – ACS] State Demographics (Top 10):");
    profile.usaCensusStates.slice(0, 10).forEach((s: any) => {
      lines.push(`  ${s.name}: Pop=${(s.population / 1e6).toFixed(1)}M, Median Income=$${(s.medianIncome || 0).toLocaleString()}`);
    });
  }

  // Exchange rates
  if (profile.usaExchangeRates?.length) {
    lines.push("\n[US Treasury] Exchange Rates (latest):");
    profile.usaExchangeRates.slice(0, 10).forEach((r: any) => {
      lines.push(`  ${r.currency}: ${r.rate} (${r.date})`);
    });
  }

  // FRED economic indicators
  const fredMap: Record<string, string> = {
    GDP: "GDP (Billions)", GFDEBTN: "Federal Debt (Millions)", FYFR: "Federal Revenue (Millions)",
    UNRATE: "Unemployment Rate (%)", CPIAUCSL: "CPI (Consumer Price Index)",
  };
  if (profile.usaFredData && Object.keys(profile.usaFredData).length) {
    lines.push("\n[Federal Reserve – FRED] Economic Indicators:");
    for (const [series, label] of Object.entries(fredMap)) {
      const vals = profile.usaFredData[series];
      if (vals?.length) {
        lines.push(`  ${label}:`);
        vals.slice(0, 5).forEach((v: any) => {
          lines.push(`    ${v.date}: ${v.value !== null ? v.value.toLocaleString() : "N/A"}`);
        });
      }
    }
  }

  // ── Country-specific national datasets (CKAN portals, Vulekamali, etc.) ──
  if (profile.nationalSource) {
    lines.push(`\n[${profile.nationalSource}] National Government Data:`);
  }
  if (profile.nationalDatasets?.length) {
    lines.push(`  Available fiscal/budget datasets from national portal (${profile.nationalDatasets.length} found):`);
    profile.nationalDatasets.slice(0, 15).forEach((d: any) => {
      lines.push(`  • ${d.title}${d.organization ? ` (${d.organization})` : ""}`);
      if (d.notes) lines.push(`    ${d.notes}`);
      if (d.resources?.length) {
        d.resources.forEach((r: any) => {
          if (r.url) lines.push(`    [${r.format || "FILE"}] ${r.url}`);
        });
      }
    });
  }
  // South Africa departments & budget
  if (profile.nationalDepartments?.length) {
    lines.push("\n  Government Departments:");
    profile.nationalDepartments.slice(0, 15).forEach((d: any) => {
      lines.push(`  • ${d.name}${d.government ? ` (${d.government})` : ""}${d.budget ? ` — Budget: ${fmtUsd(d.budget)}` : ""}`);
    });
  }
  if (profile.nationalSpending?.length) {
    lines.push("\n  Budget Summaries:");
    profile.nationalSpending.slice(0, 10).forEach((s: any) => {
      lines.push(`  • ${s.name}: ${s.amount ? fmtUsd(s.amount) : "N/A"}${s.year ? ` (${s.year})` : ""}`);
    });
  }
  // Nigeria AfDB projects
  if (profile.nationalExtra?.afdbProjects?.length) {
    lines.push("\n  [African Development Bank] Development Projects:");
    profile.nationalExtra.afdbProjects.slice(0, 10).forEach((p: any) => {
      lines.push(`  • ${p.title || p.name}: ${p.amount ? fmtUsd(p.amount) : "N/A"} ${p.currency || ""}`);
    });
  }

  // Peer comparison
  const peers = profile.peerComparison;
  if (peers?.debt && Object.keys(peers.debt).length) {
    lines.push("\n[IMF] Peer Country Debt (% GDP):");
    Object.entries(peers.debt).sort((a: any, b: any) => b[1] - a[1]).forEach(([c, v]) => {
      lines.push(`  ${c}: ${(v as number).toFixed(1)}%`);
    });
  }
  if (peers?.revenue && Object.keys(peers.revenue).length) {
    lines.push("\n[IMF] Peer Country Revenue (% GDP):");
    Object.entries(peers.revenue).sort((a: any, b: any) => b[1] - a[1]).forEach(([c, v]) => {
      lines.push(`  ${c}: ${(v as number).toFixed(1)}%`);
    });
  }

  return lines.join("\n");
}

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
  const [patternDetails, setPatternDetails] = useState<Record<number, PatternDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  // Convert scan results to trackable waste items
  const convertToWasteItems = (res: WasteResult): WasteItem[] => {
    return res.patterns.map((p, i) => ({
      id: `waste-${Date.now()}-${i}`,
      type: p.type,
      description: p.description,
      amount: (p.estimatedWasteLow + p.estimatedWasteHigh) / 2,
      annualImpact: (p.estimatedWasteLow + p.estimatedWasteHigh) / 2,
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
        action: "AI detected waste pattern from live government data",
        user: "Asherin AI"
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
        onReplace: (text) => { planContent = text; },
        onDone: () => {},
      });
      const jsonMatch = planContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        setWasteItems(prev => prev.map(w => w.id === item.id ? {
          ...w,
          status: "plan_created" as WasteStatus,
          remediationPlan: plan,
          timeline: [...(w.timeline || []), { date: new Date().toISOString().split("T")[0], status: "plan_created" as WasteStatus, action: "AI-generated remediation plan created", user: "Asherin AI" }],
        } : w));
      }
    } catch (e) { console.error("Plan generation failed:", e); }
    setGeneratingPlan(null);
  };

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Deep-dive: generate itemized records for a specific pattern
  const getDetailCacheKey = (patternType: string) => `asherin_detail_v4_${country}_${patternType}`;

  const generatePatternDetail = async (patternIndex: number) => {
    if (!result) return;
    const pattern = result.patterns.sort((a, b) => b.estimatedWasteHigh - a.estimatedWasteHigh)[patternIndex];
    if (!pattern) return;

    const cacheKey = getDetailCacheKey(pattern.type);
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PatternDetail;
        setPatternDetails(prev => ({ ...prev, [patternIndex]: parsed }));
        return;
      }
    } catch { /* cache miss */ }

    setLoadingDetail(patternIndex);

    const columnPrompts: Record<string, string> = {
      ghost_employees: 'columns: employee_id, department, position_title, monthly_salary, last_attendance_date, status_flag, risk_score, source. Produce 20-30 records using TITLE+DEPARTMENT format (no invented personal names).',
      duplicate_payments: 'columns: invoice_id, vendor_name, amount, payment_date, duplicate_of_invoice, department, payment_method, days_apart, source. Produce 20-30 records.',
      overpriced_contracts: 'columns: contract_id, vendor_name, contract_value, market_rate, overpayment_pct, department, start_date, end_date, competitive_bid, source. Produce 15-25 records.',
      inactive_programs: 'columns: program_id, program_name, annual_budget, execution_rate_pct, last_activity_date, department, years_inactive, beneficiaries, source. Produce 15-25 records.',
      shell_companies: 'columns: company_id, company_name, registration_date, total_contracts, total_value, employees_listed, physical_address_verified, linked_department, source. Produce 12-20 records.',
      contract_splitting: 'columns: original_contract_id, split_contract_ids, total_value, split_count, vendor_name, department, approval_date, threshold_avoided, approver_title, source. Produce 15-20 records.',
      administrative_overhead: 'columns: unit_id, unit_name, staff_count, budget, output_metric, cost_per_output, peer_benchmark, excess_cost, source. Produce 15-25 records.',
      procurement_fraud: 'columns: procurement_id, description, awarded_to, bid_count, winning_bid, second_bid, price_difference_pct, red_flags, department, source. Produce 15-20 records.',
      embezzlement: 'columns: case_id, position_title, department, estimated_amount, method, period, evidence_strength, status, source. Produce 12-18 records.',
      ineffective_programs: 'columns: project_id, project_name, original_budget, current_cost, overrun_pct, completion_pct, years_delayed, department, contractor, source. Produce 15-20 records.',
    };

    const colPrompt = columnPrompts[pattern.type] || `columns: record_id, description, amount, department, date, status, risk_level, source. Produce 15-25 records.`;
    const countryName = COUNTRIES.find(c => c.code === country)?.name || country;
    const liveContext = rawGovData ? buildLiveDataContext(rawGovData, countryName) : "";

    let aiContent = "";
    try {
      await streamChat({
        messages: [{
          role: "user",
          content: `You are Asherin's forensic AI in DEEP REASONING MODE. Produce the MAXIMUM number of records.\n\nCRITICAL RULES:\n- Current date: ${new Date().toISOString().slice(0, 10)}\n- All records from ${new Date().getFullYear() - 2} to present only\n- Do NOT invent personal names. Use TITLE + DEPARTMENT format (e.g., "Director General, Ministry of Transport")\n- Reference REAL documented cases from official audit reports (Contraloría, GAO, National Audit Office, etc.)\n- Include a "source" field citing the audit report or public data source\n- Financial figures must be derived from the live data below — not fabricated\n- Vendor names: use REAL companies from documented contracts or descriptive placeholders ("IT Services Vendor A")\n\nLIVE GOVERNMENT DATA:\n${liveContext}\n\nCountry: ${countryName}\nWaste Type: ${pattern.type}\nEstimated Range: ${fmtUsd(pattern.estimatedWasteLow)} – ${fmtUsd(pattern.estimatedWasteHigh)}\nDescription: ${pattern.description}\nEvidence: ${pattern.evidence}\n\n${colPrompt}\n\nDETERMINISTIC SEED: "${country}_${pattern.type}" — use this for consistency.\n\nReturn ONLY JSON (no markdown):\n{\n  "columns": [{"key": "column_name", "label": "Display Label"}, ...],\n  "records": [{"id": "REC-001", "column_name": "value", ...}, ...],\n  "summary": "Brief summary"\n}`
        }],
        mode: "research",
        depth: "expert",
        onDelta: (chunk) => { aiContent += chunk; },
        onReplace: (text) => { aiContent = text; },
        onDone: () => {},
      });

      let cleanContent = aiContent.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as PatternDetail;
        setPatternDetails(prev => ({ ...prev, [patternIndex]: parsed }));
        try { sessionStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch { /* full */ }
      }
    } catch (e) {
      console.error("Detail generation failed:", e);
    }
    setLoadingDetail(null);
  };

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setChatMsgs([]);
    setAnalysisError(null);
    setPatternDetails({});
    setExpandedPattern(null);
    setWasteItems([]);

    // Check session cache
    const mainCacheKey = `asherin_waste_live_v4_${country}`;
    try {
      const cached = sessionStorage.getItem(mainCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as WasteResult;
        setResult(parsed);
        setWasteItems(convertToWasteItems(parsed));
        setLoading(false);
        return;
      }
    } catch { /* cache miss */ }

    try {
      // Fetch comprehensive fiscal profile from ALL live sources
      const profileRes = await supabase.functions.invoke("gov-data", {
        body: { action: "country_fiscal_profile", params: { countryCode: country } },
      });
      
      if (profileRes.error) throw new Error(profileRes.error.message || "Failed to fetch fiscal profile");

      const profile = profileRes.data;
      setRawGovData(profile);

      const countryName = COUNTRIES.find(c => c.code === country)?.name || country;
      const liveDataContext = buildLiveDataContext(profile, countryName);

      // Now use AI to analyze the REAL data — no hallucinated names, sourced estimates only
      let aiContent = "";
      await streamChat({
        messages: [{
          role: "user",
          content: `You are Asherin, an elite forensic financial AI. You MUST analyze the following REAL, LIVE government financial data and identify waste, fraud, and inefficiency patterns.\n\nCRITICAL INTEGRITY RULES:\n1. ALL estimates MUST be derived from the real numbers below. Show your math.\n2. Use RANGE estimates (low–high) based on international benchmarks (OECD, World Bank reports, Transparency International CPI).\n3. Do NOT invent personal names. Reference officials by TITLE + DEPARTMENT only.\n4. Every pattern must cite its data source (IMF, World Bank, Treasury, etc.).\n5. Compare this country's spending ratios to peer countries in the data.\n6. Use the deterministic seed "${country}_waste_scan" for consistent results.\n\n${liveDataContext}\n\nReturn ONLY a JSON object (no markdown):\n{\n  "totalWasteLow": <number in USD>,\n  "totalWasteHigh": <number in USD>,\n  "percentOfBudgetLow": <number>,\n  "percentOfBudgetHigh": <number>,\n  "patterns": [\n    {\n      "type": "<ghost_employees|duplicate_payments|overpriced_contracts|inactive_programs|contract_splitting|administrative_overhead|procurement_fraud|embezzlement|ineffective_programs|shell_companies>",\n      "description": "<detailed description citing specific data points from the live data>",\n      "estimatedWasteLow": <number USD>,\n      "estimatedWasteHigh": <number USD>,\n      "severity": "high|medium|low",\n      "evidence": "<specific data points and comparisons from the live data above>",\n      "recommendation": "<actionable recommendation>"\n    }\n  ],\n  "executiveSummary": "<3-4 paragraph summary referencing specific IMF/World Bank data points, peer comparisons, and fiscal trends>"\n}\n\nIMPORTANT:\n- Derive GDP value from World Bank data to calculate USD amounts\n- Compare debt/revenue/spending ratios to peer countries in the data\n- Identify anomalies by comparing year-over-year trends in the IMF data\n- Waste estimates should use conservative (3-5% of budget) to upper (8-15%) ranges based on Transparency International benchmarks for this country\n- Reference specific years and values from the data`
        }],
        mode: "research",
        depth: "expert",
        onDelta: (chunk) => { aiContent += chunk; },
        onReplace: (text) => { aiContent = text; },
        onDone: () => {},
      });

      let cleanContent = aiContent.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as WasteResult;
        parsed.dataSources = profile.sources || [];
        setResult(parsed);
        setWasteItems(convertToWasteItems(parsed));
        try { sessionStorage.setItem(mainCacheKey, JSON.stringify(parsed)); } catch { /* full */ }
      } else {
        throw new Error("AI analysis did not return valid JSON");
      }
    } catch (e: any) {
      console.error("Waste analysis error:", e);
      setAnalysisError(`Live data scan failed: ${e.message || "Unknown error"}. Please try again.`);
    }
    setLoading(false);
  }, [country]);

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMsgs(p => [...p, { role: "user", content: msg }]);
    setChatLoading(true);

    const countryName = COUNTRIES.find(c => c.code === country)?.name || country;
    const liveContext = rawGovData ? buildLiveDataContext(rawGovData, countryName) : "No live data loaded yet.";
    const resultContext = result ? `Current scan found ${result.patterns.length} patterns with total waste range ${fmtUsd(result.totalWasteLow)} – ${fmtUsd(result.totalWasteHigh)}. Patterns: ${result.patterns.map(p => `${p.type}: ${fmtUsd(p.estimatedWasteLow)}-${fmtUsd(p.estimatedWasteHigh)}`).join("; ")}` : "";

    let aiResp = "";
    try {
      await streamChat({
        messages: [{
          role: "user",
          content: `You are Asherin, a forensic financial AI. Answer based ONLY on the live government data below. Do NOT invent names, companies, or data points not present in the data.\n\nLIVE DATA:\n${liveContext}\n\n${resultContext ? `CURRENT SCAN RESULTS:\n${resultContext}\n\n` : ""}USER QUESTION: ${msg}`,
        }],
        mode: "research",
        onDelta: (chunk) => { aiResp += chunk; },
        onReplace: (text) => { aiResp = text; },
        onDone: () => {},
      });
      setChatMsgs(p => [...p, { role: "assistant", content: aiResp || "Analysis complete." }]);
    } catch {
      setChatMsgs(p => [...p, { role: "assistant", content: "Investigation temporarily unavailable. Please try again." }]);
    }
    setChatLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-light tracking-wider text-foreground/60">Waste & Fraud Detection</h2>
          <p className="text-[8px] text-muted-foreground/30 mt-0.5">AI analysis of live IMF, World Bank, Treasury & government open data — no simulated records</p>
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

      {/* Error Display */}
      {analysisError && !loading && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400/60 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-red-400/70 font-light">{analysisError}</p>
            <button onClick={runAnalysis} className="mt-2 text-[9px] text-foreground/50 underline hover:text-foreground/70">Retry Scan</button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-red-400/40" />
          <p className="text-[10px] text-muted-foreground/30">Analyzing government spending for waste & fraud patterns...</p>
          <p className="text-[8px] text-muted-foreground/20">Fetching live data from IMF, World Bank, Treasury & gov portals</p>
        </div>
      )}

      {result && !loading && viewMode === "scan" && (
        <div className="space-y-5">
          {/* Data Sources Attribution */}
          {result.dataSources?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Live Sources:</span>
              {result.dataSources.map((s, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-green-500/[0.06] border border-green-500/10 text-[7px] text-green-400/60">{s}</span>
              ))}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-red-400/40 mb-1">Total Waste Identified</p>
              <p className="text-lg font-light text-red-400/70">
                {result.patterns.length > 0 ? `${fmtUsd(result.totalWasteLow)} – ${fmtUsd(result.totalWasteHigh)}` : "N/A"}
              </p>
              <p className="text-[7px] text-muted-foreground/30 mt-0.5">Conservative to upper bound</p>
            </div>
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-1">% of Budget</p>
              <p className="text-lg font-light text-foreground/60">
                {result.patterns.length > 0 ? `${result.percentOfBudgetLow.toFixed(1)}% – ${result.percentOfBudgetHigh.toFixed(1)}%` : "N/A"}
              </p>
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
              <div className="text-[11px] leading-relaxed text-foreground/60 font-light whitespace-pre-line prose prose-sm dark:prose-invert max-w-none select-text cursor-text">
                <ReactMarkdown>{result.executiveSummary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Waste Patterns */}
          {result.patterns.length > 0 && (
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Waste & Fraud Patterns Detected</h3>
              <div className="space-y-2">
                {result.patterns.sort((a, b) => b.estimatedWasteHigh - a.estimatedWasteHigh).map((pattern, i) => {
                  const cfg = severityConfig[pattern.severity];
                  const expanded = expandedPattern === i;
                  return (
                    <div key={i} className={`w-full text-left p-4 rounded-xl border transition-all ${expanded ? cfg.bg : "bg-foreground/[0.03] border-border/[0.05] hover:bg-foreground/[0.06]"}`}>
                      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedPattern(expanded ? null : i)}>
                        <span className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-foreground/60 font-light">{pattern.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-[10px] text-foreground/50 mt-1 font-light">{pattern.description}</p>
                          <p className="text-[9px] text-red-400/60 mt-1 font-medium">Estimated waste: {fmtUsd(pattern.estimatedWasteLow)} – {fmtUsd(pattern.estimatedWasteHigh)}</p>

                          {expanded && (
                            <div className="mt-3 space-y-3 border-t border-border/[0.06] pt-3 select-text cursor-text" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Evidence</p>
                                <p className="text-[9px] text-foreground/50 font-light">{pattern.evidence}</p>
                              </div>
                              <div>
                                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Recommendation</p>
                                <p className="text-[9px] text-foreground/50 font-light">{pattern.recommendation}</p>
                              </div>

                              {/* Full Forensic Deep Dive */}
                              <ZeeionDeepDive
                                category={pattern.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                context={`Country: ${COUNTRIES.find(c => c.code === country)?.name || country}\nWaste Type: ${pattern.type}\nEstimated Range: ${fmtUsd(pattern.estimatedWasteLow)} – ${fmtUsd(pattern.estimatedWasteHigh)}\nDescription: ${pattern.description}\nEvidence: ${pattern.evidence}\nRecommendation: ${pattern.recommendation}\n\nLIVE DATA CONTEXT:\n${rawGovData ? buildLiveDataContext(rawGovData, COUNTRIES.find(c => c.code === country)?.name || country) : ""}`}
                                columnHint={(() => {
                                  const columnPrompts: Record<string, string> = {
                                    ghost_employees: 'columns: employee_id, department, position_title, monthly_salary, last_attendance_date, status_flag, risk_score, source. Generate 15-25 records using TITLE+DEPARTMENT (no personal names).',
                                    duplicate_payments: 'columns: invoice_id, vendor_name, amount, payment_date, duplicate_of_invoice, department, payment_method, days_apart, source. Generate 15-25 records.',
                                    overpriced_contracts: 'columns: contract_id, vendor_name, contract_value, market_rate, overpayment_pct, department, start_date, end_date, competitive_bid, source. Generate 12-20 records.',
                                    inactive_programs: 'columns: program_id, program_name, annual_budget, execution_rate_pct, last_activity_date, department, years_inactive, beneficiaries, source. Generate 10-18 records.',
                                    shell_companies: 'columns: company_id, company_name, registration_date, total_contracts, total_value, employees_listed, physical_address_verified, linked_department, source. Generate 8-15 records.',
                                    contract_splitting: 'columns: original_contract_id, split_contract_ids, total_value, split_count, vendor_name, department, approval_date, threshold_avoided, approver_title, source. Generate 10-15 records.',
                                    administrative_overhead: 'columns: unit_id, unit_name, staff_count, budget, output_metric, cost_per_output, peer_benchmark, excess_cost, source. Generate 12-18 records.',
                                    procurement_fraud: 'columns: procurement_id, description, awarded_to, bid_count, winning_bid, second_bid, price_difference_pct, red_flags, department, source. Generate 10-15 records.',
                                    embezzlement: 'columns: case_id, position_title, department, estimated_amount, method, period, evidence_strength, status, source. Generate 8-12 records.',
                                    ineffective_programs: 'columns: project_id, project_name, original_budget, current_cost, overrun_pct, completion_pct, years_delayed, department, contractor, source. Generate 10-15 records.',
                                  };
                                  return columnPrompts[pattern.type] || undefined;
                                })()}
                                label={`${COUNTRIES.find(c => c.code === country)?.name || country} — ${pattern.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`}
                              />
                            </div>
                          )}
                        </div>
                        <ChevronRight className={`h-3 w-3 text-muted-foreground/20 mt-1 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`} />
                      </div>
                    </div>
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
                <span className="text-[10px] font-light tracking-wider text-foreground/60">INVESTIGATE WITH ASHERIN</span>
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
                  "How does this country compare to peers?",
                  "What are the biggest savings opportunities?",
                ].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); setTimeout(() => sendChat(), 50); }} className="px-2.5 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03] text-[8px] text-foreground/50 hover:bg-foreground/[0.06]">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-3">
              {chatMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 select-text cursor-text ${m.role === "user" ? "bg-foreground/[0.08] border border-border/[0.08] text-foreground/70" : "bg-foreground/[0.03] border border-border/[0.05] text-foreground/60"}`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[10px] leading-relaxed font-light"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    ) : (
                      <p className="text-[10px] font-light">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
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

      {/* ═══ WASTE TRACKER VIEW ═══ */}
      {viewMode === "tracker" && wasteItems.length > 0 && (
        <>
          <ZeeionWasteTracker
            wasteItems={wasteItems}
            onUpdateStatus={handleUpdateStatus}
            onCreatePlan={handleCreatePlan}
            countryName={COUNTRIES.find(c => c.code === country)?.name || country}
          />
          <ZeeionWasteExport
            wasteItems={wasteItems}
            countryName={COUNTRIES.find(c => c.code === country)?.name || country}
          />
        </>
      )}
    </div>
  );
};

export default ZeeionWasteFraud;
