import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Crosshair, Shield, Globe, Users, FileText, Network, Eye,
  ArrowRight, Check, AlertTriangle, Search, BarChart3, ArrowLeft,
} from "lucide-react";

const capabilities = [
  {
    icon: Globe,
    title: "40+ Intelligence Sources",
    description:
      "NOMAD pulls from public records, news archives, social platforms, corporate filings, and domain registries simultaneously.",
  },
  {
    icon: Shield,
    title: "BLUF Executive Summaries",
    description:
      "Every investigation opens with a Bottom Line Up Front summary — the critical intelligence you need, before the deep dive.",
  },
  {
    icon: BarChart3,
    title: "Confidence Scoring",
    description:
      "Every finding receives a 0–100 confidence score based on source correlation, recency, and cross-referencing with known databases.",
  },
  {
    icon: Users,
    title: "Entity Resolution",
    description:
      "Automatically connects aliases, roles, and affiliations. NOMAD maps how people, organizations, and events relate to each other.",
  },
  {
    icon: AlertTriangle,
    title: "Risk Assessment Matrices",
    description:
      "Structured risk scoring across financial, reputational, operational, and legal dimensions with actionable intelligence ratings.",
  },
  {
    icon: FileText,
    title: "Exportable Intelligence Reports",
    description:
      "Every investigation exports as a structured intelligence dossier — ready for board presentations, due diligence files, or compliance records.",
  },
];

const investigations = [
  {
    title: "Corporate Due Diligence",
    desc: "Before a partnership, investment, or acquisition — know who you're dealing with. NOMAD surfaces corporate filings, beneficial ownership, litigation history, and media footprint.",
  },
  {
    title: "Threat & Risk Assessment",
    desc: "Identify emerging risks across geopolitical, financial, and operational vectors. NOMAD's structured output feeds directly into your risk management workflow.",
  },
  {
    title: "People Intelligence",
    desc: "Research executives, key hires, or public figures with multi-source correlation. Digital footprint, professional history, and network mapping — all in one dossier.",
  },
];

const FeatureNomad = () => {
  useEffect(() => {
    document.title = "NOMAD OSINT Agent — Aureon";
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

      {/* Hero */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">OSINT Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          Forensic-Grade
          <br />
          <span className="text-muted-foreground">Intelligence On Demand.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          NOMAD is an autonomous OSINT agent. Feed it a name, company, or topic —
          receive a structured intelligence dossier with confidence scoring and entity resolution.
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

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">How NOMAD Works</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Every investigation follows a structured methodology — multi-source collection, entity resolution, risk assessment, and structured reporting.
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

      {/* Investigation Types */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Investigation Types
          </h2>
          <div className="space-y-6">
            {investigations.map((inv) => (
              <div key={inv.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40">
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{inv.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{inv.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Intelligence That Moves At Your Speed.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Pro and Advisor plans.</p>
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

export default FeatureNomad;
