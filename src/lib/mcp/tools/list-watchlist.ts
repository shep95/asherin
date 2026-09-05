import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_watchlist",
  title: "List watchlist entities",
  description:
    "List the signed-in user's monitored entities (type, value, alert frequency, mention count, last check time).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum entries to return."),
    enabled_only: z.boolean().default(false).describe("Only return entries with monitoring enabled."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, enabled_only }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("entity_watchlist")
      .select(
        "id,entity_type,entity_value,description,enabled,alert_frequency,mention_count,last_checked_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (enabled_only) query = query.eq("enabled", true);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { entities: data ?? [] },
    };
  },
});
