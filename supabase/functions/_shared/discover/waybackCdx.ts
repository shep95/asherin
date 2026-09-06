// wayback machine cdx api. no key. returns every url the archive has captured
// for a domain or that mentions an identifier.

const UA = "asherin-search/1.0 (+https://asherin.com)";

export interface CdxRow {
  timestamp: string;
  original: string;
  mimetype: string;
  statuscode: string;
  digest: string;
}

async function cdx(query: string, limit = 200): Promise<CdxRow[]> {
  const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(query)}&output=json&limit=${limit}&collapse=urlkey`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 15_000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": UA } });
    if (!r.ok) {
      try { await r.arrayBuffer(); } catch { /* ignore */ }
      // an upstream failure is not the same as "no captures"; let the caller
      // report it as unmeasured instead of an empty archive.
      throw new Error(`wayback upstream ${r.status}`);
    }
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const [head, ...data] = rows as string[][];
    const idx = (k: string) => head.indexOf(k);
    const iT = idx("timestamp"), iO = idx("original"), iM = idx("mimetype"), iS = idx("statuscode"), iD = idx("digest");
    return data.map((r) => ({
      timestamp: r[iT] ?? "",
      original: r[iO] ?? "",
      mimetype: r[iM] ?? "",
      statuscode: r[iS] ?? "",
      digest: r[iD] ?? "",
    }));
  } finally {
    clearTimeout(t);
  }
}

export async function waybackByDomain(domain: string, limit = 300): Promise<CdxRow[]> {
  const clean = domain.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  return cdx(`${clean}/*`, limit);
}

export async function waybackByIdentifier(needle: string, limit = 60): Promise<CdxRow[]> {
  const n = needle.trim();
  if (!n) return [];
  return cdx(`*${n}*`, limit);
}
