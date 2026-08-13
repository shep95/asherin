import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// [Finding #2 & #10] — Stream data in batches instead of buffering entire dataset in memory
const BATCH_SIZE = 500;

async function* fetchTableBatched(supabase: any, table: string, userId: string) {
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .range(offset, offset + BATCH_SIZE - 1);
    if (error || !data || data.length === 0) break;
    yield data;
    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    // The export is the entire account in one download — aal2 required when
    // the account has a verified factor.
    const gate = await requireAssuredUser(req);
    if (!gate.ok) {
      return new Response(JSON.stringify(gate.body), {
        status: gate.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const userId = gate.caller.userId;


    const tables = [
      "profiles", "conversations", "messages", "memory_entries",
      "saved_prompts", "projects", "library_files", "calibration_feedback",
    ];

    // Stream NDJSON to avoid memory exhaustion on large exports
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Write header
          controller.enqueue(encoder.encode(JSON.stringify({
            exported_at: new Date().toISOString(),
            user: { id: user.id, email: user.email, created_at: user.created_at },
            format: "ndjson_stream",
          }) + "\n"));

          for (const table of tables) {
            controller.enqueue(encoder.encode(JSON.stringify({ __table: table, __start: true }) + "\n"));
            for await (const batch of fetchTableBatched(supabase, table, userId)) {
              for (const row of batch) {
                controller.enqueue(encoder.encode(JSON.stringify(row) + "\n"));
              }
            }
            controller.enqueue(encoder.encode(JSON.stringify({ __table: table, __end: true }) + "\n"));
          }

          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="aureon-data-export-${new Date().toISOString().split("T")[0]}.ndjson"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
