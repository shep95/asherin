// data contracts and artifact-owned data.
//
// A data-backed artifact declares its shape before anything is written, and it
// only ever reads and writes rows inside its own namespace. Asherin's own
// tables are never reachable from an artifact.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface DataField {
  name: string;
  type: "text" | "number" | "boolean" | "date" | "json";
  required: boolean;
  description?: string;
}

export interface DataEntity {
  name: string;
  fields: DataField[];
  relations: Array<{ to: string; kind: "one_to_one" | "one_to_many" | "many_to_one" }>;
  constraints: string[];
  indexes: string[];
  ownership: "artifact_owner";
  retention: "until_deleted" | "session_only";
  access: "owner_only" | "collaborators";
}

export interface DataContract {
  entities: DataEntity[];
  version: number;
}

const NAME = /^[a-z][a-z0-9_]{0,40}$/;

export interface ContractProblem {
  entity: string;
  field?: string;
  problem: string;
}

export function validateDataContract(contract: DataContract): ContractProblem[] {
  const problems: ContractProblem[] = [];
  const seen = new Set<string>();
  for (const entity of contract.entities) {
    if (!NAME.test(entity.name)) problems.push({ entity: entity.name, problem: "entity names must be lowercase words joined by underscores" });
    if (seen.has(entity.name)) problems.push({ entity: entity.name, problem: "this entity is declared twice" });
    seen.add(entity.name);
    if (entity.fields.length === 0) problems.push({ entity: entity.name, problem: "an entity needs at least one field" });
    const fields = new Set<string>();
    for (const field of entity.fields) {
      if (!NAME.test(field.name)) problems.push({ entity: entity.name, field: field.name, problem: "field names must be lowercase words joined by underscores" });
      if (fields.has(field.name)) problems.push({ entity: entity.name, field: field.name, problem: "this field is declared twice" });
      fields.add(field.name);
    }
    for (const rel of entity.relations) {
      if (!contract.entities.some((e) => e.name === rel.to)) {
        problems.push({ entity: entity.name, problem: `relation points at “${rel.to}”, which is not declared` });
      }
    }
    if (entity.ownership !== "artifact_owner") {
      problems.push({ entity: entity.name, problem: "artifact data always belongs to the artifact owner" });
    }
  }
  return problems;
}

export function emptyContract(): DataContract {
  return { entities: [], version: 1 };
}

export function readContract(manifest: Record<string, unknown> | null | undefined): DataContract {
  const raw = manifest && typeof manifest === "object" ? (manifest as { contract?: unknown }).contract : null;
  if (!raw || typeof raw !== "object") return emptyContract();
  const c = raw as Partial<DataContract>;
  return { entities: Array.isArray(c.entities) ? (c.entities as DataEntity[]) : [], version: Number(c.version ?? 1) };
}

/* ── artifact-owned records ───────────────────────────────────────────── */

export interface ArtifactRecord {
  id: string;
  collection: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

function mapRecord(row: Record<string, unknown>): ArtifactRecord {
  return {
    id: String(row.id),
    collection: String(row.collection),
    key: String(row.record_key),
    value: (row.value && typeof row.value === "object" ? row.value : {}) as Record<string, unknown>,
    updatedAt: String(row.updated_at),
  };
}

export async function listArtifactRecords(artifactId: string, collection?: string): Promise<ArtifactRecord[]> {
  let query = supabase
    .from("software_artifact_data")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (collection) query = query.eq("collection", collection);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => mapRecord(r as Record<string, unknown>));
}

export async function putArtifactRecord(input: {
  artifactId: string;
  userId: string;
  collection: string;
  key: string;
  value: Record<string, unknown>;
}): Promise<ArtifactRecord> {
  if (!NAME.test(input.collection)) throw new Error("a collection name must be lowercase words joined by underscores");
  const { data, error } = await supabase
    .from("software_artifact_data")
    .upsert(
      {
        artifact_id: input.artifactId,
        owner_user_id: input.userId,
        collection: input.collection,
        record_key: input.key,
        value: JSON.parse(JSON.stringify(input.value ?? {})) as Json,
      },
      { onConflict: "artifact_id,owner_user_id,collection,record_key" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapRecord(data as Record<string, unknown>);
}

export async function deleteArtifactRecord(id: string): Promise<void> {
  const { error } = await supabase.from("software_artifact_data").delete().eq("id", id);
  if (error) throw error;
}

export async function collectionCounts(artifactId: string): Promise<Array<{ collection: string; count: number }>> {
  const rows = await listArtifactRecords(artifactId);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.collection, (counts.get(r.collection) ?? 0) + 1);
  return [...counts.entries()].map(([collection, count]) => ({ collection, count })).sort((a, b) => a.collection.localeCompare(b.collection));
}
