import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Cpu, Cog, FileSearch, Layers, Eye, GitBranch, Zap, Network, ShieldAlert } from "lucide-react";

const FeatureReverseEngineer = () => (
  <FeaturePageShell
    documentTitle="REIS — Reverse Engineering Intelligence | Aureon"
    eyebrow="Reverse Engineering"
    headline={<>Deconstruct Anything.<br /><span className="text-muted-foreground">Software or Hardware.</span></>}
    subheadline="REIS — the Reverse Engineering Intelligence System — deconstructs software binaries and hardware designs into architecture, intent, and exploit surfaces. Aureon and Pro tier."
    tierLabel="Aureon — $199/mo · Pro — $740/mo"
    capabilities={[
      { icon: Cpu, title: "Binary Deconstruction", description: "Disassembly with control-flow recovery, function naming, and intent inference." },
      { icon: Cog, title: "Hardware Decomposition", description: "Schematic and PCB analysis with component identification and signal tracing." },
      { icon: FileSearch, title: "Protocol Inference", description: "Reconstruct undocumented protocols from packet captures and runtime traces." },
      { icon: Layers, title: "Architectural Recovery", description: "Surface module boundaries, dependency graphs, and architectural patterns from raw binaries." },
      { icon: Eye, title: "Vulnerability Surfaces", description: "Identify exploit primitives — UAF, OOB, ROP gadget chains — with severity ranking." },
      { icon: GitBranch, title: "Patch Diffing", description: "Compare two versions to surface security-relevant changes and silent fixes." },
      { icon: Zap, title: "AI Commentary", description: "Every disassembled function receives an AI-generated intent summary in plain English." },
      { icon: Network, title: "Cross-Reference Engine", description: "Pivot from any byte to its callers, callees, and data references with full graph view." },
      { icon: ShieldAlert, title: "Threat Model Output", description: "Auto-generated threat model document for any analyzed artifact." },
    ]}
    useCases={[
      "Vulnerability research on proprietary closed-source software",
      "Hardware security assessment for IoT and embedded systems",
      "Malware analysis with full architectural reconstruction",
      "Patch diff analysis to identify silently fixed CVEs",
      "Competitive intelligence on closed-source competitor products",
    ]}
    ctaTitle="Nothing Stays a Black Box."
    ctaSubtitle="REIS is included in Aureon ($199/mo) and Pro ($740/mo)."
  />
);

export default FeatureReverseEngineer;
