import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { ScrollText, Brain, GitBranch, Eye, Layers, Zap, Shield, BarChart3, Activity } from "lucide-react";

const FeatureCodingLaws = () => (
  <FeaturePageShell
    documentTitle="Coding Laws Engine — Living Best Practices | Aureon"
    eyebrow="Engineering Discipline"
    headline={<>The Constitution<br /><span className="text-muted-foreground">For Code.</span></>}
    subheadline="The Coding Laws Engine maintains a living corpus of engineering laws across domains and eras. AI-discovered, cross-referenced, severity-rated, and enforced inside every Aureon coding session."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: ScrollText, title: "Living Law Corpus", description: "Numbered laws across domains (security, performance, readability, architecture) and eras." },
      { icon: Brain, title: "AI Discovery", description: "Engine runs scheduled discovery passes — surfaces new laws from real-world incidents and literature." },
      { icon: GitBranch, title: "Cross-Referencing", description: "Each law links to parent laws, related laws, and concrete enforcement examples." },
      { icon: Eye, title: "Rationale Transparency", description: "Every law ships with explicit rationale — why it exists, what it prevents, when to break it." },
      { icon: Layers, title: "Severity Tiers", description: "Critical / high / medium / low severity drives gating in code review and CI checks." },
      { icon: Zap, title: "Live Enforcement", description: "Active laws inject into the IDE and chat coding sessions — violations flagged in real time." },
      { icon: Shield, title: "Domain Coverage", description: "Security, concurrency, error handling, API design, data modeling, and more." },
      { icon: BarChart3, title: "Engine Run Logs", description: "Every discovery and cross-reference pass is logged with metrics for full auditability." },
      { icon: Activity, title: "Custom Law Authoring", description: "Add organization-specific laws that participate in the same engine and enforcement." },
    ]}
    useCases={[
      "Engineering teams enforcing consistent quality across all AI-assisted code",
      "Security-critical projects with hard rules that must never be violated",
      "Tech leads codifying tribal knowledge into enforceable laws",
      "Teaching environments where novices learn law-by-law",
    ]}
    ctaTitle="Quality, Encoded as Law."
    ctaSubtitle="Coding Laws Engine is included in Aureon ($199/mo) and above."
  />
);

export default FeatureCodingLaws;
