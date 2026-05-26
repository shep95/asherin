// Asher Eyes proxy — fetches Aleph (libraryofleaks.org) resources server-side
// to bypass browser CORS for file downloads and search API calls.
import { getCorsHeaders } from "../_shared/cors.ts";
let cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

const ALLOWED = /^https:\/\/(search\.)?libraryofleaks\.org\//i;

Deno.serve(async (req) => {
  cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Require authenticated caller — prevent open SSRF/proxy abuse
    const { requireUser, authErrorResponse } = await import("../_shared/authMiddleware.ts");
    try { await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

    const u = new URL(req.url);
    const target = u.searchParams.get("url");
    if (!target || !ALLOWED.test(target)) {
      return new Response(JSON.stringify({ error: "invalid target" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    const r = await fetch(target, {
      headers: { "User-Agent": "AsherEyes/1.0", Accept: "*/*" },
    });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: r.status,
      headers: {
        ...cors,
        "content-type": r.headers.get("content-type") || "application/octet-stream",
        "content-disposition": r.headers.get("content-disposition") || "",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
