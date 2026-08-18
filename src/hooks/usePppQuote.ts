import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BASE_CENTS, type PriceLineId, type Term } from "@/lib/pricing/ppp";

export interface PppQuote {
  country: string | null;
  multiplier: number;
  vpnSuspected: boolean;
  reasons: string[];
  quote: Record<string, Record<string, { cents: number; baseCents: number }>>;
  loading: boolean;
}

const VISITOR_KEY = "asherin_visitor_id";

/** Stable per-browser id so the integrity window survives reloads and sign-in. */
function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const fresh = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 18);
  }
}

const FULL_PRICE: PppQuote["quote"] = Object.fromEntries(
  (Object.keys(BASE_CENTS) as PriceLineId[]).map((id) => [
    id,
    {
      monthly: { cents: BASE_CENTS[id].monthly, baseCents: BASE_CENTS[id].monthly },
      semiannual: { cents: BASE_CENTS[id].semiannual, baseCents: BASE_CENTS[id].semiannual },
    },
  ]),
);

/**
 * Regional pricing quote.
 *
 * Re-probes every 5 minutes while the page is open: the whole point of the
 * integrity window is that flipping a VPN *after* the first quote still gets
 * caught before checkout recomputes the price.
 */
export function usePppQuote(): PppQuote {
  const [state, setState] = useState<PppQuote>({
    country: null,
    multiplier: 1,
    vpnSuspected: false,
    reasons: [],
    quote: FULL_PRICE,
    loading: true,
  });
  const alive = useRef(true);
  const retry = useRef<number | null>(null);

  const probe = useCallback(async (attempt = 0) => {
    try {
      const { data, error } = await supabase.functions.invoke("geo-guard", {
        body: { visitorId: visitorId() },
      });
      if (error) throw error;
      if (!alive.current || !data?.quote) return;
      setState({
        country: data.country ?? null,
        multiplier: typeof data.multiplier === "number" ? data.multiplier : 1,
        vpnSuspected: !!data.vpnSuspected,
        reasons: Array.isArray(data.reasons) ? data.reasons : [],
        quote: data.quote,
        loading: false,
      });
    } catch {
      // Transient edge-runtime degradation (503) must never break the page:
      // hold full price and retry with backoff — 2s, 6s, 18s, then give up
      // until the next scheduled probe.
      if (!alive.current) return;
      setState((s) => ({ ...s, loading: false }));
      if (attempt < 3) {
        retry.current = window.setTimeout(
          () => probe(attempt + 1),
          2000 * 3 ** attempt,
        );
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    probe();
    const id = window.setInterval(() => probe(), 5 * 60 * 1000);
    return () => {
      alive.current = false;
      window.clearInterval(id);
      if (retry.current) window.clearTimeout(retry.current);
    };
  }, [probe]);


  return state;
}

export function quoteCents(
  q: PppQuote,
  tier: PriceLineId,
  term: Term,
): { cents: number; baseCents: number } {
  return q.quote?.[tier]?.[term] ?? FULL_PRICE[tier][term];
}
