// bounded http helpers shared by the identity/people source adapters.
// every helper is timeout-bounded and never throws: a failure returns null and
// the caller decides whether that means "measured, nothing found" or
// "unmeasured, here is the reason". no adapter may invent a row.

export const SOURCE_UA = "asherin-search/1.0 (+https://asherin.com)";

export interface FetchOutcome<T> {
  ok: boolean;
  value: T | null;
  status?: number;
  reason?: string;
}

export async function fetchJson<T = unknown>(
  url: string,
  timeoutMs = 10_000,
  headers: Record<string, string> = {},
): Promise<FetchOutcome<T>> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: { "user-agent": SOURCE_UA, accept: "application/json", ...headers },
    });
    if (!r.ok) {
      // drain so the connection is not leaked
      await r.text().catch(() => "");
      return { ok: false, value: null, status: r.status, reason: `http ${r.status}` };
    }
    const body = await r.text();
    if (!body.trim()) return { ok: true, value: null, status: r.status };
    try {
      return { ok: true, value: JSON.parse(body) as T, status: r.status };
    } catch {
      return { ok: false, value: null, status: r.status, reason: "response was not json" };
    }
  } catch (e) {
    return { ok: false, value: null, reason: e instanceof Error ? e.message : "network error" };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(
  url: string,
  timeoutMs = 10_000,
  headers: Record<string, string> = {},
): Promise<FetchOutcome<string>> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: { "user-agent": SOURCE_UA, ...headers },
    });
    const body = await r.text();
    if (!r.ok) return { ok: false, value: body, status: r.status, reason: `http ${r.status}` };
    return { ok: true, value: body, status: r.status };
  } catch (e) {
    return { ok: false, value: null, reason: e instanceof Error ? e.message : "network error" };
  } finally {
    clearTimeout(t);
  }
}

/** HEAD-ish existence probe used by the username account sweep. */
export async function probeStatus(
  url: string,
  timeoutMs = 9_000,
): Promise<{ status: number | null; body: string; reason?: string }> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: { "user-agent": SOURCE_UA, accept: "text/html,application/json" },
    });
    const body = (await r.text().catch(() => "")).slice(0, 4000);
    return { status: r.status, body };
  } catch (e) {
    return { status: null, body: "", reason: e instanceof Error ? e.message : "network error" };
  } finally {
    clearTimeout(t);
  }
}

/** Run tasks with a hard cap on in-flight requests so one node cannot flood. */
export async function pooled<T>(tasks: Array<() => Promise<T>>, concurrency = 6): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= tasks.length) return;
      out[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return out;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const HANDLE_RE = /(?:^|[\s(])@([a-z0-9][a-z0-9_.-]{2,29})\b/gi;

/** Pull pivotable identifiers out of free text. Only shapes we can verify. */
export function extractIdentifiers(text: string): Array<{ identifier: string; kind: "email" | "username" | "domain" }> {
  const out: Array<{ identifier: string; kind: "email" | "username" | "domain" }> = [];
  const seen = new Set<string>();
  const push = (identifier: string, kind: "email" | "username" | "domain") => {
    const key = `${kind}:${identifier.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ identifier, kind });
  };
  for (const m of text.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(email)) continue;
    push(email, "email");
    const domain = email.split("@")[1];
    if (domain) push(domain, "domain");
  }
  for (const m of text.matchAll(HANDLE_RE)) push(m[1].toLowerCase(), "username");
  return out.slice(0, 25);
}
