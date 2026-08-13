// asherin-live-dork — live SERP + path-map + elite dork pack.
// This is the port of the Cursor asherin dork loop into the cloud so
// asherin.com can dork WITHOUT a laptop kernel. No SERP is invented, no
// secret is echoed, and the elite pack is stored server-side so the HTTP
// body stays small.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ── Secret masking. Any URL that carries token/key/password/secret in a query
// string is redacted before we hand it back — same rule as Cursor asherin. ──
function maskUrl(u: string): string {
  return u.replace(
    /([?&](?:token|key|apikey|api_key|password|passwd|pwd|secret|auth|access_token|refresh_token|session|sid|otp)=)[^&#]+/gi,
    "$1[REDACTED]",
  );
}

function normalizeHost(input: string): string | null {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^\/+/, "");
  s = s.split("/")[0].split("?")[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  return s;
}

function hostFromQuery(q: string): string | null {
  const m = String(q || "").match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}|[a-z0-9-]+\.[a-z]{2,})/i);
  return m ? normalizeHost(m[0]) : null;
}

// ── Engine adapters. Each returns [{url,title,engine}] or throws. A throw
// means the caller marks the engine "blocked" and moves on — the loop keeps
// running so one captcha does not kill the turn. ──
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

type Hit = { url: string; title: string; engine: string; why: string };

function parseDdg(html: string): Array<{ url: string; title: string }> {
  const out: Array<{ url: string; title: string }> = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 20) {
    let href = m[1];
    // DDG wraps hits in /l/?uddg=<encoded>. Unwrap.
    const wrap = href.match(/[?&]uddg=([^&]+)/);
    if (wrap) href = decodeURIComponent(wrap[1]);
    const title = m[2].replace(/<[^>]+>/g, "").trim();
    if (href.startsWith("http")) out.push({ url: href, title });
  }
  return out;
}

function parseBing(html: string): Array<{ url: string; title: string }> {
  const out: Array<{ url: string; title: string }> = [];
  const re = /<li class="b_algo"[^>]*>[\s\S]*?<h2>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 20) {
    const title = m[2].replace(/<[^>]+>/g, "").trim();
    if (m[1].startsWith("http")) out.push({ url: m[1], title });
  }
  return out;
}

async function ddg(q: string): Promise<Array<{ url: string; title: string }>> {
  // DDG serves the anomaly page to unknown IPs on GET. POST with a form body
  // matches the browser's real request and often passes where GET gets 202.
  const r = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/`,
    {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://html.duckduckgo.com/",
      },
      body: `q=${encodeURIComponent(q)}&b=&kl=us-en`,
    },
    9000,
  );
  const body = await r.text();
  if (r.status === 202 || /anomaly|captcha/i.test(body)) throw new Error("blocked");
  return parseDdg(body);
}

async function mojeek(q: string): Promise<Array<{ url: string; title: string }>> {
  const r = await fetchWithTimeout(
    `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA } },
    9000,
  );
  const body = await r.text();
  if (!r.ok) throw new Error(`mojeek_${r.status}`);
  const out: Array<{ url: string; title: string }> = [];
  const re = /<a class="ob"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) && out.length < 20) {
    out.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  return out;
}

async function bing(q: string): Promise<Array<{ url: string; title: string }>> {
  const r = await fetchWithTimeout(
    `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss`,
    { headers: { "User-Agent": UA } },
    9000,
  );
  const body = await r.text();
  // RSS parse first, fall back to HTML.
  const rssItems: Array<{ url: string; title: string }> = [];
  const reRss = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi;
  let m: RegExpExecArray | null;
  while ((m = reRss.exec(body)) && rssItems.length < 20) {
    const title = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const url = m[2].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (url.startsWith("http")) rssItems.push({ url, title });
  }
  if (rssItems.length) return rssItems;
  return parseBing(body);
}

const FORM_WHY: Array<{ re: RegExp; why: string }> = [
  { re: /login|sign[-_]?in|auth/i, why: "auth form" },
  { re: /contact/i, why: "contact form" },
  { re: /upload/i, why: "upload endpoint" },
  { re: /admin/i, why: "admin surface" },
  { re: /api|graphql|swagger|openapi/i, why: "api surface" },
  { re: /signup|register/i, why: "signup form" },
  { re: /\.js\.map|filetype=js/i, why: "js source map" },
  { re: /github\.com|gitlab\.com/i, why: "code host" },
  { re: /robots\.txt|sitemap\.xml/i, why: "site inventory" },
  { re: /\.py$|requirements\.txt|pyproject/i, why: "python surface" },
  { re: /\.tsx?$/i, why: "typescript surface" },
  { re: /\.html?$/i, why: "static html" },
];

function whyMatch(url: string, title: string, q: string): string {
  const s = `${url} ${title} ${q}`;
  for (const { re, why } of FORM_WHY) if (re.test(s)) return why;
  return "site match";
}

function baseQueries(host: string): string[] {
  return [
    `site:${host}`,
    `site:${host} (inurl:login OR inurl:signin OR inurl:auth)`,
    `site:${host} (inurl:contact OR inurl:contact-us)`,
    `site:${host} (inurl:upload OR inurl:admin OR inurl:api)`,
    `site:${host} (filetype:html OR filetype:htm OR inurl:.html)`,
    `site:${host} (filetype:py OR requirements.txt OR pyproject.toml)`,
    `site:${host} (filetype:ts OR filetype:tsx OR ".tsx")`,
    `site:${host} (filetype:js OR ".js.map")`,
    `(site:github.com OR site:gitlab.com) "${host}" (TypeScript OR Python)`,
    `site:${host} (robots.txt OR sitemap.xml)`,
  ];
}

