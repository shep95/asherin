// asherin.data — workspace access resolution for the data platform.
// Every function that touches a workspace goes through here: the caller's
// role is read from the database, never from the request body.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type DataRole = "owner" | "editor" | "viewer" | null;

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function workspaceRole(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<DataRole> {
  const { data: ws } = await admin
    .from("data_workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return null;
  if (ws.owner_id === userId) return "owner";
  const { data: m } = await admin
    .from("data_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = m?.role as DataRole | undefined;
  return role ?? null;
}

export function canWrite(role: DataRole): boolean {
  return role === "owner" || role === "editor";
}

export function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Loads rows for a version in bounded pages. Hard caps protect the runtime:
 *  analysis runs on a bounded sample and the answer says so. */
export async function loadRows(
  admin: SupabaseClient,
  versionId: string,
  cap = 20_000,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const rows: Record<string, unknown>[] = [];
  const page = 1000;
  for (let from = 0; from < cap; from += page) {
    const { data, error } = await admin
      .from("data_records")
      .select("row")
      .eq("version_id", versionId)
      .order("idx", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const d of data) rows.push((d.row ?? {}) as Record<string, unknown>);
    if (data.length < page) return { rows, truncated: false };
  }
  const { count } = await admin
    .from("data_records")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId);
  return { rows, truncated: (count ?? 0) > rows.length };
}

export async function auditData(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string | null,
  action: string,
  target: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await admin.from("data_audit").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action,
    target,
    meta,
  });
}
