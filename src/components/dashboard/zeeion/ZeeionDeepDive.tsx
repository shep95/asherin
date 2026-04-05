import { useState } from "react";
import { Loader2, Eye, Table2, X, ChevronRight, Shield, User, Users, Calendar, FileText, AlertTriangle, CheckCircle, Clock, Search, Download, Link2, TrendingUp, Scale, Repeat, BarChart3, Fingerprint, Network, Gavel, BookOpen, Target, Zap } from "lucide-react";
import { streamChat } from "@/lib/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid, ComposedChart, Line } from "recharts";

interface DetailRecord {
  id: string;
  [key: string]: string | number | null;
}

interface PatternDetail {
  columns: { key: string; label: string }[];
  records: DetailRecord[];
  summary: string;
  overview?: {
    totalItems: number;
    totalAmount: number;
    activeItems: number;
    resolvedItems: number;
    inProgressItems: number;
    departments: string[];
    topResponsible: string[];
  };
  recurringPatterns?: {
    description: string;
    involvedParties: string[];
    frequency: string;
    totalImpact: number;
  }[];
}

interface ApprovalHistoryEntry {
  date: string;
  item: string;
  amount: number;
  flagged: boolean;
  vendor?: string;
  outcome?: string;
}

interface RecordDrillDown {
  rootCause: string;
  contributingFactors: string[];
  evidence: string[];
  evidenceScore: number;
  evidenceStrength: "weak" | "moderate" | "strong" | "forensic";
  priceComparison?: {
    currentPrice: number;
    marketAverage: number;
    bestMarketPrice: number;
    overchargePercent: number;
    breakdown?: { component: string; currentCost: number; marketCost: number; variance: number }[];
    comparableSources: { name: string; price: number; url: string; type: string }[];
    internationalBenchmarks?: { country: string; price: number; source: string }[];
    peerAgencies?: { agency: string; vendor: string; price: number }[];
  };
  whyOverpriced?: string;
  whyHarmful?: string;
  potentialEffects?: string[];
  aureonRecommendation?: string;
  responsibleParty: { name: string; title: string; department: string; email: string; yearsInRole?: number };
  approvedBy: {
    name: string;
    title: string;
    department?: string;
    totalApprovals: number;
    totalValueApproved: number;
    flaggedApprovals: number;
    wasteRate: number;
    patterns: { type: string; description: string; severity: string }[];
    flags: { type: string; description: string; severity: string }[];
    approvalHistory: ApprovalHistoryEntry[];
  };
  collusionIndicators?: { type: string; description: string; severity: string; involvedParties: string[] }[];
  recurringPatterns?: { description: string; involvedPerson: string; role: string; occurrences: number; totalAmount: number }[];
  timeline: { date: string; event: string }[];
  recommendations: { priority: string; action: string; timeline: string }[];
  supportingDocs: string[];
  referenceLinks: { label: string; url: string }[];
  financialImpact: { immediate: number; annual: number; lifetime: number; opportunityCost?: string };
  citizenImpact?: string;
  alternativeUses?: { description: string; quantity: string }[];
}

interface DeepDiveProps {
  category: string;
  context: string;
  columnHint?: string;
  label?: string;
}

const fmtVal = (v: string | number | null) => {
  if (v == null) return "—";
  if (typeof v === "number" && Math.abs(v) > 1000) {
    if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  }
  return String(v);
};

const statusColor = (status: string) => {
  const s = status?.toLowerCase() || "";
  if (/resolved|recovered|closed|refunded|terminated/i.test(s)) return "text-emerald-400/80 bg-emerald-500/10 border-emerald-500/10";
  if (/progress|review|pending|requested|investigating/i.test(s)) return "text-yellow-400/80 bg-yellow-500/10 border-yellow-500/10";
  if (/active|open|flagged|critical|confirmed|suspicious/i.test(s)) return "text-red-400/80 bg-red-500/10 border-red-500/10";
  return "text-foreground/50 bg-foreground/[0.04] border-border/[0.06]";
};

const evidenceStrengthConfig = {
  weak: { label: "Weak", color: "text-red-400/70", bg: "bg-red-500/10", pct: 25 },
  moderate: { label: "Moderate", color: "text-yellow-400/70", bg: "bg-yellow-500/10", pct: 50 },
  strong: { label: "Strong", color: "text-emerald-400/70", bg: "bg-emerald-500/10", pct: 75 },
  forensic: { label: "Forensic-Grade", color: "text-blue-400/70", bg: "bg-blue-500/10", pct: 95 },
};

