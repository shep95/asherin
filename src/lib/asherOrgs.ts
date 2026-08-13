import { isOwnerEmail } from "@/lib/adminEmail";
import { supabase } from "@/integrations/supabase/client";

export type AsherRole =
  | "super_owner" | "primary_admin" | "secondary_admin"
  | "dept_admin" | "officer" | "analyst";

export type AsherClassification =
  | "UNCLASSIFIED" | "CUI" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET" | "TS_SCI";

export const ROLE_LABEL: Record<AsherRole, string> = {
  super_owner: "Super Owner",
  primary_admin: "Primary Admin",
  secondary_admin: "Secondary Admin",
  dept_admin: "Department Admin",
  officer: "Officer",
  analyst: "Analyst",
};

export async function isSuperOwner(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isOwnerEmail(user.email);
}

export async function listOrgs() {
  const { data, error } = await supabase
    .from("asher_orgs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOrg(input: {
  name: string;
  code?: string;
  org_type?: string;
  country?: string;
  max_classification?: AsherClassification;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("asher_orgs")
    .insert({
      name: input.name,
      code: input.code ?? null,
      org_type: input.org_type ?? null,
      country: input.country ?? null,
      max_classification: input.max_classification ?? "SECRET",
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  await audit(data.id, "org_created", "org", data.id, { name: input.name });
  return data;
}

export async function listDepartments(orgId: string) {
  const { data, error } = await supabase
    .from("asher_departments")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createDepartment(orgId: string, input: { name: string; code?: string; description?: string }) {
  const { data, error } = await supabase
    .from("asher_departments")
    .insert({ org_id: orgId, name: input.name, code: input.code ?? null, description: input.description ?? null })
    .select()
    .single();
  if (error) throw error;
  await audit(orgId, "department_created", "department", data.id, { name: input.name });
  return data;
}

export async function listSections(deptId: string) {
  const { data, error } = await supabase
    .from("asher_sections").select("*").eq("department_id", deptId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSection(deptId: string, name: string, description?: string) {
  const { data, error } = await supabase
    .from("asher_sections")
    .insert({ department_id: deptId, name, description: description ?? null })
    .select().single();
  if (error) throw error;
  return data;
}

export async function listTeams(sectionId: string) {
  const { data, error } = await supabase
    .from("asher_teams").select("*").eq("section_id", sectionId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createTeam(sectionId: string, name: string, focus?: string) {
  const { data, error } = await supabase
    .from("asher_teams")
    .insert({ section_id: sectionId, name, focus: focus ?? null })
    .select().single();
  if (error) throw error;
  return data;
}

export async function listMemberships(orgId: string) {
  const { data, error } = await supabase
    .from("asher_org_memberships")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMyMemberships() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("asher_org_memberships")
    .select("*, asher_orgs(*)")
    .eq("user_id", user.id);
  if (error) throw error;
  return data ?? [];
}

export interface InviteInput {
  org_id: string;
  email: string;
  role: AsherRole;
  full_name?: string;
  rank?: string;
  position?: string;
  clearance?: AsherClassification;
  department_id?: string | null;
  section_id?: string | null;
  team_id?: string | null;
  message?: string;
}

export async function createInvitation(input: InviteInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("asher_invitations")
    .insert({
      org_id: input.org_id,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      full_name: input.full_name ?? null,
      rank: input.rank ?? null,
      position: input.position ?? null,
      clearance: input.clearance ?? null,
      department_id: input.department_id ?? null,
      section_id: input.section_id ?? null,
      team_id: input.team_id ?? null,
      message: input.message ?? null,
      invited_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  await audit(input.org_id, "invitation_created", "invitation", data.id, { email: input.email, role: input.role });
  return data;
}

export async function listInvitations(orgId: string) {
  const { data, error } = await supabase
    .from("asher_invitations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMyInvitations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return [];
  const { data, error } = await supabase
    .from("asher_invitations")
    .select("*, asher_orgs(name)")
    .ilike("email", user.email)
    .eq("status", "pending");
  if (error) throw error;
  return data ?? [];
}

export async function revokeInvitation(id: string, orgId: string) {
  const { error } = await supabase
    .from("asher_invitations")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) throw error;
  await audit(orgId, "invitation_revoked", "invitation", id, {});
}

export async function acceptInvitation(token: string) {
  const { data, error } = await supabase.rpc("asher_accept_invitation", { _token: token });
  if (error) throw error;
  return data as string;
}

export function inviteLink(token: string) {
  return `${window.location.origin}/asher/dashboard?invite=${token}`;
}

export async function listAudit(orgId: string, limit = 100) {
  const { data, error } = await supabase
    .from("asher_org_audit_log")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function audit(orgId: string, action: string, target_type: string, target_id: string, metadata: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("asher_org_audit_log").insert([{
    org_id: orgId, actor_id: user.id, action, target_type, target_id, metadata: metadata as never,
  }]);
}
