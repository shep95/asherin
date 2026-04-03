import { useState } from "react";
import { Rocket, Clock, CheckCircle, Play, ChevronRight, Users, Zap, Target, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface BootcampDay {
  day: number;
  title: string;
  tasks: string[];
  deliverable: string;
  completed: boolean;
}

interface Bootcamp {
  id: string;
  name: string;
  industry: string;
  objective: string;
  days: BootcampDay[];
  status: "not_started" | "in_progress" | "completed";
  currentDay: number;
  createdAt: Date;
}

const BOOTCAMP_TEMPLATES: Omit<Bootcamp, "id" | "createdAt" | "status" | "currentDay">[] = [
  {
    name: "Predictive Maintenance AI",
    industry: "Manufacturing",
    objective: "Build an AI system that predicts equipment failures 72 hours before they happen using sensor data from your factory floor.",
    days: [
      { day: 1, title: "Data Foundation", tasks: ["Connect sensor data feeds (temperature, vibration, pressure)", "Map equipment ontology (machines → sensors → maintenance logs)", "Define failure modes and classification schema", "Set up real-time ingestion pipeline"], deliverable: "Live data pipeline with 30-day historical baseline", completed: false },
      { day: 2, title: "Pattern Recognition", tasks: ["Train anomaly detection on historical failure data", "Build feature engineering pipeline (rolling averages, FFT)", "Calibrate alert thresholds per equipment class", "Validate against known failure events"], deliverable: "Anomaly detection model with 85%+ recall on known failures", completed: false },
      { day: 3, title: "Prediction Engine", tasks: ["Build time-to-failure regression model", "Integrate weather and production schedule data", "Create risk scoring system (0-100 per asset)", "Set up A/B testing framework"], deliverable: "72-hour failure prediction with confidence intervals", completed: false },
      { day: 4, title: "Decision Workflow", tasks: ["Build AIP workflow: AI predicts → Technician reviews → Action approved", "Create maintenance scheduling optimizer", "Set up notification chains (SMS, email, dashboard)", "Define escalation paths for critical alerts"], deliverable: "Human-in-the-loop decision system with guardrails", completed: false },
      { day: 5, title: "Deployment & Monitoring", tasks: ["Deploy to production with kill-switch", "Build real-time monitoring dashboard", "Set up model drift detection", "Run live validation with operations team"], deliverable: "Production-ready predictive maintenance system", completed: false },
    ],
  },
  {
    name: "Customer Churn Predictor",
    industry: "SaaS / Subscription",
    objective: "Build an AI that identifies at-risk customers 30 days before churn and recommends retention actions.",
    days: [
      { day: 1, title: "Data Integration", tasks: ["Connect CRM, billing, support ticket, and usage data", "Build unified customer profile ontology", "Define churn events and labeling criteria", "Clean and normalize historical data"], deliverable: "Unified customer data model with 12-month history", completed: false },
      { day: 2, title: "Behavioral Analysis", tasks: ["Build engagement scoring model", "Identify leading indicators of churn", "Create customer segmentation clusters", "Map product usage patterns to retention"], deliverable: "Churn indicator dashboard with top 10 risk signals", completed: false },
      { day: 3, title: "Prediction Model", tasks: ["Train gradient boosted churn prediction model", "Build SHAP explainability layer", "Create customer health score (0-100)", "Validate against holdout set"], deliverable: "30-day churn predictor with feature importance ranking", completed: false },
      { day: 4, title: "Action Engine", tasks: ["Build retention playbook (discount, feature unlock, CSM outreach)", "Create AI recommendation system for optimal intervention", "Set up A/B testing for retention strategies", "Build approval workflow for discount offers"], deliverable: "Automated retention recommendation engine", completed: false },
      { day: 5, title: "Go-Live", tasks: ["Deploy to production", "Train CS team on dashboard and workflows", "Set up weekly model performance reports", "Create feedback loop for model retraining"], deliverable: "Live churn prevention system with ROI tracking", completed: false },
    ],
  },
  {
    name: "Intelligence Report Triage",
    industry: "Defense / Government",
    objective: "Build an AI that processes hundreds of daily intelligence reports, prioritizes threats, and routes to analysts with full human oversight.",
    days: [
      { day: 1, title: "Ingestion Architecture", tasks: ["Set up multi-format document parser (PDF, SIGINT, HUMINT)", "Build entity extraction pipeline (people, orgs, locations)", "Create classification taxonomy (threat types, regions, urgency)", "Define data retention and security policies"], deliverable: "Automated ingestion pipeline processing 500+ docs/day", completed: false },
      { day: 2, title: "Entity Resolution", tasks: ["Build cross-report entity linking", "Create relationship graph between entities", "Identify recurring patterns across time", "Build confidence scoring for entity matches"], deliverable: "Unified entity graph with temporal tracking", completed: false },
      { day: 3, title: "Threat Assessment AI", tasks: ["Train multi-label threat classifier", "Build anomaly detection for unusual patterns", "Create priority scoring algorithm", "Set up geographic threat heatmap"], deliverable: "Automated threat scoring with explainable reasoning", completed: false },
      { day: 4, title: "Human-in-the-Loop", tasks: ["Build analyst review queue with priority sorting", "Create AIP workflow with mandatory approval gates", "Set up escalation chains based on threat level", "Build audit trail for all AI recommendations"], deliverable: "Analyst workstation with AI-augmented triage", completed: false },
      { day: 5, title: "Operational Readiness", tasks: ["Security hardening and penetration testing", "Load testing at 10x expected volume", "Train analyst team on new system", "Set up continuous model evaluation"], deliverable: "Battle-ready intelligence triage system", completed: false },
    ],
  },
];

const AIPBootcampsPanel = () => {
  const { toast } = useToast();
  const [bootcamps, setBootcamps] = useState<Bootcamp[]>([]);
  const [selectedBootcamp, setSelectedBootcamp] = useState<Bootcamp | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const startBootcamp = (template: typeof BOOTCAMP_TEMPLATES[0]) => {
    const bc: Bootcamp = {
      ...template,
      id: crypto.randomUUID(),
      status: "not_started",
      currentDay: 0,
      createdAt: new Date(),
    };
    setBootcamps(prev => [...prev, bc]);
    setSelectedBootcamp(bc);
    setShowTemplates(false);
    toast({ title: "Bootcamp created", description: `"${bc.name}" — 5-day sprint ready to begin.` });
  };

  const advanceDay = (bcId: string) => {
    setBootcamps(prev => prev.map(bc => {
      if (bc.id !== bcId) return bc;
      const nextDay = bc.currentDay + 1;
      const days = bc.days.map((d, i) => i < nextDay ? { ...d, completed: true } : d);
      const status = nextDay >= 5 ? "completed" as const : "in_progress" as const;
      const updated = { ...bc, days, currentDay: nextDay, status };
      setSelectedBootcamp(updated);
      return updated;
    }));
    toast({ title: "Day completed!", description: "Deliverable marked as done. Moving to next phase." });
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-border/20 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-extralight text-foreground">AIP Bootcamps</h2>
            <button onClick={() => setShowTemplates(true)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              <Rocket className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60">5-day rapid AI deployment sprints</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {bootcamps.map(bc => (
              <button key={bc.id} onClick={() => setSelectedBootcamp(bc)} className={`w-full text-left rounded-xl p-3 transition-colors ${selectedBootcamp?.id === bc.id ? "bg-foreground/10 border border-accent/20" : "hover:bg-foreground/5 border border-transparent"}`}>
                <span className="text-xs font-light text-foreground block truncate">{bc.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-muted-foreground">{bc.industry}</span>
                  <span className={`text-[9px] rounded-full px-2 py-0.5 ${bc.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : bc.status === "in_progress" ? "bg-amber-500/10 text-amber-400" : "bg-muted/30 text-muted-foreground"}`}>
                    Day {bc.currentDay}/5
                  </span>
                </div>
              </button>
            ))}
            {bootcamps.length === 0 && (
              <div className="text-center py-10">
                <Rocket className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/50">No bootcamps yet</p>
                <button onClick={() => setShowTemplates(true)} className="mt-2 text-[10px] text-accent hover:underline">Start a bootcamp</button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 min-w-0">
        {showTemplates ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extralight text-foreground">Choose a Bootcamp</h3>
                <button onClick={() => setShowTemplates(false)} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
              </div>
              {BOOTCAMP_TEMPLATES.map((t, i) => (
                <div key={i} className="rounded-xl border border-border/20 bg-card/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-accent" />
                    <h4 className="text-xs font-light text-foreground">{t.name}</h4>
                    <span className="text-[9px] text-muted-foreground/50 bg-muted/20 rounded-full px-2 py-0.5">{t.industry}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{t.objective}</p>
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground/50">
                    <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> 5 days</span>
                    <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> {t.days.reduce((acc, d) => acc + d.tasks.length, 0)} tasks</span>
                  </div>
                  <button onClick={() => startBootcamp(t)} className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-[10px] text-accent hover:bg-accent/15 transition-colors">
                    Start Bootcamp
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : selectedBootcamp ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-extralight text-foreground">{selectedBootcamp.name}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{selectedBootcamp.objective}</p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                  <span>Progress</span>
                  <span>{selectedBootcamp.currentDay}/5 days</span>
                </div>
                <div className="h-1.5 rounded-full bg-card/40 overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(selectedBootcamp.currentDay / 5) * 100}%` }} />
                </div>
              </div>

              {/* Days */}
              {selectedBootcamp.days.map((day, i) => (
                <div key={day.day} className={`rounded-xl border p-4 space-y-3 transition-colors ${day.completed ? "border-emerald-500/20 bg-emerald-500/5" : i === selectedBootcamp.currentDay ? "border-accent/20 bg-accent/5" : "border-border/20 bg-card/20 opacity-60"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {day.completed ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : i === selectedBootcamp.currentDay ? <Play className="h-4 w-4 text-accent" /> : <Clock className="h-4 w-4 text-muted-foreground/30" />}
                      <span className="text-xs font-light text-foreground">Day {day.day}: {day.title}</span>
                    </div>
                    {i === selectedBootcamp.currentDay && !day.completed && (
                      <button onClick={() => advanceDay(selectedBootcamp.id)} className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/15 transition-colors">
                        Complete Day
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 ml-6">
                    {day.tasks.map((task, ti) => (
                      <p key={ti} className="text-[10px] text-muted-foreground/60 flex items-start gap-1.5">
                        <ChevronRight className="h-2.5 w-2.5 mt-0.5 shrink-0" /> {task}
                      </p>
                    ))}
                  </div>
                  <div className="ml-6 rounded-lg bg-card/30 border border-border/10 p-2">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Deliverable</p>
                    <p className="text-[10px] text-foreground/70">{day.deliverable}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Rocket className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/50">Select a bootcamp or start a new sprint</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPBootcampsPanel;
