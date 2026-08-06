// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL CHAT BRIDGE — folds social intelligence into a chat turn.
//
// Calls the substrate in-process rather than round-tripping through the
// social-intel endpoint: the bridge already runs inside the edge runtime, so
// an HTTP hop would add latency and a second auth check for no benefit.
//
// The bridge is deliberately conservative about when it fires. A social sweep
// costs a scarce Instagram read, so it only runs when the turn names a
// platform or pastes a profile link — never on the mere presence of an "@".
// ═══════════════════════════════════════════════════════════════════════════

import {
  CAPABILITIES,
  probePlatform,
  extractEdges,
  formatSocialBrief,
  normalizeHandle,
  type Platform,
  type SocialProbeResult,
} from "./socialSubstrate.ts";
import {
  serviceClient,
  loadBank,
  loadCooldowns,
  saveCapture,
  recordThrottle,
  clearCooldown,
  asCached,
  handleKey,
} from "./socialBank.ts";

export interface SocialTarget {
  platform: Platform;
  handle: string;
}

export interface SocialBundle {
  results: SocialProbeResult[];
  edges: ReturnType<typeof extractEdges>;
  elapsedMs: number;
}

const PLATFORM_WORDS: Array<[RegExp, Platform]> = [
  [/\b(?:twitter|tweets?|x\.com)\b/i, "x"],
  [/\b(?:instagram|insta|ig)\b/i, "instagram"],
  [/\b(?:linkedin)\b/i, "linkedin"],
  [/\b(?:facebook|fb)\b/i, "facebook"],
];

const URL_PATTERNS: Array<[RegExp, Platform]> = [
  [/(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})/gi, "x"],
  [/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/gi, "instagram"],
  [/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9\-]{3,100})/gi, "linkedin"],
  [/(?:https?:\/\/)?(?:www\.)?facebook\.com\/([A-Za-z0-9.]{3,60})/gi, "facebook"],
];

/**
 * Extract social targets from a turn.
 *
 * Two routes only: a pasted profile URL (unambiguous), or a bare @handle in a
 * turn that also names a platform (disambiguated by that mention). A lone
 * "@someone" with no platform context is skipped — guessing the platform
 * would spend a scarce read on a coin flip.
 */
export function extractSocialTargets(text: string): SocialTarget[] {
  const out: SocialTarget[] = [];
  const seen = new Set<string>();

  const push = (platform: Platform, raw: string) => {
    const handle = normalizeHandle(platform, raw);
    if (!handle) return;
    const key = `${platform}:${handleKey(handle)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ platform, handle });
  };

  for (const [re, platform] of URL_PATTERNS) {
    // Each regex is module-level and global, so lastIndex must be reset or a
    // second call would resume mid-string and silently miss early matches.
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) push(platform, m[1]);
  }

  const named = PLATFORM_WORDS.filter(([re]) => re.test(text)).map(([, p]) => p);
  if (named.length) {
    for (const m of text.matchAll(/@([A-Za-z0-9._]{2,30})\b/g)) {
      for (const platform of named) push(platform, m[1]);
    }
  }

  return out.slice(0, 6);
}

/** True when the turn is asking about someone's social presence. */
export function needsSocialLayer(text: string): boolean {
  if (extractSocialTargets(text).length > 0) return true;
  return (
    /\b(?:twitter|instagram|linkedin|facebook)\b/i.test(text) &&
    /\b(?:profile|posts?|account|followers?|bio|activity|presence|who is|look ?up|check|find|social)\b/i.test(text)
  );
}

/**
 * Run the sweep. Mirrors the endpoint's resolution order — blocked platforms
 * answer free, the bank is preferred over a scarce live read, and a throttle
 * degrades to stale data rather than nothing. Never throws.
 */
export async function runSocialIntel(targets: SocialTarget[], timeoutMs = 12000): Promise<SocialBundle | null> {
  if (targets.length === 0) return null;
  const started = Date.now();

  try {
    const sb = serviceClient();
    const [bank, cooldowns] = await Promise.all([loadBank(sb, targets), loadCooldowns(sb)]);

    const results: SocialProbeResult[] = [];
    const throttled = new Map<Platform, string>();
    const succeeded = new Set<Platform>();
    const writes: Promise<void>[] = [];

    for (const t of targets) {
      const cap = CAPABILITIES[t.platform];
      const banked = bank.get(`${t.platform}:${handleKey(t.handle)}`);

      if (!cap.targetProfile) {
        results.push({
          platform: t.platform,
          handle: t.handle,
          verdict: "blocked",
          profile: null,
          note: cap.constraint,
          residualPath: "Search-engine fragments remain available through the Zophiel sweep.",
          source: cap.transport,
          fetchedAt: new Date().toISOString(),
          latencyMs: 0,
        });
        continue;
      }

      if (banked?.fresh || throttled.has(t.platform)) {
        if (banked) {
          results.push(asCached(banked));
          continue;
        }
      }

      if (cooldowns.has(t.platform) || throttled.has(t.platform)) {
        const reason = throttled.get(t.platform) ?? cooldowns.get(t.platform)?.reason ?? "source in backoff";
        results.push({
          platform: t.platform,
          handle: t.handle,
          verdict: "rate_limited",
          profile: null,
          note: `${cap.label} is in backoff: ${reason}`,
          residualPath: "Nothing banked for this handle yet; retry after the window reopens.",
          source: cap.transport,
          fetchedAt: new Date().toISOString(),
          latencyMs: 0,
        });
        continue;
      }

      const r = await probePlatform(t.platform, t.handle, timeoutMs);
      if (r.verdict === "rate_limited") {
        throttled.set(t.platform, r.note);
        results.push(banked ? asCached(banked) : r);
        continue;
      }
      if (r.verdict === "ok" || r.verdict === "private") {
        succeeded.add(r.platform);
        writes.push(saveCapture(sb, r));
      }
      results.push(r);
    }

    for (const [platform, reason] of throttled) {
      if (!succeeded.has(platform)) writes.push(recordThrottle(sb, platform, reason));
    }
    for (const platform of succeeded) writes.push(clearCooldown(sb, platform));
    await Promise.allSettled(writes);

    return { results, edges: extractEdges(results), elapsedMs: Date.now() - started };
  } catch (e) {
    console.error("[social-bridge] sweep failed:", (e as Error).message);
    return null;
  }
}

/**
 * Render the sweep for the model. Refusals are included on purpose: without
 * them the model sees an absent platform and infers the subject has no
 * account there, which is a fabrication. Stating the wall keeps the model
 * honest about the limits of what was actually observed.
 */
export function formatSocialContext(bundle: SocialBundle | null): string {
  if (!bundle || bundle.results.length === 0) return "";

  const reached = bundle.results.filter((r) => r.verdict === "ok" || r.verdict === "private").length;
  const cached = bundle.results.filter((r) => r.fromCache).length;

  return [
    "\n\n## LIVE SOCIAL INTELLIGENCE SWEEP",
    `Probed ${bundle.results.length} target(s); ${reached} returned data${cached ? ` (${cached} served from the intelligence bank)` : ""}.`,
    "",
    formatSocialBrief(bundle.results),
    "",
    "RULES FOR USING THIS BLOCK:",
    "- Treat these figures as observed fact and prefer them over training data.",
    "- A platform marked BLOCKED means we could not read it, NOT that the subject has no account there. Never infer absence from a block.",
    "- Data marked as served from the bank reflects the last successful capture; say so if the recency matters to the answer.",
    "- Do not invent followers, posts, or engagement numbers that are not listed above.",
  ].join("\n");
}
