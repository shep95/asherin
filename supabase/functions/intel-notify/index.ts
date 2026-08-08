// ═══════════════════════════════════════════════════════════════════════════
// intel-notify — client-facing entry to the intelligence alert bus.
//
// Actions:
//   emit      → announce an intelligence product produced in the browser
//               (contact OSINT, Zophiel report, watchlist hit)
//   test      → send the caller a self-test alert on every enabled channel
//   prefs.get → current channel/severity preferences
//   prefs.set → update them
//
// Every action is bound to the caller's own auth.uid(). The body cannot name a
// recipient: a user can only ever notify themselves, so this endpoint can never
// be turned into a way to push notifications at somebody else.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notifyIntel, type IntelSeverity } from "../_shared/intelNotify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const SEVERITIES: IntelSeverity[] = ["info", "notable", "critical"];

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, cors);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
  if (uErr || !user) return json({ error: "unauthorized" }, 401, cors);

  const action = String(body.action || "");

  try {
    switch (action) {
      case "prefs.get": {
        const { data } = await admin()
          .from("intel_notification_prefs")
          .select("push_enabled, email_enabled, in_app_enabled, min_severity")
          .eq("user_id", user.id)
          .maybeSingle();
        return json({
          prefs: data ?? { push_enabled: true, email_enabled: true, in_app_enabled: true, min_severity: "info" },
        }, 200, cors);
      }

      case "prefs.set": {
        const p = (body.prefs || {}) as Record<string, unknown>;
        const min = SEVERITIES.includes(String(p.min_severity) as IntelSeverity)
          ? String(p.min_severity) : "info";
        const { error } = await admin().from("intel_notification_prefs").upsert({
          user_id: user.id,
          push_enabled: p.push_enabled !== false,
          email_enabled: p.email_enabled !== false,
          in_app_enabled: p.in_app_enabled !== false,
          min_severity: min,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw error;
        return json({ ok: true }, 200, cors);
      }

      case "emit": {
        const title = str(body.title, 140);
        if (!title) return json({ error: "title_required" }, 400, cors);
        const severity = SEVERITIES.includes(String(body.severity) as IntelSeverity)
          ? String(body.severity) as IntelSeverity : "info";
        const sections = Array.isArray(body.sections)
          ? (body.sections as unknown[]).slice(0, 12).map((s) => {
              const o = (s || {}) as Record<string, unknown>;
              return { label: str(o.label, 60), value: str(o.value, 400) };
            })
          : [];
        const findings = Array.isArray(body.findings)
          ? (body.findings as unknown[]).slice(0, 12).map((f) => str(f, 300)).filter(Boolean)
          : [];

        const result = await notifyIntel({
          userId: user.id,
          userEmail: user.email ?? null,
          kind: str(body.kind, 40) || "intel",
          severity,
          title,
          body: str(body.body, 600),
          subjectName: str(body.subject_name, 120) || null,
          source: str(body.source, 60) || "Asherin Intelligence",
          url: str(body.url, 300) || null,
          sections,
          findings,
          idempotencyKey: str(body.idempotency_key, 200) || null,
        });
        return json(result, 200, cors);
      }

      case "test": {
        // A self-test must be distinguishable from a real alert but must travel
        // the identical path, or it proves nothing about the real one.
        const result = await notifyIntel({
          userId: user.id,
          userEmail: user.email ?? null,
          kind: "selftest",
          severity: "notable",
          title: "Alert channel self-test",
          body: "This is a self-test of your intelligence alert channels. If it reached your screen, your device, and your inbox, the delivery path is healthy end to end.",
          subjectName: user.email ?? "you",
          source: "Asherin Intelligence",
          url: "/dashboard",
          sections: [
            { label: "In-app", value: "Delivered if this appears in your alert inbox." },
            { label: "Device push", value: "Delivered if your laptop, tablet or phone raised a notification." },
            { label: "Email", value: "Delivered if a copy reached your inbox." },
          ],
          findings: [],
          // Time-bucketed so repeated tests are distinct, but a double-tapped
          // button inside the same minute is not.
          idempotencyKey: `selftest:${user.id}:${new Date().toISOString().slice(0, 16)}`,
        });
        return json(result, 200, cors);
      }

      default:
        return json({ error: "unknown_action" }, 400, cors);
    }
  } catch (e) {
    console.error("intel_notify_error", action, e instanceof Error ? e.message : e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : "failed" }, 500, cors);
  }
});
