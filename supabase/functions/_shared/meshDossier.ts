// ═══════════════════════════════════════════════════════════════════════════
// MESH DOSSIER ENGINE — automated correspondent intelligence for the Vault
//
// Narrative: every human who reaches your inbox is already a declared
// relationship. The mesh turns that declaration into a standing intelligence
// product: a hop-1 subject is swept against the jurisdictional substrate, the
// people that sweep exposes become hop-2 nodes, and any hop-2 node reachable
// through two independent hop-1 subjects becomes a hop-3 cross-link — the
// bounded three-hop discipline, applied to your own correspondence graph.
//
// Every value in a dossier is traceable to a URL. Nothing is inferred by a
// language model here; this module is deterministic.
// ═══════════════════════════════════════════════════════════════════════════

import {
  classifyIntent,
  runJurisdictionalSearch,
  type IntelBundle,
  type DomainBucket,
} from "./jurisdictionalIntel.ts";
import type { Correspondent } from "./googleMesh.ts";
import type { ResolvedField } from "./intelExtract.ts";

// ── Target selection ───────────────────────────────────────────────────────

/** Senders that are systems wearing a human costume. Never worth a sweep. */
const MACHINE_LOCAL =
  /^(no-?reply|do-?not-?reply|noreply|donotreply|notifications?|alerts?|updates?|news(letter)?|info|support|help|billing|invoices?|receipts?|team|hello|contact|admin|security|service|mail(er)?|bounce|postmaster|automated|robot|bot|digest|marketing|promo|offers?|careers?|jobs|feedback|survey)([.\-+_]|$)/i;

const MACHINE_DOMAIN =
  /(^|\.)(mailchimp|sendgrid|mailgun|sparkpostmail|amazonses|salesforce|hubspot|intercom|zendesk|freshdesk|atlassian|slack|github|gitlab|linkedin|facebookmail|twitter|x|instagram|tiktok|pinterest|reddit|quora|medium|substack|paypal|stripe|square|venmo|shopify|amazon|ebay|walmart|target|uber|lyft|doordash|grubhub|netflix|spotify|hulu|disney|apple|icloud|microsoftonline|office365|docusign|dropbox|zoom|calendly|eventbrite|indeed|ziprecruiter|glassdoor|chase|wellsfargo|bankofamerica|citi|capitalone|discover|amex|experian|equifax|transunion|usps|ups|fedex|dhl)\./i;

export interface VaultTarget {
  key: string;
  email: string;
  name: string;
  priority: number;
  relationship: Correspondent;
  reason: string;
}

