// ZOPHIEL ONION SEARCH — Indexes .onion content via Ahmia (clearnet → Tor index).
// Always-on companion to zophiel-search. Returns SearchResult-shaped objects with
// tier=5 ("ONION") so they merge cleanly into the main result stream.
//
// Hard rules:
//   - Never returns a clickable .onion link without flagging onion=true so the UI
//     renders a "Tor required" affordance instead of a normal anchor.
//   - All content is treated as UNVERIFIED (low veracity floor). Onion sources
//     are NEVER promoted above clearnet primary/established sources by sort.

// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

interface OnionResult {
  title: string;
  url: string;            // .onion URL (NOT clickable in UI)
  snippet: string;
  source: string;         // .onion host
  tier: 5;
  tierLabel: "Onion (Unverified)";
  category: "general";
  onion: true;
  publishDate?: string;
  truthGraph: {
    tier: 5;
    tierLabel: "Onion (Unverified)";
    provenanceScore: number;   // floored at 0.15 — never trust by default
    freshnessScore: number;
    hostileFlag: false;
    consensusWeight: number;
  };
  veracity: number;            // capped at 45 — onion never beats clearnet primary
}

function extractOnionHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    const m = url.match(/([a-z2-7]{16,56}\.onion)/i);
    return m ? m[1] : url;
  }
}

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Ahmia returns search?q=... as HTML. We parse <li class="result"> blocks.
async function searchAhmia(query: string, limit: number): Promise<OnionResult[]> {
  const url = `https://ahmia.fi/search/?q=${encodeURIComponent(query)}`;
  let html = "";
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.warn("[onion] ahmia non-200", r.status);
      return [];
    }
    html = await r.text();
  } catch (e) {
    console.warn("[onion] ahmia fetch failed", (e as Error).message);
    return [];
  }

  const out: OnionResult[] = [];
  const blockRe = /<li[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null && out.length < limit) {
    const block = m[1];

    // Title + onion url. Ahmia wraps the title in <a href="https://ahmia.fi/search/redirect?...&redirect_url=<onion>">
    const titleMatch = block.match(/<h4>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h4>/i)
      || block.match(/<a[^>]+class="[^"]*result-title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    let onionUrl = "";
    const cite = block.match(/<cite>([\s\S]*?)<\/cite>/i);
    if (cite) onionUrl = clean(cite[1]);
    if (!onionUrl) {
      // Fallback: try to extract from redirect param
      const redir = titleMatch[1].match(/redirect_url=([^&]+)/);
      if (redir) onionUrl = decodeURIComponent(redir[1]);
    }
    if (!onionUrl || !/\.onion(?:\/|$|:)/i.test(onionUrl)) continue;

    const title = clean(titleMatch[2]) || extractOnionHost(onionUrl);

    const snipMatch = block.match(/<p>([\s\S]*?)<\/p>/i);
    const snippet = snipMatch ? clean(snipMatch[1]) : "";

    // Date if Ahmia exposes it
    const dateMatch = block.match(/<span[^>]*class="[^"]*lastSeen[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const publishDate = dateMatch ? clean(dateMatch[1]) : undefined;

    out.push({
      title,
      url: onionUrl,
      snippet,
      source: extractOnionHost(onionUrl),
      tier: 5,
      tierLabel: "Onion (Unverified)",
      category: "general",
      onion: true,
      publishDate,
      truthGraph: {
        tier: 5,
        tierLabel: "Onion (Unverified)",
        provenanceScore: 0.15,
        freshnessScore: publishDate ? 0.5 : 0.3,
        hostileFlag: false,
        consensusWeight: 0,
      },
      veracity: Math.min(45, 25 + (snippet ? 5 : 0) + (publishDate ? 5 : 0)),
    });
  }

  return out;
}

// Optional second source: torch-style mirrors via Ahmia onions.json fallback if html parse failed.
async function ahmiaJsonFallback(query: string, limit: number): Promise<OnionResult[]> {
  try {
    const r = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}&format=json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json().catch(() => null);
    const arr = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
    const out: OnionResult[] = [];
    for (const item of arr) {
      if (out.length >= limit) break;
      const onionUrl = item.url || item.onion || item.link;
      if (!onionUrl || !/\.onion/i.test(onionUrl)) continue;
      const snippet = clean(item.description || item.snippet || "");
      out.push({
        title: clean(item.title || extractOnionHost(onionUrl)),
        url: onionUrl,
        snippet,
        source: extractOnionHost(onionUrl),
        tier: 5,
        tierLabel: "Onion (Unverified)",
        category: "general",
        onion: true,
        publishDate: item.lastSeen || item.indexed || undefined,
        truthGraph: {
          tier: 5,
          tierLabel: "Onion (Unverified)",
          provenanceScore: 0.15,
          freshnessScore: 0.3,
          hostileFlag: false,
          consensusWeight: 0,
        },
        veracity: 30,
      });
    }
    return out;
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const query = (body?.query || "").trim();
    const limit = Math.min(20, Math.max(1, Number(body?.limit) || 8));

    if (!query) {
      return new Response(JSON.stringify({ success: false, error: "query required", results: [] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results = await searchAhmia(query, limit);
    if (results.length === 0) {
      results = await ahmiaJsonFallback(query, limit);
    }

    return new Response(
      JSON.stringify({
        success: true,
        query,
        source: "ahmia",
        results,
        totalResults: results.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[onion] fatal", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "onion search failed",
        results: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
