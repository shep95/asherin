// url pattern probe. hits paths developers routinely leave exposed.
// live check with HEAD then a tiny GET peek to classify.

export interface PatternHit {
  url: string;
  status: number;
  content_type: string;
  size_hint: number | null;
  exposure_class: "orphan" | "code-leak" | "directory" | "config" | "credential";
  evidence_excerpt: string;
}

const UA = "asherin-search/1.0 (+https://asherin.com)";
const TIMEOUT = 5000;

// path → exposure class + evidence sniff
export const PATTERNS: Array<{ path: string; klass: PatternHit["exposure_class"]; sniff: (body: string) => boolean }> = [
  { path: "/.env", klass: "credential", sniff: (b) => /[A-Z0-9_]+=/.test(b) && !/<html/i.test(b) },
  { path: "/.env.local", klass: "credential", sniff: (b) => /[A-Z0-9_]+=/.test(b) && !/<html/i.test(b) },
  { path: "/.env.production", klass: "credential", sniff: (b) => /[A-Z0-9_]+=/.test(b) && !/<html/i.test(b) },
  { path: "/.git/HEAD", klass: "code-leak", sniff: (b) => /^ref: /.test(b) },
  { path: "/.git/config", klass: "code-leak", sniff: (b) => /\[core\]/.test(b) },
  { path: "/.gitignore", klass: "code-leak", sniff: (b) => b.length > 0 && !/<html/i.test(b) },
  { path: "/.DS_Store", klass: "code-leak", sniff: (b) => b.startsWith("\x00\x00\x00\x01Bud1") },
  { path: "/config.json", klass: "config", sniff: (b) => /^\s*[{[]/.test(b) },
  { path: "/config.yaml", klass: "config", sniff: (b) => /:\s/.test(b) && !/<html/i.test(b) },
  { path: "/composer.json", klass: "code-leak", sniff: (b) => /"require"/.test(b) },
  { path: "/package.json", klass: "code-leak", sniff: (b) => /"dependencies"/.test(b) },
  { path: "/robots.txt", klass: "orphan", sniff: (b) => /User-agent/i.test(b) },
  { path: "/sitemap.xml", klass: "orphan", sniff: (b) => /<urlset|<sitemapindex/i.test(b) },
  { path: "/backup/", klass: "directory", sniff: (b) => /Index of|<title>Directory listing/i.test(b) },
  { path: "/backups/", klass: "directory", sniff: (b) => /Index of|<title>Directory listing/i.test(b) },
  { path: "/uploads/", klass: "directory", sniff: (b) => /Index of|<title>Directory listing/i.test(b) },
  { path: "/admin/", klass: "orphan", sniff: (b) => /login|sign\s*in|password/i.test(b) },
  { path: "/staging/", klass: "orphan", sniff: () => true },
  { path: "/dev/", klass: "orphan", sniff: () => true },
  { path: "/_old/", klass: "directory", sniff: (b) => /Index of|<title>Directory listing/i.test(b) },
  { path: "/api/v1/", klass: "orphan", sniff: (b) => /^\s*[{[]/.test(b) || /openapi|swagger/i.test(b) },
  { path: "/swagger.json", klass: "orphan", sniff: (b) => /openapi|swagger/i.test(b) },
  { path: "/openapi.json", klass: "orphan", sniff: (b) => /openapi/i.test(b) },
  { path: "/graphql", klass: "orphan", sniff: (b) => /graphql/i.test(b) },
  { path: "/actuator", klass: "config", sniff: (b) => /_links/.test(b) },
  { path: "/phpinfo.php", klass: "config", sniff: (b) => /PHP Version/i.test(b) },
  { path: "/wp-config.php.bak", klass: "credential", sniff: (b) => /DB_PASSWORD/.test(b) },
  { path: "/server-status", klass: "config", sniff: (b) => /Apache Server Status/i.test(b) },
  { path: "/.well-known/security.txt", klass: "orphan", sniff: (b) => /Contact:/i.test(b) },
];

async function probeOne(base: string, entry: (typeof PATTERNS)[number]): Promise<PatternHit | null> {
  const url = base.replace(/\/$/, "") + entry.path;
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), TIMEOUT);
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: c.signal,
      headers: { "user-agent": UA, range: "bytes=0-4095", accept: "*/*" },
    });
    // treat 3xx redirects as not-a-hit; a redirect to the canonical page
    // is not an exposure. only real 2xx bodies count.
    if (r.status < 200 || r.status >= 300) {
      try { await r.arrayBuffer(); } catch { /* ignore */ }
      return null;
    }
    const ct = (r.headers.get("content-type") || "").split(";")[0].trim();
    const buf = await r.arrayBuffer();
    const body = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 4096);
    if (!entry.sniff(body)) return null;
    return {
      url,
      status: r.status,
      content_type: ct,
      size_hint: buf.byteLength,
      exposure_class: entry.klass,
      evidence_excerpt: body.slice(0, 400),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ssrf guard: never probe loopback, link-local, private ranges or cloud
// metadata hosts, whatever the caller supplied.
const BLOCKED_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|metadata\.|.*\.internal$|.*\.local$)/i;

export function isProbeableHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!h || BLOCKED_HOST.test(h)) return false;
  return /^[a-z0-9.-]{3,253}$/.test(h) && h.includes(".") && !/\.\./.test(h);
}

export async function probeUrlPatterns(base: string, concurrency = 6): Promise<PatternHit[]> {
  const clean = base.startsWith("http") ? base : `https://${base}`;
  let host = "";
  try { host = new URL(clean).hostname; } catch { return []; }
  if (!isProbeableHost(host)) return [];
  const out: PatternHit[] = [];
  let i = 0;
  async function worker() {
    while (i < PATTERNS.length) {
      const entry = PATTERNS[i++];
      const hit = await probeOne(clean, entry);
      if (hit) out.push(hit);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}
