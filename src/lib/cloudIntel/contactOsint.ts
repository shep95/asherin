// ═══════════════════════════════════════════════════════════════════════════
// CONTACT OSINT ANNEX — external collection layer for the contact report
//
// The contact report's first generation was a closed system: it read Gmail
// metadata and the address book and nothing else. That is *communications
// analysis*, not intelligence. It could describe how a subject writes to you
// and when — but not who they are, what is publicly on record about them, or
// who else they are attached to. When someone new emails you, that is exactly
// the question that matters.
//
// This module attaches the open-source leg. It calls the Vault's dossier
// engine (mesh-vault → jurisdictional substrate → Zophiel web collection),
// which resolves identity fields against public records, press, registries and
// the open web, and returns every value with the URLs that assert it.
//
// TRADECRAFT RULES ENFORCED HERE (the reason this is a module and not a fetch):
//
//  · ICD 206 — SOURCING. Every source carries an Admiralty reliability grade
//    (A–F, derived from the class of the publisher) and every fact carries an
//    information-credibility grade (1–6, derived from how many INDEPENDENT
//    domains assert it). A single-source fact can never grade above 3.
//  · ICD 203 — ANALYTIC STANDARDS. Judgments use the standard likelihood
//    lexicon, state their confidence separately from their likelihood, and
//    name the evidence they rest on. Confidence describes the evidence; the
//    likelihood word describes the event. They are never conflated.
//  · ABSENCE IS REPORTED. A gap is a collection requirement, not an empty
//    field. Nothing is inferred to fill a hole.
//  · NO MODEL SPECULATION. Every value here is a pure transform of what the
//    collection returned. This module never invents, extrapolates or rounds a
//    fact into existence.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────── wire shapes ───────────────────────────

interface WireFact {
  value: string;
  confidence: string;
  independentDomains: number;
  authoritative: boolean;
  sources: Array<{ domain: string; url: string }>;
}

interface WireNode {
  label: string;
  kind: string;
  confidence: string;
  independentDomains: number;
  via?: string;
  sources: Array<{ domain: string; url: string }>;
}

interface WireDoc {
  subject?: { name?: string; email?: string | null; domainHint?: string | null };
  builtAt?: string;
  identity?: Record<string, WireFact[]>;
  candidates?: Record<string, WireFact[]>;
  hop1?: WireNode[];
  hop2?: WireNode[];
  hop3?: Array<{ node: string; viaA: string; viaB: string; strength: number }>;
  sources?: Array<{ domain: string; url: string; title: string; bucket: string }>;
  metrics?: Record<string, number>;
  gaps?: string[];
  jurisdiction?: string;
  channel?: string | null;
  reverse?: { identifier: string; factsAdded: number; hits: number; timedOut?: boolean; error?: string } | null;
}

// ─────────────────────────── annex shapes ───────────────────────────

/** Admiralty source reliability. F is reserved for demonstrably hostile hosts. */
export type Reliability = "A" | "B" | "C" | "D" | "E" | "F";
/** Admiralty information credibility. 6 = cannot be judged. */
export type Credibility = 1 | 2 | 3 | 4 | 5 | 6;

export interface OsintSource {
  domain: string;
  url: string;
  title: string;
  bucket: string;
  reliability: Reliability;
  reliabilityNote: string;
}

export interface OsintFact {
  field: string;
  value: string;
  /**
   * `confirmed` — the subject was positively matched inside the source
   * document. `candidate` — the document names the subject but did not clear
   * strong identity matching, so the value is reported and never relied on.
   */
  band: "confirmed" | "candidate";
  credibility: Credibility;
  credibilityNote: string;
  independentDomains: number;
  authoritative: boolean;
  sources: Array<{ domain: string; url: string }>;
}


export interface OsintAssociation {
  label: string;
  kind: string;
  hop: 1 | 2 | 3;
  via: string | null;
  independentDomains: number;
  sources: Array<{ domain: string; url: string }>;
}

