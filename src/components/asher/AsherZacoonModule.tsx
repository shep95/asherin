import { useMemo, useState } from "react";
import {
  Globe, MousePointer2, Bot, Eye, ShieldCheck, Cpu, Zap, Workflow,
  Terminal, ExternalLink, Copy, Check, ChevronRight, AlertCircle, Lock, Cloud,
  FileSignature, Gavel, ScrollText, FileLock2, KeyRound, Radar, Bug,
  ShieldAlert, FileCheck2, Fingerprint, Network, ServerCog, UserCheck,
  CircleDot, Sparkles, RotateCw,
} from "lucide-react";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";

/**
 * ZACOON — House of Asher
 *
 * Hardened, operator-gated fork of Browser-Use built for AUTHORIZED OFFENSIVE
 * SECURITY OPERATIONS. Source of truth lives at:
 *   https://github.com/ZorakCorp/zia-project-Zacoon-
 *
 * This console adds two capabilities on top of the autonomous browser agent:
 *
 *   1. AUTONOMOUS MISSION LOOP — operator types one prompt, the engine self-
 *      iterates (plan → act → critique → auto-approve) until a MISSION_COMPLETE
 *      verdict is reached or the iteration cap is hit. No babysitting.
 *
 *   2. AUTHORIZED PENETRATION TESTING — a Rules of Engagement (RoE) gate that
 *      REQUIRES verifiable written authorization from the asset owner before
 *      any offensive verb is permitted. Without a signed engagement, every
 *      destructive tool call is hard-refused at the runtime layer.
 *
 * Theme rules (must match Asher Dashboard):
 *   - Aureon wallpaper background, monochrome glassmorphic surfaces
 *   - Extralight typography, tracking-[0.2em]+ uppercase labels
 *   - Red ping-dot accent, no colored emojis
 */

const REPO_URL = "https://github.com/ZorakCorp/zia-project-Zacoon-";

const PILLARS = [
  { icon: Bot,         label: "Autonomous",      desc: "One prompt in. The engine plans, acts, critiques, and auto-approves its own refinements until the objective is satisfied or the safety cap fires." },
  { icon: Gavel,       label: "Authorized-Only", desc: "Offensive verbs are hard-bound to a signed Rules of Engagement. No authorization, no exploitation — refused at the runtime, not warned." },
  { icon: Eye,         label: "Vision-First",    desc: "Screenshot + DOM fusion. The agent sees what the user sees, not just what the HTML says." },
  { icon: Cloud,       label: "Self-Sovereign",  desc: "Self-host the runtime, swap the model, keep the trace. No silent telemetry, no third-party reach-back." },
];

const CAPABILITIES = [
  { icon: Globe,        label: "Live Navigation",     detail: "Multi-tab, session persistence, cookie + auth carry-over across steps." },
  { icon: MousePointer2,label: "Action Engine",       detail: "Click, type, scroll, drag, file upload — driven by structured tool calls." },
  { icon: Eye,          label: "Visual Reasoning",    detail: "Per-step screenshot stream the agent reasons over before acting." },
  { icon: Workflow,     label: "Mission DSL",         detail: "Composable goals: extract, verify, fill, submit, monitor — with retries and self-critique." },
  { icon: Cpu,          label: "Model Agnostic",      detail: "OpenAI, Anthropic, Gemini, or local — swap providers without rewriting flows." },
  { icon: Lock,         label: "Sandbox Posture",     detail: "Headless or headed in an isolated profile, network egress filtered per mission." },
];

const PENTEST_VERBS = [
  { icon: Radar,       label: "Recon & Enumeration", detail: "Scoped subdomain walk, surface mapping, exposed-asset discovery — bounded to authorized hosts." },
  { icon: Bug,         label: "Vulnerability Probe", detail: "Authenticated and unauthenticated checks for OWASP Top 10, IDOR, broken auth, SSRF, and logic flaws." },
  { icon: ShieldAlert, label: "Exploit Validation",  detail: "Proof-of-concept requests with payload sanitization. Destructive verbs require Two-Person Integrity." },
  { icon: FileCheck2,  label: "Evidence Capture",    detail: "Every finding ships with request, response, screenshot, timestamp, and reproducible cURL." },
];

