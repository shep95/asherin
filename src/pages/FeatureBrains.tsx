import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Brain, Upload, Layers, Eye, Edit, Zap, FileText, Lock, GitBranch } from "lucide-react";

const FeatureBrains = () => (
  <FeaturePageShell
    documentTitle="Brains — Custom AI Knowledge Bases | Aureon"
    eyebrow="Knowledge Injection"
    headline={<>Your Knowledge.<br /><span className="text-muted-foreground">Inside the AI.</span></>}
    subheadline="Brains are custom knowledge bases injected into AI conversations. Upload files, define system prompts, and switch brains per chat. Two-tier system: general Brains and module-specific brains (axrlen_brains)."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: Brain, title: "Custom Knowledge Bases", description: "Each brain has a name, description, file corpus, and system prompt." },
      { icon: Upload, title: "Multi-File Ingestion", description: "Upload PDFs, docs, CSVs, code — all extracted into the brain's corpus." },
      { icon: Layers, title: "Two-Tier System", description: "General Brains for chat; module brains (axrlen_brains, plugin brains) for specialized engines." },
      { icon: Edit, title: "System Prompt Override", description: "Each brain can define a system prompt that shapes AI behavior on every invocation." },
      { icon: Zap, title: "Per-Conversation Switching", description: "Activate any brain mid-conversation; the AI immediately incorporates its corpus and persona." },
      { icon: FileText, title: "File Reference Tracking", description: "file_ids array tracks every file backing the brain for audit and refresh." },
      { icon: GitBranch, title: "Active/Inactive Toggle", description: "Brains can be paused without deletion; reactivate with one click." },
      { icon: Eye, title: "Cross-Project Reuse", description: "Brains live at the user level — reuse across projects, conversations, and modules." },
      { icon: Lock, title: "User-Scoped", description: "Brains are private to the owning account with row-level security." },
    ]}
    useCases={[
      "Industry-specific assistants (legal, medical, defense) with private corpora",
      "Personal research assistants loaded with your reading list",
      "Customer support brains preloaded with product documentation",
      "Specialist engines (AXRLEN, plugins) each backed by domain-curated corpora",
    ]}
    ctaTitle="Train the AI on What You Know."
    ctaSubtitle="Brains is included in Aureon ($199/mo) and above."
  />
);

export default FeatureBrains;
