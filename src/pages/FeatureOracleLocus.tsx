import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  MapPin, Eye, Crosshair, Users, Shield, Globe,
  ArrowRight, Check, ArrowLeft, Cpu, Compass, Target, Search, Camera,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Crosshair,
    title: "Precision Geolocation",
    description:
      "Upload any image and Imagine Intelligence pinpoints the exact coordinates using a two-pass analysis — coarse regional identification followed by fine-grained estimation with error radius.",
  },
  {
    icon: Users,
    title: "Facial Intelligence",
    description:
      "Cross-reference facial biometrics against open-source intelligence databases. Locate matching profiles and lookalikes in any target region worldwide.",
  },
  {
    icon: Compass,
    title: "Temporal Analysis",
    description:
      "Estimate the time of day, season, and sun position from shadow analysis. Determine when a photo was taken without metadata.",
  },
  {
    icon: Eye,
    title: "Person Movement Tracking",
    description:
      "Detect individuals in images and determine their facing direction, travel trajectory, and orientation relative to landmarks.",
  },
  {
    icon: Target,
    title: "Multi-Pass Refinement",
    description:
      "Each analysis runs through iterative refinement — macro region identification, feature extraction, and coordinate triangulation for maximum accuracy.",
  },
  {
    icon: Shield,
    title: "Calibration Feedback Loop",
    description:
      "Verify results as correct or incorrect. Every verification improves the model's accuracy for your specific use cases over time.",
  },
];

const useCases = [
  "Geolocating assets and infrastructure from satellite or ground imagery",
  "Cross-referencing facial profiles across regions for investigative leads",
  "Verifying the origin and timestamp of submitted visual evidence",
  "Tracking movement patterns through sequential image analysis",
  "Mapping regional demographics via open-source facial intelligence",
];

const FeatureOracleLocus = () => {
  useEffect(() => {
    document.title = "Imagine Intelligence — Aureon";
  }, []);

  return (
    <LandingBackground>
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Geo & Facial Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Every Image Has
          <br />
          <span className="text-muted-foreground">A Location. We Find It.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Imagine Intelligence is a dual-mode intelligence engine — pinpoint geographic coordinates from any image, or cross-reference facial biometrics across global open-source databases.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/pricing" className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/features" className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5">
            All Features
          </Link>
        </div>
      </section>

      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Two intelligence modules in one interface — geolocation from visual evidence and facial cross-referencing across any target region.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40 hover:bg-card/30">
                <cap.icon className="h-6 w-6 text-foreground/80 mb-4" />
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{cap.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AgentArchitectureDiagram
        title="Imagine Intelligence Architecture"
        subtitle="A dual-mode intelligence pipeline combining precision geolocation with facial biometric cross-referencing across global open-source databases."
        layers={[
          {
            label: "Input Layer",
            nodes: [
              { id: "i1", label: "Image Ingestion", sublabel: "Upload, paste, or drag-drop any image", type: "input", icon: Camera },
              { id: "i2", label: "Target Selector", sublabel: "Geo mode or Face Intel mode", type: "input", icon: Target },
            ],
          },
          {
            label: "Analysis Engine",
            nodes: [
              { id: "a1", label: "Feature Extraction", sublabel: "Landmarks, architecture, vegetation, signage", type: "agent", icon: Search, accent: "text-accent/70" },
              { id: "a2", label: "Biometric Processor", sublabel: "128D facial vector extraction", type: "agent", icon: Users, accent: "text-accent/70" },
              { id: "a3", label: "Temporal Analyzer", sublabel: "Shadow & sun position analysis", type: "agent", icon: Compass, accent: "text-accent/70" },
            ],
          },
          {
            label: "Intelligence Core",
            nodes: [
              { id: "e1", label: "Coordinate Triangulation", sublabel: "Multi-pass refinement with error radius", type: "engine", icon: Crosshair, accent: "text-accent/60" },
              { id: "e2", label: "OSINT Cross-Reference", sublabel: "Web search + image database matching", type: "engine", icon: Globe, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Location Report", sublabel: "Coordinates, confidence, address estimate", type: "output", icon: MapPin },
              { id: "o2", label: "Match Profiles", sublabel: "Ranked facial matches with sources", type: "output", icon: Users },
              { id: "o3", label: "Calibration", sublabel: "User verification feedback loop", type: "output", icon: Cpu },
            ],
          },
        ]}
        features={["two-pass analysis", "facial intelligence", "temporal estimation", "calibration loop", "OSINT sourced"]}
      />

      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Who Uses Imagine Intelligence?
          </h2>
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            <ul className="space-y-4">
              {useCases.map((uc) => (
                <li key={uc} className="flex items-start gap-3 text-sm font-extralight text-foreground/80">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/60" />
                  {uc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          See What Others Miss.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Pro and Enterprise plans.</p>
        <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">© {new Date().getFullYear()} Aureon. All rights reserved.</p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureOracleLocus;
