import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_saved_targets",
  title: "List saved map targets",
  description:
    "List the signed-in user's saved geographic targets (label, coordinates, notes) used by the Asherin Eye map surfaces.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum targets to return."),
    search: z.string().trim().max(120).optional().describe("Case-insensitive label filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("asher_saved_targets")
      .select("id,label,lat,lng,notes,created_at,updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (search) query = query.ilike("label", `%${search.replace(/[%_]/g, "")}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { targets: data ?? [] },
    };
  },
});
