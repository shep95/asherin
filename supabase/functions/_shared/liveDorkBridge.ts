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
const TRIGGER_RE = /\b(dork|inurl:|filetype:|site:|login|signin|contact|admin|path\s*map|map\s+.*paths|robots\.txt|sitemap)\b/i;
// Words that look like TLDs but are prose. Kept small so "example.com" still fires.
const HOST_STOPLIST = new Set([
  "e.g", "i.e", "u.s", "u.k",
]);

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

export async function runLiveDork(plan: DorkPlan, auth: string | null): Promise<{
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
  const deadline = Math.max(2500, Math.min(opts?.deadlineMs ?? 5500, 7000));
  const started = Date.now();
  const s = String(subject || "").trim().replace(/^["']|["']$/g, "");
  const quoted = '"' + s + '"';
  const hostish = s.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  const isHost = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostish) && !hostish.includes(" ");
  const site = isHost ? "site:" + hostish + " " : "";
  const plan = [
    quoted,
    site + "(inurl:login OR inurl:signin OR inurl:auth)",
    "(site:github.com OR site:gitlab.com) " + quoted,
    "site:web.archive.org " + quoted,
  ].filter((q) => q.trim().length > 2).slice(0, 4);
  const noise = ["captcha", "are you a robot", "access denied", "pardon our interruption"];
  const engineHosts = ["duckduckgo.com", "bing.com", "brave.com", "yandex.", "mojeek.com", "microsoft.com"];
  const ua = "Mozilla/5.0 (compatible; asherin-dork-swarm/1.0)";
  const seen = new Set<string>();
  const good: Array<{ title: string; url: string; via: string }> = [];
  const weak: Array<{ title: string; url: string; via: string }> = [];
  const enginesOk = new Set<string>();
  const httpGet = async (url: string, ms: number) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "text/html,*/*" }, signal: ac.signal });
      return { status: r.status, html: await r.text() };
    } catch {
      return { status: 0, html: "" };
    } finally {
      clearTimeout(t);
    }
  };
  const anchors = (html: string, via: string, limit: number) => {
    const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    const out: Array<{ title: string; url: string; via: string }> = [];
    while ((m = re.exec(html)) && out.length < limit) {
      let href = m[1];
      const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
      if (href.includes("uddg=")) {
        try {
          const uddg = new URL(href, "https://duckduckgo.com").searchParams.get("uddg");
          if (uddg) href = decodeURIComponent(uddg);
        } catch { /* keep */ }
      }
      if (href.startsWith("//")) href = "https:" + href;
      if (!href.startsWith("http")) continue;
      const blob = (title + " " + href).toLowerCase();
      if (noise.some((n) => blob.includes(n))) continue;
      try {
        const host = new URL(href).hostname.toLowerCase();
        if (engineHosts.some((h) => host.includes(h.replace(/\.$/, "")))) continue;
      } catch { continue; }
      if (seen.has(href)) continue;
      seen.add(href);
      out.push({ title: title || href, url: href, via });
    }
    return out;
  };
  const grade = (h: { title: string; url: string }) => {
    const blob = (h.title + " " + h.url).toLowerCase();
    const tokens = s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const n = tokens.filter((t) => blob.includes(t)).length;
    return n >= Math.min(2, tokens.length) || blob.includes(s.toLowerCase()) ? "good" : "weak";
  };
  let queriesRun = 0;
  for (const q of plan) {
    if (Date.now() - started > deadline - 400) break;
    queriesRun += 1;
    const left = deadline - (Date.now() - started);
    const per = Math.max(700, Math.min(1600, left - 150));
    const rows = await Promise.allSettled([
      httpGet("https://html.duckduckgo.com/html/?" + new URLSearchParams({ q }).toString(), per).then((r) => ({ via: "duckduckgo", ...r })),
      httpGet("https://www.bing.com/search?" + new URLSearchParams({ q }).toString(), per).then((r) => ({ via: "bing", ...r })),
      httpGet("https://search.brave.com/search?" + new URLSearchParams({ q }).toString(), peri.then((r) => ({ via: "brave", ...r })),
    ]);
    for (const row of rows) {
      if (row.status !== "fulfilled") continue;
      const hits = anchors(row.value.html, row.value.via, 6);
      if (hits.length) enginesOk.add(row.value.via);
      for (const h of hits) (grade(h) === "good" ? good : weak).push(h);
    }
  }
  const lines = [
    "[PUBLIC-INDEX SWEEP — cursor search-swarm port on asherin.com. pack is 100k-class combinatorial; this turn live-sampled. OSINT needs no authorization.]",
    'subject: "' + s + '"',
    "queries_run: " + queriesRun + " / planned " + plan.length + " · engines_ok: " + (Array.from(enginesOk).join(",") || "none") + " · elapsed_ms: " + (Date.now() - started),
    "good_hits: " + good.length + " · weak_hits: " + weak.length + " (weak = engine returned it, tokens barely match — do not treat as confirmed)",
    "",
    "### QUERIES THAT RETURNED RESULTS",
    ...plan.slice(0, queriesRun).map((q) => "- `" + q + "`"),
    "",
    "### GOOD",
    ...(good.length ? good.slice(0, 24).map((h) => "- [" + h.title + "](" + h.url + ") · " + h.via) : ["- (none this turn)"]),
    "",
    "### WEAK / UNSURE",
    ...(weak.length ? weak.slice(0, 12).map((h) => "- [" + h.title + "](" + h.url + ") · " + h.via + " · this is unsure") : ["- (none)"]),
  ];
  if (!good.length && !weak.length) {
    lines.push("zero indexed hits landed before the turn budget. do not say the battery is unavailable. do not tell the operator to google it.");
  }
  return { block: lines.join("\n") };
}
