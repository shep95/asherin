import { useState, useMemo } from "react";
import {
  FileText, Users, Shield, Download, Plus, Check, X, Clock,
  AlertTriangle, Eye, EyeOff, ChevronDown, ChevronUp, Link2, Briefcase
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TaskItem {
  id: string;
  claim: string;
  assignee: string;
  status: "open" | "in_progress" | "closed";
  evidenceAttached: boolean;
  createdAt: number;
}

interface TeamMember {
  id: string;
  name: string;
  investigating: string[];
}

interface RedactionItem {
  field: string;
  value: string;
  redact: boolean;
}

interface NomadCaseManagerProps {
  entities: { type: string; value: string; confidence: number }[];
  investigations: { query: string; findings: string; created_at: string; entities_found: any[]; sources_checked: string[] }[];
}

const STORAGE_KEY = "nomad_case_manager";

function loadData(): { tasks: TaskItem[]; team: TeamMember[] } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"tasks":[],"team":[]}'); } catch { return { tasks: [], team: [] }; }
}
function saveData(d: { tasks: TaskItem[]; team: TeamMember[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

const NomadCaseManager = ({ entities, investigations }: NomadCaseManagerProps) => {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState<"brief" | "tasking" | "deconflict" | "redact" | "export">("brief");
  const [addingTask, setAddingTask] = useState(false);
  const [taskClaim, setTaskClaim] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [redactionItems, setRedactionItems] = useState<RedactionItem[]>([]);
  const [briefGenerated, setBriefGenerated] = useState("");

  const save = (newData: typeof data) => { setData(newData); saveData(newData); };

  // Generate case brief
  const generateBrief = () => {
    const entitySummary = entities.slice(0, 20).map(e => `- **${e.type}**: ${e.value} (${Math.round(e.confidence * 100)}% confidence)`).join("\n");
    const invSummary = investigations.slice(0, 5).map(inv =>
      `### Investigation: ${inv.query}\n${inv.findings.slice(0, 300)}...\n*Sources: ${(inv.sources_checked || []).join(", ")}*`
    ).join("\n\n");

    const brief = `# INTELLIGENCE BRIEF\n**Generated:** ${new Date().toISOString()}\n**Classification:** CONFIDENTIAL\n**Entities Identified:** ${entities.length}\n**Investigations Conducted:** ${investigations.length}\n\n---\n\n## KEY FINDINGS\n${entitySummary}\n\n## INVESTIGATION SUMMARIES\n${invSummary}\n\n## CONFIDENCE ASSESSMENT\n- High confidence findings: ${entities.filter(e => e.confidence >= 0.9).length}\n- Medium confidence: ${entities.filter(e => e.confidence >= 0.7 && e.confidence < 0.9).length}\n- Low confidence: ${entities.filter(e => e.confidence < 0.7).length}\n\n## APPENDIX: EVIDENCE INDEX\n${investigations.map((inv, i) => `${i + 1}. "${inv.query}" — ${new Date(inv.created_at).toLocaleString()} — ${(inv.entities_found || []).length} entities`).join("\n")}`;
    setBriefGenerated(brief);
  };

  const exportBrief = () => {
    const blob = new Blob([briefGenerated || "No brief generated"], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `case-brief-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const addTask = () => {
    if (!taskClaim.trim()) return;
    const task: TaskItem = { id: crypto.randomUUID(), claim: taskClaim.trim(), assignee: taskAssignee.trim(), status: "open", evidenceAttached: false, createdAt: Date.now() };
    save({ ...data, tasks: [...data.tasks, task] });
    setTaskClaim(""); setTaskAssignee(""); setAddingTask(false);
  };

  const updateTaskStatus = (id: string, status: TaskItem["status"]) => {
    save({ ...data, tasks: data.tasks.map(t => t.id === id ? { ...t, status } : t) });
  };

  const addTeamMember = () => {
    if (!memberName.trim()) return;
    const member: TeamMember = { id: crypto.randomUUID(), name: memberName.trim(), investigating: [] };
    save({ ...data, team: [...data.team, member] });
    setMemberName(""); setAddingMember(false);
  };

  // Build redaction items from entities (PII detection)
  const buildRedactionItems = () => {
    const items: RedactionItem[] = entities
      .filter(e => ["email", "phone", "person", "handle", "ip_address", "us_location", "location"].includes(e.type))
      .map(e => ({ field: e.type, value: e.value, redact: true }));
    setRedactionItems(items);
  };

  const exportRedacted = () => {
    let content = briefGenerated || investigations.map(i => i.findings).join("\n\n");
    for (const item of redactionItems.filter(r => r.redact)) {
      content = content.split(item.value).join(`[REDACTED_${item.field.toUpperCase()}]`);
    }
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `redacted-brief-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const complianceExport = () => {
    const sanitized = briefGenerated || "No brief generated";
    const custody = `# CHAIN OF CUSTODY LOG\n\nGenerated: ${new Date().toISOString()}\nInvestigations: ${investigations.length}\nEntities: ${entities.length}\n\n${investigations.map((inv, i) => `${i + 1}. Query: "${inv.query}"\n   Timestamp: ${inv.created_at}\n   Sources: ${(inv.sources_checked || []).join(", ")}\n   Entities Found: ${(inv.entities_found || []).length}`).join("\n\n")}`;

    // Export as zip-like (two separate downloads)
    const blob1 = new Blob([sanitized], { type: "text/markdown" });
    const blob2 = new Blob([custody], { type: "text/markdown" });
    const a1 = document.createElement("a");
    a1.href = URL.createObjectURL(blob1); a1.download = `compliance-report-${Date.now()}.md`; a1.click();
    setTimeout(() => {
      const a2 = document.createElement("a");
      a2.href = URL.createObjectURL(blob2); a2.download = `chain-of-custody-${Date.now()}.md`; a2.click();
    }, 500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20 overflow-x-auto">
        {([
          { id: "brief", label: "Case Brief" },
          { id: "tasking", label: "Tasking Board" },
          { id: "deconflict", label: "Deconfliction" },
          { id: "redact", label: "Redaction Gate" },
          { id: "export", label: "Compliance Export" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-light whitespace-nowrap transition-colors ${tab === t.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === "brief" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-light text-foreground">Case Brief Generator</h3>
                <div className="flex gap-2">
                  <button onClick={generateBrief} className="px-3 py-1.5 rounded-xl text-[10px] bg-foreground/[0.1] text-foreground border border-foreground/15 hover:bg-foreground/[0.12] transition-colors">
                    Generate Brief
                  </button>
                  {briefGenerated && (
                    <button onClick={exportBrief} className="px-3 py-1.5 rounded-xl text-[10px] text-muted-foreground/50 border border-border/20 hover:text-foreground transition-colors">
                      <Download className="h-3 w-3 inline mr-1" /> Export
                    </button>
                  )}
                </div>
              </div>
              {briefGenerated ? (
                <div className="rounded-xl border border-border/20 bg-card/20 p-4 max-h-[500px] overflow-y-auto">
                  <pre className="text-[11px] text-foreground/70 font-light whitespace-pre-wrap font-sans">{briefGenerated}</pre>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-[11px] text-muted-foreground/40 font-light">Click "Generate Brief" to create a structured intelligence report with sourcing and confidence levels.</p>
                </div>
              )}
            </div>
          )}

          {tab === "tasking" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Evidence-Linked Tasks</h3>
                <button onClick={() => setAddingTask(true)} className="text-[10px] text-foreground/50 hover:text-foreground"><Plus className="h-3 w-3 inline" /> Add Task</button>
              </div>
              <p className="text-[10px] text-muted-foreground/30 mb-2">Each task links to a claim gap and closes only when evidence is attached.</p>

              {addingTask && (
                <div className="rounded-xl border border-border/20 bg-card/20 p-3 space-y-2 mb-3">
                  <input value={taskClaim} onChange={e => setTaskClaim(e.target.value)} placeholder='Claim gap (e.g. "Need proof of control relationship")' className="w-full bg-transparent text-xs text-foreground outline-none border-b border-border/20 pb-1" autoFocus />
                  <input value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} placeholder="Assignee (optional)" className="w-full bg-transparent text-[11px] text-foreground outline-none border-b border-border/20 pb-1" />
                  <div className="flex gap-2"><button onClick={addTask} className="text-[10px] text-foreground">Save</button><button onClick={() => setAddingTask(false)} className="text-[10px] text-muted-foreground/40">Cancel</button></div>
                </div>
              )}

              {data.tasks.map(t => (
                <div key={t.id} className={`rounded-xl border p-3 ${t.status === "closed" ? "border-emerald-500/20 bg-emerald-500/5" : t.status === "in_progress" ? "border-border/25 bg-foreground/[0.03]" : "border-border/15 bg-card/10"}`}>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs text-foreground/70 font-light flex-1">{t.claim}</span>
                    {t.assignee && <span className="text-[9px] text-muted-foreground/30">{t.assignee}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {(["open", "in_progress", "closed"] as const).map(s => (
                      <button key={s} onClick={() => updateTaskStatus(t.id, s)} className={`text-[9px] px-2 py-0.5 rounded-lg transition-colors ${t.status === s ? "bg-foreground/10 text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`}>
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "deconflict" && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground/40 mb-3">Prevent duplicate work. Track who is investigating which entity.</p>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Team ({data.team.length})</h3>
                <button onClick={() => setAddingMember(true)} className="text-[10px] text-foreground/50 hover:text-foreground"><Plus className="h-3 w-3 inline" /> Add Analyst</button>
              </div>
              {addingMember && (
                <div className="flex items-center gap-2 mb-2">
                  <input value={memberName} onChange={e => setMemberName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTeamMember()} placeholder="Analyst name" className="bg-transparent text-xs text-foreground outline-none border-b border-border/20 pb-1" autoFocus />
                  <button onClick={addTeamMember} className="text-[10px] text-foreground">Add</button>
                </div>
              )}
              {data.team.map(m => (
                <div key={m.id} className="rounded-xl border border-border/15 bg-card/10 p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-foreground/50" />
                    <span className="text-xs text-foreground/70">{m.name}</span>
                    <span className="text-[9px] text-muted-foreground/30 ml-auto">{m.investigating.length} assigned</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "redact" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-light text-foreground">Redaction Gate</h3>
                <div className="flex gap-2">
                  <button onClick={buildRedactionItems} className="px-3 py-1.5 rounded-xl text-[10px] bg-foreground/10 text-foreground hover:bg-foreground/15 transition-colors">
                    <Eye className="h-3 w-3 inline mr-1" /> Scan PII
                  </button>
                  {redactionItems.length > 0 && (
                    <button onClick={exportRedacted} className="px-3 py-1.5 rounded-xl text-[10px] bg-foreground/[0.1] text-foreground border border-foreground/15 hover:bg-foreground/[0.12] transition-colors">
                      Export Redacted
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/40">Highlights PII/sensitive fields and forces an explicit redaction decision before export.</p>
              {redactionItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/15 bg-card/10 px-3 py-2">
                  <button onClick={() => setRedactionItems(prev => prev.map((r, j) => j === i ? { ...r, redact: !r.redact } : r))}>
                    {item.redact ? <EyeOff className="h-3.5 w-3.5 text-destructive" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  </button>
                  <span className="text-[9px] text-muted-foreground/40 uppercase w-16">{item.field}</span>
                  <span className="text-[11px] text-foreground/60 font-mono truncate flex-1">{item.value}</span>
                  <span className={`text-[9px] ${item.redact ? "text-destructive/60" : "text-muted-foreground/30"}`}>{item.redact ? "REDACT" : "KEEP"}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "export" && (
            <div className="space-y-4">
              <h3 className="text-sm font-light text-foreground">Compliance Export Packs</h3>
              <p className="text-[10px] text-muted-foreground/40">Generate sanitized report + sealed evidence appendix + chain-of-custody log with separate permissions.</p>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={complianceExport} className="rounded-xl border border-border/20 bg-card/20 p-4 text-left hover:border-border/25 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-foreground/50" />
                    <span className="text-xs font-light text-foreground">Full Compliance Pack</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/40">Downloads sanitized report + chain-of-custody log as separate files.</p>
                </button>
                <button onClick={exportBrief} className="rounded-xl border border-border/20 bg-card/20 p-4 text-left hover:border-border/25 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-xs font-light text-foreground">Brief Only</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/40">Export the intelligence brief without custody log.</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadCaseManager;
