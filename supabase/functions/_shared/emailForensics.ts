// ═══════════════════════════════════════════════════════════════════════════
// POSTMARK — Email Metadata Forensics
// ---------------------------------------------------------------------------
// The visible part of an email (sender name, subject, body) is the part the
// sender chose to show you. The envelope — the Received relay chain, the
// authentication verdicts the receiving MTA stamped on it, the Message-ID
// domain, the mailer that composed it, the timezone the clock was set to —
// is the part they did not choose. That is where intelligence lives.
//
// This module is PURE header analysis. It never reads message bodies, never
// stores content, and never leaves the operator's own mailbox. Everything it
// returns is derived from headers Gmail already hands us on a
// `format=metadata` read, plus optional IP geolocation of relay hops.
//
// Provenance discipline: every derived claim carries the header it came from,
// so nothing in the UI is an unsourced assertion.
// ═══════════════════════════════════════════════════════════════════════════

/** Every header we ask Gmail for. Order is irrelevant; completeness is not. */
export const FORENSIC_HEADERS = [
  "From", "To", "Cc", "Bcc", "Reply-To", "Sender", "Return-Path", "Delivered-To",
  "Subject", "Date", "Message-ID", "In-Reply-To", "References",
  "Received", "Received-SPF", "Authentication-Results", "ARC-Authentication-Results",
  "DKIM-Signature", "X-Google-DKIM-Signature", "X-Google-Original-From",
  "X-Mailer", "User-Agent", "X-Originating-IP", "X-Sender-IP", "X-Forwarded-For",
  "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted",
  "X-Priority", "Importance", "Content-Language", "MIME-Version", "Content-Type",
  "X-Spam-Status", "X-Spam-Flag", "X-Original-Sender", "X-Report-Abuse",
  "X-Entity-ID", "X-Campaign", "X-SES-Outgoing", "X-Mailgun-Sid", "X-SG-EID",
] as const;

export type AuthVerdict = "pass" | "fail" | "softfail" | "neutral" | "none" | "temperror" | "permerror" | "unknown";

export interface RelayHop {
  index: number;              // 0 = origin (earliest), ascending toward the mailbox
  from: string | null;        // host the sending side announced (HELO / reverse DNS)
  by: string | null;          // host that accepted it
  ip: string | null;          // public IP observed at this hop, if any
  proto: string | null;       // ESMTPS / ESMTPSA / SMTP / HTTP …
  tls: boolean;               // "S" in ESMTPS, or explicit TLS/cipher text
  at: string | null;          // ISO timestamp stamped by the receiving host
  delaySec: number | null;    // seconds spent between the previous hop and this one
  geo?: IpGeo | null;         // filled by enrichHops()
}

export interface IpGeo {
  ip: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  asn: string | null;
  org: string | null;
  isHosting: boolean | null;   // datacenter / VPS — normal for ESPs, notable for "personal" mail
  isProxy: boolean | null;     // VPN / proxy / Tor exit
}

export interface ForensicFlag {
  code: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  detail: string;
  evidence: string;   // the exact header text the finding rests on
}

export interface MessageForensics {
  id: string;
  threadId: string | null;
  subject: string;
  date: string | null;
  internalDate: number | null;

  fromName: string | null;
  fromAddress: string | null;
  fromDomain: string | null;
  replyTo: string | null;
  replyToDomain: string | null;
  returnPath: string | null;
  returnPathDomain: string | null;
  deliveredTo: string | null;
  toCount: number;
  ccCount: number;

  messageIdDomain: string | null;
  dkimDomain: string | null;
  dkimSelector: string | null;

  spf: AuthVerdict;
  dkim: AuthVerdict;
  dmarc: AuthVerdict;
  compauth: string | null;
  arcPresent: boolean;

  aligned: {
    returnPath: boolean | null;   // Return-Path domain aligns with From domain
    dkim: boolean | null;         // DKIM d= aligns with From domain
    messageId: boolean | null;    // Message-ID domain aligns with From domain
  };

  hops: RelayHop[];
  hopCount: number;
  originIp: string | null;
  originGeo: IpGeo | null;
  transitSeconds: number | null;

  mailer: string | null;          // X-Mailer / User-Agent verbatim
  mailerFamily: string | null;    // normalized: Apple Mail, Outlook, Thunderbird, script…
  esp: string | null;             // sending platform inferred from infrastructure
  senderUtcOffsetMin: number | null;  // from the Date header's own offset
  clockSkewSec: number | null;    // sender Date vs server internalDate

  isBulk: boolean;
  isAutomated: boolean;
  listId: string | null;
  precedence: string | null;
  spamStatus: string | null;

  flags: ForensicFlag[];
  riskScore: number;              // 0 clean … 100 hostile
  verdict: "clean" | "watch" | "suspect" | "hostile";
}

// ─── header access ────────────────────────────────────────────────────────

type RawHeader = { name?: string; value?: string };

