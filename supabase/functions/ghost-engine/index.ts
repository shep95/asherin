// ─────────────────────────────────────────────────────────────────────────────
// ASHERIN GHOST ENGINE — metadata-only search engine (Pro tier)
//
// It touches everything and reads nothing: discovery, shell extraction, and the
// three-index build all happen here. Nothing but the metadata shell is ever
// returned to the client, and nothing is persisted server-side.
//
// Access: Asherin Pro ($399/mo monthly + 6-month term) and admin.
// ─────────────────────────────────────────────────────────────────────────────

import { getCorsHeaders } from "../_shared/cors.ts";
import { extractGhostRecord, isPublicHttpUrl, pool, type GhostRecord } from "../_shared/ghostMetadata.ts";
import { buildIndex } from "../_shared/ghostIndex.ts";
import { resolveAxrlenAccess } from "../_shared/proTierGate.ts";

const MAX_TARGETS = 24;
const CONCURRENCY = 6;

interface GhostRequest {
  query?: string;
  urls?: string[];
  limit?: number;
  /** sweep = discover targets from the open index; target = probe given URLs. */
  mode?: "sweep" | "target";
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

  const query = String(body.query ?? "").trim().slice(0, 400);
  const explicit = Array.isArray(body.urls) ? body.urls.slice(0, MAX_TARGETS) : [];
  const limit = Math.min(Math.max(Number(body.limit) || 12, 1), MAX_TARGETS);
  if (!query && explicit.length === 0) return json({ error: "query or urls is required" }, 400);

  const started = Date.now();

  // ── Target resolution ──────────────────────────────────────────────────────
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
  console.log(`[ghost-engine] ${mode} · ${targets.length} targets · caller=${access.reason}`);

  // ── Extraction (bounded concurrency, per-target failures are data) ─────────
  const records = (await pool(targets, CONCURRENCY, extractGhostRecord)) as GhostRecord[];
  const index = buildIndex(records);

  return json({
    query: query || targets[0],
    mode,
    elapsedMs: Date.now() - started,
    tier: access.reason,
    index,
  });
});
