import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  FileText, FolderPlus, Play, Save, Sparkles, Send, Loader2, Settings, X,
  Plus, Trash2, Upload, Code2, Brain, Wand2, Bug, KeyRound, Layers, FileEdit, FlaskConical,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ASHER_CODE_PROVIDERS, type AsherCodeProject, type AsherCodeFile } from "@/lib/asherCode/types";
import { ASHER_CODE_TEMPLATES, getTemplate } from "@/lib/asherCode/templates";
import { callAsherCodeAi, extractCodeBlock, extractJsonBlock, type EditPlan, type CallAsherCodeResult } from "@/lib/asherCode/aiClient";
import EditPlanReview from "./AsherCodeEditPlan";
import AsherCodeOrchestrationResult from "./AsherCodeOrchestrationResult";
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
  const [chatInput, setChatInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [editPlan, setEditPlan] = useState<EditPlan | null>(null);
  const [orchResult, setOrchResult] = useState<CallAsherCodeResult | null>(null);
  const [orchestrateMode, setOrchestrateMode] = useState(() => localStorage.getItem("asherCode.orchestrate") === "1");
  const previewRef = useRef<HTMLIFrameElement>(null);

  // BYOK config — stored per-tab in localStorage
  const [provider, setProvider] = useState(() => localStorage.getItem("asherCode.provider") || "anthropic");
  const [model, setModel] = useState(() => localStorage.getItem("asherCode.model") || "claude-sonnet-4-5");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("asherCode.apiKey") || "");

  useEffect(() => { localStorage.setItem("asherCode.provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("asherCode.model", model); }, [model]);
  useEffect(() => { localStorage.setItem("asherCode.apiKey", apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem("asherCode.orchestrate", orchestrateMode ? "1" : "0"); }, [orchestrateMode]);

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId) || null, [files, activeFileId]);
  const activeContent = activeFileId ? (dirty[activeFileId] ?? activeFile?.content ?? "") : "";

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
    const { data, error } = await supabase
      .from("asher_code_files")
      .select("*")
      .eq("project_id", p.id)
      .order("path");
    if (error) { toast.error(error.message); return; }
    const fs = (data || []) as AsherCodeFile[];
    setFiles(fs);
    setOpenTabs(fs.length ? [fs[0].id] : []);
    setActiveFileId(fs[0]?.id || null);
    setDirty({});
    setChat([]);
  }

  async function createProject(name: string, templateId: string) {
    if (!user) return;
    const tpl = getTemplate(templateId);
    const { data: proj, error } = await supabase
      .from("asher_code_projects")
      .insert({ owner_id: user.id, name, template: templateId, language: tpl?.language || "javascript" })
      .select().single();
    if (error || !proj) { toast.error(error?.message || "create failed"); return; }
    if (tpl) {
      const rows = tpl.files.map(f => ({ project_id: proj.id, path: f.path, content: f.content, language: f.language }));
      const { error: fErr } = await supabase.from("asher_code_files").insert(rows);
      if (fErr) toast.error(fErr.message);
    }
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
    if (!chatInput.trim() || aiBusy) return;
    const userMsg: ChatMsg = { role: "user", content: chatInput };
    const next = [...chat, userMsg];
    setChat(next);
    setChatInput("");
    setAiBusy(true);
    try {
      const ctx = activeFile ? [{ path: activeFile.path, content: activeContent }] : [];
      const r = await callAsherCodeAi({ mode: "chat", byok: byok(), messages: next, contextFiles: ctx });
      setChat([...next, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setChat([...next, { role: "assistant", content: "**Error:** " + (e.message || "AI call failed") }]);
    } finally { setAiBusy(false); }
  }

  async function aiExplain() {
    if (!activeFile) return;
    setAiBusy(true);
    try {
      const r = await callAsherCodeAi({ mode: "explain", byok: byok(), code: activeContent, language: activeFile.language });
      setChat(c => [...c, { role: "user", content: `Explain ${activeFile.path}` }, { role: "assistant", content: r.reply }]);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  async function aiFix() {
    if (!activeFile) return;
    const err = prompt("Paste the error message:");
    if (!err) return;
    setAiBusy(true);
    try {
      const r = await callAsherCodeAi({ mode: "fix", byok: byok(), code: activeContent, language: activeFile.language, error: err });
      setChat(c => [...c, { role: "user", content: `Fix: ${err}` }, { role: "assistant", content: r.reply }]);
      const fixed = extractCodeBlock(r.reply);
      if (fixed && confirm("Replace file content with fixed version?")) {
        setDirty(d => ({ ...d, [activeFile.id]: fixed }));
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
      setDirty(d => ({ ...d, [activeFile.id]: code }));
      setChat(c => [...c, { role: "user", content: `Generate: ${desc}` }, { role: "assistant", content: r.reply || "" }]);
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
      setEditPlan(plan);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  function applyEditPlan(selectedPaths: string[]) {
    if (!editPlan || !activeProject) return;
    let appliedCount = 0;
    let createdFiles: AsherCodeFile[] = [];
    const newDirty = { ...dirty };
    for (const edit of editPlan.edits) {
      if (!selectedPaths.includes(edit.path)) continue;
      const existing = files.find(f => f.path === edit.path);
      if (existing) {
        newDirty[existing.id] = edit.new_content;
        appliedCount++;
      } else {
        // New file — must persist immediately to get an ID
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
    setDirty(newDirty);
    setEditPlan(null);
    toast.success(`Staged ${appliedCount} edits — review in editor and Save to commit`);
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
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/80 font-light">
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
                    <button onClick={() => deleteProject(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
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
      <div className="flex items-center justify-between border-b border-border/15 bg-card/20 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={() => { setActiveProject(null); setFiles([]); }} className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground">← Projects</button>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-xs font-light">{activeProject.name}</span>
          {Object.keys(dirty).length > 0 && <span className="text-[9px] text-amber-400/80 ml-1">● {Object.keys(dirty).length} unsaved</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={saveAll} disabled={!Object.keys(dirty).length} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Save className="h-3 w-3" /> Save</button>
          <button onClick={runPreview} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30"><Play className="h-3 w-3" /> Run</button>
          <button onClick={() => setShowPublish(true)} className="inline-flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase text-emerald-200/80 hover:bg-emerald-400/10"><Upload className="h-3 w-3" /> Publish</button>
          <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] uppercase hover:border-foreground/30"><Settings className="h-3 w-3" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <aside className="w-56 flex-shrink-0 border-r border-border/15 bg-card/10 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/15">
            <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Files</span>
            <button onClick={addFile} className="text-muted-foreground hover:text-foreground"><FolderPlus className="h-3 w-3" /></button>
          </div>
          {files.map(f => (
            <div key={f.id} className={`group flex items-center justify-between px-3 py-1.5 text-[11px] font-light cursor-pointer hover:bg-foreground/5 ${activeFileId === f.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}
              onClick={() => { if (!openTabs.includes(f.id)) setOpenTabs(t => [...t, f.id]); setActiveFileId(f.id); }}>
              <span className="truncate flex items-center gap-1.5"><FileText className="h-3 w-3 flex-shrink-0" />{f.path}{f.id in dirty && <span className="text-amber-400">●</span>}</span>
              <button onClick={(e) => { e.stopPropagation(); void removeFile(f.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </aside>

        {/* Editor + preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b border-border/15 bg-card/10 overflow-x-auto">
            {openTabs.map(tid => {
              const f = files.find(x => x.id === tid);
              if (!f) return null;
              return (
                <div key={tid} className={`group flex items-center gap-2 border-r border-border/15 px-3 py-1.5 text-[11px] font-light cursor-pointer ${activeFileId === tid ? "bg-background text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}
                  onClick={() => setActiveFileId(tid)}>
                  {f.path}{f.id in dirty && <span className="text-amber-400">●</span>}
                  <button onClick={(e) => { e.stopPropagation(); setOpenTabs(t => t.filter(x => x !== tid)); if (activeFileId === tid) setActiveFileId(openTabs.filter(x => x !== tid)[0] || null); }} className="opacity-50 hover:opacity-100"><X className="h-3 w-3" /></button>
                </div>
              );
            })}
          </div>

          {/* Editor + preview split */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 min-w-0">
              {activeFile ? (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={activeFile.language}
                  value={activeContent}
                  onChange={(v) => setDirty(d => ({ ...d, [activeFile.id]: v ?? "" }))}
                  options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, fontFamily: "ui-monospace, monospace", padding: { top: 12 } }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground/50">Open a file to start editing</div>
              )}
            </div>
            <div className="w-2/5 border-l border-border/15 bg-card/5 flex flex-col">
              <div className="px-3 py-1.5 border-b border-border/15 text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Preview</div>
              <iframe key={previewKey} ref={previewRef} srcDoc={previewSrcDoc} sandbox="allow-scripts" className="flex-1 bg-white" title="preview" />
            </div>
          </div>
        </div>

        {/* AI sidebar */}
        <aside className="w-80 flex-shrink-0 border-l border-border/15 bg-card/10 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/15">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-foreground/60" />
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Aureon Code AI</span>
            </div>
            <span className="text-[8px] tracking-[0.2em] text-emerald-400/70 uppercase">{apiKey ? "BYOK" : "No Key"}</span>
          </div>
          <div className="flex gap-1 p-2 border-b border-border/15">
            <button onClick={aiGenerate} disabled={aiBusy || !apiKey} className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Wand2 className="h-2.5 w-2.5" />Gen</button>
            <button onClick={aiExplain} disabled={aiBusy || !apiKey} className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Sparkles className="h-2.5 w-2.5" />Explain</button>
            <button onClick={aiFix} disabled={aiBusy || !apiKey} className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-border/20 bg-card/30 px-2 py-1 text-[9px] font-light tracking-[0.15em] uppercase hover:border-foreground/30 disabled:opacity-40"><Bug className="h-2.5 w-2.5" />Fix</button>
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
          <div className="border-t border-border/15 p-2 flex gap-1">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
              placeholder={apiKey ? "Ask Aureon Code…" : "Add API key in BYOK settings first"}
              disabled={!apiKey}
              rows={2}
              className="flex-1 resize-none rounded border border-border/20 bg-card/40 px-2 py-1.5 text-[11px] font-light placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none disabled:opacity-40"
            />
            <button onClick={sendChat} disabled={aiBusy || !chatInput.trim() || !apiKey} className="rounded border border-foreground/20 bg-foreground/10 px-2 hover:bg-foreground/20 disabled:opacity-40"><Send className="h-3 w-3" /></button>
          </div>
        </aside>
      </div>

      {showSettings && <BYOKSettings onClose={() => setShowSettings(false)} provider={provider} model={model} apiKey={apiKey} setProvider={setProvider} setModel={setModel} setApiKey={setApiKey} />}
      {showPublish && <PublishDialog onClose={() => setShowPublish(false)} onPublish={publishAsTab} defaultName={activeProject.name} />}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────
function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, tplId: string) => void }) {
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState(ASHER_CODE_TEMPLATES[0].id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase">New Project</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="w-full rounded-md border border-border/20 bg-card/40 px-3 py-2 text-xs font-light mb-3 focus:border-foreground/40 focus:outline-none" />
        <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase mb-2">Template</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
          {ASHER_CODE_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setTpl(t.id)} className={`rounded-lg border p-3 text-left transition ${tpl === t.id ? "border-foreground/40 bg-foreground/10" : "border-border/15 bg-card/20 hover:border-foreground/20"}`}>
              <p className="text-xs font-light">{t.name}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t.description}</p>
              <p className="text-[9px] text-muted-foreground/40 mt-1 uppercase tracking-wider">{t.stack}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/5">Cancel</button>
          <button onClick={() => name.trim() && onCreate(name.trim(), tpl)} disabled={!name.trim()} className="rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/20 disabled:opacity-40">Create</button>
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
          <button onClick={() => onPublish(name.trim(), icon, vis)} disabled={!name.trim()} className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/80 hover:bg-emerald-400/20 disabled:opacity-40">Publish</button>
        </div>
      </div>
    </div>
  );
}
