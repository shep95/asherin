// PRO / ADMIN gate — grants access when the caller is either:
//   - An admin email (ADMIN_EMAILS in constants.ts), OR
//   - Holds an active $79 Aureon Pro-class subscription in
//     public.user_subscriptions (subscription_type in the pro ladder,
//     status='active', not expired).
//
// Kept intentionally small and dependency-free (no zod, no zustand) so any
// edge function can import it without pulling extra weight.
//
// Used by axrlen-chat, axrlen-analyze, and the AXRLEN bridge inside
// Aureon/Asher chat.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCallerEmail, isAdminEmail } from "./adminGate.ts";

// Pro-class tiers per SubscriptionContext.tsx: PRO_TIERS.
export const PRO_SUBSCRIPTION_TYPES = new Set([
  "pro",
  "monthly_pro",
  "lifetime",
  "algorithm",
]);

export interface AxrlenAccess {
  granted: boolean;
  reason: "admin" | "pro" | "denied" | "anonymous";
  email: string | null;
  userId: string | null;
  tierType: string | null;
}

/**
 * Resolve AXRLEN access for the caller. Never throws — always returns a
 * decision. Anonymous callers are denied cleanly (no lookup attempted).
 */
export async function resolveAxrlenAccess(req: Request): Promise<AxrlenAccess> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return { granted: false, reason: "anonymous", email: null, userId: null, tierType: null };
  }

  const email = await getCallerEmail(req);
  if (isAdminEmail(email)) {
    return { granted: true, reason: "admin", email, userId: null, tierType: null };
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: udata } = await sb.auth.getUser(token);
    const userId = udata?.user?.id ?? null;
    if (!userId) {
      return { granted: false, reason: "anonymous", email, userId: null, tierType: null };
    }

    // Service-role read: RLS on user_subscriptions may block anon.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const nowIso = new Date().toISOString();
    const { data: subs } = await admin
      .from("user_subscriptions")
      .select("subscription_type, status, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    const hit = (subs || []).find((s) =>
      PRO_SUBSCRIPTION_TYPES.has(String(s.subscription_type || "").toLowerCase())
    );
    if (hit) {
      return { granted: true, reason: "pro", email, userId, tierType: hit.subscription_type };
    }
    return { granted: false, reason: "denied", email, userId, tierType: null };
  } catch (_e) {
    return { granted: false, reason: "denied", email, userId: null, tierType: null };
  }
}
