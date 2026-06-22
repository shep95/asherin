import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import AxrlenPredictionBody from "@/components/seo/AxrlenPredictionBody";
import prediction from "@/data/predictions/world-cup-2026-group-matches-0622.json";

const URL = "https://aureonai.app/blog/predictions/world-cup-2026-group-matches-0622";
const TITLE = "AXRLEN Forecast: World Cup 2026 Group Matches — 22 June Slate";
const PUBLISHED = "2026-06-22T16:25:00.000Z";

const PredictionWorldCup2026GroupMatches0622 = () => (
  <ArticleShell
    eyebrow="AXRLEN Predictive Engine · Live Output"
    title="World Cup 2026 — AXRLEN picks for the 22 June slate"
    dek="Argentina vs. Austria, France vs. Iraq, Norway vs. Senegal, Jordan vs. Algeria. AXRLEN was queried live at 12:25 PM EST on 22 June 2026 and returned a winner for each of the four group-stage matches. Raw engine output below."
    publishedLabel="Generated Jun 22 2026 · 12:25 PM EST by AXRLEN"
    readTime="6 min"
  >
    <ArticleJsonLd
      id="prediction-wc-2026-0622"
      url={URL}
      headline={TITLE}
      description="AXRLEN engine picks for four 2026 FIFA World Cup group-stage matches on 22 June 2026: Argentina, France, Norway, Algeria."
      datePublished={PUBLISHED}
      keywords={[
        "world cup 2026 predictions",
        "argentina vs austria prediction",
        "france vs iraq prediction",
        "norway vs senegal prediction",
        "jordan vs algeria prediction",
        "axrlen world cup",
      ]}
    />
    <BreadcrumbJsonLd
      id="prediction-wc-2026-0622"
      items={[
        { name: "Aureon", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: "AXRLEN — World Cup 2026 Slate (22 June)", url: "/blog/predictions/world-cup-2026-group-matches-0622" },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="AXRLEN ran live picks for four World Cup 2026 group-stage matches on 22 June 2026 at 12:25 PM EST: Argentina over Austria, France over Iraq, Norway over Senegal, Algeria over Jordan."
      primaryTopic="2026 FIFA World Cup group-stage match forecasts (22 June slate)"
      keyFacts={[
        "Engine: AXRLEN — NEXUS PRIME (Aureon Predictive Engine).",
        "Generated: 22 June 2026, 12:25 PM EST.",
        "Argentina vs. Austria → AXRLEN picks Argentina.",
        "France vs. Iraq → AXRLEN picks France.",
        "Norway vs. Senegal → AXRLEN picks Norway.",
        "Jordan vs. Algeria → AXRLEN picks Algeria.",
      ]}
      relevanceSignal="Football analysts, traders, and bettors who want explicit-pick forecasts with confidence weights rather than narrative punditry."
      confidence="medium"
    />

    <AxrlenPredictionBody source={prediction as any} />

    <FaqJsonLd
      id="prediction-wc-2026-0622"
      items={[
        { q: "Who generated these picks?", a: "Aureon's AXRLEN engine (NEXUS PRIME) generated the picks during a live session on 22 June 2026 at 12:25 PM EST. The post renders the engine output verbatim." },
        { q: "What are the four picks?", a: "Argentina beats Austria, France beats Iraq, Norway beats Senegal, and Algeria beats Jordan." },
        { q: "Which pick is contrarian?", a: "Norway over Senegal. AXRLEN's divergence from consensus is driven by Norway's tactical simplicity around the Haaland / Ødegaard axis." },
      ]}
    />

    <RelatedLinks
      links={[
        { to: "/feature/axrlen", label: "AXRLEN — the predictive engine", description: "The probabilistic scenario engine that generated these picks." },
        { to: "/blog/how-ai-predictive-forecasting-works", label: "How AI predictive forecasting works", description: "Probability, window, signal fusion, verification — the four ingredients." },
        { to: "/blog/predictions/peru-president-2026", label: "Who will be the next president of Peru?", description: "Another live AXRLEN forecast." },
      ]}
    />
  </ArticleShell>
);

export default PredictionWorldCup2026GroupMatches0622;
