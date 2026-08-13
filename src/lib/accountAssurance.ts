/**
 * Account assurance primitives.
 *
 * One place decides three questions the rest of the app keeps asking:
 *   1. how strongly is this session authenticated right now (aal1 / aal2)?
 *   2. could it be raised (does a verified second factor exist)?
 *   3. what stable key identifies this session across token refreshes?
 *
 * Nothing here renders. The challenge UI lives in components/auth.
 */

import { supabase } from "@/integrations/supabase/client";

export type Aal = "aal1" | "aal2" | null;

export interface Assurance {
  /** Assurance level the current access token actually carries. */
  current: Aal;
  /** Assurance level this account is entitled to reach. */
  next: Aal;
  /** A verified factor exists, so aal2 is reachable. */
  canRaise: boolean;
  /** Signed in at aal1 while aal2 is reachable — the session is under-assured. */
  challengeRequired: boolean;
}

export const UNKNOWN_ASSURANCE: Assurance = {
  current: null,
  next: null,
  canRaise: false,
  challengeRequired: false,
};

export async function readAssurance(): Promise<Assurance> {
  try {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return UNKNOWN_ASSURANCE;
    const current = (data.currentLevel ?? null) as Aal;
    const next = (data.nextLevel ?? null) as Aal;
    const canRaise = next === "aal2";
    return {
      current,
      next,
      canRaise,
      challengeRequired: canRaise && current === "aal1",
    };
  } catch {
    // A network failure must not silently downgrade the account to "no MFA".
    // Callers treat UNKNOWN as "cannot prove anything" and keep the gate shut
    // where the gate is the dangerous-action path.
    return UNKNOWN_ASSURANCE;
  }
}

export interface VerifiedFactor {
  id: string;
  friendlyName: string | null;
  createdAt: string;
}

/** Verified TOTP factors only — unverified enrollments never gate anything. */
export async function listVerifiedFactors(): Promise<VerifiedFactor[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      createdAt: f.created_at,
    }));
}

/**
 * Raise the current session to aal2 with a code from the authenticator app.
 * Returns null on success, an operator-readable reason on failure.
 */
export async function verifyTotpCode(
  factorId: string,
  code: string,
): Promise<string | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return "Enter the 6-digit code from your authenticator app.";
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: clean,
  });
  return error ? error.message : null;
}

/**
 * Password reauthentication for accounts with no second factor.
 * signInWithPassword against the caller's own email: a wrong password fails
 * here and the dangerous action never runs.
 */
export async function reauthenticateWithPassword(
  email: string,
  password: string,
): Promise<string | null> {
  if (!password) return "Enter your current password.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? "Current password is incorrect." : null;
}

/** True when the account can prove itself with a password (not OAuth-only). */
export function hasPasswordIdentity(
  identities: { provider: string }[] | undefined | null,
): boolean {
  if (!identities || identities.length === 0) return true; // email/password default
  return identities.some((i) => i.provider === "email");
}

/* ------------------------------------------------------------------ */
/* Stable session key                                                  */
/* ------------------------------------------------------------------ */

/**
 * GoTrue puts a `session_id` claim in the access token. It survives every
 * TOKEN_REFRESHED, unlike the token prefix the tracker used to slice, which
 * rotated hourly and stranded the row the heartbeat was meant to update.
 */
export function sessionKeyFromToken(accessToken: string | undefined | null): string | null {
  if (!accessToken) return null;
  const part = accessToken.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { session_id?: string; sub?: string };
    if (claims.session_id) return claims.session_id.replace(/-/g, "").slice(0, 32);
    return null;
  } catch {
    return null;
  }
}

export async function currentSessionKey(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return sessionKeyFromToken(data.session?.access_token);
}
