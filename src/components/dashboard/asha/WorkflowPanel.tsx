import { useState } from "react";
import { Workflow, Plus, Play, Pause, Trash2, Zap, Clock, Mail, FileText, AlertTriangle } from "lucide-react";
import type { WorkflowTemplate } from "./types";

interface WorkflowItem {
  id: string;
  name: string;
  active: boolean;
  triggerType: string;
  lastRun?: Date;
  runsCount: number;
}

const MOCK_WORKFLOWS: WorkflowItem[] = [
  { id: "1", name: "Fraud Detection Alert", active: true, triggerType: "New data uploaded", lastRun: new Date(Date.now() - 3600000), runsCount: 47 },
  { id: "2", name: "Weekly Revenue Report", active: true, triggerType: "Every Monday 9:00 AM", lastRun: new Date(Date.now() - 86400000 * 2), runsCount: 12 },
  { id: "3", name: "Churn Risk Detection", active: false, triggerType: "Daily at midnight", runsCount: 0 },
];

const TEMPLATES: WorkflowTemplate[] = [
  { id: "t1", name: "Monthly Revenue Reconciliation", category: "finance", description: "Compare revenue across data sources and flag discrepancies", triggerType: "Monthly" },
  { id: "t2", name: "Expense Anomaly Detection", category: "finance", description: "Flag unusual expenses based on historical patterns", triggerType: "New data" },
  { id: "t3", name: "Lead Scoring Update", category: "sales", description: "Recalculate lead scores when new data arrives", triggerType: "New data" },
  { id: "t4", name: "Churn Risk Detection", category: "sales", description: "Identify at-risk customers based on behavior patterns", triggerType: "Daily" },
  { id: "t5", name: "Inventory Threshold Alert", category: "operations", description: "Alert when stock levels drop below threshold", triggerType: "Hourly" },
  { id: "t6", name: "SLA Breach Detection", category: "operations", description: "Monitor response times and flag SLA violations", triggerType: "Real-time" },
  { id: "t7", name: "Headcount Change Detection", category: "hr", description: "Track team size changes and alert stakeholders", triggerType: "Weekly" },
  { id: "t8", name: "Campaign Performance Summary", category: "marketing", description: "Aggregate campaign metrics and generate summary", triggerType: "Daily" },
];

const categoryColors: Record<string, string> = {
  finance: "text-emerald-400",
  sales: "text-accent",
  operations: "text-amber-400",
  hr: "text-purple-400",
  marketing: "text-cyan-400",
};

const WorkflowPanel = () => {
  const [workflows, setWorkflows] = useState(MOCK_WORKFLOWS);
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("");

  const toggleActive = (id: string) => {
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, active: !w.active } : w));
  };

  const addFromTemplate = (tmpl: WorkflowTemplate) => {
    const wf: WorkflowItem = {
      id: crypto.randomUUID(),
      name: tmpl.name,
      active: false,
      triggerType: tmpl.triggerType,
      runsCount: 0,
    };
    setWorkflows((prev) => [...prev, wf]);
    setShowTemplates(false);
  };

  const filteredTemplates = filterCat ? TEMPLATES.filter((t) => t.category === filterCat) : TEMPLATES;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Workflows</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Automated intelligence — no human needed</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(!showTemplates)} className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Custom
          </button>
        </div>
      </div>

      {/* Active workflows */}
      <div className="space-y-2">
        {workflows.map((wf) => (
          <div key={wf.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Workflow className={`h-4 w-4 ${wf.active ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                <div>
                  <p className="text-sm font-light text-foreground">{wf.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
                    <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" />{wf.triggerType}</span>
                    <span>{wf.runsCount} runs</span>
                    {wf.lastRun && <span>Last: {wf.lastRun.toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleActive(wf.id)} className={`rounded-full px-3 py-1 text-[10px] transition-colors ${wf.active ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-card/30 text-muted-foreground hover:text-foreground"}`}>
                  {wf.active ? "Active" : "Paused"}
                </button>
                <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Template library */}
      {showTemplates && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-light tracking-[0.1em] text-muted-foreground/60 uppercase">Template Library</h3>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="bg-card/30 border border-border/20 rounded px-2 py-1 text-[10px] text-foreground outline-none">
              <option value="">All categories</option>
              <option value="finance">Finance</option>
              <option value="sales">Sales</option>
              <option value="operations">Operations</option>
              <option value="hr">HR</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => addFromTemplate(tmpl)}
                className="rounded-xl border border-border/20 bg-card/20 p-3 text-left hover:bg-foreground/5 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] capitalize ${categoryColors[tmpl.category]}`}>{tmpl.category}</span>
                </div>
                <p className="text-xs font-light text-foreground">{tmpl.name}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{tmpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowPanel;
