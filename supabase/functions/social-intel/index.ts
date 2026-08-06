// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-INTEL — cross-platform social intelligence sweep.
//
// Accepts a set of {platform, handle} targets, probes each concurrently, and
// returns normalized profiles, the association graph, and the capability
// registry. The registry travels with every response so the client renders
// the true reach of the system rather than a hardcoded promise.
// ═══════════════════════════════════════════════════════════════════════════

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import {
  CAPABILITIES,
  probeAll,
  extractEdges,
  formatSocialBrief,
  normalizeHandle,
  type Platform,
} from "../_shared/socialSubstrate.ts";

const PLATFORMS = new Set<Platform>(["x", "instagram", "linkedin", "facebook"]);
const MAX_TARGETS = 8;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    await requireUser(req);
  } catch (e) {
    return authErrorResponse(e, cors);
  }

  // A capability probe needs no body — the client fetches the registry to
  // build its UI before the operator has named a target.
  if (req.method === "GET") return json({ capabilities: CAPABILITIES });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  if (body?.mode === "capabilities") return json({ capabilities: CAPABILITIES });

  // ── Validate targets ─────────────────────────────────────────────────────
  const raw = Array.isArray(body?.targets) ? body.targets : [];
  if (raw.length === 0) {
    return json({ error: "Supply at least one target as { platform, handle }." }, 400);
  }
  if (raw.length > MAX_TARGETS) {
    return json({ error: `At most ${MAX_TARGETS} targets per sweep; received ${raw.length}.` }, 400);
  }

  const targets: Array<{ platform: Platform; handle: string }> = [];
  const rejected: Array<{ input: unknown; reason: string }> = [];
  const seen = new Set<string>();

  for (const t of raw) {
    const platform = String(t?.platform ?? "").toLowerCase() as Platform;
    if (!PLATFORMS.has(platform)) {
      rejected.push({ input: t, reason: `Unknown platform "${String(t?.platform).slice(0, 30)}".` });
      continue;
    }
    const handleRaw = String(t?.handle ?? "");
    if (handleRaw.length > 300) {
      rejected.push({ input: t, reason: "Handle exceeds 300 characters." });
      continue;
    }
    const handle = normalizeHandle(platform, handleRaw);
    if (!handle) {
      rejected.push({ input: t, reason: `"${handleRaw.slice(0, 40)}" is not a valid ${platform} handle.` });
      continue;
    }
    // Dedupe so a repeated target cannot multiply the upstream cost.
    const key = `${platform}:${handle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ platform, handle });
  }

  if (targets.length === 0) {
    return json({ error: "No valid targets after validation.", rejected }, 400);
  }

  const timeoutMs = Math.min(Math.max(Number(body?.timeoutMs) || 15000, 5000), 25000);

  const started = Date.now();
  const results = await probeAll(targets, timeoutMs);
  const edges = extractEdges(results);

  const reached = results.filter((r) => r.verdict === "ok" || r.verdict === "private").length;

  return json({
    sweptAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    requested: targets.length,
    reached,
    // The refusals are surfaced at the top level, not buried, so the caller
    // cannot mistake a wall for an empty result set.
    refused: results.filter((r) => r.verdict !== "ok" && r.verdict !== "private").map((r) => ({
      platform: r.platform,
      handle: r.handle,
      verdict: r.verdict,
      note: r.note,
      residualPath: r.residualPath,
    })),
    rejected,
    results,
    edges,
    brief: formatSocialBrief(results),
    capabilities: CAPABILITIES,
  });
});
