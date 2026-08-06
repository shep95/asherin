// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL SUBSTRATE — normalized cross-platform social intelligence.
//
// Every capability declared here was probed live from Supabase edge egress
// before it was written down. The registry is the contract: the UI renders
// from it, so the product cannot advertise a reach it does not have. A
// platform that blocks us says so, with the reason and the residual path —
// it never degrades into an empty panel that reads as "no data found".
//
// Measured 2026-08-06 from datacenter egress:
//   x          firecrawl profile parser  → 200, structured profile + posts
//   instagram  web_profile_info          → 200, 460 KB, profile + 12 posts
//   linkedin   public profile            → 999 (anti-bot challenge)
//   facebook   public page               → 400 (rejects unauthenticated)
//   x          cdn.syndication timeline  → 200 but zero-length; endpoint dead
// ═══════════════════════════════════════════════════════════════════════════

export type Platform = "x" | "instagram" | "linkedin" | "facebook";

/** Outcome of a single platform probe. `blocked` is a first-class result. */
export type Verdict = "ok" | "private" | "not_found" | "blocked" | "rate_limited" | "error";

export interface SocialPost {
  id: string;
  url: string | null;
  text: string;
  postedAt: string | null;
  likes: number | null;
  comments: number | null;
  /** Reposts / retweets — amplification rather than direct engagement. */
  shares?: number | null;

  /** Handles credited on the post — tags, coauthors, @mentions in the body. */
  linkedHandles: string[];
  /** Platform-supplied image description. Real alt text, not a guess. */
  imageDescription?: string;
}

export interface SocialProfile {
  platform: Platform;
  handle: string;
  url: string;
  displayName: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  verified: boolean | null;
  isPrivate: boolean;
  category: string | null;
  externalUrl: string | null;
  avatarUrl: string | null;
  /** Contact details the account owner published deliberately. */
  publicEmail: string | null;
  publicPhone: string | null;
  postCount: number | null;
  posts: SocialPost[];
}

export interface SocialProbeResult {
  platform: Platform;
  handle: string;
  verdict: Verdict;
  profile: SocialProfile | null;
  /** Operator-facing explanation. Always populated when verdict !== "ok". */
  note: string;
  /** What the operator can still do when this platform refuses us. */
  residualPath: string | null;
  source: string;
  fetchedAt: string;
  latencyMs: number;
  /** True when served from the bank rather than a live fetch. */
  fromCache?: boolean;
  /** Age of the banked capture, in hours. Present only when fromCache. */
  cacheAgeHours?: number;
}


// ── Capability registry ────────────────────────────────────────────────────
// Single source of truth. Anything not listed as `true` is not claimed.
//
// `reliability` is the distinction that matters operationally. A capability
// can be real and still be scarce: Instagram genuinely returns rich data, but
// only through an endpoint throttled by egress IP reputation, so it cannot be
// promised on demand. Grading it separately from "can we do this at all"
// stops the product from advertising an opportunistic read as a guaranteed
// one — the exact failure mode of claiming reach we do not have.

export type Reliability = "reliable" | "opportunistic" | "blocked";

export interface PlatformCapability {
  platform: Platform;
  label: string;
  reliability: Reliability;
  /** Public data about an arbitrary target — the OSINT surface. */
  targetProfile: boolean;
  targetPosts: boolean;
  targetRelationships: boolean;
  /** The operator's own private data — requires per-user OAuth. */
  selfMessages: boolean;
  selfTimeline: boolean;
  /** Why the unavailable parts are unavailable. */
  constraint: string;
  transport: string;
  /** Plain-language reliability caveat, shown next to results. */
  reliabilityNote: string;
}

