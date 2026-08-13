// session-context — returns the network context of the CALLER as seen by the
// edge, so the browser never has to ask a third party (ipify / ipapi) who it
// is. That old path leaked every operator's IP to two external services on
// every sign-in and returned nothing the edge did not already know.
//
// Auth: gateway verifies the JWT; we still re-derive the user in code.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (error || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const fwd = req.headers.get("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;

    return json({
      ip,
      // Cloudflare-populated when present; null rather than invented.
      country: req.headers.get("cf-ipcountry") || null,
      city: req.headers.get("cf-ipcity") || null,
      region: req.headers.get("cf-region") || null,
    });
  } catch {
    return json({ ip: null, country: null, city: null, region: null });
  }
});
