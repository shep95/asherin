// VAULT-RETRIEVE — embeds the query and returns top-K relevant chunks from
// the caller's Asherin Vault. Pro-tier only. Used by the chat function and by
// the Vault UI's "preview retrieval" feature.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireTier } from "../_shared/tierGate.ts";
import { embedTexts } from "../_shared/vaultEmbed.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireTier(req, ["pro", "lifetime"], corsHeaders);
    if (!gate.ok) return gate.response!;

    const { query, k } = await req.json().catch(() => ({}));
    const q = String(query ?? "").trim();
    if (!q) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const matchCount = Math.max(1, Math.min(12, Number(k ?? 6)));

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    let userId: string | undefined;
    if (gate.isAdmin) {
      const auth = req.headers.get("Authorization") || "";
      const { data } = await sb.auth.getUser(auth.replace("Bearer ", ""));
      userId = data.user?.id;
    } else {
      const { data } = await (sb as any).rpc("get_user_id_by_email", { _email: gate.email });
      userId = typeof data === "string" ? data : undefined;
    }
    if (!userId) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [qEmbed] = await embedTexts([q]);
    if (!qEmbed) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: matches, error } = await sb.rpc("match_vault_chunks", {
      _user_id: userId,
      query_embedding: qEmbed as unknown as string,
      match_count: matchCount,
    });
    if (error) throw error;

    // Hydrate with source names for display.
    const ids = Array.from(new Set((matches ?? []).map((m: any) => m.source_id)));
    let nameById: Record<string, string> = {};
    if (ids.length) {
      const { data: srcs } = await sb.from("aureon_vault_sources")
        .select("id,name").in("id", ids);
      for (const s of (srcs ?? [])) nameById[s.id] = s.name;
    }

    return new Response(JSON.stringify({
      matches: (matches ?? []).map((m: any) => ({
        sourceId: m.source_id,
        sourceName: nameById[m.source_id] ?? "vault",
        content: m.content,
        similarity: m.similarity,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[vault-retrieve] fatal", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "retrieve_failed",
      matches: [],
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
