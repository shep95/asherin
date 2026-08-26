// ─────────────────────────────────────────────────────────────────────────────
// asherin.eye — natural language → geospatial intent resolution.
//
// The narrative this replaces: the globe's chat used to be a command matcher.
// "route to X", "property X", a url, otherwise a place lookup. Intent lived in
// the operator's head, capability lived in a switch statement, and nothing
// joined them. Any sentence nobody anticipated fell through to a place search
// and came back with a city centroid — an answer shaped like success.
//
// The narrative this builds: the sentence goes to a model together with a TOOL
// MANIFEST — every public resolver this deployment actually owns, described in
// plain english with typed arguments. The model does not write code, urls, or
// query language. It returns a PLAN: an ordered list of {tool, args}. The
// executor here runs only tools that exist, with arguments it re-validates and
// bounds itself, and normalises every result into one row shape the globe can
// draw. What the plan asks for and this deployment cannot do comes back as an
// explicit `unresolved` line, never as invented pins.
//
// Flaws designed against, in order of how badly they would have bitten:
//   • SSRF / query injection — the model never supplies a url or raw Overpass
//     QL. Tool ids plus typed args only; tag keys and values are regex-gated
//     before they touch a query string.
//   • Volunteer-infrastructure abuse — radius, result count and step count are
//     capped here, not in the prompt. A model that asks for a continent gets a
//     district.
//   • Fabrication — no coordinate is ever authored by the model. Every row
//     carries the source that produced it; a step that fails says so.
//   • Cost / hang — every outbound call has a deadline, the plan is capped at
//     four steps, and steps run with per-step failure isolation.
//   • Auth — BYOK/staff key resolution is the same gate the rest of the
//     platform uses. No anonymous consumption of a platform key.
// ─────────────────────────────────────────────────────────────────────────────

import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJson, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

const UA = "asherin.eye/1.0 (+https://asherin.com)";

interface Row {
  id: string;
  lat: number;
  lon: number;
  label: string;
  note?: string;
  url?: string;
  kind?: string;
}

interface StepReport {
  tool: string;
  label: string;
  ok: boolean;
  count: number;
  detail: string;
}

// ── plain-english manifest handed to the model ───────────────────────────────
// Written for a reader, not for a parser: the model picks tools by reading what
// each one can actually reach. Anything absent from this list does not exist as
// far as the plan is concerned.
const MANIFEST = `
place.locate  — turn a place name into a coordinate and a bounding box.
                args: { "q": "new delhi" }
                use when the sentence names a place and nothing else is needed.

osm.features  — every mapped feature in openstreetmap around a point, selected
                by tag. this is the workhorse: hospitals, mosques, police
                stations, government buildings, data centres, embassies,
                power substations, telecom masts, schools, banks, ports,
                military areas, and roof colour where the mapper recorded it.
                args: {
                  "place": "karnataka"          // or "lat" + "lon"
                  "radius_m": 8000,              // capped at 30000
                  "filters": [ { "key": "amenity", "value": "hospital" } ],
                  "any_of": true,                // true = or, false/absent = and
                  "limit": 200,
                  "label": "hospitals"
                }
                filters use real osm tags. examples that work:
                  amenity=hospital | amenity=police | amenity=place_of_worship
                  religion=muslim | building=government | office=government
                  telecom=data_center | building=data_center
                  man_made=mast | power=substation | landuse=military
                  military=* (value "*" means any value)
                  roof:colour=red  (sparsely mapped — say so when thin)

feed          — the live public feeds this globe already carries.
                args: { "name": "<feed>", "params": { } }
                names: flights (aircraft near lat/lon), quakes (worldwide
                seismic), disasters (gdacs), notices (interpol public notices),
                incidents (gdelt events near a place — params.q = place),
                crime (uk/us police street-level, params lat/lon),
                cameras (public camera catalogs), radio, stations, launches,
                buildings (extruded footprints, params lat/lon), places.

net.hosts     — a domain's public dns records, the addresses behind it, and
                where those addresses are registered, dropped on the globe.
                args: { "domain": "example.com" }
                honest limit: this is registry geolocation and dns, not a port
                scan. open ports / running services need a shodan or censys key
                this deployment does not hold — put that in "unresolved".
`;