/** Case-insensitive multi-value header index. Received appears many times. */
export function indexHeaders(raw: RawHeader[] | undefined | null): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const h of raw || []) {
    const k = (h?.name || "").toLowerCase().trim();
    if (!k) continue;
    const v = (h?.value || "").trim();
    const bucket = map.get(k);
    if (bucket) bucket.push(v);
    else map.set(k, [v]);
  }
  return map;
}

const one = (m: Map<string, string[]>, k: string): string | null => m.get(k)?.[0] ?? null;
const all = (m: Map<string, string[]>, k: string): string[] => m.get(k) ?? [];

// ─── address / domain primitives ──────────────────────────────────────────

/**
 * Pull the addr-spec out of an RFC 5322 mailbox. Deliberately linear and
 * anchored: no nested quantifiers, so a hostile 8 KB header cannot induce
 * catastrophic backtracking.
 *
 * The real address is the LAST angle-bracket pair, not the first. A spoofer
 * writes `"Accounts Payable <ap@stripe.com>" <billing@evil.top>` precisely
 * because a naive first-bracket parser reports the decoy and the whole
 * analysis then vindicates the attacker.
 */
export function parseAddress(value: string | null): { name: string | null; address: string | null } {
  if (!value) return { name: null, address: null };
  const v = value.slice(0, 2000).trim();
  const angle = v.lastIndexOf("<");
  if (angle >= 0) {
    const close = v.indexOf(">", angle);
    const address = (close > angle ? v.slice(angle + 1, close) : v.slice(angle + 1)).trim().toLowerCase();
    const name = v.slice(0, angle).trim().replace(/^"|"$/g, "").replace(/"$/, "").trim();
    return { name: name || null, address: address || null };
  }
  const bare = v.split(/[\s,;]+/).find((t) => t.includes("@"));
  return { name: null, address: bare ? bare.replace(/^<|>$/g, "").toLowerCase() : null };
}


export function domainOf(address: string | null): string | null {
  if (!address) return null;
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  return address.slice(at + 1).replace(/[>\s.]+$/, "").toLowerCase() || null;
}

/** eTLD+1 approximation good enough for alignment checks on common suffixes. */
const MULTI_SUFFIX = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.jp", "co.kr", "com.au", "net.au", "com.br",
  "com.mx", "co.in", "co.za", "com.sg", "com.tr", "co.nz", "com.cn", "com.hk",
]);
export function registrableDomain(domain: string | null): string | null {
  if (!domain) return null;
  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".") || null;
  const last2 = parts.slice(-2).join(".");
  if (MULTI_SUFFIX.has(last2)) return parts.slice(-3).join(".");
  return last2;
}

const sameOrg = (a: string | null, b: string | null): boolean | null => {
  const ra = registrableDomain(a);
  const rb = registrableDomain(b);
  if (!ra || !rb) return null;
  return ra === rb;
};

// ─── Received chain ───────────────────────────────────────────────────────

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/i;

export function isPublicIp(ip: string | null): boolean {
  if (!ip) return false;
  if (ip.includes(":")) {
    const low = ip.toLowerCase();
    return !(low.startsWith("fe80") || low.startsWith("fc") || low.startsWith("fd") || low === "::1");
  }
  const o = ip.split(".").map((n) => Number(n));
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (o[0] === 10 || o[0] === 127 || o[0] === 0) return false;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return false;
  if (o[0] === 192 && o[1] === 168) return false;
  if (o[0] === 169 && o[1] === 254) return false;   // link-local / cloud metadata
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return false; // CGNAT
  return true;
}

/**
 * Parse one `Received:` field. Received is free-form by spec, so this reads
 * the clauses that virtually every MTA does emit (from / by / with / ;date)
 * and tolerates the rest rather than failing the whole message.
 */
export function parseReceived(value: string): Omit<RelayHop, "index" | "delaySec"> {
  const v = value.replace(/\s+/g, " ").slice(0, 4000);
  const semi = v.lastIndexOf(";");
  const datePart = semi >= 0 ? v.slice(semi + 1).trim() : "";
  const head = semi >= 0 ? v.slice(0, semi) : v;

  const fromM = /(?:^|\s)from\s+([^\s;]+)/i.exec(head);
  const byM = /(?:^|\s)by\s+([^\s;]+)/i.exec(head);
  const withM = /(?:^|\s)with\s+([A-Za-z0-9._-]+)/i.exec(head);

  // Prefer an IP in brackets/parens (the observed peer) over any IP that
  // happens to appear inside a hostname token.
  const bracket = /\[(?:IPv6:)?([0-9a-fA-F:.]{3,45})\]/.exec(head);
  let ip = bracket?.[1] ?? null;
  if (!ip) ip = IPV4.exec(head)?.[0] ?? IPV6.exec(head)?.[0] ?? null;
  if (ip && !isPublicIp(ip)) ip = null;

  const proto = withM?.[1] ?? null;
  const tls = /\bESMTPS?A?\b/i.test(proto || "") ? /S/i.test(proto || "") : /\b(TLS|cipher|version=TLS)/i.test(head);

  let at: string | null = null;
  if (datePart) {
    const t = Date.parse(datePart);
    if (Number.isFinite(t)) at = new Date(t).toISOString();
  }

  return {
    from: fromM?.[1]?.replace(/[();,]/g, "") || null,
    by: byM?.[1]?.replace(/[();,]/g, "") || null,
    ip,
    proto,
    tls,
    at,
  };
}

