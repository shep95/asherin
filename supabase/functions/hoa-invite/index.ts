// hoa-invite — create + accept invites for the Sovereign Command Deck.
//
// action: "create"  → owner/operator mints an invite code for their server
// action: "accept"  → any signed-in user redeems a code, gets seeded into
//                     the target server and (if the invite opts in) mirrored
//                     into the #houseofasher mothership as a guest so their
//                     activity feeds Asherin.
//
// Runs with SERVICE_ROLE so it can bypass RLS for the create/mirror path
// after verifying the caller's JWT + server role.

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

function randomCode(len = 10): string {
  const alpha = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alpha[bytes[i] % alpha.length];
  return out;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "auth required" }, 401, cors);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "invalid session" }, 401, cors);
    const user = userData.user;

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    // ---------------------------------------------------------------------
    // CREATE
    // ---------------------------------------------------------------------
    if (action === "create") {
      const serverId   = String(body?.serverId ?? "");
      const roleGrant  = ["owner","operator","analyst","guest"].includes(body?.roleGrant) ? body.roleGrant : "operator";
      const clearance  = Math.max(0, Math.min(4, Number(body?.clearanceGrant ?? 1) | 0));
      const maxUses    = Math.max(1, Math.min(500, Number(body?.maxUses ?? 1) | 0));
      const mirror     = body?.mirrorMothership !== false;
      const expiresIn  = Number(body?.expiresInHours ?? 168); // 1 week default
      if (!serverId) return json({ error: "serverId required" }, 400, cors);

      // Verify caller is owner/operator on the server.
      const { data: mem } = await svc
        .from("hoa_members")
        .select("role")
        .eq("server_id", serverId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mem || !["owner","operator"].includes(mem.role)) {
        return json({ error: "not authorized to invite on this server" }, 403, cors);
      }

      const code = randomCode(10);
      const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 3600_000).toISOString() : null;
      const { data: inv, error: invErr } = await svc.from("hoa_invites").insert({
        server_id: serverId,
        code,
        created_by: user.id,
        role_grant: roleGrant,
        clearance_grant: clearance,
        max_uses: maxUses,
        mirror_mothership: mirror,
        expires_at: expiresAt,
      }).select("*").single();
      if (invErr) return json({ error: invErr.message }, 400, cors);

      await svc.from("hoa_audit").insert({
        server_id: serverId,
        actor_id: user.id,
        actor_handle: user.email ?? "operator",
        action: "INVITE_CREATED",
        target: code,
        detail: `role=${roleGrant} clearance=${clearance} maxUses=${maxUses}`,
      });
      return json({ ok: true, invite: inv }, 200, cors);
    }

    // ---------------------------------------------------------------------
    // ACCEPT
    // ---------------------------------------------------------------------
    if (action === "accept") {
      const code   = String(body?.code ?? "").trim().toUpperCase();
      const handle = (String(body?.handle ?? "").trim() || user.email?.split("@")[0] || "operator").slice(0, 40);
      if (!code) return json({ error: "code required" }, 400, cors);

      const { data: inv } = await svc.from("hoa_invites").select("*").eq("code", code).maybeSingle();
      if (!inv) return json({ error: "invalid invite" }, 404, cors);
      if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now())
        return json({ error: "invite expired" }, 410, cors);
      if (inv.uses >= inv.max_uses)
        return json({ error: "invite exhausted" }, 410, cors);

      // Seed membership in the target server (idempotent).
      const { error: memErr } = await svc.from("hoa_members").upsert({
        server_id: inv.server_id,
        user_id:   user.id,
        handle,
        rank_label: inv.role_grant === "owner" ? "Sovereign" : inv.role_grant === "operator" ? "Operator" : "Analyst",
        role: inv.role_grant,
        clearance_rank: inv.clearance_grant,
      }, { onConflict: "server_id,user_id" });
      if (memErr) return json({ error: memErr.message }, 400, cors);

      // Mirror into #houseofasher as a guest so activity feeds Asherin.
      if (inv.mirror_mothership) {
        const { data: mother } = await svc.from("hoa_servers").select("id").eq("is_mothership", true).maybeSingle();
        if (mother?.id) {
          await svc.from("hoa_members").upsert({
            server_id: mother.id,
            user_id: user.id,
            handle,
            rank_label: "Country Liaison",
            role: "guest",
            clearance_rank: 1, // CUI — enough to see global-briefings + country-liaison
          }, { onConflict: "server_id,user_id", ignoreDuplicates: true });
        }
      }

      await svc.from("hoa_invites").update({ uses: inv.uses + 1 }).eq("id", inv.id);
      await svc.from("hoa_audit").insert({
        server_id: inv.server_id,
        actor_id: user.id,
        actor_handle: handle,
        action: "INVITE_ACCEPTED",
        target: code,
        detail: `role=${inv.role_grant} clearance=${inv.clearance_grant}`,
      });

      const { data: server } = await svc.from("hoa_servers").select("id, code, name").eq("id", inv.server_id).single();
      return json({ ok: true, server, role: inv.role_grant, clearance: inv.clearance_grant }, 200, cors);
    }

    // ---------------------------------------------------------------------
    // CREATE_SERVER — spin up a country server & seed default channels
    // ---------------------------------------------------------------------
    if (action === "create_server") {
      const code    = String(body?.code ?? "").trim().toUpperCase().slice(0, 8);
      const name    = String(body?.name ?? "").trim().slice(0, 80);
      const country = String(body?.country ?? "").trim().slice(0, 80) || null;
      const handle  = (String(body?.handle ?? "").trim() || user.email?.split("@")[0] || "sovereign").slice(0, 40);
      if (!code || !name) return json({ error: "code + name required" }, 400, cors);

      // Reserve HOA code for the mothership.
      if (code === "HOA") return json({ error: "reserved code" }, 400, cors);

      const { data: srv, error: srvErr } = await svc.from("hoa_servers").insert({
        code, name, country, created_by: user.id, is_mothership: false,
        description: `${name} sovereign server.`,
      }).select("*").single();
      if (srvErr) return json({ error: srvErr.message }, 400, cors);

      await svc.from("hoa_members").insert({
        server_id: srv.id, user_id: user.id, handle,
        rank_label: "Sovereign", role: "owner", clearance_rank: 4,
      });

      const defaults = [
        { name: "daily-briefings", kind: "text",      min_clearance: 1, topic: "0600Z posture." },
        { name: "ops-room",        kind: "voice",     min_clearance: 2, topic: null },
        { name: "sealed-orders",   kind: "vault",     min_clearance: 3, topic: null },
        { name: "public-alert",    kind: "broadcast", min_clearance: 0, topic: "Nationwide broadcast." },
      ];
      await svc.from("hoa_channels").insert(defaults.map(c => ({ ...c, server_id: srv.id })));

      await svc.from("hoa_audit").insert({
        server_id: srv.id, actor_id: user.id, actor_handle: handle,
        action: "SERVER_CREATED", target: code, detail: name,
      });
      return json({ ok: true, server: srv }, 200, cors);
    }

    return json({ error: "unknown action" }, 400, cors);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500, cors);
  }
});
