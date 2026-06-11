// Asher Code — DevOps Suite (bottom drawer)
// Modules: Visual Regression · Performance Profiler · Mobile Preview ·
//          Deploy/Env · CI/CD Pipeline · Workflows/Tasks · Problems · Packages
//
// Pure frontend. Operates on the live preview iframe. Persists state in
// localStorage scoped per project. No new backend tables required.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Camera, GitCompare, Activity, Smartphone, Rocket, GitBranch, ListChecks,
  Bug, Package as PkgIcon, PlayCircle, CheckCircle2, AlertTriangle, Clock,
  RefreshCw, Trash2, Plus, Loader2, ShieldAlert, Bot,
} from "lucide-react";
import { toast } from "sonner";
import AsherCodeZerlal from "./AsherCodeZerlal";
import AsherCodeAgents from "./AsherCodeAgents";

interface Props {
  projectId: string;
  previewIframe: HTMLIFrameElement | null;
  onClose: () => void;
  files: Array<{ path: string; content: string }>;
}

type DevTab =
  | "zerlal" | "agents" | "visual" | "perf" | "mobile" | "deploy" | "ci" | "workflows" | "problems" | "packages";

const TABS: { id: DevTab; label: string; icon: any }[] = [
  { id: "zerlal",    label: "ZERLAL",            icon: ShieldAlert },
  { id: "agents",    label: "Agents",            icon: Bot },
  { id: "visual",    label: "Visual Regression", icon: GitCompare },
  { id: "perf",      label: "Profiler",          icon: Activity },
  { id: "mobile",    label: "Mobile Preview",    icon: Smartphone },
  { id: "deploy",    label: "Deploy",            icon: Rocket },
  { id: "ci",        label: "CI/CD",             icon: GitBranch },
  { id: "workflows", label: "Workflows",         icon: ListChecks },
  { id: "problems",  label: "Problems",          icon: Bug },
  { id: "packages",  label: "Packages",          icon: PkgIcon },
];

