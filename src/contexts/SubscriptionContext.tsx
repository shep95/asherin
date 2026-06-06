import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Stripe product/price mapping
export const TIERS = {
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

/** Check if user has chat-only access */
export function hasChatAccess(tierKey: TierKey | null): boolean {
  return tierKey === "lifetime" || tierKey === "chat" || tierKey === "aureon" || tierKey === "pro";
}

/** Check if user has access to Zophiel Search, Imagine Intelligence, Notebooks (chat+ tiers) */
export function hasSearchAccess(tierKey: TierKey | null): boolean {
  return tierKey === "chat" || tierKey === "lifetime" || tierKey === "aureon" || tierKey === "pro";
}

/** Check if user has Aureon-tier ($199) access — required for NOMAD, Briefings, ZANOEM Design Lab, Vedic Strategy. Lifetime ($470) also grants this. */
export function hasAureonAccess(tierKey: TierKey | null): boolean {
  return tierKey === "aureon" || tierKey === "pro" || tierKey === "lifetime";
}

/** Check if user has pro-level access */
export function hasProAccess(tierKey: TierKey | null): boolean {
  return tierKey === "pro";
}

/** Check if user has enterprise-level access — required for Axrlen, Zeeion & Zerlal (admin only) */
export function hasEnterpriseOnlyAccess(tierKey: TierKey | null): boolean {
  return tierKey === "pro";
}

/** @deprecated Use hasEnterpriseOnlyAccess instead */
export function hasEnterpriseAccess(tierKey: TierKey | null): boolean {
  return hasEnterpriseOnlyAccess(tierKey);
}

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
