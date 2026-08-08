/**
 * ACTOR FORENSICS — the layer above raw IP enrichment.
 *
 * `actorIntel.ts` answers "what is this IP". That is necessary and not
 * sufficient. An account-takeover investigation has to answer four harder
 * questions, and each one is a different kind of evidence:
 *
 *   1. HOW did the change happen?  A password can only change three ways:
 *      through a recovery link mailed to the owner, from inside an already
 *      authenticated session, or by an operator with service-role reach.
 *      Each leaves a different trace, and the ABSENCE of a recovery mail is
 *      itself conclusive — it eliminates the entire phishing/reset family.
 *
 *   2. WHO was actually there?  Naively attributing the event to "the most
 *      recent session" is wrong: the most recent session is frequently the
 *      platform's own server-side egress, a cloud IP that is not a human at
 *      all. Candidates must be ranked by time-distance to the event AND
 *      demoted when they are datacentre infrastructure rather than an
 *      endpoint a person sits behind.
 *
 *   3. IS THE GEOGRAPHY REAL?  One IP cannot tell you. A timeline can. If the
 *      same account is observed in two places whose separation demands
 *      supersonic travel, one of those observations is a tunnel exit. That is
 *      how VPN use is proven without a VPN database: by physics.
 *
 *   4. WHERE, precisely?  An IP geolocates to a network's registered service
 *      area, never to a doorway. Reverse geocoding the coordinate yields the
 *      street-level descriptor of THAT REGISTRATION, and the report must say
 *      so plainly instead of implying a household.
 *
 * Every function here degrades to null rather than throwing. A forensic
 * enrichment failure must never suppress the underlying security alert.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ── geometry ───────────────────────────────────────────────────────────────

const EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── timeline ───────────────────────────────────────────────────────────────

export interface Observation {
  at: string;               // ISO
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  device: string | null;
  kind: string;             // login | password_change | session | ...
}

export interface TravelAnomaly {
  fromAt: string;
  toAt: string;
  fromWhere: string;
  toWhere: string;
  fromIp: string | null;
  toIp: string | null;
  km: number;
  minutes: number;
  impliedKmh: number;
}

export interface JumpVerdict {
  observations: number;
  distinctIps: number;
  distinctCountries: string[];
  anomalies: TravelAnomaly[];
  /** true when at least one pair demands travel no aircraft could perform */
  tunnelled: boolean;
  summary: string;
}

/**
 * Commercial aviation tops out near 900 km/h door to door. Anything above
 * this between two observations of the SAME account means the account was
 * presented from two networks at once — a tunnel, a proxy, or a second
 * operator. The threshold is deliberately generous so a real flight, a
 * carrier handover, or a coarse mobile-NAT geolocation does not raise it.
 */
const IMPOSSIBLE_KMH = 900;
/** Below this separation the difference is geolocation noise, not travel. */
const NOISE_FLOOR_KM = 60;

export async function buildLocationTimeline(
  sb: SupabaseClient,
  userId: string,
  days = 30,
): Promise<Observation[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [act, sess] = await Promise.all([
    sb.from("account_activity_log")
      .select("event_type, ip_address, location, device_info, metadata, created_at")
      .eq("user_id", userId).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(500),
    sb.from("user_sessions")
      .select("ip_address, browser, os, device_type, city, region, country, latitude, longitude, created_at, last_active_at")
      .eq("user_id", userId).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(200),
  ]);

  const out: Observation[] = [];

  for (const r of act.data ?? []) {
    const meta = (r.metadata ?? {}) as Record<string, any>;
    const a = (meta.actor ?? {}) as Record<string, any>;
    const parts = String(r.location ?? "").split(",").map((s) => s.trim());
    out.push({
      at: r.created_at as string,
      ip: (r.ip_address as string | null) ?? null,
      city: a.city ?? parts[0] ?? null,
      region: a.region ?? parts[1] ?? null,
      country: a.country ?? parts[2] ?? null,
      latitude: typeof a.latitude === "number" ? a.latitude : null,
      longitude: typeof a.longitude === "number" ? a.longitude : null,
      device: (r.device_info as string | null) ?? null,
      kind: (r.event_type as string) ?? "event",
    });
  }

  for (const s of sess.data ?? []) {
    out.push({
      at: (s.last_active_at as string) ?? (s.created_at as string),
      ip: (s.ip_address as string | null) ?? null,
      city: (s.city as string | null) ?? null,
      region: (s.region as string | null) ?? null,
      country: (s.country as string | null) ?? null,
      latitude: typeof s.latitude === "number" ? s.latitude : null,
      longitude: typeof s.longitude === "number" ? s.longitude : null,
      device: [s.browser, s.os, s.device_type].filter(Boolean).join(" / ") || null,
      kind: "session",
    });
  }

  out.sort((a, b) => a.at.localeCompare(b.at));
  return out;
}

