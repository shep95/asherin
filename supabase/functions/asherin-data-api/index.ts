// asherin.data — external push api.
// authenticated with a workspace api key that is stored only as a sha-256
// digest. the key never appears in a log, an error, or a stored row.

import { getCorsHeaders } from "../_shared/cors.ts";
import { adminClient, jsonResponse, auditData } from "../_shared/dataAccess.ts";

const MAX_ROWS = 20_000;
const MAX_COLUMNS = 512;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Body {
  source_name?: string;
  source_id?: string;
  rows: Record<string, unknown>[];
  note?: string;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req, "x-asherin-data-key");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  const key = req.headers.get("x-asherin-data-key") ?? "";
  if (key.length < 24) return jsonResponse({ error: "a workspace api key is required in x-asherin-data-key" }, 401, cors);

  const admin = adminClient();
  const hash = await sha256Hex(key);
  const { data: ws } = await admin
    .from("data_workspaces").select("id, owner_id").eq("api_key_hash", hash).maybeSingle();
  if (!ws) return jsonResponse({ error: "that key is not recognised" }, 401, cors);

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid json" }, 400, cors); }
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!rows.length) return jsonResponse({ error: "send a non-empty rows array" }, 400, cors);

  const columns: string[] = [];
  const flat = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r ?? {})) {
      const col = String(k).slice(0, 120);
      if (!columns.includes(col)) {
        if (columns.length >= MAX_COLUMNS) continue;
        columns.push(col);
      }
      o[col] = v && typeof v === "object" ? JSON.stringify(v) : v;
    }
    return o;
  });

  let sourceId = typeof body.source_id === "string" ? body.source_id : "";
  if (sourceId) {
    const { data: src } = await admin.from("data_sources").select("id").eq("id", sourceId).eq("workspace_id", ws.id).maybeSingle();
    if (!src) return jsonResponse({ error: "that source is not in this workspace" }, 404, cors);
  } else {
    const name = String(body.source_name ?? "api push").slice(0, 200);
    const { data: existing } = await admin
      .from("data_sources").select("id").eq("workspace_id", ws.id).eq("name", name).eq("kind", "api").maybeSingle();
    if (existing) sourceId = existing.id as string;
    else {
      const { data: src, error } = await admin.from("data_sources")
        .insert({ workspace_id: ws.id, name, kind: "api", connector: "api", status: "ready" })
        .select("id").single();
      if (error || !src) return jsonResponse({ error: "could not create the source" }, 500, cors);
      sourceId = src.id as string;
    }
  }

  const { data: last } = await admin
    .from("data_versions").select("version").eq("source_id", sourceId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const { data: ver, error: verErr } = await admin.from("data_versions").insert({
    workspace_id: ws.id, source_id: sourceId, version,
    file_name: null, mime: "application/json",
    byte_size: 0, row_count: flat.length, column_count: columns.length,
    quality: {}, profile: { columns: columns.map((c) => ({ name: c, type: "text", completeness: 100, distinct: 0 })) },
    note: String(body.note ?? "pushed through the api").slice(0, 500),
    created_by: ws.owner_id,
  }).select("id").single();
  if (verErr || !ver) return jsonResponse({ error: "could not create the version" }, 500, cors);

  let stored = 0;
  for (let i = 0; i < flat.length; i += 500) {
    const batch = flat.slice(i, i + 500).map((row, j) => ({
      workspace_id: ws.id, version_id: ver.id, idx: i + j, row,
    }));
    const { error } = await admin.from("data_records").insert(batch);
    if (error) break;
    stored += batch.length;
  }

  await admin.from("data_sources").update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", sourceId);
  await auditData(admin, ws.id, null, "api.push", sourceId, { rows: stored, version });

  // webhooks fire after the write lands, each with its own timeout
  const { data: hooks } = await admin
    .from("data_webhooks").select("id, url, events").eq("workspace_id", ws.id).eq("active", true).limit(10);
  for (const h of hooks ?? []) {
    const events = Array.isArray(h.events) ? h.events : [];
    if (events.length && !events.includes("data.ingested")) continue;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(String(h.url), {
        method: "POST", signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "data.ingested", source_id: sourceId, version, rows: stored }),
      });
      await admin.from("data_webhooks").update({ last_status: r.status, last_error: null }).eq("id", h.id);
    } catch (e) {
      await admin.from("data_webhooks")
        .update({ last_status: null, last_error: (e instanceof Error ? e.message : "delivery failed").slice(0, 300) })
        .eq("id", h.id);
    } finally {
      clearTimeout(t);
    }
  }

  return jsonResponse({ source_id: sourceId, version, rows_stored: stored, profiling: "run a refresh in the app to profile and index this version" }, 200, cors);
});
