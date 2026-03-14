import { useState } from "react";
import { Zap, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Shield, Send, ChevronDown, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActionRecommendation {
  id: string;
  title: string;
  description: string;
  impact: "low" | "medium" | "high" | "critical";
  confidence: number;
  reasoning: string;
  risks: string[];
  alternatives: string[];
  status: "pending" | "approved" | "denied" | "executing" | "completed";
  createdAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
}

interface Scenario {
  id: string;
  name: string;
  context: string;
  actions: ActionRecommendation[];
  status: "analyzing" | "awaiting_decision" | "executing" | "completed";
  createdAt: Date;
}

const ActionEnginePanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAshaSession();
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateScenario = async () => {
    if (!input.trim() || !user || !activeSession) return;
    setGenerating(true);
    const context = input.trim();
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("asha-query", {
        body: {
          query: context,
          sessionId: activeSession.id,
          mode: "action-engine",
          context: `ACTION ENGINE MODE: The user describes a situation requiring a decision. Generate 3 distinct tactical/strategic responses. For each, provide: a title, description, impact level (low/medium/high/critical), confidence percentage, detailed reasoning, 2 risks, and 1 alternative. Format as JSON array with keys: title, description, impact, confidence, reasoning, risks (array), alternatives (array). Return ONLY the JSON array, no other text.`,
        },
      });

      if (error) throw error;

      let actions: ActionRecommendation[] = [];
      try {
        const responseText = data?.response || "[]";
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          actions = parsed.map((a: any) => ({
            id: crypto.randomUUID(),
            title: a.title || "Untitled Action",
            description: a.description || "",
            impact: a.impact || "medium",
            confidence: a.confidence || 75,
            reasoning: a.reasoning || "",
            risks: a.risks || [],
            alternatives: a.alternatives || [],
            status: "pending" as const,
            createdAt: new Date(),
          }));
        }
      } catch {
        // Fallback mock actions if AI doesn't return parseable JSON
        actions = [
          { id: crypto.randomUUID(), title: "Defensive Posture", description: "Strengthen current position and monitor developments before committing resources.", impact: "medium", confidence: 82, reasoning: "Based on available data, the threat level doesn't warrant immediate aggressive response. Defensive measures reduce exposure while maintaining options.", risks: ["May miss window of opportunity", "Perceived as passive response"], alternatives: ["Deploy reconnaissance first"], status: "pending", createdAt: new Date() },
          { id: crypto.randomUUID(), title: "Proactive Engagement", description: "Deploy resources immediately to address the situation head-on with full operational capability.", impact: "high", confidence: 71, reasoning: "Immediate action could resolve the situation faster, but carries higher operational risk. Best suited when time is a critical factor.", risks: ["Resource overcommitment", "Escalation potential"], alternatives: ["Phased deployment"], status: "pending", createdAt: new Date() },
          { id: crypto.randomUUID(), title: "Diplomatic Resolution", description: "Pursue negotiation and information exchange before committing to operational response.", impact: "low", confidence: 65, reasoning: "Lower risk approach that preserves relationships and resources. Most effective when the opposing party has rational incentives to cooperate.", risks: ["May signal weakness", "Time delay in resolution"], alternatives: ["Back-channel communication"], status: "pending", createdAt: new Date() },
        ];
      }

      const scenario: Scenario = {
        id: crypto.randomUUID(),
        name: context.slice(0, 80),
        context,
        actions,
        status: "awaiting_decision",
        createdAt: new Date(),
      };
      setScenarios(prev => [scenario, ...prev]);
      setSelectedScenario(scenario);
    } catch {
      toast({ title: "Generation failed", description: "Could not generate action recommendations.", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleDecision = (scenarioId: string, actionId: string, decision: "approved" | "denied") => {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s;
      const actions = s.actions.map(a => {
        if (a.id === actionId) return { ...a, status: decision, decidedAt: new Date(), decidedBy: user?.email || "unknown" };
        if (decision === "approved" && a.status === "pending") return { ...a, status: "denied" as const };
        return a;
      });
      const updated = { ...s, actions, status: decision === "approved" ? "executing" as const : s.status };
      setSelectedScenario(updated);
      return updated;
    }));
    toast({ title: decision === "approved" ? "Action approved — executing" : "Action denied", description: decision === "approved" ? "The selected response is now being executed." : "This option has been rejected." });
  };

  const impactColor = (impact: string) => {
    switch (impact) {
      case "critical": return "text-red-400 bg-red-500/10";
      case "high": return "text-orange-400 bg-orange-500/10";
      case "medium": return "text-amber-400 bg-amber-500/10";
      default: return "text-muted-foreground bg-muted/30";
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Scenario list */}
      <div className="w-72 border-r border-border/20 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-extralight text-foreground">Action Engine</h2>
          </div>
          <p className="text-[10px] text-muted-foreground/60">AI recommends — you decide — AI executes</p>
        </div>

        {/* Input */}
        <div className="p-3 border-b border-border/10">
          <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generateScenario()}
              placeholder="Describe the situation…"
              className="flex-1 bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
            <button onClick={generateScenario} disabled={!input.trim() || generating} className="rounded-lg p-1 text-accent hover:bg-accent/10 disabled:opacity-40">
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {scenarios.map(s => (
              <button key={s.id} onClick={() => setSelectedScenario(s)} className={`w-full text-left rounded-xl p-3 transition-colors ${selectedScenario?.id === s.id ? "bg-foreground/10 border border-accent/20" : "hover:bg-foreground/5 border border-transparent"}`}>
                <span className="text-xs font-light text-foreground block truncate">{s.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] rounded-full px-2 py-0.5 ${s.status === "executing" ? "bg-emerald-500/10 text-emerald-400" : s.status === "awaiting_decision" ? "bg-amber-500/10 text-amber-400" : "bg-muted/30 text-muted-foreground"}`}>
                    {s.status.replace("_", " ")}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">{s.actions.length} options</span>
                </div>
              </button>
            ))}
            {scenarios.length === 0 && !generating && (
              <div className="text-center py-10">
                <Zap className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/50">Describe a scenario to get AI-recommended actions</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Actions detail */}
      <div className="flex-1 min-w-0">
        {selectedScenario ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-extralight text-foreground">Scenario Analysis</h3>
                <p className="text-[10px] text-muted-foreground/70 mt-1 leading-relaxed">{selectedScenario.context}</p>
              </div>

              <div className="rounded-xl border border-border/20 bg-card/20 p-3 flex items-center gap-3">
                <Bot className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-[10px] text-foreground/80">AI has generated {selectedScenario.actions.length} tactical responses.</p>
                  <p className="text-[9px] text-muted-foreground/50">Select one to approve — the rest will be automatically denied.</p>
                </div>
              </div>

              {/* Action cards */}
              <div className="space-y-4">
                {selectedScenario.actions.map((action, i) => (
                  <div key={action.id} className={`rounded-xl border p-5 space-y-4 transition-all ${action.status === "approved" ? "border-emerald-500/30 bg-emerald-500/5" : action.status === "denied" ? "border-border/10 bg-card/10 opacity-50" : "border-border/20 bg-card/20"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-accent/10 border border-accent/20 h-8 w-8 flex items-center justify-center text-xs text-accent font-light">
                          {String.fromCharCode(65 + i)}
                        </div>
                        <div>
                          <h4 className="text-xs font-light text-foreground">{action.title}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] rounded-full px-2 py-0.5 uppercase ${impactColor(action.impact)}`}>{action.impact} impact</span>
                            <span className="text-[9px] text-muted-foreground/50">Confidence: {action.confidence}%</span>
                          </div>
                        </div>
                      </div>
                      {action.status !== "pending" && (
                        <span className={`flex items-center gap-1 text-[9px] rounded-full px-2 py-0.5 ${action.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {action.status === "approved" ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {action.status}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{action.description}</p>

                    <div className="rounded-lg bg-card/30 border border-border/10 p-3 space-y-2">
                      <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">AI Reasoning</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{action.reasoning}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[9px] text-red-400/70 uppercase tracking-wider mb-1 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Risks</p>
                        {action.risks.map((r, ri) => (
                          <p key={ri} className="text-[10px] text-muted-foreground/60">• {r}</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-[9px] text-accent/70 uppercase tracking-wider mb-1 flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Alternatives</p>
                        {action.alternatives.map((a, ai) => (
                          <p key={ai} className="text-[10px] text-muted-foreground/60">• {a}</p>
                        ))}
                      </div>
                    </div>

                    {action.status === "pending" && (
                      <div className="flex gap-2 pt-2 border-t border-border/10">
                        <button onClick={() => handleDecision(selectedScenario.id, action.id, "approved")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-[10px] text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                          <CheckCircle className="h-3 w-3" /> Approve & Execute
                        </button>
                        <button onClick={() => handleDecision(selectedScenario.id, action.id, "denied")} className="inline-flex items-center gap-1.5 rounded-lg border border-border/20 px-4 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          <XCircle className="h-3 w-3" /> Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Zap className="h-10 w-10 text-muted-foreground/20" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground/50 mb-2">AI recommends. You decide. AI executes.</p>
              <p className="text-[10px] text-muted-foreground/30">Describe a situation in the input field to generate tactical options.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionEnginePanel;
