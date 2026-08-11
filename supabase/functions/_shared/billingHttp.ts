/**
 * Billing HTTP helpers.
 *
 * F5 (CWE-209 / auth-error oracle): the checkout + portal functions used to
 * funnel every failure — including "no Authorization header" and "invalid JWT"
 * — through a single catch that echoed the raw message with status 500. An
 * unauthenticated prober could therefore (a) distinguish auth states from a
 * 500 body instead of a clean 401 and (b) read upstream GoTrue text.
 *
 * These helpers give every billing function one opaque 401 for auth failures
 * and one opaque 500 for infrastructure failures. Business errors that only an
 * authenticated caller can reach keep their descriptive text so the UI can
 * still explain, e.g., "you already have an active subscription".
 */

/** Thrown when the caller has no usable session. Always answered with 401. */
export class BillingAuthError extends Error {
  constructor(message = "unauthorized") {
    super(message);
    this.name = "BillingAuthError";
  }
}

/** Thrown when server configuration is missing. Never surfaced verbatim. */
export class BillingConfigError extends Error {
  constructor(message = "billing unavailable") {
    super(message);
    this.name = "BillingConfigError";
  }
}

type Cors = Record<string, string>;

export function jsonResponse(body: unknown, status: number, corsHeaders: Cors): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

export function unauthorized(corsHeaders: Cors): Response {
  return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);
}

/**
 * Single exit point for a billing catch block.
 * - BillingAuthError  -> 401 {"error":"unauthorized"} (no upstream detail)
 * - BillingConfigError-> 500 generic (never names the missing secret)
 * - anything else     -> 500 with the caller-safe message, logged server-side
 */
export function billingError(error: unknown, corsHeaders: Cors, tag: string): Response {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${tag}] ERROR`, message);

  if (error instanceof BillingAuthError) return unauthorized(corsHeaders);
  if (error instanceof BillingConfigError) {
    return jsonResponse({ error: "Billing is temporarily unavailable." }, 503, corsHeaders);
  }
  return jsonResponse({ error: message }, 500, corsHeaders);
}

/**
 * Extracts and validates the bearer session in one place.
 * Returns the user or throws BillingAuthError — never leaks GoTrue text.
 */
export async function requireBillingUser(
  req: Request,
  getUser: (token: string) => Promise<{ data: { user: { id: string; email?: string | null } | null }; error?: unknown }>,
): Promise<{ id: string; email: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new BillingAuthError();

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new BillingAuthError();

  const { data, error } = await getUser(token);
  if (error || !data?.user?.email) throw new BillingAuthError();

  return { id: data.user.id, email: data.user.email };
}
