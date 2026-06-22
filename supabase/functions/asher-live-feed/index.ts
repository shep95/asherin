// Resolves a live YouTube video ID for a given location/query using Gemini + Google Search grounding.
// Returns: { videoId, title, channel, url, source, candidates }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    const prompt = `Find currently-live YouTube stream URLs for: ${intent}.
Return ONLY a JSON object with up to 5 candidates:
{"streams":[{"video_url":"https://www.youtube.com/watch?v=XXXXXXXXXXX","title":"...","channel":"..."}]}
Prefer official news channels (Sky News, Al Jazeera English, France 24, DW, NHK, ABC News, local stations) and well-known 24/7 city/webcam streams. Only include streams that are actively broadcasting right now. Do not invent URLs.`;

    // Try multiple models with retry — Gemini 2.5 frequently returns 503 under load
    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-1.5-flash",
    ];
    let resp: Response | null = null;
    let lastErr = "";
    outer: for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.3 },
            }),
          },
        );
        if (r.ok) { resp = r; break outer; }
        lastErr = `${model} ${r.status}: ${(await r.text()).slice(0, 200)}`;
        if (r.status !== 503 && r.status !== 429) break; // only retry on overload
        await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
      }
    }

    if (!resp) {
      return new Response(JSON.stringify({ error: "Gemini unavailable", detail: lastErr }), {
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
      // Hard fallback: well-known 24/7 streams so the panel always shows something live
      const fallbackByKind: Record<string, { id: string; title: string; channel: string }[]> = {
        news: [
          { id: "9Auq9mYxFEE", title: "Sky News Live", channel: "Sky News" },
          { id: "gCNeDWCI0vo", title: "DW News Livestream", channel: "DW News" },
          { id: "F-TyVQUKVNA", title: "Al Jazeera English Live", channel: "Al Jazeera" },
          { id: "Y-IAEsgGu_o", title: "France 24 English Live", channel: "France 24" },
        ],
        cams: [
          { id: "rnXIjl_Rzy4", title: "Times Square Live Cam", channel: "EarthCam" },
          { id: "1-iS7LArMPA", title: "Tokyo Shibuya Live Cam", channel: "ANNnewsCH" },
        ],
        live: [
          { id: "9Auq9mYxFEE", title: "Sky News Live", channel: "Sky News" },
          { id: "rnXIjl_Rzy4", title: "Times Square Live Cam", channel: "EarthCam" },
        ],
      };
      const fb = fallbackByKind[kind] || fallbackByKind.live;
      return new Response(
        JSON.stringify({
          videoId: fb[0].id,
          title: fb[0].title,
          channel: fb[0].channel,
          url: `https://www.youtube.com/watch?v=${fb[0].id}`,
          source: "fallback",
          candidates: fb.map((f) => f.id),
          notice: "No location-specific live stream resolved — showing global fallback.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
