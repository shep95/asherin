// AnalysisPanel — the elite-tier analytical surface of the Intelligence Map.
//
// NARRATIVE
// The layer tree tells the operator what is drawn. This panel tells them what
// the ground *means*: what a given point can physically see, how the terrain
// rises under a route, where the sun will put shadows at a chosen hour, which
// objects are standing on top of each other, and how to package all of it as a
// sourced product. It also partitions work into operations and records every
// mutation, so two investigations never contaminate each other.
//
// FLAWS THIS COMPONENT IS BUILT AGAINST
//  - setState after unmount during a multi-second terrain sweep → every async
//    run is guarded by a mounted ref and an AbortController that is torn down
//    on unmount and superseded on re-run.
//  - Double-submit → each analysis button is disabled for the whole run and
//    the in-flight controller is aborted before a new run starts.
//  - Silent failure → every result carries a `degraded` reason that is
//    surfaced verbatim; the panel never claims a computed figure it lacks.
//  - Missing four-state quartet → idle / running / empty / error are all
//    rendered explicitly for each product.
//  - Motion sickness → transitions are opacity/transform only and collapse to
//    instant under prefers-reduced-motion (handled by the global stylesheet).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye, Mountain, Sun, Link2, FileText, FolderOpen, Plus, Trash2, Camera,
  RotateCcw, Loader2, Download, ShieldAlert, History, Route as RouteIcon,
} from "lucide-react";
import {
  computeViewshed, elevationProfile, solarPosition, detectColocations,
  fmtM, compass, type ViewshedResult, type ElevationProfile, type SolarResult, type Colocation,
} from "@/lib/asher/geoAnalysis";
import { annoCenter, makeAnnotation, type MapAnnotation } from "@/lib/asher/mapAnnotations";
import {
  listCases, createCase, deleteCase, setActiveCaseId, setCaseClassification,
  listSnapshots, takeSnapshot, deleteSnapshot, listAudit,
  type MapCase, type MapSnapshot, type AuditEntry,
} from "@/lib/asher/mapCases";
import { exportOverlay, type ExportFormat, type BriefingContext } from "@/lib/asher/mapExport";
import { toast } from "sonner";

export interface AnalysisPanelProps {
  /** Observer / analysis anchor — selected entity, else map centre. */
  focus: { lat: number; lng: number } | null;
  annotations: MapAnnotation[];
  activeCaseId: string;
  mapCenter: { lat: number; lng: number; zoom: number };
  baseLayer: string;
  activeLayers: string[];
  onAddAnnotation: (a: MapAnnotation) => void;
  onViewshed: (v: ViewshedResult | null) => void;
  onSwitchCase: (caseId: string) => void;
  onRestoreSnapshot: (annotations: MapAnnotation[]) => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
}

type Product = "viewshed" | "profile" | "solar" | "coloc" | null;

const Section = ({ icon: Icon, title, children, right }: {
  icon: LucideIcon;
  title: string; children: React.ReactNode; right?: React.ReactNode;
}) => (
  <div className="border-t border-border/15">
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-[10px] font-light uppercase tracking-[0.3em] text-muted-foreground">{title}</p>
      </div>
      {right}
    </div>
    <div className="px-3 pb-3">{children}</div>
  </div>
);

const Btn = ({ children, onClick, disabled, danger, active }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; active?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] tracking-wide transition-colors disabled:opacity-30 ${
      active
        ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
        : danger
          ? "border-border/25 text-muted-foreground hover:border-red-400/40 hover:text-red-400"
          : "border-border/25 bg-background/30 text-muted-foreground hover:border-border/40 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">{k}</span>
    <span className="font-mono text-[10px] text-foreground/90">{v}</span>
  </div>
);

/** Inline SVG terrain cross-section — no chart dependency, no layout shift. */
const ProfileChart = ({ profile }: { profile: ElevationProfile }) => {
  const pts = profile.samples.filter((s) => s.elevM != null) as Array<{ distM: number; elevM: number }>;
  if (pts.length < 2) return null;
  const W = 320, H = 72;
  const minE = Math.min(...pts.map((p) => p.elevM));
  const maxE = Math.max(...pts.map((p) => p.elevM));
  const span = Math.max(1, maxE - minE);
  const total = Math.max(1, profile.totalM);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${((p.distM / total) * W).toFixed(1)},${(H - ((p.elevM - minE) / span) * (H - 8) - 4).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Terrain cross-section" className="mt-1.5">
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="hsl(var(--foreground) / 0.08)" />
      <path d={d} fill="none" stroke="hsl(var(--foreground) / 0.6)" strokeWidth="1.2" />
    </svg>
  );
};

