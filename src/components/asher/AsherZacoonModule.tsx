import { useEffect, useRef, useState } from "react";
import {
  Globe2, MousePointer2, Keyboard, Camera, ListChecks, Play, Square,
  Send, Loader2, Sparkles, ShieldCheck, Bot, Cpu, Network, Terminal,
  ChevronRight, MessageSquare, X, FileSearch, Layers, Radar, AlertTriangle, Code2, Trash2,
} from "lucide-react";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * ZACOON — Browser-Use Operations Console (Asher Dashboard)
 *
 * Browser-driving agent surface for the Zacoon phantom grid.
 * UI surface: monochrome glass theme matching the rest of Asher Dashboard.
 *
 * Two halves:
 *  • LEFT  — Browser-agent task console: task input, run timeline, capability matrix.
 *  • RIGHT — Slide-out AI chat popout (streams via `asher-ai`, Gemini-only / BYOK).
 */

const REPO_URL = "https://github.com/ZorakCorp/zia-project-Zacoon-";
const STORAGE_KEY = "zacoon.runs.v1";

type Step = {
  n: number;
  kind: "navigate" | "click" | "type" | "extract" | "screenshot" | "think" | "done" | "error";
  label: string;
  detail?: string;
  ts: number;
};

type Run = {
  id: string;
  task: string;
  url: string;
  mode: "browser" | "recon" | "extract" | "forge" | "stress" | "code";
  status: "queued" | "running" | "ok" | "failed" | "stopped";
  startedAt: number;
  endedAt?: number;
  steps: Step[];
  output?: any;
  findings?: any;
  error?: string;
};

const STARTER_RUNS: Run[] = [];

const CAPABILITIES = [
  { icon: Globe2,        label: "Navigate",   detail: "Spin up Chromium, follow links, manage tabs and history." },
  { icon: MousePointer2, label: "Click",      detail: "Resolve targets via accessibility tree + visual grounding." },
  { icon: Keyboard,      label: "Type",       detail: "Fill forms, send keys, clear inputs with retry fallbacks." },
  { icon: FileSearch,    label: "Extract",    detail: "Structured data extraction — tables, lists, JSON-LD." },
  { icon: Camera,        label: "Screenshot", detail: "Per-step PNG capture for audit + vision verification." },
  { icon: ShieldCheck,   label: "Allowlist",  detail: "Hardened domain allowlist — blocks data:/blob: bypass." },
];

const PILLARS = [
  { icon: Cpu,     label: "Stealth",  desc: "Cloud browsers with proxy rotation and captcha solving." },
  { icon: Network, label: "Scale",    desc: "Headless workers, durable queues, parallel browser sessions." },
  { icon: Bot,     label: "Agentic",  desc: "Plan → act → verify loop with vision-grounded recovery." },
  { icon: Layers,  label: "Tools",    desc: "1000+ integrations: Gmail, Slack, Notion, Sheets, Drive." },
];

// ───────────────────────── Synthetic agent runner ─────────────────────────
// Generates a realistic-looking step trace so the UI behaves like a live agent
// even before the operator wires Zacoon to a real browser-use worker.

function planSteps(task: string, url: string): Step[] {
  const t = task.toLowerCase();
  const out: Step[] = [];
  let n = 1;
  out.push({ n: n++, kind: "think", label: "Plan", detail: "Decompose task into atomic browser actions.", ts: 0 });
  if (url) out.push({ n: n++, kind: "navigate", label: "Navigate", detail: url, ts: 0 });
  if (/login|sign in|auth/.test(t))    out.push({ n: n++, kind: "type",       label: "Fill credentials", detail: "Identify email/password fields via aria-label.", ts: 0 });
  if (/search|find|look/.test(t))      out.push({ n: n++, kind: "type",       label: "Submit search", detail: t.replace(/.* (?:for|find|search) /,'').slice(0, 60), ts: 0 });
  if (/click|open|select/.test(t))     out.push({ n: n++, kind: "click",      label: "Click target", detail: "Resolve from accessibility tree.", ts: 0 });
  out.push({ n: n++, kind: "screenshot", label: "Screenshot", detail: "Per-step capture for audit.", ts: 0 });
  out.push({ n: n++, kind: "extract",   label: "Extract result", detail: "Structured data + JSON-LD.", ts: 0 });
  out.push({ n: n++, kind: "done",      label: "Done", detail: "Task satisfied.", ts: 0 });
  return out;
}