export default function AsherCodeDevOps({ projectId, previewIframe, onClose, files }: Props) {
  const [tab, setTab] = useState<DevTab>("zerlal");

  return (
    <div className="border-t border-border/15 bg-card/30 backdrop-blur-md flex flex-col h-80 sm:h-96 lg:h-[28rem] xl:h-[32rem] flex-shrink-0 resize-y overflow-hidden min-h-[16rem] max-h-[80vh]">
      <div className="flex items-center justify-between border-b border-border/15 px-2">
        <div className="flex overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[10px] font-light tracking-[0.18em] uppercase whitespace-nowrap transition ${
                  tab === t.id
                    ? "border-foreground/60 text-foreground"
                    : "border-transparent text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} aria-label="Close DevOps panel" className="text-muted-foreground hover:text-foreground p-1.5"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "zerlal"    && <AsherCodeZerlal projectId={projectId} files={files} />}
        {tab === "agents"    && <AsherCodeAgents projectId={projectId} files={files} />}
        {tab === "visual"    && <VisualRegression projectId={projectId} iframe={previewIframe} />}
        {tab === "perf"      && <PerformancePanel iframe={previewIframe} />}
        {tab === "mobile"    && <MobilePreviewPanel iframe={previewIframe} />}
        {tab === "deploy"    && <DeployPanel projectId={projectId} />}
        {tab === "ci"        && <CIPipelinePanel projectId={projectId} files={files} iframe={previewIframe} />}
        {tab === "workflows" && <WorkflowPanel projectId={projectId} iframe={previewIframe} />}
        {tab === "problems"  && <ProblemsPanel files={files} />}
        {tab === "packages"  && <PackagesPanel files={files} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 1. VISUAL REGRESSION — pixel-diff baseline vs current screenshot
// ──────────────────────────────────────────────────────────────────
function VisualRegression({ projectId, iframe }: { projectId: string; iframe: HTMLIFrameElement | null }) {
  type Snap = { id: string; name: string; baseline: string; current?: string; diffPct?: number };
  const key = `asherCode.visual.${projectId}`;
  const [snaps, setSnaps] = useState<Snap[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { localStorage.setItem(key, JSON.stringify(snaps)); }, [key, snaps]);

  async function captureFromIframe(): Promise<string | null> {
    if (!iframe?.contentDocument) return null;
    try {
      // html2canvas-free approach: serialize DOM into an SVG <foreignObject>, rasterise via Image
      const doc = iframe.contentDocument;
      const w = iframe.clientWidth || 800;
      const h = iframe.clientHeight || 600;
      const html = new XMLSerializer().serializeToString(doc.documentElement);
      const safe = html.replace(/#/g, "%23");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${safe.replace(/<html/, '<html xmlns="http://www.w3.org/1999/xhtml"')}</foreignObject></svg>`;
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("rasterise failed")); img.src = url; });
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } catch (e: any) {
      toast.error("Capture failed — preview must contain only same-origin content. " + e.message);
      return null;
    }
  }

  async function pixelDiff(a: string, b: string): Promise<number> {
    const [imgA, imgB] = await Promise.all([loadImg(a), loadImg(b)]);
    const w = Math.min(imgA.width, imgB.width);
    const h = Math.min(imgA.height, imgB.height);
    const ca = document.createElement("canvas"); ca.width = w; ca.height = h;
    const cb = document.createElement("canvas"); cb.width = w; cb.height = h;
    ca.getContext("2d")!.drawImage(imgA, 0, 0);
    cb.getContext("2d")!.drawImage(imgB, 0, 0);
    const da = ca.getContext("2d")!.getImageData(0, 0, w, h).data;
    const db = cb.getContext("2d")!.getImageData(0, 0, w, h).data;
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      const dr = Math.abs(da[i] - db[i]);
      const dg = Math.abs(da[i + 1] - db[i + 1]);
      const dbb = Math.abs(da[i + 2] - db[i + 2]);
      if (dr + dg + dbb > 30) diff++;
    }
    return (diff / (w * h)) * 100;
  }

  function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  async function addBaseline() {
    const name = prompt("Snapshot name (e.g. Home, ThreatCard):");
    if (!name) return;
    setBusy(true);
    const png = await captureFromIframe();
    setBusy(false);
    if (!png) return;
    setSnaps(s => [...s, { id: crypto.randomUUID(), name, baseline: png }]);
    toast.success(`Baseline captured: ${name}`);
  }

  async function runAll() {
    if (!snaps.length) { toast.info("Add a baseline first"); return; }
    setBusy(true);
    const updated: Snap[] = [];
    for (const s of snaps) {
      const cur = await captureFromIframe();
      if (!cur) { updated.push(s); continue; }
      const pct = await pixelDiff(s.baseline, cur);
      updated.push({ ...s, current: cur, diffPct: pct });
    }
    setSnaps(updated);
    setBusy(false);
    toast.success("Visual diff complete");
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={addBaseline} disabled={busy} className="ide-btn"><Camera className="h-3 w-3" /> Add Baseline</button>
        <button onClick={runAll} disabled={busy || !snaps.length} className="ide-btn"><RefreshCw className="h-3 w-3" /> Run Diff</button>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{snaps.length} snapshot{snaps.length !== 1 ? "s" : ""}</span>
      </div>
      {snaps.length === 0 && <p className="text-[11px] text-muted-foreground/50 italic">No snapshots yet. Capture a baseline of the live preview.</p>}
      <div className="space-y-3">
        {snaps.map(s => (
          <div key={s.id} className="rounded-lg border border-border/15 bg-card/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-light">{s.name}</span>
              <div className="flex items-center gap-2">
                {typeof s.diffPct === "number" && (
                  <span className={`text-[10px] font-light tracking-[0.15em] uppercase ${s.diffPct < 0.1 ? "text-emerald-400/80" : s.diffPct < 2 ? "text-amber-300/80" : "text-red-400/80"}`}>
                    {s.diffPct < 0.1 ? "✓ Passed" : `Δ ${s.diffPct.toFixed(2)}%`}
                  </span>
                )}
                {s.current && (
                  <button onClick={() => setSnaps(prev => prev.map(x => x.id === s.id ? { ...x, baseline: s.current!, current: undefined, diffPct: undefined } : x))} className="text-[9px] text-emerald-300/70 hover:text-emerald-200 uppercase tracking-[0.15em]">Accept New</button>
                )}
                <button onClick={() => setSnaps(prev => prev.filter(x => x.id !== s.id))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Cell label="Baseline" img={s.baseline} />
              <Cell label="Current" img={s.current} />
              <Cell label="Diff" img={s.current} highlight={s.diffPct} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ label, img, highlight }: { label: string; img?: string; highlight?: number }) {
  return (
    <div>
      <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60 mb-1">{label}</p>
      <div className="aspect-video rounded border border-border/20 bg-background/50 overflow-hidden relative">
        {img ? (
          <>
            <img src={img} alt={label} className="w-full h-full object-contain" />
            {label === "Diff" && typeof highlight === "number" && highlight >= 0.1 && (
              <div className="absolute inset-0 bg-red-500/20 mix-blend-screen pointer-events-none" />
            )}
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[9px] text-muted-foreground/40">—</div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 2. PERFORMANCE PROFILER — Performance API on iframe
// ──────────────────────────────────────────────────────────────────
function PerformancePanel({ iframe }: { iframe: HTMLIFrameElement | null }) {
  const [metrics, setMetrics] = useState<{ fcp?: number; load?: number; dom?: number; resources?: number; jsHeap?: number; domNodes?: number } | null>(null);
  const [hotspots, setHotspots] = useState<{ name: string; duration: number }[]>([]);
  const [busy, setBusy] = useState(false);

  function profile() {
    if (!iframe?.contentWindow) { toast.error("No preview to profile"); return; }
    setBusy(true);
    try {
      const w = iframe.contentWindow as any;
      const perf = w.performance;
      const nav = perf.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const paints = perf.getEntriesByType("paint") as PerformanceEntry[];
      const fcp = paints.find(p => p.name === "first-contentful-paint")?.startTime;
      const resources = perf.getEntriesByType("resource") as PerformanceResourceTiming[];
      const longest = [...resources]
        .map(r => ({ name: r.name.split("/").pop() || r.name, duration: r.duration }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8);
      const heap = (w.performance as any).memory?.usedJSHeapSize;
      setMetrics({
        fcp,
        load: nav?.loadEventEnd,
        dom: nav?.domContentLoadedEventEnd,
        resources: resources.length,
        jsHeap: heap ? Math.round(heap / 1024 / 1024) : undefined,
        domNodes: iframe.contentDocument?.querySelectorAll("*").length,
      });
      setHotspots(longest);
      toast.success("Profile captured");
    } catch (e: any) {
      toast.error("Profile failed: " + e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={profile} disabled={busy} className="ide-btn"><PlayCircle className="h-3 w-3" /> Capture Profile</button>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {!metrics && <p className="text-[11px] text-muted-foreground/50 italic">Run a profile to see metrics from the preview iframe.</p>}
      {metrics && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <Stat label="FCP" value={metrics.fcp ? `${Math.round(metrics.fcp)} ms` : "—"} />
            <Stat label="DOM Ready" value={metrics.dom ? `${Math.round(metrics.dom)} ms` : "—"} />
            <Stat label="Load" value={metrics.load ? `${Math.round(metrics.load)} ms` : "—"} />
            <Stat label="Resources" value={String(metrics.resources ?? "—")} />
            <Stat label="JS Heap" value={metrics.jsHeap ? `${metrics.jsHeap} MB` : "n/a"} />
            <Stat label="DOM Nodes" value={String(metrics.domNodes ?? "—")} />
          </div>
          <div>
            <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70 mb-1.5">Slowest Resources (Hotspots)</p>
            <div className="space-y-1">
              {hotspots.map((h, i) => {
                const max = hotspots[0]?.duration || 1;
                const pct = (h.duration / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-light text-muted-foreground/60 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 h-5 bg-card/40 rounded overflow-hidden relative">
                      <div className="h-full bg-foreground/20" style={{ width: `${pct}%` }} />
                      <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-light">
                        <span className="truncate max-w-[70%]">{h.name}</span>
                        <span className="text-muted-foreground/70">{Math.round(h.duration)} ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/15 bg-card/30 px-2 py-1.5">
      <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">{label}</p>
      <p className="text-xs font-light mt-0.5">{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 3. MOBILE PREVIEW — resize iframe to device frames
// ──────────────────────────────────────────────────────────────────
function MobilePreviewPanel({ iframe }: { iframe: HTMLIFrameElement | null }) {
  const devices = [
    { name: "iPhone 15 Pro", w: 393, h: 852 },
    { name: "iPhone 15", w: 390, h: 844 },
    { name: "Pixel 8", w: 412, h: 915 },
    { name: "Galaxy S23", w: 360, h: 780 },
    { name: "iPad Pro", w: 1024, h: 1366 },
    { name: "Desktop", w: 0, h: 0 },
  ];
  function apply(d: typeof devices[number]) {
    if (!iframe) return;
    if (d.w === 0) { iframe.style.width = ""; iframe.style.height = ""; toast.success("Reset to fit"); return; }
    iframe.style.width = d.w + "px";
    iframe.style.height = d.h + "px";
    iframe.style.maxWidth = "100%";
    iframe.style.transition = "width 0.2s, height 0.2s";
    toast.success(`Preview → ${d.name}`);
  }
  return (
    <div className="p-3">
      <p className="text-[11px] text-muted-foreground/70 mb-3">Resize the live preview to test responsive layouts.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {devices.map(d => (
          <button key={d.name} onClick={() => apply(d)} className="rounded-lg border border-border/15 bg-card/30 p-3 text-left hover:border-foreground/30 transition">
            <p className="text-[11px] font-light">{d.name}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">{d.w === 0 ? "Reset" : `${d.w} × ${d.h}`}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 4. DEPLOY PANEL — environment management (UI scaffolding)
// ──────────────────────────────────────────────────────────────────
function DeployPanel({ projectId }: { projectId: string }) {
  const key = `asherCode.deploy.${projectId}`;
  type Env = { name: string; version: string; status: "healthy" | "degraded" | "down"; lastDeploy: string };
  const [envs, setEnvs] = useState<Env[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "null") || defaultEnvs(); } catch { return defaultEnvs(); }
  });
  function defaultEnvs(): Env[] {
    return [
      { name: "Development", version: "v0.1.0-dev", status: "healthy", lastDeploy: new Date().toISOString() },
      { name: "Staging",     version: "—",          status: "down",    lastDeploy: "" },
      { name: "Production",  version: "—",          status: "down",    lastDeploy: "" },
    ];
  }
  useEffect(() => { localStorage.setItem(key, JSON.stringify(envs)); }, [key, envs]);

  function deploy(envName: string) {
    const major = envs[0]?.version.match(/v(\d+\.\d+\.\d+)/)?.[1] || "0.1.0";
    setEnvs(prev => prev.map(e => e.name === envName ? { ...e, version: `v${major}`, status: "healthy", lastDeploy: new Date().toISOString() } : e));
    toast.success(`Deployed to ${envName}`);
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-muted-foreground/70">Multi-environment deploy ledger. Records published versions across environments.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {envs.map(e => (
          <div key={e.name} className="rounded-lg border border-border/15 bg-card/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-light">{e.name}</p>
              <span className={`text-[9px] uppercase tracking-[0.2em] ${e.status === "healthy" ? "text-emerald-400/80" : e.status === "degraded" ? "text-amber-300/80" : "text-muted-foreground/40"}`}>
                {e.status === "healthy" ? "● Healthy" : e.status === "degraded" ? "● Degraded" : "○ Empty"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/60">{e.version}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-1">{e.lastDeploy ? new Date(e.lastDeploy).toLocaleString() : "Never deployed"}</p>
            <button onClick={() => deploy(e.name)} className="mt-2 w-full ide-btn justify-center"><Rocket className="h-3 w-3" /> Deploy</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 5. CI/CD PIPELINE — real checks against project files & preview
// ──────────────────────────────────────────────────────────────────
function CIPipelinePanel({ projectId, files, iframe }: { projectId: string; files: Array<{ path: string; content: string }>; iframe: HTMLIFrameElement | null }) {
  type Stage = { name: string; run: () => Promise<{ ok: boolean; detail?: string }> };
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ name: string; status: "pending" | "running" | "passed" | "failed"; ms?: number; detail?: string }[]>([]);

  const stages: Stage[] = useMemo(() => [
    {
      name: "Build (parse files)",
      run: async () => {
        if (!files.length) return { ok: false, detail: "No files in project" };
        let bad = 0;
        for (const f of files) {
          if (f.path.endsWith(".json")) { try { JSON.parse(f.content); } catch { bad++; } }
        }
        return bad === 0 ? { ok: true, detail: `${files.length} files parsed` } : { ok: false, detail: `${bad} invalid JSON file(s)` };
      },
    },
    {
      name: "Lint (heuristic scan)",
      run: async () => {
        let errors = 0;
        for (const f of files) {
          if (/eval\(/.test(f.content)) errors++;
        }
        return errors === 0 ? { ok: true, detail: "No eval() / blocking issues" } : { ok: false, detail: `${errors} eval() usage(s)` };
      },
    },
    {
      name: "Test (preview reachable)",
      run: async () => {
        if (!iframe?.contentWindow) return { ok: false, detail: "Preview iframe not mounted" };
        const doc = iframe.contentDocument;
        const nodes = doc?.querySelectorAll("*").length ?? 0;
        return nodes > 0 ? { ok: true, detail: `${nodes} DOM nodes rendered` } : { ok: false, detail: "Empty preview document" };
      },
    },
    {
      name: "Security Scan",
      run: async () => {
        const flagged: string[] = [];
        for (const f of files) {
          if (/api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{16,}/i.test(f.content)) flagged.push(f.path);
          if (/(?:password|secret)\s*[:=]\s*["'][^"']{6,}/i.test(f.content)) flagged.push(f.path);
        }
        return flagged.length === 0 ? { ok: true, detail: "No hardcoded secrets" } : { ok: false, detail: `Secrets in: ${flagged.slice(0, 3).join(", ")}` };
      },
    },
    {
      name: "Deploy Ledger Sync",
      run: async () => {
        const key = `asherCode.deploy.${projectId}`;
        const exists = localStorage.getItem(key);
        return exists ? { ok: true, detail: "Ledger present" } : { ok: false, detail: "No deploy ledger initialised" };
      },
    },
    {
      name: "Integration (preview no-error)",
      run: async () => {
        if (!iframe?.contentWindow) return { ok: false, detail: "No preview" };
        const w = iframe.contentWindow as any;
        const errs = w.__asherErrors || 0;
        return errs === 0 ? { ok: true, detail: "No runtime errors captured" } : { ok: false, detail: `${errs} runtime error(s)` };
      },
    },
  ], [files, iframe, projectId]);

  useEffect(() => { setResults(stages.map(s => ({ name: s.name, status: "pending" }))); }, [stages.length]);

  async function run() {
    if (running) return;
    setRunning(true);
    setResults(stages.map(s => ({ name: s.name, status: "pending" })));
    for (let i = 0; i < stages.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "running" } : r));
      const t0 = performance.now();
      let res: { ok: boolean; detail?: string };
      try { res = await stages[i].run(); } catch (e: any) { res = { ok: false, detail: e.message }; }
      const ms = Math.round(performance.now() - t0);
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: res.ok ? "passed" : "failed", ms, detail: res.detail } : r));
      if (!res.ok) { toast.error(`${stages[i].name}: ${res.detail || "failed"}`); setRunning(false); return; }
    }
    setRunning(false);
    toast.success("Pipeline complete — all checks passed");
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={run} disabled={running} className="ide-btn"><GitBranch className="h-3 w-3" /> Run Pipeline</button>
        {running && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="space-y-1">
        {results.map((r, i) => (
          <div key={i} className="flex items-start gap-2 rounded border border-border/15 bg-card/30 px-2.5 py-1.5">
            {r.status === "passed"  && <CheckCircle2 className="h-3 w-3 text-emerald-400/80 mt-0.5" />}
            {r.status === "failed"  && <AlertTriangle className="h-3 w-3 text-red-400/80 mt-0.5" />}
            {r.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-foreground/60 mt-0.5" />}
            {r.status === "pending" && <Clock className="h-3 w-3 text-muted-foreground/40 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-light">{r.name}</p>
              {r.detail && <p className="text-[9px] text-muted-foreground/60 mt-0.5 truncate">{r.detail}</p>}
            </div>
            {r.ms !== undefined && <span className="text-[10px] text-muted-foreground/60">{r.ms} ms</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 6. WORKFLOWS — real executable steps (no fake delays)
// Step DSL: "reload" | "count:<selector>" | "click:<selector>" |
//           "wait:<ms>" | "log:<msg>" | "fetch:<url>" | "assert:<selector>"
// ──────────────────────────────────────────────────────────────────
function WorkflowPanel({ projectId, iframe }: { projectId: string; iframe: HTMLIFrameElement | null }) {
  const key = `asherCode.workflows.${projectId}`;
  type Wf = { id: string; name: string; steps: string[] };
  const [wfs, setWfs] = useState<Wf[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "null") || defaults(); } catch { return defaults(); }
  });
  const [log, setLog] = useState<string[]>([]);
  function defaults(): Wf[] {
    return [
      { id: crypto.randomUUID(), name: "Smoke Test Preview", steps: ["assert:body", "count:*", "log:smoke ok"] },
      { id: crypto.randomUUID(), name: "Reload & Verify", steps: ["reload", "wait:800", "assert:body"] },
    ];
  }
  useEffect(() => { localStorage.setItem(key, JSON.stringify(wfs)); }, [key, wfs]);

  function add() {
    const name = prompt("Workflow name");
    if (!name) return;
    const stepsStr = prompt("Steps (comma-separated). Verbs: reload, wait:<ms>, count:<sel>, click:<sel>, assert:<sel>, fetch:<url>, log:<msg>") || "";
    const steps = stepsStr.split(",").map(s => s.trim()).filter(Boolean);
    setWfs(prev => [...prev, { id: crypto.randomUUID(), name, steps }]);
  }

  async function execStep(s: string): Promise<string> {
    const [verb, ...rest] = s.split(":");
    const arg = rest.join(":");
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    switch (verb) {
      case "reload":
        if (!win) throw new Error("no preview");
        win.location.reload();
        return "preview reloaded";
      case "wait":
        await new Promise(r => setTimeout(r, parseInt(arg) || 0));
        return `waited ${arg}ms`;
      case "count": {
        if (!doc) throw new Error("no preview doc");
        const n = doc.querySelectorAll(arg).length;
        return `${arg} → ${n} nodes`;
      }
      case "click": {
        if (!doc) throw new Error("no preview doc");
        const el = doc.querySelector(arg) as HTMLElement | null;
        if (!el) throw new Error(`selector not found: ${arg}`);
        el.click();
        return `clicked ${arg}`;
      }
      case "assert": {
        if (!doc) throw new Error("no preview doc");
        const el = doc.querySelector(arg);
        if (!el) throw new Error(`assertion failed: ${arg} missing`);
        return `assert ok: ${arg}`;
      }
      case "fetch": {
        const r = await fetch(arg);
        return `fetch ${arg} → ${r.status}`;
      }
      case "log":
        return arg;
      default:
        throw new Error(`unknown verb: ${verb}`);
    }
  }

  async function run(wf: Wf) {
    setLog([`▶ ${wf.name}`]);
    for (const s of wf.steps) {
      try {
        const out = await execStep(s);
        setLog(prev => [...prev, `  ✓ ${s} — ${out}`]);
      } catch (e: any) {
        setLog(prev => [...prev, `  ✗ ${s} — ${e.message}`]);
        toast.error(`Workflow failed: ${e.message}`);
        return;
      }
    }
    setLog(prev => [...prev, `✓ "${wf.name}" complete`]);
    toast.success(`Workflow "${wf.name}" complete`);
  }

  return (
    <div className="p-3 space-y-3">
      <button onClick={add} className="ide-btn"><Plus className="h-3 w-3" /> New Workflow</button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {wfs.map(w => (
          <div key={w.id} className="rounded-lg border border-border/15 bg-card/30 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-light">{w.name}</p>
              <button onClick={() => setWfs(prev => prev.filter(x => x.id !== w.id))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            </div>
            <ol className="text-[10px] text-muted-foreground/70 list-decimal list-inside space-y-0.5 mb-2">
              {w.steps.map((s, i) => <li key={i} className="font-mono">{s}</li>)}
            </ol>
            <button onClick={() => run(w)} className="w-full ide-btn justify-center"><PlayCircle className="h-3 w-3" /> Run</button>
          </div>
        ))}
      </div>
      {log.length > 0 && (
        <div className="rounded border border-border/15 bg-background/60 p-2 max-h-40 overflow-auto">
          <pre className="text-[10px] font-mono text-muted-foreground/80 whitespace-pre-wrap">{log.join("\n")}</pre>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 7. PROBLEMS — heuristic linter on file contents
// ──────────────────────────────────────────────────────────────────
function ProblemsPanel({ files }: { files: Array<{ path: string; content: string }> }) {
  const problems = useMemo(() => {
    const out: { file: string; line: number; severity: "error" | "warn" | "info"; msg: string }[] = [];
    for (const f of files) {
      const lines = f.content.split("\n");
      lines.forEach((ln, i) => {
        const n = i + 1;
        if (/console\.log/.test(ln)) out.push({ file: f.path, line: n, severity: "info", msg: "console.log left in code" });
        if (/\bvar\s+/.test(ln)) out.push({ file: f.path, line: n, severity: "warn", msg: "Use 'let' or 'const' instead of 'var'" });
        if (/==\s/.test(ln) && !/===/.test(ln)) out.push({ file: f.path, line: n, severity: "warn", msg: "Use strict equality '==='" });
        if (/TODO|FIXME|XXX/.test(ln)) out.push({ file: f.path, line: n, severity: "info", msg: "Unresolved TODO/FIXME marker" });
        if (ln.length > 200) out.push({ file: f.path, line: n, severity: "warn", msg: "Line exceeds 200 chars" });
        if (/eval\(/.test(ln)) out.push({ file: f.path, line: n, severity: "error", msg: "Avoid eval() — security risk" });
      });
    }
    return out;
  }, [files]);

  const counts = problems.reduce((acc, p) => { acc[p.severity]++; return acc; }, { error: 0, warn: 0, info: 0 } as any);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em]">
        <span className="text-red-400/80">⛔ {counts.error} errors</span>
        <span className="text-amber-300/80">⚠ {counts.warn} warnings</span>
        <span className="text-muted-foreground/70">💡 {counts.info} hints</span>
      </div>
      {!problems.length && <p className="text-[11px] text-muted-foreground/50 italic">No problems detected. Clean code.</p>}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {problems.map((p, i) => (
          <div key={i} className="flex items-start gap-2 rounded border border-border/15 bg-card/30 px-2.5 py-1.5">
            <span className={`text-[10px] mt-0.5 ${p.severity === "error" ? "text-red-400/80" : p.severity === "warn" ? "text-amber-300/80" : "text-foreground/50"}`}>
              {p.severity === "error" ? "⛔" : p.severity === "warn" ? "⚠" : "💡"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-light">{p.msg}</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">{p.file}:{p.line}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 8. PACKAGES — read package.json if present
// ──────────────────────────────────────────────────────────────────
function PackagesPanel({ files }: { files: Array<{ path: string; content: string }> }) {
  const pkg = files.find(f => f.path.endsWith("package.json"));
  const parsed = useMemo(() => {
    if (!pkg) return null;
    try { return JSON.parse(pkg.content); } catch { return null; }
  }, [pkg]);
  if (!pkg) return <p className="p-3 text-[11px] text-muted-foreground/50 italic">No <code>package.json</code> found in this project.</p>;
  if (!parsed) return <p className="p-3 text-[11px] text-red-400/80">Invalid <code>package.json</code></p>;
  const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-muted-foreground/70">{Object.keys(deps).length} dependencies declared in <code>{pkg.path}</code></p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
        {Object.entries(deps).map(([name, ver]) => (
          <div key={name} className="rounded border border-border/15 bg-card/30 px-2.5 py-1.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-light">{name}</p>
              <p className="text-[9px] text-muted-foreground/60">{String(ver)}</p>
            </div>
            <a href={`https://www.npmjs.com/package/${name}`} target="_blank" rel="noreferrer" className="text-[9px] text-foreground/50 hover:text-foreground uppercase tracking-[0.2em]">npm ↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}
