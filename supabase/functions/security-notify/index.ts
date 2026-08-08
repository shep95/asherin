/**
 * SECURITY NOTIFY — device delivery for account-security events.
 *
 * The security-notification preference rows existed long before anything read
 * them: an event was written to the audit trail and the alert died there. This
 * function is the missing transport. It owns device enrolment (so a user who
 * never opens Rideshare Guardian still has a registered laptop and phone) and
 * it is the only place a security event fans out.
 *
 * Actions:
 *   vapid            → public VAPID key (public by design, no auth)
 *   push.subscribe   → register this browser/device for alerts
 *   push.unsubscribe → drop one endpoint
 *   push.list        → the caller's registered devices (never other users')
 *   push.test        → deliver a real push to the caller's devices
 *   event            → log a security event and fan it out to push + email
 *
 * Every action is bound to the caller's own auth.uid(). No action accepts a
 * user id from the request body.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/webPush.ts";
import { notifyIntel, type IntelSeverity } from "../_shared/intelNotify.ts";
import { enrichActor, extractClientIp, actorSections, type ActorIntel } from "../_shared/actorIntel.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Event catalogue. Each security event names the preference column that gates
 * it, so a user who muted "failed logins" is not woken by one. Unknown event
 * types are rejected rather than silently delivered — an unrecognised alert is
 * a code defect, not a reason to buzz someone's phone.
 */
const EVENTS: Record<string, { prefKey: string; title: string; severity: IntelSeverity }> = {
  new_device_login: { prefKey: "new_device_login", title: "New device sign-in", severity: "critical" },
  failed_login: { prefKey: "failed_login_attempts", title: "Failed sign-in attempts", severity: "notable" },
  password_change: { prefKey: "password_change", title: "Password changed", severity: "critical" },
  mfa_setup: { prefKey: "mfa_change", title: "Two-factor authentication enabled", severity: "notable" },
  mfa_disable: { prefKey: "mfa_change", title: "Two-factor authentication removed", severity: "critical" },
  session_revoke: { prefKey: "session_revocation", title: "Session revoked", severity: "notable" },
  recovery_code_used: { prefKey: "recovery_code_usage", title: "Recovery code used", severity: "critical" },
};

