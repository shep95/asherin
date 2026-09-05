import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_saved_target",
  title: "Save a map target",
  description:
    "Save a geographic target (label, latitude, longitude, optional notes) for the signed-in user so it appears on the Asherin Eye map.",
  inputSchema: {
    label: z.string().trim().min(1).max(160).describe("Target label."),
    lat: z.number().min(-90).max(90).describe("Latitude in decimal degrees."),
    lng: z.number().min(-180).max(180).describe("Longitude in decimal degrees."),
    notes: z.string().trim().max(2000).optional().describe("Optional notes about the target."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ label, lat, lng, notes }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("asher_saved_targets")
      .insert({ user_id: ctx.getUserId(), label, lat, lng, notes: notes ?? null })
      .select("id,label,lat,lng,notes,created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { target: data },
    };
  },
});
