// ─────────────────────────────────────────────────────────────────────────────
// asherin.defender — the device agent's only door.
//
// The browser tab can measure a tab. The device agent runs on the operator's
// own machine, with the operator's own permissions, and posts its readings
// here. This function is deliberately the narrowest thing that can accept them:
//
//   op="report"  the agent posts { token, meta, findings }. The token is never
//                stored — only its sha-256 digest, which is matched against a
//                row the operator created from their signed-in session. A
//                report can therefore only ever land on the account that
//                enrolled that device.
//
// Refusals held here:
//   • the payload is capped, every finding id is bounded, every string is
//     truncated before it reaches the database.
//   • unknown or revoked token → 401, with no hint about which part failed.
//   • per-token write throttle, so an agent loop cannot become a write flood.
//   • the function never returns anyone's data; reading is done by the signed-in
//     client through RLS.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const MAX_FINDINGS = 400;
const MAX_BODY = 512 * 1024;
const WRITE_EVERY_MS = 20_000;
const lastWrite = new Map<string, number>();

type State = "pass" | "warn" | "fail" | "unmeasured";
const STATES = new Set<State>(["pass", "warn", "fail", "unmeasured"]);

function clip(v: unknown, n: number): string {
  return String(v ?? "").slice(0, n);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "post only" }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const token = clip(body.token, 200);
  if (token.length < 24) return json({ error: "unauthorized" }, 401);

  const digest = await sha256Hex(token);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: device } = await admin
    .from("defender_devices")
    .select("id, user_id, revoked, last_seen_at")
    .eq("token_sha256", digest)
    .maybeSingle();

  if (!device || device.revoked) return json({ error: "unauthorized" }, 401);

  // throttle on the stored timestamp, not on process memory — every cold start
  // would otherwise hand an agent loop a fresh write budget.
  const seen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  const last = Math.max(seen, lastWrite.get(digest) ?? 0);
  if (Date.now() - last < WRITE_EVERY_MS) return json({ ok: true, throttled: true });
  lastWrite.set(digest, Date.now());

  const rawFindings = Array.isArray(body.findings) ? body.findings.slice(0, MAX_FINDINGS) : [];
  const findings = rawFindings
    .map((f) => {
      const item = (f ?? {}) as Record<string, unknown>;
      const state = clip(item.state, 12) as State;
      return {
        id: clip(item.id, 64),
        state: STATES.has(state) ? state : "unmeasured",
        observed: clip(item.observed, 400),
        action: item.action ? clip(item.action, 300) : null,
      };
    })
    .filter((f) => f.id.length > 0);

  const metaIn = (body.meta ?? {}) as Record<string, unknown>;
  const meta = {
    hostname: clip(metaIn.hostname, 120),
    platform: clip(metaIn.platform, 120),
    release: clip(metaIn.release, 120),
    arch: clip(metaIn.arch, 40),
    agent_version: clip(metaIn.agent_version, 20),
    scanned_paths: Number(metaIn.scanned_paths ?? 0) || 0,
    scanned_files: Number(metaIn.scanned_files ?? 0) || 0,
    duration_ms: Number(metaIn.duration_ms ?? 0) || 0,
  };

  const measured = findings.filter((f) => f.state !== "unmeasured").length;
  const passed = findings.filter((f) => f.state === "pass").length;
  const warned = findings.filter((f) => f.state === "warn").length;

  const { error } = await admin.from("defender_reports").insert({
    device_id: device.id,
    user_id: device.user_id,
    agent_version: meta.agent_version || null,
    meta,
    findings,
    score: measured ? Math.round(((passed + warned * 0.4) / measured) * 1000) : 0,
    coverage: measured,
  });
  if (error) return json({ error: "report rejected" }, 400);

  await admin
    .from("defender_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      platform: meta.platform || null,
      agent_version: meta.agent_version || null,
    })
    .eq("id", device.id);

  return json({ ok: true, accepted: findings.length });
});
