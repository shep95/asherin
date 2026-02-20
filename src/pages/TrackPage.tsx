import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// ─── Standalone tracker page served at /track?token=... ──────────────────────
// Replicates the edge-function HTML tracker as a React page so the URL shows
// https://aureonai.app/track?token=... instead of a raw backend URL.

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

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!r.ok) return "Resolving address…";
    const d = await r.json();
    return d.display_name ?? "Address unavailable";
  } catch {
    return "Address unavailable";
  }
}

export default function TrackPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"acquiring" | "live" | "denied" | "unavailable">("acquiring");
  const [coords, setCoords] = useState<{ lat: number; lon: number; acc: number | null } | null>(null);
  const [address, setAddress] = useState("Resolving address…");
  const [pingCount, setPingCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("—");
  const [mapSrc, setMapSrc] = useState("");
  const lastCoords = useRef<{ lat: number; lon: number } | null>(null);
  const visitorId = useRef(getOrCreateVisitorId());

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      window.location.href = "https://aureonai.app/";
    }
  }, [token]);

  const sendPing = async (lat: number, lon: number, acc: number | null) => {
    try {
      await fetch(POST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          visitorId: visitorId.current,
          latitude: lat,
          longitude: lon,
          accuracy: acc,
        }),
        keepalive: true,
      });
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!token) return;

    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
        const isNew = lat !== lastCoords.current?.lat || lon !== lastCoords.current?.lon;
        lastCoords.current = { lat, lon };

        setCoords({ lat, lon, acc });
        setStatus("live");
        setPingCount(prev => prev + 1);
        setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        if (isNew) {
          const delta = 0.005;
          const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
          setMapSrc(`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`);
          const addr = await reverseGeocode(lat, lon);
          setAddress(addr);
        }

        await sendPing(lat, lon, acc);
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [token]);

  if (!token) return null;

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        background: "#050505",
        color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            background: status === "live" ? "#22d3ee" : "#475569",
            borderRadius: "50%",
            flexShrink: 0,
            boxShadow: status === "live" ? "0 0 8px #22d3ee" : "none",
            animation: status === "live" ? "blink 1.2s infinite" : "none",
          }}
        />
        <h1
          style={{
            fontSize: 11,
            fontWeight: 300,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#e2e8f0",
          }}
        >
          Aureon · Live Signal
        </h1>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.15em",
            color: "#64748b",
            textTransform: "uppercase",
            marginLeft: "auto",
          }}
        >
          {status === "live" ? "Live ✓" : status === "denied" ? "GPS Denied" : status === "unavailable" ? "Unavailable" : "Acquiring…"}
        </span>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {status !== "live" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              background: "#050505",
              zIndex: 10,
            }}
          >
            {status === "denied" || status === "unavailable" ? (
              <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "#ef4444", textTransform: "uppercase" }}>
                {status === "denied" ? "Location access denied" : "GPS not available"}
              </p>
            ) : (
              <>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: "2px solid rgba(34,211,238,0.15)",
                    borderTopColor: "#22d3ee",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase" }}>
                  Acquiring GPS Signal
                </p>
              </>
            )}
          </div>
        )}
        {mapSrc && (
          <iframe
            title="Live Map"
            src={mapSrc}
            width="100%"
            height="100%"
            style={{
              border: 0,
              display: "block",
              minHeight: 260,
              filter: "invert(92%) hue-rotate(180deg) brightness(82%) contrast(88%) saturate(0.55)",
            }}
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Coords bar */}
      <div
        style={{
          flexShrink: 0,
          background: "#0a0a0a",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "12px 18px",
          display: "flex",
          flexWrap: "wrap" as const,
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        {[
          { label: "Latitude", val: coords ? coords.lat.toFixed(6) : "—" },
          { label: "Longitude", val: coords ? coords.lon.toFixed(6) : "—" },
          { label: "Accuracy", val: coords?.acc != null ? `±${Math.round(coords.acc)}m` : "—" },
          { label: "Updated", val: updatedAt },
        ].map(({ label, val }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 8, letterSpacing: "0.18em", color: "#475569", textTransform: "uppercase" }}>{label}</span>
            <span style={{ fontSize: 13, fontFamily: "'SF Mono', monospace", color: "#22d3ee", fontWeight: 400 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Address bar */}
      <div
        style={{
          flexShrink: 0,
          background: "#050505",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "10px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            background: "#22d3ee",
            borderRadius: "50%",
            marginTop: 3,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, fontWeight: 300 }}>{address}</span>
      </div>

      {/* Trail bar */}
      <div
        style={{
          flexShrink: 0,
          background: "#0a0a0a",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "8px 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 8, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase" }}>Trail</span>
        <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'SF Mono', monospace" }}>
          {pingCount} ping{pingCount !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, maxHeight: 24, overflow: "hidden" }}>
          {Array.from({ length: Math.min(pingCount, 30) }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22d3ee",
                opacity: Math.max(0.1, 1 - i * 0.05),
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
