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
  tierLabel?: string;         // "Pro — $740/mo" etc
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
  ctaSubtitle = "Available inside the Aureon dashboard.",
  children,
}: FeaturePageShellProps) => {
  useEffect(() => {
    document.title = documentTitle;

    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    const url = `https://aureonai.app${path}`;
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

      <div className="relative z-10 pt-24 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
            {eyebrow}
          </span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          {headline}
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          {subheadline}
        </p>
        {tierLabel && (
          <div className="mt-6 rounded-full border border-border/20 bg-card/20 px-4 py-1.5">
            <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground uppercase">
              {tierLabel}
            </span>
          </div>
        )}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
          >
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/features"
            className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
          >
            All Features
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            {capabilitiesTitle}
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Every component is designed for forensic-grade output, not demo theatre.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40 hover:bg-card/30"
              >
                <cap.icon className="h-6 w-6 text-foreground/80 mb-4" />
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">
                  {cap.title}
                </h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {children}

      {/* Use Cases */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            {useCasesTitle}
          </h2>
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            <ul className="space-y-4">
              {useCases.map((uc) => (
                <li
                  key={uc}
                  className="flex items-start gap-3 text-sm font-extralight text-foreground/80"
                >
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/60" />
                  {uc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          {ctaTitle}
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">{ctaSubtitle}</p>
        <Link
          to="/pricing"
          className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
        >
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">
          © {new Date().getFullYear()} Aureon. All rights reserved.
        </p>
      </footer>
    </LandingBackground>
  );
};

export default FeaturePageShell;
