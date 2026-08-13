// Strict BYOK gate — only staff identities may consume the platform Gemini
// key. Every other caller MUST ship a valid BYOK config or get a clean 403.
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

export const BYOK_REQUIRED_BODY = {
  error: "BYOK_REQUIRED",
  message:
    "Bring your own AI key to use the Zophiel Engine. Open the BYOK panel and add your Gemini key.",
};

// Cheapest uncensored Venice model that handles code + vision.
// See https://docs.venice.ai/api-reference/models
const VENICE_FREE_MODEL = "mistral-31-24b";

/** Returns the authenticated caller's email, or null if anon / invalid. */
export async function getCallerEmail(req: Request): Promise<string | null> {
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
    return (data?.user?.email || null)?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/**
 * Staff identity check — the single implementation. constants.ts re-exports
 * this same rule so the two cannot drift apart.
 */
export function isAdminEmail(email: string | null): boolean {
  return isStaffEmail(email);
}

export interface KeyResolution {
  /** "admin": use the platform GEMINI_API_KEY. "byok": use the user's config. */
  mode: "admin" | "byok";
  /** Present when mode === "admin". */
  geminiKey?: string;
  /** Present when mode === "byok". */
  byok?: ZophielByokConfig;
}

/**
 * Resolves which key path to use.
 * - Admin caller: may use platform key (or BYOK if they sent one — BYOK wins).
 * - Anyone else: MUST send a valid BYOK config, or this throws.
 *
 * Throws an Error with `.status = 403` and `.code = "BYOK_REQUIRED"` when the
 * non-admin caller did not provide a usable BYOK config.
 */
export async function resolveKey(
  req: Request,
  byok: unknown,
  opts: { strict?: boolean } = {},
): Promise<KeyResolution> {
  const email = await getCallerEmail(req);
  return resolveKeyForEmail(email, byok, opts);
}

/**
 * Same resolution, but for callers whose identity does not come from the
 * request — scheduled/service-key runs act on behalf of an agent's owner, so
 * the owner's email, not the missing JWT, decides the key.
 */
export async function resolveKeyForEmail(
  email: string | null,
  byok: unknown,
  opts: { strict?: boolean } = {},
): Promise<KeyResolution> {
  const validByok = isValidByok(byok) ? (byok as ZophielByokConfig) : null;
  const isInternalTeam = isAdminEmail(email);

  // Staff digests are never prompted for BYOK — always routed through the
  // platform Gemini key, in BOTH normal and strict modes. No software they
  // touch should ever ask them to supply a Gemini key.
  if (isInternalTeam) {
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";
    if (geminiKey) return { mode: "admin", geminiKey };
    // If platform key is missing, fall through so a team member's own BYOK still works.
  }

  // BYOK always wins for everyone else.
  if (validByok) return { mode: "byok", byok: validByok };

  // Strict mode (Zerlal, Video Intelligence): no platform fallback.
  if (opts.strict) {
    const e: any = new Error("BYOK_REQUIRED");
    e.status = 403;
    e.code = "BYOK_REQUIRED";
    throw e;
  }

  // Free-tier fallback: route AUTHENTICATED callers without BYOK through the
  // platform Venice key. Anonymous (no JWT) callers MUST NOT reach this path —
  // otherwise any unauthenticated HTTP client can consume the platform Venice
  // budget without limit (billing DoS).
  const veniceKey = Deno.env.get("VENICE_API_KEY") || "";
  if (veniceKey && email) {
    return {
      mode: "byok",
      byok: {
        provider: "venice",
        model: VENICE_FREE_MODEL,
        apiKey: veniceKey,
      },
    };
  }

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
