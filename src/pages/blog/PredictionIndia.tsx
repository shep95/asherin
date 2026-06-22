import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import AxrlenPredictionBody from "@/components/seo/AxrlenPredictionBody";
import prediction from "@/data/predictions/india.json";

const URL = "https://aureonai.app/blog/predictions/india-2026-2030";
const TITLE = "AXRLEN Forecast: India 2026-2030 — Economy, Geopolitics, Modi Trajectory";
const PUBLISHED = "2026-06-22T15:58:09.469Z";

const PredictionIndia = () => (
  <ArticleShell
    eyebrow="AXRLEN Predictive Engine · Live Output"
    title="India 2026-2030 — AXRLEN strategic forecast"
    dek="Aureon's AXRLEN engine (NEXUS PRIME) ran a scenario forecast on India's strategic and economic trajectory through 2030. The body below is the raw engine output — growth bands, geopolitical posture, and named off-ramps."
    publishedLabel="Generated Jun 22 2026 · 15:58:09 UTC by AXRLEN"
    readTime="10 min"
  >
    <ArticleJsonLd
      id="prediction-india"
      url={URL}
      headline={TITLE}
      description="AXRLEN engine forecast for India through 2030: growth bands, China–India and Pakistan posture, and political trajectory."
      datePublished={PUBLISHED}
      keywords={["india prediction 2026", "india economy forecast", "modi 2029", "india china border forecast", "axrlen india"]}
    />
    <BreadcrumbJsonLd
      id="prediction-india"
      items={[
        { name: "Aureon", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: "AXRLEN — India 2026-2030", url: "/blog/predictions/india-2026-2030" },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="AXRLEN ran a live multi-scenario forecast on India's economic and geopolitical trajectory through 2030. The full engine output — scenarios, probability matrix, historical parallels, and NEXUS VERDICT — is rendered in this post."
      primaryTopic="India strategic and economic forecast 2026-2030"
      keyFacts={[
        "Engine: AXRLEN — NEXUS PRIME (Aureon Predictive Engine).",
        "Horizon: 2026-2030 (5-year strategic window).",
        "Output: 2-3 ranked scenarios with explicit probability weights.",
        "Covers GDP growth band, BJP/Modi trajectory, China–India LAC posture, Pakistan risk.",
        "Verification plan with a specific resolution date included.",
      ]}
      relevanceSignal="Sovereign analysts, EM investors, supply-chain operators, and policy desks tracking the Indo-Pacific."
      confidence="medium"
    />

    <AxrlenPredictionBody source={prediction as any} />

    <FaqJsonLd
      id="prediction-india"
      items={[
        { q: "Who generated this prediction?", a: "Aureon's AXRLEN engine (NEXUS PRIME). The post renders the raw engine output verbatim." },
        { q: "Does this forecast cover the 2029 Indian general election?", a: "Yes — the political-trajectory scenarios cover the BJP/Modi succession and 2029 cycle conditions." },
        { q: "Does it cover China–India border risk?", a: "Yes — LAC posture and a Pakistan-tail scenario are included as separate risk vectors inside the probability matrix." },
      ]}
    />

    <RelatedLinks
      links={[
        { to: "/feature/axrlen", label: "AXRLEN — the predictive engine", description: "The probabilistic scenario engine that generated this post." },
        { to: "/blog/predictions/ww3-2026-2030", label: "AXRLEN — WW3 2026-2030", description: "Great-power model that this regional forecast feeds." },
        { to: "/blog/predictions/global-war-watch", label: "AXRLEN — global war watch", description: "Shorter-horizon flashpoint companion." },
      ]}
    />
  </ArticleShell>
);

export default PredictionIndia;
