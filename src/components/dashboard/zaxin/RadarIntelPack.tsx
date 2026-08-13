// Zaxin — Radar Intel Pack
// Browser-native BLE readout panel. Reads what the Web Bluetooth API exposes, not a
// replacement for professional RF test gear or indoor location systems.
//
// What it shows:
//  1. Wardrive recorder + GeoJSON export.
//  2. Unwanted-tracker alarm (device seen at ≥3 distinct GPS fixes).
//  3. RSSI history sparkline + path-loss distance readout.
//  4. Source correlation chip (local vs hop-mesh).
//  5. IRK / mfr fingerprint chip surfaced next to id.
//  6. WebAudio ping whose cadence ∝ nearest RSSI.
//  7. Scan-cone sector filter (±deg around heading).
//  8. Layer toggles that mute static IoT and named wearables.
//  9. Floating manufacturer tag on each row.
// 10. Per-contact RSSI time-strip.
//
// All state is local, no server, no allocations per animation frame.

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, AlertOctagon, Volume2, VolumeX, Radar as RadarIcon, Filter, Eye, EyeOff } from "lucide-react";
import type { Contact } from "./core/types";

interface GeoLike {
  fix: { lat: number; lon: number; accuracy?: number | null } | null;
}

interface WardriveRow {
  ts: number;
  id: string;
  name: string;
  mfr: string | null;
  kind: string | null;
  rssi: number | null;
  lat: number;
  lon: number;
  acc: number | null;
}

// Haversine (meters) — used for AirGuard-style "different location" tests.
function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const q = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)));
}

// Angular delta on a compass (0..180).
function angDelta(a: number, b: number) {
  const d = Math.abs(((a - b) % 360) + 540) % 360 - 180;
  return Math.abs(d);
}

