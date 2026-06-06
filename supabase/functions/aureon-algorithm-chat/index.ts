// AUREON ALGORITHM CHAT — proxy to the live Aureon-LLM Railway endpoint.
// Tiers:
//   • Anonymous / free        : 10 messages / 2 hours per (IP + browser fingerprint)
//   • Authenticated paid sub  : 20 messages / hour per user_id
//   • Admin (ashernewtonx@gmail.com): unlimited
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const RAILWAY_URL = "https://web-production-f9b81.up.railway.app/api/chat";
const ALGORITHM_PRICE_ID = "price_1TfC3oRxgCpmPfiFniV2cXAu";
const ADMIN_EMAIL = "ashernewtonx@gmail.com";

const FREE_LIMIT = 10;
const FREE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const PAID_LIMIT = 20;
const PAID_WINDOW_MS = 60 * 60 * 1000;     // 1 hour

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "anon";
}

async function consume(
  admin: ReturnType<typeof createClient>,
  bucketKey: string,
  scope: "anon" | "user",
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const { data } = await admin
    .from("algorithm_chat_usage")
    .select("count, window_end")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  const existing = data as { count: number; window_end: string } | null;
  const windowEndMs = existing ? new Date(existing.window_end).getTime() : 0;

  if (!existing || windowEndMs < now) {
    const newEnd = new Date(now + windowMs).toISOString();
    await admin.from("algorithm_chat_usage").upsert(
      {
        bucket_key: bucketKey,
        scope,
        count: 1,
        window_start: new Date(now).toISOString(),
        window_end: newEnd,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "bucket_key" },
    );
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: windowEndMs };
  }

  await admin
    .from("algorithm_chat_usage")
    .update({ count: existing.count + 1, updated_at: new Date(now).toISOString() })
    .eq("bucket_key", bucketKey);

  return { ok: true, remaining: limit - existing.count - 1, resetAt: windowEndMs };
}

async function hasActiveAlgorithmSub(stripeKey: string, email: string): Promise<boolean> {
  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return false;
    const subs = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "active",
      price: ALGORITHM_PRICE_ID,
      limit: 1,
    });
    return subs.data.length > 0;
  } catch (e) {
    console.error("[algorithm-chat] stripe lookup failed", e);
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, fp } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Resolve identity
    let userId: string | null = null;
    let userEmail: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const { data } = await admin.auth.getUser(token);
      if (data.user) {
        userId = data.user.id;
        userEmail = data.user.email ?? null;
      }
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL;
    let tier: "admin" | "paid" | "free" = "free";

    if (isAdmin) {
      tier = "admin";
    } else if (userId && userEmail && stripeKey) {
      const paid = await hasActiveAlgorithmSub(stripeKey, userEmail);
      if (paid) tier = "paid";
    }

    // Rate-limit
    let gate = { ok: true, remaining: -1, resetAt: 0 };
    if (tier === "free") {
      const ip = getClientIp(req);
      const key = `anon:${ip}::${(fp || "").slice(0, 64)}`;
      gate = await consume(admin, key, "anon", FREE_LIMIT, FREE_WINDOW_MS);
    } else if (tier === "paid") {
      gate = await consume(admin, `user:${userId}`, "user", PAID_LIMIT, PAID_WINDOW_MS);
    }

    if (!gate.ok) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          tier,
          message:
            tier === "free"
              ? "Free limit reached (10 / 2 hours). Upgrade for 20 / hour, or wait for the window to reset."
              : "Hourly limit reached (20 / hour). Resets soon.",
          remaining: 0,
          resetAt: gate.resetAt,
          upgrade: tier === "free",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Proxy to Railway
    const upstream = await fetch(RAILWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: "upstream_failed", status: upstream.status, detail: text.slice(0, 400) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let upstreamJson: { reply?: string } = {};
    try { upstreamJson = JSON.parse(text); } catch { upstreamJson = { reply: text }; }

    return new Response(
      JSON.stringify({
        reply: upstreamJson.reply ?? "(empty)",
        tier,
        remaining: gate.remaining,
        resetAt: gate.resetAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