export const CAPABILITIES: Record<Platform, PlatformCapability> = {
  x: {
    platform: "x",
    label: "X / Twitter",
    reliability: "reliable",
    targetProfile: true,
    targetPosts: true,
    targetRelationships: true,
    selfMessages: false,
    selfTimeline: false,
    constraint:
      "Public posts and profile are readable. Direct messages require X's paid API tier plus a per-user OAuth app; the managed X connector is app-only and read-only, so it can never reach DMs.",
    transport: "Firecrawl structured profile parser",
    reliabilityNote:
      "Served through a rotating proxy pool, so reads succeed consistently and are not tied to our egress IP.",
  },
  instagram: {
    platform: "instagram",
    label: "Instagram",
    reliability: "opportunistic",
    targetProfile: true,
    targetPosts: true,
    targetRelationships: true,
    selfMessages: false,
    selfTimeline: false,
    constraint:
      "Public profile, recent posts, tagged accounts and coauthors are readable when the window is open. Direct messages are not exposed by Meta to any third party. Private accounts yield metadata only.",
    transport: "Instagram public web profile endpoint (direct, unproxied)",
    reliabilityNote:
      "Instagram throttles this endpoint by egress IP, and no proxy vendor will carry the domain. Reads succeed in bursts and then lock out for a period. Successful captures are banked and reused so a locked window never costs you data you already earned.",
  },
  linkedin: {
    platform: "linkedin",
    label: "LinkedIn",
    reliability: "blocked",
    targetProfile: false,
    targetPosts: false,
    targetRelationships: false,
    selfMessages: false,
    selfTimeline: false,
    constraint:
      "LinkedIn answers unauthenticated requests with an anti-bot challenge (HTTP 999) and Firecrawl refuses the domain by policy. Messaging is partner-gated. Target data is reachable only as search-engine fragments.",
    transport: "none — search-engine fragments only",
    reliabilityNote: "No direct read path exists. Do not expect profile data from this platform.",
  },
  facebook: {
    platform: "facebook",
    label: "Facebook",
    reliability: "blocked",
    targetProfile: false,
    targetPosts: false,
    targetRelationships: false,
    selfMessages: false,
    selfTimeline: false,
    constraint:
      "Meta rejects unauthenticated page reads (HTTP 400) and Firecrawl refuses the domain by policy. Graph API access to non-owned pages requires an approved Business review.",
    transport: "none — search-engine fragments only",
    reliabilityNote: "No direct read path exists. Do not expect profile data from this platform.",

  },
};

// ── Handle normalization ───────────────────────────────────────────────────
// Input arrives as URLs, @handles, or bare names. We never fetch a
// caller-supplied URL: we extract a handle, validate it against the
// platform's own charset, then rebuild the URL from a fixed host. That
// closes SSRF at the parser rather than trusting a blocklist downstream.

const HANDLE_RULES: Record<Platform, { re: RegExp; host: string; path: (h: string) => string }> = {
  x: { re: /^[A-Za-z0-9_]{1,15}$/, host: "x.com", path: (h) => `https://x.com/${h}` },
  instagram: {
    re: /^[A-Za-z0-9._]{1,30}$/,
    host: "instagram.com",
    path: (h) => `https://www.instagram.com/${h}/`,
  },
  linkedin: {
    re: /^[A-Za-z0-9\-]{3,100}$/,
    host: "linkedin.com",
    path: (h) => `https://www.linkedin.com/in/${h}/`,
  },
  facebook: {
    re: /^[A-Za-z0-9.]{3,60}$/,
    host: "facebook.com",
    path: (h) => `https://www.facebook.com/${h}`,
  },
};

/** Reserved paths that are site chrome, not accounts. */
const RESERVED = new Set([
  "home", "explore", "search", "about", "login", "signup", "settings", "help",
  "privacy", "terms", "i", "intent", "share", "notifications", "messages",
  "accounts", "directory", "p", "reel", "reels", "stories", "feed", "company",
  "jobs", "pages", "groups", "watch", "marketplace", "events",
]);

