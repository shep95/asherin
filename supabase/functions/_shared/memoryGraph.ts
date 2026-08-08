// memoryGraph.ts — persistent per-user entity graph. Every autonomous-loop
// run merges its discovered entities and edges into this graph so future
// sessions inherit the accumulated intelligence instead of starting cold.
//
// FLAW-TAXONOMY APPLIED
//  - security: all reads/writes scoped by user_id; service-role client used
//    only for server-side merges (RLS still gates any client reads).
//  - concurrency: upserts use UNIQUE(user_id,canonical) so parallel writes
//    of the same subject converge to one row instead of duplicating.
//  - data honesty: confidence is preserved; hit_count is the only field that
//    grows on re-encounter, so recall counts stay auditable.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface MemoryEntityInput {
  canonical: string;
  kind: string;
  label: string;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  confidence?: "VERIFIED" | "CORROBORATED" | "REPORTED";
  notes?: string;
}

export interface MemoryEdgeInput {
  fromCanonical: string;
  toCanonical: string;
  relationship: string;
  sourceTheory?: string;
  confidence?: "VERIFIED" | "CORROBORATED" | "REPORTED";
}

export interface MemoryRunRecord {
  query: string;
  subject: string;
  kind: string;
  toolsFired: string[];
  consensusScore?: number;
  entitiesTouched: number;
  edgesCreated: number;
  durationMs: number;
  summary?: string;
}

export function canonicalize(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w.@-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240);
}

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Merge a batch of entities. Returns a map of canonical -> row id. */
export async function upsertEntities(
  supabase: SupabaseClient,
  userId: string,
  entities: MemoryEntityInput[],
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  if (!entities.length) return idMap;

  const rows = entities.map((e) => ({
    user_id: userId,
    canonical: canonicalize(e.canonical),
    kind: e.kind,
    label: e.label,
    aliases: e.aliases || [],
    attributes: e.attributes || {},
    confidence: e.confidence || "REPORTED",
    notes: e.notes || null,
    last_seen: new Date().toISOString(),
  }));

  // Two-step: try insert, on conflict fall back to increment hit_count.
  // A single upsert would clobber hit_count, so we split.
  const canonicals = rows.map((r) => r.canonical);
  const { data: existing } = await supabase
    .from("intel_memory_entities")
    .select("id, canonical, hit_count")
    .eq("user_id", userId)
    .in("canonical", canonicals);

  const existingMap = new Map<string, { id: string; hit_count: number }>();
  for (const r of existing || []) existingMap.set(r.canonical, { id: r.id, hit_count: r.hit_count });

  const toInsert = rows.filter((r) => !existingMap.has(r.canonical));
  if (toInsert.length) {
    const { data: inserted } = await supabase
      .from("intel_memory_entities")
      .insert(toInsert)
      .select("id, canonical");
    for (const r of inserted || []) idMap.set(r.canonical, r.id);
  }

  for (const r of rows) {
    const hit = existingMap.get(r.canonical);
    if (hit) {
      idMap.set(r.canonical, hit.id);
      await supabase
        .from("intel_memory_entities")
        .update({ hit_count: hit.hit_count + 1, last_seen: r.last_seen })
        .eq("id", hit.id);
    }
  }
  return idMap;
}

export async function upsertEdges(
  supabase: SupabaseClient,
  userId: string,
  edges: MemoryEdgeInput[],
  idMap: Map<string, string>,
): Promise<number> {
  if (!edges.length) return 0;
  const rows = edges
    .map((e) => {
      const from = idMap.get(canonicalize(e.fromCanonical));
      const to = idMap.get(canonicalize(e.toCanonical));
      if (!from || !to || from === to) return null;
      return {
        user_id: userId,
        from_entity: from,
        to_entity: to,
        relationship: e.relationship,
        source_theory: e.sourceTheory || null,
        confidence: e.confidence || "REPORTED",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("intel_memory_edges")
    .upsert(rows, { onConflict: "user_id,from_entity,to_entity,relationship", ignoreDuplicates: true });
  if (error) console.warn("[memoryGraph] edge upsert:", error.message);
  return rows.length;
}

export async function recordRun(
  supabase: SupabaseClient,
  userId: string,
  run: MemoryRunRecord,
): Promise<void> {
  await supabase.from("intel_autonomous_runs").insert({
    user_id: userId,
    query: run.query.slice(0, 2000),
    subject: run.subject,
    kind: run.kind,
    tools_fired: run.toolsFired,
    consensus_score: run.consensusScore ?? null,
    entities_touched: run.entitiesTouched,
    edges_created: run.edgesCreated,
    duration_ms: run.durationMs,
    summary: run.summary?.slice(0, 4000) ?? null,
  });
}

/** Pull prior knowledge for a subject to prime the loop with what we know. */
export async function recallSubject(
  supabase: SupabaseClient,
  userId: string,
  canonical: string,
): Promise<{ entity: any; neighbors: any[]; runs: any[] } | null> {
  const canon = canonicalize(canonical);
  const { data: entity } = await supabase
    .from("intel_memory_entities")
    .select("*")
    .eq("user_id", userId)
    .eq("canonical", canon)
    .maybeSingle();
  if (!entity) return { entity: null, neighbors: [], runs: [] };

  const { data: edges } = await supabase
    .from("intel_memory_edges")
    .select("relationship, source_theory, confidence, to_entity")
    .eq("user_id", userId)
    .eq("from_entity", entity.id)
    .limit(50);

  const neighborIds = (edges || []).map((e) => e.to_entity);
  let neighbors: any[] = [];
  if (neighborIds.length) {
    const { data } = await supabase
      .from("intel_memory_entities")
      .select("id, label, kind, canonical, confidence")
      .in("id", neighborIds);
    neighbors = data || [];
  }

  const { data: runs } = await supabase
    .from("intel_autonomous_runs")
    .select("query, tools_fired, consensus_score, summary, created_at")
    .eq("user_id", userId)
    .eq("subject", entity.label)
    .order("created_at", { ascending: false })
    .limit(3);

  return { entity, neighbors, runs: runs || [] };
}
