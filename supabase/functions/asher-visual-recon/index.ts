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

type Bbox = [number, number, number, number];
type GeoHit = { lat: number; lng: number; display_name: string; bbox?: Bbox; category?: string; type?: string };

function normalizeGeocodeQueries(q: string): string[] {
  const lower = q.toLowerCase();
  const variants: string[] = [];
  if (/north(ern)?\s+new\s+delhi|north\s+delhi/.test(lower)) variants.push("North Delhi, Delhi, India");
  if (/south(ern)?\s+new\s+delhi|south\s+delhi/.test(lower)) variants.push("South Delhi, Delhi, India");
  if (/east(ern)?\s+new\s+delhi|east\s+delhi/.test(lower)) variants.push("East Delhi, Delhi, India");
  if (/west(ern)?\s+new\s+delhi|west\s+delhi/.test(lower)) variants.push("West Delhi, Delhi, India");
  variants.push(q);
  return Array.from(new Set(variants.map((v) => v.trim()).filter(Boolean)));
}

function parseHit(h: any): GeoHit | null {
  const lat = parseFloat(h?.lat);
  const lng = parseFloat(h?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const bbox = h.boundingbox
    ? ([parseFloat(h.boundingbox[2]), parseFloat(h.boundingbox[0]), parseFloat(h.boundingbox[3]), parseFloat(h.boundingbox[1])] as Bbox)
    : undefined;
  return { lat, lng, display_name: h.display_name, bbox, category: h.class, type: h.type };
}

function geocodeScore(h: GeoHit, originalQuery: string): number {
  const cls = (h.category || "").toLowerCase();
  const typ = (h.type || "").toLowerCase();
  const name = (h.display_name || "").toLowerCase();
  const q = originalQuery.toLowerCase();
  let score = 0;
  if (cls === "boundary") score += 160;
  if (cls === "place") score += 120;
  if (typ === "administrative") score += 90;
  if (["city", "town", "suburb", "neighbourhood", "county", "district"].includes(typ)) score += 55;
  if (["shop", "amenity", "tourism", "office", "building", "leisure"].includes(cls)) score -= 240;
  if (name.includes("delhi")) score += 25;
  if ((q.includes("north new delhi") || q.includes("north delhi")) && name.includes("north delhi")) score += 110;
  if (h.bbox) {
    const [w, s, e, n] = h.bbox;
    const area = Math.abs((e - w) * (n - s));
    if (area < 0.000001) score -= 120;
    else score += Math.min(80, Math.log10(area * 1_000_000 + 1) * 18);
  }
  return score;
}

async function geocode(q: string): Promise<GeoHit | null> {
  try {
    const candidates: GeoHit[] = [];
    for (const query of normalizeGeocodeQueries(q)) {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": UA, "Accept-Language": "en" } },
      );
      if (!r.ok) continue;
      const arr = await r.json();
      if (Array.isArray(arr)) candidates.push(...arr.map(parseHit).filter(Boolean) as GeoHit[]);
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => geocodeScore(b, q) - geocodeScore(a, q));
    return candidates[0];
  } catch { return null; }
}

function bboxAround(lat: number, lng: number, radiusKm: number): Bbox {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function clampBbox(b: Bbox, maxKm = 8): Bbox {
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

type ImagePayload = { b64: string; mime: string; width: number; height: number; bbox: [number, number, number, number]; source: string };

function inferMime(buf: Uint8Array, contentType: string | null): string | null {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (ct.startsWith("image/")) return ct;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  return null;
}

async function fetchImageBytes(url: string, source: string): Promise<{ b64: string; mime: string; source: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" }, signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) {
      console.warn(`[visual-recon] ${source} failed status=${r.status}`);
      return null;
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const mime = inferMime(buf, r.headers.get("content-type"));
    if (!mime || buf.length < 500) {
      console.warn(`[visual-recon] ${source} returned non-image/empty payload bytes=${buf.length}`);
      return null;
    }
    return { b64: bufToB64(buf), mime, source };
  } catch (e) {
    console.warn(`[visual-recon] ${source} threw:`, e);
    return null;
  }
}

function tileXYToBbox(z: number, x: number, y: number): [number, number, number, number] {
  const n2 = Math.pow(2, z);
  const tileLngW = (x / n2) * 360 - 180;
  const tileLngE = ((x + 1) / n2) * 360 - 180;
  const tileLatN = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n2)));
  const tileLatS = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n2)));
  return [tileLngW, tileLatS, tileLngE, tileLatN];
}

