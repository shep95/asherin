// asher-visual-recon — natural-language satellite recon.
//
// Flow:
//   1. Geocode the user-provided AREA (and optional LANDMARK) via Nominatim.
//   2. Build a bounding box around the area (or around the landmark with a radius).
//   3. Pull a high-res ESRI World Imagery export PNG covering the bbox.
//   4. Send the image + the user's natural-language CRITERIA (e.g.
//      "red or blue roofs near the Kali temple") to Gemini Vision.
//   5. Gemini returns normalised pixel coordinates (0..1) for each detection
//      together with a label, confidence and reason.
//   6. We project pixel coords back to geo coords using the bbox and return
//      detections + the bbox (so the client can fly there and drop markers).
//
// GEMINI-ONLY (admin GEMINI_API_KEY or user BYOK). No Lovable AI Gateway.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "AsherVisualRecon/1.0 (intel-map)";

type GeoHit = { lat: number; lng: number; display_name: string; bbox?: [number, number, number, number] };

async function geocode(q: string): Promise<GeoHit | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": UA, "Accept-Language": "en" } },
    );
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) return null;
    const h = arr[0];
    const bbox = h.boundingbox
      ? ([
          parseFloat(h.boundingbox[2]), // west  (minLng)
          parseFloat(h.boundingbox[0]), // south (minLat)
          parseFloat(h.boundingbox[3]), // east  (maxLng)
          parseFloat(h.boundingbox[1]), // north (maxLat)
        ] as [number, number, number, number])
      : undefined;
    return { lat: parseFloat(h.lat), lng: parseFloat(h.lon), display_name: h.display_name, bbox };
  } catch { return null; }
}

