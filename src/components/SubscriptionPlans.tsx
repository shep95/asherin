import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useState } from "react";
import { usePppQuote, quoteCents } from "@/hooks/usePppQuote";
import { formatUsd, type Term } from "@/lib/pricing/ppp";

/** ISO-3166 alpha-2 → readable country name, with a safe fallback. */
function countryName(code: string | null): string {
  if (!code) return "your region";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

const PLANS = [
  {
    id: "monthly_aureon" as const,
    name: "Asherin",
    price: "$18",
    period: "/month",
    tagline: "Core intelligence",
    description:
      "Everything you need to think, code, search and ship — uncensored AI, elite coding engine, the full Zophiel Search Intelligence engine, persistent memory and a workspace built for one operator.",
    cta: "Subscribe — $18 / month",
    highlight: false,
    groups: [
      {
        title: "Core Chat + Modes",
        items: ["Chat Mode", "Code Mode", "Research Mode", "Truth Mode"],
      },
      {
        title: "Core Capabilities",
        items: [
          "Uncensored AI responses",
          "Elite coding engine",
          "Multi-language output",
          "Response depth control",
        ],
      },
      {
        title: "Zophiel Search Intelligence (Full Engine)",
        items: [
          "Real-time web search with source-credibility + veracity scoring",
          "Deep Search, Link Extract, Archives Harvester and page preview",
          "Dark Web, Leaks, Onion and GhostChain sweeps",
          "Google Dorking, XKeyscore operators and Data Engine",
          "Intel Map, URL/Domain mapping and Zophiel V2 pipeline",
          "Imagine Intelligence, File Scrapper and Cipher",
          "Standard query throughput and recency",
        ],
      },
      {
        title: "Google Cloud Intelligence",
        items: [
          "Connect multiple Google accounts (Gmail, Calendar, Drive, Meet)",
          "Automated contact intelligence reports",
          "Signed-in device mesh — battery, link and live location",
          "Always-on Sentinel alerts by email and push",
        ],
      },
      {
        title: "Asherin Maps",
        items: [
          "Satellite-first tactical map with scalable layer tree",
          "Live street-camera intelligence sweeps",
          "Directions, explore nearby and hiring nearby",
          "Find-My device locating across your signed-in fleet",
        ],
      },
      {
        title: "Productivity",
        items: ["Code snippets library", "Keyboard shortcuts / command palette"],
      },
      {
        title: "Workspace",
        items: ["Team workspace (limited)", "Basic sharing / collaboration"],
      },

      {
        title: "Memory + Privacy",
        items: [
          "Persistent memory (standard limits)",
          "End-to-end encryption",
          "Delete anytime + export",
        ],
      },
      {
        title: "Usage",
        items: ["60 messages per 3-hour window"],
      },
    ],
  },
  {
    id: "monthly_pro" as const,
    name: "Asherin Pro",
    price: "$399",
    period: "/month",
    tagline: "Maximum intelligence",
    description:
      "Everything in Asherin, plus the full intelligence suite — Azplen data platform, NOMAD OSINT, advanced briefings, Zophiel Pro and full team collaboration.",
    cta: "Subscribe — $399 / month",
    highlight: true,
    groups: [
      { title: "Everything in Asherin", items: ["All core chat, modes, search, memory and workspace features", "Google Cloud Intelligence + Asherin Maps, with Pro-depth sweeps"] },
      {
        title: "Azplen Data Intelligence Platform",
        items: [
          "Ingestion + analysis workflows",
          "Entity resolution",
          "Workflow automation",
          "Scenario simulation",
          "Threat modeling",
        ],
      },
      {
        title: "NOMAD Public Intelligence Agent",
        items: ["OSINT investigation tooling", "Public web intelligence + entity matching"],
      },
      {
        title: "Intelligence Briefings (Advanced)",
        items: ["Daily briefings", "Industry customization"],
      },
      {
        title: "Zophiel Search (Pro)",
        items: ["Higher query limits", "Deeper crawling / broader coverage", "Priority latency"],
      },
      {
        title: "Collaboration (Pro)",
        items: ["Team workspace (full)", "Shared threads + outputs", "Admin controls"],
      },
      {
        title: "Plus the full advanced suite",
        items: [
          "Asherin IDE, Whiteboard, File Scrapper, Cipher",
          "AXRLEN predictive intelligence",
          "ZEEION financial intelligence",
          "ZERLAL cyber security",
          "CROSS live screen intelligence",
          "ZANOEM Design Lab, Vedic Strategy, Video Intelligence",
          "Plugin Marketplace + Automated Agents",
        ],
      },
      {
        title: "Usage",
        items: ["200 messages per 3-hour window"],
      },
    ],
  },
];

interface Props {
  compact?: boolean;
}

/**
 * Public-facing subscription plans card.
 *
 * Replaces the previous "Asherin is free" donation manifesto. Renders the two
 * core monthly tiers (Asherin $18 / Asherin Pro $399) plus an Enterprise
 * contact card.
 */
export default function SubscriptionPlans({ compact = false }: Props) {
  const { user } = useAuth();
  const { startCheckout, checkoutLoading } = useSubscription();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [term, setTerm] = useState<Term>("monthly");
  const ppp = usePppQuote();

  const handleSubscribe = async (id: "monthly_aureon" | "monthly_pro") => {
    if (!user) {
      window.location.href = "/dashboard";
      return;
    }
    setPendingId(id);
    try {
      await startCheckout(id, term);

    } catch (e) {
      console.error(e);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-10 text-center">
        <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/40">
          ◈ Subscription
        </p>
        <h2
          className={`mt-4 font-extralight tracking-tight text-foreground ${
            compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
          } leading-[1.05]`}
        >
          Pick the tier that fits the work.
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-sm font-extralight leading-relaxed text-muted-foreground">
          Two plans. No trial countdown, no upsell wall. Cancel from the dashboard in one click —
          your data is exported or deleted on request.
        </p>

        {/* Billing term */}
        <div
          role="radiogroup"
          aria-label="Billing term"
          className="mt-7 inline-flex items-center rounded-full border border-foreground/15 bg-background/50 p-1 backdrop-blur-xl"
        >
          {(["monthly", "semiannual"] as const).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={term === t}
              onClick={() => setTerm(t)}
              className={`rounded-full px-5 py-2 text-[10px] font-light tracking-[0.2em] uppercase transition-colors ${
                term === t
                  ? "bg-foreground text-background"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {t === "monthly" ? "Monthly" : "6 months"}
            </button>
          ))}
        </div>

        <p className="mt-5 max-w-2xl mx-auto text-[13px] font-extralight leading-relaxed text-muted-foreground/80">
          We didn&rsquo;t want anyone living in survival mode over a subscription — liking the work
          but bracing for a charge every thirty days, asking each month whether they can keep the
          tools they build with. So there is a six-month term: pay once, then don&rsquo;t think
          about it for half a year. Same price per month, none of the monthly dread.
        </p>

        <p
          className="mt-3 text-[11px] font-extralight text-muted-foreground/55"
          aria-live="polite"
        >
          {ppp.loading
            ? "Checking regional pricing…"
            : ppp.multiplier < 1
              ? `Regional pricing applied for ${countryName(ppp.country)} — priced to what the local economy can carry, not the US sticker.`
              : ppp.vpnSuspected
                ? "Standard pricing — your connection changed networks in the last hour, so regional pricing is paused."
                : `Standard pricing${ppp.country ? ` for ${countryName(ppp.country)}` : ""}.`}
        </p>
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col overflow-hidden rounded-3xl border backdrop-blur-2xl p-8 ${
              plan.highlight
                ? "border-foreground/30 bg-foreground/[0.05]"
                : "border-foreground/10 bg-background/40"
            }`}
          >
            {plan.highlight && (
              <span className="absolute top-5 right-5 rounded-full border border-foreground/30 px-3 py-1 text-[9px] font-medium tracking-[0.2em] uppercase text-foreground/80">
                Most Capability
              </span>
            )}
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
              ◉ {plan.tagline}
            </p>
            <h3 className="mt-3 text-2xl font-extralight tracking-tight text-foreground">
              {plan.name}
            </h3>
            {(() => {
              const q = quoteCents(ppp, plan.id, term);
              const isSemi = term === "semiannual";
              const perMonth = isSemi ? Math.round(q.cents / 6) : q.cents;
              return (
                <>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-5xl font-extralight tracking-tight text-foreground">
                      {formatUsd(q.cents)}
                    </span>
                    <span className="text-sm text-muted-foreground font-extralight">
                      {isSemi ? "/ 6 months" : "/month"}
                    </span>
                    {q.cents < q.baseCents && (
                      <span className="text-sm font-extralight text-muted-foreground/50 line-through">
                        {formatUsd(q.baseCents)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-extralight text-muted-foreground/60">
                    {isSemi
                      ? `Paid once — works out to ${formatUsd(perMonth)}/month, then renews every 6 months.`
                      : "Billed every month."}
                  </p>
                  <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                    {plan.description}
                  </p>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={checkoutLoading && pendingId === plan.id}
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-light tracking-[0.2em] uppercase transition-colors disabled:opacity-60 ${
                      plan.highlight
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "border border-foreground/30 text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {checkoutLoading && pendingId === plan.id
                      ? "Loading…"
                      : `Subscribe — ${formatUsd(q.cents)}${isSemi ? " / 6 months" : " / month"}`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              );
            })()}


            <div className="mt-8 space-y-5">
              {plan.groups.map((g) => (
                <div key={g.title}>
                  <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/60 mb-2">
                    {g.title}
                  </p>
                  <ul className="space-y-1.5">
                    {g.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm font-extralight text-muted-foreground"
                      >
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Enterprise */}
      <div className="mt-6 rounded-3xl border border-foreground/10 bg-background/40 backdrop-blur-2xl p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
              ◈ Enterprise · Custom
            </p>
            <h3 className="mt-2 text-2xl font-extralight tracking-tight text-foreground">
              Built for organizations that need governance.
            </h3>
            <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
              SSO / SAML, org-wide policy controls, audit logs with retention controls, dedicated
              capacity, and custom SLAs. Priced per organization.
            </p>
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {[
                "SSO / SAML",
                "Org policy controls",
                "Audit logs + retention",
                "Dedicated capacity",
                "Custom SLAs",
              ].map((i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm font-extralight text-muted-foreground"
                >
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground/70" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-shrink-0">
            <a
              href="mailto:asher@aureonai.app?subject=Asherin%20Enterprise%20Inquiry"
              className="inline-flex items-center gap-2 rounded-full border border-foreground/30 px-5 py-3 text-xs font-light tracking-[0.2em] uppercase text-foreground hover:bg-foreground/5 transition-colors"
            >
              Contact sales
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs font-extralight text-muted-foreground/70">
        All prices in USD. Cancel anytime — no retention flow, no &ldquo;are you sure?&rdquo; loop.
      </p>
      <p className="mt-2 text-center text-[11px] font-extralight leading-relaxed text-muted-foreground/50 max-w-2xl mx-auto">
        Regional pricing is resolved from the network your request actually arrives on and is
        re-checked at checkout. Rotating IPs, hopping countries or routing through a
        datacenter/VPN network within the hour simply returns you to standard pricing — nothing is
        blocked, nothing is punished. It exists so the discount reaches the people it was built for.
      </p>

      {!user && (
        <p className="mt-2 text-center text-xs font-extralight text-muted-foreground/50">
          <Link to="/dashboard" className="underline hover:text-foreground">Sign in</Link> to subscribe.
        </p>
      )}
    </div>
  );
}
