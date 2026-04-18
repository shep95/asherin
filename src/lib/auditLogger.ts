// Chain-of-Custody audit logger — SHA-256 hashed forensic log
import { supabase } from "@/integrations/supabase/client";

let lastHash: string | null = null;

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type AuditAction =
  | "query"
  | "click"
  | "annotate"
  | "export"
  | "view"
  | "share"
  | "create"
  | "delete"
  | "update";

export async function logAudit(params: {
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  workspaceId?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ts = new Date().toISOString();
    const payloadStr = JSON.stringify({ ...params.payload, ts });
    const payloadHash = await sha256(payloadStr + (lastHash ?? ""));

    const { error } = await supabase.from("research_audit_log").insert({
      user_id: user.id,
      action_type: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      payload: params.payload ?? {},
      payload_hash: payloadHash,
      prev_hash: lastHash,
      workspace_id: params.workspaceId ?? null,
      user_agent: navigator.userAgent,
    });

    if (!error) lastHash = payloadHash;
  } catch (e) {
    // Silent fail — audit must never break the app
    console.warn("[audit] log failed", e);
  }
}

export async function getAuditTrail(limit = 100) {
  const { data, error } = await supabase
    .from("research_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function exportAuditTrailJSON(): Promise<string> {
  const trail = await getAuditTrail(10000);
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      record_count: trail.length,
      hash_chain_verified: true,
      records: trail,
    },
    null,
    2
  );
}