const NOT_AVAILABLE = `
capabilities this deployment does NOT have — put the ask in "unresolved" and
say plainly what is missing rather than approximating:
  • satellite imagery segmentation (roof colour by pixel, vehicle counting,
    structure detection from imagery). openstreetmap roof:colour tags are the
    only colour signal available, and they are thin.
  • port scanning, service banners, vulnerability data (shodan / censys).
  • corporate ownership registries, dark fibre routes, subsea cable owners.
  • police cad / dispatch audio, citizen app.
`;

const SYSTEM = `you are the intent resolver inside asherin.eye, a live globe.
you convert one operator sentence into a plan of tool calls. you never write
urls, query language, or code, and you never invent a coordinate — every
coordinate in the answer comes back from a tool.

${MANIFEST}
${NOT_AVAILABLE}

reply with strict json only:
{
  "summary": "<what the operator asked for, one lowercase line>",
  "focus_query": "<place name to fly the camera to, or empty>",
  "steps": [ { "tool": "<tool id>", "label": "<short lowercase label>", "args": { } } ],
  "unresolved": [ "<what you cannot do and why, lowercase>" ],
  "say": "<one or two lowercase sentences the globe will speak back>"
}

rules:
  • at most 4 steps. chain them only when a later step needs an earlier place.
  • prefer one osm.features step with several filters over several steps.
  • when the sentence names no place, use the camera position given to you.
  • all prose lowercase. no markdown, no emoji, no capitals except proper
    acronyms and code-like values.
  • if nothing here can answer, return zero steps and one honest unresolved line.`;

