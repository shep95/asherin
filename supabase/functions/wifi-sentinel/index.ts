/**
 * WI-FI SENTINEL — background safety report for every network you join.
 *
 * NARRATIVE
 * A Wi-Fi network is the single most privileged position an attacker can
 * occupy against a phone: it sits between the device and everything it talks
 * to. Yet the decision to join one is made in half a second, from a name in a
 * list, with no information at all. This function supplies the information
 * that should have been there — automatically, on connect, without the owner
 * asking.
 *
 * Six questions are answered for each access point:
 *
 *   WHO OWNS IT   — the first three octets of the BSSID are an IEEE-registered
 *                   organisationally unique identifier. That yields the
 *                   hardware maker, and the public egress address yields the
 *                   carrier or hosting operator behind it. A "Starbucks WiFi"
 *                   broadcast from a consumer travel-router is a lie the OUI
 *                   exposes instantly.
 *   HOW FAR       — RSSI to metres via the log-distance path-loss model. This
 *                   is an ORDER OF MAGNITUDE, not a measurement; walls and
 *                   bodies dominate the term. Its value is relative: an AP
 *                   estimated at 2 m in a room where the visible router is
 *                   40 m away is sitting in somebody's bag.
 *   HOW UNSAFE    — open networks carry no link-layer encryption at all, WEP
 *                   is broken, WPA/TKIP is deprecated, WPA2 is acceptable,
 *                   WPA3 with PMF resists the deauth-and-capture family.
 *   WHAT IT SEES  — every unencrypted byte, every DNS question, every TLS SNI
 *                   hostname, and — where the resolvers are attacker-chosen —
 *                   the ability to redirect any name to any address.
 *   WHO ELSE IS ON— device count from the companion's ARP sweep when present.
 *                   Never invented; absent means absent.
 *   IS IT A TWIN  — the same SSID appearing under a second BSSID is the
 *                   classic evil-twin signature, and it is detectable only
 *                   because this ledger remembers what the name looked like
 *                   the first time.
 *
 * Everything is scoped to the caller's own auth.uid(). No action accepts a
 * user id from the body, and enrichment failures degrade to nulls rather than
 * blocking the safety verdict — a partial report delivered is worth more than
 * a perfect report withheld.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notifyIntel } from "../_shared/intelNotify.ts";
import { enrichActor } from "../_shared/actorIntel.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
};

// ── BSSID hygiene ──────────────────────────────────────────────────────────

/** Canonical lowercase colon form. Anything that is not a MAC is rejected. */
function normaliseBssid(raw: string): string | null {
  const hex = raw.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}

/**
 * Locally-administered bit (second-least-significant bit of the first octet).
 * Set means the address was chosen by software rather than burned in by a
 * manufacturer — normal for randomised clients, deeply abnormal for a fixed
 * access point, and the standard tell of a software hotspot masquerading as
 * venue infrastructure.
 */
const isLocallyAdministered = (bssid: string) =>
  (parseInt(bssid.slice(0, 2), 16) & 0b10) !== 0;

// ── OUI vendor lookup ──────────────────────────────────────────────────────

const vendorCache = new Map<string, string | null>();

async function lookupVendor(bssid: string): Promise<string | null> {
  const oui = bssid.slice(0, 8);
  if (vendorCache.has(oui)) return vendorCache.get(oui)!;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`https://api.macvendors.com/${encodeURIComponent(bssid)}`, {
      signal: ctl.signal,
    });
    // 404 is a legitimate answer ("unregistered prefix"), and it is cached so a
    // repeat sweep does not re-spend the rate limit on a known unknown.
    const v = r.ok ? (await r.text()).trim().slice(0, 120) || null : null;
    vendorCache.set(oui, v);
    return v;
  } catch {
    return null; // deliberately NOT cached: a timeout is not evidence
  } finally {
    clearTimeout(timer);
  }
}

// ── distance ───────────────────────────────────────────────────────────────

/**
 * Log-distance path loss: d = 10^((TxPower − RSSI) / (10·n)).
 *
 * TxPower is the reference RSSI at one metre; −40 dBm is typical for a
 * consumer AP at 2.4 GHz and −45 dBm at 5 GHz, where free-space loss is
 * higher. n is the environmental exponent: 2.0 outdoors, ~2.7 through
 * ordinary interior walls. The result is clamped to a sane band because the
 * model diverges violently at both extremes.
 */
