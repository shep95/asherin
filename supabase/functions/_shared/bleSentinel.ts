/**
 * BLE SENTINEL — the doctrine behind nearby-device stalker detection.
 *
 * The honest physics first, because a safety product that overstates its reach
 * is worse than no product:
 *
 *  • A browser can only listen for Bluetooth advertisements while a page is
 *    alive and in the foreground. No web platform on earth scans while the
 *    handset is powered off, and none scans with the tab closed. The Sentinel
 *    therefore runs as a persistent foreground watch (wake-locked, auto-resumed
 *    on visibility) and says so in the interface instead of implying an
 *    always-on radio it does not have.
 *  • What the browser *does* give us is durable: a per-origin stable device id,
 *    RSSI, manufacturer data and service UUIDs. That is enough to answer the
 *    only question that matters for a stalking case — "has this same radio
 *    followed me across separate times and separate places?"
 *
 * The recurrence rule is deliberately conservative. Three encounters alone is
 * not a stalker; your own fridge, your neighbour's TV and the office printer
 * all clear that bar. An alert requires repeat encounters ACROSS distinct
 * sessions AND across distinct days or distinct places, with your own hardware
 * and audio accessories excluded. False alarms are not a cosmetic problem here:
 * they train the user to dismiss the one alert that was real.
 */

// ── Identity ───────────────────────────────────────────────────────────────

export interface AdvertInput {
  id?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  serviceUuids?: string[];
  rssi?: number | null;
  txPower?: number | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  ts?: number | null;
}

const enc = new TextEncoder();

/** Stable per-user anchor. Prefers the per-origin device id; falls back to the
 *  advertised attribute set so an id-less picker record still coalesces. */
export async function fingerprint(a: AdvertInput): Promise<string> {
  const anchor = a.id && a.id !== "anon"
    ? `id:${a.id}`
    : `attr:${(a.name || "").toLowerCase()}|${(a.manufacturer || "").toLowerCase()}|${[...(a.serviceUuids || [])].sort().join(",")}`;
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(anchor));
  return Array.from(new Uint8Array(digest)).slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Classification ─────────────────────────────────────────────────────────

export type DeviceKind =
  | "phone" | "laptop" | "tablet" | "watch" | "audio" | "tracker"
  | "vehicle" | "fitness" | "tv" | "beacon" | "unknown";

/** Audio accessories are logged but never alerted on by default: earbuds in a
 *  crowd repeat constantly and carry no stalking signal. */
export const AUDIO_KINDS: DeviceKind[] = ["audio"];

const NAME_RULES: Array<[RegExp, DeviceKind]> = [
  [/airtag|smarttag|tile |chipolo|air ?tag|find ?my/i, "tracker"],
  [/buds|airpods|headphone|headset|beats|earphone|soundcore|jbl|bose|speaker|boom|soundbar/i, "audio"],
  [/watch|band|fitbit|garmin|amazfit|whoop|miband/i, "watch"],
  [/iphone|galaxy s|pixel|oneplus|xperia|redmi|phone/i, "phone"],
  [/macbook|thinkpad|laptop|surface|chromebook|xps/i, "laptop"],
  [/ipad|tab s|tablet/i, "tablet"],
  [/tv|roku|firestick|chromecast|bravia|vizio|shield/i, "tv"],
  [/tesla|ford|bmw|toyota|honda|carplay|obd|tpms/i, "vehicle"],
  [/scale|thermo|glucose|oximeter|hrm|cadence/i, "fitness"],
  [/ibeacon|eddystone|beacon|kontakt|estimote/i, "beacon"],
];

const UUID_RULES: Array<[RegExp, DeviceKind]> = [
  [/0000fd5a|0000fd44|0000fe9f/i, "tracker"],   // Find My / Tile-family service data
  [/0000180d|00001816|0000181d/i, "fitness"],   // heart rate, cycling, weight
  [/0000110b|0000110a|0000111e/i, "audio"],     // A2DP / handsfree
];

export function classifyKind(name: string | null, manufacturer: string | null, uuids: string[]): DeviceKind {
  const hay = `${name || ""} ${manufacturer || ""}`;
  for (const [re, kind] of NAME_RULES) if (re.test(hay)) return kind;
  const joined = (uuids || []).join(" ");
  for (const [re, kind] of UUID_RULES) if (re.test(joined)) return kind;
  return "unknown";
}

