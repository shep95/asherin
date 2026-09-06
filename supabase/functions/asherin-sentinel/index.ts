// asherin.sentinel — the account side of the ambient watch.
//
// Everything here is scoped to the verified caller. The user id is derived from
// the bearer token by the auth server, never read out of the request body: a
// body-supplied id is exactly how one tenant reads another tenant's timeline.
// Access is the $18 Asherin subscription and above, checked server-side, so a
// patched client cannot open the room.
//
// The transcription leg calls the platform speech endpoint with a complete wav
// the client assembled. Failures are returned as notes on the event rather than
// swallowed: an untranscribed segment is stored with its audio evidence and a
// stated reason, because a silent empty transcript would read as "nobody spoke".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireTier } from "../_shared/tierGate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const STT_MODEL = "openai/gpt-4o-mini-transcribe";
const MAX_SEGMENTS = 6;
const MAX_AUDIO_B64 = 4_000_000; // ~3mb wav — about 90s at 16khz mono
const MAX_TIMELINE = 300;
const MATCH_THRESHOLD = 0.955;
const MATCH_MARGIN = 0.012;
const PRINT_DIMS = 14;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

function mergeCentroid(stored: number[], fresh: number[], sampleCount: number): number[] {
  if (!stored.length) return fresh.slice();
  const w = 1 / Math.min(20, Math.max(2, sampleCount + 1));
  const merged = stored.map((x, i) => x * (1 - w) + (fresh[i] ?? 0) * w);
  const n = Math.sqrt(merged.reduce((s, x) => s + x * x, 0));
  return n > 0 ? merged.map((x) => x / n) : merged;
}

