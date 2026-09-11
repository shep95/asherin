// Unsaved work survives a reload.
//
// A draft is not a version. It is the in-between state a person is actually
// holding — typed but not committed. It is stored per person per artifact so a
// collaborator's half-finished edit never lands in someone else's editor.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface DraftFile {
  path: string;
  content: string;
}

export type SaveState = "saved" | "saving" | "unsaved" | "save_failed";

export async function loadDraft(artifactId: string, userId: string): Promise<DraftFile[]> {
  const { data, error } = await supabase
    .from("software_artifact_draft")
    .select("files")
    .eq("artifact_id", artifactId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const raw = (data?.files ?? []) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is DraftFile => !!f && typeof (f as DraftFile).path === "string")
    .map((f) => ({ path: f.path, content: String(f.content ?? "") }));
}

export async function saveDraft(artifactId: string, userId: string, files: DraftFile[]): Promise<void> {
  const { error } = await supabase.from("software_artifact_draft").upsert(
    {
      artifact_id: artifactId,
      owner_user_id: userId,
      files: JSON.parse(JSON.stringify(files)) as Json,
    },
    { onConflict: "artifact_id,owner_user_id" },
  );
  if (error) throw error;
}

export async function clearDraft(artifactId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("software_artifact_draft")
    .delete()
    .eq("artifact_id", artifactId)
    .eq("owner_user_id", userId);
  if (error) throw error;
}
