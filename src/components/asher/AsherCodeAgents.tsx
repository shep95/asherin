// AGENTS — Custom Agent Builder for Asher Code IDE
// 10 agent types · marketplace · workflows · live monitoring.
// All execution is LIVE through the asher-code-ai edge function — no simulations.
// State persisted to localStorage per-project (no new backend tables required).

import { useEffect, useMemo, useState } from "react";
import {
  Bot, Plus, Play, Pause, Trash2, Copy, Download, Upload, Store, Activity,
  CheckCircle2, XCircle, Loader2, Settings, Workflow, Save, Search, Edit3,
  Code2, Bug, ShieldCheck, FileSearch, GitBranch, MessageSquare, Database,
  Globe, Cpu, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId: string;
  files: Array<{ path: string; content: string }>;
}

type AgentType =
  | "code-reviewer" | "bug-hunter" | "refactor" | "doc-writer" | "test-generator"
  | "security-auditor" | "perf-profiler" | "dep-watcher" | "api-designer" | "data-mapper";

interface AgentDef {
  id: string;
  name: string;
  type: AgentType;
  systemPrompt: string;
  trigger: "manual" | "on-save" | "scheduled";
  schedule?: string;          // ISO interval or cron-like (manual eval per session)
  scope: { include: string[]; exclude: string[] }; // glob-ish prefixes
  enabled: boolean;
  createdAt: string;
}

interface RunRecord {
  id: string;
  agentId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "ok" | "error";
  output?: string;
  error?: string;
}

const TYPE_META: Record<AgentType, { label: string; icon: any; defaultPrompt: string }> = {
  "code-reviewer":    { label: "Code Reviewer",    icon: Code2,        defaultPrompt: "Review the included files. Flag bugs, smells, and improvements with file:line evidence." },
  "bug-hunter":       { label: "Bug Hunter",       icon: Bug,          defaultPrompt: "Hunt latent bugs: race conditions, null derefs, off-by-one, leaked promises. Provide PoC reasoning." },
  "refactor":         { label: "Refactor Architect", icon: Edit3,      defaultPrompt: "Propose precise refactors with before/after diffs. Preserve behavior. Reduce cyclomatic complexity." },
  "doc-writer":       { label: "Documentation",    icon: FileSearch,   defaultPrompt: "Generate JSDoc/TSDoc & a README section per file. Include usage examples." },
  "test-generator":   { label: "Test Generator",   icon: CheckCircle2, defaultPrompt: "Generate vitest/jest tests covering edge cases for each exported symbol." },
  "security-auditor": { label: "Security Auditor", icon: ShieldCheck,  defaultPrompt: "OWASP Top 10 + business logic flaws. Output severity, CWE, exploit narrative." },
  "perf-profiler":    { label: "Perf Profiler",    icon: Cpu,          defaultPrompt: "Identify hot paths, O(n^2) loops, redundant renders, oversized bundles." },
  "dep-watcher":      { label: "Dependency Watch", icon: GitBranch,    defaultPrompt: "Audit declared dependencies for staleness, CVEs, and unused imports." },
  "api-designer":     { label: "API Designer",     icon: Globe,        defaultPrompt: "Review API endpoints/contracts. Suggest REST/RPC improvements & OpenAPI spec." },
  "data-mapper":      { label: "Data Mapper",      icon: Database,     defaultPrompt: "Map data flows: source → transform → sink. Flag PII handling violations." },
};

