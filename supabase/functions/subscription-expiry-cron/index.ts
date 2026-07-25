// subscription-expiry-cron
// Runs daily. Finds any subscription (user_subscriptions + granted_subscriptions)
// expiring in EXACTLY 3 days and sends the "subscription-ending" email.
// Dedupe is enforced by an idempotencyKey derived from the row id + expires_at,
// so re-runs within the same window do not re-send.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SUB-EXPIRY-CRON] ${step}${detailsStr}`);
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function tierToPlanName(tier: string | null | undefined) {
  if (!tier) return "Asherin";
  const t = tier.toLowerCase();
  if (t.includes("life")) return "Asherin Lifetime";
  if (t.includes("pro")) return "Asherin Pro";
  if (t.includes("asherin")) return "Asherin";
  if (t.includes("chat")) return "Asherin Chat";
  if (t.includes("enterprise")) return "Asherin Enterprise";
  return `Asherin ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // Window: 3-day mark (2.5 → 3.5 days from now). One run/day catches it once.
    const now = Date.now();
    const windowStart = new Date(now + 2.5 * DAY_MS).toISOString();
    const windowEnd   = new Date(now + 3.5 * DAY_MS).toISOString();
    logStep("Scanning window", { windowStart, windowEnd });

    let sent = 0;
    let skipped = 0;
    const failures: any[] = [];

    async function send(recipientEmail: string, planName: string, expiresAtIso: string, idKey: string, name?: string | null) {
      const daysLeft = Math.max(1, Math.ceil((new Date(expiresAtIso).getTime() - now) / DAY_MS));
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "subscription-ending",
          recipientEmail,
          idempotencyKey: idKey,
          templateData: {
            name: name || null,
            planName,
            daysLeft,
            endsOn: formatDate(expiresAtIso),
          },
        },
      });
      if (error) {
        failures.push({ recipientEmail, error: String((error as any)?.message || error) });
      } else {
        sent++;
      }
    }

    // ── 1) user_subscriptions (active, expiring in 3 days) ──────────────────
    const { data: us, error: usErr } = await supabase
      .from("user_subscriptions")
      .select("id, user_id, subscription_type, status, expires_at")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .gte("expires_at", windowStart)
      .lt("expires_at", windowEnd);

    if (usErr) throw usErr;
    logStep("user_subscriptions matches", { count: us?.length || 0 });

    for (const row of us ?? []) {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(row.user_id);
        const email = u?.user?.email;
        if (!email) { skipped++; continue; }
        const dayKey = (row.expires_at as string).slice(0, 10);
        await send(
          email,
          tierToPlanName(row.subscription_type),
          row.expires_at as string,
          `sub-ending-3d-${row.id}-${dayKey}`,
          (u?.user?.user_metadata as any)?.full_name || null,
        );
      } catch (e) {
        failures.push({ row_id: row.id, error: String(e) });
      }
    }

    // ── 2) granted_subscriptions (email-keyed, active, expiring in 3 days) ──
    const { data: gs, error: gsErr } = await supabase
      .from("granted_subscriptions")
      .select("id, email, tier, active, expires_at")
      .eq("active", true)
      .not("expires_at", "is", null)
      .gte("expires_at", windowStart)
      .lt("expires_at", windowEnd);

    if (gsErr) throw gsErr;
    logStep("granted_subscriptions matches", { count: gs?.length || 0 });

    for (const row of gs ?? []) {
      try {
        if (!row.email) { skipped++; continue; }
        const dayKey = (row.expires_at as string).slice(0, 10);
        await send(
          row.email as string,
          tierToPlanName(row.tier),
          row.expires_at as string,
          `sub-ending-3d-grant-${row.id}-${dayKey}`,
        );
      } catch (e) {
        failures.push({ row_id: row.id, error: String(e) });
      }
    }

    logStep("Done", { sent, skipped, failures: failures.length });

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, failures }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    logStep("ERROR", { error: String(e) });
    return new Response(
      JSON.stringify({ ok: false, error: String((e as any)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
