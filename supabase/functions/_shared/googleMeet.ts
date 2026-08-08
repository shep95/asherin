// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE MEET VAULT — meeting + recording retrieval over the connected mesh
// ---------------------------------------------------------------------------
// Three independent collectors, fused into one ledger:
//
//   1. CALENDAR   — every event that carried a Meet link. This is the only
//                   source that reliably knows the human title, the invitees
//                   and the scheduled window.
//   2. MEET API   — conferenceRecords/recordings/transcripts. Authoritative
//                   for "was this actually recorded", and it hands back the
//                   Drive file id of the artifact.
//   3. DRIVE      — the "Meet Recordings" folder. The fallback that still
//                   works when the Meet API is unavailable to the account
//                   (personal Gmail accounts often have no conferenceRecords
//                   surface at all) and the only source for recordings made
//                   before the account joined the mesh.
//
// Every collector is allowed to fail on its own without taking the sweep
// down: a partial vault with an honest note beats an empty page with an error.
// Nothing here streams bytes — playback is a separate, token-gated proxy so a
// Google access token never reaches the browser.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasScope, type MeshAccount } from "./googleMesh.ts";

type Acct = MeshAccount & { token: string };

export interface MeetSessionRow {
  user_id: string;
  account_id: string;
  dedupe_key: string;
  conference_code: string | null;
  space_name: string | null;
  title: string | null;
  meet_link: string | null;
  organizer_email: string | null;
  participants: string[];
  started_at: string | null;
  ended_at: string | null;
  source: string;
}

export interface MeetArtifactRow {
  user_id: string;
  account_id: string;
  kind: "recording" | "transcript" | "chat";
  drive_file_id: string;
  name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  thumbnail_link: string | null;
  web_view_link: string | null;
  file_created_at: string | null;
  /** Resolved to a session row at persist time, never stored raw. */
  _code: string | null;
  _startMs: number | null;
}

export interface SweepReport {
  account: string;
  sessions: number;
  recordings: number;
  transcripts: number;
  notes: string[];
}

const MEET_LINK = /https?:\/\/meet\.google\.com\/([a-z0-9-]{8,})/i;

/** `abc-defg-hij` — the only cross-source join key Meet actually exposes. */
export function conferenceCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = MEET_LINK.exec(text);
  if (m) return m[1].toLowerCase().replace(/\?.*$/, "");
  const bare = /\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i.exec(text);
  return bare ? bare[1].toLowerCase() : null;
}

/**
 * Drive names recordings `"<title> (2026-01-02 09:30 GMT-08:00)"`. Pulling the
 * timestamp out of the name is what lets a Drive-only recording bind to the
 * calendar event it belongs to when no conference code survived.
 */
