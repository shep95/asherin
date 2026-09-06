// crt.sh — public certificate transparency mirror. free, no key.
// query by domain or by email (S/MIME certs contain email in san).

export interface CrtRow {
  name: string;
  first_seen: string;
  issuer: string;
}

const UA = "asherin-search/1.0 (+https://asherin.com)";

async function fetchJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": UA, accept: "application/json" } });
    if (!r.ok) {
      try { await r.arrayBuffer(); } catch { /* ignore */ }
      // surface upstream failure so callers can report "unmeasured" rather
      // than silently reporting zero certificates.
      throw new Error(`crt.sh upstream ${r.status}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function crtSubdomains(domain: string): Promise<CrtRow[]> {
  const clean = domain.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  if (!/^[a-z0-9.-]{3,253}$/.test(clean)) return [];
  const raw = await fetchJson(`https://crt.sh/?q=%25.${encodeURIComponent(clean)}&output=json`);
  if (!Array.isArray(raw)) return [];
  const seen = new Map<string, CrtRow>();
  for (const row of raw as Array<Record<string, unknown>>) {
    const names = String(row.name_value ?? "").split(/\s+/);
    const issuer = String(row.issuer_name ?? "");
    const firstSeen = String(row.not_before ?? "");
    for (const n of names) {
      const name = n.replace(/^\*\./, "").toLowerCase();
      if (!name || !name.endsWith(clean)) continue;
      const prior = seen.get(name);
      if (!prior || (firstSeen && firstSeen < prior.first_seen)) {
        seen.set(name, { name, first_seen: firstSeen, issuer });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function crtByEmail(email: string): Promise<CrtRow[]> {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return [];
  const raw = await fetchJson(`https://crt.sh/?q=${encodeURIComponent(e)}&output=json`);
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).slice(0, 100).map((r) => ({
    name: String(r.name_value ?? ""),
    first_seen: String(r.not_before ?? ""),
    issuer: String(r.issuer_name ?? ""),
  }));
}