/** Received headers arrive newest-first. Return them origin-first with delays. */
export function buildChain(received: string[]): RelayHop[] {
  const parsed = received.map(parseReceived).reverse();
  return parsed.map((h, i) => {
    const prev = i > 0 ? parsed[i - 1].at : null;
    const delaySec = prev && h.at ? Math.max(0, Math.round((Date.parse(h.at) - Date.parse(prev)) / 1000)) : null;
    return { ...h, index: i, delaySec };
  });
}

// ─── authentication verdicts ──────────────────────────────────────────────

function readVerdict(text: string, mech: string): AuthVerdict {
  // e.g. "spf=pass (google.com: domain of …)" — anchored on the mechanism token.
  const re = new RegExp(`(?:^|[;\\s])${mech}\\s*=\\s*([a-z]+)`, "i");
  const m = re.exec(text);
  const v = m?.[1]?.toLowerCase();
  if (!v) return "unknown";
  if (["pass", "fail", "softfail", "neutral", "none", "temperror", "permerror"].includes(v)) return v as AuthVerdict;
  if (v === "bestguesspass") return "neutral";
  return "unknown";
}

// ─── fingerprints ─────────────────────────────────────────────────────────

const ESP_SIGNATURES: Array<[RegExp, string]> = [
  [/amazonses\.com|\bSES\b/i, "Amazon SES"],
  [/sendgrid\.(net|com)|sendgrid\.me/i, "SendGrid"],
  [/mailgun\.(org|net)/i, "Mailgun"],
  [/mcsv\.net|mailchimp|rsgsv\.net|mcdlv\.net/i, "Mailchimp"],
  [/sparkpostmail|\bsparkpost/i, "SparkPost"],
  [/postmarkapp\.com/i, "Postmark"],
  [/mandrillapp\.com/i, "Mandrill"],
  [/klaviyomail\.com|klaviyo/i, "Klaviyo"],
  [/hubspotemail\.net|hubspot/i, "HubSpot"],
  [/salesforce\.com|exacttarget|\bmta\d?\.exacttarget/i, "Salesforce Marketing Cloud"],
  [/protection\.outlook\.com|outbound\.protection/i, "Microsoft 365 / Exchange Online"],
  [/google\.com|googlemail\.com|gmail\.com/i, "Google Workspace / Gmail"],
  [/zoho(?:mail)?\.(com|eu)/i, "Zoho Mail"],
  [/mimecast\.com/i, "Mimecast"],
  [/proofpoint|pphosted\.com/i, "Proofpoint"],
  [/barracuda(?:networks)?\.com|barracudanetworks/i, "Barracuda"],
  [/yahoodns\.net|yahoo\.com/i, "Yahoo"],
  [/icloud\.com|apple\.com/i, "Apple iCloud Mail"],
  [/protonmail|proton\.me/i, "Proton Mail"],
  [/tutanota|tuta\.com/i, "Tutanota"],
  [/fastmail(?:\.com)?|messagingengine\.com/i, "Fastmail"],
  [/sendinblue|brevo\.com/i, "Brevo"],
  [/constantcontact|ccsend\.com/i, "Constant Contact"],
  [/intercom(?:mail)?\.io|intercom\.com/i, "Intercom"],
  [/zendesk\.com/i, "Zendesk"],
  [/mailjet\.com/i, "Mailjet"],
  [/elasticemail/i, "Elastic Email"],
  [/smtp2go/i, "SMTP2GO"],
  // Shared-hosting and VPS relays. Not inherently hostile, but a "personal"
  // or brand-claiming message emitted straight off a rented box is a shape
  // the operator should see named rather than left blank.
  [/hostinger|hostgator|bluehost|godaddy|secureserver\.net|namecheap|siteground|dreamhost|ionos|1and1/i, "Shared web host relay"],
  [/digitalocean|linode|vultr|hetzner|contabo|ovh\.net|ovhcloud|scaleway|upcloud/i, "VPS / cloud relay"],
  [/amazonaws\.com|azure|googleusercontent|compute\.internal/i, "Cloud compute relay"],
];

