import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;

    // Gather all user data from all tables
    const [
      profileRes,
      settingsRes,
      statsRes,
      intelRes,
      conversationsRes,
      messagesRes,
      memoryRes,
      promptsRes,
      projectsRes,
      libraryRes,
      calibrationRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId),
      supabase.from("user_settings").select("*").eq("user_id", userId),
      supabase.from("usage_stats").select("*").eq("user_id", userId),
      supabase.from("user_intelligence_profile").select("*").eq("user_id", userId),
      supabase.from("conversations").select("*").eq("user_id", userId),
      supabase.from("messages").select("*").eq("user_id", userId),
      supabase.from("memory_entries").select("*").eq("user_id", userId),
      supabase.from("saved_prompts").select("*").eq("user_id", userId),
      supabase.from("projects").select("*").eq("user_id", userId),
      supabase.from("library_files").select("*").eq("user_id", userId),
      supabase.from("calibration_feedback").select("*").eq("user_id", userId),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profileRes.data ?? [],
      settings: settingsRes.data ?? [],
      usage_stats: statsRes.data ?? [],
      intelligence_profile: intelRes.data ?? [],
      conversations: conversationsRes.data ?? [],
      messages: messagesRes.data ?? [],
      memory_entries: memoryRes.data ?? [],
      saved_prompts: promptsRes.data ?? [],
      projects: projectsRes.data ?? [],
      library_files: libraryRes.data ?? [],
      calibration_feedback: calibrationRes.data ?? [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="zialiel-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
