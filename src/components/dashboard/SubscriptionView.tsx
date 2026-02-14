import { useState } from "react";
import { Check, ArrowRight, Zap, Shield, AlertCircle, Loader2, ExternalLink, RefreshCw, Crown } from "lucide-react";
import { useSubscription, TIERS, type TierKey } from "@/contexts/SubscriptionContext";

const plans: {
  id: TierKey;
  name: string;
  tagline: string;
  price: string;
  period: string;
  description: string;
  highlight: boolean;
  features: string[];
}[] = [
  {
    id: "aureon",
    name: "AUREON",
    tagline: "AI Intelligence",
    price: "$18",
    period: "/ month",
    description: "Full access to Aureon AI — uncensored, unfiltered, built for individuals who demand the truth.",
    highlight: false,
    features: [
      "Uncensored AI responses on any topic",
      "Elite coding engine",
      "Persistent memory across sessions",
      "Context intelligence & intent detection",
      "Multi-persona system",
      "Live web search integration",
      "End-to-end encryption",
    ],
  },
  {
    id: "enterprise",
    name: "ZIALIEL ENTERPRISE",
    tagline: "Full Intelligence Suite",
    price: "$5,000",
    period: "/ week",
    description: "The complete intelligence platform — Aureon AI + ZIALIEL Search + OSINT tooling + data analysis.",
    highlight: true,
    features: [
      "Everything in Aureon — unlimited",
      "ZIALIEL Search Engine — full deployment",
      "Source credibility intelligence (4-tier)",
      "Backend OSINT tool for applications",
      "Real-time data analysis pipeline",
      "Dedicated intelligence API endpoints",
      "Priority model access — zero queue",
      "Team workspace — unlimited seats",
      "Private deployment option",
      "24/7 direct engineering support",
    ],
  },
];

const SubscriptionView = () => {
  const { subscribed, tierKey, subscriptionEnd, loading, checkSubscription, startCheckout, openPortal, checkoutLoading } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
  };

  const activePlanName = tierKey ? plans.find(p => p.id === tierKey)?.name ?? "Unknown" : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extralight tracking-wide text-foreground">Subscription</h2>
            <p className="text-sm font-extralight text-muted-foreground mt-1">Manage your plan and billing.</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Refresh status">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Current Plan Status */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${subscribed ? "bg-accent/20" : "bg-muted/20"}`}>
                {loading ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : subscribed ? (
                  <Crown className="h-5 w-5 text-accent" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                {loading ? (
                  <p className="text-sm font-light text-muted-foreground">Checking subscription…</p>
                ) : subscribed ? (
                  <>
                    <p className="text-sm font-light text-foreground">{activePlanName} — Active</p>
                    {subscriptionEnd && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Renews {new Date(subscriptionEnd).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-light text-foreground">No Active Plan</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Choose a plan below to get started.</p>
                  </>
                )}
              </div>
            </div>
            {subscribed && (
              <button onClick={openPortal} className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
                Manage Billing
              </button>
            )}
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isActive = tierKey === plan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-xl border backdrop-blur-sm p-4 sm:p-6 transition-all flex flex-col ${
                  plan.highlight
                    ? "border-accent/30 bg-accent/5"
                    : "border-border/20 bg-card/20"
                } ${isActive ? "ring-1 ring-accent/50" : ""}`}
              >
                {/* Badge */}
                {plan.highlight && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 mb-4 w-fit">
                    <Zap className="h-3 w-3 text-accent" />
                    <span className="text-[10px] font-medium tracking-[0.15em] text-accent uppercase">Full Suite</span>
                  </div>
                )}

                {isActive && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 mb-4 w-fit">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] font-medium tracking-[0.15em] text-emerald-400 uppercase">Your Plan</span>
                  </div>
                )}

                {/* Name */}
                <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground uppercase">{plan.tagline}</p>
                <h3 className="mt-1 text-sm font-light tracking-[0.1em] text-foreground">{plan.name}</h3>

                {/* Price */}
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extralight tracking-tight text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground font-extralight">{plan.period}</span>
                </div>

                {/* Description */}
                <p className="mt-3 text-xs font-extralight leading-relaxed text-muted-foreground">{plan.description}</p>

                {/* CTA */}
                <button
                  onClick={() => !isActive && startCheckout(plan.id)}
                  disabled={isActive || checkoutLoading}
                  className={`group mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-light tracking-wide transition-all ${
                    isActive
                      ? "bg-muted/20 text-muted-foreground cursor-default"
                      : plan.highlight
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : "bg-foreground text-background hover:bg-foreground/90"
                  }`}
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isActive ? (
                    "Current Plan"
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="my-5 h-px bg-border/15" />

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs font-extralight text-foreground/80">
                      <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${plan.highlight ? "text-accent" : "text-emerald-400"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Billing Info */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-light text-foreground">Billing & Security</h3>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Payment method</span>
              <span className="text-foreground/70">{subscribed ? "Managed via Stripe" : "No payment method on file"}</span>
            </div>
            <div className="h-px bg-border/10" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Next billing date</span>
              <span className="text-foreground/70">{subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : "—"}</span>
            </div>
            <div className="h-px bg-border/10" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Data policy</span>
              <span className="text-foreground/70">Your data is never sold or used for training</span>
            </div>
          </div>
          {subscribed && (
            <button onClick={openPortal} className="w-full rounded-lg border border-border/20 py-2.5 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              Manage Payment Methods & Invoices
            </button>
          )}
        </div>

        {/* FAQ */}
        <div className="space-y-2">
          <h3 className="text-sm font-light text-foreground mb-3">Common Questions</h3>
          {[
            { q: "Can I switch plans?", a: "Yes. Upgrade or downgrade anytime. Changes take effect immediately." },
            { q: "How do I cancel?", a: "Click 'Manage Billing' above to access the Stripe portal where you can cancel instantly." },
            { q: "Is Enterprise billed weekly?", a: "Yes. Weekly billing, no long-term contract. Cancel with 7 days notice." },
          ].map(({ q, a }) => (
            <details key={q} className="group rounded-lg border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-xs font-light text-foreground list-none">
                {q}
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-4 pb-3">
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
