/**
 * Entity resolution.
 *
 * Two names that look alike are a candidate match, not the same entity. This
 * module produces ranked candidates with a stated reason; promotion to
 * `resolved` requires either a shared strong identifier or an explicit
 * operator decision. Vector or string similarity alone never resolves.
 */

import type { Entity, EntityKind, Identifier } from "./types";

const COMPANY_SUFFIXES = [
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "l.l.c.",
  "ltd",
  "ltd.",
  "limited",
  "plc",
  "corp",
  "corp.",
  "corporation",
  "co",
  "co.",
  "gmbh",
  "ag",
  "bv",
  "nv",
  "sa",
  "sas",
  "srl",
  "spa",
  "pty",
  "holdings",
  "group",
];

const PERSON_TITLES = ["mr", "mrs", "ms", "miss", "dr", "prof", "sir", "dame", "rev"];

/** Stable key for a name within one investigation and kind. */
export function canonicalize(kind: EntityKind | string, label: string): string {
  let t = String(label || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (kind === "company" || kind === "organization") {
    let changed = true;
    while (changed) {
      changed = false;
      for (const suffix of COMPANY_SUFFIXES) {
        const re = new RegExp(`[,\\s]${suffix.replace(/\./g, "\\.")}$`);
        if (re.test(t)) {
          t = t.replace(re, "").trim();
          changed = true;
        }
      }
    }
    t = t.replace(/\s*&\s*/g, " and ");
  }

  if (kind === "person") {
    const parts = t.split(" ").filter(Boolean);
    while (parts.length > 1 && PERSON_TITLES.includes(parts[0].replace(/\./g, ""))) parts.shift();
    t = parts.join(" ");
  }

  if (kind === "domain") t = t.replace(/^www\./, "");

  return t.replace(/\s+/g, " ").trim();
}

/** Identifier kinds strong enough to resolve an entity on their own. */
export const STRONG_IDENTIFIERS = new Set([
  "cik",
  "lei",
  "duns",
  "company_number",
  "registration_number",
  "vat",
  "ein",
  "isin",
  "orcid",
  "doi",
]);

function tokenSet(value: string): Set<string> {
  return new Set(value.split(" ").filter((t) => t.length > 1));
}

/** Jaccard over word tokens — a weak signal, labelled as such by callers. */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared += 1;
  });
  return shared / (ta.size + tb.size - shared);
}

export interface MatchCandidate {
  entityId: string;
  score: number;
  /** `identifier` is decisive; the rest are candidates awaiting confirmation. */
  basis: "identifier" | "exact_canonical" | "alias" | "name_similarity";
  reason: string;
  decisive: boolean;
}

export interface ResolveInput {
  kind: EntityKind | string;
  label: string;
  aliases?: string[];
  identifiers?: { kind: string; value: string }[];
}

/**
 * Ranks existing entities against an incoming mention. Never mutates and never
 * decides: it returns candidates, and only an `identifier` basis is decisive.
 */
export function findCandidates(
  input: ResolveInput,
  entities: Entity[],
  identifiers: Identifier[],
  opts: { minSimilarity?: number; limit?: number } = {},
): MatchCandidate[] {
  const minSimilarity = opts.minSimilarity ?? 0.55;
  const limit = opts.limit ?? 5;
  const canonical = canonicalize(input.kind, input.label);
  const incomingIds = (input.identifiers || []).map((i) => ({
    kind: i.kind.toLowerCase().trim(),
    value: i.value.toLowerCase().trim(),
  }));
  const aliasSet = new Set((input.aliases || []).map((a) => canonicalize(input.kind, a)));

  const out: MatchCandidate[] = [];

  for (const entity of entities) {
    if (entity.resolutionState === "merged" || entity.resolutionState === "rejected") continue;
    if (entity.kind !== input.kind) continue;

    const entityIds = identifiers.filter((i) => i.entityId === entity.id);
    const idHit = entityIds.find((existing) =>
      incomingIds.some(
        (incoming) =>
          incoming.kind === existing.kind.toLowerCase().trim() &&
          incoming.value === existing.value.toLowerCase().trim() &&
          STRONG_IDENTIFIERS.has(incoming.kind),
      ),
    );
    if (idHit) {
      out.push({
        entityId: entity.id,
        score: 1,
        basis: "identifier",
        reason: `shared ${idHit.kind} ${idHit.value}`,
        decisive: true,
      });
      continue;
    }

    if (entity.canonical === canonical) {
      out.push({
        entityId: entity.id,
        score: 0.9,
        basis: "exact_canonical",
        reason: "identical normalized name — candidate only, no shared identifier",
        decisive: false,
      });
      continue;
    }

    const aliasMatch =
      aliasSet.has(entity.canonical) ||
      entity.aliases.some((a) => canonicalize(entity.kind, a) === canonical);
    if (aliasMatch) {
      out.push({
        entityId: entity.id,
        score: 0.8,
        basis: "alias",
        reason: "name matches a recorded alias — candidate only",
        decisive: false,
      });
      continue;
    }

    const sim = nameSimilarity(canonical, entity.canonical);
    if (sim >= minSimilarity) {
      out.push({
        entityId: entity.id,
        score: Number(sim.toFixed(3)),
        basis: "name_similarity",
        reason: `name overlap ${(sim * 100).toFixed(0)}% — similarity is not proof of identity`,
        decisive: false,
      });
    }
  }

  return out
    .sort((a, b) => (Number(b.decisive) - Number(a.decisive)) || b.score - a.score)
    .slice(0, limit);
}

export interface ResolutionDecision {
  action: "merge" | "create" | "candidate";
  entityId: string | null;
  candidates: MatchCandidate[];
  reason: string;
}

/**
 * Decides what to do with an incoming mention. Only a decisive identifier
 * match merges automatically; everything else is surfaced for review so a weak
 * clue can never quietly become an identity.
 */
export function decideResolution(
  input: ResolveInput,
  entities: Entity[],
  identifiers: Identifier[],
): ResolutionDecision {
  const candidates = findCandidates(input, entities, identifiers);
  const decisive = candidates.find((c) => c.decisive);
  if (decisive) {
    return {
      action: "merge",
      entityId: decisive.entityId,
      candidates,
      reason: `resolved on ${decisive.reason}`,
    };
  }
  if (candidates.length) {
    return {
      action: "candidate",
      entityId: null,
      candidates,
      reason: "similar entities exist; kept separate pending a shared identifier or operator confirmation",
    };
  }
  return { action: "create", entityId: null, candidates: [], reason: "no comparable entity in this investigation" };
}
