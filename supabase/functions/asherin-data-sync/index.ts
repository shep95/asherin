// asherin.data — live connectors.
// only connectors that can actually complete a fetch from this runtime are
// offered. anything requiring an oauth dance, a private network route or a
// driver the runtime does not carry reports available:false with the reason —
// it never returns a hollow success.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import { adminClient, workspaceRole, canWrite, jsonResponse, auditData } from "../_shared/dataAccess.ts";

interface Body {
  workspace_id: string;
  connector: string;
  /** connector specific, never persisted when it carries a credential */
  config?: Record<string, unknown>;
  secret?: string;
  source_id?: string;
  name?: string;
  cadence?: string;
}

export interface ConnectorInfo {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
  needs: string[];
}

export const CONNECTORS: ConnectorInfo[] = [
  { id: "google-sheets", label: "google sheets", available: true, needs: ["a sheet published to the web, or a sheet id plus an api key"] },
  { id: "postgresql", label: "postgresql", available: true, needs: ["a connection string reachable from the public internet"] },
  { id: "stripe", label: "stripe", available: true, needs: ["a restricted api key with read access"] },
  { id: "http-json", label: "http json endpoint", available: true, needs: ["a public https url returning an array of records"] },
  { id: "mysql", label: "mysql", available: false, reason: "this runtime carries no mysql driver. export to csv or expose the table over an https endpoint.", needs: [] },
  { id: "google-analytics", label: "google analytics", available: false, reason: "ga4 requires a google oauth consent flow that is not connected yet.", needs: [] },
  { id: "salesforce", label: "salesforce", available: false, reason: "not connected yet.", needs: [] },
  { id: "airtable", label: "airtable", available: false, reason: "not connected yet.", needs: [] },
  { id: "notion", label: "notion", available: false, reason: "not connected yet.", needs: [] },
  { id: "quickbooks", label: "quickbooks", available: false, reason: "not connected yet.", needs: [] },
  { id: "snowflake", label: "snowflake", available: false, reason: "not connected yet.", needs: [] },
  { id: "bigquery", label: "bigquery", available: false, reason: "not connected yet.", needs: [] },
  { id: "hubspot", label: "hubspot", available: false, reason: "not connected yet.", needs: [] },
];

const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|metadata\.)/i;

function assertPublicUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("only https urls are accepted");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("private, loopback and metadata hosts are refused");
  return u;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 20_000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

function csvToRows(text: string): { columns: string[]; rows: Record<string, string | null>[] } {
  const lines: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); lines.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); lines.push(row); }
  const [header, ...body] = lines.filter((l) => l.some((c) => c.trim() !== ""));
  const columns = (header ?? []).map((c, i) => c.trim() || `column_${i + 1}`);
  const rows = body.map((l) => {
    const o: Record<string, string | null> = {};
    columns.forEach((c, i) => { const v = (l[i] ?? "").trim(); o[c] = v === "" ? null : v; });
    return o;
  });
  return { columns, rows };
}

function flatten(records: Record<string, unknown>[]): { columns: string[]; rows: Record<string, unknown>[] } {
  const columns: string[] = [];
  const rows = records.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r ?? {})) {
      const key = k.slice(0, 120);
      o[key] = v && typeof v === "object" ? JSON.stringify(v) : v;
      if (!columns.includes(key)) columns.push(key);
    }
    return o;
  });
  return { columns, rows };
}

const MAX_ROWS = 20_000;

async function pullGoogleSheets(config: Record<string, unknown>, secret?: string) {
  const sheetId = String(config.sheet_id ?? "").trim();
  const publishedUrl = String(config.published_csv_url ?? "").trim();
  if (publishedUrl) {
    const u = assertPublicUrl(publishedUrl);
    const r = await fetchWithTimeout(u.toString());
    if (!r.ok) throw new Error(`google sheets returned ${r.status}`);
    return csvToRows(await r.text());
  }
  if (!sheetId) throw new Error("give either a published csv url or a sheet id");
  if (!secret) throw new Error("a sheets api key is needed when using a sheet id");
  const range = String(config.range ?? "A1:Z10000");
  const r = await fetchWithTimeout(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(secret)}`,
  );
  if (!r.ok) throw new Error(`google sheets returned ${r.status}`);
  const j = await r.json();
  const values: string[][] = j?.values ?? [];
  const [header, ...body] = values;
  if (!header) throw new Error("the range came back empty");
  const columns = header.map((c, i) => String(c).trim() || `column_${i + 1}`);
  const rows = body.map((l) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c, i) => { const v = (l[i] ?? "").trim(); o[c] = v === "" ? null : v; });
    return o;
  });
  return { columns, rows };
}

async function pullPostgres(config: Record<string, unknown>, secret?: string) {
  const conn = String(secret ?? config.connection_string ?? "").trim();
  const table = String(config.table ?? "").trim();
  if (!conn) throw new Error("a connection string is needed");
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i.test(table)) throw new Error("give a table name like schema.table");
  const host = new URL(conn.replace(/^postgres(ql)?:\/\//, "https://")).hostname;
  if (PRIVATE_HOST.test(host)) throw new Error("private and loopback database hosts are refused");
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client(conn);
  await client.connect();
  try {
    // identifier is validated above; the limit is a bound parameter
    const res = await client.queryObject<Record<string, unknown>>(
      `select * from ${table} limit $1`, [MAX_ROWS],
    );
    return flatten(res.rows);
  } finally {
    await client.end();
  }
}

async function pullStripe(config: Record<string, unknown>, secret?: string) {
  if (!secret) throw new Error("a stripe restricted key is needed");
  const object = ["charges", "customers", "invoices", "subscriptions", "payment_intents", "balance_transactions"]
    .includes(String(config.object ?? "")) ? String(config.object) : "charges";
  const rows: Record<string, unknown>[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://api.stripe.com/v1/${object}`);
    url.searchParams.set("limit", "100");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);
    const r = await fetchWithTimeout(url.toString(), { headers: { Authorization: `Bearer ${secret}` } });
    if (r.status === 401) throw new Error("stripe rejected that key");
    if (!r.ok) throw new Error(`stripe returned ${r.status}`);
    const j = await r.json();
    const batch: Record<string, unknown>[] = j?.data ?? [];
    for (const item of batch) {
      rows.push({
        id: item.id,
        created: item.created ? new Date(Number(item.created) * 1000).toISOString() : null,
        amount: typeof item.amount === "number" ? item.amount / 100 : null,
        currency: item.currency ?? null,
        status: item.status ?? null,
        customer: typeof item.customer === "string" ? item.customer : null,
        description: item.description ?? null,
      });
    }
    if (!j?.has_more || !batch.length) break;
    startingAfter = String(batch[batch.length - 1].id);
  }
  if (!rows.length) throw new Error(`stripe returned no ${object}`);
  return flatten(rows);
}