export interface KeyJudgment {
  /** Standard ICD 203 likelihood expression. */
  likelihood:
    | "almost certainly"
    | "very likely"
    | "likely"
    | "roughly even chance"
    | "unlikely"
    | "very unlikely"
    | "almost certainly not";
  /** Analytic confidence in the evidence base — separate from likelihood. */
  confidence: "High" | "Moderate" | "Low";
  text: string;
  basis: string;
}

export type OsintStatus = "ready" | "building" | "queued" | "failed" | "absent" | "error" | "unauthenticated";

export interface OsintAnnex {
  status: OsintStatus;
  /** Why the annex is not `ready`. Null exactly when it is. */
  blocker: string | null;
  subjectName: string;
  subjectEmail: string | null;
  builtAt: number | null;
  jurisdiction: string;
  /** 0-100 evidence-density score computed server-side. */
  collectionConfidence: number;
  facts: OsintFact[];
  associations: OsintAssociation[];
  crossLinks: Array<{ node: string; viaA: string; viaB: string; strength: number }>;
  sources: OsintSource[];
  metrics: {
    documentsParsed: number;
    totalHits: number;
    queriesRun: number;
    independentDomains: number;
    authoritativeSources: number;
    rejectedIdentityHits: number;
    elapsedMs: number;
  };
  keyJudgments: KeyJudgment[];
  gaps: string[];
  reverse: WireDoc["reverse"];
  /**
   * Where the contact's hard identifiers are confirmed to appear. The vault
   * dossier answers "who is this"; the sweep answers "where is this address or
   * number actually carried, and since when" — a different question, and the
   * one that exposes paste-site and breach-index circulation.
   */
  identifierSweeps: IdentifierSweepSummary[];
}

/** A per-identifier exposure register, folded down for report rendering. */
export interface IdentifierSweepSummary {
  identifier: string;
  kind: string;
  surfaces: number;
  confirmed: number;
  firstSeen: string | null;
  lastSeen: string | null;
  /** Paste sites and breach indexes — the surfaces that mean circulation. */
  exposed: Array<{ host: string; surfaceClass: string; lastSeen: string | null }>;
  top: Array<{ host: string; surfaceClass: string; sightings: number; lastSeen: string | null }>;
  /** Null when the leg ran clean; otherwise why it is thin. */
  blocker: string | null;
}

// ───────────────────── Admiralty grading (ICD 206) ─────────────────────

const HOSTILE = /^(infowars|naturalnews|beforeitsnews|globalresearch|zerohedge)\./i;

const TIER_A =
  /(^|\.)(sec\.gov|courtlistener\.com|pacer\.gov|uspto\.gov|patents\.google\.com|opencorporates\.com|companieshouse\.gov\.uk)$/i;

const TIER_B_PRESS =
  /(^|\.)(reuters|apnews|bbc|nytimes|washingtonpost|wsj|ft|bloomberg|theguardian|economist|npr|propublica|politico|cnbc)\.(com|org|co\.uk)$/i;

const TIER_D_SOCIAL =
  /(^|\.)(facebook|instagram|tiktok|x|twitter|reddit|quora|pinterest|threads|vk)\.com$/i;

/**
 * Grade the PUBLISHER, never the claim. Reliability is a property of who is
 * speaking; credibility (below) is a property of how many independent voices
 * say the same thing. Collapsing the two is the classic sourcing error.
 */
export function gradeReliability(domain: string): { grade: Reliability; note: string } {
  const d = (domain || "").replace(/^www\./i, "").toLowerCase();
  if (!d) return { grade: "F", note: "no publisher recorded — treat as unusable." };
  if (HOSTILE.test(`${d}.`)) return { grade: "F", note: "publisher on the manipulation watchlist." };
  if (/\.onion$/i.test(d)) return { grade: "E", note: "hidden-service host; provenance unverifiable." };
  if (TIER_A.test(d) || /(^|\.)gov$/i.test(d) || /\.gov(\.[a-z]{2})?$/i.test(d) || /\.mil$/i.test(d)) {
    return { grade: "A", note: "official registry or court of record." };
  }
  if (/\.(edu|ac\.[a-z]{2})$/i.test(d)) return { grade: "B", note: "academic institution of record." };
  if (TIER_B_PRESS.test(d)) return { grade: "B", note: "established newsroom with a corrections process." };
  if (TIER_D_SOCIAL.test(d)) return { grade: "D", note: "self-published platform; subject-controlled content." };
  if (/(^|\.)(linkedin|crunchbase|bloomberg|zoominfo|apollo)\.(com|io)$/i.test(d)) {
    return { grade: "C", note: "commercial aggregator; partially subject-supplied." };
  }
  return { grade: "C", note: "general web publisher; no editorial record established." };
}

