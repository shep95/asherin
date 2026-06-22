import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import AxrlenPredictionBody from "@/components/seo/AxrlenPredictionBody";
import prediction from "@/data/predictions/global-war-watch.json";

const URL = "https://aureonai.app/blog/predictions/global-war-watch";
const TITLE = "AXRLEN Global War Watch: 12-Month Conflict Forecast";
const PUBLISHED = "2026-06-22T15:58:25.892Z";

const PredictionGlobalWarWatch = () => (
  <ArticleShell
    eyebrow="AXRLEN Predictive Engine · Live Output"
    title="Global war watch — AXRLEN 12-month forecast"
    dek="Aureon's AXRLEN engine (NEXUS PRIME) ran a 12-month scenario forecast on the highest-probability new or escalating armed conflicts. The body below is the raw engine output — flashpoints, probability matrix, and named off-ramps."
    publishedLabel="Generated Jun 22 2026 · 15:58:25 UTC by AXRLEN"
    readTime="10 min"
  >
    <ArticleJsonLd
      id="prediction-global-war-watch"
      url={URL}
      headline={TITLE}
      description="AXRLEN 12-month armed-conflict forecast: Ukraine, Taiwan, Middle East, Korea, Africa flashpoints with explicit probabilities."
      datePublished={PUBLISHED}
      keywords={["war prediction 2026", "global conflict forecast", "taiwan war risk", "middle east 2026", "axrlen conflict watch"]}
    />
    <BreadcrumbJsonLd
      id="prediction-global-war-watch"
      items={[
        { name: "Aureon", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: "AXRLEN — Global War Watch", url: "/blog/predictions/global-war-watch" },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="AXRLEN ran a live 12-month scenario forecast on global armed-conflict risk. The full engine output — flashpoints, probability matrix, historical parallels, and NEXUS VERDICT — is rendered in this post."
      primaryTopic="Global armed-conflict probability — 12 month rolling"
      keyFacts={[
        "Engine: AXRLEN — NEXUS PRIME (Aureon Predictive Engine).",
        "Window: 12-month rolling horizon.",
        "Covers Ukraine, Taiwan Strait, Middle East, Korean peninsula, African flashpoints.",
        "Output: 2-3 ranked scenarios with explicit probability weights summing to 100%.",
        "Verification plan with named resolution criteria included.",
      ]}
      relevanceSignal="Sovereign risk desks, journalists, defence operators, and NGOs tracking near-term conflict exposure."
      confidence="medium"
    />

    <AxrlenPredictionBody source={prediction as any} />

    <FaqJsonLd
      id="prediction-global-war-watch"
      items={[
        { q: "Who generated this prediction?", a: "Aureon's AXRLEN engine (NEXUS PRIME). The post renders the raw engine output verbatim." },
        { q: "How often is this re-evaluated?", a: "AXRLEN re-evaluates on a rolling 30-day cadence for short-horizon conflict forecasts. The verification plan inside the post names trigger signals." },
        { q: "Does this include cyber-only conflict?", a: "Cyber-only escalation is treated as a separate vector inside the probability matrix when relevant, not as a primary kinetic scenario." },
      ]}
    />

    <RelatedLinks
      links={[
        { to: "/feature/axrlen", label: "AXRLEN — the predictive engine", description: "The probabilistic scenario engine that generated this post." },
        { to: "/blog/predictions/ww3-2026-2030", label: "AXRLEN — WW3 2026-2030", description: "Five-year companion forecast on great-power conflict." },
        { to: "/blog/predictions/india", label: "AXRLEN — India 2026-2030", description: "Regional trajectory feeding the global conflict model." },
      ]}
    />
  </ArticleShell>
);

export default PredictionGlobalWarWatch;
