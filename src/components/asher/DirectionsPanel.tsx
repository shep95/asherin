// DirectionsPanel — Asherin Maps turn-by-turn navigation surface.
//
// Parity with what people actually use in Google Maps, plus the fixes the
// review corpus complains about most: honest ETAs, alternatives you can see
// before committing, a unit toggle, avoid-options, per-step highlighting, and
// street cameras along the corridor.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, Car, Bike, Footprints, X, Loader2, Repeat, MapPin,
  CornerUpLeft, CornerUpRight, ArrowUp, RotateCw, Flag, Camera, Ruler,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDirections, fmtDistance, fmtDuration, fmtEta,
  type AvoidOption, type DirectionsResult, type RouteOption, type TravelMode, type Units,
} from "@/lib/asher/directions";
import { fetchStreetCameras, type StreetCamera } from "@/lib/asher/streetCameras";

export interface DirectionsEndpoint {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  units: Units;
  onUnitsChange: (u: Units) => void;
  myFix: { lat: number; lng: number } | null;
  onRequestMyLocation: () => void;
  /** Destination seeded from the map (search pick / AI tool / right-click). */
  seedDestination?: DirectionsEndpoint | null;
  geocode: (q: string) => Promise<DirectionsEndpoint | null>;
  /** Push the drawn corridor + alternatives up to the map. */
  onRoutes: (payload: { routes: RouteOption[]; activeId: string | null; highlight: Array<{ lat: number; lng: number }> | null }) => void;
  onCameras: (cams: StreetCamera[]) => void;
  onFitPath: (path: Array<{ lat: number; lng: number }>) => void;
}

const MODES: Array<{ id: TravelMode; label: string; Icon: typeof Car }> = [
  { id: "driving", label: "Drive", Icon: Car },
  { id: "walking", label: "Walk", Icon: Footprints },
  { id: "cycling", label: "Cycle", Icon: Bike },
];

const AVOIDS: Array<{ id: AvoidOption; label: string }> = [
  { id: "toll", label: "Tolls" },
  { id: "motorway", label: "Highways" },
  { id: "ferry", label: "Ferries" },
];

function StepIcon({ maneuver, modifier }: { maneuver: string; modifier?: string }) {
  const cls = "h-3.5 w-3.5 text-[#c98b3a]";
  if (maneuver === "arrive") return <Flag className={cls} strokeWidth={1.6} />;
  if (maneuver === "roundabout" || maneuver === "rotary") return <RotateCw className={cls} strokeWidth={1.6} />;
  if (modifier?.includes("left")) return <CornerUpLeft className={cls} strokeWidth={1.6} />;
  if (modifier?.includes("right")) return <CornerUpRight className={cls} strokeWidth={1.6} />;
  return <ArrowUp className={cls} strokeWidth={1.6} />;
}

