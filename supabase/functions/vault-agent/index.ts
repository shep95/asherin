// VAULT-AGENT — Natural-language automation layer over the Asherin Vault.
// Takes a plain-English command and autonomously decides to:
//   WRITE        → chunk + embed the given content
//   FETCH_WRITE  → fetch a URL/API, normalize to text, then ingest
//   QUERY        → semantic-search the vault and answer with citations
//
// Request:  { command: string }
// Response: { intent, message, sourceId?, chunkCount?, matches?, answer? }
//
// Pro-tier only. Uses Gemini for intent classification + answer synthesis.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireTier } from "../_shared/tierGate.ts";
import { chunkText, embedTexts, approxTokens } from "../_shared/vaultEmbed.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MAX_BYTES = 2 * 1024 * 1024;
const MODEL = "gemini-flash-latest";

type Intent = "WRITE" | "FETCH_WRITE" | "QUERY";
interface Classified {
  intent: Intent;
  name?: string;
  content?: string;
  url?: string;
  question?: string;
  reason?: string;
}

async function classify(command: string): Promise<Classified> {
  if (!GEMINI_KEY) throw new Error("classifier_unavailable");
  const prompt = `You are the routing brain of Asherin's Knowledge Vault agent.
Classify the user's command into ONE of:

- "WRITE"       → user pasted or dictated content to store. Extract a short "name" (title) and the "content" verbatim.
- "FETCH_WRITE" → user wants Asherin to go fetch data from a URL, API, or well-known open dataset. Provide the canonical "url" (must be https and publicly accessible without auth), and a short "name". If the user only names a source (e.g. "CoinGecko BTC price"), map it to the correct public endpoint (e.g. https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd).
- "QUERY"       → user is asking a question that should be answered from vault contents. Put the raw question in "question".

Return STRICT JSON: {"intent":"...","name":"...","content":"...","url":"...","question":"...","reason":"one short line"}
Only include fields relevant to the chosen intent. No markdown, no prose.

COMMAND:
${command}`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!r.ok) throw new Error(`classify_${r.status}`);
  const j = await r.json();
  const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  const intent = String(parsed?.intent ?? "").toUpperCase() as Intent;
  if (!["WRITE", "FETCH_WRITE", "QUERY"].includes(intent)) {
    throw new Error("bad_intent");
  }
  return { ...parsed, intent };
}

async function synthesize(question: string, ctx: string): Promise<string> {
  if (!GEMINI_KEY) return "Vault answer unavailable (no synth key).";
  const prompt = `You are Asherin. Answer the user's question using ONLY the vault excerpts below.
Cite source names inline as [source]. If the excerpts do not contain the answer, say so plainly.

QUESTION:
${question}

VAULT EXCERPTS:
${ctx}`;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!r.ok) return "Vault answer failed.";
  const j = await r.json();
  return String(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() || "No answer.";
}

