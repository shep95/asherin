import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ShieldAlert, Loader2, FileCode, Sparkles, Shield, Zap,
  Bug, AlertTriangle, ExternalLink, Copy, Check, Wrench,
  Lock, Plug, Syringe, UploadCloud, X, Brain, Workflow, Eye, FileArchive, KeyRound,
  Download, FileText, FileJson, FileSpreadsheet, GitBranch, History,
} from "lucide-react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok, isIntelMapByokEnabled } from "@/lib/intelMapByok";
import IntelMapByokPanel from "./IntelMapByokPanel";
import { exportCSV, exportJSON, exportPDF } from "@/lib/exportEngine";

// ─── Types ───────────────────────────────────────────────────────────────────
type Tone = "neutral" | "good" | "warn" | "critical";
interface Leaf { label: string; value: string; confidence?: "high" | "med" | "low"; }
interface Branch { id: string; label: string; icon: string; tone: Tone; leaves: Leaf[]; }
interface Edge { from: string; to: string; label?: string; }
interface Critical { branch: string; finding: string; severity: "high" | "med" | "low"; }
interface Intel {
  board_score?: { total: number; code: number; supply_chain: number; infra: number; human: number; trend: string; peer_median: number };
  nation_state?: { primary_ttp: string; groups: { id: string; aka: string; nation: string; sectors: string; rationale: string }[]; active_campaign_note: string };
  red_team?: { stages: { k: string; reachable: boolean; via: string }[] };
  quantum_crypto?: { algo: string; status: "vulnerable" | "safe"; evidence: string; recommendation: string }[];
  ai_generated_code?: { pattern: string; evidence: string; confidence: "high" | "med" | "low" }[];
  dark_web?: { k: string; v: string }[];
  ueba?: { k: string; v: string }[];
  ot_ics?: { k: string; exposed: boolean; evidence: string }[];
  incident_response?: { armed: boolean; affected_surfaces: number; forensic_artifacts: string; breach_notice_drafts: string[]; triage_tasks: number };
  siem?: { k: string; status: string; alerts_queued: number }[];
  cve_pipeline?: { k: string; n: number; active: boolean }[];
  geopolitical?: { scenario: string; risk: "HIGH" | "MED" | "LOW"; time_to_exploit: string }[];
  compliance?: { framework: string; violations: number; controls: string[] }[];
  memory_safety?: { k: string; hit: boolean; evidence: string }[];
  infra_misconfig?: { k: string; hit: boolean; evidence: string }[];
  zero_day_confidence?: { branch: string; finding: string; confidence_pct: number; novel: boolean; cve_match: string }[];
  remediation_sla?: { critical_24h: number; high_72h: number; medium_14d: number; low_30d: number };
}
interface Blueprint {
  target: string;
  summary: string;
  score?: { security?: number; integrity?: number; complexity?: number };
  branches: Branch[];
  edges: Edge[];
  criticals?: Critical[];
  intel?: Intel;
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
type ScanCategory =
  | "injection" | "auth" | "crypto" | "deps" | "secrets" | "logic"
  | "workflow" | "bugs" | "breaking" | "duplication" | "performance"
  | "concurrency" | "errorhandling" | "memory" | "validation"
  | "accessibility" | "api" | "config" | "supplychain" | "ai_prompt"
  | "ui_ux" | "business" | "observability" | "privacy" | "compliance"
  | "deadcode" | "other";
type InputMode = "zip" | "github" | "paste";
type ZerlalPage = "scan" | "history" | "compliance" | "patterns";
type ScanHistoryEntry = { id: string; target: string; risk: number; files: number; timestamp: string; critical: number; high: number; medium: number; low: number };
const ALL_CATEGORIES: { id: ScanCategory; label: string }[] = [
  { id: "injection", label: "Injection" },
  { id: "auth", label: "Auth/Session" },
  { id: "crypto", label: "Crypto" },
  { id: "deps", label: "Dependencies" },
  { id: "secrets", label: "Secrets/Leaks" },
  { id: "logic", label: "Logic Flaws" },
  { id: "workflow", label: "Workflow Flaws" },
  { id: "bugs", label: "Bugs" },
  { id: "breaking", label: "Code Breaking" },
  { id: "duplication", label: "Duplication" },
  { id: "performance", label: "Performance" },
  { id: "concurrency", label: "Race / Concurrency" },
  { id: "errorhandling", label: "Error Handling" },
  { id: "memory", label: "Memory / Leaks" },
  { id: "validation", label: "Input Validation" },
  { id: "accessibility", label: "Accessibility" },
  { id: "api", label: "API Contract" },
  { id: "config", label: "Misconfiguration" },
  { id: "supplychain", label: "Supply Chain" },
  { id: "ai_prompt", label: "Prompt Injection" },
  { id: "ui_ux", label: "UI / UX Flaws" },
  { id: "business", label: "Business Logic" },
  { id: "observability", label: "Logging / Observability" },
  { id: "privacy", label: "Privacy / PII" },
  { id: "compliance", label: "Compliance" },
  { id: "deadcode", label: "Dead / Unused Code" },
  { id: "other", label: "Other / Uncategorized" },
];

const normalizeGithubUrl = (url: string) => {
  if (!url) return "";
  if (/^https:\/\/raw\.githubusercontent\.com\//i.test(url)) return url;
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}` : "";
};

const blueprintFindingSignal = (code: string, file: string, agent: string) => {
  const fileChunk = code.includes(`FILE: ${file}`)
    ? code.split(`FILE: ${file}`).slice(1).join("\n").slice(0, 12000)
    : code.slice(0, 12000);
  const hay = fileChunk.toLowerCase();
  const probes = agent.includes("Injection") ? [/eval\(/, /innerhtml/, /execute\(/, /raw\(/, /select .*\$\{/, /exec\(/]
    : agent.includes("Auth") ? [/localstorage/, /sessionstorage/, /jwt/, /admin/, /role/, /password/]
    : agent.includes("Crypto") ? [/md5/, /sha1/, /rsa/, /des/, /math\.random/, /secret/, /private[_-]?key/]
    : agent.includes("Deps") ? [/package\.json/, /import /, /require\(/, /from "/, /from '/]
    : [/todo/, /fixme/, /catch \{/, /settimeout/, /promise/, /async/, /await/];
  return probes.reduce((n, rx) => n + (rx.test(hay) ? 1 : 0), 0);
};

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
  const [byokOpen, setByokOpen] = useState(false);
  const [byokActive, setByokActive] = useState<boolean>(() => isIntelMapByokEnabled());
  const [inputMode, setInputMode] = useState<InputMode>("zip");
  const [githubUrl, setGithubUrl] = useState("");
  const [activePage, setActivePage] = useState<ZerlalPage>("scan");
  const [scanStartedAt, setScanStartedAt] = useState<string | null>(null);
  const [scanCompletedAt, setScanCompletedAt] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("zerlal_scan_history");
      if (raw) setScanHistory(JSON.parse(raw));
    } catch { /* ignore malformed local history */ }
  }, []);

  const fileCount = useMemo(() => {
    if (zipFileCount > 0) return zipFileCount;
    if (!code.trim()) return 0;
    const markers = code.match(/\/\* ───── FILE: .*? ───── \*\//g);
    return markers?.length || 1;
  }, [code, zipFileCount]);

  const persistHistory = useCallback((bp: Blueprint) => {
    const counts = countSeverities(bp);
    const entry: ScanHistoryEntry = {
      id: `${Date.now()}`,
      target: bp.target || filename || "target",
      risk: computeRiskScore(bp),
      files: fileCount || 1,
      timestamp: new Date().toISOString(),
      critical: counts.critical,
      high: counts.high,
      medium: counts.med,
      low: counts.low,
    };
    setScanHistory(prev => {
      const next = [entry, ...prev].slice(0, 25);
      localStorage.setItem("zerlal_scan_history", JSON.stringify(next));
      return next;
    });
  }, [fileCount, filename]);

  const isZip = (file: File) =>
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed";

  const importGithubTarget = useCallback(async () => {
    const rawUrl = normalizeGithubUrl(githubUrl.trim());
    if (!rawUrl) {
      setError("Paste a public GitHub raw/blob file URL first");
      return;
    }
    setError(null);
    setProgress(8);
    setProgressLabel("Fetching GitHub source…");
    try {
      const resp = await fetch(rawUrl);
      if (!resp.ok) throw new Error(`GitHub fetch failed (${resp.status})`);
      const text = await resp.text();
      if (!text.trim()) throw new Error("GitHub file returned empty content");
      if (text.length > MAX_COMBINED_CODE) throw new Error("GitHub file exceeds 500KB scan bundle limit");
      setCode(text);
      setFilename(rawUrl.split("/").pop() || "github-source");
      setByteSize(new TextEncoder().encode(text).length);
      setZipFileCount(0);
      setBlueprint(null);
      setProgress(100);
      setProgressLabel("GitHub source ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import GitHub source");
    } finally {
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 800);
    }
  }, [githubUrl]);

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
    setScanStartedAt(new Date().toISOString());
    setScanCompletedAt(null);
    setProgress(5);
    setProgressLabel("Dispatching to ZERLAL engine…");

    // Live agent feed
    const fileList = code.match(/\/\* ───── FILE: (.*?) ───── \*\//g)?.map(s => s.replace(/\/\* ───── FILE: (.*?) ───── \*\//, "$1")) || [filename || "target"];
    const agents = ["Agent-1 Injection", "Agent-2 Auth", "Agent-3 Crypto", "Agent-4 Deps", "Agent-5 Logic"];
    let fIdx = 0, aIdx = 0;
    const liveTick = setInterval(() => {
      const f = fileList[fIdx % fileList.length];
      const a = agents[aIdx % agents.length];
        const observed = blueprintFindingSignal(code, f, a);
        setLiveLog(prev => [{ agent: a, file: f, findings: observed, ts: Date.now() }, ...prev].slice(0, 12));
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
      const bp = data.blueprint as Blueprint;
      setBlueprint(bp);
      setScanCompletedAt(new Date().toISOString());
      persistHistory(bp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Audit failed";
      setError(msg);
    } finally {
      clearInterval(tick);
      clearInterval(liveTick);
      setAuditing(false);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 600);
    }
  }, [code, filename, scanDepth, scanCategories, persistHistory]);

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
      <ZerlalTopNav active={activePage} onChange={setActivePage} />
      {activePage !== "scan" && (
        <ZerlalIntelPage page={activePage} history={scanHistory} blueprint={blueprint} />
      )}
      {activePage === "scan" && (
        <>
      <ZerlalDashboardHeader
        blueprint={blueprint}
        auditing={auditing}
        progress={progress}
        progressLabel={progressLabel}
        liveLog={liveLog}
        fileCount={fileCount}
        scanStartedAt={scanStartedAt}
        scanCompletedAt={scanCompletedAt}
      />
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
          <button
            onClick={() => setByokOpen(true)}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-light tracking-wide transition-colors shrink-0 ${
              byokActive
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-border/30 bg-card/30 text-muted-foreground/70 hover:text-foreground hover:border-border/50"
            }`}
            title={byokActive
              ? "Your API key is hooked into the Zophiel engine — used for ZERLAL, Search, Intel Map, Link Extract, all tabs"
              : "Bring your own API key — hooks into the Zophiel engine across every tab and skips the shared queue"}
            type="button"
          >
            <KeyRound className="h-3 w-3" />
            {byokActive ? "My API Key: ON" : "Use My API Key"}
          </button>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-emerald-200/70 uppercase shrink-0">
            <Sparkles className="h-2.5 w-2.5" /> Free
          </span>
        </div>

