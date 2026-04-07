import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_IDENTITY = `You are AUREON — NEXUS-PRIME, the supreme cross-domain intelligence oracle integrated into the AXRLEN predictive platform. You are a TIME MANIPULATION INTERFACE and an ORACLE.

Your ENTIRE knowledge, personality, analytical framework, response format, and domain expertise comes from the BRAIN DOCUMENTS below. These brains are your training — they define HOW you think, WHAT you know, and HOW you respond.

RULES:
1. Synthesize ALL brain content into every response — cross-reference across all uploaded brains.
2. NEVER give short answers. Be comprehensive, layered, and deeply analytical.
3. Use markdown formatting with bold headers, horizontal rules, and structured sections.
4. Be DEFINITIVE in predictions — you are an oracle, not a diplomat.
5. If no brains are loaded, inform the user that the AXRLEN knowledge base has not been configured yet.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sessionContext } = await req.json();
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Fetch ALL active brains — these ARE the system prompt
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    let brainContent = "";
    try {
      const { data: brains } = await sb
        .from("axrlen_brains")
        .select("name, content")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (brains && brains.length > 0) {
        brainContent = brains
          .map((b: any) => `\n════════════════════════════════════════\nBRAIN: ${b.name.toUpperCase()}\n════════════════════════════════════════\n\n${b.content}`)
          .join("\n\n");
      }
    } catch (e) {
      console.error("Failed to fetch axrlen brains:", e);
    }

    // Session context injection (if user has an active session)
    let sessionBlock = "";
    if (sessionContext?.title) {
      sessionBlock = `\n\n════════════════════════════════════════\nACTIVE SESSION CONTEXT\n════════════════════════════════════════\n\nSESSION TITLE: ${sessionContext.title}\nREGION: ${sessionContext.region || "Global"}\nCONFIDENCE: ${sessionContext.confidenceScore || "N/A"}%\nSTATUS: ${sessionContext.status || "unknown"}\nSUMMARY: ${sessionContext.aiSummary || "None"}\nPREDICTIONS: ${JSON.stringify(sessionContext.predictions || [])}\nTHREATS: ${JSON.stringify(sessionContext.threatAssessment || {})}\nRESOURCES: ${JSON.stringify(sessionContext.resourceAnalysis || {})}\nPOLICY SIMS: ${JSON.stringify(sessionContext.policySimulations || [])}\nTIMELINE DIVERGENCES: ${JSON.stringify(sessionContext.timelineDivergences || [])}\nDATA SOURCES: ${JSON.stringify(sessionContext.dataSources || {})}`;
    }

    const systemPrompt = BASE_IDENTITY + "\n" + brainContent + sessionBlock;

    // Convert chat messages to Gemini format
    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 65536,
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error:", status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE to OpenAI-compatible SSE format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const oaiChunk = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${oaiChunk}\n\n`));
                }
              } catch { /* skip partial */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("axrlen-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
