// nicheLeakLexicon — pages niche software actually ships and accidentally
// leaves public. Shared by chat live-dork, asherinx.eng, Zerlal, Zophiel
// form-path, and path-map. Public-index inventory + HEAD/GET status only.
// Never exploit sequences, never payloads, never ATO.

/** Priority HEAD/GET inventory. Marketing `/` and `/index.html` are last. */
export const LEAK_SEED_PATHS: string[] = [
  // secrets / config
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.env.development",
  "/.env.bak",
  "/.env.example",
  "/config.json",
  "/config.js",
  "/settings.json",
  "/appsettings.json",
  "/appsettings.Development.json",
  "/appsettings.Production.json",
  "/web.config",
  "/web.config.bak",
  "/wp-config.php",
  "/wp-config.php.bak",
  "/wp-config.php.old",
  "/configuration.php.bak",
  "/settings.py",
  "/local_settings.py",
  "/application.properties",
  "/application.yml",
  "/application-dev.yml",
  "/secrets.yml",
  "/parameters.yml",
  "/local.settings.json",
  "/credentials.json",
  "/serviceAccount.json",
  "/google-services.json",
  "/firebase.json",
  "/.firebase/hosting.json",
  "/.npmrc",
  "/.pypirc",
  "/.dockercfg",
  "/.docker/config.json",
  "/.aws/credentials",
  "/id_rsa",
  "/id_ed25519",
  // scm / leftovers
  "/.git/HEAD",
  "/.git/config",
  "/.svn/entries",
  "/.hg/hgrc",
  "/.DS_Store",
  "/.vscode/sftp.json",
  "/.vscode/ftp-sync.json",
  "/Thumbs.db",
  // api docs / debug
  "/swagger",
  "/swagger.json",
  "/swagger-ui.html",
  "/swagger/index.html",
  "/swagger-ui/index.html",
  "/openapi.json",
  "/openapi.yaml",
  "/v2/api-docs",
  "/v3/api-docs",
  "/api-docs",
  "/redoc",
  "/graphql",
  "/graphiql",
  "/playground",
  "/altair",
  "/actuator",
  "/actuator/env",
  "/actuator/health",
  "/actuator/mappings",
  "/actuator/heapdump",
  "/debug",
  "/debug/pprof",
  "/_debug",
  "/phpinfo.php",
  "/info.php",
  "/server-status",
  "/server-info",
  "/nginx_status",
  "/elmah.axd",
  "/trace.axd",
  "/_profiler",
  "/app_dev.php",
  "/console",
  "/horizon",
  "/telescope",
  "/nova",
  "/clockwork",
  "/_profiler/phpinfo",
  "/rails/info",
  "/sidekiq",
  "/resque",
  "/flower",
  "/hangfire",
  "/mini-profiler-resources",
  // niche app surfaces
  "/wp-json",
  "/wp-json/wp/v2/users",
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/wp-content/debug.log",
  "/readme.html",
  "/.well-known/openid-configuration",
  "/.well-known/jwks.json",
  "/.well-known/oauth-authorization-server",
  "/.well-known/security.txt",
  "/auth/realms",
  "/realms/master",
  "/admin",
  "/administrator",
  "/login",
  "/signin",
  "/ghost",
  "/ghost/#/signin",
  "/strapi/admin",
  "/adminer.php",
  "/adminer",
  "/phpmyadmin",
  "/pma",
  "/manager/html",
  "/solr/admin",
  "/_cat/indices",
  "/_cluster/health",
  "/jenkins",
  "/grafana",
  "/kibana",
  "/prometheus",
  "/metrics",
  "/health",
  "/healthz",
  "/readyz",
  "/status",
  "/version",
  "/api",
  "/api/v1",
  "/api/v2",
  "/rest/v1",
  // backups / dumps / sourcemaps
  "/backup",
  "/backups",
  "/backup.sql",
  "/dump.sql",
  "/database.sql",
  "/db.sql",
  "/backup.zip",
  "/backup.tar.gz",
  "/old",
  "/bak",
  "/tmp",
  "/temp",
  "/logs",
  "/log",
  "/debug.log",
  "/error_log",
  "/storage/logs/laravel.log",
  "/main.js.map",
  "/static/js/main.js.map",
  "/assets/index.js.map",
  "/.map",
  // inventory (not marketing html)
  "/robots.txt",
  "/sitemap.xml",
  "/crossdomain.xml",
  "/clientaccesspolicy.xml",
  "/humans.txt",
  "/CHANGELOG.md",
  "/README.md",
  "/Dockerfile",
  "/docker-compose.yml",
  "/package.json",
  "/composer.json",
  "/Gemfile",
  "/Pipfile",
  "/pyproject.toml",
  "/vercel.json",
  "/netlify.toml",
  "/wrangler.toml",
  "/",
];

