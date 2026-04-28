// Asher AI — backend for the right-side AI panel on the Intelligence Map.
// Uses Lovable AI Gateway with tool calling so the AI can perform map actions
// (search/fly-to, save target, toggle threat layers, analyze entity, generate image).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ASHER AI — the operator's tactical co-pilot embedded inside the Asher Intelligence Map.

CAPABILITIES (call tools — do not describe them as text):
- map_search(query): geocode + fly to location
- toggle_threat_layer(layer, enabled): toggle "earthquakes" | "wildfires" | "aircraft" overlays
- save_current_target(label?): save the currently selected entity to the operator's dossier vault
- analyze_entity(): produce a tactical assessment of the currently selected entity
- generate_image(prompt): render a tactical visualization or sketch
- set_base_layer(layer): switch base map ("street" | "satellite" | "topo" | "dark")

STYLE: Surgical. Direct. Intelligence Officer voice. Use bold headers and tables when summarizing data. No filler. Never say "Certainly" / "Of course". Never disclose the underlying model or backend.`;

const TOOLS = [
  { type: "function", function: { name: "map_search", description: "Search a place/coords and fly map to it.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "toggle_threat_layer", description: "Toggle a live threat overlay.", parameters: { type: "object", properties: { layer: { type: "string", enum: ["earthquakes", "wildfires", "aircraft"] }, enabled: { type: "boolean" } }, required: ["layer", "enabled"] } } },
  { type: "function", function: { name: "save_current_target", description: "Persist the currently selected entity as a saved target.", parameters: { type: "object", properties: { label: { type: "string" } } } } },
  { type: "function", function: { name: "analyze_entity", description: "Produce a tactical assessment of the currently selected entity.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "generate_image", description: "Generate a tactical visualization image.", parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } },
  { type: "function", function: { name: "set_base_layer", description: "Switch base cartography.", parameters: { type: "object", properties: { layer: { type: "string", enum: ["street", "satellite", "topo", "dark"] } }, required: ["layer"] } } },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mapContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ctxBlock = mapContext
      ? `\n\nCURRENT MAP CONTEXT:\n${JSON.stringify(mapContext, null, 2)}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + ctxBlock },
          ...messages,
        ],
        tools: TOOLS,
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded — try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("asher-ai gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }),
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
