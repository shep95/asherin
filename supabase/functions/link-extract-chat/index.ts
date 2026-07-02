// LINK EXTRACT CHAT — Aureon-brain-powered streaming chat assistant scoped to a
// link extraction session. Loads active brains from public.axrlen_brains and
// answers questions about the dossier + intel map.
//
// Strict BYOK: non-admin callers MUST supply a BYOK config.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { isValidByok, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";
import { runOsintPipeline } from "../_shared/osintStack.ts";
import { runPropertyPipeline } from "../_shared/propertyIntel.ts";
import { runAxrlenBridge } from "../_shared/axrlenBridge.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

interface ChatMessage { role: "user" | "assistant" | "system"; content: string; }

async function loadBrainsContext(brainIds: string[] | undefined): Promise<string> {
  if (!brainIds?.length) return "";
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data } = await sb
      .from("axrlen_brains")
      .select("name, system_prompt, knowledge_text")
      .in("id", brainIds.slice(0, 5))
      .eq("is_active", true);
    if (!data?.length) return "";
    return data.map((b: any) =>
      `## BRAIN: ${b.name}\n${b.system_prompt || ""}\n${(b.knowledge_text || "").slice(0, 4000)}`
    ).join("\n\n---\n\n").slice(0, 20000);
  } catch { return ""; }
}

async function callGeminiStream(apiKey: string, model: string, sys: string, msgs: ChatMessage[]) {
  const contents = msgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
      }),
    },
  );
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => "");
    throw new Error(`gemini_stream_${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.body;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, dossier, intelMap, brainIds, byok = null } = await req.json() as {
      messages: ChatMessage[];
      dossier?: unknown;
      intelMap?: unknown;
      brainIds?: string[];
      byok?: ZophielByokConfig | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolved;
    try { resolved = await resolveKey(req, byok); }
    catch (e: any) { return byokErrorResponse(e, corsHeaders); }

    // Streaming only supports Gemini today; force BYOK to Gemini for non-admins.
    let apiKey: string;
    let model: string;
    if (resolved.mode === "byok") {
      if (!isValidByok(resolved.byok) || resolved.byok!.provider !== "google") {
        return new Response(JSON.stringify({
          error: "BYOK_REQUIRED", message: "Link Extract Chat needs a Google/Gemini BYOK key.",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      apiKey = resolved.byok!.apiKey;
      model = resolved.byok!.model || "gemini-2.5-flash";
    } else {
      apiKey = resolved.geminiKey!;
      model = "gemini-2.5-flash";
    }

    const brainsCtx = await loadBrainsContext(brainIds);

    // ── Live OSINT enrichment ────────────────────────────────────────────────
    // Runs the free zero-key global intel stack (GDELT, SEC EDGAR, OpenSky,
    // World Bank, IMF, Wikipedia, USASpending, OpenFDA, UN Comtrade, FX,
    // Overpass/OSM) only when the last user message contains OSINT-shaped
    // intent (country, company, ticker, currency, conflict, filings…).
    // Per-source timeout is 4.5s and failures are silently skipped, so this
    // never blocks the stream for long or breaks URL-only questions.
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const [osint, property] = await Promise.all([
      runOsintPipeline(lastUser).catch(() => ({ sources: [] as string[], context: "", errors: [] as string[] })),
      runPropertyPipeline(lastUser).catch(() => ({
        fired: false, addresses: [] as string[], evidence: "",
        attachments: { map: null, sources: [] as unknown[] }, errors: [] as string[],
      })),
    ]);

    const sys = `You are an Aureon URL-forensics intelligence assistant operating inside the Link Extractor. Speak as a surgical intelligence officer: BOLD direct headers, Markdown tables for data, no apologies, no fluff.

RESPONSE RULE: Simple question, simple answer.

You have access to:
1. The forensic DOSSIER for the target URL (extraction payload).
2. The INTEL MAP graph (entities + relationships) built from the dossier.
3. Active Aureon BRAINS that shape your tone and domain bias.
4. LIVE OSINT PULL — real-time evidence from free global intelligence APIs
   (GDELT, SEC EDGAR, OpenSky, World Bank, IMF, Wikipedia, USASpending,
   OpenFDA, UN Comtrade, FX, Overpass/OSM). When present, cite it inline like
   [GDELT] or [SEC] and prefer it over your training data for anything
   time-sensitive.
5. LIVE PROPERTY EVIDENCE — when the user asks about a physical property or
   address, cited scrapes from Zillow / Redfin / Realtor / assessor sites plus
   a geocode. Cite each fact as [zillow.com] / [redfin.com] / [nyc.gov] etc.
   Flag conflicts between sources explicitly.

Answer the user's questions strictly grounded in the dossier, map, live OSINT, and property evidence. When the user asks for "everything you can find" — list every entity in the map, group by type, and cross-reference with dossier evidence. Do NOT invent facts. If something is not in the dossier or live evidence, say so plainly.

${brainsCtx ? "ACTIVE BRAINS CONTEXT:\n" + brainsCtx + "\n\n" : ""}DOSSIER:\n${JSON.stringify(dossier || {}).slice(0, 8000)}\n\nINTEL MAP:\n${JSON.stringify(intelMap || {}).slice(0, 6000)}${osint.context}${property.evidence}`;

    const stream = await callGeminiStream(apiKey, model, sys, messages);

    // Re-stream as plain text chunks (UI parses SSE deltas).
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const out = new ReadableStream({
      async start(controller) {
        // 1. Emit an [[AUREON_META]] JSON block so the client can render the
        //    PropertyMapCard + PropertySourcesStrip beneath the assistant
        //    message. Client strips this from displayed text. Always emitted
        //    (empty attachments allowed) so parsing is deterministic.
        const meta = {
          osintSources: osint.sources,
          property: property.fired ? property.attachments : null,
        };
        controller.enqueue(encoder.encode(`[[AUREON_META]]${JSON.stringify(meta)}[[/AUREON_META]]\n`));

        // 2. Human-visible OSINT footer (unchanged).
        if (osint.sources.length) {
          controller.enqueue(encoder.encode(
            `> **Live OSINT sources consulted:** ${osint.sources.join(" · ")}\n\n`
          ));
        }
        if (property.fired && property.attachments.sources.length) {
          controller.enqueue(encoder.encode(
            `> **Property evidence:** ${property.attachments.sources.map((s: any) => s.domain).join(" · ")}\n\n`
          ));
        }
        const reader = stream.getReader();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const json = line.slice(5).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const d = JSON.parse(json);
                const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (t) controller.enqueue(encoder.encode(t));
              } catch { /* ignore partial chunks */ }
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`\n\n[stream error: ${String((e as any)?.message || e)}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(out, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