/**
 * Credibility is corroboration, full stop. One domain can never exceed 3 no
 * matter how authoritative it is — an uncorroborated official record is still
 * an uncorroborated record.
 */
export function gradeCredibility(independentDomains: number, authoritative: boolean): { grade: Credibility; note: string } {
  if (independentDomains >= 4) return { grade: 1, note: `confirmed by ${independentDomains} independent domains.` };
  if (independentDomains === 3) return { grade: 2, note: "corroborated by three independent domains." };
  if (independentDomains === 2) {
    return { grade: authoritative ? 2 : 3, note: "corroborated by two independent domains." };
  }
  if (independentDomains === 1) {
    return {
      grade: authoritative ? 3 : 4,
      note: authoritative
        ? "single authoritative source; uncorroborated."
        : "single non-authoritative source; uncorroborated.",
    };
  }
  return { grade: 6, note: "no independent domain count recorded — credibility cannot be judged." };
}

// ───────────────────── judgment synthesis (ICD 203) ─────────────────────

const LIKELIHOOD_BY_CREDIBILITY: Record<Credibility, KeyJudgment["likelihood"]> = {
  1: "almost certainly",
  2: "very likely",
  3: "likely",
  4: "roughly even chance",
  5: "unlikely",
  6: "roughly even chance",
};

function confidenceFor(best: Credibility, corroborating: number): KeyJudgment["confidence"] {
  if (best <= 2 && corroborating >= 2) return "High";
  if (best <= 3) return "Moderate";
  return "Low";
}

/**
 * Judgments are derived, not written. Each one names the field family it came
 * from, the grade of its best evidence, and how many independent domains stand
 * behind it — so a reader can reject the judgment without rejecting the report.
 */
function synthesizeJudgments(facts: OsintFact[], assoc: OsintAssociation[], metrics: OsintAnnex["metrics"]): KeyJudgment[] {
  const out: KeyJudgment[] = [];
  const byField = new Map<string, OsintFact[]>();
  // Judgments rest on confirmed matches only. Candidate values are reported in
  // the body of the annex but are never allowed to carry a judgment.
  for (const f of facts.filter((x) => x.band === "confirmed")) {
    const arr = byField.get(f.field) ?? [];
    arr.push(f);
    byField.set(f.field, arr);
  }
  const candidateCount = facts.filter((x) => x.band === "candidate").length;
  if (candidateCount) {
    out.push({
      likelihood: "roughly even chance",
      confidence: "Low",
      text: `${candidateCount} identity value${candidateCount === 1 ? "" : "s"} extracted from documents naming the subject did not clear strong identity matching and are carried as candidates only.`,
      basis: "Possible-band extraction; name present in source but insufficient corroborating identifiers to bind the value to this subject.",
    });
  }


  for (const [field, group] of byField) {
    const best = group.reduce((a, b) => (b.credibility < a.credibility ? b : a));
    const corroborated = group.filter((g) => g.independentDomains >= 2).length;
    out.push({
      likelihood: LIKELIHOOD_BY_CREDIBILITY[best.credibility],
      confidence: confidenceFor(best.credibility, corroborated),
      text: `${field} of record for the subject ${group.length > 1 ? `includes ${group.length} distinct values, best supported being` : "resolves to"} "${best.value}".`,
      basis: `${best.independentDomains} independent domain${best.independentDomains === 1 ? "" : "s"}; Admiralty ${best.credibility}; ${best.authoritative ? "authoritative registry in the set" : "no authoritative registry in the set"}.`,
    });
  }

  const hop1 = assoc.filter((a) => a.hop === 1).length;
  if (hop1) {
    const corroborated = assoc.filter((a) => a.hop === 1 && a.independentDomains >= 2).length;
    out.push({
      likelihood: corroborated >= 2 ? "very likely" : "likely",
      confidence: corroborated >= 2 ? "Moderate" : "Low",
      text: `The subject is publicly associated with ${hop1} first-ring entit${hop1 === 1 ? "y" : "ies"}, of which ${corroborated} ${corroborated === 1 ? "is" : "are"} multi-source.`,
      basis: "Association ring built from co-occurrence in collected documents; single-source links are not treated as confirmed relationships.",
    });
  }

  if (metrics.totalHits > 0 && facts.length === 0) {
    out.push({
      likelihood: "roughly even chance",
      confidence: "Low",
      text: "Collection returned documents but none survived identity matching — the subject is either low-footprint or shares a common name with a higher-footprint individual.",
      basis: `${metrics.totalHits} hits collected, ${metrics.rejectedIdentityHits} rejected at the identity gate.`,
    });
  }

  if (metrics.totalHits === 0) {
    out.push({
      likelihood: "likely",
      confidence: "Low",
      text: "The subject has no resolvable open-source footprint under the identifiers supplied.",
      basis: "Zero documents returned across the query plan. Absence of collection is not evidence of absence of record.",
    });
  }

  return out.slice(0, 12);
}