function bboxAround(lat: number, lng: number, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function clampBbox(b: [number, number, number, number], maxKm = 8): [number, number, number, number] {
  const [w, s, e, n] = b;
  const cLat = (s + n) / 2, cLng = (w + e) / 2;
  const widthKm = Math.max(0.1, (e - w) * 111 * Math.cos((cLat * Math.PI) / 180));
  const heightKm = Math.max(0.1, (n - s) * 111);
  if (widthKm <= maxKm && heightKm <= maxKm) return b;
  return bboxAround(cLat, cLng, maxKm / 2);
}

function bufToB64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

// Fetch a single ESRI World Imagery XYZ tile.
async function fetchEsriTile(z: number, x: number, y: number): Promise<Uint8Array | null> {
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

// Pull satellite imagery covering the bbox. Tries ESRI export (single image)
// first, then falls back to the central XYZ tile (always works).
async function fetchSatelliteImage(
  bbox: [number, number, number, number],
  size = 1024,
): Promise<{ b64: string; mime: string; width: number; height: number; bbox: [number, number, number, number] } | null> {
  const [w, s, e, n] = bbox;

  // --- Attempt 1: ESRI export endpoint (full bbox) ---
  const exportUrl =
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${w},${s},${e},${n}` +
    `&bboxSR=4326&imageSR=4326&size=${size},${size}&format=png&transparent=false&f=image`;
  try {
    const r = await fetch(exportUrl, { headers: { "User-Agent": UA } });
    if (r.ok) {
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 1000) {
        return { b64: bufToB64(buf), mime: "image/png", width: size, height: size, bbox };
      }
    } else {
      console.warn(`[visual-recon] ESRI export failed status=${r.status}`);
    }
  } catch (e) {
    console.warn(`[visual-recon] ESRI export threw:`, e);
  }

  // --- Attempt 2: single XYZ tile centered on bbox ---
  const cLat = (s + n) / 2;
  const cLng = (w + e) / 2;
  // Pick zoom level based on bbox span
  const spanDeg = Math.max(e - w, n - s);
  // rough mapping: spanDeg=0.1 -> z=14, 0.05 -> z=15, 0.02 -> z=16
  let z = 16;
  if (spanDeg > 0.2) z = 12;
  else if (spanDeg > 0.1) z = 13;
  else if (spanDeg > 0.05) z = 14;
  else if (spanDeg > 0.02) z = 15;

  const n2 = Math.pow(2, z);
  const x = Math.floor(((cLng + 180) / 360) * n2);
  const latRad = (cLat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n2);

  const tile = await fetchEsriTile(z, x, y);
  if (tile && tile.length > 500) {
    // Compute the actual bbox of this tile so pixel->geo stays correct.
    const tileLngW = (x / n2) * 360 - 180;
    const tileLngE = ((x + 1) / n2) * 360 - 180;
    const tileLatN = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n2)));
    const tileLatS = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n2)));
    return {
      b64: bufToB64(tile),
      mime: "image/jpeg",
      width: 256,
      height: 256,
      bbox: [tileLngW, tileLatS, tileLngE, tileLatN],
    };
  }

  return null;
}

interface PixelDetection {
  x: number;     // 0..1 from left
  y: number;     // 0..1 from top
  label: string;
  confidence: number; // 0..1
  reason?: string;
  color?: string;
}

interface GeoDetection extends PixelDetection {
  lat: number;
  lng: number;
}

function pixelToGeo(d: PixelDetection, bbox: [number, number, number, number]): GeoDetection {
  const [w, s, e, n] = bbox;
  const lng = w + d.x * (e - w);
  const lat = n - d.y * (n - s); // y=0 is top => maxLat
  return { ...d, lat, lng };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: auth } = await supa.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const area: string = (body?.area || "").toString().trim();
    const landmark: string | undefined = body?.landmark ? String(body.landmark).trim() : undefined;
    const criteria: string = (body?.criteria || "").toString().trim();
    const radiusKm: number = Math.max(0.3, Math.min(8, Number(body?.radiusKm) || 2));
    const byok: string | undefined = body?.byok;

    if (!area && !landmark) {
      return new Response(JSON.stringify({ error: "area or landmark required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!criteria) {
      return new Response(JSON.stringify({ error: "criteria required (e.g. 'red or blue roofs')" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve key (admin or BYOK)
    const isAdmin = user.email === "ashernewtonx@gmail.com";
    const apiKey = (typeof byok === "string" && byok.trim())
      || (isAdmin ? Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") : null);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key required (BYOK or admin)" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Geocode area + (optional) landmark
    const areaHit = area ? await geocode(area) : null;
    const landmarkHit = landmark ? await geocode(landmark + (area ? `, ${area}` : "")) : null;

    if (!areaHit && !landmarkHit) {
      return new Response(JSON.stringify({ error: "Could not geocode area or landmark" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Pick bbox: prefer landmark-centered (tight), else area's own bbox
    let bbox: [number, number, number, number];
    let center: { lat: number; lng: number };
    if (landmarkHit) {
      bbox = bboxAround(landmarkHit.lat, landmarkHit.lng, radiusKm);
      center = { lat: landmarkHit.lat, lng: landmarkHit.lng };
    } else if (areaHit?.bbox) {
      bbox = clampBbox(areaHit.bbox, radiusKm * 2);
      center = { lat: areaHit.lat, lng: areaHit.lng };
    } else {
      bbox = bboxAround(areaHit!.lat, areaHit!.lng, radiusKm);
      center = { lat: areaHit!.lat, lng: areaHit!.lng };
    }

    // 3) Pull satellite image
    const img = await fetchSatelliteImage(bbox, 1024);
    if (!img) {
      return new Response(JSON.stringify({ error: "Failed to fetch satellite imagery" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Gemini Vision — strict JSON output via responseMimeType
    const prompt = `You are a satellite image recon analyst. Examine the provided high-resolution overhead satellite image and locate every feature that matches the user criteria. Be precise. Do not invent results — if nothing matches, return an empty array.

USER CRITERIA: ${criteria}
${landmark ? `LANDMARK CONTEXT (image is centred on this): ${landmark}` : ""}
AREA CONTEXT: ${area || "(unspecified)"}

For every match, return:
- x, y: pixel position normalised to [0..1] from the TOP-LEFT of the image (x = column / width, y = row / height). Aim for the centre of the feature.
- label: short human label (e.g. "Red metal roof", "Blue tarp roof")
- color: dominant color word ("red", "blue", "rust", "navy", etc.)
- confidence: 0..1
- reason: one short sentence explaining why it matches.

Return STRICT JSON only:
{
  "detections": [
    {"x":0.42,"y":0.31,"label":"...","color":"red","confidence":0.86,"reason":"..."}
  ],
  "summary": "2 sentence overview of what was found"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let resp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: img.mime, data: img.b64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      });
      if (resp.ok) break;
      lastErr = await resp.text();
      if (resp.status === 429 || resp.status === 503) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) {
      return new Response(JSON.stringify({ error: `Gemini failed: ${resp?.status} ${lastErr.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use the actual bbox returned by the imagery fetch (may differ from
    // requested bbox when we fall back to a single tile).
    const imgBbox = img.bbox;

    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }

    const rawDet: PixelDetection[] = Array.isArray(parsed?.detections) ? parsed.detections : [];
    const detections: GeoDetection[] = rawDet
      .filter((d) => typeof d.x === "number" && typeof d.y === "number" && d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1)
      .map((d) => pixelToGeo(d, imgBbox))
      .slice(0, 60);

    console.log(`[asher-visual-recon] area="${area}" landmark="${landmark || ""}" criteria="${criteria.slice(0,80)}" detections=${detections.length}`);

    return new Response(JSON.stringify({
      success: true,
      summary: parsed?.summary || "",
      center,
      bbox,
      radiusKm,
      detections,
      area: areaHit?.display_name || null,
      landmark: landmarkHit?.display_name || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asher-visual-recon error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
