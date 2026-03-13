import { useState, useEffect, useCallback } from "react";
import { Check, ArrowRight, Loader2, ExternalLink, RefreshCw, Crown, AlertCircle, Package, Trash2, Shield, ChevronDown } from "lucide-react";
import { useSubscription, type TierKey } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getDashboardPlans } from "@/config/subscriptionPlans";
import TierFeatureTabs from "@/components/subscription/TierFeatureTabs";
import GiftSubscriptionSection from "@/components/dashboard/subscription/GiftSubscriptionSection";
import AddOnsSection from "@/components/dashboard/subscription/AddOnsSection";

const plans = getDashboardPlans().map(p => ({
  id: p.id,
  name: p.name,
  tagline: p.tagline,
  price: p.price,
  period: p.period,
  description: p.description,
  highlight: p.highlight,
  features: p.featureLabels,
}));

/* ── Section wrapper for visual consistency ─────────────────────────────── */
const Section = ({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/15 bg-card/10 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-foreground/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground/70" />
          <h3 className="text-xs font-light tracking-[0.12em] uppercase text-foreground/90">{title}</h3>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  );
};

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

  const activePlanName = tierKey ? plans.find(p => p.id === tierKey)?.name ?? "Unknown" : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extralight tracking-[0.15em] text-foreground">Subscription</h2>
            <p className="text-[11px] font-extralight text-muted-foreground/70 mt-1 tracking-wide">Manage your plan, add-ons, and billing.</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors" title="Refresh status">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ── Current Plan Banner ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border/15 bg-card/10 backdrop-blur-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${subscribed ? "bg-accent/15" : "bg-muted/15"}`}>
                {loading ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : subscribed ? (
                  <Crown className="h-4 w-4 text-accent" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground/60" />
                )}
              </div>
              <div>
                {loading ? (
                  <p className="text-xs font-light text-muted-foreground">Checking subscription…</p>
                ) : subscribed ? (
                  <>
                    <p className="text-sm font-light text-foreground tracking-wide">
                      {activePlanName}
                      <span className="ml-2 text-[10px] font-light tracking-[0.15em] uppercase text-accent/80">
                        {cancelAtPeriodEnd ? "Canceling" : status === "trialing" ? "Trial" : "Active"}
                      </span>
                    </p>
                    {subscriptionEnd && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {cancelAtPeriodEnd
                          ? `Access until ${new Date(subscriptionEnd).toLocaleDateString()}`
                          : `Renews ${new Date(subscriptionEnd).toLocaleDateString()}`}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-light text-foreground">No Active Plan</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Choose a plan below to get started.</p>
                  </>
                )}
              </div>
            </div>
            {subscribed && (
              <button onClick={openPortal} className="flex items-center gap-1.5 rounded-lg border border-border/15 px-3.5 py-2 text-[10px] font-light tracking-wide text-foreground/80 hover:bg-foreground/5 transition-colors">
                <ExternalLink className="h-3 w-3" />
                Manage Billing
              </button>
            )}
          </div>
        </div>

        {/* ── Plan Cards ───────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/50 mb-3 px-1">Available Plans</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map((plan) => {
              const isActive = tierKey === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border backdrop-blur-sm p-5 transition-all flex flex-col ${
                    isActive
                      ? "border-accent/25 bg-accent/[0.04] ring-1 ring-accent/20"
                      : plan.highlight
                        ? "border-accent/20 bg-accent/[0.03]"
                        : "border-border/15 bg-card/10"
                  }`}
                >
                  {isActive && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 mb-3 w-fit">
                      <Check className="h-2.5 w-2.5 text-accent" />
                      <span className="text-[9px] font-medium tracking-[0.15em] text-accent uppercase">Current</span>
                    </div>
                  )}

                  <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/50 uppercase">{plan.tagline}</p>
                  <h3 className="mt-1 text-xs font-light tracking-[0.12em] text-foreground">{plan.name}</h3>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-extralight tracking-tight text-foreground">{plan.price}</span>
                    <span className="text-[11px] text-muted-foreground/50 font-extralight">{plan.period}</span>
                  </div>

                  <p className="mt-2 text-[11px] font-extralight leading-relaxed text-muted-foreground/70 line-clamp-2">{plan.description}</p>

                  <button
                    onClick={() => !isActive && startCheckout(plan.id)}
                    disabled={isActive || checkoutLoading}
                    className={`group mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[11px] font-light tracking-wide transition-all ${
                      isActive
                        ? "bg-accent/10 text-accent/60 cursor-default"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    }`}
                  >
                    {checkoutLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActive ? "Current Plan" : <>Subscribe <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></>}
                  </button>

                  <div className="my-4 h-px bg-border/10" />

                  <ul className="space-y-1.5 flex-1">
                    {plan.features.slice(0, 6).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[10px] font-extralight text-foreground/70">
                        <Check className="h-2.5 w-2.5 mt-0.5 shrink-0 text-accent/70" />
                        {feature}
                      </li>
                    ))}
                    {plan.features.length > 6 && (
                      <li className="text-[9px] text-muted-foreground/40 pl-4">+{plan.features.length - 6} more features</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Add-Ons ──────────────────────────────────────────────────── */}
        <AddOnsSection />

        {/* ── Gift Subscriptions ───────────────────────────────────────── */}
        <GiftSubscriptionSection />

        {/* ── Feature Breakdown ────────────────────────────────────────── */}
        <Section title="Feature Breakdown" icon={Check} defaultOpen={false}>
          <TierFeatureTabs compact />
        </Section>

        {/* ── Plugin Subscriptions ─────────────────────────────────────── */}
        <Section title="Installed Plugins" icon={Package} defaultOpen={false}>
          {pluginsLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
              <span className="text-[11px] text-muted-foreground/50">Loading plugins…</span>
            </div>
          ) : pluginSubs.length === 0 ? (
            <p className="text-[11px] font-extralight text-muted-foreground/50 py-2">No plugins installed. Visit the Plugin Marketplace to browse available plugins.</p>
          ) : (
            <div className="space-y-2">
              {pluginSubs.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-border/10 bg-card/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <div>
                      <p className="text-[11px] font-light text-foreground">{row.plugins?.name ?? "Unknown Plugin"}</p>
                      <p className="text-[10px] text-muted-foreground/50">
                        Installed {new Date(row.installed_at).toLocaleDateString()}
                        {row.plugins?.is_premium && row.plugins.price_cents > 0 && (
                          <> · <span className="text-foreground/60">${(row.plugins.price_cents / 100).toFixed(0)}/mo</span></>
                        )}
                        {!row.plugins?.is_premium && " · Free"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelPlugin(row)}
                    disabled={removingPlugin === row.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {removingPlugin === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    {row.plugins?.is_premium ? "Cancel" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Billing & Security ───────────────────────────────────────── */}
        <Section title="Billing & Security" icon={Shield} defaultOpen={false}>
          <div className="space-y-3">
            {[
              { label: "Payment method", value: subscribed ? "Managed via Stripe" : "No payment method on file" },
              { label: "Next billing date", value: subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : "—" },
              { label: "Data policy", value: "Your data is never sold or used for training" },
            ].map(({ label, value }, i) => (
              <div key={label}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="text-muted-foreground/60">{label}</span>
                  <span className="text-foreground/60">{value}</span>
                </div>
                {i < 2 && <div className="h-px bg-border/8 mt-3" />}
              </div>
            ))}
          </div>
          {subscribed && (
            <button onClick={openPortal} className="w-full mt-4 rounded-lg border border-border/15 py-2.5 text-[11px] font-light text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors">
              Manage Payment Methods & Invoices
            </button>
          )}
        </Section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/50 mb-3 px-1">Common Questions</p>
          <div className="space-y-1.5">
            {[
              { q: "Can I switch plans?", a: "Yes. Upgrade or downgrade anytime. Changes take effect immediately." },
              { q: "How do I cancel?", a: "Click 'Manage Billing' above to access the portal where you can cancel instantly." },
              { q: "What are the message limits?", a: "Aureon: 300 messages per 3 hours. Pro: 200 per 3 hours. Advisor: Unlimited." },
              { q: "Can I use my own AI models?", a: "Yes — go to Settings → AI Model Keys. Connect API keys from Google, OpenAI, Claude, Meta, Venice, xAI, Mistral, or DeepSeek and select your preferred model." },
              { q: "What is the Advisor NDA?", a: "Advisor clients sign a Non-Disclosure Agreement to protect proprietary intelligence methods and platform internals." },
              { q: "Is the Advisor tier really limited to 8 seats?", a: "Yes. Once 8 clients are active, the Advisor tier is closed until a seat opens." },
            ].map(({ q, a }) => (
              <details key={q} className="group rounded-lg border border-border/12 bg-card/5 overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-[11px] font-light text-foreground/80 list-none">
                  {q}
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-3">
                  <p className="text-[11px] font-extralight leading-relaxed text-muted-foreground/60">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default SubscriptionView;