export function normalizeHandle(platform: Platform, raw: string): string | null {
  if (!raw) return null;
  let h = raw.trim();

  // Pull the handle out of a URL if one was pasted.
  if (/^https?:\/\//i.test(h) || h.includes("/")) {
    const withScheme = /^https?:\/\//i.test(h) ? h : `https://${h}`;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      return null;
    }
    // The pasted host must belong to the platform being asked for, otherwise
    // a link to an attacker-controlled domain could steer the fetch.
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const expected = HANDLE_RULES[platform].host;
    if (host !== expected && !host.endsWith(`.${expected}`)) return null;

    const segments = parsed.pathname.split("/").filter(Boolean);
    // LinkedIn nests the handle under /in/ or /company/.
    h = platform === "linkedin" ? (segments[1] ?? segments[0] ?? "") : (segments[0] ?? "");
  }

  h = h.replace(/^@+/, "").trim();
  // Strip a trailing query or fragment left over from a partial paste.
  h = h.split(/[?#]/)[0];
  if (!h) return null;
  if (RESERVED.has(h.toLowerCase())) return null;
  if (!HANDLE_RULES[platform].re.test(h)) return null;
  return h;
}

export function profileUrl(platform: Platform, handle: string): string {
  return HANDLE_RULES[platform].path(handle);
}

// ── Shared helpers ─────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function mentionsIn(text: string): string[] {
  // Non-global exec in a loop would hang; a global regex used once here is
  // safe because it is constructed fresh on every call rather than shared.
  const out = new Set<string>();
  for (const m of text.matchAll(/@([A-Za-z0-9._]{2,30})\b/g)) out.add(m[1].toLowerCase());
  return [...out];
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function blocked(platform: Platform, handle: string, note: string, residual: string, started: number): SocialProbeResult {
  return {
    platform,
    handle,
    verdict: "blocked",
    profile: null,
    note,
    residualPath: residual,
    source: CAPABILITIES[platform].transport,
    fetchedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  };
}

// ── Instagram adapter ──────────────────────────────────────────────────────

const IG_APP_ID = "936619743392459";

async function fetchInstagram(handle: string, timeoutMs: number): Promise<SocialProbeResult> {
  const started = Date.now();
  const base = {
    platform: "instagram" as const,
    handle,
    source: CAPABILITIES.instagram.transport,
    fetchedAt: new Date().toISOString(),
  };
  const done = (r: Omit<SocialProbeResult, keyof typeof base | "latencyMs">) =>
    ({ ...base, ...r, latencyMs: Date.now() - started }) as SocialProbeResult;

  let res: Response;
  try {
    res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers: { "User-Agent": UA, "X-IG-App-ID": IG_APP_ID, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) },
    );
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError";
    return done({
      verdict: timedOut ? "rate_limited" : "error",
      profile: null,
      note: timedOut
        ? `Instagram did not answer within ${Math.round(timeoutMs / 1000)}s — usually soft throttling of the request window.`
        : `Instagram transport failure: ${(e as Error).message}`,
      residualPath: "Retry on the next sweep; the endpoint recovers without intervention.",
    });
  }

  if (res.status === 404) {
    return done({ verdict: "not_found", profile: null, note: `No Instagram account exists at @${handle}.`, residualPath: "Confirm the spelling, or run a handle hunt to find variants." });
  }
  // 401/403 here means the anonymous app-id window was revoked, not that the
  // account is private — private accounts still return 200 with is_private.
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    return done({
      verdict: "rate_limited",
      profile: null,
      note: `Instagram refused the anonymous read (HTTP ${res.status}). The public endpoint throttles by egress IP, not by account.`,
      residualPath: "Back off and retry; results already in the vault remain valid.",
    });
  }
  if (!res.ok) {
    return done({ verdict: "error", profile: null, note: `Instagram returned HTTP ${res.status}.`, residualPath: "Retry on the next sweep." });
  }

  let user: any;
  try {
    user = (await res.json())?.data?.user;
  } catch {
    return done({ verdict: "error", profile: null, note: "Instagram returned a non-JSON body — the anonymous endpoint was likely served a challenge page.", residualPath: "Retry on the next sweep." });
  }
  if (!user) {
    return done({ verdict: "not_found", profile: null, note: `Instagram returned no user object for @${handle}.`, residualPath: "Confirm the spelling, or run a handle hunt to find variants." });
  }

  const isPrivate = Boolean(user.is_private);
  const posts: SocialPost[] = [];
  for (const edge of user.edge_owner_to_timeline_media?.edges ?? []) {
    const n = edge?.node;
    if (!n?.id) continue;
    const text: string = n.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
    const tagged: string[] = [
      ...(n.edge_media_to_tagged_user?.edges ?? []).map((t: any) => t?.node?.user?.username),
      ...(n.coauthor_producers ?? []).map((c: any) => c?.username),
      ...mentionsIn(text),
    ]
      .filter((v: unknown): v is string => typeof v === "string" && v.length > 0)
      .map((v) => v.toLowerCase());

    posts.push({
      id: String(n.id),
      url: n.shortcode ? `https://www.instagram.com/p/${n.shortcode}/` : null,
      text,
      postedAt: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null,
      likes: num(n.edge_media_preview_like?.count ?? n.edge_liked_by?.count),
      comments: num(n.edge_media_to_comment?.count),
      linkedHandles: [...new Set(tagged)],
      imageDescription: n.accessibility_caption || undefined,
    });
  }

  const profile: SocialProfile = {
    platform: "instagram",
    handle,
    url: profileUrl("instagram", handle),
    displayName: user.full_name || null,
    bio: user.biography || null,
    followers: num(user.edge_followed_by?.count),
    following: num(user.edge_follow?.count),
    verified: Boolean(user.is_verified),
    isPrivate,
    category: user.category_name || null,
    externalUrl: user.external_url || null,
    avatarUrl: user.profile_pic_url_hd || user.profile_pic_url || null,
    publicEmail: user.business_email || null,
    publicPhone: user.business_phone_number || null,
    postCount: num(user.edge_owner_to_timeline_media?.count),
    posts,
  };

  return done({
    verdict: isPrivate ? "private" : "ok",
    profile,
    note: isPrivate
      ? `@${handle} is private. Profile metadata, follower counts and bio are readable; post content is withheld by Instagram.`
      : "",
    residualPath: isPrivate ? "Public mentions by other accounts may still reference this subject." : null,
  });
}