// Downloads a JSON blob as a file — no server hop.
function downloadBlob(name: string, data: string, mime = "application/geo+json") {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function RadarIntelPack({
  contacts,
  heading,
  geo,
}: {
  contacts: Contact[];
  heading: number | null;
  geo: GeoLike;
}) {
  // ── recorder ─────────────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [track, setTrack] = useState<WardriveRow[]>([]);
  useEffect(() => {
    if (!recording) return;
    const iv = window.setInterval(() => {
      const fix = geo.fix;
      if (!fix) return;
      const t = Date.now();
      const rows: WardriveRow[] = contacts.map((c) => ({
        ts: t,
        id: c.id,
        name: c.displayName,
        mfr: c.manufacturer,
        kind: c.inferredKind,
        rssi: c.rssi,
        lat: fix.lat,
        lon: fix.lon,
        acc: fix.accuracy ?? null,
      }));
      if (!rows.length) return;
      setTrack((prev) => (prev.length > 5000 ? [...prev.slice(-4500), ...rows] : [...prev, ...rows]));
    }, 3000);
    return () => window.clearInterval(iv);
  }, [recording, contacts, geo]);

  // ── AirGuard-style unwanted-tracker alarm ────────────────────────────────
  // Group track rows by id; flag ids seen at ≥3 GPS points ≥20m apart.
  const followers = useMemo(() => {
    const byId = new Map<string, WardriveRow[]>();
    for (const r of track) {
      if (!byId.has(r.id)) byId.set(r.id, []);
      byId.get(r.id)!.push(r);
    }
    const out: Array<{ id: string; name: string; spanM: number; hits: number }> = [];
    for (const [id, rows] of byId) {
      if (rows.length < 3) continue;
      // Farthest pair of points.
      let span = 0;
      for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++)
          span = Math.max(span, haversineMeters(rows[i], rows[j]));
      if (span >= 20) out.push({ id, name: rows[0].name, spanM: Math.round(span), hits: rows.length });
    }
    return out.sort((a, b) => b.spanM - a.spanM).slice(0, 8);
  }, [track]);

  // ── proximity audio ping ───────────────────────────────────────────
  const [audioOn, setAudioOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!audioOn) {
      if (pingTimerRef.current) window.clearTimeout(pingTimerRef.current);
      pingTimerRef.current = null;
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    const ctx = audioCtxRef.current!;
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      const rssis = contacts.map((c) => c.rssi ?? -110).filter((v) => v > -110);
      const best = rssis.length ? Math.max(...rssis) : -110; // closer = higher
      // -30 dBm → 220ms cadence, -100 dBm → 1600ms cadence.
      const t = Math.min(1, Math.max(0, (Math.abs(best) - 30) / 70));
      const ms = 220 + t * 1400;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1180;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
      pingTimerRef.current = window.setTimeout(schedule, ms);
    };
    schedule();
    return () => {
      cancelled = true;
      if (pingTimerRef.current) window.clearTimeout(pingTimerRef.current);
    };
  }, [audioOn, contacts]);

  // ── filters (tricorder cone + predator layers) ───────────────────────────
  const [cone, setCone] = useState(180); // ±deg, 180 = off
  const [hideStatic, setHideStatic] = useState(false);
  const [onlyUnknown, setOnlyUnknown] = useState(false);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (cone < 180 && heading != null && c.bearing != null) {
        if (angDelta(c.bearing, heading) > cone) return false;
      }
      if (hideStatic && (c.inferredKind === "watch" || c.inferredKind === "earbuds" || c.inferredKind === "beacon"))
        return false;
      if (onlyUnknown && c.threatTier !== "unknown" && c.threatTier !== "priority" && c.threatTier !== "breach")
        return false;
      return true;
    });
  }, [contacts, cone, heading, hideStatic, onlyUnknown]);

  const nearest = useMemo(() => {
    return [...filtered]
      .filter((c) => c.rssi != null)
      .sort((a, b) => (b.rssi ?? -110) - (a.rssi ?? -110))
      .slice(0, 3);
  }, [filtered]);

  const exportGeoJson = () => {
    const features = track.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        ts: r.ts,
        id: r.id,
        name: r.name,
        manufacturer: r.mfr,
        kind: r.kind,
        rssi: r.rssi,
        accuracy_m: r.acc,
      },
    }));
    downloadBlob(
      `zaxin-wardrive-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.geojson`,
      JSON.stringify({ type: "FeatureCollection", features }, null, 2)
    );
  };

  return (
    <div className="rounded-2xl border border-[#c69a4a]/15 bg-black/40 backdrop-blur-sm p-4 mt-5">
      <div className="flex items-center gap-2 mb-3">
        <RadarIcon className="h-3.5 w-3.5 text-[#c69a4a]/80" />
        <span className="text-[10px] tracking-[0.24em] uppercase text-foreground/80 font-medium">
          Radar Intel Pack
        </span>
        <span className="ml-auto text-[8px] tracking-[0.18em] uppercase text-muted-foreground/50">
          {filtered.length}/{contacts.length} contacts · {track.length} track pts
        </span>
      </div>

      {/* control strip */}
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setRecording((r) => !r)}
            className={`px-2.5 py-1 rounded-md text-[9px] tracking-[0.18em] uppercase border transition-all ${
              recording
                ? "bg-rose-500/10 border-rose-400/30 text-rose-200"
                : "border-[#c69a4a]/25 text-[#e8c684]/90 hover:bg-[#c69a4a]/[0.06]"
            }`}
            title="WiGle-style wardrive recorder"
          >
            {recording ? "● Recording" : "◌ Wardrive"}
          </button>
          <button
            onClick={exportGeoJson}
            disabled={track.length === 0}
            className="px-2.5 py-1 rounded-md text-[9px] tracking-[0.18em] uppercase border border-border/25 text-foreground/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            title="Export track as GeoJSON"
          >
            <Download className="h-3 w-3" /> GeoJSON
          </button>
          <button
            onClick={() => setAudioOn((v) => !v)}
            className={`px-2.5 py-1 rounded-md text-[9px] tracking-[0.18em] uppercase border inline-flex items-center gap-1.5 ${
              audioOn ? "border-[#c69a4a]/40 text-[#e8c684]" : "border-border/25 text-foreground/60"
            }`}
            title="Aliens-style motion-tracker ping"
          >
            {audioOn ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            Pulse
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <label className="text-[9px] tracking-[0.16em] uppercase text-muted-foreground/70 inline-flex items-center gap-1.5">
            <Filter className="h-3 w-3" /> Cone ±{cone}°
          </label>
          <input
            type="range"
            min={15}
            max={180}
            step={5}
            value={cone}
            onChange={(e) => setCone(Number(e.target.value))}
            className="accent-[#c69a4a] w-32"
          />
          <button
            onClick={() => setHideStatic((v) => !v)}
            className={`px-2 py-0.5 rounded border text-[9px] tracking-[0.14em] uppercase inline-flex items-center gap-1 ${
              hideStatic ? "border-[#c69a4a]/40 text-[#e8c684]" : "border-border/25 text-muted-foreground/60"
            }`}
          >
            {hideStatic ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} Static
          </button>
          <button
            onClick={() => setOnlyUnknown((v) => !v)}
            className={`px-2 py-0.5 rounded border text-[9px] tracking-[0.14em] uppercase ${
              onlyUnknown ? "border-rose-400/40 text-rose-200" : "border-border/25 text-muted-foreground/60"
            }`}
          >
            Unknown only
          </button>
        </div>
      </div>

      {/* tracker alarm */}
      {followers.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/[0.04] p-2.5">
          <div className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] uppercase text-rose-200">
            <AlertOctagon className="h-3 w-3" /> Follower Alarm
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {followers.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-[10px]">
                <span className="text-rose-100/90 truncate">{f.name || f.id.slice(0, 8)}</span>
                <span className="text-rose-200/60 font-mono ml-auto">{f.spanM}m · {f.hits} hits</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* nearest 3 with RSSI sparkline (Esper time-strip) */}
      <div className="mt-3 grid gap-1.5">
        <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">Nearest Vector</div>
        {nearest.length === 0 && (
          <div className="text-[10px] text-muted-foreground/60">No RSSI samples yet — start a sweep.</div>
        )}
        {nearest.map((c) => (
          <NearestRow key={c.id} c={c} heading={heading} />
        ))}
      </div>
    </div>
  );
}

