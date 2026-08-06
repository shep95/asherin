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
  identity: Record<string, DossierFact[]>;
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
  for (const k of ["address", "employer", "entity", "phone"]) {
    if (!doc.identity[FIELD_LABEL[k]]?.length) gaps.push(`No ${FIELD_LABEL[k].toLowerCase()} resolved to this subject.`);
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
  const ledger = bundle.fieldLedger;
  if (ledger) {
    for (const [kind, fields] of Object.entries(ledger.confirmed)) {
      if (!fields?.length) continue;
      identity[FIELD_LABEL[kind] ?? kind] = fields.slice(0, 8).map(factOf);
    }
  }

  const g = bundle.graph;
  const nodeById = new Map((g?.nodes ?? []).map((n) => [n.id, n]));
  const hop1: DossierHopNode[] = (g?.nodes ?? [])
    .filter((n) => n.ring === 1)
    .slice(0, 24)
    .map((n) => ({
      label: n.label, kind: n.kind, confidence: n.confidence,
      independentDomains: n.independentDomains, sources: n.sources.slice(0, 3),
    }));

  const parentOf = new Map<string, string>();
  for (const e of g?.edges ?? []) {
    const to = nodeById.get(e.to);
    const from = nodeById.get(e.from);
    if (to?.ring === 2 && from && !parentOf.has(to.id)) parentOf.set(to.id, from.label);
  }
  const hop2: DossierHopNode[] = (g?.nodes ?? [])
    .filter((n) => n.ring === 2)
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
    jurisdiction: bundle.jurisdictionLabel ?? "",
  };
  doc.gaps = findGaps(doc, bundle);

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

export function normKey(s: string): string {
  return (s ?? "").toUpperCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

function round(n: number, d: number): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}
