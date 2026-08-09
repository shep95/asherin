// ═══════════════════════════════════════════════════════════════════════════
// sentinel-beacon — the only door a background service worker may knock on.
//
// A service worker cannot read the app's auth session (it lives in
// localStorage, which workers cannot touch), and smuggling a JWT into
// IndexedDB so a worker can replay it would turn a background task into a
// long-lived credential store. So the worker gets its own least-privilege
// credential instead: an opaque random device token, minted once by the page,
// stored only in IndexedDB, and held here only as a SHA-256 hash.
//
// That token buys exactly two things and nothing else:
//   • report presence (position + link facts) for this device's owner,
//   • ask the unattended sweep to become due now.
// It cannot read intelligence, cannot enumerate devices, cannot change
// settings. Losing it leaks a coarse position for one device until revoked.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { recordArrival } from "../_shared/areaSentinel.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const json = (b: unknown, s: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const clampStr = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const action = String(body.action || "");
  const db = admin();

  try {
    // ── Registration: the ONE call that needs a real session ───────────────
    // The page is authenticated, so it mints the token here and hands the
    // opaque half to the worker. The token itself is never stored server-side.
    if (action === "register") {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data: { user } } = await anon.auth.getUser(authHeader.slice(7));
      if (!user) return json({ error: "unauthorized" }, 401, cors);

      const token = clampStr(body.token, 200);
      if (!token || token.length < 32) return json({ error: "weak_token" }, 400, cors);
      const token_hash = await sha256(token);

      await db.from("sentinel_devices").upsert({
        user_id: user.id,
        token_hash,
        label: clampStr(body.label, 80),
        platform: clampStr(body.platform, 60),
        revoked: false,
      }, { onConflict: "token_hash" });
      await db.from("sentinel_cron_state").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
      await db.from("sentinel_presence").upsert(
        { user_id: user.id, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
      return json({ ok: true }, 200, cors);
    }

    // ── Heartbeat from the background worker ───────────────────────────────
    if (action === "beacon") {
      const token = clampStr(body.token, 200);
      if (!token) return json({ error: "no_token" }, 401, cors);
      const token_hash = await sha256(token);
      const { data: dev } = await db.from("sentinel_devices")
        .select("id,user_id,revoked").eq("token_hash", token_hash).maybeSingle();
      if (!dev || dev.revoked) return json({ error: "unauthorized" }, 401, cors);

      const lat = Number(body.lat), lng = Number(body.lng);
      const hasFix = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      const nowIso = new Date().toISOString();

      const patch: Record<string, unknown> = {
        user_id: dev.user_id,
        link_type: clampStr(body.linkType, 40),
        effective_type: clampStr(body.effectiveType, 20),
        last_source: clampStr(body.source, 30) || "worker",
        last_seen_at: nowIso,
        updated_at: nowIso,
      };
      // A fix from the worker has to update the arrival latch too, not just the
      // coordinates. Writing lat/lng while leaving place_key stale would let a
      // user cross into a new cell with the tab closed and have the server
      // still believe they never moved — the closed-tab version of the bug.
      let arrivedNew = false;
      if (hasFix) {
        const st = await recordArrival(db, dev.user_id, lat, lng, {
          accuracy: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null,
          link_type: patch.link_type,
          effective_type: patch.effective_type,
          last_source: patch.last_source,
        });
        arrivedNew = st.arrived;
      } else {
        await db.from("sentinel_presence").upsert(patch, { onConflict: "user_id" });
      }

      await db.from("sentinel_devices").update({ last_beacon_at: nowIso }).eq("id", dev.id);

      // ── Fleet row: keeps this device findable from the operator's other
      // devices while its tab is closed. Only fields the worker can honestly
      // carry are written; a missing battery leaves the last one untouched
      // rather than blanking it, and the timestamp stays the page's reading
      // time so the UI can age it correctly instead of showing it as fresh.
      const meshDeviceId = clampStr(body.meshDeviceId, 120);
      if (meshDeviceId) {
        const meshPatch: Record<string, unknown> = {
          last_source: "worker",
          link_type: clampStr(body.linkType, 40),
          effective_type: clampStr(body.effectiveType, 20),
          last_seen_at: nowIso,
          updated_at: nowIso,
        };
        const pct = Number(body.batteryPct);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
          meshPatch.battery_pct = Math.round(pct);
          meshPatch.battery_charging = typeof body.batteryCharging === "boolean" ? body.batteryCharging : null;
          const bAt = Number(body.batteryAt);
          meshPatch.battery_at = Number.isFinite(bAt) && bAt > 0 ? new Date(bAt).toISOString() : nowIso;
        }
        if (hasFix) {
          meshPatch.lat = lat;
          meshPatch.lng = lng;
          meshPatch.accuracy = Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null;
          meshPatch.fix_at = nowIso;
        }
        const { data: existing } = await db.from("mesh_devices")
          .select("id").eq("user_id", dev.user_id).eq("device_id", meshDeviceId).maybeSingle();
        if (existing) {
          await db.from("mesh_devices").update(meshPatch).eq("id", existing.id);
        } else {
          // First contact from a worker that outlived its page: create the row
          // so a device lost before it ever reported in-page is still on the
          // roster. The page fills in label/emails on its next boot.
          await db.from("mesh_devices").insert({
            ...meshPatch,
            user_id: dev.user_id,
            device_id: meshDeviceId,
            label: clampStr(body.label, 80),
            form_factor: "unknown",
          });
        }
        await db.from("sentinel_devices").update({ mesh_device_id: meshDeviceId }).eq("id", dev.id);
      }

      // A device that just reported a *new* position deserves an immediate
      // sweep rather than waiting out the interval — that is the whole point
      // of a background heartbeat. The server tick now runs every minute, so
      // "due now" is due within the minute rather than within the quarter hour.
      if (hasFix) {
        await db.from("sentinel_cron_state")
          .upsert({ user_id: dev.user_id, next_due_at: nowIso }, { onConflict: "user_id" });
      }
      return json({ ok: true, fix: hasFix, arrived: arrivedNew }, 200, cors);

    }

    return json({ error: "unknown_action" }, 400, cors);
  } catch (e) {
    console.error("beacon_error", action, e instanceof Error ? e.message : e);
    return json({ error: "beacon_failed" }, 500, cors);
  }
});
