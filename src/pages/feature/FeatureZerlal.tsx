import { ShieldAlert, Activity, GitBranch, Crosshair, Layers, FileWarning } from "lucide-react";
import FeaturePageShell from "@/components/landing/FeaturePageShell";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

/**
 * /feature/zerlal — Cluster Spine (Theory 8).
 * AI vulnerability scanner with exploit chaining and zero-day confidence scoring.
 * Closes Batch 1, item 1 of the Zophiel content roadmap.
 */

const URL = "https://asherin.com/feature/zerlal";
const TITLE = "ZERLAL — AI Vulnerability Scanner with Exploit Chaining | Asherin";
const PUBLISHED = "2026-06-19";

const FeatureZerlal = () => (
  <>
    <ArticleJsonLd
      id="feature-zerlal"
      url={URL}
      headline={TITLE}
      description="ZERLAL is Asherin's AI vulnerability scanner. It chains 2-4 medium-severity findings into critical-severity exploit paths and assigns a zero-day confidence score to every novel finding."
      datePublished={PUBLISHED}
      keywords={[
        "ai vulnerability scanner",
        "ai security scanner",
        "vulnerability chaining",
        "exploit chaining",
        "zero-day confidence scoring",
        "zerlal",
      ]}
    />
    <BreadcrumbJsonLd
      id="feature-zerlal"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Software", url: "/software" },
        { name: "ZERLAL", url: "/feature/zerlal" },
      ]}
    />

    <FeaturePageShell
      documentTitle={TITLE}
      eyebrow="Cyber Intelligence · Vulnerability Engine"
      headline={
        <>
          ZERLAL —
          <br />
          <span className="text-muted-foreground/70">
            AI vulnerability scanner with exploit chaining.
          </span>
        </>
      }
      subheadline="ZERLAL is Asherin's AI vulnerability scanner. It does what legacy SAST/DAST tools refuse to do: it chains 2-4 medium-severity findings into a single critical-severity exploit path, assigns a zero-day confidence score to every novel pattern, and monitors the target continuously instead of running a one-shot scan."
      tierLabel="Asherin Pro — $79/mo · Enterprise on request"
      capabilities={[
        {
          icon: ShieldAlert,
          title: "Exploit Chaining (2-4 → 1)",
          description:
            "ZERLAL collapses 2-4 individually 'low' or 'medium' findings into a single critical-severity exploit path when those findings, combined, are exploitable. Legacy scanners report each in isolation; ZERLAL reports the chain.",
        },
        {
          icon: Crosshair,
          title: "Zero-Day Confidence Scoring",
          description:
            "Every finding that does not match a known CVE is rated on a calibrated 0-100 zero-day-confidence scale. The score reflects pattern novelty, exploitability, and corroborating signal — not vendor marketing.",
        },
        {
          icon: Activity,
          title: "Continuous Monitoring",
          description:
            "ZERLAL re-scans on every commit, dependency update, or runtime change. Findings carry a delta marker so analysts see what is genuinely new since the last pass, not what scrolled by again.",
        },
        {
          icon: GitBranch,
          title: "Attack-Path Graph",
          description:
            "Every chained exploit is rendered as a directed graph: entry point → intermediate findings → critical sink. The graph is exportable and built so a security engineer can replay the same path manually.",
        },
        {
          icon: FileWarning,
          title: "Named-Limitation Reporting",
          description:
            "Every report ships with an explicit limitation block: scan depth, source access scope, false-positive estimate, and the categories ZERLAL did not cover. No quiet gaps.",
        },
        {
          icon: Layers,
          title: "BYOK + Sovereign Stack",
          description:
            "ZERLAL reasoning runs through the operator's own provider key (Gemini, OpenAI, Claude, Mistral, xAI, Groq, DeepSeek, OpenRouter, Venice). Findings never leave the operator's vendor account.",
        },
      ]}
      useCases={[
        "Security research teams chaining low-severity issues into reportable critical findings before disclosure deadlines.",
        "Red teams looking for non-obvious attack paths across application + infrastructure boundaries.",
        "Open-source maintainers continuously monitoring a public repository for novel exploit patterns introduced by dependency changes.",
        "Compliance teams generating defensible vulnerability reports with named limitations and reproducible attack-path graphs.",
        "Independent bug-bounty hunters scoring novel patterns against the zero-day confidence scale before triage.",
        "Internal blue teams correlating runtime telemetry with static findings to surface chains a single-tool scan would miss.",
      ]}
      ctaTitle="Run ZERLAL on a real target"
      ctaSubtitle="ZERLAL ships inside Asherin Pro. Pair it with a BYOK key — findings stay inside your provider account."
    >
      <section className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-3xl space-y-8 text-base font-extralight leading-[1.85] text-foreground/85">
          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Why ZERLAL exists
          </h2>
          <p>
            Legacy SAST and DAST tools were designed to surface known
            patterns: a regex catalog of CVEs, OWASP categories, and
            taint-analysis rules. They produce long lists of low-severity
            noise and miss the most dangerous bugs of all — the ones that
            require <em>combining</em> two or three otherwise-harmless
            findings into a working exploit. ZERLAL was built to do the
            combining. It reads the codebase, the dependency graph, the
            runtime configuration, and the documented behavior of the
            stack, then it asks the question a human attacker would ask:
            <em>which of these tiny issues, taken together, gets me to
            something that matters?</em>
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Vulnerability chaining, in concrete numbers
          </h2>
          <p>
            Across internal benchmarks against public CTF and bug-bounty
            corpora, ZERLAL collapses an average of 2-4 individually
            medium-severity findings into a single critical-severity
            chain. The most common shape is an information disclosure
            finding + an authentication weakness + an unauthenticated
            write endpoint — none of which is catastrophic alone, all of
            which together produce an account-takeover primitive. The
            longer chains (5+ links) are real but rare; ZERLAL reports
            them as separate categories so they are not confused with
            the high-confidence 2-4-link chains the engine specializes in.
            See{" "}
            <a href="/blog/vulnerability-chaining-explained" className="text-accent hover:underline">
              the chaining mechanism explained
            </a>{" "}
            for the full anatomy of a chained exploit.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Zero-day confidence scoring
          </h2>
          <p>
            Every finding that does not map to a known CVE receives a
            score on a calibrated 0-100 zero-day-confidence scale.
            Scoring inputs include pattern novelty (does the finding
            match any public disclosure?), exploitability (is there a
            plausible attacker path?), corroborating signal (do
            independent sources reinforce the finding?), and a stability
            check (does the same pattern persist across re-scans?).
            Scores above 70 are surfaced as candidate zero-days;
            scores between 40 and 70 are flagged for human review. The
            scoring methodology is documented in the dedicated glossary
            entry — see{" "}
            <a href="/glossary/zero-day-confidence-scoring" className="text-accent hover:underline">
              zero-day confidence scoring
            </a>
            .
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Named limitations
          </h2>
          <p>
            Honesty is part of the report. ZERLAL's scan depth is bounded
            by the access permissions granted to the engine — a
            repository scanned with read-only access cannot evaluate
            runtime behavior, and a runtime scan without source access
            cannot evaluate code paths that did not execute during the
            observation window. ZERLAL does not invent findings to fill
            the gap. The limitation block in every report names what was
            not scanned, why, and what false-positive rate the engine
            observed during the run. This is a deliberate Theory-13
            (Benford Authenticity) commitment: a vulnerability scanner
            that never admits a gap is selling marketing, not security.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Where ZERLAL fits in the Asherin stack
          </h2>
          <p>
            ZERLAL is a sibling to{" "}
            <a href="/feature/zophiel" className="text-accent hover:underline">
              Zophiel
            </a>{" "}
            (multi-engine OSINT) and{" "}
            <a href="/feature/axrlen" className="text-accent hover:underline">
              AXRLEN
            </a>{" "}
            (predictive intelligence). Zophiel collects the world's
            signal; AXRLEN forecasts where the signal is going; ZERLAL
            surfaces the structural weakness inside the system being
            studied. The three together form the security-intelligence
            triangle of the{" "}
            <a href="/glossary/operator-stack" className="text-accent hover:underline">
              operator stack
            </a>
            .
          </p>

          <FaqJsonLd
            id="feature-zerlal"
            items={[
              {
                q: "What is ZERLAL?",
                a: "ZERLAL is Asherin's AI vulnerability scanner. It chains 2-4 medium-severity findings into a single critical-severity exploit path, assigns a 0-100 zero-day confidence score to every novel pattern, and monitors targets continuously instead of running a one-shot scan.",
              },
              {
                q: "How is ZERLAL different from a legacy SAST or DAST scanner?",
                a: "Legacy SAST/DAST tools report findings in isolation against a CVE/OWASP rule catalog. ZERLAL combines findings across the codebase, dependency graph, and runtime configuration to surface exploit chains that no individual finding would reveal. It also assigns a calibrated zero-day confidence score to non-CVE patterns and ships an explicit limitation block with every report.",
              },
              {
                q: "What does the zero-day confidence score actually measure?",
                a: "It is a calibrated 0-100 score reflecting pattern novelty, exploitability, corroborating signal, and stability across re-scans. Scores above 70 are surfaced as candidate zero-days for human review. The score is a triage signal, not a guarantee — every score above 70 still requires manual confirmation.",
              },
              {
                q: "Where does my code go when I run a ZERLAL scan?",
                a: "ZERLAL reasoning runs through the operator's own BYOK provider key across nine supported vendors. Code and findings flow through the operator's vendor account, not a shared Asherin proxy. The platform does not retain scan content after the report is delivered.",
              },
              {
                q: "What are ZERLAL's known limitations?",
                a: "Scan depth depends on the access permissions granted to the engine. A read-only repository scan cannot evaluate runtime behavior. A runtime-only scan cannot evaluate code paths that did not execute during the observation window. Every report names what was not scanned, why, and the observed false-positive rate for the run.",
              },
            ]}
          />

          <RelatedLinks
            heading="Continue down the ZERLAL cluster"
            links={[
              {
                to: "/blog/ai-vulnerability-scanning-explained",
                label: "AI vulnerability scanning, explained",
                description: "How AI-driven scanners differ from legacy SAST/DAST and what they actually catch.",
              },
              {
                to: "/blog/vulnerability-chaining-explained",
                label: "Vulnerability chaining — the mechanism",
                description: "Anatomy of a 2-4-link chained exploit and why isolated findings miss it.",
              },
              {
                to: "/glossary/zero-day-confidence-scoring",
                label: "Zero-day confidence scoring — definition",
                description: "The calibrated 0-100 scale ZERLAL uses for novel patterns.",
              },
              {
                to: "/blog/what-is-ai-osint",
                label: "What is AI OSINT?",
                description: "Adjacent intelligence-tooling audience — the four-stage pipeline behind Zophiel.",
              },
            ]}
          />
        </div>
      </section>
    </FeaturePageShell>
  </>
);

export default FeatureZerlal;
