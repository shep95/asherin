// Asherin Connect — server-side capability tracing.
//
// Mirror of src/lib/connect/emitPull.ts for edge functions. Masking rules are
// identical: no credentials, contacts starred, hard length cap. Tracing is
// best-effort and must never fail the capability that ran.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type PullStatus = "ok" | "fail" | "skip" | "stale";

export interface ConnectPullInput {
  organ: string;
  capability: string;
  fromSurface?: string;
  status: PullStatus;
  latencyMs?: number;
  quote?: string | null;
  meta?: Record<string, unknown>;
}

const SECRET_PATTERNS: RegExp[] = [
  /\b(sk|pk|rk|api|key|token|bearer|secret|pat|ghp|gho|ghu|ghs|xoxb|xoxp)[-_a-z]*[=:\s]*["']?[A-Za-z0-9_\-]{16,}/gi,
  /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g,
  /\bAIza[0-9A-Za-z_\-]{20,}\b/g,
  /\b(?:password|passphrase|totp|otp|seed|mnemonic)\s*[:=]\s*\S+/gi,
];
const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9-])[A-Za-z0-9.-]*\.([A-Za-z]{2,})\b/g;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;

export function maskQuote(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return null;
  for (const re of SECRET_PATTERNS) s = s.replace(re, "[redacted]");
  s = s.replace(EMAIL_RE, (_m, a, d, tld) => `${a}***@${d}***.${tld}`);
  s = s.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    return digits.length < 8 ? m : `***${digits.slice(-3)}`;
  });
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

function safeMeta(meta?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!meta) return out;
  for (const [k, v] of Object.entries(meta)) {
    if (/key|token|secret|password|totp|otp|auth|cookie|session/i.test(k)) continue;
    if (v == null) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = maskQuote(v) ?? "";
  }
  return out;
}

/** Write one trace row for a signed-in user. Swallows all errors. */
export async function emitPull(userId: string | null | undefined, input: ConnectPullInput): Promise<void> {
  if (!userId) return;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return;
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const latency =
      typeof input.latencyMs === "number" && Number.isFinite(input.latencyMs)
        ? Math.max(0, Math.min(600000, Math.round(input.latencyMs)))
        : null;
    await client.from("asherin_connect_pulls").insert({
      user_id: userId,
      organ: String(input.organ).slice(0, 48),
      capability: String(input.capability).slice(0, 64),
      from_surface: String(input.fromSurface || "edge").slice(0, 48),
      status: input.status,
      latency_ms: latency,
      quote_masked: maskQuote(input.quote),
      meta: safeMeta(input.meta),
    });
  } catch {
    // best-effort
  }
}

/** Time a server capability and trace both outcomes. */
export async function tracePull<T>(
  userId: string | null | undefined,
  base: Omit<ConnectPullInput, "status" | "latencyMs">,
  run: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    void emitPull(userId, { ...base, status: "ok", latencyMs: Date.now() - started });
    return result;
  } catch (err) {
    void emitPull(userId, {
      ...base,
      status: "fail",
      latencyMs: Date.now() - started,
      quote: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  }
}
