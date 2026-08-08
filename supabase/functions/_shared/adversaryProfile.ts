/**
 * ADVERSARY PROFILE — the layer above `actorForensics.ts`.
 *
 * `actorIntel` answers "what is this address". `actorForensics` answers "how
 * did the change happen, was the geography real, where does the network
 * register". None of them answer the question an owner actually asks after a
 * takeover: *who am I dealing with, and how good are they?*
 *
 * That question is answerable — but only from tradecraft residue, never from
 * identity. An intruder cannot act without emitting choices, and choices are
 * skill-graded:
 *
 *   • WHERE they egressed from. Datacentre VPN, Tor, or a residential proxy
 *     are three different price points and three different threat models.
 *     Residential-proxy traffic costs real money per gigabyte and is bought
 *     deliberately; a free datacentre VPN is what someone reaches for first.
 *
 *   • WHETHER they stayed coherent. One address, one user-agent, one clean
 *     entry is discipline. Fourteen addresses across four countries inside an
 *     hour is a leaky consumer VPN with no kill-switch, operated by someone
 *     who has not thought about correlation.
 *
 *   • WHAT they had to defeat. Riding an existing session needs only a stolen
 *     token or an unlocked device. Driving a recovery link needs mailbox
 *     control. Reaching the service role needs the backend. The mechanism is
 *     a floor on capability that cannot be faked downward.
 *
 *   • WHAT they left behind. Automation user-agents, headless markers, and
 *     brute-force noise are loud. Absence of all three, with a single precise
 *     action at an off-hour, is quiet — and quiet is expensive.
 *
 * The output is a TIER with the evidence that produced it, plus the two
 * inferences that actually help: the kit this actor demonstrably had, versus
 * the kit their method required (the gap is the shopping list they still need
 * — or already own), and the behavioural typology of that tier.
 *
 * On typology, one hard rule is enforced throughout: a tier describes a
 * POPULATION, never a person. "Operators of this grade usually work from a
 * fixed private space" is a base rate. It is not a description of anybody, it
 * cannot identify anybody, and every consumer of this module receives that
 * caveat attached to the payload rather than left to a footnote. Physical
 * descriptors are expressed as environment and operating-posture priors —
 * things that change what evidence to go looking for — and never as an
 * appearance sketch that could be pointed at a bystander.
 *
 * Everything degrades to a partial answer. A profiling failure must never
 * suppress the underlying security alert.
 */

import type { ActorCandidate, JumpVerdict, MechanismTrace } from "./actorForensics.ts";

// ── inputs ────────────────────────────────────────────────────────────────

export interface AdversarySignals {
  /** Enriched network facts for the best human endpoint. */
  ip: string | null;
  isp: string | null;
  org: string | null;
  asn: string | null;
  reverseDns: string | null;
  mobile: boolean | null;
  proxy: boolean | null;
  hosting: boolean | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  /** UTC instant the credential actually changed. */
  occurredAt: Date;
  /** Local hour at the actor's own timezone, when derivable. */
  actorTimezone: string | null;
  mechanism: MechanismTrace | null;
  jumps: JumpVerdict | null;
  candidates: ActorCandidate[];
  /** Actor bound their own address to the account — a self-inflicted burn. */
  selfDisclosedEmail: string | null;
}

// ── tiers ─────────────────────────────────────────────────────────────────

export type SkillTier =
  | "opportunist"
  | "scripted"
  | "practitioner"
  | "operator"
  | "professional";

interface TierShape {
  rank: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** What this grade of intruder is actually capable of next. */
  capability: string;
  /**
   * Population-level operating posture. Written as *where the evidence
   * usually lives*, so it is actionable for an investigator without ever
   * being pointable at an individual.
   */
  posture: string;
  /** What normally stops them. */
  counter: string;
}