// ── X / Twitter adapter ────────────────────────────────────────────────────
// Firecrawl ships a purpose-built X profile parser that returns a structured
// digest rather than raw DOM. We read that digest instead of the HTML.

async function fetchX(handle: string, timeoutMs: number): Promise<SocialProbeResult> {
  const started = Date.now();
  const base = { platform: "x" as const, handle, source: CAPABILITIES.x.transport, fetchedAt: new Date().toISOString() };
  const done = (r: Omit<SocialProbeResult, keyof typeof base | "latencyMs">) =>
    ({ ...base, ...r, latencyMs: Date.now() - started }) as SocialProbeResult;

  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) {
    return done({
      verdict: "error",
      profile: null,
      note: "X reader is not configured — the scraping credential is absent from this environment.",
      residualPath: "Link the Firecrawl connector to restore X profile reads.",
    });
  }

  let md = "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: profileUrl("x", handle),
        formats: ["markdown"],
        onlyMainContent: false,
        timeout: Math.max(8000, timeoutMs - 2000),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 429) {
      return done({ verdict: "rate_limited", profile: null, note: "X reader is rate limited upstream.", residualPath: "Retry on the next sweep." });
    }
    if (!res.ok) {
      return done({ verdict: "error", profile: null, note: `X reader returned HTTP ${res.status}.`, residualPath: "Retry on the next sweep." });
    }
    md = (await res.json())?.data?.markdown ?? "";
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError";
    return done({
      verdict: timedOut ? "rate_limited" : "error",
      profile: null,
      note: timedOut ? `X reader exceeded ${Math.round(timeoutMs / 1000)}s.` : `X transport failure: ${(e as Error).message}`,
      residualPath: "Retry on the next sweep.",
    });
  }

  if (!md.trim()) {
    return done({ verdict: "not_found", profile: null, note: `No readable X profile at @${handle} — the account may be suspended, renamed, or protected.`, residualPath: "Run a handle hunt to find the current alias." });
  }

  // The parser emits `# Display Name (@handle)`, a bio paragraph, a bullet
  // block of stats, then `## Latest Posts` of `### N. Post` entries. It also
  // markdown-escapes punctuation, so every extracted string is unescaped
  // before use — otherwise names surface as "NASA \- @NASA".
  const unescape = (s: string) => s.replace(/\\([-_*[\]()#.!\\])/g, "$1").trim();

  const head = md.match(/^#\s+(.+?)\s*\(@([A-Za-z0-9_]+)\)\s*$/m);
  const resolvedHandle = head?.[2] ?? handle;
  let displayName = head?.[1] ? unescape(head[1]) : null;
  // X titles often repeat the handle inside the name ("NASA - @NASA"); the
  // duplicate is chrome, not identity.
  if (displayName) {
    displayName = displayName.replace(/\s*[-–—|]\s*@[A-Za-z0-9_]+\s*$/i, "").trim() || displayName;
  }

  const followers = md.match(/Followers:\s*([\d,]+)/i);
  const following = md.match(/Following:\s*([\d,]+)/i);
  const postCount = md.match(/(?:Posts|Tweets):\s*([\d,]+)/i);
  const verified = /Verified:\s*yes/i.test(md);
  const avatar = md.match(/Profile Picture:\s*!\[[^\]]*\]\(([^)]+)\)/i);
  const parseCount = (m: RegExpMatchArray | null) => (m ? num(m[1].replace(/,/g, "")) : null);

  // Bio is the free text between the title and the first bullet or section.
  const bioBlock = unescape(md.split(/\n-\s|\n##\s/)[0].split("\n").slice(1).join(" ").trim());

  const posts: SocialPost[] = [];
  const sections = md.split(/^###\s+\d+\.\s*Post\s*$/m).slice(1);
  for (const sec of sections) {
    const url = sec.match(/https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)/);
    const posted = sec.match(/Posted:\s*(.+)/);
    const when = posted ? new Date(unescape(posted[1])) : null;
    const likes = sec.match(/Likes:\s*([\d,]+)/i);
    const reposts = sec.match(/(?:Retweets|Reposts):\s*([\d,]+)/i);
    const replies = sec.match(/(?:Replies|Comments):\s*([\d,]+)/i);

    // The body arrives as a blockquote. Strip the metadata lines and the
    // quote markers so the text reads as the author wrote it.
    const text = unescape(
      sec
        .replace(/^Posted:.*$/gm, "")
        .replace(/^URL:.*$/gm, "")
        .replace(/^Likes:.*$/gm, "")
        .replace(/\[https?:[^\]]*\]\(([^)]*)\)/g, "$1")
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    );

    if (!url && !text) continue;
    posts.push({
      id: url?.[1] ?? `${resolvedHandle}-${posts.length}`,
      url: url?.[0] ?? null,
      text: text.slice(0, 2000),
      postedAt: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
      likes: parseCount(likes),
      comments: parseCount(replies),
      shares: parseCount(reposts),
      linkedHandles: mentionsIn(text),
    });
  }

  return done({
    verdict: "ok",
    profile: {
      platform: "x",
      handle: resolvedHandle,
      url: profileUrl("x", resolvedHandle),
      displayName,
      bio: bioBlock && !/^https?:/i.test(bioBlock) ? bioBlock.slice(0, 500) : null,
      followers: parseCount(followers),
      following: parseCount(following),
      verified,
      isPrivate: false,
      category: null,
      externalUrl: null,
      avatarUrl: avatar?.[1] ?? null,
      publicEmail: null,
      publicPhone: null,
      postCount: parseCount(postCount),
      posts,
    },
    note: "",
    residualPath: null,
  });
}


// ── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Probe one platform. Never throws: a refusal is data, and the caller must be
 * able to render it. Blocked platforms answer immediately without burning a
 * network round trip on a result already known to be a wall.
 */
export async function probePlatform(platform: Platform, rawHandle: string, timeoutMs = 15000): Promise<SocialProbeResult> {
  const started = Date.now();
  const handle = normalizeHandle(platform, rawHandle);
  if (!handle) {
    return {
      platform,
      handle: rawHandle.slice(0, 80),
      verdict: "error",
      profile: null,
      note: `"${rawHandle.slice(0, 40)}" is not a valid ${CAPABILITIES[platform].label} handle.`,
      residualPath: "Supply the handle alone or a link to the profile on that platform.",
      source: "validator",
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  }

  const cap = CAPABILITIES[platform];
  if (!cap.targetProfile) {
    return blocked(
      platform,
      handle,
      cap.constraint,
      "Search-engine fragments for this subject are still collected by the Zophiel sweep and folded into the dossier.",
      started,
    );
  }

  return platform === "instagram" ? fetchInstagram(handle, timeoutMs) : fetchX(handle, timeoutMs);
}

/** Probe several platforms concurrently. Order of results follows the input. */
export async function probeAll(
  targets: Array<{ platform: Platform; handle: string }>,
  timeoutMs = 15000,
): Promise<SocialProbeResult[]> {
  // allSettled is redundant because probePlatform never rejects, but it costs
  // nothing and guarantees one bad adapter can never void an entire sweep.
  const settled = await Promise.allSettled(targets.map((t) => probePlatform(t.platform, t.handle, timeoutMs)));
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          platform: targets[i].platform,
          handle: targets[i].handle,
          verdict: "error" as const,
          profile: null,
          note: `Adapter crashed: ${String((s as PromiseRejectedResult).reason).slice(0, 200)}`,
          residualPath: null,
          source: "dispatcher",
          fetchedAt: new Date().toISOString(),
          latencyMs: 0,
        },
  );
}

