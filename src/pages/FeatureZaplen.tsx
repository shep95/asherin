import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Crown, Swords, Map, Brain, GitBranch, BarChart3, Eye, Zap, ShieldAlert } from "lucide-react";

const FeatureZaplen = () => (
  <FeaturePageShell
    documentTitle="Zaplen — War Scenarios & Chess Engine | Aureon"
    eyebrow="Strategic Simulation"
    headline={<>War Scenarios.<br /><span className="text-muted-foreground">Played to the End.</span></>}
    subheadline="Zaplen is a Pro-tier war scenarios platform with a high-fidelity Chess engine, multi-domain conflict simulation, and adversarial outcome trees. Pre-mortem your strategy before reality runs the experiment."
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: Crown, title: "High-Fidelity Chess Engine", description: "Full UCI-compatible engine with branching, evaluation, and AI commentary." },
      { icon: Swords, title: "Multi-Domain War Scenarios", description: "Land, sea, air, cyber, and economic vectors modeled in a unified simulation." },
      { icon: Map, title: "Theatre Visualization", description: "Geographic and topological views of force distribution and movement." },
      { icon: Brain, title: "Adversary Modeling", description: "Configurable adversary doctrine — symmetric, asymmetric, hybrid, irregular." },
      { icon: GitBranch, title: "Outcome Branching", description: "Every decision spawns a branch; explore the full decision tree." },
      { icon: BarChart3, title: "Probabilistic Scoring", description: "Outcome likelihood with sensitivity to assumptions and inputs." },
      { icon: Eye, title: "After-Action Review", description: "Auto-generated AAR with key decision points, blunders, and missed opportunities." },
      { icon: Zap, title: "Pre-Mortem Mode", description: "Run a scenario backwards from a failure state to surface its causes." },
      { icon: ShieldAlert, title: "Escalation Modeling", description: "Track escalation ladders with off-ramp identification at every rung." },
    ]}
    useCases={[
      "Defense and intelligence community scenario planning",
      "Geopolitical strategy stress-testing for hedge funds and sovereign actors",
      "Executive war-gaming for high-stakes M&A or competitive responses",
      "Chess training and analysis at engine-grade depth",
      "Insurance and reinsurance modeling against tail-risk conflict scenarios",
    ]}
    ctaTitle="Win the Game Before It Starts."
    ctaSubtitle="Zaplen is included in Aureon Pro ($740/mo)."
  />
);

export default FeatureZaplen;
