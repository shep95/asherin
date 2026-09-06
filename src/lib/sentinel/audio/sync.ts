// asherin.sentinel — layer 4b, the sync client.
//
// One narrow surface to the account's own backend. Every call is authenticated
// with the caller's session (the edge function derives the user id from the
// verified token, never from the body), every call is time-boxed, and a failure
// is returned rather than swallowed — a silent catch here would look like "no
// events today" when the truth is "the network is down".

import { supabase } from "@/integrations/supabase/client";

export interface AmbientDevice {
  id: string;
  device_key: string;
  label: string;
  platform: string;
  status: string;
  last_seen_at: string;
  push_prefs: Record<string, unknown>;
}

export interface AmbientSpeaker {
  id: string;
  label: string;
  name: string | null;
  name_source: string | null;
  sample_count: number;
  confidence: number;
  first_heard_at: string;
  last_heard_at: string;
}

export interface AmbientEvent {
  id: string;
  device_id: string | null;
  speaker_id: string | null;
  kind: "speech" | "sound";
  transcript: string | null;
  tag: string | null;
  confidence: number | null;
  started_at: string;
  duration_ms: number | null;
  meta: Record<string, unknown>;
}

export interface AmbientAlert {
  id: string;
  kind: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  event_id: string | null;
}

export interface IngestResult {
  events: AmbientEvent[];
  speakers: AmbientSpeaker[];
  alerts: AmbientAlert[];
  notes: string[];
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("asherin-sentinel", { body: { action, ...body } });
  if (error) {
    // supabase-js hides the response body on non-2xx; surface what it gives.
    throw new Error(error.message || `sentinel ${action} failed`);
  }
  const payload = data as { error?: string; message?: string } & T;
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new Error(payload.message || String(payload.error));
  }
  return payload as T;
}

export const registerDevice = (deviceKey: string, label: string, platform: string) =>
  call<{ device: AmbientDevice }>("register", { deviceKey, label, platform });

export const heartbeat = (deviceKey: string, status: string) => call<{ ok: true }>("heartbeat", { deviceKey, status });

export const ingest = (deviceKey: string, segments: unknown[]) =>
  call<IngestResult>("ingest", { deviceKey, segments });

export const fetchTimeline = (filters: {
  sinceIso?: string;
  untilIso?: string;
  speakerId?: string;
  deviceId?: string;
  tag?: string;
  query?: string;
  limit?: number;
}) => call<{ events: AmbientEvent[]; speakers: AmbientSpeaker[]; devices: AmbientDevice[] }>("timeline", filters);

export const fetchSpeakers = () => call<{ speakers: AmbientSpeaker[] }>("speakers");
export const renameSpeaker = (speakerId: string, name: string) =>
  call<{ speaker: AmbientSpeaker }>("rename-speaker", { speakerId, name });
export const fetchAlerts = () => call<{ alerts: AmbientAlert[] }>("alerts");
export const ackAlert = (alertId: string) => call<{ ok: true }>("ack-alert", { alertId });
export const fetchDevices = () => call<{ devices: AmbientDevice[] }>("devices");
export const saveSettings = (prefs: Record<string, unknown>, retentionHours: number) =>
  call<{ ok: true }>("settings", { prefs, retentionHours });
export const fetchSettings = () =>
  call<{ prefs: Record<string, unknown>; retentionHours: number }>("get-settings");
export const purgeRemote = (beforeIso: string) => call<{ deleted: number }>("purge", { beforeIso });

// ── desktop companion pairing ────────────────────────────────────────────────
export interface CompanionRow {
  id: string;
  device_key: string;
  label: string;
  platform: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export const createPairingCode = () => call<{ code: string; expiresAt: string }>("pair-code");
export const fetchCompanions = () => call<{ companions: CompanionRow[] }>("companion-devices");
export const revokeCompanion = (companionId: string) =>
  call<{ ok: true; revoked: boolean }>("revoke-companion", { companionId });
