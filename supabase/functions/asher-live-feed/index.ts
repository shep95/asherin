// Resolves a live YouTube video ID for a given location/query using Gemini + Google Search grounding.
// Returns: { videoId, title, channel, url, source, candidates }
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface Body {
  location?: string;
  lat?: number;
  lng?: number;
  kind?: "live" | "news" | "cams";
  byokGeminiKey?: string;
}

const YT_ID_RE = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;

function extractIds(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = YT_ID_RE.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const headerKey = req.headers.get("x-byok-gemini-key") || undefined;
    const apiKey = headerKey || body.byokGeminiKey || Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing Gemini API key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loc = (body.location || "").trim() ||
      (typeof body.lat === "number" && typeof body.lng === "number"
        ? `${body.lat.toFixed(3)}, ${body.lng.toFixed(3)}`
        : "");
    if (!loc) {
      return new Response(JSON.stringify({ error: "location required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kind = body.kind || "live";
    const intent =
      kind === "news"
        ? `live news broadcast covering ${loc}`
        : kind === "cams"
        ? `24/7 live webcam stream from ${loc} (street, skyline, harbor, traffic)`
        : `live stream from ${loc} right now`;

    const prompt = `Find a currently-live YouTube stream URL for: ${intent}.
Return ONLY a JSON object:
{"video_url":"https://www.youtube.com/watch?v=XXXXXXXXXXX","title":"...","channel":"..."}
Pick a stream that is actively broadcasting. Prefer official news channels (Sky, Al Jazeera, France 24, NHK, local stations) or well-known 24/7 city/webcam streams. Do not invent a URL.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `Gemini ${resp.status}`, detail: t.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("\n") || "";

    // Try JSON object first
    let videoId = "";
    let title = "";
    let channel = "";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        const url: string = obj.video_url || obj.url || "";
        const ids = extractIds(url);
        if (ids[0]) videoId = ids[0];
        title = obj.title || "";
        channel = obj.channel || "";
      } catch {/* ignore */}
    }
    // Fallback: scan grounded URIs + raw text
    const candidates = extractIds(text);
    const grounding = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const g of grounding) {
      const uri: string = g?.web?.uri || "";
      const ids = extractIds(uri);
      for (const id of ids) if (!candidates.includes(id)) candidates.push(id);
    }
    if (!videoId && candidates[0]) videoId = candidates[0];

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "No live video resolved", raw: text.slice(0, 400) }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        videoId,
        title,
        channel,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        source: "gemini+google_search",
        candidates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