// ── Cross-platform synthesis ───────────────────────────────────────────────

export interface SocialEdge {
  from: string;
  to: string;
  platform: Platform;
  /** How many distinct posts credit this handle. Repetition is signal. */
  weight: number;
  contexts: string[];
}

/**
 * Derive the association graph. A handle credited once is noise; a handle
 * credited across several posts is a relationship. Weight carries that
 * distinction forward instead of flattening every co-occurrence into an edge.
 */
export function extractEdges(results: SocialProbeResult[]): SocialEdge[] {
  const map = new Map<string, SocialEdge>();
  for (const r of results) {
    if (!r.profile) continue;
    const from = `${r.platform}:${r.profile.handle.toLowerCase()}`;
    for (const post of r.profile.posts) {
      for (const h of post.linkedHandles) {
        if (h === r.profile.handle.toLowerCase()) continue; // self-reference
        const key = `${from}→${r.platform}:${h}`;
        const existing = map.get(key);
        if (existing) {
          existing.weight += 1;
          if (existing.contexts.length < 3 && post.text) existing.contexts.push(post.text.slice(0, 140));
        } else {
          map.set(key, {
            from,
            to: `${r.platform}:${h}`,
            platform: r.platform,
            weight: 1,
            contexts: post.text ? [post.text.slice(0, 140)] : [],
          });
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

/** Posting-rhythm read. Returns null when the sample is too small to claim. */
export function cadence(profile: SocialProfile): { perWeek: number; spanDays: number; peakHourUtc: number | null } | null {
  const stamps = profile.posts
    .map((p) => (p.postedAt ? Date.parse(p.postedAt) : NaN))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (stamps.length < 3) return null;
  const spanDays = (stamps[stamps.length - 1] - stamps[0]) / 86400000;
  if (spanDays < 1) return null;
  const hours = new Array(24).fill(0);
  for (const s of stamps) hours[new Date(s).getUTCHours()] += 1;
  const peak = hours.indexOf(Math.max(...hours));
  return {
    perWeek: Math.round(((stamps.length / spanDays) * 7) * 10) / 10,
    spanDays: Math.round(spanDays),
    peakHourUtc: peak,
  };
}

/** Render a sweep for a text dossier or a model prompt. Losses stay visible. */
export function formatSocialBrief(results: SocialProbeResult[]): string {
  const lines: string[] = [];
  const edges = extractEdges(results);

  for (const r of results) {
    const cap = CAPABILITIES[r.platform];
    if (r.verdict === "ok" || r.verdict === "private") {
      const p = r.profile!;
      lines.push(`${cap.label} — @${p.handle}${p.verified ? " [verified]" : ""}${p.isPrivate ? " [private]" : ""}`);
      if (p.displayName) lines.push(`  Name: ${p.displayName}`);
      if (p.bio) lines.push(`  Bio: ${p.bio}`);
      if (p.followers != null) lines.push(`  Followers: ${p.followers.toLocaleString()}${p.following != null ? ` · Following: ${p.following.toLocaleString()}` : ""}`);
      if (p.category) lines.push(`  Category: ${p.category}`);
      if (p.externalUrl) lines.push(`  Link: ${p.externalUrl}`);
      if (p.publicEmail) lines.push(`  Published email: ${p.publicEmail}`);
      if (p.publicPhone) lines.push(`  Published phone: ${p.publicPhone}`);
      const c = cadence(p);
      if (c) lines.push(`  Cadence: ${c.perWeek}/week over ${c.spanDays}d · peak hour ${String(c.peakHourUtc).padStart(2, "0")}:00 UTC`);
      if (p.posts.length) {
        lines.push(`  Recent posts (${p.posts.length}):`);
        for (const post of p.posts.slice(0, 6)) {
          const when = post.postedAt ? post.postedAt.slice(0, 10) : "undated";
          const body = (post.text || post.imageDescription || "(no text)").replace(/\s+/g, " ").slice(0, 180);
          lines.push(`    · ${when} — ${body}`);
        }
      }
      if (r.note) lines.push(`  Note: ${r.note}`);
    } else {
      // A refusal is reported as a refusal, with its cause. It is never
      // allowed to read as an absence of the subject from that platform.
      lines.push(`${cap.label} — @${r.handle}: ${r.verdict.toUpperCase()}`);
      lines.push(`  ${r.note}`);
      if (r.residualPath) lines.push(`  Residual: ${r.residualPath}`);
    }
    lines.push("");
  }

  if (edges.length) {
    lines.push("ASSOCIATION GRAPH (by corroborating post count):");
    for (const e of edges.slice(0, 15)) {
      lines.push(`  ${e.from} → ${e.to}  ×${e.weight}`);
    }
  }
  return lines.join("\n").trim();
}
