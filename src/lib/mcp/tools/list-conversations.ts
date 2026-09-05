import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_conversations",
  title: "List chat conversations",
  description:
    "List the signed-in user's Asherin chat conversations (title, mode, pinned/archived state, timestamps). Message bodies are not returned.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum conversations to return."),
    include_archived: z.boolean().default(false).describe("Include archived conversations."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, include_archived }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("conversations")
      .select("id,title,mode,pinned,archived,created_at,updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!include_archived) query = query.eq("archived", false);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { conversations: data ?? [] },
    };
  },
});