const whereOf = (o: Observation) =>
  [o.city, o.region, o.country].filter(Boolean).join(", ") || o.ip || "unknown";

/**
 * Physics-based tunnel detection.
 *
 * Only observations that carry BOTH coordinates can be compared, and only
 * consecutive DISTINCT places are considered — comparing an IP against itself
 * produces zero-distance noise that would drown the real jumps.
 */
export function detectImpossibleTravel(timeline: Observation[]): JumpVerdict {
  const geo = timeline.filter(
    (o) => typeof o.latitude === "number" && typeof o.longitude === "number",
  );
  const anomalies: TravelAnomaly[] = [];

  for (let i = 1; i < geo.length; i++) {
    const a = geo[i - 1];
    const b = geo[i];
    if (a.ip && b.ip && a.ip === b.ip) continue;
    const km = haversineKm(a.latitude!, a.longitude!, b.latitude!, b.longitude!);
    if (km < NOISE_FLOOR_KM) continue;
    const minutes = (Date.parse(b.at) - Date.parse(a.at)) / 60_000;
    // A non-positive interval means the two observations are simultaneous:
    // the account was live from two networks in the same instant, which is
    // the strongest possible tunnel signal, so it is scored as infinite speed.
    const impliedKmh = minutes <= 0 ? Number.POSITIVE_INFINITY : km / (minutes / 60);
    if (impliedKmh < IMPOSSIBLE_KMH) continue;
    anomalies.push({
      fromAt: a.at, toAt: b.at,
      fromWhere: whereOf(a), toWhere: whereOf(b),
      fromIp: a.ip, toIp: b.ip,
      km: Math.round(km),
      minutes: Math.max(0, Math.round(minutes)),
      impliedKmh: Number.isFinite(impliedKmh) ? Math.round(impliedKmh) : -1,
    });
  }

  const ips = new Set(timeline.map((o) => o.ip).filter(Boolean) as string[]);
  const countries = [...new Set(timeline.map((o) => o.country).filter(Boolean) as string[])];

  const summary = anomalies.length
    ? `${anomalies.length} impossible-travel transition${anomalies.length > 1 ? "s" : ""} across ${ips.size} distinct addresses — at least one observed location is a tunnel exit, not a physical position.`
    : ips.size > 1
      ? `${ips.size} distinct addresses observed, all consistent with physical travel — no tunnelling signature in this window.`
      : "Single origin address across the window — no location-jump signature available.";

  return {
    observations: timeline.length,
    distinctIps: ips.size,
    distinctCountries: countries,
    anomalies: anomalies.slice(0, 8),
    tunnelled: anomalies.length > 0,
    summary,
  };
}

// ── actor correlation ──────────────────────────────────────────────────────

export interface ActorCandidate {
  ip: string | null;
  where: string;
  device: string | null;
  at: string;
  secondsFromEvent: number;
  infrastructure: boolean;
  score: number;
  why: string;
}

/**
 * Cloud/host ranges belong to machines, not people. When a platform runs
 * server-side rendering, scheduled jobs or an agent sandbox, its own egress
 * shows up as a "session" — and naive attribution then accuses the platform
 * of changing the owner's password. These prefixes cover the three hyperscale
 * egresses that appear in this application's own traffic; anything else is
 * classified by the ip-api `hosting` flag upstream.
 */
const CLOUD_PREFIXES = [
  "34.", "35.", "104.196.", "130.211.",       // Google Cloud
  "3.", "18.", "52.", "54.",                   // AWS
  "20.", "40.", "13.64.", "13.65.",            // Azure
  "165.227.", "167.99.", "159.65.",            // DigitalOcean
];

export function looksLikeInfrastructure(ip: string | null): boolean {
  if (!ip) return false;
  return CLOUD_PREFIXES.some((p) => ip.startsWith(p));
}

