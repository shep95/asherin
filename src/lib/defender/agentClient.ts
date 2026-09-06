// asherin.defender — the client side of device pairing.
//
// The pairing token is generated here, in the operator's browser, shown once,
// and never sent to asherin in plain form: only its sha-256 digest is stored,
// against the operator's own row. That means a leaked database still cannot
// impersonate anybody's agent, and asherin cannot replay the operator's token.

import { supabase } from "@/integrations/supabase/client";
import type { Finding } from "./posture";
import { PROTECTION_BY_ID } from "./protections";

export interface DefenderDevice {
  id: string;
  name: string;
  platform: string | null;
  agent_version: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked: boolean;
}

export interface DefenderReport {
  id: string;
  device_id: string;
  created_at: string;
  agent_version: string | null;
  meta: Record<string, unknown>;
  findings: Array<{ id: string; state: string; observed: string; action: string | null }>;
}

export function makePairingToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function enrollDevice(name: string): Promise<{ device: DefenderDevice; token: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("sign in before pairing a device");
  const token = makePairingToken();
  const token_sha256 = await sha256Hex(token);
  const { data, error } = await supabase
    .from("defender_devices")
    .insert({ user_id: auth.user.id, name: name.slice(0, 80) || "my device", token_sha256 })
    .select("id, name, platform, agent_version, created_at, last_seen_at, revoked")
    .single();
  if (error) throw new Error(error.message);
  return { device: data as DefenderDevice, token };
}

export async function listDevices(): Promise<DefenderDevice[]> {
  const { data, error } = await supabase
    .from("defender_devices")
    .select("id, name, platform, agent_version, created_at, last_seen_at, revoked")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  return (data ?? []) as DefenderDevice[];
}

export async function revokeDevice(id: string): Promise<void> {
  const { error } = await supabase.from("defender_devices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function latestReport(deviceId?: string): Promise<DefenderReport | null> {
  let q = supabase
    .from("defender_reports")
    .select("id, device_id, created_at, agent_version, meta, findings")
    .order("created_at", { ascending: false })
    .limit(1);
  if (deviceId) q = q.eq("device_id", deviceId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data?.[0] as DefenderReport | undefined) ?? null;
}

/** report rows become findings only when their id exists in the register. */
export function reportToFindings(report: DefenderReport | null): Finding[] {
  if (!report) return [];
  const at = new Date(report.created_at).getTime();
  return report.findings
    .filter((f) => PROTECTION_BY_ID[f.id])
    .map((f) => ({
      id: f.id,
      state: (["pass", "warn", "fail", "unmeasured"].includes(f.state) ? f.state : "unmeasured") as Finding["state"],
      observed: f.observed,
      action: f.action ?? undefined,
      source: "agent" as const,
      at,
    }));
}

export const AGENT_COMMAND = (token: string) =>
  `python3 asherin-defender-agent.py --token ${token}`;
