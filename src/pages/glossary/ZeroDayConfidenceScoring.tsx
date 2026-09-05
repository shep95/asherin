import ArticleShell from "@/components/seo/ArticleShell";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

const URL = "https://asherin.com/glossary/zero-day-confidence-scoring";
const TITLE = "Zero-Day Confidence Scoring, Definition and Calibration Scale";
const PUBLISHED = "2026-06-19";

const ZeroDayConfidenceScoring = () => (
  <ArticleShell
    eyebrow="Glossary · Definition"
    title="What Is Zero-Day Confidence Scoring?"
    dek="Zero-day confidence scoring is a calibrated 0-100 scale used to triage vulnerability findings that do not match any known CVE. This is the definition, the scoring inputs, the band interpretation, and how Asherin's ZERLAL engine assigns it in practice."
    publishedLabel="Jun 19 2026"
    readTime="6 min"
    backTo={{ to: "/glossary", label: "← Asherin Glossary" }}
  >
    <ArticleJsonLd
      id="zero-day-confidence-scoring"
      url={URL}
      headline={TITLE}
      description="Definitional reference for zero-day confidence scoring, the calibrated 0-100 triage scale for novel vulnerability findings, with band interpretation and scoring inputs."
      datePublished={PUBLISHED}
      keywords={[
        "zero-day confidence scoring",
        "zero day score",
        "vulnerability triage scoring",
        "ai vulnerability scoring",
      ]}
    />
    <BreadcrumbJsonLd
      id="zero-day-confidence-scoring"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Glossary", url: "/glossary" },
        { name: "Zero-Day Confidence Scoring", url: "/glossary/zero-day-confidence-scoring" },
      ]}
    />
    <h2>The definition</h2>
    <p>
      <strong>Zero-day confidence scoring</strong> is a calibrated
      0-100 scale used to triage vulnerability findings that do not
      match any known CVE. The score answers a single question: how
      confident is the engine that this is a real, exploitable, novel
      issue worth a human's attention? It is a triage signal, not a
      severity rating, a high-confidence novel finding can still
      resolve as low-impact, and a low-confidence finding can still be
      worth investigating when context demands.
    </p>

    <h2>The four scoring inputs</h2>
    <ol>
      <li>
        <strong>Pattern novelty.</strong> Does the finding match any
        published CVE, OWASP category, or known-bad pattern? Higher
        novelty raises the score because rule-based scanners cannot
        catch novelty.
      </li>
      <li>
        <strong>Exploitability.</strong> Is there a plausible attacker
        path from a realistic threat model to a sink that matters?
        Findings with a coherent path score higher than abstract
        anti-patterns.
      </li>
      <li>
        <strong>Corroborating signal.</strong> Do independent signals
, runtime telemetry, dependency graph anomalies, related
        findings in adjacent files, reinforce the finding? Multiple
        corroborators raise confidence; a single isolated signal
        lowers it.
      </li>
      <li>
        <strong>Stability across re-scans.</strong> Does the same
        pattern persist when the engine re-evaluates the target? A
        finding that disappears under a re-scan with new context was
        probably a hallucination and gets a confidence penalty.
      </li>
    </ol>

    <h2>Band interpretation</h2>
    <ul>
      <li>
        <strong>90-100 (Critical confidence).</strong> Triage
        immediately. Treat as a candidate zero-day until human review
        either confirms or refutes.
      </li>
      <li>
        <strong>70-89 (High confidence).</strong> Surface to the
        security team's standard triage queue with a 24-72 hour
        review window.
      </li>
      <li>
        <strong>40-69 (Medium confidence).</strong> Flag for analyst
        triage when bandwidth allows. Investigate when a related
        finding or runtime signal corroborates.
      </li>
      <li>
        <strong>0-39 (Low confidence).</strong> Documented in the
        report but does not page the operator. Useful as context
        when neighboring findings escalate.
      </li>
    </ul>

    <h2>What the score is not</h2>
    <p>
      The score is not a severity rating, not a probability of
      exploit-in-the-wild, and not a guarantee. It is a triage signal
      that says &quot;a human's time on this is justified at this
      confidence level.&quot; A high score still requires manual
      confirmation before any disclosure or remediation decision.
      Treating the score as a verdict instead of a triage signal is
      the most common misuse.
    </p>

    <h2>Limitations</h2>
    <p>
      Calibration depends on the access permissions the engine has.
      Read-only repository scans cannot evaluate the
      runtime-corroboration input and so produce scores with a
      systematic ceiling. The score's stability check requires at
      least two scan passes; first-pass scores carry a higher
      uncertainty band and are noted as such in ZERLAL reports.
    </p>

    <FaqJsonLd
      id="zero-day-confidence-scoring"
      items={[
        {
          q: "Is zero-day confidence scoring the same as CVSS?",
          a: "No. CVSS scores severity (how bad the impact is if exploited). Zero-day confidence scoring scores triage confidence (how confident the engine is that this novel finding is real and exploitable). The two are complementary, a high-confidence novel finding can still be triaged for severity using CVSS.",
        },
        {
          q: "What score threshold should I set my alerting on?",
          a: "Industry-typical practice is to page on 90+ and route to standard triage queue on 70-89. Below 70, surface in the report but do not interrupt. Tune to your team's bandwidth and risk appetite.",
        },
        {
          q: "Does Asherin's ZERLAL use this scoring?",
          a: "Yes. ZERLAL assigns a 0-100 zero-day confidence score to every finding that does not match a known CVE, using the four inputs documented here, and reports the score alongside the finding's attack-path graph.",
        },
      ]}
    />

    <RelatedLinks
      links={[
        {
          to: "/feature/zerlal",
          label: "ZERLAL, the scoring in production",
          description: "Asherin's AI vulnerability scanner, scoring novel patterns on the 0-100 scale.",
        },
        {
          to: "/blog/ai-vulnerability-scanning-explained",
          label: "AI vulnerability scanning, explained",
          description: "Where zero-day confidence scoring sits in the broader scanning landscape.",
        },
        {
          to: "/blog/vulnerability-chaining-explained",
          label: "Vulnerability chaining, explained",
          description: "Many chained exploits include at least one novel-pattern link with a confidence score.",
        },
      ]}
    />
  </ArticleShell>
);

export default ZeroDayConfidenceScoring;
