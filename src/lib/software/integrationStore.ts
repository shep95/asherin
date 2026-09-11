// owner-scoped persistence and the gateway client for integrations.
//
// The browser stores names and permissions. Credentials live in project
// secrets, and every outbound call is made by the gateway edge function on the
// signed-in user's behalf.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  validateCredentialRef,
  validateEndpoint,
  wrapUntrusted,
  type IntegrationAuthType,
  type IntegrationContractShape,
  type IntegrationEvent,
  type IntegrationGrant,
  type IntegrationHealthState,
  type IntegrationRecord,
  type IntegrationTransport,
  type IntegrationType,
  type UntrustedResult,
} from "./integrations";

const j = (v: unknown): Json => JSON.parse(JSON.stringify(v ?? null)) as Json;
type Loose = Record<string, unknown>;

function mapIntegration(row: Loose): IntegrationRecord {
  const contract = (row.contract && typeof row.contract === "object" ? row.contract : {}) as IntegrationContractShape;
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    provider: String(row.provider),
    displayName: String(row.display_name),
    type: row.integration_type as IntegrationType,
    endpoint: (row.endpoint as string) ?? null,
    transport: row.transport as IntegrationTransport,
    authType: row.auth_type as IntegrationAuthType,
    credentialRef: (row.credential_ref as string) ?? null,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    contract: { operations: [], ...contract },
    capabilities: (row.capabilities as Record<string, unknown>) ?? {},
    status: row.status as IntegrationRecord["status"],
    health: row.health as IntegrationHealthState,
    healthDetail: (row.health_detail as string) ?? null,
    lastCheckedAt: (row.last_checked_at as string) ?? null,
    version: (row.version as string) ?? null,
    compatibility: (row.compatibility as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapGrant(row: Loose): IntegrationGrant {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    integrationId: String(row.integration_id),
    artifactId: String(row.artifact_id),
    installationId: (row.installation_id as string) ?? null,
    grantedScopes: Array.isArray(row.granted_scopes) ? (row.granted_scopes as string[]) : [],
    grantedTools: Array.isArray(row.granted_tools) ? (row.granted_tools as string[]) : [],
    rationale: (row.rationale as string) ?? null,
    state: row.state as IntegrationGrant["state"],
    approvedAt: (row.approved_at as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Loose): IntegrationEvent {
  return {
    id: String(row.id),
    integrationId: (row.integration_id as string) ?? null,
    artifactId: (row.artifact_id as string) ?? null,
    grantId: (row.grant_id as string) ?? null,
    eventType: String(row.event_type),
    operation: (row.operation as string) ?? null,
    outcome: row.outcome as IntegrationEvent["outcome"],
    detail: (row.detail as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

async function ownerId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("sign in to manage integrations");
  return data.user.id;
}

/* ── integrations ─────────────────────────────────────────────────────── */

export async function listIntegrations(): Promise<IntegrationRecord[]> {
  const { data, error } = await supabase
    .from("software_integration")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapIntegration);
}

export interface NewIntegration {
  provider: string;
  displayName: string;
  type: IntegrationType;
  endpoint: string | null;
  transport: IntegrationTransport;
  authType: IntegrationAuthType;
  credentialRef: string | null;
  scopes?: string[];
  contract?: IntegrationContractShape;
  version?: string | null;
  compatibility?: string | null;
}

export async function createIntegration(input: NewIntegration): Promise<IntegrationRecord> {
  if (input.type !== "internal") {
    const check = validateEndpoint(input.endpoint ?? "");
    if (!check.ok) throw new Error(check.reason);
    input = { ...input, endpoint: check.normalized ?? input.endpoint };
  }
  const cred = validateCredentialRef(input.credentialRef);
  if (!cred.ok) throw new Error(cred.reason);

  const { data, error } = await supabase
    .from("software_integration")
    .insert({
      owner_user_id: await ownerId(),
      provider: input.provider.trim(),
      display_name: input.displayName.trim(),
      integration_type: input.type,
      endpoint: input.endpoint,
      transport: input.transport,
      auth_type: input.authType,
      credential_ref: cred.normalized ?? null,
      scopes: input.scopes ?? [],
      contract: j(input.contract ?? { operations: [] }),
      version: input.version ?? null,
      compatibility: input.compatibility ?? null,
      // never "connected" on creation. only a real health check may say that.
      health: input.authType !== "none" && !input.credentialRef ? "unconfigured" : "disconnected",
    })
    .select()
    .single();
  if (error) throw error;
  return mapIntegration(data as Loose);
}

export async function updateIntegration(
  id: string,
  patch: Partial<Pick<IntegrationRecord, "displayName" | "status" | "scopes" | "contract" | "credentialRef" | "endpoint">>,
): Promise<IntegrationRecord> {
  const row: Loose = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.scopes !== undefined) row.scopes = patch.scopes;
  if (patch.contract !== undefined) row.contract = j(patch.contract);
  if (patch.endpoint !== undefined) {
    const check = validateEndpoint(patch.endpoint ?? "");
    if (!check.ok) throw new Error(check.reason);
    row.endpoint = check.normalized;
    row.health = "disconnected";
  }
  if (patch.credentialRef !== undefined) {
    const cred = validateCredentialRef(patch.credentialRef);
    if (!cred.ok) throw new Error(cred.reason);
    row.credential_ref = cred.normalized ?? null;
    row.health = "disconnected";
  }
  const { data, error } = await supabase.from("software_integration").update(row).eq("id", id).select().single();
  if (error) throw error;
  return mapIntegration(data as Loose);
}

/** revoking stops every app immediately: the record is marked and grants close. */
export async function revokeIntegration(id: string): Promise<void> {
  const { error } = await supabase
    .from("software_integration")
    .update({ status: "revoked", health: "disconnected", health_detail: "revoked by you" })
    .eq("id", id);
  if (error) throw error;
  await supabase.from("software_integration_grant").update({ state: "revoked" }).eq("integration_id", id);
  await recordIntegrationEvent({ integrationId: id, eventType: "revoke", outcome: "ok", detail: {} });
}

export async function deleteIntegration(id: string): Promise<void> {
  const { error } = await supabase.from("software_integration").delete().eq("id", id);
  if (error) throw error;
}

/* ── grants ───────────────────────────────────────────────────────────── */

export async function listGrants(artifactId?: string): Promise<IntegrationGrant[]> {
  let query = supabase.from("software_integration_grant").select("*");
  if (artifactId) query = query.eq("artifact_id", artifactId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapGrant);
}

export async function grantIntegration(input: {
  integrationId: string;
  artifactId: string;
  installationId?: string | null;
  scopes: string[];
  tools?: string[];
  rationale?: string | null;
  approve: boolean;
}): Promise<IntegrationGrant> {
  const { data, error } = await supabase
    .from("software_integration_grant")
    .upsert(
      {
        owner_user_id: await ownerId(),
        integration_id: input.integrationId,
        artifact_id: input.artifactId,
        installation_id: input.installationId ?? null,
        granted_scopes: input.scopes,
        granted_tools: input.tools ?? [],
        rationale: input.rationale ?? null,
        state: input.approve ? "approved" : "pending",
        approved_at: input.approve ? new Date().toISOString() : null,
      },
      { onConflict: "integration_id,artifact_id" },
    )
    .select()
    .single();
  if (error) throw error;
  const grant = mapGrant(data as Loose);
  await recordIntegrationEvent({
    integrationId: input.integrationId,
    artifactId: input.artifactId,
    grantId: grant.id,
    eventType: input.approve ? "grant_approved" : "grant_requested",
    outcome: "ok",
    detail: { scopes: input.scopes.join(","), tools: (input.tools ?? []).join(",") },
  });
  return grant;
}

export async function revokeGrant(grantId: string): Promise<void> {
  const { data, error } = await supabase
    .from("software_integration_grant")
    .update({ state: "revoked" })
    .eq("id", grantId)
    .select()
    .single();
  if (error) throw error;
  const grant = mapGrant(data as Loose);
  await recordIntegrationEvent({
    integrationId: grant.integrationId,
    artifactId: grant.artifactId,
    grantId,
    eventType: "grant_revoked",
    outcome: "ok",
    detail: {},
  });
}

/* ── audit ────────────────────────────────────────────────────────────── */

export async function recordIntegrationEvent(input: {
  integrationId?: string | null;
  artifactId?: string | null;
  grantId?: string | null;
  eventType: string;
  operation?: string | null;
  outcome: IntegrationEvent["outcome"];
  detail: Record<string, unknown>;
}): Promise<void> {
  const { sanitizeAuditDetail } = await import("./integrations");
  await supabase.from("software_integration_event").insert({
    owner_user_id: await ownerId(),
    integration_id: input.integrationId ?? null,
    artifact_id: input.artifactId ?? null,
    grant_id: input.grantId ?? null,
    event_type: input.eventType,
    operation: input.operation ?? null,
    outcome: input.outcome,
    detail: j(sanitizeAuditDetail(input.detail)),
  });
}

export async function listIntegrationEvents(limit = 50): Promise<IntegrationEvent[]> {
  const { data, error } = await supabase
    .from("software_integration_event")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

/* ── gateway ──────────────────────────────────────────────────────────── */

export interface GatewayHealth {
  ok: boolean;
  health: IntegrationHealthState;
  detail: string;
}

export async function checkIntegrationHealth(integrationId: string): Promise<GatewayHealth> {
  const { data, error } = await supabase.functions.invoke("software-integration-gateway", {
    body: { op: "health", integrationId },
  });
  if (error) return { ok: false, health: "failed", detail: "the connection test could not be run" };
  const res = data as { ok?: boolean; health?: IntegrationHealthState; detail?: string; error?: string };
  return {
    ok: !!res?.ok,
    health: res?.health ?? "failed",
    detail: res?.detail ?? res?.error ?? "no answer from the service",
  };
}

export interface GatewayInvocation {
  ok: boolean;
  state?: string;
  error?: string;
  /** external content, always labelled as data with no authority. */
  result?: UntrustedResult;
}

export async function invokeIntegration(input: {
  integrationId: string;
  artifactId: string;
  operationId: string;
  toolName?: string | null;
  payload?: Record<string, unknown>;
  confirmed?: boolean;
}): Promise<GatewayInvocation> {
  const { data, error } = await supabase.functions.invoke("software-integration-gateway", {
    body: {
      op: "invoke",
      integrationId: input.integrationId,
      artifactId: input.artifactId,
      operationId: input.operationId,
      toolName: input.toolName ?? null,
      input: input.payload ?? {},
      confirmed: input.confirmed === true,
    },
  });
  if (error) return { ok: false, state: "failed", error: "the call could not be made" };
  const res = data as { ok?: boolean; state?: string; error?: string; body?: string };
  if (!res?.ok) return { ok: false, state: res?.state ?? "failed", error: res?.error ?? "the call failed" };
  return { ok: true, result: wrapUntrusted(input.integrationId, input.operationId, res.body ?? "") };
}

/** asks an mcp server to report its own tools. the answer is data, not trust. */
export async function discoverMcpCapabilities(integrationId: string): Promise<{ ok: boolean; tools: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("software-integration-gateway", {
    body: { op: "discover", integrationId },
  });
  if (error) return { ok: false, tools: 0, error: "the server could not be reached" };
  const res = data as { ok?: boolean; tools?: number; error?: string };
  return { ok: !!res?.ok, tools: res?.tools ?? 0, error: res?.error };
}
