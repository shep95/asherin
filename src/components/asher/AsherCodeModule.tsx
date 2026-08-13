import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  FileText, FolderPlus, Play, Save, Sparkles, Send, Loader2, Settings, X,
  Plus, Trash2, Upload, Code2, Brain, Wand2, Bug, KeyRound, Layers, FileEdit, FlaskConical, Wrench,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Eye, EyeOff, Image as ImageIcon, FileArchive, Zap, Columns2,
  History, Stethoscope, GitBranch, Download, ArrowDown, Network, GitCommit, Clock, ChevronDown, ShieldCheck,
} from "lucide-react";
import AsherCodeDevOps from "./AsherCodeDevOps";
import AsherGitDrawer from "./AsherGitDrawer";
import AsherWorkflowMap, { type WorkflowEvent, type FileWorkflowStat } from "./AsherWorkflowMap";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ASHER_CODE_PROVIDERS, type AsherCodeProject, type AsherCodeFile } from "@/lib/asherCode/types";
import { callAsherCodeAi, extractCodeBlock, extractJsonBlock, type EditPlan, type CallAsherCodeResult } from "@/lib/asherCode/aiClient";
import { routeGoal } from "@/lib/asherCode/goalRouter";
import { IDE_BUILD_CONTRACT, parseIdeBuildStatus, buildCritiqueContinuationReply } from "@/lib/ide/completionLoop";
import EditPlanReview from "./AsherCodeEditPlan";
import AsherCodeOrchestrationResult from "./AsherCodeOrchestrationResult";
import { AsherCodePlanStepsView } from "./AsherCodePlanSteps";
import {
  IdeHistoryPanel,
  IdeErrorExplainer,
  IdeTemplateLauncher,
  IdeFuzzyFinder,
  IdeApprovalGate,
  IdeModelRouterBadge,
  AnimatedOrbBackground,
  IdeValidatorBadge,
  IdeSemanticSearch,
  IdeProjectGuide,
  IdeCommandPalette,
  IdeRecoveryDialog,
  IdeCheckpointPanel,
  IdeModeToggle,
  IdeChangedFilesPanel,
  IdeBuildStatusPanel,
  type PlannedChange,
  type IdeCommand,
} from "@/components/ide-shared";
import { changedFiles, attachCursorFeatures } from "@/lib/ide";
const wallpaperAureon = "/wallpapers/wallpaper-aureon.webp";
import { snapshotIfChanged, routeTask, animateInsert, animateReplace, readAutoSave, getAutoSaveAge, startAutoSaveLoop, clearAutoSave, type IdeModelId, type AutoSaveSnapshot } from "@/lib/ide";
import { toast } from "sonner";
import { needsHumanDecision as zanoemNeedsDecision, buildAutopilotReply as zanoemBuildReply, logDecision as zanoemLogDecision } from "@/lib/zanoem/decisionLog";
import ZanoemDecisionLog from "./ZanoemDecisionLog";
import { validateFiles, validateCode } from "@/lib/ide";
import { verifyUiMatchesIntent } from "@/lib/zanoem/visionVerify";
import { autoFixUntilClean, type AutoFixFile } from "@/lib/zanoem/autoFix";
import { enqueue as zqEnqueue, registerHandler as zqRegister, startQueueWorker as zqStart, type QueuedJob } from "@/lib/zanoem/offlineQueue";

interface ChatMsg { role: "user" | "assistant"; content: string }

type ZipImportAction = "create" | "overwrite" | "skip" | "reject";
type ZipImportEntry = {
  path: string;
  content: string;
  language: string;
  bytes: number;
  action: ZipImportAction;
  reason?: string;
};
type ZipImportSession = {
  archiveName: string;
  entries: ZipImportEntry[];
  totalEntries: number;
  acceptedBytes: number;
};

const ZIP_IMPORT_MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const ZIP_IMPORT_MAX_FILES = 150;
const ZIP_IMPORT_MAX_ENTRY_BYTES = 512 * 1024;
const ZIP_IMPORT_MAX_TOTAL_TEXT_BYTES = 3 * 1024 * 1024;
const ZIP_IMPORT_BLOCKED_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".cache", "coverage"]);
const ZIP_IMPORT_BLOCKED_FILES = new Set([".env", ".env.local", ".env.production", ".npmrc", ".yarnrc", "id_rsa", "id_dsa"]);
const ZIP_IMPORT_BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif", "heic", "pdf", "zip", "rar", "7z", "tar", "gz", "bz2",
  "exe", "dll", "so", "dylib", "bin", "class", "jar", "wasm", "mp3", "mp4", "mov", "avi", "wav", "ogg", "ttf", "otf", "woff", "woff2",
]);

function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return ({
    js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript", py: "python", html: "html", htm: "html",
    css: "css", scss: "scss", json: "json", md: "markdown", mdx: "markdown",
    sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml", toml: "toml",
    sql: "sql", go: "go", rs: "rust", java: "java", rb: "ruby", php: "php",
    txt: "plaintext", gitignore: "plaintext",
  } as Record<string, string>)[ext] || "plaintext";
}

function sanitizeZipPath(rawName: string): { path: string | null; reason?: string } {
  const normalized = rawName.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "").trim();
  if (!normalized) return { path: null, reason: "empty path" };
  if (normalized.length > 220) return { path: null, reason: "path too long" };
  if (normalized.includes("\0") || /[\u0000-\u001f]/.test(normalized)) return { path: null, reason: "control character" };
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("~")) return { path: null, reason: "absolute path" };
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === ".." || part === ".")) return { path: null, reason: "path traversal" };
  if (parts.some((part) => ZIP_IMPORT_BLOCKED_DIRS.has(part))) return { path: null, reason: "blocked system folder" };
  const fileName = parts[parts.length - 1]?.toLowerCase();
  if (!fileName) return { path: null, reason: "folder entry" };
  if (ZIP_IMPORT_BLOCKED_FILES.has(fileName) || fileName.startsWith(".env.")) return { path: null, reason: "secret file blocked" };
  const ext = fileName.split(".").pop() || "";
  if (ZIP_IMPORT_BINARY_EXTENSIONS.has(ext)) return { path: null, reason: "binary asset skipped" };
  return { path: parts.join("/") };
}

function isValidBranchName(name: string): boolean {
  return /^(?!\/)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._/-]{1,80}$/.test(name) && !name.endsWith("/") && !name.endsWith(".lock");
}

async function parseZipImport(file: File, currentFiles: AsherCodeFile[]): Promise<ZipImportSession> {
  if (file.size > ZIP_IMPORT_MAX_ARCHIVE_BYTES) {
    throw new Error(`${file.name} exceeds the 20MB ZIP import limit`);
  }
  const zip = await JSZip.loadAsync(file);
  const zipEntries = Object.values(zip.files);
  const existingPaths = new Set(currentFiles.map((f) => f.path));
  const seenPaths = new Set<string>();
  const entries: ZipImportEntry[] = [];
  let acceptedBytes = 0;

  for (const entry of zipEntries) {
    if (entry.dir) continue;
    const { path, reason } = sanitizeZipPath(entry.name);
    if (!path) {
      entries.push({ path: entry.name, content: "", language: "plaintext", bytes: 0, action: "reject", reason });
      continue;
    }
    const declaredSize = Number((entry as any)?._data?.uncompressedSize || 0);
    if (declaredSize > ZIP_IMPORT_MAX_ENTRY_BYTES) {
      entries.push({ path, content: "", language: languageForPath(path), bytes: declaredSize, action: "reject", reason: "file too large" });
      continue;
    }
    if (seenPaths.has(path)) {
      entries.push({ path, content: "", language: languageForPath(path), bytes: 0, action: "skip", reason: "duplicate path" });
      continue;
    }
    if (entries.filter((e) => e.action === "create" || e.action === "overwrite").length >= ZIP_IMPORT_MAX_FILES) {
      entries.push({ path, content: "", language: languageForPath(path), bytes: declaredSize, action: "reject", reason: "file count limit" });
      continue;
    }

    let bytes: Uint8Array;
    try {
      bytes = await entry.async("uint8array");
    } catch {
      entries.push({ path, content: "", language: languageForPath(path), bytes: declaredSize, action: "reject", reason: "read failed" });
      continue;
    }
    if (bytes.byteLength > ZIP_IMPORT_MAX_ENTRY_BYTES) {
      entries.push({ path, content: "", language: languageForPath(path), bytes: bytes.byteLength, action: "reject", reason: "file too large" });
      continue;
    }
    if (acceptedBytes + bytes.byteLength > ZIP_IMPORT_MAX_TOTAL_TEXT_BYTES) {
      entries.push({ path, content: "", language: languageForPath(path), bytes: bytes.byteLength, action: "reject", reason: "archive text limit" });
      continue;
    }
    if (bytes.includes(0)) {
      entries.push({ path, content: "", language: languageForPath(path), bytes: bytes.byteLength, action: "reject", reason: "binary content" });
      continue;
    }

    let content = "";
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      entries.push({ path, content: "", language: languageForPath(path), bytes: bytes.byteLength, action: "reject", reason: "non-utf8 text" });
      continue;
    }

    seenPaths.add(path);
    acceptedBytes += bytes.byteLength;
    entries.push({
      path,
      content,
      language: languageForPath(path),
      bytes: bytes.byteLength,
      action: existingPaths.has(path) ? "overwrite" : "create",
    });
  }

  entries.sort((a, b) => {
    const weight = (entry: ZipImportEntry) => entry.action === "reject" ? 2 : entry.action === "skip" ? 1 : 0;
    return weight(a) - weight(b) || a.path.localeCompare(b.path);
  });

  return { archiveName: file.name, entries, totalEntries: zipEntries.length, acceptedBytes };
}

// Load the operator brain context (mirrors Asherin Chat / ZALI). Result is spread into every
// asher-code-ai call so Asher IDE inherits the same coding brain stack as the rest of the dashboard.
async function loadAureonContext(): Promise<{
  brainContext: { prompt: string; fileContents: { name: string; content: string }[] } | null;
}> {
  let brainContext: { prompt: string; fileContents: { name: string; content: string }[] } | null = null;
  try {
    const activeBrainId = localStorage.getItem("aureon_active_brain_id");
    if (activeBrainId) {
      const { data: brain } = await supabase
        .from("brains")
        .select("system_prompt, file_ids")
        .eq("id", activeBrainId)
        .single();
      if (brain) {
        const fileContents: { name: string; content: string }[] = [];
        if (brain.file_ids?.length) {
          const { data: files } = await supabase
            .from("library_files")
            .select("file_name, storage_path, file_type")
            .in("id", brain.file_ids);
          if (files) {
            for (const f of files) {
              const isText = !f.file_type.startsWith("image/")
                && !f.file_type.startsWith("video/")
                && !f.file_type.startsWith("audio/");
              if (!isText) continue;
              const { data: blob } = await supabase.storage.from("library").download(f.storage_path);
              if (blob) fileContents.push({ name: f.file_name, content: (await blob.text()).slice(0, 80000) });
            }
          }
        }
        brainContext = { prompt: brain.system_prompt || "", fileContents };
      }
    }
  } catch (e) { console.error("Asher Code: failed to load Asherin brain context:", e); }
  return { brainContext };
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 604_800_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return `${Math.floor(d / 604_800_000)}w ago`;
}

/**
 * Compact recent-projects switcher shown in the Asher IDE top bar when a
 * project is open. Lists the last 8 projects by updated_at; clicking one
 * calls onSelect. Closes on outside click and on Escape.
 */
