import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Sparkles, Globe, Shield, GitBranch, BarChart3, Brain, Eye, Layers, Target } from "lucide-react";

const FeatureAxrlen = () => (
  <FeaturePageShell
    documentTitle="AXRLEN — NEXUS-PRIME Predictive Engine | Aureon"
    eyebrow="Strategic Forecasting"
    headline={<>The Global Prediction<br /><span className="text-muted-foreground">Algorithm.</span></>}
    subheadline="AXRLEN is the NEXUS-PRIME predictive intelligence engine — a multi-source forecasting system for geopolitical events, resource flows, policy outcomes, and timeline divergences. Persona-driven: 'You are my global prediction algorithm.'"
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: Brain, title: "NEXUS-PRIME Reasoning", description: "Multi-stage hypothesis generation with confidence scoring, divergence trees, and counter-scenario analysis." },
      { icon: Globe, title: "Geopolitical Forecasting", description: "Region-tagged predictions across conflict, trade, regulatory, and economic vectors." },
      { icon: Shield, title: "Threat Assessment", description: "Structured threat_assessment JSON with actor, vector, likelihood, and mitigation surfaces." },
      { icon: GitBranch, title: "Timeline Divergences", description: "Map alternative futures with branch probabilities and decision-point sensitivities." },
      { icon: BarChart3, title: "Resource Analysis", description: "Per-region resource flow modeling — energy, capital, talent, military assets." },
      { icon: Sparkles, title: "Policy Simulations", description: "Run counterfactual policy scenarios and capture downstream second/third-order effects." },
      { icon: Eye, title: "AI Summary Synthesis", description: "Every session produces an executive AI summary with confidence score and source manifest." },
      { icon: Layers, title: "Brain-Backed Context", description: "axrlen_brains table injects domain-specific corpora into every prediction run." },
      { icon: Target, title: "Persistent Sessions", description: "Each prediction lives as an axrlen_session with full audit trail and downloadable export." },
    ]}
    useCases={[
      "Strategic planning for sovereign wealth funds and family offices",
      "Geopolitical risk forecasting for multinational supply chains",
      "Defense and intelligence community scenario planning",
      "Policy simulation for executive branch advisors",
      "Resource allocation modeling under uncertainty",
    ]}
    ctaTitle="Forecast the Future. Then Shape It."
    ctaSubtitle="AXRLEN is included in Aureon Pro ($740/mo)."
  />
);

export default FeatureAxrlen;
