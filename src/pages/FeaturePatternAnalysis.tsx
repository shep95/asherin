import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { TrendingUp, Eye, Image, Brain, BarChart3, GitBranch, Zap, Activity, Layers } from "lucide-react";

const FeaturePatternAnalysis = () => (
  <FeaturePageShell
    documentTitle="Pattern Analysis — Trend Forecasting | Aureon"
    eyebrow="Predictive Patterns"
    headline={<>The Pattern<br /><span className="text-muted-foreground">Before the News.</span></>}
    subheadline="Pattern Analysis identifies trends in text and visual data using the Azplen pipeline. Forecast emerging movements, brand shifts, and structural anomalies before mainstream signals appear."
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: TrendingUp, title: "Trend Detection", description: "Statistical and AI-driven detection of accelerating signals across heterogenous datasets." },
      { icon: Image, title: "Visual Pattern Mining", description: "Image-based trend analysis — surface visual motifs, brand cues, and aesthetic shifts." },
      { icon: Brain, title: "Azplen-Powered Engine", description: "Reuses the Azplen analytical pipeline for natural-language pattern queries." },
      { icon: Eye, title: "Anomaly Surfaces", description: "Distinguish genuine emerging patterns from cyclical noise and seasonal artifacts." },
      { icon: BarChart3, title: "Confidence Scoring", description: "Every pattern carries a quantified confidence and projected horizon." },
      { icon: GitBranch, title: "Forking Branches", description: "Isolate a single pattern and run scenario branches on its trajectory." },
      { icon: Zap, title: "Live Alerts", description: "Subscribe to a pattern; get alerted when its trajectory accelerates or breaks." },
      { icon: Activity, title: "Cross-Modal Correlation", description: "Correlate text-based mentions with visual presence and structural data." },
      { icon: Layers, title: "Forecast Horizons", description: "Multi-horizon projections: 1-day, 1-week, 1-month, 1-quarter." },
    ]}
    useCases={[
      "Brand and trend forecasting for consumer goods companies",
      "Geopolitical signal mining across news, imagery, and structured data",
      "Hedge fund alpha sourcing from emergent pattern recognition",
      "Marketing campaign timing based on accelerating cultural signals",
      "Supply-chain anomaly forecasting from cross-modal indicators",
    ]}
    ctaTitle="See the Trend Before the Trend."
    ctaSubtitle="Pattern Analysis is included in Aureon Pro ($740/mo)."
  />
);

export default FeaturePatternAnalysis;
