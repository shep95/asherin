import { useState } from "react";
import {
  Workflow, Activity, Clock, Layers, Radio, Shield, Database, Cpu,
  GitBranch, Terminal, ExternalLink, Copy, Check, ChevronRight, Zap, Lock, AlertCircle,
} from "lucide-react";

/**
 * ZAHTEN — House of Asher
 *
 * Operator console for the hardened Trigger.dev OSS fork that lives at:
 *   https://github.com/ZorakCorp/project---zahten-
 *
 * This module is the Aureon-themed dashboard surface for the Zahten engine:
 * durable workflows, queues, realtime runs, and observability — with the
 * defense-in-depth posture (X-Request-Id correlation, structured audit signals,
 * baseline HTTP hardening) the upstream fork ships by default.
 *
 * Theme rules (must match Asher Dashboard):
 *   - Monochrome glassmorphic surfaces (bg-card/30, backdrop-blur-xl, border/20)
 *   - Extralight typography, tracking-[0.2em]+ uppercase labels
 *   - Red ping-dot accent, no colored emojis
 *   - Tables for data, surgical copy
 */

const REPO_URL = "https://github.com/ZorakCorp/project---zahten-";

const PILLARS = [
  { icon: Clock,    label: "Durability",     desc: "Long-running tasks, retries, idempotency, checkpointing — agents and pipelines that cannot vanish mid-flight." },
  { icon: Activity, label: "Observability",  desc: "Traces, logs, run metadata surfaced like you actually operate the thing." },
  { icon: Shield,   label: "Operator Posture", desc: "Baseline HTTP hardening, X-Request-Id correlation, optional TRUST_PROXY, structured audit hooks." },
  { icon: Lock,     label: "Self-Sovereign", desc: "Self-host, extend the webapp & workers, keep your stack on your metal. Apache 2.0." },
];

const CAPABILITIES = [
  { icon: Workflow,  label: "Workflows",  detail: "Compose LLM steps, tools, and human-in-the-loop pauses." },
  { icon: Layers,    label: "Queues",     detail: "Concurrency rules that match how your org runs work." },
  { icon: Radio,     label: "Realtime",   detail: "Subscribe to runs, stream outputs — no polling." },
  { icon: GitBranch, label: "Schedules",  detail: "Durable cron that survives deploys and reality." },
  { icon: Cpu,       label: "Extensions", detail: "Browsers, FFmpeg, Python sidecars — the boring stuff." },
  { icon: Database,  label: "Audit",      detail: "Structured security audit signals on every request." },
];

const TASK_SAMPLE = `import { task } from "@trigger.dev/sdk";

export const intelSweep = task({
  id: "intel-sweep",
  run: async (payload: { target: string }) => {
    // Durable. Retried. Traced. Survives deploys.
    return await runIntelligenceSweep(payload.target);
  },
});`;

const HARDENING_NOTES = [
  { k: "X-Request-Id", v: "Auto-generated and propagated through every internal hop for forensic correlation." },
  { k: "TRUST_PROXY",  v: "Opt-in flag for deployments behind a TLS terminator (nginx, Cloudflare, ALB)." },
  { k: "Audit Signals",v: "Structured emit on auth, run mutation, queue admin — pipe to your SIEM." },
  { k: "Baseline Headers", v: "HSTS, frame-ancestors, no-sniff, referrer-policy enforced by default." },
];

const ROADMAP = [
  { phase: "Phase 0", status: "live",     label: "Engine forked + hardened",    note: "Apache 2.0, parity with upstream SDK." },
  { phase: "Phase 1", status: "live",     label: "Operator audit hooks",        note: "Structured signals on auth + run mutation." },
  { phase: "Phase 2", status: "wiring",   label: "Aureon control plane bridge", note: "Trigger Zahten runs from Asher modules." },
  { phase: "Phase 3", status: "planned",  label: "Realtime run inspector",      note: "Stream traces into this tab." },
  { phase: "Phase 4", status: "planned",  label: "Schedule library",            note: "Mission-grade cron presets for OSINT loops." },
];

