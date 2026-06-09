import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const currentHour = now.getUTCHours();

    // Find all users whose delivery time matches current hour
    const { data: profiles } = await supabaseAdmin
      .from("briefing_profiles")
      .select("user_id, delivery_time, enabled")
      .eq("enabled", true);

    let generated = 0;

    for (const profile of profiles || []) {
      // Parse delivery time (format: "08:00" or "08:00 EST")
      const timePart = profile.delivery_time?.split(" ")[0] || "08:00";
      const [hour] = timePart.split(":").map(Number);

      if (hour === currentHour) {
        // Check if briefing already generated today
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const { data: existing } = await supabaseAdmin
          .from("briefing_reports")
          .select("id")
          .eq("user_id", profile.user_id)
          .gte("created_at", todayStart)
          .limit(1);

        if (!existing || existing.length === 0) {
          // Generate briefing by calling generate-briefing with service role
          try {
            const resp = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-briefing`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ userId: profile.user_id }),
              }
            );

            if (resp.ok) {
              generated++;
              console.log(`[BRIEFING-CRON] Generated briefing for user ${profile.user_id}`);
            } else {
              console.error(`[BRIEFING-CRON] Failed for user ${profile.user_id}: ${resp.status}`);
            }
          } catch (e) {
            console.error(`[BRIEFING-CRON] Error for user ${profile.user_id}:`, e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, briefings_generated: generated, checked_hour: currentHour }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BRIEFING-CRON] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
