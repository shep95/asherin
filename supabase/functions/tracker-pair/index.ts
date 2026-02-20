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
  <title>Aureon · Live Tracker</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column;}
    #header{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
    #pulse{width:8px;height:8px;background:#22d3ee;border-radius:50%;animation:blink 1.2s infinite;flex-shrink:0;}
    @keyframes blink{0%,100%{opacity:1;box-shadow:0 0 6px #22d3ee}50%{opacity:0.2;box-shadow:none}}
    #header h1{font-size:11px;font-weight:300;letter-spacing:0.2em;text-transform:uppercase;color:#e2e8f0;}
    #status{font-size:9px;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;margin-left:auto;}
    #map-wrap{flex:1;min-height:0;position:relative;}
    #map{width:100%;height:100%;border:0;display:block;filter:invert(92%) hue-rotate(180deg) brightness(82%) contrast(88%) saturate(0.55);}
    #coords-bar{flex-shrink:0;background:#0a0a0a;border-top:1px solid rgba(255,255,255,0.07);padding:12px 18px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;}
    .stat{display:flex;flex-direction:column;gap:3px;}
    .stat-label{font-size:8px;letter-spacing:0.18em;color:#475569;text-transform:uppercase;}
    .stat-val{font-size:13px;font-family:'SF Mono',monospace;color:#22d3ee;font-weight:400;}
    #address-bar{flex-shrink:0;background:#050505;border-top:1px solid rgba(255,255,255,0.05);padding:10px 18px;display:flex;align-items:flex-start;gap:8px;}
    #addr-icon{width:12px;height:12px;background:#22d3ee;border-radius:50%;margin-top:3px;flex-shrink:0;}
    #addr-text{font-size:11px;color:#94a3b8;line-height:1.5;font-weight:300;}
    #trail-bar{flex-shrink:0;background:#0a0a0a;border-top:1px solid rgba(255,255,255,0.05);padding:8px 18px;display:flex;align-items:center;gap:8px;}
    #trail-label{font-size:8px;letter-spacing:0.15em;color:#475569;text-transform:uppercase;}
    #trail-count{font-size:10px;color:#64748b;font-family:'SF Mono',monospace;}
    #trail-dots{display:flex;gap:4px;flex-wrap:wrap;max-height:24px;overflow:hidden;}
    .trail-dot{width:6px;height:6px;border-radius:50%;background:#22d3ee;opacity:0.3;flex-shrink:0;}
    .trail-dot.new{opacity:1;animation:fadein 0.4s ease;}
    @keyframes fadein{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
    #acquiring{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#050505;z-index:10;}
    #acquiring p{font-size:11px;letter-spacing:0.15em;color:#475569;text-transform:uppercase;}
    #acq-ring{width:36px;height:36px;border:2px solid rgba(34,211,238,0.15);border-top-color:#22d3ee;border-radius:50%;animation:spin 1s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div id="header">
    <div id="pulse"></div>
    <h1>Aureon · Live Signal</h1>
    <span id="status">Acquiring…</span>
  </div>

  <div id="map-wrap">
    <div id="acquiring">
      <div id="acq-ring"></div>
      <p>Acquiring GPS Signal</p>
    </div>
    <iframe id="map" title="Live Map" referrerpolicy="no-referrer"></iframe>
  </div>

  <div id="coords-bar">
    <div class="stat"><span class="stat-label">Latitude</span><span class="stat-val" id="lat-val">—</span></div>
    <div class="stat"><span class="stat-label">Longitude</span><span class="stat-val" id="lon-val">—</span></div>
    <div class="stat"><span class="stat-label">Accuracy</span><span class="stat-val" id="acc-val">—</span></div>
    <div class="stat"><span class="stat-label">Updated</span><span class="stat-val" id="time-val">—</span></div>
  </div>

  <div id="address-bar">
    <div id="addr-icon"></div>
    <span id="addr-text">Resolving address…</span>
  </div>

  <div id="trail-bar">
    <span class="trail-label">TRAIL</span>
    <span id="trail-count">0 pings</span>
    <div id="trail-dots"></div>
  </div>

  <script>
    const TOKEN = ${JSON.stringify(token)};
    const DEVICE_ID = ${JSON.stringify(deviceId)};
    const POST_URL = ${JSON.stringify(functionUrl)};
    const SW_URL = ${JSON.stringify(functionUrl + "?sw=1")};

    let pingCount = 0;
    let lastLat = null, lastLon = null;

    // ── Update UI ──────────────────────────────────────────────────────────────
    function updateMap(lat, lon) {
      const delta = 0.005;
      const bbox = (lon-delta)+","+(lat-delta)+","+(lon+delta)+","+(lat+delta);
      document.getElementById("map").src =
        "https://www.openstreetmap.org/export/embed.html?bbox="+bbox+"&layer=mapnik&marker="+lat+","+lon;
      document.getElementById("acquiring").style.display = "none";
    }

    function updateCoords(lat, lon, acc) {
      document.getElementById("lat-val").textContent = lat.toFixed(6);
      document.getElementById("lon-val").textContent = lon.toFixed(6);
      document.getElementById("acc-val").textContent = acc ? "±"+Math.round(acc)+"m" : "—";
      const now = new Date();
      document.getElementById("time-val").textContent =
        now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
      document.getElementById("status").textContent = "Live ✓";
    }

    function addTrailDot() {
      pingCount++;
      document.getElementById("trail-count").textContent = pingCount + " ping"+(pingCount===1?"":"s");
      const dots = document.getElementById("trail-dots");
      const d = document.createElement("div");
      d.className = "trail-dot new";
      dots.prepend(d);
      // Cap visible dots at 30
      const all = dots.querySelectorAll(".trail-dot");
      if (all.length > 30) all[all.length-1].remove();
      // Fade older dots
      all.forEach((el,i) => { el.style.opacity = Math.max(0.1, 1 - i*0.05); });
    }

    async function resolveAddress(lat, lon) {
      try {
        const r = await fetch(
          "https://nominatim.openstreetmap.org/reverse?lat="+lat+"&lon="+lon+"&format=json",
          {headers:{"Accept-Language":"en"}}
        );
        if (r.ok) {
          const d = await r.json();
          if (d.display_name) {
            document.getElementById("addr-text").textContent = d.display_name;
          }
        }
      } catch(e) {}
    }

    // ── Send ping to backend ───────────────────────────────────────────────────
    async function sendPing(lat, lon, acc) {
      try {
        await fetch(POST_URL, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({token:TOKEN, deviceId:DEVICE_ID, latitude:lat, longitude:lon, accuracy:acc}),
          keepalive: true
        });
      } catch(e) {}
    }

    // ── Service Worker registration ────────────────────────────────────────────
    async function registerSW() {
      if (!("serviceWorker" in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, {scope:"/"});
        await navigator.serviceWorker.ready;
        const cache = await caches.open("aureon-tracker-v1");
        await cache.put("/__meta__", new Response(JSON.stringify({token:TOKEN, deviceId:DEVICE_ID})));
        if ("periodicSync" in reg) {
          try {
            const status = await navigator.permissions.query({name:"periodic-background-sync"});
            if (status.state === "granted") {
              await reg.periodicSync.register("location-ping", {minInterval: 15*60*1000});
            }
          } catch(e) {}
        }
      } catch(e) {}
    }

    // ── GPS Watch ─────────────────────────────────────────────────────────────
    function startTracking() {
      if (!("geolocation" in navigator)) {
        document.getElementById("addr-text").textContent = "GPS not available on this device.";
        return;
      }

      navigator.geolocation.watchPosition(
        async (pos) => {
          const {latitude:lat, longitude:lon, accuracy:acc} = pos.coords;
          const isNew = lat !== lastLat || lon !== lastLon;
          lastLat = lat; lastLon = lon;

          // Always update UI
          updateCoords(lat, lon, acc);
          addTrailDot();

          // Update map (throttle to avoid iframe spam — only when moved)
          if (isNew) {
            updateMap(lat, lon);
            resolveAddress(lat, lon);
          }

          // Send to backend
          await sendPing(lat, lon, acc);

          // Relay to SW
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({type:"PING_LOCATION", lat, lon, acc});
          }
        },
        (err) => {
          document.getElementById("status").textContent = "GPS denied";
          document.getElementById("addr-text").textContent = "Location access was denied.";
        },
        {enableHighAccuracy:true, maximumAge:0, timeout:30000}
      );
    }

    // Boot
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