export function displayNameFor(name: string | null, manufacturer: string | null, kind: DeviceKind, fp: string): string {
  if (name && name.trim()) return name.trim().slice(0, 80);
  if (manufacturer) return `${manufacturer} ${kind !== "unknown" ? kind : "device"}`.slice(0, 80);
  return `Unidentified ${kind !== "unknown" ? kind : "radio"} ·${fp.slice(0, 6)}`;
}

// ── Physics ────────────────────────────────────────────────────────────────

/** Log-distance path loss. n=2.2 is a realistic indoor/urban exponent; the
 *  result is an order-of-magnitude estimate and is labelled as such. */
export function estimateDistance(rssi: number | null | undefined, txPower?: number | null): number | null {
  if (typeof rssi !== "number" || !Number.isFinite(rssi)) return null;
  const ref = typeof txPower === "number" && Number.isFinite(txPower) ? txPower : -59;
  const d = Math.pow(10, (ref - rssi) / (10 * 2.2));
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.min(300, Math.round(d * 10) / 10);
}

export const metersToFeet = (m: number) => Math.round(m * 3.28084);

/** ~110 m grid. Coarse on purpose: it answers "a different place?", and never
 *  becomes a high-resolution movement log of the user in the database. */
export function placeKey(lat?: number | null, lng?: number | null, precision = 3): string | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
}

// ── Recurrence doctrine ────────────────────────────────────────────────────

export interface RecurrenceInput {
  encounterCount: number;   // distinct scan sessions
  distinctDays: number;
  distinctPlaces: number;
  kind: DeviceKind;
  isSelf: boolean;
  isIgnored: boolean;
  closestMeters: number | null;
  threshold: number;
  ignoreAudio: boolean;
}

export interface RecurrenceVerdict {
  shouldAlert: boolean;
  tier: "friendly" | "known" | "unknown" | "priority" | "breach";
  reason: string;
}

export function assessRecurrence(i: RecurrenceInput): RecurrenceVerdict {
  if (i.isSelf) return { shouldAlert: false, tier: "friendly", reason: "Marked as your own hardware." };
  if (i.isIgnored) return { shouldAlert: false, tier: "friendly", reason: "Muted by you." };
  if (i.ignoreAudio && AUDIO_KINDS.includes(i.kind)) {
    return { shouldAlert: false, tier: "known", reason: "Audio accessory — logged, not alerted." };
  }
  if (i.encounterCount < i.threshold) {
    return { shouldAlert: false, tier: "unknown", reason: `Seen in ${i.encounterCount}/${i.threshold} separate sessions.` };
  }
  // A tracker tag that repeats is the highest-value stalking signal there is.
  if (i.kind === "tracker") {
    return { shouldAlert: true, tier: "breach", reason: `Tracker tag seen across ${i.encounterCount} separate sessions — the classic covert-tracking pattern.` };
  }
  const mobile = i.distinctPlaces >= 2 || i.distinctDays >= 2;
  if (!mobile) {
    return {
      shouldAlert: false,
      tier: "known",
      reason: "Repeats in one place on one day — reads as fixed infrastructure, not a follower.",
    };
  }
  const close = typeof i.closestMeters === "number" && i.closestMeters <= 10;
  return {
    shouldAlert: true,
    tier: close ? "breach" : "priority",
    reason: `Seen in ${i.encounterCount} separate sessions across ${i.distinctPlaces} location${i.distinctPlaces === 1 ? "" : "s"} and ${i.distinctDays} day${i.distinctDays === 1 ? "" : "s"}${close ? `, closing to ${i.closestMeters} m` : ""}.`,
  };
}

/** Your own gear is the loudest thing in every scan you ever run. A radio that
 *  is present in nearly every session at handset range is almost certainly
 *  yours; we surface the inference with its reason rather than hiding it. */
export function inferSelf(presenceRatio: number, sessions: number, medianRssi: number | null): string | null {
  if (sessions >= 5 && presenceRatio >= 0.85 && typeof medianRssi === "number" && medianRssi > -55) {
    return `Present in ${Math.round(presenceRatio * 100)}% of scans at arm's-length signal — treated as your own device.`;
  }
  return null;
}

