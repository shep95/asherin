// ═══════════════════════════════════════════════════════════════════════════
// THE BLOODSTREAM
//
// One shared substance every organ writes into and reads from. An organ
// publishes SENSATIONS — facts it observed, never judgements about what they
// mean. The bloodstream normalises the thing that was sensed into a canonical
// entity (shared memory), appends an immutable event (circulation), and folds
// the observation into that entity's single shared confidence score under the
// corroboration law.
//
// Discipline enforced here, so no organ can bypass it:
//   • an organ may not name the account — user_id always comes from the caller
//   • the same sensation reported twice is ONE event (dedupe_key)
//   • every event carries its own death date (TTL) at write time
//   • corroboration counts DISTINCT organs, never repeat reports from one
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clamp01, fuse, halfLifeFor } from "./confidence.ts";

export type Organ =
  | "postmark"
  | "voiceprint"
  | "mesh"
  | "ghost"
  | "sentinel"
  | "shield"
  | "op"
  | "lattice"
  | "augur"
  | "guardian"
  | "zophiel"
  | "chat";

export type EntityKind =
  | "person"
  | "email"
  | "phone"
  | "domain"
  | "network"
  | "device"
  | "radio"
  | "credential"
  | "place"
  | "org";

export interface Sensation {
  organ: Organ;
  kind: string;
  entity: { kind: EntityKind; key: string; label?: string | null; attrs?: Record<string, unknown> } | null;
  verdict?: "clean" | "benign" | "anomalous" | "hostile" | "unknown";
  confidence?: number;
  reflex?: boolean;
  summary?: string;
  evidence?: Record<string, unknown>;
  observedAt?: string;
  /** Stable identity of the sensation itself — same fact ⇒ same key. */
  dedupeKey?: string;
  ttlDays?: number;
}

export interface EntityRow {
  id: string;
  user_id: string;
  kind: string;
  entity_key: string;
  label: string | null;
  confidence: number;
  corroboration: number;
  organs: string[];
  self_status: string;
  half_life_hours: number;
  attrs: Record<string, unknown>;
  first_seen: string;
  last_seen: string;
  last_decayed_at: string;
  expires_at: string | null;
}

export interface EventRow {
  id: string;
  organ: string;
  kind: string;
  entity_id: string | null;
  verdict: string;
  confidence: number;
  reflex: boolean;
  summary: string | null;
  evidence: Record<string, unknown>;
  observed_at: string;
}

/**
 * Normalisation is what makes memory shared. "Bob@Example.COM " arriving from
 * the mail organ and "bob@example.com" arriving from the dossier organ must
 * collapse to ONE entity, or the two hands never read each other's notes.
 */
export function normalizeKey(kind: EntityKind, raw: string): string {
  const v = String(raw ?? "").trim().toLowerCase();
  switch (kind) {
    case "email":
      return v.replace(/\s+/g, "");
    case "phone":
      // E.164-ish: digits only, leading + preserved
      return (v.startsWith("+") ? "+" : "") + v.replace(/\D/g, "");
    case "domain":
      return v.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/[.]$/, "");
    case "radio":
    case "device":
      return v.replace(/[^a-z0-9:_-]/g, "");
    case "network":
      return v.replace(/\s+/g, " ");
    default:
      return v.replace(/\s+/g, " ");
  }
}

