import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { LineChart, Bot, Zap, Shield, Activity, Brain, AlertOctagon, Clock, Layers } from "lucide-react";

const FeatureAziion = () => (
  <FeaturePageShell
    documentTitle="Aziion — Automated Quant Trading Bot | Aureon"
    eyebrow="Quantitative Intelligence"
    headline={<>Automated Trading.<br /><span className="text-muted-foreground">Predictive Conviction.</span></>}
    subheadline="Aziion is an automated quantitative trading bot. AI predicts price direction every 24 hours, places signed trades on Hyperliquid with conviction scoring, and persists every position with full reasoning chain. Admin-restricted by design."
    tierLabel="Restricted — Administrator Only"
    capabilities={[
      { icon: Brain, title: "24h AI Prediction Cycle", description: "Multi-model consensus generates a directional prediction (LONG/SHORT) with confidence score and reasoning." },
      { icon: Bot, title: "Autonomous Execution", description: "Signed trades placed directly on Hyperliquid with TP/SL, position sizing, and leverage controls." },
      { icon: Activity, title: "Bot State Persistence", description: "Every position, P&L, fee, and decision is logged in aziion_trades and aziion_bot_state." },
      { icon: AlertOctagon, title: "Emergency Stop", description: "Single-click kill switch with reason logging — no further trades until manually re-enabled." },
      { icon: LineChart, title: "Predicted Entry/TP/SL", description: "Every prediction stores entry price, take-profit, and stop-loss for full backtesting transparency." },
      { icon: Shield, title: "Admin-Only Access", description: "Restricted to ashernewtonx@gmail.com via row-level security. Cannot be enabled by other accounts." },
      { icon: Zap, title: "Signal Reasoning Logged", description: "Every trade stores the AI's reasoning chain — audit any decision after the fact." },
      { icon: Clock, title: "Scheduled Predictions", description: "next_prediction_at field drives the cron loop. No manual trigger required." },
      { icon: Layers, title: "Session-Based Tracking", description: "Each prediction belongs to a session with title, status, and trade linkage." },
    ]}
    useCases={[
      "Continuous overnight Brent Oil and crypto perpetuals trading",
      "Backtested strategy validation against multi-year historical data",
      "AI-driven directional conviction with quantified confidence",
      "Hands-off P&L generation with full forensic traceability",
    ]}
    ctaTitle="Prediction. Conviction. Execution."
    ctaSubtitle="Aziion is restricted to administrator accounts."
  />
);

export default FeatureAziion;