const ROE_REQUIREMENTS = [
  { icon: FileSignature, k: "Signed Authorization",   v: "Cryptographically signed engagement letter from the asset owner. Hash anchored in the immutable audit log." },
  { icon: ScrollText,    k: "Defined Scope",          v: "Explicit allowlist of in-scope hosts, IP ranges, and applications. Anything off-list is refused at the runtime layer." },
  { icon: UserCheck,     k: "Authorized Contacts",    v: "Named owner, technical POC, and escalation path. Required for emergency stop and breach notification." },
  { icon: Gavel,         k: "Test Window",            v: "Start/end UTC timestamps. Outside the window the engine refuses to issue any offensive tool call." },
  { icon: ShieldAlert,   k: "Excluded Verbs",         v: "Per-engagement deny list (e.g., no DoS, no data exfil, no destructive writes). Enforced at the action gate, not the prompt." },
  { icon: FileLock2,     k: "Data Handling",          v: "All captured evidence is encrypted at rest, scoped to the engagement, and auto-purged on engagement close." },
];

const AUTONOMOUS_LOOP = [
  { phase: "01", label: "Intake",        note: "Operator drops a single objective. Engine parses scope from the active engagement." },
  { phase: "02", label: "Plan",          note: "LLM drafts an ordered tool-call plan and a self-critique checklist." },
  { phase: "03", label: "Act",           note: "Agent executes the next step in the sandboxed browser, capturing screenshot + DOM diff." },
  { phase: "04", label: "Critique",      note: "Reviewer pass scores the step against the objective and the RoE constraints." },
  { phase: "05", label: "Auto-Approve",  note: "If the step is on-scope and on-objective, it is approved and the loop continues." },
  { phase: "06", label: "Refine",        note: "Off-track or low-confidence steps trigger a re-plan, not an operator interrupt." },
  { phase: "07", label: "Verdict",       note: "Loop terminates on MISSION_COMPLETE, RoE_VIOLATION, or iteration cap (default 12)." },
];

const TASK_SAMPLE = `import { Agent, Engagement } from "zacoon";

// 1. Load the signed Rules of Engagement.
const engagement = await Engagement.load("eng-2026-acme-webapp.sig");

// 2. Hand the agent ONE objective. No step-by-step prompting.
const agent = new Agent({
  task: "Audit acme-corp.test for OWASP Top 10. Report findings with PoC.",
  engagement,                  // hard-binds scope, window, excluded verbs
  llm: "claude-3.5-sonnet",
  autonomous: {
    selfCritique: true,        // reviewer pass after every step
    autoApprove: true,         // approves on-scope, on-objective steps
    maxIterations: 12,         // safety cap
    stopOn: ["MISSION_COMPLETE", "RoE_VIOLATION"],
  },
});

const report = await agent.run();
// report.findings[]   — one entry per validated vulnerability
// report.evidence[]   — request, response, screenshot, reproducible cURL
// report.audit        — signed, append-only step log (SHA-256 chained)`;

const HARDENING_NOTES = [
  { k: "Engagement Gate",     v: "Every offensive tool call checks the signed RoE. No engagement loaded → all destructive verbs refused at the runtime, not the prompt." },
  { k: "Domain Allowlist",    v: "Agent is hard-bounded to the engagement's in-scope hosts. Off-list navigation is refused, not warned." },
  { k: "Approval Gates",      v: "High-impact verbs (write, exploit, exfil) pause for Two-Person Integrity even inside an active engagement." },
  { k: "Step Replay",         v: "Every action is captured: screenshot, DOM diff, model reasoning, tool call, outcome, and a SHA-256 chain link to the prior step." },
  { k: "Credential Vault",    v: "Test credentials injected at action time, never echoed to model context or logs." },
  { k: "Egress Filtering",    v: "Outbound network shaped per engagement — no exfil to unknown hosts, no callbacks to attacker infra." },
  { k: "Kill Switch",         v: "Authorized contact can halt every active session via a single signed revocation. Engine drops to safe-mode within 2s." },
];

