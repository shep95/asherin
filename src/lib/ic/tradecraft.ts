// ═══════════════════════════════════════════════════════════════════════════
// IC TRADECRAFT — client mirror.
//
// The authoritative implementation lives server-side in
// supabase/functions/_shared/icTradecraft.ts, where products are assembled.
// This file carries only what the RENDERER needs: the canonical section order,
// the display labels, the confidence rubric and the portion-mark parser.
//
// Deliberately duplicated rather than imported: the edge runtime is Deno and
// the app is Vite, and a shared import across that boundary is a build-config
// trap. The duplication is small, pure and covered by a test that pins the two
// section orders to each other.
// ═══════════════════════════════════════════════════════════════════════════

export type ConfidenceLevel = "low" | "moderate" | "high";

export const IC_SECTION_ORDER: readonly string[] = [
  "SCOPE NOTE",
  "SOURCE SUMMARY",
  "DISCUSSION",
  "OUTLOOK",
  "ALTERNATIVE ANALYSIS",
  "INTELLIGENCE GAPS",
  "CONFIDENCE",
  "HANDLING",
] as const;

/** Sections that are analytic apparatus rather than substantive facts. */
export const IC_APPARATUS = new Set<string>([
  "SCOPE NOTE",
  "SOURCE SUMMARY",
  "OUTLOOK",
  "ALTERNATIVE ANALYSIS",
  "INTELLIGENCE GAPS",
  "CONFIDENCE",
  "HANDLING",
]);

export const PRODUCT_BANNER = "OPEN SOURCE \u00B7 UNCLASSIFIED//OSINT \u00B7 ADDRESSEE EYES ONLY";

export const LIKELIHOOD_TERMS: readonly { term: string; lo: number; hi: number }[] = [
  { term: "almost no chance", lo: 1, hi: 5 },
  { term: "very unlikely", lo: 5, hi: 20 },
  { term: "unlikely", lo: 20, hi: 45 },
  { term: "roughly even chance", lo: 45, hi: 55 },
  { term: "likely", lo: 55, hi: 80 },
  { term: "very likely", lo: 80, hi: 95 },
  { term: "almost certain", lo: 95, hi: 99 },
] as const;

const MARK_RE = /^\((U(?:\/\/LIMDIS)?)\)\s*/;

/** Split "(U) text" into its provenance mark and the text. */
export function splitPortionMark(raw: string): { mark: string | null; text: string } {
  const m = MARK_RE.exec(raw ?? "");
  return m ? { mark: m[1], text: raw.slice(m[0].length) } : { mark: null, text: raw ?? "" };
}

/**
 * Find the single estimative term a judgment carries, if any. Matches the
 * longest term first so "very unlikely" is never mis-read as "unlikely" —
 * the bug that would have inverted an 80% judgment into a 20% one.
 */
export function estimativeTermIn(text: string): { term: string; lo: number; hi: number } | null {
  const t = (text ?? "").toLowerCase();
  const byLength = [...LIKELIHOOD_TERMS].sort((a, b) => b.term.length - a.term.length);
  return byLength.find((b) => t.includes(b.term)) ?? null;
}

const RANK = new Map(IC_SECTION_ORDER.map((s, i) => [s, i]));
const DISCUSSION_RANK = RANK.get("DISCUSSION") ?? 2;

export function orderIcSections<T extends { label: string }>(sections: T[]): T[] {
  return sections
    .map((s, i) => ({ s, i, r: RANK.get((s.label ?? "").toUpperCase()) ?? DISCUSSION_RANK }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Report serial. Must stay byte-identical to the server implementation in
 * supabase/functions/_shared/icTradecraft.ts, so the number printed in the
 * email is the number shown on the dossier page. Both derive it from the
 * inbox row id, never from a random uuid.
 */
export function reportNumber(kind: string, serial: string | null | undefined, at: Date): string {
  const tag = (kind || "INTEL").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "INTEL";
  const day = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`;
  const suffix = (serial ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";
  return `ASH-${tag}-${day}-${suffix}`;
}

export const IC_APPARATUS_TITLE: Record<string, string> = {
  "SCOPE NOTE": "SCOPE NOTE",
  "SOURCE SUMMARY": "SOURCE SUMMARY STATEMENT",
  OUTLOOK: "OUTLOOK",
  "ALTERNATIVE ANALYSIS": "ALTERNATIVE ANALYSIS — WHAT WOULD CHANGE THIS",
  "INTELLIGENCE GAPS": "INTELLIGENCE GAPS",
  CONFIDENCE: "CONFIDENCE IN THIS ASSESSMENT",
  HANDLING: "HANDLING AND DISTRIBUTION",
};
