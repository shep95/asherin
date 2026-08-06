// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-INTEL — cross-platform social intelligence sweep.
//
// Accepts a set of {platform, handle} targets and returns normalized
// profiles, the association graph, and the capability registry. The registry
// travels with every response so the client renders the true reach of the
// system rather than a hardcoded promise.
//
// Resolution order per target, cheapest first:
//   1. structurally blocked platform  → answer immediately, no network cost
//   2. fresh banked capture           → serve it, spend no scarce quota
//   3. platform parked by backoff     → serve stale bank, else honest refusal
//   4. live probe                     → bank on success, park on throttle
//
// A throttle never erases a capture: the bank is only ever written by a
// substantive result, so a locked window degrades to older data, not none.
// ═══════════════════════════════════════════════════════════════════════════

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import {
  CAPABILITIES,
  probePlatform,
  extractEdges,
  formatSocialBrief,
  normalizeHandle,
  type Platform,
  type SocialProbeResult,
} from "../_shared/socialSubstrate.ts";
import {
  serviceClient,
  loadBank,
  loadCooldowns,
  saveCapture,
  recordThrottle,
  clearCooldown,
  asCached,
  handleKey,
} from "../_shared/socialBank.ts";

const PLATFORMS = new Set<Platform>(["x", "instagram", "linkedin", "facebook"]);
const MAX_TARGETS = 8;
/** Live probes run concurrently but bounded, so one sweep cannot stampede. */
const MAX_CONCURRENT = 4;

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
    const key = `${platform}:${handleKey(handle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ platform, handle });
  }

  if (targets.length === 0) {
    return json({ error: "No valid targets after validation.", rejected }, 400);
  }

  const timeoutMs = Math.min(Math.max(Number(body?.timeoutMs) || 15000, 5000), 25000);
  const refresh = body?.refresh === true;

  const started = Date.now();
  const sb = serviceClient();
  // Both reads are independent, so overlap them rather than paying twice.
  const [bank, cooldowns] = await Promise.all([loadBank(sb, targets), loadCooldowns(sb)]);

  const results: SocialProbeResult[] = new Array(targets.length);
  const live: number[] = [];

  // ── Pass 1: resolve everything that needs no network ─────────────────────
  targets.forEach((t, i) => {
    const cap = CAPABILITIES[t.platform];
    const banked = bank.get(`${t.platform}:${handleKey(t.handle)}`);

    if (!cap.targetProfile) {
      // Structurally blocked. Spend nothing; say so plainly.
      results[i] = {
        platform: t.platform,
        handle: t.handle,
        verdict: "blocked",
        profile: null,
        note: cap.constraint,
        residualPath:
          "Search-engine fragments for this subject are still collected by the Zophiel sweep and folded into the dossier.",
        source: cap.transport,
        fetchedAt: new Date().toISOString(),
        latencyMs: 0,
      };
      return;
    }

    if (banked?.fresh && !refresh) {
      results[i] = asCached(banked);
      return;
    }

    const parked = cooldowns.get(t.platform);
    if (parked) {
      if (banked) {
        // Stale beats nothing, and it is labelled as stale.
        results[i] = asCached(banked);
      } else {
        const mins = Math.max(1, Math.round((Date.parse(parked.until) - Date.now()) / 60000));
        results[i] = {
          platform: t.platform,
          handle: t.handle,
          verdict: "rate_limited",
          profile: null,
          note: `${cap.label} is in backoff after ${parked.consecutiveFailures} consecutive throttled read(s); it reopens in about ${mins} minute(s). ${parked.reason ?? ""}`.trim(),
          residualPath:
            "Nothing is banked for this handle yet. Re-run after the backoff window, or rely on search-engine fragments in the meantime.",
          source: cap.transport,
          fetchedAt: new Date().toISOString(),
          latencyMs: 0,
        };
      }
      return;
    }

    live.push(i);
  });

  // ── Pass 2: bounded-concurrency live probes ──────────────────────────────
  const throttled = new Map<Platform, string>();
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const slot = cursor++;
      if (slot >= live.length) return;
      const i = live[slot];
      const t = targets[i];

      // A sibling target may have just discovered this platform is throttled;
      // honour that immediately instead of taking the same refusal again.
      if (throttled.has(t.platform)) {
        const banked = bank.get(`${t.platform}:${handleKey(t.handle)}`);
        results[i] = banked
          ? asCached(banked)
          : {
              platform: t.platform,
              handle: t.handle,
              verdict: "rate_limited",
              profile: null,
              note: `${CAPABILITIES[t.platform].label} throttled earlier in this same sweep: ${throttled.get(t.platform)}`,
              residualPath: "Re-run after the backoff window.",
              source: CAPABILITIES[t.platform].transport,
              fetchedAt: new Date().toISOString(),
              latencyMs: 0,
            };
        continue;
      }

      const r = await probePlatform(t.platform, t.handle, timeoutMs);

      if (r.verdict === "rate_limited") {
        throttled.set(t.platform, r.note);
        const banked = bank.get(`${t.platform}:${handleKey(t.handle)}`);
        // Prefer a real past capture over a live refusal.
        results[i] = banked ? asCached(banked) : r;
        continue;
      }

      results[i] = r;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, live.length) }, worker));

  // ── Pass 3: persist what we learned ──────────────────────────────────────
  // Writes are deliberately after the results are assembled so storage
  // latency never delays the operator's answer beyond a single await.
  const writes: Promise<void>[] = [];
  const succeeded = new Set<Platform>();
  for (const r of results) {
    if (!r.fromCache && (r.verdict === "ok" || r.verdict === "private")) {
      writes.push(saveCapture(sb, r));
      succeeded.add(r.platform);
    }
  }
  for (const [platform, reason] of throttled) {
    // A platform that also succeeded this sweep is not genuinely throttled.
    if (!succeeded.has(platform)) writes.push(recordThrottle(sb, platform, reason));
  }
  for (const platform of succeeded) writes.push(clearCooldown(sb, platform));
  await Promise.allSettled(writes);

  const edges = extractEdges(results);
  const reached = results.filter((r) => r.verdict === "ok" || r.verdict === "private").length;

  return json({
    sweptAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    requested: targets.length,
    reached,
    servedFromBank: results.filter((r) => r.fromCache).length,
    // Refusals are surfaced at the top level, not buried, so the caller
    // cannot mistake a wall for an empty result set.
    refused: results
      .filter((r) => r.verdict !== "ok" && r.verdict !== "private")
      .map((r) => ({
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
