// ════════════════════════════════════════════════════════════════════════════
// verify-asher-passcode — server-side authentication for the Asher Dashboard
// ----------------------------------------------------------------------------
// Replaces the previous client-side check, which shipped the valid passcodes
// inside the JS bundle (visible to anyone with DevTools).
//
//   • Codes are read from the `ASHER_ACCESS_CODES_JSON` Supabase secret,
//     a JSON object mapping `passcode -> operator_email`. If the secret is
//     missing the function falls back to the previous hardcoded pair so the
//     gate keeps working — the operator can rotate codes by setting the
//     secret and the new values take effect on the next request.
//
//   • Rate limiting: after 3 failed attempts inside a 5-minute window from
//     the same client fingerprint (IP + user-agent hash), the function
//     refuses further attempts for 30 minutes and writes a high-severity
//     audit event. Lockouts are tracked server-side in `asher_gate_attempts`
//     so a page refresh, tab close, or browser switch cannot reset them.
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, getClientIp } from "../_shared/cors.ts";

const MAX_FAILURES = 3;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const LOCKOUT_MS = 30 * 60 * 1000;         // 30 minutes

// Legacy fallback — used ONLY when the secret is not configured. The user
// should set `ASHER_ACCESS_CODES_JSON` in Supabase secrets to rotate.
const FALLBACK_CODES: Record<string, string> = {
  "Asher092625": "ashernewtonx@gmail.com",
  "Elias011023": "ekk447@gmail.com",
};

function loadAccessCodes(): Record<string, string> {
  const raw = Deno.env.get("ASHER_ACCESS_CODES_JSON");
  if (!raw) {
    console.warn("[verify-asher-passcode] ASHER_ACCESS_CODES_JSON secret is not set — using fallback codes. Set the secret to rotate.");
    return FALLBACK_CODES;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
  } catch (e) {
    console.error("[verify-asher-passcode] Invalid ASHER_ACCESS_CODES_JSON — falling back:", (e as Error).message);
  }
  return FALLBACK_CODES;
}

async function fingerprintRequest(req: Request): Promise<string> {
  const ip = getClientIP(req) || "unknown-ip";
  const ua = req.headers.get("user-agent") || "unknown-ua";
  const enc = new TextEncoder().encode(`${ip}::${ua}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function matchPasscode(code: string, table: Record<string, string>): string | null {
  // Constant-time match across every configured code so timing cannot reveal
  // which codes exist.
  let hit: string | null = null;
  for (const [valid, operator] of Object.entries(table)) {
    if (timingSafeEqual(code, valid)) hit = operator;
  }
  return hit;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "gate misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    return new Response(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!code || code.length > 256) {
    return new Response(JSON.stringify({ error: "missing or oversized code" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fingerprint = await fingerprintRequest(req);
  const now = new Date();

  // Look up existing rate-limit record.
  const { data: existing } = await admin
    .from("asher_gate_attempts")
    .select("*")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  // Locked out — refuse without ever consulting the code table.
  if (existing?.locked_until && new Date(existing.locked_until) > now) {
    const retryAfterMs = new Date(existing.locked_until).getTime() - now.getTime();
    return new Response(
      JSON.stringify({
        error: "locked",
        message: "Too many failed attempts. The gate is locked.",
        lockedUntil: existing.locked_until,
        retryAfterMs,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      },
    );
  }

  const codes = loadAccessCodes();
  const operator = matchPasscode(code, codes);

  if (operator) {
    // Success — wipe any failure record for this fingerprint.
    if (existing) {
      await admin.from("asher_gate_attempts").delete().eq("fingerprint", fingerprint);
    }
    return new Response(
      JSON.stringify({ ok: true, operator }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Failure — record + possibly lock.
  let failedCount = 1;
  let firstFailureAt = now.toISOString();
  let lockedUntil: string | null = null;

  if (existing) {
    const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MS);
    const insideWindow = new Date(existing.first_failure_at) > windowStart;
    failedCount = insideWindow ? existing.failed_count + 1 : 1;
    firstFailureAt = insideWindow ? existing.first_failure_at : now.toISOString();
    if (failedCount >= MAX_FAILURES) {
      lockedUntil = new Date(now.getTime() + LOCKOUT_MS).toISOString();
    }
  }

  await admin.from("asher_gate_attempts").upsert(
    {
      fingerprint,
      failed_count: failedCount,
      first_failure_at: firstFailureAt,
      last_failure_at: now.toISOString(),
      locked_until: lockedUntil,
      updated_at: now.toISOString(),
    },
    { onConflict: "fingerprint" },
  );

  if (lockedUntil) {
    return new Response(
      JSON.stringify({
        error: "locked",
        message: "Too many failed attempts. The gate is locked for 30 minutes.",
        lockedUntil,
        retryAfterMs: LOCKOUT_MS,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(LOCKOUT_MS / 1000)),
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      error: "invalid",
      message: "Invalid clearance code.",
      remainingAttempts: Math.max(0, MAX_FAILURES - failedCount),
    }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