/** Absent preferences must not silence a security alert — default to loud. */
const PREF_DEFAULT = true;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, cors);
  }
  const action = str(body.action, 40);

  if (action === "vapid") {
    return json({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || null }, 200, cors);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
  if (uErr || !user) return json({ error: "unauthorized" }, 401, cors);
  const userId = user.id;

  const sb = admin();

  try {
    switch (action) {
      case "push.subscribe": {
        const sub = (body.subscription || {}) as Record<string, any>;
        const endpoint = str(sub.endpoint, 600);
        const p256dh = str(sub?.keys?.p256dh, 200);
        const auth = str(sub?.keys?.auth, 200);
        if (!endpoint || !p256dh || !auth) return json({ error: "invalid_subscription" }, 400, cors);
        // Push endpoints are always https origins operated by the browser
        // vendor. Anything else is a forged subscription aimed at turning this
        // function into an outbound request proxy.
        if (!/^https:\/\//.test(endpoint)) return json({ error: "invalid_subscription" }, 400, cors);

        const { error } = await sb.from("push_subscriptions").upsert({
          user_id: userId,
          endpoint,
          p256dh,
          auth_key: auth,
          user_agent: str(body.userAgent, 300),
          label: str(body.label, 80) || null,
          platform: str(body.platform, 40) || null,
          last_used_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });
        if (error) throw error;
        return json({ ok: true }, 200, cors);
      }

      case "push.unsubscribe": {
        const endpoint = str(body.endpoint, 600);
        if (!endpoint) return json({ error: "endpoint_required" }, 400, cors);
        await sb.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
        return json({ ok: true }, 200, cors);
      }

      case "push.list": {
        const { data } = await sb
          .from("push_subscriptions")
          .select("id, endpoint, label, platform, user_agent, created_at, last_used_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        return json({ devices: data ?? [] }, 200, cors);
      }

      case "push.test": {
        const { data: subs } = await sb
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth_key")
          .eq("user_id", userId);
        if (!subs?.length) return json({ ok: false, delivered: 0, reason: "no_devices" }, 200, cors);

        const results = await Promise.allSettled(subs.map((s) =>
          sendWebPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth_key: s.auth_key },
            {
              title: "Asherin · Security",
              body: "Test alert delivered. This device will receive security notifications.",
              tag: `security-test-${Date.now()}`,
              url: "/dashboard",
            },
            { urgency: "high" },
          ).then((r) => ({ r, id: s.id })),
        ));

        let delivered = 0;
        const dead: string[] = [];
        const errors: string[] = [];
        for (const res of results) {
          if (res.status !== "fulfilled") { errors.push("transport_error"); continue; }
          if (res.value.r.ok) delivered++;
          // 404/410 means the browser discarded the subscription. Pruning here
          // keeps the device list honest instead of showing phantom laptops.
          if (res.value.r.gone) dead.push(res.value.id);
          if (!res.value.r.ok) errors.push(res.value.r.error || `status_${res.value.r.status}`);
        }
        if (dead.length) await sb.from("push_subscriptions").delete().in("id", dead);
        return json({ ok: delivered > 0, delivered, pruned: dead.length, errors: errors.slice(0, 3) }, 200, cors);
      }

      case "event":
      case "dispatch_recent_password_change": {
        // Two paths funnel here. `event` fires live: the actor is whoever
        // just called this function, so IP and UA come from THIS request's
        // headers — a client-supplied "location" or "device" is untrusted
        // and only used as a last resort. `dispatch_recent_password_change`
        // reconstructs a past event for the owner: the actor is the most
        // recent live session on the account, correlated to auth.users.
        // updated_at (the timestamp Supabase bumps on a password change).
        const isRetro = action === "dispatch_recent_password_change";
        const type = isRetro ? "password_change" : str(body.type, 40);
        const spec = EVENTS[type];
        if (!spec) return json({ error: "unknown_event" }, 400, cors);

        let actor: ActorIntel;
        let occurredAt: Date;
        let outcome = str(body.outcome, 20) || "success";

        if (isRetro) {
          const [{ data: userRow }, { data: sessRows }] = await Promise.all([
            sb.auth.admin.getUserById(userId),
            sb.from("user_sessions")
              .select("ip_address, browser, os, device_type, city, region, country, latitude, longitude, created_at, last_active_at")
              .eq("user_id", userId)
              .order("last_active_at", { ascending: false, nullsFirst: false })
              .limit(1),
          ]);
          const updatedAt = userRow?.user?.updated_at ? new Date(userRow.user.updated_at) : new Date();
          occurredAt = updatedAt;
          const s = sessRows?.[0];
          const rawIp = str(s?.ip_address, 64) || null;
          const ua = [s?.browser, s?.os, s?.device_type].filter(Boolean).join(" ");
          actor = await enrichActor(rawIp, ua);
          // Prefer live enrichment; fall back to the session's stored geo so
          // the email is never empty when ip-api is unreachable.
          if (!actor.city && s?.city) actor.city = s.city as string;
          if (!actor.region && s?.region) actor.region = s.region as string;
          if (!actor.country && s?.country) actor.country = s.country as string;
          if (actor.latitude == null && typeof s?.latitude === "number") actor.latitude = s.latitude as number;
          if (actor.longitude == null && typeof s?.longitude === "number") actor.longitude = s.longitude as number;
          if (actor.latitude != null && actor.longitude != null && !actor.satelliteUrl) {
            const { satelliteExportUrl } = await import("../_shared/actorIntel.ts");
            actor.satelliteUrl = satelliteExportUrl(actor.latitude, actor.longitude);
            actor.mapsUrl = `/dashboard/maps?lat=${actor.latitude.toFixed(5)}&lon=${actor.longitude.toFixed(5)}&z=15`;
          }
        } else {
          occurredAt = new Date();
          const ip = extractClientIp(req.headers);
          const ua = req.headers.get("user-agent") || "";
          actor = await enrichActor(ip, ua);
        }

        const geoLocation = [actor.city, actor.region, actor.country].filter(Boolean).join(", ") || null;
        const description = isRetro
          ? `The account password was changed at ${occurredAt.toUTCString()}. This alert reconstructs the actor from the most recent authenticated session on the account.`
          : (str(body.description, 300) || spec.title);

        // 1. Audit trail first: survives any transport failure.
        await sb.from("account_activity_log").insert({
          user_id: userId,
          event_type: type === "failed_login" ? "failed_login" : type,
          description,
          device_info: actor.device,
          location: geoLocation,
          ip_address: actor.ip,
          outcome,
          metadata: {
            actor: {
              ip: actor.ip,
              browser: actor.browser,
              os: actor.os,
              deviceType: actor.deviceType,
              isp: actor.isp,
              org: actor.org,
              asn: actor.asn,
              country: actor.country,
              region: actor.region,
              city: actor.city,
              latitude: actor.latitude,
              longitude: actor.longitude,
              timezone: actor.timezone,
              mobile: actor.mobile,
              proxy: actor.proxy,
              hosting: actor.hosting,
              reverseDns: actor.reverseDns,
              threatBadges: actor.threatBadges,
            },
            occurredAt: occurredAt.toISOString(),
            retro: isRetro,
          },
        });

        // 2. Consult the user's own gate for this event class.
        const { data: prefs } = await sb
          .from("security_notification_prefs")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        const eventOn = prefs ? (prefs as Record<string, unknown>)[spec.prefKey] !== false : PREF_DEFAULT;
        const pushOn = prefs ? (prefs as Record<string, unknown>).notify_push !== false : PREF_DEFAULT;
        const emailOn = prefs ? (prefs as Record<string, unknown>).notify_email !== false : PREF_DEFAULT;
        if (!eventOn) return json({ ok: true, suppressed: "event_muted" }, 200, cors);

        // 3. Fan out. Idempotency is content-derived and minute-bucketed for
        // live events; retro dispatches key off the event timestamp so the
        // owner cannot accidentally spam themselves with the same reconstruction.
        const bucket = isRetro
          ? Math.floor(occurredAt.getTime() / 60_000)
          : Math.floor(Date.now() / 60_000);

        const { sections: actorRows, findings } = actorSections(actor);
        const sections = [
          { label: "Event", value: `${spec.title} · ${occurredAt.toUTCString()}` },
          ...actorRows,
        ];
        if (isRetro) sections.push({ label: "Reconstruction", value: "Actor derived from most recent authenticated session on the account." });

        const delivery = await notifyIntel({
          userId,
          userEmail: user.email ?? null,
          kind: "security",
          severity: spec.severity,
          title: isRetro ? `${spec.title} · reconstructed actor` : spec.title,
          body: description,
          source: "Asherin Security",
          url: "/dashboard/vault",
          sections,
          findings,
          imageUrl: actor.satelliteUrl ?? undefined,
          secondaryCta: {
            label: "Not you? Lock the account",
            url: "https://asherin.com/dashboard/vault?panic=1",
          },
          idempotencyKey: `security-${type}-${userId}-${bucket}${isRetro ? "-retro" : ""}`,
          skipPush: !pushOn,
          skipEmail: !emailOn,
        });

        return json({
          ok: true,
          channels: delivery.channels,
          actor: {
            ip: actor.ip,
            city: actor.city,
            country: actor.country,
            isp: actor.isp,
            device: actor.device,
            badges: actor.threatBadges,
            satellite: actor.satelliteUrl,
          },
        }, 200, cors);
      }

      default:
        return json({ error: "unknown_action" }, 400, cors);
    }
  } catch (e) {
    console.error("security_notify_error", action, e instanceof Error ? e.message : e);
    return json({ error: "internal_error" }, 500, cors);
  }
});
