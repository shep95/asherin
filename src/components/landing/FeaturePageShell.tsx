import { useEffect, type ElementType } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";


export interface Capability {
  icon: ElementType;
  title: string;
  description: string;
}

export interface FeaturePageShellProps {
  documentTitle: string;
  eyebrow: string;            // "Cyber Intelligence" etc
  headline: React.ReactNode;  // can include <br/> + spans
  subheadline: string;
  tierLabel?: string;         // "Pro, $740/mo" etc
  capabilitiesTitle?: string;
  capabilities: Capability[];
  useCasesTitle?: string;
  useCases: string[];
  ctaTitle: string;
  ctaSubtitle?: string;
  children?: React.ReactNode; // optional architecture diagram slot
}

const FeaturePageShell = ({
  documentTitle,
  eyebrow,
  headline,
  subheadline,
  tierLabel,
  capabilitiesTitle = "Core Capabilities",
  capabilities,
  useCasesTitle = "Operational Use Cases",
  useCases,
  ctaTitle,
  ctaSubtitle = "Available inside the Asherin dashboard.",
  children,
}: FeaturePageShellProps) => {
  useEffect(() => {
    document.title = documentTitle;

    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    const url = `https://asherin.com${path}`;
    const desc = subheadline.length > 160 ? subheadline.slice(0, 157).trimEnd() + "..." : subheadline;

    const upsertMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    upsertMeta(`meta[name="description"]`, "name", "description", desc);
    upsertMeta(`meta[property="og:title"]`, "property", "og:title", documentTitle);
    upsertMeta(`meta[property="og:description"]`, "property", "og:description", desc);
    upsertMeta(`meta[property="og:url"]`, "property", "og:url", url);
    upsertMeta(`meta[name="twitter:title"]`, "name", "twitter:title", documentTitle);
    upsertMeta(`meta[name="twitter:description"]`, "name", "twitter:description", desc);

    let canonical = document.head.querySelector<HTMLLinkElement>(`link[rel="canonical"]`);
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [documentTitle, subheadline]);

  return (
    <LandingBackground>
      <Header />

      <div className="zophiel-aurora-shell">

      <div className="relative z-10 pt-24 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[10px] font-extralight tracking-[0.32em] uppercase text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[78vh] flex-col items-center justify-center px-6 pt-16 text-center">
        <span className="founder-eyebrow mb-8">{eyebrow}</span>

        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-[-0.01em] leading-[1.02] text-foreground">
          {headline}
        </h1>
        <p className="mt-8 max-w-2xl text-base font-extralight leading-[1.75] text-muted-foreground">
          {subheadline}
        </p>
        {tierLabel && (
          <div className="mt-8 rounded-full border border-border/30 bg-card/40 backdrop-blur-xl px-5 py-1.5 shadow-2xl shadow-black/30">
            <span className="text-[10px] font-light tracking-[0.28em] text-muted-foreground uppercase">
              {tierLabel}
            </span>
          </div>
        )}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/pricing"
            className="group flex items-center gap-2 rounded-full bg-foreground px-8 py-3 text-xs font-light tracking-[0.22em] uppercase text-background transition-all hover:bg-foreground/90"
          >
            Get Access <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/software"
            className="rounded-full border border-border/30 bg-card/30 backdrop-blur-md px-8 py-3 text-xs font-light tracking-[0.22em] uppercase text-foreground transition-colors hover:bg-foreground/10"
          >
            All Features
          </Link>
        </div>
      </section>

      {/* Extractable answer + sourced pricing figures for generative engines. */}
      <section className="relative z-10 px-6">
        <div className="mx-auto max-w-3xl">
        </div>
      </section>



      {/* Capabilities */}
      <section className="relative z-10 px-6 py-28 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 01 · Capabilities</span>
            <h2 className="mt-6 text-3xl sm:text-4xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
              {capabilitiesTitle}
            </h2>
            <p className="mt-5 text-sm font-extralight text-muted-foreground/80 max-w-2xl mx-auto leading-[1.75]">
              Every component is designed for forensic-grade output, not demo theatre.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((cap, i) => (
              <div
                key={cap.title}
                className="founder-glass founder-corner rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-7"
              >
                <div className="flex items-center justify-between mb-5">
                  <cap.icon className="h-5 w-5 text-foreground/80" strokeWidth={1.25} />
                  <span className="text-[10px] font-extralight tracking-[0.32em] text-muted-foreground/40 uppercase">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-sm font-light tracking-[0.16em] uppercase text-foreground">
                  {cap.title}
                </h3>
                <div className="mt-2 h-px w-8 bg-foreground/20" />
                <p className="mt-4 text-sm font-extralight leading-[1.75] text-muted-foreground">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {children}

      {/* Use Cases */}
      <section className="relative z-10 px-6 py-28 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <span className="founder-eyebrow mb-6">Chapter · 02 · Deployment</span>
            <h2 className="mt-6 text-3xl sm:text-4xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
              {useCasesTitle}
            </h2>
          </div>
          <div className="founder-glass founder-corner rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12">
            <ul className="space-y-4">
              {useCases.map((uc, i) => (
                <li
                  key={uc}
                  className="flex items-start gap-4 text-sm font-extralight leading-[1.7] text-foreground/85"
                >
                  <span className="mt-0.5 text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/50 tabular-nums shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Check className="h-3.5 w-3.5 mt-1 shrink-0 text-foreground/60" strokeWidth={1.5} />
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-28 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="founder-eyebrow mb-6">Activation</span>
          <h2 className="mt-6 text-3xl sm:text-4xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground mb-5">
            {ctaTitle}
          </h2>
          <p className="text-sm font-extralight text-muted-foreground/80 mb-10 leading-[1.75]">{ctaSubtitle}</p>
          <Link
            to="/pricing"
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-10 py-3.5 text-xs font-light tracking-[0.24em] uppercase text-background transition-all hover:bg-foreground/90"
          >
            View Plans <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-10 text-center">
        <p className="text-[10px] font-extralight tracking-[0.32em] uppercase text-muted-foreground/40">
          © {new Date().getFullYear()} Asherin · All rights reserved
        </p>
      </footer>

      </div>
    </LandingBackground>
  );
};

export default FeaturePageShell;
