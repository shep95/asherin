import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Puzzle, Zap, Brain, Layers, Globe, Shield, GitBranch, BarChart3, Eye } from "lucide-react";

const FeaturePluginMarketplace = () => (
  <FeaturePageShell
    documentTitle="Plugin Marketplace — Live Azplen Plugins | Aureon"
    eyebrow="Extensibility"
    headline={<>Live Plugins.<br /><span className="text-muted-foreground">Real Execution.</span></>}
    subheadline="The Plugin Marketplace runs on a live execution engine — every plugin runs against real data, not simulated placeholders. Install, configure, run, and chain."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: Puzzle, title: "Live Execution Engine", description: "Plugins call real models with real inputs. No mock returns, no demo theatre." },
      { icon: Zap, title: "One-Click Install", description: "Browse the marketplace, install with one click, configure inputs, run." },
      { icon: Brain, title: "Intelligence-Powered Plugins", description: "Each plugin can leverage multi-model consensus and the full Aureon intelligence stack." },
      { icon: Layers, title: "Plugin Chaining", description: "Output of one plugin feeds the next — build pipelines without writing code." },
      { icon: Globe, title: "Web-Aware Plugins", description: "Plugins can access live web data, structured APIs, and the user's knowledge base." },
      { icon: Shield, title: "Sandboxed Execution", description: "Each plugin runs with scoped permissions; no plugin can read another's secrets." },
      { icon: GitBranch, title: "Version Management", description: "Pin a plugin version per workspace; upgrade on your schedule." },
      { icon: BarChart3, title: "Usage Analytics", description: "Track invocation counts, latency, and cost per plugin." },
      { icon: Eye, title: "Open Author Model", description: "Build and publish plugins with full visibility into runtime behavior." },
    ]}
    useCases={[
      "Custom data enrichment pipelines without writing code",
      "Industry-specific workflows (legal, medical, financial) deployed as plugins",
      "Internal tooling for departments with no engineering resources",
      "Agency-style productized AI services published to clients",
    ]}
    ctaTitle="Plugins That Actually Run."
    ctaSubtitle="Plugin Marketplace is included in Aureon ($199/mo) and above."
  />
);

export default FeaturePluginMarketplace;
