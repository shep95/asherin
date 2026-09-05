/**
 * /pricing — Subscription & SEO landing page.
 *
 *
 * The page reuses <SubscriptionPlans /> for the actual purchase cards
 * (single source of truth shared with the homepage) and adds an SEO
 * frame: hero, comparison table, FAQ, and rich JSON-LD.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";

import SiteFooter from "@/components/SiteFooter";
import SubscriptionPlans from "@/components/SubscriptionPlans";
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
    a: "Asherin ($18/mo) gives you direct-answer chat, four reasoning modes, a capable coding engine, base Zophiel Search, persistent memory and a 60-message / 3-hour usage window. Asherin Pro ($79/mo) adds the Azplen data platform, the Asherin Engine reach-back harvest, advanced Intelligence Briefings, Zophiel Pro (higher limits, deeper crawling, priority latency), and full team collaboration with admin controls, and raises the limit to 200 messages per 3-hour window.",
  },
  {
    q: "How much does Asherin Team cost?",
    a: "Asherin Team is $39 per month for the workspace plus $24 per member per month, minimum 2 seats. Five people cost $39 + (5 x $24) = $159 per month. The owner is billed for every occupied seat including their own; invited members never enter a card and receive Pro-class access for as long as the workspace stays active.",
  },
  {
    q: "Do team members need their own subscription?",
    a: "No. Team access is inherited from membership. While the workspace is billing-active, every member and the owner work at Pro-class limits. If someone also holds a personal $18 or $79 plan, their subscription page shows that they are covered by the team, they can cancel the personal plan themselves.",
  },
  {
    q: "Is there a free trial?",
    a: "No. Asherin does not run a trial countdown or upsell wall. Subscribe month-to-month, cancel in one click from the dashboard, and request data export or deletion at any time.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancellation is one click in the dashboard, no retention flow, no 'are you sure' loop. You retain access through the end of the current billing period.",
  },
  {
    q: "Do I need to bring my own API keys?",
    a: "No. Asherin ships with platform-paid models out of the box. Bring-your-own-key (BYOK) is supported for nine providers if you prefer to route through your own account, your key always wins over the platform default.",
  },
  {
    q: "What does Enterprise include?",
    a: "Enterprise adds SSO/SAML, org-wide policy controls, audit logs with retention controls, dedicated capacity, and custom SLAs. Pricing is per organization, contact sales for a quote.",
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
      name: "asherin",
      description:
        "asherin: chat with sources, files, maps, and a vault. $18/mo, or $79/mo for Pro. Team workspaces are billed to the owner.",
      brand: { "@type": "Brand", name: "Asherin" },
      url: URL,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "18",
        highPrice: "159",
        offerCount: "3",
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
          {
            "@type": "Offer",
            name: "Asherin Team",
            description:
              "Company workspace: $39/month plus $24 per member per month, minimum 2 seats. Example: 5 people = $159/month.",
            price: "159",
            priceCurrency: "USD",
            url: URL,
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "24",
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

          {/* Hero, single H1 for SEO */}
          <header className="text-center max-w-3xl mx-auto mb-16">
            <p className="font-mono text-[10px] tracking-[0.4em] uppercase text-foreground/40 mb-4">
              monthly · usd
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              asherin pricing, $18/mo, $79/mo pro.
            </h1>
            <p className="mt-6 text-base sm:text-lg font-extralight leading-relaxed text-foreground/75">
              two personal plans, a team workspace billed to the owner, and enterprise. there is no free
              trial. cancel in one click from the dashboard.
            </p>
          </header>
          {/* Extractable answer + sourced price figures for generative engines. */}
          {/* Plans, reuses SubscriptionPlans (single source of truth) */}
          <section aria-label="Subscription plans" className="mt-12">
            <SubscriptionPlans />
          </section>

          {/* Comparison table, Theory 5 (table snippets get cited) */}
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
                    ["Chat, you pick the model; refusal is the model's", "✓", "✓", "✓"],
                    ["Capable coding engine", "✓", "✓", "✓"],
                    ["Zophiel Search", "Base", "Pro, deeper crawl, priority latency", "Pro + dedicated capacity"],
                    ["Persistent memory, account-scoped at rest, TLS in transit, export/delete", "✓", "✓", "✓"],
                    ["BYOK (9 providers)", "✓", "✓", "✓"],
                    ["Messages / 3-hour window", "60", "200", "Custom"],
                    ["Azplen Data Intelligence Platform", "-", "✓", "✓"],
                    ["Asherin Engine reach-back harvest (OSINT)", "-", "✓", "✓"],
                    ["Advanced Intelligence Briefings", "-", "✓", "✓"],
                    ["Team workspace", "Limited", "Full + admin controls", "Org-wide + SSO/SAML"],
                    ["Audit logs + retention controls", "-", "-", "✓"],
                    ["Dedicated capacity + custom SLA", "-", "-", "✓"],
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

          {/* FAQ, Theory 5 (FAQ schema gets 3x citation rate) */}
          <section className="mt-24 max-w-3xl mx-auto" aria-labelledby="faq-heading">
            <div className="text-center mb-10">
              <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/40">
                ◈ Frequently asked
              </p>
              <h2
                id="faq-heading"
                className="mt-4 text-3xl sm:text-4xl font-extralight tracking-tight text-foreground"
              >
                Asherin pricing, common questions.
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

          {/* RelatedLinks, Theory 11 (Compound chain) */}
          <section className="mt-24">
            <RelatedLinks
              heading="Continue exploring Asherin"
              links={[
                { to: "/blog", label: "notes from asherin", description: "how the thing is built, and what it will not pretend to know." },
                { to: "/founder", label: "who makes it", description: "a small project, made with care." },
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
