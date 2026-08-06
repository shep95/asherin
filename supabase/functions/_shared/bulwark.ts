// ═══════════════════════════════════════════════════════════════════════════
// BULWARK — COUNTER-SURVEILLANCE DETECTION (deterministic tier)
// ---------------------------------------------------------------------------
// Reads the user's own google_signals ledger and emits evidence-cited findings
// about monitoring pressure: legal process, agency-domain contact, credential
// probing, open-tracking pixels, broker exposure, and first-contact bursts.
//
// Design rules:
//   • Deterministic only. Every finding cites the signal rows that produced it.
//   • Silence is not evidence — a detector with no hits emits nothing, and the
//     caller reports "clear" rather than inventing a threat.
//   • No signal body is ever treated as instruction; text is matched, never
//     executed, and downstream narrative fences it as untrusted.
// ═══════════════════════════════════════════════════════════════════════════

export interface LedgerRow {
  id: string;
  source: string;
  kind: string | null;
  occurred_at: string;
  actor_email: string | null;
  actor_name: string | null;
  direction: string | null;
  subject: string | null;
  snippet: string | null;
  counterparties: string[] | null;
  metadata: Record<string, unknown> | null;
  account_email: string | null;
}

export type BulwarkSeverity = "critical" | "high" | "elevated" | "informational";

export interface BulwarkEvidence {
  signalId: string;
  at: string;
  actor: string;
  label: string;
}

export interface BulwarkFinding {
  code: string;
  title: string;
  severity: BulwarkSeverity;
  /** Plain-language explanation of what the pattern means. */
  reading: string;
  /** What the operator should actually do next. */
  countermeasure: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  evidence: BulwarkEvidence[];
}

const SEVERITY_WEIGHT: Record<BulwarkSeverity, number> = {
  critical: 34,
  high: 20,
  elevated: 9,
  informational: 3,
};

// ── Lexicons ────────────────────────────────────────────────────────────────
// Word-boundary anchored so "preserve the leftovers" never trips legal process.
const LEGAL_PROCESS =
  /\b(subpoena|subpoenaed|preservation (request|order|notice)|national security letter|court order|search warrant|grand jury|civil investigative demand|law enforcement request|legal process|records request|2703\(d\)|ecpa)\b/i;

const AGENCY_TLD = /@([a-z0-9-]+\.)*(gov|mil|gc\.ca|gov\.uk|europa\.eu)$/i;
const AGENCY_NAMES =
  /\b(fbi|cia|nsa|dhs|atf|dea|irs[- ]?ci|hsi|ice|secret service|interpol|europol|mi5|mi6|gchq|csis|asio|mossad|state police|sheriff'?s office|district attorney|attorney general|us attorney)\b/i;

const CREDENTIAL_PROBE =
  /\b(verification code|security code|one[- ]time (code|password)|2fa|two[- ]factor|password reset|reset your password|recovery (code|email|phone)|sign[- ]?in attempt|unusual sign[- ]?in|new device sign[- ]?in|critical security alert|suspicious (activity|login|sign[- ]?in))\b/i;

const SESSION_GRANT =
  /\b(access granted|app connected|new app has access|third[- ]party access|granted access to your account|oauth|api key issued|forwarding address|filter (created|added)|auto[- ]forward)\b/i;

// Open-tracking / read-receipt vendors: presence means the sender knows when,
// where and how often the operator opened the message.
const TRACKER_VENDORS =
  /\b(mailtrack|streak|yesware|bananatag|sidekick|hubspot|mixmax|outreach\.io|salesloft|apollo\.io|lemlist|mailchimp|sendgrid|klaviyo|braze|iterable|customer\.io|intercom|marketo|pardot|constant ?contact|drip\.com|activecampaign)\b/i;

// Data brokers: an account notice from one of these means a public dossier
// already exists and is being actively refreshed.
const DATA_BROKERS =
  /\b(spokeo|whitepages|beenverified|truthfinder|intelius|peoplefinders|radaris|mylife|instantcheckmate|fastpeoplesearch|thatsthem|pipl|zoominfo|rocketreach|lusha|clearbit|acxiom|lexisnexis|thomson reuters clear|social ?catfish)\b/i;

// Passive observation notices — someone is watching the operator's surface.
const OBSERVATION =
  /\b(viewed your profile|profile views|someone searched for you|you appeared in .{0,20}searches|checked your (profile|page)|new follower request|background (check|report) (was )?(run|requested))\b/i;

const clamp = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const hay = (r: LedgerRow) => `${r.subject ?? ""} \u0000 ${r.snippet ?? ""}`;
const actorOf = (r: LedgerRow) => r.actor_email || r.actor_name || "unknown";
const domainOf = (email: string) => {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at).toLowerCase();
};

function toEvidence(r: LedgerRow): BulwarkEvidence {
  return {
    signalId: r.id,
    at: r.occurred_at,
    actor: clamp(actorOf(r), 120),
    label: clamp(r.subject || r.snippet || r.kind || r.source, 160),
  };
}