const MARKETPLACE: Array<Omit<AgentDef, "id" | "createdAt" | "enabled">> = [
  { name: "Senior PR Reviewer",      type: "code-reviewer",    systemPrompt: "Act as a Staff Engineer at Google. Review with brutal honesty. Block on any P0/P1.", trigger: "manual", scope: { include: [], exclude: ["node_modules"] } },
  { name: "Pre-Commit Bug Sweep",    type: "bug-hunter",       systemPrompt: "Surface concurrency bugs and unhandled rejections. Cite file:line.",                trigger: "on-save", scope: { include: ["src/"], exclude: [] } },
  { name: "OWASP Hardening Pass",    type: "security-auditor", systemPrompt: "Map findings to OWASP Top 10 + CWE IDs. Provide PoC and exact patch.",              trigger: "manual", scope: { include: ["src/", "supabase/"], exclude: [] } },
  { name: "Vitest Coverage Booster", type: "test-generator",   systemPrompt: "Generate vitest tests using @testing-library where applicable. Target 90%+ branch coverage.", trigger: "manual", scope: { include: ["src/"], exclude: ["**/*.test.*"] } },
  { name: "TSDoc Sweeper",           type: "doc-writer",       systemPrompt: "Add TSDoc to every exported function. Provide @param, @returns, @example.",         trigger: "manual", scope: { include: ["src/"], exclude: [] } },
  { name: "Render-Cost Auditor",     type: "perf-profiler",    systemPrompt: "React perf — useMemo/useCallback opportunities, prop-drilling smells, key warnings.", trigger: "manual", scope: { include: ["src/"], exclude: [] } },
];