        {/* BYOK hookup notice */}
        <div className={`mt-2 rounded-lg border px-3 py-2 flex items-start gap-2 text-[10px] font-extralight leading-relaxed ${
          byokActive
            ? "border-emerald-400/25 bg-emerald-400/[0.04] text-emerald-100/80"
            : "border-border/20 bg-background/30 text-muted-foreground/70"
        }`}>
          <KeyRound className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
          <span>
            {byokActive
              ? <>Your API key is <strong className="font-medium text-emerald-200">hooked into the Zophiel engine</strong> — used for ZERLAL audits and every Zophiel tab. No queue, no rate limits.</>
              : <>Hitting limits or scanning at high volume? <button onClick={() => setByokOpen(true)} className="underline underline-offset-2 hover:text-foreground">Bring your own API key</button> — it gets <strong className="font-medium text-foreground/80">hooked into our Zophiel engine</strong> and powers ZERLAL plus every other Zophiel tab.</>}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-border/20 bg-background/25 px-3 py-3">
          <div className="flex flex-wrap items-center gap-1 mb-3">
            {[
              { id: "zip" as const, label: "ZIP Upload", icon: FileArchive },
              { id: "github" as const, label: "GitHub Link", icon: GitBranch },
              { id: "paste" as const, label: "Paste Code", icon: FileCode },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setInputMode(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-light tracking-wide transition-colors ${
                  inputMode === m.id ? "border-accent/50 bg-accent/15 text-accent" : "border-border/20 bg-card/20 text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                <m.icon className="h-3 w-3" /> {m.label}
              </button>
            ))}
          </div>

          {inputMode === "zip" && (
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="rounded-xl border border-dashed border-border/30 bg-background/30 hover:bg-background/40 transition-colors px-4 py-5"
            >
              {!filename ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 text-muted-foreground/70 hover:text-foreground transition-colors"
                  type="button"
                >
                  <UploadCloud className="h-6 w-6" />
                  <span className="text-[11px] font-light">Drop a code file or ZIP archive here, or click to upload</span>
                  <span className="text-[9px] font-extralight tracking-[0.15em] text-muted-foreground/40 uppercase">Single file or ZIP up to 100MB · auto-extracted</span>
                </button>
              ) : <SelectedTarget filename={filename} isZipFile={isZipFile} byteSize={byteSize} lineCount={code.split("\n").length} zipFileCount={zipFileCount} auditing={auditing} onClear={clearFile} onAudit={handleAudit} />}
            </div>
          )}

          {inputMode === "github" && (
            <div className="rounded-xl border border-border/20 bg-background/30 px-3 py-3 space-y-3">
              <div className="flex gap-2">
                <input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/org/repo/blob/main/src/auth/session.ts"
                  className="flex-1 rounded-lg border border-border/20 bg-card/30 px-3 py-2 text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/40"
                />
                <button type="button" onClick={importGithubTarget} className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[10px] font-medium tracking-wide text-accent hover:bg-accent/20 transition-colors">Import</button>
              </div>
              {filename && <SelectedTarget filename={filename} isZipFile={false} byteSize={byteSize} lineCount={code.split("\n").length} zipFileCount={zipFileCount} auditing={auditing} onClear={clearFile} onAudit={handleAudit} />}
            </div>
          )}

          {inputMode === "paste" && (
            <div className="rounded-xl border border-border/20 bg-background/30 px-3 py-3 space-y-3">
              <textarea
                value={code}
                onChange={(e) => { setCode(e.target.value); setFilename("pasted-code.ts"); setByteSize(new TextEncoder().encode(e.target.value).length); setZipFileCount(0); setBlueprint(null); }}
                placeholder="Paste code here for ZERLAL analysis…"
                className="min-h-[180px] w-full resize-y rounded-lg border border-border/20 bg-card/30 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/40"
              />
              {code.trim() && <SelectedTarget filename={filename || "pasted-code.ts"} isZipFile={false} byteSize={byteSize} lineCount={code.split("\n").length} zipFileCount={zipFileCount} auditing={auditing} onClear={clearFile} onAudit={handleAudit} />}
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

          {/* FLAW TYPE TOTALS — every flaw class incl. "Other" so nothing is dropped */}
          <FlawTypeTotalsPanel blueprint={blueprint} />

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

          {/* ZERLAL Model — stratified pantheon hierarchy (rival of Gaythropic) */}
          <GaythropicMythosModel blueprint={blueprint} />

          {/* Branches grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blueprint.branches.map((b) => <BranchCard key={b.id} branch={b} />)}
          </div>

          <RemediationActionPanel blueprint={blueprint} />

          {/* EXPLOIT CHAIN MAP — kill-chain visualization */}
          <ExploitChainMap blueprint={blueprint} />

          {/* PATTERN RECOGNITION — recurring developer patterns */}
          <PatternRecognitionPanel blueprint={blueprint} />

          {/* SUPPLY CHAIN / SBOM */}
          <SbomPanel blueprint={blueprint} />

          {/* ── ZERLAL TIER 1 — DIFFERENTIATORS ───────────────────────── */}
          <BoardRiskScorePanel blueprint={blueprint} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NationStateAttributionPanel blueprint={blueprint} />
            <AutonomousRedTeamPanel blueprint={blueprint} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <QuantumCryptoAuditPanel blueprint={blueprint} />
            <AiGeneratedCodeSecurityPanel blueprint={blueprint} />
          </div>

          {/* ── ZERLAL TIER 2 — ENTERPRISE ────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DarkWebIntelPanel blueprint={blueprint} />
            <UebaInsiderThreatPanel blueprint={blueprint} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OtIcsScadaPanel blueprint={blueprint} />
            <IncidentResponseCommandPanel blueprint={blueprint} />
          </div>
          <SiemIntegrationStatusPanel blueprint={blueprint} />

          {/* ── ZERLAL TIER 3 — GOVERNMENT / COMPLIANCE ───────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CvePipelinePanel blueprint={blueprint} />
            <GeopoliticalThreatPanel blueprint={blueprint} />
          </div>
          <ComplianceAutoMapPanel blueprint={blueprint} />
          <MemorySafetyPanel blueprint={blueprint} />
          <InfraMisconfigPanel blueprint={blueprint} />
          <ZeroDayConfidencePanel blueprint={blueprint} />
          <RemediationSlaPanel blueprint={blueprint} />
          <ScanHistoryPanel blueprint={blueprint} />

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

      {/* Empty state — advertises the full ZERLAL intelligence suite */}
      {!blueprint && !auditing && !error && !filename && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-border/20 bg-card/10 px-5 py-8 text-center">
            <ShieldAlert className="h-5 w-5 text-foreground/40 mx-auto mb-2" />
            <p className="text-[11px] font-light tracking-wide text-foreground/70">
              Upload a code file to unlock the full <span className="text-foreground font-semibold">ZERLAL</span> intelligence suite.
            </p>
            <p className="text-[10px] font-extralight tracking-wide text-muted-foreground/50 mt-1">
              Live signal — no simulation. Backed by Zophiel's adversarial reasoning engine.
            </p>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm px-5 py-4">
            <div className="text-[9px] font-semibold tracking-[0.25em] text-foreground/60 uppercase mb-3">
              Intelligence Panels Activated On Scan
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { tier: "T1", label: "Board Risk Score (0–1000)" },
                { tier: "T1", label: "Nation-State Attribution (MITRE)" },
                { tier: "T1", label: "Autonomous Red Team — Kill Chain" },
                { tier: "T1", label: "Quantum Cryptography Audit" },
                { tier: "T1", label: "AI-Generated Code Security" },
                { tier: "T2", label: "Dark Web / Leak Intelligence" },
                { tier: "T2", label: "UEBA — Insider Threat" },
                { tier: "T2", label: "OT / ICS / SCADA Exposure" },
                { tier: "T2", label: "Incident Response Command" },
                { tier: "T2", label: "SIEM Integration Status" },
                { tier: "T3", label: "CVE Pipeline + 0-Day Confidence" },
                { tier: "T3", label: "Geopolitical Threat Map" },
                { tier: "T3", label: "Compliance Auto-Map (NIST/SOC2/GDPR)" },
                { tier: "FX", label: "Memory Safety Forensics" },
                { tier: "FX", label: "Infrastructure Misconfig" },
                { tier: "FX", label: "Remediation SLA Tracker" },
                { tier: "FX", label: "Exploit Chain Map" },
                { tier: "FX", label: "Scan History / Posture Trend" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-2 rounded-lg border border-border/15 bg-background/30 px-2.5 py-1.5">
                  <span className={`text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    p.tier === "T1" ? "bg-red-400/10 text-red-300/80 border border-red-400/20"
                    : p.tier === "T2" ? "bg-amber-400/10 text-amber-300/80 border border-amber-400/20"
                    : p.tier === "T3" ? "bg-blue-400/10 text-blue-300/80 border border-blue-400/20"
                    : "bg-foreground/5 text-foreground/50 border border-border/20"
                  }`}>{p.tier}</span>
                  <span className="text-[10px] font-light text-foreground/70 truncate">{p.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-extralight tracking-wide text-muted-foreground/40 mt-3 text-center">
              18+ live intelligence panels render after upload. Use your own API key (BYOK) to bypass shared rate limits.
            </p>
          </div>
        </div>
      )}
        </>
      )}
      {/* BYOK Panel */}
      <IntelMapByokPanel
        open={byokOpen}
        onClose={() => setByokOpen(false)}
        onChange={() => setByokActive(isIntelMapByokEnabled())}
      />
    </div>
  );
};

