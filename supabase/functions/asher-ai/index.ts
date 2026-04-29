// Asher AI — Gemini-only co-pilot for the Intelligence Map.
// Per ASHER DASHBOARD AI policy: uses admin GEMINI_API_KEY or user BYOK ONLY.
// Never routes through Lovable AI Gateway. Streams OpenAI-compatible SSE so the
// existing AsherAIPanel parser (delta.content / delta.tool_calls) works unchanged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { WAR_DOCTRINE } from "./warDoctrine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-byok-gemini-key",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mapContext, byokGeminiKey } = await req.json();

    // Resolve key: user BYOK (header or body) > admin GEMINI_API_KEY
    const headerKey = req.headers.get("x-byok-gemini-key");
    const adminKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
    const apiKey = (headerKey || byokGeminiKey || adminKey || "").trim();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No Gemini API key configured. Add a BYOK key in Settings or contact admin." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ctxBlock = mapContext
      ? `\n\nCURRENT MAP CONTEXT:\n${JSON.stringify(mapContext, null, 2)}`
      : "";

    // Sanitize: Gemini's OpenAI-compat endpoint returns an empty stream when any
    // message has empty content. Drop empty assistant/user turns and collapse
    // consecutive duplicates from retry loops.
    const cleaned: any[] = [];
    for (const m of (messages || [])) {
      if (!m || typeof m !== "object") continue;
      const hasContent = typeof m.content === "string" ? m.content.trim().length > 0 : !!m.content;
      const hasToolCalls = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
      if (!hasContent && !hasToolCalls) continue;
      const last = cleaned[cleaned.length - 1];
      if (last && last.role === m.role && last.content === m.content) continue;
      cleaned.push(m);
    }
    if (cleaned.length === 0) {
      cleaned.push({ role: "user", content: "Hello" });
    }

    // Gemini OpenAI-compatible endpoint — keeps client SSE parser unchanged.
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + ctxBlock },
            ...cleaned,
          ],
          tools: TOOLS,
          stream: true,
        }),
      },
    );

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Gemini rate limit — try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 401 || response.status === 403) {
      return new Response(JSON.stringify({ error: "Gemini API key invalid or unauthorized." }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("asher-ai gemini error:", response.status, t);
      return new Response(JSON.stringify({ error: `Gemini error ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("asher-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
