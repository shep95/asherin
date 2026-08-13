// asherin-public-index — PUBLIC INDEX ONLY. No model. No inference. No Gemini.
//
// The default property fly on Asherin Maps calls this function, never the
// cinematic dossier engine. Every field is either a string lifted from a
// public register or the exact phrase "not in public index". Nothing here
// guesses a resident, an owner, or an offence.
//
// Sources (each bounded at 8s, all fired in parallel):
//   - Nominatim reverse geocode           → address string
//   - Overpass building at point          → start_date / addr:* / building
//   - US Census oneline geocoder          → geographies (US addresses only)
//   - FCC census block API                → census block FIPS
//   - CourtListener address-string search → docket text mentioning the address
//   - Open-Meteo point forecast           → weather fallback (context only)
//
// Flood: no stable public JSON endpoint is wired, so flood_zone is a declared
// gap rather than a fabricated zone.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const NIL = "not in public index";
const TIMEOUT_MS = 8000;
const UA = "asherin-public-index/1.0 (+https://asherin.com)";

interface Citation { label: string; url: string }

async function getJson(url: string, init?: RequestInit): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url: string, init?: RequestInit): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Geocode (forward) — a caller may hand us only an address string ─────── */
async function forwardGeocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const photon = await getJson(
    `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(address)}`,
  );
  const f = photon?.features?.[0]?.geometry?.coordinates;
  if (Array.isArray(f) && Number.isFinite(f[0]) && Number.isFinite(f[1])) {
    return { lat: Number(f[1]), lon: Number(f[0]) };
  }
  const nom = await getJson(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`,
  );
  const h = Array.isArray(nom) ? nom[0] : null;
  if (h && Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lon))) {
    return { lat: Number(h.lat), lon: Number(h.lon) };
  }
  return null;
}

/* ── Overpass building at point ──────────────────────────────────────────── */
async function overpassBuilding(lat: number, lon: number): Promise<any | null> {
  const q = `[out:json][timeout:7];(way(around:35,${lat},${lon})["building"];relation(around:35,${lat},${lon})["building"];);out tags center 3;`;
  const data = await getJson("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
  });
  const el = data?.elements?.[0];
  return el?.tags ? el.tags : null;
}

/* ── CourtListener — ADDRESS STRING search, never a person hunt ──────────── */
async function courtListenerAddress(
  address: string,
  streetNumber: string | null,
  streetToken: string | null,
): Promise<{ value: string; citations: Citation[] }> {
  if (!streetNumber || !streetToken) {
    return { value: NIL, citations: [] };
  }
  const data = await getJson(
    `https://www.courtlistener.com/api/rest/v4/search/?type=r&q=${encodeURIComponent(`"${streetNumber} ${streetToken}"`)}&order_by=score%20desc`,
  );
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const num = streetNumber.toLowerCase();
  const tok = streetToken.toLowerCase();
  const hits = results.filter((r) => {
    const blob = JSON.stringify(r).toLowerCase();
    // crime-at-address only when the docket text carries BOTH the street
    // number and the street token. A name collision is not an address hit.
    return blob.includes(num) && blob.includes(tok);
  });
  if (!hits.length) return { value: NIL, citations: [] };
  const citations = hits.slice(0, 3).map((h) => ({
    label: String(h.caseName ?? h.docketNumber ?? "CourtListener docket"),
    url: h.absolute_url ? `https://www.courtlistener.com${h.absolute_url}` : "https://www.courtlistener.com",
  }));
  const value =
    `${hits.length} federal docket${hits.length === 1 ? "" : "s"} mention the address string "${streetNumber} ${streetToken}" ` +
    `(${hits.slice(0, 2).map((h) => String(h.caseName ?? h.docketNumber ?? "docket")).join("; ")}). ` +
    `THIS IS UNSURE — a docket mentioning a street string is not proof of an offence at this parcel; homonym addresses exist in other cities.`;
  return { value, citations };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    let lat = Number(body?.lat);
    let lon = Number(body?.lon ?? body?.lng);
    const addressIn = typeof body?.address === "string" ? body.address.trim() : "";

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (!addressIn) {
        return new Response(
          JSON.stringify({ success: false, error: "lat/lon or address required" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const g = await forwardGeocode(addressIn);
      if (!g) {
        return new Response(
          JSON.stringify({ success: false, error: "could not geocode address" }),
          { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      lat = g.lat;
      lon = g.lon;
    }

    const citations: Citation[] = [];

    const [reverse, building, fcc, weather] = await Promise.all([
      getJson(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`),
      overpassBuilding(lat, lon),
      getJson(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`),
      getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`),
    ]);

    const addr = reverse?.address ?? {};
    const resolvedAddress: string = reverse?.display_name || addressIn || NIL;
    if (reverse?.display_name) {
      citations.push({ label: "Nominatim reverse geocode", url: "https://nominatim.openstreetmap.org/" });
    }

    const streetNumber: string | null = addr.house_number ? String(addr.house_number) : null;
    const roadFull: string = String(addr.road ?? "");
    const streetToken: string | null = roadFull ? roadFull.split(/\s+/)[0] : null;
    const isUsa =
      String(addr.country_code ?? "").toLowerCase() === "us" ||
      /\b(usa|united states)\b/i.test(addressIn);

    /* US Census oneline geographies — only meaningful for a US street address */
    const censusOneline =
      isUsa && (streetNumber || addressIn)
        ? await getJson(
            `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(
              resolvedAddress !== NIL ? resolvedAddress : addressIn,
            )}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`,
          )
        : null;

    const court = await courtListenerAddress(resolvedAddress, streetNumber, streetToken);
    citations.push(...court.citations);

    /* ── year_built — Overpass start_date is the only public-index source ── */
    let yearBuilt = NIL;
    const startDate = building?.["start_date"] ?? building?.["building:start_date"];
    if (startDate) {
      yearBuilt = `${String(startDate)} (OSM start_date on the building footprint)`;
      citations.push({ label: "OpenStreetMap building footprint", url: `https://www.openstreetmap.org/#map=19/${lat}/${lon}` });
    }

    /* ── ownership — no free public deed register exists at this layer ───── */
    let ownership = NIL;
    if (building?.operator) {
      ownership = `${String(building.operator)} (OSM operator tag — operator is not a deed holder)`;
    }

    /* ── occupants — mailing/registry data is NOT a resident roll ────────── */
    const occupants = NIL;
    const occupantsNote =
      "Occupancy is not published in any open register. Mailing-address or provider-registry records (e.g. NPPES) show where post is delivered, not who lives here — they are never fused into a household list.";

    /* ── census block via FCC ─────────────────────────────────────────────── */
    let censusBlock = NIL;
    const fips = fcc?.Block?.FIPS;
    if (fips) {
      censusBlock = `${String(fips)}${fcc?.County?.name ? ` · ${fcc.County.name}, ${fcc?.State?.code ?? ""}`.trim() : ""}`;
      citations.push({ label: "FCC Census Block API", url: "https://geo.fcc.gov/api/census/" });
    } else {
      const geo = censusOneline?.result?.addressMatches?.[0]?.geographies;
      const blk = geo?.["Census Blocks"]?.[0];
      if (blk?.GEOID) {
        censusBlock = String(blk.GEOID);
        citations.push({ label: "US Census geocoder", url: "https://geocoding.geo.census.gov/" });
      }
    }

    /* ── flood zone — declared gap, never invented ───────────────────────── */
    const floodZone = NIL;

    const buildingType = building?.building && building.building !== "yes" ? String(building.building) : NIL;
    const roofShape = building?.["roof:shape"] ? String(building["roof:shape"]) : NIL;

    const weatherLine = weather?.current
      ? `${weather.current.temperature_2m}°C, wind ${weather.current.wind_speed_10m} km/h (Open-Meteo point forecast)`
      : NIL;

    return new Response(
      JSON.stringify({
        success: true,
        source: "public-index",
        model_used: false,
        location: { lat, lon },
        address: resolvedAddress,
        year_built: yearBuilt,
        ownership,
        occupants,
        occupants_note: occupantsNote,
        criminal: court.value,
        census_block: censusBlock,
        flood_zone: floodZone,
        building_type: buildingType,
        roof_shape: roofShape,
        weather: weatherLine,
        citations,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