const SelectedTarget = ({
  filename, isZipFile, byteSize, lineCount, zipFileCount, auditing, onClear, onAudit,
}: {
  filename: string; isZipFile: boolean; byteSize: number; lineCount: number; zipFileCount: number; auditing: boolean; onClear: () => void; onAudit: () => void;
}) => (
  <div className="flex items-center gap-3">
    {isZipFile ? <FileArchive className="h-5 w-5 text-accent shrink-0" /> : <FileCode className="h-5 w-5 text-accent shrink-0" />}
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-light text-foreground truncate">{filename}</p>
      <p className="text-[9px] font-extralight text-muted-foreground/60">
        {(byteSize / 1024).toFixed(1)}KB · {lineCount} lines{zipFileCount > 0 && ` · ${zipFileCount} files scanned`}
      </p>
    </div>
    <button onClick={onClear} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition" type="button">
      <X className="h-3.5 w-3.5" />
    </button>
    <button onClick={onAudit} disabled={auditing} className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-medium tracking-wide text-accent transition-colors" type="button">
      {auditing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />AUDITING</>) : (<><ShieldAlert className="h-3.5 w-3.5" />AUDIT IT</>)}
    </button>
  </div>
);

const ZerlalTopNav = ({ active, onChange }: { active: ZerlalPage; onChange: (p: ZerlalPage) => void }) => {
  const pages = [
    { id: "scan" as const, label: "Scan", icon: ShieldAlert },
    { id: "history" as const, label: "Scan History", icon: History },
    { id: "compliance" as const, label: "Compliance Map", icon: Shield },
    { id: "patterns" as const, label: "Pattern Intelligence", icon: Brain },
  ];
  return (
    <div className="rounded-2xl border border-border/20 bg-card/25 backdrop-blur-sm p-1 flex flex-wrap gap-1">
      {pages.map((p) => (
        <button key={p.id} type="button" onClick={() => onChange(p.id)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-light tracking-[0.16em] uppercase transition-colors ${active === p.id ? "border-accent/50 bg-accent/15 text-accent" : "border-transparent text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}>
          <p.icon className="h-3 w-3" /> {p.label}
        </button>
      ))}
    </div>
  );
};

const ZerlalDashboardHeader = ({ blueprint, auditing, progress, progressLabel, liveLog, fileCount, scanStartedAt, scanCompletedAt }: {
  blueprint: Blueprint | null; auditing: boolean; progress: number; progressLabel: string; liveLog: { agent: string; file: string; findings: number; ts: number }[]; fileCount: number; scanStartedAt: string | null; scanCompletedAt: string | null;
}) => {
  const counts = blueprint ? countSeverities(blueprint) : { critical: 0, high: 0, med: 0, low: 0 };
  const risk = blueprint ? computeRiskScore(blueprint) : 0;
  const latest = liveLog[0];
  const stamp = scanCompletedAt || scanStartedAt;
  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-4 space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[170px_1fr_210px] gap-4 items-center">
        <div className="text-center lg:text-left">
          <p className="text-[9px] font-semibold tracking-[0.25em] text-muted-foreground/60 uppercase">Overall Risk Score</p>
          <div className="flex items-end justify-center lg:justify-start gap-1 mt-1">
            <span className={`text-5xl font-extralight tabular-nums ${risk >= 70 ? "text-red-300" : risk >= 40 ? "text-amber-300" : risk > 0 ? "text-emerald-300" : "text-foreground/70"}`}>{risk}</span>
            <span className="pb-2 text-[10px] tracking-[0.25em] text-muted-foreground/50 uppercase">/100</span>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-3 text-[10px] font-light">
            <span className="tracking-[0.2em] text-foreground/70 uppercase">Severity Breakdown</span>
            <span className="text-muted-foreground/60 tabular-nums">Critical {counts.critical} · High {counts.high} · Medium {counts.med} · Low {counts.low}</span>
          </div>
          <SeverityMiniBar counts={counts} />
          <div className="rounded-lg border border-border/15 bg-background/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-[10px] font-light text-muted-foreground/60">
              <span className="truncate">{auditing ? (latest ? `${latest.agent.replace("Agent-", "Agent ")} — analyzing ${latest.file} — ${latest.findings} findings so far` : progressLabel || "Agents starting…") : blueprint ? `Last scan complete — ${blueprint.target}` : "No scan running — upload, import, or paste code"}</span>
              <span className="tabular-nums text-accent/80">{auditing ? `${progress}%` : blueprint ? "100%" : "0%"}</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-foreground/[0.05] overflow-hidden"><div className="h-full bg-accent/80 transition-all duration-300" style={{ width: `${auditing ? progress : blueprint ? 100 : 0}%` }} /></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <HeaderMetric label="Files" value={fileCount || 0} />
          <HeaderMetric label="Timestamp" value={stamp ? new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />
          <HeaderMetric label="MITRE" value={blueprint?.intel?.nation_state?.primary_ttp?.split("—")[0]?.trim() || "—"} />
          <HeaderMetric label="CVE" value={blueprint?.intel?.zero_day_confidence?.length || 0} />
        </div>
      </div>
      {blueprint && <ZerlalExportActions blueprint={blueprint} />}
    </div>
  );
};

const HeaderMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border border-border/15 bg-background/30 px-3 py-2">
    <p className="text-[8px] tracking-[0.25em] text-muted-foreground/50 uppercase">{label}</p>
    <p className="text-[11px] font-light text-foreground/85 tabular-nums truncate">{value}</p>
  </div>
);

const SeverityMiniBar = ({ counts }: { counts: { critical: number; high: number; med: number; low: number } }) => {
  const total = counts.critical + counts.high + counts.med + counts.low || 1;
  return <div className="h-2 rounded-full overflow-hidden flex bg-foreground/[0.05]"><div className="bg-red-400/90" style={{ width: `${(counts.critical / total) * 100}%` }} /><div className="bg-orange-400/80" style={{ width: `${(counts.high / total) * 100}%` }} /><div className="bg-amber-400/80" style={{ width: `${(counts.med / total) * 100}%` }} /><div className="bg-emerald-400/70" style={{ width: `${(counts.low / total) * 100}%` }} /></div>;
};

const reportItems = (blueprint: Blueprint) => blueprint.branches.flatMap((b) => b.leaves.map((l) => ({ title: `${b.label}: ${l.label}`, snippet: l.value, metadata: { confidence: l.confidence, branch: b.id } })));

const ZerlalExportActions = ({ blueprint }: { blueprint: Blueprint }) => {
  const name = `zerlal-${blueprint.target.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 32)}-${Date.now()}`;
  const items = reportItems(blueprint);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/10 pt-3">
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase"><Download className="h-3 w-3" /> Export Full Report</span>
      <button onClick={() => exportPDF(name, items, { blueprint })} className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition"><FileText className="inline h-3 w-3 mr-1" />PDF</button>
      <button onClick={() => exportJSON(name, items, { blueprint })} className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition"><FileJson className="inline h-3 w-3 mr-1" />JSON</button>
      <button onClick={() => exportCSV(name, items)} className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition"><FileSpreadsheet className="inline h-3 w-3 mr-1" />CSV</button>
    </div>
  );
};

const ZerlalIntelPage = ({ page, history, blueprint }: { page: ZerlalPage; history: ScanHistoryEntry[]; blueprint: Blueprint | null }) => {
  if (page === "history") return <HistoryPage history={history} />;
  if (page === "compliance") return <CompliancePage blueprint={blueprint} />;
  return <PatternsPage blueprint={blueprint} history={history} />;
};

const HistoryPage = ({ history }: { history: ScanHistoryEntry[] }) => (
  <PanelShell title="Scan History · Posture Trend" icon={History} accent="neutral">
    {history.length === 0 ? <Awaiting note="No persisted scans yet. Run ZERLAL once and this timeline fills with real local scan records." /> : <div className="space-y-2">{history.map((h) => <div key={h.id} className="rounded-lg border border-border/15 bg-background/30 px-3 py-2 flex items-center gap-3 text-[10px]"><span className="text-2xl font-light tabular-nums text-foreground/85 w-12">{h.risk}</span><span className="flex-1 truncate text-foreground/80">{h.target}</span><span className="text-muted-foreground/60">{h.files} files</span><span className="text-muted-foreground/50">{new Date(h.timestamp).toLocaleString()}</span></div>)}</div>}
  </PanelShell>
);

const CompliancePage = ({ blueprint }: { blueprint: Blueprint | null }) => blueprint ? <ComplianceAutoMapPanel blueprint={blueprint} /> : <PanelShell title="Compliance Map" icon={Shield} accent="emerald"><Awaiting note="Run a scan to map findings to NIST, SOC2, ISO27001, FedRAMP, GDPR, and HIPAA controls." /></PanelShell>;

const PatternsPage = ({ blueprint, history }: { blueprint: Blueprint | null; history: ScanHistoryEntry[] }) => (
  <div className="space-y-3">
    {blueprint ? <PatternRecognitionPanel blueprint={blueprint} /> : <PanelShell title="Pattern Intelligence" icon={Brain} accent="cyan"><Awaiting note="Run a scan to surface recurring cross-file developer vulnerability patterns." /></PanelShell>}
    <PanelShell title="Cross-Project Signal" icon={Workflow} accent="neutral"><p className="text-[10px] font-extralight text-muted-foreground/60">{history.length} real local scan records available for posture trend comparison.</p></PanelShell>
  </div>
);

const ScorePip = ({ label, value }: { label: string; value?: number }) => {
  if (typeof value !== "number") return null;
  const color = value >= 75 ? "text-emerald-300/80 border-emerald-400/30" : value >= 45 ? "text-amber-300/80 border-amber-400/30" : "text-red-300/80 border-red-400/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${color} bg-background/30 px-2 py-0.5 text-[9px] tracking-wider`}>
      {label} <strong className="font-semibold">{value}</strong>
    </span>
  );
};

