import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Stripe product/price mapping.
// NOTE: monthly_aureon ($18/mo) and monthly_pro ($399/mo) are the active subscription
// products. The legacy one-time tiers (chat / aureon / pro / lifetime / algorithm) are
// retained so existing subscribers and grant records continue to resolve, but they are
// no longer offered for new purchase.
//
// TODO(stripe): replace the monthly_aureon / monthly_pro price_id placeholders below
// with real Stripe Price IDs ($18/mo + $399/mo recurring) before launching checkout.
export const TIERS = {
  monthly_aureon: {
    product_id: "prod_UjaQPixvFi3Qlr",
    price_id: "price_1Tk7FyRxgCpmPfiF4vZebmnE",
  },
  monthly_pro: {
    product_id: "prod_UjaQFcAkQnTOm1",
    price_id: "price_1Tk7FzRxgCpmPfiFlkJig5Bf",
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
}

interface SubscriptionContextValue extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  startCheckout: (tier: TierKey) => Promise<void>;
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

function productToTier(productId: string | null): TierKey | null {
  if (!productId) return null;
  for (const [key, val] of Object.entries(TIERS)) {
    if (val.product_id === productId) return key as TierKey;
  }
  return null;
}

// ── Access helpers ───────────────────────────────────────────────────────────
// NOTE: Aureon currently keeps gating permissive at the runtime level while the
// new monthly subscription products are wired up in Stripe. Display, copy and
// pricing now reflect the $18 / $399 model, but every authenticated user can
// still reach every view. Flip these helpers to real checks once monthly
// price IDs and webhook → tier mapping are in place.
export function hasChatAccess(_tierKey: TierKey | null): boolean { return true; }
export function hasSearchAccess(_tierKey: TierKey | null): boolean { return true; }
export function hasAureonAccess(_tierKey: TierKey | null): boolean { return true; }
export function hasProAccess(_tierKey: TierKey | null): boolean { return true; }
export function hasEnterpriseOnlyAccess(_tierKey: TierKey | null): boolean { return true; }
/** @deprecated Retained for legacy callers — always returns true. */
export function hasEnterpriseAccess(_tierKey: TierKey | null): boolean { return true; }


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
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, productId: null, tierKey: null, subscriptionEnd: null, status: null, cancelAtPeriodEnd: false, loading: false, isPastDue: false, isTrialing: false });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
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

  const startCheckout = useCallback(async (tier: TierKey) => {
    setCheckoutLoading(true);
    try {
      const isLifetime = tier === "lifetime";
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: TIERS[tier].price_id, mode: isLifetime ? "payment" : "subscription" },
      });
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
