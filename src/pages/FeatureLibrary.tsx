import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { FolderOpen, Search, Layers, Eye, Tag, Lock, GitBranch, Zap, FileText } from "lucide-react";

const FeatureLibrary = () => (
  <FeaturePageShell
    documentTitle="Library & Project Folders | Aureon"
    eyebrow="Knowledge Management"
    headline={<>Everything You've Ever<br /><span className="text-muted-foreground">Given the AI.</span></>}
    subheadline="The Library is your global document store. Project Folders create siloed contexts for specific work. Cross-Project Search finds anything across both — instantly."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: FolderOpen, title: "Project Folders", description: "Siloed context per project — files, conversations, and memories scoped to that project." },
      { icon: Layers, title: "Global Library", description: "All-account document storage that any project or chat can pull from." },
      { icon: Search, title: "Cross-Project Search", description: "Semantic search across every file, every project, every conversation." },
      { icon: Tag, title: "Tag & Categorize", description: "Multi-tag any document; build dynamic collections by tag." },
      { icon: Eye, title: "In-App Preview", description: "PDF, image, code, and document preview without download." },
      { icon: GitBranch, title: "Version Tracking", description: "Re-upload any file; previous versions remain accessible with diff support for text." },
      { icon: Zap, title: "AI-Aware Storage", description: "Every uploaded file is parsed, embedded, and made retrievable by the AI immediately." },
      { icon: FileText, title: "Multi-Format Support", description: "PDF, DOCX, PPTX, XLSX, TXT, code, images — all first-class citizens." },
      { icon: Lock, title: "Per-File Permissions", description: "Pro teams can scope file visibility down to individual users." },
    ]}
    useCases={[
      "Personal knowledge base across years of research and reference",
      "Project-scoped context for engineering, legal, or strategic work",
      "Shared team libraries (Pro tier) with role-based access",
      "Cross-project research without losing the boundaries between projects",
    ]}
    ctaTitle="Your Documents. AI-Native."
    ctaSubtitle="Library and Project Folders included in Aureon ($199/mo) and above."
  />
);

export default FeatureLibrary;
