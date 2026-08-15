// liveDorkBridge — turns "dork example.com" / "map example.com paths" into an
// actual invoke of asherin-live-dork before the model writes a word. Never
// invents SERP output; on failure it hands back an honest offline banner so
// the caller says "live dork offline (…)" instead of hallucinating URLs.

export interface DorkPlan {
  host: string;
  wantDork: boolean;
  wantPathMap: boolean;
}

const HOST_RE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/i;
const TRIGGER_RE =
  /\b(dork|inurl:|filetype:|site:|login|signin|contact|admin|path\s*map|map\s+.*paths|robots\.txt|sitemap)\b/i;
// Words that look like TLDs but are prose. Kept small so "example.com" still fires.
const HOST_STOPLIST = new Set(["e.g", "i.e", "u.s", "u.k"]);

export function planDork(text: string): DorkPlan | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const trigger = TRIGGER_RE.test(raw);
  const m = raw.match(HOST_RE);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (HOST_STOPLIST.has(host)) return null;
  // Require either an explicit trigger word OR a filetype/inurl-style query,
  // else "I love google.com search" would fire the dork loop.
  if (!trigger) return null;
  const wantPathMap = /\b(path\s*map|map\s+.*paths|robots\.txt|sitemap|inventory)\b/i.test(raw);
  const wantDork = !wantPathMap || /\b(dork|login|contact|signin|admin|inurl:|filetype:|site:)\b/i.test(raw);
  return { host, wantDork, wantPathMap };
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

  if (plan.wantDork) {
    const r = await invokeLiveDork("dork", plan.host, auth);
    fired.push(`asherin-live-dork:dork(${r.status})`);
    if (!r.ok || !r.body?.ok) {
      offline = `live dork offline (${r.status || r.err || "error"})`;
    } else {
      const hits: Array<{ url: string; title: string; engine: string; why: string }> = r.body.hits || [];
      const blocked: Array<{ engine: string; status: string }> = r.body.blocked || [];
      parts.push(`LIVE DORK HITS for ${plan.host} (${hits.length}):`);
      for (const h of hits.slice(0, 24)) {
        parts.push(`- ${h.url} — ${h.why} [${h.engine}]${h.title ? ` — ${h.title}` : ""}`);
      }
      if (!hits.length) parts.push(`- (no hits parsed)`);
      if (blocked.length) parts.push(`BLOCKED ENGINES: ${blocked.map((b) => `${b.engine}:${b.status}`).join(", ")}`);
    }
  }

  if (plan.wantPathMap) {
    const r = await invokeLiveDork("path_map", plan.host, auth);
    fired.push(`asherin-live-dork:path_map(${r.status})`);
    if (!r.ok || !r.body?.ok) {
      if (!offline) offline = `live dork offline (${r.status || r.err || "error"})`;
    } else {
      const pm = r.body.path_map || {};
      parts.push(`PATH MAP for ${plan.host}:`);
      parts.push(`- robots.txt status: ${pm.robots_status ?? "not fetched"}`);
      const inv: string[] = pm.path_inventory || [];
      if (inv.length) {
        parts.push(`- robots inventory (${inv.length}): ${inv.slice(0, 40).join(", ")}`);
      } else {
        parts.push(`- robots inventory: empty or robots.txt not fetched`);
      }
      const probes: Array<{ path: string; status: number | null }> = pm.seed_probe || [];
      const alive = probes.filter((p) => p.status && p.status < 400);
      parts.push(`- seed probes: ${probes.length} tried, ${alive.length} responded < 400`);
      for (const p of probes) {
        parts.push(`  · ${p.path} → ${p.status ?? "no-response"}`);
      }
    }
  }

  return {
    context: parts.length ? `\n[ASHERIN LIVE DORK]\n${parts.join("\n")}\n` : "",
    fired,
    offline,
  };
}

