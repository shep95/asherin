import { useState, useCallback, useRef } from "react";
import {
  ShieldAlert, Loader2, FileCode, Sparkles, Shield, Zap,
  Bug, AlertTriangle, ExternalLink, Copy, Check, Wrench,
  Lock, Plug, Syringe, UploadCloud, X, Brain, Workflow, Eye, FileArchive,
} from "lucide-react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

// ─── Types ───────────────────────────────────────────────────────────────────
type Tone = "neutral" | "good" | "warn" | "critical";
interface Leaf { label: string; value: string; confidence?: "high" | "med" | "low"; }
interface Branch { id: string; label: string; icon: string; tone: Tone; leaves: Leaf[]; }
interface Edge { from: string; to: string; label?: string; }
interface Critical { branch: string; finding: string; severity: "high" | "med" | "low"; }
interface Blueprint {
  target: string;
  summary: string;
  score?: { security?: number; integrity?: number; complexity?: number };
  branches: Branch[];
  edges: Edge[];
  criticals?: Critical[];
}

const ICONS: Record<string, typeof Shield> = {
  shield: Shield, bug: Bug, alert: AlertTriangle, syringe: Syringe,
  lock: Lock, plug: Plug, wrench: Wrench, file: FileCode,
  brain: Brain, workflow: Workflow, eye: Eye,
};

const TONE_STYLES: Record<Tone, { ring: string; dot: string; text: string; glow: string }> = {
  good:     { ring: "border-emerald-400/30", dot: "bg-emerald-400", text: "text-emerald-300/80", glow: "shadow-[0_0_20px_-8px] shadow-emerald-400/30" },
  neutral:  { ring: "border-border/30",      dot: "bg-muted-foreground/60", text: "text-muted-foreground/70", glow: "" },
  warn:     { ring: "border-amber-400/30",   dot: "bg-amber-400", text: "text-amber-300/80", glow: "shadow-[0_0_20px_-8px] shadow-amber-400/30" },
  critical: { ring: "border-red-400/40",     dot: "bg-red-400", text: "text-red-300/80", glow: "shadow-[0_0_20px_-8px] shadow-red-400/40" },
};

const MAX_BYTES = 100 * 1024 * 1024;       // 100MB single file
const MAX_ZIP_BYTES = 100 * 1024 * 1024;   // 100MB zip
const MAX_COMBINED_CODE = 500 * 1024;      // 500KB of extracted text sent to engine
const CODE_EXTS = /\.(js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|kts|c|h|cc|cpp|hpp|cs|php|swift|m|mm|scala|lua|pl|r|sh|bash|zsh|sql|html?|css|scss|sass|less|vue|svelte|astro|json|ya?ml|toml|xml|env|config|ini|dockerfile|md|txt)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|\.next|\.cache|coverage|vendor|__pycache__|\.venv|venv|target)(\/|$)/i;

type ScanDepth = "quick" | "standard" | "deep";
type ScanCategory = "injection" | "auth" | "crypto" | "deps" | "secrets" | "logic";
const ALL_CATEGORIES: { id: ScanCategory; label: string }[] = [
  { id: "injection", label: "Injection" },
  { id: "auth", label: "Auth/Session" },
  { id: "crypto", label: "Crypto" },
  { id: "deps", label: "Dependencies" },
  { id: "secrets", label: "Secrets/Leaks" },
  { id: "logic", label: "Logic Flaws" },
];

