import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { ArrowLeft, ArrowRight, Video, Wand2, MessageSquare, Scissors, Sparkles, Film, Upload, Clapperboard } from "lucide-react";

const capabilities = [
  { icon: MessageSquare, title: "Text-to-Video", description: "Describe a scene in natural language and Aureon generates a video — from cinematic establishing shots to product demos." },
  { icon: Upload, title: "Video Editing", description: "Upload existing footage and edit with text commands. Cut, trim, add effects, change pacing, or transform the visual style." },
  { icon: Scissors, title: "Smart Cuts", description: "AI-powered scene detection and intelligent trimming. Remove dead space, highlight key moments, and create concise edits." },
  { icon: Film, title: "Style & Effects", description: "Apply cinematic filters, color grading, and visual effects through conversational commands — no editing software required." },
  { icon: Wand2, title: "AI Enhancement", description: "Upscale resolution, stabilize footage, remove noise, and enhance lighting with one-click AI processing." },
  { icon: Clapperboard, title: "Project Management", description: "Organize videos into projects. Track edits, maintain versions, and export in multiple formats." },
];

const useCases = [
  { icon: Sparkles, title: "Social Content", desc: "Generate short-form video content for social media — reels, stories, and clips from text prompts." },
  { icon: Video, title: "Product Demos", desc: "Create polished product demonstration videos from descriptions and screenshots without manual editing." },
  { icon: Film, title: "Presentations", desc: "Transform slide decks and reports into engaging video presentations with AI narration and visuals." },
];

const FeatureVibeVideo = () => {
  useEffect(() => {
    document.title = "Vibe Video — Aureon | AI Video Generation";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Vibe Video: AI video generation and editing. Create and edit videos from text prompts.");
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
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 mb-6">
          <Video className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-medium tracking-[0.2em] text-accent uppercase">Pro Tier</span>
        </div>
        <h1 className="max-w-3xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Vibe Video.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          AI video generation and editing — create cinematic content from text prompts or transform existing footage.
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
            <h2 className="text-2xl font-extralight tracking-wide text-foreground">Start Creating Videos.</h2>
            <p className="mt-4 text-sm font-extralight text-muted-foreground">Available on the Pro tier.</p>
            <Link to="/pricing" className="group inline-flex items-center gap-2 mt-6 rounded-xl bg-accent px-8 py-3 text-sm font-light tracking-wide text-accent-foreground hover:bg-accent/90 transition-all">
              View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </LandingBackground>
  );
};

export default FeatureVibeVideo;