/** A human name is at least two tokens of letters. "billing" is not a person. */
export function looksHuman(name: string): boolean {
  const clean = name.replace(/["']/g, "").trim();
  if (!clean || clean.includes("@")) return false;
  const tokens = clean.split(/\s+/).filter((t) => /^[\p{L}][\p{L}'.\-]*$/u.test(t));
  return tokens.length >= 2 && tokens.length <= 5 && clean.length <= 60;
}

export function isMachineAddress(email: string): boolean {
  const [local, domain = ""] = email.toLowerCase().split("@");
  return MACHINE_LOCAL.test(local) || MACHINE_DOMAIN.test(`${domain}.`);
}

/**
 * Rank correspondents into sweep targets.
 *
 * Priority is deliberately NOT raw volume — a mailing list out-volumes a
 * spouse. It is two-way traffic (reciprocity) multiplied by durability
 * (how long the correspondence has run), with recency as a tiebreak.
 */
export function selectTargets(
  people: Correspondent[],
  opts: { max?: number; minTotal?: number } = {},
): { targets: VaultTarget[]; skipped: Array<{ email: string; reason: string }> } {
  const max = Math.min(Math.max(opts.max ?? 25, 1), 60);
  const minTotal = opts.minTotal ?? 2;
  const targets: VaultTarget[] = [];
  const skipped: Array<{ email: string; reason: string }> = [];

  for (const p of people) {
    const total = p.received + p.sent;
    if (isMachineAddress(p.email)) { skipped.push({ email: p.email, reason: "automated sender" }); continue; }
    if (total < minTotal) { skipped.push({ email: p.email, reason: `only ${total} message(s)` }); continue; }
    if (p.sent === 0 && p.tier === "periphery") { skipped.push({ email: p.email, reason: "never answered — broadcast" }); continue; }
    if (!looksHuman(p.name)) { skipped.push({ email: p.email, reason: "no human name on the header" }); continue; }

    const durabilityDays = Math.max(
      1,
      (Date.parse(p.lastSeen) - Date.parse(p.firstSeen)) / 86400000,
    );
    const recency = 1 / (1 + p.dormantDays / 90);
    const priority = round(
      (0.55 * p.reciprocity + 0.25 * Math.min(1, total / 20) + 0.2 * Math.min(1, durabilityDays / 365)) *
        (0.6 + 0.4 * recency) * 100,
      1,
    );

    targets.push({
      key: p.email.toLowerCase(),
      email: p.email.toLowerCase(),
      name: p.name.replace(/["']/g, "").trim(),
      priority,
      relationship: p,
      reason: `${p.tier} tier · ${total} messages · reciprocity ${p.reciprocity}`,
    });
  }

  targets.sort((a, b) => b.priority - a.priority);
  return { targets: targets.slice(0, max), skipped };
}

// ── Address-book targets ───────────────────────────────────────────────────

export interface ContactTarget {
  key: string;
  email: string | null;
  name: string;
  priority: number;
  /** Address-book facts, kept verbatim so the dossier can seed on them. */
  profile: {
    source: "contacts";
    emails: string[];
    phones: string[];
    org: string | null;
    title: string | null;
    addresses: string[];
  };
  locationHint: string | null;
  reason: string;
}

/** "1234 Elm St, Cape Coral, FL 33904, USA" → "Cape Coral FL" */
function hintFromAddress(addr: string): string | null {
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const city = parts[parts.length - 3] ?? parts[0];
  const region = (parts[parts.length - 2] ?? "").replace(/\s*\d{4,}.*$/, "").trim();
  const hint = [city, region].filter(Boolean).join(" ").slice(0, 60);
  return hint.length >= 4 ? hint : null;
}

/**
 * Turn the address book into sweep subjects.
 *
 * A saved contact is a stronger declaration of relationship than a single
 * inbound message — the user typed it in — so a rich card outranks a thin
 * correspondence. Cards already covered by the mail sweep are dropped here so
 * the same human is never queued twice under two keys.
 */
export function selectContactTargets(
  contacts: Array<{
    name: string; emails: string[]; phones: string[];
    org: string | null; title: string | null; addresses: string[]; richness: number;
  }>,
  alreadyKeyed: Set<string>,
  opts: { max?: number } = {},
): { targets: ContactTarget[]; skipped: Array<{ email: string; reason: string }> } {
  const max = Math.min(Math.max(opts.max ?? 40, 1), 120);
  const targets: ContactTarget[] = [];
  const skipped: Array<{ email: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const c of contacts) {
    const primary = c.emails[0] ?? null;
    const label = primary ?? c.name;
    if (primary && isMachineAddress(primary)) {
      skipped.push({ email: label, reason: "automated address" });
      continue;
    }
    if (!looksHuman(c.name)) {
      skipped.push({ email: label, reason: "not a personal name" });
      continue;
    }
    // Mail sweep keys on the email; the book keys on the normalized name when
    // there is no address. Both are checked so one human yields one subject.
    const key = primary ? primary.toLowerCase() : `contact:${normKey(c.name).toLowerCase()}`;
    if (alreadyKeyed.has(key) || seen.has(key)) {
      skipped.push({ email: label, reason: "already a subject" });
      continue;
    }
    if (c.emails.some((e) => alreadyKeyed.has(e.toLowerCase()))) {
      skipped.push({ email: label, reason: "already a subject (alias)" });
      continue;
    }
    seen.add(key);

    // Completeness drives priority: a card with a phone, an employer and a
    // street address is a resolvable identity; a bare name is a coin flip.
    const priority = Math.round(
      Math.min(100, 30 + c.phones.length * 14 + c.emails.length * 8 +
        c.addresses.length * 12 + (c.org ? 10 : 0)),
    );

    targets.push({
      key,
      email: primary,
      name: c.name,
      priority,
      profile: {
        source: "contacts",
        emails: c.emails.slice(0, 5),
        phones: c.phones.slice(0, 5),
        org: c.org,
        title: c.title,
        addresses: c.addresses,
      },
      locationHint: c.addresses.map(hintFromAddress).find(Boolean) ?? null,
      reason: `address book · ${c.phones.length} phone(s) · ${c.emails.length} email(s)` +
        (c.org ? ` · ${c.org}` : ""),
    });
  }

  targets.sort((a, b) => b.priority - a.priority);
  return { targets: targets.slice(0, max), skipped };
}

// ── Dossier shape ──────────────────────────────────────────────────────────

export interface DossierFact {
  value: string;
  confidence: string;
  independentDomains: number;
  authoritative: boolean;
  sources: Array<{ domain: string; url: string }>;
}

export interface DossierHopNode {
  label: string;
  kind: string;
  confidence: string;
  independentDomains: number;
  via?: string;
  sources: Array<{ domain: string; url: string }>;
}

export interface MeshDossierDoc {
  version: 2;
  subject: { name: string; email: string | null; domainHint: string | null };
  builtAt: string;
  /** STRONG-band fields only: the subject was positively matched in the document. */
  identity: Record<string, DossierFact[]>;
  /**
   * POSSIBLE-band fields. These are extracted from documents that mention the
   * name but did not clear strong identity matching. Publishing them as
   * confirmed would be fabrication; withholding them entirely was the reason
   * dossiers on real people came back empty while sixty sources sat unread.
   * They ship in their own compartment, never merged into `identity`, and are
   * capped at "possibly true" no matter how many domains repeat them.
   */
  candidates: Record<string, DossierFact[]>;
  hop1: DossierHopNode[];
  hop2: DossierHopNode[];
  hop3: Array<{ node: string; viaA: string; viaB: string; strength: number }>;
  sources: Array<{ domain: string; url: string; title: string; bucket: string }>;
  metrics: {
    documentsParsed: number;
    totalHits: number;
    rejectedIdentityHits: number;
    queriesRun: number;
    elapsedMs: number;
    ring2Executed: number;
    authoritativeSources: number;
    independentDomains: number;
  };
  gaps: string[];
  jurisdiction: string;
  /**
   * Face imagery harvested from the resolved identity clusters. URLs only —
   * bytes are never inlined and are fetched later through the SSRF-guarded
   * intel-avatar proxy. Each entry names the cluster it came from so a photo
   * can never be silently attributed to the wrong same-name person.
   */
  imagery: Array<{ url: string; attributedTo: string; clusterScore: number }>;
  /**
   * Kin names asserted by the resolved cluster (relatives / spouse lines in
   * people-directory documents). Carried separately from the association ring
   * because a relative is a claimed blood/marriage tie, not a co-occurrence.
   */
  kin: string[];
  /** Which inbound channel produced this subject (mail, calendar, phone…). */
  channel?: string | null;
  /** Outcome of the reverse-identifier pass, when one was run. */
  reverse?: {
    identifier: string;
    factsAdded: number;
    hits: number;
    timedOut?: boolean;
    error?: string;
  } | null;
}


const FIELD_LABEL: Record<string, string> = {
  address: "Addresses", phone: "Phone numbers", email: "Email addresses",
  age: "Age", dob: "Date of birth", handle: "Online handles",
  employer: "Employment", entity: "Business entities", case: "Court records",
  parcel: "Property parcels", license: "Licenses", relative: "Relatives",
  alias: "Aliases",
};

function factOf(f: ResolvedField): DossierFact {
  return {
    value: f.display || f.canonical,
    confidence: f.confidence,
    independentDomains: f.independentDomains,
    authoritative: f.authoritative,
    sources: (f.sources ?? []).slice(0, 4).map((s: any) => ({ domain: s.domain, url: s.url })),
  };
}

/**
 * Confidence is evidence density, not model belief:
 *   corroboration (fields asserted by ≥2 independent domains)
 * × authority (fields from authoritative registries)
 * × coverage (how many distinct field families were resolved at all)
 */
export function scoreConfidence(doc: MeshDossierDoc): number {
  const facts = Object.values(doc.identity).flat();
  if (!facts.length) return 0;
  const corroborated = facts.filter((f) => f.independentDomains >= 2).length / facts.length;
  const authoritative = facts.filter((f) => f.authoritative).length / facts.length;
  const coverage = Math.min(1, Object.keys(doc.identity).length / 6);
  const graph = Math.min(1, (doc.hop1.length + doc.hop2.length) / 10);
  return round(
    100 * (0.35 * corroborated + 0.3 * authoritative + 0.2 * coverage + 0.15 * graph),
    1,
  );
}

/** Named absences. A silent gap reads as a finding; it is not one. */
function findGaps(doc: MeshDossierDoc, bundle: IntelBundle): string[] {
  const gaps: string[] = [];
  // A field can be resolved either into the ledger or as a typed graph node —
  // reporting a gap while the graph carries the value would be a false absence.
  const graphKinds = new Set([...doc.hop1, ...doc.hop2].map((n) => n.kind));
  const GRAPH_EQUIV: Record<string, string> = { address: "address", employer: "employer", entity: "entity" };
  for (const k of ["address", "employer", "entity", "phone"]) {
    if (doc.identity[FIELD_LABEL[k]]?.length) continue;
    if (GRAPH_EQUIV[k] && graphKinds.has(GRAPH_EQUIV[k])) continue;
    const cand = doc.candidates?.[FIELD_LABEL[k]]?.length ?? 0;
    gaps.push(
      cand
        ? `No ${FIELD_LABEL[k].toLowerCase()} CONFIRMED to this subject; ${cand} candidate value(s) carried unverified — corroborate before use.`
        : `No ${FIELD_LABEL[k].toLowerCase()} resolved to this subject.`,
    );
  }
  if (!doc.hop1.length) gaps.push("No hop-1 associates surfaced — the subject has a thin public record.");
  if (!doc.hop2.length) gaps.push("Hop-2 expansion returned nothing; hop-3 cross-links are therefore n/a.");
  if (bundle.rejectedIdentityHits > 0) {
    gaps.push(`${bundle.rejectedIdentityHits} document(s) matched the name but failed identity scoring and were discarded.`);
  }
  return gaps;
}

function summarize(doc: MeshDossierDoc, rel: Correspondent | null): string {
  const bits: string[] = [];
  if (rel) {
    bits.push(
      `${rel.tier} correspondent · ${rel.received + rel.sent} messages · last contact ${rel.dormantDays}d ago`,
    );
  }
  const emp = doc.identity[FIELD_LABEL.employer]?.[0]?.value;
  const ent = doc.identity[FIELD_LABEL.entity]?.[0]?.value;
  const addr = doc.identity[FIELD_LABEL.address]?.[0]?.value;
  if (emp) bits.push(`Employment: ${emp}`);
  if (ent) bits.push(`Entity: ${ent}`);
  if (addr) bits.push(`Locus: ${addr}`);
  bits.push(`${doc.hop1.length} hop-1 · ${doc.hop2.length} hop-2 · ${doc.hop3.length} hop-3 cross-links`);
  return bits.join(" — ");
}

// ── Build ──────────────────────────────────────────────────────────────────

export interface BuildOptions {
  /** free-text jurisdiction hint, e.g. "Cape Coral Florida" */
  locationHint?: string;
  timeoutMs?: number;
  /**
   * Hard identifiers (E.164 phone, alternate address) belonging to the
   * subject. When the name sweep comes back thin, ONE of these is run as a
   * reverse lookup — a number resolves an identity that a common surname
   * cannot. Bounded to a single extra pass with its own wall-clock cap.
   */
  identifiers?: string[];
  /** Ceiling for the reverse pass. Defaults to 35s. */
  reverseBudgetMs?: number;
  /**
   * Organisational anchors bound to the subject — an employer name, or the
   * registrable domain of the organisation they work for. A person on a
   * corporate address gets their employer's public footprint for free because
   * the address itself names the org; a person on a consumer mailbox does not,
   * and that asymmetry is why freemail contacts read thin. These anchors
   * restore the organisational axis for those subjects.
   */
  orgAnchors?: string[];
  /** How this subject reached the user. Recorded on the dossier. */
  channel?: string;
}



export async function buildDossier(
  name: string,
  email: string | null,
  relationship: Correspondent | null,
  opts: BuildOptions = {},
): Promise<{ doc: MeshDossierDoc; summary: string; confidence: number }> {
  const hint = (opts.locationHint ?? "").trim();
  const intent = classifyIntent(`who is ${name}${hint ? ` who lives in ${hint}` : ""}`);
  intent.kind = "person";
  intent.subject = name;
  intent.needsClarification = false;

  const started = Date.now();
  const bundle = await runJurisdictionalSearch(intent);

  const identity: Record<string, DossierFact[]> = {};
  const candidates: Record<string, DossierFact[]> = {};
  const ledger = bundle.fieldLedger;
  if (ledger) {
    for (const [kind, fields] of Object.entries(ledger.confirmed)) {
      if (!fields?.length) continue;
      identity[FIELD_LABEL[kind] ?? kind] = fields.slice(0, 8).map(factOf);
    }
    // The candidate ledger is where every real subject's record actually lives
    // when the strong-match gate is strict. It is carried, not discarded, and
    // never allowed to shadow a confirmed value for the same field family.
    for (const [kind, fields] of Object.entries(ledger.candidate)) {
      if (!fields?.length) continue;
      const label = FIELD_LABEL[kind] ?? kind;
      const taken = new Set((identity[label] ?? []).map((f) => f.value.toLowerCase()));
      const rows = fields
        .filter((f) => !taken.has(String((f as { display?: string }).display ?? "").toLowerCase()))
        .slice(0, 8)
        .map(factOf);
      if (rows.length) candidates[label] = rows;
    }
  }


  const g = bundle.graph;
  const nodeById = new Map((g?.nodes ?? []).map((n) => [n.id, n]));
  // A locality scraped out of a "lives in" line is a place, not a relative.
  // Left unfiltered it becomes a hop-2 stub and then a phantom cross-link.
  const keep = (n: { kind: string; label: string }) => !(n.kind === "person" && isPlaceLike(n.label, intent));

  const hop1: DossierHopNode[] = (g?.nodes ?? [])
    .filter((n) => n.ring === 1 && keep(n))
    .slice(0, 24)
    .map((n) => ({
      label: n.label, kind: n.kind, confidence: n.confidence,
      independentDomains: n.independentDomains, sources: n.sources.slice(0, 3),
    }));

  const parentOf = new Map<string, string>();
  for (const e of g?.edges ?? []) {
    const to = nodeById.get(e.to);
    const from = nodeById.get(e.from);
    if (to?.ring !== 2 || !from || parentOf.has(to.id)) continue;
    // If the parent was itself discarded as a locality, attribute the child to
    // the subject rather than printing "via Cape Coral".
    parentOf.set(to.id, keep(from) ? from.label : name);
  }
  const hop2: DossierHopNode[] = (g?.nodes ?? [])
    .filter((n) => n.ring === 2 && keep(n))
    .slice(0, 24)
    .map((n) => ({
      label: n.label, kind: n.kind, confidence: n.confidence,
      independentDomains: n.independentDomains, via: parentOf.get(n.id),
      sources: n.sources.slice(0, 3),
    }));

  const seen = new Set<string>();
  const sources: MeshDossierDoc["sources"] = [];
  for (const [bucket, hits] of Object.entries(bundle.buckets) as Array<[DomainBucket, any[]]>) {
    for (const h of hits) {
      if (!h?.url || seen.has(h.url)) continue;
      if (h.identityBand === "rejected") continue;
      seen.add(h.url);
      sources.push({ domain: h.domain, url: h.url, title: (h.title ?? "").slice(0, 160), bucket });
    }
  }

  const doc: MeshDossierDoc = {
    version: 2,
    subject: { name, email, domainHint: email ? email.split("@")[1] ?? null : null },
    builtAt: new Date().toISOString(),
    identity,
    candidates,
    hop1,
    hop2,
    hop3: (g?.crossLinks ?? []).slice(0, 20),
    sources: sources.slice(0, 60),
    metrics: {
      documentsParsed: ledger?.documentsParsed ?? 0,
      totalHits: bundle.totalHits ?? 0,
      rejectedIdentityHits: bundle.rejectedIdentityHits ?? 0,
      queriesRun: bundle.queriesRun ?? 0,
      elapsedMs: bundle.elapsedMs ?? Date.now() - started,
      ring2Executed: bundle.ring2Executed ?? 0,
      authoritativeSources: sources.filter((s) => s.bucket === "authoritative" || s.bucket === "court" || s.bucket === "corporate").length,
      independentDomains: new Set(sources.map((s) => s.domain)).size,
    },
    gaps: [],
    // Imagery and kin ride the resolved identity clusters, so they inherit the
    // cluster's attribution. A cluster that lost the disambiguation contest
    // still ships its photo, labelled with its own name and score, rather than
    // being dropped or merged into the winner.
    imagery: (bundle.candidateSet?.candidates ?? [])
      .filter((c) => !!c.avatarUrl && /^https:\/\//i.test(String(c.avatarUrl)))
      .slice(0, 8)
      .map((c) => ({ url: String(c.avatarUrl), attributedTo: c.name, clusterScore: Math.round(c.score) })),
    kin: [...new Set(
      (bundle.candidateSet?.candidates ?? [])
        .flatMap((c) => c.family ?? [])
        .map((s) => String(s).trim())
        .filter((s) => s.length > 2 && s.length < 80),
    )].slice(0, 24),
    jurisdiction: bundle.jurisdictionLabel ?? "",
    channel: opts.channel ?? null,
    reverse: null,
  };

  // ── Reverse-identifier pass ───────────────────────────────────────────
  // A hard identifier outranks a name. It runs only when the name sweep left
  // the record thin, and only once, under its own clock, so a slow reverse
  // lookup can never eat the caller's per-subject budget.
  const ident = (opts.identifiers ?? []).map((s) => String(s).trim()).filter(Boolean);
  const thin =
    !identity[FIELD_LABEL.address]?.length ||
    !identity[FIELD_LABEL.employer]?.length ||
    hop1.length === 0;
  const spent = Date.now() - started;
  if (ident.length && thin && spent < 75_000) {
    const budget = Math.max(10_000, Math.min(opts.reverseBudgetMs ?? 35_000, 45_000));
    const id = ident[0];
    try {
      const rIntent = classifyIntent(`who owns the number ${id}${hint ? ` in ${hint}` : ""}`);
      rIntent.kind = "person";
      rIntent.subject = id;
      rIntent.needsClarification = false;
      const rev = await Promise.race([
        runJurisdictionalSearch(rIntent),
        new Promise<null>((res) => setTimeout(() => res(null), budget)),
      ]);
      if (rev) {
        let added = 0;
        for (const [kind, fields] of Object.entries(rev.fieldLedger?.confirmed ?? {})) {
          if (!fields?.length) continue;
          const label = FIELD_LABEL[kind] ?? kind;
          const bucket = (identity[label] ??= []);
          const have = new Set(bucket.map((f) => normKey(f.value)));
          for (const f of fields.slice(0, 6)) {
            const fact = factOf(f);
            if (have.has(normKey(fact.value))) continue;
            have.add(normKey(fact.value));
            bucket.push(fact);
            added++;
          }
        }
        const known = new Set(doc.sources.map((s) => s.url));
        for (const hits of Object.values(rev.buckets) as any[][]) {
          for (const h of hits ?? []) {
            if (!h?.url || known.has(h.url) || h.identityBand === "rejected") continue;
            known.add(h.url);
            doc.sources.push({ domain: h.domain, url: h.url, title: (h.title ?? "").slice(0, 160), bucket: h.bucket ?? "web" });
          }
        }
        doc.sources = doc.sources.slice(0, 90);
        doc.metrics.totalHits += rev.totalHits ?? 0;
        doc.metrics.queriesRun += rev.queriesRun ?? 0;
        doc.metrics.independentDomains = new Set(doc.sources.map((s) => s.domain)).size;
        doc.reverse = { identifier: id, factsAdded: added, hits: rev.totalHits ?? 0 };
      } else {
        doc.reverse = { identifier: id, factsAdded: 0, hits: 0, timedOut: true };
      }
    } catch (e) {
      // A failed reverse pass is a named absence, never a failed dossier.
      doc.reverse = { identifier: id, factsAdded: 0, hits: 0, error: (e as Error).message.slice(0, 120) };
    }
  }

  // ── Organisational pass ───────────────────────────────────────────────
  // A corporate address carries its own org query: the domain IS the employer,
  // so the name sweep incidentally collects the company's registry filings,
  // leadership pages and press. A consumer mailbox carries none of that, and
  // the resulting dossier reads thin for reasons that have nothing to do with
  // the subject's actual public footprint. One bounded extra pass on a bound
  // organisational anchor closes that asymmetry.
  const anchors = [...new Set(
    (opts.orgAnchors ?? []).map((s) => String(s).trim()).filter((s) => s.length >= 3 && s.length <= 80),
  )].slice(0, 2);
  const orgSpent = Date.now() - started;
  if (anchors.length && orgSpent < 95_000) {
    const anchor = anchors[0];
    const isDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(anchor);
    try {
      const oIntent = classifyIntent(
        isDomain
          ? `${anchor} company registration leadership staff ${name}`
          : `${name} at ${anchor} employer company profile`,
      );
      oIntent.kind = "person";
      oIntent.subject = name;
      oIntent.needsClarification = false;
      const org = await Promise.race([
        runJurisdictionalSearch(oIntent),
        new Promise<null>((res) => setTimeout(() => res(null), 30_000)),
      ]);
      if (org) {
        let added = 0;
        // Organisational collection corroborates the SUBJECT; it is never
        // allowed to overwrite a confirmed personal fact, only to extend the
        // record with values the name sweep never reached.
        for (const [kind, fields] of Object.entries(org.fieldLedger?.confirmed ?? {})) {
          if (!fields?.length) continue;
          const label = FIELD_LABEL[kind] ?? kind;
          const bucket = (identity[label] ??= []);
          const have = new Set(bucket.map((f) => normKey(f.value)));
          for (const f of fields.slice(0, 6)) {
            const fact = factOf(f);
            if (have.has(normKey(fact.value))) continue;
            have.add(normKey(fact.value));
            bucket.push(fact);
            added++;
          }
        }
        const known = new Set(doc.sources.map((s) => s.url));
        for (const hits of Object.values(org.buckets) as any[][]) {
          for (const h of hits ?? []) {
            if (!h?.url || known.has(h.url) || h.identityBand === "rejected") continue;
            known.add(h.url);
            doc.sources.push({ domain: h.domain, url: h.url, title: (h.title ?? "").slice(0, 160), bucket: h.bucket ?? "web" });
          }
        }
        doc.sources = doc.sources.slice(0, 120);
        doc.metrics.totalHits += org.totalHits ?? 0;
        doc.metrics.queriesRun += org.queriesRun ?? 0;
        doc.metrics.independentDomains = new Set(doc.sources.map((s) => s.domain)).size;
        doc.org = { anchor, kind: isDomain ? "domain" : "name", factsAdded: added, hits: org.totalHits ?? 0 };
      } else {
        doc.org = { anchor, kind: isDomain ? "domain" : "name", factsAdded: 0, hits: 0, timedOut: true };
      }
    } catch (e) {
      doc.org = { anchor, kind: isDomain ? "domain" : "name", factsAdded: 0, hits: 0, error: (e as Error).message.slice(0, 120) };
    }
  }

  doc.gaps = findGaps(doc, bundle);
  if (ident.length && !doc.reverse) {
    doc.gaps.push(`Reverse lookup on ${ident[0]} skipped — the name sweep already resolved the record.`);
  }
  if (!anchors.length) {
    doc.gaps.push("No organisational anchor was bound to this subject — employer footprint was not collectable from the address alone.");
  }


  return { doc, summary: summarize(doc, relationship), confidence: scoreConfidence(doc) };
}


// ── Hop-3: cross-links across separate hop-1 dossiers ──────────────────────

export interface VaultCrossLink {
  label: string;
  kind: string;
  viaA: string;
  viaB: string;
  extraVia: string[];
  strength: number;
}

/**
 * The rule of three, applied across the vault rather than inside one sweep:
 * a hop-2 node reachable from two DIFFERENT hop-1 subjects is a closed
 * triangle in your own network — the highest-value discovery the mesh makes,
 * because neither subject told you about it.
 */
export function foldCrossLinks(
  dossiers: Array<{ subject_name: string; dossier: MeshDossierDoc | null }>,
): VaultCrossLink[] {
  const reach = new Map<string, { kind: string; via: Set<string>; strength: number }>();
  for (const d of dossiers) {
    const doc = d.dossier;
    if (!doc?.hop2) continue;
    const own = normKey(d.subject_name);
    for (const n of [...(doc.hop2 ?? []), ...(doc.hop1 ?? [])]) {
      const key = normKey(n.label);
      if (!key || key === own) continue;
      const rec = reach.get(key) ?? { kind: n.kind, via: new Set<string>(), strength: 0 };
      rec.via.add(d.subject_name);
      rec.strength += Math.max(1, n.independentDomains);
      reach.set(key, rec);
    }
  }

  const out: VaultCrossLink[] = [];
  for (const [key, rec] of reach) {
    if (rec.via.size < 2) continue;
    const via = [...rec.via];
    out.push({
      label: key,
      kind: rec.kind,
      viaA: via[0],
      viaB: via[1],
      extraVia: via.slice(2),
      strength: rec.strength + (via.length - 2) * 3,
    });
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 40);
}

// ── utils ──────────────────────────────────────────────────────────────────

/**
 * Locality detector. Background-check pages print "Lives in Cape Coral, FL"
 * inside the relatives block, so the extractor can promote a city into the
 * relative field — and a phantom relative becomes a phantom cross-link.
 *
 * Three signals, deliberately narrow so real surnames survive: the label IS
 * the jurisdiction this sweep resolved; the first token is a geographic
 * prefix ("Cape", "Fort", "North"); or the last token is a settlement suffix
 * that is not also a common surname (PARK, HILL, WOOD are excluded for that
 * exact reason).
 */
const PLACE_PREFIX =
  /^(north|south|east|west|new|old|port|cape|fort|ft|saint|st|lake|palm|coral|mount|mt|san|santa|los|las|el|big|little|upper|lower)$/i;
const PLACE_SUFFIX =
  /^(acres?|springs?|beach|heights|shores?|falls|lakes|estates?|gardens?|meadows?|pointe|crossing|landing|junction|village|city|county|isles?|highlands?|plains?|mesa|vista|hollow|terrace|summit|bluff|harbou?r|township|borough)$/i;

export function isPlaceLike(
  label: string,
  intent?: { city?: string; county?: string; state?: string },
): boolean {
  const key = normKey(label);
  if (!key) return true;
  for (const j of [intent?.city, intent?.county, intent?.state]) {
    if (j && normKey(j) && normKey(j) === key) return true;
  }
  const tokens = key.split(" ").filter(Boolean);
  if (!tokens.length || tokens.length > 3) return false;
  if (tokens.length === 1) return PLACE_PREFIX.test(tokens[0]) || PLACE_SUFFIX.test(tokens[0]);
  return PLACE_PREFIX.test(tokens[0]) || PLACE_SUFFIX.test(tokens[tokens.length - 1]);
}

export function normKey(s: string): string {
  return (s ?? "").toUpperCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

function round(n: number, d: number): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}
