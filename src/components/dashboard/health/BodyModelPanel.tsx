import { useMemo, useRef, useState } from "react";
import { Camera, Loader2, Ruler, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invokeWithByokRetry } from "@/lib/byokInvoke";
import {
  BANDS,
  BODY_VIEWS,
  bodyTrends,
  describeEstimate,
  solveBodyModel,
  type BodyMeasurements,
  type BodyView,
  type CapturedView,
  type Sex,
  type ViewAnalysis,
} from "@/lib/health/bodyModel";
import {
  SURFACE_LIMITS,
  SURFACE_MODULES,
  lesionTracks,
  phraseObservation,
  surfaceDeltas,
  type SurfaceModule,
  type SurfaceObservation,
} from "@/lib/health/surface";
import { newId, type HealthRecord } from "@/lib/health/store";

interface Props {
  record: HealthRecord;
  persist: (r: HealthRecord) => void;
  resolveByok: () => Promise<Record<string, string> | undefined>;
  onEvent: (line: string) => void;
}

/** photographs are shrunk on device before they leave it: smaller payload, faster read, less to expose. */
async function fileToCapture(file: File, view: BodyView): Promise<CapturedView> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("this browser could not process the photograph.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return { view, dataUrl: canvas.toDataURL("image/jpeg", 0.82), width: w, height: h, capturedAt: new Date().toISOString() };
}

function splitDataUrl(dataUrl: string): { mime: string; b64: string } {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  return { mime, b64: b64 ?? "" };
}