const TIERS: Record<SkillTier, TierShape> = {
  opportunist: {
    rank: 1,
    label: "Opportunist — no tradecraft",
    capability:
      "Acts on access that was handed to them: an unlocked phone, a shared laptop, a saved " +
      "session, a password written down or previously known. Cannot regain entry once the " +
      "session is revoked, because they never had a technique — only proximity.",
    posture:
      "Physical proximity is the whole method, so the population skews to people already inside " +
      "the owner's life or space: household, workplace, a device left with someone. Egress is " +
      "the same consumer network the owner uses, at hours when the owner is away rather than at " +
      "hours convenient to the intruder. Evidence lives in door logs, shared-device history and " +
      "who had the handset — not in network artefacts.",
    counter: "Revoke every session and change the credential on a device they cannot reach.",
  },
  scripted: {
    rank: 2,
    label: "Scripted — tool-driven, low discipline",
    capability:
      "Runs off-the-shelf tooling and free infrastructure. Reuses credentials from public " +
      "breach corpora, sprays logins, leans on a free VPN that leaks. Persistent but noisy; " +
      "will try again within days and will look identical when they do.",
    posture:
      "Cost sensitivity is the tell — free VPN, free proxy list, borrowed tooling — which " +
      "corresponds to a population operating from their own residence on their own consumer " +
      "connection with no operational separation between the intrusion and their daily life. " +
      "Activity clusters in personal leisure hours in their own timezone, and the same machine " +
      "carries their ordinary browsing, so correlatable artefacts survive on it.",
    counter: "Rate limits, MFA, and breach-password rejection remove this tier entirely.",
  },
  practitioner: {
    rank: 3,
    label: "Practitioner — deliberate, funded infrastructure",
    capability:
      "Chooses infrastructure on purpose and pays for it. Understands session tokens versus " +
      "passwords, targets the mailbox rather than the login, and adapts after a failure instead " +
      "of repeating it. Assume they can return through a different door.",
    posture:
      "Paid residential proxy or a commercial VPN held under a subscription means a payment " +
      "instrument and a persistent account exist somewhere. This population typically maintains " +
      "at least one machine or virtual machine used only for this work, kept separate from a " +
      "personal one, and works from a private fixed space rather than public premises — public " +
      "wifi introduces cameras and a second identity trail they are already trying to avoid. " +
      "Session timing is task-shaped, not leisure-shaped: short, purposeful, at whatever hour " +
      "the target is least likely to be watching.",
    counter:
      "Hardware-backed MFA, short refresh-token lifetimes, and mailbox-level alerting. " +
      "Password rotation alone will not remove them.",
  },
  operator: {
    rank: 4,
    label: "Operator — correlation-aware",
    capability:
      "Treats their own traces as an asset to be managed. Consistent user-agent, single clean " +
      "egress, no failed attempts, one precise action, exit. Understands that volume is what " +
      "gets people caught and refuses to generate any. Likely already holds more access than " +
      "the single event exposed.",
    posture:
      "Discipline of this order is practised rather than improvised, which puts the population " +
      "in a controlled fixed environment with a dedicated build — a machine or VM that is reset " +
      "or discarded, never carrying personal accounts. Public premises are actively avoided for " +
      "the same reason: cameras, wifi association records and a second identity trail all raise " +
      "the correlation surface they are engineered to keep at zero. Expect the intrusion window " +
      "to be minutes, chosen from observation of the target rather than convenience.",
    counter:
      "Assume additional footholds. Rotate every credential and API key the account can reach, " +
      "not just the password, and audit for anything they added while inside.",
  },
  professional: {
    rank: 5,
    label: "Professional — privileged reach",
    capability:
      "Operated at or above the application's own trust boundary — service-role access, backend " +
      "reach, or a supply-chain position. At this level the account is not the target so much as " +
      "the doorway; treat the whole environment as suspect until proven otherwise.",
    posture:
      "Access of this kind is obtained through insider position, a compromised operator " +
      "credential, or a compromised dependency, so the population is defined by legitimate " +
      "standing rather than by any physical pattern. Network egress is frequently unremarkable " +
      "precisely because it is authorised traffic. Physical-environment inference is not " +
      "meaningful here and is deliberately not offered.",
    counter:
      "Rotate service keys, audit every function deployment and dependency change, and review " +
      "who holds operator access. Nothing at the user layer contains this tier.",
  },
};

