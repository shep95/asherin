// URL INTEL MAP — deterministic, no AI, no BYOK.
// Given any URL, scrape it via Firecrawl and extract every observable
// connection: mentions/handles, hashtags, outbound links, related domains,
// emails, phones, headings, social profiles, key entities + a screenshot.
//
// Designed for paste-a-URL-into-search workflows (e.g. x.com/MonaBets).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeUrl(input: string): string | null {
  try {
    const raw = input.trim();
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    return u.toString();
  } catch { return null; }
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function countBy<T extends string>(arr: T[]): { value: T; count: number }[] {
  const m = new Map<T, number>();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  return Array.from(m, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

const STOP = new Set("the of and to a in is it for on with that by this as at from be or are was were has have had not but they we you he she his her them their our your an if so do does did can will would could should about into over more most other some any all one two three new news com www html http https".split(" "));

function extractProperNouns(text: string, max = 25) {
  const matches = text.match(/\b[A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{2,}){0,3}\b/g) || [];
  const cleaned = matches
    .map((m) => m.trim())
    .filter((m) => !STOP.has(m.toLowerCase()) && m.length < 60);
  return countBy(cleaned).slice(0, max);
}

async function firecrawlScrape(url: string, apiKey: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html", "links", "screenshot"],
      onlyMainContent: false,
      waitFor: 2500,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `firecrawl ${r.status}`);
  return data?.data ?? data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json().catch(() => ({} as { url?: string }));
    const target = url ? normalizeUrl(url) : null;
    if (!target) {
      return new Response(JSON.stringify({ success: false, error: "valid url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scraped: any = null;
    let scrapeError: string | null = null;
    try { scraped = await firecrawlScrape(target, apiKey); }
    catch (e: any) { scrapeError = e?.message || "scrape_failed"; }

    const md: string = scraped?.markdown || "";
    const html: string = scraped?.html || "";
    const links: string[] = Array.isArray(scraped?.links) ? scraped.links : [];
    const screenshot: string | null = scraped?.screenshot || null;
    const meta = scraped?.metadata || {};
    const text = (md || html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

    const rootDomain = domainOf(target);

    // ============ DETERMINISTIC EXTRACTION ============
    const handles = uniq(((text + " " + md).match(/(?<![\w/])@[A-Za-z0-9_]{2,30}\b/g) || [])
      .map((h) => h.toLowerCase()));
    const hashtags = uniq(((text + " " + md).match(/(?<![\w/])#[A-Za-z0-9_]{2,40}\b/g) || [])
      .map((h) => h.toLowerCase()));
    const emails = uniq((text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map((e) => e.toLowerCase()));
    const phones = uniq(text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || []);
    const urls = uniq([...(links || []), ...((md.match(/https?:\/\/[^\s)\]<>"']+/g) || []))])
      .map((u) => u.replace(/[),.;:]+$/, ""))
      .filter((u) => {
        try { new URL(u); return true; } catch { return false; }
      });

    const outboundLinks = urls.filter((u) => domainOf(u) && domainOf(u) !== rootDomain);
    const internalLinks = urls.filter((u) => domainOf(u) === rootDomain && u !== target);
    const domainCounts = countBy(outboundLinks.map(domainOf).filter(Boolean)).slice(0, 40);

    // social mapping
    const socialPatterns: Array<[string, RegExp]> = [
      ["x.com", /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{2,30})(?!\/status)/gi],
      ["instagram.com", /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,40})/gi],
      ["youtube.com", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)?([A-Za-z0-9_.-]{2,60})/gi],
      ["tiktok.com", /https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{2,40})/gi],
      ["github.com", /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_-]{2,40})\b/gi],
      ["linkedin.com", /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/([A-Za-z0-9_-]{2,80})/gi],
      ["facebook.com", /https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_.-]{2,60})/gi],
      ["reddit.com", /https?:\/\/(?:www\.)?reddit\.com\/(?:r|u|user)\/([A-Za-z0-9_-]{2,40})/gi],
      ["t.me", /https?:\/\/t\.me\/([A-Za-z0-9_]{2,40})/gi],
      ["discord", /https?:\/\/(?:discord\.gg|discord\.com\/invite)\/([A-Za-z0-9_-]{4,40})/gi],
    ];
    const socials: Record<string, string[]> = {};
    const blob = md + "\n" + urls.join("\n");
    for (const [host, re] of socialPatterns) {
      const out = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(blob)) !== null) {
        const h = m[1].toLowerCase();
        if (!["share", "intent", "home", "explore", "search", "i", "settings"].includes(h)) out.add(h);
      }
      if (out.size) socials[host] = Array.from(out).slice(0, 50);
    }

    // x.com / twitter — mentions inside tweet text are STRONG connection signals
    const tweetMentions = countBy(
      ((md.match(/(?<![\w/])@[A-Za-z0-9_]{2,30}\b/g) || []) as string[])
        .map((h) => h.toLowerCase()),
    ).slice(0, 50);

    // headings
    const headings = (md.match(/^#{1,3}\s+.+$/gm) || [])
      .map((h) => h.replace(/^#+\s+/, "").trim())
      .filter((h) => h.length > 2 && h.length < 180)
      .slice(0, 30);

    // key sentences (first informative ones)
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40 && s.length < 300).slice(0, 8);

    const entities = extractProperNouns(text, 30);

    // Build graph nodes/edges (for UI visualization)
    const nodes: any[] = [{ id: "target", label: rootDomain || target, type: "target", url: target }];
    const edges: any[] = [];

    tweetMentions.slice(0, 20).forEach((h) => {
      const id = `mention:${h.value}`;
      nodes.push({ id, label: h.value, type: "mention", count: h.count });
      edges.push({ source: "target", target: id, label: "mentions", weight: h.count });
    });
    Object.entries(socials).forEach(([host, handles]) => {
      handles.slice(0, 10).forEach((h) => {
        const id = `social:${host}:${h}`;
        nodes.push({ id, label: `${h}`, type: "social", host });
        edges.push({ source: "target", target: id, label: `linked on ${host}`, weight: 1 });
      });
    });
    domainCounts.slice(0, 15).forEach((d) => {
      const id = `domain:${d.value}`;
      nodes.push({ id, label: d.value, type: "domain", count: d.count });
      edges.push({ source: "target", target: id, label: "links to", weight: d.count });
    });
    hashtags.slice(0, 15).forEach((h) => {
      const id = `tag:${h}`;
      nodes.push({ id, label: h, type: "hashtag" });
      edges.push({ source: "target", target: id, label: "topic", weight: 1 });
    });
    entities.slice(0, 15).forEach((e) => {
      const id = `entity:${e.value}`;
      nodes.push({ id, label: e.value, type: "entity", count: e.count });
      edges.push({ source: "target", target: id, label: "names", weight: e.count });
    });

    const result = {
      success: true,
      target,
      domain: rootDomain,
      scrapeError,
      meta: {
        title: meta?.title || meta?.ogTitle || "",
        description: meta?.description || meta?.ogDescription || "",
        statusCode: meta?.statusCode ?? null,
        language: meta?.language || "",
        siteName: meta?.ogSiteName || "",
        sourceURL: meta?.sourceURL || target,
        image: meta?.ogImage || "",
      },
      screenshot,
      stats: {
        words: text.split(/\s+/).filter(Boolean).length,
        outboundLinks: outboundLinks.length,
        internalLinks: internalLinks.length,
        uniqueDomains: domainCounts.length,
        handles: handles.length,
        hashtags: hashtags.length,
        emails: emails.length,
        phones: phones.length,
      },
      handles: handles.slice(0, 100),
      tweetMentions,
      hashtags: hashtags.slice(0, 60),
      emails,
      phones,
      socials,
      domainCounts,
      outboundLinks: outboundLinks.slice(0, 200),
      internalLinks: internalLinks.slice(0, 200),
      headings,
      keySentences: sentences,
      entities,
      graph: { nodes, edges },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as any)?.message || e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
