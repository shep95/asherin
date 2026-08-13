// Server-side subscription tier enforcement.
// Use for premium features that cost the platform (not gated by BYOK).
//
//   import { requireTier } from "../_shared/tierGate.ts";
//   const gate = await requireTier(req, ["pro", "aureon", "lifetime"]);
//   if (!gate.ok) return gate.response;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCallerEmail } from "./adminGate.ts";
import { isInternalProEmail } from "./identityHash.ts";

export type Tier = "free" | "chat" | "aureon" | "pro" | "lifetime";

// Explicit Stripe product ID → tier mapping. Substring matching does NOT
// work because real Stripe product IDs are opaque (e.g. prod_U1PuUztkmieRrE)
// and contain none of the tier keywords. Keep this in sync with
// src/contexts/SubscriptionContext.tsx#TIERS.
const PRODUCT_TIER_MAP: Record<string, Tier> = {
  prod_UTrNsrxIQGTBQR: "lifetime",
  prod_U4YWDDwSXK3SGO: "chat",
  prod_U1rtJ8HXSCtvqO: "aureon",
  prod_U1PuUztkmieRrE: "pro",
  prod_UjaQPixvFi3Qlr: "aureon",   // monthly_aureon ($18/mo)
  prod_UjaQFcAkQnTOm1: "pro",      // monthly_pro ($79/mo) — Vault, Zahten, premium
  prod_V226j5fQ5fSoD9: "aureon",   // Asherin — 6 month term
  prod_V2267gYsf3sRRn: "pro",      // Asherin Pro — 6 month term
  prod_aureon_algorithm: "lifetime",
};

function classifyProductId(pid: string | null | undefined): Tier {
  if (!pid) return "free";
  if (PRODUCT_TIER_MAP[pid]) return PRODUCT_TIER_MAP[pid];
  // Fallback: keyword match (legacy / future product IDs containing tier names)
  const s = pid.toLowerCase();
  if (s.includes("lifetime")) return "lifetime";
  if (s.includes("pro")) return "pro";
  if (s.includes("aureon")) return "aureon";
  if (s.includes("chat")) return "chat";
  return "free";
}

export interface TierResult {
  ok: boolean;
  tier: Tier;
  email: string | null;
  isAdmin: boolean;
  response?: Response;
}

export async function requireTier(
  req: Request,
  allowed: Tier[],
  corsHeaders: Record<string, string> = {},
): Promise<TierResult> {
  const email = await getCallerEmail(req);
  // Internal Pro grant. Resolves to "pro", NOT "lifetime": the client maps a
  // lifetime-shaped grant through a different branch and would lock these
  // accounts out of the $79 surfaces this grant exists to open. Same tier a
  // paid monthly_pro seat receives — no more, no less.
  if (isInternalProEmail(email)) return { ok: true, tier: "pro", email, isAdmin: true };

  if (!email) {
    return {
      ok: false,
      tier: "free",
      email: null,
      isAdmin: false,
      response: new Response(
        JSON.stringify({ error: "UNAUTHENTICATED", message: "Sign in required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Look up user_id from auth.users via service role (handles all signup methods).
  let userId: string | undefined;
  try {
    const { data: au } = await (sb as any).rpc("get_user_id_by_email", { _email: email });
    userId = (typeof au === "string" && au) || undefined;
  } catch { /* fall through */ }
  // No listUsers() fallback — that path silently downgraded paid users to
  // "free" past the perPage cap. If the RPC fails we fail safe: tier stays
  // "free" only when there is genuinely no matching auth user.

  let tier: Tier = "free";
  if (userId) {
    const { data: sub } = await sb
      .from("user_subscriptions")
      .select("product_id,status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    tier = classifyProductId(sub?.product_id);
  }

  const ok = allowed.includes(tier);
  if (ok) return { ok: true, tier, email, isAdmin: false };

  return {
    ok: false,
    tier,
    email,
    isAdmin: false,
    response: new Response(
      JSON.stringify({
        error: "TIER_REQUIRED",
        message: `This feature requires one of: ${allowed.join(", ")}. Current tier: ${tier}.`,
        required: allowed,
        current: tier,
      }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    ),
  };
}
