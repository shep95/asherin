import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Brain, Layers, Edit, GitBranch, Eye, Search, Tag, Zap, Lock } from "lucide-react";

const FeatureMemoryCenter = () => (
  <FeaturePageShell
    documentTitle="Memory Center — Persistent AI Context | Aureon"
    eyebrow="Persistent Intelligence"
    headline={<>Aureon Remembers.<br /><span className="text-muted-foreground">So You Don't Repeat.</span></>}
    subheadline="The Memory Center is Aureon's persistent context layer. It stores facts, preferences, traits, and project context across every session. Your intelligence profile evolves with every interaction."
    tierLabel="Included — Every Plan"
    capabilities={[
      { icon: Brain, title: "Cross-Session Memory", description: "Categorized memories persist across every chat, agent, and module." },
      { icon: Layers, title: "Auto-Inferred Traits", description: "Aureon infers tone, depth preference, expertise areas, and topic interests from conversation." },
      { icon: Edit, title: "Full CRUD Control", description: "Add, edit, delete, and re-organize memories with full version history." },
      { icon: Tag, title: "Categorized Storage", description: "Memories are typed — facts, preferences, projects, constraints — with clean filtering." },
      { icon: Search, title: "Semantic Search", description: "Find any memory by meaning, not just keyword." },
      { icon: GitBranch, title: "Context Injection", description: "Relevant memories auto-inject into every prompt without manual selection." },
      { icon: Eye, title: "Transparent Recall", description: "See exactly which memories were injected into any given response." },
      { icon: Zap, title: "User Intelligence Profile", description: "A living profile of you — communication style, expertise, response preferences." },
      { icon: Lock, title: "Private by Default", description: "Memories are user-scoped with row-level security. Never shared across users." },
    ]}
    useCases={[
      "Eliminate repetition — never re-explain context to the AI",
      "Persistent project context across weeks-long engineering work",
      "Personal AI that adapts to your communication style over time",
      "Multi-domain expertise tracking for consultants and freelancers",
    ]}
    ctaTitle="The AI That Actually Remembers You."
    ctaSubtitle="Memory Center is included in every Aureon plan."
  />
);

export default FeatureMemoryCenter;
