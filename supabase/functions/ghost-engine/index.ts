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
import { sweepIdentifier } from "../_shared/identifierSweep.ts";
import {
  classifySelector, harvestLeads, type HarvestLead, type SelectorIdentity,
} from "../_shared/ghostHarvest.ts";



// The probe budget and the harvest aperture are two different numbers. The
// harvest is wide — it collects every URL the fan-out surfaces. The probe is
// deep but bounded, because a full metadata extraction costs a round trip.
// Leads beyond the probe budget are still reported; they are simply reported
// as surface intelligence rather than as forensic shells.
const MAX_PROBE = 48;
const CONCURRENCY = 8;
const HARVEST_CAP = 400;
const BUCKET = "ghost-buffer";

type Action =
  | "search" | "searchBuffer" | "sweep" | "buffer" | "content" | "payload"
  | "purge" | "ledger" | "history" | "historyDetail" | "forget" | "origin"
  | "upload" | "timeline" | "identifier";



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
  channel?: LedgerChannel | LedgerChannel[] | null;
  focus?: string | null;
  maxHosts?: number;
  /** action=upload — an artefact the operator holds rather than a link. */
  file?: { filename?: string; contentType?: string; base64?: string };
  /** action=timeline — reach back through the capture archives. */
  fromYear?: number;
  hosts?: string[];
  /** action=timeline — extra keyword terms to carve for inside documents. */
  terms?: string[];
  /** action=identifier — wall-clock budget and harvest aperture. */
  budgetMs?: number;
  maxLeads?: number;
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
  /**
   * The contradictions this shell carries, in full. A count told the operator
   * that *something* was wrong and then made them go hunting for it in another
   * tab; the reason is the finding, so the reason travels with the row.
   */
  anomalies?: { code: string; severity: string; title: string; detail: string }[];
  /** Sum of the severity weights behind `anomalies` — the score's own witness. */
  anomaly_weight?: number;
  /** One line naming what put this row where it is. Ranking, made auditable. */
  rank_basis?: string;
  /**
   * Set when the same URL was found on the shelf AND on the live web in the
   * same run. Two independent layers agreeing is the strongest signal the
   * engine can produce, and it used to be invisible: the buffer copy simply
   * outranked everything and the web copy sat below it as a near-duplicate.
   */
  layers?: ("web" | "buffer")[];
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


/**
 * Fold a retained body into the flat result shape.
 *
 * The shelf used to be scored `1000 + matches`, which is not a score — it is a
 * pin. Every buffered row sorted above every live finding regardless of what
 * either one contained, so a stale 40 KB shell with one incidental match beat a
 * freshly-probed document carrying an author, a device and a contradiction. The
 * two layers now share one 0–100 scale and are ranked on evidence: match
 * density carries the buffer, embedded forensics carry the web, and a URL that
 * appears in BOTH is promoted above either — that is corroboration, and it is
 * the only thing that deserves a pin.
 */
function bufferResult(h: {
  session_id: string; url: string; host: string; source_type: string;
  is_encrypted: boolean; content_bytes: number; matches: number;
  snippets: { text: string }[];
}): SearchResult {
  const kb = Math.max(1, Math.round(h.content_bytes / 1024));
  // Match density, not raw match count: eight hits in a 2 KB note is a document
  // about the selector; eight hits in a 900 KB dump is a mailing-list archive.
  const density = h.matches / Math.max(1, Math.log2(kb + 2));
  const score = Math.min(
    92,
    Math.round(30 + Math.min(h.matches, 40) * 1.2 + Math.min(density, 12) * 2.5 + (h.is_encrypted ? 6 : 0)),
  );
  return {
    id: `buffer:${h.session_id}`,
    source: "buffer",
    title: h.host || h.url,
    url: h.url,
    host: h.host,
    snippet: h.snippets[0]?.text || `${h.matches} match${h.matches === 1 ? "" : "es"} in retained body`,
    badges: [
      "retained body",
      `${h.matches} match${h.matches === 1 ? "" : "es"}`,
      h.source_type.split(";")[0],
      h.is_encrypted ? "encrypted" : "",
      `${kb} KB`,
    ].filter(Boolean),
    score,
    rank_basis:
      `retained body · ${h.matches} match${h.matches === 1 ? "" : "es"} at ${density.toFixed(1)} per KB-decade`,
    layers: ["buffer"],
    session_id: h.session_id,
  };
}

/** What each severity is worth to the rank, and how loudly it is stated. */
const ANOMALY_WEIGHT: Record<string, number> = { critical: 26, high: 16, medium: 8, low: 3 };