const AnalysisPanel = ({
  focus, annotations, activeCaseId, mapCenter, baseLayer, activeLayers,
  onAddAnnotation, onViewshed, onSwitchCase, onRestoreSnapshot, onFlyTo,
}: AnalysisPanelProps) => {
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const [running, setRunning] = useState<Product>(null);
  const [error, setError] = useState<string | null>(null);

  const [viewshed, setViewshed] = useState<ViewshedResult | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [eyeM, setEyeM] = useState(2);

  const [profile, setProfile] = useState<ElevationProfile | null>(null);
  const [profileLabel, setProfileLabel] = useState<string>("");

  const [solar, setSolar] = useState<SolarResult | null>(null);
  const [solarWhen, setSolarWhen] = useState(() => new Date().toISOString().slice(0, 16));

  const [coloc, setColoc] = useState<Colocation[] | null>(null);
  const [colocM, setColocM] = useState(60);

  const [cases, setCases] = useState<MapCase[]>(() => listCases());
  const [snaps, setSnaps] = useState<MapSnapshot[]>(() => listSnapshots(activeCaseId));
  const [audit, setAudit] = useState<AuditEntry[]>(() => listAudit(activeCaseId));
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => () => { mounted.current = false; abortRef.current?.abort(); }, []);

  // Case switch invalidates every product — stale analysis of another
  // operation's geometry is worse than no analysis.
  useEffect(() => {
    setSnaps(listSnapshots(activeCaseId));
    setAudit(listAudit(activeCaseId));
    setViewshed(null); onViewshed(null);
    setProfile(null); setColoc(null); setError(null);
  }, [activeCaseId, onViewshed]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) ?? cases[0],
    [cases, activeCaseId],
  );

  const beginRun = (p: Product) => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setError(null);
    setRunning(p);
    return ctl.signal;
  };
  const endRun = () => { if (mounted.current) setRunning(null); };

  /* ── Viewshed ─────────────────────────────────────────────────────── */
  const runViewshed = useCallback(async () => {
    if (!focus) { setError("No anchor point — click the map or select an entity first."); return; }
    const signal = beginRun("viewshed");
    try {
      const res = await computeViewshed(focus, radiusKm * 1000, eyeM, { signal });
      if (!mounted.current) return;
      setViewshed(res);
      onViewshed(res.ring.length ? res : null);
      if (res.degraded) setError(res.degraded);
      else {
        onAddAnnotation(makeAnnotation({
          kind: "polygon",
          label: `Viewshed · ${radiusKm} km @ ${eyeM} m`,
          path: res.ring,
          category: "observation",
          role: "viewshed",
          confidence: Math.round(res.coverage * 100),
          note: `Line-of-sight from ${focus.lat.toFixed(5)}, ${focus.lng.toFixed(5)} · ${(res.visibleFraction * 100).toFixed(0)}% of radius unobstructed · Copernicus GLO-30 terrain`,
          source: "operator",
        }));
      }
    } catch (e: any) {
      if (mounted.current && e?.name !== "AbortError") setError(e?.message ?? "Viewshed failed.");
    } finally { endRun(); }
  }, [focus, radiusKm, eyeM, onViewshed, onAddAnnotation]);

  /* ── Elevation profile ────────────────────────────────────────────── */
  const routeAnnos = useMemo(
    () => annotations.filter((a) => (a.kind === "line" || a.kind === "polygon") && (a.path?.length ?? 0) >= 2),
    [annotations],
  );

  const runProfile = useCallback(async (anno: MapAnnotation) => {
    const signal = beginRun("profile");
    setProfileLabel(anno.label);
    try {
      const res = await elevationProfile(anno.path!, 96, signal);
      if (!mounted.current) return;
      setProfile(res);
      if (res.degraded) setError(res.degraded);
    } catch (e: any) {
      if (mounted.current && e?.name !== "AbortError") setError(e?.message ?? "Profile failed.");
    } finally { endRun(); }
  }, []);

  /* ── Solar / shadow ───────────────────────────────────────────────── */
  const runSolar = useCallback(() => {
    if (!focus) { setError("No anchor point for solar geometry."); return; }
    const when = new Date(solarWhen);
    if (Number.isNaN(when.getTime())) { setError("Invalid timestamp."); return; }
    setError(null);
    setSolar(solarPosition(focus, when));
  }, [focus, solarWhen]);

  /* ── Co-location ──────────────────────────────────────────────────── */
  const runColoc = useCallback(() => {
    setError(null);
    const pts = annotations
      .map((a) => ({ id: a.id, label: a.label, ...(annoCenter(a) ?? {}) }))
      .filter((p) => p.lat != null && p.lng != null);
    setColoc(detectColocations(pts as any, colocM));
  }, [annotations, colocM]);

  /* ── Cases, snapshots, export ─────────────────────────────────────── */
  const refreshCases = () => setCases(listCases());

  const briefingCtx: BriefingContext | undefined = activeCase
    ? {
        caseRec: activeCase,
        annotations,
        mapCenter,
        baseLayer,
        activeLayers,
        colocations: coloc?.map((c) => ({ aLabel: c.aLabel, bLabel: c.bLabel, distanceM: c.distanceM })),
        analysisNotes: [
          viewshed && !viewshed.degraded
            ? `Viewshed from ${viewshed.observer.lat.toFixed(5)}, ${viewshed.observer.lng.toFixed(5)} at ${viewshed.observerHeightM} m eye height: ${(viewshed.visibleFraction * 100).toFixed(0)}% of a ${fmtM(viewshed.radiusM)} radius unobstructed (~${viewshed.approxAreaKm2.toFixed(2)} km²), terrain coverage ${(viewshed.coverage * 100).toFixed(0)}%.`
            : null,
          profile && !profile.degraded
            ? `Terrain profile "${profileLabel}": ${fmtM(profile.totalM)} run, ${profile.minM?.toFixed(0)}–${profile.maxM?.toFixed(0)} m, +${profile.gainM.toFixed(0)} m gain / -${profile.lossM.toFixed(0)} m loss, max grade ${profile.maxGradePct.toFixed(1)}%.`
            : null,
          solar
            ? `Solar geometry at anchor: elevation ${solar.elevationDeg.toFixed(1)}°, azimuth ${solar.azimuthDeg.toFixed(1)}° (${compass(solar.azimuthDeg)}), shadows cast toward ${solar.shadowBearingDeg.toFixed(0)}° at ${solar.shadowRatio ? `${solar.shadowRatio.toFixed(2)}×` : "n/a — sun below horizon"} object height.`
            : null,
        ].filter((x): x is string => !!x),
      }
    : undefined;

  const doExport = (fmt: ExportFormat) => {
    if (!annotations.length && fmt !== "briefing") { toast.error("Overlay is empty."); return; }
    exportOverlay(fmt, annotations, briefingCtx);
    toast.success(`Exported ${fmt.toUpperCase()}`);
  };

  return (
    <>
      {/* ── OPERATIONS ─────────────────────────────────────────────── */}
      <Section
        icon={FolderOpen}
        title="Operations"
        right={
          <Btn onClick={() => { const name = window.prompt("Operation name")?.trim(); if (name) { createCase(name); refreshCases(); onSwitchCase(listCases().slice(-1)[0].id); } }}>
            <Plus className="h-3 w-3" /> New
          </Btn>
        }
      >
        <select
          value={activeCaseId}
          onChange={(e) => { setActiveCaseId(e.target.value); onSwitchCase(e.target.value); }}
          aria-label="Active operation"
          className="w-full rounded-md border border-border/25 bg-background/40 px-2 py-1 text-[11px] text-foreground focus:outline-none"
        >
          {cases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="mt-1.5 flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <select
            value={activeCase?.classification ?? "UNCLASSIFIED"}
            onChange={(e) => { setCaseClassification(activeCaseId, e.target.value as MapCase["classification"]); refreshCases(); }}
            aria-label="Classification"
            className="flex-1 rounded-md border border-border/25 bg-background/40 px-2 py-1 text-[10px] tracking-wide text-foreground focus:outline-none"
          >
            <option value="UNCLASSIFIED">UNCLASSIFIED</option>
            <option value="SENSITIVE">SENSITIVE</option>
            <option value="RESTRICTED">RESTRICTED</option>
          </select>
          {cases.length > 1 && (
            <Btn danger onClick={() => { const next = deleteCase(activeCaseId); refreshCases(); onSwitchCase(next); }}>
              <Trash2 className="h-3 w-3" />
            </Btn>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn onClick={() => { const s = takeSnapshot(activeCaseId, `${annotations.length} objects`, annotations); setSnaps([s, ...snaps]); setAudit(listAudit(activeCaseId)); toast.success("Snapshot taken"); }}>
            <Camera className="h-3 w-3" /> Snapshot
          </Btn>
          <Btn onClick={() => setShowAudit((v) => !v)} active={showAudit}>
            <History className="h-3 w-3" /> Audit
          </Btn>
        </div>

        {snaps.length > 0 && (
          <div className="mt-2 space-y-1">
            {snaps.slice(0, 5).map((s) => (
              <div key={s.id} className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-foreground/5">
                <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/80">{s.label}</span>
                <span className="font-mono text-[9px] text-muted-foreground/60">{new Date(s.takenAt).toLocaleTimeString()}</span>
                <button onClick={() => { onRestoreSnapshot(s.annotations); toast.success("Snapshot restored"); }} title="Restore" className="text-muted-foreground hover:text-emerald-400">
                  <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
                </button>
                <button onClick={() => { deleteSnapshot(s.id); setSnaps(snaps.filter((x) => x.id !== s.id)); }} title="Delete snapshot" className="text-muted-foreground hover:text-red-400">
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAudit && (
          <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border/20 bg-background/30 p-1.5">
            {audit.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60">No recorded actions in this operation.</p>
            ) : audit.map((e) => (
              <p key={e.id} className="font-mono text-[9px] leading-relaxed text-muted-foreground/80">
                {new Date(e.at).toLocaleTimeString()} · {e.actor} · {e.action}{e.detail ? ` · ${e.detail}` : ""}
              </p>
            ))}
          </div>
        )}
      </Section>

      {/* ── VIEWSHED ───────────────────────────────────────────────── */}
      <Section icon={Eye} title="Line of Sight">
        <div className="flex items-center gap-2">
          <label className="flex-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Radius {radiusKm} km
            <input type="range" min={1} max={30} step={1} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="mt-1 w-full accent-emerald-400" />
          </label>
          <label className="flex-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Eye {eyeM} m
            <input type="range" min={1} max={120} step={1} value={eyeM} onChange={(e) => setEyeM(Number(e.target.value))} className="mt-1 w-full accent-emerald-400" />
          </label>
        </div>
        <div className="mt-2">
          <Btn onClick={runViewshed} disabled={running !== null || !focus}>
            {running === "viewshed" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
            {running === "viewshed" ? "Casting rays…" : "Run viewshed"}
          </Btn>
        </div>
        {!focus && <p className="mt-1.5 text-[10px] text-muted-foreground/60">Click the map to set an observer point.</p>}
        {running === "viewshed" && (
          <div className="mt-2 space-y-1" aria-live="polite">
            {[0, 1, 2].map((i) => <div key={i} className="h-3 animate-pulse rounded bg-foreground/5" />)}
          </div>
        )}
        {viewshed && running !== "viewshed" && !viewshed.degraded && (
          <div className="mt-2 rounded border border-border/20 bg-background/30 px-2 py-1.5">
            <Stat k="Observer elev" v={viewshed.observerElevM != null ? `${viewshed.observerElevM.toFixed(0)} m` : "—"} />
            <Stat k="Unobstructed" v={`${(viewshed.visibleFraction * 100).toFixed(0)}% of ${fmtM(viewshed.radiusM)}`} />
            <Stat k="Visible area" v={`~${viewshed.approxAreaKm2.toFixed(2)} km²`} />
            <Stat k="DEM coverage" v={`${(viewshed.coverage * 100).toFixed(0)}%`} />
            <Stat k="Best sector" v={(() => {
              const best = [...viewshed.rays].sort((a, b) => b.visibleM - a.visibleM)[0];
              return best ? `${compass(best.bearing)} · ${fmtM(best.visibleM)}` : "—";
            })()} />
          </div>
        )}
      </Section>

      {/* ── TERRAIN PROFILE ────────────────────────────────────────── */}
      <Section icon={Mountain} title="Terrain Profile">
        {routeAnnos.length === 0 ? (
          <p className="text-[10px] font-extralight leading-relaxed text-muted-foreground/60">
            Draw a route or zone first — the profile is sampled along its geometry.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {routeAnnos.slice(0, 6).map((a) => (
              <Btn key={a.id} onClick={() => runProfile(a)} disabled={running !== null}>
                {running === "profile" && profileLabel === a.label ? <Loader2 className="h-3 w-3 animate-spin" /> : <RouteIcon className="h-3 w-3" />}
                <span className="max-w-[110px] truncate">{a.label}</span>
              </Btn>
            ))}
          </div>
        )}
        {profile && running !== "profile" && !profile.degraded && (
          <div className="mt-2 rounded border border-border/20 bg-background/30 px-2 py-1.5">
            <p className="mb-0.5 truncate text-[10px] text-foreground/80">{profileLabel}</p>
            <ProfileChart profile={profile} />
            <Stat k="Run" v={fmtM(profile.totalM)} />
            <Stat k="Range" v={profile.minM != null ? `${profile.minM.toFixed(0)} – ${profile.maxM?.toFixed(0)} m` : "—"} />
            <Stat k="Gain / loss" v={`+${profile.gainM.toFixed(0)} / -${profile.lossM.toFixed(0)} m`} />
            <Stat k="Max grade" v={`${profile.maxGradePct.toFixed(1)}%`} />
            <Stat k="DEM coverage" v={`${(profile.coverage * 100).toFixed(0)}%`} />
          </div>
        )}
      </Section>

      {/* ── SOLAR ──────────────────────────────────────────────────── */}
      <Section icon={Sun} title="Solar & Shadow">
        <div className="flex items-center gap-1.5">
          <input
            type="datetime-local"
            value={solarWhen}
            onChange={(e) => setSolarWhen(e.target.value)}
            aria-label="Timestamp for solar geometry"
            className="min-w-0 flex-1 rounded-md border border-border/25 bg-background/40 px-2 py-1 text-[10px] text-foreground focus:outline-none"
          />
          <Btn onClick={runSolar} disabled={!focus}><Sun className="h-3 w-3" /> Solve</Btn>
        </div>
        {solar && (
          <div className="mt-2 rounded border border-border/20 bg-background/30 px-2 py-1.5">
            <Stat k="Sun elevation" v={`${solar.elevationDeg.toFixed(1)}°`} />
            <Stat k="Sun azimuth" v={`${solar.azimuthDeg.toFixed(1)}° ${compass(solar.azimuthDeg)}`} />
            <Stat k="Daylight" v={solar.isDaylight ? "yes" : "no — below horizon"} />
            <Stat k="Shadow bearing" v={`${solar.shadowBearingDeg.toFixed(0)}° ${compass(solar.shadowBearingDeg)}`} />
            <Stat k="Shadow length" v={solar.shadowRatio ? `${solar.shadowRatio.toFixed(2)} × height` : "—"} />
            <Stat k="Solar noon (UTC)" v={`${String(Math.floor(solar.solarNoonUtcHours)).padStart(2, "0")}:${String(Math.round((solar.solarNoonUtcHours % 1) * 60)).padStart(2, "0")}`} />
          </div>
        )}
      </Section>

      {/* ── CO-LOCATION ────────────────────────────────────────────── */}
      <Section icon={Link2} title="Co-location">
        <div className="flex items-center gap-1.5">
          <label className="flex-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Threshold {colocM} m
            <input type="range" min={10} max={500} step={10} value={colocM} onChange={(e) => setColocM(Number(e.target.value))} className="mt-1 w-full accent-emerald-400" />
          </label>
          <Btn onClick={runColoc} disabled={annotations.length < 2}><Link2 className="h-3 w-3" /> Scan</Btn>
        </div>
        {coloc && (
          coloc.length === 0 ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground/60">No objects within {colocM} m of each other.</p>
          ) : (
            <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
              {coloc.slice(0, 20).map((c, i) => (
                <button
                  key={`${c.aId}-${c.bId}-${i}`}
                  onClick={() => onFlyTo(c.center.lat, c.center.lng, 17)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-foreground/5"
                >
                  <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/80">{c.aLabel} ↔ {c.bLabel}</span>
                  <span className="font-mono text-[9px] text-amber-300/80">{c.distanceM.toFixed(0)} m</span>
                </button>
              ))}
            </div>
          )
        )}
      </Section>

      {/* ── PRODUCT EXPORT ─────────────────────────────────────────── */}
      <Section icon={FileText} title="Intelligence Product">
        <div className="flex flex-wrap gap-1.5">
          <Btn onClick={() => doExport("briefing")}><FileText className="h-3 w-3" /> Briefing</Btn>
          <Btn onClick={() => doExport("geojson")}><Download className="h-3 w-3" /> GeoJSON</Btn>
          <Btn onClick={() => doExport("kml")}><Download className="h-3 w-3" /> KML</Btn>
          <Btn onClick={() => doExport("gpx")}><Download className="h-3 w-3" /> GPX</Btn>
          <Btn onClick={() => doExport("csv")}><Download className="h-3 w-3" /> CSV/WKT</Btn>
        </div>
      </Section>

      {error && (
        <div role="alert" className="mx-3 mb-3 rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-2">
          <p className="text-[10px] font-light leading-relaxed text-amber-200/90">{error}</p>
        </div>
      )}
    </>
  );
};

export default AnalysisPanel;
