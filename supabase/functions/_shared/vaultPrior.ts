// ═══════════════════════════════════════════════════════════════════════════
// VAULT PRIOR — Mesh dossiers as first-class evidence for Zophiel and Nomad
//
// THE PROBLEM THIS SOLVES
//
// Cloud Intelligence builds a graded, provenance-carrying dossier on every
// human who has ever corresponded with the operator. Zophiel and Nomad, asked
// about that same human ten minutes later, started from a blank index — no
// known email, no known employer, no known association ring — and spent their
// whole budget re-deriving facts that were already sitting in the vault at
// STRONG band with named sources.
//
// Worse than the wasted budget: the two answers could disagree, and nothing in
// either output told the operator that a prior existed. Two confident,
// contradictory reports on the same person is not two data points. It is a
// broken instrument.
//
// WHAT THIS MODULE DOES
//
// It resolves a selector (email, phone, or name) against the operator's own
// vault and returns a compact prior: known identity fields with their bands,
// the association ring, source domains already read, and — the part that
// actually changes search quality — a set of ANCHORS the caller should fold
// into its query plan.
//
// DOCTRINE
//   · A prior is a hypothesis, never a conclusion. STRONG-band vault facts
//     enter as corroboration targets; POSSIBLE-band facts enter only as query
//     anchors and are never restated as findings.
//   · The prior is always disclosed. A report that used a prior says so, with
//     the dossier's build date, so the operator can see the age of the belief.
//   · Confidence decays with age. A dossier built 40 days ago is a lead, not a
//     fact — the half-life below is the same 14 days the vault itself uses.
//   · Never cross tenants. Every read is scoped to the calling user_id, and
//     the caller must pass a user-scoped client.
// ═══════════════════════════════════════════════════════════════════════════

export interface VaultPriorFact {
  field: string;
  value: string;
  /** STRONG = subject positively matched in the source document. */
  band: "strong" | "possible";
  sources: string[];
}

export interface VaultPrior {
  found: boolean;
  /** Vault row id, so the consumer can deep-link back to the dossier. */
  dossierId: string | null;
  subjectName: string | null;
  subjectEmail: string | null;
  /** ISO timestamp of the dossier build. Null when never built. */
  builtAt: string | null;
  ageDays: number | null;
  /** Vault-stated confidence (0–100) after age decay is applied. */
  confidence: number;
  /** Confidence before decay — kept so the decay is auditable, not invisible. */
  confidenceRaw: number;
  facts: VaultPriorFact[];
  /** Hop-1 association ring: people the vault already ties to the subject. */
  associates: string[];
  /** Claimed blood/marriage ties. Carried apart from associates deliberately. */
  kin: string[];
  /** Domains the vault already read. A fresh search that only returns these has added nothing. */
  knownDomains: string[];
  /** Query anchors the consumer should fold into its plan. */
  anchors: string[];
  /** Stated gaps from the dossier — what the vault itself could not establish. */
  gaps: string[];
  /** One-paragraph disclosure line, rendered verbatim in the consuming report. */
  disclosure: string;
  /** Set when a prior exists but is too old or too weak to steer a search. */
  stale: boolean;
}

const EMPTY: VaultPrior = {
  found: false, dossierId: null, subjectName: null, subjectEmail: null,
  builtAt: null, ageDays: null, confidence: 0, confidenceRaw: 0,
  facts: [], associates: [], kin: [], knownDomains: [], anchors: [], gaps: [],
  disclosure: "No prior dossier existed for this subject in the operator's vault; this report is derived from a cold start.",
  stale: false,
};