export function parseRecordingName(name: string): { title: string; startMs: number | null } {
  const m = /^(.*?)\s*\((\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?\s*(GMT[+-]\d{2}:?\d{2})?\)/i.exec(name);
  if (!m) return { title: name.replace(/\s*[-–]\s*(Recording|Transcript|Chat)$/i, "").trim(), startMs: null };
  const tz = (m[4] ?? "GMT+00:00").replace("GMT", "").replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
  const iso = `${m[2]}T${m[3]}:00${tz || "+00:00"}`;
  const ms = Date.parse(iso);
  return { title: m[1].trim(), startMs: Number.isFinite(ms) ? ms : null };
}

/** Bounded JSON GET. Returns null on any failure so one dead surface never aborts a sweep. */
async function jget(url: string, token: string, ms = 15_000): Promise<any | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── 1. CALENDAR ────────────────────────────────────────────────────────────

async function collectCalendar(
  userId: string,
  a: Acct,
  sinceMs: number,
  cap: number,
): Promise<{ rows: MeetSessionRow[]; scanned: number; failed: boolean }> {
  const out: MeetSessionRow[] = [];
  let scanned = 0;
  let failed = false;
  let pageToken = "";
  for (let page = 0; page < 6 && out.length < cap; page++) {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", new Date(sinceMs).toISOString());
    url.searchParams.set("timeMax", new Date(Date.now() + 86_400_000).toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await jget(url.toString(), a.token, 20_000);
    if (!data) { failed = page === 0; break; }
    scanned += (data.items ?? []).length;

    for (const ev of data.items ?? []) {
      const link: string | null =
        ev.hangoutLink ??
        (ev.conferenceData?.entryPoints ?? []).find((p: any) => p.entryPointType === "video")?.uri ??
        null;
      const code = conferenceCode(link) ?? conferenceCode(ev.conferenceData?.conferenceId);
      if (!link && !code) continue;

      const startedAt = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
      out.push({
        user_id: userId,
        account_id: a.id,
        dedupe_key: `cal:${a.id}:${ev.id}`,
        conference_code: code,
        space_name: null,
        title: ev.summary ?? "Untitled meeting",
        meet_link: link ?? (code ? `https://meet.google.com/${code}` : null),
        organizer_email: ev.organizer?.email ?? null,
        participants: (ev.attendees ?? [])
          .map((p: any) => String(p.email ?? "").toLowerCase())
          .filter(Boolean)
          .slice(0, 60),
        started_at: startedAt,
        ended_at: ev.end?.dateTime ?? null,
        source: "calendar",
      });
      if (out.length >= cap) break;
    }
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return { rows: out, scanned, failed };
}

// ── 2. MEET API v2 ─────────────────────────────────────────────────────────

async function collectMeetApi(
  userId: string,
  a: Acct,
  sinceMs: number,
): Promise<{ sessions: MeetSessionRow[]; artifacts: MeetArtifactRow[]; note: string | null }> {
  const sessions: MeetSessionRow[] = [];
  const artifacts: MeetArtifactRow[] = [];

  const filter = encodeURIComponent(`start_time>="${new Date(sinceMs).toISOString()}"`);
  const records = await jget(
    `https://meet.googleapis.com/v2/conferenceRecords?pageSize=50&filter=${filter}`,
    a.token,
    20_000,
  );
  if (!records) {
    return {
      sessions,
      artifacts,
      note: "Meet conference records were unavailable for this account — Drive and Calendar were used instead.",
    };
  }

  // Space lookups are cached: many conferences share one space and each lookup
  // is a round trip we do not need to repeat.
  const spaceCode = new Map<string, string | null>();

  for (const rec of (records.conferenceRecords ?? []).slice(0, 50)) {
    let code: string | null = null;
    if (rec.space) {
      if (!spaceCode.has(rec.space)) {
        const sp = await jget(`https://meet.googleapis.com/v2/${rec.space}`, a.token, 10_000);
        spaceCode.set(rec.space, sp?.meetingCode ?? null);
      }
      code = spaceCode.get(rec.space) ?? null;
    }

    sessions.push({
      user_id: userId,
      account_id: a.id,
      dedupe_key: `meet:${a.id}:${rec.name}`,
      conference_code: code,
      space_name: rec.space ?? null,
      title: null,
      meet_link: code ? `https://meet.google.com/${code}` : null,
      organizer_email: null,
      participants: [],
      started_at: rec.startTime ?? null,
      ended_at: rec.endTime ?? null,
      source: "meet_api",
    });

    const startMs = rec.startTime ? Date.parse(rec.startTime) : null;

    const [recs, trans] = await Promise.all([
      jget(`https://meet.googleapis.com/v2/${rec.name}/recordings`, a.token, 12_000),
      jget(`https://meet.googleapis.com/v2/${rec.name}/transcripts`, a.token, 12_000),
    ]);

    for (const r of recs?.recordings ?? []) {
      const fileId = r.driveDestination?.file;
      if (!fileId) continue;
      artifacts.push({
        user_id: userId, account_id: a.id, kind: "recording", drive_file_id: fileId,
        name: null, mime_type: "video/mp4", size_bytes: null,
        duration_ms: r.startTime && r.endTime
          ? Math.max(0, Date.parse(r.endTime) - Date.parse(r.startTime))
          : null,
        thumbnail_link: null,
        web_view_link: r.driveDestination?.exportUri ?? null,
        file_created_at: r.startTime ?? null,
        _code: code, _startMs: Number.isFinite(startMs) ? startMs : null,
      });
    }
    for (const t of trans?.transcripts ?? []) {
      const fileId = t.docsDestination?.document;
      if (!fileId) continue;
      artifacts.push({
        user_id: userId, account_id: a.id, kind: "transcript", drive_file_id: fileId,
        name: null, mime_type: "application/vnd.google-apps.document", size_bytes: null,
        duration_ms: null, thumbnail_link: null,
        web_view_link: t.docsDestination?.exportUri ?? null,
        file_created_at: t.startTime ?? null,
        _code: code, _startMs: Number.isFinite(startMs) ? startMs : null,
      });
    }
  }

  return { sessions, artifacts, note: null };
}

// ── 3. DRIVE ───────────────────────────────────────────────────────────────

const DRIVE_FIELDS =
  "nextPageToken,files(id,name,mimeType,size,createdTime,thumbnailLink,webViewLink,videoMediaMetadata/durationMillis)";

async function collectDrive(
  userId: string,
  a: Acct,
  sinceMs: number,
  cap: number,
): Promise<{ artifacts: MeetArtifactRow[]; note: string | null }> {
  const artifacts: MeetArtifactRow[] = [];

  // The recordings folder is localized ("Meet Recordings", "Meet-opnamen", …),
  // so the folder is found by name-contains rather than an exact match, and a
  // MIME sweep runs regardless in case the operator moved the files.
  const folders = await jget(
    "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.folder' and name contains 'Meet' and trashed=false",
      fields: "files(id,name)",
      pageSize: "20",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    }).toString(),
    a.token,
  );
  const folderIds: string[] = (folders?.files ?? []).map((f: any) => f.id);

  const clauses = [
    `(mimeType='video/mp4' and createdTime > '${new Date(sinceMs).toISOString()}')`,
    ...folderIds.map((id) => `('${id}' in parents and trashed=false)`),
  ];

  const seen = new Set<string>();
  for (const clause of clauses) {
    if (artifacts.length >= cap) break;
    const data = await jget(
      "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams({
        q: `${clause} and trashed=false`,
        fields: DRIVE_FIELDS,
        pageSize: "100",
        orderBy: "createdTime desc",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      }).toString(),
      a.token,
      20_000,
    );
    for (const f of data?.files ?? []) {
      if (seen.has(f.id) || artifacts.length >= cap) continue;
      const isVideo = String(f.mimeType ?? "").startsWith("video/");
      const isDoc = f.mimeType === "application/vnd.google-apps.document";
      if (!isVideo && !isDoc) continue;
      seen.add(f.id);

      const parsed = parseRecordingName(String(f.name ?? ""));
      artifacts.push({
        user_id: userId,
        account_id: a.id,
        kind: isVideo ? "recording" : "transcript",
        drive_file_id: f.id,
        name: f.name ?? null,
        mime_type: f.mimeType ?? null,
        size_bytes: f.size ? Number(f.size) : null,
        duration_ms: f.videoMediaMetadata?.durationMillis
          ? Number(f.videoMediaMetadata.durationMillis)
          : null,
        thumbnail_link: f.thumbnailLink ?? null,
        web_view_link: f.webViewLink ?? null,
        file_created_at: f.createdTime ?? null,
        _code: conferenceCode(f.name),
        _startMs: parsed.startMs,
      });
    }
  }

  return {
    artifacts,
    note: artifacts.length === 0 && folderIds.length === 0
      ? "No Meet Recordings folder was visible in this account's Drive."
      : null,
  };
}

