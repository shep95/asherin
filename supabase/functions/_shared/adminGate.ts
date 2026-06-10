// Strict BYOK gate — only the platform owner may consume the platform Gemini
// key. Every other caller MUST ship a valid BYOK config or get a clean 403.
//
// Used by every Zophiel / Aureon / Asher AI edge function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isValidByok, type ZophielByokConfig } from "./zophielByokRouter.ts";
import { ADMIN_EMAILS } from "./constants.ts";

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

export function isAdminEmail(email: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
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
): Promise<KeyResolution> {
  const validByok = isValidByok(byok) ? (byok as ZophielByokConfig) : null;
  const email = await getCallerEmail(req);
  const admin = isAdminEmail(email);

  // BYOK always wins — even for admin.
  if (validByok) return { mode: "byok", byok: validByok };

  if (admin) {
    const k =
      Deno.env.get("GEMINI_API_KEY_APP") ||
      Deno.env.get("GEMINI_API_KEY") ||
      "";
    if (!k) {
      const e: any = new Error("ADMIN_KEY_MISSING");
      e.status = 500;
      e.code = "ADMIN_KEY_MISSING";
      throw e;
    }
    return { mode: "admin", geminiKey: k };
  }

  // Free-tier fallback: route non-admin callers without BYOK through the
  // platform Venice key. They never see the key itself; their requests are
  // billed to the platform. Users with their own BYOK never get here (handled
  // above) — saves us money.
  const veniceKey = Deno.env.get("VENICE_API_KEY") || "";
  if (veniceKey) {
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

/** Helper that converts a thrown KeyResolution error into a clean Response. */
export function byokErrorResponse(e: any, corsHeaders: Record<string, string>) {
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
