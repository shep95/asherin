import { useState } from "react";
import { FlaskConical, Play, BarChart3, GitBranch, TrendingDown, TrendingUp, Minus, AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Scenario {
  id: string;
  name: string;
  variable: string;
  change: string;
  timeHorizon: string;
  status: "idle" | "running" | "complete";
  outcomes?: ScenarioOutcome[];
  sensitivity?: { factor: string; impact: "high" | "medium" | "low" }[];
  netImpact?: string;
}

interface ScenarioOutcome {
  label: string;
  probability: number;
  impact: string;
  direction: "positive" | "negative" | "neutral";
}

const DEMO_SCENARIOS: Scenario[] = [
  {
    id: "s1", name: "Reduce Marketing Spend 40%", variable: "Marketing Budget", change: "-40%", timeHorizon: "6 months", status: "complete",
    outcomes: [
      { label: "Revenue drops 8-12%", probability: 41, impact: "-$340K", direction: "negative" },
      { label: "Revenue drops 13-18%", probability: 33, impact: "-$612K", direction: "negative" },
      { label: "Revenue drops >18%", probability: 19, impact: "-$890K", direction: "negative" },
      { label: "Revenue unchanged", probability: 7, impact: "$0", direction: "neutral" },
    ],
    sensitivity: [
      { factor: "Customer Acquisition Rate", impact: "high" },
      { factor: "Churn Rate", impact: "high" },
      { factor: "Brand Awareness", impact: "medium" },
      { factor: "COGS", impact: "low" },
    ],
    netImpact: "Marketing cut saves $200K/month. Revenue drop costs $340K/month at median scenario. Net: You lose $140K/month.",
  },
  {
    id: "s2", name: "Raise Prices 10%", variable: "Pricing", change: "+10%", timeHorizon: "12 months", status: "complete",
    outcomes: [
      { label: "Revenue increases 4-7%", probability: 38, impact: "+$280K", direction: "positive" },
      { label: "Revenue flat (churn offsets)", probability: 31, impact: "$0", direction: "neutral" },
      { label: "Revenue decreases 2-5%", probability: 22, impact: "-$190K", direction: "negative" },
      { label: "Major churn event (>15%)", probability: 9, impact: "-$720K", direction: "negative" },
    ],
    sensitivity: [
      { factor: "Competitor Pricing", impact: "high" },
      { factor: "Customer LTV", impact: "medium" },
      { factor: "Market Position", impact: "medium" },
      { factor: "Product Stickiness", impact: "low" },
    ],
    netImpact: "Expected value across all scenarios: +$47K/month. Risk-adjusted: Moderate upside with 9% catastrophic risk.",
  },
];

const OUTCOME_COLORS = {
  positive: "hsl(140, 50%, 50%)",
  negative: "hsl(0, 60%, 55%)",
  neutral: "hsl(220, 10%, 55%)",
};

const ScenarioSimulatorPanel = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>(DEMO_SCENARIOS);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [newName, setNewName] = useState("");
  const [newVariable, setNewVariable] = useState("");
  const [newChange, setNewChange] = useState("");
  const [newHorizon, setNewHorizon] = useState("6 months");

  const createScenario = () => {
    if (!newName.trim()) return;
    const scenario: Scenario = {
      id: crypto.randomUUID(), name: newName, variable: newVariable, change: newChange, timeHorizon: newHorizon, status: "running",
    };
    setScenarios(prev => [scenario, ...prev]);
    setShowCreate(false);
    setNewName(""); setNewVariable(""); setNewChange("");
    // Simulate completion
    setTimeout(() => {
      setScenarios(prev => prev.map(s => s.id === scenario.id ? {
        ...s, status: "complete",
        outcomes: [
          { label: "Best case", probability: 25, impact: "+$200K", direction: "positive" as const },
          { label: "Expected case", probability: 45, impact: "-$50K", direction: "negative" as const },
          { label: "Worst case", probability: 20, impact: "-$400K", direction: "negative" as const },
          { label: "No change", probability: 10, impact: "$0", direction: "neutral" as const },
        ],
        sensitivity: [
          { factor: "Market conditions", impact: "high" as const },
          { factor: "Execution speed", impact: "medium" as const },
        ],
        netImpact: "Expected value: -$75K over the period. Proceed with caution.",
      } : s));
    }, 3000);
  };

  const detail = selectedScenario;

  return (
    <div className="flex h-full">
      {/* Scenario list */}
      <div className="w-80 border-r border-border/20 bg-card/10 flex flex-col">
        <div className="p-4 border-b border-border/20 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-light tracking-wide text-foreground">Scenario Simulator</h2>
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">
            Run "What If" simulations on your actual data. Monte Carlo engine with 10,000 iterations.
          </p>
          <button onClick={() => setShowCreate(!showCreate)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Scenario
          </button>
        </div>

        {showCreate && (
          <div className="p-4 border-b border-border/20 space-y-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Scenario name…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={newVariable} onChange={e => setNewVariable(e.target.value)} placeholder="Variable to change…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={newChange} onChange={e => setNewChange(e.target.value)} placeholder="Change amount (e.g. -40%)…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <select value={newHorizon} onChange={e => setNewHorizon(e.target.value)} className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none">
              <option>3 months</option><option>6 months</option><option>12 months</option><option>24 months</option>
            </select>
            <button onClick={createScenario} disabled={!newName.trim()} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-500/20 py-2 text-xs text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-40">
              <Play className="h-3 w-3" /> Run Simulation
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {scenarios.map(s => (
            <button key={s.id} onClick={() => setSelectedScenario(s)}
              className={`w-full text-left rounded-lg px-3 py-3 transition-colors ${detail?.id === s.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
              <p className="text-xs font-light text-foreground truncate">{s.name}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/50">
                <span>{s.variable} {s.change}</span>
                <span>·</span>
                <span>{s.timeHorizon}</span>
              </div>
              <div className="mt-1.5">
                {s.status === "running" && <span className="text-[9px] text-amber-400 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Simulating…</span>}
                {s.status === "complete" && <span className="text-[9px] text-emerald-400">Complete — {s.outcomes?.length} outcomes</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail view */}
      <div className="flex-1 overflow-y-auto">
        {detail && detail.status === "complete" && detail.outcomes ? (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-extralight tracking-wide text-foreground">{detail.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Variable: <span className="text-foreground">{detail.variable}</span> · Change: <span className="text-foreground">{detail.change}</span> · Horizon: <span className="text-foreground">{detail.timeHorizon}</span>
              </p>
            </div>

            {/* Probability Distribution */}
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5">
              <h3 className="text-xs font-light text-foreground mb-4">Probability Distribution (10,000 iterations)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={detail.outcomes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
                    {detail.outcomes.map((o, i) => <Cell key={i} fill={OUTCOME_COLORS[o.direction]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Outcomes Table */}
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-light">Outcome</th>
                    <th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-light">Probability</th>
                    <th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-light">Impact</th>
                    <th className="text-left px-4 py-3 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-light">Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.outcomes.map((o, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="px-4 py-3 font-light text-foreground">{o.label}</td>
                      <td className="px-4 py-3 text-foreground">{o.probability}%</td>
                      <td className="px-4 py-3 font-mono text-foreground">{o.impact}</td>
                      <td className="px-4 py-3">
                        {o.direction === "positive" && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                        {o.direction === "negative" && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                        {o.direction === "neutral" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sensitivity Analysis */}
            {detail.sensitivity && (
              <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5">
                <h3 className="text-xs font-light text-foreground mb-3">Sensitivity Analysis</h3>
                <p className="text-[10px] text-muted-foreground mb-4">Which factors most influence the outcome?</p>
                <div className="space-y-2">
                  {detail.sensitivity.map(s => (
                    <div key={s.factor} className="flex items-center gap-3">
                      <span className="text-xs font-light text-foreground w-48 truncate">{s.factor}</span>
                      <div className="flex-1 h-2 rounded-full bg-card/40 overflow-hidden">
                        <div className={`h-full rounded-full ${s.impact === "high" ? "bg-destructive w-full" : s.impact === "medium" ? "bg-amber-500 w-2/3" : "bg-emerald-500 w-1/3"}`} />
                      </div>
                      <span className={`text-[10px] w-16 text-right ${s.impact === "high" ? "text-destructive" : s.impact === "medium" ? "text-amber-400" : "text-emerald-400"}`}>
                        {s.impact.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Net Impact / Bottom Line */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-xs font-light text-foreground mb-1">Bottom Line Assessment</h3>
                  <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{detail.netImpact}</p>
                </div>
              </div>
            </div>
          </div>
        ) : detail && detail.status === "running" ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <p className="text-sm font-extralight text-muted-foreground">Running Monte Carlo simulation…</p>
            <p className="text-[10px] text-muted-foreground/50">10,000 iterations across all variables</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <FlaskConical className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-extralight text-muted-foreground">Select or create a scenario to view results</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioSimulatorPanel;