// ── FUSION + PERSIST ───────────────────────────────────────────────────────

/** Two sessions are the same meeting when the code matches and they overlap in time. */
function fuseSessions(rows: MeetSessionRow[]): MeetSessionRow[] {
  const byCode = new Map<string, MeetSessionRow>();
  const loose: MeetSessionRow[] = [];

  for (const r of rows) {
    const startMs = r.started_at ? Date.parse(r.started_at) : NaN;
    if (!r.conference_code || !Number.isFinite(startMs)) { loose.push(r); continue; }
    // Bucket to the hour: the calendar start and the actual conference start
    // differ by minutes, never by hours.
    const key = `${r.conference_code}:${Math.round(startMs / 3_600_000)}`;
    const prior = byCode.get(key);
    if (!prior) { byCode.set(key, { ...r }); continue; }

    // Calendar wins on human fields; Meet API wins on real timings.
    byCode.set(key, {
      ...prior,
      title: prior.title ?? r.title,
      organizer_email: prior.organizer_email ?? r.organizer_email,
      participants: prior.participants.length ? prior.participants : r.participants,
      space_name: prior.space_name ?? r.space_name,
      meet_link: prior.meet_link ?? r.meet_link,
      ended_at: prior.ended_at ?? r.ended_at,
      source: prior.source === r.source ? prior.source : "fused",
      // Keep the calendar dedupe key so re-sweeps land on the same row.
      dedupe_key: prior.source === "calendar" ? prior.dedupe_key : r.dedupe_key,
    });
  }
  return [...byCode.values(), ...loose];
}