/** Mirrors the client rule: a self-claim names the speaker, a vocative does not. */
const SELF_RE = [
  /\bmy name(?:'s| is)\s+([A-Za-z'-]{2,20})/i,
  /\bthey call me\s+([A-Za-z'-]{2,20})/i,
  /\byou can call me\s+([A-Za-z'-]{2,20})/i,
  /\bi go by\s+([A-Za-z'-]{2,20})/i,
  /\bi(?:'m| am)\s+([A-Z][a-z'-]{1,19})\b/,
];
const NAME_STOP = new Set(["sorry","here","just","not","going","gonna","fine","good","done","late","ready","sure","okay","back","out","in","on","the","a"]);
function selfName(text: string): { name: string; quote: string } | null {
  for (const re of SELF_RE) {
    const m = re.exec(text);
    if (!m) continue;
    const raw = m[1].replace(/[^A-Za-z'-]/g, "");
    if (raw.length < 2 || raw.length > 20 || NAME_STOP.has(raw.toLowerCase())) continue;
    return { name: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(), quote: m[0].trim() };
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function transcribe(wav: Uint8Array): Promise<{ text: string | null; note: string | null }> {
  if (!LOVABLE_API_KEY) return { text: null, note: "transcription is not configured on this deployment." };
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([wav], { type: "audio/wav" }), "segment.wav");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
      signal: ctl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) return { text: null, note: "transcription is rate limited right now; the segment is stored untranscribed." };
      if (res.status === 402) return { text: null, note: "transcription credits are exhausted on this workspace." };
      return { text: null, note: `transcription refused the segment (${res.status}). ${detail.slice(0, 160)}` };
    }
    const body = await res.json().catch(() => null) as { text?: string } | null;
    const text = (body?.text ?? "").trim();
    return { text: text || null, note: text ? null : "the segment carried no recognisable speech." };
  } catch (e) {
    return { text: null, note: e instanceof Error && e.name === "AbortError" ? "transcription timed out." : "transcription could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}

interface SpeakerRow {
  id: string; label: string; name: string | null; name_source: string | null;
  embedding: number[]; sample_count: number; confidence: number;
  first_heard_at: string; last_heard_at: string;
}

// ── desktop companion pairing ────────────────────────────────────────────────
// A companion process has no browser session, so it cannot carry a supabase
// JWT. It carries a device token instead: minted once, in exchange for a short
// lived code the signed-in operator generated inside the room, hashed at rest,
// revocable from the room, and scoped to a fixed set of write actions. The user
// id is resolved from the stored hash — never from anything the companion says.
const DEVICE_HEADER = "x-asherin-device";
const PAIR_TTL_MS = 10 * 60_000;
const DEVICE_ACTIONS = new Set(["register", "heartbeat", "ingest", "get-settings"]);
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0, I/1 — read aloud safely

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomFrom(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function newPairingCode(): string {
  return `${randomFrom(CODE_ALPHABET, 4)}-${randomFrom(CODE_ALPHABET, 4)}`;
}

function newDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "asd_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tier for a user id, for callers that arrive without an email-bearing JWT. */
async function tierAllowsAmbient(userId: string): Promise<boolean> {
  const { data } = await admin.from("user_subscriptions")
    .select("product_id,status").eq("user_id", userId).eq("status", "active").maybeSingle();
  const pid = String(data?.product_id ?? "").toLowerCase();
  if (!pid) return false;
  const allowedIds = new Set([
    "prod_utrnsrxiqgtbqr", "prod_u1rtj8hxsctvqo", "prod_u1puuztkmierre",
    "prod_ujaqpixvfi3qlr", "prod_ujaqfcakqntom1", "prod_v226j5fq5fsod9",
    "prod_v2267gysf3srrn", "prod_aureon_algorithm",
  ]);
  if (allowedIds.has(pid)) return true;
  return pid.includes("lifetime") || pid.includes("pro") || pid.includes("aureon");
}

async function deviceIdentity(req: Request): Promise<{ userId: string; deviceKey: string; rowId: string } | null> {
  const raw = req.headers.get(DEVICE_HEADER);
  if (!raw || raw.length < 16 || raw.length > 200) return null;
  const hash = await sha256Hex(raw.trim());
  const { data } = await admin.from("asherin_ambient_device_tokens")
    .select("id,user_id,device_key,revoked_at").eq("token_hash", hash).maybeSingle();
  if (!data || data.revoked_at) return null;
  return { userId: data.user_id, deviceKey: data.device_key, rowId: data.id };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, cors);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "BAD_REQUEST", message: "Body must be json." }, 400, cors);
  }
  const action = String(body.action ?? "");

  // The only unauthenticated action: exchanging a code the operator just made
  // for a device token. One shot — the row is marked claimed in the same write.
  if (action === "pair-claim") {
    const code = String(body.code ?? "").trim().toUpperCase().slice(0, 16);
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      return json({ error: "BAD_REQUEST", message: "That pairing code is not in the right shape." }, 400, cors);
    }
    const codeHash = await sha256Hex(code);
    const { data: pairing } = await admin.from("asherin_ambient_pairings")
      .select("id,user_id,expires_at,claimed_at").eq("code_hash", codeHash).maybeSingle();
    if (!pairing || pairing.claimed_at || new Date(pairing.expires_at).getTime() < Date.now()) {
      return json({ error: "PAIRING_INVALID", message: "That code is unknown, already used, or expired." }, 404, cors);
    }
    if (!(await tierAllowsAmbient(pairing.user_id))) {
      return json({ error: "TIER_REQUIRED", message: "That account no longer holds an Asherin subscription." }, 402, cors);
    }
    const label = String(body.label ?? "companion").slice(0, 80);
    const platform = String(body.platform ?? "desktop").slice(0, 24);
    const deviceKey = `companion-${randomFrom("abcdefghijklmnopqrstuvwxyz0123456789", 12)}`;
    const token = newDeviceToken();
    const { error: tokErr } = await admin.from("asherin_ambient_device_tokens").insert({
      user_id: pairing.user_id, device_key: deviceKey, token_hash: await sha256Hex(token),
      label, platform,
    });
    if (tokErr) {
      console.error("[asherin-sentinel] pair-claim", tokErr.message);
      return json({ error: "SERVER_ERROR", message: "The pairing could not be completed." }, 500, cors);
    }
    await admin.from("asherin_ambient_pairings")
      .update({ claimed_at: new Date().toISOString(), device_key: deviceKey }).eq("id", pairing.id);
    await admin.from("asherin_ambient_devices").upsert({
      user_id: pairing.user_id, device_key: deviceKey, label, platform,
      status: "active", last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,device_key" });
    return json({ token, deviceKey, label }, 200, cors);
  }

  const device = await deviceIdentity(req);
  let userId: string | null = null;
  if (device) {
    if (!DEVICE_ACTIONS.has(action)) {
      return json({ error: "FORBIDDEN", message: "A paired device may only record, not read or change the account." }, 403, cors);
    }
    if (!(await tierAllowsAmbient(device.userId))) {
      return json({ error: "TIER_REQUIRED", message: "This account no longer holds an Asherin subscription." }, 402, cors);
    }
    userId = device.userId;
    body.deviceKey = device.deviceKey; // the token decides the device, not the payload
    await admin.from("asherin_ambient_device_tokens")
      .update({ last_used_at: new Date().toISOString() }).eq("id", device.rowId);
  } else {
    const gate = await requireTier(req, ["aureon", "pro", "lifetime"], cors);
    if (!gate.ok) return gate.response!;
    userId = await callerId(req);
    if (!userId) return json({ error: "UNAUTHENTICATED", message: "Sign in required." }, 401, cors);
  }

  try {

    switch (action) {
      case "register": {
        const deviceKey = String(body.deviceKey ?? "").slice(0, 80);
        if (deviceKey.length < 8) return json({ error: "BAD_REQUEST", message: "A device key is required." }, 400, cors);
        const { data, error } = await admin
          .from("asherin_ambient_devices")
          .upsert({
            user_id: userId,
            device_key: deviceKey,
            label: String(body.label ?? "device").slice(0, 80),
            platform: String(body.platform ?? "web").slice(0, 24),
            status: "active",
            last_seen_at: new Date().toISOString(),
          }, { onConflict: "user_id,device_key" })
          .select()
          .single();
        if (error) throw error;
        return json({ device: data }, 200, cors);
      }

      case "heartbeat": {
        const deviceKey = String(body.deviceKey ?? "").slice(0, 80);
        const status = ["active", "sleeping", "offline"].includes(String(body.status)) ? String(body.status) : "active";
        await admin.from("asherin_ambient_devices")
          .update({ status, last_seen_at: new Date().toISOString() })
          .eq("user_id", userId).eq("device_key", deviceKey);
        return json({ ok: true }, 200, cors);
      }

      case "ingest": {
        const deviceKey = String(body.deviceKey ?? "").slice(0, 80);
        const segments = Array.isArray(body.segments) ? body.segments.slice(0, MAX_SEGMENTS) : [];
        if (!segments.length) return json({ error: "BAD_REQUEST", message: "No segments supplied." }, 400, cors);

        const { data: device } = await admin.from("asherin_ambient_devices")
          .select("id,label,push_prefs").eq("user_id", userId).eq("device_key", deviceKey).maybeSingle();
        if (!device) return json({ error: "UNKNOWN_DEVICE", message: "Register this device first." }, 409, cors);
        await admin.from("asherin_ambient_devices")
          .update({ status: "active", last_seen_at: new Date().toISOString() }).eq("id", device.id);

        const { data: settingsRow } = await admin.from("asherin_ambient_settings")
          .select("prefs").eq("user_id", userId).maybeSingle();
        const prefs = (settingsRow?.prefs ?? {}) as Record<string, unknown>;
        const pushTags = Array.isArray(prefs.pushTags) ? prefs.pushTags as string[] : ["impact — glass", "elevated vocal stress", "unclassified impact"];
        const pushNewSpeaker = prefs.pushNewSpeaker !== false;
        const transcribeEnabled = prefs.transcribe !== false;

        const { data: speakerRows } = await admin.from("asherin_ambient_speakers")
          .select("*").eq("user_id", userId).order("first_heard_at", { ascending: true });
        const speakers: SpeakerRow[] = (speakerRows ?? []) as SpeakerRow[];

        const events: unknown[] = [];
        const alerts: unknown[] = [];
        const notes: string[] = [];
        const touched = new Map<string, SpeakerRow>();

        for (const raw of segments) {
          const seg = raw as Record<string, unknown>;
          const kind = seg.kind === "sound" ? "sound" : "speech";
          const startedAt = typeof seg.startedAt === "string" ? seg.startedAt : new Date().toISOString();
          const durationMs = Math.min(600_000, Math.max(0, Number(seg.durationMs) || 0));

          if (kind === "sound") {
            const tag = String(seg.tag ?? "unclassified impact").slice(0, 60);
            const confidence = Math.min(1, Math.max(0, Number(seg.confidence) || 0.4));
            const { data: ev, error } = await admin.from("asherin_ambient_events").insert({
              user_id: userId, device_id: device.id, kind: "sound", tag, confidence,
              started_at: startedAt, duration_ms: durationMs,
              meta: { evidence: seg.evidence ?? {}, method: "on-device acoustic shape, not a trained sound-event network" },
            }).select().single();
            if (error) throw error;
            events.push(ev);
            if (pushTags.includes(tag)) {
              const { data: al } = await admin.from("asherin_ambient_alerts").insert({
                user_id: userId, device_id: device.id, event_id: (ev as { id: string }).id,
                kind: tag, message: `${tag} on ${device.label}`,
              }).select().single();
              if (al) alerts.push(al);
            }
            continue;
          }

          // ── speech ────────────────────────────────────────────────────────
          const audioB64 = typeof seg.audio === "string" ? seg.audio : "";
          if (audioB64.length > MAX_AUDIO_B64) {
            notes.push("a segment was longer than the per-segment cap and was skipped whole rather than truncated.");
            continue;
          }
          const embedding = Array.isArray(seg.embedding)
            ? (seg.embedding as unknown[]).slice(0, PRINT_DIMS).map((x) => Number(x) || 0)
            : null;

          let speaker: SpeakerRow | null = null;
          let similarity = 0;
          let ambiguous = false;
          if (embedding && embedding.length === PRINT_DIMS) {
            const scored = speakers
              .filter((s) => Array.isArray(s.embedding) && s.embedding.length === PRINT_DIMS)
              .map((s) => ({ s, v: cosine(embedding, s.embedding) }))
              .sort((a, b) => b.v - a.v);
            const top = scored[0];
            const runner = scored[1]?.v ?? 0;
            if (top && top.v >= MATCH_THRESHOLD && (scored.length < 2 || top.v - runner >= MATCH_MARGIN)) {
              speaker = top.s;
              similarity = top.v;
            } else if (top && top.v >= MATCH_THRESHOLD) {
              ambiguous = true;
              similarity = top.v;
            }
            if (!speaker && !ambiguous) {
              const label = `speaker ${speakers.length + 1}`;
              const { data: fresh, error } = await admin.from("asherin_ambient_speakers").insert({
                user_id: userId, label, embedding, sample_count: 1, confidence: 0.3,
                first_heard_at: startedAt, last_heard_at: startedAt,
              }).select().single();
              if (error) throw error;
              speaker = fresh as SpeakerRow;
              speakers.push(speaker);
              if (pushNewSpeaker) {
                const { data: al } = await admin.from("asherin_ambient_alerts").insert({
                  user_id: userId, device_id: device.id, kind: "new speaker",
                  message: `new voice on ${device.label} — labelled ${label}`,
                }).select().single();
                if (al) alerts.push(al);
              }
            }
          }

          let transcript: string | null = null;
          if (transcribeEnabled && audioB64) {
            const { text, note } = await transcribe(base64ToBytes(audioB64));
            transcript = text;
            if (note) notes.push(note);
          } else if (!transcribeEnabled) {
            notes.push("transcription is switched off in settings; segments are logged with voice identity only.");
          }

          // Passive self-identification, only from the speaker's own words.
          let nameBound: { name: string; quote: string } | null = null;
          if (transcript && speaker && !speaker.name) {
            nameBound = selfName(transcript);
            if (nameBound) {
              const { data: named } = await admin.from("asherin_ambient_speakers")
                .update({ name: nameBound.name, name_source: `self-claim: "${nameBound.quote}"` })
                .eq("id", speaker.id).eq("user_id", userId).select().single();
              if (named) speaker = named as SpeakerRow;
            }
          }

          if (speaker && embedding) {
            const count = speaker.sample_count + 1;
            const confidence = Math.min(0.95, 0.25 + Math.min(1, count / 12) * 0.45 + Math.max(0, similarity - MATCH_THRESHOLD) * 6);
            const { data: updated } = await admin.from("asherin_ambient_speakers").update({
              embedding: mergeCentroid(speaker.embedding ?? [], embedding, speaker.sample_count),
              sample_count: count,
              confidence: Number(confidence.toFixed(2)),
              last_heard_at: startedAt,
            }).eq("id", speaker.id).eq("user_id", userId).select().single();
            if (updated) {
              speaker = updated as SpeakerRow;
              const idx = speakers.findIndex((s) => s.id === speaker!.id);
              if (idx >= 0) speakers[idx] = speaker;
            }
          }
          if (speaker) touched.set(speaker.id, speaker);

          const { data: ev, error } = await admin.from("asherin_ambient_events").insert({
            user_id: userId, device_id: device.id, speaker_id: speaker?.id ?? null,
            kind: "speech", transcript, tag: null,
            confidence: speaker ? Number(similarity.toFixed(3)) || speaker.confidence : null,
            started_at: startedAt, duration_ms: durationMs,
            meta: {
              ambiguousVoice: ambiguous,
              peakRms: seg.peakRms ?? null,
              nameBoundFrom: nameBound?.quote ?? null,
              identityMethod: "acoustic similarity on this account's own samples — not forensic speaker verification",
              transcriptionModel: transcript ? STT_MODEL : null,
            },
          }).select().single();
          if (error) throw error;
          events.push(ev);
          if (ambiguous) notes.push("two stored voices matched this turn too closely to separate; it is logged without a name.");
        }

        return json({ events, speakers: [...touched.values()], alerts, notes: [...new Set(notes)] }, 200, cors);
      }

      case "timeline": {
        const limit = Math.min(MAX_TIMELINE, Math.max(1, Number(body.limit) || 200));
        let q = admin.from("asherin_ambient_events").select("*").eq("user_id", userId)
          .order("started_at", { ascending: false }).limit(limit);
        if (typeof body.sinceIso === "string") q = q.gte("started_at", body.sinceIso);
        if (typeof body.untilIso === "string") q = q.lte("started_at", body.untilIso);
        if (typeof body.speakerId === "string" && body.speakerId) q = q.eq("speaker_id", body.speakerId);
        if (typeof body.deviceId === "string" && body.deviceId) q = q.eq("device_id", body.deviceId);
        if (typeof body.tag === "string" && body.tag) q = q.eq("tag", body.tag);
        if (typeof body.query === "string" && body.query.trim()) {
          // Escaped to a literal: a raw % or , in a filter string is an injection
          // into PostgREST's filter grammar, not just a bad search.
          const needle = body.query.trim().slice(0, 120).replace(/[%,()*]/g, " ");
          q = q.ilike("transcript", `%${needle}%`);
        }
        const [{ data: events, error }, { data: speakers }, { data: devices }] = await Promise.all([
          q,
          admin.from("asherin_ambient_speakers").select("id,label,name,name_source,sample_count,confidence,first_heard_at,last_heard_at").eq("user_id", userId),
          admin.from("asherin_ambient_devices").select("*").eq("user_id", userId),
        ]);
        if (error) throw error;
        return json({ events: events ?? [], speakers: speakers ?? [], devices: devices ?? [] }, 200, cors);
      }

      case "speakers": {
        const { data, error } = await admin.from("asherin_ambient_speakers")
          .select("id,label,name,name_source,sample_count,confidence,first_heard_at,last_heard_at")
          .eq("user_id", userId).order("first_heard_at", { ascending: true });
        if (error) throw error;
        return json({ speakers: data ?? [] }, 200, cors);
      }

      case "rename-speaker": {
        const speakerId = String(body.speakerId ?? "");
        const name = String(body.name ?? "").trim().slice(0, 60);
        if (!speakerId || !name) return json({ error: "BAD_REQUEST", message: "A speaker and a name are required." }, 400, cors);
        const { data, error } = await admin.from("asherin_ambient_speakers")
          .update({ name, name_source: "renamed by the operator" })
          .eq("id", speakerId).eq("user_id", userId)
          .select("id,label,name,name_source,sample_count,confidence,first_heard_at,last_heard_at").single();
        if (error) throw error;
        return json({ speaker: data }, 200, cors);
      }

      case "alerts": {
        const { data, error } = await admin.from("asherin_ambient_alerts").select("*")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        return json({ alerts: data ?? [] }, 200, cors);
      }

      case "ack-alert": {
        const alertId = String(body.alertId ?? "");
        if (!alertId) return json({ error: "BAD_REQUEST", message: "An alert is required." }, 400, cors);
        await admin.from("asherin_ambient_alerts")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("id", alertId).eq("user_id", userId);
        return json({ ok: true }, 200, cors);
      }

      case "devices": {
        const { data, error } = await admin.from("asherin_ambient_devices").select("*")
          .eq("user_id", userId).order("last_seen_at", { ascending: false });
        if (error) throw error;
        return json({ devices: data ?? [] }, 200, cors);
      }

      case "get-settings": {
        const { data } = await admin.from("asherin_ambient_settings").select("prefs,retention_hours").eq("user_id", userId).maybeSingle();
        return json({ prefs: data?.prefs ?? {}, retentionHours: data?.retention_hours ?? 72 }, 200, cors);
      }

      case "settings": {
        const prefs = (body.prefs && typeof body.prefs === "object") ? body.prefs as Record<string, unknown> : {};
        const retentionHours = Math.min(720, Math.max(1, Number(body.retentionHours) || 72));
        const { error } = await admin.from("asherin_ambient_settings")
          .upsert({ user_id: userId, prefs, retention_hours: retentionHours, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (error) throw error;
        return json({ ok: true }, 200, cors);
      }

      case "purge": {
        const beforeIso = typeof body.beforeIso === "string" ? body.beforeIso : new Date().toISOString();
        const { data, error } = await admin.from("asherin_ambient_events")
          .delete().eq("user_id", userId).lt("started_at", beforeIso).select("id");
        if (error) throw error;
        return json({ deleted: (data ?? []).length }, 200, cors);
      }

      // ── companion pairing, operator side ────────────────────────────────
      case "pair-code": {
        // Expire anything stale for this account first, so the room never shows
        // a code that would be refused on use.
        await admin.from("asherin_ambient_pairings")
          .delete().eq("user_id", userId).is("claimed_at", null).lt("expires_at", new Date().toISOString());
        const code = newPairingCode();
        const expiresAt = new Date(Date.now() + PAIR_TTL_MS).toISOString();
        const { error } = await admin.from("asherin_ambient_pairings")
          .insert({ user_id: userId, code_hash: await sha256Hex(code), expires_at: expiresAt });
        if (error) throw error;
        return json({ code, expiresAt }, 200, cors);
      }

      case "companion-devices": {
        const { data, error } = await admin.from("asherin_ambient_device_tokens")
          .select("id,device_key,label,platform,last_used_at,revoked_at,created_at")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        return json({ companions: data ?? [] }, 200, cors);
      }

      case "revoke-companion": {
        const id = String(body.companionId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "BAD_REQUEST", message: "A companion id is required." }, 400, cors);
        const { data, error } = await admin.from("asherin_ambient_device_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", id).eq("user_id", userId).is("revoked_at", null).select("device_key").maybeSingle();
        if (error) throw error;
        if (data?.device_key) {
          await admin.from("asherin_ambient_devices")
            .update({ status: "offline" }).eq("user_id", userId).eq("device_key", data.device_key);
        }
        return json({ ok: true, revoked: Boolean(data) }, 200, cors);
      }


      default:
        return json({ error: "UNKNOWN_ACTION", message: `No such action: ${action}` }, 400, cors);
    }
  } catch (e) {
    console.error("[asherin-sentinel]", action, e instanceof Error ? e.message : e);
    return json({ error: "SERVER_ERROR", message: e instanceof Error ? e.message : "The watch could not complete that." }, 500, cors);
  }
});
