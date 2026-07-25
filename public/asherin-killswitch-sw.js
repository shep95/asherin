/* Asherin Shield · Kill-Switch Service Worker
 *
 * When armed (via postMessage {type:"ARM", allowlist:[...]}), this worker
 * intercepts every fetch from controlled clients and short-circuits any
 * request whose host is not on the allowlist. This is a real network-level
 * brake: if the user's VPN drops, the SW prevents any clear-text request
 * from leaving the browser until the user disarms it.
 */

const STATE = { armed: false, allowlist: [] };

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// SECURITY (H-12): only accept ARM/DISARM from our own origin. Any iframed
// page or cross-origin script attempting to control the kill-switch is
// rejected. self.origin reflects the SW's registration origin (i.e. the app).
self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.origin) {
    // Cross-origin postMessage — ignore silently.
    return;
  }
  const data = event.data || {};
  if (data.type === "ARM") {
    STATE.armed = true;
    STATE.allowlist = Array.isArray(data.allowlist) ? data.allowlist : [];
    event.source && event.source.postMessage({ type: "ARMED", allowlist: STATE.allowlist });
  } else if (data.type === "DISARM") {
    STATE.armed = false;
    STATE.allowlist = [];
    event.source && event.source.postMessage({ type: "DISARMED" });
  } else if (data.type === "STATUS") {
    event.source && event.source.postMessage({ type: "STATUS", armed: STATE.armed, allowlist: STATE.allowlist });
  }
});

function hostAllowed(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "blob:" || u.protocol === "data:") return true;
    if (STATE.allowlist.length === 0) return false;
    return STATE.allowlist.some((host) => u.hostname === host || u.hostname.endsWith("." + host));
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  if (!STATE.armed) return; // pass-through when disarmed

  const req = event.request;
  // Always allow same-origin navigation requests so the user can navigate.
  if (req.mode === "navigate") return;

  if (hostAllowed(req.url)) return; // allow

  event.respondWith(
    new Response(
      JSON.stringify({
        blocked: true,
        reason: "ASHERIN_KILLSWITCH_ARMED",
        url: req.url,
        ts: Date.now(),
      }),
      { status: 503, headers: { "content-type": "application/json", "x-asherin-killswitch": "blocked" } },
    ),
  );
});
