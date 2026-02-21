import { useState } from "react";
import { Factory, CheckCircle2, XCircle, AlertTriangle, Package, Truck, ShieldCheck, Globe, DollarSign, Clock, Search, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ZaliProject } from "./types";

const DFM_CHECKS = [
  { label: "PCB Manufacturability (PCBWay)", status: "pass" as const, detail: "4-layer board, 0.15mm trace width — within specs", cost: "$127 for 10 boards", lead: "7 days" },
  { label: "Component Availability (Digi-Key)", status: "pass" as const, detail: "All 23 components in stock", cost: "$67.34 per board", lead: "2 days" },
  { label: "3D Print Feasibility (Shapeways)", status: "pass" as const, detail: "SLS nylon, no overhangs >45°", cost: "$34 per part", lead: "5 days" },
  { label: "CNC Machining (ProtoLabs)", status: "warning" as const, detail: "Tight tolerance on hole H7 — requires secondary op", cost: "$89 per part", lead: "10 days" },
  { label: "Assembly (MacroFab)", status: "pass" as const, detail: "Full PCB assembly available, SMT + through-hole", cost: "$89 per board", lead: "7 days" },
];

const SUPPLIER_RESULTS = [
  { name: "McMaster-Carr", items: 12, inStock: 12, total: "$234.50", leadDays: 2 },
  { name: "Digi-Key", items: 23, inStock: 22, total: "$67.34", leadDays: 3 },
  { name: "PCBWay", items: 1, inStock: 1, total: "$127.00", leadDays: 7 },
  { name: "Shapeways", items: 3, inStock: 3, total: "$102.00", leadDays: 5 },
];

const CERTIFICATIONS = [
  { name: "CE Marking", required: true, status: "needs-review" as const },
  { name: "FCC Part 15", required: true, status: "needs-review" as const },
  { name: "RoHS Compliance", required: true, status: "pass" as const },
  { name: "UL 62368-1", required: false, status: "optional" as const },
  { name: "IEC 62133-2", required: false, status: "optional" as const },
];

interface Props {
  project: ZaliProject | null;
}

const ManufacturingVerifyPanel = ({ project }: Props) => {
  const [tab, setTab] = useState<"dfm" | "suppliers" | "certifications" | "timeline">("dfm");
  const [verifying, setVerifying] = useState(false);

  const totalCost = SUPPLIER_RESULTS.reduce((s, r) => s + parseFloat(r.total.replace("$", "")), 0);
  const maxLead = Math.max(...SUPPLIER_RESULTS.map(r => r.leadDays));
  const allPass = DFM_CHECKS.every(c => c.status === "pass");

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Manufacturing Verification</h2>
          </div>
        </div>

        {!project ? (
          <div className="text-center py-12">
            <p className="text-sm font-extralight text-muted-foreground/40">Create a design to verify manufacturability</p>
          </div>
        ) : (
          <>
            {/* Overall verdict */}
            <div className={`rounded-xl border p-4 ${allPass ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
              <div className="flex items-center gap-3">
                {allPass ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-amber-400" />}
                <div>
                  <p className="text-sm font-light text-foreground">{allPass ? "FULLY MANUFACTURABLE" : "MINOR ISSUES DETECTED"}</p>
                  <p className="text-[10px] text-muted-foreground/60">Total cost: ${totalCost.toFixed(2)} · Lead time: {maxLead + 7} days</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1">
              {(["dfm", "suppliers", "certifications", "timeline"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors capitalize ${tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`}
                >{t === "dfm" ? "DFM Checks" : t}</button>
              ))}
            </div>

            {tab === "dfm" && (
              <div className="space-y-2.5">
                {DFM_CHECKS.map(check => (
                  <div key={check.label} className="rounded-xl border border-border/15 bg-card/20 p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {check.status === "pass" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                        <span className="text-[11px] font-light text-foreground">{check.label}</span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-md ${check.status === "pass" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {check.status === "pass" ? "PASS" : "WARNING"}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/50 mb-2">{check.detail}</p>
                    <div className="flex items-center gap-4 text-[9px] text-muted-foreground/40">
                      <span className="flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" /> {check.cost}</span>
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {check.lead}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "suppliers" && (
              <div className="space-y-2.5">
                {SUPPLIER_RESULTS.map(sup => (
                  <div key={sup.name} className="rounded-xl border border-border/15 bg-card/20 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-accent/60" />
                        <span className="text-[11px] font-light text-foreground">{sup.name}</span>
                      </div>
                      <span className={`text-[9px] ${sup.inStock === sup.items ? "text-emerald-400" : "text-amber-400"}`}>
                        {sup.inStock}/{sup.items} in stock
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] text-muted-foreground/40">
                      <span>{sup.total} total</span>
                      <span>Ships in {sup.leadDays} days</span>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-border/15 bg-card/20 p-3.5 flex items-center justify-between">
                  <span className="text-[11px] font-light text-foreground">Total BOM Cost</span>
                  <span className="text-sm font-light text-accent">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            {tab === "certifications" && (
              <div className="space-y-2.5">
                {CERTIFICATIONS.map(cert => (
                  <div key={cert.name} className="rounded-xl border border-border/15 bg-card/20 p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`h-3.5 w-3.5 ${cert.status === "pass" ? "text-emerald-400" : cert.status === "needs-review" ? "text-amber-400" : "text-muted-foreground/30"}`} />
                      <div>
                        <span className="text-[11px] font-light text-foreground">{cert.name}</span>
                        {cert.required && <span className="text-[8px] text-red-400/60 ml-2">Required</span>}
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md ${
                      cert.status === "pass" ? "bg-emerald-500/10 text-emerald-400" :
                      cert.status === "needs-review" ? "bg-amber-500/10 text-amber-400" :
                      "bg-foreground/5 text-muted-foreground/40"
                    }`}>
                      {cert.status === "pass" ? "Compliant" : cert.status === "needs-review" ? "Review Needed" : "Optional"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "timeline" && (
              <div className="rounded-xl border border-border/15 bg-card/20 p-4">
                <h3 className="text-[11px] font-light text-foreground mb-4">Production Timeline</h3>
                <div className="space-y-3">
                  {[
                    { week: "Week 1–2", task: "PCB fabrication + component sourcing", status: "ready" },
                    { week: "Week 2–3", task: "3D printing + CNC machining", status: "ready" },
                    { week: "Week 3", task: "PCB assembly (SMT + through-hole)", status: "ready" },
                    { week: "Week 3–4", task: "Final assembly + QC", status: "ready" },
                    { week: "Week 4", task: "Testing + certification prep", status: "pending" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full ${step.status === "ready" ? "bg-emerald-400" : "bg-muted-foreground/20"}`} />
                        {i < 4 && <div className="w-0.5 h-4 bg-border/20" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-light text-foreground">{step.week}</p>
                        <p className="text-[9px] text-muted-foreground/50">{step.task}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default ManufacturingVerifyPanel;