// ── network-origin classification ─────────────────────────────────────────

export type OriginClass =
  | "residential"
  | "mobile"
  | "hosting"
  | "tor"
  | "residential_proxy"
  | "unknown";

interface OriginRead {
  cls: OriginClass;
  label: string;
  /** Effort/cost this origin represents. Feeds the tier score. */
  weight: number;
  note: string;
}

/**
 * Names that appear in ASN/org strings for the commercial anonymity market.
 * Matching is on the org string rather than an IP list because IP lists rot
 * within days while the corporate name behind an allocation is stable.
 */
const VPN_ORG = /(nord|express\s?vpn|mullvad|surfshark|proton|cyberghost|private internet|pia |ipvanish|windscribe|vypr|purevpn|hide\s?my|torguard|perfect privacy|azire|ovpn)/i;
const PROXY_ORG = /(bright\s?data|luminati|oxylabs|smartproxy|packetstream|iproyal|soax|netnut|proxyrack|rayobyte|geosurf|shifter|infatica|honeygain)/i;
const TOR_HINT = /(tor-?exit|torexit|torservers|exit\.tor|dfri|calyx|quintex|emerald onion|applied privacy)/i;

export function classifyOrigin(s: AdversarySignals): OriginRead {
  const blob = [s.isp, s.org, s.asn, s.reverseDns].filter(Boolean).join(" ");

  if (TOR_HINT.test(blob)) {
    return {
      cls: "tor",
      label: "Tor exit relay",
      weight: 3,
      note:
        "The connection arrived from a Tor exit. Tor is free, so it costs nothing but knowledge " +
        "— it signals someone who knows anonymity networks exist and chose one, while accepting " +
        "the latency and the blocklists that come with it. The originating address is not " +
        "recoverable from this end by any means.",
    };
  }
  if (PROXY_ORG.test(blob)) {
    return {
      cls: "residential_proxy",
      label: "Commercial residential-proxy network",
      weight: 4,
      note:
        "The address belongs to a residential-proxy provider — traffic routed through a real " +
        "consumer line rented by the gigabyte. This is the expensive option and it is bought for " +
        "one reason: to look like an ordinary household to exactly the kind of check this report " +
        "performs. Its presence is deliberate, not incidental.",
    };
  }
  if (VPN_ORG.test(blob)) {
    return {
      cls: "hosting",
      label: "Commercial VPN egress",
      weight: 2,
      note:
        "A named consumer VPN provider. A subscription exists, which means a payment instrument " +
        "and an account exist — recoverable only by legal process to the provider, and only if " +
        "they retain connection logs, which the reputable ones do not.",
    };
  }
  if (s.hosting) {
    return {
      cls: "hosting",
      label: "Datacentre / hosting address",
      weight: 2,
      note:
        "A hosting network, not a household. Either a rented server used as a jump box or a " +
        "self-hosted tunnel. Cheap and effective at hiding the origin, but conspicuous — no " +
        "ordinary user signs in from a datacentre.",
    };
  }
  if (s.mobile) {
    return {
      cls: "mobile",
      label: "Mobile carrier network",
      weight: 1,
      note:
        "A carrier address behind large-scale NAT. Geolocation on these is coarse by design and " +
        "the address is shared across thousands of subscribers, so it hides the origin as a side " +
        "effect rather than as a choice. Consistent with a phone rather than a workstation.",
    };
  }
  if (s.ip) {
    return {
      cls: "residential",
      label: "Consumer broadband address",
      weight: 1,
      note:
        "A residential ISP allocation with no anonymity layer detected. Either the actor made no " +
        "attempt to hide the origin — which places them at the bottom of the skill range — or " +
        "this is a rented residential proxy whose provider is not named in the registry data.",
    };
  }
  return {
    cls: "unknown",
    label: "Origin not resolvable",
    weight: 0,
    note: "No address survived in the record for this endpoint, so origin cannot be graded.",
  };
}