/** Bind an artifact to the session it belongs to: code first, then time proximity. */
function bindArtifact(
  art: MeetArtifactRow,
  sessions: Array<MeetSessionRow & { id: string }>,
): string | null {
  const artMs = art._startMs ?? (art.file_created_at ? Date.parse(art.file_created_at) : NaN);

  if (art._code) {
    const byCode = sessions.filter((s) => s.conference_code === art._code);
    if (byCode.length === 1) return byCode[0].id;
    if (byCode.length > 1 && Number.isFinite(artMs)) {
      return nearest(byCode, artMs, 12 * 3_600_000);
    }
    if (byCode.length > 1) return byCode[0].id;
  }
  if (!Number.isFinite(artMs)) return null;
  // A recording is written while the meeting runs, so a two-hour window is
  // generous but still tight enough to avoid stealing a neighbouring meeting.
  return nearest(sessions, artMs, 2 * 3_600_000);
}

function nearest(
  sessions: Array<MeetSessionRow & { id: string }>,
  atMs: number,
  toleranceMs: number,
): string | null {
  let best: string | null = null;
  let bestGap = Infinity;
  for (const s of sessions) {
    const t = s.started_at ? Date.parse(s.started_at) : NaN;
    if (!Number.isFinite(t)) continue;
    const gap = Math.abs(t - atMs);
    if (gap < bestGap && gap <= toleranceMs) { bestGap = gap; best = s.id; }
  }
  return best;
}

/**
 * Sweep every live account and persist the vault. Idempotent by construction:
 * sessions upsert on (user_id, dedupe_key), artifacts on (user_id, drive_file_id).
 */
