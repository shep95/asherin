import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  FileText, FolderPlus, Play, Save, Sparkles, Send, Loader2, Settings, X,
  Plus, Trash2, Upload, Code2, Brain, Wand2, Bug, KeyRound, Layers, FileEdit, FlaskConical, Wrench,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Eye, EyeOff, Image as ImageIcon, FileArchive, Zap, Columns2,
  History, Stethoscope,
} from "lucide-react";
import AsherCodeDevOps from "./AsherCodeDevOps";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ASHER_CODE_PROVIDERS, type AsherCodeProject, type AsherCodeFile } from "@/lib/asherCode/types";
import { callAsherCodeAi, extractCodeBlock, extractJsonBlock, type EditPlan, type CallAsherCodeResult } from "@/lib/asherCode/aiClient";
import EditPlanReview from "./AsherCodeEditPlan";
import AsherCodeOrchestrationResult from "./AsherCodeOrchestrationResult";
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
  type PlannedChange,
  type IdeCommand,
} from "@/components/ide-shared";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import { snapshotIfChanged, routeTask, animateInsert, animateReplace, readAutoSave, getAutoSaveAge, startAutoSaveLoop, clearAutoSave, type IdeModelId, type AutoSaveSnapshot } from "@/lib/ide";
import { toast } from "sonner";

interface ChatMsg { role: "user" | "assistant"; content: string }