// ── user-agent forensics ──────────────────────────────────────────────────

export interface AgentRead {
  automation: boolean;
  spoofSuspected: boolean;
  notes: string[];
}

const AUTOMATION = /(headless|phantom|puppeteer|playwright|selenium|webdriver|curl\/|wget\/|python-requests|axios\/|go-http|okhttp|libwww|scrapy|httpie|postman)/i;

/**
 * A user-agent is client-controlled, so it is evidence of what the actor
 * CHOSE to present, which is itself informative. Internal contradictions —
 * an iPhone claiming Windows, a Safari build number that never shipped — mean
 * the string was assembled rather than emitted, and assembly is a deliberate
 * act that raises the skill floor even as it removes device information.
 */
export function readAgent(ua: string | null): AgentRead {
  const notes: string[] = [];
  if (!ua) {
    return {
      automation: false,
      spoofSuspected: false,
      notes: ["No user-agent survived for this endpoint — the device cannot be characterised."],
    };
  }
  // Session rows store a HUMANISED device label ("Desktop — Chrome / Windows
  // 10/11"), not the raw header. Running spoof heuristics over a label the
  // platform itself wrote would manufacture findings out of our own
  // formatting, so a non-header string is graded as what it is: a summary
  // that carries device class but no forensic detail.
  const isRawHeader = /mozilla\/|applewebkit|gecko\/|curl\/|python-requests|okhttp|go-http|axios\//i.test(ua);
  if (!isRawHeader) {
    return {
      automation: AUTOMATION.test(ua),
      spoofSuspected: false,
      notes: [
        `Only a reconstructed device label survived for this endpoint ("${ua}") — the raw ` +
        "request header was not retained. Device CLASS is usable; fingerprint-spoofing cannot be " +
        "assessed either way from it, and its absence is not evidence of clean handling.",
      ],
    };
  }
  const automation = AUTOMATION.test(ua);
  if (automation) {

    notes.push(
      "The request identified itself as automation rather than a browser. Either the actor is " +
      "driving the account with a script, or they did not bother to mask the tool — both point " +
      "at tooling reuse rather than hands-on operation.",
    );
  }

  let spoof = false;
  const iOSClaim = /iphone|ipad/i.test(ua);
  const winClaim = /windows nt/i.test(ua);
  const androidClaim = /android/i.test(ua);
  const macClaim = /mac os x/i.test(ua);
  const platforms = [iOSClaim, winClaim, androidClaim, macClaim].filter(Boolean).length;
  if (platforms > 1) {
    spoof = true;
    notes.push(
      "The user-agent claims two operating systems at once. Real browsers do not emit " +
      "contradictory platform tokens; this string was hand-assembled, which is an intentional " +
      "attempt to defeat device fingerprinting.",
    );
  }
  if (/chrome\/\d+/i.test(ua) && !/safari/i.test(ua)) {
    spoof = true;
    notes.push(
      "A Chrome token without the AppleWebKit/Safari companion tokens — every genuine Chrome " +
      "build ships all three. The string is fabricated or truncated.",
    );
  }
  if (ua.length < 25) {
    spoof = true;
    notes.push("The user-agent is too short to be a real browser build string.");
  }
  if (!automation && !spoof) {
    notes.push("The user-agent is internally consistent — a real browser build, presented as-is.");
  }
  return { automation, spoofSuspected: spoof, notes };
}

// ── device: had vs needed ─────────────────────────────────────────────────

export interface DeviceProfile {
  observed: string;
  observedDetail: string;
  /** Minimum kit the demonstrated method actually requires. */
  required: string[];
  /** Kit the evidence says they did NOT have, or did not need. */
  gap: string[];
}

