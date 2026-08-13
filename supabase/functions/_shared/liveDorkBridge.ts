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
