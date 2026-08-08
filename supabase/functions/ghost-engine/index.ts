// ─────────────────────────────────────────────────────────────────────────────
// ASHERIN GHOST ENGINE — metadata index + short full-take buffer (Pro tier)
//
// Two layers, one engine:
//   METADATA  — compact tags about the session (host, ASN, EXIF device, PDF
//               producer, redirect topology, language, filenames, addresses).
//               Cheap, fast, returned inline. This is the card catalog.
//   PAYLOAD   — the session body itself (HTML, document bytes, text, JSON),
//               retained in an operator-scoped buffer for a bounded window and
//               searchable by dictionary, phrase, and regex. This is the shelf.
//
// The metadata index makes bulk traffic queryable; the buffer makes the
// matching payloads retrievable. Search hits the index first, then opens only
// the sessions that matter.
//
// Actions:
//   sweep    (default) — discover/probe targets, build the index, optionally
//                        capture payloads into the buffer
//   buffer   — list the operator's live sessions
//   content  — soft selection over buffered payloads (dictionary / regex)
//   payload  — open one buffered session (text + signed link to raw bytes)
//   purge    — drop the operator's buffer immediately
//
// Access: Asherin Pro ($399/mo monthly + 6-month term) and admin.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { extractGhostRecord, isPublicHttpUrl, pool, type GhostRecord } from "../_shared/ghostMetadata.ts";
import { buildIndex } from "../_shared/ghostIndex.ts";
import { resolveAxrlenAccess } from "../_shared/proTierGate.ts";
import {
  deriveFields, selectContent, ttlToExpiry, SelectorError,
  BUFFER_DEFAULT_TTL_MIN, type BufferRow, type Selector,
} from "../_shared/ghostBuffer.ts";

const MAX_TARGETS = 24;
const CONCURRENCY = 6;
const BUCKET = "ghost-buffer";

type Action = "search" | "searchBuffer" | "sweep" | "buffer" | "content" | "payload" | "purge" | "ledger";

interface GhostRequest {
  action?: Action;
  query?: string;
  urls?: string[];
  limit?: number;
  mode?: "sweep" | "target";
  /** Retain session bodies in the short full-take buffer. */
  capture?: boolean;
  ttlMinutes?: number;
  /** Soft-selection selectors for action=content. */
  selector?: Selector;
  /** Session to open for action=payload. */
  sessionId?: string;
  /** action=search — which layers to consult. */
  scope?: "all" | "web" | "buffer";
  /** action=ledger — Cloud Intelligence fusion parameters. */
  windowDays?: number;
  channel?: "gmail" | "sms" | null;
  focus?: string | null;
  maxHosts?: number;
}


/** A bare URL (with or without scheme) is a direct probe, not a sweep. */
function asUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(candidate);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
    return isPublicHttpUrl(u.toString());
  } catch { return null; }
}

/** Discovery pass — the open index tells us which doors to knock on. */
async function discover(query: string, limit: number, authHeader: string | null): Promise<string[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = serviceRole || (authHeader || "").replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !bearer) return [];
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ddg-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ query, numResults: limit }),
    });
    if (!res.ok) {
      console.error(`[ghost-engine] discovery failed [${res.status}]: ${await res.text()}`);
      return [];
    }
    const json = await res.json();
    const urls: string[] = (json.results || [])
      .map((r: { url: string }) => isPublicHttpUrl(r.url))
      .filter(Boolean);
    return [...new Set(urls)].slice(0, limit);
  } catch (e) {
    console.error("[ghost-engine] discovery error:", (e as Error).message);
    return [];
  }
}

/** Service-role client — the buffer is written on the operator's behalf. */
function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolve the caller's user id from the bearer token (admins included). */
async function callerUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data } = await sb.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch { return null; }
}

/** Live rows only — an expired session is not in the buffer, whatever the row says. */
async function liveRows(sb: SupabaseClient, userId: string, limit = 400): Promise<BufferRow[]> {
  const { data, error } = await sb
    .from("ghost_sessions")
    .select("session_id,url,host,source_type,status,content_text,content_bytes,content_sha256,storage_path,truncated,language_tag,entropy,is_encrypted,emails,phones,ipv4s,filenames,urls,captured_at,expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[ghost-engine] buffer read failed:", error.message);
    return [];
  }
  return (data || []) as BufferRow[];
}

