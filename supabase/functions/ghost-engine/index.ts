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
import { runGhostLedger } from "../_shared/ghostLedger.ts";
import { traceOrigin, traceUpload, type UploadedArtifact } from "../_shared/ghostOrigin.ts";
import { deepTimeSweep } from "../_shared/ghostTimeMachine.ts";
import {
  classifySelector, harvestLeads, type HarvestLead, type SelectorIdentity,
} from "../_shared/ghostHarvest.ts";



// The probe budget and the harvest aperture are two different numbers. The
// harvest is wide — it collects every URL the fan-out surfaces. The probe is
// deep but bounded, because a full metadata extraction costs a round trip.
// Leads beyond the probe budget are still reported; they are simply reported
// as surface intelligence rather than as forensic shells.
const MAX_PROBE = 96;
const CONCURRENCY = 12;
const HARVEST_CAP = 400;
const BUCKET = "ghost-buffer";

type Action =
  | "search" | "searchBuffer" | "sweep" | "buffer" | "content" | "payload"
  | "purge" | "ledger" | "history" | "historyDetail" | "forget" | "origin"
  | "upload" | "timeline";



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
  /** Zophiel web filter — suppress reference/farm/commerce/container noise. */
  noiseFilter?: boolean;
  /** Filter strictness. Higher cuts more; 0 is default; negative reveals more. */
  filterFloor?: number;
  /** action=ledger — Cloud Intelligence fusion parameters. */
  windowDays?: number;
  channel?: "gmail" | "sms" | null;
  focus?: string | null;
  maxHosts?: number;
  /** action=upload — an artefact the operator holds rather than a link. */
  file?: { filename?: string; contentType?: string; base64?: string };
  /** action=timeline — reach back through the capture archives. */
  fromYear?: number;
  hosts?: string[];
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

/**
 * Discovery pass — one selector, many angles.
 *
 * The prior implementation asked a single scraper a single question and kept
 * up to a dozen links. For anything that is an *entity* rather than a phrase —
 * a name, an email, a phone number — that returns nothing, because the open
 * index only concedes an entity exists when it is asked in the vocabulary the
 * indexers used. The fan-out does that asking.
 */
interface DiscoveryReport {
  leads: HarvestLead[];
  legs: number;
  filter: { applied: boolean; raw: number; kept: number; dropped: number; reasons: Record<string, number> };
}

