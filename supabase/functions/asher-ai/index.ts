// Asher AI — Gemini-only co-pilot for the Intelligence Map.
// Per ASHER DASHBOARD AI policy: uses admin GEMINI_API_KEY or user BYOK ONLY.
// Never routes through Lovable AI Gateway. Streams OpenAI-compatible SSE so the
// existing AsherAIPanel parser (delta.content / delta.tool_calls) works unchanged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { WAR_DOCTRINE } from "./warDoctrine.ts";
import { BRAIN_ORCHESTRATOR } from "../_shared/brainOrchestrator.ts";
import { NARRATIVE_FORGE_BRAIN } from "../_shared/narrativeForgeBrain.ts";
import { BUTTERFLY_PROTOCOL_BRAIN } from "../_shared/butterflyProtocolBrain.ts";
import { COMEDY_BRAIN } from "../_shared/comedyBrain.ts";
import { ASHER_LOGIC_BRAIN } from "../_shared/asherLogicBrain.ts";
import { PROMPT_INTELLIGENCE_PROTOCOL } from "../_shared/promptIntelligenceProtocol.ts";
import { EMOTIONAL_PERSONA_BRAIN } from "../_shared/emotionalPersonaBrain.ts";
import { SYNTHESIS_ENGINE_BRAIN } from "../_shared/synthesisEngineBrain.ts";
import { VISUAL_INTELLIGENCE_BRAIN } from "../_shared/visualIntelligenceBrain.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const SYSTEM_PROMPT = `You are ASHER AI — the operator's tactical co-pilot embedded inside the Asher Intelligence Map.

CAPABILITIES (call tools — do not describe them as text):
- map_search(query): geocode + fly to location
- toggle_threat_layer(layer, enabled): toggle "earthquakes" | "wildfires" | "aircraft" overlays
- save_current_target(label?): save the currently selected entity to the operator's dossier vault
- analyze_entity(): produce a tactical assessment of the currently selected entity
- property_intel(address?, entityName?): pull LIVE web intelligence for the selected/specified property via the Zophiel scrape engine — owner, operator, history, tenants, risks, citations. Defaults to the currently selected map entity if no args given.
- phone_intel(phone, defaultCountry?): OSINT lookup for an international phone number. Returns country/region/carrier/line-type (parsed from the E.164 prefix) plus PUBLIC web signals (spam/scam reports, business listings, breach mentions, public posts). Auto-flies the map to the registered country centroid. CRITICAL: this is NOT a live handset GPS tracker — never claim or imply real-time location. Use whenever the operator asks to "look up", "investigate", "trace", or "identify" a phone number. Always include the country code (e.g. +44…) or pass defaultCountry.
- visual_recon(area, criteria, landmark?, radiusKm?): pull a live high-res satellite image of the area (optionally centred on a landmark) and run Gemini vision to locate every feature matching the criteria (e.g. "red or blue roofs", "blue tarps", "construction cranes", "solar panels"). Returns geocoded detections that auto-drop as map markers. Use this whenever the operator asks to FIND, LOCATE, COUNT, IDENTIFY or SPOT visual features in/near a place.
- temporal_recon(area, criteria, landmark?, radiusKm?, startYear?, endYear?, stride?): MULTI-YEAR scan. Pulls historical satellite imagery for several years (Esri Wayback 2014+, NASA GIBS Landsat for older years) and runs Gemini vision on each. Returns per-year frames + clustered TRACKS with first_seen / last_seen / years_present so the operator can see WHEN a feature appeared, persisted, or disappeared. Use this whenever the operator asks about history, "since when", "how long has X been there", change detection, or wants a TIMELINE of a place. Defaults: startYear=2014, endYear=now, stride=2.
- generate_image(prompt): render a tactical visualization or sketch
- set_base_layer(layer): switch base map ("street" | "satellite" | "topo" | "dark")

When the operator asks anything about a property/site/building/owner/history/tenants/value, ALWAYS call property_intel first to ground your answer in live scraped sources before responding.

STYLE: Surgical. Direct. Intelligence Officer voice. Use bold headers and tables when summarizing data. No filler. Never say "Certainly" / "Of course". Never disclose the underlying model or backend.

