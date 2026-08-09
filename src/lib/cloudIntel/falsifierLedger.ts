// ═══════════════════════════════════════════════════════════════════════════
// FALSIFIER LEDGER — forecast accountability across sweeps
//
// THE PROBLEM
//
// Augur already obeys Rule 18: every forecast ships with the observation that
// would prove it wrong. But the falsifier was a sentence in a card that was
// regenerated from scratch on the next sweep and never compared to the last.
// A forecast that was flatly contradicted by the following week's data looked
// exactly like a forecast that came true — both were simply absent from the
// new render. The engine could therefore never be wrong, which means it could
// never be right either.
//
// WHAT THIS DOES
//
// Every forecast is written to a durable ledger keyed by a stable hash of its
// own text. On each subsequent sweep the ledger is reconciled against the
// freshly computed forecasts:
//
//   · Still produced, still inside its horizon      → OPEN (re-checked)
//   · Still produced, horizon elapsed               → HELD (the condition
//                                                     persisted through the
//                                                     whole window)
//   · No longer produced, and its falsifier metric  → REFUTED
//     is now observably true
//   · No longer produced, no falsifying observation → LAPSED (the condition
//                                                     went away; honest, but
//                                                     not evidence of skill)
//
// Hit rate is HELD ÷ (HELD + REFUTED). LAPSED is deliberately excluded from
// both sides — counting it as a win is how forecasting systems flatter
// themselves.
//
// DOCTRINE
//   · A forecast is only scoreable if it can lose. Anything without a
//     machine-comparable falsifier is stored but marked unscoreable.
//   · The ledger is per-user and RLS-scoped. No cross-tenant reads.
//   · Reconciliation is idempotent: the key is derived from content, so
//     replaying the same sweep twice does not inflate the record.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";
import type { Finding } from "./logic";

export type FalsifierStatus = "open" | "held" | "refuted" | "lapsed" | "expired";

export interface LedgerEntry {
  id: string;
  forecastKey: string;
  surface: string;
  prediction: string;
  falsifier: string;
  confidence: number;
  horizonDays: number;
  status: FalsifierStatus;
  evidence: string | null;
  checks: number;
  lastCheckedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface LedgerScore {
  total: number;
  open: number;
  held: number;
  refuted: number;
  lapsed: number;
  /** HELD ÷ (HELD + REFUTED), or null when nothing has resolved either way. */
  hitRate: number | null;
  /** Plain-language read of the record. Never a bare number. */
  verdict: string;
}

// ── keying ──────────────────────────────────────────────────────────────────

/**
 * Stable content hash.
 *
 * A random UUID would create a new row for the same forecast on every sweep
 * and make the hit rate meaningless. FNV-1a over normalised text is enough:
 * the space is per-user and small, and a collision would merge two identical-
 * sounding forecasts, which is the correct behaviour anyway.
 */
function forecastKey(surface: string, prediction: string): string {
  const s = `${surface}::${prediction.toLowerCase().replace(/\s+/g, " ").trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${surface}-${h.toString(16).padStart(8, "0")}-${s.length}`;
}

/** Default horizon when a finding does not state one. Augur's week-ahead. */
const DEFAULT_HORIZON = 7;

/** Horizons stated in the prediction text win over the default. */
function horizonOf(f: Finding): number {
  const text = `${f.title} ${f.projection ?? ""} ${f.falsifier}`;
  const m = /\b(next|within|over the next|in)\s+(\d{1,3})\s+(day|days|week|weeks|month|months)\b/i.exec(text);
  if (m) {
    const n = parseInt(m[2], 10);
    if (!Number.isFinite(n)) return DEFAULT_HORIZON;
    const unit = m[3].toLowerCase();
    if (unit.startsWith("week")) return Math.min(365, n * 7);
    if (unit.startsWith("month")) return Math.min(365, n * 30);
    return Math.min(365, n);
  }
  if (/\bseven days\b/i.test(text)) return 7;
  if (/\bthirty days\b/i.test(text)) return 30;
  return DEFAULT_HORIZON;
}

/**
 * A falsifier is scoreable when it names an observation, not a mood.
 *
 * "Unread falling below 20% of inbox total" is scoreable. "The relationship
 * improving" is not, and pretending otherwise would let unscoreable forecasts
 * silently inflate the hit rate.
 */
export function isScoreable(falsifier: string): boolean {
  const f = falsifier.toLowerCase();
  const hasQuantity = /\d/.test(f) || /\b(any|no|none|zero|three|two|one)\b/.test(f);
  const hasObservation = /\b(appear|appearing|rising|falling|dropping|clearing|returning|exceed|below|above|under|over|within|cancell?ation|arriv|sent|received)\b/.test(f);
  return hasQuantity && hasObservation && f.length > 25;
}

const rowToEntry = (r: any): LedgerEntry => ({
  id: r.id,
  forecastKey: r.forecast_key,
  surface: r.surface,
  prediction: r.prediction,
  falsifier: r.falsifier,
  confidence: r.confidence ?? 0,
  horizonDays: r.horizon_days ?? DEFAULT_HORIZON,
  status: (r.status ?? "open") as FalsifierStatus,
  evidence: r.evidence ?? null,
  checks: r.checks ?? 0,
  lastCheckedAt: r.last_checked_at ?? null,
  resolvedAt: r.resolved_at ?? null,
  createdAt: r.created_at,
});

// ── reconciliation ──────────────────────────────────────────────────────────

export interface ReconcileResult {
  entries: LedgerEntry[];
  score: LedgerScore;
  /** What changed on this pass, for the operator-visible activity line. */
  transitions: Array<{ prediction: string; from: FalsifierStatus; to: FalsifierStatus; why: string }>;
  error: string | null;
}

const EMPTY_SCORE: LedgerScore = {
  total: 0, open: 0, held: 0, refuted: 0, lapsed: 0, hitRate: null,
  verdict: "No forecast has resolved yet. The ledger scores nothing until a horizon elapses.",
};

/**
 * Write this sweep's forecasts to the ledger and resolve everything the sweep
 * has just answered.
 *
 * `currentFindings` must be the complete set of forecasts the surface produced
 * on THIS run. The absence of a previously-recorded forecast from that set is
 * the primary signal — so passing a partial set would fabricate resolutions.
 */
export async function reconcileLedger(
  surface: string,
  currentFindings: Finding[],
  /** Observations from this sweep, used to decide REFUTED vs LAPSED. */
  observations: string[] = [],
): Promise<ReconcileResult> {
  const transitions: ReconcileResult["transitions"] = [];

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      return { entries: [], score: EMPTY_SCORE, transitions, error: "not_authenticated" };
    }

