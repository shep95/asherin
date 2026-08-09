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

    // DuckDuckGo's lite endpoint now answers datacenter IPs with HTTP 202 and
    // the plain homepage — a 2xx carrying no results, which the old parser read
    // as "no hits". This function keeps its name and contract but is served by
    // the hardened surface tier, which challenge-checks bodies, breaks the
    // circuit on blocked providers and falls back across independent indexes.
    const { runSurfaceWave } = await import("../_shared/surfaceRetrieval.ts");
    const wave = await runSurfaceWave(String(query), { limit: Number(numResults) || 8 });
    const results: SearchResult[] = wave.hits.slice(0, Number(numResults) || 8).map((h) => ({
      title: h.title,
      url: h.url,
      snippet: h.snippet,
    }));

    console.log(`ddg-search: ${results.length} results, live providers ${wave.liveProviders}`);
    return new Response(
      JSON.stringify({ results, providers: wave.telemetry, escalated: wave.escalated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("surface search error:", e);
    return new Response(JSON.stringify({ results: [], error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