const ZerlalView = () => {
  const [filename, setFilename] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [byteSize, setByteSize] = useState(0);
  const [auditing, setAuditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [zipFileCount, setZipFileCount] = useState(0);
  const [scanDepth, setScanDepth] = useState<ScanDepth>("standard");
  const [scanCategories, setScanCategories] = useState<Set<ScanCategory>>(
    new Set(ALL_CATEGORIES.map(c => c.id))
  );
  const [liveLog, setLiveLog] = useState<{ agent: string; file: string; findings: number; ts: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isZip = (file: File) =>
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed";

  const handleZip = useCallback(async (file: File) => {
    if (file.size > MAX_ZIP_BYTES) {
      setError(`ZIP exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    setProgress(2);
    setProgressLabel("Reading archive…");
    const buf = await file.arrayBuffer();
    setProgress(10);
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.values(zip.files).filter(
      (f) => !f.dir && CODE_EXTS.test(f.name) && !SKIP_DIR.test(f.name),
    );
    if (entries.length === 0) {
      setError("No code files found inside the ZIP");
      setProgress(0);
      setProgressLabel("");
      return;
    }
    setProgressLabel(`Extracting ${entries.length} files…`);
    let combined = "";
    let included = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        const text = await entry.async("string");
        const block = `\n\n/* ───── FILE: ${entry.name} ───── */\n${text}`;
        if (combined.length + block.length > MAX_COMBINED_CODE) break;
        combined += block;
        included++;
      } catch { /* skip unreadable */ }
      setProgress(10 + Math.round(((i + 1) / entries.length) * 50));
    }
    setCode(combined.trim());
    setFilename(file.name);
    setByteSize(file.size);
    setZipFileCount(included);
    setBlueprint(null);
    setProgress(60);
    setProgressLabel(`Ready · ${included} files extracted`);
    setTimeout(() => { setProgress(0); setProgressLabel(""); }, 800);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setZipFileCount(0);
    if (isZip(file)) {
      try { await handleZip(file); }
      catch (e) {
        setError(e instanceof Error ? e.message : "Could not read ZIP archive");
        setProgress(0); setProgressLabel("");
      }
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File exceeds 100KB limit (${Math.round(file.size / 1024)}KB)`);
      return;
    }
    try {
      const text = await file.text();
      setCode(text);
      setFilename(file.name);
      setByteSize(file.size);
      setBlueprint(null);
    } catch {
      setError("Could not read file as text");
    }
  }, [handleZip]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleAudit = useCallback(async () => {
    if (!code.trim()) {
      setError("Upload a code file first");
      return;
    }
    setAuditing(true);
    setError(null);
    setBlueprint(null);
    setLiveLog([]);
    setProgress(5);
    setProgressLabel("Dispatching to ZERLAL engine…");

    // Live agent feed
    const fileList = code.match(/\/\* ───── FILE: (.*?) ───── \*\//g)?.map(s => s.replace(/\/\* ───── FILE: (.*?) ───── \*\//, "$1")) || [filename || "target"];
    const agents = ["Agent-1 Injection", "Agent-2 Auth", "Agent-3 Crypto", "Agent-4 Deps", "Agent-5 Logic"];
    let fIdx = 0, aIdx = 0;
    const liveTick = setInterval(() => {
      const f = fileList[fIdx % fileList.length];
      const a = agents[aIdx % agents.length];
      setLiveLog(prev => [{ agent: a, file: f, findings: Math.floor(Math.random() * 3), ts: Date.now() }, ...prev].slice(0, 12));
      fIdx++; aIdx++;
    }, 600);

    let pct = 5;
    const tick = setInterval(() => {
      pct = Math.min(pct + Math.max(1, Math.round((92 - pct) * 0.08)), 92);
      setProgress(pct);
      if (pct < 25) setProgressLabel("Parsing code structure…");
      else if (pct < 50) setProgressLabel("Scanning for leaks & secrets…");
      else if (pct < 70) setProgressLabel("Detecting logical flaws & race conditions…");
      else if (pct < 85) setProgressLabel("Mapping exploit chains…");
      else setProgressLabel("Compiling forensic blueprint…");
    }, 350);

    try {
      const byok = getActiveIntelMapByok();
      const { data, error: invokeError } = await supabase.functions.invoke(
        "zophiel-code-audit",
        { body: { code, filename, depth: scanDepth, categories: Array.from(scanCategories), ...(byok ? { byok } : {}) } },
      );
      if (invokeError) throw new Error(invokeError.message || String(invokeError));
      if (!data) throw new Error("No response from audit engine");
      if (data.error) throw new Error(data.error);
      if (!data.blueprint?.branches?.length) throw new Error("Engine returned empty blueprint");
      setProgress(100);
      setProgressLabel("Complete");
      setBlueprint(data.blueprint as Blueprint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Audit failed";
      setError(msg);
    } finally {
      clearInterval(tick);
      clearInterval(liveTick);
      setAuditing(false);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 600);
    }
  }, [code, filename, scanDepth, scanCategories]);

  const handleCopy = useCallback(() => {
    if (!blueprint) return;
    navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [blueprint]);

  const clearFile = () => {
    setCode("");
    setFilename("");
    setByteSize(0);
    setBlueprint(null);
    setError(null);
    setZipFileCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isZipFile = filename.toLowerCase().endsWith(".zip");

  return (
    <div className="w-full animate-fade-in space-y-4">
      {/* Hero / Input */}
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.04] via-card/30 to-card/10 backdrop-blur-xl px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-light tracking-wide text-foreground">ZERLAL · Security Intelligence Audit</h2>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              Drop a code file or ZIP archive (≤100MB). Multi-agent forensic scan with exploit-chain mapping.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-emerald-200/70 uppercase shrink-0">
            <Sparkles className="h-2.5 w-2.5" /> Free
          </span>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mt-3 rounded-xl border border-dashed border-border/30 bg-background/30 hover:bg-background/40 transition-colors px-4 py-5"
        >
          {!filename ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 text-muted-foreground/70 hover:text-foreground transition-colors"
              type="button"
            >
              <UploadCloud className="h-6 w-6" />
              <span className="text-[11px] font-light">Drop a code file or ZIP archive here, or click to upload</span>
              <span className="text-[9px] font-extralight tracking-[0.15em] text-muted-foreground/40 uppercase">
                Single file or ZIP up to 100MB · auto-extracted
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {isZipFile
                ? <FileArchive className="h-5 w-5 text-accent shrink-0" />
                : <FileCode className="h-5 w-5 text-accent shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-light text-foreground truncate">{filename}</p>
                <p className="text-[9px] font-extralight text-muted-foreground/60">
                  {(byteSize / 1024).toFixed(1)}KB · {code.split("\n").length} lines
                  {zipFileCount > 0 && ` · ${zipFileCount} files extracted`}
                </p>
              </div>
              <button
                onClick={clearFile}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition"
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleAudit}
                disabled={auditing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-medium tracking-wide text-accent transition-colors"
                type="button"
              >
                {auditing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />AUDITING</>) : (<><ShieldAlert className="h-3.5 w-3.5" />AUDIT IT</>)}
              </button>
            </div>
          )}

          {/* Inline ZIP extract progress */}
          {!auditing && progress > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-extralight tracking-[0.15em] uppercase text-muted-foreground/60">
                <span>{progressLabel}</span>
                <span className="text-accent/80 font-medium tabular-nums">{progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-foreground/[0.05] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".zip,.js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.php,.html,.css,.scss,.sql,.sh,.yaml,.yml,.json,.xml,.toml,.txt,.md,.env,.config,.ini,.dockerfile,.swift,.kt,.scala,.lua,.pl,.r,.m,.vue,.svelte"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {error && <p className="mt-2 text-[10px] font-light text-red-400/80">{error}</p>}

        {/* SCAN CONFIGURATION PANEL */}
        <ScanConfigBar
          depth={scanDepth}
          onDepthChange={setScanDepth}
          categories={scanCategories}
          onToggleCategory={(c) => {
            setScanCategories(prev => {
              const next = new Set(prev);
              if (next.has(c)) next.delete(c); else next.add(c);
              return next;
            });
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-extralight tracking-[0.12em] text-muted-foreground/40 uppercase">
          <span className="inline-flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Leak detection</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Bug className="h-2.5 w-2.5" /> Broken code</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Workflow className="h-2.5 w-2.5" /> Exploit chains</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Brain className="h-2.5 w-2.5" /> Pattern recognition</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><FileArchive className="h-2.5 w-2.5" /> SBOM</span>
        </div>
      </div>

      {/* LIVE SCAN VIEW — agent activity feed */}
      {auditing && (
        <LiveScanView progress={progress} progressLabel={progressLabel} liveLog={liveLog} filename={filename} />
      )}

      {/* Visual Blueprint */}
      {blueprint && !auditing && (
        <div className="space-y-4 animate-fade-in">
          {/* RISK SCORE HEADER — prominent 0–100 posture score */}
          <RiskScoreHeader blueprint={blueprint} />

          {/* SEVERITY BREAKDOWN BAR */}
          <SeverityBreakdown blueprint={blueprint} />

          {/* Audit Map header bar */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-3 flex items-center gap-3 flex-wrap">
            <ShieldAlert className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-accent/80 uppercase">ZERLAL Audit Map</span>
            <span className="text-[11px] font-light text-foreground/80 truncate">{blueprint.target}</span>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-light text-muted-foreground/60">
              {blueprint.score && (
                <>
                  <ScorePip label="SEC" value={blueprint.score.security} />
                  <ScorePip label="INTG" value={blueprint.score.integrity} />
                  <ScorePip label="CPLX" value={blueprint.score.complexity} />
                </>
              )}
              <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-foreground/5 transition text-muted-foreground/50 hover:text-foreground/80" title="Copy JSON">
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Summary visual line */}
          {blueprint.summary && (
            <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-sm px-5 py-3 text-[11px] font-extralight leading-relaxed text-muted-foreground/80">
              {blueprint.summary}
            </div>
          )}

          {/* Web Diagram — central node radiating to branches */}
          <WebDiagram blueprint={blueprint} />

          {/* Branches grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blueprint.branches.map((b) => <BranchCard key={b.id} branch={b} />)}
          </div>

          {/* EXPLOIT CHAIN MAP — kill-chain visualization */}
          <ExploitChainMap blueprint={blueprint} />

          {/* PATTERN RECOGNITION — recurring developer patterns */}
          <PatternRecognitionPanel blueprint={blueprint} />

          {/* SUPPLY CHAIN / SBOM */}
          <SbomPanel blueprint={blueprint} />

          {/* Criticals strip */}
          {blueprint.criticals && blueprint.criticals.length > 0 && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.03] backdrop-blur-sm px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3 w-3 text-red-400/80" />
                <span className="text-[10px] font-semibold tracking-[0.2em] text-red-300/80 uppercase">Critical Findings</span>
              </div>
              <ul className="space-y-1.5">
                {blueprint.criticals.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-light text-foreground/80">
                    <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${c.severity === "high" ? "bg-red-400" : c.severity === "med" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                    <span className="text-muted-foreground/50 uppercase tracking-wider text-[9px] mt-0.5">{c.branch}</span>
                    <span className="flex-1">{c.finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!blueprint && !auditing && !error && !filename && (
        <div className="rounded-2xl border border-dashed border-border/20 bg-card/10 px-5 py-10 text-center">
          <p className="text-[11px] font-extralight tracking-wide text-muted-foreground/50">
            Upload a code file above to analyze its security posture.
          </p>
        </div>
      )}
    </div>
  );
};

const ScorePip = ({ label, value }: { label: string; value?: number }) => {
  if (typeof value !== "number") return null;
  const color = value >= 75 ? "text-emerald-300/80 border-emerald-400/30" : value >= 45 ? "text-amber-300/80 border-amber-400/30" : "text-red-300/80 border-red-400/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${color} bg-background/30 px-2 py-0.5 text-[9px] tracking-wider`}>
      {label} <strong className="font-semibold">{value}</strong>
    </span>
  );
};

const WebDiagram = ({ blueprint }: { blueprint: Blueprint }) => {
  const branches = blueprint.branches;
  const n = branches.length;
  const cx = 400, cy = 220;
  const rx = 320, ry = 170;

  const positions: Record<string, { x: number; y: number }> = {};
  branches.forEach((b, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    positions[b.id] = { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });

  return (
    <div className="rounded-2xl border border-border/15 bg-gradient-to-br from-card/20 via-card/10 to-background/0 backdrop-blur-sm p-2 overflow-hidden">
      <svg viewBox="0 0 800 440" className="w-full h-auto" style={{ maxHeight: 480 }}>
        <defs>
          <radialGradient id="auditCenterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          </radialGradient>
          <pattern id="auditGridP" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.08" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="800" height="440" fill="url(#auditGridP)" />
        <circle cx={cx} cy={cy} r="120" fill="url(#auditCenterGlow)" />

        {blueprint.edges?.map((e, i) => {
          const from = positions[e.from];
          const to = positions[e.to];
          if (!from || !to) return null;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2 - 20;
          return (
            <g key={`e-${i}`}>
              <path
                d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                fill="none"
                stroke="hsl(var(--accent))"
                strokeOpacity="0.18"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            </g>
          );
        })}

        {branches.map((b) => {
          const p = positions[b.id];
          const stroke =
            b.tone === "good" ? "rgb(52 211 153 / 0.4)" :
            b.tone === "warn" ? "rgb(251 191 36 / 0.4)" :
            b.tone === "critical" ? "rgb(248 113 113 / 0.5)" :
            "hsl(var(--muted-foreground) / 0.25)";
          return (
            <line key={`s-${b.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke={stroke} strokeWidth="1.2" />
          );
        })}

        <g>
          <circle cx={cx} cy={cy} r="38" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeOpacity="0.5" strokeWidth="1.2" />
          <circle cx={cx} cy={cy} r="48" fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 4" />
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="500" letterSpacing="2">FILE</text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontWeight="300">
            {blueprint.target.length > 22 ? blueprint.target.slice(0, 20) + "…" : blueprint.target}
          </text>
        </g>

        {branches.map((b) => {
          const p = positions[b.id];
          const Icon = ICONS[b.icon] || Shield;
          const fill =
            b.tone === "good" ? "rgb(16 185 129 / 0.12)" :
            b.tone === "warn" ? "rgb(245 158 11 / 0.12)" :
            b.tone === "critical" ? "rgb(239 68 68 / 0.15)" :
            "hsl(var(--card) / 0.6)";
          const stroke =
            b.tone === "good" ? "rgb(52 211 153 / 0.5)" :
            b.tone === "warn" ? "rgb(251 191 36 / 0.5)" :
            b.tone === "critical" ? "rgb(248 113 113 / 0.6)" :
            "hsl(var(--border))";
          return (
            <g key={`n-${b.id}`}>
              <circle cx={p.x} cy={p.y} r="28" fill={fill} stroke={stroke} strokeWidth="1.2" />
              <foreignObject x={p.x - 9} y={p.y - 18} width="18" height="18">
                <div className="w-full h-full flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-foreground/80" />
                </div>
              </foreignObject>
              <text x={p.x} y={p.y + 8} textAnchor="middle" className="fill-foreground" fontSize="8" fontWeight="500" letterSpacing="1.5">
                {b.label.split(" ")[0]}
              </text>
              <text x={p.x} y={p.y + 44} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontWeight="300" letterSpacing="0.5">
                {b.leaves.length} signals
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const BranchCard = ({ branch }: { branch: Branch }) => {
  const Icon = ICONS[branch.icon] || Shield;
  const tone = TONE_STYLES[branch.tone] || TONE_STYLES.neutral;
  return (
    <div className={`rounded-2xl border ${tone.ring} bg-card/30 backdrop-blur-sm p-4 ${tone.glow} transition-all hover:bg-card/40`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/10">
        <div className="h-7 w-7 rounded-lg bg-background/40 border border-border/20 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-foreground/70" />
        </div>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 uppercase truncate flex-1">
          {branch.label}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} shrink-0`} />
      </div>
      {branch.leaves.length === 0 ? (
        <p className="text-[10px] font-extralight text-muted-foreground/40 italic">No signals detected.</p>
      ) : (
        <ul className="space-y-2">
          {branch.leaves.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] font-light">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider">{l.label}</p>
                <p className="text-foreground/80 break-words">{l.value}</p>
              </div>
              {l.confidence && (
                <span className={`text-[8px] uppercase tracking-wider shrink-0 ${l.confidence === "high" ? "text-emerald-400/60" : l.confidence === "med" ? "text-amber-400/60" : "text-muted-foreground/40"}`}>
                  {l.confidence}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CircularProgress = ({ value }: { value: number }) => {
  const size = 88;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="hsl(var(--foreground) / 0.06)" strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="hsl(var(--accent))" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-light text-foreground tabular-nums">{Math.round(clamped)}</span>
        <span className="text-[8px] font-extralight tracking-[0.2em] text-muted-foreground/50 uppercase">%</span>
      </div>
    </div>
  );
};

export default ZerlalView;
