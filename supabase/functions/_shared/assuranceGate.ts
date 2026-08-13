// Server-side assurance gate.
//
// A client-side step-up dialog only protects a UI. Anyone can call the
// function directly with a stolen aal1 access token, so the dangerous
// endpoints re-check the claim here: if the account HAS a verified factor and
// the presented token is aal1, the request is refused.
//
// Fail-closed on the factor lookup: if we cannot determine the account's MFA
// state, we do not assume "no MFA".

import { createClient } from "npm:@supabase/supabase-js@2";

export interface Caller {
  userId: string;
  aal: string | null;
  token: string;
}

export type GateResult =
  | { ok: true; caller: Caller }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Resolve the caller from the Authorization header and enforce aal2 when the
 * account is capable of it.
 */
export async function requireAssuredUser(req: Request): Promise<GateResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const token = authHeader.slice("Bearer ".length);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  const claims = claimsData?.claims as { sub?: string; aal?: string } | undefined;
  if (claimsError || !claims?.sub) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  const aal = claims.aal ?? null;
  if (aal === "aal2") {
    return { ok: true, caller: { userId: claims.sub, aal, token } };
  }

  // aal1 (or a token with no aal claim): does this account have a verified
  // factor it should have used?
  const { data: factorData, error: factorError } = await userClient.auth.mfa.listFactors();
  if (factorError) {
    return {
      ok: false,
      status: 503,
      body: { error: "assurance_check_failed", message: "Could not verify factor state. Try again." },
    };
  }
  const verified = (factorData?.all ?? []).some((f) => f.status === "verified");
  if (verified) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "step_up_required",
        message: "This action needs a session verified with your second factor.",
      },
    };
  }

  return { ok: true, caller: { userId: claims.sub, aal, token } };
}