export default function AsherCodeModule() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<AsherCodeProject[]>([]);
  const [activeProject, setActiveProject] = useState<AsherCodeProject | null>(null);
  const [files, setFiles] = useState<AsherCodeFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [showNewProject, setShowNewProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState(() => localStorage.getItem("asherCode.draft.__global__") || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [editPlan, setEditPlan] = useState<EditPlan | null>(null);
  const [orchResult, setOrchResult] = useState<CallAsherCodeResult | null>(null);
  const [showDevOps, setShowDevOps] = useState(false);
  const [orchestrateMode, setOrchestrateMode] = useState(() => localStorage.getItem("asherCode.orchestrate") === "1");
  const [showFiles, setShowFiles] = useState(() => localStorage.getItem("asherCode.showFiles") !== "0");
  const [showPreview, setShowPreview] = useState(() => localStorage.getItem("asherCode.showPreview") !== "0");
  const [viewMode, setViewMode] = useState<"code" | "split" | "preview">(() => (localStorage.getItem("asherCode.viewMode") as any) || "split");
  const [showAi, setShowAi] = useState(() => localStorage.getItem("asherCode.showAi") !== "0");
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem("asherCode.autoApprove") !== "0");
  const [animateInsertion, setAnimateInsertion] = useState(() => localStorage.getItem("asherCode.animate") !== "0");
  const [pendingUploads, setPendingUploads] = useState<{ name: string; preview?: string; content: string; kind: "image" | "zip" | "text" }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // BYOK config — stored per-tab in localStorage
  const [provider, setProvider] = useState(() => localStorage.getItem("asherCode.provider") || "anthropic");
  const [model, setModel] = useState(() => localStorage.getItem("asherCode.model") || "claude-sonnet-4-5");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("asherCode.apiKey") || "");

  // ── Shared IDE upgrade pack state ──
  const [historyOpen, setHistoryOpen] = useState(false);
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
  useEffect(() => { localStorage.setItem("asherCode.apiKey", apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem("asherCode.orchestrate", orchestrateMode ? "1" : "0"); }, [orchestrateMode]);
  useEffect(() => { localStorage.setItem("asherCode.showFiles", showFiles ? "1" : "0"); }, [showFiles]);
  useEffect(() => { localStorage.setItem("asherCode.showPreview", showPreview ? "1" : "0"); }, [showPreview]);
  useEffect(() => { localStorage.setItem("asherCode.viewMode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("asherCode.showAi", showAi ? "1" : "0"); }, [showAi]);
  useEffect(() => { localStorage.setItem("asherCode.autoApprove", autoApprove ? "1" : "0"); }, [autoApprove]);
  useEffect(() => { localStorage.setItem("asherCode.animate", animateInsertion ? "1" : "0"); }, [animateInsertion]);

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
        .insert({ project_id: activeProject.id, path: f.path, content: f.content, language: f.language }).select().single();
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
    const [filesRes, chatRes] = await Promise.all([
      supabase.from("asher_code_files").select("*").eq("project_id", p.id).order("path"),
      supabase.from("asher_code_chat_messages").select("role,content").eq("project_id", p.id).order("created_at", { ascending: true }),
    ]);
    if (filesRes.error) { toast.error(filesRes.error.message); return; }
    const fs = (filesRes.data || []) as AsherCodeFile[];
    setFiles(fs);
    setOpenTabs(fs.length ? [fs[0].id] : []);
    setActiveFileId(fs[0]?.id || null);
    setDirty({});
    if (chatRes.error) {
      setChat([]);
    } else {
      setChat(((chatRes.data as any[]) || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
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
  <p class="hint">Tell Aureon Code what to build — it adapts to any stack.</p>
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
      .insert({ project_id: activeProject.id, path, content: "", language: lang })
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

  // Build live preview srcdoc — concatenates all HTML/JS/CSS files (best-effort)
  const previewSrcDoc = useMemo(() => {
    const html = files.find(f => f.path.endsWith("index.html"));
    if (!html) return "<html><body style='background:#0a0a0a;color:#888;font-family:monospace;padding:2rem'>No <code>index.html</code> in this project — preview is HTML-based.</body></html>";
    let content = (dirty[html.id] ?? html.content);
    // Inline external scripts/styles referenced by relative path
    for (const f of files) {
      if (f.id === html.id) continue;
      const c = dirty[f.id] ?? f.content;
      content = content.replace(`<script src="${f.path}"></script>`, `<script>${c}</script>`);
      content = content.replace(`<link rel="stylesheet" href="${f.path}">`, `<style>${c}</style>`);
    }
    return content;
  }, [files, dirty]);

  function runPreview() { setPreviewKey(k => k + 1); }

  // ── AI actions ────────────────────────────────────────────────
  function byok() {
    return apiKey ? { provider, model, apiKey } : { provider, model };
  }

  async function sendChat() {
    if ((!chatInput.trim() && pendingUploads.length === 0) || aiBusy) return;
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
      const r = await callAsherCodeAi({ mode: "chat", byok: byok(), messages: next, contextFiles: ctx, images: imageAttachments } as any);
      const assistantMsg: ChatMsg = { role: "assistant", content: r.reply || "" };
      setChat([...next, assistantMsg]);
      void persistChatMessages([userMsg, assistantMsg]);
    } catch (e: any) {
      const errMsg: ChatMsg = { role: "assistant", content: "**Error:** " + (e.message || "AI call failed") };
      setChat([...next, errMsg]);
      void persistChatMessages([userMsg, errMsg]);
    } finally { setAiBusy(false); }
  }

  async function aiExplain() {
    if (!activeFile) return;
    setAiBusy(true);
    try {
      const r = await callAsherCodeAi({ mode: "explain", byok: byok(), code: activeContent, language: activeFile.language });
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
      const r = await callAsherCodeAi({ mode: "fix", byok: byok(), code: activeContent, language: activeFile.language, error: err });
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
      const r = await callAsherCodeAi({ mode: "generate", byok: byok(), description: desc, language: activeFile.language });
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
      const r = await callAsherCodeAi({ mode: "tests", byok: byok(), code: activeContent, language: activeFile.language, framework: "vitest" });
      const code = extractCodeBlock(r.reply || "");
      // Create a sibling test file
      const base = activeFile.path.replace(/\.(tsx?|jsx?|py)$/, "");
      const ext = activeFile.path.match(/\.(tsx?|jsx?)$/)?.[1] || "ts";
      const testPath = `${base}.test.${ext}`;
      const { data, error } = await supabase
        .from("asher_code_files")
        .insert({ project_id: activeProject!.id, path: testPath, content: code, language: activeFile.language })
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
      const r = await callAsherCodeAi({ mode: "edit_plan", byok: byok(), instruction, contextFiles: projectFiles });
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
      const r = await callAsherCodeAi({
        mode: "orchestrate",
        subMode: "chat",
        byoks,
        messages: [...chat, { role: "user", content: chatInput }],
        contextFiles: ctx,
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
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Asher Code</p>
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
              Add your own API key in <strong>BYOK</strong> settings. Asher Code never uses platform AI keys for non-admin users.
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
                    <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-foreground/60" /><h3 className="text-sm font-light tracking-wide">{p.name}</h3></div>
                    <button onClick={() => deleteProject(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-3">{p.language} · {p.visibility}</p>
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
          <span className="text-muted-foreground/30 hidden sm:inline">/</span>
          <span className="text-xs font-light truncate max-w-[140px] sm:max-w-none">{activeProject.name}</span>
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
          <button onClick={() => setShowDevOps(s => !s)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase ${showDevOps ? "border-foreground/40 bg-foreground/15" : "border-border/20 bg-card/30 hover:border-foreground/30"}`}><Wrench className="h-3 w-3" /> <span className="hidden md:inline">DevOps</span></button>
          <button onClick={() => setTemplateOpen(true)} title="Scaffold from natural language" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30"><Wand2 className="h-3 w-3" /></button>
          <button onClick={() => setFuzzyOpen(true)} title="Fuzzy file finder" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30"><FileText className="h-3 w-3" /></button>
          <button onClick={() => setHistoryOpen(true)} disabled={!activeFile} title="Version history" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30 disabled:opacity-40"><History className="h-3 w-3" /></button>
          <button onClick={() => { setBugDoctorMsg(""); setBugDoctorOpen(true); }} title="Bug Doctor" className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] hover:border-foreground/30"><Stethoscope className="h-3 w-3" /></button>
          <IdeModelRouterBadge decision={routeDecision} onOverride={setModelOverride} isOverridden={!!modelOverride} />
          <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30"><Settings className="h-3 w-3" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* File tree — collapsible */}
        {showFiles && (
          <aside className="w-44 sm:w-52 lg:w-56 flex-shrink-0 border-r border-border/15 bg-card/10 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/15 sticky top-0 bg-card/40 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Files</span>
              <button onClick={addFile} className="text-muted-foreground hover:text-foreground" title="Add file"><FolderPlus className="h-3 w-3" /></button>
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
            </div>
          </div>

          {/* Live validator badge — visible when a file is open */}
          {activeFile && activeContent && (
            <div className="px-2 py-1 border-b border-border/15 bg-card/5">
              <IdeValidatorBadge content={activeContent} language={activeFile.language || "tsx"} />
            </div>
          )}

          {/* Editor + preview — controlled by viewMode (code | split | preview) */}
          <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
            {viewMode !== "preview" && (
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
                      options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, fontFamily: "ui-monospace, monospace", padding: { top: 12 } }}
                    />
                  </div>
                ) : (
                  <div className="relative z-10 h-full flex items-center justify-center text-xs text-muted-foreground/50">Open a file to start editing</div>
                )}
              </div>
            )}
            {viewMode !== "code" && (
              <div className={`${viewMode === "preview" ? "w-full flex-1" : "w-full lg:w-2/5 lg:min-w-[280px]"} border-t lg:border-t-0 ${viewMode === "split" ? "lg:border-l" : ""} border-border/15 bg-card/5 flex flex-col min-h-[200px]`}>
                <div className="px-3 py-1.5 border-b border-border/15 text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase flex items-center justify-between">
                  <span>Preview</span>
                  <span className="text-muted-foreground/50 normal-case tracking-normal text-[9px]">Live · Sandboxed</span>
                </div>
                <iframe key={previewKey} ref={previewRef} srcDoc={previewSrcDoc} sandbox="allow-scripts" className="flex-1 bg-white" title="preview" />
              </div>
            )}
          </div>
        </div>


        {/* AI sidebar — collapsible */}
        {showAi && (
        <aside className="w-72 lg:w-80 flex-shrink-0 border-l border-border/15 bg-card/10 flex flex-col absolute lg:relative right-0 top-0 bottom-0 z-20 lg:z-auto bg-background/95 lg:bg-card/10 backdrop-blur-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/15">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-foreground/60" />
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Aureon Code AI</span>
            </div>
            <span className="text-[8px] tracking-[0.2em] text-foreground/70 uppercase">{apiKey ? "BYOK" : "No Key"}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2 border-b border-border/15">
            <button onClick={aiGenerate} disabled={aiBusy || !apiKey} className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Wand2 className="h-2.5 w-2.5" />Gen</button>
            <button onClick={aiExplain} disabled={aiBusy || !apiKey} className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Sparkles className="h-2.5 w-2.5" />Explain</button>
            <button onClick={aiFix} disabled={aiBusy || !apiKey} className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Bug className="h-2.5 w-2.5" />Fix</button>
            <button onClick={aiTests} disabled={aiBusy || !apiKey} title="Generate test suite" className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><FlaskConical className="h-2.5 w-2.5" />Tests</button>
            <button onClick={aiEditMode} disabled={aiBusy || !apiKey} title="Multi-file Edit Mode with diff approval" className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><FileEdit className="h-2.5 w-2.5" />Edit</button>
            <button onClick={runInlineAiPrompts} disabled={aiBusy || !apiKey} title="Resolve `// AI: ...` prompts in active file" className="inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Code2 className="h-2.5 w-2.5" />// AI:</button>
          </div>
          <div className="flex items-center justify-between px-2 py-1 border-b border-border/15 bg-card/5">
            <label className="flex items-center gap-1.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase cursor-pointer">
              <input type="checkbox" checked={orchestrateMode} onChange={(e) => setOrchestrateMode(e.target.checked)} className="accent-foreground h-3 w-3" />
              <Layers className="h-2.5 w-2.5" /> Multi-Model
            </label>
            {orchestrateMode && <span className="text-[8px] text-foreground/70 tracking-[0.15em] uppercase">3 models · ranked</span>}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {chat.length === 0 && <p className="text-[10px] text-muted-foreground/50 italic">Ask anything about your code. Senior Principal Engineer persona, BYOK only.</p>}
            {chat.map((m, i) => (
              <div key={i} className={`rounded-lg px-2.5 py-2 text-[11px] font-light ${m.role === "user" ? "bg-foreground/10 border border-foreground/15" : "bg-card/30 border border-border/15"}`}>
                {m.role === "assistant"
                  ? <div className="prose prose-xs prose-invert max-w-none prose-pre:bg-background/60 prose-pre:text-[10px] prose-pre:border prose-pre:border-border/20 prose-code:text-[10px]"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            ))}
            {aiBusy && <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
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
          {/* Auto-approve + Animation toggles */}
          <div className="border-t border-border/15 px-2 py-1 flex items-center justify-between gap-2 bg-card/5">
            <label className="flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase cursor-pointer">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
              <Zap className="h-2.5 w-2.5" /> Auto-Apply
            </label>
            <label className="flex items-center gap-1 text-[8.5px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase cursor-pointer">
              <input type="checkbox" checked={animateInsertion} onChange={(e) => setAnimateInsertion(e.target.checked)} className="accent-foreground h-2.5 w-2.5" />
              Type-Anim
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
              placeholder={apiKey ? "Ask Aureon Code… (paste image, ZIP, or describe)" : "Add API key in BYOK settings first"}
              disabled={!apiKey}
              rows={2}
              className="flex-1 resize-none rounded border border-border/20 bg-card/40 px-2 py-1.5 text-[11px] font-light placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={() => orchestrateMode ? aiOrchestrate() : sendChat()}
              disabled={aiBusy || (!chatInput.trim() && pendingUploads.length === 0) || !apiKey}
              title={orchestrateMode ? "Orchestrate across 3 models" : "Send"}
              className={`rounded border px-2 disabled:opacity-40 ${orchestrateMode ? "border-foreground/30 bg-foreground/10 hover:bg-foreground/20" : "border-foreground/20 bg-foreground/10 hover:bg-foreground/20"}`}
            >
              {orchestrateMode ? <Layers className="h-3 w-3 text-foreground" /> : <Send className="h-3 w-3" />}
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
          No template needed. Aureon Code adapts to whatever you describe — vanilla HTML, React, TypeScript, automation scripts, dashboards, charts, anything. Just tell it what to build.
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
        <p className="text-[10px] text-muted-foreground/60 mb-3">Asher Code never uses platform AI keys. Your key stays in browser local storage and is sent only to your chosen provider via our edge proxy. Never logged.</p>
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
