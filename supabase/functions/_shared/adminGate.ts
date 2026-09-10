// Strict BYOK gate — NO caller may consume a platform model key. Staff and
// non-staff alike MUST ship a valid BYOK config or get a clean 403.
//
// Staff recognition is a SHA-256 digest match (identityHash.ts). No mailbox
// appears in this file, in any comment, in any log line, or in any response
// body — a committed operator address is a disclosure, and this gate is the
// one place tempted to write one down.
//
// Used by every Zophiel / Asherin / Asher AI edge function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isValidByok, type ZophielByokConfig } from "./zophielByokRouter.ts";
import { isStaffEmail } from "./identityHash.ts";
import { DEFAULT_MODEL } from "./keyResolution.ts";


export const BYOK_REQUIRED_BODY = {
  error: "BYOK_REQUIRED",
  message:
    "Bring your own AI key to use the Zophiel Engine. Open the BYOK panel and add your Gemini key.",
};

/** Verified caller identity (id + email), or null if anon / invalid. */
export async function getCaller(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data } = await sb.auth.getUser(token);
    if (!data?.user?.id) return null;
    return { id: data.user.id, email: (data.user.email || "").toLowerCase() || null };
  } catch {
    return null;
  }
}

/** Returns the authenticated caller's email, or null if anon / invalid. */
export async function getCallerEmail(req: Request): Promise<string | null> {
  return (await getCaller(req))?.email ?? null;
}


/**
 * Staff identity check — the single implementation. constants.ts re-exports
 * this same rule so the two cannot drift apart.
 */
export function isAdminEmail(email: string | null): boolean {
  return isStaffEmail(email);
}

export interface KeyResolution {
  /** Always "byok" — the platform key path was removed. */
  mode: "admin" | "byok";
  /** Never set. Retained so existing callers keep type-checking. */
  geminiKey?: string;
  /** Present when mode === "byok". */
  byok?: ZophielByokConfig;
}

/**
 * Resolves which key path to use.
 * - Every caller MUST send (or have saved) a valid BYOK config, or this throws.
 *
 * Throws an Error with `.status = 403` and `.code = "BYOK_REQUIRED"` when the
 * non-admin caller did not provide a usable BYOK config.
 */
export async function resolveKey(
  req: Request,
  byok: unknown,
  opts: { strict?: boolean } = {},
): Promise<KeyResolution> {
  const caller = await getCaller(req);

  // A key the caller EXPLICITLY saved in Settings → AI Keys outranks every
  // platform key, staff included. Removing a provider there must actually stop
  // that provider from being called.
  if (!isValidByok(byok) && caller?.id) {
    const stored = await storedByokForUser(caller.id);
    if (stored) return { mode: "byok", byok: stored };
  }

  return resolveKeyForEmail(caller?.email ?? null, byok, opts);
}

/**
 * The provider the signed-in user actually selected (or, absent a selection,
 * the single active key they saved). Service-role read; never logged.
 * Returns null when the locker is empty or unreadable — the caller then walks
 * on to the platform/offline path instead of guessing a provider.
 */
export async function storedByokForUser(userId: string): Promise<ZophielByokConfig | null> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: keys } = await sb
      .from("user_api_keys")
      .select("provider, api_key, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);
    const active = (keys || []).filter(
      (k: { api_key?: string }) => String(k.api_key || "").trim().length > 0,
    ) as Array<{ provider: string; api_key: string }>;
    if (!active.length) return null;

    const { data: pref } = await sb
      .from("user_model_preferences")
      .select("active_provider, active_model")
      .eq("user_id", userId)
      .maybeSingle();
    const wanted = String((pref as { active_provider?: string } | null)?.active_provider || "");
    const wantedModel = String((pref as { active_model?: string } | null)?.active_model || "");

    // The selected provider only counts when a key for it still exists.
    const chosen =
      (wanted && wanted !== "default" && wanted !== "aureon"
        ? active.find((k) => k.provider === wanted)
        : null) || active[0];
    if (!chosen) return null;

    const model =
      (chosen.provider === wanted && wantedModel && wantedModel !== "default"
        ? wantedModel
        : DEFAULT_MODEL[chosen.provider]) || "";
    if (!model) return null;

    return { provider: chosen.provider, model, apiKey: chosen.api_key } as ZophielByokConfig;
  } catch {
    return null;
  }
}

/**
 * Same resolution, but for callers whose identity does not come from the
 * request — scheduled/service-key runs act on behalf of an agent's owner, so
 * the owner's email, not the missing JWT, decides the key.
 */
export async function resolveKeyForEmail(
  _email: string | null,
  byok: unknown,
  _opts: { strict?: boolean } = {},
): Promise<KeyResolution> {
  const validByok = isValidByok(byok) ? (byok as ZophielByokConfig) : null;

  // BYOK is the ONLY accepted source. There is no platform key path here:
  // staff do not fall back to a platform Gemini key and non-staff do not fall
  // back to a platform Venice key. `email` is no longer consulted for routing.
  if (validByok) return { mode: "byok", byok: validByok };

  const e: any = new Error("BYOK_REQUIRED");
  e.status = 403;
  e.code = "BYOK_REQUIRED";
  throw e;
}

/** Helper that converts a thrown KeyResolution / BYOK error into a clean Response. */
export function byokErrorResponse(e: any, corsHeaders: Record<string, string>) {
  // Adaptive rate-limit surface: when the router (or any provider fetch)
  // bubbles up a 429, we return a structured payload the client can use to
  // *auto-resume* instead of dropping the user back at the start of their flow.
  if (e?.status === 429 || e?.code === "RATE_LIMITED") {
    const retryAfterMs = typeof e?.retryAfterMs === "number" ? e.retryAfterMs : 15_000;
    return new Response(JSON.stringify({
      error: "RATE_LIMITED",
      message: "Your AI key hit its provider rate limit. Auto-resuming shortly.",
      retryAfterMs,
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    });
  }
  const status = typeof e?.status === "number" ? e.status : 500;
  const body =
    e?.code === "BYOK_REQUIRED"
      ? BYOK_REQUIRED_BODY
      : e?.code === "ADMIN_KEY_MISSING"
        ? { error: "ADMIN_KEY_MISSING", message: "Platform key not configured." }
        : { error: "internal_error", message: String(e?.message || e) };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
