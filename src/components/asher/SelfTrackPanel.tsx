// SelfTrackPanel — operator control surface for own-force tracking.
//
// Consent is the first-class citizen here: the sensor cannot be opened from
// this panel without a deliberate click, and an AI-raised request renders as a
// prompt the operator must approve — never as an auto-start.

import { useState } from "react";
import {
  Navigation, Radar, Crosshair, Download, Trash2, ShieldAlert, ShieldCheck, Loader2, Plus,
} from "lucide-react";
import {
  compass16, fmtClock, fmtDistanceM, fmtSpeed, trailToGPX, trailToGeoJSON, downloadText,
  type UseSelfTracking,
} from "@/lib/asher/selfTrack";

interface Props {
  track: UseSelfTracking;
  /** Fallback centre for a geofence when there is no live fix yet. */
  mapCenter: { lat: number; lng: number };
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">{k}</span>
    <span className="text-[11px] font-light text-foreground/90">{v}</span>
  </div>
);

const SelfTrackPanel = ({ track, mapCenter }: Props) => {
  const [open, setOpen] = useState(false);
  const [fenceLabel, setFenceLabel] = useState("");
  const [fenceRadius, setFenceRadius] = useState("500");

  const { status, error, consent, pendingRequest, fix, trail, stats, fences, events, follow } = track;

  const live = status === "live";
  const dot =
    live ? "bg-sky-400" : status === "requesting" ? "bg-amber-400" : status === "denied" || status === "error" ? "bg-red-400" : "bg-muted-foreground/40";

  const addFence = () => {
    const origin = fix ?? mapCenter;
    const r = parseFloat(fenceRadius);
    track.addFence({
      label: fenceLabel.trim() || `Fence ${fences.length + 1}`,
      lat: origin.lat,
      lng: origin.lng,
      radiusM: Number.isFinite(r) ? r : 500,
    });
    setFenceLabel("");
  };

  return (
    <div className="border-t border-border/15">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-foreground/5"
        aria-expanded={open}
      >
        <Navigation className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="flex-1 text-[11px] font-light tracking-[0.2em] uppercase text-foreground/80">My Location</span>
        <span className={`h-1.5 w-1.5 rounded-full ${dot} ${live ? "animate-pulse motion-reduce:animate-none" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          {/* AI-raised request — approval gate */}
          {pendingRequest && !consent && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2.5 space-y-2">
              <p className="flex items-start gap-1.5 text-[10px] font-light leading-snug text-amber-300/90">
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.5} />
                Asher AI requested your live position: “{pendingRequest}”. Tracking stays on this device.
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={track.grantConsent}
                  className="flex-1 rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-sky-300 hover:bg-sky-400/20"
                >
                  Allow
                </button>
                <button
                  onClick={track.clearPending}
                  className="flex-1 rounded-md border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:bg-foreground/5"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          {status === "unsupported" ? (
            <p className="text-[10px] font-light text-muted-foreground">This browser exposes no geolocation sensor.</p>
          ) : (
            <div className="flex gap-1.5">
              {!live ? (
                <button
                  onClick={consent ? track.start : track.grantConsent}
                  disabled={status === "requesting"}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-sky-300 hover:bg-sky-400/20 disabled:opacity-50"
                >
                  {status === "requesting" ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : <Radar className="h-3 w-3" />}
                  {status === "requesting" ? "Acquiring" : "Track me"}
                </button>
              ) : (
                <button
                  onClick={track.stop}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-400/40 px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-red-300 hover:bg-red-400/10"
                >
                  <ShieldCheck className="h-3 w-3" /> Stop
                </button>
              )}
              <button
                onClick={() => track.setFollow(!follow)}
                aria-pressed={follow}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] ${
                  follow ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-border/40 text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                <Crosshair className="h-3 w-3" /> Follow
              </button>
            </div>
          )}

          {error && <p className="text-[10px] font-light leading-snug text-red-400/90">{error}</p>}

          {fix && (
            <div className="space-y-1 rounded-lg border border-border/15 bg-background/40 p-2.5">
              <Row k="Position" v={`${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`} />
              <Row k="Accuracy" v={`±${Math.round(fix.accM)} m${fix.degraded ? " (degraded)" : ""}`} />
              {fix.altM != null && <Row k="Altitude" v={`${Math.round(fix.altM)} m`} />}
              <Row k="Speed" v={fmtSpeed(fix.speedMps)} />
              <Row k="Heading" v={fix.headingDeg != null ? `${compass16(fix.headingDeg)} ${Math.round(fix.headingDeg)}°` : "—"} />
              <Row k="Track" v={`${fmtDistanceM(stats.distanceM)} · ${fmtClock(stats.durationMs)}`} />
              <Row k="Fixes" v={`${stats.fixes}${stats.bestAccM != null ? ` · best ±${Math.round(stats.bestAccM)} m` : ""}`} />
              {stats.stationarySinceMs != null && (
                <Row k="Dwell" v={fmtClock(Date.now() - stats.stationarySinceMs)} />
              )}
            </div>
          )}

          {/* Geofences */}
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">Geofences</p>
            <div className="flex gap-1.5">
              <input
                value={fenceLabel}
                onChange={(e) => setFenceLabel(e.target.value)}
                placeholder="Label"
                className="min-w-0 flex-1 rounded-md border border-border/30 bg-background/50 px-2 py-1 text-[11px] font-light outline-none focus-visible:border-sky-400/50"
              />
              <input
                value={fenceRadius}
                onChange={(e) => setFenceRadius(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                aria-label="Geofence radius in metres"
                className="w-16 rounded-md border border-border/30 bg-background/50 px-2 py-1 text-[11px] font-light outline-none focus-visible:border-sky-400/50"
              />
              <button
                onClick={addFence}
                aria-label="Add geofence"
                className="rounded-md border border-border/40 px-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {fences.length === 0 ? (
              <p className="text-[10px] font-light text-muted-foreground/60">
                None. A fence is anchored on your live fix, or the map centre when tracking is off.
              </p>
            ) : (
              fences.map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-md border border-border/15 bg-background/40 px-2 py-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${g.inside ? "bg-emerald-400" : "bg-violet-400/60"}`} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-light">{g.label}</span>
                  <span className="text-[9px] text-muted-foreground/60">{Math.round(g.radiusM)} m</span>
                  <button onClick={() => track.removeFence(g.id)} aria-label={`Remove ${g.label}`} className="text-muted-foreground/60 hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
            {events.slice(0, 4).map((e) => (
              <p key={e.id} className="text-[10px] font-light text-muted-foreground/70">
                {e.kind === "enter" ? "▸ Entered" : "▸ Exited"} {e.label} · {new Date(e.ts).toLocaleTimeString()}
              </p>
            ))}
          </div>

          {/* Local-only export */}
          <div className="flex gap-1.5">
            <button
              disabled={trail.length < 2}
              onClick={() => downloadText(`asher-track-${Date.now()}.gpx`, "application/gpx+xml", trailToGPX(trail))}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:bg-foreground/5 disabled:opacity-40"
            >
              <Download className="h-3 w-3" /> GPX
            </button>
            <button
              disabled={trail.length < 2}
              onClick={() => downloadText(`asher-track-${Date.now()}.geojson`, "application/geo+json", JSON.stringify(trailToGeoJSON(trail), null, 2))}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:bg-foreground/5 disabled:opacity-40"
            >
              <Download className="h-3 w-3" /> GeoJSON
            </button>
            <button
              disabled={trail.length === 0}
              onClick={track.clearTrail}
              aria-label="Clear track history"
              className="rounded-md border border-border/40 px-2 text-muted-foreground hover:bg-foreground/5 hover:text-red-400 disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <p className="text-[9px] font-light leading-snug text-muted-foreground/50">
            Positions stay on this device — held in session memory, never uploaded. Revoking consent stops the sensor
            and clearing the track erases the history.
          </p>
          {consent && (
            <button onClick={track.revokeConsent} className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-red-400">
              Revoke location consent
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SelfTrackPanel;