function num(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function BodyModelPanel({ record, persist, resolveByok, onEvent }: Props) {
  const body = record.body;
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanModule, setScanModule] = useState<SurfaceModule>("skin");
  const [scanRegion, setScanRegion] = useState("");
  const [lesionKey, setLesionKey] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scanRef = useRef<HTMLInputElement | null>(null);

  const measurements = body.measurements;
  const latest = body.solves.length ? body.solves[body.solves.length - 1] : null;
  const trends = useMemo(() => bodyTrends(body.solves), [body.solves]);
  const deltas = useMemo(() => surfaceDeltas(record.observations), [record.observations]);
  const lesions = useMemo(() => lesionTracks(record.observations), [record.observations]);

  const setMeasurement = (patch: Partial<BodyMeasurements>) =>
    persist({ ...record, body: { ...body, measurements: { ...measurements, ...patch } } });

  const capture = async (view: BodyView, file: File | null) => {
    if (!file) return;
    try {
      const shot = await fileToCapture(file, view);
      persist({ ...record, body: { ...body, captures: [...body.captures.filter((c) => c.view !== view), shot] } });
      toast.success(`${view} view captured. it stays on this device.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "that photograph could not be read.");
    }
  };

  const solve = async () => {
    if (body.captures.length === 0) {
      toast.error("capture at least the front view first.");
      return;
    }
    setBusy(true);
    try {
      const byok = await resolveByok();
      const images = body.captures.map((c) => ({ view: c.view, ...splitDataUrl(c.dataUrl) }));
      const data = await invokeWithByokRetry<{ views?: unknown[]; note?: string; error?: string }>("asherin-health-ai", {
        body: { action: "body.views", images, ...(byok ? { byok } : {}) },
      });
      if (data?.error) throw new Error(data.error);
      const analyses: ViewAnalysis[] = (data?.views ?? []).map((raw: any) => ({
        view: (BODY_VIEWS.find((v) => v.id === raw?.view)?.id ?? "front") as BodyView,
        subjectFrameFraction: Number(raw?.subjectFrameFraction) || 0,
        bands: Array.isArray(raw?.bands)
          ? raw.bands
              .filter((b: any) => BANDS.some((x) => x.id === b?.band) && Number(b?.widthFraction) > 0)
              .map((b: any) => ({
                band: b.band,
                widthFraction: Math.min(0.6, Number(b.widthFraction)),
                confidence: Math.max(0, Math.min(1, Number(b?.confidence) || 0.5)),
              }))
          : [],
        posture: Array.isArray(raw?.posture)
          ? raw.posture.slice(0, 3).map((p: any) => ({ note: String(p?.note ?? "").slice(0, 160), confidence: Math.max(0, Math.min(1, Number(p?.confidence) || 0.4)) }))
          : [],
        quality: {
          lighting: Math.max(0, Math.min(1, Number(raw?.quality?.lighting) || 0.5)),
          pose: Math.max(0, Math.min(1, Number(raw?.quality?.pose) || 0.5)),
          clothing: Math.max(0, Math.min(1, Number(raw?.quality?.clothing) || 0.5)),
          framing: Math.max(0, Math.min(1, Number(raw?.quality?.framing) || 0.5)),
        },
      }));
      if (analyses.length === 0) throw new Error("no geometry came back from those photographs.");
      const nextSolve = solveBodyModel(analyses, measurements, newId("solve"));
      persist({ ...record, body: { ...body, analyses, solves: [...body.solves, nextSolve] } });
      onEvent(
        `a new body model solve just completed from ${analyses.length} view${analyses.length === 1 ? "" : "s"}. ` +
          `waist ${describeEstimate(nextSolve.vector.waistCm, " cm")}, hips ${describeEstimate(nextSolve.vector.hipCm, " cm")}, ` +
          `bmi ${describeEstimate(nextSolve.vector.bmi, "")}. explain what changed and what would tighten these numbers.`,
      );
      toast.success("body model solved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "the body model could not be solved.");
    } finally {
      setBusy(false);
    }
  };

  const scan = async (file: File | null) => {
    if (!file) return;
    const region = scanRegion.trim();
    if (!region) {
      toast.error("name the region first, so this photo can be compared with the same region later.");
      return;
    }
    setScanBusy(true);
    try {
      const shot = await fileToCapture(file, "front");
      const byok = await resolveByok();
      const data = await invokeWithByokRetry<{ observations?: any[]; summary?: string; limits?: string; error?: string }>(
        "asherin-health-ai",
        { body: { action: "surface.scan", module: scanModule, region, images: [splitDataUrl(shot.dataUrl)], ...(byok ? { byok } : {}) } },
      );
      if (data?.error) throw new Error(data.error);
      const now = new Date().toISOString();
      const observations: SurfaceObservation[] = (data?.observations ?? []).slice(0, 12).map((o: any) => ({
        id: newId("obs"),
        module: scanModule,
        region,
        feature: o?.feature ?? "colour",
        value: Math.max(0, Math.min(1, Number(o?.value) || 0)),
        detail: String(o?.detail ?? "").slice(0, 300),
        imageConfidence: Math.max(0, Math.min(1, Number(o?.imageConfidence) || 0.4)),
        interpretationConfidence: Math.max(0, Math.min(1, Number(o?.interpretationConfidence) || 0.3)),
        clinicalRelevance: ["routine", "watch", "clinician"].includes(o?.clinicalRelevance) ? o.clinicalRelevance : "routine",
        capturedAt: now,
        lesionKey: lesionKey.trim() || undefined,
        lesionMm: Number(o?.lesionMm) > 0 ? Number(o.lesionMm) : undefined,
      }));
      if (observations.length === 0) throw new Error("nothing readable came back from that photograph.");
      persist({ ...record, observations: [...record.observations, ...observations] });
      const escalate = observations.some((o) => o.clinicalRelevance === "clinician");
      onEvent(
        `a ${scanModule} reading of "${region}" just came in: ${data?.summary ?? observations[0].detail}. ` +
          (escalate ? "one feature was flagged for a clinician. say that plainly first, then explain it." : "explain what this means against my own earlier readings."),
      );
      toast.success(`${observations.length} feature${observations.length === 1 ? "" : "s"} recorded for ${region}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "that photograph could not be read.");
    } finally {
      setScanBusy(false);
      if (scanRef.current) scanRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[11px] font-light leading-relaxed text-foreground/50">
        four guided photographs give shape. a tape measure gives size. this keeps them apart — anything you measure yourself
        replaces the photo estimate and is marked as measured.
      </p>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/35">the four views</p>
        <div className="grid grid-cols-2 gap-2">
          {BODY_VIEWS.map((v) => {
            const shot = body.captures.find((c) => c.view === v.id);
            return (
              <div key={v.id} className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
                  {shot ? (
                    <img src={shot.dataUrl} alt={`${v.label} body view`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-light text-foreground/30">not captured</div>
                  )}
                </div>
                <p className="text-[10px] font-light text-foreground/70">{v.label}</p>
                <p className="text-[9px] font-light leading-relaxed text-foreground/35">{v.guidance}</p>
                <input
                  ref={(el) => (fileRefs.current[v.id] = el)}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void capture(v.id, e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full gap-1.5 text-[10px]"
                  onClick={() => fileRefs.current[v.id]?.click()}
                >
                  <Camera className="h-3 w-3" /> {shot ? "retake" : "capture"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/35">what you can measure</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["heightCm", "height cm"],
            ["weightKg", "weight kg"],
            ["age", "age"],
            ["waistCm", "waist cm"],
            ["hipCm", "hip cm"],
            ["chestCm", "chest cm"],
            ["neckCm", "neck cm"],
          ] as [keyof BodyMeasurements, string][]).map(([key, label]) => (
            <Input
              key={key}
              type="number"
              inputMode="decimal"
              placeholder={label}
              defaultValue={measurements[key] as number | undefined}
              onBlur={(e) => setMeasurement({ [key]: num(e.target.value) } as Partial<BodyMeasurements>)}
              className="h-8 rounded-lg border-white/[0.08] bg-white/[0.03] text-[11px]"
            />
          ))}
          <select
            value={measurements.sex ?? "unspecified"}
            onChange={(e) => setMeasurement({ sex: e.target.value as Sex })}
            className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-foreground/80"
          >
            <option value="unspecified">sex — unspecified</option>
            <option value="female">female</option>
            <option value="male">male</option>
          </select>
        </div>
      </div>

      <Button size="sm" className="h-8 w-full gap-2 text-[11px]" disabled={busy} onClick={() => void solve()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ruler className="h-3.5 w-3.5" />}
        {busy ? "reading the photographs" : "solve the body model"}
      </Button>

      {latest && (
        <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/35">current body state</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {([
              ["chestCm", "chest", " cm"],
              ["waistCm", "waist", " cm"],
              ["hipCm", "hips", " cm"],
              ["shoulderCm", "shoulders", " cm"],
              ["thighCm", "thigh", " cm"],
              ["neckCm", "neck", " cm"],
              ["bmi", "bmi", ""],
              ["waistToHeight", "waist ÷ height", ""],
              ["bodyFatPercent", "body fat", "%"],
            ] as const).map(([key, label, unit]) => {
              const e = latest.vector[key];
              if (!e) return null;
              return (
                <div key={key}>
                  <p className="text-[9px] uppercase tracking-widest text-foreground/30">{label}</p>
                  <p className={cn("text-[11px] font-light", e.source === "measured" ? "text-foreground/85" : "text-foreground/60")}>
                    {describeEstimate(e, unit)}
                    <span className="ml-1 text-[9px] text-foreground/30">{e.source}</span>
                  </p>
                </div>
              );
            })}
          </div>
          {latest.uncertainty.length > 0 && (
            <div className="space-y-1 border-t border-white/[0.06] pt-2">
              {latest.uncertainty.map((u, i) => (
                <p key={i} className="text-[10px] font-light leading-relaxed text-foreground/45">
                  {u}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {trends.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-foreground/35">
            <TrendingUp className="h-3 w-3" /> change over {trends[0].days} days
          </p>
          {trends.slice(0, 6).map((t) => (
            <p key={t.key} className={cn("text-[11px] font-light", t.meaningful ? "text-foreground/80" : "text-foreground/40")}>
              {t.label}: {t.from} → {t.to}
              <span className="ml-2 text-[10px] text-foreground/35">
                {t.meaningful ? `${t.deltaPerWeek > 0 ? "+" : ""}${t.deltaPerWeek} per week` : "inside measurement noise"}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/35">visible surface reading</p>
        <select
          value={scanModule}
          onChange={(e) => setScanModule(e.target.value as SurfaceModule)}
          className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-foreground/80"
        >
          {SURFACE_MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] font-light leading-relaxed text-foreground/40">
          {SURFACE_MODULES.find((m) => m.id === scanModule)?.capture} · watching for{" "}
          {SURFACE_MODULES.find((m) => m.id === scanModule)?.watchFor}.
        </p>
        <Input
          value={scanRegion}
          onChange={(e) => setScanRegion(e.target.value)}
          placeholder="region, e.g. left forearm"
          className="h-8 rounded-lg border-white/[0.08] bg-white/[0.03] text-[11px]"
        />
        <Input
          value={lesionKey}
          onChange={(e) => setLesionKey(e.target.value)}
          placeholder="tracking a specific mark? give it a name (optional)"
          className="h-8 rounded-lg border-white/[0.08] bg-white/[0.03] text-[11px]"
        />
        <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void scan(e.target.files?.[0] ?? null)} />
        <Button variant="outline" size="sm" className="h-8 w-full gap-2 text-[11px]" disabled={scanBusy} onClick={() => scanRef.current?.click()}>
          {scanBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {scanBusy ? "reading" : "read this region"}
        </Button>
      </div>

      {lesions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/35">tracked marks</p>
          {lesions.map((l) => (
            <div
              key={l.lesionKey}
              className={cn(
                "rounded-xl border p-2",
                l.growing ? "border-[#e0402a]/40 bg-[#e0402a]/[0.08]" : "border-white/[0.07] bg-white/[0.02]",
              )}
            >
              <p className="text-[11px] font-light text-foreground/80">
                {l.lesionKey} · {l.region}
              </p>
              <p className="text-[10px] font-light leading-relaxed text-foreground/50">
                {l.mmChange === null
                  ? "no scale reference in the photos, so size change cannot be measured — include a coin or ruler next time."
                  : `${l.mmChange > 0 ? "+" : ""}${l.mmChange} mm across ${l.days} days.`}
                {l.growing ? " this is growing measurably. have it looked at." : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {deltas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/35">readings against your baseline</p>
          {deltas.slice(0, 10).map((d) => (
            <div key={d.observation.id} className="space-y-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-light text-foreground/80">
                  {d.observation.region} · {d.observation.feature}
                </p>
                <button
                  onClick={() => persist({ ...record, observations: record.observations.filter((o) => o.id !== d.observation.id) })}
                  className="text-foreground/30 hover:text-foreground/70"
                  aria-label="remove this reading"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[10px] font-light leading-relaxed text-foreground/50">{phraseObservation(d)}</p>
              <p className="text-[9px] font-light text-foreground/30">
                seen at {Math.round(d.observation.imageConfidence * 100)}% · meaning at{" "}
                {Math.round(d.observation.interpretationConfidence * 100)}%
                {d.observation.clinicalRelevance === "clinician" ? " · have this looked at" : d.observation.clinicalRelevance === "watch" ? " · worth watching" : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1 border-t border-white/[0.06] pt-3">
        {SURFACE_LIMITS.map((l, i) => (
          <p key={i} className="text-[10px] font-light leading-relaxed text-foreground/35">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}
