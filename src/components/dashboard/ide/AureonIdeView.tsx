import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Code2, PanelLeftClose, PanelLeftOpen, Globe, FileCode, FolderKanban, Save, Loader2, Download, Search, Terminal as TerminalIcon, MessageSquare, ChevronDown, ChevronUp, MoreHorizontal, Plus, Bot } from "lucide-react";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import IdeFileTree, { type IdeFile, getLanguage } from "./IdeFileTree";
import IdeCodeEditor from "./IdeCodeEditor";
import IdeChatPanel from "./IdeChatPanel";
import IdeTerminal from "./IdeTerminal";
import IdePreviewPanel from "./IdePreviewPanel";
import IdeSessionManager, { type IdeSession } from "./IdeSessionManager";
import IdeSearchPanel from "./IdeSearchPanel";
import IdeQuickOpen from "./IdeQuickOpen";
import IdeGitPanel from "./IdeGitPanel";
import IdeAgentsPanel from "./IdeAgentsPanel";
import { detectCrash, buildCrashPrompt, type CrashEvent } from "@/lib/ide/crashHook";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import { useCodeRag } from "@/hooks/useCodeRag";
import {
  IdeHistoryPanel,
  IdeErrorExplainer,
  IdeTemplateLauncher,
  IdeFuzzyFinder,
  IdeApprovalGate,
  IdeModelRouterBadge,
  IdeValidatorBadge,
  IdeCheckpointPanel,
  IdeModeToggle,
  IdeChangedFilesPanel,
  IdeBuildStatusPanel,
  type PlannedChange,
} from "@/components/ide-shared";
import { changedFiles } from "@/lib/ide";
import { snapshotIfChanged, routeTask, animateInsert, animateReplace, type IdeModelId, type RoutingDecision } from "@/lib/ide";
import { callAsherCodeAi, extractCodeBlock } from "@/lib/asherCode/aiClient";
import { routeGoal } from "@/lib/asherCode/goalRouter";
import { History, Stethoscope, Wand2, Cpu, Brain, Zap, Bug, Eye, ScrollText, GitCommit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startQueueWorker as zqStart, registerHandler as zqRegister, enqueue as zqEnqueue, type QueuedJob } from "@/lib/zanoem/offlineQueue";
import { autoFixUntilClean, type AutoFixFile } from "@/lib/zanoem/autoFix";
import { needsHumanDecision as zanoemNeedsDecision, buildAutopilotReply as zanoemBuildReply, logDecision as zanoemLogDecision } from "@/lib/zanoem/decisionLog";
import { IDE_BUILD_CONTRACT, parseIdeBuildStatus, buildCritiqueContinuationReply } from "@/lib/ide/completionLoop";
import ZanoemDecisionLog from "@/components/asher/ZanoemDecisionLog";
import { extractZanoemCodeFiles, type ZanoemCodeFile } from "@/components/dashboard/zali/zanoemOutput";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type CenterTab = "code" | "preview" | "workflow";
type MobilePanel = "explorer" | "editor" | "chat" | "terminal";
type LeftTab = "files" | "search" | "sessions" | "git" | "agents";

