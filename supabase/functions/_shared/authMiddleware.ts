// Shared auth middleware — single source of truth for user + admin checks.
// Every function that requires authentication should import requireUser /
// requireAdmin instead of re-implementing the JWT dance.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isStaffEmail } from "./identityHash.ts";

// Re-export so callers gate on the digest check, never on a list of inboxes.
export { isStaffEmail };

export interface AuthedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the caller's JWT. Returns `{ id, email, isAdmin }` or throws an
 * AuthError(401) when the token is missing/invalid.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new AuthError("Missing bearer token", 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new AuthError("Empty bearer token", 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.email) throw new AuthError("Invalid token", 401);

  const email = data.user.email.toLowerCase();
  return { id: data.user.id, email, isAdmin: isStaffEmail(email) };
}

/**
 * Same as requireUser but rejects with 403 unless the caller is an admin.
 */
export async function requireAdmin(req: Request): Promise<AuthedUser> {
  const user = await requireUser(req);
  if (!user.isAdmin) throw new AuthError("Admin only", 403);
  return user;
}

/**
 * Convert an AuthError into a Response. Re-throws unrelated errors.
 */
export function authErrorResponse(e: unknown, corsHeaders: Record<string, string>): Response {
  if (e instanceof AuthError) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  throw e;
}

export { AuthError };
