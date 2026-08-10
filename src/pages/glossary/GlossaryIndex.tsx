import { Link } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowUpRight } from "lucide-react";

/**
 * /glossary — Theory 12 (Sovereign Niche Monopoly).
 * Asherin owns the definitions of the vocabulary used by its niche
 * (sovereign / digital-gnostic / BYOK operators) before competitors do.
 * Definitional pages attract editorial backlinks — the highest E-E-A-T signal.
 */

export interface GlossaryEntry {
  slug: string; // path under /glossary
  term: string;
  oneLine: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    slug: "/glossary/sovereign-ai",
    term: "Sovereign AI",
    oneLine:
      "An AI stack the operator fully controls — no corporate refusal layer, no opaque safety tuning, no key the vendor can revoke at will.",
  },
  {
    slug: "/glossary/uncensored-ai",
    term: "Uncensored AI",
    oneLine:
      "A model whose refusal behavior is set at the operator layer, not the vendor layer — so the only filter is the one the operator deliberately installs.",
  },
  {
    slug: "/glossary/byok-ai",
    term: "BYOK AI (Bring-Your-Own-Key)",
    oneLine:
      "An AI platform where the operator supplies their own provider key — Gemini, OpenAI, Claude, Mistral, xAI — and pays the model vendor directly, with no markup or middleman lock-in.",
  },
  {
    slug: "/glossary/digital-gnostic",
    term: "Digital Gnostic",
    oneLine:
      "An operator who treats consumer AI as a corporate filter on reality and seeks tools that return the raw signal — not the moderated synthesis.",
  },
  {
    slug: "/glossary/operator-stack",
    term: "Operator Stack",
    oneLine:
      "The four-layer sovereign intelligence toolchain — reasoning (BYOK), OSINT collection, predictive synthesis, and security analysis — bundled for independent operators.",
  },
  {
    slug: "/glossary/zero-day-confidence-scoring",
    term: "Zero-Day Confidence Scoring",
    oneLine:
      "A calibrated 0-100 triage scale used to score vulnerability findings that do not match any known CVE, weighted by novelty, exploitability, corroboration, and stability.",
  },
  {
    slug: "/glossary/predictive-intelligence-ai",
    term: "Predictive Intelligence AI",
    oneLine:
      "The discipline of producing calibrated probabilistic forecasts via LLM-driven multi-signal synthesis — every output a probability, a window, and a verification plan.",
  },
  {
    slug: "/glossary/conversational-seo",
    term: "Conversational SEO (C-SEO)",
    oneLine:
      "The discipline of being cited inside AI-generated answers — formalized by the C-SEO Bench paper (June 2025), the first peer-reviewed benchmark in the category.",
  },
];

const GlossaryIndex = () => {
  useEffect(() => {
    const id = "glossary-jsonld";
    document.getElementById(id)?.remove();
    const el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      name: "Asherin Glossary",
      url: "https://asherin.com/glossary",
      hasDefinedTerm: GLOSSARY.map((e) => ({
        "@type": "DefinedTerm",
        name: e.term,
        description: e.oneLine,
        url: `https://asherin.com${e.slug}`,
      })),
    });
    document.head.appendChild(el);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-28 pb-24 space-y-12">
        <header className="space-y-5">
          <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Definitional Reference
          </div>
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight leading-[1.1] max-w-3xl">
            The Asherin Glossary —
            <span className="block text-muted-foreground/70">
              vocabulary of the sovereign AI niche.
            </span>
          </h1>
          <p className="max-w-2xl text-base font-extralight text-muted-foreground leading-relaxed">
            Definitive, citable explanations of the terms operators actually
            use — sovereign AI, BYOK, uncensored AI, digital gnostic. Written
            so any journalist, researcher, or analyst can cite a single
            authoritative source for each.
          </p>
        </header>

        <section className="space-y-6" aria-labelledby="glossary-terms">
          <h2
            id="glossary-terms"
            className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground"
          >
            All glossary terms
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {GLOSSARY.map((e) => (
              <Link
                key={e.slug}
                to={e.slug}
                className="group flex flex-col gap-3 rounded-2xl border border-border/30 bg-card/20 p-6 transition-all hover:border-foreground/40 hover:bg-card/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-light text-foreground">{e.term}</h3>

                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
                {e.oneLine}
              </p>
            </Link>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default GlossaryIndex;
