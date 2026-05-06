import { useEffect, useRef, useState } from "react";
import {
  Globe2, MousePointer2, Keyboard, Camera, ListChecks, Play, Square,
  Send, Loader2, Sparkles, ShieldCheck, Bot, Cpu, Network, Terminal,
  ChevronRight, MessageSquare, X, FileSearch, Layers, Radar, AlertTriangle,
} from "lucide-react";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * ZACOON — Browser-Use Operations Console (Asher Dashboard)
 *
 * Inspired by the open-source `browser-use` agent (ZorakCorp/zia-project-Zacoon-).
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
  mode: "browser" | "recon";
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
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* noop */ }
    return STARTER_RUNS;
  });
  const [activeId, setActiveId] = useState<string>(() => STARTER_RUNS[0].id);
  const [task, setTask] = useState("");
  const [url, setUrl] = useState("https://");
  const [running, setRunning] = useState(false);
  const stopRef = useRef<{ stopped: boolean }>({ stopped: false });

  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 25))); } catch { /* noop */ }
  }, [runs]);

  const active = runs.find((r) => r.id === activeId);

  const startRun = async () => {
    if (!task.trim()) {
      toast.error("Provide a task.");
      return;
    }
    const id = `run-${Date.now()}`;
    const planned = planSteps(task.trim(), url.trim());
    const run: Run = {
      id, task: task.trim(), url: url.trim(), status: "running",
      startedAt: Date.now(), steps: [],
    };
    setRuns((p) => [run, ...p].slice(0, 25));
    setActiveId(id);
    setRunning(true);
    stopRef.current = { stopped: false };

    for (const s of planned) {
      if (stopRef.current.stopped) break;
      await new Promise((r) => setTimeout(r, 650 + Math.random() * 600));
      setRuns((p) => p.map((r) => r.id === id ? { ...r, steps: [...r.steps, { ...s, ts: Date.now() }] } : r));
    }

    setRuns((p) => p.map((r) => r.id === id ? {
      ...r,
      status: stopRef.current.stopped ? "stopped" : "ok",
      endedAt: Date.now(),
    } : r));
    setRunning(false);
  };

  const stopRun = () => {
    stopRef.current.stopped = true;
    setRunning(false);
  };

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

        {/* Task console */}
        <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5 mb-6">
          <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase mb-3">Mission Brief</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Find the latest pricing plans on browser-use.com and extract the table"
              className="min-h-[88px] resize-none rounded-lg border border-border/30 bg-background/40 px-3 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none"
            />
            <div className="flex flex-col gap-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Start URL (optional)"
                className="rounded-lg border border-border/30 bg-background/40 px-3 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none"
              />
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

      const resp = await fetch(url, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
