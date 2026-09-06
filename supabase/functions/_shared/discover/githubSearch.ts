// github code search. needs GITHUB_TOKEN. without one we return an
// unmeasured shape — never a fake row.

const UA = "asherin-search/1.0 (+https://asherin.com)";

export interface GhHit {
  html_url: string;
  path: string;
  repository: string;
  score: number;
  fragment?: string;
}

export interface GhResult {
  available: boolean;
  reason?: string;
  hits: GhHit[];
}

export async function githubCodeSearch(query: string, limit = 30): Promise<GhResult> {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return { available: false, reason: "requires GITHUB_TOKEN", hits: [] };
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 12_000);
  try {
    const r = await fetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${Math.min(limit, 100)}`,
      {
        signal: c.signal,
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          authorization: `Bearer ${token}`,
          "user-agent": UA,
        },
      },
    );
    if (r.status === 403 || r.status === 429) return { available: false, reason: "rate limited by github", hits: [] };
    if (!r.ok) return { available: false, reason: `github http ${r.status}`, hits: [] };
    const j = await r.json();
    const items = Array.isArray(j?.items) ? j.items : [];
    return {
      available: true,
      hits: items.map((it: Record<string, unknown>) => ({
        html_url: String(it.html_url ?? ""),
        path: String(it.path ?? ""),
        repository: String((it.repository as { full_name?: string } | undefined)?.full_name ?? ""),
        score: Number(it.score ?? 0),
      })),
    };
  } catch (e) {
    return { available: false, reason: `github error ${e instanceof Error ? e.message : String(e)}`, hits: [] };
  } finally {
    clearTimeout(t);
  }
}