/** Strip payload bytes from a row before it is described to the client. */
function summarize(r: BufferRow) {
  const { content_text: _t, ...rest } = r;
  return { ...rest, text_chars: (r.content_text || "").length };
}

/** Split a natural query into dictionary terms. Quoted spans stay intact. */
function tokenize(q: string): string[] {
  const terms: string[] = [];
  const quoted = q.match(/"[^"]{1,120}"/g) || [];
  for (const m of quoted) terms.push(m.slice(1, -1));
  const rest = q.replace(/"[^"]{1,120}"/g, " ");
  for (const w of rest.split(/[\s,]+/)) {
    const t = w.replace(/^[-+]/, "").trim();
    if (t.length >= 3 && !/^https?:\/\//i.test(t)) terms.push(t);
  }
  return [...new Set(terms)].slice(0, 12);
}

interface SearchResult {
  id: string;
  source: "web" | "buffer";
  title: string;
  url: string;
  host: string;
  snippet: string;
  badges: string[];
  score: number;
  session_id?: string;
  entity_id?: string;
}

function bufferResult(h: {
  session_id: string; url: string; host: string; source_type: string;
  is_encrypted: boolean; content_bytes: number; matches: number;
  snippets: { text: string }[];
}): SearchResult {
  return {
    id: `buffer:${h.session_id}`,
    source: "buffer",
    title: h.host || h.url,
    url: h.url,
    host: h.host,
    snippet: h.snippets[0]?.text || `${h.matches} match${h.matches === 1 ? "" : "es"} in retained body`,
    badges: [
      `${h.matches} match${h.matches === 1 ? "" : "es"}`,
      h.source_type.split(";")[0],
      h.is_encrypted ? "encrypted" : "",
      `${Math.max(1, Math.round(h.content_bytes / 1024))} KB`,
    ].filter(Boolean),
    score: 1000 + h.matches,
    session_id: h.session_id,
  };
}

/** Fold a metadata shell into the flat result shape the search list renders. */
function webResult(r: GhostRecord, anomalyCount: number): SearchResult {
  const badges = [
    r.status ? String(r.status) : "unreachable",
    (r.source_type || "").split(";")[0],
    r.tls ? "TLS" : "no TLS",
    r.asn || "",
    r.geo_source === "exif" ? "EXIF GPS" : "",
    r.author ? `author: ${r.author}` : "",
    r.software || "",
    anomalyCount ? `${anomalyCount} anomal${anomalyCount === 1 ? "y" : "ies"}` : "",
  ].filter(Boolean);

  const facts = [
    r.server ? `served by ${r.server}` : null,
    r.network_origin_ip ? `origin ${r.network_origin_ip}${r.geo_label ? ` — ${r.geo_label}` : ""}` : null,
    r.created_at ? `created ${r.created_at.slice(0, 16).replace("T", " ")}Z` : null,
    r.modified_at ? `modified ${r.modified_at.slice(0, 16).replace("T", " ")}Z` : null,
    r.device_id ? `device ${r.device_id}` : null,
    r.redirect_chain.length ? `${r.redirect_chain.length} redirect hop${r.redirect_chain.length === 1 ? "" : "s"}` : null,
    r.dns.ns.length ? `ns ${r.dns.ns.slice(0, 2).join(", ")}` : null,
  ].filter(Boolean) as string[];

  // Rank by evidentiary richness: a shell that carries authorship, a device, a
  // coordinate or a contradiction outranks a bare 200 with nothing embedded.
  const score =
    (r.status && r.status < 400 ? 20 : 0) +
    (r.author ? 30 : 0) + (r.device_id ? 25 : 0) + (r.software ? 12 : 0) +
    (r.geo_lat != null ? 25 : 0) + (r.created_at ? 10 : 0) +
    anomalyCount * 18 + Math.min(facts.length, 6) * 3;

  return {
    id: `web:${r.entity_id}`,
    source: "web",
    title: r.host || r.url,
    url: r.url,
    host: r.host,
    snippet: facts.join(" · ") || "Shell reachable, nothing embedded — the publisher strips metadata on upload.",
    badges,
    score,
    entity_id: r.entity_id,
  };
}

/** Related searches, derived from the facets the sweep already produced. */
function suggestFromFacets(facets: { field: string; value: string; count: number }[]): string[] {
  return facets
    .filter((f) => f.count > 1 && f.value && f.value !== "unknown")
    .slice(0, 10)
    .map((f) => `${f.field}:${/\s/.test(f.value) ? `"${f.value}"` : f.value}`);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ── Gate: Pro ($399 monthly / 6-month) or admin ────────────────────────────
  const access = await resolveAxrlenAccess(req);
  if (!access.granted) {
    return json(
      {
        error: access.reason === "anonymous" ? "Authentication required" : "Ghost Engine requires Asherin Pro",
        reason: access.reason,
      },
      access.reason === "anonymous" ? 401 : 403,
    );
  }

  let body: GhostRequest;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const rawAction: Action = body.action ?? "sweep";
  // `search` is the front-door verb: one box, one Enter. It reuses the sweep
  // path verbatim and then folds buffer hits + suggestions into the response,
  // so the operator never has to pick a mode to get an answer.
  const searchMode = rawAction === "search";
  const scope: "all" | "web" | "buffer" = searchMode ? (body.scope ?? "all") : "web";
  const action: Action = searchMode ? (scope === "buffer" ? "searchBuffer" : "sweep") : rawAction;
  const sb = serviceClient();
  const userId = await callerUserId(req);

  // Every entry point sweeps the shelf clean of anything past its window. The
  // buffer's finitude is enforced on the request path, not by a cron that may
  // not have run.
  if (sb) { try { await sb.rpc("ghost_buffer_purge"); } catch { /* best effort */ } }

  // ── Buffer-only search — the shelf without a new sweep ─────────────────────
  if (action === "searchBuffer") {
    const q = String(body.query ?? "").trim().slice(0, 400);
    if (!sb || !userId) return json({ error: "Buffer unavailable for this session" }, 503);
    if (!q) return json({ error: "query is required" }, 400);
    const rows = await liveRows(sb, userId);
    let hits: ReturnType<typeof selectContent> = [];
    try {
      hits = selectContent(rows, { dictionary: tokenize(q), mode: "any" }, 60);
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e;
    }
    return json({
      action: "search", scope: "buffer", query: q, mode: "target",
      elapsedMs: 0, tier: access.reason, index: null, buffer: null,
      results: hits.map(bufferResult),
      suggestions: [...new Set(hits.map((h) => `host:${h.host}`))].slice(0, 8),
      scanned: rows.length,
    });
  }

  // ── Buffer-side actions ────────────────────────────────────────────────────
  if (action !== "sweep") {
    if (!sb || !userId) return json({ error: "Buffer unavailable for this session" }, 503);

    if (action === "purge") {
      const { data: rows } = await sb.from("ghost_sessions").select("storage_path").eq("user_id", userId);
      const paths = (rows || []).map((r: { storage_path: string | null }) => r.storage_path).filter(Boolean) as string[];
      if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch { /* object may be gone */ } }
      const { error } = await sb.from("ghost_sessions").delete().eq("user_id", userId);
      if (error) return json({ error: "Purge failed", details: error.message }, 500);
      return json({ action, purged: paths.length || (rows || []).length });
    }

    const rows = await liveRows(sb, userId);

    if (action === "buffer") {
      return json({
        action,
        sessions: rows.map(summarize),
        total: rows.length,
        bytes: rows.reduce((a, r) => a + (r.content_bytes || 0), 0),
      });
    }

    if (action === "content") {
      try {
        const hits = selectContent(rows, body.selector || {}, Math.min(Number(body.limit) || 50, 100));
        return json({ action, scanned: rows.length, hits, total: hits.length });
      } catch (e) {
        if (e instanceof SelectorError) return json({ error: e.message, reason: "selector" }, 400);
        throw e;
      }
    }

    if (action === "payload") {
      const sid = String(body.sessionId || "").trim();
      const row = rows.find((r) => r.session_id === sid);
      if (!row) return json({ error: "Session not in buffer (expired or never captured)" }, 404);
      let download: string | null = null;
      if (row.storage_path) {
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(row.storage_path, 300);
        download = data?.signedUrl ?? null;
      }
      return json({ action, session: { ...summarize(row), content_text: row.content_text }, download });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  }

  // ── Sweep ──────────────────────────────────────────────────────────────────
  const query = String(body.query ?? "").trim().slice(0, 400);
  const explicit = Array.isArray(body.urls) ? body.urls.slice(0, MAX_TARGETS) : [];
  const limit = Math.min(Math.max(Number(body.limit) || 12, 1), MAX_TARGETS);
  if (!query && explicit.length === 0) return json({ error: "query or urls is required" }, 400);

  const started = Date.now();
  const capture = body.capture === true && !!sb && !!userId;

  let targets: string[] = explicit.map(asUrl).filter(Boolean) as string[];
  let mode: "sweep" | "target" = targets.length ? "target" : (body.mode ?? "sweep");
  const direct = query ? asUrl(query) : null;

  if (!targets.length && direct) {
    mode = "target";
    const u = new URL(direct);
    // A single door tells you little; the host's standard surfaces tell you a lot.
    targets = [...new Set([
      direct,
      `${u.origin}/`,
      `${u.origin}/robots.txt`,
      `${u.origin}/sitemap.xml`,
      `${u.origin}/.well-known/security.txt`,
    ])];
  } else if (!targets.length) {
    targets = await discover(query, limit, req.headers.get("Authorization"));
    if (!targets.length) {
      return json({
        query, mode, targets: [], index: null, elapsedMs: Date.now() - started,
        error: "No public targets resolved for this query.",
      });
    }
  }

  targets = targets.slice(0, MAX_TARGETS);
  console.log(`[ghost-engine] ${mode} · ${targets.length} targets · capture=${capture} · caller=${access.reason}`);

  const records = (await pool(targets, CONCURRENCY, (t: string) => extractGhostRecord(t, capture))) as GhostRecord[];

  // ── Buffer write — payload leaves the record and lands on the shelf ────────
  let buffered = 0;
  const bufferErrors: string[] = [];
  const expiresAt = ttlToExpiry(body.ttlMinutes);
  if (capture && sb && userId) {
    for (const rec of records) {
      const p = rec.payload;
      delete rec.payload;                      // never returned inline
      if (!p || !p.bytes.length) continue;
      try {
        const fields = await deriveFields(p, rec.declared_language);
        const path = `${userId}/${p.session_id}`;
        const up = await sb.storage.from(BUCKET).upload(path, p.bytes, {
          contentType: p.source_type || "application/octet-stream",
          upsert: true,
        });
        if (up.error) bufferErrors.push(`${p.host}: ${up.error.message}`);
        const { error } = await sb.from("ghost_sessions").upsert({
          user_id: userId,
          session_id: p.session_id,
          url: p.url,
          host: p.host,
          source_type: p.source_type,
          status: p.status,
          storage_path: up.error ? null : path,
          expires_at: expiresAt,
          captured_at: new Date().toISOString(),
          ...fields,
        }, { onConflict: "user_id,session_id" });
        if (error) { bufferErrors.push(`${p.host}: ${error.message}`); continue; }
        buffered++;
      } catch (e) {
        bufferErrors.push(`${p.host}: ${(e as Error).message}`);
      }
    }
  } else {
    for (const rec of records) delete rec.payload;
  }

  const index = buildIndex(records);

  // ── Search projection ──────────────────────────────────────────────────────
  // The card catalog stays intact for the power tabs; this is the flat, ranked
  // list the front door renders. Buffer hits are merged in the same list so the
  // operator never has to know which layer answered.
  let results: SearchResult[] | undefined;
  let suggestions: string[] | undefined;
  if (searchMode) {
    const anomalyByEntity = new Map<string, number>();
    for (const a of index.anomalies) {
      if (a.entity_id) anomalyByEntity.set(a.entity_id, (anomalyByEntity.get(a.entity_id) ?? 0) + 1);
    }
    results = records.map((r) => webResult(r, anomalyByEntity.get(r.entity_id) ?? 0));

    if (scope === "all" && sb && userId && query) {
      try {
        const rows = await liveRows(sb, userId);
        const hits = selectContent(rows, { dictionary: tokenize(query), mode: "any" }, 30);
        results = [...hits.map(bufferResult), ...results];
      } catch (e) {
        if (!(e instanceof SelectorError)) console.error("[ghost-engine] buffer fold failed:", (e as Error).message);
      }
    }
    results.sort((a, b) => b.score - a.score);
    suggestions = suggestFromFacets(index.facets);
  }

  return json({
    action: searchMode ? "search" : "sweep",
    scope: searchMode ? scope : undefined,
    query: query || targets[0],
    mode,
    elapsedMs: Date.now() - started,
    tier: access.reason,
    index,
    results,
    suggestions,
    buffer: capture
      ? {
        captured: buffered,
        expiresAt,
        ttlMinutes: Math.round((Date.parse(expiresAt) - Date.now()) / 60000) || BUFFER_DEFAULT_TTL_MIN,
        errors: bufferErrors.slice(0, 6),
      }
      : null,
  });
});