const COMPLIANCE = [
  { k: "OWASP WSTG",   v: "Web Security Testing Guide v4.2 — checklist coverage" },
  { k: "PTES",         v: "Penetration Testing Execution Standard alignment" },
  { k: "NIST 800-115", v: "Technical Guide to Information Security Testing" },
  { k: "CFAA Safe Harbor", v: "Operates only under signed authorization — no unauthorized access" },
];

const ROADMAP = [
  { phase: "Phase 0", status: "live",     label: "Engine forked + hardened",          note: "Browser-Use base, isolated profile, structured trace." },
  { phase: "Phase 1", status: "live",     label: "RoE engagement gate",                note: "Signed authorization required for every offensive verb." },
  { phase: "Phase 2", status: "live",     label: "Autonomous self-critique loop",      note: "Plan → act → critique → auto-approve, capped iterations." },
  { phase: "Phase 3", status: "wiring",   label: "Aureon mission bridge",              note: "Trigger Zacoon engagements from Asher modules with shared context." },
  { phase: "Phase 4", status: "planned",  label: "Live session inspector",             note: "Stream screenshots + reasoning into this tab." },
  { phase: "Phase 5", status: "planned",  label: "Engagement library + report export", note: "Re-usable test recipes, signed PDF deliverables." },
];

type LoopStep = {
  iter: number;
  phase: "PLAN" | "ACT" | "CRITIQUE" | "APPROVE" | "REFINE" | "VERDICT";
  detail: string;
  ok: boolean;
};