function estimateDistanceM(rssi: number | null, frequencyMhz: number | null): number | null {
  if (rssi === null || rssi >= 0 || rssi < -110) return null;
  const txPower = frequencyMhz && frequencyMhz >= 4900 ? -45 : -40;
  const n = 2.7;
  const d = Math.pow(10, (txPower - rssi) / (10 * n));
  return Math.round(Math.min(300, Math.max(0.5, d)) * 10) / 10;
}

const bandOf = (mhz: number | null): string | null =>
  mhz === null ? null : mhz >= 5925 ? "6 GHz" : mhz >= 4900 ? "5 GHz" : "2.4 GHz";

// ── DNS posture ────────────────────────────────────────────────────────────

const PRIVATE_RE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fe80:)/i;
/** Resolvers whose operators are publicly known and contractually bound. */
const KNOWN_PUBLIC_RESOLVERS = new Set([
  "1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9", "149.112.112.112",
  "208.67.222.222", "208.67.220.220", "94.140.14.14", "76.76.2.0",
]);

// ── risk model ─────────────────────────────────────────────────────────────

interface Finding { severity: "critical" | "high" | "medium" | "low" | "info"; title: string; detail: string; }

const WEIGHT = { critical: 40, high: 25, medium: 12, low: 5, info: 0 } as const;

interface ScoreInput {
  security: string;
  bssid: string;
  vendor: string | null;
  ssid: string;
  isHidden: boolean;
  captivePortalUrl: string | null;
  dnsServers: string[];
  connectedDevices: number | null;
  distanceM: number | null;
  twinBssids: string[];
  egress: { isp: string | null; org: string | null; hosting: boolean; proxy: boolean } | null;
}