function RecentProjectsMenu({
  projects, activeId, onSelect,
}: {
  projects: AsherCodeProject[];
  activeId: string;
  onSelect: (p: AsherCodeProject) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const recent = projects.slice(0, 8);
  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch to a recent project"
        className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground hover:border-foreground/30"
      >
        <Clock className="h-3 w-3" /> Recent <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-[100] w-72 rounded-lg border border-border/30 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border/20 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
            Recent Projects · {recent.length}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {recent.length === 0 && (
              <li className="px-3 py-4 text-[10px] text-muted-foreground/60 text-center">No previous projects.</li>
            )}
            {recent.map(p => {
              const active = p.id === activeId;
              return (
                <li key={p.id}>
                  <button
                    disabled={active}
                    onClick={() => { setOpen(false); if (!active) onSelect(p); }}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 border-l-2 ${
                      active
                        ? "border-foreground/50 bg-foreground/5 cursor-default"
                        : "border-transparent hover:bg-card/60 hover:border-foreground/30"
                    }`}
                  >
                    <FileText className="h-3 w-3 text-foreground/50 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-light truncate">{p.name}</div>
                      <div className="text-[9px] text-muted-foreground/50 truncate">
                        {p.language} · updated {relTime(p.updated_at)}
                      </div>
                    </div>
                    {active && <span className="text-[8px] font-mono uppercase tracking-wider text-foreground/60">open</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}





export default function AsherCodeModule() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<AsherCodeProject[]>([]);
  const [activeProject, setActiveProject] = useState<AsherCodeProject | null>(null);
  const [files, setFiles] = useState<AsherCodeFile[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; parent_branch_id: string | null }[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null); // null == main/default
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [showNewProject, setShowNewProject] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const commitProjectRename = async () => {
    if (!activeProject) return;
    const next = titleDraft.trim();
    setRenamingTitle(false);
    if (!next || next === activeProject.name) return;
    const prev = activeProject.name;
    setActiveProject({ ...activeProject, name: next });
    setProjects(ps => ps.map(p => p.id === activeProject.id ? { ...p, name: next } : p));
    const { error } = await supabase.from("asher_code_projects").update({ name: next }).eq("id", activeProject.id);
    if (error) {
      toast.error("Rename failed");
      setActiveProject({ ...activeProject, name: prev });
      setProjects(ps => ps.map(p => p.id === activeProject.id ? { ...p, name: prev } : p));
    } else {
      toast.success("Project renamed");
    }
  };
  const [showSettings, setShowSettings] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  // ── Auto-approved plan / todo strip ──────────────────────────
  // Each new user message generates a small checklist of steps
  // that auto-tick as the agent works. Mirrors the Lovable agent.
  const [activePlan, setActivePlan] = useState<import("./AsherCodePlanSteps").AsherCodePlan | null>(null);
  const planTimerRef = useRef<number | null>(null);
  const stopPlanTicker = useCallback(() => {
    if (planTimerRef.current != null) { window.clearInterval(planTimerRef.current); planTimerRef.current = null; }
  }, []);
  const startPlan = useCallback((prompt: string, intent: "swarm_fix" | "build_all" | "edit_file" | "chat", ctx: { activeFileName?: string; projectName?: string }) => {
    // Lazy import to avoid circular concerns at module init
    const { generatePlanSteps } = require("./AsherCodePlanSteps") as typeof import("./AsherCodePlanSteps");
    const steps = generatePlanSteps(prompt, intent, ctx);
    if (!steps.length) return;
    const plan: import("./AsherCodePlanSteps").AsherCodePlan = {
      id: Math.random().toString(36).slice(2, 9),
      prompt, intent, steps: steps.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" })),
      startedAt: Date.now(),
    };
    setActivePlan(plan);
    stopPlanTicker();
    // Advance one step every ~1.4s while the agent is working. The final
    // step is held in "running" until completePlan() is called from the
    // response handler — guarantees the checkmark lands when work lands.
    planTimerRef.current = window.setInterval(() => {
      setActivePlan((p) => {
        if (!p) return p;
        const idx = p.steps.findIndex((s) => s.status === "running");
        if (idx < 0 || idx >= p.steps.length - 1) return p;
        const next = p.steps.map((s, i) =>
          i === idx ? { ...s, status: "done" as const } :
          i === idx + 1 ? { ...s, status: "running" as const } : s);
        return { ...p, steps: next };
      });
    }, 1400);
  }, [stopPlanTicker]);
  const completePlan = useCallback(() => {
    stopPlanTicker();
    setActivePlan((p) => p ? { ...p, steps: p.steps.map((s) => ({ ...s, status: "done" as const })) } : p);
    // Fade the completed plan out after a moment so the chat stays clean
    window.setTimeout(() => setActivePlan(null), 4000);
  }, [stopPlanTicker]);
  useEffect(() => () => stopPlanTicker(), [stopPlanTicker]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [chatScrolledUp, setChatScrolledUp] = useState(false);
  const chatAutoScrollingRef = useRef(false);
  const jumpChatToPresent = useCallback(() => {
    setChatScrolledUp(false);
    chatAutoScrollingRef.current = true;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    requestAnimationFrame(() => { chatAutoScrollingRef.current = false; });
  }, []);
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (chatAutoScrollingRef.current) return;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setChatScrolledUp(dist > 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (chatScrolledUp) return;
    chatAutoScrollingRef.current = true;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    requestAnimationFrame(() => { chatAutoScrollingRef.current = false; });
  }, [chat, chatScrolledUp]);
  // ── SWARM AGENTS ─────────────────────────────────────────────
  // Live registry of per-issue debugger agents. One agent per file
  // currently being patched. Agents fade out 1.2s after they finish
  // so the user sees the swarm dissolve in real time.
  type SwarmAgent = { id: string; file: string; issueCount: number; pass: number; status: "working" | "done" | "failed" };
  const [swarmAgents, setSwarmAgents] = useState<SwarmAgent[]>([]);
  // Short-lived flag set the moment the user clicks "Fix Bugs & Logic" so the
  // button shows "Running…" even before the first agent has spawned.
  const [fixBugsPending, setFixBugsPending] = useState(false);
  // Pause control for the swarm autofix loop. Backed by a ref so the loop
  // can read the latest value without re-renders restarting it.
  const [swarmPaused, setSwarmPaused] = useState(false);
  const swarmPausedRef = useRef(false);
  useEffect(() => { swarmPausedRef.current = swarmPaused; }, [swarmPaused]);
  // Workflow Map state — persists agent history so the Workflow tab still shows
  // the run after individual agent pills have dissolved from the chat overlay.
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);
  const [fileWorkflowStats, setFileWorkflowStats] = useState<Record<string, FileWorkflowStat>>({});
  // Per-file lock — prevents two agents from ever writing to the SAME file at
  // the same time (defensive: the dispatcher already gives one agent per file
  // per pass, but overlapping passes or manual triggers could collide).
  const fileLocksRef = useRef<Set<string>>(new Set());
  // Map agent.id → file path so onAgentDone can record stats / release locks
  // even if the agent record has already been removed from swarmAgents.
  const agentFileRef = useRef<Map<string, string>>(new Map());
  const [chatInput, setChatInput] = useState(() => localStorage.getItem("asherCode.draft.__global__") || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [editPlan, setEditPlan] = useState<EditPlan | null>(null);
  const [orchResult, setOrchResult] = useState<CallAsherCodeResult | null>(null);
  const [showDevOps, setShowDevOps] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [orchestrateMode, setOrchestrateMode] = useState(() => localStorage.getItem("asherCode.orchestrate") === "1");
  const [showFiles, setShowFiles] = useState(() => localStorage.getItem("asherCode.showFiles") !== "0");
  const [showPreview, setShowPreview] = useState(() => localStorage.getItem("asherCode.showPreview") !== "0");
  const [viewMode, setViewMode] = useState<"code" | "split" | "preview" | "workflow">(() => (localStorage.getItem("asherCode.viewMode") as any) || "split");
  const [showAi, setShowAi] = useState(() => localStorage.getItem("asherCode.showAi") !== "0");
  const [zanoemMode, setZanoemMode] = useState(() => localStorage.getItem("asherCode.zanoemMode") === "1");
  const [autopilotZanoem, setAutopilotZanoem] = useState(() => localStorage.getItem("asherCode.autopilotZanoem") === "1");
  const [autoDebug, setAutoDebug] = useState(() => localStorage.getItem("asherCode.autoDebug") !== "0");          // default ON
  const [autoUiDebug, setAutoUiDebug] = useState(() => localStorage.getItem("asherCode.autoUiDebug") !== "0");    // default ON
  const autopilotRoundsRef = useRef(0);
  const AUTOPILOT_MAX_ROUNDS = 8;
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem("asherCode.autoApprove") !== "0");
  const [animateInsertion, setAnimateInsertion] = useState(() => localStorage.getItem("asherCode.animate") !== "0");
  const [pendingUploads, setPendingUploads] = useState<{ name: string; preview?: string; content: string; kind: "image" | "zip" | "text" }[]>([]);
  const [zipImportSession, setZipImportSession] = useState<ZipImportSession | null>(null);
  const [zipImporting, setZipImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipImportInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // BYOK config — provider/model persisted (non-secret); apiKey is SESSION-ONLY
  // to keep it out of localStorage (XSS exfil risk if any HTML sink ever leaks).
  const [provider, setProvider] = useState(() => localStorage.getItem("asherCode.provider") || "anthropic");
  const [model, setModel] = useState(() => localStorage.getItem("asherCode.model") || "claude-sonnet-4-5");
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("asherCode.apiKey") || "");

  // ── Shared IDE upgrade pack state ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const [bugDoctorOpen, setBugDoctorOpen] = useState(false);
  const [bugDoctorMsg, setBugDoctorMsg] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [fuzzyOpen, setFuzzyOpen] = useState(false);
  const [approval, setApproval] = useState<{ title: string; changes: PlannedChange[]; resolve: (ok: boolean) => void } | null>(null);
  const [modelOverride, setModelOverride] = useState<IdeModelId | null>(null);
  const routeDecision = useMemo(() => routeTask(chatInput || "", modelOverride ?? undefined), [chatInput, modelOverride]);
  const [semanticOpen, setSemanticOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryAge, setRecoveryAge] = useState(0);
  const [recoverySnap, setRecoverySnap] = useState<AutoSaveSnapshot | null>(null);

  useEffect(() => { localStorage.setItem("asherCode.provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("asherCode.model", model); }, [model]);
  useEffect(() => {
    // Migrate any legacy plaintext key out of localStorage and into sessionStorage.
    try { if (localStorage.getItem("asherCode.apiKey")) localStorage.removeItem("asherCode.apiKey"); } catch {}
    if (apiKey) sessionStorage.setItem("asherCode.apiKey", apiKey);
    else sessionStorage.removeItem("asherCode.apiKey");
  }, [apiKey]);
  useEffect(() => { localStorage.setItem("asherCode.orchestrate", orchestrateMode ? "1" : "0"); }, [orchestrateMode]);
  useEffect(() => { localStorage.setItem("asherCode.showFiles", showFiles ? "1" : "0"); }, [showFiles]);
  useEffect(() => { localStorage.setItem("asherCode.showPreview", showPreview ? "1" : "0"); }, [showPreview]);
  useEffect(() => { localStorage.setItem("asherCode.viewMode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("asherCode.showAi", showAi ? "1" : "0"); }, [showAi]);
  useEffect(() => { localStorage.setItem("asherCode.zanoemMode", zanoemMode ? "1" : "0"); }, [zanoemMode]);
  useEffect(() => { localStorage.setItem("asherCode.autopilotZanoem", autopilotZanoem ? "1" : "0"); }, [autopilotZanoem]);
  useEffect(() => { localStorage.setItem("asherCode.autoDebug", autoDebug ? "1" : "0"); }, [autoDebug]);
  useEffect(() => { localStorage.setItem("asherCode.autoUiDebug", autoUiDebug ? "1" : "0"); }, [autoUiDebug]);

  // Capture preview iframe errors and feed the Bug Doctor automatically
  const lastPreviewErrorRef = useRef<string>("");
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d: any = e.data;
      if (!d || typeof d !== "object") return;
      if (d.__asherPreviewError || d.__asherPreviewErrorSilent) {
        const composed = `[${d.kind}] ${d.message}${d.source ? `\n@ ${d.source}` : ""}\n\nWhy: ${d.why}`;
        lastPreviewErrorRef.current = composed;
        if (d.__asherPreviewError) {
          setBugDoctorMsg(composed);
          setBugDoctorOpen(true);
        }
        // Hard auto-mount failures always trigger the swarm autofix, regardless of the
        // Auto Debug toggle — the whole point is the user shouldn't have to press "Fix".
        const isHardMountFailure = /Component Undefined|Missing Mount|Auto-Mount Exception|Render Error|No Entry Component/i.test(String(d.kind || ""));
        if (d.__asherPreviewErrorSilent && (isHardMountFailure || autoDebugRef.current) && activeProjectRef.current) {
          void zqEnqueue({
            kind: "autofix",
            payload: { projectRef: activeProjectRef.current.id },
            surface: "asher_ide",
            projectRef: activeProjectRef.current.id,
            ownerUserId: user?.id,
          });
          if (isHardMountFailure) {
            toast.message("◈ Auto-Debug engaged", { description: `${d.kind} — patching automatically` });
          }
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => { localStorage.setItem("asherCode.autoApprove", autoApprove ? "1" : "0"); }, [autoApprove]);
  useEffect(() => { localStorage.setItem("asherCode.animate", animateInsertion ? "1" : "0"); }, [animateInsertion]);

  // ── Vision + auto-fix + offline queue (autonomous loops) ──
  // Keep refs to "latest" state so the queue handlers (which run outside React)
  // always see fresh data, even if the user closes the tab and reopens later.
  const filesRef = useRef(files);
  const activeProjectRef = useRef(activeProject);
  const previewRefForVision = previewRef;
  const autopilotZanoemRef = useRef(autopilotZanoem);
  const autoDebugRef = useRef(autoDebug);
  const autoUiDebugRef = useRef(autoUiDebug);
  const lastIntentRef = useRef<string>("");
  const lastAssistantRef = useRef<string>("");
  const autopilotEnqueueGuardRef = useRef(false);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { autopilotZanoemRef.current = autopilotZanoem; }, [autopilotZanoem]);
  useEffect(() => { autoDebugRef.current = autoDebug; }, [autoDebug]);
  useEffect(() => { autoUiDebugRef.current = autoUiDebug; }, [autoUiDebug]);

  // Auto-Approve: when enabled, any pending approval gate is auto-accepted instantly.
  useEffect(() => {
    if (autoApprove && approval) {
      const a = approval;
      setApproval(null);
      a.resolve(true);
    }
  }, [autoApprove, approval]);

  // We need a stable way for the queue worker to "send a ZANOEM turn".
  // sendChatViaZanoem isn't defined yet (declared further down), so route
  // through a ref that we update in a later effect.
  const sendZanoemTurnRef = useRef<((prompt: string) => Promise<void>) | null>(null);

  useEffect(() => {
    // Register handlers ONCE per mount.
    zqRegister("vision", async (job: QueuedJob<{ intent: string; recentAssistant: string; projectRef?: string }>) => {
      if (!autopilotZanoemRef.current || !autoUiDebugRef.current) return;       // gated by Auto UI Debug
      const verdict = await verifyUiMatchesIntent({
        intent: job.payload.intent,
        recentAssistant: job.payload.recentAssistant,
        iframe: previewRefForVision.current,
      });
      if (!verdict.matches && verdict.suggestedFixPrompt && sendZanoemTurnRef.current) {
        toast.message("ZANOEM Vision: UI mismatch detected — auto-fixing", {
          description: verdict.mismatches.slice(0, 2).join(" • ") || "patching UI",
        });
        await sendZanoemTurnRef.current(verdict.suggestedFixPrompt);
      }
    });

    zqRegister("autofix", async (_job: QueuedJob<{ projectRef?: string }>) => {
      if (!autoDebugRef.current) return;         // gated by Auto Debug
      const result = await autoFixUntilClean({
        files: () => filesRef.current.map<AutoFixFile>((f) => ({
          id: f.id, name: f.path, content: f.content, language: f.language,
        })),
        applyFileFix: applyDebuggerFix,
        runZanoemTurn: async (prompt) => {
          if (!sendZanoemTurnRef.current) throw new Error("Auto-fix dispatcher is not ready");
          await sendZanoemTurnRef.current(prompt);
        },
        maxPasses: 20,
        swarmConcurrency: 2,
        perAgentDelayMs: 1000,
        scanAllFiles: true,
        shouldPause: () => swarmPausedRef.current,
        onPassComplete: (pass, remaining, applied) => {
          if (remaining > 0) {
            toast.message(`◈ Pass ${pass} complete — ${remaining} issue(s) remain, swarm re-engaging…`, {
              description: `${applied} fix(es) applied this pass`,
            });
          } else {
            toast.success(`◉ Codebase clean after ${pass} pass(es) — no red lines remaining`);
          }
        },
        onAgentSpawn: (a) => {
          setSwarmAgents((prev) => [...prev, { ...a, status: "working" }]);
          agentFileRef.current.set(a.id, a.file);
          fileLocksRef.current.add(a.file);
          setFixBugsPending(false);
          const evId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `ev_${Date.now()}_${Math.random()}`;
          setWorkflowEvents((prev) => [...prev.slice(-499), { id: evId, ts: Date.now(), kind: "spawn", file: a.file, pass: a.pass, issueCount: a.issueCount }]);
          setFileWorkflowStats((prev) => {
            const cur = prev[a.file] ?? { path: a.file, attempts: 0, successes: 0, failures: 0, lastStatus: "working" as const, lastTs: Date.now() };
            return { ...prev, [a.file]: { ...cur, attempts: cur.attempts + 1, lastStatus: "working", lastTs: Date.now() } };
          });
        },
        onAgentDone: (id, success) => {
          const file = agentFileRef.current.get(id);
          setSwarmAgents((prev) => prev.map((a) => a.id === id ? { ...a, status: success ? "done" : "failed" } : a));
          if (file) {
            fileLocksRef.current.delete(file);
            const evId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `ev_${Date.now()}_${Math.random()}`;
            setWorkflowEvents((prev) => [...prev.slice(-499), { id: evId, ts: Date.now(), kind: success ? "done" : "failed", file }]);
            setFileWorkflowStats((prev) => {
              const cur = prev[file];
              if (!cur) return prev;
              return { ...prev, [file]: { ...cur, successes: cur.successes + (success ? 1 : 0), failures: cur.failures + (success ? 0 : 1), lastStatus: success ? "done" : "failed", lastTs: Date.now() } };
            });
          }
          // Tear down this agent ~1.2s after completion so the swarm visibly dissolves.
          setTimeout(() => {
            setSwarmAgents((prev) => prev.filter((a) => a.id !== id));
            agentFileRef.current.delete(id);
          }, 1200);
        },
        onProgress: (pass, n) => {
          if (n > 0) {
            toast.message(`◈ Swarm pass ${pass}: spawning ${n} agent${n === 1 ? "" : "s"}`);
            const evId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `ev_${Date.now()}_${Math.random()}`;
            setWorkflowEvents((prev) => [...prev.slice(-499), { id: evId, ts: Date.now(), kind: "pass", pass, issueCount: n }]);
          }
        },
      });
      // Hard-clear any stragglers (e.g. timeouts) when the whole loop exits.
      setSwarmAgents([]);
      fileLocksRef.current.clear();
      agentFileRef.current.clear();
      if (result.clean) toast.success(`ZANOEM Auto-Fix: clean (${result.passes} pass${result.passes === 1 ? "" : "es"})`);
      else toast.warning(`ZANOEM Auto-Fix stopped: ${result.finalErrorCount} error(s) remain after ${result.passes} pass(es)`);
    });

    zqStart({ intervalMs: 2000 });
    // No teardown — the queue is process-wide & must outlive component unmount
    // so jobs continue draining if the user navigates between IDE tabs.
  }, [previewRefForVision]);

  // ── Draft persistence: survives reloads, crashes, lost wifi ──
  // Keyed by active project (falls back to a global slot before a project is open).
  const draftKey = activeProject ? `asherCode.draft.${activeProject.id}` : "asherCode.draft.__global__";
  // Restore the draft for whichever project just became active.
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    setChatInput(saved || "");
  }, [draftKey]);
  // Persist every keystroke (cheap; localStorage is sync but tiny strings).
  useEffect(() => {
    if (chatInput) localStorage.setItem(draftKey, chatInput);
    else localStorage.removeItem(draftKey);
  }, [chatInput, draftKey]);


  // Word-by-word fade-in / fade-out replace for AI-generated content.
  function animateApply(fileId: string, finalContent: string) {
    const current = dirty[fileId] ?? files.find(f => f.id === fileId)?.content ?? "";
    const set = (next: string) => setDirty(d => ({ ...d, [fileId]: next }));
    if (!animateInsertion) { set(finalContent); return; }
    if (current && current.trim().length > 0) {
      animateReplace(current, finalContent, set);
    } else {
      animateInsert(finalContent, set);
    }
  }

  // ── File upload handler (images + ZIP + text) ──────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} exceeds 100MB limit`);
        continue;
      }
      try {
        if (file.type.startsWith("image/")) {
          const dataUrl = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(file);
          });
          setPendingUploads(p => [...p, { name: file.name, preview: dataUrl, content: dataUrl, kind: "image" }]);
          toast.success(`Image attached: ${file.name}`);
        } else if (file.name.endsWith(".zip") || file.type === "application/zip") {
          const zip = await JSZip.loadAsync(file);
          let extracted = "";
          let count = 0;
          for (const name of Object.keys(zip.files)) {
            const entry = zip.files[name];
            if (entry.dir) continue;
            if (count >= 60) { extracted += `\n[... ${Object.keys(zip.files).length - count} more files truncated]`; break; }
            try {
              const txt = await entry.async("string");
              if (txt.length > 50000) continue;
              extracted += `\n\n=== ${name} ===\n${txt}`;
              count++;
            } catch {}
          }
          setPendingUploads(p => [...p, { name: file.name, content: extracted, kind: "zip" }]);
          toast.success(`ZIP extracted: ${count} files from ${file.name}`);
        } else {
          const txt = await file.text();
          setPendingUploads(p => [...p, { name: file.name, content: txt, kind: "text" }]);
          toast.success(`Attached: ${file.name}`);
        }
      } catch (err: any) {
        toast.error(`Failed to read ${file.name}: ${err.message}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleZipImportSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (zipImportInputRef.current) zipImportInputRef.current.value = "";
    if (!file) return;
    if (!activeProject) { toast.error("Open a project first"); return; }
    if (!file.name.toLowerCase().endsWith(".zip") && file.type !== "application/zip") {
      toast.error("Select a .zip archive");
      return;
    }
    setZipImporting(true);
    try {
      const session = await parseZipImport(file, files);
      const importable = session.entries.filter((entry) => entry.action === "create" || entry.action === "overwrite").length;
      setZipImportSession(session);
      if (importable > 0) toast.success(`ZIP staged: ${importable} file${importable === 1 ? "" : "s"} ready`);
      else toast.warning("ZIP parsed, but no importable text files passed safety checks");
    } catch (err: any) {
      toast.error(err?.message || `Failed to inspect ${file.name}`);
    } finally {
      setZipImporting(false);
    }
  }

  function updateZipImportAction(path: string, action: ZipImportAction) {
    setZipImportSession((session) => {
      if (!session) return session;
      return {
        ...session,
        entries: session.entries.map((entry) => {
          if (entry.path !== path || entry.action === "reject") return entry;
          return { ...entry, action };
        }),
      };
    });
  }
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 768) { setShowFiles(false); setShowAi(false); setShowPreview(false); }
      else if (w < 1100) { setShowFiles(false); }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd+P fuzzy, Ctrl+Shift+P templates, Ctrl+Shift+H history
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault(); setTemplateOpen(true);
      } else if (e.shiftKey && (e.key === "H" || e.key === "h")) {
        e.preventDefault(); setHistoryOpen(true);
      } else if (!e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault(); setFuzzyOpen(true);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault(); setPaletteOpen(true);
      } else if (e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault(); setSemanticOpen(true);
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault(); setGuideOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId) || null, [files, activeFileId]);
  const activeContent = activeFileId ? (dirty[activeFileId] ?? activeFile?.content ?? "") : "";

  // Refs so long-lived Monaco widgets (Cmd+K, ghost completions) always see the current file.
  const activeFileRefAsher = useRef(activeFile);
  const activeContentRefAsher = useRef(activeContent);
  useEffect(() => { activeFileRefAsher.current = activeFile; }, [activeFile]);
  useEffect(() => { activeContentRefAsher.current = activeContent; }, [activeContent]);

  function applyProjectFileContent(fileId: string, content: string, persist = false) {
    setDirty(d => {
      const next = { ...d, [fileId]: content };
      if (persist) delete next[fileId];
      return next;
    });
    setFiles(fs => fs.map(f => f.id === fileId ? { ...f, content } : f));
    filesRef.current = filesRef.current.map(f => f.id === fileId ? { ...f, content } : f);
    if (persist) void supabase.from("asher_code_files").update({ content }).eq("id", fileId);
    setPreviewKey(k => k + 1);
  }

  // ── Auto-save dirty edits every 30s so manual Monaco edits aren't lost on tab close
  useEffect(() => {
    const t = setInterval(() => {
      const snapshot = dirty;
      const ids = Object.keys(snapshot);
      if (!ids.length) return;
      ids.forEach((id) => {
        const content = snapshot[id];
        void supabase.from("asher_code_files").update({ content }).eq("id", id).then(() => {
          setDirty((d) => {
            if (d[id] !== content) return d; // user edited again — keep dirty
            const { [id]: _drop, ...rest } = d;
            return rest;
          });
        });
      });
    }, 30_000);
    return () => clearInterval(t);
  }, [dirty]);

  async function applyDebuggerFix(file: AutoFixFile, issues: { file: string; line?: number; message: string }[]) {
    // ── PER-FILE ISOLATION ──
    // The dispatcher already spawns one agent per target file per pass. Do not
    // reject here based on fileLocksRef: onAgentSpawn marks the same file as
    // locked for UI/status purposes before this function runs, so checking that
    // lock here caused every agent to fail against its own lock.
    // Only act on issues that belong to THIS file. Strip cross-file noise so
    // the agent stays surgical and never accidentally rewrites a sibling.
    const ownIssues = issues.filter((i) => i.file === file.name);
    const current = filesRef.current.find(f => f.id === file.id)?.content ?? file.content;
    // Scan-all mode: when there are no validator errors for this file we still
    // run a LOGIC audit pass (bugs, dead code, unhandled edge cases, async
    // races, etc.) so every file in the zip gets reviewed.
    const diagnostic = ownIssues.length > 0
      ? ownIssues.map(e => `${e.file}:${e.line ?? "?"} — ${e.message}`).join("\n")
      : `[LOGIC AUDIT] No validator errors in ${file.name}. Review the entire file for: latent bugs, race conditions, unhandled errors, off-by-one errors, missing null checks, dead code, security flaws, and broken logic. If the file is already correct, return it UNCHANGED. Only rewrite if you find a real defect.`;

    // ── 429-aware retry with exponential backoff + jitter ──
    // The AI gateway throws 429 when too many agents fire at once. Instead of
    // letting the agent fail and the whole swarm pass be wasted, we retry the
    // explainError call up to 4 times with exponential backoff (1s, 2s, 4s, 8s)
    // plus a small random jitter to de-sync parallel agents.
    let reply = "";
    let lastErr: any = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const aureon = await loadAureonContext();
        const result = await callAsherCodeAi({
          mode: "fix",
          byok: byok(),
          code: current,
          language: file.language,
          error: diagnostic || lastPreviewErrorRef.current,
          ...aureon,
        });
        reply = result.reply || "";
        break;
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e || "");
        const is429 = /429|rate.?limit|quota|too.?many.?requests/i.test(msg);
        if (!is429 || attempt === 3) throw e;
        const backoff = (2 ** attempt) * 1000 + Math.floor(Math.random() * 600);
        console.warn(`[swarm-agent] 429 on ${file.name} — retrying in ${backoff}ms (attempt ${attempt + 1}/4)`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    if (!reply) throw lastErr ?? new Error("BYOK fixer returned no response");

    let corrected = extractCodeBlock(reply || "").trim();
    // ── Retry if AI returned no correctedCode ──
    // The first pass sometimes returns explanation-only (no rewrite). Force a
    // second pass with an explicit "rewrite the file" prompt before giving up.
    if (!corrected || corrected === current.trim()) {
      try {
        const aureon = await loadAureonContext();
        const forced = await callAsherCodeAi({
          mode: "fix",
          byok: byok(),
          code: current,
          language: file.language,
          error: `${diagnostic}\n\n[REWRITE REQUIRED] Return ONLY the COMPLETE corrected file inside one fenced code block. Do not skip.`,
          ...aureon,
        });
        const c2 = extractCodeBlock(forced.reply || "").trim();
        if (c2 && c2 !== current.trim()) corrected = c2;
      } catch {
        // fall through — return false below
      }
    }
    if (!corrected || corrected === current.trim()) {
      // Scan-all clean file: not a defect, not a failure.
      if (ownIssues.length === 0) {
        console.info(`[swarm-agent] ${file.name} passed logic audit (no changes needed)`);
        return true;
      }
      console.warn(`[swarm-agent] no corrected code produced for ${file.name}`);
      return false;
    }
    // Strict file-id scoping: only mutate the file this agent owns.
    applyProjectFileContent(file.id, corrected, true);
    toast.success(`Auto-applied debugger fix → ${file.name}`);
    return true;
  }

  // ── Red-line bug highlighting in Monaco ──
  // Validator issues become red squigglies (markers) + a red line-background decoration
  // so error lines are instantly spottable AND consumable by the auto-fix loop.
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor || !activeFile) return;
    const model = editor.getModel();
    if (!model) return;

    const result = validateCode(activeContent, activeFile.language);
    const totalLines = model.getLineCount();

    // 1. Markers (red squigglies + Problems panel)
    const markers = result.issues.map((iss) => {
      const line = Math.max(1, Math.min(iss.line, totalLines));
      const lineLen = model.getLineLength(line) || 1;
      return {
        severity: iss.severity === "error"
          ? monaco.MarkerSeverity.Error
          : iss.severity === "warning"
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
        startLineNumber: line,
        endLineNumber: line,
        startColumn: 1,
        endColumn: lineLen + 1,
        message: `[${iss.rule}] ${iss.message}`,
        source: "ZANOEM",
      };
    });
    monaco.editor.setModelMarkers(model, "zanoem-validator", markers);

    // 2. Red line-background decorations for error lines (the "highlight in red")
    const errorDecorations = result.issues
      .filter((i) => i.severity === "error")
      .map((iss) => {
        const line = Math.max(1, Math.min(iss.line, totalLines));
        return {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "zanoem-error-line",
            glyphMarginClassName: "zanoem-error-glyph",
            overviewRuler: {
              color: "rgba(239,68,68,0.9)",
              position: monaco.editor.OverviewRulerLane.Full,
            },
            minimap: { color: "rgba(239,68,68,0.6)", position: 1 },
          },
        };
      });
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, errorDecorations);
  }, [activeContent, activeFile]);


  // Auto-snapshot active file (infinite history, IndexedDB)
  useEffect(() => {
    if (!activeProject || !activeFile || !activeContent) return;
    const t = setTimeout(() => {
      void snapshotIfChanged({
        scope: "asher",
        projectId: activeProject.id,
        fileId: activeFile.id,
        filePath: activeFile.path,
        content: activeContent,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [activeContent, activeFile, activeProject]);

  // Pain Point #6/#12: 30s autosave loop + crash-recovery check on project open.
  useEffect(() => {
    if (!activeProject) return;
    const sid = `asher::${activeProject.id}`;
    // Recovery check: only prompt if snapshot newer than 60s and we haven't shown yet
    const snap = readAutoSave(sid);
    const age = getAutoSaveAge(sid);
    if (snap && age != null && age < 24 * 3600_000 && snap.files.length > 0) {
      setRecoverySnap(snap); setRecoveryAge(age); setRecoveryOpen(true);
    }
    const dispose = startAutoSaveLoop(sid, () => ({
      files: files.map(f => ({ id: f.id, path: f.path, content: dirty[f.id] ?? f.content, language: f.language })),
      activeFileId,
      savedAt: Date.now(),
    }));
    return dispose;
  }, [activeProject?.id]);


  // Scaffold from natural-language template launcher
  async function handleScaffold(result: { kind: string; name: string; files: { path: string; content: string; language: string }[]; primary: string }) {
    if (!activeProject) return;
    const ok = await new Promise<boolean>(resolve => setApproval({
      title: `${result.kind} ${result.name}`,
      changes: result.files.map(f => ({ path: f.path, action: "create" as const, content: f.content, language: f.language })),
      resolve,
    }));
    if (!ok) return;
    for (const f of result.files) {
      const { data } = await supabase.from("asher_code_files")
        .insert({ project_id: activeProject.id, branch_id: activeBranchId, path: f.path, content: f.content, language: f.language }).select().single();
      if (data) {
        const af = data as AsherCodeFile;
        setFiles(fs => [...fs, af]);
        if (f.path === result.primary) { setOpenTabs(t => [...t, af.id]); setActiveFileId(af.id); }
      }
    }
    toast.success(`Scaffolded ${result.files.length} file(s)`);
  }


  // Load projects on mount
  useEffect(() => { void loadProjects(); }, [user?.id]);

  async function loadProjects() {
    if (!user) return;
    const { data, error } = await supabase
      .from("asher_code_projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setProjects((data || []) as AsherCodeProject[]);
  }

  async function openProject(p: AsherCodeProject) {
    setActiveProject(p);
    const [filesRes, chatRes, brRes] = await Promise.all([
      supabase.from("asher_code_files").select("*").eq("project_id", p.id).is("branch_id", null).order("path"),
      supabase.from("asher_code_chat_messages").select("role,content").eq("project_id", p.id).order("created_at", { ascending: true }),
      supabase.from("asher_code_branches").select("id,name,parent_branch_id").eq("project_id", p.id).order("created_at"),
    ]);
    if (filesRes.error) { toast.error(filesRes.error.message); return; }
    const fs = (filesRes.data || []) as AsherCodeFile[];
    setFiles(fs);
    setOpenTabs(fs.length ? [fs[0].id] : []);
    setActiveFileId(fs[0]?.id || null);
    setDirty({});
    setActiveBranchId(null);
    setBranches((brRes.data as any[] | null) || []);
    if (chatRes.error) {
      setChat([]);
    } else {
      setChat(((chatRes.data as any[]) || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }

  async function switchBranch(branchId: string | null) {
    if (!activeProject) return;
    if (Object.keys(dirty).length && !confirm("You have unsaved changes. Switch branch and discard?")) return;
    let q = supabase.from("asher_code_files").select("*").eq("project_id", activeProject.id).order("path");
    q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const fs = (data || []) as AsherCodeFile[];
    setFiles(fs);
    setOpenTabs(fs.length ? [fs[0].id] : []);
    setActiveFileId(fs[0]?.id || null);
    setDirty({});
    setActiveBranchId(branchId);
  }

  async function createBranch() {
    if (!activeProject) return;
    const name = prompt("New branch name (e.g. feature/login)");
    if (!name) return;
    const { data: br, error } = await supabase.from("asher_code_branches")
      .insert({ project_id: activeProject.id, name, parent_branch_id: activeBranchId })
      .select().single();
    if (error || !br) { toast.error(error?.message || "branch failed"); return; }
    // Snapshot current branch's files into the new branch
    const snapshot = files.map(f => ({
      project_id: activeProject.id,
      branch_id: (br as any).id,
      path: f.path,
      content: dirty[f.id] ?? f.content,
      language: f.language,
    }));
    if (snapshot.length) {
      const { error: insErr } = await supabase.from("asher_code_files").insert(snapshot);
      if (insErr) { toast.error(insErr.message); return; }
    }
    setBranches(b => [...b, br as any]);
    toast.success(`Branch "${name}" created from ${activeBranchId ? branches.find(b => b.id === activeBranchId)?.name : "main"}`);
    await switchBranch((br as any).id);
  }

  async function persistZipEntriesToBranch(session: ZipImportSession, branchId: string | null, baseFiles: AsherCodeFile[]) {
    if (!activeProject) return { files: baseFiles, changedIds: [] as string[] };
    const nextByPath = new Map(baseFiles.map((file) => [file.path, file]));
    const changedIds: string[] = [];
    const importable = session.entries.filter((entry) => entry.action === "create" || entry.action === "overwrite");

    for (const entry of importable) {
      const existing = nextByPath.get(entry.path);
      if (existing && entry.action === "overwrite") {
        const { data, error } = await supabase
          .from("asher_code_files")
          .update({ content: entry.content, language: entry.language })
          .eq("id", existing.id)
          .select()
          .single();
        if (error || !data) throw new Error(error?.message || `Failed to overwrite ${entry.path}`);
        const updated = data as AsherCodeFile;
        nextByPath.set(entry.path, updated);
        changedIds.push(updated.id);
      } else if (!existing && entry.action === "create") {
        const { data, error } = await supabase
          .from("asher_code_files")
          .insert({ project_id: activeProject.id, branch_id: branchId, path: entry.path, content: entry.content, language: entry.language })
          .select()
          .single();
        if (error || !data) throw new Error(error?.message || `Failed to create ${entry.path}`);
        const created = data as AsherCodeFile;
        nextByPath.set(entry.path, created);
        changedIds.push(created.id);
      } else if (existing && entry.action === "create") {
        const { data, error } = await supabase
          .from("asher_code_files")
          .update({ content: entry.content, language: entry.language })
          .eq("id", existing.id)
          .select()
          .single();
        if (error || !data) throw new Error(error?.message || `Failed to update ${entry.path}`);
        const updated = data as AsherCodeFile;
        nextByPath.set(entry.path, updated);
        changedIds.push(updated.id);
      }
    }

    return {
      files: Array.from(nextByPath.values()).sort((a, b) => a.path.localeCompare(b.path)),
      changedIds,
    };
  }

  async function importZipToCurrentBranch() {
    if (!activeProject || !zipImportSession) return;
    const importable = zipImportSession.entries.filter((entry) => entry.action === "create" || entry.action === "overwrite");
    if (!importable.length) { toast.error("No files selected for import"); return; }
    const dirtyCollisions = importable.filter((entry) => {
      const existing = files.find((file) => file.path === entry.path);
      return existing && existing.id in dirty;
    });
    if (dirtyCollisions.length && !confirm(`${dirtyCollisions.length} unsaved file(s) will be overwritten by the ZIP import. Continue?`)) return;
    setZipImporting(true);
    try {
      const result = await persistZipEntriesToBranch(zipImportSession, activeBranchId, files);
      setFiles(result.files);
      setDirty((current) => {
        const next = { ...current };
        for (const id of result.changedIds) delete next[id];
        return next;
      });
      if (result.changedIds.length) {
        setOpenTabs((tabs) => Array.from(new Set([...tabs, result.changedIds[0]])));
        setActiveFileId(result.changedIds[0]);
      }
      setPreviewKey((key) => key + 1);
      setZipImportSession(null);
      const branchName = activeBranchId ? branches.find((branch) => branch.id === activeBranchId)?.name || "branch" : "main";
      toast.success(`Imported ${result.changedIds.length} file${result.changedIds.length === 1 ? "" : "s"} into ${branchName}`);
    } catch (err: any) {
      toast.error(err?.message || "ZIP import failed");
    } finally {
      setZipImporting(false);
    }
  }

  async function importZipToNewBranch() {
    if (!activeProject || !zipImportSession) return;
    const importable = zipImportSession.entries.filter((entry) => entry.action === "create" || entry.action === "overwrite");
    if (!importable.length) { toast.error("No files selected for import"); return; }
    const archiveStem = zipImportSession.archiveName.replace(/\.zip$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "archive";
    const name = prompt("New branch name for this ZIP import", `import/${archiveStem}`)?.trim();
    if (!name) return;
    if (!isValidBranchName(name)) {
      toast.error("Branch names can use letters, numbers, dots, dashes, underscores, and slashes only");
      return;
    }
    setZipImporting(true);
    try {
      const { data: br, error } = await supabase
        .from("asher_code_branches")
        .insert({ project_id: activeProject.id, name, parent_branch_id: activeBranchId })
        .select()
        .single();
      if (error || !br) throw new Error(error?.message || "Branch creation failed");
      const branchId = (br as any).id as string;
      const snapshot = files.map((file) => ({
        project_id: activeProject.id,
        branch_id: branchId,
        path: file.path,
        content: dirty[file.id] ?? file.content,
        language: file.language,
      }));
      let branchFiles: AsherCodeFile[] = [];
      if (snapshot.length) {
        const { data, error: snapshotError } = await supabase
          .from("asher_code_files")
          .insert(snapshot)
          .select();
        if (snapshotError) throw new Error(snapshotError.message);
        branchFiles = (data || []) as AsherCodeFile[];
      }
      const result = await persistZipEntriesToBranch(zipImportSession, branchId, branchFiles);
      setBranches((current) => [...current, br as any]);
      setFiles(result.files);
      setDirty({});
      setActiveBranchId(branchId);
      setOpenTabs(result.changedIds.length ? [result.changedIds[0]] : result.files[0]?.id ? [result.files[0].id] : []);
      setActiveFileId(result.changedIds[0] || result.files[0]?.id || null);
      setPreviewKey((key) => key + 1);
      setZipImportSession(null);
      toast.success(`Created ${name} and imported ${result.changedIds.length} file${result.changedIds.length === 1 ? "" : "s"}`);
    } catch (err: any) {
      toast.error(err?.message || "ZIP branch import failed");
    } finally {
      setZipImporting(false);
    }
  }

  async function deleteBranch(id: string) {
    if (!confirm("Delete this branch and all its files?")) return;
    const { error } = await supabase.from("asher_code_branches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setBranches(b => b.filter(x => x.id !== id));
    if (activeBranchId === id) await switchBranch(null);
  }

  async function downloadProjectZip() {
    if (!activeProject) return;
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.path, dirty[f.id] ?? f.content);
    }
    const branchName = activeBranchId ? branches.find(b => b.id === activeBranchId)?.name || "branch" : "main";
    const safeBranch = branchName.replace(/[^a-z0-9._-]/gi, "_");
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.name}-${safeBranch}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${a.download}`);
  }


  async function persistChatMessages(msgs: ChatMsg[]) {
    if (!user || !activeProject || msgs.length === 0) return;
    const rows = msgs.map((m) => ({ project_id: activeProject.id, owner_id: user.id, role: m.role, content: m.content }));
    const { error } = await supabase.from("asher_code_chat_messages").insert(rows);
    if (error) console.warn("[asher-code] chat persist failed:", error.message);
  }


  async function createProject(name: string) {
    if (!user) return;
    const { data: proj, error } = await supabase
      .from("asher_code_projects")
      .insert({ owner_id: user.id, name, template: "blank", language: "html" })
      .select().single();
    if (error || !proj) { toast.error(error?.message || "create failed"); return; }
    // Seed with a single neutral entry file. The AI adapts to whatever the user
    // asks for next — vanilla HTML, React via CDN, automation script, etc.
    const seed = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${name}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background:#0a0a0a; color:#e5e5e5; margin:0; padding:2rem; }
    .hint { opacity:.6; font-size:13px; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <p class="hint">Tell Asherin Code what to build — it adapts to any stack.</p>
  <script>
    // Your code starts here.
  </script>
</body>
</html>`;
    const { error: fErr } = await supabase
      .from("asher_code_files")
      .insert({ project_id: proj.id, path: "index.html", content: seed, language: "html" });
    if (fErr) toast.error(fErr.message);
    setShowNewProject(false);
    await loadProjects();
    await openProject(proj as AsherCodeProject);
    toast.success("Project created");
  }

  async function deleteProject(p: AsherCodeProject) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    // Phase 5: Purge local IndexedDB checkpoints + autosave snapshots first so
    // a freshly deleted project never resurrects from a stale local cache.
    try {
      const { listCheckpoints, deleteCheckpoint } = await import("@/lib/ide/checkpoints");
      const { clearAutoSave } = await import("@/lib/ide/autoSave");
      const ckpts = await listCheckpoints("asher", p.id);
      await Promise.all(ckpts.map(c => c.id ? deleteCheckpoint(c.id) : Promise.resolve()));
      clearAutoSave(p.id);
    } catch (e) {
      console.warn("[asher-code] local cleanup failed", e);
    }
    const { error } = await supabase.from("asher_code_projects").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    if (activeProject?.id === p.id) { setActiveProject(null); setFiles([]); setOpenTabs([]); setActiveFileId(null); }
    await loadProjects();
  }

  async function saveActive() {
    if (!activeFile || !(activeFile.id in dirty)) return;
    const newContent = dirty[activeFile.id];
    const { error } = await supabase
      .from("asher_code_files")
      .update({ content: newContent })
      .eq("id", activeFile.id);
    if (error) { toast.error(error.message); return; }
    setFiles(fs => fs.map(f => f.id === activeFile.id ? { ...f, content: newContent } : f));
    setDirty(d => { const n = { ...d }; delete n[activeFile.id]; return n; });
    toast.success("Saved");
  }

  async function saveAll() {
    const updates = Object.entries(dirty);
    if (!updates.length) return;
    for (const [id, content] of updates) {
      await supabase.from("asher_code_files").update({ content }).eq("id", id);
    }
    setFiles(fs => fs.map(f => f.id in dirty ? { ...f, content: dirty[f.id] } : f));
    setDirty({});
    toast.success(`Saved ${updates.length} file${updates.length > 1 ? "s" : ""}`);
  }

  async function addFile() {
    if (!activeProject) return;
    const path = prompt("File path (e.g. utils.js)");
    if (!path) return;
    const ext = path.split(".").pop() || "";
    const lang = ({ js:"javascript", ts:"typescript", tsx:"typescript", jsx:"javascript", py:"python", html:"html", css:"css", json:"json", md:"markdown" } as any)[ext] || "plaintext";
    const { data, error } = await supabase
      .from("asher_code_files")
      .insert({ project_id: activeProject.id, branch_id: activeBranchId, path, content: "", language: lang })
      .select().single();
    if (error || !data) { toast.error(error?.message || "create failed"); return; }
    const f = data as AsherCodeFile;
    setFiles(fs => [...fs, f]);
    setOpenTabs(t => [...t, f.id]);
    setActiveFileId(f.id);
  }

  async function removeFile(id: string) {
    if (!confirm("Delete this file?")) return;
    const { error } = await supabase.from("asher_code_files").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFiles(fs => fs.filter(f => f.id !== id));
    setOpenTabs(t => t.filter(x => x !== id));
    if (activeFileId === id) setActiveFileId(openTabs.find(x => x !== id) || null);
  }

  // Build live preview srcdoc — concatenates HTML/JS/CSS files. If no index.html
  // exists, auto-synthesizes one from CSS + JS/JSX/TSX so ZANOEM-generated projects
  // still render in the preview pane.
  const previewSrcDoc = useMemo(() => {
    // Strip ES module imports/exports (Babel standalone can't resolve them in-browser).
    // Also collect default-exported component names so we can auto-mount the last one.
    const stripModuleSyntax = (src: string): { code: string; defaultExport: string | null; namedComponents: string[] } => {
      let code = src;
      // Remove all `import ... from "..."` and bare `import "..."` lines
      code = code.replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
      code = code.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");
      // Capture `export default <Name>;` or `export default function <Name>` or `export default class <Name>`
      let defaultExport: string | null = null;
      const defFnMatch = code.match(/export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/);
      const defClassMatch = code.match(/export\s+default\s+class\s+([A-Z][A-Za-z0-9_]*)/);
      const defIdentMatch = code.match(/export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/);
      if (defFnMatch) defaultExport = defFnMatch[1];
      else if (defClassMatch) defaultExport = defClassMatch[1];
      else if (defIdentMatch) defaultExport = defIdentMatch[1];
      // Strip the export keywords (leave the declarations intact in global scope)
      code = code.replace(/export\s+default\s+function\s+/g, "function ");
      code = code.replace(/export\s+default\s+class\s+/g, "class ");
      code = code.replace(/export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/g, "");
      code = code.replace(/export\s+(const|let|var|function|class)\s+/g, "$1 ");
      code = code.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, "");
      // Capture top-level component declarations as fallback mount targets
      // (function, const, let, var, class — all PascalCase identifiers).
      const namedComponents: string[] = [];
      const rxFn = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g;
      let m: RegExpExecArray | null;
      while ((m = rxFn.exec(code)) !== null) namedComponents.push(m[1]);
      // Also scan original source (before stripping) so we still find names even
      // if the export-default rewrite ate the declaration prefix.
      const rxSrc = /(?:^|\n)\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g;
      while ((m = rxSrc.exec(src)) !== null) if (!namedComponents.includes(m[1])) namedComponents.push(m[1]);
      // Babel/eval may keep `const`, `let`, and `class` declarations lexical instead of
      // exposing them on window. Rewrite component declarations so preview auto-mount can
      // resolve them even when the source never manually assigns window.AnalyticsPage.
      for (const name of namedComponents) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        code = code.replace(new RegExp(`(^|\\n)(\\s*)(async\\s+)?function\\s+${esc}\\s*\\(`, "g"), `$1$2var ${name} = window.${name} = $3function ${name}(`);
        code = code.replace(new RegExp(`(^|\\n)(\\s*)class\\s+${esc}(\\s+extends\\s+)`, "g"), `$1$2var ${name} = window.${name} = class ${name}$3`);
        code = code.replace(new RegExp(`(^|\\n)(\\s*)class\\s+${esc}(\\s*[{])`, "g"), `$1$2var ${name} = window.${name} = class ${name}$3`);
        code = code.replace(new RegExp(`(^|\\n)(\\s*)(?:const|let|var)\\s+${esc}(?:\\s*:[^=]+)?\\s*=`, "g"), `$1$2var ${name} = window.${name} =`);
      }
      return { code, defaultExport, namedComponents };
    };

    const compileScriptTag = (path: string, source: string) => {
      const { code, defaultExport, namedComponents } = stripModuleSyntax(source);
      const filename = path.replace(/"/g, "&quot;");
      const globals = Array.from(new Set([defaultExport, ...namedComponents].filter(Boolean)))
        .map((name) => `try{if(typeof ${name}!=="undefined")window.${name}=${name};}catch(e){}`)
        .join("\n");
      return `<script type="application/x-asher-source" data-filename="${filename}">\n${`${code}\n${globals}`.replace(/<\/script/gi, "<\\/script")}\n</script>`;
    };

    const sourceRunner = `<script>
(function(){
  function showPreviewError(label, err){
    var msg = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
    var pre = document.createElement('pre');
    pre.style.cssText='color:#f88;background:#1a0a0a;font-family:ui-monospace,monospace;padding:1rem;white-space:pre-wrap;font-size:12px;margin:0';
    pre.textContent=label + ': ' + msg;
    document.body.appendChild(pre);
  }
  try {
    if (!window.Babel) { showPreviewError('Preview compiler missing', 'Babel runtime did not load'); return; }
    var nodes = document.querySelectorAll('script[type="application/x-asher-source"]');
    Array.prototype.forEach.call(nodes, function(node){
      var filename = node.getAttribute('data-filename') || 'preview.tsx';
      try {
        var compiled = Babel.transform(node.textContent || '', {
          filename: filename,
          sourceType: 'script',
          presets: [['env', { modules: false }], ['react', { runtime: 'classic' }], ['typescript', { allExtensions: true, isTSX: true }]]
        }).code;
        (0, eval)(compiled + '\n//# sourceURL=' + filename);
      } catch (e) { showPreviewError('Preview compile/runtime error in ' + filename, e); }
    });
  } catch(e) { showPreviewError('Preview runner error', e); }
})();
</script>`;

    const html = files.find(f => f.path.endsWith("index.html"));
    if (html) {
      let content = (dirty[html.id] ?? html.content);
      let needsHtmlCompiler = false;
      let needsHtmlReact = false;
      for (const f of files) {
        if (f.id === html.id) continue;
        const c = dirty[f.id] ?? f.content;
        if (/\.(tsx?|jsx?|mjs)$/.test(f.path)) {
          const compiled = compileScriptTag(f.path, c);
          const escapedPath = f.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const scriptRef = new RegExp(`<script([^>]*)src=["'](?:\\./|/)?${escapedPath}["']([^>]*)><\\/script>`, "g");
          if (scriptRef.test(content)) {
            content = content.replace(scriptRef, () => compiled);
            needsHtmlCompiler = true;
            if (/\.(tsx|jsx|js)$/.test(f.path) || /from ['"]react['"]/.test(c) || /React/.test(c)) needsHtmlReact = true;
          }
        }
        content = content.replace(`<link rel="stylesheet" href="${f.path}">`, `<style>${c}</style>`);
      }
      if (needsHtmlCompiler && !/babel\.min\.js/.test(content)) {
        const runtime = `${needsHtmlReact ? `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script>try{var R=window.React||{};['useState','useEffect','useRef','useMemo','useCallback','useContext','useReducer','useLayoutEffect','createContext','forwardRef','memo','Fragment','Suspense','lazy','createElement'].forEach(function(k){if(R[k]&&typeof window[k]==='undefined')window[k]=R[k];});if(window.ReactDOM&&typeof window.createRoot==='undefined')window.createRoot=window.ReactDOM.createRoot;}catch(e){}</script>` : ""}<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`;
        content = content.includes("</head>") ? content.replace("</head>", `${runtime}</head>`) : runtime + content;
      }
      if (needsHtmlCompiler) {
        content = content.includes("</body>") ? content.replace("</body>", `${sourceRunner}</body>`) : content + sourceRunner;
      }
      return content;
    }
    // Auto-synth path
    const css = files.filter(f => f.path.endsWith(".css")).map(f => dirty[f.id] ?? f.content).join("\n");
    const jsxFiles = files.filter(f => /\.(jsx|tsx)$/.test(f.path));
    const jsFiles = files.filter(f => /\.(m?js|ts)$/.test(f.path) && !/\.(jsx|tsx)$/.test(f.path));
    const hasReact = jsxFiles.length > 0 || files.some(f => /from ['"]react['"]/.test(dirty[f.id] ?? f.content));
    if (jsxFiles.length === 0 && jsFiles.length === 0 && css.length === 0) {
      return `<html><body style="background:#0a0a0a;color:#888;font-family:monospace;padding:2rem">No <code>index.html</code> in this project — and no JS/CSS to auto-render.</body></html>`;
    }
    let mountTarget: string | null = null;
    const jsxBlocks = jsxFiles.map(f => {
      const raw = dirty[f.id] ?? f.content;
      const { defaultExport, namedComponents } = stripModuleSyntax(raw);
      if (defaultExport) mountTarget = defaultExport;
      else if (namedComponents.length) mountTarget = namedComponents[namedComponents.length - 1];
      return compileScriptTag(f.path, raw);
    }).join("\n");
    const jsBlocks = jsFiles.map(f => compileScriptTag(f.path, dirty[f.id] ?? f.content)).join("\n");
    // Detect whether the user already mounts something (ReactDOM.render / createRoot).
    const userMountsItself = jsxFiles.concat(jsFiles).some(f => {
      const c = dirty[f.id] ?? f.content;
      return /ReactDOM\.render\s*\(/.test(c) || /createRoot\s*\([^)]*\)\s*\.render\s*\(/.test(c);
    });
    const autoMount = (hasReact && mountTarget && !userMountsItself)
      ? `<script>
(function(){
  function __appendErr(msg){
    try {
      var pre = document.createElement('pre');
      pre.style.cssText='color:#f88;background:#1a0a0a;font-family:ui-monospace,monospace;padding:1rem;white-space:pre-wrap;font-size:12px;margin:0;border-top:1px solid #400';
      pre.textContent = msg;
      (document.body || document.documentElement).appendChild(pre);
    } catch(_e) {}
  }
  function __report(kind, why, message){
    // Silent path → parent listener enqueues an autofix job (no popup).
    try { parent.postMessage({ __asherPreviewErrorSilent: true, kind: kind, why: why, message: message, source: 'auto-mount' }, '*'); } catch(e) {}
  }
  try {
    var __el = document.getElementById('root') || document.getElementById('app');
    function __resolveComponent(){
      if (window.${mountTarget}) return window.${mountTarget};
      try { if (typeof ${mountTarget} !== 'undefined') return ${mountTarget}; } catch(e){}
      var keys = Object.keys(window).filter(function(k){
        if (!/^[A-Z][A-Za-z0-9_]*$/.test(k)) return false;
        var v = window[k];
        if (typeof v !== 'function') return false;
        if (['React','ReactDOM','Babel','Object','Array','String','Number','Boolean','Function','Error','Date','RegExp','Map','Set','Promise','Symbol','Proxy','Reflect','JSON','Math','URL','URLSearchParams','FormData','Blob','File','FileReader','Image','Audio','Video','Worker','WebSocket','XMLHttpRequest','Event','CustomEvent','Element','HTMLElement','Node','Document','Window','Navigator','Location','History','Storage','Performance','PerformanceObserver','MutationObserver','IntersectionObserver','ResizeObserver','AbortController','AbortSignal','TextEncoder','TextDecoder','Intl','BigInt','WeakMap','WeakSet','DataView','ArrayBuffer','Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array','SharedArrayBuffer','Atomics','Crypto','SubtleCrypto','CryptoKey','Headers','Request','Response','ReadableStream','WritableStream','TransformStream','Fragment','Suspense'].indexOf(k) !== -1) return false;
        return true;
      });
      return keys.length ? window[keys[keys.length-1]] : null;
    }
    var __Comp = __resolveComponent();
    if (__el && __Comp) {
      try {
        if (ReactDOM.createRoot) { ReactDOM.createRoot(__el).render(React.createElement(__Comp)); }
        else { ReactDOM.render(React.createElement(__Comp), __el); }
      } catch (renderErr) {
        __appendErr('Auto-mount render error: ' + (renderErr && renderErr.stack || renderErr && renderErr.message || String(renderErr)));
        __report('Render Error', 'Component "${mountTarget}" threw while rendering. Fix the runtime error inside its function body.', (renderErr && renderErr.message) || String(renderErr));
      }
    } else if (!__el) {
      __appendErr('Auto-mount failed: no #root or #app element.');
      __report('Missing Mount', 'index.html has no <div id="root"> or <div id="app">. Add one.', 'no #root or #app element');
    } else {
      var declared = Object.keys(window).filter(function(k){return /^[A-Z][A-Za-z0-9_]*$/.test(k) && typeof window[k]==="function";}).slice(0,20).join(", ");
      var body = 'Auto-mount failed: component "${mountTarget}" is not defined at runtime.\\n\\nDeclared globals: ' + declared + '\\n\\nMost likely a compile/runtime error above prevented "${mountTarget}" from being registered. Scroll up for the real error, or Auto-Debug will patch it now.';
      __appendErr(body);
      __report('Component Undefined', 'The mount target "${mountTarget}" never reached window scope. Usually caused by a Babel compile error, a TypeScript syntax the classic-runtime preset rejects, or a reference to an unresolved import stripped by the module-syntax remover.', '${mountTarget} is not defined at runtime');
    }
  } catch (e) {
    __appendErr('Auto-mount error: ' + (e && e.message ? e.message : String(e)));
    __report('Auto-Mount Exception', 'The auto-mount bootstrap itself threw.', (e && e.message) || String(e));
  }
})();
</script>`
      : (hasReact && !userMountsItself
        ? `<script>(function(){var p=document.createElement('pre');p.style.cssText='color:#888;font-family:monospace;padding:1rem;margin:0';p.textContent='No default export or top-level component detected. Add "export default MyComponent" to render in preview.';document.body.appendChild(p);try{parent.postMessage({__asherPreviewErrorSilent:true,kind:'No Entry Component',why:'Preview needs a default export or a top-level PascalCase component to auto-mount.',message:'no default export found',source:'auto-mount'},'*');}catch(e){}})();</script>`
        : "");
    const needsBabel = hasReact || jsxFiles.length > 0 || jsFiles.length > 0;
    const reactCdn = hasReact
      ? `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`
      : (needsBabel ? `<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>` : "");
    // Shim: expose React hooks + common Next.js / framework imports as globals so that
    // stripped `import { useState } from 'react'` / `import { useRouter } from 'next/router'`
    // statements don't leave undefined identifiers behind. Also captures any Babel compile
    // errors and surfaces them inside the iframe body (otherwise they're silently swallowed
    // by the iframe console and the user sees only a white screen).
    const shim = hasReact ? `<script>
(function(){
  try {
    var R = window.React || {};
    ['useState','useEffect','useRef','useMemo','useCallback','useContext','useReducer','useLayoutEffect','createContext','forwardRef','memo','Fragment','Suspense','lazy','createElement'].forEach(function(k){ if (R[k] && typeof window[k]==='undefined') window[k]=R[k]; });
    if (window.ReactDOM && typeof window.createRoot==='undefined') window.createRoot = window.ReactDOM.createRoot;
    // Next.js stubs
    if (typeof window.useRouter==='undefined') window.useRouter = function(){ return { push:function(){}, replace:function(){}, back:function(){}, query:{}, pathname:'/', asPath:'/' }; };
    if (typeof window.dynamic==='undefined') window.dynamic = function(loader){ return function(){ return null; }; };
    // react-hot-toast stub
    if (typeof window.toast==='undefined') { var t=function(m){ console.log('[toast]',m); }; t.success=t; t.error=t; t.loading=t; t.dismiss=function(){}; window.toast=t; }
    // Common auth context stub — overridden if user defines their own
    if (typeof window.useAuth==='undefined') window.useAuth = function(){ return { user:null, loading:false, signIn:function(){}, signOut:function(){} }; };
  } catch(e){}
})();
(function(){
  function classify(msg){
    msg = String(msg||'');
    if (/Unexpected token/i.test(msg)) return { kind:'Syntax Error', why:'The code could not be parsed. A bracket, quote, or punctuation is missing or out of place, so the script never starts.' };
    if (/is not defined|ReferenceError/i.test(msg)) return { kind:'Reference Error', why:'A variable or function is being used before it exists. Likely a missing import, a typo, or a hook/identifier that was not exposed to the preview.' };
    if (/Cannot read propert|undefined.*reading|null.*reading/i.test(msg)) return { kind:'Null/Undefined Access', why:'Code is reading a property from something that is null or undefined. Add a guard (?., default value) or fix the data source.' };
    if (/is not a function/i.test(msg)) return { kind:'Type Error', why:'The value being called is not a function. Check the import path, default vs named export, or the order of declarations.' };
    if (/Failed to fetch|NetworkError|CORS/i.test(msg)) return { kind:'Network Error', why:'A request failed (network, CORS, or sandbox restriction). The preview iframe sandbox blocks most external calls.' };
    if (/Maximum update depth|infinite/i.test(msg)) return { kind:'Infinite Loop', why:'A component is updating state during render or in an effect without a stable dependency, causing an endless re-render cycle.' };
    return { kind:'Runtime Error', why:'The script crashed at runtime. Open the popup for the full stack trace and ship it to the Bug Doctor.' };
  }
  function showPopup(msg, src){
    var info = classify(msg);
    var existing = document.getElementById('__asher_err_pop'); if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = '__asher_err_pop';
    wrap.style.cssText='position:fixed;left:12px;bottom:12px;max-width:520px;z-index:2147483647;background:#1a0a0a;border:1px solid #ef4444;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:ui-monospace,SFMono-Regular,monospace;color:#fecaca;font-size:12px;overflow:hidden';
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#2a0d0d;border-bottom:1px solid #ef444466"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;box-shadow:0 0 8px #ef4444"></span><strong style="color:#fca5a5">'+info.kind+'</strong></div><div><button id="__asher_err_dbg" style="background:#7f1d1d;color:#fff;border:0;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;margin-right:6px">Send to Bug Doctor</button><button id="__asher_err_x" style="background:transparent;color:#fca5a5;border:0;cursor:pointer;font-size:14px">×</button></div></div><div style="padding:10px"><div style="color:#fecaca;margin-bottom:6px;line-height:1.4">'+info.why+'</div><pre style="margin:0;padding:8px;background:#0f0505;border:1px solid #ef444433;border-radius:6px;white-space:pre-wrap;max-height:180px;overflow:auto;color:#fca5a5">'+(msg.replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];}))+'</pre>'+(src?'<div style="margin-top:6px;color:#fda4af;opacity:.8;font-size:11px">'+src+'</div>':'')+'</div>';
    document.body.appendChild(wrap);
    document.getElementById('__asher_err_x').onclick = function(){ wrap.remove(); };
    document.getElementById('__asher_err_dbg').onclick = function(){
      try { parent.postMessage({ __asherPreviewError: true, kind: info.kind, why: info.why, message: msg, source: src }, '*'); } catch(e){}
      wrap.remove();
    };
    // Auto-feed silently as well so the debugger always has the latest error context
    try { parent.postMessage({ __asherPreviewErrorSilent: true, kind: info.kind, why: info.why, message: msg, source: src }, '*'); } catch(e){}
  }
  window.addEventListener('error', function(ev){
    var msg = (ev && ev.error && ev.error.stack) ? ev.error.stack : (ev && ev.message ? ev.message : String(ev));
    var src = ev && ev.filename ? (ev.filename+':'+(ev.lineno||'?')+':'+(ev.colno||'?')) : '';
    showPopup(msg, src);
  });
  window.addEventListener('unhandledrejection', function(ev){
    var r = ev && ev.reason; var msg = (r && r.stack) ? r.stack : (r && r.message ? r.message : String(r));
    showPopup('Unhandled promise rejection: '+msg, '');
  });
})();
</script>` : "";
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title>${reactCdn}${shim}<style>${css}</style></head><body><div id="root"></div><div id="app"></div>${jsxBlocks}${jsBlocks}${sourceRunner}${autoMount}</body></html>`;
  }, [files, dirty]);

  function runPreview() { setPreviewKey(k => k + 1); }

  // ── AI actions ────────────────────────────────────────────────
  function byok() {
    return apiKey ? { provider, model, apiKey } : { provider, model };
  }

  async function sendChat() {
    if ((!chatInput.trim() && pendingUploads.length === 0) || aiBusy) return;
    if (zanoemMode) return sendChatViaZanoem();

    // ── GOAL ROUTER ────────────────────────────────────────────
    // Before treating this as a normal chat turn, classify the prompt.
    // High-level commands like "finish building this product" or
    // "fix every bug" auto-dispatch to the swarm / ZANOEM autopilot
    // — the user does NOT need to be on a specific file.
    const goal = routeGoal(chatInput);
    // Auto-approved plan strip — visible immediately so the user sees
    // exactly what the agent is about to do, with checkmarks ticking.
    startPlan(chatInput, goal.intent, { activeFileName: activeFile?.path, projectName: activeProject?.name });
    if (goal.intent === "swarm_fix" && chatInput.trim()) {
      if (!activeProject) {
        toast.error("Open a project first so the swarm has something to scan");
      } else {
        const userMsg: ChatMsg = { role: "user", content: chatInput };
        const ackMsg: ChatMsg = {
          role: "assistant",
          content: `◈ **Swarm dispatched.** Scanning every file in **${activeProject.name}** for bugs, validator errors, and broken logic. Watch the chip strip below — one agent per broken file, all in parallel. I'll re-engage until the codebase is clean.`,
        };
        setChat([...chat, userMsg, ackMsg]);
        setChatInput("");
        setPendingUploads([]);
        void persistChatMessages([userMsg, ackMsg]);
        if (!autoDebug) setAutoDebug(true);
        autoDebugRef.current = true;
        setFixBugsPending(true);
        window.setTimeout(() => { setFixBugsPending(false); completePlan(); }, 12000);
        toast.message("◈ Goal Router → Swarm Fix", { description: goal.reason });
        void zqEnqueue({
          kind: "autofix",
          payload: { projectRef: activeProject.id },
          surface: "asher_ide",
          projectRef: activeProject.id,
          ownerUserId: user?.id,
        });
        return;
      }
    }
    if (goal.intent === "build_all" && chatInput.trim()) {
      if (!activeProject) {
        toast.error("Open a project first so I have somewhere to build");
      } else {
        toast.message("◈ Goal Router → Build All", { description: goal.reason });
        // Force ZANOEM autopilot ON for the duration of this build, then
        // hand the goal to the ZANOEM dispatcher which already knows how
        // to invent / extend / file-by-file write code from a single prompt.
        if (!zanoemMode) setZanoemMode(true);
        if (!autopilotZanoem) { setAutopilotZanoem(true); autopilotZanoemRef.current = true; }
        // Reset the autopilot round counter so this build gets the full budget.
        autopilotRoundsRef.current = 0;
        const enriched = `${chatInput}\n\n[GOAL ROUTER DIRECTIVE]\nThis is a project-wide build request. Plan the complete file tree, then write each file in turn. Do not stop until every file in the plan is written and the build is shippable. After each file, list what's still missing and continue automatically.\n\n${IDE_BUILD_CONTRACT}`;
        // Defer one tick so the zanoemMode state flush lands before dispatch.
        setTimeout(() => { void sendChatViaZanoem(enriched, false); }, 50);
        return;
      }
    }
    // edit_file and chat fall through to the normal path below.

    // Compose attachments into the user message
    let composed = chatInput;
    const imageAttachments: { name: string; dataUrl: string }[] = [];
    for (const u of pendingUploads) {
      if (u.kind === "image") {
        imageAttachments.push({ name: u.name, dataUrl: u.preview! });
        composed += `\n\n[Attached image: ${u.name}]`;
      } else if (u.kind === "zip") {
        composed += `\n\n=== ZIP CONTENTS (${u.name}) ===\n${u.content}`;
      } else {
        composed += `\n\n=== FILE (${u.name}) ===\n${u.content}`;
      }
    }
    const userMsg: ChatMsg = { role: "user", content: composed };
    const next = [...chat, userMsg];
    setChat(next);
    setChatInput("");
    setPendingUploads([]);
    setAiBusy(true);
    try {
      const ctx = activeFile ? [{ path: activeFile.path, content: activeContent }] : [];
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({ mode: "chat", byok: byok(), messages: next, contextFiles: ctx, images: imageAttachments, ...aureon } as any);
      const assistantMsg: ChatMsg = { role: "assistant", content: r.reply || "" };
      setChat([...next, assistantMsg]);
      void persistChatMessages([userMsg, assistantMsg]);
    } catch (e: any) {
      const errMsg: ChatMsg = { role: "assistant", content: "**Error:** " + (e.message || "AI call failed") };
      setChat([...next, errMsg]);
      void persistChatMessages([userMsg, errMsg]);
    } finally { setAiBusy(false); completePlan(); }
  }

  // Decision detection / autopilot reply now live in src/lib/zanoem/decisionLog.ts.
  const needsHumanDecision = zanoemNeedsDecision;
  const buildAutopilotReply = zanoemBuildReply;
  // Track the assistant text that triggered the current autopilot turn (used when logging the decision row).
  const autopilotTriggerRef = useRef<string>("");

  // ── ZANOEM Mode: First-Principles Software Architect ──
  // Routes chat through zali-chat (Gemini, no BYOK required) for inventing
  // brand-new software from first principles. Auto-extracts ``` code blocks
  // tagged with file paths and writes them into the project as new files.
  async function sendChatViaZanoem(overrideContent?: string, isAutopilotTurn = false) {
    if (!activeProject || !user) { toast.error("Open a project first"); return; }
    let composed = overrideContent ?? chatInput;
    if (!isAutopilotTurn) {
      for (const u of pendingUploads) {
        if (u.kind === "zip") composed += `\n\n=== ZIP CONTENTS (${u.name}) ===\n${u.content}`;
        else if (u.kind === "text") composed += `\n\n=== FILE (${u.name}) ===\n${u.content}`;
      }
    }
    const userMsg: ChatMsg = { role: "user", content: composed };
    const next = [...chat, userMsg];
    setChat(next);
    if (!isAutopilotTurn) { setChatInput(""); setPendingUploads([]); }
    if (!isAutopilotTurn) autopilotRoundsRef.current = 0;
    // Auto-approved plan strip — surface immediately for ZANOEM turns too
    if (!isAutopilotTurn && !activePlan) {
      const goal = routeGoal(composed);
      startPlan(composed, goal.intent === "chat" ? "build_all" : goal.intent, { activeFileName: activeFile?.path, projectName: activeProject?.name });
    }
    setAiBusy(true);
    let assistantText = "";
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zali-chat`;
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          mode: "design",
          projectContext: {
            name: activeProject.name,
            description: activeProject.description || "Software project in Asherin Code IDE",
            designType: "software",
            phase: "Architecture & Implementation",
          },
        }),
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(`ZANOEM gateway ${resp.status}: ${t.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // Push placeholder so UI updates as we stream
      setChat((prev) => [...prev, { role: "assistant", content: "▍" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setChat((prev) => {
                if (!prev.length) return prev;
                const head = prev.slice(0, -1);
                return [...head, { role: "assistant", content: assistantText + "▍" }];
              });
            }
          } catch { /* skip */ }
        }
      }
      const finalMsg: ChatMsg = { role: "assistant", content: assistantText || "(empty response)" };
      setChat((prev) => {
        if (!prev.length) return [finalMsg];
        const head = prev.slice(0, -1);
        return [...head, finalMsg];
      });
      void persistChatMessages([userMsg, finalMsg]);
      // Auto-write any code blocks tagged with file paths into the project
      const created = await materializeZanoemCodeBlocks(assistantText);
      if (created > 0) toast.success(`ZANOEM created ${created} file${created === 1 ? "" : "s"}`);
      // Track latest "intent" + assistant text so the offline vision worker
      // can verify the rendered UI even if the user closes the tab.
      if (!isAutopilotTurn) lastIntentRef.current = composed;
      lastAssistantRef.current = assistantText;
      // ── AUTOPILOT: log this turn's decision (if we're inside one) ──
      // If THIS response is the answer to the previous autopilot question,
      // record what was asked + what ZANOEM picked.
      if (isAutopilotTurn && autopilotTriggerRef.current) {
        void zanoemLogDecision({
          surface: "asher_ide",
          projectRef: activeProject.id,
          conversationRef: activeProject.id,
          round: autopilotRoundsRef.current,
          triggerText: autopilotTriggerRef.current,
          replySent: composed,
          responseText: assistantText,
        });
        autopilotTriggerRef.current = "";
      }
      // ── AUTOPILOT: continue when ZANOEM asks a question OR when its
      // STATUS sentinel says REFINING (ZAHTEN-style completion loop).
      const buildStatus = parseIdeBuildStatus(assistantText);
      const shouldContinue =
        autopilotZanoem &&
        autopilotRoundsRef.current < AUTOPILOT_MAX_ROUNDS &&
        (needsHumanDecision(assistantText) || buildStatus === "refining");
      if (shouldContinue) {
        autopilotRoundsRef.current += 1;
        autopilotTriggerRef.current = assistantText;
        const autoReply = buildStatus === "refining"
          ? buildCritiqueContinuationReply(autopilotRoundsRef.current, AUTOPILOT_MAX_ROUNDS)
          : buildAutopilotReply(autopilotRoundsRef.current, AUTOPILOT_MAX_ROUNDS);
        setAiBusy(false);
        setTimeout(() => { void sendChatViaZanoem(autoReply, true); }, 350);
        return;
      }
      if (isAutopilotTurn && buildStatus !== "refining" && !needsHumanDecision(assistantText)) {
        toast.success(`ZANOEM autopilot complete (${autopilotRoundsRef.current} round${autopilotRoundsRef.current === 1 ? "" : "s"})`);
        autopilotRoundsRef.current = 0;
        autopilotTriggerRef.current = "";
      }
      // ── Autonomous: enqueue vision verify + auto-fix when this turn
      // produced concrete output (created files OR an autopilot finish).
      // Guarded so we don't recursively enqueue inside an active autopilot turn.
      if (autopilotZanoem && !autopilotEnqueueGuardRef.current && (created > 0 || (isAutopilotTurn && !needsHumanDecision(assistantText)))) {
        autopilotEnqueueGuardRef.current = true;
        try {
          if (created > 0) {
            await zqEnqueue({
              kind: "autofix",
              payload: { projectRef: activeProject.id },
              surface: "asher_ide",
              projectRef: activeProject.id,
              ownerUserId: user.id,
            });
          }
          await zqEnqueue({
            kind: "vision",
            payload: {
              intent: lastIntentRef.current || composed,
              recentAssistant: assistantText,
              projectRef: activeProject.id,
            },
            surface: "asher_ide",
            projectRef: activeProject.id,
            ownerUserId: user.id,
          });
        } finally {
          // Release a tick later so back-to-back enqueues from a single
          // autopilot chain only fire once.
          setTimeout(() => { autopilotEnqueueGuardRef.current = false; }, 2000);
        }
      }
      // ── HAND-OFF: when ZANOEM finishes a build round (files created and
      // no further human decision needed), auto-switch the chat into the
      // Asher IDE Coder (BYOK) so it can finish wiring + auto-debug.
      const autopilotStillActive = autopilotZanoem && (needsHumanDecision(assistantText) || buildStatus === "refining");
      const zanoemBuildFinished =
        created > 0 && !needsHumanDecision(assistantText) && !autopilotStillActive;
      if (zanoemBuildFinished && zanoemMode) {
        setZanoemMode(false);
        if (!autoDebug) setAutoDebug(true);
        const handoffMsg: ChatMsg = {
          role: "assistant",
          content:
            `**◈ Hand-off: ZANOEM → Asher IDE Coder**\n\n` +
            `ZANOEM finished scaffolding ${created} file${created === 1 ? "" : "s"}. ` +
            `Switching to the **Asher IDE Coder** (BYOK) to finish wiring, fix runtime bugs, and harden the build.\n\n` +
            (apiKey
              ? `Auto Debug is **ON** — runtime errors will be caught and patched automatically.`
              : `⚠ Add a BYOK key in **Settings → BYOK** so the Coder can take over.`),
        };
        setChat((prev) => [...prev, handoffMsg]);
        void persistChatMessages([handoffMsg]);
        toast.success("Hand-off → Asher IDE Coder");
        if (apiKey) {
          void zqEnqueue({
            kind: "autofix",
            payload: { projectRef: activeProject.id },
            surface: "asher_ide",
            projectRef: activeProject.id,
            ownerUserId: user.id,
          });
        }
      }
    } catch (e: any) {
      const errMsg: ChatMsg = { role: "assistant", content: "**ZANOEM Error:** " + (e.message || "call failed") };
      setChat([...next, errMsg]);
      void persistChatMessages([userMsg, errMsg]);
      toast.error(e.message || "ZANOEM call failed");
    } finally { setAiBusy(false); if (!isAutopilotTurn) completePlan(); }
  }

  // Bind the offline-queue handlers to the live sendChatViaZanoem so they
  // can dispatch autopilot turns while the user is away.
  useEffect(() => {
    sendZanoemTurnRef.current = (prompt: string) => sendChatViaZanoem(prompt, true);
  });
  // Extract ZANOEM code blocks and write them as files.
  // SINGLE ORDERED SCAN: walks fenced ``` blocks in source order. For each
  // block, the path is taken from (in priority order):
  //   1) the fence info line:  ```lang path/to/file.ext
  //   2) the first line INSIDE the fence if it's a comment:  // path/file.ext  (or # / --)
  //   3) the LAST non-empty line ABOVE the fence within 2 lines:
  //         **path/file.ext**     `path/file.ext`     File: path/file.ext     ### path/file.ext
  // Also accepts <code_output path="..."> blocks anywhere.
  // We only ever bind a path to the SINGLE fence it actually owns — never across the doc.
  async function materializeZanoemCodeBlocks(text: string): Promise<number> {
    if (!activeProject) return 0;
    type Hit = { path: string; content: string; language: string };
    const hits: Hit[] = [];
    const seen = new Set<string>();
    const PATH_RE = /[A-Za-z0-9_][A-Za-z0-9_./-]*\.[A-Za-z0-9]{1,8}$/;

    const cleanPath = (raw: string): string | null => {
      let p = raw.trim()
        .replace(/^[`*"'\[(]+|[`*"'\])]+$/g, "")  // strip wrappers
        .replace(/^(?:\/\/|#|--)\s*/, "")          // strip comment leaders
        .replace(/^(?:File|Path|FILE|PATH)\s*[:\-]\s*/i, "")
        .replace(/^[./\\]+/, "")
        .trim();
      if (!p || !PATH_RE.test(p)) return null;
      // Reject obvious prose words that LOOK like paths but aren't (no slash, single-letter ext)
      if (!p.includes("/") && p.length < 4) return null;
      return p;
    };

    const langFor = (ext: string, hint?: string) =>
      hint || ({ js:"javascript", mjs:"javascript", cjs:"javascript", jsx:"javascript",
                 ts:"typescript", tsx:"typescript", py:"python", html:"html", htm:"html",
                 css:"css", json:"json", md:"markdown", sh:"shell", yml:"yaml", yaml:"yaml" } as any)[ext.toLowerCase()] || ext;

    const push = (path: string, content: string, lang?: string) => {
      const p = cleanPath(path);
      if (!p || seen.has(p)) return;
      seen.add(p);
      const ext = (p.split(".").pop() || "txt").toLowerCase();
      hits.push({ path: p, content: content.replace(/\s+$/, ""), language: langFor(ext, lang) });
    };

    // 1) <code_output path="..."> blocks (highest precedence — explicit)
    const tagRe = /<code_output[^>]*path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/code_output>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tagRe.exec(text)) !== null) {
      let body = tm[2].trim();
      const inner = body.match(/```[a-zA-Z0-9+#_-]*\s*\n([\s\S]*?)```/);
      if (inner) body = inner[1];
      push(tm[1], body);
    }

    // 2) Walk fenced ``` blocks in order
    const fenceRe = /```([a-zA-Z0-9+#_-]*)([^\n]*)\n([\s\S]*?)```/g;
    let fm: RegExpExecArray | null;
    while ((fm = fenceRe.exec(text)) !== null) {
      const lang = (fm[1] || "").toLowerCase();
      const infoTail = (fm[2] || "").trim();
      const body = fm[3];
      const startIdx = fm.index;

      let pathCandidate: string | null = null;

      // (a) path on info line:  ```ts src/foo.ts
      if (infoTail) {
        const cand = cleanPath(infoTail.split(/\s+/)[0]);
        if (cand) pathCandidate = cand;
      }

      // (b) first line inside the fence is a comment with a path
      if (!pathCandidate) {
        const firstLine = body.split("\n", 1)[0]?.trim() || "";
        const cm = firstLine.match(/^(?:\/\/|#|--|\/\*)\s*([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8})\s*\*?\/?\s*$/);
        if (cm) {
          const cand = cleanPath(cm[1]);
          if (cand) pathCandidate = cand;
        }
      }

      // (c) line(s) immediately above the fence (within 2 non-empty lines)
      if (!pathCandidate) {
        const before = text.slice(Math.max(0, startIdx - 300), startIdx);
        const lines = before.split("\n").map(l => l.trim()).filter(Boolean).slice(-2);
        for (let i = lines.length - 1; i >= 0; i--) {
          // strip markdown decoration: **x**  ### x  - x  > x  `x`
          const stripped = lines[i]
            .replace(/^[#>*\-`]+\s*/, "")
            .replace(/\*\*/g, "")
            .replace(/^[`"']|[`"']$/g, "")
            .replace(/^(?:File|Path|FILE|PATH)\s*[:\-]\s*/i, "");
          // Take the LAST token that looks like a path
          const tokens = stripped.split(/\s+/);
          for (let j = tokens.length - 1; j >= 0; j--) {
            const cand = cleanPath(tokens[j]);
            if (cand) { pathCandidate = cand; break; }
          }
          if (pathCandidate) break;
        }
      }

      if (pathCandidate) push(pathCandidate, body, lang);
    }

    if (hits.length === 0) return 0;
    let count = 0;
    for (const h of hits) {
      const existing = files.find((f) => f.path === h.path);
      if (existing) {
        const { error } = await supabase.from("asher_code_files").update({ content: h.content }).eq("id", existing.id);
        if (!error) {
          setFiles((fs) => fs.map((f) => (f.id === existing.id ? { ...f, content: h.content } : f)));
          count++;
        } else {
          console.warn("[zanoem] update failed", h.path, error.message);
        }
      } else {
        const { data, error } = await supabase
          .from("asher_code_files")
          .insert({ project_id: activeProject.id, branch_id: activeBranchId, path: h.path, content: h.content, language: h.language })
          .select()
          .single();
        if (!error && data) {
          setFiles((fs) => [...fs, data as AsherCodeFile]);
          count++;
        } else if (error) {
          console.warn("[zanoem] insert failed", h.path, error.message);
        }
      }
    }
    setPreviewKey((k) => k + 1);
    return count;
  }


  async function aiExplain() {
    if (!activeFile) return;
    setAiBusy(true);
    try {
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({ mode: "explain", byok: byok(), code: activeContent, language: activeFile.language, ...aureon });
      const u: ChatMsg = { role: "user", content: `Explain ${activeFile.path}` };
      const a: ChatMsg = { role: "assistant", content: r.reply || "" };
      setChat(c => [...c, u, a]);
      void persistChatMessages([u, a]);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  async function aiFix() {
    if (!activeFile) return;
    const err = prompt("Paste the error message:");
    if (!err) return;
    setAiBusy(true);
    try {
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({ mode: "fix", byok: byok(), code: activeContent, language: activeFile.language, error: err, ...aureon });
      const u: ChatMsg = { role: "user", content: `Fix: ${err}` };
      const a: ChatMsg = { role: "assistant", content: r.reply || "" };
      setChat(c => [...c, u, a]);
      void persistChatMessages([u, a]);
      const fixed = extractCodeBlock(r.reply || "");
      if (fixed) {
        if (autoApprove || confirm("Replace file content with fixed version?")) {
          animateApply(activeFile.id, fixed);
          if (autoApprove) toast.success("Fix applied — undo via Ctrl+Z in editor");
        }
      }
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  async function aiGenerate() {
    if (!activeFile) return;
    const desc = prompt("Describe what to generate:");
    if (!desc) return;
    setAiBusy(true);
    try {
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({ mode: "generate", byok: byok(), description: desc, language: activeFile.language, ...aureon });
      const code = extractCodeBlock(r.reply || "");
      animateApply(activeFile.id, code);
      const u: ChatMsg = { role: "user", content: `Generate: ${desc}` };
      const a: ChatMsg = { role: "assistant", content: r.reply || "" };
      setChat(c => [...c, u, a]);
      void persistChatMessages([u, a]);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  // Generate full test suite for the active file
  async function aiTests() {
    if (!activeFile) return;
    setAiBusy(true);
    try {
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({ mode: "tests", byok: byok(), code: activeContent, language: activeFile.language, framework: "vitest", ...aureon });
      const code = extractCodeBlock(r.reply || "");
      // Create a sibling test file
      const base = activeFile.path.replace(/\.(tsx?|jsx?|py)$/, "");
      const ext = activeFile.path.match(/\.(tsx?|jsx?)$/)?.[1] || "ts";
      const testPath = `${base}.test.${ext}`;
      const { data, error } = await supabase
        .from("asher_code_files")
        .insert({ project_id: activeProject!.id, branch_id: activeBranchId, path: testPath, content: code, language: activeFile.language })
        .select().single();
      if (error || !data) { toast.error(error?.message || "Failed to create test file"); return; }
      const f = data as AsherCodeFile;
      setFiles(fs => [...fs, f]);
      setOpenTabs(t => [...t, f.id]);
      setActiveFileId(f.id);
      toast.success(`Tests generated → ${testPath}`);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  // Multi-file Edit Mode — AI proposes plan, user approves diff
  async function aiEditMode() {
    const instruction = prompt("What should change across the project?");
    if (!instruction) return;
    setAiBusy(true);
    try {
      const projectFiles = files.map(f => ({ path: f.path, content: dirty[f.id] ?? f.content }));
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({ mode: "edit_plan", byok: byok(), instruction, contextFiles: projectFiles, ...aureon });
      const plan = extractJsonBlock<EditPlan>(r.reply || "");
      if (!plan?.edits?.length) { toast.error("AI did not return a valid edit plan"); return; }
      if (autoApprove) {
        applyEditPlan(plan.edits.map(e => e.path), plan);
        toast.success(`Auto-applied ${plan.edits.length} edits — review/undo in editor`);
      } else {
        setEditPlan(plan);
      }
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  function applyEditPlan(selectedPaths: string[], planOverride?: EditPlan) {
    const planToUse = planOverride || editPlan;
    if (!planToUse || !activeProject) return;
    let appliedCount = 0;
    const newDirty = { ...dirty };
    for (const edit of planToUse.edits) {
      if (!selectedPaths.includes(edit.path)) continue;
      const existing = files.find(f => f.path === edit.path);
      if (existing) {
        if (animateInsertion) animateApply(existing.id, edit.new_content);
        else newDirty[existing.id] = edit.new_content;
        appliedCount++;
      } else {
        void supabase.from("asher_code_files").insert({
          project_id: activeProject.id,
          branch_id: activeBranchId,
          path: edit.path,
          content: edit.new_content,
          language: edit.path.split(".").pop() || "plaintext",
        }).select().single().then(({ data }) => {
          if (data) {
            const f = data as AsherCodeFile;
            setFiles(fs => [...fs, f]);
          }
        });
        appliedCount++;
      }
    }
    if (!animateInsertion) setDirty(newDirty);
    setEditPlan(null);
    toast.success(`${autoApprove ? "Applied" : "Staged"} ${appliedCount} edits — Save to commit`);
  }

  // Multi-model orchestration on the chat input
  async function aiOrchestrate() {
    if (!chatInput.trim()) { toast.error("Type a request in the chat box first"); return; }
    setAiBusy(true);
    try {
      // Pick top 3 providers — current + 2 most distinct
      const others = ASHER_CODE_PROVIDERS
        .filter(p => p.id !== provider)
        .slice(0, 2)
        .map(p => ({ provider: p.id, model: p.models[0].id, apiKey: undefined as any }));
      const byoks = [{ provider, model, apiKey: apiKey || undefined }, ...others];
      const ctx = activeFile ? [{ path: activeFile.path, content: activeContent }] : [];
      const aureon = await loadAureonContext();
      const r = await callAsherCodeAi({
        mode: "orchestrate",
        subMode: "chat",
        byoks,
        messages: [...chat, { role: "user", content: chatInput }],
        contextFiles: ctx,
        ...aureon,
      });
      setChatInput("");
      setOrchResult(r);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  // Inline `// AI: <prompt>` trigger — detected on save with Cmd+Enter or button
  async function runInlineAiPrompts() {
    if (!activeFile) return;
    const lines = activeContent.split("\n");
    const re = /^(\s*)(?:\/\/|\/\*|#)\s*AI:\s*(.+?)\s*(?:\*\/)?\s*$/i;
    const targets: { lineIdx: number; indent: string; prompt: string }[] = [];
    lines.forEach((ln, i) => {
      const m = ln.match(re);
      if (m) targets.push({ lineIdx: i, indent: m[1], prompt: m[2] });
    });
    if (!targets.length) { toast.info("No `// AI: ...` prompts found in this file"); return; }
    setAiBusy(true);
    try {
      const aureon = await loadAureonContext();
      const newLines = [...lines];
      // Process bottom-up so indices stay stable
      for (const t of [...targets].reverse()) {
        const before = newLines.slice(Math.max(0, t.lineIdx - 30), t.lineIdx).join("\n");
        const after = newLines.slice(t.lineIdx + 1, t.lineIdx + 31).join("\n");
        const r = await callAsherCodeAi({
          mode: "inline",
          byok: byok(),
          path: activeFile.path,
          language: activeFile.language,
          before: `${before}\n// REQUEST: ${t.prompt}\n`,
          after,
          ...aureon,
        });
        const completion = (r.reply || "").trim().replace(/^```[\w]*\n?|\n?```$/g, "");
        const indented = completion.split("\n").map(l => t.indent + l).join("\n");
        newLines.splice(t.lineIdx + 1, 0, indented);
      }
      setDirty(d => ({ ...d, [activeFile.id]: newLines.join("\n") }));
      toast.success(`Resolved ${targets.length} inline prompt${targets.length > 1 ? "s" : ""}`);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  // ── Publish as Asher tab ──────────────────────────────────────
  async function publishAsTab(name: string, icon: string, visibility: "private" | "team" | "organization" | "public") {
    if (!activeProject || !user) return;
    const html = files.find(f => f.path.endsWith("index.html"));
    if (!html) { toast.error("Project must contain index.html to publish"); return; }
    const entry = previewSrcDoc;
    const { error } = await supabase.from("asher_code_published_tabs").insert({
      project_id: activeProject.id,
      owner_id: user.id,
      name, icon, entry_html: entry, visibility,
    });
    if (error) { toast.error(error.message); return; }
    setShowPublish(false);
    toast.success(`Published "${name}" as Asher tab`);
  }

  // ── RENDER ─────────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="flex h-full w-full flex-col bg-background text-foreground overflow-auto">
        <div className="border-b border-border/15 bg-card/20 px-6 py-4 backdrop-blur-md flex items-center justify-between">
          <div>
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Asher IDE</p>
            <h2 className="text-xl font-extralight tracking-wide">Integrated Development Environment</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border/20 bg-card/30 px-3 py-1.5 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30">
              <KeyRound className="h-3 w-3" /> BYOK
            </button>
            <button onClick={() => setShowNewProject(true)} className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-[10px] font-light tracking-[0.15em] uppercase hover:bg-foreground/20">
              <Plus className="h-3 w-3" /> New Project
            </button>
          </div>
        </div>

        <div className="p-6 max-w-5xl mx-auto w-full">
          {!apiKey && (
            <div className="mb-4 rounded-lg border border-foreground/20 bg-foreground/5 p-3 text-[11px] text-muted-foreground/80 font-light">
              Add your own API key in <strong>BYOK</strong> settings. Asher IDE never uses platform AI keys for non-admin users.
            </div>
          )}
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-border/15 bg-card/20 p-10 text-center backdrop-blur-md">
              <Code2 className="mx-auto h-8 w-8 text-foreground/30 mb-3" strokeWidth={1.2} />
              <p className="text-sm font-light text-muted-foreground">No projects yet. Create one to start building.</p>
              <button onClick={() => setShowNewProject(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/10 px-4 py-2 text-[10px] font-light tracking-[0.2em] uppercase hover:bg-foreground/20">
                <Plus className="h-3 w-3" /> Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map(p => (
                <div key={p.id} className="rounded-xl border border-border/15 bg-card/20 p-4 backdrop-blur-md hover:border-foreground/30 transition group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0"><FileText className="h-3.5 w-3.5 text-foreground/60 flex-shrink-0" /><h3 className="text-sm font-light tracking-wide truncate">{p.name}</h3></div>
                    <button onClick={() => deleteProject(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">{p.language} · {p.visibility}</p>
                  <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1 mb-3"><Clock className="h-2.5 w-2.5" /> updated {relTime(p.updated_at)}</p>
                  <button onClick={() => openProject(p)} className="w-full rounded-md border border-border/20 bg-card/40 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase hover:bg-foreground/10">Open</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {showNewProject && <NewProjectDialog onClose={() => setShowNewProject(false)} onCreate={createProject} />}
        {showSettings && <BYOKSettings onClose={() => setShowSettings(false)} provider={provider} model={model} apiKey={apiKey} setProvider={setProvider} setModel={setModel} setApiKey={setApiKey} />}
      </div>
    );
  }

  // ── Project open: full IDE ─────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="relative z-[80] flex items-center justify-between gap-2 border-b border-border/15 bg-card/20 px-2 sm:px-3 py-2 backdrop-blur-md flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => { setActiveProject(null); setFiles([]); }} className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground whitespace-nowrap">← Projects</button>
          <RecentProjectsMenu
            projects={projects}
            activeId={activeProject.id}
            onSelect={(p) => openProject(p)}
          />
          <span className="text-muted-foreground/30 hidden sm:inline">/</span>
          {renamingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitProjectRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitProjectRename();
                if (e.key === "Escape") { setRenamingTitle(false); }
              }}
              className="text-xs font-light bg-card/60 border border-foreground/30 rounded px-2 py-0.5 outline-none min-w-[160px]"
            />
          ) : (
            <button
              onDoubleClick={() => { setTitleDraft(activeProject.name); setRenamingTitle(true); }}
              onClick={(e) => { if (e.detail === 2) return; }}
              title="Double-click to rename"
              className="text-xs font-light truncate max-w-[140px] sm:max-w-none hover:text-foreground/90 cursor-text"
            >
              {activeProject.name}
            </button>
          )}
          {Object.keys(dirty).length > 0 && <span className="text-[9px] text-muted-foreground/80 ml-1 whitespace-nowrap">● {Object.keys(dirty).length} unsaved</span>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Pane toggles */}
          <button onClick={() => setShowFiles(s => !s)} title="Toggle file tree" className={`inline-flex items-center justify-center rounded-md border px-2 py-1 ${showFiles ? "border-foreground/30 bg-foreground/10" : "border-border/20 bg-card/30 hover:border-foreground/30"}`}>
            {showFiles ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
          </button>
          <button onClick={() => setShowPreview(s => !s)} title="Toggle preview" className={`inline-flex items-center justify-center rounded-md border px-2 py-1 ${showPreview ? "border-foreground/30 bg-foreground/10" : "border-border/20 bg-card/30 hover:border-foreground/30"}`}>
            {showPreview ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
          <button onClick={() => setShowAi(s => !s)} title="Toggle AI sidebar" className={`inline-flex items-center justify-center rounded-md border px-2 py-1 ${showAi ? "border-foreground/30 bg-foreground/10" : "border-border/20 bg-card/30 hover:border-foreground/30"}`}>
            {showAi ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
          </button>
          <span className="w-px h-4 bg-border/20 mx-0.5" />
          <button onClick={saveAll} disabled={!Object.keys(dirty).length} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Save className="h-3 w-3" /> <span className="hidden sm:inline">Save</span></button>
          <button onClick={runPreview} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30"><Play className="h-3 w-3" /> <span className="hidden sm:inline">Run</span></button>
          <button onClick={() => setShowPublish(true)} className="inline-flex items-center gap-1 rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase text-foreground/80 hover:bg-foreground/10"><Upload className="h-3 w-3" /> <span className="hidden sm:inline">Publish</span></button>
          <button onClick={downloadProjectZip} title="Download current branch as .zip" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30" aria-label="Download current branch as .zip"><Download className="h-3 w-3" /> <span className="hidden sm:inline">ZIP</span></button>
          <input ref={zipImportInputRef} type="file" accept=".zip,application/zip" onChange={handleZipImportSelect} className="hidden" />
          <button onClick={() => zipImportInputRef.current?.click()} disabled={zipImporting} title="Import a ZIP into the current branch or stage it as a new branch" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40" aria-label="Import ZIP into branch">
            {zipImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileArchive className="h-3 w-3" />} <span className="hidden md:inline">Import</span>
          </button>
          <button onClick={() => setShowDevOps(s => !s)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase ${showDevOps ? "border-foreground/40 bg-foreground/15" : "border-border/20 bg-card/30 hover:border-foreground/30"}`}><Wrench className="h-3 w-3" /> <span className="hidden md:inline">DevOps</span></button>
          <button onClick={() => setShowGit(true)} title="Clone, commit & push to GitHub" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30"><GitBranch className="h-3 w-3" /> <span className="hidden md:inline">GitHub</span></button>
          <button onClick={() => setTemplateOpen(true)} title="Scaffold from natural language" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30"><Wand2 className="h-3 w-3" /></button>
          <button onClick={() => setFuzzyOpen(true)} title="Fuzzy file finder" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30"><FileText className="h-3 w-3" /></button>
          <button onClick={() => setHistoryOpen(true)} disabled={!activeFile} title="Version history" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30 disabled:opacity-40"><History className="h-3 w-3" /></button>
          <button onClick={() => setCheckpointsOpen(true)} disabled={!activeProject} title="Checkpoints — rollback last agent edit" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30 disabled:opacity-40"><GitCommit className="h-3 w-3" /></button>
          <IdeModeToggle scope="asher" />
          <button onClick={() => { setBugDoctorMsg(""); setBugDoctorOpen(true); }} title="Bug Doctor" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30"><Stethoscope className="h-3 w-3" /></button>
          <IdeModelRouterBadge decision={routeDecision} onOverride={setModelOverride} isOverridden={!!modelOverride} />
          <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30"><Settings className="h-3 w-3" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* File tree — collapsible */}
        {showFiles && (
          <aside className="w-44 sm:w-52 lg:w-56 flex-shrink-0 border-r border-border/15 bg-card/10 overflow-y-auto">
            {/* Branches */}
            <div className="border-b border-border/15 bg-card/20">
              <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-card/40 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase flex items-center gap-1.5"><GitBranch className="h-3 w-3" /> Branches</span>
                <button onClick={createBranch} className="text-muted-foreground hover:text-foreground" title="New branch from current" aria-label="New branch from current"><Plus className="h-3 w-3" /></button>
              </div>
              <div
                onClick={() => switchBranch(null)}
                className={`group flex items-center justify-between px-3 py-1.5 text-[11px] font-light cursor-pointer hover:bg-foreground/5 ${activeBranchId === null ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}
              >
                <span className="truncate flex items-center gap-1.5"><GitBranch className="h-3 w-3 flex-shrink-0" />main</span>
              </div>
              {branches.map(b => (
                <div key={b.id}
                  onClick={() => switchBranch(b.id)}
                  className={`group flex items-center justify-between px-3 py-1.5 text-[11px] font-light cursor-pointer hover:bg-foreground/5 ${activeBranchId === b.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}>
                  <span className="truncate flex items-center gap-1.5 pl-3 border-l border-border/30"><GitBranch className="h-3 w-3 flex-shrink-0" />{b.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); void deleteBranch(b.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/15 sticky top-0 bg-card/40 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Files {activeBranchId && <span className="text-foreground/60">· {branches.find(b=>b.id===activeBranchId)?.name}</span>}</span>
              <button onClick={addFile} className="text-muted-foreground hover:text-foreground" title="Add file" aria-label="Add file"><FolderPlus className="h-3 w-3" /></button>
            </div>
            {files.map(f => (
              <div key={f.id} className={`group flex items-center justify-between px-3 py-1.5 text-[11px] font-light cursor-pointer hover:bg-foreground/5 ${activeFileId === f.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}
                onClick={() => { if (!openTabs.includes(f.id)) setOpenTabs(t => [...t, f.id]); setActiveFileId(f.id); }}>
                <span className="truncate flex items-center gap-1.5"><FileText className="h-3 w-3 flex-shrink-0" />{f.path}{f.id in dirty && <span className="text-muted-foreground">●</span>}</span>
                <button onClick={(e) => { e.stopPropagation(); void removeFile(f.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </aside>
        )}

        {/* Editor + preview */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border/15 bg-card/10">
            <div className="flex items-center overflow-x-auto flex-1 min-w-0">
              {openTabs.map(tid => {
                const f = files.find(x => x.id === tid);
                if (!f) return null;
                return (
                  <div key={tid} className={`group flex items-center gap-2 border-r border-border/15 px-3 py-1.5 text-[11px] font-light cursor-pointer whitespace-nowrap ${activeFileId === tid ? "bg-background text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}
                    onClick={() => setActiveFileId(tid)}>
                    {f.path}{f.id in dirty && <span className="text-muted-foreground">●</span>}
                    <button onClick={(e) => { e.stopPropagation(); setOpenTabs(t => t.filter(x => x !== tid)); if (activeFileId === tid) setActiveFileId(openTabs.filter(x => x !== tid)[0] || null); }} className="opacity-50 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
            </div>
            {/* Code / Split / Preview segmented control */}
            <div className="flex items-center gap-0.5 px-2 py-1 border-l border-border/15 flex-shrink-0">
              <button
                onClick={() => setViewMode("code")}
                title="Code only"
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-light tracking-[0.2em] uppercase transition ${viewMode === "code" ? "bg-foreground/15 text-foreground border border-foreground/30" : "text-muted-foreground/70 hover:text-foreground border border-transparent"}`}
              >
                <Code2 className="h-3 w-3" /><span className="hidden sm:inline">Code</span>
              </button>
              <button
                onClick={() => setViewMode("split")}
                title="Split view"
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-light tracking-[0.2em] uppercase transition ${viewMode === "split" ? "bg-foreground/15 text-foreground border border-foreground/30" : "text-muted-foreground/70 hover:text-foreground border border-transparent"}`}
              >
                <Columns2 className="h-3 w-3" /><span className="hidden sm:inline">Split</span>
              </button>
              <button
                onClick={() => setViewMode("preview")}
                title="Preview only"
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-light tracking-[0.2em] uppercase transition ${viewMode === "preview" ? "bg-foreground/15 text-foreground border border-foreground/30" : "text-muted-foreground/70 hover:text-foreground border border-transparent"}`}
              >
                <Eye className="h-3 w-3" /><span className="hidden sm:inline">Preview</span>
              </button>
              <button
                onClick={() => setViewMode("workflow")}
                title="Workflow Map · agents, file tree, timeline"
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-light tracking-[0.2em] uppercase transition ${viewMode === "workflow" ? "bg-foreground/15 text-foreground border border-foreground/30" : "text-muted-foreground/70 hover:text-foreground border border-transparent"}`}
              >
                <Network className="h-3 w-3" />
                <span className="hidden sm:inline">Workflow</span>
                {swarmAgents.filter(a => a.status === "working").length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-foreground/20 px-1 text-[8px] font-mono text-foreground/90">
                    {swarmAgents.filter(a => a.status === "working").length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Live validator badge — visible when a file is open */}
          {activeFile && activeContent && (
            <div className="px-2 py-1 border-b border-border/15 bg-card/5">
              <IdeValidatorBadge content={activeContent} language={activeFile.language || "tsx"} />
            </div>
          )}

          {activeProject && (
            <div className="px-2 py-1 border-b border-border/15 bg-card/5">
              <IdeChangedFilesPanel
                scope="asher"
                projectId={activeProject.id}
                onOpenFile={(id) => {
                  if (!openTabs.includes(id)) setOpenTabs(t => [...t, id]);
                  setActiveFileId(id);
                }}
              />
            </div>
          )}

          {/* Editor + preview + workflow — controlled by viewMode (code | split | preview | workflow) */}
          <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
            {viewMode === "workflow" ? (
              <div className="w-full flex-1 min-w-0 min-h-[200px]">
                <AsherWorkflowMap
                  liveAgents={swarmAgents}
                  events={workflowEvents}
                  fileStats={Object.values(fileWorkflowStats)}
                />
              </div>
            ) : null}
            {viewMode !== "preview" && viewMode !== "workflow" && (
              <div
                className={`relative min-w-0 min-h-[200px] ${viewMode === "split" ? "flex-1" : "w-full flex-1"}`}
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${wallpaperAureon})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                {activeFile ? (
                  <div className="relative z-10 h-full">
                    <Editor
                      height="100%"
                      theme="aureon-transparent"
                      beforeMount={(monaco) => {
                        monaco.editor.defineTheme("aureon-transparent", {
                          base: "vs-dark",
                          inherit: true,
                          rules: [],
                          colors: {
                            "editor.background": "#00000000",
                            "editor.lineHighlightBackground": "#ffffff08",
                            "editor.lineHighlightBorder": "#00000000",
                            "editorGutter.background": "#00000000",
                            "minimap.background": "#00000000",
                            "scrollbarSlider.background": "#ffffff14",
                            "scrollbarSlider.hoverBackground": "#ffffff22",
                            "scrollbarSlider.activeBackground": "#ffffff33",
                            "editorWidget.background": "#0a0a0acc",
                            "editorSuggestWidget.background": "#0a0a0acc",
                          },
                        });
                      }}
                      language={activeFile.language}
                      value={activeContent}
                      onChange={(v) => setDirty(d => ({ ...d, [activeFile.id]: v ?? "" }))}
                      onMount={(editor, monaco) => {
                        editorRef.current = editor;
                        monacoRef.current = monaco;
                        const detach = attachCursorFeatures(editor, monaco, {
                          getFile: () => {
                            const f = activeFileRefAsher.current;
                            return f ? { id: f.id, name: f.path, language: f.language, content: activeContentRefAsher.current } : null;
                          },
                          getByok: () => {
                            try {
                              const c = localStorage.getItem("aureon_byok_active");
                              const p = c ? JSON.parse(c) : null;
                              if (p?.provider && p.provider !== "default" && p?.model) return { provider: p.provider, model: p.model };
                            } catch { /* noop */ }
                            return { provider: "google", model: "gemini-2.5-flash" };
                          },
                        });
                        editor.onDidDispose(() => { try { detach(); } catch { /* noop */ } });
                      }}
                      options={{ fontSize: 13, minimap: { enabled: true }, automaticLayout: true, fontFamily: "ui-monospace, monospace", padding: { top: 12 }, glyphMargin: true }}
                    />
                  </div>
                ) : (
                  <div className="relative z-10 h-full flex items-center justify-center text-xs text-muted-foreground/50">Open a file to start editing</div>
                )}
              </div>
            )}
            {viewMode !== "code" && viewMode !== "workflow" && (
              <div className={`${viewMode === "preview" ? "w-full flex-1" : "w-full lg:w-2/5 lg:min-w-[280px]"} border-t lg:border-t-0 ${viewMode === "split" ? "lg:border-l" : ""} border-border/15 bg-card/5 flex flex-col min-h-[200px]`}>
                <div className="px-3 py-1.5 border-b border-border/15 text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase flex items-center justify-between">
                  <span>Preview</span>
                  <span className="text-muted-foreground/50 normal-case tracking-normal text-[9px]">Live · Sandboxed</span>
                </div>
                <iframe key={previewKey} ref={previewRef} srcDoc={previewSrcDoc} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" className="flex-1 bg-white" title="preview" />
              </div>
            )}
          </div>
        </div>


        {/* AI sidebar — collapsible */}
        {showAi && (
        <aside className="w-full sm:w-72 lg:w-80 max-w-full flex-shrink-0 border-l border-border/15 bg-card/10 flex flex-col absolute lg:relative right-0 top-0 bottom-0 z-20 lg:z-auto bg-background/95 lg:bg-card/10 backdrop-blur-xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/15">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-foreground/60" />
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Asherin Code AI</span>
            </div>
            <span className="text-[8px] tracking-[0.2em] text-foreground/70 uppercase">{apiKey ? "BYOK" : "No Key"}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2 border-b border-border/15">
            <button onClick={aiGenerate} disabled={aiBusy || !apiKey} className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Wand2 className="h-2.5 w-2.5" />Gen</button>
            <button onClick={aiExplain} disabled={aiBusy || !apiKey} className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Sparkles className="h-2.5 w-2.5" />Explain</button>
            <button onClick={aiFix} disabled={aiBusy || !apiKey} className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Bug className="h-2.5 w-2.5" />Fix</button>
            <button onClick={aiTests} disabled={aiBusy || !apiKey} title="Generate test suite" className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40" aria-label="Generate test suite"><FlaskConical className="h-2.5 w-2.5" />Tests</button>
            <button onClick={aiEditMode} disabled={aiBusy || !apiKey} title="Multi-file Edit Mode with diff approval" className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40" aria-label="Multi-file Edit Mode with diff approval"><FileEdit className="h-2.5 w-2.5" />Edit</button>
            <button onClick={runInlineAiPrompts} disabled={aiBusy || !apiKey} title="Resolve `// AI: ...` prompts in active file" className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40" aria-label="Resolve `// AI: ...` prompts in active file"><Code2 className="h-2.5 w-2.5" />// AI:</button>
          </div>
          <div className="flex items-center justify-between px-2 py-1 border-b border-border/15 bg-card/5">
            <label className="flex items-center gap-1.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase cursor-pointer">
              <input type="checkbox" checked={orchestrateMode} onChange={(e) => setOrchestrateMode(e.target.checked)} className="accent-foreground h-3 w-3" />
              <Layers className="h-2.5 w-2.5" /> Multi-Model
            </label>
            {orchestrateMode && <span className="text-[8px] text-foreground/70 tracking-[0.15em] uppercase">3 models · ranked</span>}
          </div>
          <div className="relative flex-1 min-h-0 min-w-0">
            <div ref={chatScrollRef} className="absolute inset-0 overflow-y-auto px-3 py-2 space-y-2 min-w-0">
              {chat.length === 0 && !activePlan && <p className="text-[10px] text-muted-foreground/50 italic">Ask anything about your code. Senior Principal Engineer persona, BYOK only.</p>}
              {chat.map((m, i) => (
                <div key={i} className={`rounded-lg px-2.5 py-2 text-[11px] font-light min-w-0 max-w-full overflow-hidden ${m.role === "user" ? "bg-foreground/10 border border-foreground/15" : "bg-card/30 border border-border/15"}`}>
                  {m.role === "assistant"
                    ? <div className="prose prose-xs prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:whitespace-pre [&_code]:break-words [&_p]:break-words [&_a]:break-all prose-pre:bg-background/60 prose-pre:text-[10px] prose-pre:border prose-pre:border-border/20 prose-code:text-[10px]"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                </div>
              ))}
              <AsherCodePlanStepsView plan={activePlan} />
              {(zanoemMode || autopilotRoundsRef.current > 0) && (
                <IdeBuildStatusPanel
                  lastAssistantText={chat.filter(m => m.role === "assistant").slice(-1)[0]?.content || ""}
                  round={autopilotRoundsRef.current}
                  maxRounds={AUTOPILOT_MAX_ROUNDS}
                  busy={aiBusy}
                />
              )}
              {aiBusy && <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
              <div ref={chatEndRef} />
            </div>
            {chatScrolledUp && (
              <button
                onClick={jumpChatToPresent}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-border/30 bg-card/90 backdrop-blur-xl px-3 py-1.5 text-[10px] font-light tracking-wide text-muted-foreground hover:text-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] animate-fade-in"
              >
                <ArrowDown className="h-3 w-3" />
                {aiBusy ? "Asher is still writing — Jump to present" : "Jump to present"}
              </button>
            )}
            {/* ── SWARM PANEL ─────────────────────────────────────
                One pill per live debugger agent. Pills appear when
                spawned and fade out 1.2s after their fix lands. */}
            {swarmAgents.length > 0 && (
              <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 max-w-[60%] animate-fade-in">
                <div className="flex items-center gap-1.5 text-[9px] font-light tracking-[0.2em] uppercase text-foreground/80 px-2 py-1 rounded border border-border/30 bg-card/90 backdrop-blur-xl shadow-lg">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
                  </span>
                  ◈ Swarm · {swarmAgents.filter(a => a.status === "working").length} active · {swarmAgents.length} total
                </div>
                <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto">
                  {swarmAgents.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono border backdrop-blur-xl shadow-sm transition-opacity ${
                        a.status === "working"
                          ? "bg-card/85 border-border/30 text-foreground/85"
                          : a.status === "done"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300/90 opacity-70"
                          : "bg-destructive/10 border-destructive/30 text-destructive/90 opacity-70"
                      }`}
                    >
                      {a.status === "working" ? <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" /> :
                       a.status === "done" ? <span className="text-[10px] leading-none">◉</span> :
                       <X className="h-2.5 w-2.5 shrink-0" />}
                      <span className="truncate">{a.file.split("/").pop()}</span>
                      <span className="opacity-50 shrink-0">· {a.issueCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Pending uploads chips */}
          {pendingUploads.length > 0 && (
            <div className="border-t border-border/15 px-2 py-1.5 flex flex-wrap gap-1 bg-card/20">
              {pendingUploads.map((u, i) => (
                <div key={i} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 px-1.5 py-0.5 text-[9px] font-light">
                  {u.kind === "image" ? <ImageIcon className="h-2.5 w-2.5" /> : u.kind === "zip" ? <FileArchive className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                  <span className="truncate max-w-[80px]">{u.name}</span>
                  <button onClick={() => setPendingUploads(p => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-2 w-2" /></button>
                </div>
              ))}
            </div>
          )}
          {/* Manual "Fix Bugs & Logic" trigger — runs the same swarm autofix loop on demand */}
          {(() => {
            const workingCount = swarmAgents.filter(a => a.status === "working").length;
            const isRunning = workingCount > 0 || fixBugsPending;
            return (
              <div className="border-t border-border/15 px-2 py-1 flex items-center gap-2 bg-card/10">
                <button
                  type="button"
                  disabled={isRunning}
                  title={isRunning
                    ? "Swarm is running — fixing all validator errors across the project."
                    : "Manually launch the ZANOEM swarm to scan every file, spawn one agent per broken file, and fix all validator errors (red-line bugs) and logic issues until clean."}
                  onClick={() => {
                    if (!activeProject) {
                      toast.error("Open a project first");
                      return;
                    }
                    if (!autoDebug) setAutoDebug(true);
                    autoDebugRef.current = true;
                    setFixBugsPending(true);
                    // Auto-clear the pending flag after 12s in case no errors were found
                    // (so the button doesn't stay stuck on "Running").
                    window.setTimeout(() => setFixBugsPending(false), 12000);
                    toast.message("◈ Fix Bugs & Logic — dispatching swarm");
                    void zqEnqueue({
                      kind: "autofix",
                      payload: { projectRef: activeProject.id },
                      surface: "asher_ide",
                      projectRef: activeProject.id,
                      ownerUserId: user?.id,
                    });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-light tracking-[0.18em] uppercase transition-colors ${
                    isRunning
                      ? "border-foreground/40 bg-foreground/15 text-foreground cursor-not-allowed"
                      : "border-foreground/20 bg-foreground/5 hover:bg-foreground/15 text-foreground"
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Running{workingCount > 0 ? ` · ${workingCount} agent${workingCount === 1 ? "" : "s"}` : "…"}
                    </>
                  ) : (
                    <>
                      <Wrench className="h-2.5 w-2.5" /> Fix Bugs & Logic
                    </>
                  )}
                </button>
                {/* Pause / Resume — visible only while the swarm is active */}
                {isRunning && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !swarmPaused;
                      setSwarmPaused(next);
                      swarmPausedRef.current = next;
                      toast.message(next ? "⏸ Swarm paused" : "▶ Swarm resumed");
                    }}
                    title={swarmPaused ? "Resume the swarm — it will pick up where it left off." : "Pause the swarm — in-flight agents finish, no new agents spawn until you resume."}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-light tracking-[0.18em] uppercase transition-colors ${
                      swarmPaused
                        ? "border-foreground/40 bg-foreground/15 text-foreground"
                        : "border-foreground/20 bg-foreground/5 hover:bg-foreground/15 text-foreground"
                    }`}
                  >
                    {swarmPaused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                )}
                {isRunning && (
                  <span className="flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase text-muted-foreground/70">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${swarmPaused ? "bg-muted-foreground" : "bg-foreground animate-pulse"}`} />
                    {swarmPaused ? "swarm paused" : "swarm active"}
                  </span>
                )}
              </div>
            );
          })()}
          {/* Auto-approve + Animation + ZANOEM toggles */}
          <div className="border-t border-border/15 px-2 py-1 flex items-center justify-between gap-2 bg-card/5 flex-wrap">
            <label className="flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase cursor-pointer">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
              <Zap className="h-2.5 w-2.5" /> Auto Approve
            </label>
            <label className="flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase cursor-pointer">
              <input type="checkbox" checked={animateInsertion} onChange={(e) => setAnimateInsertion(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
              Type-Anim
            </label>
            <label
              title="ZANOEM Mode: design brand-new software from first principles. Auto-creates files from generated code blocks. Uses Asherin engine — no BYOK key needed."
              className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${zanoemMode ? "text-foreground" : "text-muted-foreground/70"}`}
            >
              <input type="checkbox" checked={zanoemMode} onChange={(e) => setZanoemMode(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
              <Brain className="h-2.5 w-2.5" /> ZANOEM
            </label>
            <label
              title="You Decide ZANOEM: autopilot. ZANOEM auto-answers its own questions and recommendations on your behalf for up to 6 rounds, picking the best option each time."
              className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autopilotZanoem ? "text-foreground" : "text-muted-foreground/70"} ${!zanoemMode ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={autopilotZanoem}
                onChange={(e) => setAutopilotZanoem(e.target.checked)}
                disabled={!zanoemMode}
                className="accent-foreground h-2.5 w-2.5"
              />
              <Zap className="h-2.5 w-2.5" /> You Decide ZANOEM
            </label>
            <label
              title="Auto Debug: when autopilot is on, ZANOEM keeps re-running the validator + Bug Doctor in the background until the codebase has zero errors (max 6 passes)."
              className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autoDebug ? "text-foreground" : "text-muted-foreground/70"} ${!autopilotZanoem ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={autoDebug}
                onChange={(e) => setAutoDebug(e.target.checked)}
                disabled={!autopilotZanoem}
                className="accent-foreground h-2.5 w-2.5"
              />
              <Bug className="h-2.5 w-2.5" /> Auto Debug
            </label>
            <label
              title="Auto UI Debug: ZANOEM screenshots the live preview and uses vision to verify the rendered UI matches what was just built. Mismatches are auto-patched."
              className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autoUiDebug ? "text-foreground" : "text-muted-foreground/70"} ${!autopilotZanoem ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={autoUiDebug}
                onChange={(e) => setAutoUiDebug(e.target.checked)}
                disabled={!autopilotZanoem}
                className="accent-foreground h-2.5 w-2.5"
              />
              <Eye className="h-2.5 w-2.5" /> Auto UI Debug
            </label>
          </div>
          <div className="border-t border-border/15 p-2 flex gap-1">
            <input ref={fileInputRef} type="file" multiple accept="image/*,.zip,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.jsx,.html,.css" onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={aiBusy}
              title="Attach images, ZIPs (up to 100MB), or text files"
              className="rounded border border-border/20 bg-card/40 px-2 hover:border-foreground/30 disabled:opacity-40"
            >
              <Upload className="h-3 w-3" />
            </button>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
              placeholder={zanoemMode ? "ZANOEM: invent brand-new software from first principles…" : (apiKey ? "Ask Asherin Code… (paste image, ZIP, or describe)" : "Add API key in BYOK settings first")}
              disabled={!zanoemMode && !apiKey}
              rows={2}
              className="flex-1 resize-none rounded border border-border/20 bg-card/40 px-2 py-1.5 text-[11px] font-light placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={() => zanoemMode ? sendChat() : (orchestrateMode ? aiOrchestrate() : sendChat())}
              disabled={aiBusy || (!chatInput.trim() && pendingUploads.length === 0) || (!zanoemMode && !apiKey)}
              title={zanoemMode ? "ZANOEM: invent new software from first principles" : (orchestrateMode ? "Orchestrate across 3 models" : "Send")}
              className={`rounded border px-2 disabled:opacity-40 ${zanoemMode ? "border-foreground/40 bg-foreground/15 hover:bg-foreground/25" : orchestrateMode ? "border-foreground/30 bg-foreground/10 hover:bg-foreground/20" : "border-foreground/20 bg-foreground/10 hover:bg-foreground/20"}`}
            >
              {zanoemMode ? <Brain className="h-3 w-3 text-foreground" /> : orchestrateMode ? <Layers className="h-3 w-3 text-foreground" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </aside>
        )}
      </div>

      {showDevOps && (
        <AsherCodeDevOps
          projectId={activeProject.id}
          previewIframe={previewRef.current}
          onClose={() => setShowDevOps(false)}
          files={files.map(f => ({ path: f.path, content: dirty[f.id] ?? f.content }))}
        />
      )}

      <AsherGitDrawer
        open={showGit}
        onClose={() => setShowGit(false)}
        projectId={activeProject.id}
        branchId={activeBranchId}
        files={files}
        dirty={dirty}
        onImported={(created) => {
          setFiles(fs => {
            const map = new Map(fs.map(x => [x.id, x]));
            for (const c of created) map.set(c.id, c);
            return Array.from(map.values());
          });
        }}
      />


      {zipImportSession && (
        <ZipImportReviewDialog
          session={zipImportSession}
          currentBranchName={activeBranchId ? branches.find((branch) => branch.id === activeBranchId)?.name || "branch" : "main"}
          importing={zipImporting}
          onClose={() => setZipImportSession(null)}
          onActionChange={updateZipImportAction}
          onImportCurrent={importZipToCurrentBranch}
          onImportNewBranch={importZipToNewBranch}
        />
      )}
      {showSettings && <BYOKSettings onClose={() => setShowSettings(false)} provider={provider} model={model} apiKey={apiKey} setProvider={setProvider} setModel={setModel} setApiKey={setApiKey} />}
      {showPublish && <PublishDialog onClose={() => setShowPublish(false)} onPublish={publishAsTab} defaultName={activeProject.name} />}
      {editPlan && (
        <EditPlanReview
          plan={editPlan}
          currentFiles={files.map(f => ({ id: f.id, path: f.path, content: dirty[f.id] ?? f.content }))}
          busy={aiBusy}
          onCancel={() => setEditPlan(null)}
          onApply={applyEditPlan}
        />
      )}
      {orchResult && (
        <AsherCodeOrchestrationResult
          result={orchResult}
          onClose={() => setOrchResult(null)}
          onInsert={(code) => {
            if (activeFile) setDirty(d => ({ ...d, [activeFile.id]: code }));
            setOrchResult(null);
            toast.success("Inserted into active file");
          }}
        />
      )}

      {/* ── Shared IDE Upgrade Pack modals ── */}
      <IdeFuzzyFinder
        open={fuzzyOpen}
        files={files.map(f => ({ id: f.id, path: f.path }))}
        onClose={() => setFuzzyOpen(false)}
        onPick={(id) => {
          setOpenTabs(t => t.includes(id) ? t : [...t, id]);
          setActiveFileId(id);
          setFuzzyOpen(false);
        }}
      />
      <IdeTemplateLauncher
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onCreate={(r) => { setTemplateOpen(false); void handleScaffold(r); }}
      />
      {activeProject && activeFile && (
        <IdeHistoryPanel
          scope="asher"
          projectId={activeProject.id}
          fileId={activeFile.id}
          filePath={activeFile.path}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={(content) => {
            setDirty(d => ({ ...d, [activeFile.id]: content }));
            setHistoryOpen(false);
            toast.success("Snapshot restored to editor (unsaved)");
          }}
        />
      )}
      {activeProject && (
        <IdeCheckpointPanel
          scope="asher"
          projectId={activeProject.id}
          open={checkpointsOpen}
          onClose={() => setCheckpointsOpen(false)}
          onRestore={(restored) => {
            setDirty(d => {
              const next = { ...d };
              for (const f of restored) next[f.fileId] = f.content;
              return next;
            });
            changedFiles.clear("asher", activeProject.id);
            toast.success(`Restored ${restored.length} file${restored.length === 1 ? "" : "s"} (unsaved)`);
          }}
        />
      )}
      <IdeErrorExplainer
        open={bugDoctorOpen}
        message={bugDoctorMsg}
        contextCode={activeContent}
        onClose={() => setBugDoctorOpen(false)}
        onApplyFix={(code) => {
          if (activeFile) setDirty(d => ({ ...d, [activeFile.id]: code }));
          setBugDoctorOpen(false);
          toast.success("Fix applied to editor");
        }}
      />
      {approval && (
        <IdeApprovalGate
          open={true}
          title={approval.title}
          changes={approval.changes}
          onApprove={() => { approval.resolve(true); setApproval(null); }}
          onCancel={() => { approval.resolve(false); setApproval(null); }}
        />
      )}
      <IdeSemanticSearch
        open={semanticOpen}
        files={files.map(f => ({ id: f.id, path: f.path, content: dirty[f.id] ?? f.content }))}
        onClose={() => setSemanticOpen(false)}
        onJump={(fileId) => { if (!openTabs.includes(fileId)) setOpenTabs(t => [...t, fileId]); setActiveFileId(fileId); }}
      />
      <IdeProjectGuide
        open={guideOpen}
        files={files.map(f => ({ id: f.id, path: f.path, content: dirty[f.id] ?? f.content, language: f.language }))}
        onClose={() => setGuideOpen(false)}
      />
      <IdeCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={[
          { id: "save", label: "Save All", shortcut: "Ctrl+S", keywords: ["save", "write", "persist"], run: () => void saveAll() },
          { id: "fuzzy", label: "Go to File", shortcut: "Ctrl+P", keywords: ["open", "find file", "fuzzy"], run: () => setFuzzyOpen(true) },
          { id: "semantic", label: "Semantic Search", shortcut: "Ctrl+Shift+F", keywords: ["search", "find", "where"], run: () => setSemanticOpen(true) },
          { id: "guide", label: "Project Guide — what to work on", shortcut: "Ctrl+G", keywords: ["next", "task", "todo", "guide"], run: () => setGuideOpen(true) },
          { id: "history", label: "Version History (time machine)", shortcut: "Ctrl+Shift+H", keywords: ["history", "undo", "restore"], run: () => setHistoryOpen(true) },
          { id: "template", label: "Scaffold from natural language", shortcut: "Ctrl+Shift+P", keywords: ["new", "create", "template", "component"], run: () => setTemplateOpen(true) },
          { id: "bug", label: "Bug Doctor — explain last error", keywords: ["error", "fix", "debug", "bug"], run: () => { setBugDoctorMsg(""); setBugDoctorOpen(true); } },
          { id: "preview", label: "Run Preview", keywords: ["run", "preview", "play"], run: () => runPreview() },
          { id: "settings", label: "Open Settings", keywords: ["config", "settings", "byok", "key"], run: () => setShowSettings(true) },
        ]}
      />
      <IdeRecoveryDialog
        open={recoveryOpen}
        ageMs={recoveryAge}
        fileCount={recoverySnap?.files.length ?? 0}
        onDiscard={() => { if (activeProject) clearAutoSave(`asher::${activeProject.id}`); setRecoveryOpen(false); }}
        onRestore={() => {
          if (!recoverySnap) return setRecoveryOpen(false);
          const map: Record<string, string> = {};
          for (const f of recoverySnap.files) map[f.id] = f.content;
          setDirty(map);
          if (recoverySnap.activeFileId) setActiveFileId(recoverySnap.activeFileId);
          setRecoveryOpen(false);
          toast.success("Restored auto-saved work");
        }}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────
function ZipImportReviewDialog({
  session,
  currentBranchName,
  importing,
  onClose,
  onActionChange,
  onImportCurrent,
  onImportNewBranch,
}: {
  session: ZipImportSession;
  currentBranchName: string;
  importing: boolean;
  onClose: () => void;
  onActionChange: (path: string, action: ZipImportAction) => void;
  onImportCurrent: () => void;
  onImportNewBranch: () => void;
}) {
  const createCount = session.entries.filter((entry) => entry.action === "create").length;
  const overwriteCount = session.entries.filter((entry) => entry.action === "overwrite").length;
  const skipCount = session.entries.filter((entry) => entry.action === "skip").length;
  const rejectedCount = session.entries.filter((entry) => entry.action === "reject").length;
  const importableCount = createCount + overwriteCount;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border/20 bg-card/80 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/20 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-light uppercase tracking-[0.28em] text-muted-foreground/70">
              <ShieldCheck className="h-3 w-3" /> ZIP Import Review
            </p>
            <h3 className="mt-1 truncate text-sm font-light tracking-wide text-foreground">{session.archiveName}</h3>
          </div>
          <button onClick={onClose} disabled={importing} className="text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Close ZIP import review">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-border/20 bg-border/20 sm:grid-cols-5">
          {[
            ["Scanned", session.totalEntries],
            ["Create", createCount],
            ["Overwrite", overwriteCount],
            ["Skipped", skipCount],
            ["Rejected", rejectedCount],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-card/70 px-3 py-2">
              <p className="text-[8px] font-light uppercase tracking-[0.22em] text-muted-foreground/60">{label}</p>
              <p className="mt-1 text-sm font-extralight text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-border/20 px-4 py-2 text-[10px] font-light leading-relaxed text-muted-foreground/75">
          Branch target: <span className="text-foreground/80">{currentBranchName}</span> · Text staged: {(session.acceptedBytes / 1024).toFixed(1)} KB · blocked paths, binary assets, secrets, oversized files, and traversal attempts stay out.
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-card/95 text-[8px] uppercase tracking-[0.2em] text-muted-foreground/60 backdrop-blur-md">
              <tr className="border-b border-border/20">
                <th className="px-3 py-2 font-light">Action</th>
                <th className="px-3 py-2 font-light">Path</th>
                <th className="hidden px-3 py-2 font-light sm:table-cell">Lang</th>
                <th className="hidden px-3 py-2 font-light md:table-cell">Size</th>
                <th className="px-3 py-2 font-light">Signal</th>
              </tr>
            </thead>
            <tbody>
              {session.entries.map((entry, index) => {
                const locked = entry.action === "reject";
                return (
                  <tr key={`${entry.path}-${index}`} className="border-b border-border/10 hover:bg-foreground/5">
                    <td className="px-3 py-2 align-top">
                      {locked ? (
                        <span className="rounded border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.16em] text-destructive/90">Reject</span>
                      ) : (
                        <select
                          value={entry.action}
                          onChange={(event) => onActionChange(entry.path, event.target.value as ZipImportAction)}
                          disabled={importing}
                          className="rounded border border-border/20 bg-background/70 px-1.5 py-1 text-[9px] uppercase tracking-[0.12em] text-foreground outline-none focus:border-foreground/40 disabled:opacity-40"
                        >
                          <option value="create">Create</option>
                          <option value="overwrite">Overwrite</option>
                          <option value="skip">Skip</option>
                        </select>
                      )}
                    </td>
                    <td className="max-w-[280px] break-all px-3 py-2 align-top font-mono text-foreground/85">{entry.path}</td>
                    <td className="hidden px-3 py-2 align-top text-muted-foreground/70 sm:table-cell">{entry.language}</td>
                    <td className="hidden px-3 py-2 align-top text-muted-foreground/70 md:table-cell">{entry.bytes ? `${(entry.bytes / 1024).toFixed(1)} KB` : "—"}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground/70">{entry.reason || entry.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] font-light uppercase tracking-[0.18em] text-muted-foreground/60">
            {importableCount} file{importableCount === 1 ? "" : "s"} armed for import
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={onClose} disabled={importing} className="rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] hover:bg-foreground/5 disabled:opacity-40">Cancel</button>
            <button onClick={onImportCurrent} disabled={importing || importableCount === 0} className="inline-flex items-center gap-1.5 rounded-md border border-border/30 bg-card/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] hover:border-foreground/40 disabled:opacity-40">
              {importing && <Loader2 className="h-3 w-3 animate-spin" />} Import Here
            </button>
            <button onClick={onImportNewBranch} disabled={importing || importableCount === 0} className="inline-flex items-center gap-1.5 rounded-md border border-foreground/25 bg-foreground/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-foreground/15 disabled:opacity-40">
              <GitBranch className="h-3 w-3" /> New Branch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase">New Project</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onCreate(name.trim()); }}
          placeholder="Project name"
          className="w-full rounded-md border border-border/20 bg-card/40 px-3 py-2 text-xs font-light focus:border-foreground/40 focus:outline-none"
        />
        <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">
          No template needed. Asherin Code adapts to whatever you describe — vanilla HTML, React, TypeScript, automation scripts, dashboards, charts, anything. Just tell it what to build.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/5">Cancel</button>
          <button onClick={() => name.trim() && onCreate(name.trim())} disabled={!name.trim()} className="rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/20 disabled:opacity-40">Create</button>
        </div>
      </div>
    </div>
  );
}

function BYOKSettings({ onClose, provider, model, apiKey, setProvider, setModel, setApiKey }: any) {
  const prov = ASHER_CODE_PROVIDERS.find(p => p.id === provider) || ASHER_CODE_PROVIDERS[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase">BYOK — Bring Your Own Key</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mb-3">Asher IDE never uses platform AI keys. Your key stays in browser local storage and is sent only to your chosen provider via our edge proxy. Never logged.</p>
        <label className="block text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">Provider</label>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); const p = ASHER_CODE_PROVIDERS.find(x => x.id === e.target.value); if (p) setModel(p.models[0].id); }} className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light mb-3 focus:border-foreground/40 focus:outline-none">
          {ASHER_CODE_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <label className="block text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">Model</label>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light mb-3 focus:border-foreground/40 focus:outline-none">
          {prov.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <label className="block text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">API Key</label>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-... / your provider key" className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light focus:border-foreground/40 focus:outline-none" />
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/20">Done</button>
        </div>
      </div>
    </div>
  );
}

function PublishDialog({ onClose, onPublish, defaultName }: { onClose: () => void; onPublish: (n: string, i: string, v: any) => void; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [icon, setIcon] = useState("◈");
  const [vis, setVis] = useState<"private" | "team" | "organization" | "public">("private");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase">Publish as Asher Tab</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <label className="block text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">Tab Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light mb-3 focus:border-foreground/40 focus:outline-none" />
        <label className="block text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">Icon (Unicode)</label>
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light mb-3 focus:border-foreground/40 focus:outline-none" />
        <label className="block text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">Visibility</label>
        <select value={vis} onChange={(e) => setVis(e.target.value as any)} className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light focus:border-foreground/40 focus:outline-none">
          <option value="private">Private — only me</option>
          <option value="team">Team</option>
          <option value="organization">Organization</option>
          <option value="public">Public — marketplace</option>
        </select>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/5">Cancel</button>
          <button onClick={() => onPublish(name.trim(), icon, vis)} disabled={!name.trim()} className="rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/80 hover:bg-foreground/20 disabled:opacity-40">Publish</button>
        </div>
      </div>
    </div>
  );
}
