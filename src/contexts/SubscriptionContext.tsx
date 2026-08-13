import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Stripe product/price mapping.
// NOTE: monthly_aureon ($18/mo) and monthly_pro ($79/mo) are the active subscription
// products. The legacy one-time tiers (chat / aureon / pro / lifetime / algorithm) are
// retained so existing subscribers and grant records continue to resolve, but they are
// no longer offered for new purchase.
//
// TODO(stripe): replace the monthly_aureon / monthly_pro price_id placeholders below
// with real Stripe Price IDs ($18/mo + $79/mo recurring) before launching checkout.
export const TIERS = {
  monthly_aureon: {
    product_id: "prod_UjaQPixvFi3Qlr",
    price_id: "price_1Tk7FyRxgCpmPfiF4vZebmnE",
  },
  monthly_pro: {
    product_id: "prod_UjaQFcAkQnTOm1",
    price_id: "price_1U3vudRxgCpmPfiFCTcY3p1W",
  },
  lifetime: {
    product_id: "prod_UTrNsrxIQGTBQR",
    price_id: "price_1TUtfDRxgCpmPfiFNYa092Zu",
  },
  chat: {
    product_id: "prod_U4YWDDwSXK3SGO",
    price_id: "price_1T6PPmRxgCpmPfiFoTiBXBzq",
  },
  aureon: {
    product_id: "prod_U1rtJ8HXSCtvqO",
    price_id: "price_1T3o9NRxgCpmPfiFaFDWC8u0",
  },
  pro: {
    product_id: "prod_U1PuUztkmieRrE",
    price_id: "price_1T3N4iRxgCpmPfiFGbJkXY33",
  },
  algorithm: {
    product_id: "prod_aureon_algorithm",
    price_id: "price_1TfC3oRxgCpmPfiFniV2cXAu",
  },
} as const;


export type TierKey = keyof typeof TIERS;

export interface TeamGrant {
  team_id: string;
  team_name: string;
  team_role: string;
  is_owner: boolean;
  billing_status?: string;
}

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  tierKey: TierKey | null;
  subscriptionEnd: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  isPastDue: boolean;
  isTrialing: boolean;
  /** Set when Pro-class access is inherited from an Asherin Team seat. */
  team: TeamGrant | null;
}

interface SubscriptionContextValue extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  startCheckout: (tier: TierKey, term?: "monthly" | "semiannual") => Promise<void>;
  openPortal: () => Promise<void>;
  upgradeSubscription: (targetTier: TierKey) => Promise<void>;
  startProTrial: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  checkoutLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscribed: false,
  productId: null,
  tierKey: null,
  subscriptionEnd: null,
  status: null,
  cancelAtPeriodEnd: false,
  loading: true,
  isPastDue: false,
  isTrialing: false,
  team: null,
  checkSubscription: async () => {},
  startCheckout: async () => {},
  openPortal: async () => {},
  upgradeSubscription: async () => {},
  startProTrial: async () => {},
  cancelSubscription: async () => {},
  reactivateSubscription: async () => {},
  checkoutLoading: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

// Six-month term products resolve to the same entitlement as their monthly twin.
const SEMIANNUAL_PRODUCTS: Record<string, TierKey> = {
  prod_V226j5fQ5fSoD9: "monthly_aureon",
  prod_V2267gYsf3sRRn: "monthly_pro",
};

function productToTier(productId: string | null): TierKey | null {
  if (!productId) return null;
  if (SEMIANNUAL_PRODUCTS[productId]) return SEMIANNUAL_PRODUCTS[productId];
  for (const [key, val] of Object.entries(TIERS)) {
    if (val.product_id === productId) return key as TierKey;
  }
  // Keyword fallback — mirrors supabase/functions/_shared/tierGate.ts so
  // internally-granted product ids (e.g. "aureon_admin_lifetime_max") don't
  // read as "no subscription" on the client.
  const s = productId.toLowerCase();
  if (s.includes("lifetime")) return "lifetime";
  if (s.includes("algorithm")) return "algorithm";
  if (s.includes("pro")) return "pro";
  if (s.includes("aureon")) return "aureon";
  if (s.includes("chat")) return "chat";
  return null;
}


