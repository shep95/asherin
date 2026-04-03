import { useState, useCallback } from "react";
import { Shield, Plus, Play, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, ChevronDown, Zap, User, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIPWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  guardrails: string[];
  status: "draft" | "active" | "paused";
  requiresApproval: boolean;
  createdAt: Date;
}

interface WorkflowStep {
  id: string;
  type: "ai_analyze" | "ai_classify" | "ai_extract" | "ai_summarize" | "human_review" | "action" | "notify";
  label: string;
  config: Record<string, string>;
  approved?: boolean;
}

interface PendingAction {
  id: string;
  workflowId: string;
  workflowName: string;
  stepLabel: string;
  recommendation: string;
  confidence: number;
  reasoning: string;
  status: "pending" | "approved" | "denied";
  createdAt: Date;
}

const TEMPLATE_WORKFLOWS: Omit<AIPWorkflow, "id" | "createdAt">[] = [
  {
    name: "Intelligence Report Anomaly Detector",
    description: "AI analyzes incoming intel reports, flags anomalies, and routes to analyst for sign-off before action.",
    steps: [
      { id: "1", type: "ai_analyze", label: "Ingest & Parse Reports", config: { prompt: "Extract key entities, dates, locations, and threat indicators" } },
      { id: "2", type: "ai_classify", label: "Classify Threat Level", config: { categories: "critical,high,medium,low,informational" } },
      { id: "3", type: "ai_extract", label: "Flag Anomalies", config: { prompt: "Identify deviations from baseline patterns" } },
      { id: "4", type: "human_review", label: "Analyst Review", config: { approvalRequired: "true" } },
      { id: "5", type: "action", label: "Execute Response", config: { action: "route_to_operations" } },
    ],
    guardrails: ["AI cannot initiate actions without human approval", "All recommendations logged with reasoning", "Confidence threshold: 70% minimum for flagging"],
    status: "draft",
    requiresApproval: true,
  },
  {
    name: "Financial Compliance Monitor",
    description: "Continuously scan transactions for regulatory violations. AI flags suspicious patterns; compliance officer approves investigations.",
    steps: [
      { id: "1", type: "ai_analyze", label: "Scan Transaction Feed", config: { prompt: "Monitor for AML/KYC violations and unusual patterns" } },
      { id: "2", type: "ai_classify", label: "Risk Score Assignment", config: { categories: "investigate,monitor,clear" } },
      { id: "3", type: "human_review", label: "Compliance Officer Review", config: { approvalRequired: "true" } },
      { id: "4", type: "notify", label: "Alert Stakeholders", config: { channels: "email,dashboard" } },
    ],
    guardrails: ["No automated account freezes", "All flagged transactions require human review within 24h", "Full audit trail maintained"],
    status: "draft",
    requiresApproval: true,
  },
  {
    name: "Supply Chain Disruption Predictor",
    description: "AI monitors supplier data, news feeds, and logistics — predicts disruptions before they happen. Human approves contingency activation.",
    steps: [
      { id: "1", type: "ai_analyze", label: "Monitor Data Sources", config: { prompt: "Analyze supplier delivery times, news sentiment, weather data" } },
      { id: "2", type: "ai_summarize", label: "Generate Risk Brief", config: { format: "executive_summary" } },
      { id: "3", type: "ai_extract", label: "Propose Contingencies", config: { prompt: "Recommend alternative suppliers and routes" } },
      { id: "4", type: "human_review", label: "Operations Manager Approval", config: { approvalRequired: "true" } },
      { id: "5", type: "action", label: "Activate Contingency", config: { action: "switch_supplier" } },
    ],
    guardrails: ["Supplier switches require VP-level approval", "AI confidence must exceed 85% for critical alerts", "Predictions include uncertainty ranges"],
    status: "draft",
    requiresApproval: true,
  },
];

const AIPLogicPanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<AIPWorkflow[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AIPWorkflow | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [building, setBuilding] = useState(false);

  const createFromTemplate = (template: typeof TEMPLATE_WORKFLOWS[0]) => {
    const wf: AIPWorkflow = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setWorkflows(prev => [...prev, wf]);
    setSelectedWorkflow(wf);
    setShowTemplates(false);
    toast({ title: "Workflow created", description: `"${wf.name}" is ready for configuration.` });
  };

  const activateWorkflow = async (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: "active" as const } : w));
    const wf = workflows.find(w => w.id === id);
    if (wf && user && activeSession) {
      try {
        const { data, error } = await supabase.functions.invoke("asha-query", {
          body: {
            query: `Workflow "${wf.name}" has been activated. Based on this workflow: "${wf.description}" with guardrails [${wf.guardrails.join("; ")}], generate ONE realistic pending action that requires human approval. Return JSON with keys: recommendation (string), confidence (number 0-100), reasoning (string). Return ONLY JSON.`,
            sessionId: activeSession.id,
            mode: "aip-logic",
          },
        });

        if (!error && data?.response) {
          let rec = "AI analysis complete — review recommended for flagged items.";
          let conf = 80;
          let reason = "Cross-referenced against historical patterns.";
          try {
            const jsonMatch = data.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              rec = parsed.recommendation || rec;
              conf = parsed.confidence || conf;
              reason = parsed.reasoning || reason;
            }
          } catch { /* use defaults */ }

          const action: PendingAction = {
            id: crypto.randomUUID(),
            workflowId: id,
            workflowName: wf.name,
            stepLabel: wf.steps.find(s => s.type === "human_review")?.label || "Review",
            recommendation: rec,
            confidence: conf,
            reasoning: reason,
            status: "pending",
            createdAt: new Date(),
          };
          setPendingActions(prev => [...prev, action]);
        }
      } catch {
        // Still activate the workflow even if AI fails
      }
    }
    toast({ title: "Workflow activated", description: "AI processing has begun. Actions requiring approval will appear in the queue." });
  };

  const handleAction = (actionId: string, decision: "approved" | "denied") => {
    setPendingActions(prev => prev.map(a => a.id === actionId ? { ...a, status: decision } : a));
    toast({ title: decision === "approved" ? "Action approved" : "Action denied", description: decision === "approved" ? "The AI will proceed with execution." : "Action has been blocked. The AI will not proceed." });
  };

  const stepIcon = (type: WorkflowStep["type"]) => {
    switch (type) {
      case "ai_analyze": case "ai_classify": case "ai_extract": case "ai_summarize":
        return <Bot className="h-3.5 w-3.5 text-accent" />;
      case "human_review":
        return <User className="h-3.5 w-3.5 text-amber-400" />;
      case "action":
        return <Zap className="h-3.5 w-3.5 text-emerald-400" />;
      case "notify":
        return <AlertTriangle className="h-3.5 w-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Workflow list */}
      <div className="w-72 border-r border-border/20 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-extralight text-foreground">AIP Workflows</h2>
            <button onClick={() => setShowTemplates(true)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60">AI-driven logic with human guardrails</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {workflows.map(wf => (
              <button key={wf.id} onClick={() => setSelectedWorkflow(wf)} className={`w-full text-left rounded-xl p-3 transition-colors ${selectedWorkflow?.id === wf.id ? "bg-foreground/10 border border-accent/20" : "hover:bg-foreground/5 border border-transparent"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-light text-foreground truncate">{wf.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] rounded-full px-2 py-0.5 ${wf.status === "active" ? "bg-emerald-500/10 text-emerald-400" : wf.status === "paused" ? "bg-amber-500/10 text-amber-400" : "bg-muted/30 text-muted-foreground"}`}>
                    {wf.status}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">{wf.steps.length} steps</span>
                </div>
              </button>
            ))}
            {workflows.length === 0 && (
              <div className="text-center py-10">
                <Shield className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/50">No workflows yet</p>
                <button onClick={() => setShowTemplates(true)} className="mt-2 text-[10px] text-accent hover:underline">Create from template</button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Pending Actions Badge */}
        {pendingActions.filter(a => a.status === "pending").length > 0 && (
          <div className="p-3 border-t border-border/20 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-amber-400">{pendingActions.filter(a => a.status === "pending").length} actions awaiting approval</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Detail / Templates */}
      <div className="flex-1 min-w-0">
        {showTemplates ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extralight text-foreground">Workflow Templates</h3>
                <button onClick={() => setShowTemplates(false)} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
              </div>
              {TEMPLATE_WORKFLOWS.map((t, i) => (
                <div key={i} className="rounded-xl border border-border/20 bg-card/20 p-4 space-y-3">
                  <h4 className="text-xs font-light text-foreground">{t.name}</h4>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {t.steps.map(s => (
                      <span key={s.id} className="flex items-center gap-1 rounded-full bg-card/40 border border-border/10 px-2 py-0.5 text-[9px] text-muted-foreground">
                        {s.type.startsWith("ai_") ? <Bot className="h-2.5 w-2.5" /> : s.type === "human_review" ? <User className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <div className="pt-1">
                    <p className="text-[9px] text-muted-foreground/50 mb-1">Guardrails:</p>
                    {t.guardrails.map((g, gi) => (
                      <p key={gi} className="text-[9px] text-muted-foreground/60 flex items-start gap-1"><Shield className="h-2.5 w-2.5 mt-0.5 text-accent shrink-0" />{g}</p>
                    ))}
                  </div>
                  <button onClick={() => createFromTemplate(t)} className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-[10px] text-accent hover:bg-accent/15 transition-colors">
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : selectedWorkflow ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extralight text-foreground">{selectedWorkflow.name}</h3>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{selectedWorkflow.description}</p>
                </div>
                {selectedWorkflow.status === "draft" && (
                  <button onClick={() => activateWorkflow(selectedWorkflow.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-xs text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                    <Play className="h-3.5 w-3.5" /> Activate
                  </button>
                )}
              </div>

              {/* Pipeline visualization */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Workflow Steps</p>
                {selectedWorkflow.steps.map((step, i) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`rounded-full p-2 ${step.type === "human_review" ? "bg-amber-500/10 border border-amber-500/20" : step.type.startsWith("ai_") ? "bg-accent/10 border border-accent/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                        {stepIcon(step.type)}
                      </div>
                      {i < selectedWorkflow.steps.length - 1 && <div className="w-px h-6 bg-border/30 my-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-light text-foreground">{step.label}</span>
                        <span className={`text-[8px] rounded-full px-1.5 py-0.5 ${step.type === "human_review" ? "bg-amber-500/10 text-amber-400" : step.type.startsWith("ai_") ? "bg-accent/10 text-accent" : "bg-emerald-500/10 text-emerald-400"}`}>
                          {step.type === "human_review" ? "HUMAN" : step.type.startsWith("ai_") ? "AI" : "ACTION"}
                        </span>
                      </div>
                      {step.config.prompt && <p className="text-[10px] text-muted-foreground/50 mt-1">{step.config.prompt}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Guardrails */}
              <div className="rounded-xl border border-border/20 bg-card/20 p-4 space-y-2">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1.5"><Shield className="h-3 w-3 text-accent" /> Guardrails</p>
                {selectedWorkflow.guardrails.map((g, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70 flex items-start gap-2">
                    <span className="text-accent mt-0.5">▸</span> {g}
                  </p>
                ))}
              </div>

              {/* Pending Actions */}
              {pendingActions.filter(a => a.workflowId === selectedWorkflow.id).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Pending Human Decisions</p>
                  {pendingActions.filter(a => a.workflowId === selectedWorkflow.id).map(action => (
                    <div key={action.id} className={`rounded-xl border p-4 space-y-3 ${action.status === "pending" ? "border-amber-500/20 bg-amber-500/5" : action.status === "approved" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-light text-foreground">{action.stepLabel}</span>
                        <span className={`text-[9px] rounded-full px-2 py-0.5 ${action.status === "pending" ? "bg-amber-500/10 text-amber-400" : action.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {action.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-foreground/80 leading-relaxed">{action.recommendation}</p>
                      <div className="rounded-lg bg-card/30 p-2">
                        <p className="text-[9px] text-muted-foreground/50 mb-1">AI Reasoning (confidence: {action.confidence}%)</p>
                        <p className="text-[10px] text-muted-foreground/70">{action.reasoning}</p>
                      </div>
                      {action.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(action.id, "approved")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[10px] text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                            <CheckCircle className="h-3 w-3" /> Approve
                          </button>
                          <button onClick={() => handleAction(action.id, "denied")} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/15 transition-colors">
                            <XCircle className="h-3 w-3" /> Deny
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Shield className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/50">Select a workflow or create one from templates</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPLogicPanel;
