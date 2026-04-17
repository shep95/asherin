import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Layout, Palette, GitBranch, Image, Layers, Zap, Eye, Type, Maximize } from "lucide-react";

const FeatureWhiteboard = () => (
  <FeaturePageShell
    documentTitle="Whiteboard — Infinite Creative Canvas | Aureon"
    eyebrow="Creative Surface"
    headline={<>An Infinite Canvas.<br /><span className="text-muted-foreground">Glassmorphic by Design.</span></>}
    subheadline="AUREON Whiteboard is an infinite-canvas creation tool with a blurred glassmorphic aesthetic and 14 branded wallpapers. Sketch, plan, diagram, and ideate — all inside the dashboard."
    tierLabel="Included — Every Plan"
    capabilities={[
      { icon: Layout, title: "Infinite Canvas", description: "Pan and zoom across an unbounded surface with smooth GPU-accelerated transforms." },
      { icon: Palette, title: "14 Branded Wallpapers", description: "Hand-curated AUREON wallpapers — pick the surface that fits the work." },
      { icon: Image, title: "Image & Sticker Drops", description: "Drop images, stickers, and reference assets anywhere on the canvas." },
      { icon: Type, title: "Text & Annotation", description: "Typography-aware text blocks with full font control matching the AUREON system." },
      { icon: GitBranch, title: "Diagram Primitives", description: "Boxes, arrows, connectors, and flow primitives for system design." },
      { icon: Layers, title: "Layer Management", description: "Stack and group elements with z-order control and grouping." },
      { icon: Zap, title: "AI-Assisted Layout", description: "Auto-arrange and beautify selections with one click." },
      { icon: Eye, title: "Glassmorphic Aesthetic", description: "Blur layers and translucent panels match the rest of the AUREON visual system." },
      { icon: Maximize, title: "Fullscreen Mode", description: "Distraction-free fullscreen ideation with hide-everything mode." },
    ]}
    useCases={[
      "Strategy mapping and decision trees for executives",
      "System architecture sketches before formal documentation",
      "Visual brainstorming sessions with mixed media",
      "Presentation prep with freeform composition",
      "Product design ideation with reference imagery",
    ]}
    ctaTitle="Think Visually. With Style."
    ctaSubtitle="Whiteboard is included in every Aureon plan."
  />
);

export default FeatureWhiteboard;
