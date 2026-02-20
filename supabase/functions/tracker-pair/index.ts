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

    if (!token || !deviceId) {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://aureonai.app/" },
      });
    }

    // ── 1. Get IP from request headers ─────────────────────────────────────────
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = req.headers.get("user-agent") || "";

    // ── 2. IP Geolocation via ip-api.com (free, no key needed) ──────────────────
    let latitude: number | null = null;
    let longitude: number | null = null;
    let address: string | null = null;

    if (ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("::")) {
      try {
        const geoResp = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country`
        );
        if (geoResp.ok) {
          const geo = await geoResp.json();
          if (geo.status === "success") {
            latitude = geo.lat;
            longitude = geo.lon;
            address = [geo.city, geo.regionName, geo.country]
              .filter(Boolean)
              .join(", ");
          }
        }
      } catch {
        // geo lookup failed — still redirect, just no location saved
      }
    }

    // ── 3. Verify the owner's token & store location ─────────────────────────────
    if (latitude !== null && longitude !== null) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Verify the token belongs to the device owner
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();

      if (user) {
        const adminClient = createClient(supabaseUrl, serviceKey);
        const now = new Date().toISOString();

        // Insert location ping
        await adminClient.from("tracker_locations").insert({
          device_id: deviceId,
          user_id: user.id,
          latitude,
          longitude,
          accuracy: null,
          recorded_at: now,
          address,
        });

        // Update device last_seen + store user_agent in device_name if not yet set
        await adminClient
          .from("tracker_devices")
          .update({ last_seen: now })
          .eq("id", deviceId)
          .eq("user_id", user.id);
      }
    }

    // ── 4. Redirect to Aureon home ────────────────────────────────────────────────
    return new Response(null, {
      status: 302,
      headers: { Location: "https://aureonai.app/" },
    });

  } catch (err) {
    console.error("[tracker-pair] Error:", err);
    // Always redirect even on error
    return new Response(null, {
      status: 302,
      headers: { Location: "https://aureonai.app/" },
    });
  }
});