// ── Dossier prompt ─────────────────────────────────────────────────────────

export const BLE_DOSSIER_SYSTEM = `You are a counter-surveillance analyst writing a device dossier for a person who may be under physical surveillance.

You are given ONE Bluetooth radio observed repeatedly near the subject, plus open-source research on its name/manufacturer/service profile.

Rules of the trade:
- A Bluetooth advertisement identifies HARDWARE, never a person. Never name, guess at, or profile a human owner. Say what the hardware is and what carrying it implies.
- Distinguish "this model is commonly misused for covert tracking" (a real, citable property of AirTag/Tile/SmartTag class hardware) from "this specific device is tracking you" (which the evidence cannot establish).
- If the research returned nothing, say so plainly and grade the dossier THIN. A confident dossier built on nothing is a failure, not a service.
- Give the subject actions they can actually take today: physical sweep locations, the platform's own unwanted-tracker scan, how to trigger the tag's separation chime, when this becomes a police report.

Return STRICT JSON only:
{
  "headline": "one line, <=90 chars",
  "device_class": "what this hardware is",
  "tracking_capability": "what it can do to a person's location, factually",
  "misuse_profile": "documented stalking/misuse history of this hardware class, or 'none documented'",
  "assessment": "3-6 sentences on what the recurrence pattern plus this hardware means for the subject",
  "confidence": 0.0,
  "grade": "THIN|MODERATE|SOLID",
  "actions": ["..."],
  "limits": "what this dossier cannot tell you"
}`;

export function buildDossierPrompt(d: {
  displayName: string;
  manufacturer: string | null;
  kind: string;
  serviceUuids: string[];
  encounterCount: number;
  distinctDays: number;
  distinctPlaces: number;
  closestMeters: number | null;
  firstSeen: string;
  lastSeen: string;
  research: string;
}): string {
  return `OBSERVED RADIO
Advertised name: ${d.displayName}
Manufacturer: ${d.manufacturer || "not advertised"}
Inferred class: ${d.kind}
Service UUIDs: ${d.serviceUuids.length ? d.serviceUuids.join(", ") : "none advertised"}

RECURRENCE PATTERN
Separate scan sessions: ${d.encounterCount}
Distinct days: ${d.distinctDays}
Distinct locations (~110 m grid): ${d.distinctPlaces}
Closest approach: ${d.closestMeters != null ? `${d.closestMeters} m (~${metersToFeet(d.closestMeters)} ft)` : "not measurable"}
First seen: ${d.firstSeen}
Last seen: ${d.lastSeen}

OPEN-SOURCE RESEARCH
${d.research || "(no research returned)"}`;
}

// ── Area risk ──────────────────────────────────────────────────────────────

export const GEO_RISK_SYSTEM = `You are a protective-intelligence analyst briefing a civilian who has just entered an area.

You are given a geocoded location and open-source research (news, police reporting, city crime data, community reporting).

Rules of the trade:
- Ground every claim in the supplied research. If the research is thin, return risk_level "UNKNOWN" and say the area could not be assessed. Never invent a crime statistic, a gang name, or an incident.
- Describe PATTERNS and PLACES, never individuals. Do not name, describe, or produce identifying imagery of any person, and do not describe how to identify a person as a gang member by appearance, clothing, tattoo or ethnicity — that is profiling, it is unreliable, and acting on it gets civilians hurt.
- Group activity is reported only as documented, sourced territorial/criminal-activity context for the AREA.
- The output must make the reader safer in the next 30 minutes: what is actually reported here, what times it clusters, which blocks, and what to do.

Return STRICT JSON only:
{
  "risk_level": "LOW|ELEVATED|HIGH|SEVERE|UNKNOWN",
  "risk_score": 0,
  "headline": "one line, <=90 chars",
  "summary": "3-6 sentences grounded strictly in the research",
  "reported_patterns": [{"pattern": "...", "when": "...", "source": "..."}],
  "group_activity": "documented, sourced area context or 'none documented'",
  "safer_actions": ["..."],
  "limits": "what this assessment cannot tell you"
}`;