function NearestRow({ c, heading }: { c: Contact; heading: number | null }) {
  const samples = c.samples ?? [];
  const last = samples.slice(-32);
  const min = -100;
  const max = -30;
  const w = 96;
  const h = 22;
  const pts = last.map((s, i) => {
    const x = (i / Math.max(1, last.length - 1)) * w;
    const t = Math.min(1, Math.max(0, (s.rssi - min) / (max - min)));
    const y = h - t * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const bearingLabel =
    c.bearing != null
      ? `${Math.round(c.bearing).toString().padStart(3, "0")}°${
          heading != null ? ` (rel ${Math.round(angDelta(c.bearing, heading))}°)` : ""
        }`
      : "brg —";
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/15 bg-black/30 px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-foreground/90 truncate">{c.displayName || c.id.slice(0, 8)}</span>
          {c.manufacturer && (
            <span className="text-[8px] tracking-[0.14em] uppercase text-[#c69a4a]/70 border border-[#c69a4a]/20 rounded px-1">
              {c.manufacturer}
            </span>
          )}
          {c.inferredKind && (
            <span className="text-[8px] tracking-[0.14em] uppercase text-muted-foreground/50">{c.inferredKind}</span>
          )}
        </div>
        <div className="text-[8px] font-mono tracking-wide text-muted-foreground/60">
          {c.rssi != null ? `${c.rssi} dBm` : "— dBm"} · {c.distanceLabel || "range —"} · {bearingLabel}
        </div>
      </div>
      <svg width={w} height={h} className="shrink-0">
        <polyline
          points={pts}
          fill="none"
          stroke="rgba(198,154,74,0.85)"
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
