// sharing and collaboration for software artifacts.
//
// Two different operations live here and are never conflated: sharing gives a
// named person a role, publishing changes who may discover the artifact at all.
// Nothing in this file grants access on its own — every write lands in a table
// guarded by row level security and every acceptance runs server side.

import { supabase } from "@/integrations/supabase/client";
import { recordEvent } from "./store";
import {
  roleCan,
  type ArtifactCapability,
  type ArtifactInvitation,
  type ArtifactRole,
  type ArtifactVisibility,
  type InvitableRole,
  type ShareLink,
} from "./types";

/* ── pure logic ───────────────────────────────────────────────────────── */

export const VISIBILITY_MEANING: Record<ArtifactVisibility, string> = {
  private: "only you and people you invite",
  shared: "you, and the people you invited, by role",
  unlisted: "anyone holding an active share link",
  public: "any signed-in asherin account can find it",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmail(raw: string): boolean {
  return EMAIL.test(normaliseEmail(raw));
}

export type InvitationProblem =
  | "invalid_email"
  | "self_invite"
  | "already_member"
  | "already_invited"
  | "not_allowed"
  | null;

export function checkInvitation(input: {
  email: string;
  actorRole: ArtifactRole | null;
  actorEmail: string | null;
  memberEmails: string[];
  pendingEmails: string[];
}): InvitationProblem {
  if (!roleCan(input.actorRole, "manage_members")) return "not_allowed";
  const email = normaliseEmail(input.email);
  if (!isEmail(email)) return "invalid_email";
  if (input.actorEmail && normaliseEmail(input.actorEmail) === email) return "self_invite";
  if (input.memberEmails.map(normaliseEmail).includes(email)) return "already_member";
  if (input.pendingEmails.map(normaliseEmail).includes(email)) return "already_invited";
  return null;
}

export const INVITATION_PROBLEM_TEXT: Record<Exclude<InvitationProblem, null>, string> = {
  invalid_email: "that does not look like an email address",
  self_invite: "you already have access to this",
  already_member: "that person already has access",
  already_invited: "that person already has an invitation waiting",
  not_allowed: "your role cannot change who has access",
};

/** An invitation only counts as live while it is pending and unexpired. */
export function invitationIsLive(inv: ArtifactInvitation, now = new Date()): boolean {
  return inv.status === "pending" && new Date(inv.expiresAt).getTime() > now.getTime();
}

export function shareLinkIsLive(link: ShareLink, now = new Date()): boolean {
  if (link.revoked) return false;
  if (!link.expiresAt) return true;
  return new Date(link.expiresAt).getTime() > now.getTime();
}

export function shareLinkUrl(token: string, origin = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}/dashboard/software/join/${token}`;
}

export function invitationUrl(token: string, origin = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}/dashboard/software/invite/${token}`;
}

/**
 * A role change is an audit event, never a silent update. This produces the
 * before/after record that gets written alongside it.
 */
export function roleChangeAudit(input: {
  subject: string;
  from: ArtifactRole | null;
  to: ArtifactRole | null;
}): Record<string, unknown> {
  const gained: ArtifactCapability[] = [];
  const lost: ArtifactCapability[] = [];
  const all: ArtifactCapability[] = [
    "read",
    "comment",
    "edit_files",
    "create_version",
    "install",
    "manage_members",
    "manage_distribution",
    "delete",
  ];
  for (const cap of all) {
    const before = roleCan(input.from, cap);
    const after = roleCan(input.to, cap);
    if (!before && after) gained.push(cap);
    if (before && !after) lost.push(cap);
  }
  return { subject: input.subject, from: input.from, to: input.to, gained, lost };
}

/** Editors may change code. Distribution and security stay with owners/admins. */
export function canChangeDistribution(role: ArtifactRole | null): boolean {
  return roleCan(role, "manage_distribution");
}

/* ── persistence ──────────────────────────────────────────────────────── */

type Loose = Record<string, unknown>;

export interface ArtifactMember {
  id: string;
  artifactId: string;
  userId: string;
  role: ArtifactRole;
  createdAt: string;
}

function mapInvitation(row: Loose): ArtifactInvitation {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    inviterUserId: String(row.inviter_user_id),
    inviteeEmail: String(row.invitee_email),
    inviteeUserId: (row.invitee_user_id as string) ?? null,
    role: row.role as InvitableRole,
    status: row.status as ArtifactInvitation["status"],
    delivery: row.delivery as ArtifactInvitation["delivery"],
    token: String(row.token),
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    acceptedAt: (row.accepted_at as string) ?? null,
  };
}