async function runDorks(host: string): Promise<{ hits: Hit[]; blocked: Array<{ engine: string; status: string }> }> {
  const hits: Hit[] = [];
  const blocked: Array<{ engine: string; status: string }> = [];
  const seen = new Set<string>();
  const queries = baseQueries(host);
  for (const q of queries) {
    let rows: Array<{ url: string; title: string }> = [];
    let engine = "duckduckgo";
    // Three-engine cascade. Any one blocking is noted and we walk on — one
    // captcha never kills the turn.
    try {
      rows = await ddg(q);
    } catch (_e) {
      blocked.push({ engine: "duckduckgo", status: "blocked" });
    }
    if (!rows.length) {
      try {
        rows = await bing(q);
        engine = "bing";
      } catch (_e) {
        blocked.push({ engine: "bing", status: "blocked" });
      }
    }
    if (!rows.length) {
      try {
        rows = await mojeek(q);
        engine = "mojeek";
      } catch (_e) {
        blocked.push({ engine: "mojeek", status: "blocked" });
        continue;
      }
    }
    let per = 0;
    for (const r of rows) {
      if (per >= 8) break;
      const clean = maskUrl(r.url);
      const key = `${engine}|${clean}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ url: clean, title: r.title, engine, why: whyMatch(clean, r.title, q) });
      per++;
    }
  }
  return { hits, blocked };
}

const SEED_PATHS = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/login",
  "/signin",
  "/contact",
  "/contact-us",
  "/search",
  "/upload",
  "/report",
  "/admin",
  "/api",
  "/api/v1",
  "/graphql",
  "/swagger.json",
  "/openapi.json",
  "/.well-known/security.txt",
  "/.git/HEAD",
  "/security.txt",
];

async function pathMap(host: string): Promise<{
  path_inventory: string[];
  robots_status: number | null;
  seed_probe: Array<{ path: string; status: number | null }>;
}> {
  let robotsStatus: number | null = null;
  const inv: string[] = [];
  try {
    const r = await fetchWithTimeout(`https://${host}/robots.txt`, { headers: { "User-Agent": UA } }, 8000);
    robotsStatus = r.status;
    if (r.ok) {
      const body = await r.text();
      for (const line of body.split(/\r?\n/)) {
        const m = line.match(/^(?:Disallow|Allow|Sitemap):\s*(\S+)/i);
        if (m) inv.push(m[1]);
      }
    } else {
      await r.text().catch(() => "");
    }
  } catch (_e) {
    robotsStatus = null;
  }
  const probes: Array<{ path: string; status: number | null }> = [];
  const seeds = SEED_PATHS.slice(0, 25);
  for (const p of seeds) {
    try {
      const r = await fetchWithTimeout(`https://${host}${p}`, { method: "HEAD", headers: { "User-Agent": UA } }, 8000);
      probes.push({ path: p, status: r.status });
      await r.body?.cancel().catch(() => {});
    } catch (_e) {
      probes.push({ path: p, status: null });
    }
  }
  return { path_inventory: inv, robots_status: robotsStatus, seed_probe: probes };
}

function elitePack(host: string): string[] {
  const subs = ["", "www.", "api.", "staging.", "dev.", "test.", "admin.", "beta.", "internal."];
  const verbs = ["inurl:login", "inurl:signin", "inurl:admin", "inurl:api", "inurl:upload", "inurl:contact", "inurl:report"];
  const ftypes = ["filetype:html", "filetype:htm", "filetype:py", "filetype:ts", "filetype:tsx", "filetype:js", "filetype:env", "filetype:json", "filetype:log", "filetype:sql"];
  const extras = [
    `(site:github.com OR site:gitlab.com) "${host}"`,
    `(site:pastebin.com OR site:paste.ee) "${host}"`,
    `"${host}" ("api_key" OR "apikey" OR "authorization: bearer")`,
    `"${host}" ext:env`,
    `"${host}" "index of /"`,
  ];
  const set = new Set<string>();
  for (const s of subs) {
    const h = `${s}${host}`;
    set.add(`site:${h}`);
    for (const v of verbs) set.add(`site:${h} ${v}`);
    for (const f of ftypes) set.add(`site:${h} ${f}`);
    for (const v of verbs) for (const f of ftypes) set.add(`site:${h} ${v} ${f}`);
  }
  for (const e of extras) set.add(e);
  return Array.from(set);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // ── Auth. Verify the caller JWT because Lovable-managed fns run with
    // verify_jwt=false and we still refuse anonymous dorking. ──
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await sb.auth.getUser(jwt);
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "dork");
    const query = String(body?.query || "");
    const rawHost = body?.host ? String(body.host) : hostFromQuery(query) || "";
    const host = normalizeHost(rawHost);
    if (!host) {
      return new Response(
        JSON.stringify({ error: "host_required", hint: "pass { host } or a query with a hostname" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const out: Record<string, unknown> = { ok: true, fake: false, host };

    if (mode === "dork" || mode === "swarm") {
      const { hits, blocked } = await runDorks(host);
      out.hits = hits;
      out.blocked = blocked;
    }
    if (mode === "path_map" || mode === "swarm") {
      out.path_map = await pathMap(host);
    }
    if (mode === "elite_sample") {
      const pack = elitePack(host);
      // Persist the full pack server-side, hand back a small sample.
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (service) {
        const admin = createClient(url, service);
        await admin.from("asherin_dork_packs").insert({
          user_id: userId,
          host,
          pack,
        }).select("id").maybeSingle();
      }
      // Deterministic sample: first 8 unique.
      out.sample_dorks = pack.slice(0, 8);
      out.pack_count = pack.length;
    }

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message || "error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