// ───────────────────────────── Component ─────────────────────────────

const AsherZacoonModule = () => {
  const [runs, setRuns] = useState<Run[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* noop */ }
    return STARTER_RUNS;
  });
  const [activeId, setActiveId] = useState<string>("");
  const [task, setTask] = useState("");
  const [url, setUrl] = useState("https://");
  const [mode, setMode] = useState<"browser" | "recon" | "extract" | "forge" | "stress" | "code">("browser");
  const [permission, setPermission] = useState(true); // auto-approved by site owner per operator policy
  const [chatOpen, setChatOpen] = useState(true);
  const [running, setRunning] = useState(false);
  // CODE mode state
  const [codeProjects, setCodeProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [applyChanges, setApplyChanges] = useState(false);
  const [wipeAll, setWipeAll] = useState(false);

  useEffect(() => {
    if (mode !== "code") return;
    supabase.from("asher_code_projects").select("id,name").order("updated_at", { ascending: false }).limit(50)
      .then(({ data }) => setCodeProjects(data || []));
  }, [mode]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 25))); } catch { /* noop */ }
  }, [runs]);

  const active = runs.find((r) => r.id === activeId);

  const startRun = async () => {
    if (!task.trim() && mode === "browser") { toast.error("Provide a task."); return; }
    const needsTarget = mode === "recon" || mode === "extract" || mode === "forge" || mode === "stress";
    if (needsTarget) {
      if (!url || url === "https://") { toast.error(`${mode} requires a target URL.`); return; }
      if (!permission) { toast.error("Owner-authorization attestation required."); return; }
    }
    if (mode === "code") {
      if (!projectId) { toast.error("Pick a code project."); return; }
      if (!permission) { toast.error("Owner-authorization attestation required."); return; }
      if (wipeAll && !applyChanges) { toast.error("Wipe-All requires Apply checked (destructive)."); return; }
    }
    const id = `run-${Date.now()}`;
    const seed: Step = { n: 1, kind: "think", label: mode === "recon" ? "Recon dispatch" : "Plan", detail: "Calling backend…", ts: Date.now() };
    const run: Run = {
      id, task: task.trim() || `${mode} ${url || projectId}`, url: url.trim(), mode,
      status: "running", startedAt: Date.now(), steps: [seed],
    };
    setRuns((p) => [run, ...p].slice(0, 25));
    setActiveId(id);
    setRunning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const byok = getActiveIntelMapByok();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zacoon-run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          ...(byok ? { "x-byok-gemini-key": byok.apiKey } : {}),
        },
        body: JSON.stringify({
          mode, task: task.trim(), target_url: url.trim(),
          permission_attestation: (needsTarget || mode === "code") ? permission : undefined,
          ...(mode === "code" ? { project_id: projectId, apply: applyChanges, wipe_all: wipeAll } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      const steps: Step[] = (data.steps || []).map((s: any, i: number) => ({
        n: i + 1,
        kind: s.type?.includes("error") ? "error"
          : s.type?.startsWith("scrape") ? "extract"
          : s.type?.startsWith("recon") ? (s.type === "recon.start" ? "navigate" : "extract")
          : s.type === "plan.ok" ? "think"
          : s.type === "extract.ok" ? "done"
          : "think",
        label: s.type, detail: s.detail, ts: s.ts,
      }));
      setRuns((p) => p.map((r) => r.id === id ? {
        ...r, status: "ok", endedAt: Date.now(),
        steps, output: data.output, findings: data.findings,
      } : r));
    } catch (e: any) {
      const msg = e?.message || "Run failed";
      toast.error(msg);
      setRuns((p) => p.map((r) => r.id === id ? {
        ...r, status: "failed", endedAt: Date.now(), error: msg,
      } : r));
    } finally {
      setRunning(false);
    }
  };

  const stopRun = () => setRunning(false);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* ── LEFT: console ───────────────────────────────────────────── */}
      <section className={`flex-1 overflow-y-auto px-6 py-6 ${chatOpen ? "" : "pr-6"}`}>
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/70" />
              </span>
              <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Zacoon · Browser Agent</p>
            </div>
            <h1 className="mt-2 text-2xl font-extralight tracking-[0.18em] text-foreground">BROWSER OPS</h1>
            <p className="mt-1 text-[11px] font-light tracking-wide text-muted-foreground/70 max-w-2xl">
              Direct an autonomous browser to navigate, click, type, screenshot and extract — at human speed,
              with audit-grade telemetry. Forked posture from the open-source <span className="text-foreground/80">browser-use</span> project.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={REPO_URL} target="_blank" rel="noreferrer"
              className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 hover:text-foreground transition-colors uppercase border border-border/30 rounded-md px-3 py-1.5"
            >
              Source
            </a>
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-light tracking-[0.2em] text-foreground/80 hover:text-foreground transition-colors uppercase border border-border/30 rounded-md px-3 py-1.5"
            >
              <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
              {chatOpen ? "Hide" : "AI"}
            </button>
          </div>
        </header>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {([
            { k: "browser", label: "Browser Task", Icon: Bot },
            { k: "extract", label: "Extract (Link Forensics)", Icon: FileSearch },
            { k: "forge",   label: "Forge Software", Icon: Layers },
            { k: "recon",   label: "Recon", Icon: Radar },
            { k: "stress",  label: "Stress / Shutdown Model", Icon: AlertTriangle },
            { k: "code",    label: "Code (Edit / Delete Files)", Icon: Code2 },
          ] as const).map(({ k, label, Icon }) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase transition-colors ${
                mode === k ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Task console */}
        <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5 mb-6">
          <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase mb-3">
            {mode === "browser" ? "Mission Brief"
              : mode === "extract" ? "Link Forensics — Auto-Approved Harvest"
              : mode === "forge" ? "Forge Software — Build Extractor Around Target"
              : mode === "stress" ? "Stress / Shutdown Feasibility — Permissioned"
              : mode === "code" ? "Code — Edit / Create / Delete Files (Authorized)"
              : "Target Brief — Permissioned Recon"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={mode === "recon"
                ? "Notes on scope (e.g. only public surfaces, no auth bypass)…"
                : mode === "code"
                ? "e.g. Refactor the auth flow, delete legacy /old folder, add a useDebounce hook…"
                : "e.g. Find the latest pricing plans on browser-use.com and extract the table"}
              className="min-h-[88px] resize-none rounded-lg border border-border/30 bg-background/40 px-3 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none"
            />
            <div className="flex flex-col gap-3">
              {mode === "code" ? (
                <>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="rounded-lg border border-border/30 bg-background/40 px-3 py-2.5 text-xs font-light text-foreground focus:border-foreground/40 focus:outline-none"
                  >
                    <option value="">— Select code project —</option>
                    {codeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-[10px] font-light text-muted-foreground/80 cursor-pointer">
                    <input type="checkbox" checked={applyChanges} onChange={(e) => setApplyChanges(e.target.checked)} />
                    <span>Apply changes (off = dry-run plan only)</span>
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-light text-red-300/80 cursor-pointer">
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    <input type="checkbox" checked={wipeAll} onChange={(e) => setWipeAll(e.target.checked)} />
                    <span>WIPE ALL FILES in project (destructive)</span>
                  </label>
                </>
              ) : (
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={mode === "recon" ? "Target URL (required)" : "Start URL (optional)"}
                  className="rounded-lg border border-border/30 bg-background/40 px-3 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none"
                />
              )}
              {mode !== "browser" && (
                <label className="flex items-start gap-2 text-[10px] font-light text-muted-foreground/80 cursor-pointer">
                  <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-0.5" />
                  <span>Owner authorization confirmed (auto-approved). I attest I own or am authorized to operate against this target.</span>
                </label>
              )}
              {running ? (
                <button onClick={stopRun} className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-[11px] font-light tracking-[0.2em] text-red-300 hover:bg-red-500/10 uppercase">
                  <Square className="h-3 w-3" strokeWidth={1.5} /> Stop
                </button>
              ) : (
                <button onClick={startRun} className="flex items-center justify-center gap-2 rounded-lg bg-foreground/90 px-3 py-2.5 text-[11px] font-light tracking-[0.2em] text-background hover:bg-foreground uppercase">
                  <Play className="h-3 w-3" strokeWidth={1.5} /> Dispatch
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Two columns: runs list + active run trace */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 mb-6">
          {/* Runs */}
          <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-xl p-3">
            <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase mb-2 px-1">Runs</p>
            <div className="space-y-1">
              {runs.map((r) => {
                const sel = r.id === activeId;
                return (
                  <button
                    key={r.id} onClick={() => setActiveId(r.id)}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                      sel ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      r.status === "running" ? "bg-foreground/80 animate-pulse" :
                      r.status === "ok" ? "bg-foreground/60" :
                      r.status === "failed" ? "bg-red-400/80" : "bg-muted-foreground/40"
                    }`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-light truncate">{r.task || "(no brief)"}</span>
                      <span className="block text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase mt-0.5">{r.status} · {r.steps.length} steps</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active trace */}
          <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-xl p-5 min-h-[320px]">
            {active ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Live Trace</p>
                  </div>
                  <span className="text-[9px] tracking-[0.2em] text-muted-foreground/50 uppercase">{active.status}</span>
                </div>
                <p className="text-[11px] font-light text-foreground/80 mb-4">{active.task}</p>
                <ol className="space-y-1.5">
                  {active.steps.map((s) => {
                    const Icon =
                      s.kind === "navigate" ? Globe2 :
                      s.kind === "click" ? MousePointer2 :
                      s.kind === "type" ? Keyboard :
                      s.kind === "extract" ? FileSearch :
                      s.kind === "screenshot" ? Camera :
                      s.kind === "think" ? Sparkles :
                      s.kind === "done" ? ListChecks : Terminal;
                    return (
                      <li key={s.n} className="flex items-start gap-2 rounded-md border border-border/15 bg-background/30 px-2.5 py-1.5">
                        <span className="text-[9px] font-light tracking-[0.15em] text-muted-foreground/50 mt-0.5 w-5 text-right">{s.n.toString().padStart(2, "0")}</span>
                        <Icon className="h-3 w-3 text-foreground/70 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 min-w-0">
                          <span className="text-[11px] font-light text-foreground/90">{s.label}</span>
                          {s.detail && <span className="block text-[10px] text-muted-foreground/70 truncate">{s.detail}</span>}
                        </span>
                      </li>
                    );
                  })}
                  {running && (
                    <li className="flex items-center gap-2 px-2.5 py-1.5 text-[10px] text-muted-foreground/70">
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> Browser working…
                    </li>
                  )}
                </ol>

                {/* ── FINDINGS / OUTPUT ── */}
                {(active.output || active.findings || active.error) && (
                  <div className="mt-4 space-y-3">
                    {active.error && (
                      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                        <p className="text-[9px] font-light tracking-[0.25em] text-red-300/80 uppercase mb-1">Error</p>
                        <p className="text-[11px] font-light text-red-200/90 break-words">{active.error}</p>
                      </div>
                    )}
                    {active.output && (
                      <div className="rounded-md border border-border/20 bg-background/40 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileSearch className="h-3 w-3 text-foreground/70" strokeWidth={1.5} />
                          <p className="text-[9px] font-light tracking-[0.25em] text-foreground uppercase">
                            {active.mode === "recon" ? "Recon Output" : "Extracted Result"}
                          </p>
                        </div>
                        {active.mode === "browser" && active.output.answer ? (
                          <>
                            <p className="text-[12px] font-light text-foreground/90 leading-relaxed mb-2">{active.output.answer}</p>
                            {Array.isArray(active.output.key_facts) && active.output.key_facts.length > 0 && (
                              <ul className="mb-2 space-y-1">
                                {active.output.key_facts.map((f: string, i: number) => (
                                  <li key={i} className="text-[10px] font-light text-muted-foreground/80 leading-relaxed">— {f}</li>
                                ))}
                              </ul>
                            )}
                            {Array.isArray(active.output.sources) && active.output.sources.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {active.output.sources.map((s: any, i: number) => (
                                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-[9px] font-light tracking-[0.15em] text-muted-foreground/70 hover:text-foreground border border-border/20 rounded px-2 py-0.5 uppercase">
                                    {s.title || s.url}
                                  </a>
                                ))}
                              </div>
                            )}
                            {typeof active.output.confidence === "number" && (
                              <p className="mt-2 text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
                                Confidence: {Math.round(active.output.confidence * 100)}%
                              </p>
                            )}
                          </>
                        ) : active.mode === "forge" && (active.output as any)?.code_typescript ? (
                          <>
                            <p className="text-[12px] font-light text-foreground/90 leading-relaxed mb-1">
                              <span className="text-foreground">{(active.output as any).name || "Forged Extractor"}</span>
                            </p>
                            {(active.output as any).description && (
                              <p className="text-[10px] font-light text-muted-foreground/80 mb-2">{(active.output as any).description}</p>
                            )}
                            <pre className="text-[10px] font-mono text-foreground/85 overflow-auto max-h-[320px] leading-relaxed bg-background/40 border border-border/15 rounded p-2">{(active.output as any).code_typescript}</pre>
                            <button
                              onClick={() => {
                                const blob = new Blob([(active.output as any).code_typescript], { type: "text/typescript" });
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = `${((active.output as any).name || "extractor").replace(/\s+/g, "_").toLowerCase()}.ts`;
                                a.click();
                              }}
                              className="mt-2 text-[9px] font-light tracking-[0.2em] text-foreground/80 hover:text-foreground border border-border/30 rounded px-2 py-1 uppercase"
                            >
                              Download .ts
                            </button>
                          </>
                        ) : (
                          <pre className="text-[10px] font-mono text-foreground/80 overflow-auto max-h-[280px] leading-relaxed">{JSON.stringify(active.output, null, 2)}</pre>
                        )}
                      </div>
                    )}
                    {active.findings && (
                      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-3 w-3 text-amber-400/90" strokeWidth={1.5} />
                          <p className="text-[9px] font-light tracking-[0.25em] text-amber-200/90 uppercase">Recon Findings</p>
                        </div>
                        {Array.isArray(active.findings.exposed_data) && active.findings.exposed_data.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase mb-1">Exposed Data</p>
                            <ul className="space-y-1">
                              {active.findings.exposed_data.map((d: any, i: number) => (
                                <li key={i} className="text-[10px] font-light text-foreground/85">
                                  <span className="font-mono text-foreground/95">{d.path}</span>
                                  <span className="text-muted-foreground/70"> · {d.severity}</span>
                                  {d.why && <span className="block text-muted-foreground/70">{d.why}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(active.findings.exploit_hypotheses) && active.findings.exploit_hypotheses.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase mb-1">Exploit Hypotheses</p>
                            <ul className="space-y-1.5">
                              {active.findings.exploit_hypotheses.map((h: any, i: number) => (
                                <li key={i} className="text-[10px] font-light text-foreground/85 border-l border-amber-500/30 pl-2">
                                  <span className="font-mono text-foreground/95">{h.vector}</span>
                                  <span className="text-muted-foreground/70"> · {h.cwe || "—"} · {h.severity}</span>
                                  {h.why && <span className="block text-muted-foreground/70">{h.why}</span>}
                                  {h.next_step && <span className="block text-muted-foreground/60 italic">→ {h.next_step}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {active.findings.shutdown_feasibility && (
                          <div>
                            <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase mb-1">Shutdown Feasibility</p>
                            <p className="text-[10px] font-light text-foreground/85">{active.findings.shutdown_feasibility.summary}</p>
                          </div>
                        )}
                        {active.findings.raw && (
                          <pre className="text-[10px] font-mono text-foreground/75 overflow-auto max-h-[200px]">{active.findings.raw}</pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground/60">No run selected.</p>
            )}
          </div>
        </div>

        {/* Capability matrix */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-3.5 w-3.5 text-foreground/80" strokeWidth={1.5} />
                  <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">{c.label}</p>
                </div>
                <p className="text-[11px] font-light text-muted-foreground/70 leading-relaxed">{c.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="rounded-xl border border-border/15 bg-background/30 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/80 uppercase">{p.label}</p>
                </div>
                <p className="text-[10px] font-light text-muted-foreground/60 leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── RIGHT: AI chat popout ─────────────────────────────────────── */}
      {chatOpen && (
        <ZacoonChatPanel
          onClose={() => setChatOpen(false)}
          activeRun={active}
          onSeedTask={(t) => setTask(t)}
        />
      )}
    </div>
  );
};

// ─────────────────────── Chat popout (right rail) ───────────────────────

type ChatMsg = { role: "user" | "assistant"; content: string };

const ZacoonChatPanel = ({
  onClose, activeRun, onSeedTask,
}: { onClose: () => void; activeRun?: Run; onSeedTask: (t: string) => void }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Zacoon co-pilot online. Tell me what to automate — I'll draft the task brief and the action plan." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);

    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const byok = getActiveIntelMapByok();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-ai`;
      const system = `You are the ZACOON browser-agent co-pilot inside the Asher Dashboard. Help the operator design and refine browser automation tasks: target URLs, success criteria, selectors, anti-bot considerations, extraction shape. Be surgical. No filler. Format with short bold headers and tight bullets.${activeRun ? `\n\n[ACTIVE RUN]\nTask: ${activeRun.task}\nStatus: ${activeRun.status}\nSteps so far: ${activeRun.steps.length}` : ""}`;

      const { data: { session: _zacoonSession } } = await supabase.auth.getSession();
      const _zacoonToken = _zacoonSession?.access_token;
      if (!_zacoonToken) throw new Error("Sign in required.");
      const resp = await fetch(url, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${_zacoonToken}`,
          ...(byok ? { "x-byok-gemini-key": byok.apiKey } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: system }, ...next],
          mapContext: { surface: "zacoon_copilot" },
        }),
      });

      if (resp.status === 429) throw new Error("Rate limit — wait and retry.");
      if (resp.status === 401) throw new Error("Add a BYOK Gemini key in Settings.");
      if (!resp.ok || !resp.body) throw new Error(`Stream failed (${resp.status})`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", text2 = "", done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              text2 += delta.content;
              setMessages((m) => {
                const c = [...m];
                c[c.length - 1] = { role: "assistant", content: text2 };
                return c;
              });
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Co-pilot failed.";
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: `⚠ ${msg}` };
        return c;
      });
      toast.error(msg);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <aside className="flex h-full w-[360px] flex-shrink-0 flex-col border-l border-border/20 bg-sidebar/60 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-foreground/80" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">Co-Pilot</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground/70 hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-[11px] font-light leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-foreground/90 text-background"
                : "bg-background/40 border border-border/20 text-foreground/90"
            }`}>
              {m.content || (streaming && i === messages.length - 1 ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> : "")}
            </div>
          </div>
        ))}
      </div>

      {/* Quick suggestions */}
      <div className="border-t border-border/15 px-4 py-2 flex gap-1.5 overflow-x-auto">
        {[
          "Draft a task brief",
          "What selectors should I target?",
          "Add anti-bot evasion",
        ].map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="flex-shrink-0 text-[9px] font-light tracking-[0.15em] text-muted-foreground/70 hover:text-foreground border border-border/20 rounded-md px-2 py-1 uppercase whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="border-t border-border/15 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Instruct the co-pilot…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-border/30 bg-background/40 px-2.5 py-2 text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/90 text-background hover:bg-foreground disabled:opacity-40"
          >
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Send className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </button>
        </div>
        {messages.length > 1 && messages[messages.length - 1].role === "assistant" && !streaming && (
          <button
            onClick={() => onSeedTask(messages[messages.length - 1].content.slice(0, 280))}
            className="mt-2 flex items-center gap-1 text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 hover:text-foreground uppercase"
          >
            <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.5} /> Use as task brief
          </button>
        )}
      </div>
    </aside>
  );
};

export default AsherZacoonModule;
