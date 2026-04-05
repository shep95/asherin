import { useState } from "react";
import { Loader2, Eye, Table2, X, ChevronRight, Shield, User, Calendar, FileText, AlertTriangle, CheckCircle, Clock, Search, Download, Link2, TrendingUp, Scale, Repeat, BarChart3, Fingerprint, Network, Gavel, BookOpen, Target, Zap } from "lucide-react";
import { streamChat } from "@/lib/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

  const generate = async () => {
    setLoading(true);
    let aiContent = "";
    try {
      const savedByok = localStorage.getItem("aureon_byok_active");
      localStorage.removeItem("aureon_byok_active");

      const colInstruction = columnHint || `columns: record_id, description, amount, department, responsible_person, approver, date, status, risk_level. Generate 12-18 detailed records.`;

      await streamChat({
        messages: [{
          role: "user",
          content: `You are Aureon's forensic AI generating DETAILED itemized data with full attribution and recurring pattern analysis.\n\nCategory: ${category}\nContext: ${context}\n\n${colInstruction}\n\nIMPORTANT: Every record MUST include:\n- "id": Official-looking ID (e.g., REC-2026-0041)\n- "status": One of "Active", "In Progress", "Under Review", "Resolved", "Flagged"\n- "department": The responsible department\n- "responsible_person": Name of responsible individual\n- "approver": Name of person who approved this\n- "amount" or a numeric value column\n\nAlso analyze for RECURRING PATTERNS — same sender, same approver, same vendor appearing repeatedly, same amounts, suspicious timing patterns.\n\nReturn ONLY a JSON object (no markdown):\n{\n  "columns": [{"key": "column_name", "label": "Display Label"}, ...],\n  "records": [{"id": "REC-001", "column_name": "value", ...}, ...],\n  "summary": "Brief summary of findings",\n  "overview": {\n    "totalItems": <number>,\n    "totalAmount": <total dollar amount>,\n    "activeItems": <count>,\n    "resolvedItems": <count>,\n    "inProgressItems": <count>,\n    "departments": ["dept1", ...],\n    "topResponsible": ["person1", ...]\n  },\n  "recurringPatterns": [\n    {\n      "description": "Pattern description — e.g., Judge X approved 5 overpriced contracts for same vendor",\n      "involvedParties": ["Name1", "Name2"],\n      "frequency": "5 times in 6 months",\n      "totalImpact": <dollar amount>\n    }\n  ]\n}\n\nMake data realistic. Generate 12-20 records. Include realistic dates in 2025-2026.`
        }],
        mode: "research",
        onDelta: (chunk) => { aiContent += chunk; },
        onDone: () => {},
      });

      if (savedByok) localStorage.setItem("aureon_byok_active", savedByok);

      const clean = aiContent.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as PatternDetail;
        if (!parsed.overview) {
          const amounts = parsed.records.map(r => {
            for (const k of Object.keys(r)) {
              if (typeof r[k] === "number" && k !== "id") return r[k] as number;
            }
            return 0;
          });
          const statuses = parsed.records.map(r => String(r.status || r.status_flag || "Active"));
          const depts = [...new Set(parsed.records.map(r => String(r.department || r.dept || "Unknown")))];
          const people = [...new Set(parsed.records.map(r => String(r.responsible_person || r.manager || r.paid_by || "Unknown")))].slice(0, 5);
          parsed.overview = {
            totalItems: parsed.records.length,
            totalAmount: amounts.reduce((s, v) => s + Math.abs(v), 0),
            activeItems: statuses.filter(s => /active|open|flagged|critical|confirmed/i.test(s)).length,
            resolvedItems: statuses.filter(s => /resolved|recovered|closed|refunded|terminated/i.test(s)).length,
            inProgressItems: statuses.filter(s => /progress|review|pending|requested|investigating/i.test(s)).length,
            departments: depts,
            topResponsible: people,
          };
        }
        setDetail(parsed);
      }
    } catch (e) {
      console.error("Deep dive failed:", e);
    }
    setLoading(false);
  };

  const drillIntoRecord = async (record: DetailRecord) => {
    setSelectedRecord(record);
    setRecordDrill(null);
    setDrillLoading(true);

    let aiContent = "";
    try {
      const savedByok = localStorage.getItem("aureon_byok_active");
      localStorage.removeItem("aureon_byok_active");

      const recordStr = Object.entries(record).map(([k, v]) => `${k}: ${v}`).join("\n");

      await streamChat({
        messages: [{
          role: "user",
          content: `You are Aureon's forensic AI generating a COMPLETE evidence-based investigation for a single waste record. This must be court-admissible quality evidence.\n\nCategory: ${category}\nRecord Data:\n${recordStr}\n\nGenerate the MOST COMPREHENSIVE forensic report possible. You MUST include ALL of the following:\n\n1. ROOT CAUSE — Deep analysis of why this waste exists\n2. WHY OVERPRICED — Specific numerical reasoning with market comparison\n3. WHY HARMFUL — How this waste harms citizens, services, budget\n4. CITIZEN IMPACT — Direct impact on taxpayers and public services\n5. EVIDENCE SCORE — Rate your evidence strength 0-100\n6. PRICE COMPARISON with:\n   - Cost breakdown by component (base service, maintenance, licensing, etc.)\n   - At least 3 comparable market sources with realistic URLs\n   - International benchmarks (3+ countries with PPP adjustment)\n   - Peer agency comparisons (other government agencies paying less)\n7. APPROVER FULL PROFILE:\n   - Total approvals given in career\n   - Total dollar value approved\n   - Number flagged as waste\n   - Waste rate percentage\n   - Behavioral PATTERNS detected (rubber stamp, vendor favoritism, price blindness)\n   - RED FLAGS raised\n   - Full approval history (8+ entries) showing their track record\n8. COLLUSION INDICATORS — Any signs of collusion between approver and vendor\n9. RECURRING PATTERNS — Same people, vendors, amounts appearing repeatedly\n10. ALTERNATIVE USES — What this wasted money could have funded instead (schools, hospitals, etc.)\n11. AUREON RECOMMENDATION — Specific strategic recommendation\n\nReturn ONLY JSON (no markdown):\n{\n  "rootCause": "Detailed root cause analysis with systemic issues identified",\n  "evidenceScore": <0-100>,\n  "evidenceStrength": "weak|moderate|strong|forensic",\n  "whyOverpriced": "Specific numerical reasoning — e.g., 'Current vendor charges $3.2M/yr for IT services. Market analysis of 15 comparable vendors shows average of $2.1M. The support component alone is 120% above market rate.'",\n  "whyHarmful": "Specific harm description with affected populations",\n  "citizenImpact": "How this directly affects taxpayers — e.g., 'Each taxpayer effectively pays $X extra due to this overcharge. These funds could provide healthcare to 5,000 families.'",\n  "potentialEffects": ["Budget deficit increases by X%", "Y public projects delayed", "Citizen trust erodes"],\n  "aureonRecommendation": "Specific multi-step recommendation with timeline and expected outcomes",\n  "contributingFactors": ["Weak procurement oversight", "No competitive bidding requirement", "Approver-vendor relationship"],\n  "evidence": ["Market research from 15 vendors shows avg $X", "Independent audit confirmed overcharge", "Contract lacked competitive bidding", "Price increased 45% in 3 years without justification", "Similar agencies pay 35% less"],\n  "priceComparison": {\n    "currentPrice": <number>,\n    "marketAverage": <number>,\n    "bestMarketPrice": <number>,\n    "overchargePercent": <number>,\n    "breakdown": [\n      {"component": "Base Service", "currentCost": <number>, "marketCost": <number>, "variance": <number>},\n      {"component": "Support & Maintenance", "currentCost": <number>, "marketCost": <number>, "variance": <number>},\n      {"component": "Licensing", "currentCost": <number>, "marketCost": <number>, "variance": <number>}\n    ],\n    "comparableSources": [\n      {"name": "Vendor Name", "price": <number>, "url": "https://realistic-procurement-url.example.com", "type": "direct_competitor"},\n      {"name": "Another Vendor", "price": <number>, "url": "https://another-url.example.com", "type": "market_research"},\n      {"name": "Government Portal", "price": <number>, "url": "https://procurement-portal.example.gov", "type": "government_benchmark"}\n    ],\n    "internationalBenchmarks": [\n      {"country": "Chile", "price": <number>, "source": "ChileCompra Portal"},\n      {"country": "Colombia", "price": <number>, "source": "Colombia Compra Eficiente"},\n      {"country": "Mexico", "price": <number>, "source": "CompraNet"}\n    ],\n    "peerAgencies": [\n      {"agency": "Ministry of Health", "vendor": "Alt Vendor", "price": <number>},\n      {"agency": "Ministry of Education", "vendor": "Another Vendor", "price": <number>}\n    ]\n  },\n  "responsibleParty": {"name": "Full Name", "title": "Job Title", "department": "Dept", "email": "email@gov.example", "yearsInRole": <number>},\n  "approvedBy": {\n    "name": "Approver Full Name",\n    "title": "Senior Procurement Director",\n    "department": "Department",\n    "totalApprovals": <total number, e.g., 234>,\n    "totalValueApproved": <total dollar amount, e.g., 450000000>,\n    "flaggedApprovals": <number flagged, e.g., 18>,\n    "wasteRate": <percentage, e.g., 7.7>,\n    "patterns": [\n      {"type": "vendor_favoritism", "description": "Approved 12 contracts to same vendor cluster in 2 years", "severity": "high"},\n      {"type": "rubber_stamp", "description": "Average review time 4 hours vs dept avg 5 days", "severity": "medium"}\n    ],\n    "flags": [\n      {"type": "conflict_of_interest", "description": "Approver's spouse previously employed by vendor", "severity": "critical"},\n      {"type": "high_waste_rate", "description": "7.7% waste rate vs department average 3.2%", "severity": "high"}\n    ],\n    "approvalHistory": [\n      {"date": "2026-01-15", "item": "IT Infrastructure Contract", "amount": <number>, "flagged": true, "vendor": "TechCorp", "outcome": "Under investigation"},\n      {"date": "2025-11-20", "item": "Office Supplies", "amount": <number>, "flagged": false, "vendor": "OfficeMax", "outcome": "Completed"},\n      {"date": "2025-09-03", "item": "Cloud Services", "amount": <number>, "flagged": true, "vendor": "TechCorp", "outcome": "Overpriced confirmed"}\n    ]\n  },\n  "collusionIndicators": [\n    {"type": "split_contract", "description": "3 contracts split to avoid $500K threshold", "severity": "high", "involvedParties": ["Approver Name", "Vendor Name"]},\n    {"type": "relationship", "description": "Approver and vendor CEO attended same university", "severity": "medium", "involvedParties": ["Person1", "Person2"]}\n  ],\n  "recurringPatterns": [\n    {"description": "Same approver-vendor pair in 8 contracts", "involvedPerson": "Name", "role": "approver", "occurrences": 8, "totalAmount": <number>}\n  ],\n  "timeline": [{"date": "2024-06-15", "event": "Contract originally signed"}, {"date": "2025-03-01", "event": "First price increase (15%)"}, {"date": "2025-09-15", "event": "Audit flagged overcharge"}, {"date": "2026-01-20", "event": "Aureon AI detected pattern"}, {"date": "2026-02-10", "event": "Investigation opened"}],\n  "recommendations": [\n    {"priority": "Immediate", "action": "Freeze vendor payments pending review", "timeline": "48 hours"},\n    {"priority": "Short-Term", "action": "Conduct competitive rebid", "timeline": "30 days"},\n    {"priority": "Long-Term", "action": "Implement automated price monitoring", "timeline": "90 days"}\n  ],\n  "supportingDocs": ["Original Contract.pdf", "Market Research Report.pdf", "Audit Finding #2026-047.pdf", "Vendor Payment History.xlsx", "Competitive Quote Analysis.pdf"],\n  "referenceLinks": [\n    {"label": "Government Procurement Portal", "url": "https://procurement.gov.example/contracts"},\n    {"label": "Market Rate Database", "url": "https://marketrates.example.com/it-services"},\n    {"label": "International Benchmark Report", "url": "https://oecd.org/gov-procurement/benchmarks"}\n  ],\n  "financialImpact": {"immediate": <number>, "annual": <number>, "lifetime": <number>, "opportunityCost": "Could fund 3 rural health clinics for 5 years"},\n  "alternativeUses": [\n    {"description": "Rural health clinics", "quantity": "3 clinics for 5 years"},\n    {"description": "School scholarships", "quantity": "2,500 students"},\n    {"description": "Road infrastructure", "quantity": "15km of highways"},\n    {"description": "Clean water projects", "quantity": "12 communities"}\n  ]\n}\n\nBe FORENSIC. Use realistic names, dates, amounts, URLs. Make the evidence comprehensive enough to support legal action.`
        }],
        mode: "research",
        onDelta: (chunk) => { aiContent += chunk; },
        onDone: () => {},
      });

      if (savedByok) localStorage.setItem("aureon_byok_active", savedByok);

      const clean = aiContent.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setRecordDrill(JSON.parse(jsonMatch[0]));
      }
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
                    <span className="text-[10px] text-muted-foreground/40 ml-2">Building forensic evidence chain...</span>
                  </div>
                )}

                {recordDrill && (
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

                    {/* Price Comparison with Breakdown */}
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

                        {/* Cost Breakdown */}
                        {recordDrill.priceComparison.breakdown && recordDrill.priceComparison.breakdown.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-2">Cost Breakdown by Component</p>
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

                        {/* Approval History */}
                        {recordDrill.approvedBy?.approvalHistory?.length > 0 && (
                          <div className="mt-2 border-t border-border/[0.06] pt-2">
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1">Approval History</p>
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                              {recordDrill.approvedBy.approvalHistory.map((h, i) => (
                                <div key={i} className="flex items-center gap-2 py-0.5 text-[8px]">
                                  <span className="text-muted-foreground/30 w-[60px] shrink-0">{h.date}</span>
                                  <span className="text-foreground/50 truncate flex-1">{h.item}</span>
                                  <span className="text-foreground/50 shrink-0">{fmtVal(h.amount)}</span>
                                  {h.flagged && <span className="text-red-400/60 text-[7px] shrink-0">⚠</span>}
                                </div>
                              ))}
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

                    {/* Recurring Patterns for this record */}
                    {recordDrill.recurringPatterns && recordDrill.recurringPatterns.length > 0 && (
                      <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-yellow-400/50 mb-2 flex items-center gap-1.5"><Repeat className="h-3 w-3" /> Recurring Patterns</p>
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
        <><Loader2 className="h-3 w-3 animate-spin" /> Generating forensic records...</>
      ) : (
        <><Eye className="h-3 w-3" /> {label || "Deep Dive — Show Itemized Records"}</>
      )}
    </button>
  );
};

// Missing import for Users icon used in citizen impact section
const Users = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default ZeeionDeepDive;