const AsherZahtenModule = () => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(TASK_SAMPLE); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-8 py-10 space-y-10">

        {/* Header */}
        <header className="border-b border-border/15 pb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">House of Asher · Engine</p>
          </div>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-4xl font-extralight tracking-[0.25em] text-foreground">ZAHTEN</h1>
              <p className="mt-2 text-sm font-extralight text-muted-foreground/80 max-w-2xl">
                Hardened, operator-focused fork of Trigger.dev OSS. Durable TypeScript workflows, queues, realtime runs,
                and observability — with defense-in-depth defaults baked in.
              </p>
            </div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-lg border border-border/30 bg-card/40 backdrop-blur-md px-4 py-2 text-[10px] font-light tracking-[0.25em] text-foreground/80 hover:border-foreground/40 hover:text-foreground transition-colors uppercase"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
              View Repository
            </a>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Trigger.dev OSS", "Apache 2.0", "Self-Hostable", "Defense-in-Depth", "Realtime"].map((t) => (
              <span key={t} className="rounded-full border border-border/25 bg-card/30 backdrop-blur-md px-3 py-1 text-[9px] font-light tracking-[0.25em] text-muted-foreground/80 uppercase">
                {t}
              </span>
            ))}
          </div>
        </header>

        {/* BYOK notice */}
        <section className="rounded-xl border border-border/25 bg-card/40 backdrop-blur-xl p-5">
          <div className="flex items-start gap-3">
            <Lock className="h-3.5 w-3.5 text-foreground/70 mt-0.5" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase mb-1.5">
                Bring Your Own LLM Key
              </p>
              <p className="text-xs font-extralight text-muted-foreground/85 leading-relaxed">
                Set your LLM API key once in <span className="text-foreground/90">Settings → Bring Your Own
                LLM Key</span>. The same key powers every tab — no per-tab configuration.
              </p>
            </div>
          </div>
        </section>

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
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Platform Snapshot</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="group rounded-xl border border-border/20 bg-card/20 backdrop-blur-xl p-4 hover:bg-card/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-border/25 bg-background/40 p-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/80" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">{label}</p>
                    <p className="mt-1 text-[11px] font-extralight text-muted-foreground/75 leading-relaxed">{detail}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Code Sample */}
        <section>
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Tasks Live In Your Repo</p>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/15 bg-background/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="h-3 w-3 text-muted-foreground/70" strokeWidth={1.5} />
                <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">tasks/intel-sweep.ts</span>
              </div>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/25 bg-background/40 px-2.5 py-1 text-[9px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors uppercase"
              >
                {copied ? <Check className="h-3 w-3" strokeWidth={1.5} /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-5 text-[12px] font-light leading-relaxed text-foreground/90 overflow-x-auto">
              <code>{TASK_SAMPLE}</code>
            </pre>
          </div>
        </section>

        {/* Hardening table */}
        <section>
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Defense-In-Depth Defaults</p>
          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/15 bg-background/30">
                  <th className="px-5 py-3 text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase w-56">Control</th>
                  <th className="px-5 py-3 text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {HARDENING_NOTES.map((row, i) => (
                  <tr key={row.k} className={i < HARDENING_NOTES.length - 1 ? "border-b border-border/10" : ""}>
                    <td className="px-5 py-3 text-[11px] font-light tracking-[0.15em] text-foreground uppercase">{row.k}</td>
                    <td className="px-5 py-3 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{row.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Roadmap */}
        <section>
          <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Integration Roadmap</p>
          <div className="space-y-2">
            {ROADMAP.map((r) => {
              const dot =
                r.status === "live"   ? "bg-emerald-400/80" :
                r.status === "wiring" ? "bg-amber-400/80"   :
                                        "bg-muted-foreground/40";
              return (
                <div key={r.phase} className="flex items-start gap-4 rounded-lg border border-border/15 bg-card/20 backdrop-blur-md px-4 py-3 hover:bg-card/40 transition-colors">
                  <div className="flex items-center gap-2 w-28 flex-shrink-0">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">{r.phase}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-light tracking-wide text-foreground">{r.label}</p>
                    <p className="text-[10px] font-extralight text-muted-foreground/70 mt-0.5">{r.note}</p>
                  </div>
                  <span className="text-[8px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">{r.status}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer status */}
        <section className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">Engine Status — Standby</p>
              <p className="mt-1 text-[11px] font-extralight text-muted-foreground/75">
                Zahten is provisioned at the repository layer. Connect a deployment endpoint in Settings to stream live runs into this console.
              </p>
            </div>
            <Zap className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        </section>

        <p className="text-center text-[9px] font-light tracking-[0.3em] text-muted-foreground/40 uppercase pt-2">
          House of Asher · #HouseOfAsher · Apache 2.0
        </p>
      </div>
    </div>
  );
};

export default AsherZahtenModule;
