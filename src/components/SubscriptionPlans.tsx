import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useState } from "react";

const PLANS = [
  {
    id: "monthly_aureon" as const,
    name: "Aureon",
    price: "$18",
    period: "/month",
    tagline: "Core intelligence",
    description:
      "Everything you need to think, code, search and ship — uncensored AI, elite coding engine, base Zophiel Search, persistent memory and a workspace built for one operator.",
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
        title: "Zophiel Search (Base)",
        items: ["Real-time web search", "Standard recency", "Basic query limits"],
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
      "Everything in Aureon, plus the full intelligence suite — Azplen data platform, NOMAD OSINT, advanced briefings, Zophiel Pro and full team collaboration.",
    cta: "Subscribe — $399 / month",
    highlight: true,
    groups: [
      { title: "Everything in Aureon", items: ["All core chat, modes, search, memory and workspace features"] },
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
          "Aureon IDE, Whiteboard, File Scrapper, Cipher",
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
 * Replaces the previous "Aureon is free" donation manifesto. Renders the two
 * core monthly tiers (Aureon $18 / Asherin Pro $399) plus an Enterprise
 * contact card.
 */
export default function SubscriptionPlans({ compact = false }: Props) {
  const { user } = useAuth();
  const { startCheckout, checkoutLoading } = useSubscription();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleSubscribe = async (id: "monthly_aureon" | "monthly_pro") => {
    if (!user) {
      window.location.href = "/dashboard";
      return;
    }
    setPendingId(id);
    try {
      await startCheckout(id);
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
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-extralight tracking-tight text-foreground">
                {plan.price}
              </span>
              <span className="text-sm text-muted-foreground font-extralight">{plan.period}</span>
            </div>
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
              {checkoutLoading && pendingId === plan.id ? "Loading…" : plan.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

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
              href="mailto:asher@aureonai.app?subject=Aureon%20Enterprise%20Inquiry"
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
      {!user && (
        <p className="mt-2 text-center text-xs font-extralight text-muted-foreground/50">
          <Link to="/dashboard" className="underline hover:text-foreground">Sign in</Link> to subscribe.
        </p>
      )}
    </div>
  );
}
