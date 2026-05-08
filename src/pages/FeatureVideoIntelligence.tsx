import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { ArrowLeft, ArrowRight, Video, Eye, Brain, AlertTriangle, Shield, BarChart3, ScanLine, Activity } from "lucide-react";

const capabilities = [
  { icon: Eye, title: "Behavioral Analysis", description: "AI-powered detection of micro-expressions, body language cues, and behavioral patterns in video footage." },
  { icon: Brain, title: "Deception Detection", description: "Advanced analysis algorithms that identify inconsistencies in speech patterns, facial movements, and physiological signals." },
  { icon: ScanLine, title: "Frame-by-Frame Analysis", description: "Granular inspection of individual frames with AI annotation of detected behavioral markers and anomalies." },
  { icon: Activity, title: "Sentiment Tracking", description: "Real-time emotional state tracking throughout the video — mapping sentiment shifts, stress indicators, and engagement levels." },
  { icon: BarChart3, title: "Confidence Scoring", description: "Every detection comes with a calibrated confidence score and supporting evidence chain for verification." },
  { icon: Shield, title: "Forensic Reports", description: "Generate detailed analysis reports suitable for professional and investigative contexts with full evidence documentation." },
];

const useCases = [
  { icon: AlertTriangle, title: "Interview Analysis", desc: "Analyze interview recordings for behavioral patterns, stress indicators, and communication style assessment." },
  { icon: Shield, title: "Verification", desc: "Cross-reference video claims against behavioral signals to assess credibility and identify potential inconsistencies." },
  { icon: Eye, title: "Training & Research", desc: "Study communication patterns, body language, and interpersonal dynamics for professional development." },
];

const FeatureVideoIntelligence = () => {
  useEffect(() => {
    document.title = "Video Intelligence — Aureon | Behavioral Analysis";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Video Intelligence: AI-powered behavioral and deception analysis from video uploads.");
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
          Video Intelligence.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          AI-powered behavioral analysis and deception detection — extract intelligence from video that the human eye misses.
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
            <h2 className="text-2xl font-extralight tracking-wide text-foreground">Unlock Video Intelligence.</h2>
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

export default FeatureVideoIntelligence;
