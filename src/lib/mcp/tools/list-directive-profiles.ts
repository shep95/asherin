import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_directive_profiles",
  title: "List directive profiles",
  description:
    "List the signed-in user's directive profiles (saved standing directions applied to Asherin chat turns).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum profiles to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("brains")
      .select("id,name,description,system_prompt,is_active,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { profiles: data ?? [] },
    };
  },
});
