import { useState } from "react";
import { Loader2, Eye, Table2, X, ChevronRight, Shield, User, Calendar, FileText, AlertTriangle, CheckCircle, Clock, Search } from "lucide-react";
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
}

interface RecordDrillDown {
  rootCause: string;
  contributingFactors: string[];
  evidence: string[];
  responsibleParty: { name: string; title: string; department: string; email: string };
  approvedBy: { name: string; title: string };
  timeline: { date: string; event: string }[];
  recommendations: { priority: string; action: string; timeline: string }[];
  supportingDocs: string[];
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

      const colInstruction = columnHint || `columns: record_id, description, amount, department, responsible_person, date, status, risk_level. Generate 12-18 detailed records.`;

      await streamChat({
        messages: [{
          role: "user",
          content: `You are Aureon's forensic AI generating DETAILED itemized data with full attribution.\n\nCategory: ${category}\nContext: ${context}\n\n${colInstruction}\n\nIMPORTANT: Every record MUST include these fields:\n- "id": Official-looking ID (e.g., REC-2026-0041)\n- "status": One of "Active", "In Progress", "Under Review", "Resolved", "Flagged"\n- "department": The responsible department\n- "responsible_person": Name of responsible individual\n- "amount" or a numeric value column\n\nReturn ONLY a JSON object (no markdown):\n{\n  "columns": [{"key": "column_name", "label": "Display Label"}, ...],\n  "records": [{"id": "REC-001", "column_name": "value", ...}, ...],\n  "summary": "Brief summary of findings",\n  "overview": {\n    "totalItems": <number>,\n    "totalAmount": <total dollar amount>,\n    "activeItems": <count of active/flagged>,\n    "resolvedItems": <count of resolved>,\n    "inProgressItems": <count of in progress/review>,\n    "departments": ["dept1", "dept2", ...],\n    "topResponsible": ["person1", "person2", ...]\n  }\n}\n\nMake data realistic. Generate 12-20 records. Include realistic dates in 2025-2026. Make amounts vary realistically. Use realistic person names.`
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
        // Auto-generate overview if AI didn't provide one
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
          content: `You are Aureon's forensic AI generating a COMPLETE drill-down report for a single record.\n\nCategory: ${category}\nRecord Data:\n${recordStr}\n\nGenerate a comprehensive investigation report for this specific item. Return ONLY JSON (no markdown):\n{\n  "rootCause": "Detailed explanation of why this happened",\n  "contributingFactors": ["factor1", "factor2", "factor3"],\n  "evidence": ["evidence point 1", "evidence point 2", "evidence point 3", "evidence point 4"],\n  "responsibleParty": {\n    "name": "Full Name",\n    "title": "Job Title",\n    "department": "Department",\n    "email": "email@gov.example"\n  },\n  "approvedBy": {\n    "name": "Approver Name",\n    "title": "Approver Title"\n  },\n  "timeline": [\n    {"date": "2025-XX-XX", "event": "Event description"},\n    {"date": "2026-XX-XX", "event": "Event description"}\n  ],\n  "recommendations": [\n    {"priority": "Immediate", "action": "Action description", "timeline": "48 hours"},\n    {"priority": "Short-Term", "action": "Action description", "timeline": "30 days"},\n    {"priority": "Long-Term", "action": "Action description", "timeline": "90 days"}\n  ],\n  "supportingDocs": ["Document name 1.pdf", "Document name 2.pdf"],\n  "financialImpact": {\n    "immediate": <number>,\n    "annual": <number>,\n    "lifetime": <number>\n  }\n}\n\nBe forensic and specific. Use realistic names, dates, amounts.`
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

  // Filter records
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
        {/* Overview Stats */}
        {ov && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30">Total Items</p>
              <p className="text-[16px] font-light text-foreground/70 mt-0.5">{ov.totalItems}</p>
              <p className="text-[8px] text-muted-foreground/30 mt-0.5">
                <span className="text-red-400/60">{ov.activeItems} active</span>
                {" · "}
                <span className="text-yellow-400/60">{ov.inProgressItems} in progress</span>
                {" · "}
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
                <div
                  className="h-full rounded-full bg-emerald-400/40 transition-all"
                  style={{ width: `${ov.totalItems > 0 ? (ov.resolvedItems / ov.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {detail.summary && (
          <p className="text-[9px] text-foreground/40 font-light italic">{detail.summary}</p>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3 w-3 text-foreground/40" />
          <p className="text-[8px] uppercase tracking-[0.15em] text-foreground/50 mr-2">
            Itemized Records ({filteredRecords.length})
          </p>
          {["all", "active", "in_progress", "resolved"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`text-[7px] px-2 py-0.5 rounded-md border transition-all ${
                filter === f
                  ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/60"
                  : "border-border/[0.06] text-muted-foreground/30 hover:bg-foreground/[0.03]"
              }`}
            >
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
                  <th key={col.key} className="px-2.5 py-1.5 text-[7px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
                <th className="px-2.5 py-1.5 text-[7px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec, ri) => {
                const recStatus = String(rec.status || rec.status_flag || "");
                return (
                  <tr
                    key={rec.id || ri}
                    className="border-b border-border/[0.04] hover:bg-foreground/[0.03] transition-colors cursor-pointer group"
                    onClick={() => drillIntoRecord(rec)}
                  >
                    {detail.columns.map(col => {
                      const val = rec[col.key];
                      const isStatus = col.key === "status" || col.key === "status_flag";
                      const isRisk = typeof val === "string" && /high|critical|flagged|suspicious|over.?budget|rejected|fraud|ghost|inactive/i.test(val);
                      const isGood = typeof val === "string" && /verified|resolved|low|clean|approved|active|compliant|on.?track|recovered/i.test(val);
                      return (
                        <td key={col.key} className="px-2.5 py-1.5 text-[9px] font-light whitespace-nowrap">
                          {isStatus ? (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${statusColor(String(val))}`}>
                              {String(val)}
                            </span>
                          ) : (
                            <span className={isRisk ? "text-red-400/70" : isGood ? "text-emerald-400/70" : "text-foreground/55"}>
                              {fmtVal(val)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1.5">
                      <ChevronRight className="h-3 w-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* By Department & Responsible Party Breakdown */}
        {ov && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ov.departments && ov.departments.length > 0 && (
              <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">By Department</p>
                {ov.departments.map(dept => {
                  const deptRecords = detail.records.filter(r => String(r.department || r.dept || "").includes(dept));
                  return (
                    <div key={dept} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                      <span className="text-[9px] text-foreground/50 font-light">{dept}</span>
                      <span className="text-[8px] text-muted-foreground/40">{deptRecords.length} items</span>
                    </div>
                  );
                })}
              </div>
            )}
            {ov.topResponsible && ov.topResponsible.length > 0 && (
              <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
                <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">By Responsible Party</p>
                {ov.topResponsible.map(person => {
                  const personRecords = detail.records.filter(r =>
                    String(r.responsible_person || r.manager || r.paid_by || r.employee_name || "").includes(person)
                  );
                  return (
                    <div key={person} className="flex items-center justify-between py-1 border-b border-border/[0.04] last:border-0">
                      <span className="text-[9px] text-foreground/50 font-light">{person}</span>
                      <span className="text-[8px] text-muted-foreground/40">{personRecords.length} items</span>
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
              <DialogDescription className="text-[10px] text-muted-foreground/40">
                Full forensic drill-down for {category}
              </DialogDescription>
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

                {/* Drill-Down Content */}
                {drillLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/40 ml-2">Generating forensic analysis...</span>
                  </div>
                )}

                {recordDrill && (
                  <div className="space-y-4">
                    {/* Root Cause */}
                    <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                      <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" /> Root Cause Analysis
                      </p>
                      <p className="text-[10px] text-foreground/60 font-light leading-relaxed">{recordDrill.rootCause}</p>
                      {recordDrill.contributingFactors?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[7px] uppercase tracking-[0.12em] text-muted-foreground/30 mb-1">Contributing Factors</p>
                          <ul className="space-y-1">
                            {recordDrill.contributingFactors.map((f, i) => (
                              <li key={i} className="text-[9px] text-foreground/50 font-light flex items-start gap-1.5">
                                <span className="text-muted-foreground/30 mt-0.5">•</span> {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Responsible Party & Approver */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5">
                          <User className="h-3 w-3" /> Responsible Party
                        </p>
                        <p className="text-[10px] text-foreground/60 font-light">{recordDrill.responsibleParty?.name}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.responsibleParty?.title}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.responsibleParty?.department}</p>
                        <p className="text-[8px] text-muted-foreground/30 mt-1">{recordDrill.responsibleParty?.email}</p>
                      </div>
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3" /> Approved By
                        </p>
                        <p className="text-[10px] text-foreground/60 font-light">{recordDrill.approvedBy?.name}</p>
                        <p className="text-[9px] text-muted-foreground/40">{recordDrill.approvedBy?.title}</p>
                      </div>
                    </div>

                    {/* Evidence */}
                    {recordDrill.evidence?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5">
                          <Search className="h-3 w-3" /> Evidence
                        </p>
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
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Immediate</p>
                            <p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.immediate)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Annual</p>
                            <p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.annual)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] uppercase text-muted-foreground/30">Lifetime</p>
                            <p className="text-[12px] text-foreground/60 font-light">{fmtVal(recordDrill.financialImpact.lifetime)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {recordDrill.timeline?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" /> Event Timeline
                        </p>
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
                              <span className={`text-[7px] px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${
                                r.priority === "Immediate" ? "text-red-400/70 bg-red-500/10 border-red-500/10" :
                                r.priority === "Short-Term" ? "text-yellow-400/70 bg-yellow-500/10 border-yellow-500/10" :
                                "text-foreground/40 bg-foreground/[0.04] border-border/[0.06]"
                              }`}>
                                {r.priority}
                              </span>
                              <div className="flex-1">
                                <p className="text-[9px] text-foreground/55 font-light">{r.action}</p>
                                <p className="text-[8px] text-muted-foreground/30 mt-0.5 flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" /> {r.timeline}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Supporting Documents */}
                    {recordDrill.supportingDocs?.length > 0 && (
                      <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
                        <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2 flex items-center gap-1.5">
                          <FileText className="h-3 w-3" /> Supporting Documents
                        </p>
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
