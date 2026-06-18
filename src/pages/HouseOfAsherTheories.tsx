import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowLeft, Dna, Brain, Plane, Database, Network, Eye, Heart, Activity, Cpu, Waves, FileCode2, BookOpen, ShieldAlert, Wrench, ArrowRight, Atom, Layers, Target, Sparkles, Trophy } from "lucide-react";

interface Parallel {
  icon: React.ReactNode;
  bio: string;
  tech: string;
  note: string;
}

interface Theory {
  id: string;
  number: string;
  title: string;
  thesis: string;
  body: string;
  parallels: Parallel[];
  diagram?: React.ReactNode;
}


const THEORIES: Theory[] = [
  {
    id: "biotech-soulmates",
    number: "01",
    title: "Human Biology & Technology Are Soulmates",
    thesis:
      "Combining technology with human biology creates next-generational technology. Every breakthrough in machines is, at its core, a quiet imitation of something the body has already perfected over millions of years.",
    body:
      "Our theory: biology and technology are not opposites — they are soulmates. The most advanced systems humans have ever built are reverse-engineered versions of organs, instincts, and neural patterns we already carry inside us. When engineers stop fighting biology and start studying it, the result is a generational leap, not an iteration.",
    parallels: [
      {
        icon: <Plane className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Falcon — silent flight, swept wings, predator silhouette",
        tech: "B-2 Spirit Stealth Bomber",
        note: "The B-2 doesn't just look like a falcon — its airfoil, low radar cross-section, and angle of attack mirror raptor aerodynamics.",
      },
      {
        icon: <Database className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Hippocampus — long-term memory storage and recall",
        tech: "Databases, vector stores, indexed memory",
        note: "Tables, keys, and indexes are a literal externalization of how the brain encodes, indexes, and retrieves memory.",
      },
      {
        icon: <Brain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Neural cortex — weighted synaptic firing patterns",
        tech: "AI thought process / neural networks",
        note: "Backpropagation, weights, and activations are a mathematical mirror of neurotransmitter pathways and synaptic plasticity.",
      },
      {
        icon: <Eye className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Human eye — lens, retina, foveal focus",
        tech: "Cameras, CMOS sensors, computer vision",
        note: "Aperture mimics the iris, focal length mimics accommodation, and convolutional layers mimic the visual cortex's edge detection.",
      },
      {
        icon: <Network className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Nervous system — distributed signal routing",
        tech: "The internet, packet switching, fiber networks",
        note: "Nerves are biological cables; the internet is a planetary nervous system carrying electrical impulses between nodes of consciousness.",
      },
      {
        icon: <Heart className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Heart — rhythmic pressure-driven circulation",
        tech: "Hydraulic pumps, cooling loops, power grids",
        note: "Every centralized distribution system on Earth — water, fuel, electricity — is a re-implementation of a four-chambered pump.",
      },
      {
        icon: <Dna className="h-5 w-5" strokeWidth={1.5} />,
        bio: "DNA — quaternary base-pair information storage",
        tech: "Binary code, error-correcting codes, blockchain",
        note: "DNA is nature's first version-controlled, error-correcting, self-replicating codebase. Git just rediscovered it.",
      },
      {
        icon: <Activity className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Echolocation (bats, dolphins) — pulse return mapping",
        tech: "Radar, sonar, LiDAR",
        note: "Submarines and self-driving cars 'see' the same way a dolphin does — emit a pulse, measure the echo, build a map.",
      },
      {
        icon: <Cpu className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Skin — pressure, temperature, and pain sensors",
        tech: "Touchscreens, haptics, IoT sensor arrays",
        note: "Capacitive touch is engineered skin. Haptic feedback is engineered nerve endings.",
      },
      {
        icon: <Waves className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Vocal cords + cochlea — analog wave transduction",
        tech: "Microphones, speakers, codecs, voice AI",
        note: "Every audio chain — diaphragm, signal, transducer — is a mechanical copy of the larynx-to-eardrum pipeline.",
      },
      {
        icon: <Brain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Immune system — pattern recognition of threats",
        tech: "Antivirus, intrusion detection, anomaly AI",
        note: "Signatures, heuristics, and zero-day defense are software T-cells. The body wrote the security playbook first.",
      },
      {
        icon: <Network className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Ant colonies & swarms — emergent collective intelligence",
        tech: "Distributed computing, swarm robotics, mesh networks",
        note: "No central CEO ant — just simple rules producing intelligent behavior. Kubernetes is a colony with YAML.",
      },
    ],
  },
];

const HouseOfAsherTheories = () => {
  useEffect(() => {
    const id = "theories-page-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "House of Asher — Theories",
      url: "https://aureonai.app/houseofasher/theories",
      description:
        "Foundational theories from the House of Asher: where human biology and technology converge into next-generation intelligence.",
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-16">
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            <Dna className="h-3 w-3" strokeWidth={1.5} />
            House of Asher · Theories
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-4xl">
            The theories that shape Aureon.
            <span className="block text-muted-foreground/70">
              Biology is the blueprint. Technology is the echo.
            </span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Every model, system, and architecture inside Aureon is built on a
            foundational theory from the House of Asher. This is the public
            record of those theories.
          </p>
        </header>

        {THEORIES.map((t) => (
          <section
            key={t.id}
            id={t.id}
            aria-label={t.title}
            className="relative rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-12 space-y-10"
          >
            <div className="absolute -left-3 top-12 hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background text-[10px] font-mono tracking-wider text-muted-foreground">
              {t.number}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
                Theory #{t.number}
              </p>
              <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-[1.1]">
                {t.title}
              </h2>
              <p className="text-base sm:text-lg font-extralight text-foreground/85 leading-[1.7] max-w-3xl">
                {t.thesis}
              </p>
              <p className="text-sm sm:text-base font-extralight text-muted-foreground leading-[1.75] max-w-3xl">
                {t.body}
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
                ◈ Biological ↔ Technological Parallels
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {t.parallels.map((p, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl border border-border/30 bg-background/40 p-5 transition-all hover:border-foreground/30 hover:bg-background/60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 h-9 w-9 rounded-full border border-border/40 bg-background flex items-center justify-center text-foreground/80">
                        {p.icon}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground/80">
                            Biology
                          </span>
                          <span className="text-sm font-light text-foreground/90 leading-snug">
                            {p.bio}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground/80">
                            Technology
                          </span>
                          <span className="text-sm font-light text-foreground/90 leading-snug">
                            {p.tech}
                          </span>
                        </div>
                        <p className="pt-2 text-xs font-extralight text-muted-foreground leading-relaxed border-t border-border/20">
                          {p.note}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-dashed border-border/30 bg-background/20 p-8 sm:p-10 text-center space-y-2">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
            ◈ More Theories Incoming
          </p>
          <p className="text-sm font-extralight text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Additional theories from the House of Asher are documented here as
            they are deployed into Aureon.
          </p>
        </section>

        <div>
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Aureon
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default HouseOfAsherTheories;