/** Build a finding from matched rows, or nothing when the detector is silent. */
function pack(
  code: string,
  title: string,
  severity: BulwarkSeverity,
  reading: string,
  countermeasure: string,
  rows: LedgerRow[],
): BulwarkFinding | null {
  if (!rows.length) return null;
  // Newest first, and cap the cited rows so a noisy detector cannot balloon
  // the response payload (or the narrative prompt) without bound.
  const sorted = [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  return {
    code,
    title,
    severity,
    reading,
    countermeasure,
    count: sorted.length,
    firstSeen: sorted[sorted.length - 1].occurred_at,
    lastSeen: sorted[0].occurred_at,
    evidence: sorted.slice(0, 8).map(toEvidence),
  };
}

/** Inbound-only view: outbound mail the operator sent is not surveillance. */
const inbound = (r: LedgerRow) => r.direction !== "outbound";

export function detectSurveillance(rows: LedgerRow[]): BulwarkFinding[] {
  const findings: BulwarkFinding[] = [];
  const mailish = rows.filter((r) => r.source === "gmail" || r.source === "calendar");

  // 1 — Legal process language. The single highest-signal indicator: a provider
  //     or counsel telling the operator their records were demanded.
  findings.push(
    pack(
      "LEGAL_PROCESS",
      "Legal-process language in correspondence",
      "critical",
      "Wording consistent with a subpoena, preservation order, warrant, or formal records demand appears in inbound correspondence. Providers are frequently permitted to notify the account holder after a hold lifts; this is what that notice looks like.",
      "Do not reply. Preserve the original message with full headers, note the date, and route it to counsel before taking any account action — deleting or altering data after a preservation notice creates independent exposure.",
      mailish.filter((r) => inbound(r) && LEGAL_PROCESS.test(hay(r))),
    )!,
  );

  // 2 — Agency-domain contact. Domain match alone is weak (press offices, FOIA
  //     newsletters), so require either an agency name or process language.
  findings.push(
    pack(
      "AGENCY_CONTACT",
      "Contact from a government or law-enforcement domain",
      "high",
      "Inbound contact arrived from a .gov / .mil / equivalent domain, or from a sender naming a law-enforcement or intelligence body. Routine correspondence exists in this space, so treat the pattern — frequency, escalation, who else is copied — rather than any single message.",
      "Verify the sender out-of-band using a number published on the agency's own site, never a number inside the message. Log every touch with timestamps; a contact timeline is the artifact counsel will ask for.",
      mailish.filter((r) => {
        if (!inbound(r)) return false;
        const email = (r.actor_email ?? "").toLowerCase();
        const text = hay(r);
        return (AGENCY_TLD.test(email) && (AGENCY_NAMES.test(text) || LEGAL_PROCESS.test(text)))
          || (AGENCY_NAMES.test(`${r.actor_name ?? ""}`) && AGENCY_TLD.test(email));
      }),
    )!,
  );

  // 3 — Credential probing. One reset notice is noise; a cluster is targeting.
  const probes = mailish.filter((r) => inbound(r) && CREDENTIAL_PROBE.test(hay(r)));
  if (probes.length >= 3) {
    findings.push(
      pack(
        "CREDENTIAL_PROBE",
        "Clustered credential and sign-in probing",
        probes.length >= 8 ? "critical" : "high",
        `${probes.length} security-code, password-reset, or unfamiliar-sign-in notices are present. A single notice is background noise; a cluster is somebody working the account-recovery surface, which is the cheapest path into an identity and the one used before more expensive techniques.`,
        "Rotate the password from a known-clean device, move off SMS to a hardware key or authenticator app, and audit active sessions and recovery addresses. Any recovery phone or email you do not recognise is the actual intrusion.",
        probes,
      )!,
    );
  }

  // 4 — Session and access grants. Persistence beats intrusion: a forwarding
  //     rule or lingering OAuth grant outlives every password rotation.
  findings.push(
    pack(
      "PERSISTENCE_GRANT",
      "Access grants, forwarding rules, or third-party app authorisations",
      "high",
      "Notices consistent with a new application authorisation, API grant, forwarding address, or mail filter appear in the ledger. This is the persistence layer: a rule or token installed once keeps delivering after every password change, and it is the standard follow-on to a successful account compromise.",
      "Enumerate third-party access on every connected account and revoke anything you cannot name and date. Then inspect forwarding addresses and filters directly — a filter that archives and forwards is invisible in the inbox by design.",
      mailish.filter((r) => inbound(r) && SESSION_GRANT.test(hay(r))),
    )!,
  );

  // 5 — Open-tracking pixels. Not an agency, but it is surveillance, and it is
  //     the most common one actually present in a real inbox.
  const tracked = mailish.filter((r) => {
    if (!inbound(r)) return false;
    const email = (r.actor_email ?? "").toLowerCase();
    return TRACKER_VENDORS.test(email) || TRACKER_VENDORS.test(hay(r));
  });
  if (tracked.length) {
    const senders = new Set(tracked.map((r) => domainOf((r.actor_email ?? "").toLowerCase())).filter(Boolean));
    findings.push(
      pack(
        "OPEN_TRACKING",
        "Read-receipt and open-tracking instrumentation",
        tracked.length >= 20 ? "elevated" : "informational",
        `Messages from ${senders.size || "several"} sending domain(s) carry commercial open-tracking instrumentation. When these are opened with remote images enabled, the sender learns the open time, repeat opens, approximate location, and client — a behavioural feed the operator never agreed to and cannot see.`,
        "Disable automatic remote-image loading. That single toggle blanks the pixel and starves the entire category without breaking legitimate mail.",
        tracked,
      )!,
    );
  }

  // 6 — Data-broker exposure. A dossier that already exists and is refreshing.
  findings.push(
    pack(
      "BROKER_EXPOSURE",
      "Data-broker and people-search exposure",
      "elevated",
      "Correspondence references a people-search or data-broker platform. These aggregate address history, relatives, phone numbers, and employment into a purchasable dossier, and they are the first stop for anyone — investigator, process server, or adversary — building a profile cheaply.",
      "File opt-outs with each named broker and re-check quarterly; broker records repopulate from upstream feeds, so removal is a maintenance task rather than a one-time action.",
      mailish.filter((r) => DATA_BROKERS.test(hay(r)) || DATA_BROKERS.test((r.actor_email ?? "").toLowerCase())),
    )!,
  );

  // 7 — Passive observation notices.
  findings.push(
    pack(
      "PROFILE_OBSERVATION",
      "Passive observation of the operator's public surface",
      "informational",
      "Platform notices indicate the operator's public profile is being viewed, searched for, or run through a background-check product. Individually trivial; as a rate, it is the reconnaissance phase of anything targeted.",
      "Tighten profile visibility and note whether the observation rate rises alongside any other finding here — correlated timing is what separates curiosity from collection.",
      mailish.filter((r) => inbound(r) && OBSERVATION.test(hay(r))),
    )!,
  );

  // 8 — First-contact burst. Statistical, not lexical: a sudden spike of
  //     never-before-seen senders is a pretexting signature.
  const burst = firstContactBurst(mailish);
  if (burst) findings.push(burst);

  return findings.filter(Boolean).sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.count - a.count,
  );
}