export function profileDevice(s: AdversarySignals, agent: AgentRead, origin: OriginRead): DeviceProfile {
  const observed =
    [s.browser, s.os, s.deviceType].filter(Boolean).join(" / ") ||
    (s.userAgent ? "unrecognised client" : "no client signature recorded");

  const observedDetail = agent.spoofSuspected
    ? `Presented as "${observed}", but the signature is fabricated — treat the device class as unknown and the fabrication itself as the finding.`
    : agent.automation
      ? `Presented as "${observed}" — this is tooling, not a person at a browser. The physical device behind it is unconstrained.`
      : `Presented as "${observed}". The signature is internally consistent, so this is most likely the actual device class.`;

  const required: string[] = [];
  const gap: string[] = [];

  switch (s.mechanism?.method) {
    case "recovery_link":
      required.push(
        "Read access to the owner's mailbox — the reset link is delivered there and nowhere else.",
        "A browser capable of completing the reset form (any device, including a phone).",
      );
      gap.push(
        "They never needed the old password, and they never needed the owner's device. The " +
        "mailbox was the whole key, so the mailbox is the compromise to close.",
      );
      break;
    case "authenticated_session":
      required.push(
        "A live session artefact — a stolen refresh token, an exported cookie jar, or physical " +
        "access to a device already signed in.",
        "A browser or HTTP client able to replay that artefact against the origin.",
      );
      gap.push(
        "No mailbox access was required and none is evidenced. No password guessing occurred. " +
        "The session token was the entire capability — which means revoking sessions, not " +
        "changing the password, is what actually evicts them.",
      );
      break;
    case "operator_or_api":
      required.push(
        "Service-role or backend credential — reach above the user-facing application.",
        "Ability to call the platform's administrative surface directly.",
      );
      gap.push("No user-layer control removes this. The key itself has to be rotated.");
      break;
    default:
      required.push("Mechanism indeterminate — required kit cannot be bounded from the evidence held.");
  }

  if (origin.cls === "residential_proxy" || origin.cls === "tor" || origin.cls === "hosting") {
    required.push(`Anonymity infrastructure: ${origin.label.toLowerCase()}, active at the moment of the change.`);
  }
  if (agent.spoofSuspected) {
    required.push("A fingerprint-masking browser or a hand-edited client — the agent string did not come from a stock build.");
  }
  if (origin.cls === "residential" && !agent.spoofSuspected && !agent.automation) {
    gap.push(
      "No anonymity layer and no fingerprint masking. Whatever else they did, they did not " +
      "protect the origin — the address in this report is the address they actually used.",
    );
  }

  return { observed, observedDetail, required, gap };
}

// ── timing ────────────────────────────────────────────────────────────────

function readTiming(s: AdversarySignals): { note: string; weight: number } {
  const hourUtc = s.occurredAt.getUTCHours();
  let localHour: number | null = null;
  if (s.actorTimezone) {
    try {
      localHour = Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit", hour12: false, timeZone: s.actorTimezone,
        }).format(s.occurredAt),
      );
    } catch { /* unknown zone — fall back to UTC only */ }
  }
  const h = localHour ?? hourUtc;
  const label = localHour != null ? `${h}:00 local to the actor (${s.actorTimezone})` : `${h}:00 UTC`;

  // Off-hours action against the owner is a targeting choice, not a lifestyle
  // fact — it is when the owner is least likely to see a notification land.
  if (h >= 1 && h <= 5) {
    return {
      weight: 2,
      note:
        `The change was made at ${label} — the window in which an account owner is least likely ` +
        "to read an alert. Choosing that window is targeting behaviour: it buys hours of " +
        "uncontested access before anyone reacts.",
    };
  }
  if (h >= 9 && h <= 18) {
    return {
      weight: 0,
      note:
        `The change was made at ${label}, inside ordinary waking hours — no deliberate ` +
        "low-observation window was selected.",
    };
  }
  return {
    weight: 1,
    note: `The change was made at ${label} — evening or early-morning, mildly outside peak observation.`,
  };
}

