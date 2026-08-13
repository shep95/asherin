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
    tagline: "core seat",
    description:
      "a practical single-operator seat: chat, code, search, memory, maps and workspace.",
    cta: "choose asherin — $18 / month",
    highlight: false,
    groups: [
      {
        title: "Asherin Chat",
        items: ["Chat Mode", "Code Mode", "Research Mode", "Truth Mode"],
      },
      {
        title: "Core Capabilities",
        items: [
          "Analytical answers; refusal behaviour follows the provider you route to",
          "Capable coding engine with multi-language output",
          "Response depth control",
          "BYOK — bring your own model key",
        ],
      },
      {
        title: "Search",
        items: [
          "Base web search with source-credibility scoring",
          "Search operators (dorking) with a live fetch",
          "Standard query throughput and recency",
        ],
      },
      {
        title: "Asherin Maps",
        items: [
          "Satellite-first map with a scalable layer tree",
          "Public street-camera feeds where the agency publishes them",
          "Directions and explore nearby",
        ],
      },
      {
        title: "Workspace",
        items: [
          "Guardian Vault",
          "Whiteboard",
          "Persistent memory (standard limits)",
          "Team workspace (limited) + basic sharing",
        ],
      },
      {
        title: "Privacy",
        items: [
          "Account-synced encryption at rest",
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
    price: "$79",
    period: "/month",
    tagline: "higher limits + team",
    description:
      "everything in the $18 seat, with higher limits on asherin chat tools and a full team workspace.",
    cta: "choose asherin pro — $79 / month",
    highlight: true,
    groups: [
      {
        title: "Everything in Asherin ($18)",
        items: [
          "Chat, modes, coding, memory, Guardian Vault, Whiteboard, Maps, BYOK",
        ],
      },
      {
        title: "Usage",
        items: ["200 messages per 3-hour window"],
      },
      {
        title: "Throughput",
        items: [
          "Higher search / dork throughput, with priority when that engine is queued",
          "Extra map and search query capacity",
          "Higher limits on the tools that run inside asherin chat",
        ],
      },
      {
        title: "Team",
        items: ["Full team workspace", "Shared threads + outputs", "Admin controls"],
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
 * core monthly tiers (Asherin $18 / Asherin Pro $79) plus an Enterprise
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
                broader plan
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
                      : `choose plan — ${formatUsd(q.cents)}${isSemi ? " / 6 months" : " / month"}`}
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
              href="mailto:asher@asherin.com?subject=Asherin%20Enterprise%20Inquiry"
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
