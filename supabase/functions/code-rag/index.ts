// CODE-RAG — Phase 4 Aureon IDE
// Two actions:
//   - index:   chunk + embed + upsert file contents into asher_code_embeddings
//   - search:  embed a query, return top-k semantically similar chunks
//   - hover:   embed symbol + context, return short Aureon-Code explanation grounded in RAG
//
// Uses Lovable AI Gateway embeddings (openai/text-embedding-3-small, 1536 dims)
// and gemini-flash for hover explanations. JWT verified manually.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMS = 1536;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

async function sha1(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function chunk(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!text) return [];
  if (text.length <= size) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

async function embed(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.data ?? []).map((d: any) => d.embedding);
}

async function aiChat(messages: any[]): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json();
    const action = String(body.action || "");
    const projectId = String(body.project_id || "");
    if (!projectId) return new Response(JSON.stringify({ error: "project_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---------- INDEX ----------
    if (action === "index") {
      const files: Array<{ id: string; path: string; content: string; language?: string }> = body.files || [];
      if (!files.length) return new Response(JSON.stringify({ indexed: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });

      let indexed = 0;
      // Process files sequentially in small batches to keep token & memory bounded
      for (const f of files) {
        if (!f.content || f.content.length < 20) continue;
        const chunks = chunk(f.content);
        const hashes = await Promise.all(chunks.map(sha1));

        // Fetch existing hashes for this file
        const { data: existing } = await admin
          .from("asher_code_embeddings")
          .select("chunk_index, content_hash")
          .eq("user_id", user.id).eq("project_id", projectId).eq("file_id", f.id);
        const existingMap = new Map<number, string>((existing ?? []).map(r => [r.chunk_index, r.content_hash]));

        // Determine which chunks need re-embedding
        const toEmbed: { idx: number; text: string; hash: string }[] = [];
        for (let i = 0; i < chunks.length; i++) {
          if (existingMap.get(i) !== hashes[i]) toEmbed.push({ idx: i, text: chunks[i], hash: hashes[i] });
        }

        // Delete stale chunks beyond new length
        if ((existing?.length ?? 0) > chunks.length) {
          await admin.from("asher_code_embeddings")
            .delete().eq("user_id", user.id).eq("project_id", projectId).eq("file_id", f.id).gte("chunk_index", chunks.length);
        }

        if (toEmbed.length) {
          const vectors = await embed(toEmbed.map(t => `File: ${f.path}\n\n${t.text}`));
          const rows = toEmbed.map((t, i) => ({
            user_id: user.id, project_id: projectId, file_id: f.id, file_path: f.path,
            chunk_index: t.idx, content: t.text, content_hash: t.hash,
            language: f.language ?? null, embedding: vectors[i] as any,
          }));
          const { error } = await admin.from("asher_code_embeddings")
            .upsert(rows, { onConflict: "user_id,project_id,file_id,chunk_index" });
          if (error) throw error;
          indexed += rows.length;
        }
      }

      return new Response(JSON.stringify({ indexed }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---------- SEARCH ----------
    if (action === "search") {
      const query = String(body.query || "").slice(0, 4000);
      const k = Math.min(Math.max(Number(body.k) || 6, 1), 12);
      if (!query) return new Response(JSON.stringify({ matches: [] }), { headers: { ...cors, "Content-Type": "application/json" } });
      const [vec] = await embed([query]);
      const { data, error } = await admin.rpc("match_asher_code_chunks", {
        _user_id: user.id, _project_id: projectId, query_embedding: vec as any, match_count: k,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ matches: data ?? [] }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---------- HOVER ----------
    if (action === "hover") {
      const symbol = String(body.symbol || "").slice(0, 200);
      const filePath = String(body.file_path || "");
      const language = String(body.language || "");
      const lineText = String(body.line_text || "").slice(0, 400);
      const surrounding = String(body.surrounding || "").slice(0, 2000);
      if (!symbol) return new Response(JSON.stringify({ markdown: "" }), { headers: { ...cors, "Content-Type": "application/json" } });

      // Retrieve RAG context for the symbol
      const [vec] = await embed([`${symbol}\n${lineText}\n${surrounding.slice(0, 800)}`]);
      const { data: matches } = await admin.rpc("match_asher_code_chunks", {
        _user_id: user.id, _project_id: projectId, query_embedding: vec as any, match_count: 4,
      });
      const ctx = (matches ?? [])
        .filter((m: any) => m.file_path !== filePath || Math.abs((m.similarity ?? 0)) > 0.4)
        .slice(0, 3)
        .map((m: any) => `// ${m.file_path} (chunk ${m.chunk_index}, sim ${(m.similarity ?? 0).toFixed(2)})\n${m.content.slice(0, 600)}`)
        .join("\n\n");

      const markdown = await aiChat([
        { role: "system", content: "You are AUREON CODE hover-intel. Reply with 1-3 dense bullet lines in Markdown explaining the symbol in context. Use **bold** for the symbol. If it's a function, give a one-line signature. If a variable, give inferred type. No filler, no apologies, never mention models or vendors." },
        { role: "user", content: `LANGUAGE: ${language}\nFILE: ${filePath}\nLINE: ${lineText}\nSYMBOL: ${symbol}\n\nSURROUNDING CODE:\n\`\`\`${language}\n${surrounding}\n\`\`\`\n\nRELATED PROJECT CONTEXT:\n${ctx || "(none)"}` },
      ]);

      return new Response(JSON.stringify({ markdown }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---------- PURGE ----------
    if (action === "purge") {
      await admin.from("asher_code_embeddings").delete().eq("user_id", user.id).eq("project_id", projectId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("code-rag error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