const MAILER_SIGNATURES: Array<[RegExp, string]> = [
  [/iPhone Mail|iPad Mail|iPhone-Mail/i, "Apple Mail (iOS)"],
  [/Apple Mail|MacOutlook|Mac OS X Mail/i, "Apple Mail (macOS)"],
  [/Microsoft Outlook|Microsoft-MacOutlook|MSOutlook/i, "Microsoft Outlook"],
  [/Microsoft Exchange|ExchangeServer/i, "Exchange Server"],
  [/Thunderbird|Mozilla/i, "Mozilla Thunderbird"],
  [/Zimbra/i, "Zimbra"],
  [/Roundcube/i, "Roundcube webmail"],
  [/Horde/i, "Horde webmail"],
  [/PHPMailer|phpmailer/i, "PHPMailer (script)"],
  [/SwiftMailer|Symfony Mailer/i, "SwiftMailer (script)"],
  [/Nodemailer/i, "Nodemailer (script)"],
  [/Python|smtplib|Django/i, "Python script"],
  [/Ruby|ActionMailer/i, "Ruby ActionMailer (script)"],
  [/PowerShell|Send-MailMessage/i, "PowerShell (script)"],
  [/Postbox|Airmail|Spark|Superhuman|Missive|Bluemail|Edison/i, "Third-party mail client"],
  [/Android|Samsung|BlackBerry/i, "Mobile mail client"],
];

const matchSig = (text: string, table: Array<[RegExp, string]>): string | null => {
  for (const [re, label] of table) if (re.test(text)) return label;
  return null;
};

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "aol.com", "icloud.com", "me.com", "mail.com", "gmx.com", "yandex.com", "proton.me",
  "protonmail.com", "zoho.com", "msn.com", "ymail.com", "inbox.com", "mail.ru",
]);

/** Homoglyph / lookalike heuristics used only as corroboration, never alone. */
function looksLikeLookalike(domain: string | null): string | null {
  if (!domain) return null;
  const d = registrableDomain(domain) || domain;
  if (/\bxn--/.test(d)) return "punycode (internationalized) domain";
  if (/\d/.test(d.split(".")[0]) && /[a-z]/.test(d)) {
    if (/(?:0(?=[a-z])|1(?=[a-z])|(?<=[a-z])0|(?<=[a-z])1)/.test(d.split(".")[0])) {
      return "digit-for-letter substitution in the label";
    }
  }
  if (/(-secure|-support|-verify|-login|-account|secure-|support-|verify-|login-|account-)/.test(d)) {
    return "trust-word compound label";
  }
  return null;
}

// ─── the analyzer ─────────────────────────────────────────────────────────

export interface AnalyzeInput {
  id: string;
  threadId?: string | null;
  snippet?: string;
  internalDate?: string | number | null;
  labelIds?: string[];
  payload?: { headers?: RawHeader[] };
}

