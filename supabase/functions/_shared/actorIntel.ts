/**
 * ACTOR INTEL — server-side enrichment for account-security events.
 *
 * A password-change alert that says "your password was changed" and nothing
 * else is not a security notification, it is a receipt. The account owner
 * needs to know who: the origin IP, the network that owns it (ISP, ASN,
 * whether it is a residential connection, a mobile carrier, a VPN exit, or
 * a datacentre), the coarse geolocation with a real satellite thumbnail of
 * the block the request came from, and the device fingerprint that
 * accompanied the call. That is the difference between "someone changed
 * my password" and "someone on a Comcast residential line in Fort Wayne,
 * Indiana, using a fresh Chrome on Windows 11, changed my password at
 * 03:08:49 UTC — and here is the block they were sitting in."
 *
 * This module is pure and dependency-free so it can be imported by
 * security-notify, the historical dispatch action, and any future
 * account-security surface without pulling in a heavier client.
 */

export interface ActorIntel {
  ip: string | null;
  device: string;                 // "Desktop — Chrome / Windows 10/11"
  browser: string;
  os: string;
  deviceType: string;
  isp: string | null;
  org: string | null;
  asn: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postal: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
  reverseDns: string | null;
  satelliteUrl: string | null;    // static Esri World Imagery export
  mapsUrl: string | null;         // click-through to Asherin Maps
  threatBadges: string[];         // human labels: VPN/proxy, mobile carrier, datacentre, etc.
}

/** Strict private-range test so an internal request never gets enriched. */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.") || ip.startsWith("fe80:")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const o = parseInt(m[1], 10);
    if (o >= 16 && o <= 31) return true;
  }
  return false;
}

/**
 * Extract the caller's real IP. Supabase Edge Functions sit behind a
 * reverse proxy, so the connection socket is always internal — the true
 * source is in the forward headers. Take the FIRST entry of x-forwarded-for
 * (the client), never the last (the proxy chain).
 */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && !isPrivateIp(first)) return first;
  }
  const cf = headers.get("cf-connecting-ip");
  if (cf && !isPrivateIp(cf)) return cf;
  const real = headers.get("x-real-ip");
  if (real && !isPrivateIp(real)) return real;
  return null;
}

/**
 * Minimal user-agent parser. A full UA library is overkill for the four
 * facts this alert actually shows the owner — browser family, OS family,
 * form factor — and pulling one in for one email is exactly the kind of
 * dependency that rots.
 */
export function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  const s = ua || "";
  let browser = "Unknown browser";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\//i.test(s) || /Opera/i.test(s)) browser = "Opera";
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s)) browser = "Safari";
  else if (/CriOS/i.test(s)) browser = "Chrome iOS";

  let os = "Unknown OS";
  if (/Windows NT 10/i.test(s)) os = "Windows 10/11";
  else if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Linux/i.test(s)) os = "Linux";

  const deviceType = /Mobi|Android|iPhone|iPod/i.test(s)
    ? "Mobile"
    : /iPad|Tablet/i.test(s)
      ? "Tablet"
      : "Desktop";
  return { browser, os, deviceType };
}

/**
 * Static satellite tile for the actor's coordinates. Esri World Imagery
 * accepts unauthenticated `export` requests that render a JPEG for any
 * bbox — perfect for an inline email <img>. A ~500 m box gives the owner
 * a block-level view without pinpointing a household.
 */
export function satelliteExportUrl(lat: number, lon: number): string {
  const halfDeg = 0.004; // ~440 m at the equator
  const bbox = `${lon - halfDeg},${lat - halfDeg},${lon + halfDeg},${lat + halfDeg}`;
  const params = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    imageSR: "3857",
    size: "560,320",
    format: "jpg",
    f: "image",
  });
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}

function mapsDeepLink(lat: number, lon: number): string {
  // Same-origin deep link into Asherin Maps with a preselected pin.
  return `/dashboard/maps?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&z=15`;
}

/**
 * Enrich an IP with geo, ISP/ASN and threat surface flags.
 * ip-api.com's free tier answers 45 req/min with proxy+hosting+mobile
 * flags — enough signal to badge a VPN, a datacentre or a mobile carrier
 * next to the coordinates.
 */