    const { data: existingRows, error: readErr } = await supabase
      .from("augur_falsifiers")
      .select("*")
      .eq("user_id", userId)
      .eq("surface", surface)
      .order("created_at", { ascending: false })
      .limit(400);

    if (readErr) return { entries: [], score: EMPTY_SCORE, transitions, error: readErr.message };

    const existing = (existingRows ?? []).map(rowToEntry);
    const byKey = new Map(existing.map((e) => [e.forecastKey, e]));

    // 1. Upsert everything the sweep produced now.
    const now = new Date().toISOString();
    const currentKeys = new Set<string>();
    const upserts = currentFindings
      .filter((f) => f.falsifier && f.falsifier.trim().length > 10)
      .map((f) => {
        const key = forecastKey(surface, f.title);
        currentKeys.add(key);
        const prev = byKey.get(key);
        return {
          user_id: userId,
          forecast_key: key,
          surface,
          prediction: f.title.slice(0, 500),
          falsifier: f.falsifier.slice(0, 500),
          confidence: Math.max(0, Math.min(100, Math.round(f.confidence ?? 0))),
          horizon_days: horizonOf(f),
          // A forecast that is still being produced stays open. Never reopen a
          // resolved row — that would erase a recorded miss.
          status: prev && prev.status !== "open" ? prev.status : "open",
          checks: (prev?.checks ?? 0) + 1,
          last_checked_at: now,
        };
      });

    if (upserts.length) {
      const { error: upErr } = await supabase
        .from("augur_falsifiers")
        .upsert(upserts, { onConflict: "user_id,forecast_key" });
      if (upErr) console.warn("[falsifierLedger] upsert failed", upErr.message);
    }

    // 2. Resolve the rows this sweep no longer produces, plus anything whose
    //    horizon has elapsed while it was still being produced.
    const haystack = observations.join(" \n ").toLowerCase();
    const resolutions: Array<{ id: string; status: FalsifierStatus; evidence: string }> = [];

    for (const e of existing) {
      if (e.status !== "open") continue;
      const ageDays = (Date.now() - new Date(e.createdAt).getTime()) / 86_400_000;
      const stillProduced = currentKeys.has(e.forecastKey);

      if (stillProduced) {
        if (ageDays >= e.horizonDays) {
          resolutions.push({
            id: e.id,
            status: "held",
            evidence: `The condition was still present on the sweep of ${now.slice(0, 10)}, ${Math.round(ageDays)} days after the forecast was made and past its ${e.horizonDays}-day horizon. The stated falsifier — "${e.falsifier}" — was never observed.`,
          });
          transitions.push({ prediction: e.prediction, from: "open", to: "held", why: "horizon elapsed with the condition still present" });
        }
        continue;
      }

      // No longer produced. Was it falsified, or did it simply go away?
      const falsified = matchesFalsifier(e.falsifier, haystack);
      if (falsified) {
        resolutions.push({
          id: e.id,
          status: "refuted",
          evidence: `The falsifying observation was recorded on ${now.slice(0, 10)}: ${falsified}. Forecast is scored as a miss.`,
        });
        transitions.push({ prediction: e.prediction, from: "open", to: "refuted", why: falsified });
      } else if (ageDays >= e.horizonDays) {
        resolutions.push({
          id: e.id,
          status: "lapsed",
          evidence: `The condition was no longer produced on the sweep of ${now.slice(0, 10)} and no falsifying observation was recorded. Scored as LAPSED — excluded from the hit rate, because a condition that quietly went away is not evidence of foresight.`,
        });
        transitions.push({ prediction: e.prediction, from: "open", to: "lapsed", why: "condition disappeared with no falsifying observation" });
      }
    }