export function analyzeMessage(msg: AnalyzeInput): MessageForensics {
  const H = indexHeaders(msg.payload?.headers);

  const fromRaw = one(H, "from");
  const { name: fromName, address: fromAddress } = parseAddress(fromRaw);
  const fromDomain = domainOf(fromAddress);

  const replyTo = parseAddress(one(H, "reply-to")).address;
  const returnPath = parseAddress(one(H, "return-path")).address;
  const deliveredTo = parseAddress(one(H, "delivered-to")).address;
  const replyToDomain = domainOf(replyTo);
  const returnPathDomain = domainOf(returnPath);

  const messageId = one(H, "message-id");
  const messageIdDomain = messageId ? domainOf(messageId.replace(/[<>]/g, "")) : null;

  const dkimSig = one(H, "dkim-signature") || "";
  const dkimDomain = /(?:^|[;\s])d\s*=\s*([^;\s]+)/i.exec(dkimSig)?.[1]?.toLowerCase() ?? null;
  const dkimSelector = /(?:^|[;\s])s\s*=\s*([^;\s]+)/i.exec(dkimSig)?.[1] ?? null;

  const authText = [...all(H, "authentication-results"), ...all(H, "arc-authentication-results")].join(" ; ");
  const spfHeader = one(H, "received-spf") || "";
  let spf = readVerdict(authText, "spf");
  if (spf === "unknown" && spfHeader) {
    const w = /^\s*([a-z]+)/i.exec(spfHeader)?.[1]?.toLowerCase();
    spf = (["pass", "fail", "softfail", "neutral", "none"].includes(w || "") ? w : "unknown") as AuthVerdict;
  }
  const dkim = dkimSig && readVerdict(authText, "dkim") === "unknown" ? "unknown" : readVerdict(authText, "dkim");
  const dmarc = readVerdict(authText, "dmarc");
  const compauth = /compauth\s*=\s*([a-z]+)/i.exec(authText)?.[1]?.toLowerCase() ?? null;

  const hops = buildChain(all(H, "received"));
  const declaredRaw = (one(H, "x-originating-ip") || one(H, "x-sender-ip") || "").replace(/[\[\]]/g, "").trim();
  const declaredIp = declaredRaw || null;

  const originHop = hops.find((h) => h.ip);
  const originIp = (declaredIp && isPublicIp(declaredIp) ? declaredIp : null) ?? originHop?.ip ?? null;

  const firstAt = hops.find((h) => h.at)?.at ?? null;
  const lastAt = [...hops].reverse().find((h) => h.at)?.at ?? null;
  const transitSeconds = firstAt && lastAt
    ? Math.max(0, Math.round((Date.parse(lastAt) - Date.parse(firstAt)) / 1000))
    : null;

  const dateHeader = one(H, "date");
  const offsetM = dateHeader ? /([+-])(\d{2})(\d{2})\s*$/.exec(dateHeader.trim()) : null;
  const senderUtcOffsetMin = offsetM
    ? (offsetM[1] === "-" ? -1 : 1) * (Number(offsetM[2]) * 60 + Number(offsetM[3]))
    : null;

  const internalDate = msg.internalDate != null ? Number(msg.internalDate) : null;
  const senderMs = dateHeader ? Date.parse(dateHeader) : NaN;
  const clockSkewSec = internalDate && Number.isFinite(senderMs)
    ? Math.round((senderMs - internalDate) / 1000)
    : null;

  const mailer = one(H, "x-mailer") || one(H, "user-agent");
  const mailerFamily = mailer ? matchSig(mailer, MAILER_SIGNATURES) : null;

  // Fingerprint the SENDING infrastructure only. Including every `by` host
  // meant the operator's own receiving MTA (mx.google.com) matched first and
  // every message on earth came back as "Google Workspace" — a fingerprint of
  // the mailbox, not of the sender.
  const originSide = hops[0]?.from || "";
  const infraText = [
    originSide, messageIdDomain || "", dkimDomain || "", returnPathDomain || "",
    one(H, "x-ses-outgoing") || "", one(H, "x-mailgun-sid") ? "mailgun" : "", one(H, "x-sg-eid") ? "sendgrid" : "",
  ].join(" ");
  const esp = matchSig(infraText, ESP_SIGNATURES);


  const listUnsub = one(H, "list-unsubscribe");
  const listId = one(H, "list-id");
  const precedence = one(H, "precedence");
  const autoSubmitted = one(H, "auto-submitted");
  const isBulk = !!(listUnsub || listId || /bulk|list|junk/i.test(precedence || ""));
  const isAutomated = isBulk || !!(autoSubmitted && autoSubmitted.toLowerCase() !== "no");

  const aligned = {
    returnPath: sameOrg(returnPathDomain, fromDomain),
    dkim: sameOrg(dkimDomain, fromDomain),
    messageId: sameOrg(messageIdDomain, fromDomain),
  };

  // ── findings ────────────────────────────────────────────────────────────
  const flags: ForensicFlag[] = [];
  const push = (f: ForensicFlag) => flags.push(f);

  if (spf === "fail" || spf === "softfail") {
    push({
      code: "SPF_FAIL", severity: spf === "fail" ? "critical" : "high",
      title: `SPF ${spf}`,
      detail: `The relay that handed this message over is not authorized to send for ${fromDomain ?? "the claimed domain"}.`,
      evidence: (spfHeader || authText).slice(0, 400),
    });
  }
  if (dkim === "fail") {
    push({
      code: "DKIM_FAIL", severity: "critical", title: "DKIM signature failed",
      detail: "The cryptographic signature does not verify — the message was altered in transit or forged outright.",
      evidence: authText.slice(0, 400),
    });
  } else if (dkim === "none" && !isBulk) {
    push({
      code: "DKIM_NONE", severity: "medium", title: "Unsigned message",
      detail: "No DKIM signature at all. Nothing binds this message to the domain it claims.",
      evidence: authText.slice(0, 300) || "no Authentication-Results DKIM verdict",
    });
  }
  if (dmarc === "fail") {
    push({
      code: "DMARC_FAIL", severity: "critical", title: "DMARC failed",
      detail: "The domain owner's own published policy says this message should not be trusted.",
      evidence: authText.slice(0, 400),
    });
  }
  if (aligned.returnPath === false) {
    // A bulk sender whose DMARC passes is *supposed* to bounce through its
    // platform. Scoring that as "high" buried the real hijack attempts under
    // every newsletter in the mailbox, so relaxed alignment is graded as
    // context, not as an accusation.
    const benign = dmarc === "pass" && (isBulk || aligned.dkim === true);
    push({
      code: "ENVELOPE_MISMATCH", severity: benign ? "info" : "high",
      title: benign ? "Platform-relayed envelope (expected)" : "Envelope sender differs from visible sender",
      detail: benign
        ? `Bounces route to ${returnPathDomain} while the message presents as ${fromDomain} — normal relaxed alignment for a DMARC-passing sending platform.`
        : `Bounces route to ${returnPathDomain}, while the message presents as ${fromDomain}, and nothing authenticates that relationship.`,
      evidence: `Return-Path: ${returnPath} | From: ${fromAddress}`,
    });
  }
  if (replyToDomain && sameOrg(replyToDomain, fromDomain) === false) {
    const benign = dmarc === "pass" && isBulk;
    push({
      code: "REPLYTO_DIVERGENCE", severity: benign ? "low" : "high",
      title: "Replies redirect to a different domain",
      detail: benign
        ? `Replies land at ${replyToDomain} rather than ${fromDomain} — common for authenticated platform mail, still worth knowing before you answer.`
        : `A reply leaves the conversation and lands at ${replyToDomain}. This is the standard mechanic of a conversation-hijack or invoice-redirection attempt.`,

      evidence: `Reply-To: ${replyTo} | From: ${fromAddress}`,
    });
  }
  // Display-name spoof: the name field itself carries a different address.
  if (fromName && fromName.includes("@")) {
    const inName = domainOf(parseAddress(fromName).address);
    if (inName && sameOrg(inName, fromDomain) === false) {
      push({
        code: "DISPLAY_NAME_SPOOF", severity: "critical", title: "Display name carries a foreign address",
        detail: `The name shown to you reads as ${inName}, but the message is actually from ${fromDomain}. Mail clients show the name, not the address.`,
        evidence: String(fromRaw).slice(0, 300),
      });
    }
  }
  if (fromDomain && FREEMAIL.has(registrableDomain(fromDomain) || "") && /\b(invoice|payroll|wire|bank|account|ceo|cfo|hr|legal)\b/i.test(one(H, "subject") || "")) {
    push({
      code: "FREEMAIL_AUTHORITY", severity: "high", title: "Authority claim from a consumer mailbox",
      detail: "A financial or authority-framed subject arriving from a free consumer provider is the classic business-email-compromise shape.",
      evidence: `From: ${fromAddress} | Subject: ${(one(H, "subject") || "").slice(0, 160)}`,
    });
  }
  const lookalike = looksLikeLookalike(fromDomain);
  if (lookalike) {
    push({
      code: "LOOKALIKE_DOMAIN", severity: "high", title: "Sender domain shows impersonation structure",
      detail: `${fromDomain} exhibits ${lookalike}.`,
      evidence: `From: ${fromAddress}`,
    });
  }
  if (mailerFamily && /script/i.test(mailerFamily) && dkim !== "pass") {
    push({
      code: "SCRIPT_MAILER", severity: "medium", title: "Machine-composed and unverified",
      detail: `Composed by ${mailerFamily} with no passing signature — typical of a compromised web host relaying on someone else's behalf.`,
      evidence: `X-Mailer/User-Agent: ${mailer}`,
    });
  }
  if (clockSkewSec != null && Math.abs(clockSkewSec) > 6 * 3600) {
    push({
      code: "CLOCK_SKEW", severity: "low", title: "Sender clock disagrees with receipt time",
      detail: `The Date header is ${Math.round(Math.abs(clockSkewSec) / 3600)}h ${clockSkewSec > 0 ? "ahead of" : "behind"} the receiving server's clock.`,
      evidence: `Date: ${dateHeader}`,
    });
  }
  if (hops.length === 0) {
    push({
      code: "NO_CHAIN", severity: "info", title: "No relay chain exposed",
      detail: "Gmail returned no Received headers for this message — usually an internally generated or API-injected message.",
      evidence: "Received: (absent)",
    });
  } else if (hops.length >= 8) {
    push({
      code: "LONG_CHAIN", severity: "low", title: `${hops.length}-hop relay path`,
      detail: "A long path means multiple forwarders touched this message; each is a place it could have been read or altered.",
      evidence: hops.map((h) => h.by || h.from || "?").join(" → ").slice(0, 400),
    });
  }
  if (hops.length > 0 && !hops.some((h) => h.tls)) {
    push({
      code: "NO_TLS", severity: "medium", title: "Delivered without transport encryption",
      detail: "No hop in the chain negotiated TLS. The message crossed the internet readable to anyone on the path.",
      evidence: hops.map((h) => h.proto || "?").join(", ").slice(0, 200),
    });
  }
  const spamStatus = one(H, "x-spam-status") || one(H, "x-spam-flag");
  if (spamStatus && /^yes|\bYes\b/i.test(spamStatus)) {
    push({
      code: "UPSTREAM_SPAM", severity: "medium", title: "Flagged upstream",
      detail: "A filter before your mailbox already scored this as unwanted.",
      evidence: spamStatus.slice(0, 200),
    });
  }

  const WEIGHT: Record<ForensicFlag["severity"], number> = { critical: 40, high: 22, medium: 10, low: 4, info: 0 };
  const riskScore = Math.min(100, flags.reduce((s, f) => s + WEIGHT[f.severity], 0));
  const verdict: MessageForensics["verdict"] =
    riskScore >= 60 ? "hostile" : riskScore >= 30 ? "suspect" : riskScore >= 10 ? "watch" : "clean";

  return {
    id: msg.id,
    threadId: msg.threadId ?? null,
    subject: one(H, "subject") || "(no subject)",
    date: dateHeader,
    internalDate,
    fromName, fromAddress, fromDomain,
    replyTo, replyToDomain, returnPath, returnPathDomain, deliveredTo,
    toCount: (one(H, "to") || "").split(",").filter((s) => s.includes("@")).length,
    ccCount: (one(H, "cc") || "").split(",").filter((s) => s.includes("@")).length,
    messageIdDomain, dkimDomain, dkimSelector,
    spf, dkim, dmarc, compauth,
    arcPresent: all(H, "arc-authentication-results").length > 0,
    aligned,
    hops, hopCount: hops.length,
    originIp, originGeo: null, transitSeconds,
    mailer, mailerFamily, esp,
    senderUtcOffsetMin, clockSkewSec,
    isBulk, isAutomated, listId, precedence,
    spamStatus,
    flags, riskScore, verdict,
  };
}

