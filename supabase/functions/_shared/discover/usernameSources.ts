// username sources — cross-platform account existence sweep.
//
// each platform is probed on its public profile url only. a 200 whose body does
// not carry a negative marker counts as present; a 404 counts as absent; any
// other status (403 bot-wall, 429, timeout) is reported as unmeasured with the
// status, never as absent. no login, no api key abuse, no scraping of private
// content.

import { fetchJson, probeStatus, pooled, extractIdentifiers } from "./httpJson.ts";
import type { IdResult, IdRow } from "./identitySources.ts";
import { runSurfaceWave } from "../surfaceRetrieval.ts";

interface Platform {
  label: string;
  url: (u: string) => string;
  /** body substrings that mean "this handle does not exist" despite a 200. */
  negative?: string[];
  /** platforms known to bot-wall datacenter egress; reported honestly. */
  knownWalled?: boolean;
}

const PLATFORMS: Platform[] = [
  { label: "github", url: (u) => `https://api.github.com/users/${u}` },
  { label: "gitlab", url: (u) => `https://gitlab.com/api/v4/users?username=${u}` },
  { label: "codeberg", url: (u) => `https://codeberg.org/api/v1/users/${u}` },
  { label: "npm", url: (u) => `https://registry.npmjs.org/-/user/org.couchdb.user:${u}` },
  { label: "pypi", url: (u) => `https://pypi.org/user/${u}/` },
  { label: "keybase", url: (u) => `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${u}` },
  { label: "hackernews", url: (u) => `https://hacker-news.firebaseio.com/v0/user/${u}.json` },
  { label: "dev.to", url: (u) => `https://dev.to/api/users/by_username?url=${u}` },
  { label: "medium", url: (u) => `https://medium.com/@${u}/about` },
  { label: "telegram", url: (u) => `https://t.me/${u}`, negative: ["tgme_page_icon", "If you have <strong>Telegram</strong>"] },
  { label: "replit", url: (u) => `https://replit.com/@${u}` },
  { label: "sourceforge", url: (u) => `https://sourceforge.net/u/${u}/profile/` },
  { label: "bitbucket", url: (u) => `https://api.bitbucket.org/2.0/users/${u}` },
  { label: "gravatar", url: (u) => `https://en.gravatar.com/${u}.json` },
  { label: "about.me", url: (u) => `https://about.me/${u}` },
  { label: "steam", url: (u) => `https://steamcommunity.com/id/${u}?xml=1`, negative: ["The specified profile could not be found"] },
  { label: "wordpress", url: (u) => `https://${u}.wordpress.com/` },
  { label: "chess.com", url: (u) => `https://api.chess.com/pub/player/${u}` },
  { label: "lichess", url: (u) => `https://lichess.org/api/user/${u}` },
  { label: "soundcloud", url: (u) => `https://soundcloud.com/${u}`, knownWalled: true },
  { label: "instagram", url: (u) => `https://www.instagram.com/${u}/`, knownWalled: true },
  { label: "x.twitter", url: (u) => `https://x.com/${u}`, knownWalled: true },
  { label: "tiktok", url: (u) => `https://www.tiktok.com/@${u}`, knownWalled: true },
  { label: "reddit", url: (u) => `https://www.reddit.com/user/${u}/about.json`, knownWalled: true },
];

function validHandle(u: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,38}$/i.test(u);
}

export interface PlatformOutcome {
  label: string;
  state: "present" | "absent" | "unmeasured";
  url: string;
  status: number | null;
  reason?: string;
}