const DirectionsPanel = ({
  open, onClose, units, onUnitsChange, myFix, onRequestMyLocation,
  seedDestination, geocode, onRoutes, onCameras, onFitPath,
}: Props) => {
  const [fromText, setFromText] = useState("My location");
  const [toText, setToText] = useState("");
  const [from, setFrom] = useState<DirectionsEndpoint | null>(null);
  const [to, setTo] = useState<DirectionsEndpoint | null>(null);
  const [mode, setMode] = useState<TravelMode>("driving");
  const [avoid, setAvoid] = useState<AvoidOption[]>([]);
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camBusy, setCamBusy] = useState(false);
  const [camNote, setCamNote] = useState<string | null>(null);
  const [camCount, setCamCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  // The parent callbacks are re-created every render; hold them in a ref so the
  // routing effect does not re-fire on every parent paint.
  const cbRef = useRef({ onRoutes, onCameras, onFitPath });
  cbRef.current = { onRoutes, onCameras, onFitPath };

  useEffect(() => {
    if (seedDestination) {
      setTo(seedDestination);
      setToText(seedDestination.label);
    }
  }, [seedDestination]);

  const activeRoute = result?.routes.find((r) => r.id === activeId) || result?.routes[0] || null;

  const run = useCallback(async () => {
    setError(null);
    let origin = from;
    if (!origin) {
      if (fromText.trim().toLowerCase() === "my location" || !fromText.trim()) {
        if (!myFix) {
          onRequestMyLocation();
          setError("Waiting on your location fix — approve the prompt, then run directions again.");
          return;
        }
        origin = { label: "My location", lat: myFix.lat, lng: myFix.lng };
      } else {
        origin = await geocode(fromText.trim());
        if (!origin) { setError(`Could not resolve "${fromText}".`); return; }
        setFrom(origin);
      }
    }

    let dest = to;
    if (!dest) {
      if (!toText.trim()) { setError("Enter a destination."); return; }
      dest = await geocode(toText.trim());
      if (!dest) { setError(`Could not resolve "${toText}".`); return; }
      setTo(dest);
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setCamCount(0);
    setCamNote(null);
    cbRef.current.onCameras([]);
    try {
      const res = await getDirections(
        [{ lat: origin.lat, lng: origin.lng }, { lat: dest.lat, lng: dest.lng }],
        { mode, avoid, signal: ctrl.signal },
      );
      if (ctrl.signal.aborted) return;
      setResult(res);
      const first = res.routes[0] || null;
      setActiveId(first?.id ?? null);
      cbRef.current.onRoutes({ routes: res.routes, activeId: first?.id ?? null, highlight: null });
      if (first) cbRef.current.onFitPath(first.path);
      if (!res.routes.length) setError("No route found between those points.");
    } catch (e: any) {
      if (!ctrl.signal.aborted) setError(e?.message || "Routing failed.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, [from, to, fromText, toText, mode, avoid, myFix, geocode, onRequestMyLocation]);

  // Cancel any in-flight route when the panel unmounts — no setState on a dead
  // component, no orphaned request burning the public OSRM quota.
  useEffect(() => () => abortRef.current?.abort(), []);

  const pickRoute = (r: RouteOption) => {
    setActiveId(r.id);
    cbRef.current.onRoutes({ routes: result?.routes || [], activeId: r.id, highlight: null });
    cbRef.current.onFitPath(r.path);
  };

  const swap = () => {
    setFrom(to); setTo(from);
    setFromText(toText || "My location"); setToText(fromText === "My location" ? "" : fromText);
    setResult(null); setActiveId(null);
    cbRef.current.onRoutes({ routes: [], activeId: null, highlight: null });
  };

  const loadCameras = async () => {
    if (!activeRoute?.path.length) return;
    setCamBusy(true);
    setCamNote(null);
    try {
      const sweep = await fetchStreetCameras({ path: activeRoute.path, radiusM: 900, limit: 80 });
      cbRef.current.onCameras(sweep.cameras);
      setCamCount(sweep.cameras.length);
      setCamNote(sweep.coverageNote || (sweep.sources.length ? `Feeds: ${sweep.sources.join(", ")}` : null));
      if (!sweep.cameras.length) toast.info("No cameras found along this corridor.");
    } catch (e: any) {
      setCamNote(`Camera sweep failed: ${e?.message || "network"}`);
    } finally {
      setCamBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="flex max-h-[calc(100vh-8rem)] w-[340px] flex-col overflow-hidden rounded-xl border border-[#c98b3a]/25 bg-card/95 backdrop-blur-xl shadow-[0_18px_50px_-12px_rgba(0,0,0,.85)]">
      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2.5">
        <ArrowUpRight className="h-4 w-4 text-[#c98b3a]" strokeWidth={1.6} />
        <p className="flex-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Directions</p>
        <button
          onClick={() => onUnitsChange(units === "metric" ? "imperial" : "metric")}
          className="rounded border border-border/30 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          title="Toggle distance units"
        >
          <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{units === "metric" ? "km" : "mi"}</span>
        </button>
        <button onClick={onClose} aria-label="Close directions" className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 border-b border-border/15 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 space-y-1.5">
            <input
              value={fromText}
              onChange={(e) => { setFromText(e.target.value); setFrom(null); }}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Start — or 'My location'"
              className="w-full rounded-md border border-border/25 bg-background/60 px-2 py-1.5 text-[11px] font-light text-foreground outline-none focus:border-[#c98b3a]/50"
            />
            <input
              value={toText}
              onChange={(e) => { setToText(e.target.value); setTo(null); }}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Destination"
              className="w-full rounded-md border border-border/25 bg-background/60 px-2 py-1.5 text-[11px] font-light text-foreground outline-none focus:border-[#c98b3a]/50"
            />
          </div>
          <button onClick={swap} title="Swap start and destination" aria-label="Swap start and destination"
            className="rounded-md border border-border/25 p-1.5 text-muted-foreground hover:text-foreground">
            <Repeat className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex gap-1">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] transition-colors ${
                mode === id ? "border-[#c98b3a]/50 bg-[#c98b3a]/10 text-[#e0a955]" : "border-border/25 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />{label}
            </button>
          ))}
        </div>

        {mode === "driving" && (
          <div className="flex flex-wrap gap-1">
            {AVOIDS.map((a) => {
              const on = avoid.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => setAvoid((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                  className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                    on ? "border-[#c98b3a]/50 bg-[#c98b3a]/10 text-[#e0a955]" : "border-border/25 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Avoid {a.label}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={run}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#c98b3a]/40 bg-[#c98b3a]/10 px-2 py-1.5 text-[11px] font-medium text-[#e0a955] transition-colors hover:bg-[#c98b3a]/20 disabled:opacity-50"
        >
          {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />Routing…</> : <>Get directions</>}
        </button>

        {error && (
          <p role="alert" className="text-[10px] leading-snug text-red-400">{error}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {busy && !result && (
          <div className="space-y-2 p-3" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-md bg-foreground/5 motion-reduce:animate-none" />)}
          </div>
        )}

        {!busy && !result && (
          <p className="px-3 py-4 text-[10px] font-light leading-relaxed text-muted-foreground">
            Enter two points to route them over the live OpenStreetMap road graph.
            Alternatives, turn-by-turn manoeuvres and corridor cameras appear here.
          </p>
        )}

        {result?.routes.map((r) => {
          const on = r.id === activeId;
          return (
            <div key={r.id} className={`border-b border-border/10 ${on ? "bg-[#c98b3a]/[0.06]" : ""}`}>
              <button onClick={() => pickRoute(r)} className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-foreground/5">
                <span className={`text-[13px] font-medium ${on ? "text-[#e0a955]" : "text-foreground"}`}>{fmtDuration(r.durationS)}</span>
                <span className="text-[11px] text-muted-foreground">{fmtDistance(r.distanceM, units)}</span>
                <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  {r.durationS > 0 ? `ETA ${fmtEta(r.durationS)}` : ""}
                </span>
              </button>
              <p className="px-3 pb-2 text-[10px] font-light text-muted-foreground">{r.summary}</p>
              {r.degraded && <p className="px-3 pb-2 text-[10px] text-amber-400">{r.degraded}</p>}
              {r.constraintWarning && <p className="px-3 pb-2 text-[10px] text-amber-400">{r.constraintWarning}</p>}

              {on && r.steps.length > 0 && (
                <ol className="space-y-0.5 px-3 pb-3">
                  {r.steps.map((s, i) => (
                    <li
                      key={i}
                      onMouseEnter={() => cbRef.current.onRoutes({ routes: result.routes, activeId, highlight: s.path })}
                      onMouseLeave={() => cbRef.current.onRoutes({ routes: result.routes, activeId, highlight: null })}
                      className="flex items-start gap-2 rounded px-1 py-1 hover:bg-foreground/5"
                    >
                      <span className="mt-0.5"><StepIcon maneuver={s.maneuver} modifier={s.modifier} /></span>
                      <span className="flex-1 text-[11px] font-light leading-snug text-foreground/90">{s.text}</span>
                      <span className="shrink-0 text-[9px] text-muted-foreground">{fmtDistance(s.distanceM, units)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {activeRoute && (
        <div className="space-y-1 border-t border-border/15 px-3 py-2">
          <button
            onClick={loadCameras}
            disabled={camBusy}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/30 px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-[#c98b3a]/40 hover:text-[#e0a955] disabled:opacity-50"
          >
            {camBusy
              ? <><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />Sweeping corridor…</>
              : <><Camera className="h-3 w-3" />Street cameras along route{camCount ? ` · ${camCount}` : ""}</>}
          </button>
          {camNote && <p className="text-[9px] leading-snug text-muted-foreground/80">{camNote}</p>}
          <p className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
            <MapPin className="h-2.5 w-2.5" />{result?.attribution}
          </p>
        </div>
      )}
    </div>
  );
};

export default DirectionsPanel;