// ─── IP enrichment ────────────────────────────────────────────────────────

/**
 * Geolocate relay IPs. Free endpoints are rate-limited and occasionally down,
 * so this is best-effort by design: a failed lookup degrades one hop to
 * "unlocated", never the whole report. Every call is timeout-bounded.
 */
export async function geolocateIps(ips: string[], timeoutMs = 6000): Promise<Map<string, IpGeo>> {
  const out = new Map<string, IpGeo>();
  const unique = [...new Set(ips.filter((ip) => isPublicIp(ip)))].slice(0, 60);
  const lookup = async (ip: string) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctl.signal });
      if (!r.ok) return;
      const d = await r.json();
      if (d?.success === false) return;
      out.set(ip, {
        ip,
        country: d.country ?? null,
        countryCode: d.country_code ?? null,
        region: d.region ?? null,
        city: d.city ?? null,
        lat: typeof d.latitude === "number" ? d.latitude : null,
        lon: typeof d.longitude === "number" ? d.longitude : null,
        asn: d.connection?.asn ? `AS${d.connection.asn}` : null,
        org: d.connection?.org ?? d.connection?.isp ?? null,
        isHosting: d.connection?.domain ? /host|cloud|server|data|vps/i.test(String(d.connection.org || "")) : null,
        isProxy: typeof d.security?.proxy === "boolean" ? d.security.proxy : null,
      });
    } catch {
      // Best effort — an unlocated hop is still a reported hop.
    } finally {
      clearTimeout(timer);
    }
  };
  // Bounded concurrency: free geo APIs throttle hard above ~6 parallel.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, unique.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= unique.length) return;
        await lookup(unique[i]);
      }
    })
  );
  return out;
}

