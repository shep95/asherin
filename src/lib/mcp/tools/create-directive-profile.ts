import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_directive_profile",
  title: "Create a directive profile",
  description:
    "Create a directive profile for the signed-in user: a named set of standing directions that Asherin chat applies when the profile is active.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Short profile name."),
    directions: z
      .string()
      .trim()
      .min(1)
      .max(12000)
      .describe("The standing directions the assistant should follow."),
    description: z.string().trim().max(500).optional().describe("Optional short summary."),
    activate: z.boolean().default(false).describe("Make this the active profile."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, directions, description, activate }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    if (activate) {
      const { error: clearError } = await supabase
        .from("brains")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);
      if (clearError) {
        return { content: [{ type: "text", text: clearError.message }], isError: true };
      }
    }

    const { data, error } = await supabase
      .from("brains")
      .insert({
        user_id: userId,
        name,
        description: description ?? null,
        system_prompt: directions,
        is_active: activate,
      })
      .select("id,name,description,is_active,created_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { profile: data },
    };
  },
});
