// asher-temporal-recon — multi-year satellite scan.
//
// Flow:
//   1. Geocode area / landmark via Nominatim, build a bbox.
//   2. For each year in the requested window, fetch a high-res satellite tile.
//      Years <= 2013 use NASA GIBS Landsat WELD annual mosaic.
//      Years >= 2014 use ESRI World Imagery Wayback (closest release per year).
//   3. Run Gemini Vision on each frame with the user's natural-language criteria.
//   4. For each detection, project pixel→geo and tag it with the year it was
//      observed. Then collapse detections across years into "tracks":
//        - lat/lng cluster (≤ ~30m)
//        - first_seen, last_seen, years_present[]
//   5. Return per-year frames + temporal tracks so the client can render a
//      timeline scrubber and "since YYYY" badges on each marker.
//
// GEMINI-ONLY (admin GEMINI_API_KEY or user BYOK). No Lovable AI Gateway.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { isStaffEmail } from "../_shared/identityHash.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const UA = "AsherTemporalRecon/1.0 (intel-map)";

type Bbox = [number, number, number, number]; // [w, s, e, n]

interface GeoHit { lat: number; lng: number; display_name: string; bbox?: Bbox }

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
    const bbox: Bbox | undefined = h.boundingbox ? [
      parseFloat(h.boundingbox[2]), parseFloat(h.boundingbox[0]),
      parseFloat(h.boundingbox[3]), parseFloat(h.boundingbox[1]),
    ] : undefined;
    return { lat: parseFloat(h.lat), lng: parseFloat(h.lon), display_name: h.display_name, bbox };
  } catch { return null; }
}

function bboxAround(lat: number, lng: number, radiusKm: number): Bbox {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function clampBbox(b: Bbox, maxKm = 6): Bbox {
  const [w, s, e, n] = b;
  const cLat = (s + n) / 2, cLng = (w + e) / 2;
  const widthKm = Math.max(0.1, (e - w) * 111 * Math.cos((cLat * Math.PI) / 180));
  const heightKm = Math.max(0.1, (n - s) * 111);
  if (widthKm <= maxKm && heightKm <= maxKm) return b;
  return bboxAround(cLat, cLng, maxKm / 2);
}

const WAYBACK_RELEASES: Record<number, string> = {
  2014: "2014-02-20",
  2015: "2015-08-12",
  2016: "2016-09-21",
  2017: "2017-12-13",
  2018: "2018-12-12",
  2019: "2019-12-04",
  2020: "2020-11-18",
  2021: "2021-12-08",
  2022: "2022-12-14",
  2023: "2023-12-13",
  2024: "2024-12-04",
  2025: "2025-06-25",
};

async function fetchWaybackTile(year: number, bbox: Bbox, size = 768): Promise<{ b64: string; mime: string; source: string } | null> {
  const release = WAYBACK_RELEASES[year];
  if (!release) return null;
  const [w, s, e, n] = bbox;
  const url =
    `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}` +
    `?bbox=${w},${s},${e},${n}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=jpg&f=image`;
  const exportUrl =
    `https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/MapServer/exts/Wayback/release/${release}/export` +
    `?bbox=${w},${s},${e},${n}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=jpg&f=image`;
  for (const u of [exportUrl, url]) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return { b64: btoa(bin), mime: ct.split(";")[0], source: `Esri Wayback ${release}` };
    } catch { /* try next */ }
  }
  return null;
}

async function fetchGibsTile(year: number, bbox: Bbox, size = 768): Promise<{ b64: string; mime: string; source: string } | null> {
  const [w, s, e, n] = bbox;
  const layer = "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual";
  const time = `${year}-01-01`;
  const url =
    `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi` +
    `?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}` +
    `&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&WIDTH=${size}&HEIGHT=${size}` +
    `&FORMAT=image/jpeg&TIME=${time}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { b64: btoa(bin), mime: ct.split(";")[0], source: `NASA GIBS Landsat ${year}` };
  } catch { return null; }
}

async function fetchYearTile(year: number, bbox: Bbox): Promise<{ b64: string; mime: string; source: string } | null> {
  if (year >= 2014) {
    const w = await fetchWaybackTile(year, bbox);
    if (w) return w;
  }
  return await fetchGibsTile(year, bbox);
}

interface PixelDet { x: number; y: number; label: string; confidence: number; color?: string; reason?: string }
interface GeoDet extends PixelDet { lat: number; lng: number; year: number; source: string }

function pixelToGeo(d: PixelDet, bbox: Bbox, year: number, source: string): GeoDet {
  const [w, s, e, n] = bbox;
  return { ...d, lat: n - d.y * (n - s), lng: w + d.x * (e - w), year, source };
}

async function geminiDetect(apiKey: string, criteria: string, year: number, area: string, landmark: string | undefined, img: { b64: string; mime: string }): Promise<{ detections: PixelDet[]; summary: string } | null> {
  const prompt = `You are a satellite image recon analyst examining a HISTORICAL overhead image from ${year}.
Locate every feature matching the user criteria. Be precise. Empty array if nothing matches.

USER CRITERIA: ${criteria}
${landmark ? `LANDMARK CONTEXT: ${landmark}` : ""}
AREA CONTEXT: ${area}
IMAGE YEAR: ${year}

For every match return:
- x, y: pixel position normalised [0..1] from TOP-LEFT (centre of feature).
- label: short human label
- color: dominant color word
- confidence: 0..1
- reason: one short sentence

Return STRICT JSON only:
{"detections":[{"x":0.42,"y":0.31,"label":"...","color":"red","confidence":0.86,"reason":"..."}],"summary":"1 sentence"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: img.mime, data: img.b64 } }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 3072, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) {
      if (r.status === 429 || r.status === 503) { await new Promise((res) => setTimeout(res, 1200 * attempt)); continue; }
      return null;
    }
    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/); if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
    const detections = (Array.isArray(parsed?.detections) ? parsed.detections : []).filter(
      (d: any) => typeof d.x === "number" && typeof d.y === "number" && d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1,
    );
    return { detections, summary: parsed?.summary || "" };
  }
  return null;
}

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface Track {
  lat: number; lng: number;
  label: string; color?: string;
  first_seen: number; last_seen: number;
  years_present: number[];
  confidence: number;
  reason?: string;
}