// ───────────────────────────── transform ─────────────────────────────

function toAnnex(
  doc: WireDoc,
  meta: { status: OsintStatus; blocker: string | null; confidence: number; name: string; email: string | null },
): OsintAnnex {
  const facts: OsintFact[] = [];
  const ingest = (src: Record<string, WireFact[]> | undefined, band: OsintFact["band"]) => {
    for (const [field, list] of Object.entries(src ?? {})) {
      for (const f of list ?? []) {
        const { grade, note } = gradeCredibility(f.independentDomains ?? 0, Boolean(f.authoritative));
        // A candidate can never grade better than "possibly true": corroboration
        // across domains raises how often a claim is repeated, not whether the
        // claim is about this person.
        const credibility: Credibility = band === "candidate" ? (Math.max(grade, 3) as Credibility) : grade;
        facts.push({
          field,
          value: f.value,
          band,
          credibility,
          credibilityNote:
            band === "candidate"
              ? `${note} Identity match is POSSIBLE, not strong — corroborate before acting.`
              : note,
          independentDomains: f.independentDomains ?? 0,
          authoritative: Boolean(f.authoritative),
          sources: (f.sources ?? []).slice(0, 4),
        });
      }
    }
  };
  ingest(doc.identity, "confirmed");
  ingest(doc.candidates, "candidate");
  // Confirmed always outranks candidate regardless of grade — band is the
  // primary sort key so the reader never meets an unverified value first.
  facts.sort((a, b) =>
    (a.band === b.band ? 0 : a.band === "confirmed" ? -1 : 1) ||
    a.credibility - b.credibility ||
    b.independentDomains - a.independentDomains);


  const associations: OsintAssociation[] = [
    ...(doc.hop1 ?? []).map((n) => ({ ...n, hop: 1 as const })),
    ...(doc.hop2 ?? []).map((n) => ({ ...n, hop: 2 as const })),
  ].map((n) => ({
    label: n.label,
    kind: n.kind,
    hop: n.hop,
    via: n.via ?? null,
    independentDomains: n.independentDomains ?? 0,
    sources: (n.sources ?? []).slice(0, 3),
  }));

  const sources: OsintSource[] = (doc.sources ?? []).slice(0, 60).map((s) => {
    const { grade, note } = gradeReliability(s.domain);
    return { ...s, reliability: grade, reliabilityNote: note };
  });

  const m = doc.metrics ?? {};
  const metrics: OsintAnnex["metrics"] = {
    documentsParsed: Number(m.documentsParsed ?? 0),
    totalHits: Number(m.totalHits ?? 0),
    queriesRun: Number(m.queriesRun ?? 0),
    independentDomains: Number(m.independentDomains ?? 0),
    authoritativeSources: Number(m.authoritativeSources ?? 0),
    rejectedIdentityHits: Number(m.rejectedIdentityHits ?? 0),
    elapsedMs: Number(m.elapsedMs ?? 0),
  };

  const builtAtMs = doc.builtAt ? Date.parse(doc.builtAt) : NaN;

  return {
    status: meta.status,
    blocker: meta.blocker,
    subjectName: doc.subject?.name || meta.name,
    subjectEmail: doc.subject?.email ?? meta.email,
    builtAt: Number.isFinite(builtAtMs) ? builtAtMs : null,
    jurisdiction: doc.jurisdiction || "not determined",
    collectionConfidence: Math.max(0, Math.min(100, Math.round(meta.confidence))),
    facts,
    associations,
    crossLinks: doc.hop3 ?? [],
    sources,
    metrics,
    keyJudgments: synthesizeJudgments(facts, associations, metrics),
    gaps: doc.gaps ?? [],
    reverse: doc.reverse ?? null,
  };
}