async function fetchEsriTile(z: number, x: number, y: number): Promise<ImagePayload | null> {
  const urls = [
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  ];
  for (const url of urls) {
    const img = await fetchImageBytes(url, `ESRI tile z${z}`);
    if (img) return { ...img, width: 256, height: 256, bbox: tileXYToBbox(z, x, y) };
  }
  return null;
}

// Pull satellite imagery covering the bbox. Tries ESRI export (single image)
// first, then falls back to the central XYZ tile (always works).
async function fetchSatelliteImage(
  bbox: [number, number, number, number],
  size = 1024,
): Promise<ImagePayload | null> {
  const [w, s, e, n] = bbox;

  // --- Attempt 1: ESRI export endpoint (full bbox) ---
  const exportUrl =
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${w},${s},${e},${n}` +
    `&bboxSR=4326&imageSR=4326&size=${size},${size}&format=png&transparent=false&f=image`;
  const exported = await fetchImageBytes(exportUrl, "ESRI export");
  if (exported) return { ...exported, width: size, height: size, bbox };

  // --- Attempt 2: ESRI Wayback recent releases (same imagery family, different endpoint) ---
  for (const release of ["2025-06-25", "2024-12-04", "2023-12-13"]) {
    const waybackUrl =
      `https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/MapServer/exts/Wayback/release/${release}/export` +
      `?bbox=${w},${s},${e},${n}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=jpg&f=image`;
    const img = await fetchImageBytes(waybackUrl, `ESRI Wayback ${release}`);
    if (img) return { ...img, width: size, height: size, bbox };
  }

  // --- Attempt 3: XYZ tiles centered on bbox ---
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

  for (const zoom of [z, Math.max(1, z - 1), Math.max(1, z - 2)]) {
    const n2 = Math.pow(2, zoom);
    const x = Math.floor(((cLng + 180) / 360) * n2);
    const latRad = (cLat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n2);
    const tile = await fetchEsriTile(zoom, x, y);
    if (tile) return tile;
  }

  // --- Attempt 4: NASA GIBS visible imagery fallback. Lower-res, but keeps recon nonfatal. ---
  const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const gibsUrl =
    `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi` +
    `?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor` +
    `&STYLES=&FORMAT=image/jpeg&TRANSPARENT=false&HEIGHT=${size}&WIDTH=${size}` +
    `&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&TIME=${d}`;
  const gibs = await fetchImageBytes(gibsUrl, "NASA GIBS visible imagery");
  if (gibs) return { ...gibs, width: size, height: size, bbox };

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
      console.warn(`[asher-visual-recon] all imagery providers failed area="${area}" landmark="${landmark || ""}" bbox=${bbox.join(",")}`);
      return new Response(JSON.stringify({
        success: false,
        error: "Imagery providers unavailable. No satellite frame could be retrieved for this area right now.",
        code: "IMAGERY_UNAVAILABLE",
        center,
        bbox,
        radiusKm,
        detections: [],
        area: areaHit?.display_name || null,
        landmark: landmarkHit?.display_name || null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`[asher-visual-recon] imagery source=${img.source} mime=${img.mime} bbox=${img.bbox.join(",")}`);

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
      return new Response(JSON.stringify({
        success: false,
        error: `Vision analysis unavailable: ${resp?.status || "no_response"} ${lastErr.slice(0, 200)}`,
        code: "VISION_UNAVAILABLE",
        center,
        bbox: img.bbox,
        radiusKm,
        detections: [],
        area: areaHit?.display_name || null,
        landmark: landmarkHit?.display_name || null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      bbox: imgBbox,
      radiusKm,
      detections,
      area: areaHit?.display_name || null,
      landmark: landmarkHit?.display_name || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asher-visual-recon error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e), code: "SERVICE_FAILED", detections: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
