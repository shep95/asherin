import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Service Worker JS (served at ?sw=1) ─────────────────────────────────────
// Registers periodic background sync to keep pinging location even when tab is closed
function buildServiceWorker(postUrl: string): string {
  return `
const POST_URL = "${postUrl}";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Periodic Background Sync (Chrome Android)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "location-ping") {
    event.waitUntil(pingLocation());
  }
});

// Fallback: message from page to trigger ping
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PING_LOCATION") {
    pingLocation(event.data.lat, event.data.lon, event.data.acc);
  }
});

async function pingLocation(lat, lon, acc) {
  try {
    const stored = await getStored();
    if (!stored) return;
    const body = { token: stored.token, deviceId: stored.deviceId, latitude: lat, longitude: lon, accuracy: acc };
    await fetch(POST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    });
  } catch (e) {}
}

async function getStored() {
  const cache = await caches.open("aureon-tracker-v1");
  const resp = await cache.match("/__meta__");
  if (!resp) return null;
  return resp.json();
}
`;
}

// ─── Tracking HTML Page ───────────────────────────────────────────────────────
function buildHtml(token: string, deviceId: string, functionUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aureon</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #050505; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .dot { width: 8px; height: 8px; background: #22d3ee; border-radius: 50%; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.2;} }
  </style>
</head>
<body>
  <div class="dot"></div>
  <script>
    const TOKEN = ${JSON.stringify(token)};
    const DEVICE_ID = ${JSON.stringify(deviceId)};
    const POST_URL = ${JSON.stringify(functionUrl)};
    const SW_URL = ${JSON.stringify(functionUrl + "?sw=1")};

    async function sendPing(lat, lon, acc) {
      try {
        await fetch(POST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: TOKEN, deviceId: DEVICE_ID, latitude: lat, longitude: lon, accuracy: acc }),
          keepalive: true
        });
      } catch(e) {}
    }

    async function registerSW() {
      if (!("serviceWorker" in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
        await navigator.serviceWorker.ready;

        // Cache token+deviceId so service worker can read it
        const cache = await caches.open("aureon-tracker-v1");
        await cache.put("/__meta__", new Response(JSON.stringify({ token: TOKEN, deviceId: DEVICE_ID })));

        // Request periodic background sync (Chrome Android)
        if ("periodicSync" in reg) {
          try {
            const status = await navigator.permissions.query({ name: "periodic-background-sync" });
            if (status.state === "granted") {
              await reg.periodicSync.register("location-ping", { minInterval: 15 * 60 * 1000 }); // 15 min
            }
          } catch(e) {}
        }
      } catch(e) {}
    }

    function startTracking() {
      if (!("geolocation" in navigator)) {
        // IP fallback — just redirect
        window.location.href = "https://aureonai.app/";
        return;
      }

      // Watch position — fires immediately and on every movement
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
          await sendPing(lat, lon, acc);

          // Also message the service worker
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "PING_LOCATION", lat, lon, acc
            });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );

      // Redirect after 2s — keep the watch alive briefly so we get an accurate fix first
      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        window.location.href = "https://aureonai.app/";
      }, 2500);
    }

    // Boot sequence
    (async () => {
      await registerSW();
      startTracking();
    })();
  </script>
</body>
</html>`;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Build the canonical POST URL for this function
  const functionUrl = `${url.origin}${url.pathname}`;

  // ── Serve Service Worker ──────────────────────────────────────────────────
  if (url.searchParams.get("sw") === "1") {
    return new Response(buildServiceWorker(functionUrl), {
      headers: {
        "Content-Type": "application/javascript",
        "Service-Worker-Allowed": "/",
        "Cache-Control": "no-cache",
        ...corsHeaders,
      },
    });
  }

  // ── POST: Receive location ping from page / service worker ────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { token, deviceId, latitude, longitude, accuracy } = body;

      if (!token || !deviceId || latitude == null || longitude == null) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Verify token
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();

      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(supabaseUrl, serviceKey);
      const now = new Date().toISOString();

      // Reverse geocode the GPS coords (OpenStreetMap Nominatim)
      let address: string | null = null;
      try {
        const geoResp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { "Accept-Language": "en", "User-Agent": "AureonTracker/1.0" } }
        );
        if (geoResp.ok) {
          const geo = await geoResp.json();
          address = geo.display_name ?? null;
        }
      } catch { /* skip */ }

      // Insert location ping
      await adminClient.from("tracker_locations").insert({
        device_id: deviceId,
        user_id: user.id,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        recorded_at: now,
        address,
      });

      // Keep device last_seen fresh
      await adminClient
        .from("tracker_devices")
        .update({ last_seen: now })
        .eq("id", deviceId)
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[tracker-pair POST]", err);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── GET: Serve tracking HTML page ─────────────────────────────────────────
  const token = url.searchParams.get("token");
  const deviceId = url.searchParams.get("deviceId");

  if (!token || !deviceId) {
    return new Response(null, { status: 302, headers: { Location: "https://aureonai.app/" } });
  }

  // Also do IP-based geolocation as a silent fallback (captured server-side)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;

  if (ip && !ip.startsWith("127.") && !ip.startsWith("::")) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();

      if (user) {
        const geoResp = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country`);
        if (geoResp.ok) {
          const geo = await geoResp.json();
          if (geo.status === "success") {
            const adminClient = createClient(supabaseUrl, serviceKey);
            const now = new Date().toISOString();
            const address = [geo.city, geo.regionName, geo.country].filter(Boolean).join(", ");
            await adminClient.from("tracker_locations").insert({
              device_id: deviceId,
              user_id: user.id,
              latitude: geo.lat,
              longitude: geo.lon,
              accuracy: null,
              recorded_at: now,
              address,
            });
            await adminClient
              .from("tracker_devices")
              .update({ last_seen: now })
              .eq("id", deviceId)
              .eq("user_id", user.id);
          }
        }
      }
    } catch { /* silent */ }
  }

  return new Response(buildHtml(token, deviceId, functionUrl), {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });
});