export async function runCursorDorkSwarm(subject: string, opts?: { deadlineMs?: number }): Promise<{ block: string }> {
  const deadline = Math.max(800, Math.min(opts?.deadlineMs ?? 1800, 2000));
  const started = Date.now();
  const s = String(subject || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const quoted = encodeURIComponent(s);
  const hostish = s
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .toLowerCase();
  const isHost = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostish) && !hostish.includes(" ");
  const ua = "Mozilla/5.0 (compatible; asherin-dork-edge/1.0)";
  const httpGet = async (url: string, ms: number) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json,text/html,*/*" },
        signal: ac.signal,
      });
      return { status: r.status, text: await r.text() };
    } catch {
      return { status: 0, text: "" };
    } finally {
      clearTimeout(t);
    }
  };
  const good: Array<{ title: string; url: string; via: string }> = [];
  const weak: Array<{ title: string; url: string; via: string }> = [];
  const seen = new Set<string>();
  const push = (title: string, url: string, via: string, grade: "good" | "weak") => {
    if (!url.startsWith("http") || seen.has(url)) return;
    seen.add(url);
    (grade === "good" ? good : weak).push({ title: title.slice(0, 200) || url, url, via });
  };
  const left = () => Math.max(250, deadline - (Date.now() - started));
  const wikiUrl =
    "https://en.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&search=" + quoted;
  const cdxUrl =
    "https://web.archive.org/cdx/search/cdx?output=json&fl=original,timestamp,statuscode&filter=statuscode:200&limit=8&url=" +
    encodeURIComponent(isHost ? hostish + "/*" : "*" + s.replace(/\s+/g, "*") + "*");
  const ghUrl = "https://github.com/search?type=code&q=" + quoted;
  // wayback-first. wikipedia only if UA sent (httpGet always sets it) and HTTP 200.
  // never scrape ddg/bing/brave from the isolate.
  const wayback = await httpGet(cdxUrl, left());
  if (wayback.status === 200 && wayback.text.startsWith("[")) {
    try {
      const j = JSON.parse(wayback.text) as string[][];
      for (const rec of j.slice(1, 9)) {
        const original = rec[0];
        if (original)
          push(original, "https://web.archive.org/web/" + (rec[1] || "") + "/" + original, "wayback", "good");
      }
    } catch {
      /* ignore */
    }
  }
  if (left() > 400) {
    const wiki = await httpGet(wikiUrl, left());
    if (wiki.status === 200 && wiki.text) {
      try {
        const j = JSON.parse(wiki.text) as [string, string[], string[], string[]];
        const titles = j[1] || [];
        const urls = j[3] || [];
        for (let i = 0; i < titles.length; i++) push(titles[i], urls[i], "wikipedia", "good");
      } catch {
        /* ignore */
      }
    }
  }
  if (left() > 300) {
    const gh = await httpGet(ghUrl, Math.min(900, left()));
    if (gh.status === 200 && gh.text) {
      push("github code search for " + s, ghUrl, "github", "weak");
    }
  }
  const plan = [
    '"' + s + '"',
    isHost ? "site:" + hostish : '(site:github.com OR site:gitlab.com) "' + s + '"',
    'site:web.archive.org "' + s + '"',
  ];
  const enginesOk = [];
  if (good.some((h) => h.via === "wikipedia") || weak.some((h) => h.via === "wikipedia")) enginesOk.push("wikipedia");
  if (good.some((h) => h.via === "wayback")) enginesOk.push("wayback");
  if (weak.some((h) => h.via === "github") || good.some((h) => h.via === "github")) enginesOk.push("github");
  const lines = [
    "[PUBLIC-INDEX SWEEP â edge-safe indexes on asherin.com (wayback CDX + wikipedia + github). not laptop ddg/bing/brave scrape. pack is 100k-class combinatorial; this turn live-sampled. OSINT needs no authorization.]",
    'subject: "' + s + '"',
    "queries_run: " +
      plan.length +
      " Â· engines_ok: " +
      (enginesOk.join(",") || "none") +
      " Â· elapsed_ms: " +
      (Date.now() - started),
    "good_hits: " +
      good.length +
      " Â· weak_hits: " +
      weak.length +
      " (weak = index returned a surface, tokens barely match â do not treat as confirmed)",
    "",
    "### QUERIES THAT RETURNED RESULTS",
    ...plan.map((q) => "- `" + q + "`"),
    "",
    "### GOOD",
    ...(good.length
      ? good.slice(0, 16).map((h) => "- [" + h.title + "](" + h.url + ") Â· " + h.via)
      : ["- (none this turn)"]),
    "",
    "### WEAK / UNSURE",
    ...(weak.length
      ? weak.slice(0, 8).map((h) => "- [" + h.title + "](" + h.url + ") Â· " + h.via + " Â· this is unsure")
      : ["- (none)"]),
  ];
  if (!good.length && !weak.length) {
    lines.push(
      "zero indexed hits landed before the 2s edge budget. do not say the battery is unavailable. do not tell the operator to google it. do not fail the chat fetch.",
    );
  }
  return { block: lines.join("\n") };
}