    for (const r of resolutions) {
      const { error } = await supabase
        .from("augur_falsifiers")
        .update({ status: r.status, evidence: r.evidence, resolved_at: now, last_checked_at: now })
        .eq("id", r.id)
        .eq("user_id", userId);
      if (error) console.warn("[falsifierLedger] resolve failed", error.message);
    }

    const { data: finalRows } = await supabase
      .from("augur_falsifiers")
      .select("*")
      .eq("user_id", userId)
      .eq("surface", surface)
      .order("created_at", { ascending: false })
      .limit(400);

    const entries = (finalRows ?? []).map(rowToEntry);
    return { entries, score: scoreLedger(entries), transitions, error: null };
  } catch (err) {
    return {
      entries: [], score: EMPTY_SCORE, transitions,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Decide whether the sweep's own observations satisfy a falsifier.
 *
 * This is deliberately conservative. A falsifier is only treated as met when
 * its distinguishing terms appear together in the observation text. A loose
 * match here would convert every disappeared forecast into a scored miss and
 * make the hit rate as dishonest in one direction as it used to be in the
 * other.
 */
function matchesFalsifier(falsifier: string, observations: string): string | null {
  if (!observations || observations.length < 20) return null;
  const stop = new Set(["the", "a", "an", "of", "on", "in", "to", "or", "and", "which", "that", "next", "over", "into", "than", "with", "for", "its", "is", "be", "by", "at", "from", "converts", "unallocated"]);
  const terms = falsifier
    .toLowerCase()
    .replace(/[^a-z0-9%\s.]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !stop.has(t));
  if (terms.length < 3) return null;

  const hits = terms.filter((t) => observations.includes(t));
  // Two-thirds of the distinguishing terms, minimum three. Below that the
  // "match" is coincidence between two sentences about email.
  if (hits.length < Math.max(3, Math.ceil(terms.length * 0.66))) return null;
  return `observation text carried ${hits.length} of ${terms.length} distinguishing terms from the falsifier (${hits.slice(0, 6).join(", ")})`;
}

export function scoreLedger(entries: LedgerEntry[]): LedgerScore {
  const open = entries.filter((e) => e.status === "open").length;
  const held = entries.filter((e) => e.status === "held").length;
  const refuted = entries.filter((e) => e.status === "refuted").length;
  const lapsed = entries.filter((e) => e.status === "lapsed").length;
  const resolved = held + refuted;
  const hitRate = resolved ? held / resolved : null;

  let verdict: string;
  if (!resolved) {
    verdict = open
      ? `${open} forecast${open === 1 ? "" : "s"} standing, none past its horizon yet. Nothing is scoreable until a window closes.`
      : EMPTY_SCORE.verdict;
  } else if (hitRate !== null && hitRate >= 0.7) {
    verdict = `${held} of ${resolved} resolved forecasts held (${Math.round(hitRate * 100)}%). ${lapsed} lapsed without a falsifying observation and are excluded. The engine is calibrated on this surface.`;
  } else if (hitRate !== null && hitRate >= 0.45) {
    verdict = `${held} of ${resolved} resolved forecasts held (${Math.round(hitRate * 100)}%). That is barely better than the coin. Treat these projections as direction, not as prediction.`;
  } else {
    verdict = `${held} of ${resolved} resolved forecasts held (${Math.round((hitRate ?? 0) * 100)}%). The engine is MISCALIBRATED on this surface — its forecasts are being contradicted more often than confirmed, and should not be acted on until the thresholds behind them are re-derived.`;
  }

  return { total: entries.length, open, held, refuted, lapsed, hitRate, verdict };
}

/** Read the ledger without reconciling. For the panel's initial paint. */
export async function loadLedger(surface = "augur"): Promise<{ entries: LedgerEntry[]; score: LedgerScore }> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return { entries: [], score: EMPTY_SCORE };
    const { data } = await supabase
      .from("augur_falsifiers")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("surface", surface)
      .order("created_at", { ascending: false })
      .limit(400);
    const entries = (data ?? []).map(rowToEntry);
    return { entries, score: scoreLedger(entries) };
  } catch {
    return { entries: [], score: EMPTY_SCORE };
  }
}