// ── the assessment ────────────────────────────────────────────────────────

export interface TradecraftAssessment {
  tier: SkillTier;
  rank: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** 0–100, monotonic with rank; exposes the margin inside a tier. */
  score: number;
  confidence: "low" | "moderate" | "high";
  origin: OriginRead;
  agent: AgentRead;
  device: DeviceProfile;
  timing: string;
  /** Every scored observation, so the grade is auditable rather than asserted. */
  evidence: string[];
  /** Opsec mistakes that are actionable right now. */
  mistakes: string[];
  capability: string;
  posture: string;
  counter: string;
  caveat: string;
}

const CAVEAT =
  "This grade describes a POPULATION of intruders whose traces look like these, not a named " +
  "individual. The posture paragraph is a base rate drawn from how that population is observed " +
  "to operate — it tells an investigator which evidence is worth pulling, and it is not a " +
  "description of any person, cannot identify anyone, and must never be used to point at a " +
  "bystander who happens to match it.";

export function assessTradecraft(s: AdversarySignals): TradecraftAssessment {
  const origin = classifyOrigin(s);
  const agent = readAgent(s.userAgent);
  const device = profileDevice(s, agent, origin);
  const timing = readTiming(s);

  const evidence: string[] = [];
  const mistakes: string[] = [];
  let pts = 0;

  // ── infrastructure choice ──
  pts += origin.weight;
  evidence.push(`Origin — ${origin.label}. ${origin.note}`);

  // ── mechanism floor ──
  switch (s.mechanism?.method) {
    case "operator_or_api":
      pts += 6;
      evidence.push("Mechanism — the change came through privileged backend reach, which is a hard capability floor no consumer tooling reaches.");
      break;
    case "recovery_link":
      pts += 3;
      evidence.push("Mechanism — a recovery link was driven, which required control of the owner's mailbox before the account was ever touched. Mailbox compromise is a prerequisite skill, not a lucky click.");
      break;
    case "authenticated_session":
      pts += 2;
      evidence.push("Mechanism — the change was made from an already-authenticated session. That needs either a stolen session artefact (a token-theft capability) or physical access to a signed-in device (no capability at all). The two are opposite ends of the range, which is why the origin and agent evidence below carries the decision.");
      break;
    default:
      evidence.push("Mechanism — indeterminate from the surviving record; the capability floor cannot be set from this axis.");
  }

  // ── noise discipline ──
  const fails = s.mechanism?.failedLoginsBefore ?? 0;
  if (fails > 5) {
    pts -= 2;
    evidence.push(`Noise — ${fails} failed sign-in attempts preceded the change. Guessing at volume is the loudest possible approach and the first thing any rate limiter catches.`);
    mistakes.push(`${fails} failed attempts are logged with timestamps and addresses — a complete, correlatable attack trace.`);
  } else if (fails === 0) {
    pts += 2;
    evidence.push("Noise — zero failed sign-in attempts. Entry was achieved on the first action, so there was no guessing phase to detect. Whatever they used, they already had it.");
  }

  // ── egress coherence ──
  const humanHops = (s.jumps?.anomalies ?? []).filter((a) => !a.infrastructureArtefact).length;
  const ipCount = s.jumps?.distinctIps ?? 0;
  if (humanHops > 0) {
    pts += 1;
    evidence.push(`Tunnel — ${humanHops} impossible-travel transition${humanHops > 1 ? "s" : ""} between human endpoints. A tunnel was definitely in use; that it was DETECTABLE means it leaked, so the operator either had no kill-switch or was switching exits mid-session.`);
    mistakes.push("The tunnel leaked position. Exits were changed while the account stayed live, which is exactly the pattern that proves a VPN rather than hiding one.");
  } else if (ipCount === 1) {
    pts += 2;
    evidence.push("Coherence — a single origin address across the whole window. One address, one identity, no leakage: this is the disciplined shape, and it is deliberate.");
  } else if (ipCount > 6) {
    pts -= 1;
    evidence.push(`Coherence — ${ipCount} distinct addresses in the window. Address churn at this rate is a consumer VPN rotating without a kill-switch, not managed infrastructure.`);
  }

  // ── client handling ──
  if (agent.spoofSuspected) {
    pts += 2;
    evidence.push("Client — the user-agent is fabricated. Defeating device fingerprinting is a considered step, and it means the device class in this report is a costume, not a fact.");
  }
  if (agent.automation) {
    pts += 1;
    evidence.push("Client — the request came from automation tooling presented without masking. Capable enough to script it, careless enough to announce it.");
    mistakes.push("The automation signature is in the log verbatim and is a durable behavioural fingerprint across any other account they touch.");
  }

  // ── timing ──
  pts += timing.weight;
  evidence.push(`Timing — ${timing.note}`);

  // ── self-inflicted burns ──
  if (s.selfDisclosedEmail) {
    pts -= 3;
    evidence.push(`Opsec — an address (${s.selfDisclosedEmail}) was attached to the account during or after the intrusion. Binding a reachable identity to a compromised account is the single most damaging mistake available, and it is not one an experienced operator makes.`);
    mistakes.push(`${s.selfDisclosedEmail} was bound to your account by the intruder's own action — it is the only identity thread in this entire report that does not require legal process.`);
  }

  // ── residual burns worth stating ──
  if (origin.cls === "residential" && !agent.spoofSuspected) {
    mistakes.push("No anonymity layer was used. The address in this report is the address they connected from — it resolves to a real subscriber line under legal process.");
  }
  if (origin.cls === "hosting") {
    mistakes.push("A datacentre egress narrows the field dramatically: the provider holds a paying account and a source address for that server.");
  }

  // ── tier resolution ──
  let tier: SkillTier;
  if (s.mechanism?.method === "operator_or_api") tier = "professional";
  else if (pts >= 9) tier = "operator";
  else if (pts >= 6) tier = "practitioner";
  else if (pts >= 3) tier = "scripted";
  else tier = "opportunist";

  const shape = TIERS[tier];

  // Confidence is a function of how many independent axes actually produced
  // evidence — a grade built on one surviving field is not a grade.
  const axes =
    (origin.cls !== "unknown" ? 1 : 0) +
    (s.userAgent ? 1 : 0) +
    (s.mechanism && s.mechanism.method !== "indeterminate" ? 1 : 0) +
    ((s.jumps?.observations ?? 0) >= 4 ? 1 : 0);
  const confidence: "low" | "moderate" | "high" = axes >= 4 ? "high" : axes >= 2 ? "moderate" : "low";

  // Score is anchored inside the tier band so it can never contradict rank.
  const band = (shape.rank - 1) * 20;
  const score = Math.max(1, Math.min(100, band + Math.max(0, Math.min(19, pts * 2))));

  return {
    tier,
    rank: shape.rank,
    label: shape.label,
    score,
    confidence,
    origin,
    agent,
    device,
    timing: timing.note,
    evidence: [...evidence, ...agent.notes.map((n) => `Client — ${n}`)],
    mistakes,
    capability: shape.capability,
    posture: shape.posture,
    counter: shape.counter,
    caveat: CAVEAT,
  };
}

