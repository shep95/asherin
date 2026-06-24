import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import AxrlenPredictionBody from "@/components/seo/AxrlenPredictionBody";
import prediction from "@/data/predictions/world-cup-2026-group-matches-0623.json";

const URL = "https://aureonai.app/blog/predictions/world-cup-2026-group-matches-0623";
const TITLE = "AXRLEN Forecast: World Cup 2026 Group Matches — 23 June Slate";
const PUBLISHED = "2026-06-22T21:00:00.000Z";

const PredictionWorldCup2026GroupMatches0623 = () => (
  <ArticleShell
    eyebrow="AXRLEN Predictive Engine · Live Output · Results Updating"
    title="World Cup 2026 — AXRLEN picks for the 23 June slate (live results)"
    dek="Portugal vs. Uzbekistan, England vs. Ghana, Panama vs. Croatia, Colombia vs. DR Congo. UPDATE (23 Jun late evening ET): Portugal hit 5–0 (modal margin exceeded), Croatia hit 1–0 (Budimir 54'), England 0–0 Ghana (pick missed). Colombia vs. DR Congo pending late kickoff. Live tracker inside."
    publishedLabel="Generated Jun 22 2026 · 5:00 PM EST · Results updated Jun 23 2026"
    readTime="7 min"
  >
    <ArticleJsonLd
      id="prediction-wc-2026-0623"
      url={URL}
      headline={TITLE}
      description="AXRLEN engine picks for four 2026 FIFA World Cup group-stage matches on 23 June 2026: Portugal, England, Croatia, Colombia."
      datePublished={PUBLISHED}
      keywords={[
        "world cup 2026 predictions",
        "portugal vs uzbekistan prediction",
        "england vs ghana prediction",
        "panama vs croatia prediction",
        "colombia vs dr congo prediction",
        "axrlen world cup 23 june",
      ]}
    />
    <BreadcrumbJsonLd
      id="prediction-wc-2026-0623"
      items={[
        { name: "Aureon", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: "AXRLEN — World Cup 2026 Slate (23 June)", url: "/blog/predictions/world-cup-2026-group-matches-0623" },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="AXRLEN picks for four World Cup 2026 group-stage matches on 23 June 2026: Portugal over Uzbekistan, England over Ghana, Croatia over Panama, Colombia over DR Congo."
      primaryTopic="2026 FIFA World Cup group-stage match forecasts (23 June slate)"
      keyFacts={[
        "Engine: AXRLEN — NEXUS PRIME (Aureon Predictive Engine).",
        "Generated: 22 June 2026, 5:00 PM EST.",
        "Portugal vs. Uzbekistan → AXRLEN picks Portugal.",
        "England vs. Ghana → AXRLEN picks England.",
        "Panama vs. Croatia → AXRLEN picks Croatia.",
        "Colombia vs. DR Congo → AXRLEN picks Colombia.",
      ]}
      relevanceSignal="Football analysts, traders, and bettors who want explicit-pick forecasts with confidence weights rather than narrative punditry."
      confidence="medium"
    />

    <AxrlenPredictionBody source={prediction as any} />

    <FaqJsonLd
      id="prediction-wc-2026-0623"
      items={[
        { q: "How did the picks score?", a: "As of the late evening of 23 June 2026, three of four matches have resolved and AXRLEN is 2/3 on winners. Portugal 5–0 Uzbekistan (pick correct, modal margin exceeded). Croatia 1–0 Panama via Ante Budimir (54') (pick correct, one goal short of the 2–0 modal). England 0–0 Ghana (pick missed; the result fell into the engine's flagged 'England opens-group under-performs xG' risk vector). Colombia vs. DR Congo is the late kickoff and is pending." },
        { q: "Who generated these picks?", a: "Aureon's AXRLEN engine (NEXUS PRIME) generated the picks on 22 June 2026 for the four group-stage matches scheduled on 23 June 2026. The post renders the engine output verbatim and is updated as matches resolve." },
        { q: "What were the four picks?", a: "Portugal beats Uzbekistan, England beats Ghana, Croatia beats Panama, and Colombia beats DR Congo." },
        { q: "Which pick had the lowest pre-match confidence?", a: "Colombia vs. DR Congo at 68%. AXRLEN reads DR Congo's transition threat as more credible than most consensus models." },
        { q: "Which pick had the highest pre-match confidence?", a: "Portugal over Uzbekistan at 84%, driven by the European-club-spine and squad-depth differential. This pick resolved correctly with a 5–0 result." },
      ]}
    />

    <RelatedLinks
      links={[
        { to: "/blog/predictions/world-cup-2026-group-matches-0622", label: "AXRLEN — World Cup 2026 22 June slate", description: "The previous day's slate with live outcome tracking (1/1 resolved correct so far)." },
        { to: "/feature/axrlen", label: "AXRLEN — the predictive engine", description: "The probabilistic scenario engine that generated these picks." },
        { to: "/blog/how-ai-predictive-forecasting-works", label: "How AI predictive forecasting works", description: "Probability, window, signal fusion, verification — the four ingredients." },
      ]}
    />
  </ArticleShell>
);

export default PredictionWorldCup2026GroupMatches0623;
