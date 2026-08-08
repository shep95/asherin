import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// ─── Service Worker JS (served at ?sw=1) ─────────────────────────────────────
// Registers periodic background sync to keep pinging location even when tab is closed
function buildServiceWorker(postUrl: string): string {
  return `
const POST_URL = "${postUrl}";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "location-ping") {
    event.waitUntil(pingLocation());
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PING_LOCATION") {
    pingLocation(event.data.lat, event.data.lon, event.data.acc);
  }
});

async function pingLocation(lat, lon, acc) {
  try {
    const stored = await getStored();
    if (!stored) return;
    // Uses visitorId so server auto-creates device row per unique browser
    const body = { token: stored.token, visitorId: stored.visitorId, latitude: lat, longitude: lon, accuracy: acc };
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
// deviceId param is now ignored — the page auto-generates a visitorId per browser
function buildHtml(token: string, _deviceId: string, functionUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Asherin · Live Tracker</title>
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
    <h1>Asherin · Live Signal</h1>
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
    const POST_URL = ${JSON.stringify(functionUrl)};
    const SW_URL = ${JSON.stringify(functionUrl + "?sw=1")};

    // Auto-generate a stable visitorId per browser stored in localStorage
    // This means each unique device/browser gets its own tracker_devices row
    // regardless of how many people click the same link
    let VISITOR_ID = localStorage.getItem("aureon_visitor_id");
    if (!VISITOR_ID) {
      VISITOR_ID = "v-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
      localStorage.setItem("aureon_visitor_id", VISITOR_ID);
    }

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
      const all = dots.querySelectorAll(".trail-dot");
      if (all.length > 30) all[all.length-1].remove();
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
    // Uses visitorId so server can auto-create device row per unique browser
    async function sendPing(lat, lon, acc) {
      try {
        await fetch(POST_URL, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({token:TOKEN, visitorId:VISITOR_ID, latitude:lat, longitude:lon, accuracy:acc}),
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
        await cache.put("/__meta__", new Response(JSON.stringify({token:TOKEN, visitorId:VISITOR_ID})));
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

          updateCoords(lat, lon, acc);
          addTrailDot();

          if (isNew) {
            updateMap(lat, lon);
            resolveAddress(lat, lon);
          }

          await sendPing(lat, lon, acc);

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
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
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

  // ── POST: Receive location ping ───────────────────────────────────────────
  // Body: { shortCode, visitorId, latitude, longitude, accuracy }
  // shortCode is the ?t= value from the URL — maps to tracker_devices.pairing_token
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { shortCode, visitorId, latitude, longitude, accuracy } = body;

      if (!shortCode || !visitorId || latitude == null || longitude == null) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);
      const now = new Date().toISOString();

      // Resolve short code → owner device row
      const { data: ownerDevice } = await adminClient
        .from("tracker_devices")
        .select("id, user_id")
        .eq("pairing_token", shortCode)
        .maybeSingle();

      if (!ownerDevice) {
        return new Response(JSON.stringify({ error: "Invalid code" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ownerId = ownerDevice.user_id;
      const visitorKey = `${shortCode}::${visitorId}`;

      // Check if we already have a device row for this specific visitor on this campaign
      const { data: existingDevice } = await adminClient
        .from("tracker_devices")
        .select("id")
        .eq("user_id", ownerId)
        .eq("pairing_token", visitorKey)
        .maybeSingle();

      let deviceId: string;

      if (existingDevice) {
        deviceId = existingDevice.id;
      } else {
        // First ping from this browser — create a new device row
        const { data: newDevice, error: insertErr } = await adminClient
          .from("tracker_devices")
          .insert({
            user_id: ownerId,
            device_name: `Target-${visitorId.slice(0, 6).toUpperCase()}`,
            pairing_token: visitorKey,
            last_seen: now,
          })
          .select("id")
          .single();

        if (insertErr || !newDevice) {
          console.error("[tracker-pair] device insert error", insertErr);
          return new Response(JSON.stringify({ error: "Device creation failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        deviceId = newDevice.id;
      }

      // Reverse geocode
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
        user_id: ownerId,
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
        .eq("id", deviceId);

      return new Response(JSON.stringify({ ok: true, deviceId }), {
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

  // ── GET: not used (TrackPage is served by the React app at /track) ────────
  return new Response(null, { status: 302, headers: { Location: "https://asherin.com/" } });
});