/**
 * GaythropicMythosModel — replaces the legacy radial web diagram.
 *
 * Mythos framework (rival to Gaythropic's "Constitution"):
 *   - APEX  : the artifact under audit (the "Aeon")
 *   - PANTHEONS : three mythos strata grouped by severity tone
 *       · Wrathful Pantheon  (critical findings)  — top stratum
 *       · Twilight Pantheon  (warn findings)      — middle stratum
 *       · Verdant Pantheon   (good / neutral)     — lower stratum
 *   - GLYPH LINES : ley-line edges between branches (from blueprint.edges)
 *   - SIGILS : per-branch nodes carry their icon + signal count
 */
const GaythropicMythosModel = ({ blueprint }: { blueprint: Blueprint }) => {
  const branches = blueprint.branches;

  // Stratify branches into the three mythos pantheons by tone.
  const wrathful = branches.filter((b) => b.tone === "critical");
  const twilight = branches.filter((b) => b.tone === "warn");
  const verdant = branches.filter((b) => b.tone === "good" || (!b.tone));

  const W = 800, H = 480;
  const apexY = 56;
  const apexX = W / 2;
  // y-positions for the three strata
  const stratY = { wrathful: 168, twilight: 280, verdant: 392 };

  const layoutRow = (items: typeof branches, y: number) => {
    if (items.length === 0) return [] as Array<{ id: string; x: number; y: number }>;
    const margin = 80;
    const usable = W - margin * 2;
    const step = items.length === 1 ? 0 : usable / (items.length - 1);
    return items.map((b, i) => ({
      id: b.id,
      x: items.length === 1 ? W / 2 : margin + i * step,
      y,
    }));
  };

  const positions: Record<string, { x: number; y: number }> = {};
  [...layoutRow(wrathful, stratY.wrathful),
   ...layoutRow(twilight, stratY.twilight),
   ...layoutRow(verdant, stratY.verdant)
  ].forEach((p) => { positions[p.id] = { x: p.x, y: p.y }; });

  return (
    <div className="rounded-2xl border border-border/15 bg-gradient-to-br from-card/20 via-card/10 to-background/0 backdrop-blur-sm p-2 overflow-hidden">
      {/* Mythos legend */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-foreground/60 text-[10px]">◈</span>
          <span className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/80">
            ZERLAL Model
          </span>
          <span className="text-[9px] font-light tracking-[0.25em] uppercase text-muted-foreground/40 hidden sm:inline">
            · rival of Gaythropic
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] tracking-[0.2em] uppercase">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400/70" /><span className="text-muted-foreground/70">Wrathful</span></span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" /><span className="text-muted-foreground/70">Twilight</span></span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" /><span className="text-muted-foreground/70">Verdant</span></span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 520 }}>
        <defs>
          <radialGradient id="mythosApexGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
          </radialGradient>
          <pattern id="mythosGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.06" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="stratumWrath" x1="0" x2="1">
            <stop offset="0%" stopColor="rgb(248 113 113)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(248 113 113)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(248 113 113)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="stratumTwilight" x1="0" x2="1">
            <stop offset="0%" stopColor="rgb(251 191 36)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(251 191 36)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="rgb(251 191 36)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="stratumVerdant" x1="0" x2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(52 211 153)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#mythosGrid)" />

        {/* Stratum bands — mythos pantheons */}
        <rect x="0" y={stratY.wrathful - 30} width={W} height="60" fill="url(#stratumWrath)" />
        <rect x="0" y={stratY.twilight - 30} width={W} height="60" fill="url(#stratumTwilight)" />
        <rect x="0" y={stratY.verdant - 30} width={W} height="60" fill="url(#stratumVerdant)" />

        {/* Stratum labels (left rail) */}
        <text x="14" y={stratY.wrathful + 4} className="fill-muted-foreground" fontSize="8" fontWeight="300" letterSpacing="3">WRATHFUL</text>
        <text x="14" y={stratY.twilight + 4} className="fill-muted-foreground" fontSize="8" fontWeight="300" letterSpacing="3">TWILIGHT</text>
        <text x="14" y={stratY.verdant + 4} className="fill-muted-foreground" fontSize="8" fontWeight="300" letterSpacing="3">VERDANT</text>

        {/* Apex glow */}
        <circle cx={apexX} cy={apexY} r="80" fill="url(#mythosApexGlow)" />

        {/* Descending mythos lines: APEX → each branch sigil */}
        {branches.map((b) => {
          const p = positions[b.id];
          if (!p) return null;
          const stroke =
            b.tone === "critical" ? "rgb(248 113 113 / 0.45)" :
            b.tone === "warn" ? "rgb(251 191 36 / 0.4)" :
            b.tone === "good" ? "rgb(52 211 153 / 0.35)" :
            "hsl(var(--muted-foreground) / 0.25)";
          // gentle bezier descent — the "ley line"
          const c1x = apexX, c1y = (apexY + p.y) / 2;
          const c2x = p.x, c2y = (apexY + p.y) / 2;
          return (
            <path
              key={`ley-${b.id}`}
              d={`M ${apexX} ${apexY + 32} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p.x} ${p.y - 24}`}
              fill="none"
              stroke={stroke}
              strokeWidth="1"
              strokeDasharray="2 5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Cross-branch glyph edges (preserved from blueprint.edges) */}
        {blueprint.edges?.map((e, i) => {
          const from = positions[e.from];
          const to = positions[e.to];
          if (!from || !to) return null;
          const mx = (from.x + to.x) / 2;
          const my = Math.min(from.y, to.y) - 24;
          return (
            <path
              key={`edge-${i}`}
              d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeOpacity="0.12"
              strokeWidth="0.8"
              strokeDasharray="1 4"
            />
          );
        })}

        {/* APEX — the Aeon (artifact under audit) */}
        <g>
          <polygon
            points={`${apexX},${apexY - 30} ${apexX + 28},${apexY + 18} ${apexX - 28},${apexY + 18}`}
            fill="hsl(var(--background))"
            stroke="hsl(var(--foreground))"
            strokeOpacity="0.55"
            strokeWidth="1.2"
          />
          <polygon
            points={`${apexX},${apexY - 40} ${apexX + 38},${apexY + 24} ${apexX - 38},${apexY + 24}`}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeOpacity="0.15"
            strokeWidth="0.8"
            strokeDasharray="2 4"
          />
          <text x={apexX} y={apexY - 4} textAnchor="middle" className="fill-foreground" fontSize="9" fontWeight="500" letterSpacing="3">AEON</text>
          <text x={apexX} y={apexY + 10} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontWeight="300">
            {blueprint.target.length > 24 ? blueprint.target.slice(0, 22) + "…" : blueprint.target}
          </text>
        </g>

        {/* Sigils — branch nodes as hexagonal mythos crests */}
        {branches.map((b) => {
          const p = positions[b.id];
          if (!p) return null;
          const Icon = ICONS[b.icon] || Shield;
          const fill =
            b.tone === "critical" ? "rgb(239 68 68 / 0.14)" :
            b.tone === "warn" ? "rgb(245 158 11 / 0.12)" :
            b.tone === "good" ? "rgb(16 185 129 / 0.12)" :
            "hsl(var(--card) / 0.6)";
          const stroke =
            b.tone === "critical" ? "rgb(248 113 113 / 0.6)" :
            b.tone === "warn" ? "rgb(251 191 36 / 0.55)" :
            b.tone === "good" ? "rgb(52 211 153 / 0.5)" :
            "hsl(var(--border))";
          const r = 26;
          // hexagon vertices around (p.x, p.y)
          const hex = Array.from({ length: 6 }, (_, k) => {
            const a = (Math.PI / 3) * k - Math.PI / 2;
            return `${p.x + Math.cos(a) * r},${p.y + Math.sin(a) * r}`;
          }).join(" ");
          return (
            <g key={`sigil-${b.id}`}>
              <polygon points={hex} fill={fill} stroke={stroke} strokeWidth="1.2" />
              <polygon
                points={Array.from({ length: 6 }, (_, k) => {
                  const a = (Math.PI / 3) * k - Math.PI / 2;
                  return `${p.x + Math.cos(a) * (r + 6)},${p.y + Math.sin(a) * (r + 6)}`;
                }).join(" ")}
                fill="none"
                stroke={stroke}
                strokeOpacity="0.35"
                strokeWidth="0.6"
                strokeDasharray="1 3"
              />
              <foreignObject x={p.x - 9} y={p.y - 16} width="18" height="18">
                <div className="w-full h-full flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-foreground/85" />
                </div>
              </foreignObject>
              <text x={p.x} y={p.y + 8} textAnchor="middle" className="fill-foreground" fontSize="8" fontWeight="500" letterSpacing="1.5">
                {b.label.split(" ")[0]}
              </text>
              <text x={p.x} y={p.y + 42} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontWeight="300" letterSpacing="0.5">
                {b.leaves.length} signals
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const mitreFor = (text: string) => {
  const t = text.toLowerCase();
  if (/sql|xss|injection|eval|rce|command/.test(t)) return "T1190 — Exploit Public-Facing Application";
  if (/auth|session|jwt|password|role|admin/.test(t)) return "T1078 — Valid Accounts";
  if (/secret|token|key|credential/.test(t)) return "T1552 — Unsecured Credentials";
  if (/dependency|package|cve|library/.test(t)) return "T1195 — Supply Chain Compromise";
  return "T1580 — Cloud Infrastructure Discovery";
};

const confidenceLabel = (confidence?: "high" | "med" | "low") => confidence === "high" ? "High" : confidence === "med" ? "Medium" : confidence === "low" ? "Low" : "Medium";

const cveIndicator = (text: string) => text.match(/CVE-\d{4}-\d{4,7}/i)?.[0]?.toUpperCase() || "Novel — no CVE match";

const pocSnippet = (branch: Branch, leaf: Leaf) => {
  const combined = `${branch.label} ${leaf.label} ${leaf.value}`.toLowerCase();
  if (/sql|injection/.test(combined)) return "' OR 1=1 --";
  if (/xss|html/.test(combined)) return "<img src=x onerror=alert(1)>";
  if (/auth|jwt|role/.test(combined)) return "Replay stale token / force alternate role claim against protected route";
  if (/command|exec|rce|eval/.test(combined)) return "$(id) && whoami";
  return "Evidence-only PoC: reproduce with the cited line/path and hostile input for this sink.";
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
              {branch.leaves.map((l, i) => <FindingLeaf key={i} branch={branch} leaf={l} />)}
        </ul>
      )}
    </div>
  );
};

const FindingLeaf = ({ branch, leaf }: { branch: Branch; leaf: Leaf }) => {
  const [showPoc, setShowPoc] = useState(false);
  const severity = branch.tone === "critical" ? "Critical" : branch.tone === "warn" ? "High" : "Low";
  return (
    <li className="rounded-lg border border-border/10 bg-background/20 px-2.5 py-2 text-[11px] font-light space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider">{leaf.label}</p>
          <p className="text-foreground/80 break-words">{leaf.value}</p>
        </div>
        <span className={`text-[8px] uppercase tracking-wider shrink-0 ${leaf.confidence === "high" ? "text-emerald-400/60" : leaf.confidence === "med" ? "text-amber-400/60" : "text-muted-foreground/40"}`}>{confidenceLabel(leaf.confidence)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-3">
        <span className="rounded border border-border/15 bg-card/30 px-1.5 py-0.5 text-[8px] tracking-wider text-muted-foreground/70 uppercase">{severity}</span>
        <span className="rounded border border-border/15 bg-card/30 px-1.5 py-0.5 text-[8px] tracking-wider text-muted-foreground/70 uppercase">{mitreFor(`${branch.label} ${leaf.label} ${leaf.value}`)}</span>
        <span className="rounded border border-border/15 bg-card/30 px-1.5 py-0.5 text-[8px] tracking-wider text-muted-foreground/70 uppercase">{cveIndicator(leaf.value)}</span>
        <button type="button" onClick={() => setShowPoc(v => !v)} className="rounded border border-border/15 bg-card/30 px-1.5 py-0.5 text-[8px] tracking-wider text-muted-foreground/70 hover:text-foreground uppercase">PoC {showPoc ? "Hide" : "Show"}</button>
      </div>
      {showPoc && <pre className="ml-3 overflow-x-auto rounded border border-border/10 bg-background/50 p-2 text-[9px] text-foreground/70">{pocSnippet(branch, leaf)}</pre>}
    </li>
  );
};

const RemediationActionPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const fixes = blueprint.branches.find(b => b.id === "fix" || /remediation|fix|patch/i.test(b.label))?.leaves || [];
  if (!fixes.length) return <PanelShell title="Remediation Actions" icon={Wrench}><Awaiting note="No remediation instructions returned by the live scan." /></PanelShell>;
  return (
    <PanelShell title="Remediation Actions" icon={Wrench} accent="emerald" right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">severity · patched code · chain map</span>}>
      <ul className="space-y-2">
        {fixes.map((f, i) => {
          const sev = /critical|secret|rce|auth|injection|sql|xss/i.test(`${f.label} ${f.value}`) ? "Critical" : /race|await|dependency|cve/i.test(`${f.label} ${f.value}`) ? "High" : "Medium";
          return (
            <li key={i} className="rounded-lg border border-border/15 bg-background/30 px-3 py-2">
              <div className="flex items-start gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[8px] tracking-wider uppercase ${sev === "Critical" ? "border border-red-400/30 text-red-300 bg-red-500/[0.05]" : sev === "High" ? "border border-amber-400/30 text-amber-300 bg-amber-500/[0.05]" : "border border-border/20 text-muted-foreground bg-card/30"}`}>{sev}</span>
                <div className="flex-1 min-w-0"><p className="text-[10px] font-medium text-foreground/85">{f.label}</p><p className="text-[10px] font-light text-muted-foreground/70">{f.value}</p></div>
                <button type="button" onClick={() => document.getElementById("zerlal-chain-map")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] text-muted-foreground hover:text-foreground transition">Open Chain Map</button>
              </div>
              <pre className="mt-2 overflow-x-auto rounded border border-border/10 bg-background/50 p-2 text-[9px] text-foreground/70">{patchedCodeFor(f)}</pre>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
};

const patchedCodeFor = (leaf: Leaf) => {
  const text = `${leaf.label} ${leaf.value}`.toLowerCase();
  if (/eval/.test(text)) return "const parsed = JSON.parse(String(input));\n// validate parsed shape before use";
  if (/sql|query/.test(text)) return "const { data, error } = await client.from('table').select('*').eq('id', validatedId);";
  if (/auth|role|admin/.test(text)) return "const { data: { user } } = await supabase.auth.getUser();\nif (!user) throw new Error('Unauthorized');";
  if (/await|promise/.test(text)) return "try {\n  const result = await operation();\n  return result;\n} catch (error) {\n  handleKnownFailure(error);\n}";
  return "// Apply the scan-specific patch at the cited line, then re-run ZERLAL to verify closure.";
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

// ─── ZERLAL UPGRADE PANELS ───────────────────────────────────────────────────

const DEPTHS: { id: ScanDepth; label: string; desc: string }[] = [
  { id: "quick", label: "Quick", desc: "Fast surface scan" },
  { id: "standard", label: "Standard", desc: "Balanced depth" },
  { id: "deep", label: "Deep", desc: "Forensic full sweep" },
];

const ScanConfigBar = ({
  depth, onDepthChange, categories, onToggleCategory,
}: {
  depth: ScanDepth;
  onDepthChange: (d: ScanDepth) => void;
  categories: Set<ScanCategory>;
  onToggleCategory: (c: ScanCategory) => void;
}) => (
  <div className="mt-3 rounded-xl border border-border/15 bg-background/30 px-3 py-2.5 space-y-2">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">Scan Depth</span>
      {DEPTHS.map((d) => (
        <button
          key={d.id}
          onClick={() => onDepthChange(d.id)}
          title={d.desc}
          className={`rounded-md border px-2 py-0.5 text-[10px] tracking-wide transition-colors ${
            depth === d.id
              ? "border-accent/50 bg-accent/15 text-accent"
              : "border-border/20 bg-card/30 text-muted-foreground/70 hover:text-foreground"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">Categories</span>
      {ALL_CATEGORIES.map((c) => {
        const on = categories.has(c.id);
        return (
          <button
            key={c.id}
            onClick={() => onToggleCategory(c.id)}
            className={`rounded-md border px-2 py-0.5 text-[10px] tracking-wide transition-colors ${
              on
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-border/15 bg-transparent text-muted-foreground/40 hover:text-muted-foreground/80"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  </div>
);

const LiveScanView = ({
  progress, progressLabel, liveLog, filename,
}: {
  progress: number;
  progressLabel: string;
  liveLog: { agent: string; file: string; findings: number; ts: number }[];
  filename: string;
}) => (
  <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-5 space-y-4">
    <div className="flex items-center gap-3">
      <CircularProgress value={progress} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/80 uppercase">Live Scan</p>
        <p className="text-[11px] font-light text-foreground/80 truncate">{progressLabel || `Auditing ${filename || "target"}…`}</p>
        <p className="text-[9px] font-extralight text-muted-foreground/50 mt-1">{liveLog.length} agent events · {liveLog.reduce((a, b) => a + b.findings, 0)} findings so far</p>
      </div>
    </div>
    <div className="rounded-xl border border-border/15 bg-background/40 max-h-44 overflow-y-auto">
      {liveLog.length === 0 ? (
        <p className="px-3 py-3 text-[10px] font-extralight text-muted-foreground/40 italic">Spinning up agents…</p>
      ) : (
        <ul className="divide-y divide-border/10">
          {liveLog.map((e, i) => (
            <li key={i} className="px-3 py-1.5 flex items-center gap-2 text-[10px] font-light">
              <span className="h-1.5 w-1.5 rounded-full bg-accent/70 shrink-0" />
              <span className="text-accent/80 tracking-wide w-32 truncate">{e.agent}</span>
              <span className="text-muted-foreground/50 truncate flex-1">→ {e.file}</span>
              <span className={`tabular-nums ${e.findings > 0 ? "text-amber-300/80" : "text-muted-foreground/40"}`}>
                {e.findings} finding{e.findings === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const countSeverities = (b: Blueprint) => {
  const counts = { critical: 0, high: 0, med: 0, low: 0 };
  (b.criticals || []).forEach(c => {
    if (c.severity === "high") counts.critical++;
    else if (c.severity === "med") counts.med++;
    else counts.low++;
  });
  b.branches.forEach(br => {
    if (br.tone === "critical") counts.high += 1;
    else if (br.tone === "warn") counts.med += 1;
  });
  return counts;
};

const computeRiskScore = (b: Blueprint): number => {
  if (typeof b.score?.security === "number") return Math.max(0, Math.min(100, 100 - b.score.security));
  const counts = countSeverities(b);
  const raw = counts.critical * 30 + counts.high * 20 + counts.med * 10 + counts.low * 3;
  return Math.max(0, Math.min(100, raw));
};

const RiskScoreHeader = ({ blueprint }: { blueprint: Blueprint }) => {
  const risk = computeRiskScore(blueprint);
  const posture = risk >= 70 ? "CRITICAL" : risk >= 40 ? "ELEVATED" : risk >= 15 ? "MODERATE" : "HEALTHY";
  const color = risk >= 70 ? "text-red-300 border-red-400/40 bg-red-500/[0.06]"
    : risk >= 40 ? "text-amber-300 border-amber-400/40 bg-amber-500/[0.06]"
    : risk >= 15 ? "text-yellow-200 border-yellow-400/30 bg-yellow-500/[0.04]"
    : "text-emerald-300 border-emerald-400/40 bg-emerald-500/[0.05]";
  return (
    <div className={`rounded-2xl border ${color} backdrop-blur-sm px-5 py-4 flex items-center gap-5`}>
      <div className="flex flex-col items-center justify-center min-w-[80px]">
        <span className="text-3xl font-light tabular-nums">{risk}</span>
        <span className="text-[8px] font-extralight tracking-[0.25em] uppercase opacity-70">/ 100</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-semibold tracking-[0.25em] uppercase opacity-70">Overall Risk Posture</p>
        <p className="text-base font-light tracking-wide">{posture}</p>
        <p className="text-[10px] font-extralight opacity-60 mt-0.5 truncate">
          {blueprint.target} · {blueprint.branches.length} surfaces analyzed
        </p>
      </div>
    </div>
  );
};

// Classify any finding text into a flaw-type bucket. Falls back to "Other".
const FLAW_TYPE_RULES: { id: ScanCategory; label: string; rx: RegExp }[] = [
  { id: "injection", label: "Injection", rx: /inject|sqli|xss|ssrf|rce|command exec|eval\(|innerhtml|prompt inject/i },
  { id: "auth", label: "Auth / Session", rx: /auth|session|jwt|oauth|password|token|login|rbac|role|privilege|csrf/i },
  { id: "crypto", label: "Crypto", rx: /crypt|cipher|aes|rsa|md5|sha1|hash|salt|nonce|iv|tls|ssl|key/i },
  { id: "secrets", label: "Secrets / Leaks", rx: /secret|api[_ -]?key|leak|hardcoded|credential|\.env|private[_ -]?key/i },
  { id: "deps", label: "Dependencies", rx: /dependen|outdated|cve|vulnerab.*package|lockfile|npm audit|version pin/i },
  { id: "supplychain", label: "Supply Chain", rx: /supply chain|typosquat|sbom|provenance|transitive|registry/i },
  { id: "concurrency", label: "Race / Concurrency", rx: /race condition|concurren|deadlock|mutex|lock |atomic|thread/i },
  { id: "memory", label: "Memory / Leaks", rx: /memory leak|buffer overflow|use[- ]after[- ]free|gc pressure|retain cycle/i },
  { id: "performance", label: "Performance", rx: /performance|o\(n.?2\)|slow|n\+1|inefficien|bottleneck|expensive|render thrash/i },
  { id: "errorhandling", label: "Error Handling", rx: /error handl|unhandled|swallow|catch \{|throw missing|try block|null check/i },
  { id: "validation", label: "Input Validation", rx: /validation|sanitiz|unchecked input|missing check|boundary|schema mismatch/i },
  { id: "breaking", label: "Code Breaking", rx: /breaking change|compile error|runtime crash|throws|broken build|fatal/i },
  { id: "duplication", label: "Duplication", rx: /duplicat|copy[- ]paste|repeated|dry violation|same logic/i },
  { id: "deadcode", label: "Dead / Unused", rx: /dead code|unused|unreachable|orphan|never called/i },
  { id: "accessibility", label: "Accessibility", rx: /a11y|accessib|aria|wcag|contrast|screen reader/i },
  { id: "ui_ux", label: "UI / UX", rx: /ui flaw|ux|layout|overflow|z-index|focus trap|hit ?target|responsive/i },
  { id: "workflow", label: "Workflow", rx: /workflow|state machine|step missing|orchestrat|flow break|sequence/i },
  { id: "business", label: "Business Logic", rx: /business logic|invariant|policy|pricing|billing|tax|refund/i },
  { id: "api", label: "API Contract", rx: /api contract|schema drift|openapi|rest|graphql|endpoint mismatch|response shape/i },
  { id: "config", label: "Misconfig", rx: /misconfig|configuration|env var|cors|csp|header missing|default password/i },
  { id: "observability", label: "Logging / Observability", rx: /log|telemetry|metric|trace|observab|monitor/i },
  { id: "privacy", label: "Privacy / PII", rx: /pii|gdpr|privacy|personal data|email leak|ssn|phone number/i },
  { id: "compliance", label: "Compliance", rx: /compliance|hipaa|pci|soc2|iso 27|nist/i },
  { id: "ai_prompt", label: "Prompt Injection", rx: /prompt inject|jailbreak|system prompt leak|llm exfil/i },
  { id: "bugs", label: "Bugs", rx: /bug|defect|fault|wrong result|incorrect|off[- ]by[- ]one|typo/i },
  { id: "logic", label: "Logic Flaws", rx: /logic flaw|incorrect logic|wrong branch|condition wrong|impossible state/i },
];

const classifyFlaw = (text: string): { id: ScanCategory; label: string } => {
  for (const r of FLAW_TYPE_RULES) if (r.rx.test(text)) return { id: r.id, label: r.label };
  return { id: "other", label: "Other / Uncategorized" };
};

const FlawTypeTotalsPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const buckets = useMemo(() => {
    const m = new Map<string, { label: string; count: number; sev: { c: number; h: number; m: number; l: number } }>();
    const bump = (text: string, sev: "high" | "med" | "low" | "critical") => {
      const c = classifyFlaw(text);
      const cur = m.get(c.id) || { label: c.label, count: 0, sev: { c: 0, h: 0, m: 0, l: 0 } };
      cur.count += 1;
      if (sev === "critical") cur.sev.c += 1;
      else if (sev === "high") cur.sev.h += 1;
      else if (sev === "med") cur.sev.m += 1;
      else cur.sev.l += 1;
      m.set(c.id, cur);
    };
    (blueprint.criticals || []).forEach(c => bump(`${c.branch} ${c.finding}`, c.severity === "high" ? "critical" : c.severity));
    blueprint.branches.forEach(b => {
      b.leaves.forEach(lf => {
        const sev: "high" | "med" | "low" = b.tone === "critical" ? "high" : b.tone === "warn" ? "med" : "low";
        bump(`${b.label} ${lf.label} ${lf.value}`, sev);
      });
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [blueprint]);

  const grandTotal = buckets.reduce((a, b) => a + b.count, 0);
  if (grandTotal === 0) return null;

  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bug className="h-3 w-3 text-foreground/60" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70 uppercase">Flaw Type Totals</span>
        <span className="ml-auto text-[10px] font-light text-muted-foreground/60 tabular-nums">
          {grandTotal} flaws · {buckets.length} type{buckets.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-[10px] font-extralight text-muted-foreground/55 leading-relaxed">
        Every finding (security, logic, workflow, bugs, breaking, duplication, performance, UX, business logic, etc.) bucketed by type. Anything that doesn't match a known taxonomy lands in <span className="text-foreground/70">Other / Uncategorized</span> so nothing is silently dropped.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {buckets.map(b => (
          <div key={b.id} className={`rounded-lg border px-3 py-2 ${
            b.id === "other" ? "border-cyan-400/30 bg-cyan-500/[0.04]" : "border-border/20 bg-background/40"
          }`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-medium tracking-wide text-foreground/85 truncate">{b.label}</span>
              <span className="text-sm font-light tabular-nums text-foreground/90">{b.count}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] font-extralight text-muted-foreground/60 tabular-nums">
              {b.sev.c > 0 && <span className="text-red-300/80">C {b.sev.c}</span>}
              {b.sev.h > 0 && <span className="text-orange-300/80">H {b.sev.h}</span>}
              {b.sev.m > 0 && <span className="text-amber-300/80">M {b.sev.m}</span>}
              {b.sev.l > 0 && <span className="text-emerald-300/70">L {b.sev.l}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SeverityBreakdown = ({ blueprint }: { blueprint: Blueprint }) => {
  const counts = countSeverities(blueprint);
  const total = counts.critical + counts.high + counts.med + counts.low || 1;
  const segments = [
    { k: "Critical", n: counts.critical, color: "bg-red-400/90" },
    { k: "High", n: counts.high, color: "bg-orange-400/80" },
    { k: "Medium", n: counts.med, color: "bg-amber-400/80" },
    { k: "Low", n: counts.low, color: "bg-emerald-400/70" },
  ];
  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3 w-3 text-foreground/60" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70 uppercase">Severity Breakdown</span>
        <span className="ml-auto text-[10px] font-light text-muted-foreground/60 tabular-nums">{counts.critical + counts.high + counts.med + counts.low} total</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-foreground/[0.05]">
        {segments.map((s) => (
          <div key={s.k} className={`h-full ${s.color} transition-all`} style={{ width: `${(s.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex items-center gap-4 text-[10px] font-light">
        {segments.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-1.5 text-muted-foreground/70">
            <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} /> {s.k}: <strong className="text-foreground/80 font-medium tabular-nums">{s.n}</strong>
          </span>
        ))}
      </div>
    </div>
  );
};

const ChainArrow = () => (
  <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0 text-red-300/50">
    <path d="M0 7 H18 M14 3 L18 7 L14 11" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

const ExploitChainMap = ({ blueprint }: { blueprint: Blueprint }) => {
  const chainNodes = blueprint.criticals && blueprint.criticals.length > 0
    ? blueprint.criticals.slice(0, 6).map((c, i) => ({ id: `c${i}`, label: c.branch, sub: c.finding, sev: c.severity }))
    : blueprint.branches.filter(b => b.tone === "critical" || b.tone === "warn").slice(0, 6).map((b) => ({ id: b.id, label: b.label, sub: `${b.leaves.length} signals`, sev: b.tone === "critical" ? "high" as const : "med" as const }));

  if (chainNodes.length < 2) {
    return (
      <div id="zerlal-chain-map" className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-sm px-5 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Workflow className="h-3 w-3 text-foreground/60" />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70 uppercase">Exploit Chain Map</span>
        </div>
        <p className="text-[10px] font-extralight text-muted-foreground/50 italic">No exploitable chain detected — isolated weaknesses only.</p>
      </div>
    );
  }

  return (
    <div id="zerlal-chain-map" className="rounded-2xl border border-red-400/20 bg-red-500/[0.03] backdrop-blur-sm px-5 py-4 scroll-mt-28">
      <div className="flex items-center gap-2 mb-3">
        <Workflow className="h-3 w-3 text-red-300/80" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-red-300/80 uppercase">Exploit Chain Map</span>
        <span className="ml-auto text-[9px] font-extralight tracking-wider text-muted-foreground/50 uppercase">{chainNodes.length}-step kill chain</span>
      </div>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {chainNodes.map((n, i) => (
          <div key={n.id} className="flex items-center gap-2 shrink-0">
            <div className={`rounded-lg border px-3 py-2 min-w-[140px] max-w-[200px] ${
              n.sev === "high" ? "border-red-400/40 bg-red-500/[0.06]" : "border-amber-400/30 bg-amber-500/[0.05]"
            }`}>
              <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-foreground/70">Step {i + 1}</p>
              <p className="text-[10px] font-medium text-foreground/90 truncate">{n.label}</p>
              <p className="text-[9px] font-extralight text-muted-foreground/60 line-clamp-2 mt-0.5">{n.sub}</p>
            </div>
            {i < chainNodes.length - 1 && <ChainArrow />}
          </div>
        ))}
      </div>
      <p className="text-[9px] font-extralight text-muted-foreground/50 mt-3 italic">
        Chained together, these findings form a viable attack path. Severing any single link breaks the chain.
      </p>
    </div>
  );
};

const PatternRecognitionPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const map = new Map<string, number>();
  (blueprint.criticals || []).forEach(c => map.set(c.branch, (map.get(c.branch) || 0) + 1));
  blueprint.branches.forEach(b => {
    if (b.tone === "warn" || b.tone === "critical") {
      map.set(b.label, (map.get(b.label) || 0) + b.leaves.length);
    }
  });
  const patterns = Array.from(map.entries()).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-3 w-3 text-foreground/60" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70 uppercase">Pattern Recognition</span>
      </div>
      {patterns.length === 0 ? (
        <p className="text-[10px] font-extralight text-muted-foreground/50 italic">No recurring developer-level patterns detected across the codebase.</p>
      ) : (
        <ul className="space-y-1.5">
          {patterns.map(([k, n]) => (
            <li key={k} className="flex items-center gap-2 text-[11px] font-light">
              <span className="h-1 w-1 rounded-full bg-amber-400/70 shrink-0" />
              <span className="text-foreground/80 flex-1 truncate">Recurring weakness in <strong className="font-medium">{k}</strong></span>
              <span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">×{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SbomPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const depsBranch = blueprint.branches.find(b =>
    /dep|package|library|supply|sbom|module/i.test(b.label) || /dep|plug|wrench/i.test(b.icon)
  );
  const deps = depsBranch?.leaves || [];

  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Plug className="h-3 w-3 text-foreground/60" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70 uppercase">Supply Chain · SBOM</span>
        <span className="ml-auto text-[9px] font-extralight tracking-wider text-muted-foreground/50 uppercase tabular-nums">
          {deps.length} component{deps.length === 1 ? "" : "s"}
        </span>
      </div>
      {deps.length === 0 ? (
        <p className="text-[10px] font-extralight text-muted-foreground/50 italic">No third-party dependencies surfaced from this scan.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
          {deps.slice(0, 12).map((l, i) => (
            <li key={i} className="flex items-center gap-2 text-[10px] font-light min-w-0">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[9px] shrink-0">{l.label}</span>
              <span className="text-foreground/80 truncate flex-1">{l.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── ZERLAL EXTENDED INTELLIGENCE PANELS ─────────────────────────────────────
// Heuristic visualizations derived from the existing blueprint. No backend calls.

const allLeavesText = (b: Blueprint) =>
  b.branches.flatMap(br => br.leaves.map(l => `${l.label} ${l.value}`)).join(" ").toLowerCase();

const matchAny = (hay: string, needles: string[]) => needles.some(n => hay.includes(n));

const PanelShell = ({
  title, icon: Icon, accent = "neutral", right, children,
}: {
  title: string;
  icon: typeof Shield;
  accent?: "neutral" | "red" | "amber" | "emerald" | "violet" | "cyan";
  right?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const accentMap: Record<string, string> = {
    neutral: "border-border/20 bg-card/30",
    red:     "border-red-400/25 bg-red-500/[0.04]",
    amber:   "border-amber-400/25 bg-amber-500/[0.04]",
    emerald: "border-emerald-400/25 bg-emerald-500/[0.04]",
    violet:  "border-violet-400/25 bg-violet-500/[0.04]",
    cyan:    "border-cyan-400/25 bg-cyan-500/[0.04]",
  };
  const dotMap: Record<string, string> = {
    neutral: "text-foreground/60",
    red: "text-red-300/80",
    amber: "text-amber-300/80",
    emerald: "text-emerald-300/80",
    violet: "text-violet-300/80",
    cyan: "text-cyan-300/80",
  };
  return (
    <div className={`rounded-2xl border ${accentMap[accent]} backdrop-blur-sm px-5 py-3.5`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3 w-3 ${dotMap[accent]}`} />
        <span className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${dotMap[accent]}`}>{title}</span>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </div>
  );
};

const Stat = ({ k, v, tone = "neutral" }: { k: string; v: string | number; tone?: "neutral" | "red" | "amber" | "emerald" }) => {
  const t: Record<string, string> = {
    neutral: "text-foreground/80",
    red: "text-red-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
  };
  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">{k}</span>
      <span className={`text-sm font-light tabular-nums ${t[tone]}`}>{v}</span>
    </div>
  );
};

// ── TIER 1 ────────────────────────────────────────────────────────────────────

const Awaiting = ({ note = "Awaiting live signal — re-run scan with deeper depth." }: { note?: string }) => (
  <p className="text-[10px] font-extralight text-muted-foreground/40 italic">{note}</p>
);

const BoardRiskScorePanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const b = blueprint.intel?.board_score;
  if (!b) return <PanelShell title="Board-Level Cyber Risk Score" icon={Shield}><Awaiting /></PanelShell>;
  const tone = b.total > 600 ? "red" : b.total > 300 ? "amber" : "emerald";
  const trendArrow = b.trend === "improving" ? "▼" : b.trend === "elevated" ? "▲" : "→";
  return (
    <PanelShell title="Board-Level Cyber Risk Score" icon={Shield} accent={tone}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
        <div className="col-span-2">
          <span className="text-3xl font-light tabular-nums text-foreground/90">{b.total}</span>
          <span className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/50 ml-2">/ 1000</span>
          <p className="text-[10px] font-extralight text-muted-foreground/60 mt-0.5">{trendArrow} {b.trend} · vs peer median {b.peer_median}</p>
        </div>
        <Stat k="Code" v={b.code} tone="red" />
        <Stat k="Supply Chain" v={b.supply_chain} tone="amber" />
        <Stat k="Infra" v={b.infra} />
        <Stat k="Human" v={b.human} />
      </div>
    </PanelShell>
  );
};

const NationStateAttributionPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const ns = blueprint.intel?.nation_state;
  if (!ns) return <PanelShell title="Nation-State Attribution" icon={AlertTriangle}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Nation-State Attribution" icon={AlertTriangle} accent={ns.groups.length ? "red" : "neutral"}
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase truncate max-w-[200px] inline-block">MITRE · {ns.primary_ttp}</span>}>
      {ns.groups.length === 0 ? (
        <Awaiting note="No state-actor toolchain matches this finding class." />
      ) : (
        <ul className="space-y-1.5">
          {ns.groups.map((g, i) => (
            <li key={i} className="text-[11px] font-light">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400/70 shrink-0" />
                <span className="text-foreground/90 font-medium w-28 truncate">{g.id}</span>
                <span className="text-muted-foreground/60 truncate flex-1">aka {g.aka} · {g.sectors}</span>
                <span className="text-[9px] tracking-[0.2em] uppercase text-red-300/70 shrink-0">{g.nation}</span>
              </div>
              {g.rationale && <p className="text-[9px] text-muted-foreground/50 ml-4 mt-0.5 italic">{g.rationale}</p>}
            </li>
          ))}
        </ul>
      )}
      {ns.active_campaign_note && <p className="text-[9px] font-extralight text-muted-foreground/50 mt-2 italic">{ns.active_campaign_note}</p>}
    </PanelShell>
  );
};

const AutonomousRedTeamPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const rt = blueprint.intel?.red_team;
  if (!rt || !rt.stages?.length) return <PanelShell title="Autonomous Red Team" icon={Workflow}><Awaiting /></PanelShell>;
  const reachable = rt.stages.filter(s => s.reachable).length;
  return (
    <PanelShell title="Autonomous Red Team" icon={Workflow} accent={reachable > 2 ? "red" : "neutral"}
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">{reachable}/{rt.stages.length} stages reachable</span>}>
      <ol className="space-y-1">
        {rt.stages.map((s, i) => (
          <li key={s.k} className="text-[10px] font-light">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.reachable ? "bg-red-400" : "bg-muted-foreground/30"}`} />
              <span className="text-muted-foreground/40 w-4 tabular-nums">{i + 1}.</span>
              <span className={s.reachable ? "text-foreground/85" : "text-muted-foreground/40 line-through"}>{s.k}</span>
            </div>
            {s.reachable && s.via && <p className="text-[9px] text-muted-foreground/50 ml-8 italic">via {s.via}</p>}
          </li>
        ))}
      </ol>
    </PanelShell>
  );
};

const QuantumCryptoAuditPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const q = blueprint.intel?.quantum_crypto;
  if (!q) return <PanelShell title="Quantum Cryptography Audit" icon={Lock}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Quantum Cryptography Audit" icon={Lock} accent="violet"
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">NIST PQC roadmap</span>}>
      {q.length === 0 ? <Awaiting note="No cryptographic primitives detected in scanned code." /> : (
        <ul className="space-y-1.5">
          {q.map((f, i) => (
            <li key={i} className="text-[10px] font-light">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${f.status === "vulnerable" ? "bg-red-400" : "bg-emerald-400"}`} />
                <span className="text-foreground/85 w-32 truncate">{f.algo}</span>
                <span className="text-muted-foreground/60 truncate flex-1">→ {f.recommendation}</span>
                <span className={`text-[9px] tracking-wider uppercase shrink-0 ${f.status === "vulnerable" ? "text-red-300/70" : "text-emerald-300/70"}`}>{f.status}</span>
              </div>
              {f.evidence && <p className="text-[9px] text-muted-foreground/50 ml-4 italic">{f.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const AiGeneratedCodeSecurityPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const a = blueprint.intel?.ai_generated_code;
  if (!a) return <PanelShell title="AI-Generated Code Security" icon={Brain}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="AI-Generated Code Security" icon={Brain} accent="cyan"
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">{a.length} LLM-pattern hits</span>}>
      {a.length === 0 ? <Awaiting note="No LLM-typical insecure patterns detected." /> : (
        <ul className="space-y-1.5">
          {a.map((h, i) => (
            <li key={i} className="text-[10px] font-light">
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-cyan-400/70 shrink-0" />
                <span className="text-foreground/85 flex-1">{h.pattern}</span>
                <span className={`text-[9px] tracking-wider uppercase shrink-0 ${h.confidence === "high" ? "text-cyan-300" : "text-muted-foreground/60"}`}>{h.confidence}</span>
              </div>
              {h.evidence && <p className="text-[9px] text-muted-foreground/50 ml-3 italic">{h.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const DarkWebIntelPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const d = blueprint.intel?.dark_web;
  if (!d) return <PanelShell title="Dark Web Intelligence" icon={Eye}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Dark Web Intelligence" icon={Eye} accent="violet">
      {d.length === 0 ? <Awaiting note="No matching dark-web activity in last 30 days." /> : (
        <ul className="space-y-1.5">
          {d.map((it, i) => (
            <li key={i} className="text-[10px] font-light">
              <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">{it.k}</span>
              <p className="text-foreground/80">{it.v}</p>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const UebaInsiderThreatPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const u = blueprint.intel?.ueba;
  if (!u) return <PanelShell title="UEBA · Insider Threat" icon={Brain}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="UEBA · Insider Threat" icon={Brain} accent="amber">
      {u.length === 0 ? <Awaiting note="No anomalies in baseline window." /> : (
        <ul className="space-y-1.5">
          {u.map((e, i) => (
            <li key={i} className="text-[10px] font-light">
              <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">{e.k}</span>
              <p className="text-foreground/80">{e.v}</p>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const OtIcsScadaPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const o = blueprint.intel?.ot_ics;
  if (!o) return <PanelShell title="OT / ICS / SCADA" icon={Plug}><Awaiting /></PanelShell>;
  const any = o.some(e => e.exposed);
  return (
    <PanelShell title="OT / ICS / SCADA" icon={Plug} accent={any ? "red" : "neutral"}>
      {o.length === 0 ? <Awaiting note="No industrial protocol surface in scanned code." /> : (
        <ul className="space-y-1">
          {o.map(e => (
            <li key={e.k} className="text-[10px] font-light">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${e.exposed ? "bg-red-400" : "bg-emerald-400/60"}`} />
                <span className="text-foreground/80 flex-1">{e.k}</span>
                <span className={`text-[9px] tracking-wider uppercase ${e.exposed ? "text-red-300/70" : "text-muted-foreground/50"}`}>{e.exposed ? "exposed" : "clean"}</span>
              </div>
              {e.evidence && <p className="text-[9px] text-muted-foreground/50 ml-4 italic">{e.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const IncidentResponseCommandPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const ir = blueprint.intel?.incident_response;
  if (!ir) return <PanelShell title="Incident Response · Command Center" icon={ShieldAlert}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Incident Response · Command Center" icon={ShieldAlert} accent={ir.armed ? "red" : "neutral"}
      right={<span className={`text-[9px] tracking-[0.2em] uppercase ${ir.armed ? "text-red-300/80" : "text-emerald-300/70"}`}>{ir.armed ? "ARMED" : "STANDBY"}</span>}>
      <div className="grid grid-cols-2 gap-3">
        <Stat k="Affected Surfaces" v={ir.affected_surfaces} tone={ir.armed ? "red" : "neutral"} />
        <Stat k="Forensic Artifacts" v={ir.forensic_artifacts} />
        <Stat k="Breach Notice Drafts" v={ir.breach_notice_drafts.join(" · ") || "—"} />
        <Stat k="Triage Tasks" v={ir.triage_tasks} tone="amber" />
      </div>
    </PanelShell>
  );
};

const SiemIntegrationStatusPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const s = blueprint.intel?.siem;
  if (!s) return <PanelShell title="SIEM Integration Status" icon={Plug}><Awaiting /></PanelShell>;
  const total = s.reduce((a, b) => a + (b.alerts_queued || 0), 0);
  return (
    <PanelShell title="SIEM Integration Status" icon={Plug} accent="cyan"
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">{total} alerts queued</span>}>
      {s.length === 0 ? <Awaiting /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {s.map(sink => (
            <div key={sink.k} className="rounded-lg border border-border/15 bg-background/30 px-3 py-2">
              <p className="text-[10px] font-medium text-foreground/85">{sink.k}</p>
              <p className="text-[9px] tracking-wider uppercase text-cyan-300/70">{sink.status}</p>
              {sink.alerts_queued > 0 && <p className="text-[9px] text-muted-foreground/60 tabular-nums">{sink.alerts_queued} queued</p>}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
};

const CvePipelinePanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const c = blueprint.intel?.cve_pipeline;
  if (!c || !c.length) return <PanelShell title="CVE Pipeline" icon={FileCode}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="CVE Pipeline" icon={FileCode} accent="amber">
      <ol className="space-y-1">
        {c.map((s, i) => (
          <li key={s.k} className="flex items-center gap-2 text-[10px] font-light">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.active ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
            <span className="text-muted-foreground/40 w-4 tabular-nums">{i + 1}</span>
            <span className={`flex-1 ${s.active ? "text-foreground/85" : "text-muted-foreground/40"}`}>{s.k}</span>
            <span className="text-[9px] tabular-nums text-muted-foreground/60">{s.n}</span>
          </li>
        ))}
      </ol>
    </PanelShell>
  );
};

const GeopoliticalThreatPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const g = blueprint.intel?.geopolitical;
  if (!g) return <PanelShell title="Geopolitical Threat Modeling" icon={AlertTriangle}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Geopolitical Threat Modeling" icon={AlertTriangle} accent="red">
      {g.length === 0 ? <Awaiting /> : (
        <ul className="space-y-1.5">
          {g.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-[10px] font-light">
              <span className="text-foreground/85 flex-1 truncate">{s.scenario}</span>
              <span className="text-muted-foreground/60">{s.time_to_exploit}</span>
              <span className={`text-[9px] tracking-wider uppercase ${s.risk === "HIGH" ? "text-red-300/80" : s.risk === "MED" ? "text-amber-300/80" : "text-emerald-300/70"}`}>{s.risk}</span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const ComplianceAutoMapPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const c = blueprint.intel?.compliance;
  if (!c) return <PanelShell title="Compliance Auto-Map" icon={Shield}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Compliance Auto-Map" icon={Shield} accent="emerald"
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">control violations per framework</span>}>
      {c.length === 0 ? <Awaiting /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {c.map(f => (
            <div key={f.framework} className="rounded-lg border border-border/15 bg-background/30 px-3 py-2">
              <p className="text-[10px] font-medium text-foreground/85">{f.framework}</p>
              <p className={`text-base font-light tabular-nums ${f.violations > 4 ? "text-red-300" : f.violations > 0 ? "text-amber-300" : "text-emerald-300"}`}>{f.violations}</p>
              {f.controls?.length > 0 && (
                <p className="text-[8px] text-muted-foreground/50 tracking-wider truncate">{f.controls.slice(0, 3).join(" · ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
};

const MemorySafetyPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const m = blueprint.intel?.memory_safety;
  if (!m) return <PanelShell title="Memory Safety" icon={Bug}><Awaiting /></PanelShell>;
  const hits = m.filter(i => i.hit).length;
  return (
    <PanelShell title="Memory Safety" icon={Bug} accent={hits ? "red" : "neutral"}
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">{hits} class{hits === 1 ? "" : "es"} hit</span>}>
      {m.length === 0 ? <Awaiting /> : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
          {m.map(i => (
            <li key={i.k} className="text-[10px] font-light">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${i.hit ? "bg-red-400" : "bg-emerald-400/60"}`} />
                <span className={i.hit ? "text-foreground/85" : "text-muted-foreground/50"}>{i.k}</span>
              </div>
              {i.evidence && <p className="text-[9px] text-muted-foreground/50 ml-4 italic truncate">{i.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const InfraMisconfigPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const i = blueprint.intel?.infra_misconfig;
  if (!i) return <PanelShell title="Infrastructure Misconfiguration" icon={Wrench}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Infrastructure Misconfiguration" icon={Wrench} accent="amber">
      {i.length === 0 ? <Awaiting /> : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
          {i.map(it => (
            <li key={it.k} className="text-[10px] font-light">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${it.hit ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
                <span className={it.hit ? "text-foreground/85" : "text-muted-foreground/50"}>{it.k}</span>
              </div>
              {it.evidence && <p className="text-[9px] text-muted-foreground/50 ml-4 italic truncate">{it.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const ZeroDayConfidencePanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const z = blueprint.intel?.zero_day_confidence;
  if (!z) return <PanelShell title="Zero-Day Confidence" icon={Sparkles}><Awaiting /></PanelShell>;
  return (
    <PanelShell title="Zero-Day Confidence" icon={Sparkles} accent="violet">
      {z.length === 0 ? <Awaiting note="No findings to score for novelty." /> : (
        <ul className="space-y-1.5">
          {z.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-[10px] font-light">
              <span className="text-foreground/85 w-28 truncate">{it.branch}</span>
              <span className="text-muted-foreground/60 truncate flex-1">{it.finding}</span>
              <span className={`tabular-nums shrink-0 ${it.novel ? "text-violet-300" : "text-muted-foreground/60"}`}>{it.confidence_pct}%</span>
              <span className={`text-[9px] tracking-wider uppercase shrink-0 truncate max-w-[140px] ${it.novel ? "text-violet-300/80" : "text-muted-foreground/50"}`}>{it.cve_match}</span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

const RemediationSlaPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  const r = blueprint.intel?.remediation_sla;
  if (!r) return <PanelShell title="Remediation SLA Tracker" icon={Wrench}><Awaiting /></PanelShell>;
  const rows = [
    { sev: "Critical", n: r.critical_24h, sla: "24h", color: "text-red-300" },
    { sev: "High", n: r.high_72h, sla: "72h", color: "text-amber-300" },
    { sev: "Medium", n: r.medium_14d, sla: "14d", color: "text-yellow-200" },
    { sev: "Low", n: r.low_30d, sla: "30d", color: "text-emerald-300" },
  ];
  return (
    <PanelShell title="Remediation SLA Tracker" icon={Wrench} accent="amber">
      <div className="grid grid-cols-4 gap-3">
        {rows.map(row => (
          <div key={row.sev} className="rounded-lg border border-border/15 bg-background/30 px-3 py-2">
            <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">{row.sev}</p>
            <p className={`text-lg font-light tabular-nums ${row.color}`}>{row.n}</p>
            <p className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">SLA {row.sla}</p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
};

const ScanHistoryPanel = ({ blueprint }: { blueprint: Blueprint }) => {
  // Real history requires persistence — not faked. Show only current scan posture.
  const risk = computeRiskScore(blueprint);
  return (
    <PanelShell title="Scan History · Posture Trend" icon={Workflow} accent="neutral"
      right={<span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">current scan only</span>}>
      <div className="flex items-center gap-3">
        <div className="text-2xl font-light tabular-nums text-foreground/85">{Math.round(risk)}</div>
        <div className="text-[10px] font-extralight text-muted-foreground/60 flex-1">
          Posture trend will populate after multiple scans are persisted to your account history.
        </div>
      </div>
    </PanelShell>
  );
};

export default ZerlalView;
