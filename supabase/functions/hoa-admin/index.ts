// hoa-admin — server-owner-only administration for the sovereign command deck.
//
// Actions:
//   set_api_key   { serverId, provider, apiKey }     → AES-GCM encrypts with HOA_KEY_SECRET, stores ciphertext + hint
//   rotate_api_key{ serverId, apiKey }               → same, keeps provider
//   delete_api_key{ serverId }
//   create_role   { serverId, name, color, perms }
//   update_role   { roleId, name?, color?, perms? }
//   delete_role   { roleId }
//   assign_role   { memberId, roleId }
//   unassign_role { memberId, roleId }
//
// Every mutation writes an entry to hoa_audit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY_SECRET   = Deno.env.get("HOA_KEY_SECRET")!;

// ─── AES-GCM helpers ────────────────────────────────────────────────────────
async function getKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(KEY_SECRET).slice(0, 32);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
function b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
export async function encryptApiKey(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const ct  = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body.action ?? "");
    if (!action) return json({ error: "action required" }, 400);

    // Helper: require the caller to be OWNER (or houseofasher operator) on serverId.
    async function requireOwner(serverId: string): Promise<{ handle: string }> {
      const { data: mem, error } = await admin
        .from("hoa_members").select("handle, role")
        .eq("server_id", serverId).eq("user_id", user.id).maybeSingle();
      if (error || !mem) throw new Error("not a member of this server");
      if (mem.role !== "owner" && mem.role !== "houseofasher") throw new Error("owner-only action");
      return { handle: mem.handle };
    }
    async function audit(serverId: string | null, actorHandle: string, act: string, target?: string, detail?: string) {
      await admin.from("hoa_audit").insert({
        server_id: serverId, actor_id: user.id, actor_handle: actorHandle,
        action: act, target: target ?? null, detail: detail ?? null,
      });
    }

    switch (action) {
      // ── API key ────────────────────────────────────────────────────────────
      case "set_api_key":
      case "rotate_api_key": {
        const serverId = String(body.serverId ?? "");
        const apiKey   = String(body.apiKey ?? "").trim();
        const provider = String(body.provider ?? (action === "rotate_api_key" ? "" : "")).trim().toLowerCase();
        if (!serverId || !apiKey) return json({ error: "serverId and apiKey required" }, 400);
        if (apiKey.length < 10 || apiKey.length > 512) return json({ error: "invalid apiKey length" }, 400);
        const { handle } = await requireOwner(serverId);

        // If rotate, keep existing provider unless a new one supplied
        let effectiveProvider = provider;
        if (action === "rotate_api_key" && !provider) {
          const { data: cur } = await admin.from("hoa_servers").select("api_key_provider").eq("id", serverId).single();
          effectiveProvider = String(cur?.api_key_provider ?? "openai");
        }
        if (!["openai","anthropic","lovable","gemini"].includes(effectiveProvider)) {
          return json({ error: "provider must be openai|anthropic|lovable|gemini" }, 400);
        }

        const ciphertext = await encryptApiKey(apiKey);
        const hint = apiKey.slice(-4);
        const { error } = await admin.from("hoa_servers").update({
          api_key_ciphertext: ciphertext,
          api_key_provider: effectiveProvider,
          api_key_hint: hint,
          api_key_updated_at: new Date().toISOString(),
          api_key_updated_by: user.id,
        }).eq("id", serverId);
        if (error) throw error;
        await audit(serverId, handle, action === "set_api_key" ? "API_KEY_SET" : "API_KEY_ROTATED",
          effectiveProvider, `hint=****${hint}`);
        return json({ ok: true, provider: effectiveProvider, hint });
      }

      case "delete_api_key": {
        const serverId = String(body.serverId ?? "");
        if (!serverId) return json({ error: "serverId required" }, 400);
        const { handle } = await requireOwner(serverId);
        const { error } = await admin.from("hoa_servers").update({
          api_key_ciphertext: null, api_key_provider: null, api_key_hint: null,
          api_key_updated_at: new Date().toISOString(), api_key_updated_by: user.id,
        }).eq("id", serverId);
        if (error) throw error;
        await audit(serverId, handle, "API_KEY_REVOKED");
        return json({ ok: true });
      }

      // ── Roles ──────────────────────────────────────────────────────────────
      case "create_role": {
        const serverId = String(body.serverId ?? "");
        const name = String(body.name ?? "").trim();
        const color = String(body.color ?? "#94a3b8");
        const perms = (body.perms ?? {}) as Record<string, boolean>;
        if (!serverId || !name) return json({ error: "serverId and name required" }, 400);
        if (name.length > 40) return json({ error: "role name too long" }, 400);
        const { handle } = await requireOwner(serverId);
        const { data, error } = await admin.from("hoa_server_roles").insert({
          server_id: serverId, name, color,
          perm_send:            !!perms.send,
          perm_invite:          !!perms.invite,
          perm_manage_roles:    !!perms.manage_roles,
          perm_manage_channels: !!perms.manage_channels,
          perm_view_audit:      !!perms.view_audit,
          perm_manage_api_key:  !!perms.manage_api_key,
          created_by: user.id,
        }).select().single();
        if (error) throw error;
        await audit(serverId, handle, "ROLE_CREATED", name);
        return json({ ok: true, role: data });
      }

      case "update_role": {
        const roleId = String(body.roleId ?? "");
        if (!roleId) return json({ error: "roleId required" }, 400);
        const { data: existing } = await admin.from("hoa_server_roles").select("server_id, name").eq("id", roleId).single();
        if (!existing) return json({ error: "role not found" }, 404);
        const { handle } = await requireOwner(existing.server_id);
        const patch: Record<string, unknown> = {};
        if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 40);
        if (body.color !== undefined) patch.color = String(body.color).slice(0, 20);
        if (body.perms) {
          const p = body.perms as Record<string, boolean>;
          patch.perm_send            = !!p.send;
          patch.perm_invite          = !!p.invite;
          patch.perm_manage_roles    = !!p.manage_roles;
          patch.perm_manage_channels = !!p.manage_channels;
          patch.perm_view_audit      = !!p.view_audit;
          patch.perm_manage_api_key  = !!p.manage_api_key;
        }
        const { error } = await admin.from("hoa_server_roles").update(patch).eq("id", roleId);
        if (error) throw error;
        await audit(existing.server_id, handle, "ROLE_UPDATED", existing.name);
        return json({ ok: true });
      }

      case "delete_role": {
        const roleId = String(body.roleId ?? "");
        if (!roleId) return json({ error: "roleId required" }, 400);
        const { data: existing } = await admin.from("hoa_server_roles").select("server_id, name").eq("id", roleId).single();
        if (!existing) return json({ error: "role not found" }, 404);
        const { handle } = await requireOwner(existing.server_id);
        const { error } = await admin.from("hoa_server_roles").delete().eq("id", roleId);
        if (error) throw error;
        await audit(existing.server_id, handle, "ROLE_DELETED", existing.name);
        return json({ ok: true });
      }

      case "assign_role":
      case "unassign_role": {
        const memberId = String(body.memberId ?? "");
        const roleId   = String(body.roleId ?? "");
        if (!memberId || !roleId) return json({ error: "memberId and roleId required" }, 400);
        const { data: mem } = await admin.from("hoa_members").select("server_id, handle").eq("id", memberId).single();
        const { data: role } = await admin.from("hoa_server_roles").select("server_id, name").eq("id", roleId).single();
        if (!mem || !role || mem.server_id !== role.server_id) return json({ error: "invalid member/role" }, 400);
        const { handle } = await requireOwner(mem.server_id);

        if (action === "assign_role") {
          const { error } = await admin.from("hoa_member_roles").insert({
            server_id: mem.server_id, member_id: memberId, role_id: roleId, assigned_by: user.id,
          });
          if (error && !String(error.message).includes("duplicate")) throw error;
          await audit(mem.server_id, handle, "ROLE_ASSIGNED", mem.handle, role.name);
        } else {
          const { error } = await admin.from("hoa_member_roles").delete().eq("member_id", memberId).eq("role_id", roleId);
          if (error) throw error;
          await audit(mem.server_id, handle, "ROLE_UNASSIGNED", mem.handle, role.name);
        }
        return json({ ok: true });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("hoa-admin error", e);
    return json({ error: (e as Error).message ?? "internal error" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