const exportDetailAsTxt = (detail: PatternDetail, category: string, recordDrill: RecordDrillDown | null, selectedRecord: DetailRecord | null) => {
  let txt = "";
  txt += "╔═══════════════════════════════════════════════════════════════╗\n";
  txt += "║     AUREON COMPLETE WASTE INTELLIGENCE REPORT                 ║\n";
  txt += "║     Evidence-Based Government Waste Analysis                  ║\n";
  txt += "╚═══════════════════════════════════════════════════════════════╝\n\n";
  txt += `Report Generated: ${new Date().toLocaleString()}\n`;
  txt += `Report ID: RPT-${Date.now()}\n`;
  txt += `Category: ${category}\n\n`;

  if (detail.overview) {
    txt += "═══════════════════════════════════════════════════════════════\n";
    txt += "SECTION 1: EXECUTIVE SUMMARY\n";
    txt += "═══════════════════════════════════════════════════════════════\n\n";
    txt += `Total Items: ${detail.overview.totalItems}\n`;
    txt += `Total Financial Impact: ${fmtVal(detail.overview.totalAmount)}\n`;
    txt += `Active: ${detail.overview.activeItems} | In Progress: ${detail.overview.inProgressItems} | Resolved: ${detail.overview.resolvedItems}\n`;
    txt += `Resolution Rate: ${detail.overview.totalItems > 0 ? Math.round((detail.overview.resolvedItems / detail.overview.totalItems) * 100) : 0}%\n`;
    txt += `Departments: ${detail.overview.departments?.join(", ") || "N/A"}\n`;
    txt += `Key Personnel: ${detail.overview.topResponsible?.join(", ") || "N/A"}\n\n`;
  }

  txt += `Summary: ${detail.summary}\n\n`;

  if (detail.recurringPatterns?.length) {
    txt += "═══════════════════════════════════════════════════════════════\n";
    txt += "SECTION 2: RECURRING PATTERNS DETECTED\n";
    txt += "═══════════════════════════════════════════════════════════════\n\n";
    detail.recurringPatterns.forEach((p, i) => {
      txt += `Pattern ${i + 1}: ${p.description}\n`;
      txt += `  Involved: ${p.involvedParties.join(", ")}\n`;
      txt += `  Frequency: ${p.frequency}\n`;
      txt += `  Total Impact: ${fmtVal(p.totalImpact)}\n\n`;
    });
  }

  txt += "═══════════════════════════════════════════════════════════════\n";
  txt += "SECTION 3: ITEMIZED RECORDS\n";
  txt += "═══════════════════════════════════════════════════════════════\n\n";
  detail.records.forEach((rec, i) => {
    txt += `RECORD ${i + 1}: ${rec.id}\n`;
    detail.columns.forEach(col => {
      txt += `  ${col.label}: ${fmtVal(rec[col.key])}\n`;
    });
    txt += "\n";
  });

  if (selectedRecord && recordDrill) {
    txt += "═══════════════════════════════════════════════════════════════\n";
    txt += `SECTION 4: DETAILED INVESTIGATION — ${selectedRecord.id}\n`;
    txt += "═══════════════════════════════════════════════════════════════\n\n";

    txt += `EVIDENCE STRENGTH: ${recordDrill.evidenceStrength?.toUpperCase() || "N/A"} (Score: ${recordDrill.evidenceScore || 0}/100)\n\n`;

    txt += `ROOT CAUSE: ${recordDrill.rootCause}\n\n`;
    if (recordDrill.whyOverpriced) txt += `WHY OVERPRICED:\n${recordDrill.whyOverpriced}\n\n`;
    if (recordDrill.whyHarmful) txt += `WHY HARMFUL:\n${recordDrill.whyHarmful}\n\n`;
    if (recordDrill.citizenImpact) txt += `CITIZEN IMPACT:\n${recordDrill.citizenImpact}\n\n`;

    if (recordDrill.potentialEffects?.length) {
      txt += "POTENTIAL EFFECTS:\n";
      recordDrill.potentialEffects.forEach(e => txt += `  • ${e}\n`);
      txt += "\n";
    }
    if (recordDrill.aureonRecommendation) txt += `AUREON STRATEGIC RECOMMENDATION:\n${recordDrill.aureonRecommendation}\n\n`;

    txt += "CONTRIBUTING FACTORS:\n";
    recordDrill.contributingFactors?.forEach(f => txt += `  • ${f}\n`);

    txt += "\nEVIDENCE CHAIN:\n";
    recordDrill.evidence?.forEach(e => txt += `  ✓ ${e}\n`);

    if (recordDrill.priceComparison) {
      const pc = recordDrill.priceComparison;
      txt += `\n───────────────────────────────────────────────────────────────\n`;
      txt += `PRICE COMPARISON & MARKET ANALYSIS\n`;
      txt += `───────────────────────────────────────────────────────────────\n`;
      txt += `  Current Price: ${fmtVal(pc.currentPrice)}\n`;
      txt += `  Fair Market Average: ${fmtVal(pc.marketAverage)}\n`;
      txt += `  Best Available Price: ${fmtVal(pc.bestMarketPrice)}\n`;
      txt += `  Overcharge: ${pc.overchargePercent}%\n\n`;

      if (pc.breakdown?.length) {
        txt += `  COST BREAKDOWN:\n`;
        pc.breakdown.forEach(b => {
          txt += `    ${b.component}: Current ${fmtVal(b.currentCost)} vs Market ${fmtVal(b.marketCost)} (Variance: ${fmtVal(b.variance)})\n`;
        });
        txt += "\n";
      }

      txt += `  COMPARABLE SOURCES:\n`;
      pc.comparableSources?.forEach(s => txt += `    ${s.name} (${s.type}): ${fmtVal(s.price)} — ${s.url}\n`);

      if (pc.internationalBenchmarks?.length) {
        txt += `\n  INTERNATIONAL BENCHMARKS:\n`;
        pc.internationalBenchmarks.forEach(b => txt += `    ${b.country}: ${fmtVal(b.price)} (Source: ${b.source})\n`);
      }
      if (pc.peerAgencies?.length) {
        txt += `\n  PEER AGENCY COMPARISON:\n`;
        pc.peerAgencies.forEach(p => txt += `    ${p.agency} → ${p.vendor}: ${fmtVal(p.price)}\n`);
      }
      txt += "\n";
    }

    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `RESPONSIBLE PARTY\n`;
    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `  Name: ${recordDrill.responsibleParty?.name}\n`;
    txt += `  Title: ${recordDrill.responsibleParty?.title}\n`;
    txt += `  Department: ${recordDrill.responsibleParty?.department}\n`;
    txt += `  Email: ${recordDrill.responsibleParty?.email}\n`;
    if (recordDrill.responsibleParty?.yearsInRole) txt += `  Years in Role: ${recordDrill.responsibleParty.yearsInRole}\n`;

    const ab = recordDrill.approvedBy;
    if (ab) {
      txt += `\n───────────────────────────────────────────────────────────────\n`;
      txt += `APPROVER / DECISION MAKER\n`;
      txt += `───────────────────────────────────────────────────────────────\n`;
      txt += `  Name: ${ab.name}\n`;
      txt += `  Title: ${ab.title}\n`;
      if (ab.department) txt += `  Department: ${ab.department}\n`;
      txt += `  Total Approvals Given: ${ab.totalApprovals}\n`;
      txt += `  Total Value Approved: ${fmtVal(ab.totalValueApproved)}\n`;
      txt += `  Flagged Approvals: ${ab.flaggedApprovals}\n`;
      txt += `  Waste Rate: ${ab.wasteRate?.toFixed(1) || 0}%\n`;

      if (ab.patterns?.length) {
        txt += `\n  APPROVER BEHAVIORAL PATTERNS:\n`;
        ab.patterns.forEach(p => txt += `    [${p.severity.toUpperCase()}] ${p.type}: ${p.description}\n`);
      }
      if (ab.flags?.length) {
        txt += `\n  APPROVER FLAGS:\n`;
        ab.flags.forEach(f => txt += `    ⚠ [${f.severity.toUpperCase()}] ${f.type}: ${f.description}\n`);
      }

      txt += `\n  APPROVAL HISTORY:\n`;
      ab.approvalHistory?.forEach(h => {
        txt += `    ${h.date}: ${h.item} — ${fmtVal(h.amount)}${h.vendor ? ` (Vendor: ${h.vendor})` : ""}${h.flagged ? " ⚠ FLAGGED" : ""}${h.outcome ? ` → ${h.outcome}` : ""}\n`;
      });
    }

    if (recordDrill.collusionIndicators?.length) {
      txt += `\n───────────────────────────────────────────────────────────────\n`;
      txt += `COLLUSION / CONFLICT OF INTEREST INDICATORS\n`;
      txt += `───────────────────────────────────────────────────────────────\n`;
      recordDrill.collusionIndicators.forEach((c, i) => {
        txt += `  Alert ${i + 1}: [${c.severity.toUpperCase()}] ${c.type}\n`;
        txt += `    ${c.description}\n`;
        txt += `    Involved: ${c.involvedParties.join(", ")}\n\n`;
      });
    }

    if (recordDrill.recurringPatterns?.length) {
      txt += `───────────────────────────────────────────────────────────────\n`;
      txt += `RECURRING PATTERNS (THIS RECORD)\n`;
      txt += `───────────────────────────────────────────────────────────────\n`;
      recordDrill.recurringPatterns.forEach(p => {
        txt += `  ${p.description}\n`;
        txt += `    Person: ${p.involvedPerson} (${p.role}) — ${p.occurrences}x — ${fmtVal(p.totalAmount)}\n\n`;
      });
    }

    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `EVENT TIMELINE\n`;
    txt += `───────────────────────────────────────────────────────────────\n`;
    recordDrill.timeline?.forEach(t => txt += `  ${t.date}: ${t.event}\n`);

    txt += `\n───────────────────────────────────────────────────────────────\n`;
    txt += `FINANCIAL IMPACT ANALYSIS\n`;
    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `  Immediate: ${fmtVal(recordDrill.financialImpact?.immediate)}\n`;
    txt += `  Annual: ${fmtVal(recordDrill.financialImpact?.annual)}\n`;
    txt += `  Lifetime: ${fmtVal(recordDrill.financialImpact?.lifetime)}\n`;
    if (recordDrill.financialImpact?.opportunityCost) txt += `  Opportunity Cost: ${recordDrill.financialImpact.opportunityCost}\n`;

    if (recordDrill.alternativeUses?.length) {
      txt += `\n  WHAT THIS MONEY COULD FUND:\n`;
      recordDrill.alternativeUses.forEach(u => txt += `    • ${u.description}: ${u.quantity}\n`);
    }

    txt += `\n───────────────────────────────────────────────────────────────\n`;
    txt += `RECOMMENDED ACTIONS\n`;
    txt += `───────────────────────────────────────────────────────────────\n`;
    recordDrill.recommendations?.forEach(r => txt += `  [${r.priority}] ${r.action} (Timeline: ${r.timeline})\n`);

    if (recordDrill.referenceLinks?.length) {
      txt += `\n───────────────────────────────────────────────────────────────\n`;
      txt += `REFERENCE LINKS & SOURCES\n`;
      txt += `───────────────────────────────────────────────────────────────\n`;
      recordDrill.referenceLinks.forEach(l => txt += `  ${l.label}: ${l.url}\n`);
    }

    txt += `\n───────────────────────────────────────────────────────────────\n`;
    txt += `SUPPORTING DOCUMENTS\n`;
    txt += `───────────────────────────────────────────────────────────────\n`;
    recordDrill.supportingDocs?.forEach(d => txt += `  📄 ${d}\n`);
  }

  txt += "\n╔═══════════════════════════════════════════════════════════════╗\n";
  txt += "║  END OF REPORT — Generated by Aureon Financial Intelligence  ║\n";
  txt += "╚═══════════════════════════════════════════════════════════════╝\n";

  const blob = new Blob([txt], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aureon-forensic-intelligence-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const ZeeionDeepDive = ({ category, context, columnHint, label }: DeepDiveProps) => {
  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DetailRecord | null>(null);
  const [recordDrill, setRecordDrill] = useState<RecordDrillDown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "resolved" | "in_progress">("all");

  // Session cache key for consistency
  const detailCacheKey = `aureon_deepdive_live_v3_${category.replace(/\s+/g, "_")}`;
  const drillCacheKey = (recId: string) => `aureon_drill_live_v3_${category.replace(/\s+/g, "_")}_${recId}`;

  const generate = async () => {
    try {
      const cached = sessionStorage.getItem(detailCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PatternDetail;
        setDetail(parsed);
        return;
      }
    } catch { /* cache miss */ }

    setLoading(true);
    try {
      const liveOnlyDetail: PatternDetail = {
        columns: [
          { key: "field", label: "Field" },
          { key: "value", label: "Live Source Status" },
        ],
        records: [
          {
            id: "LIVE-ONLY-001",
            field: "Case-level drill-down",
            value: "Unavailable unless a connected public record source provides row-level evidence",
          },
          {
            id: "LIVE-ONLY-002",
            field: "Named approvers / people",
            value: "Blocked in live-source-only mode when not present in verifiable public records",
          },
          {
            id: "LIVE-ONLY-003",
            field: "Vendor / company attribution",
            value: "Only shown from connected live procurement or contract records",
          },
          {
            id: "LIVE-ONLY-004",
            field: "Recurring patterns",
            value: "Only computed from source-backed rows, not generated by AI",
          },
        ],
        summary: `Live-source-only mode is enabled for ${category}. This view will not fabricate itemized records, names, vendors, approval histories, or evidence chains from incomplete public data.`,
        overview: {
          totalItems: 0,
          totalAmount: 0,
          activeItems: 0,
          resolvedItems: 0,
          inProgressItems: 0,
          departments: [],
          topResponsible: [],
        },
        recurringPatterns: [],
      };
      setDetail(liveOnlyDetail);
      try { sessionStorage.setItem(detailCacheKey, JSON.stringify(liveOnlyDetail)); } catch { /* storage full */ }
    } catch (e) {
      console.error("Deep dive failed:", e);
    }
    setLoading(false);
  };

  const drillIntoRecord = async (record: DetailRecord) => {
    setSelectedRecord(record);
    setRecordDrill(null);

    const cacheKey = drillCacheKey(String(record.id));
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setRecordDrill(JSON.parse(cached));
        return;
      }
    } catch { /* cache miss */ }

    setDrillLoading(true);
    try {
      const unsupportedDrill: RecordDrillDown = {
        rootCause: "Detailed forensic attribution is disabled here because this panel is restricted to live, source-backed public data only.",
        contributingFactors: [
          "No connected row-level procurement, payroll, or audit dataset was provided for this record.",
          "Aureon will not infer or invent actors, companies, approval chains, or case evidence.",
        ],
        evidence: [
          "Status: no verifiable record-level evidence loaded for this item.",
          "Policy: unsupported details are withheld instead of being AI-generated.",
        ],
        evidenceScore: 0,
        evidenceStrength: "weak",
        whyOverpriced: "Not available from the current live public source set.",
        whyHarmful: "Aureon cannot assert case-specific harm without source-backed record evidence.",
        potentialEffects: ["Connect live contract, payroll, spending, or audit records to enable real evidence-backed analysis."],
        aureonRecommendation: "Connect a verifiable public record source before using this panel for case-level accusations or named attribution.",
        responsibleParty: {
          name: "Unavailable from live source",
          title: "Not provided",
          department: "Not provided",
          email: "Not available",
        },
        approvedBy: {
          name: "Unavailable from live source",
          title: "Not provided",
          department: "Not provided",
          totalApprovals: 0,
          totalValueApproved: 0,
          flaggedApprovals: 0,
          wasteRate: 0,
          patterns: [],
          flags: [],
          approvalHistory: [],
        },
        collusionIndicators: [],
        recurringPatterns: [],
        timeline: [],
        recommendations: [
          { priority: "Immediate", action: "Load a source-backed record feed for this category.", timeline: "Before further case analysis" },
        ],
        supportingDocs: ["No supporting document loaded for this record."],
        referenceLinks: [],
        financialImpact: { immediate: 0, annual: 0, lifetime: 0, opportunityCost: "Not calculated without source-backed case data." },
        citizenImpact: "Not available from the current live source set.",
        alternativeUses: [],
      };
      setRecordDrill(unsupportedDrill);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(unsupportedDrill)); } catch { /* storage full */ }
    } catch (e) {
      console.error("Record drill-down failed:", e);
    }
    setDrillLoading(false);
  };

  const filteredRecords = detail?.records.filter(r => {
    if (filter === "all") return true;
    const s = String(r.status || r.status_flag || "").toLowerCase();
    if (filter === "active") return /active|open|flagged|critical|confirmed|suspicious/i.test(s);
    if (filter === "resolved") return /resolved|recovered|closed|refunded|terminated/i.test(s);
    if (filter === "in_progress") return /progress|review|pending|requested|investigating/i.test(s);
    return true;
  }) || [];

  if (detail) {
    const ov = detail.overview;
    return (
      <div className="mt-3 space-y-3">
        {/* Export Button */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => exportDetailAsTxt(detail, category, recordDrill, selectedRecord)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-foreground/[0.05] border border-border/[0.08] text-[8px] text-foreground/50 hover:bg-foreground/[0.08] transition-all"
          >
            <Download className="h-3 w-3" /> Export Complete Report
          </button>
        </div>

        {/* Overview Stats */}
        {ov && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Total Items</p>
              <p className="text-[16px] font-light text-foreground/70 mt-0.5">{ov.totalItems}</p>
              <p className="text-[8px] text-muted-foreground/30 mt-0.5">
                <span className="text-red-400/60">{ov.activeItems} active</span>{" · "}
                <span className="text-yellow-400/60">{ov.inProgressItems} in progress</span>{" · "}
                <span className="text-emerald-400/60">{ov.resolvedItems} resolved</span>
              </p>
            </div>
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Financial Impact</p>
              <p className="text-[16px] font-light text-foreground/70 mt-0.5">{fmtVal(ov.totalAmount)}</p>
              <p className="text-[8px] text-muted-foreground/30 mt-0.5">Annual impact</p>
            </div>
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Departments</p>
              <p className="text-[16px] font-light text-foreground/70 mt-0.5">{ov.departments?.length || 0}</p>
              <p className="text-[8px] text-muted-foreground/30 mt-0.5 truncate">{ov.departments?.slice(0, 3).join(", ")}</p>
            </div>
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Resolution Rate</p>
              <p className="text-[16px] font-light text-foreground/70 mt-0.5">
                {ov.totalItems > 0 ? Math.round((ov.resolvedItems / ov.totalItems) * 100) : 0}%
              </p>
              <div className="w-full h-1 rounded-full bg-foreground/[0.06] mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400/40 transition-all" style={{ width: `${ov.totalItems > 0 ? (ov.resolvedItems / ov.totalItems) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        )}

        {detail.summary && <p className="text-[9px] text-foreground/40 font-light italic">{detail.summary}</p>}

        {/* Recurring Patterns Section */}
        {detail.recurringPatterns && detail.recurringPatterns.length > 0 && (
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4">
            <p className="text-[8px] uppercase tracking-[0.15em] text-yellow-400/50 mb-3 flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" /> Recurring Patterns Detected ({detail.recurringPatterns.length})
            </p>
            <div className="space-y-2">
              {detail.recurringPatterns.map((p, i) => (
                <div key={i} className="rounded-lg border border-yellow-500/10 bg-yellow-500/[0.03] p-3">
                  <p className="text-[10px] text-foreground/60 font-light">{p.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[8px] text-yellow-400/50">Involved: {p.involvedParties?.join(", ")}</span>
                    <span className="text-[8px] text-muted-foreground/30">Frequency: {p.frequency}</span>
                    <span className="text-[8px] text-red-400/60">Impact: {fmtVal(p.totalImpact)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3 w-3 text-foreground/40" />
          <p className="text-[8px] uppercase tracking-[0.15em] text-foreground/50 mr-2">Itemized Records ({filteredRecords.length})</p>
          {["all", "active", "in_progress", "resolved"].map(f => (
            <button key={f} onClick={() => setFilter(f as typeof filter)} className={`text-[7px] px-2 py-0.5 rounded-md border transition-all ${filter === f ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/60" : "border-border/[0.06] text-muted-foreground/30 hover:bg-foreground/[0.03]"}`}>
              {f === "all" ? "All" : f === "active" ? "Active" : f === "in_progress" ? "In Progress" : "Resolved"}
            </button>
          ))}
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto rounded-lg border border-border/[0.08]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/[0.08] bg-foreground/[0.03]">
                {detail.columns.map(col => (
                  <th key={col.key} className="px-2.5 py-1.5 text-[7px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium whitespace-nowrap">{col.label}</th>
                ))}
                <th className="px-2.5 py-1.5 text-[7px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec, ri) => (
                <tr key={rec.id || ri} className="border-b border-border/[0.04] hover:bg-foreground/[0.03] transition-colors cursor-pointer group" onClick={() => drillIntoRecord(rec)}>
                  {detail.columns.map(col => {
                    const val = rec[col.key];
                    const isStatus = col.key === "status" || col.key === "status_flag";
                    const isRisk = typeof val === "string" && /high|critical|flagged|suspicious|over.?budget|rejected|fraud|ghost|inactive/i.test(val);
                    const isGood = typeof val === "string" && /verified|resolved|low|clean|approved|active|compliant|on.?track|recovered/i.test(val);
                    return (
                      <td key={col.key} className="px-2.5 py-1.5 text-[9px] font-light whitespace-nowrap">
                        {isStatus ? (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${statusColor(String(val))}`}>{String(val)}</span>
                        ) : (
                          <span className={isRisk ? "text-red-400/70" : isGood ? "text-emerald-400/70" : "text-foreground/55"}>{fmtVal(val)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2.5 py-1.5"><ChevronRight className="h-3 w-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Department & Responsible Breakdown */}
        {ov && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ov.departments && ov.departments.length > 0 && (
              <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">By Department</p>
                {ov.departments.map(dept => {
                  const ct = detail.records.filter(r => String(r.department || r.dept || "").includes(dept)).length;
                  return (
                    <div key={dept} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                      <span className="text-[9px] text-foreground/50 font-light">{dept}</span>
                      <span className="text-[8px] text-muted-foreground/40">{ct} items</span>
                    </div>
                  );
                })}
              </div>
            )}
            {ov.topResponsible && ov.topResponsible.length > 0 && (
              <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">By Responsible Party</p>
                {ov.topResponsible.map(person => {
                  const ct = detail.records.filter(r => String(r.responsible_person || r.manager || r.paid_by || r.employee_name || "").includes(person)).length;
                  return (
                    <div key={person} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                      <span className="text-[9px] text-foreground/50 font-light">{person}</span>
                      <span className="text-[8px] text-muted-foreground/40">{ct} items</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Record Detail Modal */}
        <Dialog open={!!selectedRecord} onOpenChange={() => { setSelectedRecord(null); setRecordDrill(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/[0.12]">
            <DialogHeader>
              <DialogTitle className="text-[13px] font-light text-foreground/80 flex items-center gap-2">
                <Shield className="h-4 w-4 text-foreground/40" />
                Forensic Investigation: {selectedRecord?.id}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground/40">Complete evidence-based analysis for {category}</DialogDescription>
            </DialogHeader>

            {selectedRecord && (
              <div className="space-y-4 mt-2">
                {/* Record Fields */}
                <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                  <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-3">Record Data</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {detail?.columns.map(col => (
                      <div key={col.key}>
                        <p className="text-[7px] uppercase tracking-[0.12em] text-muted-foreground/30">{col.label}</p>
                        <p className="text-[10px] text-foreground/60 font-light mt-0.5">{fmtVal(selectedRecord[col.key])}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {drillLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/40 ml-2">Checking live-source availability...</span>
                  </div>
                )}

                {!drillLoading && recordDrill && (
                  <div className="space-y-4">
                    {/* Export + Evidence Strength */}
                    <div className="flex items-center justify-between">
                      {recordDrill.evidenceStrength && (
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-3.5 w-3.5 text-foreground/30" />
                          <span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground/30">Evidence Strength:</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded-full ${evidenceStrengthConfig[recordDrill.evidenceStrength]?.bg || "bg-foreground/5"} ${evidenceStrengthConfig[recordDrill.evidenceStrength]?.color || "text-foreground/50"}`}>
                            {evidenceStrengthConfig[recordDrill.evidenceStrength]?.label || recordDrill.evidenceStrength} ({recordDrill.evidenceScore}/100)
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${recordDrill.evidenceScore >= 80 ? "bg-blue-400/50" : recordDrill.evidenceScore >= 60 ? "bg-emerald-400/50" : recordDrill.evidenceScore >= 40 ? "bg-yellow-400/50" : "bg-red-400/50"}`} style={{ width: `${recordDrill.evidenceScore}%` }} />
                          </div>
                        </div>
                      )}
                      <button onClick={() => exportDetailAsTxt(detail, category, recordDrill, selectedRecord)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-foreground/[0.05] border border-border/[0.08] text-[8px] text-foreground/50 hover:bg-foreground/[0.08] transition-all">
                        <Download className="h-3 w-3" /> Download Report
                      </button>
                    </div>

                    {/* Why Overpriced / Why Harmful / Citizen Impact */}
                    {(recordDrill.whyOverpriced || recordDrill.whyHarmful || recordDrill.citizenImpact) && (
                      <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 space-y-3">
                        {recordDrill.whyOverpriced && (
                          <div>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-red-400/50 mb-1 flex items-center gap-1.5"><Scale className="h-3 w-3" /> Why Overpriced / Wasteful</p>
                            <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.whyOverpriced}</p>
                          </div>
                        )}
                        {recordDrill.whyHarmful && (
                          <div>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-red-400/50 mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Why This Is Harmful</p>
                            <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.whyHarmful}</p>
                          </div>
                        )}
                        {recordDrill.citizenImpact && (
                          <div>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-red-400/50 mb-1 flex items-center gap-1.5"><Users className="h-3 w-3" /> Direct Citizen Impact</p>
                            <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.citizenImpact}</p>
                          </div>
                        )}
                        {recordDrill.potentialEffects && recordDrill.potentialEffects.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase tracking-[0.12em] text-muted-foreground/30 mb-1">Cascading Effects</p>
                            <ul className="space-y-1">
                              {recordDrill.potentialEffects.map((e, i) => (
                                <li key={i} className="text-[9px] text-foreground/50 font-light flex items-start gap-1.5">
                                  <TrendingUp className="h-3 w-3 text-red-400/30 mt-0.5 shrink-0" /> {e}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Aureon Recommendation */}
                    {recordDrill.aureonRecommendation && (
                      <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-emerald-400/50 mb-1 flex items-center gap-1.5"><Target className="h-3 w-3" /> Aureon Strategic Recommendation</p>
                        <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.aureonRecommendation}</p>
                      </div>
                    )}

                    {/* Price Comparison with Breakdown + Chart */}
                    {recordDrill.priceComparison && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4 space-y-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 flex items-center gap-1.5"><Scale className="h-3 w-3" /> Price Comparison & Market Analysis</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Current Price</p><p className="text-[12px] text-red-400/70 font-light">{fmtVal(recordDrill.priceComparison.currentPrice)}</p></div>
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Market Average</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.priceComparison.marketAverage)}</p></div>
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Best Price</p><p className="text-[12px] text-emerald-400/70 font-light">{fmtVal(recordDrill.priceComparison.bestMarketPrice)}</p></div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-red-400/40" style={{ width: `${Math.min(recordDrill.priceComparison.overchargePercent, 100)}%` }} />
                        </div>
                        <p className="text-[9px] text-red-400/60">Overcharged by {recordDrill.priceComparison.overchargePercent}%</p>

                        {/* Price Comparison Bar Chart */}
                        {(() => {
                          const chartData = [
                            { name: "Current", value: recordDrill.priceComparison!.currentPrice, fill: "hsl(0, 70%, 55%)" },
                            { name: "Market Avg", value: recordDrill.priceComparison!.marketAverage, fill: "hsl(45, 70%, 55%)" },
                            { name: "Best Price", value: recordDrill.priceComparison!.bestMarketPrice, fill: "hsl(150, 60%, 45%)" },
                          ];
                          if (recordDrill.priceComparison!.comparableSources?.length) {
                            recordDrill.priceComparison!.comparableSources.slice(0, 3).forEach(s => {
                              chartData.push({ name: s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name, value: s.price, fill: "hsl(210, 50%, 55%)" });
                            });
                          }
                          if (recordDrill.priceComparison!.internationalBenchmarks?.length) {
                            recordDrill.priceComparison!.internationalBenchmarks.forEach(b => {
                              chartData.push({ name: b.country, value: b.price, fill: "hsl(270, 40%, 55%)" });
                            });
                          }
                          return (
                            <div className="h-48 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,30%)" strokeOpacity={0.15} />
                                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 8, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} />
                                  <Tooltip formatter={(v: number) => fmtVal(v)} contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: 8, fontSize: 10 }} labelStyle={{ fontSize: 9, color: "hsl(0,0%,60%)" }} />
                                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} fillOpacity={0.7} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}

                        {/* Cost Breakdown */}
                        {recordDrill.priceComparison.breakdown && recordDrill.priceComparison.breakdown.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-2">Cost Breakdown by Component</p>
                            {/* Breakdown comparison chart */}
                            <div className="h-40 w-full mb-3">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={recordDrill.priceComparison.breakdown.map(b => ({ name: b.component.length > 16 ? b.component.slice(0, 16) + "…" : b.component, current: b.currentCost, market: b.marketCost, variance: b.variance }))} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,30%)" strokeOpacity={0.15} />
                                  <XAxis dataKey="name" tick={{ fontSize: 7, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 7, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} />
                                  <Tooltip formatter={(v: number) => fmtVal(v)} contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: 8, fontSize: 10 }} />
                                  <Bar dataKey="current" name="Current Cost" fill="hsl(0, 65%, 55%)" fillOpacity={0.6} radius={[3, 3, 0, 0]} />
                                  <Bar dataKey="market" name="Market Cost" fill="hsl(150, 55%, 45%)" fillOpacity={0.6} radius={[3, 3, 0, 0]} />
                                  <Line type="monotone" dataKey="variance" name="Variance" stroke="hsl(45, 80%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="space-y-1.5">
                              {recordDrill.priceComparison.breakdown.map((b, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-foreground/[0.02] border border-border/[0.04]">
                                  <span className="text-[9px] text-foreground/55 font-light">{b.component}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[8px] text-red-400/60">{fmtVal(b.currentCost)}</span>
                                    <span className="text-[8px] text-muted-foreground/30">vs</span>
                                    <span className="text-[8px] text-emerald-400/60">{fmtVal(b.marketCost)}</span>
                                    <span className="text-[7px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/60">+{fmtVal(b.variance)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Comparable Sources */}
                        {recordDrill.priceComparison.comparableSources?.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1.5">Comparable Sources</p>
                            {recordDrill.priceComparison.comparableSources.map((s, i) => (
                              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/[0.04] last:border-0">
                                <div>
                                  <span className="text-[9px] text-foreground/50 font-light">{s.name}</span>
                                  <span className="text-[7px] ml-1.5 px-1 py-0.5 rounded bg-foreground/[0.04] text-muted-foreground/30">{s.type?.replace(/_/g, " ")}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-emerald-400/60">{fmtVal(s.price)}</span>
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-blue-400/50 hover:text-blue-400/80 flex items-center gap-0.5">
                                    <Link2 className="h-2.5 w-2.5" /> Source
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* International Benchmarks */}
                        {recordDrill.priceComparison.internationalBenchmarks && recordDrill.priceComparison.internationalBenchmarks.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1.5 flex items-center gap-1"><BarChart3 className="h-3 w-3" /> International Benchmarks (PPP-Adjusted)</p>
                            {recordDrill.priceComparison.internationalBenchmarks.map((b, i) => (
                              <div key={i} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                                <span className="text-[9px] text-foreground/50 font-light">{b.country}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-emerald-400/60">{fmtVal(b.price)}</span>
                                  <span className="text-[7px] text-muted-foreground/30">{b.source}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Peer Agencies */}
                        {recordDrill.priceComparison.peerAgencies && recordDrill.priceComparison.peerAgencies.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1.5 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Peer Agency Comparison</p>
                            {recordDrill.priceComparison.peerAgencies.map((p, i) => (
                              <div key={i} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                                <span className="text-[9px] text-foreground/50 font-light">{p.agency}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] text-muted-foreground/30">{p.vendor}</span>
                                  <span className="text-[9px] text-emerald-400/60">{fmtVal(p.price)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Root Cause */}
                    <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                      <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Root Cause Analysis</p>
                      <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.rootCause}</p>
                      {recordDrill.contributingFactors?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[7px] uppercase tracking-[0.12em] text-muted-foreground/30 mb-1">Contributing Factors</p>
                          <ul className="space-y-1">
                            {recordDrill.contributingFactors.map((f, i) => (
                              <li key={i} className="text-[9px] text-foreground/50 font-light flex items-start gap-1.5"><span className="text-muted-foreground/30 mt-0.5">•</span> {f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Responsible Party & Approver */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><User className="h-3 w-3" /> Responsible Party</p>
                        <p className="text-[10px] text-foreground/60 font-light">{recordDrill.responsibleParty?.name}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.responsibleParty?.title}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.responsibleParty?.department}</p>
                        <p className="text-[8px] text-muted-foreground/30 mt-1">{recordDrill.responsibleParty?.email}</p>
                        {recordDrill.responsibleParty?.yearsInRole && <p className="text-[8px] text-muted-foreground/30">{recordDrill.responsibleParty.yearsInRole} years in role</p>}
                      </div>
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><Gavel className="h-3 w-3" /> Approver / Decision Maker</p>
                        <p className="text-[10px] text-foreground/60 font-light">{recordDrill.approvedBy?.name}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.approvedBy?.title}</p>
                        {recordDrill.approvedBy?.department && <p className="text-[9px] text-muted-foreground/40">{recordDrill.approvedBy.department}</p>}

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Total Approved</p>
                            <p className="text-[11px] text-foreground/60">{recordDrill.approvedBy?.totalApprovals}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Value Approved</p>
                            <p className="text-[11px] text-foreground/60">{fmtVal(recordDrill.approvedBy?.totalValueApproved)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Flagged</p>
                            <p className="text-[11px] text-red-400/70">{recordDrill.approvedBy?.flaggedApprovals}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Waste Rate</p>
                            <p className="text-[11px] text-red-400/70">{recordDrill.approvedBy?.wasteRate?.toFixed(1) || 0}%</p>
                          </div>
                        </div>

                        {/* Approver Patterns */}
                        {recordDrill.approvedBy?.patterns?.length > 0 && (
                          <div className="mt-3 border-t border-border/[0.06] pt-2">
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1">Behavioral Patterns</p>
                            {recordDrill.approvedBy.patterns.map((p, i) => (
                              <div key={i} className="flex items-start gap-1.5 py-0.5">
                                <span className={`text-[6px] px-1 py-0.5 rounded shrink-0 mt-0.5 ${p.severity === "high" ? "bg-red-500/10 text-red-400/60" : p.severity === "medium" ? "bg-yellow-500/10 text-yellow-400/60" : "bg-foreground/5 text-foreground/40"}`}>{p.severity}</span>
                                <span className="text-[8px] text-foreground/50 font-light">{p.description}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Approver Flags */}
                        {recordDrill.approvedBy?.flags?.length > 0 && (
                          <div className="mt-2 border-t border-border/[0.06] pt-2">
                            <p className="text-[7px] uppercase text-red-400/40 mb-1">⚠ Red Flags</p>
                            {recordDrill.approvedBy.flags.map((f, i) => (
                              <div key={i} className="flex items-start gap-1.5 py-0.5">
                                <span className={`text-[6px] px-1 py-0.5 rounded shrink-0 mt-0.5 ${f.severity === "critical" ? "bg-red-500/20 text-red-400/80" : "bg-red-500/10 text-red-400/60"}`}>{f.severity}</span>
                                <span className="text-[8px] text-foreground/50 font-light">{f.description}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Approval History with Chart */}
                        {recordDrill.approvedBy?.approvalHistory?.length > 0 && (
                          <div className="mt-2 border-t border-border/[0.06] pt-2">
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1">Approval History</p>
                            {/* Approval History Bar Chart */}
                            <div className="h-36 w-full mb-2">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={recordDrill.approvedBy.approvalHistory.map(h => ({ date: h.date?.slice(5) || "", amount: h.amount, flagged: h.flagged, name: h.item?.length > 20 ? h.item.slice(0, 20) + "…" : h.item }))} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,30%)" strokeOpacity={0.15} />
                                  <XAxis dataKey="date" tick={{ fontSize: 7, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 7, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} />
                                  <Tooltip formatter={(v: number) => fmtVal(v)} contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: 8, fontSize: 10 }} labelStyle={{ fontSize: 9, color: "hsl(0,0%,60%)" }} />
                                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                                    {recordDrill.approvedBy.approvalHistory.map((h, idx) => (
                                      <Cell key={idx} fill={h.flagged ? "hsl(0, 65%, 55%)" : "hsl(210, 50%, 50%)"} fillOpacity={0.65} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="flex items-center gap-1 text-[7px] text-muted-foreground/40"><span className="w-2 h-2 rounded-sm bg-[hsl(0,65%,55%)] opacity-65" /> Flagged</span>
                              <span className="flex items-center gap-1 text-[7px] text-muted-foreground/40"><span className="w-2 h-2 rounded-sm bg-[hsl(210,50%,50%)] opacity-65" /> Clean</span>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                              {recordDrill.approvedBy.approvalHistory.map((h, i) => (
                                <div key={i} className="flex items-center gap-2 py-0.5 text-[8px]">
                                  <span className="text-muted-foreground/30 w-[60px] shrink-0">{h.date}</span>
                                  <span className="text-foreground/50 truncate flex-1">{h.item}</span>
                                  <span className="text-foreground/50 shrink-0">{fmtVal(h.amount)}</span>
                                  {h.vendor && <span className="text-muted-foreground/30 text-[7px] shrink-0">{h.vendor}</span>}
                                  {h.flagged && <span className="text-red-400/60 text-[7px] shrink-0">⚠</span>}
                                  {h.outcome && <span className="text-[7px] text-muted-foreground/30 shrink-0">→ {h.outcome}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Approver Performance Donut */}
                        {recordDrill.approvedBy && recordDrill.approvedBy.totalApprovals > 0 && (
                          <div className="mt-2 border-t border-border/[0.06] pt-2">
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1">Approval Performance</p>
                            <div className="h-32 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: "Clean", value: recordDrill.approvedBy.totalApprovals - recordDrill.approvedBy.flaggedApprovals, fill: "hsl(210, 50%, 50%)" },
                                      { name: "Flagged / Waste", value: recordDrill.approvedBy.flaggedApprovals, fill: "hsl(0, 65%, 55%)" },
                                    ]}
                                    cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value"
                                  >
                                    <Cell fill="hsl(210, 50%, 50%)" fillOpacity={0.6} />
                                    <Cell fill="hsl(0, 65%, 55%)" fillOpacity={0.7} />
                                  </Pie>
                                  <Tooltip formatter={(v: number) => v} contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: 8, fontSize: 10 }} />
                                  <Legend wrapperStyle={{ fontSize: 8 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Collusion Indicators */}
                    {recordDrill.collusionIndicators && recordDrill.collusionIndicators.length > 0 && (
                      <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-red-400/50 mb-2 flex items-center gap-1.5"><Network className="h-3 w-3" /> Collusion / Conflict Indicators</p>
                        {recordDrill.collusionIndicators.map((c, i) => (
                          <div key={i} className="py-1.5 border-b border-red-500/[0.06] last:border-0">
                            <div className="flex items-start gap-2">
                              <span className={`text-[6px] px-1 py-0.5 rounded shrink-0 mt-0.5 ${c.severity === "critical" ? "bg-red-500/20 text-red-400/80" : c.severity === "high" ? "bg-red-500/10 text-red-400/60" : "bg-yellow-500/10 text-yellow-400/60"}`}>{c.severity}</span>
                              <div>
                                <p className="text-[9px] text-foreground/55 font-light">{c.description}</p>
                                <p className="text-[8px] text-muted-foreground/30 mt-0.5">Involved: {c.involvedParties?.join(", ")}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recurring Patterns with Chart */}
                    {recordDrill.recurringPatterns && recordDrill.recurringPatterns.length > 0 && (
                      <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-yellow-400/50 mb-2 flex items-center gap-1.5"><Repeat className="h-3 w-3" /> Recurring Patterns</p>
                        {/* Pattern frequency chart */}
                        <div className="h-36 w-full mb-3">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={recordDrill.recurringPatterns.map(p => ({ name: p.involvedPerson?.length > 12 ? p.involvedPerson.slice(0, 12) + "…" : p.involvedPerson, occurrences: p.occurrences, amount: p.totalAmount }))} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,30%)" strokeOpacity={0.15} />
                              <XAxis type="number" tick={{ fontSize: 7, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: "hsl(0,0%,55%)" }} tickLine={false} axisLine={false} width={55} />
                              <Tooltip formatter={(v: number, name: string) => name === "amount" ? fmtVal(v) : `${v}x`} contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: 8, fontSize: 10 }} />
                              <Bar dataKey="occurrences" name="Occurrences" fill="hsl(45, 70%, 55%)" fillOpacity={0.6} radius={[0, 3, 3, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {recordDrill.recurringPatterns.map((p, i) => (
                          <div key={i} className="py-1.5 border-b border-yellow-500/[0.06] last:border-0">
                            <p className="text-[9px] text-foreground/55 font-light">{p.description}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-[8px] text-muted-foreground/40">{p.involvedPerson} ({p.role})</span>
                              <span className="text-[8px] text-yellow-400/50">{p.occurrences}x occurrences</span>
                              <span className="text-[8px] text-red-400/50">{fmtVal(p.totalAmount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Evidence */}
                    {recordDrill.evidence?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><Search className="h-3 w-3" /> Evidence Chain</p>
                        <ul className="space-y-1.5">
                          {recordDrill.evidence.map((e, i) => (
                            <li key={i} className="text-[9px] text-foreground/50 font-light flex items-start gap-1.5">
                              <CheckCircle className="h-3 w-3 text-emerald-400/40 mt-0.5 shrink-0" /> {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Financial Impact + Alternative Uses */}
                    {recordDrill.financialImpact && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4 space-y-3">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30">Financial Impact Analysis</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Immediate</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.immediate)}</p></div>
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Annual</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.annual)}</p></div>
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Lifetime</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.lifetime)}</p></div>
                        </div>
                        {recordDrill.financialImpact.opportunityCost && (
                          <p className="text-[9px] text-foreground/40 font-light italic">Opportunity Cost: {recordDrill.financialImpact.opportunityCost}</p>
                        )}
                        {recordDrill.alternativeUses && recordDrill.alternativeUses.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1.5 flex items-center gap-1"><Zap className="h-3 w-3" /> What This Money Could Fund Instead</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {recordDrill.alternativeUses.map((u, i) => (
                                <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/[0.06]">
                                  <span className="text-[9px] text-emerald-400/60 font-light">{u.description}: <span className="text-foreground/50">{u.quantity}</span></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    {recordDrill.timeline?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Event Timeline</p>
                        <div className="space-y-2">
                          {recordDrill.timeline.map((t, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <div className="flex flex-col items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
                                {i < recordDrill.timeline.length - 1 && <div className="w-px h-4 bg-border/[0.1]" />}
                              </div>
                              <div>
                                <p className="text-[8px] text-muted-foreground/30">{t.date}</p>
                                <p className="text-[9px] text-foreground/50 font-light">{t.event}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {recordDrill.recommendations?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">Recommended Actions</p>
                        <div className="space-y-2">
                          {recordDrill.recommendations.map((r, i) => (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-foreground/[0.02] border border-border/[0.04]">
                              <span className={`text-[7px] px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${r.priority === "Immediate" ? "text-red-400/70 bg-red-500/10 border-red-500/10" : r.priority === "Short-Term" ? "text-yellow-400/70 bg-yellow-500/10 border-yellow-500/10" : "text-foreground/40 bg-foreground/[0.04] border-border/[0.06]"}`}>{r.priority}</span>
                              <div className="flex-1">
                                <p className="text-[9px] text-foreground/55 font-light">{r.action}</p>
                                <p className="text-[8px] text-muted-foreground/30 mt-0.5 flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {r.timeline}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reference Links */}
                    {recordDrill.referenceLinks?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Reference Links & Sources</p>
                        <div className="space-y-1">
                          {recordDrill.referenceLinks.map((l, i) => (
                            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-1 text-[9px] text-blue-400/50 hover:text-blue-400/80 font-light">
                              <Link2 className="h-3 w-3 shrink-0" /> {l.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Supporting Documents */}
                    {recordDrill.supportingDocs?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Supporting Documents</p>
                        <div className="space-y-1">
                          {recordDrill.supportingDocs.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 py-1">
                              <FileText className="h-3 w-3 text-muted-foreground/20" />
                              <span className="text-[9px] text-foreground/50 font-light">{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); generate(); }}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/[0.05] border border-border/[0.08] text-[9px] text-foreground/50 hover:bg-foreground/[0.08] transition-all disabled:opacity-40 mt-2"
    >
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Loading live-source status...</>
      ) : (
        <><Eye className="h-3 w-3" /> {label || "Deep Dive — Live Source Status"}</>
      )}
    </button>
  );
};

export default ZeeionDeepDive;