async function ipApi(ip: string, signal: AbortSignal): Promise<Partial<ActorIntel>> {
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}` +
      `?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,reverse,query`;
    const r = await fetch(url, { signal });
    if (!r.ok) return {};
    const j = await r.json();
    if (j?.status !== "success") return {};
    const asRaw = typeof j.as === "string" ? j.as : "";
    const asn = asRaw ? asRaw.split(" ")[0] : null;
    return {
      country: j.country ?? null,
      region: j.regionName ?? null,
      city: j.city ?? null,
      postal: j.zip ?? null,
      latitude: typeof j.lat === "number" ? j.lat : null,
      longitude: typeof j.lon === "number" ? j.lon : null,
      timezone: j.timezone ?? null,
      isp: j.isp ?? null,
      org: j.org ?? null,
      asn,
      mobile: Boolean(j.mobile),
      proxy: Boolean(j.proxy),
      hosting: Boolean(j.hosting),
      reverseDns: j.reverse ?? null,
    };
  } catch {
    return {};
  }
}

/** Compose the human badges from the raw provider flags. */
function badges(base: Partial<ActorIntel>): string[] {
  const out: string[] = [];
  if (base.proxy) out.push("VPN / Proxy exit");
  if (base.hosting) out.push("Datacentre IP");
  if (base.mobile) out.push("Mobile carrier");
  if (!base.proxy && !base.hosting && !base.mobile && base.isp) out.push("Residential ISP");
  return out;
}

/**
 * Full enrichment. Never throws — the account-security alert must fire even
 * when every enrichment provider is down. Missing fields simply drop off
 * the email; the audit row always persists.
 */
export async function enrichActor(ip: string | null, userAgent: string): Promise<ActorIntel> {
  const ua = parseUserAgent(userAgent);
  const device = `${ua.deviceType} — ${ua.browser} / ${ua.os}`;

  const shell: ActorIntel = {
    ip,
    device,
    browser: ua.browser,
    os: ua.os,
    deviceType: ua.deviceType,
    isp: null, org: null, asn: null,
    country: null, region: null, city: null, postal: null,
    latitude: null, longitude: null, timezone: null,
    mobile: false, proxy: false, hosting: false,
    reverseDns: null,
    satelliteUrl: null,
    mapsUrl: null,
    threatBadges: [],
  };
  if (!ip || isPrivateIp(ip)) return shell;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  const extra = await ipApi(ip, ctl.signal);
  clearTimeout(t);

  const merged: ActorIntel = { ...shell, ...extra };
  if (typeof merged.latitude === "number" && typeof merged.longitude === "number") {
    merged.satelliteUrl = satelliteExportUrl(merged.latitude, merged.longitude);
    merged.mapsUrl = mapsDeepLink(merged.latitude, merged.longitude);
  }
  merged.threatBadges = badges(merged);
  return merged;
}

/**
 * Turn an ActorIntel into the labelled rows and bullet findings that the
 * intelligence-report email template already knows how to render.
 */
export function actorSections(a: ActorIntel): { sections: { label: string; value: string }[]; findings: string[] } {
  const sections: { label: string; value: string }[] = [];
  if (a.ip) sections.push({ label: "Origin IP", value: a.ip });
  const loc = [a.city, a.region, a.country].filter(Boolean).join(", ");
  if (loc) sections.push({ label: "Location", value: loc + (a.postal ? ` ${a.postal}` : "") });
  if (typeof a.latitude === "number" && typeof a.longitude === "number") {
    sections.push({ label: "Coordinates", value: `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` });
  }
  if (a.timezone) sections.push({ label: "Timezone", value: a.timezone });
  if (a.isp) sections.push({ label: "Network operator", value: a.isp });
  if (a.org && a.org !== a.isp) sections.push({ label: "Registered organisation", value: a.org });
  if (a.asn) sections.push({ label: "ASN", value: a.asn });
  if (a.reverseDns) sections.push({ label: "Reverse DNS", value: a.reverseDns });
  sections.push({ label: "Device", value: a.device });
  if (a.threatBadges.length) sections.push({ label: "Network class", value: a.threatBadges.join(" · ") });

  const findings: string[] = [];
  if (a.proxy) findings.push("Origin IP resolves to a VPN or public proxy exit — the visible geography may not be the actor's real geography.");
  if (a.hosting) findings.push("Origin IP is registered to a hosting or cloud provider, not a home connection — atypical for a legitimate password change from a personal device.");
  if (a.mobile) findings.push("Origin IP is a mobile carrier gateway — geolocation for carrier NAT ranges is coarse and can be hundreds of miles off the actual device.");
  if (!a.proxy && !a.hosting && !a.mobile && a.isp) findings.push(`Origin traces to a residential connection on ${a.isp}${loc ? ` in ${loc}` : ""} — consistent with a personal device on a home network.`);
  return { sections, findings };
}
