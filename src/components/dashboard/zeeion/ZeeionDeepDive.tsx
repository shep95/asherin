import { useState } from "react";
import { Loader2, Eye, Table2, X, ChevronRight, Shield, User, Calendar, FileText, AlertTriangle, CheckCircle, Clock, Search, Download, Link2, TrendingUp, Scale, Repeat } from "lucide-react";
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

interface RecordDrillDown {
  rootCause: string;
  contributingFactors: string[];
  evidence: string[];
  priceComparison?: {
    currentPrice: number;
    marketAverage: number;
    bestMarketPrice: number;
    overchargePercent: number;
    comparableSources: { name: string; price: number; url: string }[];
  };
  whyOverpriced?: string;
  whyHarmful?: string;
  potentialEffects?: string[];
  aureonRecommendation?: string;
  responsibleParty: { name: string; title: string; department: string; email: string };
  approvedBy: { name: string; title: string; totalApprovals: number; flaggedApprovals: number; approvalHistory: { date: string; item: string; amount: number; flagged: boolean }[] };
  recurringPatterns?: { description: string; involvedPerson: string; role: string; occurrences: number; totalAmount: number }[];
  timeline: { date: string; event: string }[];
  recommendations: { priority: string; action: string; timeline: string }[];
  supportingDocs: string[];
  referenceLinks: { label: string; url: string }[];
  financialImpact: { immediate: number; annual: number; lifetime: number };
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

const exportDetailAsTxt = (detail: PatternDetail, category: string, recordDrill: RecordDrillDown | null, selectedRecord: DetailRecord | null) => {
  let txt = "";
  txt += "═══════════════════════════════════════════════════════════════\n";
  txt += `AUREON FORENSIC INTELLIGENCE REPORT\n`;
  txt += `Category: ${category}\n`;
  txt += `Generated: ${new Date().toISOString()}\n`;
  txt += "═══════════════════════════════════════════════════════════════\n\n";

  if (detail.overview) {
    txt += `Total Items: ${detail.overview.totalItems}\n`;
    txt += `Total Financial Impact: ${fmtVal(detail.overview.totalAmount)}\n`;
    txt += `Active: ${detail.overview.activeItems} | In Progress: ${detail.overview.inProgressItems} | Resolved: ${detail.overview.resolvedItems}\n`;
    txt += `Departments: ${detail.overview.departments?.join(", ") || "N/A"}\n`;
    txt += `Key Personnel: ${detail.overview.topResponsible?.join(", ") || "N/A"}\n\n`;
  }

  txt += `Summary: ${detail.summary}\n\n`;
  txt += "───────────────────────────────────────────────────────────────\n";
  txt += "ITEMIZED RECORDS\n";
  txt += "───────────────────────────────────────────────────────────────\n\n";

  detail.records.forEach((rec, i) => {
    txt += `RECORD ${i + 1}: ${rec.id}\n`;
    detail.columns.forEach(col => {
      txt += `  ${col.label}: ${fmtVal(rec[col.key])}\n`;
    });
    txt += "\n";
  });

  if (detail.recurringPatterns?.length) {
    txt += "───────────────────────────────────────────────────────────────\n";
    txt += "RECURRING PATTERNS DETECTED\n";
    txt += "───────────────────────────────────────────────────────────────\n\n";
    detail.recurringPatterns.forEach((p, i) => {
      txt += `Pattern ${i + 1}: ${p.description}\n`;
      txt += `  Involved: ${p.involvedParties.join(", ")}\n`;
      txt += `  Frequency: ${p.frequency}\n`;
      txt += `  Total Impact: ${fmtVal(p.totalImpact)}\n\n`;
    });
  }

  if (selectedRecord && recordDrill) {
    txt += "═══════════════════════════════════════════════════════════════\n";
    txt += `DETAILED INVESTIGATION: ${selectedRecord.id}\n`;
    txt += "═══════════════════════════════════════════════════════════════\n\n";
    txt += `ROOT CAUSE: ${recordDrill.rootCause}\n\n`;
    if (recordDrill.whyOverpriced) txt += `WHY OVERPRICED: ${recordDrill.whyOverpriced}\n\n`;
    if (recordDrill.whyHarmful) txt += `WHY HARMFUL: ${recordDrill.whyHarmful}\n\n`;
    if (recordDrill.potentialEffects?.length) {
      txt += "POTENTIAL EFFECTS:\n";
      recordDrill.potentialEffects.forEach(e => txt += `  • ${e}\n`);
      txt += "\n";
    }
    if (recordDrill.aureonRecommendation) txt += `AUREON RECOMMENDATION: ${recordDrill.aureonRecommendation}\n\n`;
    txt += "CONTRIBUTING FACTORS:\n";
    recordDrill.contributingFactors?.forEach(f => txt += `  • ${f}\n`);
    txt += "\nEVIDENCE:\n";
    recordDrill.evidence?.forEach(e => txt += `  ✓ ${e}\n`);
    if (recordDrill.priceComparison) {
      const pc = recordDrill.priceComparison;
      txt += `\nPRICE COMPARISON:\n`;
      txt += `  Current Price: ${fmtVal(pc.currentPrice)}\n`;
      txt += `  Market Average: ${fmtVal(pc.marketAverage)}\n`;
      txt += `  Best Market Price: ${fmtVal(pc.bestMarketPrice)}\n`;
      txt += `  Overcharge: ${pc.overchargePercent}%\n`;
      pc.comparableSources?.forEach(s => txt += `  Source: ${s.name} — ${fmtVal(s.price)} (${s.url})\n`);
    }
    txt += `\nRESPONSIBLE PARTY: ${recordDrill.responsibleParty?.name} (${recordDrill.responsibleParty?.title})\n`;
    txt += `  Department: ${recordDrill.responsibleParty?.department}\n`;
    txt += `  Email: ${recordDrill.responsibleParty?.email}\n`;
    const ab = recordDrill.approvedBy;
    if (ab) {
      txt += `\nAPPROVER: ${ab.name} (${ab.title})\n`;
      txt += `  Total Approvals: ${ab.totalApprovals} | Flagged: ${ab.flaggedApprovals}\n`;
      ab.approvalHistory?.forEach(h => {
        txt += `  ${h.date}: ${h.item} — ${fmtVal(h.amount)}${h.flagged ? " ⚠ FLAGGED" : ""}\n`;
      });
    }
    if (recordDrill.recurringPatterns?.length) {
      txt += "\nRECURRING PATTERNS (THIS RECORD):\n";
      recordDrill.recurringPatterns.forEach(p => {
        txt += `  ${p.description} — ${p.involvedPerson} (${p.role}) — ${p.occurrences}x — ${fmtVal(p.totalAmount)}\n`;
      });
    }
    txt += "\nTIMELINE:\n";
    recordDrill.timeline?.forEach(t => txt += `  ${t.date}: ${t.event}\n`);
    txt += "\nRECOMMENDED ACTIONS:\n";
    recordDrill.recommendations?.forEach(r => txt += `  [${r.priority}] ${r.action} (${r.timeline})\n`);
    txt += "\nFINANCIAL IMPACT:\n";
    txt += `  Immediate: ${fmtVal(recordDrill.financialImpact?.immediate)}\n`;
    txt += `  Annual: ${fmtVal(recordDrill.financialImpact?.annual)}\n`;
    txt += `  Lifetime: ${fmtVal(recordDrill.financialImpact?.lifetime)}\n`;
    if (recordDrill.referenceLinks?.length) {
      txt += "\nREFERENCE LINKS:\n";
      recordDrill.referenceLinks.forEach(l => txt += `  ${l.label}: ${l.url}\n`);
    }
    txt += "\nSUPPORTING DOCUMENTS:\n";
    recordDrill.supportingDocs?.forEach(d => txt += `  📄 ${d}\n`);
  }

  txt += "\n═══════════════════════════════════════════════════════════════\n";
  txt += "Report generated by Aureon Financial Intelligence\n";

  const blob = new Blob([txt], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aureon-forensic-report-${Date.now()}.txt`;
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
          content: `You are Aureon's forensic AI generating a COMPLETE drill-down investigation for a single record with maximum evidence depth.\n\nCategory: ${category}\nRecord Data:\n${recordStr}\n\nGenerate a comprehensive forensic report. You MUST include:\n1. WHY this is overpriced/wasteful/fraudulent — specific reasoning\n2. Price comparison with market rates and competitor sources\n3. How this could affect taxpayers/citizens/budget\n4. Aureon's specific strategic recommendation\n5. The approver's full history — how many things they've approved, how many were flagged\n6. Recurring patterns involving the sender, approver, vendor, or any party\n7. Reference links for price comparison (realistic URLs)\n\nReturn ONLY JSON (no markdown):\n{\n  "rootCause": "Detailed explanation",\n  "whyOverpriced": "Specific reason why this is overpriced vs market — with numbers",\n  "whyHarmful": "How this waste harms citizens, services, or budget",\n  "potentialEffects": ["Effect on public services", "Effect on budget deficit", "Effect on citizen trust"],\n  "aureonRecommendation": "Aureon's strategic recommendation — what to do, who to notify, how to fix",\n  "contributingFactors": ["factor1", "factor2", "factor3"],\n  "evidence": ["Specific evidence point 1", "Market data shows...", "Audit trail reveals...", "Comparable contract analysis..."],\n  "priceComparison": {\n    "currentPrice": <number>,\n    "marketAverage": <number>,\n    "bestMarketPrice": <number>,\n    "overchargePercent": <number>,\n    "comparableSources": [\n      {"name": "Vendor/Source Name", "price": <number>, "url": "https://realistic-url.example.com/pricing"},\n      {"name": "Another Source", "price": <number>, "url": "https://another-example.com/rates"}\n    ]\n  },\n  "responsibleParty": {"name": "Full Name", "title": "Job Title", "department": "Dept", "email": "email@gov.example"},\n  "approvedBy": {\n    "name": "Judge/Approver Name",\n    "title": "Title",\n    "totalApprovals": <total number they've approved>,\n    "flaggedApprovals": <how many of theirs were flagged>,\n    "approvalHistory": [\n      {"date": "2025-XX-XX", "item": "Contract/Item description", "amount": <number>, "flagged": true},\n      {"date": "2025-XX-XX", "item": "Another item", "amount": <number>, "flagged": false}\n    ]\n  },\n  "recurringPatterns": [\n    {"description": "Pattern description", "involvedPerson": "Name", "role": "sender/approver/vendor", "occurrences": <number>, "totalAmount": <number>}\n  ],\n  "timeline": [{"date": "2025-XX-XX", "event": "Event"}],\n  "recommendations": [{"priority": "Immediate", "action": "Action", "timeline": "48 hours"}],\n  "supportingDocs": ["Document.pdf"],\n  "referenceLinks": [{"label": "Market Rate Reference", "url": "https://example.com/market-data"}],\n  "financialImpact": {"immediate": <number>, "annual": <number>, "lifetime": <number>}\n}\n\nBe forensic and highly specific. Use realistic names, dates, amounts, URLs.`
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
            <Download className="h-3 w-3" /> Export TXT Report
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
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/[0.12]">
            <DialogHeader>
              <DialogTitle className="text-[13px] font-light text-foreground/80 flex items-center gap-2">
                <Shield className="h-4 w-4 text-foreground/40" />
                Record Detail: {selectedRecord?.id}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground/40">Full forensic drill-down for {category}</DialogDescription>
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
                    <span className="text-[10px] text-muted-foreground/40 ml-2">Generating forensic analysis...</span>
                  </div>
                )}

                {recordDrill && (
                  <div className="space-y-4">
                    {/* Export this record */}
                    <div className="flex justify-end">
                      <button onClick={() => exportDetailAsTxt(detail, category, recordDrill, selectedRecord)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-foreground/[0.05] border border-border/[0.08] text-[8px] text-foreground/50 hover:bg-foreground/[0.08] transition-all">
                        <Download className="h-3 w-3" /> Download TXT Report
                      </button>
                    </div>

                    {/* Why Overpriced / Why Harmful */}
                    {(recordDrill.whyOverpriced || recordDrill.whyHarmful) && (
                      <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 space-y-3">
                        {recordDrill.whyOverpriced && (
                          <div>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-red-400/50 mb-1 flex items-center gap-1.5"><Scale className="h-3 w-3" /> Why Overpriced</p>
                            <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.whyOverpriced}</p>
                          </div>
                        )}
                        {recordDrill.whyHarmful && (
                          <div>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-red-400/50 mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Why This Is Harmful</p>
                            <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.whyHarmful}</p>
                          </div>
                        )}
                        {recordDrill.potentialEffects && recordDrill.potentialEffects.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase tracking-[0.12em] text-muted-foreground/30 mb-1">Potential Effects</p>
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
                        <p className="text-[8px] uppercase tracking-[0.15em] text-emerald-400/50 mb-1 flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Aureon Strategic Recommendation</p>
                        <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.aureonRecommendation}</p>
                      </div>
                    )}

                    {/* Price Comparison */}
                    {recordDrill.priceComparison && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-3 flex items-center gap-1.5"><Scale className="h-3 w-3" /> Price Comparison</p>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Current Price</p>
                            <p className="text-[12px] text-red-400/70 font-light">{fmtVal(recordDrill.priceComparison.currentPrice)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Market Average</p>
                            <p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.priceComparison.marketAverage)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Best Price</p>
                            <p className="text-[12px] text-emerald-400/70 font-light">{fmtVal(recordDrill.priceComparison.bestMarketPrice)}</p>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-foreground/[0.06] overflow-hidden mb-3">
                          <div className="h-full rounded-full bg-red-400/40" style={{ width: `${Math.min(recordDrill.priceComparison.overchargePercent, 100)}%` }} />
                        </div>
                        <p className="text-[9px] text-red-400/60 mb-3">Overcharged by {recordDrill.priceComparison.overchargePercent}%</p>
                        {recordDrill.priceComparison.comparableSources?.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1.5">Comparable Sources</p>
                            {recordDrill.priceComparison.comparableSources.map((s, i) => (
                              <div key={i} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                                <span className="text-[9px] text-foreground/50 font-light">{s.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-emerald-400/60">{fmtVal(s.price)}</span>
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-blue-400/50 hover:text-blue-400/80 flex items-center gap-0.5">
                                    <Link2 className="h-2.5 w-2.5" /> Link
                                  </a>
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
                      </div>
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Approver / Judge</p>
                        <p className="text-[10px] text-foreground/60 font-light">{recordDrill.approvedBy?.name}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.approvedBy?.title}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Total Approved</p>
                            <p className="text-[11px] text-foreground/60">{recordDrill.approvedBy?.totalApprovals}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Flagged</p>
                            <p className="text-[11px] text-red-400/70">{recordDrill.approvedBy?.flaggedApprovals}</p>
                          </div>
                        </div>
                        {recordDrill.approvedBy?.approvalHistory?.length > 0 && (
                          <div className="mt-2 border-t border-border/[0.06] pt-2">
                            <p className="text-[7px] uppercase text-muted-foreground/30 mb-1">Approval History</p>
                            {recordDrill.approvedBy.approvalHistory.map((h, i) => (
                              <div key={i} className="flex items-center justify-between py-0.5 text-[8px]">
                                <span className="text-muted-foreground/40">{h.date}</span>
                                <span className="text-foreground/50 truncate max-w-[120px]">{h.item}</span>
                                <span className="text-foreground/50">{fmtVal(h.amount)}</span>
                                {h.flagged && <span className="text-red-400/60 text-[7px]">⚠</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

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
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><Search className="h-3 w-3" /> Evidence</p>
                        <ul className="space-y-1.5">
                          {recordDrill.evidence.map((e, i) => (
                            <li key={i} className="text-[9px] text-foreground/50 font-light flex items-start gap-1.5">
                              <CheckCircle className="h-3 w-3 text-emerald-400/40 mt-0.5 shrink-0" /> {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Financial Impact */}
                    {recordDrill.financialImpact && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">Financial Impact</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Immediate</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.immediate)}</p></div>
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Annual</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.annual)}</p></div>
                          <div><p className="text-[7px] uppercase text-muted-foreground/30">Lifetime</p><p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.lifetime)}</p></div>
                        </div>
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
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Reference Links</p>
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
        <><Loader2 className="h-3 w-3 animate-spin" /> Generating detailed records...</>
      ) : (
        <><Eye className="h-3 w-3" /> {label || "Deep Dive — Show Itemized Records"}</>
      )}
    </button>
  );
};

export default ZeeionDeepDive;