/**
 * Fold a metadata shell into the flat result shape the search list renders.
 * When the harvest supplied a title/snippet for this URL, that human-readable
 * context is preferred for the headline and appended to the forensic facts —
 * a bare hostname told the operator nothing about *why* the hit matched.
 *
 * Anomalies are no longer a tally. "3 anomalies" is a number an operator has to
 * go and re-derive somewhere else; a contradicted creation timestamp, a device
 * ID that does not match the declared producer and a coordinate inside a
 * country the host claims not to serve are three *different* findings with
 * three different weights. Each one travels with the row, stated in the words
 * the detector used, and its severity — not its existence — sets the rank.
 */
function webResult(
  r: GhostRecord,
  anomalies: { severity: string; code: string; title: string; detail: string }[],
  lead?: HarvestLead,
): SearchResult {
  const weight = anomalies.reduce((n, a) => n + (ANOMALY_WEIGHT[a.severity] ?? 3), 0);
  const worst = anomalies.slice().sort(
    (a, b) => (ANOMALY_WEIGHT[b.severity] ?? 0) - (ANOMALY_WEIGHT[a.severity] ?? 0),
  )[0];

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
    // The badge names the finding, not the count.
    worst ? `anomaly: ${worst.title}` : "",
    anomalies.length > 1 ? `+${anomalies.length - 1} more anomal${anomalies.length === 2 ? "y" : "ies"}` : "",
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

  // Rank by evidentiary richness, on the same 0–100 scale the shelf uses so the
  // two layers are actually comparable.
  const raw =
    (r.status && r.status < 400 ? 14 : 0) +
    (r.author ? 20 : 0) + (r.device_id ? 17 : 0) + (r.software ? 8 : 0) +
    (r.geo_lat != null ? 17 : 0) + (r.created_at ? 7 : 0) +
    weight + Math.min(facts.length, 6) * 2 +
    Math.min(lead?.corroboration ?? 0, 8) * 1.5;
  const score = Math.max(4, Math.min(96, Math.round(raw)));

  const basis = [
    r.author ? "authorship carved" : null,
    r.device_id ? "device identified" : null,
    r.geo_lat != null ? "coordinate embedded" : null,
    weight ? `${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} (weight ${weight})` : null,
    (lead?.corroboration ?? 0) > 1 ? `${lead?.corroboration} legs agreed` : null,
  ].filter(Boolean);

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
    anomalies: anomalies.map((a) => ({
      code: a.code, severity: a.severity, title: a.title, detail: a.detail,
    })),
    anomaly_weight: weight,
    rank_basis: basis.length ? basis.join(" · ") : "reachable shell, nothing embedded",
    layers: ["web"],
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

  // ── IDENTIFIER — "everywhere this address or number actually appears" ──────
  // INTERCEPT reports what the index offered. IDENTIFIER opens each candidate
  // and demands the string be on the page before it counts as a sighting, then
  // folds sightings into per-host surfaces with their own dated windows.
  if (action === "identifier") {
    const target = String(body.query || "").trim();
    if (!target) return json({ error: "Give the engine an email address or a phone number." }, 400);
    const report = await sweepIdentifier(target, {
      authHeader: req.headers.get("Authorization"),
      budgetMs: Math.min(Math.max(Number(body.budgetMs) || 100_000, 15_000), 170_000),
      openCap: Math.min(Math.max(Number(body.limit) || 40, 4), 80),
      maxLeads: Math.min(Math.max(Number(body.maxLeads) || 220, 40), 400),
    });

    // A sweep is an entity lookup, so it belongs on the same history rail the
    // intercept writes to — otherwise the record of who was checked is split
    // across two ledgers and neither one is complete.
    if (sb && userId && report.identity.kind !== "freeform") {
      try {
        await sb.from("ghost_entity_history").insert({
          user_id: userId,
          entity_key: report.identity.key,
          entity_kind: `sweep_${report.identity.kind}`,
          entity_label: report.identity.label,
          query: target,
          scope: "identifier_sweep",
          leads_found: report.leadsHarvested,
          probed: report.opened,
          anomalies: report.surfaces.filter(
            (s) => s.surfaceClass === "breach-index" || s.surfaceClass === "paste",
          ).length,
          elapsed_ms: report.elapsedMs,
          results: {
            surfaces: report.surfaces.slice(0, 30).map((s) => ({
              host: s.host, class: s.surfaceClass, sightings: s.sightings.length,
              firstSeen: s.firstSeen, lastSeen: s.lastSeen, bestGrade: s.bestGrade,
            })),
          },
          summary: {
            confirmed: report.confirmed,
            surfaces: report.surfaces.length,
            firstSeen: report.firstSeen,
            lastSeen: report.lastSeen,
            byClass: report.byClass,
            notes: report.notes.slice(0, 6),
          },
        });
      } catch (e) {
        console.warn("[ghost-engine] sweep history insert skipped:", (e as Error).message);
      }
    }

    return json({ action: "identifier", report });
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
      // No channel means every channel. Mail and messages were the only two the
      // fusion ever read, which quietly excluded Drive shares, calendar invites
      // and contact records that live in the very same ledger.
      channel: (Array.isArray(body.channel) ? body.channel : body.channel ? [body.channel] : [])
        .filter(isLedgerChannel),
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
  const probeBudget = Math.min(Math.max(Number(body.limit) || 32, 1), MAX_PROBE);
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

  // ── Probe + shelve, streamed ───────────────────────────────────────────────
  // The prior shape extracted every target first and only *then* wrote the
  // buffer. That kept up to `probeBudget` payloads (raw bytes plus a decoded
  // text twin) resident at once — roughly 96 × ~2.5 MB — which walks straight
  // through the worker's memory ceiling and returns 546 WORKER_RESOURCE_LIMIT.
  // Now each payload is uploaded and released inside the worker that produced
  // it, so peak residency is bounded by concurrency, not by the aperture.
  let buffered = 0;
  const bufferErrors: string[] = [];
  const expiresAt = ttlToExpiry(body.ttlMinutes);
  let retainedBytes = 0;
  const RETAIN_BUDGET = 24 * 1024 * 1024;   // total bytes shelved per sweep

  const records = (await pool(targets, CONCURRENCY, async (t: string) => {
    const rec = (await extractGhostRecord(t, capture)) as GhostRecord;
    const p = rec.payload;
    delete rec.payload;                      // never returned inline
    if (!p || !p.bytes.length) return rec;
    if (!(capture && sb && userId)) return rec;
    if (retainedBytes + p.bytes.length > RETAIN_BUDGET) return rec;
    retainedBytes += p.bytes.length;
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
      if (error) bufferErrors.push(`${p.host}: ${error.message}`);
      else buffered++;
    } catch (e) {
      bufferErrors.push(`${p.host}: ${(e as Error).message}`);
    }
    return rec;
  })) as GhostRecord[];


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
    const anomalyByEntity = new Map<string, typeof index.anomalies>();
    for (const a of index.anomalies) {
      if (!a.entity_id) continue;
      const bucket = anomalyByEntity.get(a.entity_id);
      if (bucket) bucket.push(a);
      else anomalyByEntity.set(a.entity_id, [a]);
    }
    results = records.map((r) =>
      webResult(r, anomalyByEntity.get(r.entity_id) ?? [], leadByUrl.get(r.url))
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

    // ── Cross-layer corroboration ─────────────────────────────────────────
    // Two layers reaching the same URL independently — the shelf remembers it,
    // the live probe just found it again — is the single strongest confirmation
    // this engine produces. It used to be *invisible*: the buffer row was pinned
    // to the top and the web row sat somewhere below it, and the operator read
    // them as two near-duplicate lines rather than as one corroborated finding.
    // They are now merged into one row carrying both layers, both bodies of
    // evidence, and a rank that reflects the agreement.
    const byUrl = new Map<string, SearchResult>();
    const merged: SearchResult[] = [];
    for (const r of results) {
      const key = r.url.replace(/[#?].*$/, "").replace(/\/+$/, "");
      const prior = byUrl.get(key);
      if (!prior) { byUrl.set(key, r); merged.push(r); continue; }
      // A lead is a promise of a page; a probed shell or a retained body is the
      // page. A lead never survives a merge against either.
      const keep = prior.source === "lead" ? r : r.source === "lead" ? prior : prior;
      const drop = keep === prior ? r : prior;
      if (drop.source !== "lead" && keep.source !== drop.source) {
        keep.layers = [...new Set([...(keep.layers ?? []), ...(drop.layers ?? [])])] as ("web" | "buffer")[];
        keep.badges = [...new Set([...keep.badges, ...drop.badges])];
        // Corroboration is a multiplier on the stronger of the two reads, not a
        // sum — the same document seen twice is one document, seen well.
        keep.score = Math.min(100, Math.round(Math.max(keep.score, drop.score) * 1.35) + 6);
        keep.rank_basis = `corroborated across live probe and retained body · ${keep.rank_basis ?? ""}`.trim();
        keep.session_id = keep.session_id ?? drop.session_id;
        keep.entity_id = keep.entity_id ?? drop.entity_id;
        if (!keep.anomalies?.length && drop.anomalies?.length) keep.anomalies = drop.anomalies;
      }
      if (keep !== prior) {
        merged[merged.indexOf(prior)] = keep;
        byUrl.set(key, keep);
      }
    }
    results = merged;

    results.sort((a, b) =>
      b.score - a.score ||
      (b.layers?.length ?? 1) - (a.layers?.length ?? 1) ||
      (b.anomaly_weight ?? 0) - (a.anomaly_weight ?? 0)
    );
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


