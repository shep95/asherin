import { supabase } from "@/integrations/supabase/client";
import type { NotepadData } from "./types";

const NOTEPAD_NOTEBOOK_PREFIX = "📝 Notepad";

/**
 * Syncs notepad tree data to a notebook in the Notebooks tab.
 * Creates the notebook if it doesn't exist, or updates it if it does.
 */
export async function syncNotepadToNotebook(
  userId: string,
  conversationId: string,
  data: NotepadData
): Promise<{ success: boolean; notebookId?: string; error?: string }> {
  try {
    const totalNotes = data.unsorted.length + data.branches.reduce((s, b) => s + b.notes.length, 0);
    if (totalNotes === 0) return { success: true };

    const notebookTitle = `${NOTEPAD_NOTEBOOK_PREFIX} — ${conversationId.slice(0, 8)}`;

    // Check if a notepad notebook already exists for this conversation
    const { data: existing } = await (supabase.from as any)("notebooks")
      .select("id, version")
      .eq("owner_id", userId)
      .ilike("title", notebookTitle)
      .limit(1);

    let notebookId: string;
    let currentVersion: number;

    if (existing && existing.length > 0) {
      notebookId = existing[0].id;
      currentVersion = existing[0].version;

      // Delete old cells
      await (supabase.from as any)("notebook_cells").delete().eq("notebook_id", notebookId);

      // Bump version
      currentVersion += 1;
      await (supabase.from as any)("notebooks").update({
        version: currentVersion,
        updated_at: new Date().toISOString(),
      }).eq("id", notebookId);
    } else {
      // Create new notebook
      const { data: created, error } = await (supabase.from as any)("notebooks")
        .insert({
          title: notebookTitle,
          description: "Auto-synced from Asherin Notepad",
          owner_id: userId,
          tags: ["notepad", "auto-sync"],
        })
        .select()
        .single();

      if (error || !created) return { success: false, error: error?.message || "Failed to create notebook" };

      notebookId = created.id;
      currentVersion = 1;

      // Create initial version
      await (supabase.from as any)("notebook_versions").insert({
        notebook_id: notebookId,
        version: 1,
        changed_by: userId,
        change_summary: "Auto-synced from Notepad",
      });
    }

    // Build cells from notepad data
    const cells: { notebook_id: string; cell_type: string; content: string; position: number }[] = [];
    let position = 0;

    // Add a header cell
    cells.push({
      notebook_id: notebookId,
      cell_type: "text",
      content: `# 📝 Notepad Notes\n\n*Auto-synced from Asherin Notepad*\n*Last synced: ${new Date().toLocaleString()}*`,
      position: position++,
    });

    // Add branches as sections
    for (const branch of data.branches) {
      let branchContent = `## ${branch.name}\n\n`;
      if (branch.notes.length === 0) {
        branchContent += "*No notes in this branch*";
      } else {
        branchContent += branch.notes.map(n => `- ${n.content}`).join("\n");
      }
      cells.push({
        notebook_id: notebookId,
        cell_type: "text",
        content: branchContent,
        position: position++,
      });
    }

    // Add unsorted notes
    if (data.unsorted.length > 0) {
      let unsortedContent = `## Unsorted Notes\n\n`;
      unsortedContent += data.unsorted.map(n => `- ${n.content}`).join("\n");
      cells.push({
        notebook_id: notebookId,
        cell_type: "text",
        content: unsortedContent,
        position: position++,
      });
    }

    // Insert all cells
    const { error: cellError } = await (supabase.from as any)("notebook_cells").insert(cells);
    if (cellError) return { success: false, error: cellError.message };

    // Save version snapshot
    await (supabase.from as any)("notebook_versions").insert({
      notebook_id: notebookId,
      version: currentVersion,
      changed_by: userId,
      change_summary: "Auto-synced from Notepad",
      snapshot: { cells: cells.map(c => ({ cell_type: c.cell_type, content: c.content, output: null, position: c.position, config: {} })) },
    });

    return { success: true, notebookId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
