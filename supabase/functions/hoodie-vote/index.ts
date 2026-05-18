// HOODIE VOTE — one vote per visitor IP.
// IP is sha-256 hashed (never stored in cleartext). Service role inserts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, getClientIp } from "../_shared/cors.ts";

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // Always return current totals (GET or POST)
    if (req.method === "GET") {
      const { data, error } = await supa.rpc("hoodie_vote_totals");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return new Response(
        JSON.stringify({ yes: Number(row?.yes_count ?? 0), no: Number(row?.no_count ?? 0) }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const vote = body?.vote;
    if (vote !== "yes" && vote !== "no") {
      return new Response(JSON.stringify({ error: "vote must be 'yes' or 'no'" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const ip = getClientIp(req);
    const salt = Deno.env.get("HOODIE_VOTE_SALT") ?? "aureon-hoodie-2026";
    const ipHash = await sha256(`${salt}:${ip}`);
    const ua = (req.headers.get("user-agent") || "").slice(0, 256);

    const { error: insErr } = await supa
      .from("hoodie_votes")
      .insert({ ip_hash: ipHash, vote, user_agent: ua });

    let alreadyVoted = false;
    if (insErr) {
      // 23505 = unique violation -> already voted from this IP
      if ((insErr as any).code === "23505") {
        alreadyVoted = true;
      } else {
        throw insErr;
      }
    }

    const { data, error } = await supa.rpc("hoodie_vote_totals");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({
        ok: true,
        alreadyVoted,
        yes: Number(row?.yes_count ?? 0),
        no: Number(row?.no_count ?? 0),
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Vote failed" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
