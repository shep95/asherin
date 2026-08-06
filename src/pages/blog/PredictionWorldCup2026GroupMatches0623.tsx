import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import AxrlenPredictionBody from "@/components/seo/AxrlenPredictionBody";
import prediction from "@/data/predictions/world-cup-2026-group-matches-0623.json";

const URL = "https://asherin.com/blog/predictions/world-cup-2026-group-matches-0623";
const TITLE = "AXRLEN Forecast: World Cup 2026 Group Matches — 23 June Slate";
const PUBLISHED = "2026-06-22T21:00:00.000Z";

const PredictionWorldCup2026GroupMatches0623 = () => (
  <ArticleShell
    eyebrow="AXRLEN Predictive Engine · Slate Resolved · 3/4 Hit"
    title="World Cup 2026 — AXRLEN picks for the 23 June slate (final results)"
    dek="Final: AXRLEN went 3/4 on winners. Portugal 5–0 Uzbekistan (hit, exceeded modal), Croatia 1–0 Panama (hit, Budimir 54'), Colombia 1–0 DR Congo (hit, one short of 2–1 modal), England 0–0 Ghana (miss — pre-flagged risk vector). Inside calibration band."
    publishedLabel="Generated Jun 22 2026 · 5:00 PM EST · Final results Jun 24 2026"
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
        { name: "Asherin", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: "AXRLEN — World Cup 2026 Slate (23 June)", url: "/blog/predictions/world-cup-2026-group-matches-0623" },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="AXRLEN picks for four World Cup 2026 group-stage matches on 23 June 2026: Portugal over Uzbekistan, England over Ghana, Croatia over Panama, Colombia over DR Congo."
      primaryTopic="2026 FIFA World Cup group-stage match forecasts (23 June slate)"
      keyFacts={[
        "Engine: AXRLEN — NEXUS PRIME (Asherin Predictive Engine).",
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
        { q: "How did the picks score?", a: "The slate is fully resolved. AXRLEN finished 3/4 on winners. Portugal 5–0 Uzbekistan (pick correct, modal margin exceeded). Croatia 1–0 Panama via Ante Budimir (54') (pick correct, one goal short of the 2–0 modal). Colombia 1–0 DR Congo (pick correct, one goal short of the 2–1 modal). England 0–0 Ghana (pick missed; the result fell into the engine's flagged 'England opens-group under-performs xG' risk vector). The slate landed inside AXRLEN's stated 3/4 calibration band." },
        { q: "Who generated these picks?", a: "Asherin's AXRLEN engine (NEXUS PRIME) generated the picks on 22 June 2026 for the four group-stage matches scheduled on 23 June 2026. The post renders the engine output verbatim and is updated as matches resolve." },
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
