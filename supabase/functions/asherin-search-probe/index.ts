// live re-check for a single stored hit. head request only.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  let user;
  try { user = await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

  let body: { hit_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400, cors); }
  const hitId = String(body?.hit_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(hitId)) return json({ error: "invalid hit_id" }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: hit } = await admin.from("search_hits").select("id,user_id,url").eq("id", hitId).single();
  if (!hit || hit.user_id !== user.id) return json({ error: "not found" }, 404, cors);
  if (!hit.url) return json({ error: "no url on hit" }, 400, cors);

  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 6_000);
  let live = false, status: number | null = null;
  try {
    const r = await fetch(hit.url, { method: "HEAD", redirect: "manual", signal: c.signal, headers: { "user-agent": "asherin-search/1.0" } });
    status = r.status; live = r.status >= 200 && r.status < 400;
    try { await r.arrayBuffer(); } catch { /* ignore */ }
  } catch { live = false; }
  finally { clearTimeout(t); }
  await admin.from("search_hits").update({ live, http_status: status, last_probed_at: new Date().toISOString() }).eq("id", hitId);
  return json({ ok: true, live, status }, 200, cors);
});

function json(x: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(x), { status, headers: { ...cors, "content-type": "application/json" } });
}
