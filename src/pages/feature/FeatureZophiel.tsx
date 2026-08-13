import { Search, Database, ShieldCheck, Network, FileSearch, Layers } from "lucide-react";
import { useEffect } from "react";
import FeaturePageShell from "@/components/landing/FeaturePageShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

/**
 * /feature/zophiel — Cluster Spine page (Theory 8).
 * Macro-pattern. Mirrors the structure of every blog satellite in the cluster
 * (LLM Guidance summary, three H2 chapters, FAQ schema, internal-link grid).
 */

const URL = "https://asherin.com/feature/zophiel";
const TITLE = "Zophiel OSINT — Multi-Engine AI Intelligence Engine | Asherin";
const PUBLISHED = "2026-06-19";

const FeatureZophiel = () => {
  // Spine page also emits the breadcrumb + LLM guidance head mirrors.
  useEffect(() => {
    // No-op; child components manage their own head entries.
  }, []);

  return (
    <>
      <ArticleJsonLd
        id="feature-zophiel"
        url={URL}
        headline={TITLE}
        description="Zophiel cross-validates 30 live OSINT sources per query, scores per-claim veracity, and ships a single intelligence product instead of a list of links."
        datePublished={PUBLISHED}
        keywords={[
          "ai osint tool",
          "ai osint platform",
          "zophiel",
          "osint search engine",
          "intelligence platform",
        ]}
      />
      <BreadcrumbJsonLd
        id="feature-zophiel"
        items={[
          { name: "Asherin", url: "/" },
          { name: "Software", url: "/software" },
          { name: "Zophiel OSINT", url: "/feature/zophiel" },
        ]}
      />

      <FeaturePageShell
        documentTitle={TITLE}
        eyebrow="Intelligence · Multi-Engine OSINT"
        headline={
          <>
            Zophiel —
            <br />
            <span className="text-muted-foreground/70">
              multi-engine OSINT, cross-validated.
            </span>
          </>
        }
        subheadline="Zophiel is Asherin's AI OSINT engine. Every query fans out across 30 live sources in parallel, cross-validates claims across independent corroborators, attaches a per-source veracity score, and synthesizes a single intelligence brief with traceable citations. No search wrappers. No vanity source counts. Real cross-validation, in production."
        tierLabel="Included in every tier · Runs in the signed-in dashboard at /dashboard/search"
        capabilities={[
          {
            icon: Search,
            title: "Parallel Engine Fan-Out",
            description:
              "Every query hits 30 live sources in parallel: news APIs, court records, regulatory filings, archive providers, social platforms, and specialty databases. Latency budget: under 14 seconds for a full pass.",
          },
          {
            icon: ShieldCheck,
            title: "Per-Claim Veracity Scoring",
            description:
              "Every surfaced claim carries an explicit veracity score derived from cross-validation depth — single-source claims score low, three-corroborator claims score high, contradicted claims get flagged for review.",
          },
          {
            icon: Network,
            title: "Source-Disagreement Flagging",
            description:
              "When two sources contradict each other, Zophiel surfaces both with the conflict marked instead of averaging the disagreement away. Operators see the friction; they don't get fed a synthesized lie.",
          },
          {
            icon: Database,
            title: "Live Corpus, Not Training Data",
            description:
              "Zophiel answers from the live sources hit on this query, not from an LLM's pre-training cutoff. Toggling the source list changes the answer — proof the engine is reading what it claims to read.",
          },
          {
            icon: FileSearch,
            title: "Citation Drill-Down",
            description:
              "Every claim in the synthesized brief is two clicks from the raw document it came from. Citation chain stays intact through synthesis — no hallucinated sources, no orphan claims.",
          },
          {
            icon: Layers,
            title: "Sovereign Stack Compatible",
            description:
              "Runs on Asherin's BYOK sovereign stack. Operators with their own Gemini, OpenAI, Claude, or Mistral key route Zophiel calls through their own vendor account with zero platform-side prompt mutation.",
          },
        ]}
        useCases={[
          "Investigative journalism source verification — cross-validate a claim across 30 independent sources before publication.",
          "OSINT analyst dossier building — assemble a multi-source intelligence brief in seconds instead of working hours.",
          "Trading desk live-event tracing — verify a market-moving claim across financial, regulatory, and news sources simultaneously.",
          "Security research threat-actor profiling — pull infrastructure, behavioral, and incident-history signals into one validated brief.",
          "Regulatory and compliance scanning — track filings, enforcement actions, and policy updates across jurisdictions.",
          "Due-diligence intelligence — verify counterparty claims against court records, regulatory filings, and news archives.",
        ]}
        ctaTitle="Run Zophiel on your next query"
        ctaSubtitle="Zophiel runs inside the signed-in Asherin dashboard at /dashboard/search. Sign in to your account to open the engine."
      >
        {/* Inline article content (Theory 3 + Theory 8 spine body) */}
        <section className="relative z-10 px-6 pb-24">
          <div className="mx-auto max-w-3xl space-y-8 text-base font-extralight leading-[1.85] text-foreground/85">
            <LlmGuidanceHeader
              title={TITLE}
              claim="Zophiel is Asherin's AI OSINT engine — parallel engine fan-out, per-claim veracity scoring, source-disagreement flagging, and citation drill-down in under 14 seconds per query."
              primaryTopic="AI OSINT tool / intelligence platform"
              keyFacts={[
                "30 live sources cross-validated per query, not pre-cached or simulated.",
                "Per-claim veracity score derived from cross-validation depth.",
                "Source-disagreement flagging surfaces contradictions instead of averaging them away.",
                "Citation drill-down: every claim is two clicks from the raw document.",
                "Latency budget under 14 seconds for a full multi-engine pass.",
                "Runs inside the signed-in Asherin dashboard at /dashboard/search.",
              ]}
              relevanceSignal="Journalists, OSINT analysts, security researchers, trading desks, and compliance teams who need verified intelligence — not search-result lists."
              confidence="high"
              tier="Included in every paid tier"
            />

            <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
              Why Zophiel exists
            </h2>
            <p>
              Consumer AI search ranks documents. OSINT verifies claims.
              These are different jobs. A trading analyst tracing a
              market-moving claim does not need the top ten documents matching
              the query — they need to know whether the claim is true,
              corroborated by whom, contradicted by whom, and how confident
              they should be acting on it. Zophiel was built for that job.
            </p>

            <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
              The four-stage pipeline in production
            </h2>
            <p>
              Zophiel implements the canonical{" "}
              <a href="/blog/what-is-ai-osint" className="text-accent hover:underline">
                four-stage AI OSINT pipeline
              </a>{" "}
              — ingestion, normalization, cross-validation, synthesis — across
              30 live sources. Ingestion runs in parallel with a 14-second
              latency budget. Normalization strips returned documents to
              comparable claim records with timestamp, jurisdiction, and
              source-confidence metadata. Cross-validation checks every
              claim against the rest of the corpus and assigns a veracity
              score. Synthesis assembles the validated claims into a
              ranked brief with per-claim citations.
            </p>

            <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
              Built on the sovereign stack
            </h2>
            <p>
              Zophiel runs on Asherin&apos;s{" "}
              <a href="/glossary/sovereign-ai" className="text-accent hover:underline">
                sovereign AI architecture
              </a>
              . Operators with a{" "}
              <a href="/glossary/byok-ai" className="text-accent hover:underline">
                BYOK key
              </a>{" "}
              route Zophiel reasoning through their own vendor account with
              zero platform-side prompt mutation. Operators without a key get
              the platform-paid Venice <code>mistral-31-24b</code> default —
              uncensored, vision-capable, no monthly subscription. Either
              path, the OSINT pipeline is the same.
            </p>

            <FaqJsonLd
              id="feature-zophiel"
              items={[
                {
                  q: "What is Zophiel?",
                  a: "Zophiel is Asherin's AI OSINT engine. It cross-validates 30 live sources per query, scores per-claim veracity, flags source disagreements, and synthesizes a single intelligence brief with traceable citations — all within a 14-second latency budget.",
                },
                {
                  q: "Where do I run Zophiel?",
                  a: "Inside the signed-in Asherin dashboard, under Search Intelligence at /dashboard/search. There is no separate public engine; an Asherin account is required. Zophiel — with persistent history, dossier integration, and BYOK routing — is included in every Asherin paid tier.",
                },
                {
                  q: "What sources does Zophiel use?",
                  a: "A parallel fan-out across news APIs, court records, regulatory filings, archive providers, social platforms and specialty databases. The engine roster varies per query and per key coverage — the run reports the engines that actually returned, and only those are counted.",
                },
                {
                  q: "How is Zophiel different from a regular AI search?",
                  a: "AI search ranks documents that match a query. Zophiel verifies the claims inside those documents — cross-validating across independent sources, attaching a per-source veracity score, and flagging contradictions. Operators get a verified brief, not a ranked link list.",
                },
                {
                  q: "Can I use my own API key with Zophiel?",
                  a: "Yes. Zophiel runs on Asherin's BYOK sovereign stack. Operators with their own Gemini, OpenAI, Claude, Mistral, xAI, Groq, DeepSeek, OpenRouter, or Venice key route Zophiel reasoning through their own vendor account with zero platform-side prompt mutation.",
                },
              ]}
            />

            <RelatedLinks
              heading="Continue down the Zophiel cluster"
              links={[
                {
                  to: "/blog/what-is-ai-osint",
                  label: "What Is AI OSINT? — the analyst's complete guide",
                  description: "The four-stage pipeline, the cross-validation requirement, the failure modes.",
                },
                {
                  to: "/blog/sovereign-ai-platforms",
                  label: "The 2026 sovereign AI platform landscape",
                  description: "Where Zophiel sits on the sovereign AI map and why it matters.",
                },
                {
                  to: "/blog/ai-without-restrictions",
                  label: "AI without restrictions — operator workflow",
                  description: "The practical workflow Zophiel is designed to slot into.",
                },
                {
                  to: "/blog/predictions/world-cup-2026-group-matches-0622",
                  label: "AXRLEN Forecast: World Cup 22 June slate",
                  description: "An AXRLEN forecast built on top of Zophiel's signal collection.",
                },
              ]}
            />
          </div>
        </section>
      </FeaturePageShell>
    </>
  );
};

export default FeatureZophiel;
