// hoa-aureon-feed — pulls the mothership training bus for Aureon consumption.
//
// Admin-only (uses is_admin_user). Returns un-consumed messages from
// hoa_aureon_training_feed, optionally marking them consumed. This is how
// every country server's traffic reaches the sovereign brain in one stream.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200, cors: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "auth required" }, 401, cors);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid session" }, 401, cors);

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: admin } = await svc.rpc("is_admin_user", { _user_id: userData.user.id });
  if (!admin) return json({ error: "admin only" }, 403, cors);

  const url = new URL(req.url);
  const limit    = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? "100") | 0));
  const consume  = url.searchParams.get("consume") === "1";
  const includeSealed = url.searchParams.get("includeSealed") === "1";

  let q = svc.from("hoa_aureon_training_feed").select("*").is("consumed_at", null).order("ingested_at", { ascending: true }).limit(limit);
  if (!includeSealed) q = q.eq("sealed", false);
  const { data: rows, error } = await q;
  if (error) return json({ error: error.message }, 500, cors);

  if (consume && rows && rows.length > 0) {
    const ids = rows.map((r: any) => r.id);
    await svc.from("hoa_aureon_training_feed").update({ consumed_at: new Date().toISOString() }).in("id", ids);
  }

  return json({ ok: true, count: rows?.length ?? 0, rows: rows ?? [] }, 200, cors);
});
