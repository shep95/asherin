// asher-jobs-nearby — live hiring intelligence for Asherin Maps.
//
// "Find restaurant jobs near this address that are hiring" is a geospatial
// question with an open-web answer. This function runs a live board sweep
// (Firecrawl search across the major aggregators plus employer career pages),
// extracts structured postings with Gemini, then geocodes each employer so the
// results can be dropped on the map as pins.
//
// Realism rules: postings are only returned when a real result carried them.
// Nothing is invented, every posting keeps its source URL, and an empty sweep
// is reported as empty.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { placeSearch, type WebHit } from "../_shared/bleSentinel.ts";

interface JobPosting {
  title: string;
  employer: string;
  address?: string;
  lat?: number;
  lng?: number;
  distanceM?: number;
  pay?: string;
  employmentType?: string;
  posted?: string;
  applyUrl?: string;
  source: string;
  snippet?: string;
}

const R_EARTH = 6_371_000;
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

/** Nominatim reverse geocode → a human locality the boards actually index. */
async function reverseLocality(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { "User-Agent": "AsherinMaps/1.0 (+https://asherin.com)" } },
    );
    if (!r.ok) return "";
    const j = await r.json();
    const a = j?.address || {};
    return [a.city || a.town || a.village || a.suburb, a.state, a.country].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "AsherinMaps/1.0 (+https://asherin.com)" } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon) };
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const role = String(body?.role || body?.query || "").trim().slice(0, 120);
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const radiusMi = Math.max(1, Math.min(60, Number(body?.radiusMi) || 10));
    const byok = typeof body?.byok === "string" ? body.byok : undefined;

    if (!role) {
      return new Response(JSON.stringify({ success: false, error: "role/query required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ success: false, error: "lat/lng required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const anchor = { lat, lng };
    const locality = (body?.locality && String(body.locality)) || await reverseLocality(lat, lng);
    const where = locality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    // Collection plan: aggregators + direct employer career surfaces. Run in
    // parallel with a hard wall-clock slice so one slow board cannot stall the
    // whole sweep.
    const plan: string[] = [
      `${role} jobs hiring now near ${where} site:indeed.com`,
      `${role} jobs hiring near ${where} site:linkedin.com/jobs`,
      `${role} "now hiring" ${where} site:ziprecruiter.com`,
      `${role} jobs ${where} site:snagajob.com OR site:craigslist.org`,
      `"${role}" hiring ${where} careers apply`,
    ];

    const settled = await Promise.allSettled(
      plan.map((q) => withTimeout(placeSearch(q, 6, 9000), 10_000, [] as WebHit[])),
    );
    const hits: WebHit[] = [];
    for (const s of settled) if (s.status === "fulfilled") hits.push(...s.value);

    // Dedupe by URL — boards syndicate the same posting many times.
    const seen = new Set<string>();
    const unique = hits.filter((h) => {
      const k = h.url.split("?")[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 30);

    if (!unique.length) {
      return new Response(JSON.stringify({
        success: true, jobs: [], locality: where,
        note: "The live board sweep returned nothing for this role in this area. Widen the radius or loosen the role wording.",
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Structured extraction (Gemini) ────────────────────────────────────
    const apiKey = (byok || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "").trim();
    let jobs: JobPosting[] = [];

    if (apiKey) {
      const corpus = unique.map((h, i) =>
        `[${i + 1}] ${h.title}\nURL: ${h.url}\n${(h.snippet || "").slice(0, 400)}`).join("\n\n");
      const prompt =
        `You are extracting REAL job postings from live web search results for the role "${role}" near ${where}.\n\n` +
        `RULES:\n` +
        `- Only output a posting when the result text actually evidences it. Never invent employers, pay or addresses.\n` +
        `- Omit any field the source does not state. Do not guess.\n` +
        `- "address" must be a street address or a named venue plus locality, good enough to geocode.\n` +
        `- Return at most 15 postings, closest-to-role first.\n\n` +
        `Return ONLY JSON: {"jobs":[{"title":"","employer":"","address":"","pay":"","employmentType":"","posted":"","applyUrl":"","source":"","snippet":""}]}\n\n` +
        `RESULTS:\n${corpus}`;

      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
            }),
          },
        );
        if (r.ok) {
          const j = await r.json();
          const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
          const parsed = JSON.parse(txt.replace(/^```(?:json)?|```$/g, "").trim());
          if (Array.isArray(parsed?.jobs)) {
            jobs = parsed.jobs.filter((x: any) => x && x.title && x.employer).slice(0, 15);
          }
        }
      } catch (e) {
        console.error("[asher-jobs-nearby] extraction:", (e as Error).message);
      }
    }

    // Degrade honestly: without extraction the raw hits are still real leads.
    if (!jobs.length) {
      jobs = unique.slice(0, 12).map((h) => ({
        title: h.title.slice(0, 120) || role,
        employer: (() => { try { return new URL(h.url).hostname.replace(/^www\./, ""); } catch { return "unknown source"; } })(),
        applyUrl: h.url,
        source: (() => { try { return new URL(h.url).hostname.replace(/^www\./, ""); } catch { return "web"; } })(),
        snippet: h.snippet?.slice(0, 240),
      }));
    }

    // ── Geocode employers so the map can pin them ─────────────────────────
    // Sequential with a small cap: Nominatim's usage policy is 1 req/sec and a
    // parallel burst gets the whole function rate-limited.
    const maxGeocode = 10;
    for (let i = 0; i < Math.min(jobs.length, maxGeocode); i++) {
      const j = jobs[i];
      const q = j.address ? `${j.address}` : `${j.employer}, ${where}`;
      const p = await geocode(q);
      if (p) {
        j.lat = p.lat;
        j.lng = p.lng;
        j.distanceM = Math.round(haversineM(anchor, p));
      }
      await new Promise((r) => setTimeout(r, 1100));
    }

    const radiusM = radiusMi * 1609.344;
    // Keep un-geocoded postings — they are still real leads, just unpinnable.
    const filtered = jobs.filter((j) => j.distanceM === undefined || j.distanceM <= radiusM);
    filtered.sort((a, b) => (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER));

    return new Response(JSON.stringify({
      success: true,
      jobs: filtered,
      locality: where,
      anchor,
      radiusMi,
      sourcesScanned: unique.length,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[asher-jobs-nearby]", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