const STARTER_FILES: IdeFile[] = [
  {
    id: "src", name: "src", type: "folder", children: [
      { id: "app", name: "App.tsx", type: "file", content: `import React from "react";\n\nfunction App() {\n  return (\n    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">\n      <h1 className="text-4xl font-bold">Hello World</h1>\n    </div>\n  );\n}\n\nexport default App;` },
      { id: "main", name: "main.tsx", type: "file", content: `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);` },
      { id: "css", name: "index.css", type: "file", content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: Inter, sans-serif;\n}` },
    ],
  },
  { id: "pkg", name: "package.json", type: "file", content: `{\n  "name": "aureon-project",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  },\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  },\n  "devDependencies": {\n    "vite": "^5.4.0",\n    "@vitejs/plugin-react": "^4.3.0",\n    "tailwindcss": "^3.4.0",\n    "typescript": "^5.5.0"\n  }\n}` },
  { id: "tsconfig", name: "tsconfig.json", type: "file", content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "jsx": "react-jsx",\n    "strict": true\n  }\n}` },
  { id: "indexhtml", name: "index.html", type: "file", content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Aureon Project</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>` },
];

const EMPTY_PROJECT_FILES: IdeFile[] = [];

function flattenFiles(files: IdeFile[]): IdeFile[] {
  const result: IdeFile[] = [];
  for (const f of files) {
    if (f.type === "file") result.push(f);
    if (f.children) result.push(...flattenFiles(f.children));
  }
  return result;
}

function normalizeGeneratedFilePath(path: string): string | null {
  const cleaned = String(path || "")
    .replace(/[`'"<>]/g, "")
    .replace(/^\s*(?:file|path|filename)\s*:\s*/i, "")
    .replace(/^\.?\//, "")
    .replace(/\\/g, "/")
    .trim();
  if (!cleaned || cleaned.includes("..") || cleaned.endsWith("/")) return null;
  return cleaned;
}

function responseLooksCutOff(text: string): boolean {
  if (!text) return false;
  if (/GENERATION_INCOMPLETE|MAX_TOKENS|finish_reason\s*[:=]\s*(?:length|max_tokens)/i.test(text)) return true;
  if (((text.match(/```/g) || []).length % 2) === 1) return true;
  if (/\{\s*"files"\s*:\s*\[/i.test(text) && !/\]\s*}\s*```?\s*$/s.test(text.trim())) return true;
  if (/\b(import|export|const|let|function|class|return)\b[^\n]*$/i.test(text.trim()) && !/[;})\]`.]\s*$/.test(text.trim())) return true;
  return false;
}

function applyGeneratedFilesToTree(tree: IdeFile[], generated: ZanoemCodeFile[]): { next: IdeFile[]; primaryId: string | null; applied: number } {
  const clone = JSON.parse(JSON.stringify(tree)) as IdeFile[];
  let primaryId: string | null = null;
  let applied = 0;

  const collectByName = (nodes: IdeFile[], name: string, acc: IdeFile[] = []): IdeFile[] => {
    for (const node of nodes) {
      if (node.type === "file" && node.name === name) acc.push(node);
      if (node.children) collectByName(node.children, name, acc);
    }
    return acc;
  };

  const updateById = (nodes: IdeFile[], id: string, content: string): boolean => {
    for (const node of nodes) {
      if (node.id === id && node.type === "file") {
        node.content = content;
        node.language = getLanguage(node.name);
        return true;
      }
      if (node.children && updateById(node.children, id, content)) return true;
    }
    return false;
  };

  const upsertAtPath = (nodes: IdeFile[], parts: string[], content: string): string => {
    const [head, ...rest] = parts;
    if (!head) return "";
    if (rest.length === 0) {
      let file = nodes.find((n) => n.type === "file" && n.name === head);
      if (!file) {
        file = { id: crypto.randomUUID(), name: head, type: "file", language: getLanguage(head), content };
        nodes.push(file);
      } else {
        file.content = content;
        file.language = getLanguage(head);
      }
      return file.id;
    }
    let folder = nodes.find((n) => n.type === "folder" && n.name === head);
    if (!folder) {
      folder = { id: crypto.randomUUID(), name: head, type: "folder", children: [] };
      nodes.push(folder);
    }
    folder.children ||= [];
    return upsertAtPath(folder.children, rest, content);
  };

  for (const file of generated) {
    const normalized = normalizeGeneratedFilePath(file.filename);
    if (!normalized || !file.content?.trim()) continue;
    const parts = normalized.split("/").filter(Boolean);
    const basename = parts[parts.length - 1];
    let id: string | null = null;

    if (parts.length === 1) {
      const existing = collectByName(clone, basename);
      if (existing.length === 1) {
        id = existing[0].id;
        updateById(clone, id, file.content);
      }
    }

    if (!id) id = upsertAtPath(clone, parts, file.content);
    if (id) {
      primaryId ||= id;
      applied += 1;
    }
  }

  return { next: clone, primaryId, applied };
}

// Credit system
const MAX_CREDITS_PER_HOUR = 200;

function useCredits() {
  const [credits, setCredits] = useState<{ timestamps: number[] }>({ timestamps: [] });
  const getRemaining = useCallback(() => {
    const now = Date.now();
    const hourAgo = now - 3600_000;
    return MAX_CREDITS_PER_HOUR - credits.timestamps.filter(t => t > hourAgo).length;
  }, [credits]);
  const useCredit = useCallback(() => {
    const now = Date.now();
    const hourAgo = now - 3600_000;
    setCredits(prev => ({ timestamps: [...prev.timestamps.filter(t => t > hourAgo), now] }));
  }, []);
  return { remaining: getRemaining(), useCredit, maxCredits: MAX_CREDITS_PER_HOUR };
}

const AureonIdeView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { remaining: creditsRemaining, useCredit, maxCredits } = useCredits();

  // Session state
  const [sessions, setSessions] = useState<IdeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // File state
  const [files, setFiles] = useState<IdeFile[]>(EMPTY_PROJECT_FILES);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Undo/Redo
  const fileHistoryRef = useRef<IdeFile[][]>([EMPTY_PROJECT_FILES]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback((newFiles: IdeFile[]) => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    const next = fileHistoryRef.current.slice(0, historyIndexRef.current + 1);
    next.push(JSON.parse(JSON.stringify(newFiles)));
    if (next.length > 100) next.shift();
    fileHistoryRef.current = next;
    historyIndexRef.current = next.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    skipHistoryRef.current = true;
    setFiles(JSON.parse(JSON.stringify(fileHistoryRef.current[historyIndexRef.current])));
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= fileHistoryRef.current.length - 1) return;
    historyIndexRef.current += 1;
    skipHistoryRef.current = true;
    setFiles(JSON.parse(JSON.stringify(fileHistoryRef.current[historyIndexRef.current])));
  }, []);

  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => pushHistory(files), 1000);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [files, pushHistory]);

  // ── ZANOEM autopilot state (mirrors Asher IDE checkboxes) ──
  // Separate localStorage keys from Asher so each IDE preserves its own toggle state.
  const [zanoemMode, setZanoemMode] = useState(() => localStorage.getItem("aureonIde.zanoemMode") === "1");
  const [autopilotZanoem, setAutopilotZanoem] = useState(() => localStorage.getItem("aureonIde.autopilotZanoem") === "1");
  const [autoDebug, setAutoDebug] = useState(() => localStorage.getItem("aureonIde.autoDebug") !== "0");       // default ON
  const [autoUiDebug, setAutoUiDebug] = useState(() => localStorage.getItem("aureonIde.autoUiDebug") !== "0"); // default ON
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem("aureonIde.autoApprove") !== "0"); // default ON
  const [decisionLogOpen, setDecisionLogOpen] = useState(false);
  const autopilotRoundsRef = useRef(0);
  const AUTOPILOT_MAX_ROUNDS = 8;
  useEffect(() => { localStorage.setItem("aureonIde.zanoemMode", zanoemMode ? "1" : "0"); }, [zanoemMode]);
  useEffect(() => { localStorage.setItem("aureonIde.autopilotZanoem", autopilotZanoem ? "1" : "0"); }, [autopilotZanoem]);
  useEffect(() => { localStorage.setItem("aureonIde.autoDebug", autoDebug ? "1" : "0"); }, [autoDebug]);
  useEffect(() => { localStorage.setItem("aureonIde.autoUiDebug", autoUiDebug ? "1" : "0"); }, [autoUiDebug]);
  useEffect(() => { localStorage.setItem("aureonIde.autoApprove", autoApprove ? "1" : "0"); }, [autoApprove]);

  // Refs for offline queue handlers (run outside React's render cycle)
  const filesRefAureon = useRef(files);
  const autopilotZanoemRef = useRef(autopilotZanoem);
  const autoDebugRef = useRef(autoDebug);
  const autoUiDebugRef = useRef(autoUiDebug);
  const lastIntentRef = useRef<string>("");
  const lastAssistantRef = useRef<string>("");
  const autopilotEnqueueGuardRef = useRef(false);
  const autopilotTriggerRef = useRef<string>("");
  // sendChatMessage is declared further down — route through a ref so the
  // queue worker can call it once it exists.
  const sendZanoemTurnRef = useRef<((prompt: string) => Promise<void>) | null>(null);
  useEffect(() => { filesRefAureon.current = files; }, [files]);
  useEffect(() => { autopilotZanoemRef.current = autopilotZanoem; }, [autopilotZanoem]);
  useEffect(() => { autoDebugRef.current = autoDebug; }, [autoDebug]);
  useEffect(() => { autoUiDebugRef.current = autoUiDebug; }, [autoUiDebug]);

  const activeByok = useCallback(() => {
    try {
      const cached = localStorage.getItem("aureon_byok_active");
      const parsed = cached ? JSON.parse(cached) : null;
      if (parsed?.provider && parsed.provider !== "default" && parsed?.model) {
        return { provider: parsed.provider, model: parsed.model };
      }
    } catch { /* ignore */ }
    return { provider: "google", model: "gemini-2.5-flash" };
  }, []);

  const applyAureonDebuggerFix = useCallback(async (file: AutoFixFile, issues: { file: string; line?: number; message: string }[]) => {
    const ownIssues = issues.filter((i) => i.file === file.name);
    const flat = flattenFiles(filesRefAureon.current);
    const live = flat.find((f) => f.id === file.id || f.name === file.name);
    const current = live?.content ?? file.content;
    // Scan-all mode: with no validator errors we still ask the model to
    // audit logic across the whole file (bugs, races, edge cases).
    const diagnostic = ownIssues.length > 0
      ? ownIssues.map((e) => `${e.file}:${e.line ?? "?"} — ${e.message}`).join("\n")
      : `[LOGIC AUDIT] No validator errors in ${file.name}. Review the entire file for: latent bugs, race conditions, unhandled errors, off-by-one errors, missing null checks, dead code, security flaws, and broken logic. If the file is already correct, return it UNCHANGED. Only rewrite if you find a real defect.`;

    let corrected: string | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await callAsherCodeAi({ mode: "fix", byok: activeByok(), code: current, language: file.language, error: diagnostic });
        corrected = extractCodeBlock(response.reply || "").trim();
        if (corrected && corrected !== current.trim()) break;
        const forced = await callAsherCodeAi({
          mode: "fix",
          byok: activeByok(),
          code: current,
          language: file.language,
          error: `${diagnostic}\n\n[REWRITE REQUIRED] Return ONLY the COMPLETE corrected file inside one fenced code block. Do not skip.`,
        });
        corrected = extractCodeBlock(forced.reply || "").trim();
        if (corrected && corrected !== current.trim()) break;
        // Scan-all mode: AI confirms the file is already clean — treat as success.
        if (ownIssues.length === 0) return true;
        return false;
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e || "");
        if (!/429|rate.?limit|quota|too.?many.?requests/i.test(msg) || attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, (2 ** attempt) * 1000 + Math.floor(Math.random() * 600)));
      }
    }
    if (!corrected || corrected === current.trim()) {
      if (ownIssues.length === 0) return true;
      throw lastErr ?? new Error("No corrected code produced");
    }

    const updateInTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.map((n) => {
        if (n.id === file.id || n.name === file.name) return { ...n, content: corrected };
        if (n.children) return { ...n, children: updateInTree(n.children) };
        return n;
      });
    setFiles((prev) => {
      const next = updateInTree(prev);
      filesRefAureon.current = next;
      return next;
    });
    toast({ title: "Auto-applied debugger fix", description: file.name });
    return true;
  }, [activeByok, toast]);

  // ── ZANOEM offline autopilot worker (cross-IDE) ──
  // Drains persisted jobs even if the user closes the tab / loses wifi.
  // Vision jobs are best-effort here (Aureon's preview iframe is owned by
  // a child component); auto-fix runs the validator + dispatches a fix turn
  // through Aureon's own chat backend when ZANOEM mode is on.
  useEffect(() => {
    zqRegister("vision", async (_job: QueuedJob<{ intent: string; recentAssistant: string; projectRef?: string }>) => {
      if (!autopilotZanoemRef.current || !autoUiDebugRef.current) return;
      // Aureon's preview iframe is encapsulated; we still log the verdict so the
      // user can see it in the console / future panels.
      console.info("[zanoem] Aureon vision job (preview iframe owned by child component — skipping screenshot pass)");
    });

    zqRegister("autofix", async (_job: QueuedJob<{ projectRef?: string }>) => {
      if (!autopilotZanoemRef.current || !autoDebugRef.current) return;
      const collectFlat = (): AutoFixFile[] => {
        const flat: AutoFixFile[] = [];
        const walk = (nodes: IdeFile[]) => {
        for (const n of nodes) {
          if (n.children) walk(n.children);
          else flat.push({ id: n.id, name: n.name, content: n.content || "", language: getLanguage(n.name) });
        }
      };
        walk(filesRefAureon.current);
        return flat;
      };
      const result = await autoFixUntilClean({
        files: collectFlat,
        applyFileFix: applyAureonDebuggerFix,
        runZanoemTurn: async (prompt) => { if (sendZanoemTurnRef.current) await sendZanoemTurnRef.current(prompt); },
        maxPasses: 20,
        swarmConcurrency: 2,
        perAgentDelayMs: 1000,
        scanAllFiles: true,
        shouldPause: () => swarmPausedRef.current,
        onPassComplete: (pass, remaining, applied) => {
          if (remaining > 0) {
            toast({ title: `◈ Pass ${pass} complete`, description: `${remaining} issue(s) remain — swarm re-engaging (${applied} fix(es) applied)` });
          } else {
            toast({ title: "◉ Codebase clean", description: `No red lines remaining after ${pass} pass(es)` });
          }
        },
        onAgentSpawn: (a) => {
          setSwarmAgents((prev) => [...prev, { ...a, status: "working" }]);
          agentFileRef.current.set(a.id, a.file);
          fileLocksRef.current.add(a.file);
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
          setTimeout(() => {
            setSwarmAgents((prev) => prev.filter((a) => a.id !== id));
            agentFileRef.current.delete(id);
          }, 1200);
        },
        onProgress: (pass, n) => {
          if (n > 0) {
            toast({ title: `ZANOEM Auto-Fix pass ${pass}`, description: `Spawning ${n} agent${n === 1 ? "" : "s"}` });
            const evId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `ev_${Date.now()}_${Math.random()}`;
            setWorkflowEvents((prev) => [...prev.slice(-499), { id: evId, ts: Date.now(), kind: "pass", pass, issueCount: n }]);
          }
        },
      });
      // Hard-clear stragglers when the loop ends.
      setSwarmAgents([]);
      fileLocksRef.current.clear();
      agentFileRef.current.clear();
      if (result.clean) toast({ title: "ZANOEM Auto-Fix: clean", description: `${result.passes} pass${result.passes === 1 ? "" : "es"}` });
      else console.info("[zanoem] Aureon validator stopped:", result.finalErrorCount, "error(s) remain");
    });
    zqStart({ intervalMs: 2500 });
  }, [applyAureonDebuggerFix, toast]);

  // Panel state — simplified defaults
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(false); // AI chat hidden by default
  const [bottomOpen, setBottomOpen] = useState(false); // Terminal hidden by default
  const [centerTab, setCenterTab] = useState<CenterTab>("code");

  // ── SWARM / WORKFLOW MAP STATE (ported from Asher IDE) ──────────────
  // Live registry of per-issue debugger agents. One agent per file.
  const [swarmAgents, setSwarmAgents] = useState<SwarmAgent[]>([]);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);
  const [fileWorkflowStats, setFileWorkflowStats] = useState<Record<string, FileWorkflowStat>>({});
  const fileLocksRef = useRef<Set<string>>(new Set());
  const agentFileRef = useRef<Map<string, string>>(new Map());
  // Pause control for the swarm autofix loop.
  const [swarmPaused, setSwarmPaused] = useState(false);
  const swarmPausedRef = useRef(false);
  useEffect(() => { swarmPausedRef.current = swarmPaused; }, [swarmPaused]);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("files");

  // Mobile
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ── Pro tools state (shared IDE upgrade pack) ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const [bugDoctorOpen, setBugDoctorOpen] = useState(false);
  const [bugDoctorMsg, setBugDoctorMsg] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [fuzzyOpen, setFuzzyOpen] = useState(false);
  const [approval, setApproval] = useState<{ title: string; changes: PlannedChange[]; resolve: (ok: boolean) => void } | null>(null);
  const [modelOverride, setModelOverride] = useState<IdeModelId | null>(null);
  const [chatDraft, setChatDraft] = useState("");

  // Auto-Approve: when enabled, any pending approval gate is auto-accepted instantly.
  useEffect(() => {
    if (autoApprove && approval) {
      const a = approval;
      setApproval(null);
      a.resolve(true);
    }
  }, [autoApprove, approval]);

  // Terminal output for AI context (also auto-detects errors → Bug Doctor)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const handleTerminalOutput = useCallback((output: string) => {
    setTerminalOutput(prev => [...prev.slice(-20), output]);
    if (/^(error|uncaught|unhandled|exception|traceback|panic|fatal)/i.test(output) ||
        /\b[A-Z][a-z]+Error: /.test(output) || /Cannot read propert/i.test(output)) {
      if (!bugDoctorOpen) { setBugDoctorMsg(output.slice(0, 600)); setBugDoctorOpen(true); }
    }
  }, [bugDoctorOpen]);

  const routeDecision: RoutingDecision = useMemo(
    () => routeTask(chatDraft || (chatMessages[chatMessages.length - 1]?.content ?? ""), modelOverride ?? undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatDraft, chatMessages.length, modelOverride]
  );

  // Derived
  const allFiles = useMemo(() => flattenFiles(files), [files]);
  const openFiles = useMemo(() => openFileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as IdeFile[], [allFiles, openFileIds]);
  const activeFile = useMemo(() => allFiles.find(f => f.id === activeFileId), [activeFileId, allFiles]);

  // ── Phase 4: RAG codebase memory (pgvector-backed) ──
  // Re-uses the active session as the project scope so embeddings follow the user's project.
  const rag = useCodeRag(activeSessionId);
  // Auto-index project files into pgvector whenever the file set changes (debounced).
  useEffect(() => {
    if (!activeSessionId) return;
    const payload = allFiles
      .filter(f => f.type === "file" && typeof f.content === "string" && (f.content?.length ?? 0) > 20)
      .map(f => ({ id: f.id, path: f.name, content: f.content ?? "", language: getLanguage(f.name) }));
    if (!payload.length) return;
    rag.indexFilesDebounced(payload, 6000);
  }, [files, activeSessionId, allFiles, rag]);


  useEffect(() => {
    if (isMobile) { setLeftOpen(false); setRightOpen(false); setBottomOpen(false); }
  }, [isMobile]);

  // ── Session CRUD ──
  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("ide_sessions").select("id, name, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (error) {
      console.warn("[ide] failed to load sessions", error);
      setSessions([]);
    } else {
      setSessions((data as IdeSession[]) ?? []);
    }
    setSessionsLoading(false);
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadSession = useCallback(async (id: string) => {
    if (!user?.id) return;
    const { data, error } = await supabase.from("ide_sessions").select("*").eq("id", id).eq("user_id", user.id).single();
    if (error) {
      console.warn("[ide] failed to load session", error);
      toast({ title: "Project failed to open", description: "The project data could not be loaded.", variant: "destructive" });
      return;
    }
    if (data) {
      const loadedFiles = Array.isArray(data.files) ? data.files as unknown as IdeFile[] : STARTER_FILES;
      const loadedFlat = flattenFiles(loadedFiles);
      const nextActiveId = data.active_file_id && loadedFlat.some(f => f.id === data.active_file_id)
        ? data.active_file_id
        : loadedFlat[0]?.id ?? null;
      setFiles(loadedFiles);
      setOpenFileIds((data.open_file_ids ?? []).filter((id: string) => loadedFlat.some(f => f.id === id)));
      setActiveFileId(nextActiveId);
      fileHistoryRef.current = [JSON.parse(JSON.stringify(loadedFiles))];
      historyIndexRef.current = 0;
      const cfg = data.panel_config as any;
      if (cfg && !isMobile) { setLeftOpen(cfg.leftOpen ?? true); setRightOpen(cfg.rightOpen ?? false); setBottomOpen(cfg.bottomOpen ?? false); }
      setActiveSessionId(id);
      const savedChat = cfg?.chatMessages as ChatMsg[] | undefined;
      setChatMessages(savedChat?.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) ?? []);
      setLeftTab("files");
      if (isMobile) setMobilePanel("editor");
    }
  }, [isMobile, toast, user?.id]);

  const autoOpenedSessionRef = useRef(false);

  const createSession = useCallback(async () => {
    if (!user) return;
    const starterCopy = JSON.parse(JSON.stringify(STARTER_FILES)) as IdeFile[];
    const { data, error } = await supabase.from("ide_sessions").insert({
      user_id: user.id,
      name: `Project ${sessions.length + 1}`,
      files: starterCopy as any,
      open_file_ids: ["app"],
      active_file_id: "app",
      panel_config: { leftOpen: true, rightOpen: false, bottomOpen: false, chatMessages: [] } as any,
    }).select("id, name, updated_at").single();
    if (error) {
      console.warn("[ide] failed to create session", error);
      toast({ title: "Project failed to create", description: "The IDE could not create a clean project workspace.", variant: "destructive" });
      return;
    }
    if (data) {
      autoOpenedSessionRef.current = true;
      setSessions(prev => [data as IdeSession, ...prev]);
      await loadSession(data.id);
      setCenterTab("preview");
    }
  }, [user, sessions.length, loadSession, toast]);

  const deleteSession = useCallback(async (id: string) => {
    // Phase 5: Purge local IndexedDB checkpoints and localStorage autosave so
    // deleting a project doesn't leave ghost recovery snapshots behind.
    try {
      const { listCheckpoints, deleteCheckpoint } = await import("@/lib/ide/checkpoints");
      const { clearAutoSave } = await import("@/lib/ide/autoSave");
      const ckpts = await listCheckpoints("aureon", id);
      await Promise.all(ckpts.map(c => c.id ? deleteCheckpoint(c.id) : Promise.resolve()));
      clearAutoSave(id);
    } catch (e) {
      console.warn("[ide] local cleanup failed", e);
    }
    await supabase.from("ide_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); setFiles(EMPTY_PROJECT_FILES); setOpenFileIds([]); setActiveFileId(null); }
  }, [activeSessionId]);

  const renameSession = useCallback(async (id: string, name: string) => {
    await supabase.from("ide_sessions").update({ name }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  const saveSession = useCallback(async () => {
    if (!activeSessionId || !user) return;
    setSaving(true);
    await supabase.from("ide_sessions").update({ files: files as any, open_file_ids: openFileIds, active_file_id: activeFileId, panel_config: { leftOpen, rightOpen, bottomOpen, chatMessages } as any }).eq("id", activeSessionId);
    setSaving(false);
    toast({ title: "Session saved" });
  }, [activeSessionId, user, files, openFileIds, activeFileId, leftOpen, rightOpen, bottomOpen, chatMessages, toast]);

  // Auto-save every 30s
  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(() => {
      supabase.from("ide_sessions").update({ files: files as any, open_file_ids: openFileIds, active_file_id: activeFileId, panel_config: { leftOpen, rightOpen, bottomOpen, chatMessages } as any }).eq("id", activeSessionId);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeSessionId, files, openFileIds, activeFileId, leftOpen, rightOpen, bottomOpen, chatMessages]);

  // Keyboard shortcuts (simplified)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveSession(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "p") { e.preventDefault(); setFuzzyOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") { e.preventDefault(); setTemplateOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "h" && e.shiftKey) { e.preventDefault(); setHistoryOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); setLeftOpen(p => !p); }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") { e.preventDefault(); setBottomOpen(p => !p); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") { e.preventDefault(); handleRedo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveSession, handleUndo, handleRedo]);

  // ── Auto-snapshot active file (infinite history, IndexedDB) ──
  useEffect(() => {
    if (!activeSessionId || !activeFileId) return;
    const file = allFiles.find(f => f.id === activeFileId);
    if (!file?.content) return;
    const t = setTimeout(() => {
      void snapshotIfChanged({
        scope: "aureon",
        projectId: activeSessionId,
        fileId: activeFileId,
        filePath: file.name,
        content: file.content!,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [files, activeFileId, activeSessionId, allFiles]);

  // ── Pro tools helpers ──
  const requestApproval = useCallback((title: string, changes: PlannedChange[]): Promise<boolean> => {
    return new Promise(resolve => setApproval({ title, changes, resolve }));
  }, []);

  const handleScaffold = useCallback(async (result: { kind: string; name: string; files: { path: string; content: string; language: string }[]; primary: string }) => {
    const changes: PlannedChange[] = result.files.map(f => ({
      path: f.path, action: "create", content: f.content, language: f.language,
    }));
    const ok = await requestApproval(`${result.kind} ${result.name}`, changes);
    if (!ok) return;
    // Apply: create each file at the root for simplicity
    for (const f of result.files) {
      const newFile: IdeFile = { id: crypto.randomUUID(), name: f.path.split("/").pop() ?? f.path, type: "file", content: f.content };
      setFiles(prev => [...prev, newFile]);
      if (f.path === result.primary) {
        setOpenFileIds(prev => [...prev, newFile.id]);
        setActiveFileId(newFile.id);
      }
    }
    toast({ title: "Scaffolded", description: `Created ${result.files.length} file(s)` });
  }, [requestApproval, toast]);


  // ── File operations ──
  const selectFile = (file: IdeFile) => {
    if (!openFileIds.includes(file.id)) setOpenFileIds(prev => [...prev, file.id]);
    setActiveFileId(file.id);
    setCenterTab("code");
    if (isMobile) setMobilePanel("editor");
  };

  const closeTab = (id: string) => {
    setOpenFileIds(prev => {
      const next = prev.filter(fid => fid !== id);
      if (activeFileId === id) setActiveFileId(next[next.length - 1] ?? null);
      return next;
    });
  };

  const updateContent = (id: string, content: string) => {
    const updateInTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.map(n => {
        if (n.id === id) return { ...n, content };
        if (n.children) return { ...n, children: updateInTree(n.children) };
        return n;
      });
    setFiles(prev => updateInTree(prev));
  };

  // Find a file's current content (for animateReplace fade-out source).
  const findContent = (id: string, nodes: IdeFile[] = files): string => {
    for (const n of nodes) {
      if (n.id === id && n.type === "file") return n.content ?? "";
      if (n.children) {
        const v = findContent(id, n.children);
        if (v) return v;
      }
    }
    return "";
  };

  // AI-driven write: word-by-word fade-out current → fade-in new.
  const aiWriteContent = (id: string, content: string) => {
    const current = findContent(id);
    const set = (next: string) => updateContent(id, next);
    if (current && current.trim().length > 0) animateReplace(current, content, set);
    else animateInsert(content, set);
  };

  const createFile = (parentId: string | null, name: string, type: "file" | "folder") => {
    const newFile: IdeFile = { id: crypto.randomUUID(), name, type, content: type === "file" ? "" : undefined, children: type === "folder" ? [] : undefined };
    if (!parentId) { setFiles(prev => [...prev, newFile]); }
    else {
      const addToParent = (nodes: IdeFile[]): IdeFile[] =>
        nodes.map(n => {
          if (n.id === parentId && n.type === "folder") return { ...n, children: [...(n.children || []), newFile] };
          if (n.children) return { ...n, children: addToParent(n.children) };
          return n;
        });
      setFiles(prev => addToParent(prev));
    }
    if (type === "file") selectFile(newFile);
  };

  const deleteFile = (id: string) => {
    const removeFromTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.filter(n => n.id !== id).map(n => n.children ? { ...n, children: removeFromTree(n.children) } : n);
    setFiles(prev => removeFromTree(prev));
    closeTab(id);
  };

  const renameFile = (id: string, newName: string) => {
    const renameInTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.map(n => {
        if (n.id === id) return { ...n, name: newName };
        if (n.children) return { ...n, children: renameInTree(n.children) };
        return n;
      });
    setFiles(prev => renameInTree(prev));
  };

  const moveFile = (fileId: string, targetFolderId: string | null) => {
    let movedFile: IdeFile | null = null;
    const removeFromTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.filter(n => {
        if (n.id === fileId) { movedFile = n; return false; }
        return true;
      }).map(n => n.children ? { ...n, children: removeFromTree(n.children) } : n);

    const addToTarget = (nodes: IdeFile[]): IdeFile[] => {
      if (!movedFile) return nodes;
      if (!targetFolderId) return [...nodes, movedFile];
      return nodes.map(n => {
        if (n.id === targetFolderId && n.type === "folder") return { ...n, children: [...(n.children || []), movedFile!] };
        if (n.children) return { ...n, children: addToTarget(n.children) };
        return n;
      });
    };

    setFiles(prev => {
      const after = removeFromTree(prev);
      return addToTarget(after);
    });
  };

  // Export ZIP
  const exportProject = useCallback(async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const addToZip = (nodes: IdeFile[], path: string) => {
      for (const n of nodes) {
        if (n.type === "file" && n.content !== undefined) zip.file(`${path}${n.name}`, n.content);
        if (n.children) addToZip(n.children, `${path}${n.name}/`);
      }
    };
    addToZip(files, "");
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessions.find(s => s.id === activeSessionId)?.name ?? "aureon-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Project downloaded as ZIP." });
  }, [files, sessions, activeSessionId, toast]);

  // ── Chat ──
  // When ZANOEM mode is on we prepend a "first-principles inventor" preamble.
  // When "You Decide ZANOEM" is also on, we recursively self-answer any
  // clarifying question the assistant comes back with (up to 6 rounds).
  const sendChatMessage = useCallback(async (content: string, customBrainPrompt?: string, _isAutopilotTurn = false) => {
    if (creditsRemaining <= 0) {
      toast({ title: "Credit limit reached", description: `You've used all ${maxCredits} credits this hour.`, variant: "destructive" });
      return;
    }

    // ── GOAL ROUTER (mirrors Asher IDE) ─────────────────────
    // Auto-dispatch high-level commands like "finish building this product"
    // or "fix every bug" to the swarm/autopilot — user does NOT need to
    // be on a specific file. Only fires for fresh user turns, never for
    // autopilot loops (which would otherwise re-trigger themselves).
    if (!_isAutopilotTurn) {
      const goal = routeGoal(content);
      if (goal.intent === "swarm_fix" && activeSessionId) {
        toast({ title: "◈ Goal Router → Swarm Fix", description: goal.reason });
        const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
        const ackMsg: ChatMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `◈ **Swarm dispatched.** Scanning every file in this session for bugs and validator errors. One agent per broken file, all in parallel — I'll re-engage until clean.`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, userMsg, ackMsg]);
        if (!autoDebugRef.current) autoDebugRef.current = true;
        void zqEnqueue({
          kind: "autofix",
          payload: { projectRef: activeSessionId },
          surface: "aureon_ide",
          projectRef: activeSessionId,
          ownerUserId: user?.id,
        });
        return;
      }
      if (goal.intent === "build_all") {
        toast({ title: "◈ Goal Router → Build All", description: goal.reason });
        if (!zanoemMode) setZanoemMode(true);
        if (!autopilotZanoem) { setAutopilotZanoem(true); autopilotZanoemRef.current = true; }
        autopilotRoundsRef.current = 0;
        // Fall through with an enriched prompt — ZANOEM autopilot will then
        // run round-by-round until the build is complete.
        content = `${content}\n\n[GOAL ROUTER DIRECTIVE]\nThis is a project-wide build request. Plan the complete file tree, then write each file in turn. Do not stop until every file in the plan is written and the build is shippable. After each file, list what's still missing and continue automatically.\n\n${IDE_BUILD_CONTRACT}`;
      }
    }

    useCredit();
    const isAutopilotTurn = _isAutopilotTurn;
    if (!isAutopilotTurn) {
      autopilotRoundsRef.current = 0;
      lastIntentRef.current = content;
    }
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setSuggestions([]);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    const allMsgs = [...chatMessages, userMsg].map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const contextParts: string[] = [];
    if (zanoemMode) {
      contextParts.push([
        "[ZANOEM MODE — Aureon IDE]",
        "You are ZANOEM, a first-principles software inventor. Design and ship production-grade code, never apologise, never ask for permission you can resolve yourself.",
        "Use BOLD section headers, prefer code blocks for any concrete change, and write self-documenting code with strict types and guard clauses.",
        "When you create or update files, prefix EVERY code fence with the exact project path on its own line, for example: src/App.tsx then the fenced code block. This lets the IDE write the file into Explorer/Preview automatically.",
        IDE_BUILD_CONTRACT,
      ].join("\n"));
    } else if (/\b(code|build|create|make|app|component|file|fix|rewrite|implement|page)\b/i.test(content)) {
      contextParts.push([
        "[AUREON IDE FILE-WRITE CONTRACT]",
        "If you output code, prefix each fenced code block with the exact file path on its own line.",
        "Return complete files, not fragments or diffs. If the job is not done, end with STATUS: REFINING. If done, end with STATUS: MISSION_COMPLETE.",
      ].join("\n"));
    }
    if (allFiles.length > 0) {
      contextParts.push(`[Current project files]\n${allFiles.map((f) => `- ${f.name} (${getLanguage(f.name)})`).join("\n")}`);
    }
    if (activeFile?.content) {
      contextParts.push(`[IDE Context] Currently editing: ${activeFile.name}\n\`\`\`${getLanguage(activeFile.name)}\n${activeFile.content.slice(0, 4000)}\n\`\`\``);
    }

    // ── Phase 4: RAG-grounded codebase recall ──
    // Pull the top-k most semantically similar chunks from the project's pgvector index
    // and inject them as additional grounding so the model never hallucinates symbols.
    try {
      const matches = await rag.search(content, 6);
      const cross = matches
        .filter(m => m.file_path !== activeFile?.name)
        .slice(0, 5)
        .map(m => `// ${m.file_path} · chunk ${m.chunk_index} · sim ${(m.similarity ?? 0).toFixed(2)}\n${m.content.slice(0, 900)}`)
        .join("\n\n");
      if (cross) {
        contextParts.push(`[Codebase RAG — top matches across project]\n${cross}`);
      }
    } catch { /* RAG is best-effort; never block chat */ }
    if (terminalOutput.length > 0) {
      contextParts.push(`[Terminal Output]\n${terminalOutput.join("\n")}`);
    }
    if (customBrainPrompt) {
      contextParts.push(`[Custom Instructions]\n${customBrainPrompt}`);
    }
    if (contextParts.length > 0) {
      allMsgs.unshift({ role: "user" as const, content: contextParts.join("\n\n") });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: allMsgs, mode: "code", depth: "deep", signal: controller.signal,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === assistantId) return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            return [...prev, { id: assistantId, role: "assistant", content: assistantContent, timestamp: new Date() }];
          });
        },
        onReplace: (content) => {
          assistantContent = content;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === assistantId) return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
            return [...prev, { id: assistantId, role: "assistant", content, timestamp: new Date() }];
          });
        },
        onDone: () => {
          setIsStreaming(false);
          fetchSuggestions(assistantContent).then(setSuggestions).catch(() => {});
        },
      });

      lastAssistantRef.current = assistantContent;

      const rawGenerated = extractZanoemCodeFiles(assistantContent);
      const generatedFiles = rawGenerated.length === 1 && /^snippet-\d+\./i.test(rawGenerated[0].filename) && activeFile
        ? [{ ...rawGenerated[0], filename: activeFile.name, language: getLanguage(activeFile.name) }]
        : rawGenerated;
      if (generatedFiles.length > 0) {
        const result = applyGeneratedFilesToTree(filesRefAureon.current, generatedFiles);
        if (result.applied > 0) {
          setFiles(result.next);
          filesRefAureon.current = result.next;
          const flatNext = flattenFiles(result.next);
          const primary = result.primaryId ? flatNext.find((f) => f.id === result.primaryId) : flatNext[0];
          if (primary) {
            setOpenFileIds((prev) => Array.from(new Set([...prev, primary.id])));
            setActiveFileId(primary.id);
            setCenterTab("preview");
            if (isMobile) setMobilePanel("editor");
          }
          toast({ title: "Code applied to IDE", description: `${result.applied} file${result.applied === 1 ? "" : "s"} written to Explorer/Preview.` });
        }
      }

      // ── Autopilot loop (ZAHTEN-style: continue on question OR STATUS:REFINING) ──
      const buildStatus = parseIdeBuildStatus(assistantContent);
      const cutOff = responseLooksCutOff(assistantContent);
      const shouldContinue =
        zanoemMode &&
        autopilotZanoem &&
        autopilotRoundsRef.current < AUTOPILOT_MAX_ROUNDS &&
        (zanoemNeedsDecision(assistantContent) || buildStatus === "refining" || cutOff);
      if (shouldContinue) {
        if (isAutopilotTurn && autopilotTriggerRef.current) {
          void zanoemLogDecision({
            surface: "aureon_ide",
            projectRef: activeSessionId ?? null,
            round: autopilotRoundsRef.current,
            triggerText: autopilotTriggerRef.current,
            replySent: zanoemBuildReply(autopilotRoundsRef.current, AUTOPILOT_MAX_ROUNDS),
            responseText: assistantContent,
          });
        }
        autopilotRoundsRef.current += 1;
        autopilotTriggerRef.current = assistantContent;
        const autoReply = cutOff
          ? `[IDE BUILD AUTOPILOT — pass ${autopilotRoundsRef.current}/${AUTOPILOT_MAX_ROUNDS}]\n\nYour previous response was cut off or ended with an unclosed code block. Continue from the exact stopping point, finish every incomplete file, close every code fence, and then end with STATUS: REFINING or STATUS: MISSION_COMPLETE. Do not restart or summarize.`
          : buildStatus === "refining"
          ? buildCritiqueContinuationReply(autopilotRoundsRef.current, AUTOPILOT_MAX_ROUNDS)
          : zanoemBuildReply(autopilotRoundsRef.current, AUTOPILOT_MAX_ROUNDS);
        setTimeout(() => { void sendChatMessage(autoReply, customBrainPrompt, true); }, 250);
      } else if (isAutopilotTurn && autopilotRoundsRef.current > 0) {
        toast({ title: "ZANOEM autopilot complete", description: `${autopilotRoundsRef.current} round${autopilotRoundsRef.current === 1 ? "" : "s"}` });
        autopilotRoundsRef.current = 0;
        autopilotTriggerRef.current = "";

        // Background sweep — autofix + vision verification.
        if (!autopilotEnqueueGuardRef.current) {
          autopilotEnqueueGuardRef.current = true;
          if (autoDebugRef.current) {
            void zqEnqueue({
              kind: "autofix",
              payload: { projectRef: activeSessionId ?? undefined },
              surface: "aureon_ide",
              projectRef: activeSessionId ?? undefined,
              ownerUserId: user?.id,
            });
          }
          if (autoUiDebugRef.current) {
            void zqEnqueue({
              kind: "vision",
              payload: {
                intent: lastIntentRef.current,
                recentAssistant: assistantContent,
                projectRef: activeSessionId ?? undefined,
              },
              surface: "aureon_ide",
              projectRef: activeSessionId ?? undefined,
              ownerUserId: user?.id,
            });
          }
          setTimeout(() => { autopilotEnqueueGuardRef.current = false; }, 2000);
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setChatMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `Error: ${err.message}`, timestamp: new Date() }]);
      }
      setIsStreaming(false);
    }
  }, [chatMessages, activeFile, allFiles, creditsRemaining, useCredit, maxCredits, toast, terminalOutput, zanoemMode, autopilotZanoem, activeSessionId, rag, isMobile]);

  // Expose sendChatMessage to the offline queue worker as a stable ref.
  useEffect(() => { sendZanoemTurnRef.current = (p: string) => sendChatMessage(p, undefined, true); }, [sendChatMessage]);

  const stopStreaming = useCallback(() => { abortRef.current?.abort(); setIsStreaming(false); }, []);


  const handleTerminalAiCommand = useCallback((query: string) => {
    sendChatMessage(query);
    if (!rightOpen && !isMobile) setRightOpen(true);
    if (isMobile) setMobilePanel("chat");
  }, [sendChatMessage, rightOpen, isMobile]);

  // ── Crash hook wiring ─────────────────────────────────────
  // 1. Holds the IdeAgentsPanel "on_crash" trigger so we can fire it.
  // 2. Recent-crash dedupe (avoid spamming the AI when one error repeats).
  const crashAgentTriggerRef = useRef<((summary: string) => void) | null>(null);
  const lastCrashRef = useRef<{ sig: string; at: number }>({ sig: "", at: 0 });

  const handleCrashEvent = useCallback((evt: CrashEvent) => {
    const sig = `${evt.type || ""}|${evt.file || ""}:${evt.line || ""}|${evt.message.slice(0, 80)}`;
    const now = Date.now();
    if (sig === lastCrashRef.current.sig && now - lastCrashRef.current.at < 8000) return;
    lastCrashRef.current = { sig, at: now };

    // Best-effort locate file by basename
    let snippet: { name: string; content: string; startLine: number } | undefined;
    if (evt.file) {
      const baseName = evt.file.split("/").pop() || evt.file;
      const match = allFiles.find(f => f.name === baseName || f.name.endsWith("/" + baseName));
      if (match) {
        selectFile(match);
        if (match.content && evt.line) {
          const lines = match.content.split("\n");
          const start = Math.max(0, evt.line - 8);
          const end = Math.min(lines.length, evt.line + 8);
          snippet = { name: match.name, content: lines.slice(start, end).map((l, i) => `${start + i + 1} | ${l}`).join("\n"), startLine: start + 1 };
        }
      }
    }
    const prompt = buildCrashPrompt(evt, snippet);
    sendChatMessage(prompt);
    if (!rightOpen && !isMobile) setRightOpen(true);
    if (isMobile) setMobilePanel("chat");
    toast({ title: "◈ Crash detected", description: `${evt.type ?? "Error"}${evt.file ? " in " + (evt.file.split("/").pop() || evt.file) : ""} — AI dispatched` });

    // Fire on_crash agents
    crashAgentTriggerRef.current?.(prompt);
  }, [allFiles, selectFile, sendChatMessage, rightOpen, isMobile, toast]);

  // Global runtime error capture — uncaught exceptions + unhandled promise rejections.
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      const text = `${e.error?.stack || e.message}${e.filename ? `\n    at ${e.filename}:${e.lineno}:${e.colno}` : ""}`;
      const evt = detectCrash(text);
      if (evt) handleCrashEvent(evt);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const reason: any = e.reason;
      const text = reason?.stack || String(reason);
      const evt = detectCrash(text);
      if (evt) handleCrashEvent(evt);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, [handleCrashEvent]);

  // ── ZANOEM toggle strip (rendered above the chat panel on both layouts) ──
  const zanoemToggleBar = (
    <div className="border-b border-border/15 px-2 py-1 flex items-center justify-between gap-2 bg-card/5 flex-wrap">
      <label
        title="ZANOEM Mode: design brand-new software from first principles. Uses Aureon's engine — no API key needed."
        className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${zanoemMode ? "text-foreground" : "text-muted-foreground/70"}`}
      >
        <input type="checkbox" checked={zanoemMode} onChange={(e) => setZanoemMode(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
        <Brain className="h-2.5 w-2.5" /> ZANOEM
      </label>
      <label
        title="You Decide ZANOEM: autopilot. ZANOEM auto-answers its own questions and recommendations on your behalf for up to 6 rounds."
        className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autopilotZanoem ? "text-foreground" : "text-muted-foreground/70"} ${!zanoemMode ? "opacity-50" : ""}`}
      >
        <input type="checkbox" checked={autopilotZanoem} onChange={(e) => setAutopilotZanoem(e.target.checked)} disabled={!zanoemMode} className="accent-foreground h-2.5 w-2.5" />
        <Zap className="h-2.5 w-2.5" /> You Decide ZANOEM
      </label>
      <label
        title="Auto Debug: when autopilot is on, ZANOEM keeps re-running the validator + Bug Doctor in the background until the codebase has zero errors."
        className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autoDebug ? "text-foreground" : "text-muted-foreground/70"} ${!autopilotZanoem ? "opacity-50" : ""}`}
      >
        <input type="checkbox" checked={autoDebug} onChange={(e) => setAutoDebug(e.target.checked)} disabled={!autopilotZanoem} className="accent-foreground h-2.5 w-2.5" />
        <Bug className="h-2.5 w-2.5" /> Auto Debug
      </label>
      <label
        title="Auto UI Debug: ZANOEM verifies the rendered preview matches what was just built and queues fixes when it doesn't."
        className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autoUiDebug ? "text-foreground" : "text-muted-foreground/70"} ${!autopilotZanoem ? "opacity-50" : ""}`}
      >
        <input type="checkbox" checked={autoUiDebug} onChange={(e) => setAutoUiDebug(e.target.checked)} disabled={!autopilotZanoem} className="accent-foreground h-2.5 w-2.5" />
        <Eye className="h-2.5 w-2.5" /> Auto UI Debug
      </label>
      <label
        title="Auto Approve: skip every approval prompt and auto-accept all planned changes instantly."
        className={`flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase cursor-pointer ${autoApprove ? "text-foreground" : "text-muted-foreground/70"}`}
      >
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
        <Zap className="h-2.5 w-2.5" /> Auto Approve
      </label>
      <button
        onClick={() => setDecisionLogOpen(true)}
        title="ZANOEM Decision Log — review or override every choice the autopilot made."
        className="flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] uppercase text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        <ScrollText className="h-2.5 w-2.5" /> Decision Log
      </button>
    </div>
  );

  // ── Mobile Layout ──
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden pt-1">
        {/* Simple mobile header */}
        <div className="flex items-center justify-between px-3 py-2 bg-card/20 border-b border-border/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-accent/70" />
            <span className="text-xs font-light tracking-widest text-foreground/80">IDE</span>
          </div>
          <button onClick={saveSession} disabled={!activeSessionId || saving} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {mobilePanel === "explorer" && (
            leftTab === "sessions" ? <IdeSessionManager sessions={sessions} activeSessionId={activeSessionId} loading={sessionsLoading} onSelect={loadSession} onCreate={createSession} onDelete={deleteSession} onRename={renameSession} />
            : leftTab === "search" ? <IdeSearchPanel files={files} onOpenFile={selectFile} />
            : <IdeFileTree files={files} activeFileId={activeFileId} onSelectFile={selectFile} onCreateFile={createFile} onDeleteFile={deleteFile} onRenameFile={renameFile} onMoveFile={moveFile} />
          )}
          {mobilePanel === "editor" && (
            centerTab === "code"
              ? <IdeCodeEditor openFiles={openFiles} activeFileId={activeFileId} onSelectTab={setActiveFileId} onCloseTab={closeTab} onContentChange={updateContent} onHover={rag.hover} />
              : <IdePreviewPanel files={files} />
          )}
          {mobilePanel === "chat" && (
            <IdeChatPanel
              messages={chatMessages}
              isStreaming={isStreaming}
              onSend={sendChatMessage}
              onStop={stopStreaming}
              mode={ideMode}
              activeFileName={activeFile?.name}
              activeFileContent={activeFile?.content}
              creditsRemaining={creditsRemaining}
              maxCredits={maxCredits}
            />
          )}
          {mobilePanel === "terminal" && <IdeTerminal onAiCommand={handleTerminalAiCommand} files={files} onCreateFile={createFile} onDeleteFile={deleteFile} onUpdateContent={updateContent} onTerminalOutput={handleTerminalOutput} onCrashDetected={handleCrashEvent} />}
        </div>

        {/* Simple 4-tab bottom nav */}
        <div className="flex items-center border-t border-border/20 bg-card/20 flex-shrink-0">
          {([
            { id: "explorer" as MobilePanel, icon: FolderKanban, label: "Files" },
            { id: "editor" as MobilePanel, icon: FileCode, label: centerTab === "preview" ? "Preview" : "Code" },
            { id: "chat" as MobilePanel, icon: ideMode === "agent" ? Bot : MessageSquare, label: ideMode === "agent" ? "Agent" : "Chat" },
            { id: "terminal" as MobilePanel, icon: TerminalIcon, label: "Terminal" },
          ]).map(tab => (
            <button key={tab.id}
              onClick={() => { if (tab.id === "editor" && mobilePanel === "editor") setCenterTab(t => t === "code" ? "preview" : "code"); else setMobilePanel(tab.id); }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-light transition-colors ${mobilePanel === tab.id ? "text-accent" : "text-muted-foreground/50"}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>


        <IdeQuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} files={files} onSelectFile={selectFile} />
      </div>
    );
  }

  // ── Desktop Layout (Simplified) ──
  return (
    <div className="flex flex-col h-full w-full overflow-hidden pt-1">
      {/* Top bar: asherin | project | New | Code | Preview | Save | Chat | More */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/20 border-b border-border/20 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-accent/70 shrink-0" />
            <span className="text-xs font-light tracking-widest text-foreground/80 shrink-0">asherin IDE</span>
          </div>
          {activeSessionId ? (
            <span className="text-[10px] text-muted-foreground/50 bg-muted/10 rounded-full px-2.5 py-0.5 truncate max-w-[160px]">
              {sessions.find(s => s.id === activeSessionId)?.name ?? ""}
            </span>
          ) : null}
          <button
            onClick={createSession}
            className="flex items-center gap-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 px-3 py-1.5 text-[10px] font-light text-accent transition-colors"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Code / Preview */}
          <div className="flex items-center rounded-lg border border-border/20 overflow-hidden mr-1">
            <button onClick={() => setCenterTab("code")} className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-light transition-colors ${centerTab === "code" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`}>
              <FileCode className="h-3 w-3" /> Code
            </button>
            <button onClick={() => setCenterTab("preview")} className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-light transition-colors ${centerTab === "preview" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`}>
              <Globe className="h-3 w-3" /> Preview
            </button>
          </div>

          {/* Save */}
          <button onClick={saveSession} disabled={!activeSessionId || saving} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30" title="Save (Ctrl+S)">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </button>

          {/* Chat vs Agent */}
          <IdeModeToggle scope="aureon" value={ideMode} onChange={setIdeMode} />
          <IdeModelRouterBadge decision={routeDecision} onOverride={setModelOverride} isOverridden={!!modelOverride} />

          {/* Chat panel toggle */}
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-light transition-colors ${rightOpen ? "bg-accent/15 text-accent" : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5"}`}
            title="Toggle chat panel"
          >
            {ideMode === "agent" ? <Bot className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
            <span className="hidden lg:inline">Chat</span>
          </button>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuItem onClick={() => setQuickOpenOpen(true)}>
                <Search className="h-3.5 w-3.5 mr-2" /> Go to File <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+P</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLeftTab("search"); setLeftOpen(true); }}>
                <Search className="h-3.5 w-3.5 mr-2" /> Search in Files
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                <Wand2 className="h-3.5 w-3.5 mr-2" /> Scaffold files <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+Shift+P</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!activeSessionId || !activeFileId} onClick={() => setHistoryOpen(true)}>
                <History className="h-3.5 w-3.5 mr-2" /> Version history
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!activeSessionId} onClick={() => setCheckpointsOpen(true)}>
                <GitCommit className="h-3.5 w-3.5 mr-2" /> Checkpoints
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setBugDoctorMsg(terminalOutput.slice(-5).join("\n") || ""); setBugDoctorOpen(true); }}>
                <Stethoscope className="h-3.5 w-3.5 mr-2" /> Explain last error
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createSession}>
                <Plus className="h-3.5 w-3.5 mr-2" /> New Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLeftTab("sessions"); setLeftOpen(true); }}>
                <FolderKanban className="h-3.5 w-3.5 mr-2" /> Projects
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLeftTab("git"); setLeftOpen(true); }}>
                <Code2 className="h-3.5 w-3.5 mr-2" /> Git
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportProject}>
                <Download className="h-3.5 w-3.5 mr-2" /> Export as ZIP
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLeftOpen(p => !p)}>
                {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5 mr-2" /> : <PanelLeftOpen className="h-3.5 w-3.5 mr-2" />}
                {leftOpen ? "Hide" : "Show"} Sidebar <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+B</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBottomOpen(p => !p)}>
                {bottomOpen ? <ChevronDown className="h-3.5 w-3.5 mr-2" /> : <ChevronUp className="h-3.5 w-3.5 mr-2" />}
                {bottomOpen ? "Hide" : "Show"} Terminal <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+J</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left sidebar — just files by default, simple tab strip */}
          {leftOpen && (
            <>
              <ResizablePanel defaultSize={18} minSize={10} maxSize={30} className="overflow-hidden">
                <div className="flex flex-col h-full border-r border-border/20 bg-card/10 overflow-hidden">
                  {/* Simple tab strip */}
                  <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/10 shrink-0">
                    {([
                      { id: "files" as LeftTab, icon: FolderKanban, label: "Files" },
                      { id: "search" as LeftTab, icon: Search, label: "Search" },
                      { id: "agents" as LeftTab, icon: Bot, label: "Agents" },
                    ]).map(tab => (
                      <button key={tab.id} onClick={() => setLeftTab(tab.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-light transition-colors ${leftTab === tab.id ? "bg-accent/15 text-accent" : "text-muted-foreground/40 hover:text-foreground"}`}
                      >
                        <tab.icon className="h-3 w-3" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {leftTab === "files" && <IdeFileTree files={files} activeFileId={activeFileId} onSelectFile={selectFile} onCreateFile={createFile} onDeleteFile={deleteFile} onRenameFile={renameFile} onMoveFile={moveFile} />}
                    {leftTab === "search" && <IdeSearchPanel files={files} onOpenFile={selectFile} />}
                    {leftTab === "sessions" && <IdeSessionManager sessions={sessions} activeSessionId={activeSessionId} loading={sessionsLoading} onSelect={loadSession} onCreate={createSession} onDelete={deleteSession} onRename={renameSession} />}
                    {leftTab === "git" && <IdeGitPanel files={files} onImportFiles={(imported) => setFiles(imported)} />}
                    {leftTab === "agents" && (
                      <IdeAgentsPanel
                        sessionId={activeSessionId}
                        onRunAgent={(goal, name) => { sendChatMessage(`[Agent: ${name}]\n${goal}`); if (!rightOpen && !isMobile) setRightOpen(true); }}
                        onRegisterCrashHandler={(handler) => { crashAgentTriggerRef.current = handler; }}
                      />
                    )}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Center */}
          <ResizablePanel defaultSize={rightOpen ? 58 : 82} minSize={30} className="overflow-hidden">
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={bottomOpen ? 70 : 100} minSize={20} className="overflow-hidden">
                <div className="flex flex-col h-full">
                  {centerTab === "code" && activeFile?.content && (
                    <div className="px-2 py-1 border-b border-border/15 bg-card/5">
                      <IdeValidatorBadge content={activeFile.content} language={getLanguage(activeFile.name)} />
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    {centerTab === "code"
                      ? <IdeCodeEditor openFiles={openFiles} activeFileId={activeFileId} onSelectTab={setActiveFileId} onCloseTab={closeTab} onContentChange={updateContent} onHover={rag.hover} />
                      : <IdePreviewPanel files={files} />}

                  </div>
                </div>
              </ResizablePanel>

              {/* Terminal (only when open) */}
              {bottomOpen && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={30} minSize={10} maxSize={50} className="overflow-hidden">
                    <div className="flex flex-col h-full border-t border-border/20">
                      <div className="flex items-center px-3 py-1 bg-card/10 border-b border-border/10 shrink-0">
                        <div className="flex items-center gap-1 text-[10px] font-light text-accent/70">
                          <TerminalIcon className="h-3 w-3" />
                          Terminal
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <IdeTerminal onAiCommand={handleTerminalAiCommand} files={files} onCreateFile={createFile} onDeleteFile={deleteFile} onUpdateContent={updateContent} onTerminalOutput={handleTerminalOutput} onCrashDetected={handleCrashEvent} />
                      </div>
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right: AI Chat */}
          {rightOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={24} minSize={15} maxSize={40} className="overflow-hidden">
                <div className="h-full border-l border-border/20 bg-card/10 overflow-hidden flex flex-col">
                  <div className="px-2 pt-2">
                    <IdeChangedFilesPanel
                      scope="aureon"
                      projectId={activeSessionId ?? ""}
                      onOpenFile={(id) => { const f = allFiles.find(x => x.id === id); if (f) selectFile(f); }}
                    />
                  </div>
                  <div className="flex-1 min-h-0">
                    <IdeChatPanel
                      messages={chatMessages}
                      isStreaming={isStreaming}
                      onSend={sendChatMessage}
                      onStop={stopStreaming}
                      mode={ideMode}
                      activeFileName={activeFile?.name}
                      activeFileContent={activeFile?.content}
                      creditsRemaining={creditsRemaining}
                      maxCredits={maxCredits}
                    />
                  </div>
                </div>

              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <IdeQuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} files={files} onSelectFile={selectFile} />


      {/* Shared IDE upgrade pack modals */}
      <IdeFuzzyFinder
        open={fuzzyOpen}
        files={allFiles.map(f => ({ id: f.id, path: f.name }))}
        onPick={(id) => { const f = allFiles.find(x => x.id === id); if (f) selectFile(f); }}
        onClose={() => setFuzzyOpen(false)}
      />
      <IdeTemplateLauncher open={templateOpen} onClose={() => setTemplateOpen(false)} onCreate={handleScaffold} />
      <IdeHistoryPanel
        scope="aureon"
        projectId={activeSessionId ?? ""}
        fileId={activeFileId ?? ""}
        filePath={activeFile?.name ?? ""}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={(content) => activeFileId && aiWriteContent(activeFileId, content)}
      />
      <IdeCheckpointPanel
        scope="aureon"
        projectId={activeSessionId ?? ""}
        open={checkpointsOpen}
        onClose={() => setCheckpointsOpen(false)}
        onRestore={(restored) => {
          for (const f of restored) aiWriteContent(f.fileId, f.content);
          changedFiles.clear("aureon", activeSessionId ?? "");
        }}
      />
      <IdeErrorExplainer
        open={bugDoctorOpen}
        message={bugDoctorMsg}
        contextCode={activeFile?.content}
        onClose={() => setBugDoctorOpen(false)}
        onApplyFix={(code) => activeFileId && aiWriteContent(activeFileId, code)}
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
    </div>
  );
};

export default AureonIdeView;
