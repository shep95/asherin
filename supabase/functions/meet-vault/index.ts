// ═══════════════════════════════════════════════════════════════════════════
// meet-vault — Google Meet history, recordings and transcripts
// Actions (POST, JWT-scoped): sweep | list | grant | delete
// Streaming (GET, HMAC-token-scoped): ?t=<token>&mode=stream|download
//
// The GET path carries no Authorization header because a <video> element
// cannot set one. It is authorised instead by a ten-minute HMAC bound to
// (user, artifact, expiry) that the POST path issues only to the owner.
// A Google access token is never returned to the browser on any path.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { adminClient, liveAccounts, scopesForTier } from "../_shared/googleMesh.ts";
import { sweepMeetVault, signPlaybackToken, verifyPlaybackToken } from "../_shared/googleMeet.ts";

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Google Docs transcripts are exported as text; binary files stream as-is. */
function driveUrl(mime: string | null, fileId: string, download: boolean): string {
  if (mime === "application/vnd.google-apps.document") {
    return `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${
      download ? "application%2Fpdf" : "text%2Fplain"
    }`;
  }
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = adminClient();

    // ── STREAM / DOWNLOAD ────────────────────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const claim = await verifyPlaybackToken(url.searchParams.get("t") ?? "");
      if (!claim) return json({ error: "Link expired — reopen the recording." }, 403, cors);

      const { data: art } = await sb
        .from("google_meet_artifacts")
        .select("drive_file_id, mime_type, name, account_id, user_id")
        .eq("id", claim.artifactId)
        .eq("user_id", claim.userId)
        .maybeSingle();
      if (!art) return json({ error: "Recording not found" }, 404, cors);

      const accounts = await liveAccounts(sb, claim.userId, art.account_id);
      const token = accounts[0]?.token;
      if (!token) {
        return json({ error: "The Google account holding this file is disconnected." }, 409, cors);
      }

      const download = url.searchParams.get("mode") === "download";
      const range = req.headers.get("Range");
      const upstream = await fetch(driveUrl(art.mime_type, art.drive_file_id, download), {
        headers: range
          ? { Authorization: `Bearer ${token}`, Range: range }
          : { Authorization: `Bearer ${token}` },
      });

      if (!upstream.ok && upstream.status !== 206) {
        const detail = await upstream.text().catch(() => "");
        console.error(`meet-vault stream failed [${upstream.status}]: ${detail.slice(0, 400)}`);
        return json(
          { error: "Google refused the file", status: upstream.status, details: detail.slice(0, 400) },
          upstream.status,
          cors,
        );
      }

      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") ?? art.mime_type ?? "application/octet-stream");
      for (const h of ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"]) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "private, max-age=0, no-store");
      if (download) {
        const safe = (art.name ?? "asherin-recording").replace(/["\\\r\n]/g, "").slice(0, 120);
        headers.set("Content-Disposition", `attachment; filename="${safe}"`);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // ── AUTHENTICATED ACTIONS ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, cors);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
    if (uErr || !user) return json({ error: "Unauthorized" }, 401, cors);
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    // Which connected accounts still lack the scopes the vault needs. Surfaced
    // so the UI can ask for a re-authorization instead of showing an empty page.
    const accounts = await liveAccounts(sb, userId, body.account_id ?? null);
    const needsGrant = accounts
      .filter((a) => !(a.scopes ?? []).some((s: string) => s.endsWith("/drive.readonly")))
      .map((a) => a.google_email);

    if (action === "sweep") {
      if (!accounts.length) {
        return json({ error: "No connected Google account.", needsGrant: [] }, 409, cors);
      }
      const reports = await sweepMeetVault(sb, userId, accounts, {
        days: Number(body.days) || 365,
        cap: Number(body.cap) || 250,
      });
      return json({ ok: true, reports, needsGrant }, 200, cors);
    }

    if (action === "grant") {
      // The mesh OAuth function owns the consent URL; this only reports the
      // scope set the vault requires so the caller can re-consent at Tier 2.
      return json({ ok: true, scopes: scopesForTier(2), needsGrant }, 200, cors);
    }

    if (action === "delete") {
      // Removes the local index row only. Nothing is deleted inside Drive.
      const id = String(body.artifact_id ?? "");
      if (!id) return json({ error: "artifact_id required" }, 400, cors);
      const { error } = await sb
        .from("google_meet_artifacts").delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true }, 200, cors);
    }

    // ── LIST (default) ───────────────────────────────────────────────────
    const limit = Math.min(200, Math.max(1, Number(body.limit) || 60));
    const q = String(body.q ?? "").trim().slice(0, 120);

    let sessQuery = sb
      .from("google_meet_sessions")
      .select("id, title, meet_link, conference_code, organizer_email, participants, started_at, ended_at, source, account_id")
      .eq("user_id", userId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (q) sessQuery = sessQuery.ilike("title", `%${q}%`);

    const { data: sessions, error: sErr } = await sessQuery;
    if (sErr) return json({ error: sErr.message }, 400, cors);

    const ids = (sessions ?? []).map((s) => s.id);
    const { data: artifacts } = await sb
      .from("google_meet_artifacts")
      .select("id, session_id, kind, name, mime_type, size_bytes, duration_ms, thumbnail_link, web_view_link, file_created_at")
      .eq("user_id", userId)
      .order("file_created_at", { ascending: false, nullsFirst: false })
      .limit(500);

    // Artifacts whose meeting was never indexed still deserve to be playable.
    const bound = (artifacts ?? []).filter((a) => a.session_id && ids.includes(a.session_id));
    const orphans = (artifacts ?? []).filter((a) => !a.session_id).slice(0, 40);

    const signed = await Promise.all(
      [...bound, ...orphans].map(async (a) => ({
        ...a,
        playback: await signPlaybackToken(userId, a.id),
      })),
    );
    const byId = new Map(signed.map((a) => [a.id, a]));

    return json({
      ok: true,
      needsGrant,
      accounts: accounts.map((a) => ({ id: a.id, email: a.google_email })),
      sessions: (sessions ?? []).map((s) => ({
        ...s,
        artifacts: bound.filter((a) => a.session_id === s.id).map((a) => byId.get(a.id)),
      })),
      unmatched: orphans.map((a) => byId.get(a.id)),
    }, 200, cors);
  } catch (e) {
    console.error("meet-vault error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected failure" }, 500, cors);
  }
});