export function attachGeo(reports: MessageForensics[], geo: Map<string, IpGeo>): void {
  for (const r of reports) {
    for (const h of r.hops) if (h.ip) h.geo = geo.get(h.ip) ?? null;
    r.originGeo = r.originIp ? geo.get(r.originIp) ?? null : null;
    // A residential-claiming sender routed through a proxy/VPN exit is a
    // deception signal worth surfacing once geo is known.
    if (r.originGeo?.isProxy && !r.isBulk) {
      r.flags.push({
        code: "PROXY_ORIGIN", severity: "medium",
        title: "Origin hop is a proxy or VPN exit",
        detail: `The first observed relay (${r.originIp}) sits on ${r.originGeo.org ?? "an anonymizing network"}. The true sending location is concealed.`,
        evidence: `origin IP ${r.originIp} — ${r.originGeo.org ?? "unknown operator"}`,
      });
      r.riskScore = Math.min(100, r.riskScore + 10);
      r.verdict = r.riskScore >= 60 ? "hostile" : r.riskScore >= 30 ? "suspect" : r.riskScore >= 10 ? "watch" : "clean";
    }
  }
}

// ─── aggregate roll-up ────────────────────────────────────────────────────

export interface ForensicAggregate {
  analyzed: number;
  auth: { spfPass: number; dkimPass: number; dmarcPass: number; fullyAuthenticated: number; unauthenticated: number };
  verdicts: Record<MessageForensics["verdict"], number>;
  topFlags: Array<{ code: string; title: string; count: number; severity: ForensicFlag["severity"] }>;
  senderDomains: Array<{ domain: string; count: number; authPassRate: number; worstVerdict: MessageForensics["verdict"] }>;
  countries: Array<{ code: string; country: string; count: number }>;
  networks: Array<{ asn: string; org: string; count: number }>;
  mailers: Array<{ family: string; count: number }>;
  platforms: Array<{ esp: string; count: number }>;
  timezones: Array<{ offsetMin: number; label: string; count: number }>;
  encryption: { tlsAllHops: number; anyPlaintext: number; noChain: number };
  medianTransitSec: number | null;
  hostile: Array<{ id: string; from: string | null; subject: string; riskScore: number; reasons: string[] }>;
}