export default function AsherCodeAgents({ projectId, files }: Props) {
  const agentsKey = `asherCode.agents.${projectId}`;
  const runsKey   = `asherCode.agentRuns.${projectId}`;

  const [agents, setAgents] = useState<AgentDef[]>(() => { try { return JSON.parse(localStorage.getItem(agentsKey) || "[]"); } catch { return []; } });
  const [runs, setRuns]     = useState<RunRecord[]>(() => { try { return JSON.parse(localStorage.getItem(runsKey)   || "[]"); } catch { return []; } });
  const [view, setView]     = useState<"list" | "new" | "marketplace" | "monitor" | "workflow">("list");
  const [editing, setEditing] = useState<AgentDef | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { localStorage.setItem(agentsKey, JSON.stringify(agents)); }, [agentsKey, agents]);
  useEffect(() => { localStorage.setItem(runsKey, JSON.stringify(runs.slice(-200))); }, [runsKey, runs]);

  function saveAgent(a: AgentDef) {
    setAgents(curr => {
      const idx = curr.findIndex(x => x.id === a.id);
      if (idx >= 0) { const n = [...curr]; n[idx] = a; return n; }
      return [...curr, a];
    });
    toast.success(`Agent "${a.name}" saved`);
  }

  function deleteAgent(id: string) {
    if (!confirm("Delete this agent?")) return;
    setAgents(curr => curr.filter(x => x.id !== id));
  }

  function duplicateAgent(a: AgentDef) {
    saveAgent({ ...a, id: crypto.randomUUID(), name: a.name + " (copy)", createdAt: new Date().toISOString() });
  }

  function installFromMarketplace(tpl: typeof MARKETPLACE[number]) {
    const def: AgentDef = { ...tpl, id: crypto.randomUUID(), enabled: true, createdAt: new Date().toISOString() };
    saveAgent(def);
    setView("list");
  }

  function exportAgents() {
    const blob = new Blob([JSON.stringify(agents, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `agents-${projectId}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function importAgents(file: File) {
    try {
      const text = await file.text();
      const arr = JSON.parse(text) as AgentDef[];
      if (!Array.isArray(arr)) throw new Error("Invalid format");
      setAgents(curr => [...curr, ...arr.map(a => ({ ...a, id: crypto.randomUUID(), createdAt: new Date().toISOString() }))]);
      toast.success(`Imported ${arr.length} agents`);
    } catch (e: any) { toast.error(e?.message || "Import failed"); }
  }

  function scopedFiles(a: AgentDef) {
    return files.filter(f => {
      if (a.scope.exclude.some(p => p && f.path.includes(p))) return false;
      if (!a.scope.include.length) return true;
      return a.scope.include.some(p => p && f.path.startsWith(p));
    });
  }

  async function runAgent(a: AgentDef) {
    if (!a.enabled) { toast.error("Agent is disabled"); return; }
    const fs = scopedFiles(a);
    if (!fs.length) { toast.error("No files in scope"); return; }
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    setRuns(r => [...r, { id: runId, agentId: a.id, startedAt, status: "running" }]);

    const digest = fs.slice(0, 60).map(f => `\n\n--- ${f.path} ---\n${(f.content || "").slice(0, 5000)}`).join("");
    const messages = [{
      role: "user",
      content: `${a.systemPrompt}\n\nLIVE codebase analysis. Do not invent. Cite file:line.\n${digest}`,
    }];

    try {
      const { data, error } = await supabase.functions.invoke("asher-code-ai", {
        body: { messages, mode: `agent:${a.type}`, projectId, agentId: a.id, model: "google/gemini-2.5-pro" },
      });
      if (error) throw error;
      const output = (data as any)?.content || (data as any)?.message || JSON.stringify(data);
      setRuns(r => r.map(x => x.id === runId ? { ...x, finishedAt: new Date().toISOString(), status: "ok", output } : x));
      toast.success(`${a.name} finished`);
    } catch (e: any) {
      setRuns(r => r.map(x => x.id === runId ? { ...x, finishedAt: new Date().toISOString(), status: "error", error: e?.message || "Run failed" } : x));
      toast.error(`${a.name}: ${e?.message || "failed"}`);
    }
  }

  // On-save hook: re-run agents with trigger="on-save" whenever the files prop changes.
  useEffect(() => {
    if (!files.length) return;
    const onSave = agents.filter(a => a.enabled && a.trigger === "on-save");
    if (!onSave.length) return;
    const t = setTimeout(() => { onSave.forEach(runAgent); }, 1500); // debounce
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(a => a.name.toLowerCase().includes(q) || a.type.includes(q));
  }, [agents, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/15 px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] tracking-[0.25em] uppercase font-light">Agents</span>
          <span className="text-[9px] text-muted-foreground/50">· {agents.length} configured · {runs.filter(r => r.status === "running").length} running</span>
        </div>
        <div className="flex items-center gap-1">
          {(["list","new","marketplace","monitor","workflow"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded border ${view === v ? "border-foreground/40 bg-foreground/10" : "border-border/20 bg-card/30 hover:border-foreground/30"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === "list" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter agents…" className="w-full bg-card/30 border border-border/20 rounded pl-7 pr-2 py-1.5 text-[10px] focus:outline-none focus:border-foreground/40" />
              </div>
              <button onClick={() => { setEditing(null); setView("new"); }} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/30 hover:border-foreground/30 px-2 py-1.5 text-[10px] uppercase tracking-[0.2em]"><Plus className="h-3 w-3" /> New</button>
              <button onClick={exportAgents} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/30 hover:border-foreground/30 px-2 py-1.5 text-[10px] uppercase tracking-[0.2em]"><Download className="h-3 w-3" /></button>
              <label className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/30 hover:border-foreground/30 px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] cursor-pointer">
                <Upload className="h-3 w-3" />
                <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importAgents(e.target.files[0])} />
              </label>
            </div>
            {!filteredAgents.length && (
              <p className="text-[11px] text-muted-foreground/60 italic p-3 text-center">No agents yet — create one or browse the Marketplace.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredAgents.map(a => {
                const Icon = TYPE_META[a.type].icon;
                const lastRun = [...runs].reverse().find(r => r.agentId === a.id);
                return (
                  <div key={a.id} className="rounded border border-border/15 bg-card/30 p-2.5">
                    <div className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 mt-0.5 text-foreground/70" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-light truncate">{a.name}</p>
                          <span className={`text-[8px] uppercase tracking-[0.2em] border rounded px-1.5 py-0.5 ${a.enabled ? "border-emerald-400/40 text-emerald-400" : "border-border/20 text-muted-foreground/60"}`}>{a.enabled ? "ENABLED" : "PAUSED"}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{TYPE_META[a.type].label} · {a.trigger}</p>
                        {lastRun && (
                          <p className="text-[9px] text-muted-foreground/50 mt-1">
                            Last: {lastRun.status === "ok" ? <CheckCircle2 className="inline h-2.5 w-2.5 text-emerald-400" /> : lastRun.status === "error" ? <XCircle className="inline h-2.5 w-2.5 text-red-400" /> : <Loader2 className="inline h-2.5 w-2.5 animate-spin" />} {new Date(lastRun.startedAt).toLocaleTimeString()}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          <button onClick={() => runAgent(a)} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"><Play className="h-2.5 w-2.5" /> Run</button>
                          <button onClick={() => saveAgent({ ...a, enabled: !a.enabled })} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"><Pause className="h-2.5 w-2.5" /> {a.enabled ? "Pause" : "Resume"}</button>
                          <button onClick={() => { setEditing(a); setView("new"); }} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"><Settings className="h-2.5 w-2.5" /></button>
                          <button onClick={() => duplicateAgent(a)} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"><Copy className="h-2.5 w-2.5" /></button>
                          <button onClick={() => deleteAgent(a.id)} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-red-400/40 hover:text-red-400 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"><Trash2 className="h-2.5 w-2.5" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "new" && (
          <AgentEditor
            initial={editing}
            onCancel={() => { setEditing(null); setView("list"); }}
            onSave={(a) => { saveAgent(a); setEditing(null); setView("list"); }}
          />
        )}

        {view === "marketplace" && (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {MARKETPLACE.map((tpl, i) => {
              const Icon = TYPE_META[tpl.type].icon;
              return (
                <div key={i} className="rounded border border-border/15 bg-card/30 p-2.5">
                  <div className="flex items-start gap-2">
                    <Icon className="h-3.5 w-3.5 mt-0.5 text-foreground/70" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-light">{tpl.name}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{TYPE_META[tpl.type].label} · {tpl.trigger}</p>
                      <p className="text-[9px] text-muted-foreground/70 mt-1 line-clamp-2">{tpl.systemPrompt}</p>
                      <button onClick={() => installFromMarketplace(tpl)} className="mt-2 inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"><Plus className="h-2.5 w-2.5" /> Install</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "monitor" && (
          <div className="p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-2"><Activity className="inline h-3 w-3 mr-1" /> Recent Runs ({runs.length})</p>
            {!runs.length && <p className="text-[11px] text-muted-foreground/60 italic">No runs yet.</p>}
            {[...runs].reverse().slice(0, 50).map(r => {
              const a = agents.find(x => x.id === r.agentId);
              return (
                <details key={r.id} className="rounded border border-border/15 bg-card/30">
                  <summary className="flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-pointer text-[10px]">
                    <span className="flex items-center gap-2">
                      {r.status === "ok" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> :
                        r.status === "error" ? <XCircle className="h-3 w-3 text-red-400" /> :
                        <Loader2 className="h-3 w-3 animate-spin" />}
                      <span className="font-light">{a?.name || "(deleted)"}</span>
                    </span>
                    <span className="text-muted-foreground/60 text-[9px]">{new Date(r.startedAt).toLocaleString()}</span>
                  </summary>
                  <div className="border-t border-border/15 p-2.5 max-h-64 overflow-auto">
                    {r.error && <p className="text-[10px] text-red-400/80">{r.error}</p>}
                    {r.output && <pre className="text-[10px] whitespace-pre-wrap font-light">{r.output}</pre>}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {view === "workflow" && (
          <WorkflowBuilder
            projectId={projectId}
            agents={agents}
            onRunAgent={runAgent}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Agent Editor (create / edit)
// ──────────────────────────────────────────────────────────────────
function AgentEditor({ initial, onCancel, onSave }: { initial: AgentDef | null; onCancel: () => void; onSave: (a: AgentDef) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<AgentType>(initial?.type || "code-reviewer");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || TYPE_META["code-reviewer"].defaultPrompt);
  const [trigger, setTrigger] = useState<"manual" | "on-save" | "scheduled">(initial?.trigger || "manual");
  const [include, setInclude] = useState((initial?.scope.include || []).join(", "));
  const [exclude, setExclude] = useState((initial?.scope.exclude || ["node_modules"]).join(", "));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  return (
    <div className="p-3 space-y-3 max-w-2xl">
      <div className="space-y-1">
        <label className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-card/30 border border-border/20 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-foreground/40" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">Type</label>
          <select value={type} onChange={e => { const t = e.target.value as AgentType; setType(t); if (!initial) setSystemPrompt(TYPE_META[t].defaultPrompt); }} className="w-full bg-card/30 border border-border/20 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-foreground/40">
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">Trigger</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value as any)} className="w-full bg-card/30 border border-border/20 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-foreground/40">
            <option value="manual">Manual</option>
            <option value="on-save">On file change</option>
            <option value="scheduled">Scheduled (per-session)</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">System Prompt</label>
        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={6} className="w-full bg-card/30 border border-border/20 rounded px-2 py-1.5 text-[11px] font-light focus:outline-none focus:border-foreground/40" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">Include path prefixes (comma)</label>
          <input value={include} onChange={e => setInclude(e.target.value)} placeholder="src/, supabase/" className="w-full bg-card/30 border border-border/20 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-foreground/40" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">Exclude (comma)</label>
          <input value={exclude} onChange={e => setExclude(e.target.value)} className="w-full bg-card/30 border border-border/20 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-foreground/40" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[10px]">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        Enabled
      </label>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="rounded border border-border/20 bg-card/30 hover:border-foreground/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">Cancel</button>
        <button
          onClick={() => {
            if (!name.trim()) { toast.error("Name required"); return; }
            onSave({
              id: initial?.id || crypto.randomUUID(),
              name: name.trim(),
              type,
              systemPrompt: systemPrompt.trim(),
              trigger,
              scope: {
                include: include.split(",").map(s => s.trim()).filter(Boolean),
                exclude: exclude.split(",").map(s => s.trim()).filter(Boolean),
              },
              enabled,
              createdAt: initial?.createdAt || new Date().toISOString(),
            });
          }}
          className="inline-flex items-center gap-1 rounded border border-foreground/30 bg-foreground/10 hover:bg-foreground/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
        ><Save className="h-3 w-3" /> Save</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Workflow Builder — sequential agent chain
// ──────────────────────────────────────────────────────────────────
function WorkflowBuilder({ projectId, agents, onRunAgent }: { projectId: string; agents: AgentDef[]; onRunAgent: (a: AgentDef) => Promise<void> }) {
  const key = `asherCode.workflow.${projectId}`;
  const [chain, setChain] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } });
  const [running, setRunning] = useState(false);
  useEffect(() => { localStorage.setItem(key, JSON.stringify(chain)); }, [key, chain]);

  async function runAll() {
    if (running) return;
    setRunning(true);
    try {
      for (const id of chain) {
        const a = agents.find(x => x.id === id);
        if (a) await onRunAgent(a);
      }
      toast.success("Workflow finished");
    } finally { setRunning(false); }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60"><Workflow className="inline h-3 w-3 mr-1" /> Sequential Workflow</p>
        <button disabled={running || !chain.length} onClick={runAll} className="inline-flex items-center gap-1 rounded border border-foreground/30 bg-foreground/10 hover:bg-foreground/20 disabled:opacity-40 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Run Workflow
        </button>
      </div>
      <div className="space-y-1.5">
        {chain.map((id, idx) => {
          const a = agents.find(x => x.id === id);
          return (
            <div key={`${id}-${idx}`} className="flex items-center gap-2 rounded border border-border/15 bg-card/30 px-2.5 py-1.5">
              <span className="text-[9px] text-muted-foreground/60 w-5">#{idx + 1}</span>
              <span className="flex-1 text-[10px] font-light">{a?.name || "(missing agent)"}</span>
              <button onClick={() => setChain(c => c.filter((_, i) => i !== idx))} className="text-muted-foreground/60 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            </div>
          );
        })}
        {!chain.length && <p className="text-[10px] text-muted-foreground/60 italic">Add agents to build a chain.</p>}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60 mb-1">Add agent</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {agents.map(a => (
            <button key={a.id} onClick={() => setChain(c => [...c, a.id])} className="flex items-center gap-2 rounded border border-border/15 bg-card/30 hover:border-foreground/30 px-2 py-1.5 text-left">
              <Plus className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] font-light truncate">{a.name}</span>
              <span className="ml-auto text-[8px] uppercase tracking-[0.2em] text-muted-foreground/50">{TYPE_META[a.type].label}</span>
            </button>
          ))}
          {!agents.length && <p className="text-[10px] text-muted-foreground/60 italic">Create agents first.</p>}
        </div>
      </div>
    </div>
  );
}
