// ═══════════════════════════════════════════════════════════════════════════
// OP LAYER — CORRELATION ENGINE
//
// The whole point of the OP layer lives in this file. Every other piece just
// moves bytes; this is where an account's scattered per-device readings become
// one judgement about one human.
//
// Three disciplines are enforced structurally rather than by convention:
//
//   1. NOTHING IS ASSERTED ABOVE THE EVIDENCE. A finding's confidence is hard
//      capped by how many INDEPENDENT devices and how many INDEPENDENT signal
//      types corroborate it. One device with one flaky reading physically
//      cannot produce a high-confidence finding, no matter how alarming the
//      rule that fired.
//   2. ABSENCE IS A FINDING. A device that should have reported and did not is
//      emitted as its own finding, never silently omitted. A blank panel must
//      never be mistakable for a clean bill of health.
//   3. NO ACT FROM A SINGLE WITNESS. The `act` response tier is unreachable
//      unless two or more devices agree — encoded once, in `responseTier()`,
//      so no rule can opt out of it.
//
// Deterministic and pure: no clock beyond the `now` passed in, no I/O, no
// model. That is what makes it safe to run for every account on a server clock.
// ═══════════════════════════════════════════════════════════════════════════

export type Verdict = "clean" | "anomalous" | "hostile" | "unknown";
export type Severity = "critical" | "high" | "elevated" | "informational";
export type ResponseTier = "log" | "advise" | "act";

export interface OpDevice {
  device_id: string;
  label: string | null;
  platform: string | null;
  form_factor: string;
  consent_level: string;
  trusted: boolean;
  revoked: boolean;
  enrolled_at: string;
  last_report_at: string | null;
  expected_interval_minutes: number;
}

export interface OpSignal {
  device_id: string;
  signal_type: string;
  verdict: Verdict;
  confidence: number;
  network_key: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  runtime_tier: string;
  evidence: Record<string, unknown>;
  observed_at: string;
}

export interface OpNetwork {
  network_key: string;
  label: string | null;
  org: string | null;
  country: string | null;
  verdict: string;
  hostile_reports: number;
  clean_reports: number;
  devices_seen: number;
  first_seen: string;
}

export interface OpFinding {
  code: string;
  title: string;
  narrative: string;
  severity: Severity;
  confidence: number;
  corroboratingDevices: number;
  distinctSignalTypes: number;
  responseTier: ResponseTier;
  exposedDeviceId: string | null;
  evidence: Record<string, unknown>;
  recommendations: string[];
  firstSeen: string;
  lastSeen: string;
}

const HOUR = 3_600_000;
const ms = (iso: string | null): number => (iso ? Date.parse(iso) : NaN);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * The corroboration law. `base` is what a rule believes on its own evidence;
 * the ceiling is what the ROSTER is entitled to believe given how many
 * independent witnesses exist. The ceiling always wins.
 */
export function corroborate(base: number, devices: number, types: number): number {
  const ceiling = devices >= 3 ? 0.95 : devices === 2 ? 0.8 : 0.55;
  const lift = 0.15 * Math.max(0, devices - 1) + 0.1 * Math.max(0, types - 1);
  return clamp01(Math.min(base + lift, ceiling));
}

/**
 * Detection tiers and response tiers are separate ladders. A rule may be
 * certain and still only be allowed to advise, because a single device is a
 * witness, not a quorum. Irreversible or account-wide responses never reach
 * `act` from one device — that constraint lives here and nowhere else.
 */
export function responseTier(confidence: number, devices: number): ResponseTier {
  if (confidence >= 0.75 && devices >= 2) return "act";
  if (confidence >= 0.5) return "advise";
  return "log";
}

function severityFor(confidence: number, weight: number): Severity {
  const s = confidence * weight;
  if (s >= 0.75) return "critical";
  if (s >= 0.5) return "high";
  if (s >= 0.28) return "elevated";
  return "informational";
}

