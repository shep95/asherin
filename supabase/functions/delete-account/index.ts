import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAssuredUser } from "../_shared/assuranceGate.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Irreversible destruction: aal2 required whenever the account can reach it.
    const gate = await requireAssuredUser(req);
    if (!gate.ok) {
      return new Response(JSON.stringify(gate.body), {
        status: gate.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = gate.caller.userId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Use service role for deletion operations
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);


    // 1. Get all library files to delete from storage
    const { data: libraryFiles } = await adminClient
      .from("library_files")
      .select("storage_path")
      .eq("user_id", userId);

    // 2. Delete storage files
    if (libraryFiles && libraryFiles.length > 0) {
      const paths = libraryFiles.map((f: any) => f.storage_path);
      await adminClient.storage.from("library").remove(paths);
    }

    // 3. Delete avatar from storage
    const { data: avatarFiles } = await adminClient.storage.from("avatars").list(userId);
    if (avatarFiles && avatarFiles.length > 0) {
      const avatarPaths = avatarFiles.map((f: any) => `${userId}/${f.name}`);
      await adminClient.storage.from("avatars").remove(avatarPaths);
    }

    // 4. Delete all user data from all tables (order matters for FK constraints)
    await adminClient.from("calibration_feedback").delete().eq("user_id", userId);
    await adminClient.from("messages").delete().eq("user_id", userId);
    await adminClient.from("conversations").delete().eq("user_id", userId);
    await adminClient.from("memory_entries").delete().eq("user_id", userId);
    await adminClient.from("saved_prompts").delete().eq("user_id", userId);
    await adminClient.from("library_files").delete().eq("user_id", userId);
    await adminClient.from("projects").delete().eq("user_id", userId);
    await adminClient.from("user_intelligence_profile").delete().eq("user_id", userId);
    await adminClient.from("usage_stats").delete().eq("user_id", userId);
    await adminClient.from("user_settings").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // 5. Delete the auth user account
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: "Failed to delete account" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, message: "Account and all data permanently deleted" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