/** An annex that reports its own failure rather than being silently omitted. */
export function emptyAnnex(status: OsintStatus, blocker: string, name: string, email: string | null): OsintAnnex {
  return {
    status,
    blocker,
    subjectName: name,
    subjectEmail: email,
    builtAt: null,
    jurisdiction: "not determined",
    collectionConfidence: 0,
    facts: [],
    associations: [],
    crossLinks: [],
    sources: [],
    metrics: {
      documentsParsed: 0, totalHits: 0, queriesRun: 0, independentDomains: 0,
      authoritativeSources: 0, rejectedIdentityHits: 0, elapsedMs: 0,
    },
    keyJudgments: [],
    gaps: [],
    reverse: null,
    identifierSweeps: [],
  };
}

// ───────────────────────────── collection ─────────────────────────────

export interface OsintRequest {
  name: string;
  email: string | null;
  /** Extra hard identifiers (phones, alternate addresses) to seed reverse lookup. */
  identifiers?: string[];
  locationHint?: string | null;
  /** Force a fresh sweep even when a cached dossier is inside its half-life. */
  force?: boolean;
  signal?: AbortSignal;
}

/**
 * Run (or reuse) the open-source sweep for one contact.
 *
 * Never throws. A collection failure is intelligence about the collection, so
 * it is returned as an annex with a stated blocker rather than as an exception
 * that would delete the annex from the report entirely.
 */
export async function collectContactOsint(req: OsintRequest): Promise<OsintAnnex> {
  const name = (req.name || "").trim();
  const email = (req.email || "").trim().toLowerCase() || null;
  if (!name && !email) {
    return emptyAnnex("absent", "No name or address on the contact record to collect against.", name, email);
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      return emptyAnnex("unauthenticated", "Not signed in — the open-source leg requires an authenticated session.", name, email);
    }

    const { data, error } = await supabase.functions.invoke("mesh-vault", {
      body: {
        action: "vault_for_contact",
        name,
        email,
        identifiers: (req.identifiers ?? []).slice(0, 4),
        location_hint: req.locationHint ?? null,
        force: req.force === true,
      },
    });

    if (error) {
      // functions.invoke collapses every non-2xx into one opaque message; the
      // real reason is in the response body, so it is read out explicitly.
      let detail = error.message ?? "unknown error";
      const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
      if (ctx?.text) {
        try { detail = (await ctx.text()).slice(0, 300) || detail; } catch { /* body already consumed */ }
      }
      return emptyAnnex("error", `Collection call failed: ${detail}`, name, email);
    }

    const payload = data as { status?: string; dossier?: WireDoc | null; confidence?: number; message?: string } | null;
    if (!payload?.dossier) {
      return emptyAnnex(
        (payload?.status as OsintStatus) || "absent",
        payload?.message || "No dossier was produced for this subject.",
        name,
        email,
      );
    }

    return toAnnex(payload.dossier, {
      status: "ready",
      blocker: null,
      confidence: Number(payload.confidence ?? 0),
      name,
      email,
    });
  } catch (e) {
    return emptyAnnex("error", `Collection aborted: ${(e as Error).message.slice(0, 200)}`, name, email);
  }
}