export const LEAK_PROBE_PATHS = LEAK_SEED_PATHS.slice(0, 48);

export const LEAK_FILETYPES = [
  "env",
  "bak",
  "old",
  "sql",
  "log",
  "conf",
  "cfg",
  "ini",
  "yml",
  "yaml",
  "json",
  "xml",
  "map",
  "pem",
  "key",
  "p12",
  "jks",
  "zip",
  "gz",
  "tar",
  "properties",
  "config",
];

export const LEAK_INURL = [
  ".env",
  ".git",
  ".svn",
  "wp-config",
  "phpinfo",
  "server-status",
  "actuator",
  "swagger",
  "openapi",
  "graphql",
  "graphiql",
  "telescope",
  "horizon",
  "debug",
  "backup",
  "dump.sql",
  "phpmyadmin",
  "adminer",
  "web.config",
  "appsettings",
  "credentials.json",
  "id_rsa",
  ".js.map",
  "wp-json",
  "xmlrpc.php",
  "elmah.axd",
];

export const FORM_WHY: Array<{ re: RegExp; why: string }> = [
  { re: /\.env|appsettings|web\.config|wp-config|credentials\.json|id_rsa|\.pem/i, why: "secret/config leak page" },
  { re: /\.git|\.svn|\.hg|ds_store/i, why: "scm leftover" },
  { re: /swagger|openapi|api-docs|redoc|graphql|graphiql/i, why: "api docs surface" },
  { re: /actuator|phpinfo|server-status|telescope|horizon|_profiler|elmah|pprof/i, why: "debug/admin telemetry" },
  { re: /wp-json|wp-admin|xmlrpc|wp-login/i, why: "wordpress surface" },
  { re: /backup|\.sql|\.bak|dump\.|index of/i, why: "backup/dump listing" },
  { re: /\.js\.map|sourceMappingURL/i, why: "js source map" },
  { re: /phpmyadmin|adminer|solr\/admin|_cat\/indices|grafana|kibana|jenkins/i, why: "ops console" },
  { re: /login|sign[-_]?in|auth/i, why: "auth form" },
  { re: /contact/i, why: "contact form" },
  { re: /upload/i, why: "upload endpoint" },
  { re: /admin/i, why: "admin surface" },
  { re: /api/i, why: "api surface" },
  { re: /signup|register/i, why: "signup form" },
  { re: /github\.com|gitlab\.com/i, why: "code host" },
  { re: /robots\.txt|sitemap\.xml/i, why: "site inventory" },
  { re: /\.py$|requirements\.txt|pyproject/i, why: "python surface" },
  { re: /\.tsx?$/i, why: "typescript surface" },
];

export function whyMatch(url: string, title: string, q: string): string {
  const s = `${url} ${title} ${q}`;
  for (const { re, why } of FORM_WHY) if (re.test(s)) return why;
  return "site match";
}

/** SERP queries for a host. No filetype:html / inurl:.html primary hunt. */
export function leakBaseQueries(host: string): string[] {
  const ftypes = LEAK_FILETYPES.slice(0, 10)
    .map((e) => `ext:${e}`)
    .join(" OR ");
  const inurl = LEAK_INURL.slice(0, 12)
    .map((p) => `inurl:${p}`)
    .join(" OR ");
  return [
    `site:${host}`,
    `site:${host} (${inurl})`,
    `site:${host} (${ftypes})`,
    `site:${host} (intitle:"index of" OR intitle:"parent directory")`,
    `site:${host} (inurl:login OR inurl:signin OR inurl:auth OR inurl:admin)`,
    `site:${host} (inurl:swagger OR inurl:openapi OR inurl:graphql OR inurl:actuator)`,
    `site:${host} (inurl:.env OR inurl:.git OR inurl:wp-config OR inurl:phpinfo)`,
    `site:${host} (inurl:backup OR inurl:dump.sql OR ext:sql OR ext:bak OR ext:log)`,
    `site:${host} (inurl:.js.map OR "sourceMappingURL")`,
    `site:${host} (inurl:telescope OR inurl:horizon OR inurl:server-status OR inurl:debug)`,
    `site:${host} (filetype:py OR requirements.txt OR pyproject.toml)`,
    `site:${host} (filetype:ts OR filetype:tsx OR filetype:js)`,
    `(site:github.com OR site:gitlab.com OR site:gist.github.com) "${host}" (ext:env OR ".env" OR wp-config OR "BEGIN PRIVATE")`,
    `(site:pastebin.com OR site:paste.ee OR site:ghostbin.com) "${host}"`,
    `site:${host} (robots.txt OR sitemap.xml)`,
  ];
}