// ── Access helpers ───────────────────────────────────────────────────────────
// Real tier-based gating. Tier ladder:
//   chat < aureon/monthly_aureon < pro/monthly_pro/lifetime/algorithm
const AUREON_TIERS: TierKey[] = ["monthly_aureon", "aureon", "monthly_pro", "pro", "lifetime", "algorithm"];
const PRO_TIERS: TierKey[] = ["monthly_pro", "pro", "lifetime", "algorithm"];
// Maximum Intelligence — the $79/mo Asherin Pro subscription (and its one-time
// equivalent) only. Deliberately excludes `lifetime` and `algorithm`: those are
// lower-priced grandfathered entitlements whose published feature list stops at
// the Aureon tier, so they must not inherit maximum-tier surfaces.
const MAXIMUM_TIERS: TierKey[] = ["monthly_pro", "pro"];
export function hasChatAccess(t: TierKey | null): boolean { return !!t; }
export function hasSearchAccess(t: TierKey | null): boolean { return !!t; }
// Zophiel Search Intelligence — the entire tab (web, deep, dark web, leaks,
// archives, dork, ghostchain, Resolve, intel map, data engine, v2) ships with
// the $18/mo Asherin subscription and its 6-month term (both resolve to
// `monthly_aureon`), and with every tier above it. Legacy `chat` holders keep
// the access they already had — this change only widens, never removes.
export function hasZophielAccess(t: TierKey | null): boolean {
  return !!t && (t === "chat" || AUREON_TIERS.includes(t));
}
export function hasAureonAccess(t: TierKey | null): boolean { return !!t && AUREON_TIERS.includes(t); }
export function hasProAccess(t: TierKey | null): boolean { return !!t && PRO_TIERS.includes(t); }
export function hasMaximumAccess(t: TierKey | null): boolean { return !!t && MAXIMUM_TIERS.includes(t); }
export function hasEnterpriseOnlyAccess(t: TierKey | null): boolean { return !!t && PRO_TIERS.includes(t); }
/** @deprecated alias retained for legacy callers. */
export function hasEnterpriseAccess(t: TierKey | null): boolean { return hasProAccess(t); }



export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    productId: null,
    tierKey: null,
    subscriptionEnd: null,
    status: null,
    cancelAtPeriodEnd: false,
    loading: true,
    isPastDue: false,
    isTrialing: false,
    team: null,
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, productId: null, tierKey: null, subscriptionEnd: null, status: null, cancelAtPeriodEnd: false, loading: false, isPastDue: false, isTrialing: false, team: null });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        const contextStatus = (error as { context?: { status?: number } })?.context?.status;
        if (contextStatus === 401) {
          setState({ subscribed: false, productId: null, tierKey: null, subscriptionEnd: null, status: null, cancelAtPeriodEnd: false, loading: false, isPastDue: false, isTrialing: false, team: null });
          return;
        }
        throw error;
      }
      const tierKey = productToTier(data?.product_id ?? null);
      const status = data?.status ?? null;
      setState({
        subscribed: data?.subscribed ?? false,
        productId: data?.product_id ?? null,
        tierKey,
        subscriptionEnd: data?.subscription_end ?? null,
        status,
        cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
        loading: false,
        isPastDue: status === "past_due",
        isTrialing: status === "trialing",
        team: (data?.team as TeamGrant | null) ?? null,
      });
    } catch (e) {
      console.error("check-subscription error:", e);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const startCheckout = useCallback(async (tier: TierKey, term: "monthly" | "semiannual" = "monthly") => {
    setCheckoutLoading(true);
    try {
      const isLifetime = tier === "lifetime";
      // Regional / term plans are priced entirely server-side: we send the plan
      // identity and the visitor id, never an amount or a country.
      const regional = tier === "monthly_aureon" || tier === "monthly_pro";
      const body = regional
        ? { tier, term, visitorId: (() => { try { return localStorage.getItem("asherin_visitor_id") || undefined; } catch { return undefined; } })() }
        : { priceId: TIERS[tier].price_id, mode: isLifetime ? "payment" : "subscription" };
      const { data, error } = await supabase.functions.invoke("create-checkout", { body });
      if (error) throw error;

      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        // Use location.href to avoid popup blockers
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      console.error("create-checkout error:", e);
      // Surface error so UI can react
      setCheckoutLoading(false);
      throw e;
    }
    setCheckoutLoading(false);
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e) {
      console.error("customer-portal error:", e);
    }
  }, []);

  const upgradeSubscription = useCallback(async (targetTier: TierKey) => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: { action: "upgrade", targetTier },
      });
      if (error) throw error;
      // Refresh subscription state
      await checkSubscription();
    } catch (e) {
      console.error("upgrade error:", e);
      throw e;
    } finally {
      setCheckoutLoading(false);
    }
  }, [checkSubscription]);

  const startProTrial = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: { action: "start_pro_trial" },
      });
      if (error) throw error;
      await checkSubscription();
    } catch (e) {
      console.error("pro trial error:", e);
      throw e;
    } finally {
      setCheckoutLoading(false);
    }
  }, [checkSubscription]);

  const cancelSubscription = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: { action: "cancel" },
      });
      if (error) throw error;
      await checkSubscription();
    } catch (e) {
      console.error("cancel error:", e);
      throw e;
    } finally {
      setCheckoutLoading(false);
    }
  }, [checkSubscription]);

  const reactivateSubscription = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: { action: "reactivate" },
      });
      if (error) throw error;
      await checkSubscription();
    } catch (e) {
      console.error("reactivate error:", e);
      throw e;
    } finally {
      setCheckoutLoading(false);
    }
  }, [checkSubscription]);

  return (
    <SubscriptionContext.Provider value={{
      ...state,
      checkSubscription,
      startCheckout,
      openPortal,
      upgradeSubscription,
      startProTrial,
      cancelSubscription,
      reactivateSubscription,
      checkoutLoading,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