/**
 * Rank who was plausibly present at `at`.
 *
 * Time proximity dominates, because a password change is instantaneous and
 * the endpoint that performed it must have been live within minutes. Cloud
 * egress is heavily demoted but never discarded: if the ONLY thing present
 * was infrastructure, the report must say that rather than invent a human.
 */
export function rankActorCandidates(timeline: Observation[], at: Date): ActorCandidate[] {
  const t = at.getTime();
  const seen = new Map<string, ActorCandidate>();

  for (const o of timeline) {
    const dt = Math.abs(Date.parse(o.at) - t) / 1000;
    if (!Number.isFinite(dt) || dt > 6 * 3600) continue; // ±6h evidentiary window
    const infra = looksLikeInfrastructure(o.ip);
    // Exponential time decay with a 20-minute half-life, then an order of
    // magnitude penalty for infrastructure so a human endpoint 40 minutes out
    // still outranks a cloud egress that was live at the exact second.
    const score = Math.exp(-dt / 1200) * (infra ? 0.05 : 1);
    const key = o.ip ?? `noip-${o.device ?? "unknown"}`;
    const prev = seen.get(key);
    if (prev && prev.score >= score) continue;
    seen.set(key, {
      ip: o.ip,
      where: whereOf(o),
      device: o.device,
      at: o.at,
      secondsFromEvent: Math.round(dt),
      infrastructure: infra,
      score,
      why: infra
        ? "Datacentre egress — this is platform infrastructure, not a person's endpoint."
        : `Endpoint live ${Math.round(dt / 60)} min from the event.`,
    });
  }

  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}

// ── mechanism ──────────────────────────────────────────────────────────────

export type ChangeMethod =
  | "recovery_link"
  | "authenticated_session"
  | "operator_or_api"
  | "indeterminate";

export interface MechanismTrace {
  method: ChangeMethod;
  label: string;
  narrative: string;
  recoveryMailsNearEvent: { template: string; recipient: string; at: string; status: string }[];
  failedLoginsBefore: number;
  eliminated: string[];
}

/**
 * Determine HOW the credential changed by what evidence exists — and, just as
 * importantly, by what evidence does NOT.
 *
 * A recovery link is the only mechanism that requires mailbox access, so if no
 * recovery mail was issued in the window, every phishing, mailbox-compromise
 * and reset-link theory is eliminated outright. What remains requires either a
 * live authenticated session (the attacker already had a token or the device)
 * or privileged backend reach.
 */
export async function traceChangeMechanism(
  sb: SupabaseClient,
  userId: string,
  userEmail: string | null,
  at: Date,
): Promise<MechanismTrace> {
  const from = new Date(at.getTime() - 6 * 3600_000).toISOString();
  const to = new Date(at.getTime() + 30 * 60_000).toISOString();

  const [mail, fails] = await Promise.all([
    userEmail
      ? sb.from("email_send_log")
          .select("template_name, recipient_email, status, created_at")
          .eq("recipient_email", userEmail)
          .gte("created_at", from).lte("created_at", to)
          .order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as any[] }),
    sb.from("account_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("event_type", "failed_login")
      .gte("created_at", from).lte("created_at", to),
  ]);

  // Only credential-bearing templates count. An intelligence report or a
  // rideshare dossier landing in the same window proves nothing about auth.
  const RECOVERY = /recovery|reset|magic|magiclink|invite|email_change|reauth/i;
  const recoveryMails = (mail.data ?? [])
    .filter((m: any) => RECOVERY.test(String(m.template_name ?? "")))
    .map((m: any) => ({
      template: m.template_name, recipient: m.recipient_email,
      at: m.created_at, status: m.status,
    }));

  const failedLoginsBefore = (fails as any).count ?? 0;
  const eliminated: string[] = [];
  let method: ChangeMethod;
  let label: string;
  let narrative: string;

  if (recoveryMails.length) {
    method = "recovery_link";
    label = "Password reset link";
    narrative =
      `A credential-recovery message was issued to ${recoveryMails[0].recipient} at ` +
      `${new Date(recoveryMails[0].at).toUTCString()}, inside the change window. The reset was ` +
      `driven through the mailbox — which means whoever changed the password could READ that ` +
      `mailbox. Mailbox access is now the primary compromise, not the app account.`;
  } else {
    eliminated.push("Password-reset link — no recovery, magic-link or email-change message was issued to the account in the six hours before the change. Every phishing and reset-interception theory is excluded.");
    method = failedLoginsBefore > 0 ? "authenticated_session" : "authenticated_session";
    label = "Change from inside a live session";
    narrative =
      "No recovery message exists in the window, so the credential was not reset through the " +
      "mailbox. That leaves exactly one ordinary path: the change was performed from a session " +
      "that was already authenticated — an open tab, a retained refresh token, or the owner's " +
      "own device. An attacker on this path never needed the old password; they needed the session.";
    if (failedLoginsBefore === 0) {
      eliminated.push("Credential stuffing / brute force — zero failed sign-in attempts were recorded against the account in the window. There was no guessing phase.");
    }
  }

  return { method, label, narrative, recoveryMailsNearEvent: recoveryMails, failedLoginsBefore, eliminated };
}