/** Great-circle distance in kilometres. Used to catch a device claiming to be
 *  somewhere its sibling's reading makes physically impossible. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Ctx {
  now: number;
  devices: OpDevice[];
  signals: OpSignal[];
  networks: Map<string, OpNetwork>;
  byDevice: Map<string, OpDevice>;
}

function build(
  code: string,
  title: string,
  narrative: string,
  opts: {
    base: number;
    weight: number;
    deviceIds: string[];
    types: string[];
    evidence: Record<string, unknown>;
    recommendations: string[];
    exposedDeviceId?: string | null;
    firstSeen: string;
    lastSeen: string;
  },
): OpFinding {
  const devices = new Set(opts.deviceIds.filter(Boolean)).size || 1;
  const types = new Set(opts.types.filter(Boolean)).size || 1;
  const confidence = corroborate(opts.base, devices, types);
  return {
    code,
    title,
    narrative,
    severity: severityFor(confidence, opts.weight),
    confidence: Number(confidence.toFixed(3)),
    corroboratingDevices: devices,
    distinctSignalTypes: types,
    responseTier: responseTier(confidence, devices),
    exposedDeviceId: opts.exposedDeviceId ?? null,
    evidence: { ...opts.evidence, corroboration: { devices, signalTypes: types, base: opts.base } },
    recommendations: opts.recommendations,
    firstSeen: opts.firstSeen,
    lastSeen: opts.lastSeen,
  };
}

const label = (ctx: Ctx, id: string) => ctx.byDevice.get(id)?.label || ctx.byDevice.get(id)?.platform || id.slice(0, 8);
const hostile = (s: OpSignal) => s.verdict === "hostile";
const adverse = (s: OpSignal) => s.verdict === "hostile" || s.verdict === "anomalous";

// ── RULE 1 ─ Two devices, two networks, hostile in the same hour ───────────
// The signature no single device can ever see: pressure that follows the
// person rather than the connection they happen to be on.
function ruleCrossNetworkPressure(ctx: Ctx): OpFinding[] {
  const recent = ctx.signals.filter((s) => hostile(s) && ctx.now - ms(s.observed_at) <= HOUR && s.network_key);
  if (recent.length < 2) return [];
  const nets = new Set(recent.map((s) => s.network_key!));
  const devs = new Set(recent.map((s) => s.device_id));
  if (nets.size < 2 || devs.size < 2) return [];
  const times = recent.map((s) => s.observed_at).sort();
  return [
    build(
      "cross-network-pressure",
      "Hostile network signatures on two networks within the hour",
      `${devs.size} devices on this account reported hostile network conditions across ${nets.size} separate networks inside sixty minutes. A single compromised network explains one report; it does not explain two devices on two different networks. This pattern follows the account, not the connection.`,
      {
        base: 0.6,
        weight: 1,
        deviceIds: [...devs],
        types: recent.map((s) => s.signal_type),
        evidence: {
          networks: [...nets],
          devices: [...devs].map((d) => label(ctx, d)),
          samples: recent.slice(0, 8).map((s) => ({ device: label(ctx, s.device_id), type: s.signal_type, at: s.observed_at, network: s.network_key })),
        },
        recommendations: [
          "Engage a VPN profile on every device currently reporting.",
          "Treat any credential entered on these networks in the last hour as exposed.",
          "Rotate session tokens rather than only changing the password.",
        ],
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
      },
    ),
  ];
}

// ── RULE 2 ─ DNS integrity ─────────────────────────────────────────────────
function ruleDnsIntegrity(ctx: Ctx): OpFinding[] {
  const bad = ctx.signals.filter((s) => s.signal_type === "dns" && adverse(s) && ctx.now - ms(s.observed_at) <= 6 * HOUR);
  if (!bad.length) return [];
  const devs = [...new Set(bad.map((s) => s.device_id))];
  const times = bad.map((s) => s.observed_at).sort();
  return [
    build(
      "dns-integrity",
      "DNS answers on this network do not match a known-good resolver",
      `A canary lookup resolved to an address the network chose rather than the one the domain publishes. That is the mechanism behind captive interception and credential harvesting: the name you typed is not the machine you reached.`,
      {
        base: 0.55,
        weight: 1,
        deviceIds: devs,
        types: bad.map((s) => s.signal_type),
        evidence: { observations: bad.slice(0, 6).map((s) => ({ device: label(ctx, s.device_id), network: s.network_key, ...s.evidence })) },
        recommendations: [
          "Switch to an encrypted resolver (DoH/DoT) before signing into anything.",
          "Do not accept certificate warnings on this network.",
        ],
        exposedDeviceId: devs[0] ?? null,
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
      },
    ),
  ];
}

// ── RULE 3 ─ TLS / certificate consistency ─────────────────────────────────
function ruleTlsConsistency(ctx: Ctx): OpFinding[] {
  const bad = ctx.signals.filter((s) => s.signal_type === "tls" && adverse(s) && ctx.now - ms(s.observed_at) <= 6 * HOUR);
  if (!bad.length) return [];
  const devs = [...new Set(bad.map((s) => s.device_id))];
  const times = bad.map((s) => s.observed_at).sort();
  return [
    build(
      "tls-interception",
      "Encrypted traffic is not reaching its endpoint intact",
      `A control request to a pinned endpoint returned a response this network altered or could not deliver unmodified. Something between this device and the destination is terminating TLS.`,
      {
        base: 0.6,
        weight: 1,
        deviceIds: devs,
        types: bad.map((s) => s.signal_type),
        evidence: { observations: bad.slice(0, 6).map((s) => ({ device: label(ctx, s.device_id), network: s.network_key, ...s.evidence })) },
        recommendations: ["Leave this network before authenticating anywhere.", "Verify the certificate issuer manually if you must stay."],
        exposedDeviceId: devs[0] ?? null,
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
      },
    ),
  ];
}

// ── RULE 4 ─ WebRTC / geo drift leak ───────────────────────────────────────
function ruleLeak(ctx: Ctx): OpFinding[] {
  const bad = ctx.signals.filter((s) => (s.signal_type === "webrtc" || s.signal_type === "geodrift") && adverse(s) && ctx.now - ms(s.observed_at) <= 12 * HOUR);
  if (!bad.length) return [];
  const devs = [...new Set(bad.map((s) => s.device_id))];
  const times = bad.map((s) => s.observed_at).sort();
  return [
    build(
      "identity-leak",
      "Your real address is leaking around the protection you think you have on",
      `The device is exposing a host candidate or an egress geography that contradicts the protection profile in use. Whatever tunnel is running, this traffic is going around it.`,
      {
        base: 0.5,
        weight: 0.85,
        deviceIds: devs,
        types: bad.map((s) => s.signal_type),
        evidence: { observations: bad.slice(0, 6).map((s) => ({ device: label(ctx, s.device_id), type: s.signal_type, ...s.evidence })) },
        recommendations: ["Disable WebRTC host candidates in the browser.", "Confirm the tunnel is set to block traffic when it drops."],
        exposedDeviceId: devs[0] ?? null,
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
      },
    ),
  ];
}

// ── RULE 5 ─ Egress reputation inherited from the roster ───────────────────
// The posture a newly enrolled device gets for free on its first minute.
function ruleNetworkReputation(ctx: Ctx): OpFinding[] {
  const out: OpFinding[] = [];
  const recent = ctx.signals.filter((s) => s.network_key && ctx.now - ms(s.observed_at) <= 2 * HOUR);
  const seen = new Set<string>();
  for (const s of recent) {
    const key = s.network_key!;
    if (seen.has(key)) continue;
    seen.add(key);
    const net = ctx.networks.get(key);
    if (!net || net.hostile_reports < 1) continue;
    out.push(
      build(
        `network-flagged:${key}`,
        `Back on a network another device already flagged`,
        `${net.label || key} has been reported adverse ${net.hostile_reports} time(s) by devices on this account. The device now on it inherits that history rather than starting from zero.`,
        {
          base: 0.45,
          weight: 0.8,
          deviceIds: [s.device_id, ...(net.devices_seen > 1 ? ["__prior__"] : [])],
          types: ["egress", s.signal_type],
          evidence: { network: key, org: net.org, country: net.country, hostileReports: net.hostile_reports, cleanReports: net.clean_reports },
          recommendations: ["Consider a VPN for the duration of this session on this network."],
          exposedDeviceId: s.device_id,
          firstSeen: net.first_seen,
          lastSeen: s.observed_at,
        },
      ),
    );
  }
  return out;
}

// ── RULE 6 ─ A network no device on the account has ever used ──────────────
function ruleUnfamiliarNetwork(ctx: Ctx): OpFinding[] {
  const out: OpFinding[] = [];
  const recent = ctx.signals.filter((s) => s.network_key && ctx.now - ms(s.observed_at) <= HOUR);
  const seen = new Set<string>();
  for (const s of recent) {
    const key = s.network_key!;
    if (seen.has(key)) continue;
    seen.add(key);
    const net = ctx.networks.get(key);
    const isNew = !net || ctx.now - ms(net.first_seen) < 30 * 60_000;
    const odd = adverse(s);
    if (!isNew || !odd) continue;
    out.push(
      build(
        `unfamiliar-network:${key}`,
        "Unfamiliar network behaving oddly",
        `No device on this account has used ${key} before, and the first readings from it are already adverse. Novelty alone is not a threat; novelty plus an adverse reading is worth a countermeasure.`,
        {
          base: 0.42,
          weight: 0.7,
          deviceIds: [s.device_id],
          types: [s.signal_type],
          evidence: { network: key, firstReading: s.evidence, device: label(ctx, s.device_id) },
          recommendations: ["This network looks unusual — consider a VPN before continuing."],
          exposedDeviceId: s.device_id,
          firstSeen: s.observed_at,
          lastSeen: s.observed_at,
        },
      ),
    );
  }
  return out;
}

// ── RULE 7 ─ A device on the roster nobody remembers enrolling ─────────────
function ruleStrangerOnRoster(ctx: Ctx): OpFinding[] {
  const fresh = ctx.devices.filter((d) => !d.revoked && !d.trusted && ctx.now - ms(d.enrolled_at) <= 24 * HOUR);
  if (!fresh.length) return [];
  return fresh.map((d) =>
    build(
      `roster-stranger:${d.device_id}`,
      "New device on the account roster",
      `${d.label || d.platform || "An unlabelled device"} enrolled itself as a sensor on this account. If that was you signing in somewhere new, mark it trusted. If it was not, this is an authenticated session you do not control.`,
      {
        base: 0.4,
        weight: 0.9,
        deviceIds: [d.device_id],
        types: ["roster"],
        evidence: { device: d.label, platform: d.platform, formFactor: d.form_factor, enrolledAt: d.enrolled_at },
        recommendations: ["Confirm this device, or revoke it and rotate your password and sessions."],
        exposedDeviceId: d.device_id,
        firstSeen: d.enrolled_at,
        lastSeen: d.last_report_at || d.enrolled_at,
      },
    ),
  );
}

// ── RULE 8 ─ Two devices claiming mutually exclusive positions ─────────────
function ruleLocationContradiction(ctx: Ctx): OpFinding[] {
  const fixes = new Map<string, OpSignal>();
  for (const s of ctx.signals) {
    if (s.lat === null || s.lng === null) continue;
    if (ctx.now - ms(s.observed_at) > HOUR) continue;
    const prev = fixes.get(s.device_id);
    if (!prev || ms(s.observed_at) > ms(prev.observed_at)) fixes.set(s.device_id, s);
  }
  const list = [...fixes.values()];
  const out: OpFinding[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const gapMin = Math.abs(ms(a.observed_at) - ms(b.observed_at)) / 60_000;
      if (gapMin > 15) continue;
      const km = haversineKm(a.lat!, a.lng!, b.lat!, b.lng!);
      // A person can carry a phone and a laptop apart; they cannot carry both
      // 400 km apart. Below that, two devices simply sit in different rooms.
      if (km < 400) continue;
      out.push(
        build(
          `geo-contradiction:${[a.device_id, b.device_id].sort().join(":")}`,
          "Two devices report positions the same person cannot occupy",
          `${label(ctx, a.device_id)} and ${label(ctx, b.device_id)} reported fixes ${Math.round(km)} km apart within ${Math.round(gapMin)} minutes. Either one device is somewhere you are not, or one of these position claims is fabricated.`,
          {
            base: 0.55,
            weight: 1,
            deviceIds: [a.device_id, b.device_id],
            types: ["geo", "roster"],
            evidence: {
              a: { device: label(ctx, a.device_id), lat: a.lat, lng: a.lng, at: a.observed_at, accuracy: a.accuracy },
              b: { device: label(ctx, b.device_id), lat: b.lat, lng: b.lng, at: b.observed_at, accuracy: b.accuracy },
              separationKm: Math.round(km),
            },
            recommendations: [
              "Confirm both devices are physically where you expect them.",
              "If one is not with you, treat it as lost or in someone else's hands.",
            ],
            firstSeen: a.observed_at < b.observed_at ? a.observed_at : b.observed_at,
            lastSeen: a.observed_at > b.observed_at ? a.observed_at : b.observed_at,
          },
        ),
      );
    }
  }
  return out;
}

// ── RULE 9 ─ ABSENCE IS A FINDING ──────────────────────────────────────────
// The rule that keeps a quiet panel from being read as a safe one.
function ruleSilentDevice(ctx: Ctx): OpFinding[] {
  const out: OpFinding[] = [];
  for (const d of ctx.devices) {
    if (d.revoked || d.consent_level === "identity") continue;
    const last = ms(d.last_report_at);
    const overdueMs = Math.max(15, d.expected_interval_minutes) * 60_000 * 3;
    if (Number.isFinite(last) && ctx.now - last <= overdueMs) continue;
    const silentFor = Number.isFinite(last) ? Math.round((ctx.now - last) / 60_000) : null;
    out.push(
      build(
        `device-silent:${d.device_id}`,
        `${d.label || d.platform || "A device"} has stopped reporting`,
        silentFor === null
          ? `This device enrolled but has never filed a single reading. It is not covered, and its silence is not evidence that it is safe.`
          : `Last reading was ${silentFor} minutes ago against an expected cadence of ${d.expected_interval_minutes} minutes. The OP layer cannot see this device right now and is not assuming it is fine.`,
        {
          base: 0.35,
          weight: 0.6,
          deviceIds: [d.device_id],
          types: ["roster"],
          evidence: { device: d.label, platform: d.platform, lastReportAt: d.last_report_at, expectedIntervalMinutes: d.expected_interval_minutes },
          recommendations: ["Open Asherin on that device to restore coverage, or revoke it if it is gone."],
          exposedDeviceId: d.device_id,
          firstSeen: d.last_report_at || d.enrolled_at,
          lastSeen: new Date(ctx.now).toISOString(),
        },
      ),
    );
  }
  return out;
}

// ── RULE 10 ─ Radio recurrence, judged at the account rather than the device ─
function ruleRadioRecurrence(ctx: Ctx): OpFinding[] {
  const bad = ctx.signals.filter((s) => s.signal_type === "ble" && adverse(s) && ctx.now - ms(s.observed_at) <= 24 * HOUR);
  if (!bad.length) return [];
  const devs = [...new Set(bad.map((s) => s.device_id))];
  const times = bad.map((s) => s.observed_at).sort();
  return [
    build(
      "radio-recurrence",
      "The same unknown radio keeps appearing near you",
      `An unregistered Bluetooth radio has recurred across separate times and separate places. Being near a stranger once is coincidence; the same radio at different places on different days is the signature of being followed.`,
      {
        base: 0.55,
        weight: 1,
        deviceIds: devs,
        types: bad.map((s) => s.signal_type),
        evidence: { observations: bad.slice(0, 8).map((s) => ({ device: label(ctx, s.device_id), ...s.evidence, at: s.observed_at })) },
        recommendations: ["Open the Bluetooth Sentinel case file.", "Vary your route and check whether the radio follows the change."],
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
      },
    ),
  ];
}

// ── RULE 11 ─ Credential exposure, watched continuously ────────────────────
function ruleCredentialExposure(ctx: Ctx): OpFinding[] {
  const bad = ctx.signals.filter((s) => s.signal_type === "credential" && adverse(s) && ctx.now - ms(s.observed_at) <= 7 * 24 * HOUR);
  if (!bad.length) return [];
  const devs = [...new Set(bad.map((s) => s.device_id))];
  const times = bad.map((s) => s.observed_at).sort();
  const findings: OpFinding[] = [
    build(
      "credential-exposure",
      "A credential or key tied to this account is exposed",
      `The exposure sweep surfaced a credential bound to this account in public reach. A leaked key is a device-and-account risk in exactly the way a hostile network is, so it is watched continuously rather than only when someone opens that panel.`,
      {
        base: 0.6,
        weight: 1,
        deviceIds: devs,
        types: bad.map((s) => s.signal_type),
        evidence: { findings: bad.slice(0, 6).map((s) => ({ ...s.evidence, at: s.observed_at })) },
        recommendations: ["Rotate the exposed credential now.", "Revoke sessions issued before the rotation."],
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
      },
    ),
  ];

  // ── RULE 12 ─ The compound nobody sees from one device: an exposed key AND
  // an unfamiliar device authenticating in the same window.
  const strangers = ctx.devices.filter((d) => !d.trusted && !d.revoked && ctx.now - ms(d.enrolled_at) <= 24 * HOUR);
  if (strangers.length) {
    const s = strangers[0];
    findings.push(
      build(
        "credential-plus-stranger",
        "Exposed credential and an unfamiliar device authenticating in the same window",
        `A credential for this account is publicly exposed, and ${s.label || s.platform || "an unrecognised device"} enrolled on the account inside the same window. Separately each is a maybe. Together they are the ordinary shape of an account takeover in progress.`,
        {
          base: 0.7,
          weight: 1,
          deviceIds: [...devs, s.device_id],
          types: ["credential", "roster"],
          evidence: { exposure: bad[0]?.evidence ?? {}, newDevice: { id: s.device_id, label: s.label, platform: s.platform, enrolledAt: s.enrolled_at } },
          recommendations: [
            "Rotate the credential and revoke every session immediately.",
            "Revoke the unfamiliar device from the roster.",
            "Turn on a second factor if it is not already on.",
          ],
          exposedDeviceId: s.device_id,
          firstSeen: times[0],
          lastSeen: s.enrolled_at,
        },
      ),
    );
  }
  return findings;
}

/**
 * Runs the full battery. Order is irrelevant — rules never read each other's
 * output — so a rule that throws is contained instead of collapsing the sweep.
 */
