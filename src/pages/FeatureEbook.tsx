import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Book, FileText, Layers, Edit, Download, Type, Image, Zap, Eye } from "lucide-react";

const FeatureEbook = () => (
  <FeaturePageShell
    documentTitle="E-Book Generator — Multi-Session Authoring | Aureon"
    eyebrow="Long-Form Authoring"
    headline={<>Books, Not Blog Posts.<br /><span className="text-muted-foreground">Built Incrementally.</span></>}
    subheadline="The E-Book Generator supports persistent multi-book sessions with incremental text uploads. Build books over weeks, not in one chaotic prompt. Full chapter management, front matter, and export."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: Book, title: "Persistent Book Sessions", description: "Each book is a long-lived session with title, subtitle, author, dedication, copyright, and about-author." },
      { icon: Edit, title: "Incremental Text Uploads", description: "Upload chapters as you write — the system tracks word count and stitches them into the master manuscript." },
      { icon: Layers, title: "Chapter Management", description: "Reorder, split, merge, and version chapters without losing prior drafts." },
      { icon: Type, title: "Front & Back Matter", description: "Structured fields for dedication, acknowledgements, copyright, and author bio." },
      { icon: Image, title: "Cover & Image Support", description: "Attach cover art and inline imagery with caption management." },
      { icon: FileText, title: "Style Settings", description: "Per-book settings JSON drives typography, spacing, and output formatting." },
      { icon: Download, title: "Multi-Format Export", description: "EPUB, PDF, and DOCX exports with consistent typography across formats." },
      { icon: Eye, title: "Live Preview", description: "Reader-mode preview of any chapter at any moment." },
      { icon: Zap, title: "AI Co-Author", description: "AI assistance for outlining, expansion, editing, and continuity checking." },
    ]}
    useCases={[
      "Solo authors writing novels and non-fiction over months",
      "Subject-matter experts converting research into structured books",
      "Internal company manuals and onboarding handbooks",
      "Self-publishers needing multi-format export from one source",
      "Coaches and consultants productizing methodology into books",
    ]}
    ctaTitle="Write the Book. Don't Reinvent the Wheel."
    ctaSubtitle="E-Book Generator is included in Aureon ($199/mo) and above."
  />
);

export default FeatureEbook;
