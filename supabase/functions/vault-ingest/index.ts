// VAULT-INGEST — Ingests a text payload (or fetches an API source) into the
// caller's Aureon Vault: chunks → embeds → stores. Pro-tier only.
//
// Request body:
//   { name: string, sourceType: "file"|"text"|"api",
//     content?: string,                       // for file/text
//     apiUrl?: string, apiHeaders?: object,   // for api
//     refreshMinutes?: number,                // for api
//     sourceId?: string                       // reuse existing source (refresh)
//   }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireTier } from "../_shared/tierGate.ts";
import { chunkText, embedTexts, approxTokens } from "../_shared/vaultEmbed.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB per source per ingest

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireTier(req, ["pro", "lifetime"], corsHeaders);
    if (!gate.ok) return gate.response!;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    let userId: string | undefined;
    if (gate.isAdmin) {
      // Admins still need a real user_id to file the rows under. Fall back to caller JWT.
      const auth = req.headers.get("Authorization") || "";
      const { data } = await sb.auth.getUser(auth.replace("Bearer ", ""));
      userId = data.user?.id;
    } else {
      const { data } = await (sb as any).rpc("get_user_id_by_email", { _email: gate.email });
      userId = typeof data === "string" ? data : undefined;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "no_user" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").slice(0, 200).trim();
    const sourceType = body.sourceType as "file" | "text" | "api" | "url" | "youtube";
    if (!name || !["file", "text", "api", "url", "youtube"].includes(sourceType)) {
      return new Response(JSON.stringify({ error: "bad_input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve raw text we will chunk.
    let rawText = "";
    if (sourceType === "api") {
      const url = String(body.apiUrl ?? "");
      if (!isPublicHttpUrl(url)) {
        return new Response(JSON.stringify({ error: "api_url_required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const headers = (body.apiHeaders && typeof body.apiHeaders === "object")
        ? body.apiHeaders as Record<string, string>
        : {};
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20_000);
      const r = await fetch(url, { headers, signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) {
        return new Response(JSON.stringify({ error: `api_${r.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ct = r.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = await r.json();
        rawText = JSON.stringify(j, null, 2);
      } else {
        rawText = await r.text();
      }
    } else if (sourceType === "url" || sourceType === "youtube") {
      const url = String(body.url ?? body.apiUrl ?? "");
      if (!isPublicHttpUrl(url)) {
        return new Response(JSON.stringify({ error: "url_required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        rawText = sourceType === "youtube"
          ? await fetchYoutubeTranscript(url)
          : await fetchReadableText(url);
      } catch (e) {
        return new Response(JSON.stringify({
          error: e instanceof Error ? e.message : "fetch_failed",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      rawText = String(body.content ?? "");
    }


    rawText = rawText.replace(/\u0000/g, "").trim();
    if (!rawText) {
      return new Response(JSON.stringify({ error: "empty_content" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rawText.length > MAX_BYTES) rawText = rawText.slice(0, MAX_BYTES);

    // Create or reuse the source row.
    let sourceId: string = String(body.sourceId ?? "") || "";
    if (sourceId) {
      // Verify ownership and wipe old chunks before re-ingest.
      const { data: existing } = await sb
        .from("aureon_vault_sources")
        .select("id,user_id")
        .eq("id", sourceId)
        .maybeSingle();
      if (!existing || existing.user_id !== userId) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await sb.from("aureon_vault_chunks").delete().eq("source_id", sourceId);
      await sb.from("aureon_vault_sources").update({
        status: "ingesting", error_message: null, name,
      }).eq("id", sourceId);
    } else {
      const { data: src, error } = await sb.from("aureon_vault_sources").insert({
        user_id: userId,
        name,
        source_type: sourceType,
        api_url: sourceType === "api" ? String(body.apiUrl ?? "") : null,
        api_headers: sourceType === "api" ? (body.apiHeaders ?? null) : null,
        refresh_minutes: sourceType === "api"
          ? Math.max(0, Math.min(10080, Number(body.refreshMinutes ?? 0))) || null
          : null,
        status: "ingesting",
      }).select("id").single();
      if (error || !src) {
        return new Response(JSON.stringify({ error: "insert_failed", detail: error?.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sourceId = src.id;
    }

    // Chunk + embed.
    const chunks = chunkText(rawText, 1200, 150);
    if (!chunks.length) {
      await sb.from("aureon_vault_sources").update({
        status: "error", error_message: "no_chunks",
      }).eq("id", sourceId);
      return new Response(JSON.stringify({ error: "no_chunks" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let embeddings: number[][];
    try {
      embeddings = await embedTexts(chunks);
    } catch (e) {
      await sb.from("aureon_vault_sources").update({
        status: "error",
        error_message: e instanceof Error ? e.message.slice(0, 300) : "embed_failed",
      }).eq("id", sourceId);
      throw e;
    }

    const rows = chunks.map((content, i) => ({
      source_id: sourceId,
      user_id: userId,
      chunk_index: i,
      content,
      embedding: embeddings[i],
      token_count: approxTokens(content),
    }));

    // Insert in batches to keep payloads small.
    const STEP = 50;
    for (let i = 0; i < rows.length; i += STEP) {
      const slice = rows.slice(i, i + STEP);
      const { error } = await sb.from("aureon_vault_chunks").insert(slice);
      if (error) {
        await sb.from("aureon_vault_sources").update({
          status: "error", error_message: error.message.slice(0, 300),
        }).eq("id", sourceId);
        throw error;
      }
    }

    await sb.from("aureon_vault_sources").update({
      status: "ready",
      chunk_count: rows.length,
      byte_size: rawText.length,
      last_refresh_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", sourceId);

    return new Response(JSON.stringify({
      success: true,
      sourceId,
      chunkCount: rows.length,
      bytes: rawText.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[vault-ingest] fatal", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "ingest_failed",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
