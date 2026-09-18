import ArticleShell from "@/components/seo/ArticleShell";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

const URL = "https://asherin.com/blog/aureon-pricing-explained";
const TITLE = "asherin pricing explained, current plans and boundaries";
const PUBLISHED = "2026-06-19";

const FAQ = [
  { q: "what does asherin cost?", a: "asherin is $18 per month, asherin pro is $79 per month, team is $39 per month plus $24 per member with a two-member minimum, and enterprise is custom." },
  { q: "is there a free trial?", a: "no. asherin does not offer a free trial." },
  { q: "is bringing an api key supported?", a: "yes. saved provider keys are supported. model and image support varies by provider, and the live model picker shows current compatibility." },
  { q: "which page controls if pricing changes?", a: "the live pricing and checkout pages are authoritative if this dated journal article ever differs." },
];

const AureonPricingExplained = () => (
  <ArticleShell
    eyebrow="pricing · current offer"
    title="asherin pricing, without the hidden tiers"
    dek="the current public plans are asherin at $18 monthly, asherin pro at $79 monthly, team at $39 monthly plus $24 per member with a two-member minimum, and enterprise with custom terms. there is no free trial."
    publishedLabel="jun 19 2026 · updated sep 18 2026"
    readTime="6 min"
  >
    <ArticleJsonLd id="aureon-pricing-explained" url={URL} headline={TITLE} description="the current asherin subscription plans, team pricing, enterprise option, and saved-key support." datePublished={PUBLISHED} keywords={["asherin pricing", "asherin pro", "asherin team", "byok ai"]} />
    <BreadcrumbJsonLd id="aureon-pricing-explained" items={[{ name: "asherin", url: "/" }, { name: "journal", url: "/blog" }, { name: "asherin pricing", url: "/blog/aureon-pricing-explained" }]} />
    <FaqJsonLd id="aureon-pricing-explained" items={FAQ} />

    <h2>the four public plans</h2>
    <ul>
      <li><strong>asherin, $18 monthly.</strong> the core individual workspace and included room set shown on the live pricing page.</li>
      <li><strong>asherin pro, $79 monthly.</strong> higher usage plus pro data, cyber, knowledge, analysis, and collaboration surfaces.</li>
      <li><strong>team, $39 monthly plus $24 per member.</strong> a shared workspace with a two-member minimum and administrative controls.</li>
      <li><strong>enterprise, custom.</strong> organization-specific governance, identity, and audit requirements.</li>
    </ul>

    <h2>what the subscription does not promise</h2>
    <p>
      a plan does not make every external source available, remove provider limits, or turn an estimate into a fact. connected-account coverage depends on the permissions you grant. public-source research depends on source availability. image work requires a compatible vision model.
    </p>

    <h2>saved provider keys</h2>
    <p>
      asherin supports saved provider keys. when a compatible saved key is selected, it is preferred for the call you choose to make. provider catalogues and modalities change, so the live picker, not a static article list, is the current record of available models.
    </p>

    <h2>no free trial</h2>
    <p>
      asherin does not offer a free trial. the checkout page shows the price and billing period before purchase. subscription management is available from the signed-in workspace.
    </p>

    <h2>retired names are not plan benefits</h2>
    <p>
      older articles referenced standalone products that have since been consolidated or retired. zaxin, axrlen, zeeion, shepherd, the former ide, and ghost-engine are not current purchasable rooms. the software catalogue and live left navigation define the present product surface.
    </p>

    <RelatedLinks links={[
      { to: "/pricing", label: "current pricing", description: "the authoritative plans and purchase controls." },
      { to: "/software", label: "current software", description: "the public catalogue of available asherin rooms." },
      { to: "/blog/sovereign-ai-platforms", label: "provider choice", description: "how to assess key custody, model coverage, and service dependencies." },
    ]} />
  </ArticleShell>
);

export default AureonPricingExplained;
