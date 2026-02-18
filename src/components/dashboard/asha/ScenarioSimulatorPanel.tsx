import { useState } from "react";
import { FlaskConical, Play, TrendingDown, TrendingUp, Minus, AlertTriangle, Loader2, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

interface ScenarioOutcome { label: string; probability: number; impact: string; direction: "positive" | "negative" | "neutral"; }
interface Scenario { id: string; name: string; variable: string; change: string; timeHorizon: string; status: "idle" | "running" | "complete"; outcomes?: ScenarioOutcome[]; sensitivity?: { factor: string; impact: "high" | "medium" | "low" }[]; netImpact?: string; }

const OUTCOME_COLORS = { positive: "hsl(140, 50%, 50%)", negative: "hsl(0, 60%, 55%)", neutral: "hsl(220, 10%, 55%)" };

const ScenarioSimulatorPanel = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [newName, setNewName] = useState("");
  const [newVariable, setNewVariable] = useState("");
  const [newChange, setNewChange] = useState("");
  const [newHorizon, setNewHorizon] = useState("6 months");
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  const createScenario = async () => {
    if (!newName.trim() || !user) return;
    const scenario: Scenario = { id: crypto.randomUUID(), name: newName, variable: newVariable, change: newChange, timeHorizon: newHorizon, status: "running" };
    setScenarios(prev => [scenario, ...prev]);
    setSelectedScenario(scenario);
    setShowCreate(false);
    setNewName(""); setNewVariable(""); setNewChange("");

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ query: `[SCENARIO SIMULATION] "${newName}" — Variable: ${newVariable}, Change: ${newChange}, Horizon: ${newHorizon}. Return ONLY JSON: {"outcomes":[{"label":"desc","probability":0-100,"impact":"$amt","direction":"positive|negative|neutral"}],"sensitivity":[{"factor":"name","impact":"high|medium|low"}],"netImpact":"assessment"}`, sessionId: activeSession?.id }),
      });
      if (res.ok) {
        const result = await res.json();
        const jsonMatch = (result.response || "").match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const updated = { ...scenario, status: "complete" as const, outcomes: parsed.outcomes || [], sensitivity: parsed.sensitivity || [], netImpact: parsed.netImpact || "" };
          setScenarios(prev => prev.map(s => s.id === scenario.id ? updated : s));
          setSelectedScenario(updated);
          return;
        }
      }
      throw new Error("fail");
    } catch {
      const fallback = { ...scenario, status: "complete" as const, outcomes: [{ label: "Inconclusive", probability: 100, impact: "N/A", direction: "neutral" as const }], netImpact: "Upload data for better results." };
      setScenarios(prev => prev.map(s => s.id === scenario.id ? fallback : s));
      setSelectedScenario(fallback);
    }
  };

  const detail = selectedScenario;

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-border/20 bg-card/10 flex flex-col">
        <div className="p-4 border-b border-border/20 space-y-3">
          <div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-purple-400" /><h2 className="text-sm font-light tracking-wide text-foreground">Scenario Simulator</h2></div>
          <p className="text-[10px] font-extralight text-muted-foreground">AI-powered "What If" analysis against your data.</p>
          <button onClick={() => setShowCreate(!showCreate)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors"><Plus className="h-3.5 w-3.5" /> New Scenario</button>
        </div>
        {showCreate && (
          <div className="p-4 border-b border-border/20 space-y-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Scenario name…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={newVariable} onChange={e => setNewVariable(e.target.value)} placeholder="Variable…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={newChange} onChange={e => setNewChange(e.target.value)} placeholder="Change (e.g. -40%)…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <select value={newHorizon} onChange={e => setNewHorizon(e.target.value)} className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none"><option>3 months</option><option>6 months</option><option>12 months</option><option>24 months</option></select>
            <button onClick={createScenario} disabled={!newName.trim()} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-500/20 py-2 text-xs text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-40"><Play className="h-3 w-3" /> Run</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {scenarios.map(s => (
            <button key={s.id} onClick={() => setSelectedScenario(s)} className={`w-full text-left rounded-lg px-3 py-3 transition-colors ${detail?.id === s.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
              <p className="text-xs font-light text-foreground truncate">{s.name}</p>
              <div className="text-[10px] text-muted-foreground/50 mt-1">{s.variable} {s.change} · {s.timeHorizon}</div>
              {s.status === "running" && <span className="text-[9px] text-amber-400 flex items-center gap-1 mt-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Analyzing…</span>}
              {s.status === "complete" && <span className="text-[9px] text-emerald-400 mt-1">Complete</span>}
            </button>
          ))}
          {scenarios.length === 0 && <p className="text-[10px] text-muted-foreground/40 text-center py-8">Create a scenario to begin.</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {detail?.status === "complete" && detail.outcomes ? (
          <div className="p-6 space-y-6">
            <div><h2 className="text-lg font-extralight tracking-wide text-foreground">{detail.name}</h2><p className="text-xs text-muted-foreground mt-1">{detail.variable} · {detail.change} · {detail.timeHorizon}</p></div>
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5">
              <h3 className="text-xs font-light text-foreground mb-4">Probability Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={detail.outcomes}><CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" /><XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(0, 0%, 55%)" }} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} unit="%" /><Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} /><Bar dataKey="probability" radius={[6, 6, 0, 0]}>{detail.outcomes.map((o, i) => <Cell key={i} fill={OUTCOME_COLORS[o.direction]} />)}</Bar></BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
              <table className="w-full text-xs"><thead><tr className="border-b border-border/20"><th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase font-light">Outcome</th><th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase font-light">Prob</th><th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase font-light">Impact</th><th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase font-light">Dir</th></tr></thead>
              <tbody>{detail.outcomes.map((o, i) => (<tr key={i} className="border-b border-border/10"><td className="px-4 py-3 font-light text-foreground">{o.label}</td><td className="px-4 py-3 text-foreground">{o.probability}%</td><td className="px-4 py-3 font-mono text-foreground">{o.impact}</td><td className="px-4 py-3">{o.direction === "positive" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : o.direction === "negative" ? <TrendingDown className="h-3.5 w-3.5 text-destructive" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}</td></tr>))}</tbody></table>
            </div>
            {detail.sensitivity && detail.sensitivity.length > 0 && (
              <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5">
                <h3 className="text-xs font-light text-foreground mb-3">Sensitivity Analysis</h3>
                <div className="space-y-2">{detail.sensitivity.map(s => (<div key={s.factor} className="flex items-center gap-3"><span className="text-xs font-light text-foreground w-48 truncate">{s.factor}</span><div className="flex-1 h-2 rounded-full bg-card/40 overflow-hidden"><div className={`h-full rounded-full ${s.impact === "high" ? "bg-destructive w-full" : s.impact === "medium" ? "bg-amber-500 w-2/3" : "bg-emerald-500 w-1/3"}`} /></div><span className={`text-[10px] w-16 text-right ${s.impact === "high" ? "text-destructive" : s.impact === "medium" ? "text-amber-400" : "text-emerald-400"}`}>{s.impact.toUpperCase()}</span></div>))}</div>
              </div>
            )}
            {detail.netImpact && (<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"><div className="flex items-start gap-3"><AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" /><div><h3 className="text-xs font-light text-foreground mb-1">Bottom Line</h3><p className="text-xs font-extralight text-muted-foreground leading-relaxed">{detail.netImpact}</p></div></div></div>)}
          </div>
        ) : detail?.status === "running" ? (
          <div className="flex flex-col items-center justify-center h-full gap-4"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /><p className="text-sm font-extralight text-muted-foreground">Running AI analysis…</p></div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full"><FlaskConical className="h-12 w-12 text-muted-foreground/20 mb-4" /><p className="text-sm font-extralight text-muted-foreground">Create a scenario to begin</p></div>
        )}
      </div>
    </div>
  );
};

export default ScenarioSimulatorPanel;