export function leakElitePack(host: string): string[] {
  const subs = ["", "www.", "api.", "staging.", "dev.", "test.", "admin.", "beta.", "internal.", "cdn."];
  const verbs = [
    "inurl:.env",
    "inurl:.git",
    "inurl:wp-config",
    "inurl:swagger",
    "inurl:actuator",
    "inurl:graphql",
    "inurl:backup",
    "inurl:phpinfo",
    "inurl:telescope",
    "inurl:admin",
    "inurl:login",
    "inurl:api",
  ];
  const ftypes = LEAK_FILETYPES.map((e) => `filetype:${e}`);
  const extras = [
    `(site:github.com OR site:gitlab.com) "${host}" (ext:env OR ext:bak OR "AKIA")`,
    `(site:pastebin.com OR site:paste.ee) "${host}"`,
    `"${host}" ("api_key" OR "apikey" OR "authorization: bearer" OR "DB_PASSWORD")`,
    `"${host}" ext:env`,
    `"${host}" "index of /"`,
    `"${host}" (inurl:actuator/env OR inurl:server-status OR inurl:phpinfo)`,
    `site:web.archive.org "${host}" (inurl:.env OR inurl:.git OR inurl:backup)`,
  ];
  const set = new Set<string>();
  for (const s of subs) {
    const h = `${s}${host}`;
    set.add(`site:${h}`);
    for (const v of verbs) set.add(`site:${h} ${v}`);
    for (const f of ftypes) set.add(`site:${h} ${f}`);
  }
  for (const e of extras) set.add(e);
  return Array.from(set);
}

export const LEAK_TRIGGER_RE =
  /\b(dork|inurl:|filetype:|ext:|site:|login|signin|contact|admin|path\s*map|map\s+.*paths|robots\.txt|sitemap|leak|leaked|exposure|sweep|recon|osint|\.env|\.git|swagger|actuator|graphql|backup|phpinfo|wp-json|wp-config|telescope|horizon|sourcemap|heapdump|phpmyadmin|index\s+of)\b/i;

export const LEAK_PATHMAP_RE =
  /\b(path\s*map|map\s+.*paths|robots\.txt|sitemap|inventory|leak|exposure|sweep|recon|\.env|\.git|swagger|actuator|backup)\b/i;

/** Path tokens that mean "this URL is a leak page, not a marketing html". */
export const LEAK_PATH_RE =
  /\.(env|bak|old|sql|log|pem|map|p12)(?:$|\?)|\/(?:\.git|wp-config|phpinfo|server-status|actuator|swagger|openapi|graphql|graphiql|telescope|horizon|phpmyadmin|adminer|_profiler|elmah|backup|dump\.sql|credentials\.json|appsettings|web\.config|id_rsa|wp-json)/i;

export function leakUrlscanQuery(host: string): string {
  return `domain:${host} AND (filename:.env OR filename:web.config OR filename:appsettings.json OR page.url:.git OR page.url:swagger OR page.url:actuator OR page.url:graphql OR page.url:phpinfo OR page.url:backup OR page.url:.js.map)`;
}

export function leakGithubQuery(host: string): string {
  return `"${host}" (filename:.env OR filename:wp-config.php OR filename:web.config OR filename:id_rsa OR extension:pem OR "AKIA")`;
}

export function isLeakUrl(url: string): boolean {
  return LEAK_PATH_RE.test(url);
}

export interface SeedTheory {
  category:
    | "exposed_files"
    | "open_directories"
    | "login_portals"
    | "exposed_dbs"
    | "credentials_keys"
    | "attack_surface";
  query: string;
  why: string;
}

/** Deterministic leak theories so Gemini cannot collapse to filetype:html. */
export function seedLeakTheories(subject: string, kind: string, domainHint?: string): SeedTheory[] {
  const host = (kind === "domain" ? subject : domainHint || "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
  const quoted = `"${subject}"`;
  const out: SeedTheory[] = [];
  if (host && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    for (const q of leakBaseQueries(host).slice(1)) {
      out.push({
        category: "attack_surface",
        query: q,
        why: "niche leak-page inventory — not marketing html",
      });
    }
  } else {
    out.push(
      {
        category: "exposed_files",
        query: `${quoted} (ext:env OR ext:sql OR ext:bak OR ext:log OR ext:pem)`,
        why: "leaked secret/config files",
      },
      {
        category: "open_directories",
        query: `${quoted} intitle:"index of" (backup OR dump OR .git OR .env)`,
        why: "open directory listings",
      },
      {
        category: "credentials_keys",
        query: `(site:github.com OR site:gitlab.com OR site:pastebin.com) ${quoted} (DB_PASSWORD OR api_key OR "BEGIN PRIVATE" OR AKIA)`,
        why: "committed credentials",
      },
      {
        category: "attack_surface",
        query: `${quoted} (inurl:swagger OR inurl:actuator OR inurl:graphql OR inurl:phpinfo OR inurl:wp-config)`,
        why: "niche software leak pages",
      },
      {
        category: "exposed_dbs",
        query: `${quoted} (inurl:phpmyadmin OR inurl:adminer OR inurl:kibana OR intitle:"mongodb")`,
        why: "exposed db consoles",
      },
    );
  }
  return out;
}

// liveDorkBridge — host + leak/sweep/dork → asherin-live-dork.
// Niche leak pages, not marketing html. Never invents SERP output.

export interface DorkPlan {
  host: string;
  wantDork: boolean;
  wantPathMap: boolean;
}

const HOST_RE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/i;
const HOST_STOPLIST = new Set(["e.g", "i.e", "u.s", "u.k"]);

export function planDork(text: string): DorkPlan | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const trigger = LEAK_TRIGGER_RE.test(raw);
  const m = raw.match(HOST_RE);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (HOST_STOPLIST.has(host)) return null;
  if (!trigger) return null;
  const wantPathMap = LEAK_PATHMAP_RE.test(raw);
  const wantDork = !wantPathMap || LEAK_TRIGGER_RE.test(raw);
  return { host, wantDork, wantPathMap: wantPathMap || wantDork };
}

