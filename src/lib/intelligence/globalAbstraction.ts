// privacy abstraction gateway.
//
// nothing personal crosses this line. what leaves a user's namespace is a
// mechanism stated in general terms, with every identifier, project detail and
// quoted phrase removed. if a candidate cannot survive abstraction, it does not
// leave — it is rejected, not sanitised into something misleading.

import type { GlobalCandidate, PatternObject } from "./types";

const IDENTIFIER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, label: "email address" },
  { re: /\bhttps?:\/\/\S+/gi, label: "url" },
  { re: /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, label: "phone-like number" },
  { re: /\b\d{1,5}\s+[A-Z][a-z]+\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b/gi, label: "street address" },
  { re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, label: "identifier" },
  { re: /\b(sk|pk|rk)[-_][A-Za-z0-9]{12,}\b/gi, label: "credential" },
  { re: /\bAIza[0-9A-Za-z_-]{20,}\b/g, label: "credential" },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, label: "token" },
  { re: /-----BEGIN[^-]{0,40}PRIVATE KEY-----/g, label: "private key" },
  { re: /\b[\w-]+\.(com|net|org|io|dev|app|co|ai)\b/gi, label: "domain name" },
  { re: /\b(?:\/[\w.-]+){2,}\b/g, label: "file path" },
];

const PERSONAL_MARKERS = [
  /\bthe user\b/i,
  /\bmy (project|repo|codebase|company|team|client)\b/i,
  /\bthis (repo|repository|codebase|project|company|account)\b/i,
  /\b(i|we) (prefer|like|hate|want|always|never)\b/i,
  /\buser [A-Z]\b/,
];

const SPECIFIC_TECH = /\b(supabase|firebase|zustand|next\.?js|django|rails|vercel|netlify|stripe|postgres|mysql|mongodb)\b/gi;

export interface AbstractionResult {
  ok: boolean;
  candidate?: GlobalCandidate;
  removed: string[];
  rejectedBecause?: string;
}

function stripIdentifiers(text: string): { text: string; removed: string[] } {
  let out = text;
  const removed: string[] = [];
  for (const { re, label } of IDENTIFIER_PATTERNS) {
    if (re.test(out)) {
      removed.push(label);
      out = out.replace(new RegExp(re.source, re.flags), "[removed]");
    }
  }
  return { text: out, removed: Array.from(new Set(removed)) };
}

function generalise(text: string): string {
  return text
    .replace(SPECIFIC_TECH, "the platform component")
    .replace(/\bthe user\b/gi, "an operator")
    .replace(/\b(i|we)\b/gi, "one")
    .replace(/\bmy\b/gi, "the")
    .replace(/\bthis (repo|repository|codebase|project)\b/gi, "a codebase")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** stable fingerprint over the abstracted mechanism, for dedup and merging. */
export function fingerprint(mechanism: string, domain: string): string {
  const normal = `${domain}|${mechanism}`
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .join(" ");
  let hash = 2166136261;
  for (let i = 0; i < normal.length; i += 1) {
    hash ^= normal.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `gp_${(hash >>> 0).toString(36)}_${normal.length.toString(36)}`;
}

/**
 * abstract a local pattern into an anonymous global candidate. a pattern that is
 * only meaningful because of who or what it names is not generalisable, so it
 * is refused rather than stripped into a vague sentence.
 */
export function abstractForGlobal(pattern: PatternObject): AbstractionResult {
  const removedAll: string[] = [];

  if (pattern.scope === "task") {
    return { ok: false, removed: [], rejectedBecause: "task-scoped items never leave the conversation" };
  }
  if (pattern.source === "global") {
    return { ok: false, removed: [], rejectedBecause: "already a global pattern" };
  }
  if (pattern.status !== "active" && pattern.status !== "validated" && pattern.status !== "refined") {
    return { ok: false, removed: [], rejectedBecause: `only validated patterns are eligible (this one is ${pattern.status})` };
  }
  if (pattern.successCount < 3) {
    return { ok: false, removed: [], rejectedBecause: "fewer than three recorded successes" };
  }

  const rawMechanism = pattern.mechanism ?? pattern.procedure.join("; ");
  const stripped = stripIdentifiers(rawMechanism);
  removedAll.push(...stripped.removed);
  const mechanism = generalise(stripped.text);

  if (stripped.removed.includes("credential") || stripped.removed.includes("private key") || stripped.removed.includes("token")) {
    return { ok: false, removed: removedAll, rejectedBecause: "credential material present — refused outright, not sanitised" };
  }

  if (PERSONAL_MARKERS.some((re) => re.test(mechanism))) {
    return { ok: false, removed: removedAll, rejectedBecause: "still describes a specific person or project after abstraction" };
  }
  if (mechanism.replace(/\[removed\]/g, "").trim().length < 25) {
    return { ok: false, removed: removedAll, rejectedBecause: "nothing generalisable remained after abstraction" };
  }

  const procedure = pattern.procedure.map((step) => {
    const s = stripIdentifiers(step);
    removedAll.push(...s.removed);
    return generalise(s.text);
  });

  const candidate: GlobalCandidate = {
    fingerprint: fingerprint(mechanism, pattern.domain),
    name: generalise(stripIdentifiers(pattern.name).text).slice(0, 120),
    domain: pattern.domain,
    abstractionLevel: "abstract",
    mechanism,
    procedure,
    constraints: pattern.constraints.map((c) => generalise(stripIdentifiers(c).text)),
    failureModes: pattern.failureModes.map((f) => generalise(stripIdentifiers(f.whenFails).text)),
    independentSources: 1,
    evidenceScore: Math.min(1, pattern.successCount / 10),
    privacyChecked: true,
    status: "quarantined",
    reviewNotes: [`abstracted from a local pattern; removed: ${Array.from(new Set(removedAll)).join(", ") || "nothing"}`],
  };

  return { ok: true, candidate, removed: Array.from(new Set(removedAll)) };
}

/**
 * independence analysis. repeated copies of the same behaviour from one origin
 * are one piece of evidence, not many — popularity is not proof.
 */
export function analyseIndependence(
  candidates: { fingerprint: string; originHash: string }[],
): Map<string, number> {
  const byFingerprint = new Map<string, Set<string>>();
  for (const c of candidates) {
    if (!byFingerprint.has(c.fingerprint)) byFingerprint.set(c.fingerprint, new Set());
    byFingerprint.get(c.fingerprint)!.add(c.originHash);
  }
  const result = new Map<string, number>();
  byFingerprint.forEach((origins, fp) => result.set(fp, origins.size));
  return result;
}
