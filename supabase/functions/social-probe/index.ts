import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Temporary reachability probe. Establishes, from the real Deno/datacenter
 * egress the production adapters will use, which social surfaces answer and
 * which block. Consumer-IP results from a dev sandbox do not transfer — many
 * platforms blackhole datacenter ranges specifically.
 */
async function probe(name: string, url: string, headers: Record<string, string> = {}) {
  const started = Date.now();
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", ...headers },
      signal: AbortSignal.timeout(20000),
    });
    const body = await r.text();
    return { name, status: r.status, bytes: body.length, ms: Date.now() - started, head: body.slice(0, 160) };
  } catch (e) {
    return { name, status: 0, bytes: 0, ms: Date.now() - started, head: `THREW: ${(e as Error).message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results = await Promise.all([
    probe("instagram_api", "https://www.instagram.com/api/v1/users/web_profile_info/?username=nasa", {
      "X-IG-App-ID": "936619743392459",
    }),
    probe("linkedin_public", "https://www.linkedin.com/in/williamhgates/"),
    probe("facebook_public", "https://www.facebook.com/nasa"),
    probe("x_syndication", "https://cdn.syndication.twimg.com/timeline/profile?screen_name=nasa"),
  ]);

  return new Response(JSON.stringify({ egress: "supabase-edge", results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