/** Same half-life the vault applies to its own freshness banner. */
const HALF_LIFE_DAYS = 14;
/** Beyond this, a prior may still be disclosed but must not steer the plan. */
const STALE_AFTER_DAYS = 45;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Digits only, last 10 — enough to match a number across formatting conventions. */
function phoneKey(raw: string): string {
  const d = String(raw ?? "").replace(/\D+/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

/**
 * Age-decayed confidence.
 *
 * Exponential with a 14-day half-life, floored at 5 so a very old dossier
 * still registers as "something was once known" rather than vanishing into a
 * zero that reads identically to never-searched.
 */
function decay(raw: number, ageDays: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (!Number.isFinite(ageDays) || ageDays <= 0) return Math.round(raw);
  return Math.max(5, Math.round(raw * Math.pow(0.5, ageDays / HALF_LIFE_DAYS)));
}

type AnySb = {
  from: (t: string) => any;
};

/**
 * Resolve a selector against the operator's mesh vault.
 *
 * `sb` MUST be a client bound to the calling user (anon key + the caller's
 * Authorization header). This function does not and must not accept a
 * service-role client: a prior leaking across tenants would be an IDOR with
 * a research-grade payload.
 */
export async function resolveVaultPrior(
  sb: AnySb,
  userId: string,
  selector: string,
): Promise<VaultPrior> {
  const raw = String(selector ?? "").trim();
  if (!userId || raw.length < 3) return { ...EMPTY };

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  const isPhone = !isEmail && phoneKey(raw).length >= 10;

  try {
    // Ready dossiers only. A queued or failed row carries no evidence, and
    // treating "we meant to look" as a prior is exactly the kind of phantom
    // corroboration this module exists to prevent.
    const { data, error } = await sb
      .from("mesh_dossiers")
      .select("id, subject_name, subject_email, confidence, built_at, dossier, relationship, channel")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("confidence", { ascending: false })
      .limit(400);

    if (error || !Array.isArray(data) || !data.length) return { ...EMPTY };

    const target = norm(raw);
    const targetPhone = isPhone ? phoneKey(raw) : "";

    let row: any = null;

    if (isEmail) {
      row = data.find((r: any) => norm(r.subject_email) === target) ?? null;
    }

    if (!row && isPhone) {
      // Phones live inside the dossier body, not in a column. Scan the STRONG
      // band only — a possible-band phone is not identification.
      row = data.find((r: any) => {
        const ident = r?.dossier?.identity ?? {};
        return Object.entries(ident).some(([field, facts]: [string, any]) =>
          /phone|tel|mobile/i.test(field) &&
          Array.isArray(facts) &&
          facts.some((f: any) => phoneKey(f?.value) === targetPhone));
      }) ?? null;
    }

    if (!row && !isEmail && !isPhone) {
      // Name match. Exact-normalised first; a token-subset fallback catches
      // "Robert J. Vance" vs "Robert Vance" without matching every Robert.
      row = data.find((r: any) => norm(r.subject_name) === target) ?? null;
      if (!row) {
        const want = new Set(target.split(/\s+/).filter((t) => t.length > 2));
        if (want.size >= 2) {
          row = data.find((r: any) => {
            const have = new Set(norm(r.subject_name).split(/\s+/).filter(Boolean));
            let overlap = 0;
            for (const t of want) if (have.has(t)) overlap++;
            return overlap === want.size;
          }) ?? null;
        }
      }
    }

    if (!row) return { ...EMPTY };

    const doc = row.dossier ?? {};
    const builtAt: string | null = row.built_at ?? doc.builtAt ?? null;
    const ageDays = builtAt
      ? Math.max(0, Math.round((Date.now() - new Date(builtAt).getTime()) / 86_400_000))
      : null;

    const confidenceRaw = Number(row.confidence ?? 0) || 0;
    const confidence = decay(confidenceRaw, ageDays ?? 0);
    const stale = (ageDays ?? 0) > STALE_AFTER_DAYS || confidence < 15;

    const facts: VaultPriorFact[] = [];
    const pushFacts = (bag: Record<string, any[]>, band: "strong" | "possible") => {
      for (const [field, list] of Object.entries(bag ?? {})) {
        if (!Array.isArray(list)) continue;
        for (const f of list.slice(0, 4)) {
          const value = String(f?.value ?? "").trim();
          if (!value) continue;
          facts.push({
            field,
            value: value.slice(0, 200),
            band,
            sources: Array.isArray(f?.sources)
              ? f.sources.slice(0, 4).map((s: any) => String(s?.domain ?? s ?? "")).filter(Boolean)
              : [],
          });
        }
      }
    };
    pushFacts(doc.identity ?? {}, "strong");
    pushFacts(doc.candidates ?? {}, "possible");

    const associates: string[] = Array.isArray(doc.hop1)
      ? doc.hop1.map((n: any) => String(n?.name ?? n?.node ?? "")).filter(Boolean).slice(0, 25)
      : [];
    const kin: string[] = Array.isArray(doc.kin) ? doc.kin.slice(0, 15).map(String) : [];
    const knownDomains: string[] = Array.isArray(doc.sources)
      ? [...new Set(doc.sources.map((s: any) => String(s?.domain ?? "")).filter(Boolean))].slice(0, 60)
      : [];
    const gaps: string[] = Array.isArray(doc.gaps) ? doc.gaps.slice(0, 10).map(String) : [];

    // ── Anchors ────────────────────────────────────────────────────────────
    // The single highest-value output. An anchor is a term that, paired with
    // the subject's name, collapses the same-name ambiguity that wastes most
    // of a cold search: an employer, a city, a domain, a licence number.
    const anchorFields = /employer|company|organi[sz]ation|org|title|role|city|state|county|address|domain|licen[cs]e|registration|school|university/i;
    const anchors = [...new Set(
      facts
        .filter((f) => anchorFields.test(f.field))
        .map((f) => f.value)
        .concat(row.subject_email ? [String(row.subject_email).split("@")[1] ?? ""] : []),
    )].filter((a) => a && a.length > 2 && a.length < 60).slice(0, 12);

    const strongCount = facts.filter((f) => f.band === "strong").length;

    const disclosure = stale
      ? `A prior dossier on this subject exists in the operator's vault (built ${builtAt?.slice(0, 10) ?? "unknown"}, ` +
        `${ageDays} days old, decayed confidence ${confidence}/100). It is DISCLOSED but NOT used to steer this search — ` +
        `at that age its anchors are as likely to entrench a stale belief as to sharpen the query.`
      : `This report started from a prior: a vault dossier on ${row.subject_name || raw} built ${builtAt?.slice(0, 10) ?? "unknown"} ` +
        `(${ageDays ?? 0} days old, confidence ${confidenceRaw} raw → ${confidence} after age decay), carrying ${strongCount} strong-band ` +
        `identity field${strongCount === 1 ? "" : "s"} across ${knownDomains.length} already-read domain${knownDomains.length === 1 ? "" : "s"}. ` +
        `Prior facts are treated as corroboration targets to be re-tested, not as findings.`;

    return {
      found: true,
      dossierId: String(row.id),
      subjectName: row.subject_name ?? null,
      subjectEmail: row.subject_email ?? null,
      builtAt,
      ageDays,
      confidence,
      confidenceRaw,
      facts: facts.slice(0, 60),
      associates,
      kin,
      knownDomains,
      anchors: stale ? [] : anchors,
      gaps,
      disclosure,
      stale,
    };
  } catch (err) {
    console.error("[vaultPrior] resolve_failed", err instanceof Error ? err.message : String(err));
    return { ...EMPTY };
  }
}

/**
 * Render the prior as a context block for a reasoning model.
 *
 * The band labelling is load-bearing: without it a model reads every line as
 * established and repeats possible-band material as fact.
 */
export function formatVaultPrior(p: VaultPrior): string {
  if (!p.found) return "";
  const lines: string[] = [];
  lines.push("── VAULT PRIOR (operator's own Cloud Intelligence dossier) ──");
  lines.push(p.disclosure);
  if (p.stale) return lines.join("\n");

  const strong = p.facts.filter((f) => f.band === "strong");
  const possible = p.facts.filter((f) => f.band === "possible");

  if (strong.length) {
    lines.push("STRONG band — subject positively matched in the source document. Re-test, do not assume:");
    for (const f of strong.slice(0, 25)) {
      lines.push(`  · ${f.field}: ${f.value}${f.sources.length ? ` [${f.sources.join(", ")}]` : ""}`);
    }
  }
  if (possible.length) {
    lines.push("POSSIBLE band — extracted from name-matching documents that did NOT clear identity matching. Use as query anchors ONLY; never restate as fact:");
    for (const f of possible.slice(0, 15)) lines.push(`  · ${f.field}: ${f.value}`);
  }
  if (p.associates.length) lines.push(`Known association ring (hop-1): ${p.associates.slice(0, 15).join(", ")}`);
  if (p.kin.length) lines.push(`Claimed kin: ${p.kin.join(", ")}`);
  if (p.anchors.length) lines.push(`Disambiguation anchors to pair with the name: ${p.anchors.join(" · ")}`);
  if (p.knownDomains.length) {
    lines.push(`Already read by the vault (${p.knownDomains.length} domains): ${p.knownDomains.slice(0, 20).join(", ")}. A result set confined to these has added nothing new.`);
  }
  if (p.gaps.length) lines.push(`The vault could NOT establish: ${p.gaps.join("; ")}. These are the questions this search should prioritise.`);
  return lines.join("\n");
}