const rank = (v: MessageForensics["verdict"]) => ({ clean: 0, watch: 1, suspect: 2, hostile: 3 }[v]);

export function aggregate(reports: MessageForensics[]): ForensicAggregate {
  const tally = <K extends string>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

  const verdicts: Record<MessageForensics["verdict"], number> = { clean: 0, watch: 0, suspect: 0, hostile: 0 };
  const flagCount = new Map<string, { title: string; count: number; severity: ForensicFlag["severity"] }>();
  const domains = new Map<string, { count: number; pass: number; worst: MessageForensics["verdict"] }>();
  const countries = new Map<string, { country: string; count: number }>();
  const networks = new Map<string, { org: string; count: number }>();
  const mailers = new Map<string, number>();
  const platforms = new Map<string, number>();
  const zones = new Map<number, number>();
  const transits: number[] = [];
  let spfPass = 0, dkimPass = 0, dmarcPass = 0, full = 0, none = 0;
  let tlsAll = 0, plain = 0, noChain = 0;

  for (const r of reports) {
    verdicts[r.verdict]++;
    for (const f of r.flags) {
      const prior = flagCount.get(f.code);
      if (prior) prior.count++;
      else flagCount.set(f.code, { title: f.title, count: 1, severity: f.severity });
    }
    if (r.spf === "pass") spfPass++;
    if (r.dkim === "pass") dkimPass++;
    if (r.dmarc === "pass") dmarcPass++;
    const authed = r.spf === "pass" && r.dkim === "pass" && r.dmarc === "pass";
    if (authed) full++;
    if (r.spf !== "pass" && r.dkim !== "pass") none++;

    if (r.fromDomain) {
      const key = registrableDomain(r.fromDomain) || r.fromDomain;
      const d = domains.get(key) ?? { count: 0, pass: 0, worst: "clean" as MessageForensics["verdict"] };
      d.count++;
      if (authed) d.pass++;
      if (rank(r.verdict) > rank(d.worst)) d.worst = r.verdict;
      domains.set(key, d);
    }
    for (const h of r.hops) {
      if (h.geo?.countryCode) {
        const c = countries.get(h.geo.countryCode) ?? { country: h.geo.country || h.geo.countryCode, count: 0 };
        c.count++; countries.set(h.geo.countryCode, c);
      }
      if (h.geo?.asn) {
        const n = networks.get(h.geo.asn) ?? { org: h.geo.org || h.geo.asn, count: 0 };
        n.count++; networks.set(h.geo.asn, n);
      }
    }
    if (r.mailerFamily) tally(mailers, r.mailerFamily);
    if (r.esp) tally(platforms, r.esp);
    if (r.senderUtcOffsetMin != null) zones.set(r.senderUtcOffsetMin, (zones.get(r.senderUtcOffsetMin) ?? 0) + 1);
    if (r.transitSeconds != null) transits.push(r.transitSeconds);
    if (r.hopCount === 0) noChain++;
    else if (r.hops.every((h) => h.tls)) tlsAll++;
    else plain++;
  }

  transits.sort((a, b) => a - b);
  const medianTransitSec = transits.length
    ? (transits.length % 2 ? transits[(transits.length - 1) / 2]
      : Math.round((transits[transits.length / 2 - 1] + transits[transits.length / 2]) / 2))
    : null;

  const zoneLabel = (min: number) => {
    const sign = min < 0 ? "-" : "+";
    const a = Math.abs(min);
    return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  };

  return {
    analyzed: reports.length,
    auth: { spfPass, dkimPass, dmarcPass, fullyAuthenticated: full, unauthenticated: none },
    verdicts,
    topFlags: [...flagCount.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.count - a.count).slice(0, 12),
    senderDomains: [...domains.entries()]
      .map(([domain, v]) => ({ domain, count: v.count, authPassRate: v.count ? v.pass / v.count : 0, worstVerdict: v.worst }))
      .sort((a, b) => b.count - a.count).slice(0, 25),
    countries: [...countries.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.count - a.count).slice(0, 15),
    networks: [...networks.entries()].map(([asn, v]) => ({ asn, ...v })).sort((a, b) => b.count - a.count).slice(0, 15),
    mailers: [...mailers.entries()].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    platforms: [...platforms.entries()].map(([esp, count]) => ({ esp, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    timezones: [...zones.entries()].map(([offsetMin, count]) => ({ offsetMin, label: zoneLabel(offsetMin), count })).sort((a, b) => b.count - a.count).slice(0, 12),
    encryption: { tlsAllHops: tlsAll, anyPlaintext: plain, noChain },
    medianTransitSec,
    hostile: reports.filter((r) => r.verdict === "hostile" || r.verdict === "suspect")
      .sort((a, b) => b.riskScore - a.riskScore).slice(0, 25)
      .map((r) => ({ id: r.id, from: r.fromAddress, subject: r.subject, riskScore: r.riskScore, reasons: r.flags.map((f) => f.title) })),
  };
}
