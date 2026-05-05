import { useEffect, useRef, useState } from "react";
import {
  Workflow, Activity, Clock, Layers, Radio, Shield, Database, Cpu, GitBranch,
  Terminal, ExternalLink, ChevronRight, Zap, Lock, AlertCircle, AlertTriangle,
  Play, Square, RefreshCw, CheckCircle2, Loader2, FileLock2, Satellite, Users,
  Eye, Crosshair, Globe, Server, Fingerprint, Siren, Trash2, ShieldAlert,
  Building2, Network, Radar, Award, KeyRound, Rocket, Send, Sparkles, GitFork,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { toast } from "sonner";

/**
 * ZAHTEN — House of Asher
 * Hardened Trigger.dev fork → classified-ready intelligence operations console.
 *
 * Two halves:
 *  1) AUTONOMOUS MISSION CONSOLE (top) — operator types ONE prompt and the
 *     engine self-iterates: drafts → critiques → refines → auto-approves
 *     until it emits MISSION_COMPLETE or hits the iteration cap. No further
 *     typing required.
 *  2) GOVERNMENT/INTELLIGENCE CAPABILITY MATRIX (below) — classification
 *     system, air-gap mode, immutable audit, OSINT/SIGINT/HUMINT/GEOINT
 *     templates, emergency protocols, multi-tenant isolation, RTOC,
 *     gov-system integrations, biometric auth, deployment topology.
 *
 * AI: routes through `asher-ai` (Gemini-only, admin GEMINI_API_KEY or user BYOK).
 * No Lovable AI Gateway. Per ASHER DASHBOARD AI policy.
 */

const REPO_URL = "https://github.com/ZorakCorp/project---zahten-";
const MAX_ITERATIONS_DEFAULT = 8;

// ───────────────────────── Mission Console types ─────────────────────────

type Pass = {
  n: number;
  status: "running" | "refining" | "complete" | "error";
  text: string;
  startedAt: number;
  endedAt?: number;
};

const ORCHESTRATOR_SYSTEM = `You are ZAHTEN AGENT BUILDER — an autonomous engine that designs, scaffolds and hardens production-grade automated agents (Trigger.dev-style: durable, retryable, observable, schedulable).

OPERATING DOCTRINE:
1. The operator gives ONE agent objective. By this point the scope is sufficient (the scope assessor already ran). Do NOT ask further questions.
2. Each pass MUST produce the FULL current best version of the agent specification AND its working code (not a diff).
3. After producing output, SILENTLY self-critique: missing triggers, weak retry logic, unhandled edge cases, missing observability, shallow tool integration, security gaps. Then produce an improved full revision.
4. Keep iterating until the agent is genuinely production-grade and could ship to a Trigger.dev deployment as-is.

OUTPUT CONTRACT (every single pass) — use these exact bold sections in this order:

**PASS N — <one-line summary of this pass's improvement>**

**AGENT SPEC**
- Name: <slug>
- Purpose: <one sentence>
- Trigger: <event | schedule(cron) | webhook | manual>
- Schedule: <cron or "n/a">
- Inputs: <typed payload schema>
- Outputs: <typed result schema>
- Tools / Integrations: <list>
- Secrets required: <list, or "none">
- Concurrency / queue: <rule>
- Retry policy: <attempts, backoff>
- Idempotency key: <strategy>
- Observability: <logs, metrics, alerts>

**WORKFLOW** (numbered steps, each step names the tool, inputs, outputs, failure mode)

**CODE** (one fenced \`\`\`ts block, complete Trigger.dev v3 task definition: \`task({ id, run })\`, all imports, typed payload, retry/queue config, structured logger calls, error handling)

**TEST PLAN** (table: scenario | input | expected | failure mode covered)

End the message with EXACTLY one of these sentinel lines on its own:
    STATUS: REFINING — <one-sentence reason why another pass is needed>
    STATUS: MISSION_COMPLETE — <one-sentence reason this agent is now production-grade>

Voice: Senior staff engineer. Surgical. Direct. No filler. No "Certainly".`;

const SCOPE_ASSESSOR_SYSTEM = `You are ZAHTEN SCOPE ASSESSOR. Your only job is to decide whether an agent-build prompt has enough information to produce a production-grade automated agent without guessing core decisions.

Required signal (must be inferable from the prompt):
- What the agent does (action verb + target system)
- When it runs (trigger: event / schedule / webhook / manual)
- Where data comes from and where results go
- Any external services / APIs / credentials involved
- Success criteria or expected output shape

Respond with ONE of these two formats and nothing else:

READY
<one short sentence restating the agent in your own words>

or

CLARIFY
1. <specific question>
2. <specific question>
3. <specific question>
(2–5 questions max, each one concrete and answerable in one line. Never ask vague "tell me more" questions.)`;

function parseStatus(text: string): "refining" | "complete" | null {
  const m = text.match(/STATUS:\s*(REFINING|MISSION_COMPLETE)/i);
  if (!m) return null;
  return m[1].toUpperCase() === "MISSION_COMPLETE" ? "complete" : "refining";
}

// ──────────────────────── Capability matrix data ────────────────────────

const PILLARS = [
  { icon: Clock,    label: "Durability",      desc: "Long-running tasks, retries, idempotency, checkpointing — operations that cannot vanish mid-flight." },
  { icon: Activity, label: "Observability",   desc: "Traces, logs, run metadata surfaced like you actually operate the thing." },
  { icon: Shield,   label: "Operator Posture", desc: "Baseline HTTP hardening, X-Request-Id correlation, structured audit hooks." },
  { icon: Lock,     label: "Self-Sovereign",  desc: "Self-host, extend the webapp & workers, keep your stack on your metal." },
];

const CAPABILITIES = [
  { icon: Workflow,  label: "Workflows",  detail: "Compose LLM steps, tools, and human-in-the-loop pauses." },
  { icon: Layers,    label: "Queues",     detail: "Concurrency rules that match how your org runs work." },
  { icon: Radio,     label: "Realtime",   detail: "Subscribe to runs, stream outputs — no polling." },
  { icon: GitBranch, label: "Schedules",  detail: "Durable cron that survives deploys and reality." },
  { icon: Cpu,       label: "Extensions", detail: "Browsers, FFmpeg, sidecars — the boring stuff." },
  { icon: Database,  label: "Audit",      detail: "Structured security audit signals on every request." },
];

const CLASSIFICATIONS = [
  { tier: "UNCLASSIFIED", desc: "Public release authorised." },
  { tier: "CUI",          desc: "Controlled Unclassified Information — handling required." },
  { tier: "CONFIDENTIAL", desc: "Damage to national security if disclosed." },
  { tier: "SECRET",       desc: "Serious damage if disclosed. Default operating tier." },
  { tier: "TOP SECRET",   desc: "Exceptionally grave damage." },
  { tier: "TS//SCI",      desc: "Sensitive Compartmented Information. Compartments enforced (HUMINT, SIGINT, GEOINT)." },
];

const INTEL_DISCIPLINES = [
  { icon: Globe,    label: "OSINT",  detail: "Social monitor, entity extraction, social-graph build, sentiment, timeline reconstruction." },
  { icon: Radar,    label: "SIGINT", detail: "Comms intercept analysis, metadata extraction, pattern matching, geolocation triangulation." },
  { icon: Users,    label: "HUMINT", detail: "Source debriefing, credibility scoring, cross-referencing, gap analysis, collection tasking." },
  { icon: Satellite,label: "GEOINT", detail: "Multi-sensor satellite (optical/SAR/IR), change detection, object detection, activity patterns." },
  { icon: Crosshair,label: "IMINT",  detail: "Imagery intelligence fusion across discipline outputs into a single threat board." },
  { icon: Eye,      label: "Predictive", detail: "Aureon forecast engine — 7–30 day windows, confidence-thresholded courses of action." },
];

const COMPLIANCE = [
  { std: "FIPS 140-2",   req: "Validated cryptographic modules",      impl: "HSM integration, AES-256-GCM at rest, TLS 1.3 mTLS in transit" },
  { std: "FedRAMP High", req: "Federal cloud security baseline",      impl: "Multi-zone defence, segmented VLANs, WORM audit storage" },
  { std: "NIST 800-53",  req: "Security & privacy controls",          impl: "Full control mapping with continuous attestation hooks" },
  { std: "DoD IL-6",     req: "Classified data handling",             impl: "Classification system, compartments, declassification workflow" },
  { std: "CJIS",         req: "Criminal-justice information services", impl: "Audit chain, dual approval on export, biometric MFA" },
  { std: "ITAR",         req: "Export control",                       impl: "Air-gap deployment, sneakernet ingress with GPG verification" },
];

const EMERGENCY = [
  { icon: Siren,      label: "Kill Switch",     detail: "Two senior officials → halt all workflows, sever external links, hardware-lock the host." },
  { icon: Trash2,     label: "Data Purge",      detail: "Three-officer rule → cryptographic erasure + DoD 5220.22-M 7-pass overwrite + physical-media alert." },
  { icon: ShieldAlert,label: "Breach Response", detail: "Auto-isolate, preserve forensics, damage assessment, stakeholder notification, recovery loop." },
];

const GOV_INTEGRATIONS = [
  { name: "JWICS",   tier: "TOP SECRET",      kind: "Secure gateway" },
  { name: "SIPRNet", tier: "SECRET",          kind: "Secure gateway" },
  { name: "NIPRNet", tier: "UNCLASSIFIED",    kind: "HTTPS" },
  { name: "TIDE",    tier: "SECRET",          kind: "Oracle RAC" },
  { name: "DCGS",    tier: "TOP SECRET//SI",  kind: "Message queue" },
  { name: "ICREACH", tier: "TOP SECRET//SI",  kind: "Mutual-TLS API" },
];

// ───────────────────────────── Component ─────────────────────────────

type ScopeState =
  | { phase: "idle" }
  | { phase: "assessing" }
  | { phase: "clarify"; questions: string[]; answers: string[] }
  | { phase: "ready"; restated: string };

type AgentRecord = {
  id: string;
  name: string;
  status: "draft" | "ready" | "scheduled" | "paused" | "live";
  trigger: string;
  lastRun?: string;
  passes: Pass[];
  objective: string;
  deployedAt?: number;
  liveRuns?: LiveRun[];
  secretValues?: Record<string, string>;
};

type LiveRun = {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "ok" | "failed";
  log: string[];
};

type ViewTab = "builder" | "workflow" | "runs" | "code" | "schedule" | "compliance";

const STARTER_AGENTS: AgentRecord[] = [
  { id: "agent-001", name: "GitHub Bug Triage", status: "scheduled", trigger: "cron: 0 7 * * *", lastRun: "2h ago", passes: [], objective: "Pull new GitHub issues labelled bug, summarise them, post digest to Slack #eng-triage." },
  { id: "agent-002", name: "OSINT Watchdog",    status: "ready",     trigger: "webhook",        lastRun: "—",      passes: [], objective: "Watch a list of news domains for keyword mentions and emit structured alerts." },
  { id: "agent-003", name: "Invoice Reconciler",status: "draft",     trigger: "manual",         lastRun: "—",      passes: [], objective: "" },
];

// Parse "Secrets required:" line from pass text → array of secret names
function parseRequiredSecrets(text: string): string[] {
  if (!text) return [];
  const m = text.match(/Secrets?\s*required\s*[:\-]\s*([^\n]+)/i);
  if (!m) return [];
  const raw = m[1].trim();
  if (/^(none|n\/?a|—|-)$/i.test(raw)) return [];
  return raw.split(/[,;]| and /i).map(s => s.replace(/[`*<>]/g, "").trim()).filter(s => s && s.length < 60).slice(0, 12);
}

// Parse numbered WORKFLOW steps from pass text → array of short labels
function parseWorkflowSteps(text: string): { n: number; label: string }[] {
  if (!text) return [];
  const wfMatch = text.match(/\*\*WORKFLOW\*\*([\s\S]*?)(?:\*\*CODE\*\*|\*\*TEST PLAN\*\*|$)/i);
  const block = wfMatch ? wfMatch[1] : text;
  const steps: { n: number; label: string }[] = [];
  const re = /^\s*(\d+)[.)]\s+(.+)$/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    const label = m[2].split(/[—\-:|]/)[0].replace(/\*/g, "").trim().slice(0, 60);
    if (label) steps.push({ n: parseInt(m[1]), label });
    if (steps.length >= 12) break;
  }
  return steps;
}

const AsherZahtenModule = () => {
  // Agent registry
  const [agents, setAgents] = useState<AgentRecord[]>(STARTER_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string>(STARTER_AGENTS[0].id);
  const [viewTab, setViewTab] = useState<ViewTab>("builder");
  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];

  // Mission Console state
  const [objective, setObjective] = useState(activeAgent?.objective || "");
  const [maxIters, setMaxIters] = useState(MAX_ITERATIONS_DEFAULT);
  const [autoApprove, setAutoApprove] = useState(true);
  const [running, setRunning] = useState(false);
  const [passes, setPasses] = useState<Pass[]>(activeAgent?.passes || []);
  const [classification, setClassification] = useState<string>("SECRET");
  const [scope, setScope] = useState<ScopeState>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Sync when switching agents
  useEffect(() => {
    if (!activeAgent) return;
    setObjective(activeAgent.objective);
    setPasses(activeAgent.passes);
    setScope({ phase: "idle" });
  }, [activeAgentId]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [passes]);

  const createAgent = () => {
    const id = `agent-${Date.now()}`;
    const next: AgentRecord = { id, name: `Untitled Agent ${agents.length + 1}`, status: "draft", trigger: "manual", passes: [], objective: "" };
    setAgents((p) => [next, ...p]);
    setActiveAgentId(id);
    setViewTab("builder");
  };

  const stopMission = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  const callAsherAi = async (history: { role: "user" | "assistant"; content: string }[], signal: AbortSignal): Promise<string> => {
    const byok = getActiveIntelMapByok();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-ai`;
    const resp = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        ...(byok ? { "x-byok-gemini-key": byok.apiKey } : {}),
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: `[ZAHTEN ORCHESTRATOR DOCTRINE]\n${ORCHESTRATOR_SYSTEM}\n\n[CLASSIFICATION] ${classification}` },
          ...history,
        ],
        mapContext: { surface: "zahten_mission_console" },
      }),
    });

    if (resp.status === 429) throw new Error("Rate limit — wait and retry");
    if (resp.status === 401) throw new Error("AI key invalid. Add a BYOK key in Settings.");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    if (!resp.ok || !resp.body) throw new Error(`Stream failed (${resp.status})`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let done = false;
    const passIdx = passes.length; // current in-progress pass
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
            text += delta.content;
            setPasses((p) => p.map((pp, i) => i === passIdx ? { ...pp, text } : pp));
          }
        } catch { buf = line + "\n" + buf; break; }
      }
    }
    return text;
  };

  // Plain (non-streaming-into-passes) call for the scope assessor.
  const callAsherAiPlain = async (system: string, user: string, signal: AbortSignal): Promise<string> => {
    const byok = getActiveIntelMapByok();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-ai`;
    const resp = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        ...(byok ? { "x-byok-gemini-key": byok.apiKey } : {}),
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: system },
          { role: "user", content: user },
        ],
        mapContext: { surface: "zahten_scope_assessor" },
      }),
    });
    if (!resp.ok || !resp.body) throw new Error(`Assessor failed (${resp.status})`);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", text = "", done = false;
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
          if (delta?.content) text += delta.content;
        } catch { buf = line + "\n" + buf; break; }
      }
    }
    return text.trim();
  };

  const parseAssessor = (text: string): { ready: boolean; restated?: string; questions?: string[] } => {
    const t = text.trim();
    if (/^READY\b/i.test(t)) {
      const rest = t.replace(/^READY\s*/i, "").trim();
      return { ready: true, restated: rest || "Scope confirmed." };
    }
    if (/^CLARIFY\b/i.test(t)) {
      const lines = t.split("\n").slice(1).map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
      return { ready: false, questions: lines.slice(0, 5) };
    }
    // Fallback: assume ready if model didn't follow format
    return { ready: true, restated: t.slice(0, 240) };
  };

  const assessScope = async () => {
    if (!objective.trim() || running || scope.phase === "assessing") return;
    setScope({ phase: "assessing" });
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const out = await callAsherAiPlain(
        SCOPE_ASSESSOR_SYSTEM,
        `AGENT BUILD PROMPT:\n${objective.trim()}`,
        ctl.signal,
      );
      const parsed = parseAssessor(out);
      if (parsed.ready) {
        setScope({ phase: "ready", restated: parsed.restated! });
      } else if (parsed.questions && parsed.questions.length) {
        setScope({ phase: "clarify", questions: parsed.questions, answers: parsed.questions.map(() => "") });
      } else {
        setScope({ phase: "ready", restated: "Scope confirmed." });
      }
    } catch (e: any) {
      toast.error(e?.message || "Scope assessment failed");
      setScope({ phase: "idle" });
    } finally {
      abortRef.current = null;
    }
  };

  const buildEnrichedObjective = (): string => {
    if (scope.phase !== "clarify") return objective.trim();
    const qa = scope.questions
      .map((q, i) => `Q: ${q}\nA: ${scope.answers[i]?.trim() || "(no answer — make a defensible assumption)"}`)
      .join("\n\n");
    return `${objective.trim()}\n\n--- CLARIFICATIONS ---\n${qa}`;
  };

  const deploy = async () => {
    if (!objective.trim() || running) return;

    // Pre-flight: if scope hasn't been assessed yet, run the assessor first.
    if (scope.phase === "idle") {
      await assessScope();
      return; // user reviews questions / restated scope, then clicks Deploy again
    }
    if (scope.phase === "assessing") return;

    setRunning(true);
    setPasses([]);
    const ctl = new AbortController();
    abortRef.current = ctl;

    const enriched = buildEnrichedObjective();
    const history: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: `AGENT BUILD OBJECTIVE:\n${enriched}\n\nExecute pass 1 now. Then self-critique and continue iterating until MISSION_COMPLETE.` },
    ];

    try {
      for (let n = 1; n <= maxIters; n++) {
        if (ctl.signal.aborted) break;
        setPasses((p) => [...p, { n, status: "running", text: "", startedAt: Date.now() }]);
        let text = "";
        try {
          text = await callAsherAi(history, ctl.signal);
        } catch (e: any) {
          if (ctl.signal.aborted) break;
          setPasses((p) => p.map((pp) => pp.n === n ? { ...pp, status: "error", text: pp.text + `\n\n_Error: ${e?.message || e}_`, endedAt: Date.now() } : pp));
          toast.error(e?.message || "Build pass failed");
          break;
        }
        const status = parseStatus(text);
        const isComplete = status === "complete" || n === maxIters;
        setPasses((p) => p.map((pp) => pp.n === n ? { ...pp, status: isComplete ? "complete" : "refining", text, endedAt: Date.now() } : pp));

        if (isComplete) {
          if (n === maxIters && status !== "complete") {
            toast.message(`Iteration cap hit at pass ${n}. Agent auto-finalized.`);
          } else {
            toast.success(`Agent built in ${n} pass${n === 1 ? "" : "es"}`);
          }
          break;
        }
        history.push({ role: "assistant", content: text });
        history.push({
          role: "user",
          content: autoApprove
            ? `APPROVED. Now perform pass ${n + 1}: harder self-critique, deeper edge cases, tighter code. Produce the FULL improved version. End with the STATUS sentinel.`
            : `Continue. Pass ${n + 1}.`,
        });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const resetScope = () => {
    setScope({ phase: "idle" });
    setPasses([]);
  };

  // Save current builder state into active agent
  useEffect(() => {
    setAgents((prev) => prev.map((a) => a.id === activeAgentId ? { ...a, objective, passes } : a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective, passes]);

  const lastCodeBlock = (() => {
    const last = passes[passes.length - 1];
    if (!last) return "";
    const m = last.text.match(/```ts([\s\S]*?)```/);
    return m ? m[1].trim() : "";
  })();

  const TABS: { id: ViewTab; label: string }[] = [
    { id: "builder",    label: "Builder" },
    { id: "runs",       label: "Runs" },
    { id: "code",       label: "Code" },
    { id: "schedule",   label: "Schedule" },
    { id: "compliance", label: "Platform" },
  ];

  return (
    <div className="h-full w-full flex bg-background text-foreground overflow-hidden">
      {/* My Agents sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border/15 bg-card/20 flex flex-col">
        <div className="px-4 py-4 border-b border-border/15 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">House of Asher</p>
            <p className="text-sm font-extralight tracking-[0.25em] text-foreground mt-0.5">ZAHTEN</p>
          </div>
          <button onClick={createAgent} title="New Agent" className="rounded-md border border-border/30 hover:border-foreground/50 px-2 py-1 text-[10px] font-light tracking-wide text-foreground/80 hover:text-foreground">+ New</button>
        </div>
        <div className="px-3 py-2 text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">My Agents</div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {agents.map((a) => {
            const isActive = a.id === activeAgentId;
            return (
              <button
                key={a.id}
                onClick={() => setActiveAgentId(a.id)}
                className={`w-full text-left rounded-md px-2.5 py-2 transition-colors ${isActive ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.status === "scheduled" ? "bg-emerald-400/80" : a.status === "ready" ? "bg-sky-400/80" : a.status === "paused" ? "bg-amber-400/80" : "bg-muted-foreground/40"}`} />
                  <span className="flex-1 text-[12px] font-light truncate">{a.name}</span>
                </div>
                <div className="mt-0.5 ml-3.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase truncate">{a.trigger}</div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/15 px-3 py-3">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase">
            <ExternalLink className="h-3 w-3" /> Repository
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="border-b border-border/15 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Workflow className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
            <input
              value={activeAgent?.name || ""}
              onChange={(e) => setAgents((p) => p.map((a) => a.id === activeAgentId ? { ...a, name: e.target.value } : a))}
              className="bg-transparent text-base font-extralight tracking-wide text-foreground focus:outline-none border-b border-transparent focus:border-border/40 px-1 min-w-[180px]"
            />
            <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase border border-border/30 rounded-full px-2 py-0.5">{activeAgent?.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase">Classification</span>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              disabled={running}
              className="bg-background/60 border border-border/30 rounded px-2 py-1 text-[10px] tracking-[0.2em] text-foreground/90 focus:outline-none focus:border-foreground/60 uppercase"
            >
              {CLASSIFICATIONS.map((c) => <option key={c.tier} value={c.tier}>{c.tier}</option>)}
            </select>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-border/15 px-6 flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setViewTab(t.id)}
              className={`px-3 py-2.5 text-[10px] font-light tracking-[0.25em] uppercase border-b-2 transition-colors ${viewTab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {viewTab !== "compliance" ? (
            <div className="mx-auto max-w-5xl px-8 py-8 space-y-6">

              {viewTab === "runs" && (
                <section className="rounded-xl border border-border/20 bg-card/30 p-5">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase mb-4">Recent Runs</p>
                  {passes.length === 0 ? (
                    <p className="text-[11px] font-extralight text-muted-foreground/70">No runs yet. Build the agent first to populate the run history.</p>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead><tr className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase border-b border-border/15"><th className="text-left py-2">Pass</th><th className="text-left py-2">Status</th><th className="text-left py-2">Started</th><th className="text-left py-2">Duration</th></tr></thead>
                      <tbody>
                        {passes.map((p) => (
                          <tr key={p.n} className="border-b border-border/10 last:border-0">
                            <td className="py-2 font-mono text-foreground/90">#{p.n}</td>
                            <td className="py-2 text-muted-foreground/85">{p.status}</td>
                            <td className="py-2 text-muted-foreground/70">{new Date(p.startedAt).toLocaleTimeString()}</td>
                            <td className="py-2 text-muted-foreground/70">{p.endedAt ? `${((p.endedAt - p.startedAt) / 1000).toFixed(1)}s` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {viewTab === "code" && (
                <section className="rounded-xl border border-border/20 bg-card/30 p-5">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase mb-3">Generated Trigger.dev Task</p>
                  {lastCodeBlock ? (
                    <pre className="font-mono text-[11px] leading-relaxed text-foreground/85 bg-background/60 border border-border/20 rounded-md p-4 overflow-auto max-h-[600px]">{lastCodeBlock}</pre>
                  ) : (
                    <p className="text-[11px] font-extralight text-muted-foreground/70">Run the Builder to generate the agent's code.</p>
                  )}
                </section>
              )}

              {viewTab === "schedule" && (
                <section className="rounded-xl border border-border/20 bg-card/30 p-5 space-y-3">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Trigger</p>
                  <div className="grid grid-cols-2 gap-3 text-[11px] font-extralight">
                    {["manual", "schedule", "webhook", "event"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setAgents((p) => p.map((a) => a.id === activeAgentId ? { ...a, trigger: t } : a))}
                        className={`rounded-md border px-3 py-2 text-left ${activeAgent?.trigger === t || activeAgent?.trigger?.startsWith(t) ? "border-foreground/50 bg-foreground/5 text-foreground" : "border-border/25 text-muted-foreground hover:text-foreground"}`}
                      >
                        <p className="text-[9px] tracking-[0.25em] uppercase">{t}</p>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase mb-1">Cron expression</p>
                    <input
                      placeholder="0 7 * * *"
                      defaultValue={activeAgent?.trigger?.startsWith("cron:") ? activeAgent.trigger.slice(5).trim() : ""}
                      onChange={(e) => setAgents((p) => p.map((a) => a.id === activeAgentId ? { ...a, trigger: e.target.value ? `cron: ${e.target.value}` : "manual" } : a))}
                      className="w-full bg-background/60 border border-border/30 rounded px-3 py-2 font-mono text-[11px] text-foreground focus:outline-none focus:border-foreground/60"
                    />
                  </div>
                </section>
              )}

              {viewTab === "builder" && (
                <>
                  <section className="rounded-xl border border-border/25 bg-card/40 p-4 flex items-start gap-3">
                    <Lock className="h-3.5 w-3.5 text-foreground/70 mt-0.5" strokeWidth={1.5} />
                    <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
                      Set your LLM API key once in <span className="text-foreground/90">Settings → Bring Your Own LLM Key</span>.
                      The Builder uses the Scope Assessor to clarify your prompt, then iterates spec + Trigger.dev code until production-grade.
                    </p>
                  </section>
                </>
              )}
            </div>
          ) : null}

          {viewTab === "builder" && (
          <div className="mx-auto max-w-5xl px-8 pb-10 space-y-6">

        {/* ─────────── AUTONOMOUS MISSION CONSOLE ─────────── */}
        <section className="rounded-2xl border border-border/25 bg-card/40 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Step 1 → Describe Agent  ·  Step 2 → Answer Clarifications  ·  Step 3 → Build</p>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-light tracking-[0.25em] uppercase">
              <span className="text-muted-foreground/60">Classification</span>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                disabled={running}
                className="bg-background/60 border border-border/30 rounded px-2 py-1 text-foreground/90 focus:outline-none focus:border-foreground/60"
              >
                {CLASSIFICATIONS.map((c) => <option key={c.tier} value={c.tier}>{c.tier}</option>)}
              </select>
            </div>
          </div>

          <textarea
            value={objective}
            onChange={(e) => { setObjective(e.target.value); if (scope.phase !== "idle") setScope({ phase: "idle" }); }}
            disabled={running || scope.phase === "assessing"}
            placeholder="Describe the agent you want. e.g. 'Every morning at 7am pull new GitHub issues labelled bug, summarise them with an LLM, and post the digest to Slack #eng-triage.' If you skip key details (trigger, source, destination, success criteria) the assessor will ask before building."
            rows={4}
            className="w-full bg-background/60 border border-border/30 rounded-lg px-4 py-3 text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/60 resize-none"
          />

          <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} disabled={running} className="accent-foreground" />
                Auto-Approve Refinements
              </label>
              <div className="flex items-center gap-2">
                <span>Max Passes</span>
                <input
                  type="number" min={1} max={20} value={maxIters}
                  onChange={(e) => setMaxIters(Math.max(1, Math.min(20, parseInt(e.target.value || "1"))))}
                  disabled={running}
                  className="w-14 bg-background/60 border border-border/30 rounded px-2 py-1 text-foreground/90 focus:outline-none focus:border-foreground/60"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {running ? (
                <button onClick={stopMission} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 text-[10px] font-light tracking-[0.25em] text-foreground uppercase transition-colors">
                  <Square className="h-3 w-3" strokeWidth={1.5} /> Abort Build
                </button>
              ) : (
                <>
                  {scope.phase !== "idle" && (
                    <button onClick={resetScope} className="inline-flex items-center gap-2 rounded-lg border border-border/30 hover:border-foreground/40 px-3 py-2 text-[10px] font-light tracking-[0.25em] text-muted-foreground hover:text-foreground uppercase transition-colors">
                      Reset Scope
                    </button>
                  )}
                  <button
                    onClick={deploy}
                    disabled={!objective.trim() || scope.phase === "assessing" || (scope.phase === "clarify" && scope.answers.every((a) => !a.trim()))}
                    className="inline-flex items-center gap-2 rounded-lg border border-foreground/40 bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 text-[10px] font-light tracking-[0.25em] text-foreground uppercase transition-colors"
                  >
                    {scope.phase === "assessing" ? (
                      <><Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> Assessing Scope</>
                    ) : scope.phase === "idle" ? (
                      <><Eye className="h-3 w-3" strokeWidth={1.5} /> Assess & Build</>
                    ) : scope.phase === "clarify" ? (
                      <><Play className="h-3 w-3" strokeWidth={1.5} /> Build Agent</>
                    ) : (
                      <><Play className="h-3 w-3" strokeWidth={1.5} /> Build Agent</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Scope assessor — clarify panel */}
          {scope.phase === "clarify" && (
            <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Scope Assessor — Clarification Needed</p>
                  <p className="mt-1 text-[11px] font-extralight text-muted-foreground/80 leading-relaxed">
                    Your prompt is light on specifics. Answer what you can — anything left blank will be filled with a defensible assumption.
                  </p>
                </div>
              </div>
              {scope.questions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[11px] font-light text-foreground/85">{i + 1}. {q}</p>
                  <input
                    value={scope.answers[i]}
                    onChange={(e) => {
                      const next = [...scope.answers]; next[i] = e.target.value;
                      setScope({ ...scope, answers: next });
                    }}
                    placeholder="Your answer (optional)"
                    className="w-full bg-background/60 border border-border/30 rounded px-3 py-2 text-[12px] font-extralight text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/60"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Scope assessor — ready panel */}
          {scope.phase === "ready" && (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Scope Confirmed</p>
                  <p className="mt-1 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{scope.restated}</p>
                </div>
              </div>
            </div>
          )}

          {/* Iteration log */}
          {passes.length > 0 && (
            <div className="mt-6 space-y-3">
              {passes.map((p) => (
                <div key={p.n} className="rounded-lg border border-border/20 bg-background/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {p.status === "running" && <Loader2 className="h-3 w-3 text-foreground/70 animate-spin" strokeWidth={1.5} />}
                      {p.status === "refining" && <RefreshCw className="h-3 w-3 text-foreground/70" strokeWidth={1.5} />}
                      {p.status === "complete" && <CheckCircle2 className="h-3 w-3 text-foreground/90" strokeWidth={1.5} />}
                      {p.status === "error" && <AlertCircle className="h-3 w-3 text-red-400" strokeWidth={1.5} />}
                      <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Pass {p.n} · {p.status}</p>
                    </div>
                    {p.endedAt && (
                      <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
                        {((p.endedAt - p.startedAt) / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/85 max-h-[420px] overflow-y-auto">
                    {p.text || (p.status === "running" ? "…" : "")}
                  </pre>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {!passes.length && scope.phase === "idle" && (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-border/20 bg-background/30 p-3">
              <Zap className="h-3 w-3 text-foreground/60 mt-0.5" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase leading-relaxed">
                Two-phase build: (1) the Scope Assessor reads your prompt and asks for any missing details,
                (2) the Builder iterates spec + Trigger.dev code, self-critiquing each pass until MISSION_COMPLETE.
              </p>
            </div>
          )}
        </section>
          </div>
          )}

          {viewTab === "compliance" && (
          <div className="mx-auto max-w-5xl px-8 py-8 space-y-6">
        {/* Pillars */}
        <section>
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Pillars</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PILLARS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5 hover:border-foreground/30 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                </div>
                <p className="text-xs font-extralight text-muted-foreground/80 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section>
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Capabilities</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                </div>
                <p className="text-[11px] font-extralight text-muted-foreground/80 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Classification system */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileLock2 className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Classification System</p>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/20 text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">
                  <th className="text-left px-4 py-2.5 w-44">Tier</th>
                  <th className="text-left px-4 py-2.5">Definition</th>
                </tr>
              </thead>
              <tbody>
                {CLASSIFICATIONS.map((c) => (
                  <tr key={c.tier} className="border-b border-border/10 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-foreground/90">{c.tier}</td>
                    <td className="px-4 py-2.5 font-extralight text-muted-foreground/85">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] font-extralight text-muted-foreground/60 leading-relaxed">
            Compartments enforced at the workflow level (NOFORN, FVEY, NATO, ORCON). Cross-domain solutions
            and declassification workflows auto-generated per OADR rules.
          </p>
        </section>

        {/* Intelligence disciplines */}
        <section>
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Intelligence Disciplines</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INTEL_DISCIPLINES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                </div>
                <p className="text-[11px] font-extralight text-muted-foreground/80 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Air-gap + audit */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Air-Gap Deployment</p>
            </div>
            <ul className="space-y-2 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Zero external connections — sneakernet ingress with GPG-verified media.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> ClamAV + YARA scan on every imported artefact before isolation.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Manual update channel — signed bundles, multi-officer approval.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Local-only telemetry. Zero outbound reporting.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Immutable Audit Chain</p>
            </div>
            <ul className="space-y-2 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> SHA-256 blockchain-linked events — tamper-evident from genesis.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> HSM-signed records, append-only DB + WORM cold storage.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Captures who/what/where/why/result + clearance + badge + facility.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Chain integrity verifier on demand for any event ID.</li>
            </ul>
          </div>
        </section>

        {/* Compliance matrix */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Compliance Matrix</p>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/20 text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">
                  <th className="text-left px-4 py-2.5 w-32">Standard</th>
                  <th className="text-left px-4 py-2.5 w-64">Requirement</th>
                  <th className="text-left px-4 py-2.5">Implementation</th>
                </tr>
              </thead>
              <tbody>
                {COMPLIANCE.map((c) => (
                  <tr key={c.std} className="border-b border-border/10 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-foreground/90">{c.std}</td>
                    <td className="px-4 py-2.5 font-extralight text-muted-foreground/85">{c.req}</td>
                    <td className="px-4 py-2.5 font-extralight text-muted-foreground/75">{c.impl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Emergency protocols */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Emergency Protocols</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EMERGENCY.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-xl border border-red-500/20 bg-card/30 backdrop-blur-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-red-400/80" strokeWidth={1.5} />
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                </div>
                <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Multi-tenant + RTOC */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Multi-Tenant Isolation</p>
            </div>
            <ul className="space-y-2 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Dedicated DB schema + unique HSM-held encryption key per agency.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Dedicated compute nodes auto-provisioned at SECRET and above.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Network isolation, geo-pinned data residency, separate backup vaults.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Realtime Operations Center</p>
            </div>
            <ul className="space-y-2 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Live workflow board scoped by clearance — SECRET / TS channels.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Threat board, asset tracking, secure-comms activity in one pane.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> WebSocket push at 5-second cadence, classified subscription model.</li>
            </ul>
          </div>
        </section>

        {/* Government integrations + biometric */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Government Systems</p>
            </div>
            <div className="space-y-1.5">
              {GOV_INTEGRATIONS.map((g) => (
                <div key={g.name} className="flex items-center justify-between text-[11px] font-extralight border-b border-border/10 last:border-0 pb-1.5 last:pb-0">
                  <span className="font-mono text-foreground/90">{g.name}</span>
                  <span className="text-muted-foreground/70">{g.tier}</span>
                  <span className="text-muted-foreground/60">{g.kind}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Fingerprint className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Biometric & Two-Person Auth</p>
            </div>
            <ul className="space-y-2 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> CAC / PIV smart-card authentication with revocation-list checks.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Fingerprint + iris verification with full audit trail.</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-foreground/50 flex-shrink-0" strokeWidth={1.5} /> Two-person integrity: dual auth + geolocation proximity for critical ops.</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/15 pt-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">House of Asher · Zahten Engine · Standby</p>
          <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">Apache 2.0 · Self-Hostable · Air-Gappable</p>
        </footer>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AsherZahtenModule;