export function correlate(input: {
  now?: number;
  devices: OpDevice[];
  signals: OpSignal[];
  networks: OpNetwork[];
}): OpFinding[] {
  const ctx: Ctx = {
    now: input.now ?? Date.now(),
    devices: input.devices.filter((d) => !d.revoked),
    signals: input.signals,
    networks: new Map(input.networks.map((n) => [n.network_key, n])),
    byDevice: new Map(input.devices.map((d) => [d.device_id, d])),
  };

  const rules = [
    ruleCrossNetworkPressure, ruleDnsIntegrity, ruleTlsConsistency, ruleLeak,
    ruleNetworkReputation, ruleUnfamiliarNetwork, ruleStrangerOnRoster,
    ruleLocationContradiction, ruleSilentDevice, ruleRadioRecurrence,
    ruleCredentialExposure,
  ];

  const out: OpFinding[] = [];
  for (const rule of rules) {
    try {
      out.push(...rule(ctx));
    } catch (e) {
      console.error(`[opCorrelation] rule ${rule.name} failed`, String(e));
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/** Account posture, derived only from what is actually open. */
export function posture(findings: OpFinding[], devices: OpDevice[]): {
  score: number; label: string; covered: number; silent: number;
} {
  const live = devices.filter((d) => !d.revoked);
  const silent = findings.filter((f) => f.code.startsWith("device-silent:")).length;
  const risk = findings.reduce((acc, f) => {
    const w = f.severity === "critical" ? 34 : f.severity === "high" ? 20 : f.severity === "elevated" ? 9 : 3;
    return acc + w * f.confidence;
  }, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - risk)));
  const label = score >= 85 ? "NOMINAL" : score >= 65 ? "WATCH" : score >= 40 ? "PRESSURED" : "COMPROMISED";
  return { score, label, covered: live.length - silent, silent };
}