// ── precise geography ──────────────────────────────────────────────────────

export interface PreciseLocation {
  address: string | null;
  road: string | null;
  neighbourhood: string | null;
  postcode: string | null;
  /** what the coordinate actually represents — never "their house" */
  caveat: string;
}

/**
 * Reverse-geocode the coordinate to a street-level descriptor.
 *
 * The honest framing matters more than the string: an IP geolocation resolves
 * to the registered service address or the geographic centroid of the
 * operator's allocation. Rendering that as "the actor's address" would be a
 * fabrication, and acting on it — showing up somewhere — could put an innocent
 * subscriber in danger. The caveat travels with the value, always.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<PreciseLocation | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": "Asherin-Security/1.0 (security alerts)", "Accept": "application/json" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const a = (j?.address ?? {}) as Record<string, string>;
    return {
      address: typeof j?.display_name === "string" ? j.display_name : null,
      road: a.road ?? null,
      neighbourhood: a.neighbourhood ?? a.suburb ?? a.quarter ?? null,
      postcode: a.postcode ?? null,
      caveat:
        "This is the street-level descriptor of the coordinate the NETWORK registers for this " +
        "address block — the operator's service point or allocation centroid. It is not a " +
        "residence and must never be treated as the actor's doorstep.",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── identity ceiling ───────────────────────────────────────────────────────

export interface IdentityTrace {
  actorEmail: string | null;
  linkedIdentities: string[];
  ceiling: string;
}

/**
 * What can honestly be said about the actor's identity.
 *
 * An IP address does not carry an email. The only lawful ways to bind one are
 * a subscriber record held by the ISP under legal process, or a self-inflicted
 * disclosure — the actor adding their own address to the account. So this
 * reads the account's own identity table: if a takeover attached a new email,
 * OAuth identity or recovery address, THAT is the actor's address, handed over
 * by their own action.
 */
export async function traceActorIdentity(
  sb: SupabaseClient,
  userId: string,
  ownerEmail: string | null,
): Promise<IdentityTrace> {
  const out: IdentityTrace = {
    actorEmail: null,
    linkedIdentities: [],
    ceiling:
      "An address block cannot be resolved to a person's email by any public dataset — that " +
      "binding exists only in the ISP's subscriber record and is released solely to a subpoena " +
      "or a law-enforcement preservation request. The single case where the actor's own address " +
      "becomes recoverable is when they attach it to the account themselves; that table is " +
      "checked below.",
  };
  try {
    const { data } = await sb.auth.admin.getUserById(userId);
    const u = data?.user as any;
    const ids: string[] = [];
    for (const i of (u?.identities ?? []) as any[]) {
      const em = i?.identity_data?.email;
      const provider = i?.provider ?? "unknown";
      if (em) ids.push(`${provider}: ${em}`);
    }
    const newEmail = u?.new_email || u?.email_change || null;
    out.linkedIdentities = ids;
    // Anything bound to the account that is NOT the owner's own address is a
    // self-disclosure by whoever bound it.
    const foreign = ids
      .map((s) => s.split(": ")[1])
      .filter((e) => e && ownerEmail && e.toLowerCase() !== ownerEmail.toLowerCase());
    out.actorEmail = (newEmail && newEmail !== ownerEmail ? newEmail : foreign[0]) ?? null;
  } catch {
    /* identity read is best-effort */
  }
  return out;
}
