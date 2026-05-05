import { useState } from "react";
import {
  Globe, MousePointer2, Bot, Eye, ShieldCheck, Cpu, Zap, Workflow,
  Terminal, ExternalLink, Copy, Check, ChevronRight, AlertCircle, Lock, Cloud,
} from "lucide-react";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";

/**
 * ZACOON — House of Asher
 *
 * Operator console for the hardened Browser-Use fork that lives at:
 *   https://github.com/ZorakCorp/zia-project-Zacoon-
 *
 * Zacoon is an autonomous browser agent: an LLM that drives a real browser —
 * navigates, clicks, types, extracts — under operator supervision. This tab is
 * the Aureon-themed surface for missions, sessions, and the safety posture
 * around them.
 *
 * Theme rules (must match Asher Dashboard):
 *   - Aureon wallpaper background, monochrome glassmorphic surfaces
 *   - Extralight typography, tracking-[0.2em]+ uppercase labels
 *   - Red ping-dot accent, no colored emojis
 */

const REPO_URL = "https://github.com/ZorakCorp/zia-project-Zacoon-";

const PILLARS = [
  { icon: Bot,         label: "Autonomous",   desc: "An LLM that drives a real browser — plans, navigates, clicks, types, scrolls, and extracts under mission constraints." },
  { icon: Eye,         label: "Vision-First", desc: "Screenshots + DOM fusion. The agent sees what the user sees, not just what the HTML says." },
  { icon: ShieldCheck, label: "Operator-Gated", desc: "Approval gates on destructive actions, domain allowlists, and full step-by-step replay." },
  { icon: Cloud,       label: "Self-Sovereign", desc: "Self-host the runtime, swap the model, keep the trace. No silent telemetry." },
];

const CAPABILITIES = [
  { icon: Globe,        label: "Live Navigation", detail: "Multi-tab, session persistence, cookie + auth carry-over across steps." },
  { icon: MousePointer2,label: "Action Engine",   detail: "Click, type, scroll, drag, file upload — driven by structured tool calls." },
  { icon: Eye,          label: "Visual Reasoning",detail: "Per-step screenshot stream the agent reasons over before acting." },
  { icon: Workflow,     label: "Mission DSL",     detail: "Composable goals: extract, verify, fill, submit, monitor — with retries." },
  { icon: Cpu,          label: "Model Agnostic",  detail: "OpenAI, Anthropic, Gemini, or local — swap providers without rewriting flows." },
  { icon: Lock,         label: "Sandbox Posture", detail: "Headless or headed in an isolated profile, network egress filtered per mission." },
];

const TASK_SAMPLE = `import { Agent } from "zacoon";

const agent = new Agent({
  task: "Open the target dossier, extract the latest filing, and download the PDF.",
  llm: "gpt-5",
  allowedDomains: ["sec.gov"],
  approvalRequired: ["download", "submit"],
});

const result = await agent.run();
// result.steps[]   — every action with screenshot + reasoning
// result.artifacts — files captured under operator approval`;

const HARDENING_NOTES = [
  { k: "Domain Allowlist",    v: "Agent is hard-bounded to the domains you whitelist per mission. Off-list navigation is refused, not warned." },
  { k: "Approval Gates",      v: "Destructive verbs (submit, download, purchase, send) pause for operator confirmation by default." },
  { k: "Step Replay",         v: "Every action is captured: screenshot, DOM diff, model reasoning, tool call, outcome." },
  { k: "Credential Vault",    v: "Secrets injected at action time, never echoed to model context or logs." },
  { k: "Egress Filtering",    v: "Outbound network shaped per mission — no exfil to unknown hosts." },
];

const ROADMAP = [
  { phase: "Phase 0", status: "live",     label: "Engine forked + hardened",      note: "Browser-Use base, isolated profile, structured trace." },
  { phase: "Phase 1", status: "live",     label: "Approval gating + allowlists",  note: "Operator-in-the-loop on destructive verbs." },
  { phase: "Phase 2", status: "wiring",   label: "Aureon mission bridge",         note: "Trigger Zacoon runs from Asher modules with shared context." },
  { phase: "Phase 3", status: "planned",  label: "Live session inspector",        note: "Stream screenshots + reasoning into this tab." },
  { phase: "Phase 4", status: "planned",  label: "Mission library",               note: "Reusable OSINT + verification recipes." },
];

const AsherZacoonModule = () => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(TASK_SAMPLE); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Aureon wallpaper background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${wallpaperAureon})` }}
      />
      <div aria-hidden className="absolute inset-0 bg-background/75 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative h-full w-full overflow-y-auto text-foreground">
        <div className="mx-auto max-w-6xl px-8 py-10 space-y-10">

          {/* Header */}
          <header className="border-b border-border/15 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">House of Asher · Browser Agent</p>
            </div>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-4xl font-extralight tracking-[0.25em] text-foreground">ZACOON</h1>
                <p className="mt-2 text-sm font-extralight text-muted-foreground/85 max-w-2xl">
                  Hardened, operator-gated fork of Browser-Use. An autonomous agent that drives a real browser
                  — vision-first, allowlist-bounded, with approval gates on every destructive verb.
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
              {["Browser-Use Fork", "Vision + DOM", "Self-Hostable", "Approval-Gated", "Model Agnostic"].map((t) => (
                <span key={t} className="rounded-full border border-border/25 bg-card/30 backdrop-blur-md px-3 py-1 text-[9px] font-light tracking-[0.25em] text-muted-foreground/85 uppercase">
                  {t}
                </span>
              ))}
            </div>
          </header>

          {/* Pillars */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Pillars</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PILLARS.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-5 hover:border-foreground/30 transition-colors">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                    <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                  </div>
                  <p className="text-xs font-extralight text-muted-foreground/85 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Capabilities */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Platform Snapshot</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="group rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4 hover:bg-card/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border border-border/25 bg-background/40 p-2">
                      <Icon className="h-3.5 w-3.5 text-foreground/80" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">{label}</p>
                      <p className="mt-1 text-[11px] font-extralight text-muted-foreground/80 leading-relaxed">{detail}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Code Sample */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Missions Live In Your Repo</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/15 bg-background/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3 text-muted-foreground/70" strokeWidth={1.5} />
                  <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">missions/extract-filing.ts</span>
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
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Operator Posture</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden">
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
                  <div key={r.phase} className="flex items-start gap-4 rounded-lg border border-border/15 bg-card/30 backdrop-blur-md px-4 py-3 hover:bg-card/50 transition-colors">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                      <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">{r.phase}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-light tracking-wide text-foreground">{r.label}</p>
                      <p className="text-[10px] font-extralight text-muted-foreground/75 mt-0.5">{r.note}</p>
                    </div>
                    <span className="text-[8px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">{r.status}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer status */}
          <section className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-5">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">Agent Status — Standby</p>
                <p className="mt-1 text-[11px] font-extralight text-muted-foreground/80">
                  Zacoon is provisioned at the repository layer. Connect a runtime endpoint in Settings to stream live browser sessions into this console.
                </p>
              </div>
              <Zap className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
          </section>

          <p className="text-center text-[9px] font-light tracking-[0.3em] text-muted-foreground/40 uppercase pt-2">
            House of Asher · #HouseOfAsher · MIT
          </p>
        </div>
      </div>
    </div>
  );
};

export default AsherZacoonModule;