async function discoverWide(
  identity: SelectorIdentity,
  authHeader: string | null,
  noiseFilter: boolean,
  filterFloor?: number,
): Promise<DiscoveryReport> {
  const nil = { applied: false, raw: 0, kept: 0, dropped: 0, reasons: {} as Record<string, number> };
  try {
    const { legs, leads, filter } = await harvestLeads(identity, authHeader, {
      concurrency: 5,
      legTimeoutMs: 12_000,
      maxLeads: HARVEST_CAP,
      noiseFilter,
      filterFloor,
    });
    // A lead is only useful if it is a public HTTP target we are allowed to open.
    const usable = leads.filter((l) => isPublicHttpUrl(l.url));
    return { leads: usable, legs: legs.length, filter };
  } catch (e) {
    console.error("[ghost-engine] harvest error:", (e as Error).message);
    return { leads: [], legs: 0, filter: nil };
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
  /**
   * INTERCEPT layers:
   *   web    — a shell the engine actually opened and carved metadata from
   *   lead   — a surfaced target the probe budget did not reach; still evidence
   *   buffer — a retained body already on the shelf
   */
  source: "web" | "lead" | "buffer";
  title: string;
  url: string;
  host: string;
  snippet: string;
  badges: string[];
  score: number;
  session_id?: string;
  entity_id?: string;
  /** For `lead` results — which fan-out leg surfaced the URL. */
  via?: string;
  /** Distinct engines/legs that independently returned this URL. */
  corroboration?: number;
}

function leadResult(l: HarvestLead): SearchResult {
  let host = "";
  try { host = new URL(l.url).hostname.replace(/^www\./, ""); } catch { /* noop */ }
  const badges = [
    "unprobed",
    l.engine || "",
    l.via ? `via ${l.via}` : "",
    l.corroboration > 1 ? `x${l.corroboration}` : "",
  ].filter(Boolean);
  return {
    id: `lead:${l.url}`,
    source: "lead",
    title: l.title || host || l.url,
    url: l.url,
    host,
    snippet: l.snippet || "Surfaced by the harvest; not probed this round.",
    badges,
    // Leads rank below probed shells but above unreachable ones.
    score: 5 + Math.min(l.corroboration, 8) * 2,
    via: l.via,
    corroboration: l.corroboration,
  };
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

/**
 * Fold a metadata shell into the flat result shape the search list renders.
 * When the harvest supplied a title/snippet for this URL, that human-readable
 * context is preferred for the headline and appended to the forensic facts —
 * a bare hostname told the operator nothing about *why* the hit matched.
 */
function webResult(r: GhostRecord, anomalyCount: number, lead?: HarvestLead): SearchResult {
  const badges = [
    r.status ? String(r.status) : "unreachable",
    (r.source_type || "").split(";")[0],
    r.tls ? "TLS" : "no TLS",
    r.asn || "",
    r.geo_source === "exif" ? "EXIF GPS" : "",
    r.author ? `author: ${r.author}` : "",
    r.software || "",
    lead?.via ? `via ${lead.via}` : "",
    lead && lead.corroboration > 1 ? `x${lead.corroboration}` : "",
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
    anomalyCount * 18 + Math.min(facts.length, 6) * 3 +
    Math.min(lead?.corroboration ?? 0, 8) * 2;

  const forensic = facts.join(" · ");
  const context = (lead?.snippet || "").trim();
  const snippet = context && forensic
    ? `${context} — ${forensic}`
    : context || forensic ||
      "Shell reachable, nothing embedded — the publisher strips metadata on upload.";

  return {
    id: `web:${r.entity_id}`,
    source: "web",
    title: lead?.title || r.host || r.url,
    url: r.url,
    host: r.host,
    snippet,
    badges,
    score,
    entity_id: r.entity_id,
    via: lead?.via,
    corroboration: lead?.corroboration,
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

  // ── ORIGIN — provenance of a single artefact ───────────────────────────────
  // The sweep answers "what is on this host". ORIGIN answers "who wrote this
  // file, when, on what machine, in which timezone" — a different question
  // with a different evidence base (container metadata, not link topology).
  if (action === "origin") {
    const target = String(body.query || (body.urls?.[0] ?? "")).trim();
    if (!target) return json({ error: "Give the engine a link to trace." }, 400);
    const trace = await traceOrigin(target);
    return json({ action: "origin", trace });
  }

  // ── UPLOAD — ORIGIN for a file the operator already holds ──────────────────
  // A link can be traced because it is served. A document that arrived by mail,
  // by hand, or out of a case file cannot be — but the provenance lives in the
  // bytes either way, so the same carving runs against the uploaded buffer and
  // the response additionally hands back every selector found inside it.
  if (action === "upload") {
    const f = body.file;
    if (!f?.base64) return json({ error: "No file payload received." }, 400);
    const artifact: UploadedArtifact = {
      filename: String(f.filename || "upload"),
      contentType: String(f.contentType || ""),
      base64: String(f.base64),
    };
    const trace = await traceUpload(artifact);
    return json({ action: "upload", trace });
  }

  // ── TIMELINE — the engine's own reach-back ─────────────────────────────────
  // No outside capture archive is consulted. The engine re-runs its own harvest
  // across era buckets, opens every lead itself, and carves the date out of the
  // document — transport header, structured markup, URL path, copyright range.
  if (action === "timeline") {
    const target = String(body.query || "").trim();
    if (!target) return json({ error: "Give the engine a selector to reach back on." }, 400);
    const id = classifySelector(target);
    const report = await deepTimeSweep(target, id.kind, {
      hosts: Array.isArray(body.hosts) ? body.hosts.slice(0, 8).map(String) : [],
      fromYear: typeof body.fromYear === "number" ? body.fromYear : undefined,
      terms: Array.isArray(body.terms) ? body.terms.slice(0, 24).map(String) : [],
      authHeader: req.headers.get("Authorization"),

    });
    return json({ action: "timeline", identity: id, report });
  }





  // ── HISTORY — the second half of the dual sidebar ──────────────────────────
  // INTERCEPT is what the engine is pulling right now. HISTORY is what it has
  // ever pulled on this entity. They are different questions and they get
  // different surfaces; collapsing them was why a repeat lookup looked like a
  // first lookup.
  if (action === "history" || action === "historyDetail" || action === "forget") {
    if (!sb || !userId) return json({ error: "History unavailable for this session" }, 503);

    if (action === "forget") {
      const key = String(body.query || "").trim();
      const del = sb.from("ghost_entity_history").delete().eq("user_id", userId);
      const { error } = key ? await del.eq("entity_key", key) : await del;
      if (error) return json({ error: "Could not clear history", details: error.message }, 500);
      return json({ action: "forget", entity_key: key || null, cleared: true });
    }

    if (action === "historyDetail") {
      const key = String(body.query || "").trim();
      if (!key) return json({ error: "entity key is required" }, 400);
      const { data, error } = await sb
        .from("ghost_entity_history")
        .select("id,entity_key,entity_kind,entity_label,query,scope,leads_found,probed,anomalies,elapsed_ms,results,summary,created_at")
        .eq("user_id", userId)
        .eq("entity_key", key)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: "History read failed", details: error.message }, 500);
      return json({ action: "historyDetail", entity_key: key, runs: data || [] });
    }

    const { data, error } = await sb
      .from("ghost_entity_history")
      .select("id,entity_key,entity_kind,entity_label,query,scope,leads_found,probed,anomalies,elapsed_ms,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return json({ error: "History read failed", details: error.message }, 500);

    // Collapse runs into entities. The rail lists WHO was looked up, not how
    // many times a query string was retyped.
    const byEntity = new Map<string, {
      entity_key: string; entity_kind: string; entity_label: string;
      runs: number; last_seen: string; first_seen: string;
      total_leads: number; total_anomalies: number; queries: string[];
    }>();
    for (const r of data || []) {
      const e = byEntity.get(r.entity_key);
      if (e) {
        e.runs += 1;
        e.first_seen = r.created_at;
        e.total_leads += r.leads_found || 0;
        e.total_anomalies += r.anomalies || 0;
        if (!e.queries.includes(r.query) && e.queries.length < 6) e.queries.push(r.query);
      } else {
        byEntity.set(r.entity_key, {
          entity_key: r.entity_key,
          entity_kind: r.entity_kind,
          entity_label: r.entity_label,
          runs: 1,
          last_seen: r.created_at,
          first_seen: r.created_at,
          total_leads: r.leads_found || 0,
          total_anomalies: r.anomalies || 0,
          queries: [r.query],
        });
      }
    }
    return json({
      action: "history",
      entities: [...byEntity.values()].sort((a, b) => b.last_seen.localeCompare(a.last_seen)),
      runs: data || [],
    });
  }


  // ── LEDGER — Cloud Intelligence fused into the Ghost Engine ────────────────
  // The operator's own correspondence nominates the targets; Ghost probes the
  // infrastructure named inside it. Read through the caller's own token, so a
  // ledger the caller cannot see is a ledger this action cannot probe.
  if (action === "ledger") {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Authentication required" }, 401);
    const bundle = await runGhostLedger(authHeader, {
      windowDays: Number(body.windowDays) || 90,
      channel: body.channel === "gmail" || body.channel === "sms" ? body.channel : null,
      focus: body.focus ? String(body.focus).slice(0, 120) : null,
      maxHosts: Number(body.maxHosts) || 14,
      budgetMs: 60_000,
    });
    if (!bundle) {
      return json({
        action: "ledger",
        empty: true,
        message: "No correspondence in the selected window, or no Google account is connected yet.",
      });
    }
    console.log(
      `[ghost-engine] ledger · scanned=${bundle.scanned} · probed=${bundle.hostsProbed}/${bundle.hostsConsidered} · ${bundle.elapsedMs}ms`,
    );
    return json({ action: "ledger", tier: access.reason, ...bundle });
  }


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

  // ── Sweep / INTERCEPT ──────────────────────────────────────────────────────
  const query = String(body.query ?? "").trim().slice(0, 400);
  const explicit = Array.isArray(body.urls) ? body.urls.slice(0, MAX_PROBE) : [];
  // `limit` is now the PROBE budget, not the harvest aperture. The harvest is
  // uncapped relative to it — every lead the fan-out surfaces is reported.
  const probeBudget = Math.min(Math.max(Number(body.limit) || 48, 1), MAX_PROBE);
  if (!query && explicit.length === 0) return json({ error: "query or urls is required" }, 400);

  const started = Date.now();
  // The buffer is the shelf. Retention is ON unless the operator explicitly
  // turns it off — a metadata hit the operator cannot reopen and read is a
  // card catalog with no library behind it, which was the complaint.
  const capture = body.capture !== false && !!sb && !!userId;
  const noiseFilter = body.noiseFilter !== false;
  const filterFloor = Number.isFinite(Number(body.filterFloor)) ? Number(body.filterFloor) : undefined;

  let targets: string[] = explicit.map(asUrl).filter(Boolean) as string[];
  let mode: "sweep" | "target" = targets.length ? "target" : (body.mode ?? "sweep");
  const identity = classifySelector(query || targets[0] || "");
  // `asUrl` will happily coerce "someone@gmail.com" into a host, which then
  // probes the provider's login page and reports it as intelligence about the
  // person. Only a selector the classifier calls a *domain* is a direct target.
  const direct = query && identity.kind === "domain" ? asUrl(query) : null;


  let harvest: HarvestLead[] = [];
  let legCount = 0;
  let filterReport: DiscoveryReport["filter"] = { applied: false, raw: 0, kept: 0, dropped: 0, reasons: {} };

  if (!targets.length && direct) {
    mode = "target";
    const u = new URL(direct);
    // A single door tells you little; the host's standard surfaces tell you a
    // lot — and the fan-out then tells you who else is talking about the host.
    targets = [...new Set([
      direct,
      `${u.origin}/`,
      `${u.origin}/robots.txt`,
      `${u.origin}/sitemap.xml`,
      `${u.origin}/.well-known/security.txt`,
    ])];
    const wide = await discoverWide(identity, req.headers.get("Authorization"), noiseFilter, filterFloor);
    harvest = wide.leads;
    legCount = wide.legs;
    filterReport = wide.filter;
    const seen = new Set(targets);
    for (const l of harvest) {
      if (targets.length >= probeBudget) break;
      if (seen.has(l.url)) continue;
      seen.add(l.url);
      targets.push(l.url);
    }
  } else if (!targets.length) {
    const wide = await discoverWide(identity, req.headers.get("Authorization"), noiseFilter, filterFloor);
    harvest = wide.leads;
    legCount = wide.legs;
    filterReport = wide.filter;
    targets = harvest.slice(0, probeBudget).map((l) => l.url);
    if (!targets.length) {
      return json({
        query, mode, targets: [], index: null, results: [], suggestions: [],
        harvest: { leads: 0, legs: legCount, probed: 0, unprobed: 0 },
        identity,
        elapsedMs: Date.now() - started,
        error:
          "The fan-out ran but no public target came back. Every discovery leg " +
          "returned empty — usually an upstream engine outage or a selector no " +
          "open index carries. Try a narrower spelling or add a known domain.",
      });
    }
  }

  targets = targets.slice(0, probeBudget);
  const leadByUrl = new Map(harvest.map((l) => [l.url, l]));
  console.log(
    `[ghost-engine] ${mode} · selector=${identity.kind} · legs=${legCount} · ` +
    `harvest=${harvest.length} · probing=${targets.length} · capture=${capture} · caller=${access.reason}`,
  );

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
  // list the front door renders. Three layers merge here: retained bodies,
  // probed shells, and — new — every unprobed lead the harvest surfaced, so the
  // aperture the operator sees equals the aperture the engine actually opened.
  let results: SearchResult[] | undefined;
  let suggestions: string[] | undefined;
  const probedUrls = new Set(records.map((r) => r.url));
  const unprobed = harvest.filter((l) => !probedUrls.has(l.url));

  if (searchMode) {
    const anomalyByEntity = new Map<string, number>();
    for (const a of index.anomalies) {
      if (a.entity_id) anomalyByEntity.set(a.entity_id, (anomalyByEntity.get(a.entity_id) ?? 0) + 1);
    }
    results = records.map((r) =>
      webResult(r, anomalyByEntity.get(r.entity_id) ?? 0, leadByUrl.get(r.url))
    );
    results = [...results, ...unprobed.map(leadResult)];

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

  const elapsedMs = Date.now() - started;
  const harvestSummary = {
    leads: harvest.length,
    legs: legCount,
    probed: records.length,
    unprobed: unprobed.length,
    filter: filterReport,
  };

  // ── History write ──────────────────────────────────────────────────────────
  // A lookup that leaves no trace cannot be compared against tomorrow's. The
  // snapshot is best-effort: a history failure must never fail the search.
  if (sb && userId && query && identity.key) {
    try {
      await sb.from("ghost_entity_history").insert({
        user_id: userId,
        entity_key: identity.key,
        entity_kind: identity.kind,
        entity_label: identity.label || query,
        query,
        scope: searchMode ? scope : "web",
        leads_found: harvest.length,
        probed: records.length,
        anomalies: index.anomalies.length,
        elapsed_ms: elapsedMs,
        results: (results ?? []).slice(0, 120),
        summary: {
          legs: legCount,
          hosts: [...new Set(records.map((r) => r.host).filter(Boolean))].slice(0, 60),
          facets: index.facets.slice(0, 24),
        },
      });
    } catch (e) {
      console.error("[ghost-engine] history write failed:", (e as Error).message);
    }
  }

  return json({
    action: searchMode ? "search" : "sweep",
    scope: searchMode ? scope : undefined,
    query: query || targets[0],
    mode,
    identity,
    harvest: harvestSummary,
    elapsedMs,
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


