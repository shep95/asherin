import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Monitor, Brain, Eye, Activity, Layers, Zap, FileVideo, Network, ShieldAlert } from "lucide-react";

const FeatureCross = () => (
  <FeaturePageShell
    documentTitle="CROSS — Screen Intelligence Platform | Aureon"
    eyebrow="Screen Intelligence"
    headline={<>Your Screen.<br /><span className="text-muted-foreground">Forensically Understood.</span></>}
    subheadline="CROSS is a 100% web-based screen intelligence platform. MediaRecorder-driven capture, frame-level analysis, behavioral profiling, and a 5-level detail hierarchy from Workflow Overview down to Raw Event Data."
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: Monitor, title: "Web-Native Capture", description: "Browser-only capture with MediaRecorder. No installs, no kernel drivers, no enterprise rollout." },
      { icon: Brain, title: "5-Level Detail Hierarchy", description: "Drill from Workflow Overview → Phase → Action → UI Event → Raw Event Data with full traceability." },
      { icon: Eye, title: "Psychological Profiling", description: "Per-session psych_profiles surface user state, intent, frustration signals, and confidence." },
      { icon: Activity, title: "Frame Analysis Engine", description: "Configurable frame sampling — analyzed vs skipped, with credit accounting per session." },
      { icon: Layers, title: "Workflow Reconstruction", description: "Auto-build a node/edge graph of phases, transitions, optimizations, and bottlenecks." },
      { icon: Zap, title: "Insight Generation", description: "AI surfaces inefficiencies, repeat patterns, and recommended workflow optimizations." },
      { icon: FileVideo, title: "Recording & Transcript", description: "Full session recording with synchronized transcript and tagging system." },
      { icon: Network, title: "Workflow Graphs", description: "Visualize the captured workflow as a navigable graph in the cross_workflows store." },
      { icon: ShieldAlert, title: "Alert Tracking", description: "alerts_fired counter surfaces compliance breaches, security anomalies, or policy violations." },
    ]}
    useCases={[
      "Productivity forensics — identify where knowledge workers actually lose hours",
      "Compliance and audit recordings with full searchable trail",
      "Customer support session analysis with psychological state tracking",
      "Onboarding optimization by replaying user struggle points",
      "Insider threat investigation with frame-level evidence",
    ]}
    ctaTitle="See What Your Team Actually Does."
    ctaSubtitle="CROSS is included in Aureon Pro ($740/mo)."
  />
);

export default FeatureCross;