function buildTracks(all: GeoDet[]): Track[] {
  const tracks: Track[] = [];
  const radiusM = 35;
  for (const d of all) {
    let added = false;
    for (const t of tracks) {
      const sameColor = (d.color || "").toLowerCase().slice(0, 4) === (t.color || "").toLowerCase().slice(0, 4);
      if (sameColor && distM({ lat: d.lat, lng: d.lng }, { lat: t.lat, lng: t.lng }) < radiusM) {
        t.years_present = Array.from(new Set([...t.years_present, d.year])).sort();
        t.first_seen = Math.min(t.first_seen, d.year);
        t.last_seen = Math.max(t.last_seen, d.year);
        const k = t.years_present.length;
        t.lat = (t.lat * (k - 1) + d.lat) / k;
        t.lng = (t.lng * (k - 1) + d.lng) / k;
        t.confidence = (t.confidence * (k - 1) + d.confidence) / k;
        added = true;
        break;
      }
    }
    if (!added) {
      tracks.push({
        lat: d.lat, lng: d.lng, label: d.label, color: d.color,
        first_seen: d.year, last_seen: d.year, years_present: [d.year],
        confidence: d.confidence, reason: d.reason,
      });
    }
  }
  return tracks;
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
    const radiusKm: number = Math.max(0.3, Math.min(6, Number(body?.radiusKm) || 1.5));
    const startYear: number = Math.max(2000, Math.min(2025, Number(body?.startYear) || 2014));
    const endYear: number = Math.max(startYear, Math.min(2025, Number(body?.endYear) || new Date().getFullYear()));
    const stride: number = Math.max(1, Math.min(5, Number(body?.stride) || 2));
    const byok: string | undefined = body?.byok;

    if (!area && !landmark) return new Response(JSON.stringify({ error: "area or landmark required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!criteria) return new Response(JSON.stringify({ error: "criteria required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isAdmin = isStaffEmail(user.email);
    const apiKey = (typeof byok === "string" && byok.trim()) || (isAdmin ? Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") : null);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key required (BYOK or admin)" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const areaHit = area ? await geocode(area) : null;
    const landmarkHit = landmark ? await geocode(landmark + (area ? `, ${area}` : "")) : null;
    if (!areaHit && !landmarkHit) {
      return new Response(JSON.stringify({ error: "Could not geocode area or landmark" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let bbox: Bbox; let center: { lat: number; lng: number };
    if (landmarkHit) { bbox = bboxAround(landmarkHit.lat, landmarkHit.lng, radiusKm); center = { lat: landmarkHit.lat, lng: landmarkHit.lng }; }
    else if (areaHit?.bbox) { bbox = clampBbox(areaHit.bbox, radiusKm * 2); center = { lat: areaHit.lat, lng: areaHit.lng }; }
    else { bbox = bboxAround(areaHit!.lat, areaHit!.lng, radiusKm); center = { lat: areaHit!.lat, lng: areaHit!.lng }; }

    const years: number[] = [];
    for (let y = startYear; y <= endYear; y += stride) years.push(y);
    if (years[years.length - 1] !== endYear) years.push(endYear);

    // Hard cap to 5 frames to stay within edge-function wall-time budget.
    const MAX_FRAMES = 5;
    let trimmed: number[];
    if (years.length <= MAX_FRAMES) {
      trimmed = years;
    } else {
      const step = (years.length - 1) / (MAX_FRAMES - 1);
      trimmed = Array.from(new Set(Array.from({ length: MAX_FRAMES }, (_, i) => years[Math.round(i * step)])));
    }
    if (!trimmed.includes(endYear)) trimmed.push(endYear);
    trimmed = trimmed.sort((a, b) => a - b);

    // Process all years IN PARALLEL — fetch tile + run vision concurrently.
    const perYearArea = areaHit?.display_name || area;
    const perYearLandmark = landmarkHit?.display_name || landmark;
    const yearResults = await Promise.all(trimmed.map(async (y) => {
      const tile = await fetchYearTile(y, bbox);
      if (!tile) return { year: y, source: "unavailable", detection_count: 0, summary: "No imagery for this year", geos: [] as GeoDet[] };
      const det = await geminiDetect(apiKey, criteria, y, perYearArea, perYearLandmark, tile);
      if (!det) return { year: y, source: tile.source, detection_count: 0, summary: "Vision call failed", geos: [] as GeoDet[] };
      const geos = det.detections.map((d) => pixelToGeo(d, bbox, y, tile.source));
      return { year: y, source: tile.source, detection_count: geos.length, summary: det.summary, geos };
    }));

    const frames = yearResults.map(({ year, source, detection_count, summary }) => ({ year, source, detection_count, summary }));
    const allDet: GeoDet[] = yearResults.flatMap((r) => r.geos);

    const tracks = buildTracks(allDet);

    console.log(`[asher-temporal-recon] area="${area}" landmark="${landmark || ""}" years=${trimmed.join(",")} dets=${allDet.length} tracks=${tracks.length}`);

    return new Response(JSON.stringify({
      success: true,
      center, bbox, radiusKm,
      years: trimmed,
      frames,
      detections: allDet,
      tracks,
      area: areaHit?.display_name || null,
      landmark: landmarkHit?.display_name || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asher-temporal-recon error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
