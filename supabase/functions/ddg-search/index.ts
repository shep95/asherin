import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require authenticated caller — prevent anonymous scraping abuse.
  // Trusted server-to-server callers (other edge functions) present the
  // service-role key, which is not a user JWT and would fail requireUser.
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const isInternal = Boolean(SERVICE_ROLE) && bearer === SERVICE_ROLE;
  if (!isInternal) {
    const { requireUser, authErrorResponse } = await import("../_shared/authMiddleware.ts");
    try { await requireUser(req); } catch (e) { return authErrorResponse(e, corsHeaders); }
  }


  try {
    const { query, numResults = 8 } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("DuckDuckGo search:", query);

    // Use DuckDuckGo lite endpoint (simpler HTML, easier to parse)
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://lite.duckduckgo.com/lite/`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html",
      },
      body: `q=${encodedQuery}`,
    });

    if (!response.ok) {
      console.error("DDG response error:", response.status);
      return new Response(JSON.stringify({ results: [], error: "Search failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await response.text();
    const results: SearchResult[] = [];

    // Parse the lite HTML - results are in table rows with specific classes
    // Pattern: <a rel="nofollow" href="URL" class='result-link'>TITLE</a>
    // followed by snippet in <td class="result-snippet">
    
    const linkRegex = /class='result-link'[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const links: { url: string; title: string }[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let url = match[1].trim();
      const title = match[2].replace(/<[^>]*>/g, "").trim();
      
      // Handle DDG redirect URLs
      if (url.includes("duckduckgo.com/l/")) {
        const uddg = url.match(/uddg=([^&]*)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
      }
      
      if (title && url) {
        links.push({ url, title: decodeEntities(title) });
      }
    }

    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(decodeEntities(match[1].replace(/<[^>]*>/g, "").trim()));
    }

    for (let i = 0; i < Math.min(links.length, numResults); i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || "",
      });
    }

    // Fallback: try alternative parsing if no results found
    if (results.length === 0) {
      // Try parsing <a> tags with rel="nofollow" that link to external sites
      const altRegex = /<a[^>]*rel="nofollow"[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
      const altLinks: { url: string; title: string }[] = [];
      while ((match = altRegex.exec(html)) !== null) {
        const url = match[1].trim();
        const title = match[2].trim();
        if (title && url && !url.includes("duckduckgo.com")) {
          altLinks.push({ url, title: decodeEntities(title) });
        }
      }
      
      for (let i = 0; i < Math.min(altLinks.length, numResults); i++) {
        results.push({
          title: altLinks[i].title,
          url: altLinks[i].url,
          snippet: "",
        });
      }
    }

    console.log(`Found ${results.length} results`);
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("DDG search error:", e);
    return new Response(JSON.stringify({ results: [], error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
