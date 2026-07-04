// Shared SSRF + auth helpers for ZOSMA pentest edge functions.
import { createClient } from "npm:@supabase/supabase-js@2";

const PRIVATE_HOST_RE =
  /^(?:localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|::1|fe80:|fc00:|metadata\.google\.internal)/i;

export function guardHost(host: string): string | null {
  const h = host.trim().toLowerCase();
  if (!h) return "empty host";
  if (PRIVATE_HOST_RE.test(h)) return "private/loopback/metadata target refused";
  if (!/^[a-z0-9.\-:_\[\]]+$/i.test(h)) return "hostname contains illegal characters";
  return null;
}

const ADMINS = new Set(["ashernewtonx@gmail.com", "shepherdnewtonx@gmail.com"]);

export async function requireAdmin(req: Request): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, status: 401, error: "unauthenticated" };
  if (!user.email || !ADMINS.has(user.email.toLowerCase())) {
    return { ok: false, status: 403, error: "forbidden — pentest surface is admin-gated" };
  }
  return { ok: true, email: user.email.toLowerCase() };
}
