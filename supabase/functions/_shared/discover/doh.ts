// dns-over-https via cloudflare + google. no key.
// resolves records and probes a short wordlist for orphan subdomains.

const UA = "asherin-search/1.0 (+https://asherin.com)";
const TIMEOUT = 6000;

interface DohAnswer {
  name: string;
  type: number;
  data: string;
  TTL?: number;
}

async function query(host: string, type: string): Promise<DohAnswer[]> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), TIMEOUT);
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { signal: c.signal, headers: { accept: "application/dns-json", "user-agent": UA } },
    );
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.Answer) ? j.Answer : [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function resolveHost(host: string): Promise<{ a: string[]; aaaa: string[]; cname: string[] }> {
  const [a, aaaa, cname] = await Promise.all([
    query(host, "A"),
    query(host, "AAAA"),
    query(host, "CNAME"),
  ]);
  return {
    a: a.map((r) => r.data),
    aaaa: aaaa.map((r) => r.data),
    cname: cname.map((r) => r.data.replace(/\.$/, "")),
  };
}

// small but purposeful — hits the shapes developers actually deploy.
export const SUBDOMAIN_WORDS = [
  "www", "api", "dev", "staging", "stage", "test", "qa", "uat", "prod",
  "beta", "alpha", "preview", "demo", "sandbox", "internal", "intranet",
  "admin", "portal", "dashboard", "app", "apps", "auth", "sso", "login",
  "mail", "smtp", "imap", "pop", "webmail", "vpn", "ssh", "ftp", "git",
  "gitlab", "jenkins", "ci", "build", "deploy", "docker", "registry",
  "grafana", "kibana", "prometheus", "metrics", "logs", "status",
  "backup", "old", "new", "legacy", "v1", "v2", "assets", "cdn", "static",
  "files", "docs", "wiki", "confluence", "jira", "help", "support",
  "shop", "store", "checkout", "pay", "billing", "invoice", "hr",
  "monitor", "health", "probe", "es", "kafka", "db", "postgres", "mysql",
  "redis", "s3", "storage", "media", "img", "images", "video", "stream",
];

export async function enumerateSubdomains(
  domain: string,
  limit = 60,
  concurrency = 12,
): Promise<Array<{ host: string; a: string[]; cname: string[] }>> {
  const clean = domain.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  if (!/^[a-z0-9.-]{3,253}$/.test(clean)) return [];
  const words = SUBDOMAIN_WORDS.slice(0, limit);
  const out: Array<{ host: string; a: string[]; cname: string[] }> = [];
  let i = 0;
  async function worker() {
    while (i < words.length) {
      const w = words[i++];
      const host = `${w}.${clean}`;
      const r = await resolveHost(host);
      if (r.a.length || r.aaaa.length || r.cname.length) {
        out.push({ host, a: r.a, cname: r.cname });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, words.length) }, worker));
  return out.sort((a, b) => a.host.localeCompare(b.host));
}
