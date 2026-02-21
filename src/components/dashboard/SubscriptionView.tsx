import { useState, useEffect, useCallback } from "react";
import { Check, ArrowRight, Zap, Shield, AlertCircle, Loader2, ExternalLink, RefreshCw, Crown, FileText, Package, Trash2 } from "lucide-react";
import { useSubscription, TIERS, type TierKey } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const plans: {
  id: TierKey;
  name: string;
  tagline: string;
  price: string;
  period: string;
  description: string;
  highlight: boolean;
  purple?: boolean;
  features: string[];
}[] = [
  {
    id: "aureon",
    name: "AUREON",
    tagline: "AI Intelligence",
    price: "$18",
    period: "/ month",
    description: "Full access to Aureon AI — uncensored, unfiltered. 60 messages per 3 hours.",
    highlight: false,
    features: [
      "Uncensored AI responses on any topic",
      "60 messages per 3-hour window",
      "Elite coding engine",
      "Zophiel Search Engine",
      "Persistent memory across all sessions",
      "Context intelligence & intent detection",
      "Multi-persona system",
      "Live web search integration",
      "End-to-end encryption",
      "Data never sold or used for training",
    ],
  },
  {
    id: "pro",
    name: "AUREON PRO",
    tagline: "Full Dashboard Access",
    price: "$740",
    period: "/ month",
    description: "Complete access to every tool in the dashboard — Asha Intelligence, NOMAD OSINT, Briefings, and unlimited capabilities.",
    highlight: false,
    features: [
      "Everything in Aureon — expanded",
      "200 messages per 3-hour window",
      "Elion / Zohar Toolkit — domain forensics & OSINT",
      "Full Domain Scan — security score + subdomain recon",
      "Predictive Intelligence — AI event forecasting",
      "Imagine To Code — pixel art & SVG editor with AUREON AI",
      "ZALI Design Intelligence Lab",
      "ZALI Community — questions, requests & feature votes",
      "Asha Data Intelligence Platform",
      "NOMAD Public Intelligence Agent",
      "Daily Intelligence Briefings",
      "Intelligence Notebooks with versioning",
      "Team Workspace with RBAC & email invites",
      "Time-Series Intelligence & forecasting",
      "Geospatial analysis & location mapping",
      "Plugin Marketplace (20+ plugins)",
      "Audit Trail for compliance",
      "Entity resolution & relationship mapping",
      "Scenario Simulator & threat modeling",
      "Company & competitor tracking",
      "Priority model access",
    ],
  },
  {
    id: "advisor_monthly",
    name: "AUREON ADVISOR",
    tagline: "Direct Access — Limited to 8 Seats",
    price: "$20,000",
    period: "/ month",
    description: "The full intelligence suite plus direct advisor access to Asher. NDA required. Limited to 8 clients worldwide.",
    highlight: true,
    purple: true,
    features: [
      "Everything in Pro — unlimited",
      "ZALI Design Lab — unlimited projects & community",
      "Direct advisor access to Asher",
      "Limited to 8 clients worldwide",
      "NDA required upon purchase",
      "Custom intelligence operations",
      "Private deployment option",
      "Dedicated intelligence API endpoints",
      "Priority model access — zero queue",
      "24/7 direct support line",
      "Annual option: $240,000/year",
    ],
  },
];

