// asherin.data — ingest.
// The device parses, validates and profiles the file; this function persists a
// new immutable version, its rows, its dictionary and its retrieval chunks.
// Nothing is overwritten: a re-upload is always version n+1.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import { adminClient, workspaceRole, canWrite, jsonResponse, auditData } from "../_shared/dataAccess.ts";
import { embedTexts, chunkText } from "../_shared/vaultEmbed.ts";

const MAX_ROWS = 50_000;
const MAX_COLUMNS = 512;
const MAX_TEXT = 2_000_000;
const MAX_CHUNKS = 400;

interface Body {
  workspace_id: string;
  source_id?: string;
  source_name?: string;
  kind?: string;
  connector?: string | null;
  file_name?: string | null;
  mime?: string | null;
  byte_size?: number;
  storage_path?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  text?: string;
  quality?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  note?: string;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  let user;
  try { user = await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid json" }, 400, cors); }

  const workspaceId = String(body.workspace_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return jsonResponse({ error: "workspace_id is required" }, 400, cors);

  const admin = adminClient();
  const role = await workspaceRole(admin, workspaceId, user.id);
  if (!role) return jsonResponse({ error: "no access to this workspace" }, 403, cors);
  if (!canWrite(role)) return jsonResponse({ error: "viewers cannot add data" }, 403, cors);

  const columns = Array.isArray(body.columns) ? body.columns.slice(0, MAX_COLUMNS).map(String) : [];
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  const text = String(body.text ?? "").slice(0, MAX_TEXT);
  if (!rows.length && !text.trim()) {
    return jsonResponse({ error: "nothing to ingest: no rows and no text" }, 400, cors);
  }

  // 1. source (existing = new version of the same source, else create it)
  let sourceId = typeof body.source_id === "string" ? body.source_id : "";
  if (sourceId) {
    const { data: src } = await admin
      .from("data_sources").select("id").eq("id", sourceId).eq("workspace_id", workspaceId).maybeSingle();
    if (!src) return jsonResponse({ error: "that source is not in this workspace" }, 404, cors);
  } else {
    const { data: src, error } = await admin.from("data_sources").insert({
      workspace_id: workspaceId,
      name: String(body.source_name ?? body.file_name ?? "untitled source").slice(0, 200),
      kind: String(body.kind ?? (rows.length ? "table" : "document")),
      connector: body.connector ?? null,
      status: "ready",
    }).select("id").single();
    if (error || !src) return jsonResponse({ error: "could not create the source" }, 500, cors);
    sourceId = src.id as string;
  }

  // 2. next version number
  const { data: last } = await admin
    .from("data_versions").select("version").eq("source_id", sourceId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const { data: ver, error: verErr } = await admin.from("data_versions").insert({
    workspace_id: workspaceId,
    source_id: sourceId,
    version,
    storage_path: body.storage_path ?? null,
    file_name: body.file_name ?? null,
    mime: body.mime ?? null,
    byte_size: Number(body.byte_size ?? 0) || 0,
    row_count: rows.length,
    column_count: columns.length,
    quality: body.quality ?? {},
    profile: body.profile ?? {},
    note: body.note ?? null,
    created_by: user.id,
  }).select("id").single();
  if (verErr || !ver) return jsonResponse({ error: `could not create the version: ${verErr?.message}` }, 500, cors);
  const versionId = ver.id as string;

  // 3. rows, in batches
  let stored = 0;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((row, j) => ({
      workspace_id: workspaceId,
      version_id: versionId,
      idx: i + j,
      row,
    }));
    const { error } = await admin.from("data_records").insert(batch);
    if (error) {
      await admin.from("data_versions").update({ note: `partial load: ${error.message}`.slice(0, 500) }).eq("id", versionId);
      break;
    }
    stored += batch.length;
  }

  // 4. dictionary — inferred definitions, never overwriting a user edit
  const profileColumns = (body.profile as { columns?: { name: string; type: string; completeness: number; distinct: number }[] })?.columns ?? [];
  if (profileColumns.length) {
    const { data: existing } = await admin
      .from("data_dictionary").select("column_name, user_edited").eq("source_id", sourceId);
    const locked = new Set((existing ?? []).filter((e) => e.user_edited).map((e) => e.column_name));
    const entries = profileColumns.filter((c) => !locked.has(c.name)).map((c) => ({
      workspace_id: workspaceId,
      source_id: sourceId,
      column_name: c.name,
      inferred_type: c.type,
      definition: `${c.type} column, ${c.completeness}% filled in, ${c.distinct} distinct value(s)`,
      user_edited: false,
      updated_at: new Date().toISOString(),
    }));
    if (entries.length) {
      await admin.from("data_dictionary").upsert(entries, { onConflict: "source_id,column_name" });
    }
  }

  // 5. retrieval chunks — documents chunk their text, tables chunk row windows
  let chunkCount = 0;
  let embedNote: string | null = null;
  try {
    let pieces: { content: string; meta: Record<string, unknown> }[] = [];
    if (text.trim() && !rows.length) {
      pieces = chunkText(text).slice(0, MAX_CHUNKS).map((content, i) => ({ content, meta: { kind: "document", part: i } }));
    } else if (rows.length) {
      const WINDOW = 25;
      const header = columns.join(" | ");
      for (let i = 0; i < rows.length && pieces.length < MAX_CHUNKS; i += WINDOW) {
        const slice = rows.slice(i, i + WINDOW);
        const lines = slice.map((r) => columns.map((c) => String((r as Record<string, unknown>)[c] ?? "")).join(" | "));
        pieces.push({
          content: `${header}\n${lines.join("\n")}`,
          meta: { kind: "rows", row_range: [i, i + slice.length - 1] },
        });
      }
    }
    if (pieces.length) {
      const vectors = await embedTexts(pieces.map((p) => p.content));
      const inserts = pieces.map((p, i) => ({
        workspace_id: workspaceId,
        source_id: sourceId,
        version_id: versionId,
        content: p.content.slice(0, 8000),
        meta: p.meta,
        embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
      })).filter((r) => r.embedding !== null);
      for (let i = 0; i < inserts.length; i += 100) {
        const { error } = await admin.from("data_chunks").insert(inserts.slice(i, i + 100));
        if (error) { embedNote = error.message; break; }
        chunkCount += Math.min(100, inserts.length - i);
      }
    }
  } catch (e) {
    embedNote = e instanceof Error ? e.message : String(e);
  }

  await admin.from("data_sources").update({
    status: "ready",
    last_sync_at: new Date().toISOString(),
    last_sync_error: null,
  }).eq("id", sourceId);

  await auditData(admin, workspaceId, user.id, "ingest", sourceId, { version, rows: stored, chunks: chunkCount });

  return jsonResponse({
    source_id: sourceId,
    version_id: versionId,
    version,
    rows_stored: stored,
    chunks: chunkCount,
    // Retrieval degrades honestly: rows are queryable even if embedding failed.
    retrieval: chunkCount > 0 ? "ready" : "unavailable",
    retrieval_note: embedNote,
  }, 200, cors);
});