export async function usernameSweep(username: string): Promise<{ outcomes: PlatformOutcome[]; result: IdResult }> {
  const u = username.trim();
  if (!validHandle(u)) {
    return { outcomes: [], result: { available: false, reason: "not a probeable handle shape", rows: [] } };
  }

  const outcomes = await pooled(
    PLATFORMS.map((p) => async (): Promise<PlatformOutcome> => {
      const url = p.url(u);
      const probe = await probeStatus(url, 9_000);
      if (probe.status === null) {
        return { label: p.label, state: "unmeasured", url, status: null, reason: probe.reason ?? "no response" };
      }
      if (probe.status === 404 || probe.status === 410) {
        return { label: p.label, state: "absent", url, status: probe.status };
      }
      if (probe.status >= 200 && probe.status < 300) {
        const negative = (p.negative ?? []).some((n) => probe.body.includes(n));
        if (negative) return { label: p.label, state: "absent", url, status: probe.status };
        // keybase returns 200 with them:[null] for a miss
        if (p.label === "keybase" && /"them"\s*:\s*\[\s*null/.test(probe.body)) {
          return { label: p.label, state: "absent", url, status: probe.status };
        }
        if (p.label === "hackernews" && probe.body.trim() === "null") {
          return { label: p.label, state: "absent", url, status: probe.status };
        }
        if (p.label === "gitlab" && probe.body.trim() === "[]") {
          return { label: p.label, state: "absent", url, status: probe.status };
        }
        return { label: p.label, state: "present", url, status: probe.status };
      }
      return {
        label: p.label,
        state: "unmeasured",
        url,
        status: probe.status,
        reason: p.knownWalled
          ? `platform bot-walls server-side probes (http ${probe.status}) — check manually`
          : `http ${probe.status}`,
      };
    }),
    6,
  );

  const rows: IdRow[] = outcomes
    .filter((o) => o.state === "present")
    .map((o) => ({
      source: `account.${o.label}`,
      kind: "account",
      url: humanUrl(o.label, u, o.url),
      summary: `an account with this handle exists on ${o.label}`,
      discovered: [],
    }));

  const walled = outcomes.filter((o) => o.state === "unmeasured");
  return {
    outcomes,
    result: {
      available: true,
      reason: walled.length ? `${walled.length} platforms could not be measured` : undefined,
      rows,
    },
  };
}

function humanUrl(label: string, u: string, apiUrl: string): string {
  switch (label) {
    case "github": return `https://github.com/${u}`;
    case "gitlab": return `https://gitlab.com/${u}`;
    case "codeberg": return `https://codeberg.org/${u}`;
    case "npm": return `https://www.npmjs.com/~${u}`;
    case "keybase": return `https://keybase.io/${u}`;
    case "hackernews": return `https://news.ycombinator.com/user?id=${u}`;
    case "dev.to": return `https://dev.to/${u}`;
    case "bitbucket": return `https://bitbucket.org/${u}/`;
    case "gravatar": return `https://en.gravatar.com/${u}`;
    case "chess.com": return `https://www.chess.com/member/${u}`;
    case "lichess": return `https://lichess.org/@/${u}`;
    default: return apiUrl;
  }
}

/** github profile detail — public api, works unauthenticated at a lower rate. */
export async function githubProfile(username: string): Promise<IdResult> {
  const r = await fetchJson<{ login?: string; name?: string; email?: string | null; blog?: string; company?: string; location?: string; twitter_username?: string | null; html_url?: string; created_at?: string }>(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    10_000,
    { accept: "application/vnd.github+json" },
  );
  if (!r.ok) {
    if (r.status === 404) return { available: true, rows: [] };
    return { available: false, reason: r.reason ?? "github unavailable", rows: [] };
  }
  const p = r.value;
  if (!p?.login) return { available: true, rows: [] };
  const discovered: IdRow["discovered"] = [];
  if (p.email) discovered.push({ identifier: p.email, kind: "email" });
  if (p.name) discovered.push({ identifier: p.name, kind: "name" });
  if (p.blog) discovered.push({ identifier: p.blog, kind: "url" });
  if (p.twitter_username) discovered.push({ identifier: p.twitter_username, kind: "username" });
  return {
    available: true,
    rows: [{
      source: "github.profile",
      kind: "profile",
      url: p.html_url,
      summary: `github profile @${p.login}${p.name ? ` (${p.name})` : ""}${p.company ? ` — ${p.company}` : ""}${p.location ? `, ${p.location}` : ""}${p.created_at ? `, joined ${p.created_at.slice(0, 10)}` : ""}`,
      discovered,
    }],
  };
}

/** commit metadata often carries a real address the profile hides. */
export async function githubCommitEmails(username: string): Promise<IdResult> {
  const r = await fetchJson<Array<{ commit?: { author?: { email?: string; name?: string } }; repository?: { full_name?: string } }>>(
    `https://api.github.com/users/${encodeURIComponent(username)}/events/public`,
    10_000,
    { accept: "application/vnd.github+json" },
  );
  if (!r.ok) {
    if (r.status === 404) return { available: true, rows: [] };
    return { available: false, reason: r.reason ?? "github events unavailable", rows: [] };
  }
  const events = (r.value ?? []) as Array<{ payload?: { commits?: Array<{ author?: { email?: string; name?: string } }> }; repo?: { name?: string } }>;
  const seen = new Set<string>();
  const rows: IdRow[] = [];
  for (const ev of events) {
    for (const c of ev.payload?.commits ?? []) {
      const email = c.author?.email?.toLowerCase();
      if (!email || seen.has(email) || email.endsWith("@users.noreply.github.com")) continue;
      seen.add(email);
      rows.push({
        source: "github.commits",
        kind: "commit-metadata",
        url: ev.repo?.name ? `https://github.com/${ev.repo.name}` : undefined,
        summary: `public commit metadata exposes ${email}${c.author?.name ? ` for ${c.author.name}` : ""}`,
        discovered: [
          { identifier: email, kind: "email" },
          ...(c.author?.name ? [{ identifier: c.author.name, kind: "name" as const }] : []),
        ],
      });
    }
  }
  return { available: true, rows: rows.slice(0, 10) };
}

/** open-web sweep for the handle across social/forum surfaces. */
export async function usernameOpenWeb(username: string): Promise<IdResult> {
  try {
    const wave = await runSurfaceWave(`"${username}" profile OR account OR posts`, { limit: 10, yieldFloor: 4, providerFloor: 1 });
    if (wave.hits.length === 0 && wave.liveProviders === 0) {
      return { available: false, reason: `open web index did not answer (${wave.telemetry.find((t) => !t.ok)?.reason ?? "blocked"})`, rows: [] };
    }
    return {
      available: true,
      rows: wave.hits.slice(0, 10).map((h) => ({
        source: "open-web",
        kind: "mention",
        url: h.url,
        summary: h.title || h.url,
        evidence: h.snippet?.slice(0, 300),
        discovered: extractIdentifiers(`${h.title} ${h.snippet}`),
      })),
    };
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : "open web sweep failed", rows: [] };
  }
}
