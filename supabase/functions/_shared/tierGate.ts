// Server-side subscription tier enforcement.
// Use for premium features that cost the platform (not gated by BYOK).
//
//   import { requireTier } from "../_shared/tierGate.ts";
//   const gate = await requireTier(req, ["pro", "aureon", "lifetime"]);
//   if (!gate.ok) return gate.response;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCallerEmail, isAdminEmail } from "./adminGate.ts";

export type Tier = "free" | "chat" | "aureon" | "pro" | "lifetime";

function classifyProductId(pid: string | null | undefined): Tier {
  const s = (pid || "").toLowerCase();
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
  const admin = isAdminEmail(email);
  // Admin bypass — universal.
  if (admin) return { ok: true, tier: "lifetime", email, isAdmin: true };

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

  // Look up active subscription by email → user_id.
  const { data: userRow } = await sb
    .from("profiles")
    .select("user_id")
    .ilike("display_name", email)
    .maybeSingle();

  let userId = userRow?.user_id as string | undefined;
  if (!userId) {
    // Fall back to auth.users via admin API.
    const { data: au } = await (sb as any).auth.admin.listUsers({ page: 1, perPage: 1 });
    userId = au?.users?.find((u: any) => (u.email || "").toLowerCase() === email)?.id;
  }

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
