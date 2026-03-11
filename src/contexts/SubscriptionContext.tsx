import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Stripe product/price mapping
export const TIERS = {
  starter: {
    product_id: "prod_U8CahdrO3U5JxE",
    price_id: "price_1T9wBfRxgCpmPfiFgegrNIkk",
  },
  lifetime: {
    product_id: "prod_U74tK6VXkH6S5Z",
    price_id: "price_1T8qjNRxgCpmPfiFsv2lsvQq",
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
  advisor_monthly: {
    product_id: "prod_TzZlilj5l50ena",
    price_id: "price_1T1abVRxgCpmPfiFsZcq9ZNM",
  },
  advisor_annual: {
    product_id: "prod_TzZlU2MDFcXG7o",
    price_id: "price_1T1abXRxgCpmPfiFFyuty5i6",
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
}

interface SubscriptionContextValue extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  startCheckout: (tier: TierKey) => Promise<void>;
  openPortal: () => Promise<void>;
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
  checkSubscription: async () => {},
  startCheckout: async () => {},
  openPortal: async () => {},
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
  return tierKey === "lifetime" || tierKey === "chat" || tierKey === "aureon" || tierKey === "pro" || tierKey === "advisor_monthly" || tierKey === "advisor_annual";
}

/** Check if user has access to Zophiel Search (aureon+ tiers) */
export function hasSearchAccess(tierKey: TierKey | null): boolean {
  return tierKey === "aureon" || tierKey === "pro" || tierKey === "advisor_monthly" || tierKey === "advisor_annual";
}

/** Check if user has pro-level access (pro or advisor) */
export function hasProAccess(tierKey: TierKey | null): boolean {
  return tierKey === "pro" || tierKey === "advisor_monthly" || tierKey === "advisor_annual";
}

/** Check if user has advisor-level access */
export function hasAdvisorAccess(tierKey: TierKey | null): boolean {
  return tierKey === "advisor_monthly" || tierKey === "advisor_annual";
}

/** @deprecated Use hasAdvisorAccess instead */
export function hasEnterpriseAccess(tierKey: TierKey | null): boolean {
  return hasAdvisorAccess(tierKey);
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
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, productId: null, tierKey: null, subscriptionEnd: null, status: null, cancelAtPeriodEnd: false, loading: false });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      const tierKey = productToTier(data?.product_id ?? null);
      setState({
        subscribed: data?.subscribed ?? false,
        productId: data?.product_id ?? null,
        tierKey,
        subscriptionEnd: data?.subscription_end ?? null,
        status: data?.status ?? null,
        cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
        loading: false,
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
      if (data?.url) window.open(data.url, "_blank");
    } catch (e) {
      console.error("create-checkout error:", e);
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

  return (
    <SubscriptionContext.Provider value={{ ...state, checkSubscription, startCheckout, openPortal, checkoutLoading }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
