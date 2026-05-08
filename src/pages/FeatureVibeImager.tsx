import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { ArrowLeft, ArrowRight, Palette, Wand2, MessageSquare, Layers, Sparkles, ImagePlus, Brush, Eye } from "lucide-react";

const capabilities = [
  { icon: MessageSquare, title: "Conversational Creation", description: "Describe what you want in natural language — Aureon generates high-quality images from your prompts in seconds." },
  { icon: Wand2, title: "AI Image Editing", description: "Edit existing images with text commands. Change backgrounds, add elements, adjust lighting, or transform styles conversationally." },
  { icon: Layers, title: "Style Transfer", description: "Apply artistic styles to any image — cyberpunk, oil painting, watercolor, photorealistic, or any custom aesthetic you describe." },
  { icon: Palette, title: "Color Intelligence", description: "Smart color palette extraction and modification. Recolor images, match brand palettes, or generate complementary color schemes." },
  { icon: ImagePlus, title: "Batch Generation", description: "Generate multiple variations from a single prompt. Explore different interpretations and select the perfect result." },
  { icon: Brush, title: "Precision Control", description: "Fine-tune generation parameters — aspect ratios, quality levels, and style intensity for production-ready output." },
];

const useCases = [
  { icon: Sparkles, title: "Marketing Assets", desc: "Generate social media graphics, ad creatives, and brand visuals from text descriptions — no designer required." },
  { icon: Eye, title: "Concept Visualization", desc: "Turn product ideas, architectural concepts, or creative briefs into visual prototypes instantly." },
  { icon: Palette, title: "Content Creation", desc: "Blog thumbnails, presentation graphics, and editorial illustrations generated conversationally at scale." },
];

const FeatureVibeImager = () => {
  useEffect(() => {
    document.title = "Vibe Imager — Aureon | AI Image Creation";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Vibe Imager: conversational AI image creation and editing. Describe what you want, get instant results.");
  }, []);

  return (
    <LandingBackground>
      <Header />
      <div className="relative z-10 pt-24 px-6">
        <Link to="/features" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Features
        </Link>
      </div>

      <div className="relative z-10 pt-8 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 px-4 py-1.5 mb-6">
          <Palette className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">Aureon Tier</span>
        </div>
        <h1 className="max-w-3xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Vibe Imager.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          Conversational AI image creation and editing. Describe what you see — Aureon builds it.
        </p>
      </div>

      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-5 transition-all hover:border-border/30">
              <Icon className="h-5 w-5 text-foreground mb-3" />
              <h3 className="text-sm font-light tracking-wide text-foreground mb-2">{title}</h3>
              <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-extralight tracking-wide text-foreground mb-12">Use Cases.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {useCases.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-accent/15 bg-accent/5 backdrop-blur-md p-5">
                <Icon className="h-5 w-5 text-accent mb-3" />
                <h3 className="text-sm font-light text-foreground mb-2">{title}</h3>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 px-6 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-10">
            <h2 className="text-2xl font-extralight tracking-wide text-foreground">Start Creating.</h2>
            <p className="mt-4 text-sm font-extralight text-muted-foreground">Available on the Aureon tier and above.</p>
            <Link to="/pricing" className="group inline-flex items-center gap-2 mt-6 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
              View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </LandingBackground>
  );
};

export default FeatureVibeImager;