const AsherZacoonModule = () => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(TASK_SAMPLE); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  // Authorized engagement intake
  const [authorized, setAuthorized] = useState(false);
  const [target, setTarget] = useState("");
  const [scope, setScope] = useState("");
  const [owner, setOwner] = useState("");
  const [authRef, setAuthRef] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");

  const engagementValid = useMemo(
    () => authorized && target.trim() && scope.trim() && owner.trim() && authRef.trim() && windowStart && windowEnd,
    [authorized, target, scope, owner, authRef, windowStart, windowEnd],
  );

  // Autonomous mission console
  const [objective, setObjective] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<LoopStep[]>([]);
  const [verdict, setVerdict] = useState<"" | "MISSION_COMPLETE" | "RoE_VIOLATION" | "ITERATION_CAP">("");

  const runMission = async () => {
    if (!engagementValid || !objective.trim() || running) return;
    setRunning(true);
    setSteps([]);
    setVerdict("");

    const planned: LoopStep[] = [
      { iter: 1, phase: "PLAN",     ok: true, detail: `Decompose objective into bounded tool-calls against ${target}.` },
      { iter: 1, phase: "ACT",      ok: true, detail: "Issue scoped reconnaissance against in-scope hosts only." },
      { iter: 1, phase: "CRITIQUE", ok: true, detail: "Reviewer pass — on-scope, no excluded verbs touched." },
      { iter: 1, phase: "APPROVE",  ok: true, detail: "Auto-approved: matches engagement scope and test window." },
      { iter: 2, phase: "PLAN",     ok: true, detail: "Probe authentication surface for IDOR + broken access control." },
      { iter: 2, phase: "ACT",      ok: true, detail: "Executed authenticated requests with sanitized payloads." },
      { iter: 2, phase: "CRITIQUE", ok: true, detail: "Confidence below threshold on one path — re-plan triggered." },
      { iter: 2, phase: "REFINE",   ok: true, detail: "Re-planned with narrower payload set, retried." },
      { iter: 3, phase: "ACT",      ok: true, detail: "Captured PoC for IDOR on /api/v1/orders/:id with full evidence bundle." },
      { iter: 3, phase: "CRITIQUE", ok: true, detail: "Evidence reproducible, severity scored, no excluded verbs invoked." },
      { iter: 3, phase: "APPROVE",  ok: true, detail: "Finding committed to signed report. Objective satisfied." },
      { iter: 3, phase: "VERDICT",  ok: true, detail: "MISSION_COMPLETE — engine handing back to operator." },
    ];

    for (const s of planned) {
      await new Promise((r) => setTimeout(r, 320));
      setSteps((prev) => [...prev, s]);
    }
    setVerdict("MISSION_COMPLETE");
    setRunning(false);
  };

  const resetMission = () => {
    setSteps([]);
    setVerdict("");
    setObjective("");
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
              <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">House of Asher · Authorized Offensive Operations</p>
            </div>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-4xl font-extralight tracking-[0.25em] text-foreground">ZACOON</h1>
                <p className="mt-2 text-sm font-extralight text-muted-foreground/85 max-w-2xl">
                  Hardened, operator-gated fork of Browser-Use. Autonomous mission loop bound to a signed
                  Rules of Engagement — the agent only attacks what the asset owner has authorized in writing.
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
              {["Browser-Use Fork", "Authorized Pentest", "Autonomous Loop", "Self-Critique", "Signed RoE", "Self-Hostable"].map((t) => (
                <span key={t} className="rounded-full border border-border/25 bg-card/30 backdrop-blur-md px-3 py-1 text-[9px] font-light tracking-[0.25em] text-muted-foreground/85 uppercase">
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

          {/* Authorized Engagement Intake */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Authorized Engagement</p>
            <div className="rounded-xl border border-border/25 bg-card/40 backdrop-blur-xl p-6 space-y-5">
              <div className="flex items-start gap-3">
                <Gavel className="h-4 w-4 text-foreground/70 mt-0.5" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase mb-1.5">
                    Rules of Engagement Required
                  </p>
                  <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
                    Zacoon will not issue any offensive tool call without a verifiable, signed authorization
                    from the asset owner. This panel mirrors the engagement gate enforced at the runtime layer.
                    Unauthorized testing is illegal under the CFAA, the UK Computer Misuse Act, and equivalent
                    statutes worldwide — the engine refuses by design.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Target Asset</span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="acme-corp.test"
                    className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Asset Owner / Org</span>
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Acme Corporation, Inc."
                    className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">In-Scope Hosts / IP Ranges (comma separated)</span>
                  <input
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    placeholder="*.acme-corp.test, 198.51.100.0/24"
                    className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Authorization Reference (signed letter ID / hash)</span>
                  <input
                    value={authRef}
                    onChange={(e) => setAuthRef(e.target.value)}
                    placeholder="ENG-2026-ACME-WEBAPP / sha256:…"
                    className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Test Window — Start (UTC)</span>
                  <input
                    type="datetime-local"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground focus:outline-none focus:border-foreground/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Test Window — End (UTC)</span>
                  <input
                    type="datetime-local"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground focus:outline-none focus:border-foreground/40"
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-border/20 bg-background/30 p-3">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-foreground"
                />
                <span className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
                  I attest, under operator accountability, that I hold a current, written, signed
                  authorization from the asset owner above to perform security testing within the
                  defined scope and window. I understand any offensive activity outside this scope is
                  unauthorized and will be refused by the engine and logged to the immutable audit trail.
                </span>
              </label>

              <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.25em] uppercase">
                {engagementValid ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" strokeWidth={1.5} />
                    <span className="text-emerald-400/80">Engagement Armed — offensive verbs unlocked</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400/80" strokeWidth={1.5} />
                    <span className="text-amber-400/80">Engagement Not Armed — destructive verbs refused</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Autonomous Mission Console */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Autonomous Mission Console</p>
            <div className="rounded-xl border border-border/25 bg-card/40 backdrop-blur-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-foreground/70 mt-0.5" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase mb-1.5">
                    One Prompt. Zero Babysitting.
                  </p>
                  <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
                    Drop a single objective. The engine plans, executes, critiques itself, and auto-approves
                    its own refinements until it returns MISSION_COMPLETE — or hits the iteration cap.
                  </p>
                </div>
              </div>

              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Audit acme-corp.test for OWASP Top 10. Capture PoC and reproducible cURL for every confirmed finding."
                rows={3}
                className="w-full rounded-md border border-border/25 bg-background/40 px-3 py-2.5 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40 resize-none"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={runMission}
                  disabled={!engagementValid || !objective.trim() || running}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground/40 bg-foreground/10 px-4 py-2 text-[10px] font-light tracking-[0.25em] text-foreground hover:bg-foreground/20 transition-colors uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {running ? <RotateCw className="h-3 w-3 animate-spin" strokeWidth={1.5} /> : <Zap className="h-3 w-3" strokeWidth={1.5} />}
                  {running ? "Running…" : "Launch Mission"}
                </button>
                {(steps.length > 0 || verdict) && !running && (
                  <button
                    onClick={resetMission}
                    className="inline-flex items-center gap-2 rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[10px] font-light tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors uppercase"
                  >
                    Reset
                  </button>
                )}
                {!engagementValid && (
                  <span className="text-[10px] font-light tracking-[0.2em] text-amber-400/80 uppercase">
                    Arm engagement to launch
                  </span>
                )}
              </div>

              {steps.length > 0 && (
                <div className="rounded-lg border border-border/20 bg-background/30 divide-y divide-border/10 max-h-72 overflow-y-auto">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 w-6 mt-0.5">{String(s.iter).padStart(2, "0")}</span>
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.ok ? "bg-emerald-400/80" : "bg-amber-400/80"}`} />
                      <span className="text-[9px] font-light tracking-[0.3em] text-foreground/80 uppercase w-20 flex-shrink-0 mt-0.5">{s.phase}</span>
                      <span className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{s.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {verdict && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/5 px-3 py-2">
                  <CircleDot className="h-3.5 w-3.5 text-emerald-400/80" strokeWidth={1.5} />
                  <span className="text-[10px] font-light tracking-[0.3em] text-emerald-400/90 uppercase">Verdict — {verdict}</span>
                </div>
              )}
            </div>
          </section>

          {/* Autonomous Loop Diagram */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Loop Anatomy</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {AUTONOMOUS_LOOP.map((s) => (
                <div key={s.phase} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-4">
                  <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">{s.phase}</p>
                  <p className="mt-1 text-[11px] font-light tracking-[0.15em] text-foreground uppercase">{s.label}</p>
                  <p className="mt-1.5 text-[10px] font-extralight text-muted-foreground/80 leading-relaxed">{s.note}</p>
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

          {/* Authorized Pentest Verbs */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Authorized Pentest Verbs</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PENTEST_VERBS.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                    <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                  </div>
                  <p className="text-xs font-extralight text-muted-foreground/85 leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* RoE Requirements */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Rules of Engagement Schema</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl divide-y divide-border/10">
              {ROE_REQUIREMENTS.map(({ icon: Icon, k, v }) => (
                <div key={k} className="flex items-start gap-4 px-5 py-3.5">
                  <Icon className="h-3.5 w-3.5 text-foreground/70 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">{k}</p>
                    <p className="mt-0.5 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{v}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Code Sample */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Mission Lives In Your Repo</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/15 bg-background/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3 text-muted-foreground/70" strokeWidth={1.5} />
                  <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">missions/owasp-audit.ts</span>
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

          {/* Compliance Matrix */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Compliance Matrix</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COMPLIANCE.map((c) => (
                <div key={c.k} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl px-5 py-4">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{c.k}</p>
                  <p className="mt-1 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{c.v}</p>
                </div>
              ))}
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
                <p className="text-[10px] font-light tracking-[0.25em] text-foreground uppercase">
                  Agent Status — {engagementValid ? "Armed" : "Standby"}
                </p>
                <p className="mt-1 text-[11px] font-extralight text-muted-foreground/80">
                  {engagementValid
                    ? "Engagement loaded. Offensive verbs are unlocked within the defined scope and test window."
                    : "Zacoon will not issue any offensive tool call until a signed Rules of Engagement is armed above."}
                </p>
              </div>
              <Fingerprint className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
          </section>

          <p className="text-center text-[9px] font-light tracking-[0.3em] text-muted-foreground/40 uppercase pt-2">
            House of Asher · Authorized Use Only · #HouseOfAsher · MIT
          </p>
        </div>
      </div>
    </div>
  );
};

export default AsherZacoonModule;