function assess(i: ScoreInput): { findings: Finding[]; score: number; level: string } {
  const f: Finding[] = [];
  const sec = i.security.toUpperCase();

  if (!sec || sec.includes("OPEN") || sec === "NONE") {
    f.push({
      severity: "critical",
      title: "No link-layer encryption",
      detail:
        "This network is open. Every device in radio range — not just those connected — can " +
        "read any traffic that is not itself encrypted, and can see the hostname of every " +
        "site you visit even when it is. Treat everything sent here as public.",
    });
  } else if (sec.includes("WEP")) {
    f.push({
      severity: "critical",
      title: "WEP encryption — broken since 2001",
      detail: "The key is recoverable from a few minutes of captured traffic with commodity tooling. This is functionally an open network with a lock painted on it.",
    });
  } else if (sec.includes("WPA3") || sec.includes("SAE")) {
    f.push({ severity: "info", title: "WPA3 / SAE", detail: "Current-generation encryption with protected management frames. Resistant to offline dictionary attack and to the deauthentication-and-capture family." });
  } else if (sec.includes("WPA2") || sec.includes("RSN")) {
    f.push({ severity: "low", title: "WPA2", detail: "Acceptable. The pre-shared key is shared by every guest, so anyone who also knows it can decrypt your session if they captured your handshake." });
  } else if (sec.includes("WPA") || sec.includes("TKIP")) {
    f.push({ severity: "high", title: "WPA/TKIP — deprecated", detail: "TKIP has practical attacks and has been withdrawn from the standard. Traffic on this network should be considered recoverable." });
  }

  if (isLocallyAdministered(i.bssid)) {
    f.push({
      severity: "high",
      title: "Software-generated hardware address",
      detail:
        "The locally-administered bit is set on this BSSID, meaning the address was assigned by " +
        "software rather than burned in at manufacture. Fixed venue access points do not do " +
        "this. Phone hotspots and rogue travel routers do.",
    });
  }

  if (!i.vendor) {
    f.push({ severity: "low", title: "Unregistered hardware prefix", detail: "The address prefix does not resolve to an IEEE-registered manufacturer, which is consistent with spoofed or randomised hardware." });
  }

  if (i.twinBssids.length) {
    f.push({
      severity: "critical",
      title: "Evil-twin signature",
      detail:
        `The network name "${i.ssid}" has been observed under ${i.twinBssids.length + 1} different ` +
        `hardware addresses (${[i.bssid, ...i.twinBssids].join(", ")}). Either the venue runs ` +
        "multiple access points, or something is impersonating this name to harvest connections.",
    });
  }

  if (i.isHidden) {
    f.push({ severity: "medium", title: "Hidden network name", detail: "Hiding the SSID provides no security and forces your device to broadcast the name continuously while searching for it, which makes you trackable across locations." });
  }

  if (i.captivePortalUrl) {
    f.push({
      severity: "medium",
      title: "Captive portal in front of the connection",
      detail:
        `Access is gated by ${i.captivePortalUrl}. Portals typically collect an email address, ` +
        "a phone number or a social login, and they bind that identity to your device's hardware " +
        "address so the venue can recognise your return visits indefinitely.",
    });
  }

  const foreignResolvers = i.dnsServers.filter(
    (d) => !PRIVATE_RE.test(d) && !KNOWN_PUBLIC_RESOLVERS.has(d),
  );
  if (foreignResolvers.length) {
    f.push({
      severity: "high",
      title: "Unrecognised DNS resolvers",
      detail:
        `This network hands out ${foreignResolvers.join(", ")} for name resolution — neither the ` +
        "router itself nor any well-known public resolver. Whoever operates those addresses sees " +
        "every domain you look up and can point any name at any server they choose.",
    });
  } else if (i.dnsServers.length) {
    f.push({ severity: "info", title: "DNS resolvers", detail: `Resolution via ${i.dnsServers.join(", ")} — router-local or a recognised public resolver.` });
  }

  if (i.egress?.hosting) {
    f.push({ severity: "high", title: "Traffic egresses through a datacentre", detail: `The public address of this network belongs to ${i.egress.org ?? i.egress.isp ?? "a hosting provider"} rather than a consumer or carrier network. The connection is being relayed through infrastructure somebody else controls.` });
  }
  if (i.egress?.proxy) {
    f.push({ severity: "medium", title: "Egress is a proxy or VPN exit", detail: "The network's outbound address is a known proxy exit. Your apparent location and identity are being rewritten by the operator." });
  }

  if (typeof i.connectedDevices === "number") {
    const sev = i.connectedDevices > 40 ? "medium" : "info";
    f.push({
      severity: sev as Finding["severity"],
      title: `${i.connectedDevices} devices on the local segment`,
      detail:
        i.connectedDevices > 40
          ? "A large shared segment. On most consumer access points, every one of these devices can attempt to reach yours directly unless client isolation is enabled."
          : "Counted by an active address-resolution sweep of the local segment.",
    });
  }

  if (i.distanceM !== null && i.distanceM <= 3) {
    f.push({ severity: "low", title: `Transmitter within ~${i.distanceM} m`, detail: "Signal strength places the radio in the immediate vicinity. Worth a glance if no access point is visible where you are standing." });
  }

  const score = Math.min(100, f.reduce((s, x) => s + WEIGHT[x.severity], 0));
  const level = score >= 65 ? "critical" : score >= 40 ? "high" : score >= 18 ? "moderate" : "low";
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  f.sort((a, b) => order[a.severity] - order[b.severity]);
  return { findings: f, score, level };
}

// ── handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const action = str(body.action, 40) || "report";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await asUser.auth.getUser();
  const user = auth?.user;
  if (authErr || !user) return json({ error: "unauthorized" }, 401, cors);
  const userId = user.id;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    if (action === "list") {
      const { data, error } = await sb.from("wifi_networks")
        .select("*").eq("user_id", userId)
        .order("last_seen", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, networks: data ?? [] }, 200, cors);
    }

    if (action === "forget") {
      const raw = str(body.bssid, 64);
      const bssid = normaliseBssid(raw) ?? (raw.startsWith("uplink:") ? raw : null);
      if (!bssid) return json({ error: "invalid_bssid" }, 400, cors);
      await sb.from("wifi_networks").delete().eq("user_id", userId).eq("bssid", bssid);
      return json({ ok: true }, 200, cors);
    }

    /**
     * ── uplink ──────────────────────────────────────────────────────────
     * The web runtime is forbidden by every browser from reading an SSID, a
     * BSSID or a signal strength — that is why the full "report" action has
     * never fired for anyone who is not inside the native companion, and why
     * no safety report has ever arrived. The uplink action answers the half
     * of the question the browser CAN answer truthfully: who operates the
     * public egress this device is currently sitting behind, whether that
     * egress is a datacentre or proxy rather than a carrier, and what the
     * device itself reports about the link. The egress address is taken from
     * the request headers — never from the body — so it cannot be spoofed by
     * the caller into fabricating a clean verdict.
     */
    if (action === "uplink") {
      const fwd = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const publicIp = fwd || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
      if (!publicIp) return json({ error: "no_egress_visible" }, 422, cors);

      const linkType = str(body.linkType, 24).toLowerCase();   // wifi | cellular | ethernet | unknown
      const effectiveType = str(body.effectiveType, 12);
      const latitude = num(body.latitude);
      const longitude = num(body.longitude);
      const force = body.force === true;

      let egress: { isp: string | null; org: string | null; hosting: boolean; proxy: boolean } | null = null;
      try {
        const e = await enrichActor(publicIp, "");
        egress = { isp: e.isp, org: e.org, hosting: e.hosting, proxy: e.proxy };
      } catch { /* enrichment is advisory — a partial report still ships */ }

      const f: Finding[] = [];
      const operator = egress?.org ?? egress?.isp ?? null;

      if (operator) {
        f.push({
          severity: "info",
          title: `Egress operated by ${operator}`,
          detail:
            `Everything this device sends leaves through ${operator} at ${publicIp}. That operator ` +
            "sees the address of every server you reach and the timing of every session, even where " +
            "the contents are encrypted.",
        });
      } else {
        f.push({
          severity: "low",
          title: "Egress operator could not be attributed",
          detail: `The public address ${publicIp} did not resolve to a registered network operator. Attribution is unavailable, not clean.`,
        });
      }

      if (egress?.hosting) {
        f.push({
          severity: "high",
          title: "Traffic egresses through a datacentre",
          detail:
            `${operator ?? "The upstream operator"} is a hosting provider rather than a consumer or ` +
            "carrier network. On a network you did not deliberately route through a VPN, this is the " +
            "signature of traffic being relayed through infrastructure somebody else controls.",
        });
      }
      if (egress?.proxy) {
        f.push({
          severity: "medium",
          title: "Egress is a known proxy or VPN exit",
          detail: "The outbound address is a catalogued proxy exit. Your apparent location and identity are being rewritten before traffic reaches its destination.",
        });
      }
      if (linkType === "cellular") {
        f.push({ severity: "info", title: "Carrier data link", detail: "The device reports a cellular link. Carrier links are not exposed to the local-radio attacks that make shared Wi-Fi dangerous." });
      } else if (linkType === "wifi" || linkType === "ethernet") {
        f.push({
          severity: "info",
          title: linkType === "wifi" ? "Wi-Fi link — radio detail unavailable in the browser" : "Wired link",
          detail:
            linkType === "wifi"
              ? "Browsers are prohibited from exposing the network name, hardware address or signal strength, so encryption grade, evil-twin history and transmitter distance cannot be judged from this tab. Install the Asherin companion to unlock the full six-question report."
              : "A wired segment. Local-radio interception does not apply, but the segment operator still sees all unencrypted traffic.",
        });
      }
      if (effectiveType) {
        f.push({ severity: "info", title: `Link quality ${effectiveType}`, detail: "Reported by the device's own network information interface." });
      }

      const score = Math.min(100, f.reduce((s, x) => s + WEIGHT[x.severity], 0));
      const level = score >= 65 ? "critical" : score >= 40 ? "high" : score >= 18 ? "moderate" : "low";
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
      f.sort((a, b) => order[a.severity] - order[b.severity]);

      // Pseudo-identifier: keyed by egress address so reconnecting to the same
      // uplink refreshes one row instead of accumulating history noise. It is
      // deliberately NOT a MAC shape, so it can never collide with a real
      // access point or pollute evil-twin matching (which keys on SSID).
      const pseudoBssid = `uplink:${publicIp}`;
      const { error: upErr } = await sb.from("wifi_networks").upsert({
        user_id: userId,
        ssid: operator ? `${operator} uplink` : "Unattributed uplink",
        bssid: pseudoBssid,
        security: linkType ? linkType.toUpperCase() : "UNKNOWN",
        public_ip: publicIp,
        risk_score: score,
        risk_level: level,
        findings: f,
        enrichment: { egress, linkType, effectiveType, mode: "uplink", isConnected: true },
        latitude, longitude,
        last_seen: new Date().toISOString(),
      }, { onConflict: "user_id,bssid" });
      if (upErr) throw upErr;

      // A manual run always delivers a report — the whole complaint was that
      // asking for one produced silence. Automatic runs stay quiet unless the
      // uplink is genuinely dangerous.
      let notified = false;
      const dangerous = level === "critical" || level === "high";
      if (force || dangerous) {
        const { data: prefs } = await sb.from("security_notification_prefs")
          .select("notify_wifi, notify_push, notify_email").eq("user_id", userId).maybeSingle();
        const wifiOn = prefs ? (prefs as any).notify_wifi !== false : true;
        if (wifiOn) {
          await notifyIntel({
            userId,
            userEmail: user.email ?? null,
            kind: "security",
            severity: level === "critical" ? "critical" : dangerous ? "notable" : "info",
            title: dangerous
              ? `Unsafe uplink — ${operator ?? publicIp}`
              : `Network report — ${operator ?? publicIp}`,
            body:
              `Your device is egressing through ${operator ?? publicIp} on a ${linkType || "unknown"} link. ` +
              `Risk ${score}/100 (${level}). ${f[0]?.detail ?? ""}`,
            source: "Asherin Wi-Fi Sentinel",
            url: "/dashboard/google?module=sentinel&tab=network",
            sections: f.slice(0, 8).map((x) => ({ label: `${x.severity.toUpperCase()} · ${x.title}`, value: x.detail })),
            findings: f.filter((x) => x.severity !== "info").map((x) => x.title),
            secondaryCta: { label: "Review all networks", url: "https://asherin.com/dashboard/google?module=sentinel&tab=network" },
            idempotencyKey: force
              ? `uplink-manual-${userId}-${publicIp}-${Date.now()}`
              : `uplink-${userId}-${publicIp}-${Math.floor(Date.now() / 3_600_000)}`,
            skipPush: prefs ? (prefs as any).notify_push === false : false,
            skipEmail: prefs ? (prefs as any).notify_email === false : false,
          });
          notified = true;
        }
      }

      return json({
        ok: true, mode: "uplink", notified,
        network: { bssid: pseudoBssid, ssid: operator ? `${operator} uplink` : "Unattributed uplink",
          publicIp, operator, linkType: linkType || null, riskScore: score, riskLevel: level, findings: f },
      }, 200, cors);
    }

    if (action !== "report") return json({ error: "unknown_action" }, 400, cors);


    // ── report ──────────────────────────────────────────────────────────
    const raw = Array.isArray(body.networks) ? body.networks : [];
    if (!raw.length) return json({ error: "no_networks" }, 400, cors);
    // Hard cap: a scan payload is a handful of access points, never thousands.
    const incoming = raw.slice(0, 60) as Record<string, unknown>[];

    const dnsServers = (Array.isArray(body.dnsServers) ? body.dnsServers : [])
      .map((d) => str(d, 45)).filter(Boolean).slice(0, 8);
    const gatewayIp = str(body.gatewayIp, 45) || null;
    const connectedDevices = int(body.connectedDevices);
    const latitude = num(body.latitude);
    const longitude = num(body.longitude);
    const connectedBssid = normaliseBssid(str(body.connectedBssid, 32));

    // The public egress is enriched once for the whole scan: every AP in one
    // payload is on the same uplink by definition.
    const publicIp = str(body.publicIp, 45) || null;
    let egress: { isp: string | null; org: string | null; hosting: boolean; proxy: boolean } | null = null;
    if (publicIp) {
      try {
        const e = await enrichActor(publicIp, "");
        egress = { isp: e.isp, org: e.org, hosting: e.hosting, proxy: e.proxy };
      } catch { /* enrichment is advisory */ }
    }

    // One read of the existing ledger powers evil-twin detection for the whole
    // batch — an N+1 query per access point would be pointless here.
    const { data: known } = await sb.from("wifi_networks")
      .select("ssid, bssid").eq("user_id", userId).limit(500);
    const ssidToBssids = new Map<string, Set<string>>();
    for (const k of known ?? []) {
      if (!k.ssid) continue;
      const set = ssidToBssids.get(k.ssid) ?? new Set<string>();
      set.add(k.bssid as string);
      ssidToBssids.set(k.ssid, set);
    }

    const rows: Record<string, unknown>[] = [];
    const reports: Record<string, unknown>[] = [];

    for (const n of incoming) {
      const bssid = normaliseBssid(str(n.bssid, 32));
      if (!bssid) continue;
      const ssid = str(n.ssid, 64);
      const security = str(n.security, 40) || "OPEN";
      const rssi = int(n.rssi);
      const frequencyMhz = int(n.frequencyMhz);
      const isHidden = n.isHidden === true || ssid === "";
      const captivePortalUrl = str(n.captivePortalUrl, 300) || null;
      const isConnected = connectedBssid ? bssid === connectedBssid : incoming.length === 1;

      const vendor = await lookupVendor(bssid);
      const distanceM = estimateDistanceM(rssi, frequencyMhz);
      const twinBssids = [...(ssidToBssids.get(ssid) ?? new Set())].filter((b) => b !== bssid);

      const { findings, score, level } = assess({
        security, bssid, vendor, ssid, isHidden, captivePortalUrl,
        // Segment-level facts only describe the network actually joined.
        dnsServers: isConnected ? dnsServers : [],
        connectedDevices: isConnected ? connectedDevices : null,
        distanceM, twinBssids,
        egress: isConnected ? egress : null,
      });

      rows.push({
        user_id: userId, ssid: ssid || null, bssid, security, rssi,
        channel: int(n.channel), frequency_mhz: frequencyMhz, band: bandOf(frequencyMhz),
        vendor, estimated_distance_m: distanceM,
        gateway_ip: isConnected ? gatewayIp : null,
        dns_servers: isConnected ? dnsServers : [],
        public_ip: isConnected ? publicIp : null,
        connected_devices: isConnected ? connectedDevices : null,
        is_hidden: isHidden, captive_portal_url: captivePortalUrl,
        risk_score: score, risk_level: level,
        findings, enrichment: { egress: isConnected ? egress : null, twinBssids, isConnected },
        latitude, longitude, last_seen: new Date().toISOString(),
      });

      reports.push({ bssid, ssid, vendor, security, distanceM, riskScore: score, riskLevel: level, findings, isConnected });
    }

    if (!rows.length) return json({ error: "no_valid_networks" }, 400, cors);

    // Upsert on (user_id, bssid): a re-scan refreshes the same access point
    // instead of accumulating a duplicate for every connect.
    const { error: upErr } = await sb.from("wifi_networks")
      .upsert(rows, { onConflict: "user_id,bssid" });
    if (upErr) throw upErr;

    // Only the network actually joined is worth waking someone over, and only
    // when it is genuinely dangerous. A merely-observed risky AP in the list
    // is recorded, not pushed.
    const joined = reports.find((r) => r.isConnected) as Record<string, any> | undefined;
    let notified = false;

    if (joined && (joined.riskLevel === "critical" || joined.riskLevel === "high")) {
      const { data: prefs } = await sb.from("security_notification_prefs")
        .select("notify_wifi, notify_push, notify_email").eq("user_id", userId).maybeSingle();
      const wifiOn = prefs ? (prefs as any).notify_wifi !== false : true;
      if (wifiOn) {
        const crit = (joined.findings as Finding[]).filter((x) => x.severity === "critical" || x.severity === "high");
        await notifyIntel({
          userId,
          userEmail: user.email ?? null,
          kind: "security",
          severity: joined.riskLevel === "critical" ? "critical" : "notable",
          title: `Unsafe network — ${joined.ssid || joined.bssid}`,
          body:
            `You are connected to "${joined.ssid || joined.bssid}" (${joined.vendor ?? "unregistered hardware"}, ` +
            `${joined.security}). Risk ${joined.riskScore}/100. ${crit[0]?.detail ?? ""}`,
          source: "Asherin Wi-Fi Sentinel",
          url: "/dashboard/vault?tab=wifi",
          sections: (joined.findings as Finding[]).slice(0, 8).map((x) => ({
            label: `${x.severity.toUpperCase()} · ${x.title}`, value: x.detail,
          })),
          findings: crit.map((x) => x.title),
          secondaryCta: { label: "Review all networks", url: "https://asherin.com/dashboard/vault?tab=wifi" },
          // Bucketed by hour so reconnecting to the same café all afternoon
          // produces one alert, not forty.
          idempotencyKey: `wifi-${userId}-${joined.bssid}-${Math.floor(Date.now() / 3_600_000)}`,
          skipPush: prefs ? (prefs as any).notify_push === false : false,
          skipEmail: prefs ? (prefs as any).notify_email === false : false,
        });
        notified = true;
      }
    }

    return json({ ok: true, scanned: rows.length, notified, networks: reports }, 200, cors);
  } catch (e) {
    console.error("wifi_sentinel_error", action, e instanceof Error ? e.message : e);
    return json({ error: "internal_error" }, 500, cors);
  }
});
