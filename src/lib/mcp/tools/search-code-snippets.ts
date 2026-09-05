import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_code_snippets",
  title: "Search saved code snippets",
  description:
    "Search the signed-in user's saved code snippets by title or content, optionally filtered by language.",
  inputSchema: {
    query: z.string().trim().max(200).optional().describe("Text to match in title or content."),
    language: z.string().trim().max(40).optional().describe("Filter by language, e.g. 'typescript'."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum snippets to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, language, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let builder = supabase
      .from("code_snippets")
      .select("id,title,language,tags,content,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (language) builder = builder.eq("language", language);
    if (query) {
      const safe = query.replace(/[%_,()]/g, " ").trim();
      if (safe) builder = builder.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`);
    }

    const { data, error } = await builder;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const trimmed = (data ?? []).map((row) => ({
      ...row,
      content: typeof row.content === "string" && row.content.length > 4000
        ? `${row.content.slice(0, 4000)}\n… truncated`
        : row.content,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(trimmed) }],
      structuredContent: { snippets: trimmed },
    };
  },
});