export async function sweepMeetVault(
  sb: SupabaseClient,
  userId: string,
  accounts: Acct[],
  opts: { days?: number; cap?: number } = {},
): Promise<SweepReport[]> {
  const days = Math.min(1825, Math.max(1, opts.days ?? 365));
  const cap = Math.min(500, Math.max(20, opts.cap ?? 250));
  const sinceMs = Date.now() - days * 86_400_000;
  const reports: SweepReport[] = [];

  for (const a of accounts) {
    const notes: string[] = [];
    const sessions: MeetSessionRow[] = [];
    const artifacts: MeetArtifactRow[] = [];

    if (hasScope(a, "calendar.readonly")) {
      const cal = await collectCalendar(userId, a, sinceMs, cap);
      sessions.push(...cal.rows);
      if (cal.failed) {
        notes.push("Google refused the calendar read for this account — reconnect it to restore meeting history.");
      } else if (cal.scanned === 0) {
        notes.push(`No calendar events at all in the last ${days} days for this account.`);
      } else if (cal.rows.length === 0) {
        notes.push(`${cal.scanned} calendar events scanned, none of them carried a Meet link.`);
      }
    } else {
      notes.push("Calendar access was not granted, so meeting titles and invitees are missing.");
    }

    const meet = await collectMeetApi(userId, a, sinceMs);
    sessions.push(...meet.sessions);
    artifacts.push(...meet.artifacts);
    if (meet.note) notes.push(meet.note);

    if (hasScope(a, "drive.readonly")) {
      const drive = await collectDrive(userId, a, sinceMs, cap);
      artifacts.push(...drive.artifacts);
      if (drive.note) notes.push(drive.note);
    } else {
      notes.push(
        "Drive file access was not granted for this account — recordings can be listed but not played or downloaded here. Re-authorize to enable playback.",
      );
    }

    const fused = fuseSessions(sessions);
    let stored: Array<MeetSessionRow & { id: string }> = [];
    if (fused.length) {
      const { data, error } = await sb
        .from("google_meet_sessions")
        .upsert(fused, { onConflict: "user_id,dedupe_key" })
        .select("id, conference_code, started_at, dedupe_key");
      if (error) notes.push(`Meeting index write failed: ${error.message}`);
      stored = (data ?? []) as any;
    }

    // Re-read the full session set: an artifact from this sweep may belong to a
    // meeting indexed by an earlier sweep, and binding only against this run's
    // rows would orphan it.
    const { data: allSessions } = await sb
      .from("google_meet_sessions")
      .select("id, conference_code, started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(2000);
    const pool = [...(allSessions ?? []), ...stored] as Array<MeetSessionRow & { id: string }>;

    let recordings = 0;
    let transcripts = 0;
    if (artifacts.length) {
      const rows = artifacts.map(({ _code, _startMs, ...rest }) => ({
        ...rest,
        session_id: bindArtifact({ ...rest, _code, _startMs } as MeetArtifactRow, pool),
      }));
      const { error } = await sb
        .from("google_meet_artifacts")
        .upsert(rows, { onConflict: "user_id,drive_file_id" });
      if (error) notes.push(`Recording index write failed: ${error.message}`);
      else {
        recordings = rows.filter((r) => r.kind === "recording").length;
        transcripts = rows.filter((r) => r.kind === "transcript").length;
      }
    }

    reports.push({
      account: a.google_email,
      sessions: fused.length,
      recordings,
      transcripts,
      notes,
    });
  }

  return reports;
}

// ── PLAYBACK TOKENS ────────────────────────────────────────────────────────
// A <video> tag cannot send an Authorization header, so playback is authorised
// by a short-lived HMAC bound to (user, artifact, expiry). The Google access
// token never leaves the server, and a leaked URL dies in ten minutes.

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret) throw new Error("playback signing key unavailable");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function signPlaybackToken(
  userId: string,
  artifactId: string,
  ttlSeconds = 600,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${artifactId}.${exp}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${b64url(enc.encode(payload))}.${b64url(sig)}`;
}

export async function verifyPlaybackToken(
  token: string,
): Promise<{ userId: string; artifactId: string } | null> {
  const [payloadPart, sigPart] = String(token ?? "").split(".");
  if (!payloadPart || !sigPart) return null;
  let payload: string;
  try {
    const norm = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    payload = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4));
  } catch {
    return null;
  }
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  if (b64url(expected) !== sigPart) return null;

  const [userId, artifactId, expRaw] = payload.split(".");
  const exp = Number(expRaw);
  if (!userId || !artifactId || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  return { userId, artifactId };
}
