import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_watchlist_entity",
  title: "Add a watchlist entity",
  description:
    "Add an entity (person, organisation, domain, location, or other identifier) to the signed-in user's monitoring watchlist.",
  inputSchema: {
    entity_type: z
      .enum(["person", "organization", "domain", "location", "keyword", "other"])
      .describe("Kind of entity being monitored."),
    entity_value: z.string().trim().min(1).max(300).describe("The entity identifier or name."),
    description: z.string().trim().max(1000).optional().describe("Why this entity is monitored."),
    alert_frequency: z
      .enum(["realtime", "hourly", "daily", "weekly"])
      .default("daily")
      .describe("How often alerts should be evaluated."),
    enabled: z.boolean().default(true).describe("Whether monitoring is active."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ entity_type, entity_value, description, alert_frequency, enabled }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("entity_watchlist")
      .insert({
        user_id: ctx.getUserId(),
        entity_type,
        entity_value,
        description: description ?? null,
        alert_frequency,
        enabled,
      })
      .select("id,entity_type,entity_value,description,alert_frequency,enabled,created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { entity: data },
    };
  },
});
