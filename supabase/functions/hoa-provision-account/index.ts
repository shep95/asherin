// hoa-provision-account — Emperor & President account provisioning.
//
// AUTHORITY MODEL
//   Emperor  (hoa_is_houseofasher = true): can create ANY account on ANY server,
//            including server_owners (Presidents). Only the Emperor can mint Presidents.
//   President(hoa_members.role = 'owner' on target server): can create citizens
//            (operator | analyst | guest) on that ONE server only. Cannot mint owners.
//   Anyone else: denied.
//
// FLOW
//   1. Validate caller JWT + authority for {server_id, role}.
//   2. Auto-generate strong password if none supplied.
//   3. Enforce uniqueness (no duplicate email).
//   4. Create auth user (email_confirm: true so account is immediately usable).
//   5. Insert hoa_members row on the target server.
//   6. On any post-createUser failure → delete the auth user (no orphans).
//   7. Write hoa_audit entry.
//   8. Return { user_id, email, generated_password? } — password shown ONCE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ROLES = new Set(["owner", "operator", "analyst", "guest"]);
const RANK_FOR: Record<string, number> = { guest: 0, analyst: 1, operator: 2, owner: 3, houseofasher: 4 };

function genPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // URL-safe base64, remove padding, prefix with "Ah!" so it always satisfies "upper+lower+symbol+digit"
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `Ah!${b64}${(bytes[0] % 10)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "no_auth" }, 401);

  const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });

  const { data: userRes, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "invalid_session" }, 401);
  const caller = userRes.user;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const email: string = String(body?.email ?? "").trim().toLowerCase();
  const role: string  = String(body?.role ?? "").trim();
  const server_id: string | null = body?.server_id ?? null;
  const handle: string = String(body?.handle ?? email.split("@")[0]).slice(0, 40);
  let password: string | undefined = body?.password ? String(body.password) : undefined;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400);
  if (!ALLOWED_ROLES.has(role))                   return json({ error: "bad_role" }, 400);
  if (!server_id)                                 return json({ error: "server_required" }, 400);
  if (password && password.length < 12)           return json({ error: "password_too_short" }, 400);

  // ─── Authority check ────────────────────────────────────────────────────
  const { data: emperorFlag } = await svc.rpc("hoa_is_houseofasher", { _user: caller.id });
  const isEmperor = emperorFlag === true;

  let isPresidentOfServer = false;
  if (!isEmperor) {
    const { data: m } = await svc
      .from("hoa_members").select("role").eq("server_id", server_id).eq("user_id", caller.id).maybeSingle();
    isPresidentOfServer = m?.role === "owner";
  }

  if (role === "owner" && !isEmperor)       return json({ error: "only_emperor_mints_presidents" }, 403);
  if (!isEmperor && !isPresidentOfServer)   return json({ error: "not_authorized_for_server" }, 403);

  // ─── Uniqueness ─────────────────────────────────────────────────────────
  const generated = !password;
  if (generated) password = genPassword();

  // Try to reuse an existing auth user with the same email (Emperor inviting
  // an existing account onto a new server should not create a duplicate).
  let userId: string | null = null;
  let created = false;
  {
    // list up to 200 matching users by scanning first page filtered by email
    const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    const hit = existing?.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) userId = hit.id;
  }

  if (!userId) {
    const { data: newUser, error: cErr } = await svc.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { provisioned_by: caller.id },
    });
    if (cErr || !newUser?.user) return json({ error: cErr?.message ?? "create_failed" }, 500);
    userId = newUser.user.id;
    created = true;
  } else if (password && generated) {
    // Existing account: don't reset their password silently.
    password = undefined;
  }

  // ─── Membership ─────────────────────────────────────────────────────────
  const clearance = RANK_FOR[role] ?? 1;
  const { error: memErr } = await svc.from("hoa_members").upsert({
    server_id, user_id: userId, handle, role, rank_label: role === "owner" ? "President" : "Operator",
    clearance_rank: clearance,
  }, { onConflict: "server_id,user_id" });

  if (memErr) {
    // Rollback: if we just created the auth user, remove it to avoid orphan.
    if (created) await svc.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: `member_insert_failed: ${memErr.message}` }, 500);
  }

  // ─── Audit ──────────────────────────────────────────────────────────────
  await svc.from("hoa_audit").insert({
    server_id, actor_id: caller.id, action: "provision_account",
    target_type: "user", target_id: userId,
    detail: { email, role, generated_password: generated, existed: !created },
  }).catch(() => {});

  return json({
    ok: true, user_id: userId, email, role, server_id,
    created, generated_password: generated ? password : undefined,
  });
});
