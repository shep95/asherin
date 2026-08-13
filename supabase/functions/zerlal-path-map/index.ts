// Zerlal path map — defensive recon inventory endpoint.
//
// Inventory and findings CLASSES only. This function never reproduces a
// payload, never verifies a class by exercising it, and never returns
// attacker instructions. What it returns is: which hosts and paths answer,
// what each response actually shipped, and which protective classes are
// unmet — with the live quote attached and contact strings masked.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { runPathMap, normalizeTarget } from "../_shared/zerlalPathMap.ts";

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const domain = typeof body.domain === "string" ? body.domain : "";
    if (!domain || domain.length > 255) return json({ error: "A domain is required." }, 400, cors);

    let target: ReturnType<typeof normalizeTarget>;
    try {
      target = normalizeTarget(domain);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Invalid target." }, 400, cors);
    }

    const result = await runPathMap(target.url, {
      maxPaths: Number(body.max_paths) || 28,
      maxSubdomains: Number(body.max_subdomains) ?? 6,
    });

    return json({ ok: true, ...result }, 200, cors);
  } catch (err) {
    console.error("zerlal-path-map error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500, cors);
  }
});