function ttlFrom(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** Deterministic dedupe key when an organ does not supply one. */
function autoDedupe(s: Sensation): string {
  const hourBucket = (s.observedAt ? new Date(s.observedAt) : new Date()).toISOString().slice(0, 13);
  const ent = s.entity ? `${s.entity.kind}:${normalizeKey(s.entity.kind, s.entity.key)}` : "none";
  return `${s.kind}|${ent}|${s.verdict ?? "unknown"}|${hourBucket}`;
}

export interface PublishResult {
  ingested: number;
  deduped: number;
  entities: number;
  errors: string[];
}

/**
 * Publish sensations into the bloodstream.
 *
 * `db` must be a client that can write for `userId`: either the caller's own
 * session client (RLS scopes it) or a service client used by a background
 * organ. `userId` is always supplied by the trusted caller, never by a body.
 */
export async function publish(
  db: SupabaseClient,
  userId: string,
  sensations: Sensation[],
  opts: { calibration?: number } = {},
): Promise<PublishResult> {
  const out: PublishResult = { ingested: 0, deduped: 0, entities: 0, errors: [] };
  if (!sensations.length) return out;

  const calibration = clamp01(opts.calibration ?? 0.5);

  // ── 1. resolve entities (shared memory) ────────────────────────────────
  const wanted = new Map<string, { kind: EntityKind; key: string; label?: string | null; attrs?: Record<string, unknown> }>();
  for (const s of sensations) {
    if (!s.entity) continue;
    const key = normalizeKey(s.entity.kind, s.entity.key);
    if (!key) continue;
    const id = `${s.entity.kind}:${key}`;
    const prev = wanted.get(id);
    wanted.set(id, {
      kind: s.entity.kind,
      key,
      label: s.entity.label ?? prev?.label ?? null,
      attrs: { ...(prev?.attrs ?? {}), ...(s.entity.attrs ?? {}) },
    });
  }

  const idOf = (s: Sensation) =>
    s.entity ? `${s.entity.kind}:${normalizeKey(s.entity.kind, s.entity.key)}` : null;

  const resolved = new Map<string, EntityRow>();
  if (wanted.size) {
    const keys = [...wanted.values()].map((w) => w.key);
    const { data: existing, error } = await db
      .from("organism_entities")
      .select("*")
      .eq("user_id", userId)
      .in("entity_key", keys);
    if (error) out.errors.push(`entity-read: ${error.message}`);
    for (const row of (existing ?? []) as EntityRow[]) {
      resolved.set(`${row.kind}:${row.entity_key}`, row);
    }
  }

  const now = new Date().toISOString();
  const upserts: Record<string, unknown>[] = [];

  for (const [id, want] of wanted) {
    const prior = resolved.get(id);
    const mine = sensations.filter((s) => idOf(s) === id);
    const batchOrgans = [...new Set(mine.map((s) => s.organ))];
    const organs = [...new Set([...(prior?.organs ?? []), ...batchOrgans])];
    const strongest = mine.reduce((m, s) => Math.max(m, clamp01(s.confidence ?? 0.3)), 0);
    // A clean read against a standing high-confidence belief is evidence
    // AGAINST it — that is how the immune system stands itself down.
    const contradicts = mine.some((s) => s.verdict === "clean") && Number(prior?.confidence ?? 0) > 0.6;

    const confidence = fuse(Number(prior?.confidence ?? 0), strongest, {
      corroboration: organs.length,
      contradicts,
      calibration,
    });

    upserts.push({
      user_id: userId,
      kind: want.kind,
      entity_key: want.key,
      label: want.label ?? prior?.label ?? null,
      confidence: Number(confidence.toFixed(3)),
      corroboration: organs.length,
      organs,
      half_life_hours: halfLifeFor(want.kind),
      attrs: { ...(prior?.attrs ?? {}), ...(want.attrs ?? {}) },
      last_seen: now,
      last_decayed_at: now,
      updated_at: now,
    });
  }

  if (upserts.length) {
    const { data, error } = await db
      .from("organism_entities")
      .upsert(upserts, { onConflict: "user_id,kind,entity_key" })
      .select("*");
    if (error) out.errors.push(`entity-write: ${error.message}`);
    for (const row of (data ?? []) as EntityRow[]) {
      resolved.set(`${row.kind}:${row.entity_key}`, row);
      out.entities += 1;
    }
  }

  // ── 2. append circulation ──────────────────────────────────────────────
  const events = sensations.map((s) => {
    const key = idOf(s);
    return {
      user_id: userId,
      organ: s.organ,
      kind: s.kind.slice(0, 80),
      entity_id: key ? resolved.get(key)?.id ?? null : null,
      verdict: s.verdict ?? "unknown",
      confidence: Number(clamp01(s.confidence ?? 0.3).toFixed(3)),
      reflex: Boolean(s.reflex),
      summary: (s.summary ?? "").slice(0, 500) || null,
      evidence: s.evidence ?? {},
      observed_at: s.observedAt ?? now,
      expires_at: ttlFrom(s.ttlDays ?? 45),
      dedupe_key: (s.dedupeKey ?? autoDedupe(s)).slice(0, 200),
    };
  });

  const { data: written, error: evErr } = await db
    .from("organism_events")
    .upsert(events, { onConflict: "user_id,organ,dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (evErr) out.errors.push(`event-write: ${evErr.message}`);
  out.ingested = written?.length ?? 0;
  out.deduped = Math.max(0, events.length - out.ingested);

  return out;
}

/** Link two entities in associative memory (one hand telling the other). */
export async function link(
  db: SupabaseClient,
  userId: string,
  sourceId: string,
  targetId: string,
  relation: string,
  organ: Organ,
  confidence = 0.4,
): Promise<void> {
  if (sourceId === targetId) return;
  const { data: prior } = await db
    .from("organism_links")
    .select("id,organs,confidence")
    .eq("user_id", userId)
    .eq("source_id", sourceId)
    .eq("target_id", targetId)
    .eq("relation", relation)
    .maybeSingle();

  const organs = [...new Set([...(prior?.organs ?? []), organ])];
  await db.from("organism_links").upsert(
    {
      user_id: userId,
      source_id: sourceId,
      target_id: targetId,
      relation: relation.slice(0, 60),
      confidence: Number(
        fuse(Number(prior?.confidence ?? 0), clamp01(confidence), { corroboration: organs.length }).toFixed(3),
      ),
      corroboration: organs.length,
      organs,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id,source_id,target_id,relation" },
  );
}

/** Draw blood: the recent shared window every organ's brain reads from. */
export async function draw(
  db: SupabaseClient,
  userId: string,
  windowHours = 72,
  limit = 600,
): Promise<{ events: (EventRow & { entity?: EntityRow })[]; entities: EntityRow[] }> {
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();

  const [{ data: events, error: e1 }, { data: entities, error: e2 }] = await Promise.all([
    db
      .from("organism_events")
      .select("id,organ,kind,entity_id,verdict,confidence,reflex,summary,evidence,observed_at")
      .eq("user_id", userId)
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(limit),
    db
      .from("organism_entities")
      .select("*")
      .eq("user_id", userId)
      .order("last_seen", { ascending: false })
      .limit(1000),
  ]);

  if (e1) throw new Error(`bloodstream draw (events): ${e1.message}`);
  if (e2) throw new Error(`bloodstream draw (entities): ${e2.message}`);

  const byId = new Map(((entities ?? []) as EntityRow[]).map((e) => [e.id, e]));
  return {
    events: ((events ?? []) as EventRow[]).map((ev) => ({
      ...ev,
      entity: ev.entity_id ? byId.get(ev.entity_id) : undefined,
    })),
    entities: (entities ?? []) as EntityRow[],
  };
}