async function ingestText(
  sb: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  content: string,
  sourceType: "text" | "api",
  apiUrl: string | null,
) {
  let rawText = content.replace(/\u0000/g, "").trim();
  if (!rawText) throw new Error("empty_content");
  if (rawText.length > MAX_BYTES) rawText = rawText.slice(0, MAX_BYTES);

  const { data: src, error } = await sb.from("aureon_vault_sources").insert({
    user_id: userId,
    name: name.slice(0, 200),
    source_type: sourceType,
    api_url: apiUrl,
    status: "ingesting",
  }).select("id").single();
  if (error || !src) throw new Error(`insert_failed:${error?.message ?? ""}`);
  const sourceId = (src as { id: string }).id;

  const chunks = chunkText(rawText, 1200, 150);
  if (!chunks.length) {
    await sb.from("aureon_vault_sources").update({ status: "error", error_message: "no_chunks" }).eq("id", sourceId);
    throw new Error("no_chunks");
  }
  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((c, i) => ({
    source_id: sourceId,
    user_id: userId,
    chunk_index: i,
    content: c,
    embedding: embeddings[i],
    token_count: approxTokens(c),
  }));
  const STEP = 50;
  for (let i = 0; i < rows.length; i += STEP) {
    const { error: e2 } = await sb.from("aureon_vault_chunks").insert(rows.slice(i, i + STEP));
    if (e2) {
      await sb.from("aureon_vault_sources").update({ status: "error", error_message: e2.message.slice(0, 300) }).eq("id", sourceId);
      throw e2;
    }
  }
  await sb.from("aureon_vault_sources").update({
    status: "ready",
    chunk_count: rows.length,
    byte_size: rawText.length,
    last_refresh_at: new Date().toISOString(),
  }).eq("id", sourceId);
  return { sourceId, chunkCount: rows.length };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireTier(req, ["pro", "lifetime"], corsHeaders);
    if (!gate.ok) return gate.response!;

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
      return new Response(JSON.stringify({ error: "no_user" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { command } = await req.json().catch(() => ({}));
    const cmd = String(command ?? "").trim();
    if (!cmd) {
      return new Response(JSON.stringify({ error: "empty_command" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const decision = await classify(cmd);

    // ─── WRITE ─────────────────────────────────────────────
    if (decision.intent === "WRITE") {
      const name = (decision.name || "Untitled note").trim();
      const content = (decision.content || "").trim();
      if (!content) {
        return new Response(JSON.stringify({
          intent: "WRITE",
          message: "I couldn't extract content from that command. Paste the material you want stored.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { sourceId, chunkCount } = await ingestText(sb, userId, name, content, "text", null);
      return new Response(JSON.stringify({
        intent: "WRITE",
        sourceId,
        chunkCount,
        message: `Stored "${name}" as ${chunkCount} indexed chunk${chunkCount === 1 ? "" : "s"}.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── FETCH + WRITE ────────────────────────────────────
    if (decision.intent === "FETCH_WRITE") {
      const url = String(decision.url || "").trim();
      if (!/^https:\/\//i.test(url)) {
        return new Response(JSON.stringify({
          intent: "FETCH_WRITE",
          message: "I couldn't resolve a public HTTPS endpoint from that request. Try naming the source (e.g. \"CoinGecko BTC price\") or paste the URL.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20_000);
      let rawText = "";
      try {
        const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "AsherinVaultAgent/1.0" } });
        clearTimeout(t);
        if (!r.ok) throw new Error(`http_${r.status}`);
        const ct = r.headers.get("content-type") ?? "";
        rawText = ct.includes("application/json")
          ? JSON.stringify(await r.json(), null, 2)
          : await r.text();
      } catch (e) {
        return new Response(JSON.stringify({
          intent: "FETCH_WRITE",
          message: `Fetch failed for ${url}: ${(e as Error).message}`,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Strip HTML tags if the response is HTML — keep it as clean text.
      if (/<html/i.test(rawText.slice(0, 400))) {
        rawText = rawText.replace(/<script[\s\S]*?<\/script>/gi, " ")
                         .replace(/<style[\s\S]*?<\/style>/gi, " ")
                         .replace(/<[^>]+>/g, " ")
                         .replace(/\s+/g, " ").trim();
      }
      const name = (decision.name || new URL(url).hostname).trim();
      const { sourceId, chunkCount } = await ingestText(sb, userId, name, rawText, "api", url);
      return new Response(JSON.stringify({
        intent: "FETCH_WRITE",
        sourceId,
        chunkCount,
        url,
        message: `Fetched ${url} and indexed "${name}" as ${chunkCount} chunk${chunkCount === 1 ? "" : "s"}.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── QUERY ────────────────────────────────────────────
    const question = String(decision.question || cmd).trim();
    const [qEmbed] = await embedTexts([question]);
    if (!qEmbed) {
      return new Response(JSON.stringify({ intent: "QUERY", message: "Embedding failed.", matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: matches, error } = await (sb as any).rpc("match_vault_chunks", {
      _user_id: userId,
      query_embedding: qEmbed,
      match_count: 6,
    });
    if (error) throw error;
    const list = (matches ?? []) as Array<{ source_id: string; content: string; similarity: number }>;
    const ids = Array.from(new Set(list.map((m) => m.source_id)));
    let nameById: Record<string, string> = {};
    if (ids.length) {
      const { data: srcs } = await sb.from("aureon_vault_sources").select("id,name").in("id", ids);
      for (const s of (srcs ?? []) as Array<{ id: string; name: string }>) nameById[s.id] = s.name;
    }
    const hydrated = list.map((m) => ({
      sourceName: nameById[m.source_id] ?? "vault",
      similarity: m.similarity,
      content: m.content,
    }));
    const ctx = hydrated.map((m) => `[${m.sourceName}] ${m.content}`).join("\n\n---\n\n");
    const answer = hydrated.length
      ? await synthesize(question, ctx)
      : "The vault is empty (or no chunk matched). Add material and ask again.";
    return new Response(JSON.stringify({
      intent: "QUERY",
      question,
      matches: hydrated,
      answer,
      message: `Retrieved ${hydrated.length} chunk${hydrated.length === 1 ? "" : "s"}.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[vault-agent] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "agent_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