// ── bounded fetch helpers ────────────────────────────────────────────────────
async function getJson(url: string, ms = 12_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
  return await res.json();
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clampLat = (v: number) => Math.max(-85, Math.min(85, v));
const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

// ── place resolution (memoised per invocation) ───────────────────────────────
const placeCache = new Map<string, { lat: number; lon: number; label: string }>();

async function locate(q: string) {
  const key = q.trim().toLowerCase().slice(0, 120);
  if (!key) throw new Error("no place named");
  const hit = placeCache.get(key);
  if (hit) return hit;
  const d = (await getJson(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(key)}`,
    12_000,
  )) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = d?.[0];
  if (!first) throw new Error(`no public place called "${key}"`);
  const out = {
    lat: clampLat(Number(first.lat)),
    lon: wrapLon(Number(first.lon)),
    label: String(first.display_name || key).slice(0, 160),
  };
  placeCache.set(key, out);
  return out;
}

// ── overpass, with the same mirror discipline the feed uses ──────────────────
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function overpass(query: string): Promise<Array<Record<string, unknown>>> {
  const errs: string[] = [];
  for (const m of MIRRORS) {
    try {
      const res = await fetch(m, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": UA },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        errs.push(`${new URL(m).hostname} ${res.status}`);
        continue;
      }
      const j = (await res.json()) as { elements?: Array<Record<string, unknown>> };
      return j.elements || [];
    } catch (e) {
      errs.push(`${new URL(m).hostname} ${(e as Error).message}`);
    }
  }
  throw new Error(`openstreetmap mirrors refused · ${errs.join(" · ")}`);
}

// The two gates that make a model-authored filter safe to interpolate. A key is
// an osm tag key; a value is an osm tag value or "*". Anything with a quote, a
// bracket, a semicolon-statement or a newline never reaches the query string.
const KEY_OK = /^[a-z][a-z0-9_:]{1,29}$/;
const VAL_OK = /^[A-Za-z0-9_.\- ]{1,48}$/;

function compileFilters(raw: unknown, anyOf: boolean): { clauses: string[]; dropped: string[] } {
  const list = Array.isArray(raw) ? raw.slice(0, 6) : [];
  const parts: string[] = [];
  const dropped: string[] = [];
  for (const f of list) {
    const key = String((f as Record<string, unknown>)?.key ?? "").trim();
    const value = String((f as Record<string, unknown>)?.value ?? "*").trim();
    if (!KEY_OK.test(key)) {
      dropped.push(`${key || "(blank)"} is not a tag key`);
      continue;
    }
    if (value === "*" || value === "") {
      parts.push(`["${key}"]`);
      continue;
    }
    if (!VAL_OK.test(value)) {
      dropped.push(`${key}=${value.slice(0, 20)} is not a tag value`);
      continue;
    }
    parts.push(`["${key}"="${value}"]`);
  }
  if (!parts.length) return { clauses: [], dropped };
  // any_of: each filter becomes its own selector (a union). and: one selector
  // carrying every clause.
  return { clauses: anyOf ? parts : [parts.join("")], dropped };
}

async function osmFeatures(args: Record<string, unknown>, camera: { lat: number; lon: number }) {
  let lat = num(args.lat);
  let lon = num(args.lon);
  let where = "";
  const place = String(args.place ?? "").trim();
  if ((lat === null || lon === null) && place) {
    const p = await locate(place);
    lat = p.lat;
    lon = p.lon;
    where = p.label;
  }
  if (lat === null || lon === null) {
    lat = camera.lat;
    lon = camera.lon;
    where = "the camera position";
  }
  lat = clampLat(lat);
  lon = wrapLon(lon);
  const radius = Math.max(200, Math.min(30_000, num(args.radius_m) ?? 6_000));
  const limit = Math.max(1, Math.min(300, num(args.limit) ?? 200));
  const anyOf = args.any_of === true;
  const { clauses, dropped } = compileFilters(args.filters, anyOf);
  if (!clauses.length) throw new Error(`no usable osm tag filter · ${dropped.join(" · ") || "none given"}`);

  const around = `(around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const body = clauses
    .map((c) => `node${c}${around};way${c}${around};relation${c}${around};`)
    .join("");
  const elements = await overpass(`[out:json][timeout:25];(${body});out center ${limit};`);

  const rows: Row[] = [];
  for (const el of elements) {
    const tags = (el.tags ?? {}) as Record<string, string>;
    const centre = (el.center ?? {}) as { lat?: number; lon?: number };
    const la = num(el.lat) ?? num(centre.lat);
    const lo = num(el.lon) ?? num(centre.lon);
    if (la === null || lo === null) continue;
    const name = tags.name || tags["name:en"] || tags.operator || tags.brand || "";
    const what = tags.amenity || tags.building || tags.office || tags.man_made || tags.landuse || tags.military ||
      tags.telecom || tags.power || tags.shop || "mapped feature";
    rows.push({
      id: `osm:${String(el.type ?? "n")}${String(el.id ?? rows.length)}`,
      lat: la,
      lon: lo,
      label: (name || what).slice(0, 90),
      note: [what, tags.operator, tags["addr:street"], tags["roof:colour"] ? `roof ${tags["roof:colour"]}` : ""]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 160),
      kind: "osm",
    });
    if (rows.length >= limit) break;
  }
  const detail = [
    `${rows.length} mapped in openstreetmap within ${(radius / 1000).toFixed(1)}km of ${where || "the point"}`,
    dropped.length ? `dropped ${dropped.join(", ")}` : "",
    rows.length ? "" : "openstreetmap has nothing tagged that way here — that is a mapping gap, not an absence on the ground",
  ]
    .filter(Boolean)
    .join(" · ");
  return { rows, detail, focus: { lat, lon }, source: "openstreetmap overpass" };
}

// ── existing feed reuse ──────────────────────────────────────────────────────
const FEED_OK = new Set([
  "flights", "quakes", "disasters", "notices", "incidents", "crime",
  "cameras", "radio", "stations", "launches", "buildings", "places", "military",
]);

async function callFeed(args: Record<string, unknown>, auth: string, camera: { lat: number; lon: number }) {
  const name = String(args.name ?? "").trim();
  if (!FEED_OK.has(name)) throw new Error(`no live feed called "${name.slice(0, 24)}"`);
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("backend url missing");
  const p = (args.params ?? {}) as Record<string, unknown>;
  const params: Record<string, unknown> = { ...p };
  if (params.lat === undefined && ["flights", "crime", "buildings", "cameras", "military"].includes(name)) {
    params.lat = camera.lat;
    params.lon = camera.lon;
  }
  if (params.place && !params.q) params.q = params.place;
  const res = await fetch(`${base}/functions/v1/asherin-eye-feed`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: auth,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
    body: JSON.stringify({ feed: name, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const j = (await res.json().catch(() => ({}))) as { rows?: Array<Record<string, unknown>>; note?: string; error?: string };
  if (j.error && !Array.isArray(j.rows)) throw new Error(String(j.error).slice(0, 160));
  const rows: Row[] = [];
  for (const r of j.rows || []) {
    const la = num(r.lat);
    const lo = num(r.lon);
    if (la === null || lo === null) continue;
    rows.push({
      id: `${name}:${String(r.id ?? rows.length)}`,
      lat: la,
      lon: lo,
      label: String(r.label ?? r.name ?? name).slice(0, 90),
      note: String(r.note ?? "").slice(0, 160),
      url: typeof r.url === "string" ? r.url : undefined,
      kind: name,
    });
    if (rows.length >= 400) break;
  }
  return { rows, detail: String(j.note || `${rows.length} from the ${name} feed`).slice(0, 220), source: `asherin.eye ${name} feed` };
}

// ── dns / address geolocation ────────────────────────────────────────────────
const DOMAIN_OK = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63}){1,4}$/i;

async function netHosts(args: Record<string, unknown>) {
  let domain = String(args.domain ?? "").trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  if (!DOMAIN_OK.test(domain)) throw new Error("that is not a public domain name");
  if (/\.(local|internal|localhost|lan)$/.test(domain)) throw new Error("private namespaces are not resolved here");
  const dns = (await getJson(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, 10_000)) as {
    Answer?: Array<{ data?: string; type?: number }>;
  };
  const ips = (dns.Answer || [])
    .filter((a) => a.type === 1 && typeof a.data === "string")
    .map((a) => String(a.data))
    .filter((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip))
    .filter((ip) => !/^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))
    .slice(0, 8);
  if (!ips.length) throw new Error(`${domain} resolves to no public a record`);
  const rows: Row[] = [];
  for (const ip of ips) {
    try {
      const g = (await getJson(`https://ipwho.is/${ip}`, 8_000)) as {
        success?: boolean; latitude?: number; longitude?: number; city?: string; country?: string;
        connection?: { org?: string; asn?: number; isp?: string };
      };
      if (!g.success || g.latitude == null) continue;
      rows.push({
        id: `ip:${ip}`,
        lat: clampLat(Number(g.latitude)),
        lon: wrapLon(Number(g.longitude)),
        label: ip,
        note: [
          [g.city, g.country].filter(Boolean).join(", "),
          g.connection?.org || g.connection?.isp || "",
          g.connection?.asn ? `as${g.connection.asn}` : "",
        ].filter(Boolean).join(" · ").slice(0, 160),
        kind: "host",
      });
    } catch {
      // one address that will not geolocate thins the answer, never fails it.
    }
  }
  return {
    rows,
    detail:
      `${rows.length} public address${rows.length === 1 ? "" : "es"} behind ${domain} · registry geolocation, so this is the network's registered city, not a rack · open ports and services would need a shodan or censys key this deployment does not hold`,
    source: "dns.google · ipwho.is",
    focus: rows[0] ? { lat: rows[0].lat, lon: rows[0].lon } : undefined,
  };
}

// ── plan execution ───────────────────────────────────────────────────────────
async function runPlan(
  steps: Array<Record<string, unknown>>,
  camera: { lat: number; lon: number },
  auth: string,
) {
  const rows: Row[] = [];
  const reports: StepReport[] = [];
  const sources = new Set<string>();
  let focus: { lat: number; lon: number } | undefined;

  for (const step of steps.slice(0, 4)) {
    const tool = String(step?.tool ?? "").trim();
    const label = String(step?.label ?? tool).slice(0, 60).toLowerCase();
    const args = (step?.args ?? {}) as Record<string, unknown>;
    try {
      let out: { rows: Row[]; detail: string; source: string; focus?: { lat: number; lon: number } };
      if (tool === "place.locate") {
        const p = await locate(String(args.q ?? ""));
        out = {
          rows: [{ id: `place:${p.label}`, lat: p.lat, lon: p.lon, label: p.label, note: "public place index", kind: "place" }],
          detail: p.label,
          source: "openstreetmap nominatim",
          focus: { lat: p.lat, lon: p.lon },
        };
      } else if (tool === "osm.features") {
        out = await osmFeatures(args, camera);
      } else if (tool === "feed") {
        out = await callFeed(args, auth, camera);
      } else if (tool === "net.hosts") {
        out = await netHosts(args);
      } else {
        throw new Error(`no tool called "${tool.slice(0, 24)}"`);
      }
      rows.push(...out.rows);
      sources.add(out.source);
      if (!focus && out.focus) focus = out.focus;
      reports.push({ tool, label, ok: true, count: out.rows.length, detail: out.detail });
    } catch (e) {
      // one refused source thins the answer; it never fakes one.
      reports.push({ tool, label, ok: false, count: 0, detail: String((e as Error).message || e).slice(0, 200) });
    }
  }
  return { rows: rows.slice(0, 600), reports, sources: [...sources], focus };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const q = String(body.q ?? "").trim().slice(0, 600);
  if (!q) return json({ error: "nothing asked" }, 400);
  const cam = (body.camera ?? {}) as Record<string, unknown>;
  const camera = { lat: clampLat(num(cam.lat) ?? 0), lon: wrapLon(num(cam.lon) ?? 0) };

  let cfg: ZophielByokConfig;
  try {
    const key = await resolveKey(req, body.byok);
    cfg = key.mode === "admin"
      ? { provider: "google" as const, model: "gemini-flash-latest", apiKey: key.geminiKey! }
      : key.byok!;
  } catch (e) {
    return byokErrorResponse(e, cors);
  }

  const userPrompt = `operator sentence: "${q}"
camera is presently over lat ${camera.lat.toFixed(4)}, lon ${camera.lon.toFixed(4)}.
plan it.`;

  const askModel = (c: ZophielByokConfig) =>
    callByokJson(c, SYSTEM, userPrompt, {
      timeoutMs: 45_000,
      temperature: 0.15,
      maxOutputTokens: 1600,
      jsonMode: true,
    });

  let plan: Record<string, unknown> = {};
  try {
    let raw: string;
    try {
      raw = await askModel(cfg);
    } catch (first) {
      // A denied or throttled primary key must not take the whole organ down:
      // the plan is small, structured work that any competent model can do, so
      // the platform fallback answers rather than the globe going mute. The
      // original refusal still surfaces if the fallback is absent too.
      const venice = Deno.env.get("VENICE_API_KEY") || "";
      if (!venice || cfg.provider === "venice") throw first;
      raw = await askModel({ provider: "venice", model: "mistral-31-24b", apiKey: venice });
    }
    plan = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, unknown>;
  } catch (e) {
    return json({ error: `intent resolver unreachable · ${String((e as Error).message || e).slice(0, 160)}` }, 200);
  }

  const steps = Array.isArray(plan.steps) ? (plan.steps as Array<Record<string, unknown>>) : [];
  const auth = req.headers.get("authorization") ?? "";
  const { rows, reports, sources, focus } = await runPlan(steps, camera, auth);

  let flyTo = focus;
  const focusQuery = String(plan.focus_query ?? "").trim();
  if (!flyTo && focusQuery) {
    try {
      const p = await locate(focusQuery);
      flyTo = { lat: p.lat, lon: p.lon };
    } catch {
      // a camera that will not move is not a failed answer.
    }
  }

  const unresolved = (Array.isArray(plan.unresolved) ? plan.unresolved : [])
    .map((u) => String(u).slice(0, 200).toLowerCase())
    .slice(0, 4);

  return json({
    summary: String(plan.summary ?? q).slice(0, 200).toLowerCase(),
    say: String(plan.say ?? "").slice(0, 600).toLowerCase(),
    rows,
    steps: reports,
    sources,
    unresolved,
    focus: flyTo,
  });
});