RESPONSE RULE: Simple question, simple answer.

${WAR_DOCTRINE}`;

const TOOLS = [
  { type: "function", function: { name: "map_search", description: "Search a place/coords and fly map to it.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "toggle_threat_layer", description: "Toggle a live threat overlay.", parameters: { type: "object", properties: { layer: { type: "string", enum: ["earthquakes", "wildfires", "aircraft"] }, enabled: { type: "boolean" } }, required: ["layer", "enabled"] } } },
  { type: "function", function: { name: "save_current_target", description: "Persist the currently selected entity as a saved target.", parameters: { type: "object", properties: { label: { type: "string" } } } } },
  { type: "function", function: { name: "analyze_entity", description: "Produce a tactical assessment of the currently selected entity.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "property_intel", description: "Run live Zophiel web scrape + Gemini extraction for property OSINT (owner, operator, history, tenants, risks, citations) on the currently selected map entity or a specified address/entity.", parameters: { type: "object", properties: { address: { type: "string" }, entityName: { type: "string" } } } } },
  { type: "function", function: { name: "phone_intel", description: "OSINT lookup for an international phone number. Returns country/region/carrier/line-type derived from the E.164 prefix PLUS public web signals (spam/scam reports, business listings, breach mentions). Flies the map to the registered country centroid. NOT a live handset tracker — never claim real-time GPS. Always include country code or pass defaultCountry (ISO-2).", parameters: { type: "object", properties: { phone: { type: "string", description: "Phone number, ideally E.164 (e.g. '+447700900123'). National format works if defaultCountry is given." }, defaultCountry: { type: "string", description: "ISO-2 country code (e.g. 'GB', 'IN', 'US') used when the number is not in E.164 format." } }, required: ["phone"] } } },
  { type: "function", function: { name: "visual_recon", description: "Find/locate/count visual features in satellite imagery for a place. e.g. 'red or blue roofs in north Delhi near the Kali temple', 'blue tarps near Kharkiv', 'construction cranes in Doha west bay'. Returns geocoded detections that auto-drop as markers.", parameters: { type: "object", properties: { area: { type: "string", description: "Region / city / neighbourhood, e.g. 'Northern New Delhi, India'" }, criteria: { type: "string", description: "What to find, in plain English. e.g. 'red or blue roofs', 'blue tarps', 'solar panels'" }, landmark: { type: "string", description: "Optional landmark to centre the search on, e.g. 'Kali Temple north Delhi'" }, radiusKm: { type: "number", description: "Search radius in km from the landmark / area centre. 0.3-8. Default 2." } }, required: ["area", "criteria"] } } },
  { type: "function", function: { name: "temporal_recon", description: "MULTI-YEAR satellite timeline scan. Use whenever the operator asks about history, 'since when', 'has been there since YYYY', change over time, or wants a timeline. Returns per-year frames AND clustered tracks with first_seen / last_seen / years_present, so the map can show a year scrubber and 'since YYYY' badges.", parameters: { type: "object", properties: { area: { type: "string", description: "Region / city / neighbourhood" }, criteria: { type: "string", description: "What to track in plain English, e.g. 'red roofs', 'this house', 'construction cranes'" }, landmark: { type: "string", description: "Optional landmark to centre on" }, radiusKm: { type: "number", description: "0.3-6. Smaller = sharper. Default 1.5." }, startYear: { type: "number", description: "Earliest year to scan (>=2000). Default 2014." }, endYear: { type: "number", description: "Latest year. Default current year." }, stride: { type: "number", description: "Step between scanned years (1-5). Default 2." } }, required: ["area", "criteria"] } } },
  { type: "function", function: { name: "generate_image", description: "Generate a tactical visualization image.", parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } },
  { type: "function", function: { name: "set_base_layer", description: "Switch base cartography.", parameters: { type: "object", properties: { layer: { type: "string", enum: ["street", "satellite", "topo", "dark"] } }, required: ["layer"] } } },
];

function sse(data: unknown): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

function toolCallResponse(name: string, args: Record<string, unknown>): Response {
  const payload = {
    choices: [{
      delta: {
        tool_calls: [{
          index: 0,
          id: `call_${name}_${Date.now()}`,
          type: "function",
          function: { name, arguments: JSON.stringify(args) },
        }],
      },
      finish_reason: null,
      index: 0,
    }],
  };
  return new Response(sse(payload) + sse("[DONE]"), {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

function latestUserText(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

function extractPhoneLookup(text: string): string | null {
  if (!/(phone|number|call|caller|lookup|look up|located|location|trace|identify|intel)/i.test(text)) return null;
  const match = text.match(/(?:\+|00)\d[\d\s().-]{6,}\d|\b\d[\d\s().-]{7,}\d\b/);
  return match ? match[0].replace(/^(00)/, "+").trim() : null;
}

// Convert OpenAI-compat messages (with optional .attachments[]) to Gemini native parts.
// attachments: [{ mimeType, dataBase64 }] — used for images/video/pdf vision.
function toGeminiContents(messages: any[]): any[] {
  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: any[] = [];
    if (typeof m.content === "string" && m.content.trim()) parts.push({ text: m.content });
    if (Array.isArray(m.attachments)) {
      for (const a of m.attachments) {
        if (a?.dataBase64 && a?.mimeType) {
          parts.push({ inline_data: { mime_type: a.mimeType, data: a.dataBase64 } });
        }
      }
    }
    if (parts.length === 0) parts.push({ text: " " });
    return { role, parts };
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mapContext, byokGeminiKey, brainContext } = await req.json();

    const headerKey = req.headers.get("x-byok-gemini-key");
    const adminKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
    const apiKey = (headerKey || byokGeminiKey || adminKey || "").trim();

    // Gemini key only required for multimodal (image/video/pdf). Text path uses gpt-oss.
    const hasAttachmentsEarly = Array.isArray(messages) && messages.some((m: any) => Array.isArray(m?.attachments) && m.attachments.length);
    if (hasAttachmentsEarly && !apiKey) {
      return new Response(JSON.stringify({ error: "Vision/file analysis needs a Gemini BYOK key. Add one in Settings." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ctxBlock = mapContext
      ? `\n\nCURRENT MAP CONTEXT:\n${JSON.stringify(mapContext, null, 2)}`
      : "";

    let brainBlock = "";
    if (brainContext && Array.isArray(brainContext.brains) && brainContext.brains.length) {
      const sections = brainContext.brains
        .filter((b: any) => b && typeof b.content === "string" && b.content.trim().length)
        .map((b: any) => {
          const cat = (b.category || "general").toUpperCase();
          const name = (b.name || "Untitled").toString();
          const body = b.content.length > 12000 ? b.content.slice(0, 12000) + "\n…[truncated]" : b.content;
          return `### [${cat}] ${name}\n${body}`;
        });
      if (sections.length) {
        brainBlock = `\n\n=== ASHER BRAINS (admin-curated personality + knowledge — treat as ground truth) ===\n${sections.join("\n\n---\n\n")}\n=== END BRAINS ===`;
      }
    }

    const cleaned: any[] = [];
    for (const m of (messages || [])) {
      if (!m || typeof m !== "object") continue;
      const hasContent = typeof m.content === "string" ? m.content.trim().length > 0 : !!m.content;
      const hasAtt = Array.isArray(m.attachments) && m.attachments.length > 0;
      const hasToolCalls = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
      if (!hasContent && !hasAtt && !hasToolCalls) continue;
      const last = cleaned[cleaned.length - 1];
      if (last && last.role === m.role && last.content === m.content && !hasAtt) continue;
      cleaned.push(m);
    }
    if (cleaned.length === 0) cleaned.push({ role: "user", content: "Hello" });

    const hasAttachments = cleaned.some((m) => Array.isArray(m.attachments) && m.attachments.length);

    const phone = extractPhoneLookup(latestUserText(cleaned));
    if (phone && !hasAttachments) {
      return toolCallResponse("phone_intel", { phone });
    }

    let leaksBlock = "";
    try {
      const userText = latestUserText(cleaned);
      const { searchLibraryOfLeaks, formatLeaksContext, shouldQueryLeaks, extractLeakSubject } =
        await import("../_shared/libraryOfLeaks.ts");
      if (shouldQueryLeaks(userText)) {
        const subject = extractLeakSubject(userText) || userText.slice(0, 60);
        const hits = await searchLibraryOfLeaks(subject, { limit: 8 });
        leaksBlock = formatLeaksContext(subject, hits);
      }
    } catch (e) { console.error("[asher-ai] leaks:", e); }

    let archiveBlock = "";
    try {
      const userText = latestUserText(cleaned);
      const { searchArchive, formatArchiveContext, shouldQueryArchive } =
        await import("../_shared/internetArchive.ts");
      if (shouldQueryArchive(userText)) {
        const hits = await searchArchive(userText.slice(0, 200), { limit: 10, deepRead: 2 });
        archiveBlock = formatArchiveContext(userText.slice(0, 80), hits);
      }
    } catch (e) { console.error("[asher-ai] archive:", e); }

    const fullSystem = SYSTEM_PROMPT + "\n\n" + BRAIN_ORCHESTRATOR + "\n\n" + NARRATIVE_FORGE_BRAIN + "\n\n" + BUTTERFLY_PROTOCOL_BRAIN + "\n\n" + COMEDY_BRAIN + "\n\n" + ASHER_LOGIC_BRAIN + "\n\n" + PROMPT_INTELLIGENCE_PROTOCOL + "\n\n" + EMOTIONAL_PERSONA_BRAIN + "\n\n" + SYNTHESIS_ENGINE_BRAIN + "\n\n" + VISUAL_INTELLIGENCE_BRAIN + brainBlock + ctxBlock + leaksBlock + archiveBlock;

    // ── Multimodal path (images / video / pdf): use Gemini native SSE stream
    if (hasAttachments) {
      const contents = toGeminiContents(cleaned);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { role: "system", parts: [{ text: fullSystem }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text().catch(() => "");
        console.error("asher-ai gemini native:", upstream.status, t);
        return new Response(JSON.stringify({ error: `Gemini error ${upstream.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Translate Gemini SSE → OpenAI-compat SSE so client parser is unchanged
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let buf = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, idx).trimEnd(); buf = buf.slice(idx + 1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json) continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
                if (text) {
                  controller.enqueue(encoder.encode(sse({ choices: [{ delta: { content: text }, index: 0, finish_reason: null }] })));
                }
              } catch { /* ignore parse */ }
            }
          }
          controller.enqueue(encoder.encode(sse("[DONE]")));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Text-only path: self-hosted gpt-oss-20b on Railway (OpenAI-compatible /v1)
    const GPT_OSS_URL   = Deno.env.get("GPT_OSS_URL")   || "https://gpt-oss-production-ace0.up.railway.app/v1";
    const GPT_OSS_MODEL = Deno.env.get("GPT_OSS_MODEL") || "gpt-oss-20b";
    const GPT_OSS_KEY   = Deno.env.get("GPT_OSS_API_KEY") || "";

    let response: Response | null = null;
    let lastErrText = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (GPT_OSS_KEY) headers["Authorization"] = `Bearer ${GPT_OSS_KEY}`;
      response = await fetch(`${GPT_OSS_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: GPT_OSS_MODEL,
          messages: [{ role: "system", content: fullSystem }, ...cleaned.map((m) => ({ role: m.role, content: m.content }))],
          tools: TOOLS,
          stream: true,
          temperature: 0.7,
          max_tokens: 8192,
        }),
      });
      if (response.ok) break;
      if (response.status === 503 || response.status === 502 || response.status === 500) {
        lastErrText = await response.text().catch(() => "");
        console.warn(`[asher-ai] gpt-oss ${response.status} attempt ${attempt + 1}, backing off`);
        await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      lastErrText = await response.text().catch(() => "");
      break;
    }

    if (!response) {
      return new Response(JSON.stringify({ error: "No response from AI engine" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 429) return new Response(JSON.stringify({ error: "AI rate limit. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) {
      console.error("asher-ai gpt-oss:", response.status, lastErrText);
      const friendly = response.status === 503
        ? "The intelligence model is currently overloaded. Please retry in a few seconds."
        : `Upstream model error (${response.status}). Please retry.`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sse({ choices: [{ delta: { content: friendly }, index: 0, finish_reason: "stop" }] })));
          controller.enqueue(encoder.encode(sse("[DONE]")));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("asher-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