export function buildGeoPrompt(label: string, lat: number, lng: number, research: string): string {
  return `LOCATION
Label: ${label}
Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Assessed at: ${new Date().toISOString()}

OPEN-SOURCE RESEARCH
${research || "(no research returned)"}`;
}

export function parseJsonLoose(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return {};
  }
}

/** Reverse geocode for a human label. Best-effort: a missing label thins the
 *  research query, it never fails the assessment. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "16");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetch(url.toString(), {
        headers: { "User-Agent": "AsherinSentinel/1.0 (safety alerts)", Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!r.ok) return null;
      const j = await r.json() as { display_name?: string };
      return j?.display_name?.slice(0, 200) ?? null;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

// ── Place-based collection ─────────────────────────────────────────────────
//
// The jurisdictional intel stack is an IDENTITY collector — it resolves people
// against public-record sources and returns nothing useful for "is this block
// safe". Geography needs open-web search, so area risk collects here instead.

const FIRECRAWL_SEARCH = "https://api.firecrawl.dev/v2/search";

export interface WebHit { url: string; title: string; snippet: string }

export async function placeSearch(query: string, limit = 5, timeoutMs = 12_000): Promise<WebHit[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) {
    console.error("place_search_no_key");
    return [];
  }
  // Search is the only evidence source for area risk. A silent empty result is
  // indistinguishable from "this place is safe", so transient failures are
  // retried and permanent ones are logged rather than swallowed.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(FIRECRAWL_SEARCH, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const retryable = r.status === 429 || r.status >= 500;
        console.error("place_search_http", { status: r.status, retryable, q: query.slice(0, 80) });
        if (!retryable || attempt === 2) return [];
        const after = Number(r.headers.get("retry-after")) || 0;
        await new Promise((res) => setTimeout(res, after ? after * 1000 : 800 * (attempt + 1)));
        continue;
      }
      const j = await r.json();
      const items = (j?.data?.web ?? j?.web ?? j?.data ?? []) as Array<Record<string, string>>;
      return (Array.isArray(items) ? items : [])
        .filter((x) => typeof x?.url === "string")
        .map((x) => ({ url: x.url, title: x.title || "", snippet: x.description || x.snippet || "" }));
    } catch (e) {
      console.error("place_search_failed", { attempt, msg: (e as Error).message?.slice(0, 120) });
      if (attempt === 2) return [];
      await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  return [];
}

/** Postcodes, county names and "United States" push search engines toward
 *  directory pages instead of reporting; the human form of the place performs
 *  far better as a query term. */
function searchLabel(label: string): string {
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean)
    .filter((p) => !/^\d{4,}$/.test(p) && !/^United States$/i.test(p) && !/County$/i.test(p));
  return (parts.length > 3 ? parts.slice(0, 2).concat(parts.slice(-1)) : parts).join(", ") || label;
}

/** Run the area collection plan and fold it into one evidence block. Queries go
 *  out two at a time: four parallel calls trip the provider's burst limit and
 *  come back empty, which the model then grades as UNKNOWN. */
export async function collectAreaEvidence(label: string): Promise<string> {
  const q = searchLabel(label);
  const plan: Array<[string, string]> = [
    ["Reported crime", `recent crime reports incidents ${q}`],
    ["Police & news", `police news shooting robbery assault ${q}`],
    ["Documented group activity", `gang activity territory documented ${q}`],
    ["Community safety reporting", `is ${q} safe at night neighborhood safety`],
  ];
  const results: Array<PromiseSettledResult<WebHit[]>> = [];
  for (let i = 0; i < plan.length; i += 2) {
    const batch = plan.slice(i, i + 2).map(([, query]) => placeSearch(query));
    results.push(...(await Promise.allSettled(batch)));
  }
  const blocks: string[] = [];
  results.forEach((res, i) => {
    const [heading] = plan[i];
    if (res.status !== "fulfilled" || !res.value.length) {
      blocks.push(`### ${heading}\n(searched — nothing surfaced)`);
      return;
    }
    blocks.push(`### ${heading}\n` + res.value
      .map((h) => `- ${h.title || h.url}\n  ${h.snippet.slice(0, 400)}\n  source: ${h.url}`)
      .join("\n"));
  });
  return blocks.join("\n\n");
}