const SubscriptionView = () => {
  const { subscribed, tierKey, subscriptionEnd, status, cancelAtPeriodEnd, loading, checkSubscription, startCheckout, openPortal, checkoutLoading } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  interface InstalledPluginRow {
    id: string;
    plugin_id: string;
    installed_at: string;
    plugins: { name: string; price_cents: number; is_premium: boolean; icon: string } | null;
  }

  const [pluginSubs, setPluginSubs] = useState<InstalledPluginRow[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const [removingPlugin, setRemovingPlugin] = useState<string | null>(null);

  const loadPluginSubs = useCallback(async () => {
    if (!user) { setPluginsLoading(false); return; }
    const { data } = await supabase
      .from("installed_plugins")
      .select("id, plugin_id, installed_at, plugins(name, price_cents, is_premium, icon)")
      .eq("user_id", user.id);
    setPluginSubs((data as unknown as InstalledPluginRow[]) ?? []);
    setPluginsLoading(false);
  }, [user]);

  useEffect(() => { loadPluginSubs(); }, [loadPluginSubs]);

  const cancelPlugin = async (row: InstalledPluginRow) => {
    if (!user) return;
    setRemovingPlugin(row.id);
    await supabase.from("installed_plugins").delete().eq("id", row.id);
    toast({ title: "Plugin removed", description: `${row.plugins?.name ?? "Plugin"} has been uninstalled.` });
    loadPluginSubs();
    setRemovingPlugin(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
  };

  const activePlanName = tierKey ? plans.find(p => p.id === tierKey)?.name ?? (tierKey === "advisor_annual" ? "AUREON ADVISOR (Annual)" : "Unknown") : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${subscribed ? (tierKey === "advisor_monthly" || tierKey === "advisor_annual" ? "bg-purple-500/20" : "bg-accent/20") : "bg-muted/20"}`}>
                {loading ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : subscribed ? (
                  <Crown className={`h-5 w-5 ${tierKey === "advisor_monthly" || tierKey === "advisor_annual" ? "text-purple-400" : "text-accent"}`} />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                {loading ? (
                  <p className="text-sm font-light text-muted-foreground">Checking subscription…</p>
                ) : subscribed ? (
                  <>
                    <p className="text-sm font-light text-foreground">
                      {activePlanName} — {cancelAtPeriodEnd ? "Canceling" : status === "trialing" ? "Trial" : "Active"}
                    </p>
                    {subscriptionEnd && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cancelAtPeriodEnd
                          ? `Access until ${new Date(subscriptionEnd).toLocaleDateString()}`
                          : `Renews ${new Date(subscriptionEnd).toLocaleDateString()}`}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isActive = tierKey === plan.id || (plan.id === "advisor_monthly" && tierKey === "advisor_annual");
            const isPurple = plan.purple;
            return (
              <div
                key={plan.id}
                className={`rounded-xl border backdrop-blur-sm p-4 sm:p-5 transition-all flex flex-col ${
                  isPurple
                    ? "border-purple-500/30 bg-purple-500/5"
                    : plan.highlight
                      ? "border-accent/30 bg-accent/5"
                      : "border-border/20 bg-card/20"
                } ${isActive ? `ring-1 ${isPurple ? "ring-purple-500/50" : "ring-accent/50"}` : ""}`}
              >
                {isPurple && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 mb-3 w-fit">
                    <Zap className="h-3 w-3 text-purple-400" />
                    <span className="text-[10px] font-medium tracking-[0.15em] text-purple-400 uppercase">Advisor — 8 Seats Only</span>
                  </div>
                )}

                {isActive && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 mb-3 w-fit">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] font-medium tracking-[0.15em] text-emerald-400 uppercase">Your Plan</span>
                  </div>
                )}

                <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground uppercase">{plan.tagline}</p>
                <h3 className="mt-1 text-sm font-light tracking-[0.1em] text-foreground">{plan.name}</h3>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-extralight tracking-tight text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground font-extralight">{plan.period}</span>
                </div>

                <p className="mt-2 text-xs font-extralight leading-relaxed text-muted-foreground">{plan.description}</p>

                {plan.id === "advisor_monthly" ? (
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => !isActive && startCheckout("advisor_monthly")}
                      disabled={isActive || checkoutLoading}
                      className={`group flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-light tracking-wide transition-all ${
                        isActive
                          ? "bg-muted/20 text-muted-foreground cursor-default"
                          : "bg-purple-500 text-white hover:bg-purple-500/90"
                      }`}
                    >
                      {checkoutLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActive ? "Current Plan" : <>$20,000/mo <ArrowRight className="h-3.5 w-3.5" /></>}
                    </button>
                    <button
                      onClick={() => !isActive && startCheckout("advisor_annual")}
                      disabled={isActive || checkoutLoading}
                      className="group flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-light tracking-wide border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-50"
                    >
                      $240,000/year (save $0)
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => !isActive && startCheckout(plan.id)}
                    disabled={isActive || checkoutLoading}
                    className={`group mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-light tracking-wide transition-all ${
                      isActive
                        ? "bg-muted/20 text-muted-foreground cursor-default"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    }`}
                  >
                    {checkoutLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActive ? "Current Plan" : <>Subscribe <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></>}
                  </button>
                )}

                <div className="my-4 h-px bg-border/15" />

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[11px] font-extralight text-foreground/80">
                      <Check className={`h-3 w-3 mt-0.5 shrink-0 ${isPurple ? "text-purple-400" : "text-emerald-400"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.id === "advisor_monthly" && (
                  <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-[10px] text-purple-400 font-light uppercase tracking-wider">NDA Required</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Advisor clients must sign a Non-Disclosure Agreement upon purchase. <Link to="/nda" className="text-purple-400 underline">Review NDA</Link>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Plugin Subscriptions */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-light text-foreground">Plugin Subscriptions</h3>
          </div>
          {pluginsLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading plugins…</span>
            </div>
          ) : pluginSubs.length === 0 ? (
            <p className="text-xs font-extralight text-muted-foreground py-2">No plugins installed. Visit the Plugin Marketplace to browse available plugins.</p>
          ) : (
            <div className="space-y-2">
              {pluginSubs.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-border/10 bg-card/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-light text-foreground">{row.plugins?.name ?? "Unknown Plugin"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Installed {new Date(row.installed_at).toLocaleDateString()}
                        {row.plugins?.is_premium && row.plugins.price_cents > 0 && (
                          <> · <span className="text-foreground/70">${(row.plugins.price_cents / 100).toFixed(0)}/mo</span></>
                        )}
                        {!row.plugins?.is_premium && " · Free"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelPlugin(row)}
                    disabled={removingPlugin === row.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {removingPlugin === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    {row.plugins?.is_premium ? "Cancel" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
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
            { q: "How do I cancel?", a: "Click 'Manage Billing' above to access the portal where you can cancel instantly." },
            { q: "What are the message limits?", a: "Aureon: 60 messages per 3 hours. Pro: 200 per 3 hours. Advisor: Unlimited." },
            { q: "What is the Advisor NDA?", a: "Advisor clients sign a Non-Disclosure Agreement to protect proprietary intelligence methods and platform internals." },
            { q: "Is the Advisor tier really limited to 8 seats?", a: "Yes. Once 8 clients are active, the Advisor tier is closed until a seat opens." },
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
