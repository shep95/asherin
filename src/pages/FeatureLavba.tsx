import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { TrendingUp, Cpu, GitBranch, BarChart3, Zap, Brain, Activity, Layers, ShieldAlert } from "lucide-react";

const FeatureLavba = () => (
  <FeaturePageShell
    documentTitle="Lavba — Autonomous Strategy Discovery | Aureon"
    eyebrow="Strategy Engine"
    headline={<>Nestal Fractal<br /><span className="text-muted-foreground">Intelligence.</span></>}
    subheadline="Lavba is a white-label dashboard tab functioning as an Autonomous Strategy Discovery Engine. It surfaces, backtests, and ranks novel trading and operational strategies through fractal pattern analysis."
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: Brain, title: "Autonomous Discovery", description: "Engine generates strategy candidates without manual hypothesis input." },
      { icon: TrendingUp, title: "Fractal Pattern Engine", description: "Nestal fractal logic identifies repeating structures across timeframes and asset classes." },
      { icon: BarChart3, title: "Continuous Backtesting", description: "Every candidate is scored against historical regimes before promotion." },
      { icon: Cpu, title: "Strategy Ranking", description: "Multi-factor ranking by Sharpe, Sortino, drawdown, and regime-stability." },
      { icon: GitBranch, title: "Strategy Branching", description: "Fork promising strategies for parameter exploration without losing the parent." },
      { icon: Zap, title: "Auto-Trading Hook", description: "Promoted strategies can route to Lavba auto-trading (administrator-restricted live execution)." },
      { icon: Activity, title: "Live Performance Tracking", description: "Real-time P&L per strategy with attribution to discovered patterns." },
      { icon: Layers, title: "White-Label Surface", description: "Embed Lavba as a tab in any partner dashboard with brand-controlled UI." },
      { icon: ShieldAlert, title: "Risk Constraints", description: "Hard-coded position, leverage, and drawdown limits prevent runaway losses." },
    ]}
    useCases={[
      "Hedge fund alpha discovery without quant research staffing",
      "Family office strategy diversification with continuous candidate generation",
      "White-label strategy products for fintech partners",
      "Autonomous live trading (administrator-only execution)",
    ]}
    ctaTitle="Strategies Discover Themselves."
    ctaSubtitle="Lavba is included in Aureon Pro ($740/mo)."
  />
);

export default FeatureLavba;