async function invokeLiveDork(
  mode: "dork" | "path_map" | "swarm",
  host: string,
  auth: string | null,
): Promise<{ ok: boolean; body: any; status: number; err?: string }> {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return { ok: false, body: null, status: 0, err: "no-supabase-url" };
  try {
    const r = await fetch(`${url}/functions/v1/asherin-live-dork`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify({ host, mode }),
    });
    const body = await r.json().catch(() => null);
    return { ok: r.ok, body, status: r.status };
  } catch (e) {
    return { ok: false, body: null, status: 0, err: (e as Error).message };
  }
}

export async function runLiveDork(
  plan: DorkPlan,
  auth: string | null,
): Promise<{
  context: string;
  fired: string[];
  offline?: string;
}> {
  const fired: string[] = [];
  const parts: string[] = [];
  let offline: string | undefined;

  const mode: "dork" | "path_map" | "swarm" =
    plan.wantDork && plan.wantPathMap ? "swarm" : plan.wantPathMap ? "path_map" : "dork";
  const r = await invokeLiveDork(mode, plan.host, auth);
  fired.push(`asherin-live-dork:${mode}(${r.status})`);
  if (!r.ok || !r.body?.ok) {
    offline = `live dork offline (${r.status || r.err || "error"})`;
    return { context: "", fired, offline };
  }

  if (plan.wantDork) {
    const hits: Array<{ url: string; title: string; engine: string; why: string }> = r.body.hits || [];
    const blocked: Array<{ engine: string; status: string }> = r.body.blocked || [];
    parts.push(`LIVE DORK HITS for ${plan.host} (${hits.length}) — niche leak pages ranked above marketing html:`);
    for (const h of hits.slice(0, 24)) {
      parts.push(`- ${h.url} — ${h.why} [${h.engine}]${h.title ? ` — ${h.title}` : ""}`);
    }
    if (!hits.length) parts.push(`- (no hits parsed)`);
    if (blocked.length) parts.push(`BLOCKED ENGINES: ${blocked.map((b) => `${b.engine}:${b.status}`).join(", ")}`);
  }

  if (plan.wantPathMap) {
    const pm = r.body.path_map || {};
    parts.push(`PATH MAP for ${plan.host} (leak seeds, not index.html):`);
    parts.push(`- robots.txt status: ${pm.robots_status ?? "not fetched"}`);
    const inv: string[] = pm.path_inventory || [];
    if (inv.length) {
      parts.push(`- robots inventory (${inv.length}): ${inv.slice(0, 40).join(", ")}`);
    } else {
      parts.push(`- robots inventory: empty or robots.txt not fetched`);
    }
    const probes: Array<{ path: string; status: number | null; leak?: boolean }> = pm.seed_probe || [];
    const alive = probes.filter((p) => p.status && p.status < 400);
    const leakAlive = alive.filter((p) => p.leak);
    parts.push(
      `- seed probes: ${probes.length} tried, ${alive.length} responded < 400, ${leakAlive.length} leak-class`,
    );
    for (const p of probes.filter((x) => x.leak || (x.status && x.status < 400)).slice(0, 40)) {
      parts.push(`  · ${p.path} → ${p.status ?? "no-response"}${p.leak ? " [leak-class]" : ""}`);
    }
    const arch: string[] = pm.archive_leak_paths || [];
    if (arch.length) {
      parts.push(`- wayback leak-shaped captures (${arch.length}): ${arch.slice(0, 16).join(", ")}`);
    }
  }

  return {
    context: parts.length ? `\n[ASHERIN LIVE DORK]\n${parts.join("\n")}\n` : "",
    fired,
    offline,
  };
}