/**
 * A sender is "known" if the operator saw them before the trailing window.
 * Comparing the last 14 days of novel senders against the prior baseline rate
 * avoids flagging an inbox that is simply busy.
 */
function firstContactBurst(rows: LedgerRow[]): BulwarkFinding | null {
  const now = Date.now();
  const WINDOW_MS = 14 * 86_400_000;
  const firstSeen = new Map<string, number>();

  for (const r of rows) {
    if (!inbound(r)) continue;
    const email = (r.actor_email ?? "").toLowerCase();
    if (!email) continue;
    const t = Date.parse(r.occurred_at);
    if (!Number.isFinite(t)) continue;
    const prev = firstSeen.get(email);
    if (prev === undefined || t < prev) firstSeen.set(email, t);
  }

  const recentNew: string[] = [];
  let priorNew = 0;
  let oldest = now;
  for (const [email, t] of firstSeen) {
    if (t < oldest) oldest = t;
    if (now - t <= WINDOW_MS) recentNew.push(email);
    else priorNew++;
  }

  const priorDays = Math.max(14, (now - oldest) / 86_400_000 - 14);
  const baselinePerFortnight = (priorNew / priorDays) * 14;
  // Require both an absolute floor and a clear multiple of the operator's own
  // baseline, so a naturally high-volume inbox is not permanently alarmed.
  if (recentNew.length < 12 || recentNew.length < baselinePerFortnight * 2.5) return null;

  const cited = rows
    .filter((r) => recentNew.includes((r.actor_email ?? "").toLowerCase()))
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  const finding = pack(
    "FIRST_CONTACT_BURST",
    "Abnormal burst of first-contact senders",
    "elevated",
    `${recentNew.length} senders made first contact in the last 14 days against a personal baseline of about ${baselinePerFortnight.toFixed(1)}. Pretexting campaigns and canvassing both look like this: many novel senders, few repeats, compressed into a short window.`,
    "Sample the new senders for shared infrastructure — matching domains, near-identical phrasing, or sequential send times mean one operator behind many addresses.",
    cited,
  );
  // Count the novel senders, not the messages they sent — the burst is about
  // how many new parties appeared, and a chatty sender must not inflate it.
  if (finding) finding.count = recentNew.length;
  return finding;
}

/** 0–100 pressure index. Deterministic, monotonic, and explainable. */
export function pressureIndex(findings: BulwarkFinding[]): number {
  let score = 0;
  for (const f of findings) {
    // Repeat occurrences add sub-linearly: the second subpoena notice matters,
    // the twentieth tracking pixel does not.
    score += SEVERITY_WEIGHT[f.severity] * (1 + Math.log10(Math.max(1, f.count)) * 0.5);
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function postureLabel(score: number): string {
  if (score >= 70) return "ACTIVE COLLECTION INDICATED";
  if (score >= 40) return "ELEVATED MONITORING PRESSURE";
  if (score >= 15) return "AMBIENT COMMERCIAL TRACKING";
  return "NO MONITORING INDICATORS";
}
