import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield, Atom, Brain, Leaf, Syringe, Pill, Zap, Sparkles, FlaskConical, Dna, Eye, Lock } from "lucide-react";
import Header from "@/components/Header";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const ALLOWED_EMAIL = "ashernewtonx@gmail.com";

const layers = [
  {
    label: "Origin State",
    nodes: [
      { id: "source", label: "The Source", sublabel: "Pure spiritual connection — humanity's original frequency", type: "input" as const, icon: Sparkles, accent: "text-amber-400" },
      { id: "stone-age", label: "Ancient Attunement", sublabel: "Stone-age humans fully attuned to spiritual gifts & higher dimensions", type: "input" as const, icon: Eye, accent: "text-violet-400" },
    ],
  },
  {
    label: "Suppression Layer",
    nodes: [
      { id: "elite", label: "Elite Power Structures", sublabel: "Ruling classes severed humanity from the source through systemic control", type: "agent" as const, icon: Lock, accent: "text-red-400" },
      { id: "food", label: "Chemically Tainted Food", sublabel: "Processed ingredients designed to weaken the body and suppress growth", type: "agent" as const, icon: Leaf, accent: "text-red-400" },
      { id: "vaccines", label: "Mandated Injections", sublabel: "Generational domino effect — dormating spiritual potential across bloodlines", type: "agent" as const, icon: Syringe, accent: "text-red-400" },
      { id: "pills", label: "Pharmaceutical Tampering", sublabel: "Children of specific bloodlines medicated as early as age 7 to halt awakening", type: "agent" as const, icon: Pill, accent: "text-red-400" },
    ],
  },
  {
    label: "Dormation Effect",
    nodes: [
      { id: "dormated", label: "Spiritual Dormation", sublabel: "Lifetime detox attempts fail — gifts remain locked regardless of effort or location", type: "layer" as const, icon: Brain, accent: "text-muted-foreground/60" },
      { id: "bloodlines", label: "Bloodline Variance", sublabel: "Some lineages carry latent matter & energy manipulation — suppressed but not erased", type: "layer" as const, icon: Dna, accent: "text-muted-foreground/60" },
    ],
  },
  {
    label: "Reactivation Protocol",
    nodes: [
      { id: "amazonic", label: "Amazonic Ingredients", sublabel: "Ancient consumable compounds from untouched ecosystems — the detox key", type: "engine" as const, icon: FlaskConical, accent: "text-emerald-400" },
      { id: "formula", label: "Super-Human Formula", sublabel: "Combining ancestral knowledge to reverse generational suppression", type: "engine" as const, icon: Atom, accent: "text-cyan-400" },
    ],
  },
  {
    label: "Awakened Output",
    nodes: [
      { id: "energy", label: "Energy Manipulation", sublabel: "Sentry-class energy projection, absorption, and redirection", type: "output" as const, icon: Zap, accent: "text-amber-400" },
      { id: "matter", label: "Matter Manipulation", sublabel: "Molecular restructuring and transmutation at will", type: "output" as const, icon: Atom, accent: "text-emerald-400" },
      { id: "manifest", label: "Instant Manifestation", sublabel: "Thought-to-reality creation — the ultimate spiritual gift restored", type: "output" as const, icon: Sparkles, accent: "text-violet-400" },
    ],
  },
];

const ProjAureon = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">AUREON</div>
      </div>
    );
  }

  if (!user || user.email !== ALLOWED_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="relative z-10 px-6 pt-32 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-3 py-1 mb-6">
            <Shield className="h-3 w-3 text-accent/60" />
            <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase">
              Classified · Eyes Only
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extralight tracking-wide zophiel-shimmer-text mb-8">
            Proj Aureon
          </h1>

          <div className="space-y-6 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
            <p className="text-lg font-light text-foreground/90 border-l-2 border-accent/30 pl-4">
              People are tuned in at different frequencies — in the modern age, disconnected from a past era of spiritual clarity.
            </p>

            <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-md p-6 sm:p-8 space-y-5">
              <h2 className="text-xs font-light tracking-[0.2em] text-accent/70 uppercase mb-4">Meaning</h2>

              <p>
                People in the Stone Age were far more attuned to the spiritual realm and the Source. They possessed an innate connection to higher dimensions of consciousness that modern humanity has lost.
              </p>

              <p>
                However, those who rose to elite positions of power deliberately severed humanity from this connection. They constructed systems of control — rules, institutions, and structures — designed to keep the population compliant and spiritually dormant.
              </p>

              <p>
                Food has been tainted with chemicals. Injections marketed as cures for manufactured diseases — "vaccines" — have been administered to every generation, creating a domino effect that keeps people dormated, cut off from their spiritual gifts. Pharmaceutical pills offer no genuine healing. In some cases, children from specific bloodlines are placed on medication at the earliest legal age — in America, as young as seven years old. These children are targeted precisely because of their lineage, and the pills are designed to tamper with and weaken the human body, halting spiritual growth and suppressing latent powers. Combined with chemically altered food and mandated injections, the suppression is systematic.
              </p>

              <p>
                Most people go through entire lifetimes — or enough years within a single life — and no matter what they do, no matter where they go in the world, they cannot fully detox their body to unlock these spiritual gifts. Some bloodlines carry the dormated potential for matter manipulation and energy manipulation techniques that remain locked within their DNA.
              </p>

              <p className="text-foreground/90 border-l-2 border-emerald-500/30 pl-4 font-light">
                By combining ancient Amazonic consumable ingredients — compounds from untouched ecosystems that predate the suppression era — we could theoretically create a super-human with access to supernatural abilities. Powers analogous to those depicted in the MCU and comics: <span className="text-accent">The Sentry's</span> energy manipulation, matter manipulation, and instant manifestation gifts. Not fiction. Dormated science.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <AgentArchitectureDiagram
        title="Suppression → Reactivation Architecture"
        subtitle="Mapping the systematic dormation of human spiritual potential and the theoretical pathway to full reactivation through ancestral compounds."
        layers={layers}
        features={[
          "Generational Suppression",
          "Bloodline Targeting",
          "Amazonic Detox Protocol",
          "Energy Manipulation",
          "Matter Restructuring",
          "Instant Manifestation",
        ]}
      />

      {/* Footer */}
      <footer className="px-6 py-12 text-center">
        <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/30 uppercase">
          Proj Aureon · Classified · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};

export default ProjAureon;
