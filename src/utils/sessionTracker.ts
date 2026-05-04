import { supabase } from "@/integrations/supabase/client";

function parseUserAgent(): { browser: string; os: string; deviceType: string } {
  const ua = navigator.userAgent;
  
  // Browser detection
  let browser = "Unknown";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  // OS detection
  let os = "Unknown";
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("CrOS")) os = "ChromeOS";

  // Device type
  let deviceType = "Desktop";
  if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) deviceType = "Mobile";
  else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) deviceType = "Tablet";

  return { browser, os, deviceType };
}

async function fetchPublicIP(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ip || null;
  } catch {
    return null;
  }
}

async function fetchGeoFromIP(ip: string): Promise<{ city: string | null; region: string | null; country: string | null; latitude: number | null; longitude: number | null }> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { city: null, region: null, country: null, latitude: null, longitude: null };
    const data = await res.json();
    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country_name || null,
      latitude: typeof data.latitude === "number" ? data.latitude : null,
      longitude: typeof data.longitude === "number" ? data.longitude : null,
    };
  } catch {
    return { city: null, region: null, country: null, latitude: null, longitude: null };
  }
}

const SESSION_REGISTERED_KEY = "aureon_session_registered";

export async function registerSession(userId: string, sessionId: string) {
  // Prevent duplicate registration within the same browser session
  const registeredId = sessionStorage.getItem(SESSION_REGISTERED_KEY);
  if (registeredId === sessionId) return;

  const { browser, os, deviceType } = parseUserAgent();
  const ip = await fetchPublicIP();
  const geo = ip ? await fetchGeoFromIP(ip) : { city: null, region: null, country: null, latitude: null, longitude: null };

  // Create a hash-like identifier from session ID (not actual crypto hash, just a fingerprint)
  const tokenHash = sessionId.replace(/-/g, "").substring(0, 32);

  // Mark all other sessions for this user as not current
  await supabase
    .from("user_sessions")
    .update({ is_current: false })
    .eq("user_id", userId)
    .eq("is_current", true);

  // Capture referrer / UTM (where the click came from)
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const referrer = typeof document !== "undefined" ? (document.referrer || null) : null;
  const utm_source = params.get("utm_source") || params.get("ref") || null;
  const utm_medium = params.get("utm_medium") || null;
  const utm_campaign = params.get("utm_campaign") || null;
  const landing_path = typeof window !== "undefined" ? window.location.pathname : null;

  // Upsert current session
  const { error } = await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      session_token_hash: tokenHash,
      browser,
      os,
      device_type: deviceType,
      ip_address: ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      latitude: geo.latitude,
      longitude: geo.longitude,
      current_path: landing_path,
      landing_path,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      is_current: true,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "session_token_hash" }
  );

  if (!error) {
    sessionStorage.setItem(SESSION_REGISTERED_KEY, sessionId);
  }

  // Log the login event to the activity log
  await supabase.from("account_activity_log").insert({
    user_id: userId,
    event_type: "login",
    description: `Signed in from ${browser} on ${os}`,
    ip_address: ip,
    device_info: `${deviceType} — ${browser} / ${os}`,
    location: [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || null,
    outcome: "success",
  });
}

export async function updateSessionActivity(userId: string, sessionId: string, path?: string) {
  const tokenHash = sessionId.replace(/-/g, "").substring(0, 32);
  await supabase
    .from("user_sessions")
    .update({
      last_active_at: new Date().toISOString(),
      ...(path ? { current_path: path } : {}),
    })
    .eq("user_id", userId)
    .eq("session_token_hash", tokenHash);
}
