import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const deviceId = url.searchParams.get("deviceId");
    const label = url.searchParams.get("label") ?? "Device";

    if (!token || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing token or deviceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a Supabase client using the user's JWT token to verify identity
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the token by creating a client with the user's token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to update the device
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the device belongs to this user and is still pending
    const { data: device, error: fetchError } = await adminClient
      .from("tracker_devices")
      .select("id, device_name, user_id, pairing_token_expires_at")
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !device) {
      return new Response(
        JSON.stringify({ error: "Device not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if pairing token is still valid
    if (device.pairing_token_expires_at) {
      const expiresAt = new Date(device.pairing_token_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({ error: "Pairing link has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Mark device as registered: set device_name (from label), clear pairing token
    const { error: updateError } = await adminClient
      .from("tracker_devices")
      .update({
        device_name: decodeURIComponent(label),
        last_seen: new Date().toISOString(),
        pairing_token: null,
        pairing_token_expires_at: null,
      })
      .eq("id", deviceId)
      .eq("user_id", user.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to register device" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return a simple success HTML page the mobile browser can show
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Device Paired — Aureon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; color: #fff; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { max-width: 360px; width: 100%; background: #111; border: 1px solid #222; border-radius: 20px; padding: 40px 32px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 300; letter-spacing: 0.1em; margin-bottom: 12px; }
    p { font-size: 14px; color: #888; line-height: 1.6; }
    .device { margin-top: 20px; padding: 12px 20px; background: #1a1a1a; border-radius: 12px; font-size: 13px; color: #aaa; }
    .device strong { color: #fff; display: block; font-size: 15px; font-weight: 400; margin-bottom: 4px; }
    .badge { margin-top: 24px; display: inline-flex; align-items: center; gap: 8px; font-size: 11px; color: #4ade80; letter-spacing: 0.15em; text-transform: uppercase; }
    .dot { width: 6px; height: 6px; background: #4ade80; border-radius: 50%; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Device Paired</h1>
    <p>This device has been successfully registered with your Aureon account.</p>
    <div class="device">
      <strong>${decodeURIComponent(label)}</strong>
      Location tracking is now active
    </div>
    <div class="badge"><span class="dot"></span> Live on Aureon</div>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });

  } catch (err) {
    console.error("[tracker-pair] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
