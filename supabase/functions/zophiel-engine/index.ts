// zophiel-engine — proxies the Zophiel Engine crawler (hosted on Railway)
// and shapes results into the SearchResponse contract the UI expects.
import { getCorsHeaders } from "../_shared/cors.ts";

const ENGINE_URL =
  Deno.env.get("ZOPHIEL_ENGINE_URL") ||
  "https://zophielengine-production.up.railway.app";
const ENGINE_TOKEN = Deno.env.get("ZOPHIEL_ENGINE_TOKEN") || "";

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 45_000;

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ENGINE_TOKEN) {
    h["Authorization"] = `Bearer ${ENGINE_TOKEN}`;
    h["X-Nonce"] = crypto.randomUUID();
    h["X-Timestamp"] = `${Date.now()}`;
  }
  return h;
}

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

async function discoverSeeds(query: string): Promise<string[]> {
  const q = query.trim();
  if (/^https?:\/\//i.test(q)) return [q];

  // Hit DDG HTML and extract real destination URLs (uddg= redirect param).
  try {
    const r = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (r.ok) {
      const html = await r.text();
      const urls = new Set<string>();
      // DDG wraps results in /l/?uddg=ENCODED_URL
      for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
        try {
          const u = decodeURIComponent(m[1]);
          if (/^https?:\/\//i.test(u) && !/duckduckgo\.com/i.test(u)) urls.add(u);
        } catch { /* noop */ }
        if (urls.size >= 10) break;
      }
      if (urls.size) return Array.from(urls);
    }
  } catch { /* noop */ }

  // Fallback: Wikipedia search page (always crawlable, on-topic).
  return [`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`];
}


Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { query, topic, max_pages = 25, max_depth = 2, js_rendering = false } =
      await req.json().catch(() => ({}));

    const q = (query || topic || "").toString().trim();
    if (!q) {
      return new Response(
        JSON.stringify({ success: false, error: "query required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // 1) Discover real seed URLs for the query, then submit crawl job
    const seeds = await discoverSeeds(q);
    const isUrl = /^https?:\/\//i.test(q);
    const submit = await fetch(`${ENGINE_URL}/v1/jobs`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        seeds,
        topic: isUrl ? null : q,
        maxDepth: max_depth,
        maxPages: max_pages,
        includeArchive: false,
        includeSitemaps: false,
        jsRendering: js_rendering,
      }),
    });



    if (!submit.ok) {
      const text = await submit.text();
      return new Response(
        JSON.stringify({ success: false, error: `engine ${submit.status}: ${text.slice(0, 300)}` }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const job = await submit.json();
    const jobId: string = job?.id;
    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "engine returned no job id" }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // 2) Poll until completed or timeout
    const start = Date.now();
    let status = job?.status || "running";
    while (status !== "completed" && status !== "failed" && Date.now() - start < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const s = await fetch(`${ENGINE_URL}/v1/jobs/${jobId}`, { headers: authHeaders() });
      if (!s.ok) break;
      const sj = await s.json();
      status = sj?.status || status;
    }

    // 3) Fetch pages (whatever we got, even if still running)
    const pagesRes = await fetch(
      `${ENGINE_URL}/v1/jobs/${jobId}/pages?limit=50`,
      { headers: authHeaders() },
    );
    const pages = pagesRes.ok ? await pagesRes.json() : [];

    // 4) Shape into SearchResponse the UI already consumes
    const results = (Array.isArray(pages) ? pages : []).map((p: any) => {
      const finalUrl = p.finalUrl || p.url;
      const archived = p.source === "wayback" && p.archiveTimestamp;
      const ts = archived ? String(p.archiveTimestamp) : "";
      const archivedNote = archived
        ? ` • archived ${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
        : "";
      return {
        title: p.title || hostOf(finalUrl) || "Untitled",
        url: finalUrl,
        snippet: `Engine: ${p.engine || "auto"} • Source: ${p.source || "live"}${archivedNote} • Depth ${p.depth ?? 0}`,
        source: hostOf(p.url || finalUrl),
        tier: 3,
        tierLabel: "Zophiel Crawl",
        category: "primary",
      };
    });

    const grouped: Record<string, any[]> = { primary: results };

    return new Response(
      JSON.stringify({
        success: true,
        query: q,
        builtQuery: q,
        mode: "web",
        instantAnswer: null,
        instantAnswerType: null,
        results,
        grouped,
        freshnessAlerts: {},
        page: 1,
        totalResults: results.length,
        engineJobId: jobId,
        engineStatus: status,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