// ── physical camera coverage ──────────────────────────────────────────────

export interface CameraSighting {
  kind: string;          // ALPR, dome, fixed, ...
  operator: string | null;
  metres: number;
  lat: number;
  lon: number;
  direction: string | null;
}

export interface CameraCoverage {
  radiusM: number;
  cameras: CameraSighting[];
  /** Honest statement of what can and cannot be obtained from them. */
  access: string;
  summary: string;
}

/**
 * Enumerate fixed surveillance around the coordinate the network registers.
 *
 * Two hard truths are baked into the output rather than left implicit:
 *
 *   1. The coordinate is the NETWORK's registration point, not a doorway. A
 *      camera near it overlooks the operator's service area, which for a
 *      consumer ISP can be a whole exchange district. Cameras listed here are
 *      candidates for a lawful request, not a viewfinder onto the actor.
 *
 *   2. No private camera anywhere is remotely viewable by this application,
 *      and it would be a criminal offence in every relevant jurisdiction to
 *      try. What is real is that most operators retain footage for 7–30 days,
 *      and that window is the only thing that expires. Preservation requests
 *      go out first; access follows a subpoena or a police report.
 */
export async function findCameraCoverage(
  lat: number,
  lon: number,
  radiusM = 350,
): Promise<CameraCoverage | null> {
  // Only the indexed `man_made=surveillance` key is queried. A bare
  // ["surveillance"] clause forces Overpass into an unindexed key scan, which
  // on the public instance routinely exceeds the request budget and returns
  // nothing at all — trading complete coverage for an answer that arrives.
  const q =
    `[out:json][timeout:20];` +
    `node(around:${radiusM},${lat},${lon})["man_made"="surveillance"];out body 60;`;

  // The public endpoint rate-limits aggressively; the Kumi mirror serves the
  // same dataset and is tried when the primary declines.
  const MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let els: any[] | null = null;
  for (const endpoint of MIRRORS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Asherin-Security/1.0 (security alerts)",
        },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j?.elements)) { els = j.elements; break; }
    } catch {
      /* try the next mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  if (!els) return null;

  try {


    const cameras: CameraSighting[] = els
      .filter((e: any) => typeof e?.lat === "number" && typeof e?.lon === "number")
      .map((e: any) => {
        const t = (e.tags ?? {}) as Record<string, string>;
        const dLat = (e.lat - lat) * 111_320;
        const dLon = (e.lon - lon) * 111_320 * Math.cos((lat * Math.PI) / 180);
        return {
          kind: t["surveillance:type"] || t["camera:type"] || t["surveillance"] || "camera",
          operator: t.operator || t["surveillance:zone"] || null,
          metres: Math.round(Math.hypot(dLat, dLon)),
          lat: e.lat,
          lon: e.lon,
          direction: t.direction || t["camera:direction"] || null,
        };
      })
      .sort((a: CameraSighting, b: CameraSighting) => a.metres - b.metres)
      .slice(0, 25);

    const access =
      "None of these are viewable from here, and no lawful path exists to view them without the " +
      "operator's consent or a court order. What matters is the clock: fixed CCTV is typically " +
      "overwritten in 7 to 30 days, and public-agency ALPR often sooner. A written preservation " +
      "request naming the date, the time window and this coordinate, sent to each operator today, " +
      "freezes the footage while a police report or subpoena catches up. After the retention " +
      "window closes, nothing recovers it.";

    const summary = cameras.length
      ? `${cameras.length} mapped fixed camera${cameras.length > 1 ? "s" : ""} within ${radiusM} m of the ` +
        `registered coordinate, the nearest ${cameras[0].metres} m away` +
        (cameras.some((c) => c.operator) ? `, operators including ${[...new Set(cameras.map((c) => c.operator).filter(Boolean))].slice(0, 3).join(", ")}` : "") +
        ". Because the coordinate is the network's service point rather than a doorway, these " +
        "cover the area the address block is registered to — useful for a preservation request, " +
        "not for identification on their own."
      : `No fixed cameras are mapped within ${radiusM} m of the registered coordinate. Absence from ` +
        "the map is not absence in reality — private and unmapped cameras dominate most areas — but " +
        "there is no public inventory to send a preservation request to from here.";

    return { radiusM, cameras, access, summary };
  } catch {
    return null;
  }
}