function mapLink(row: Loose): ShareLink {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    createdBy: String(row.created_by),
    token: String(row.token),
    role: row.role as ShareLink["role"],
    revoked: !!row.revoked,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function listMembers(artifactId: string): Promise<ArtifactMember[]> {
  const { data, error } = await supabase
    .from("software_artifact_member")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String((r as Loose).id),
    artifactId: String((r as Loose).artifact_id),
    userId: String((r as Loose).user_id),
    role: (r as Loose).role as ArtifactRole,
    createdAt: String((r as Loose).created_at),
  }));
}

export async function setMemberRole(input: {
  member: ArtifactMember;
  role: ArtifactRole;
  actorUserId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("software_artifact_member")
    .update({ role: input.role })
    .eq("id", input.member.id);
  if (error) throw error;
  await recordEvent({
    artifactId: input.member.artifactId,
    type: "artifact.permission_changed",
    actorUserId: input.actorUserId,
    metadata: roleChangeAudit({ subject: input.member.userId, from: input.member.role, to: input.role }),
  });
}

export async function removeMember(member: ArtifactMember, actorUserId: string): Promise<void> {
  const { error } = await supabase.from("software_artifact_member").delete().eq("id", member.id);
  if (error) throw error;
  await recordEvent({
    artifactId: member.artifactId,
    type: "artifact.permission_changed",
    actorUserId,
    metadata: roleChangeAudit({ subject: member.userId, from: member.role, to: null }),
  });
}

export async function listInvitations(artifactId: string): Promise<ArtifactInvitation[]> {
  const { data, error } = await supabase
    .from("software_artifact_invitation")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapInvitation(r as Loose));
}

/**
 * Creates the invitation record. Email delivery is a separate concern: this
 * project has no configured invite mailer, so the record is created with
 * delivery `pending` and the caller is told to pass the link on themselves.
 * Nothing here ever claims an email was sent.
 */
export async function createInvitation(input: {
  artifactId: string;
  email: string;
  role: InvitableRole;
  actorUserId: string;
}): Promise<ArtifactInvitation> {
  const { data, error } = await supabase
    .from("software_artifact_invitation")
    .insert({
      artifact_id: input.artifactId,
      inviter_user_id: input.actorUserId,
      invitee_email: normaliseEmail(input.email),
      role: input.role,
      delivery: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  const invitation = mapInvitation(data as Loose);
  await recordEvent({
    artifactId: input.artifactId,
    type: "artifact.shared",
    actorUserId: input.actorUserId,
    result: "pending",
    metadata: { action: "invited", role: input.role, delivery: "pending" },
  });
  return invitation;
}

export async function revokeInvitation(inv: ArtifactInvitation, actorUserId: string): Promise<void> {
  const { error } = await supabase
    .from("software_artifact_invitation")
    .update({ status: "revoked" })
    .eq("id", inv.id);
  if (error) throw error;
  await recordEvent({
    artifactId: inv.artifactId,
    type: "artifact.permission_changed",
    actorUserId,
    metadata: { action: "invitation_revoked", role: inv.role },
  });
}

/** Acceptance runs entirely server side and checks the signed-in email. */
export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("software_accept_invitation", { _token: token });
  if (error) throw error;
  return String(data);
}

export async function redeemShareLink(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("software_redeem_share_link", { _token: token });
  if (error) throw error;
  return String(data);
}

export async function listShareLinks(artifactId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from("software_share_link")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapLink(r as Loose));
}

export async function createShareLink(input: {
  artifactId: string;
  role: ShareLink["role"];
  actorUserId: string;
  expiresAt?: string | null;
}): Promise<ShareLink> {
  const { data, error } = await supabase
    .from("software_share_link")
    .insert({
      artifact_id: input.artifactId,
      created_by: input.actorUserId,
      role: input.role,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordEvent({
    artifactId: input.artifactId,
    type: "artifact.shared",
    actorUserId: input.actorUserId,
    metadata: { action: "share_link_created", role: input.role },
  });
  return mapLink(data as Loose);
}

export async function revokeShareLink(link: ShareLink, actorUserId: string): Promise<void> {
  const { error } = await supabase.from("software_share_link").update({ revoked: true }).eq("id", link.id);
  if (error) throw error;
  await recordEvent({
    artifactId: link.artifactId,
    type: "artifact.permission_changed",
    actorUserId,
    metadata: { action: "share_link_revoked" },
  });
}
