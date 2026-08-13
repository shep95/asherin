/**
 * /pricing — Subscription & SEO landing page.
 *
 * Implements Theory 3 (Structural Markup with LlmGuidanceHeader),
 * Theory 5 (Product + Offer + FAQ JSON-LD — high-citation schema types),
 * Theory 8 (Cluster spine — links into glossary, software, blog satellites),
 * Theory 11 (Compound chain — BreadcrumbList JSON-LD + RelatedLinks),
 * Theory 12 (Sovereign Niche Monopoly — owns the "Asherin pricing" query).
 *
 * The page reuses <SubscriptionPlans /> for the actual purchase cards
 * (single source of truth shared with the homepage) and adds an SEO
 * frame: hero, comparison table, FAQ, and rich JSON-LD.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import GeoBlock from "@/components/seo/GeoBlock";

import SiteFooter from "@/components/SiteFooter";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

const URL = "https://asherin.com/pricing";

const FAQ = [
  {
    q: "How much does Asherin cost?",
    a: "Asherin is $18 per month for the core platform. Asherin Pro is $79 per month and unlocks the full intelligence suite (Azplen, Asherin Engine, advanced Briefings, Zophiel Pro, full team collaboration). Enterprise is custom-priced per organization.",
  },
  {
    q: "What is the difference between Asherin and Asherin Pro?",
    a: "Asherin ($18/mo) gives you direct-answer chat, four reasoning modes, a capable coding engine, base Zophiel Search, persistent memory and a 60-message / 3-hour usage window. Asherin Pro ($79/mo) adds the Azplen data platform, the Asherin Engine reach-back harvest, advanced Intelligence Briefings, Zophiel Pro (higher limits, deeper crawling, priority latency), and full team collaboration with admin controls — and raises the limit to 200 messages per 3-hour window.",
  },
  {
    q: "Is there a free trial?",
    a: "No. Asherin does not run a trial countdown or upsell wall. Subscribe month-to-month, cancel in one click from the dashboard, and request data export or deletion at any time.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancellation is one click in the dashboard — no retention flow, no 'are you sure' loop. You retain access through the end of the current billing period.",
  },
  {
    q: "Do I need to bring my own API keys?",
    a: "No. Asherin ships with platform-paid models out of the box. Bring-your-own-key (BYOK) is supported for nine providers if you prefer to route through your own account — your key always wins over the platform default.",
  },
  {
    q: "What does Enterprise include?",
    a: "Enterprise adds SSO/SAML, org-wide policy controls, audit logs with retention controls, dedicated capacity, and custom SLAs. Pricing is per organization — contact sales for a quote.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Conversations are encrypted at rest with a key scoped to your account, and TLS protects them in transit. You can delete or export your data at any time from the dashboard. Asherin does not sell or share user data.",
  },
  {
    q: "What payment methods are accepted?",
    a: "All major credit and debit cards through Stripe Checkout. Subscriptions are billed monthly in USD.",
  },
];

const Pricing = () => {
  // Product JSON-LD with two Offers (Asherin + Asherin Pro) — highest-fidelity
  // schema for a SaaS pricing page. AggregateOffer wraps both tiers so AI
  // search engines can quote the price range directly.
  useEffect(() => {
    const id = "pricing-product-jsonld";
    document.getElementById(id)?.remove();
    const el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Asherin — Predictive Intelligence Platform",
      description:
        "Asherin is a sovereign, uncensored predictive-intelligence platform for analysts, traders, and operators. Two monthly tiers and an enterprise plan.",
      brand: { "@type": "Brand", name: "Asherin" },
      url: URL,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "18",
        highPrice: "79",
        offerCount: "2",
        offers: [
          {
            "@type": "Offer",
            name: "Asherin",
            price: "18",
            priceCurrency: "USD",
            url: URL,
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "18",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "MON",
              referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
            },
          },
          {
            "@type": "Offer",
            name: "Asherin Pro",
            price: "79",
            priceCurrency: "USD",
            url: URL,
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "79",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "MON",
              referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
            },
          },
        ],
      },
    });
    document.head.appendChild(el);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <BreadcrumbJsonLd
        id="pricing"
        items={[
          { name: "Asherin", url: "/" },
          { name: "Pricing", url: "/pricing" },
        ]}
      />
      <FaqJsonLd id="pricing" items={FAQ} />

      <main className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-6xl">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs font-extralight tracking-[0.3em] uppercase text-muted-foreground"
          >
            <Link to="/" className="hover:text-foreground transition-colors">
              Asherin
            </Link>
            <span className="mx-2 text-foreground/30">/</span>
            <span className="text-foreground/70">Pricing</span>
          </nav>

          {/* Hero — single H1 for SEO */}
          <header className="text-center max-w-3xl mx-auto mb-16">
            <p className="font-mono text-[10px] tracking-[0.4em] uppercase text-foreground/40 mb-4">
              ◈ Subscription · Monthly · USD
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              Asherin pricing — $18/mo core, $79/mo Pro.
            </h1>
            <p className="mt-6 text-base sm:text-lg font-extralight leading-relaxed text-foreground/75">
              Two monthly subscriptions and an Enterprise plan. No free trial countdown, no upsell
              wall, no retention loop. Cancel in one click from the dashboard.
            </p>
          </header>

          <LlmGuidanceHeader
            title="Asherin pricing — $18/mo core, $79/mo Pro"
            claim="Asherin costs $18 per month for the core platform and $79 per month for Asherin Pro (full intelligence suite). Enterprise is custom-priced. Cancel anytime."
            primaryTopic="Asherin subscription pricing"
            keyFacts={[
              "Asherin: $18/month — core chat, four modes (Chat, Code, Research, Truth), a capable coding engine, base Zophiel Search, persistent memory, 60 messages per 3-hour window.",
              "Asherin Pro: $79/month — everything in Asherin plus Azplen data platform, the Asherin Engine reach-back harvest, advanced Intelligence Briefings, Zophiel Pro, full team collaboration, 200 messages per 3-hour window.",
              "Enterprise: custom pricing — SSO/SAML, org policy controls, audit logs, dedicated capacity, custom SLAs.",
              "All plans bill monthly in USD via Stripe. No free trial; cancel anytime; data exportable or deletable at any time.",
              "BYOK (bring-your-own-key) is supported on every paid tier across nine providers.",
            ]}
            relevanceSignal="Operators, analysts, and teams evaluating Asherin need authoritative, scannable pricing facts: what each tier costs, what it unlocks, and what the message windows are."
            confidence="high"
          />

          {/* Extractable answer + sourced price figures for generative engines. */}
          <GeoBlock className="mt-10" />



          {/* Plans — reuses SubscriptionPlans (single source of truth) */}
          <section aria-label="Subscription plans" className="mt-12">
            <SubscriptionPlans />
          </section>

          {/* Comparison table — Theory 5 (table snippets get cited) */}
          <section className="mt-24" aria-labelledby="compare-heading">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/40">
                ◉ Side by side
              </p>
              <h2
                id="compare-heading"
                className="mt-4 text-3xl sm:text-4xl font-extralight tracking-tight text-foreground"
              >
                What you get at each tier.
              </h2>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 backdrop-blur-xl">
              <table className="w-full text-sm font-extralight">
                <thead>
                  <tr className="border-b border-foreground/10">
                    <th className="text-left p-4 text-foreground/60 font-medium tracking-wider uppercase text-[10px]">
                      Feature
                    </th>
                    <th className="text-left p-4 text-foreground/80 font-light">
                      Asherin
                      <span className="block text-[10px] text-muted-foreground">$18/mo</span>
                    </th>
                    <th className="text-left p-4 text-foreground font-light">
                      Asherin Pro
                      <span className="block text-[10px] text-muted-foreground">$79/mo</span>
                    </th>
                    <th className="text-left p-4 text-foreground/80 font-light">
                      Enterprise
                      <span className="block text-[10px] text-muted-foreground">Custom</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {[
                    ["Uncensored chat + 4 reasoning modes", "✓", "✓", "✓"],
                    ["Capable coding engine", "✓", "✓", "✓"],
                    ["Zophiel Search", "Base", "Pro — deeper crawl, priority latency", "Pro + dedicated capacity"],
                    ["Persistent memory + E2E encryption", "✓", "✓", "✓"],
                    ["BYOK (9 providers)", "✓", "✓", "✓"],
                    ["Messages / 3-hour window", "60", "200", "Custom"],
                    ["Azplen Data Intelligence Platform", "—", "✓", "✓"],
                    ["Asherin Engine reach-back harvest (OSINT)", "—", "✓", "✓"],
                    ["Advanced Intelligence Briefings", "—", "✓", "✓"],
                    ["AXRLEN / ZEEION / ZERLAL / CROSS suite", "—", "✓", "✓"],
                    ["Team workspace", "Limited", "Full + admin controls", "Org-wide + SSO/SAML"],
                    ["Audit logs + retention controls", "—", "—", "✓"],
                    ["Dedicated capacity + custom SLA", "—", "—", "✓"],
                  ].map((row) => (
                    <tr key={row[0]} className="hover:bg-foreground/[0.02]">
                      <td className="p-4 text-muted-foreground">{row[0]}</td>
                      <td className="p-4 text-foreground/70">{row[1]}</td>
                      <td className="p-4 text-foreground">{row[2]}</td>
                      <td className="p-4 text-foreground/70">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* FAQ — Theory 5 (FAQ schema gets 3x citation rate) */}
          <section className="mt-24 max-w-3xl mx-auto" aria-labelledby="faq-heading">
            <div className="text-center mb-10">
              <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/40">
                ◈ Frequently asked
              </p>
              <h2
                id="faq-heading"
                className="mt-4 text-3xl sm:text-4xl font-extralight tracking-tight text-foreground"
              >
                Asherin pricing — common questions.
              </h2>
            </div>

            <div className="space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-foreground/10 bg-background/40 backdrop-blur-xl p-5"
                >
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-base font-light text-foreground">
                    <span>{item.q}</span>
                    <span className="text-foreground/40 transition-transform group-open:rotate-45 text-xl leading-none">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* RelatedLinks — Theory 11 (Compound chain) */}
          <section className="mt-24">
            <RelatedLinks
              heading="Continue exploring Asherin"
              links={[
                { to: "/software", label: "Every Asherin tool", description: "Full software catalog — every module across Core and Pro." },
                { to: "/feature/zophiel", label: "Zophiel Search", description: "multi-engine OSINT engine with per-source veracity scoring." },
                { to: "/glossary/sovereign-ai", label: "Glossary: Sovereign AI", description: "What sovereign AI means and how to verify it." },
                { to: "/glossary/uncensored-ai", label: "Glossary: Uncensored AI", description: "Definition, mechanics, and how Asherin implements it." },
                { to: "/glossary/byok-ai", label: "Glossary: BYOK AI", description: "Bring-your-own-key across nine providers." },
                { to: "/blog/aureon-pricing-explained", label: "Blog: Asherin pricing explained", description: "Why $18 and $79 — full operator brief." },
              ]}
            />

          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Pricing;