async function pullHttpJson(config: Record<string, unknown>, secret?: string) {
  const url = assertPublicUrl(String(config.url ?? ""));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (secret) headers.Authorization = secret.startsWith("Bearer ") ? secret : `Bearer ${secret}`;
  const r = await fetchWithTimeout(url.toString(), { headers });
  if (!r.ok) throw new Error(`the endpoint returned ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (!ct.includes("json")) throw new Error(`the endpoint returned ${ct || "an unknown content type"} instead of json`);
  const j = await r.json();
  const path = String(config.records_path ?? "").trim();
  let records: unknown = j;
  if (path) for (const seg of path.split(".")) records = (records as Record<string, unknown>)?.[seg];
  if (!Array.isArray(records)) {
    const key = Object.keys(j ?? {}).find((k) => Array.isArray(j[k]));
    if (!key) throw new Error("no array of records was found in the response");
    records = j[key];
  }
  return flatten((records as Record<string, unknown>[]).slice(0, MAX_ROWS));
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return jsonResponse({ connectors: CONNECTORS }, 200, cors);
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  let user;
  try { user = await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid json" }, 400, cors); }
  const workspaceId = String(body.workspace_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return jsonResponse({ error: "workspace_id is required" }, 400, cors);

  const info = CONNECTORS.find((c) => c.id === body.connector);
  if (!info) return jsonResponse({ error: "unknown connector" }, 400, cors);
  if (!info.available) return jsonResponse({ available: false, error: info.reason }, 400, cors);

  const admin = adminClient();
  const role = await workspaceRole(admin, workspaceId, user.id);
  if (!role) return jsonResponse({ error: "no access to this workspace" }, 403, cors);
  if (!canWrite(role)) return jsonResponse({ error: "viewers cannot connect sources" }, 403, cors);

  const config = (body.config ?? {}) as Record<string, unknown>;
  const secret = typeof body.secret === "string" ? body.secret : undefined;

  let pulled: { columns: string[]; rows: Record<string, unknown>[] };
  try {
    if (info.id === "google-sheets") pulled = await pullGoogleSheets(config, secret);
    else if (info.id === "postgresql") pulled = await pullPostgres(config, secret);
    else if (info.id === "stripe") pulled = await pullStripe(config, secret);
    else pulled = await pullHttpJson(config, secret);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (body.source_id) {
      await admin.from("data_sources").update({ last_sync_error: reason.slice(0, 500), status: "error" }).eq("id", body.source_id).eq("workspace_id", workspaceId);
    }
    return jsonResponse({ error: reason }, 400, cors);
  }
  if (!pulled.rows.length) return jsonResponse({ error: "the connector returned no rows" }, 400, cors);

  // credentials are never written to the row store; only non-secret config is kept
  const safeConfig: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (/key|token|secret|password|connection_string/i.test(k)) continue;
    safeConfig[k] = v;
  }

  const cadence = ["manual", "hourly", "daily", "weekly"].includes(String(body.cadence)) ? String(body.cadence) : "manual";
  let sourceId = body.source_id ?? "";
  if (sourceId) {
    const { data: src } = await admin.from("data_sources").select("id").eq("id", sourceId).eq("workspace_id", workspaceId).maybeSingle();
    if (!src) return jsonResponse({ error: "that source is not in this workspace" }, 404, cors);
    await admin.from("data_sources").update({ config: safeConfig, sync_cadence: cadence, status: "ready", last_sync_error: null }).eq("id", sourceId);
  } else {
    const { data: src, error } = await admin.from("data_sources").insert({
      workspace_id: workspaceId,
      name: String(body.name ?? info.label).slice(0, 200),
      kind: "connector",
      connector: info.id,
      config: safeConfig,
      sync_cadence: cadence,
      status: "ready",
    }).select("id").single();
    if (error || !src) return jsonResponse({ error: "could not create the source" }, 500, cors);
    sourceId = src.id as string;
  }

  await auditData(admin, workspaceId, user.id, "sync.pull", sourceId, { connector: info.id, rows: pulled.rows.length });

  // rows go back to the device, which validates and profiles them, then ingests.
  return jsonResponse({
    source_id: sourceId,
    connector: info.id,
    columns: pulled.columns,
    rows: pulled.rows.slice(0, MAX_ROWS),
    pulled_at: new Date().toISOString(),
  }, 200, cors);
});
