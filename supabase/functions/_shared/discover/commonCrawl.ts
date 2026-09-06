// common crawl cdx index. no key. we hit the most recent published index only.
// index names shift monthly — resolve dynamically from the collinfo endpoint.

const UA = "asherin-search/1.0 (+https://asherin.com)";
let cachedIndex: { id: string; at: number } | null = null;
const INDEX_TTL_MS = 6 * 60 * 60 * 1000;

async function latestIndex(): Promise<string | null> {
  if (cachedIndex && Date.now() - cachedIndex.at < INDEX_TTL_MS) return cachedIndex.id;
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 8_000);
  try {
    const r = await fetch("https://index.commoncrawl.org/collinfo.json", { signal: c.signal, headers: { "user-agent": UA } });
    if (!r.ok) return null;
    const rows = await r.json();
    const id = String(rows?.[0]?.id ?? "");
    if (!id) return null;
    cachedIndex = { id, at: Date.now() };
    return id;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface CcRow {
  url: string;
  timestamp: string;
  mime: string;
  status: string;
  length: string;
}

export async function commonCrawlByDomain(domain: string, limit = 100): Promise<CcRow[]> {
  const clean = domain.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  if (!/^[a-z0-9.-]{3,253}$/.test(clean)) return [];
  const id = await latestIndex();
  if (!id) return [];
  const url = `https://index.commoncrawl.org/${id}-index?url=${encodeURIComponent("*." + clean)}&output=json&limit=${limit}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 12_000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": UA } });
    if (!r.ok) return [];
    const body = await r.text();
    return body
      .split("\n")
      .filter(Boolean)
      .slice(0, limit)
      .map((line) => {
        try {
          const j = JSON.parse(line);
          return {
            url: String(j.url ?? ""),
            timestamp: String(j.timestamp ?? ""),
            mime: String(j.mime ?? ""),
            status: String(j.status ?? ""),
            length: String(j.length ?? ""),
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is CcRow => !!x);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export function commonCrawlIndexId(): string | null {
  return cachedIndex?.id ?? null;
}
