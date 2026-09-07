// identity sources — free, public, honestly unmeasured when a key is needed.
// each returns a { available, reason?, rows[] } shape so the ui can render
// "unmeasured" rows with the exact reason.

const UA = "asherin-search/1.0 (+https://asherin.com)";

export interface IdRow {
  source: string;
  kind: string;
  url?: string;
  summary: string;
  evidence?: string;
  discovered: Array<{ identifier: string; kind: "email" | "phone" | "username" | "name" | "domain" | "url" }>;
}

export interface IdResult {
  available: boolean;
  reason?: string;
  rows: IdRow[];
}

async function json(url: string, timeoutMs = 10_000, headers: Record<string, string> = {}): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": UA, accept: "application/json", ...headers } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

async function text(url: string, timeoutMs = 10_000): Promise<string | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": UA } });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

// gravatar — deterministic md5(email). we probe the hash's profile.json.
async function md5(s: string): Promise<string> {
  // gravatar accepts sha256 since 2023; use it — no md5 in web crypto.
  const buf = new TextEncoder().encode(s);
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function gravatarProfile(email: string): Promise<IdResult> {
  const hash = await md5(email.trim().toLowerCase());
  const j = await json(`https://en.gravatar.com/${hash}.json`);
  const profile = (j as { entry?: Array<Record<string, unknown>> } | null)?.entry?.[0];
  if (!profile) return { available: true, rows: [] };
  const displayName = String(profile.displayName ?? "");
  const urls = Array.isArray(profile.urls) ? (profile.urls as Array<Record<string, string>>) : [];
  const rows: IdRow[] = [{
    source: "gravatar",
    kind: "profile",
    url: `https://en.gravatar.com/${hash}`,
    summary: displayName ? `gravatar profile for ${displayName}` : "gravatar profile",
    discovered: [
      ...(displayName ? [{ identifier: displayName, kind: "name" as const }] : []),
      ...urls.map((u) => ({ identifier: String(u.value ?? ""), kind: "url" as const })).filter((x) => x.identifier),
    ],
  }];
  return { available: true, rows };
}

export async function githubUserByEmail(email: string): Promise<IdResult> {
  // the code search api needs a token, but the *user* search api answers
  // unauthenticated at a lower rate. a missing token narrows the sweep; it must
  // not silence it.
  const token = Deno.env.get("GITHUB_TOKEN");
  const headers: Record<string, string> = {
    "x-github-api-version": "2022-11-28",
    accept: "application/vnd.github+json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 12_000);
  let payload: { items?: Array<Record<string, unknown>> } | null = null;
  try {
    const r = await fetch(
      `https://api.github.com/search/users?q=${encodeURIComponent(email + " in:email")}&per_page=10`,
      { signal: c.signal, headers: { "user-agent": UA, ...headers } },
    );
    if (r.status === 403 || r.status === 429) {
      await r.text().catch(() => "");
      return {
        available: false,
        reason: token
          ? "github rate limit reached for this token"
          : "github unauthenticated search rate limit reached — set GITHUB_TOKEN to widen it",
        rows: [],
      };
    }
    if (!r.ok) {
      await r.text().catch(() => "");
      return { available: false, reason: `github http ${r.status}`, rows: [] };
    }
    payload = await r.json();
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : "github unavailable", rows: [] };
  } finally {
    clearTimeout(t);
  }
  const items = payload?.items ?? [];
  return {
    available: true,
    rows: items.slice(0, 10).map((it) => ({
      source: "github",
      kind: "user",
      url: String(it.html_url ?? ""),
      summary: `github user @${it.login} referenced this email in commit metadata`,
      discovered: [
        { identifier: String(it.login ?? ""), kind: "username" as const },
        { identifier: String(it.html_url ?? ""), kind: "url" as const },
      ].filter((x) => x.identifier),
    })),
  };
}

// free public breach index — accepts an email and returns the source list.
export async function leakCheckEmail(email: string): Promise<IdResult> {
  const j = await json(`https://leakcheck.io/api/public?check=${encodeURIComponent(email.trim().toLowerCase())}`, 12_000);
  const body = j as { success?: boolean; found?: number; fields?: string[]; sources?: Array<{ name: string; date?: string }> } | null;
  if (!body) return { available: false, reason: "leakcheck did not answer", rows: [] };
  if (!body.success) return { available: true, rows: [] };
  const rows: IdRow[] = (body.sources ?? []).slice(0, 30).map((s) => ({
    source: "leakcheck.public",
    kind: "breach",
    url: "https://leakcheck.io/",
    summary: `this address appears in the public breach index for ${s.name}${s.date ? ` (${s.date})` : ""}`,
    discovered: [],
  }));
  if (body.fields?.length) {
    rows.push({
      source: "leakcheck.public",
      kind: "breach-fields",
      summary: `field types exposed alongside this address across ${body.found ?? rows.length} records: ${body.fields.join(", ")}`,
      discovered: [],
    });
  }
  return { available: true, rows };
}

export function emailKeyedSources(): Record<string, { available: false; reason: string }> {
  return {
    "haveibeenpwned": { available: false, reason: "requires HIBP_API_KEY (paid)" },
    "emailrep": { available: false, reason: "emailrep disabled its unauthenticated api; requires EMAILREP_API_KEY" },
    "hunter.io": { available: false, reason: "requires HUNTER_API_KEY" },
  };
}


export async function keyserverProfile(email: string): Promise<IdResult> {
  // keys.openpgp.org lookup by email. text/plain if found.
  const body = await text(`https://keys.openpgp.org/vks/v1/by-email/${encodeURIComponent(email.trim().toLowerCase())}`);
  if (!body || !/BEGIN PGP PUBLIC KEY BLOCK/.test(body)) return { available: true, rows: [] };
  return {
    available: true,
    rows: [{
      source: "keys.openpgp.org",
      kind: "pgp",
      url: `https://keys.openpgp.org/search?q=${encodeURIComponent(email)}`,
      summary: "a pgp public key is published for this email",
      evidence: body.split("\n").slice(0, 6).join("\n"),
      discovered: [],
    }],
  };
}

export async function xposedOrNot(email: string): Promise<IdResult> {
  // free breach index. returns { breaches: [[names]] } or 404.
  const j = await json(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email.trim().toLowerCase())}`);
  if (!j) return { available: true, rows: [] };
  const names = Array.isArray((j as { breaches?: string[][] }).breaches?.[0])
    ? (j as { breaches: string[][] }).breaches[0]
    : [];
  return {
    available: true,
    rows: names.slice(0, 40).map((n) => ({
      source: "xposedornot",
      kind: "breach",
      summary: `email appears in the breach index for ${n}`,
      discovered: [],
    })),
  };
}

export async function secEdgarByName(name: string): Promise<IdResult> {
  const q = encodeURIComponent(name.trim());
  if (!q) return { available: true, rows: [] };
  const j = await json(
    `https://efts.sec.gov/LATEST/search-index?q=%22${q}%22&forms=&dateRange=custom&startdt=2000-01-01`,
    12_000,
    { accept: "application/json", "user-agent": UA },
  );
  const hits = (j as { hits?: { hits?: Array<Record<string, unknown>> } } | null)?.hits?.hits ?? [];
  return {
    available: true,
    rows: hits.slice(0, 15).map((h) => {
      const src = (h._source as { adsh?: string; form?: string; ciks?: string[] }) ?? {};
      const cik = Array.isArray(src.ciks) ? String(src.ciks[0] ?? "") : "";
      const url = cik
        ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cik)}`
        : "https://www.sec.gov/cgi-bin/srqsb?text=" + encodeURIComponent(name);
      return {
        source: "sec.edgar",
        kind: "filing",
        url,
        summary: `${src.form ?? "sec filing"} referencing ${name}`,
        discovered: [],
      };
    }),
  };
}

export async function faaAirmen(name: string): Promise<IdResult> {
  // faa airmen registry does not expose a free json endpoint; the download is a
  // large csv distribution. we honestly mark unmeasured with the reason so no
  // fabricated rows appear.
  return { available: false, reason: "faa airmen ships as a bulk csv download, not a query api", rows: [] };
}

export async function wikidataByName(name: string): Promise<IdResult> {
  const j = await json(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=${encodeURIComponent(name.trim())}`,
  );
  const rows = (j as { search?: Array<Record<string, unknown>> } | null)?.search ?? [];
  return {
    available: true,
    rows: rows.slice(0, 5).map((r) => ({
      source: "wikidata",
      kind: "entity",
      url: String(r.concepturi ?? ""),
      summary: String(r.description ?? r.label ?? "wikidata entity"),
      discovered: [{ identifier: String(r.concepturi ?? ""), kind: "url" as const }].filter((x) => x.identifier),
    })),
  };
}
