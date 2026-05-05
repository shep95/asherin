import { useMemo, useRef, useState } from "react";
import {
  Globe, MousePointer2, Bot, Eye, ShieldCheck, Cpu, Zap, Workflow,
  Terminal, ExternalLink, Copy, Check, ChevronRight, AlertCircle, Lock, Cloud,
  FileSignature, Gavel, ScrollText, FileLock2, Radar, Bug, ShieldAlert,
  FileCheck2, Fingerprint, RotateCw, CircleDot, Sparkles, UserCheck,
  Ghost, Network, EyeOff, Database, Users, Building2, Wallet, Map,
  Layers, KeyRound, Hash, Stamp, Link2, Activity, Skull, Compass,
  GitBranch, Binary, Crosshair, Briefcase, FileBadge, Send, Brain, Play, Square,
} from "lucide-react";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import { streamChat } from "@/lib/ai";
import { buildBrainContext } from "@/lib/asherBrains";
import { toast } from "sonner";

/**
 * ZACOON — House of Asher
 *
 * Classified-ready OSINT collection & web intelligence platform. A hardened
 * Browser-Use fork that lives at:
 *   https://github.com/ZorakCorp/zia-project-Zacoon-
 *
 * This console layers government/intelligence-agency capabilities on top of
 * the autonomous browser agent:
 *
 *   • Authorized Engagement Gate — signed Rules of Engagement required
 *     before any offensive verb is permitted at the runtime layer.
 *   • Autonomous Mission Loop — single objective in, plan → act → critique
 *     → auto-approve until MISSION_COMPLETE or iteration cap.
 *   • Stealth Browsing Engine — fingerprint masking, residential proxy
 *     rotation, behavioral mimicry, captcha solving.
 *   • TOR & Dark Web Module — triple-hop circuits, bridge mode, onion
 *     market monitoring with circuit verification.
 *   • Evidence Chain of Custody — SHA-256 hashes, HSM signatures, RFC 3161
 *     trusted timestamps, encrypted at-rest storage, integrity verification.
 *   • OSINT Workflow Catalog — SOCMINT, DOMINT, FININT presets.
 *   • Multi-Target Tracking — parallel subject monitoring with relationship
 *     mapping and network evolution snapshots.
 *   • Attribution Avoidance — burner identities, country/ISP rotation,
 *     compartmentalization.
 *   • Classification System — UNCLASSIFIED → TS//SCI with handling caveats.
 *   • Immutable Audit Log — blockchain-linked, HSM-signed, WORM storage.
 *
 * Theme rules (must match Asher Dashboard):
 *   - Aureon wallpaper background, monochrome glassmorphic surfaces
 *   - Extralight typography, tracking-[0.2em]+ uppercase labels
 *   - Red ping-dot accent, no colored emojis
 */

const REPO_URL = "https://github.com/ZorakCorp/zia-project-Zacoon-";

const PILLARS = [
  { icon: Bot,         label: "Autonomous",       desc: "One prompt in. The engine plans, acts, critiques, and auto-approves its own refinements until the objective is satisfied or the safety cap fires." },
  { icon: Gavel,       label: "Authorized-Only",  desc: "Offensive verbs are hard-bound to a signed Rules of Engagement. No authorization, no exploitation — refused at the runtime, not warned." },
  { icon: Ghost,       label: "Stealth-First",    desc: "Anti-fingerprinting, residential proxy rotation, behavioral mimicry, captcha solving. Indistinguishable from a human operator." },
  { icon: ShieldCheck, label: "Court-Admissible", desc: "Every artifact is hashed, signed, RFC 3161 timestamped, and stored under an immutable chain of custody." },
];

const CAPABILITIES = [
  { icon: Globe,        label: "Live Navigation",     detail: "Multi-tab, session persistence, cookie + auth carry-over across steps." },
  { icon: MousePointer2,label: "Action Engine",       detail: "Click, type, scroll, drag, file upload — driven by structured tool calls." },
  { icon: Eye,          label: "Visual Reasoning",    detail: "Per-step screenshot stream the agent reasons over before acting." },
  { icon: Workflow,     label: "Mission DSL",         detail: "Composable goals: extract, verify, fill, submit, monitor — with retries and self-critique." },
  { icon: Cpu,          label: "Model Agnostic",      detail: "OpenAI, Anthropic, Gemini, or local — swap providers without rewriting flows." },
  { icon: Lock,         label: "Sandbox Posture",     detail: "Headless or headed in an isolated profile, network egress filtered per mission." },
];

const STEALTH_CONTROLS = [
  { icon: Fingerprint, label: "Fingerprint Masking", detail: "Canvas, WebGL, audio, font, and timezone noise. WebRTC disabled. Encrypted SNI + DoH." },
  { icon: Network,     label: "Residential Proxies", detail: "Rotates per-request from a residential pool, country-matched to the target. No datacenter IPs." },
  { icon: UserCheck,   label: "Cover Identities",    detail: "Burner personas with realistic browsing history, social footprint, and matched fingerprint. Auto-burn after window." },
  { icon: Activity,    label: "Behavioral Mimicry",  detail: "Human mouse pathing, variable typing cadence, Gaussian-jittered delays, realistic dwell time." },
  { icon: EyeOff,      label: "Detection Evasion",   detail: "Headless / WebDriver / automation flags scrubbed. Cloudflare, PerimeterX, HUMAN bypass routines." },
  { icon: KeyRound,    label: "Captcha Engine",      detail: "AI-powered solver for reCAPTCHA v2/v3, hCaptcha, FunCaptcha, image challenges." },
];

const PENTEST_VERBS = [
  { icon: Radar,       label: "Recon & Enumeration", detail: "Scoped subdomain walk, surface mapping, exposed-asset discovery — bounded to authorized hosts." },
  { icon: Bug,         label: "Vulnerability Probe", detail: "Authenticated and unauthenticated checks for OWASP Top 10, IDOR, broken auth, SSRF, and logic flaws." },
  { icon: ShieldAlert, label: "Exploit Validation",  detail: "Proof-of-concept requests with payload sanitization. Destructive verbs require Two-Person Integrity." },
  { icon: FileCheck2,  label: "Evidence Capture",    detail: "Every finding ships with request, response, screenshot, timestamp, and reproducible cURL." },
];

const OSINT_WORKFLOWS = [
  { icon: Users,     code: "SOCMINT", label: "Social Media Intel",  detail: "Twitter/X, Facebook, LinkedIn, Instagram. Network mapping, sentiment, geo-tags, cross-platform timeline." },
  { icon: Globe,     code: "DOMINT",  label: "Domain Intelligence", detail: "DNS enumeration, subdomain discovery, tech stack, cert chain, security headers, WHOIS history, Wayback." },
  { icon: Wallet,    code: "FININT",  label: "Financial Intel",     detail: "Business registrations, property records, court filings, SEC EDGAR, blockchain wallet attribution." },
  { icon: Skull,     code: "DARKINT", label: "Dark Web Monitoring", detail: "TOR-routed onion market sweeps, vendor profiling, listing capture, paste-site monitoring." },
  { icon: Building2, code: "ORGINT",  label: "Org Penetration",     detail: "Member identification, internal/external relationship mapping, org chart inference, key-player ranking." },
  { icon: Map,       code: "GEOINT",  label: "Geospatial Fusion",   detail: "Aggregate location signals across platforms, EXIF mining, pattern-of-life reconstruction." },
];

const TOR_CONTROLS = [
  { icon: GitBranch, k: "Triple-Hop Circuit",   v: "3-hop minimum, entry-node strict (Five Eyes only), exit-node randomized. Bridge mode hides TOR usage from the upstream ISP." },
  { icon: Compass,   k: "Circuit Verification", v: "Pre-flight check inspects the chosen path. Fails closed and rebuilds the circuit if any hop is flagged." },
  { icon: EyeOff,    k: "Onion Service Access", v: "Latency-tolerant navigation to .onion endpoints with full evidence capture (HTML, screenshot, circuit path, timestamp)." },
  { icon: Skull,     k: "Market Sweep",         v: "Keyword-driven monitoring across known dark markets — vendor, listing, price, ratings, shipping origin captured per item." },
];

const EVIDENCE_CHAIN = [
  { icon: Hash,         k: "Cryptographic Hash",    v: "SHA-256 of the full evidence package (screenshot, PDF render, video, HTML, DOM, HAR, cookies, metadata)." },
  { icon: FileSignature,k: "HSM Digital Signature", v: "Non-repudiable signature from a hardware security module. Operator identity bound at signing time." },
  { icon: Stamp,        k: "RFC 3161 Timestamp",    v: "Trusted timestamp authority token proves the evidence existed at a specific UTC instant." },
  { icon: FileLock2,    k: "Encrypted at Rest",     v: "AES-256-GCM, classification-scoped key. Even storage admins cannot read raw evidence." },
  { icon: Link2,        k: "Chain of Custody",      v: "Every transfer is logged with custodian identity, action, and timestamp. Court-ready exhibit packet." },
  { icon: ShieldCheck,  k: "Integrity Verify",      v: "Re-hash on read, signature + timestamp re-verified. Tamper detection alerts the audit channel within seconds." },
];

const ROE_REQUIREMENTS = [
  { icon: FileSignature, k: "Signed Authorization",  v: "Cryptographically signed engagement letter from the asset owner. Hash anchored in the immutable audit log." },
  { icon: ScrollText,    k: "Defined Scope",         v: "Explicit allowlist of in-scope hosts, IP ranges, and applications. Anything off-list is refused at the runtime layer." },
  { icon: UserCheck,     k: "Authorized Contacts",   v: "Named owner, technical POC, and escalation path. Required for emergency stop and breach notification." },
  { icon: Gavel,         k: "Test Window",           v: "Start/end UTC timestamps. Outside the window the engine refuses to issue any offensive tool call." },
  { icon: ShieldAlert,   k: "Excluded Verbs",        v: "Per-engagement deny list (e.g., no DoS, no data exfil, no destructive writes). Enforced at the action gate, not the prompt." },
  { icon: FileLock2,     k: "Data Handling",         v: "All captured evidence is encrypted at rest, scoped to the engagement, and auto-purged on engagement close." },
];

const ATTRIBUTION_AVOIDANCE = [
  { icon: Layers,    k: "Compartmentalization", v: "Each target gets its own identity, proxy chain, and exit node. No two operations share infrastructure." },
  { icon: RotateCw,  k: "Burner Lifecycle",     v: "Identities auto-rotate every 7 days. Cookies, history, and fingerprint destroyed on burn." },
  { icon: Network,   k: "Country / ISP Rotation", v: "Exit geography rotates per request; previous exits are blacklisted for the next op cycle." },
  { icon: Activity,  k: "Pattern Suppression",  v: "Random delays (1–30s), noise requests to unrelated sites, target-timezone-aware activity windows." },
];

const CLASSIFICATION_LEVELS = [
  { code: "U",       label: "UNCLASSIFIED",   tone: "muted" },
  { code: "CUI",     label: "Controlled Unclassified", tone: "muted" },
  { code: "C",       label: "CONFIDENTIAL",   tone: "muted" },
  { code: "S",       label: "SECRET",         tone: "active" },
  { code: "TS",      label: "TOP SECRET",     tone: "active" },
  { code: "TS//SCI", label: "TS // SCI",      tone: "elite" },
];

const HANDLING_CAVEATS = ["NOFORN", "ORCON", "FVEY", "REL TO USA, FVEY", "PROPIN", "RELIDO"];

const GOV_INTEGRATIONS = [
  { icon: Database,  k: "NCIC",   v: "Criminal history cross-reference (authorized operators only)." },
  { icon: Wallet,    k: "FinCEN", v: "Financial transaction enrichment for FININT workflows." },
  { icon: Briefcase, k: "TECS",   v: "Travel and border-crossing record correlation." },
  { icon: Crosshair, k: "TSDB",   v: "Terrorist screening database matching." },
  { icon: Binary,    k: "NCTC",   v: "Counter-terrorism intel community lookups." },
];

const AUTONOMOUS_LOOP = [
  { phase: "01", label: "Intake",       note: "Operator drops a single objective. Engine parses scope from the active engagement." },
  { phase: "02", label: "Plan",         note: "LLM drafts an ordered tool-call plan and a self-critique checklist." },
  { phase: "03", label: "Act",          note: "Agent executes the next step in the sandboxed browser, capturing screenshot + DOM diff." },
  { phase: "04", label: "Critique",     note: "Reviewer pass scores the step against the objective and the RoE constraints." },
  { phase: "05", label: "Auto-Approve", note: "If the step is on-scope and on-objective, it is approved and the loop continues." },
  { phase: "06", label: "Refine",       note: "Off-track or low-confidence steps trigger a re-plan, not an operator interrupt." },
  { phase: "07", label: "Verdict",      note: "Loop terminates on MISSION_COMPLETE, RoE_VIOLATION, or iteration cap (default 12)." },
];

const TASK_SAMPLE = `import { Agent, Engagement, Stealth, Evidence } from "zacoon";

// 1. Load the signed Rules of Engagement.
const engagement = await Engagement.load("eng-2026-acme-webapp.sig");

// 2. Compose the stealth + evidence posture.
const stealth = Stealth.profile({
  proxy: "residential",
  rotation: "per_request",
  fingerprint: "randomized",
  behavior: "human",
  captcha: "ai_solver",
});

const evidence = Evidence.chain({
  hash: "sha256",
  signature: "hsm",
  timestamp: "rfc3161",
  encryption: "aes-256-gcm",
});

// 3. Hand the agent ONE objective. No step-by-step prompting.
const agent = new Agent({
  task: "Audit acme-corp.test for OWASP Top 10. Report findings with PoC.",
  engagement,                  // hard-binds scope, window, excluded verbs
  classification: "SECRET",
  caveats: ["NOFORN"],
  llm: "claude-3.5-sonnet",
  stealth,
  evidence,
  autonomous: {
    selfCritique: true,        // reviewer pass after every step
    autoApprove: true,         // approves on-scope, on-objective steps
    maxIterations: 12,
    stopOn: ["MISSION_COMPLETE", "RoE_VIOLATION"],
  },
});

const report = await agent.run();
// report.findings[]   — one entry per validated vulnerability
// report.evidence[]   — chain-of-custody artifacts
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
  { k: "OWASP WSTG",       v: "Web Security Testing Guide v4.2 — checklist coverage" },
  { k: "PTES",             v: "Penetration Testing Execution Standard alignment" },
  { k: "NIST 800-115",     v: "Technical Guide to Information Security Testing" },
  { k: "NIST 800-53",      v: "Security and Privacy Controls — applicable families" },
  { k: "FIPS 140-2",       v: "Cryptographic module compliance (HSM-backed)" },
  { k: "FedRAMP High",     v: "Boundary alignment for federal deployment" },
  { k: "CFAA Safe Harbor", v: "Operates only under signed authorization" },
  { k: "RFC 3161",         v: "Trusted timestamping for evidence integrity" },
];

const ROADMAP = [
  { phase: "Phase 0", status: "live",     label: "Engine forked + hardened",          note: "Browser-Use base, isolated profile, structured trace." },
  { phase: "Phase 1", status: "live",     label: "RoE engagement gate",                note: "Signed authorization required for every offensive verb." },
  { phase: "Phase 2", status: "live",     label: "Autonomous self-critique loop",      note: "Plan → act → critique → auto-approve, capped iterations." },
  { phase: "Phase 3", status: "live",     label: "Stealth browsing engine",            note: "Fingerprint masking, residential proxies, captcha solving." },
  { phase: "Phase 4", status: "wiring",   label: "TOR + dark web module",              note: "Triple-hop circuits, market sweeps, paste-site monitoring." },
  { phase: "Phase 5", status: "wiring",   label: "Evidence chain of custody",          note: "HSM signing, RFC 3161 timestamps, WORM storage." },
  { phase: "Phase 6", status: "planned",  label: "OSINT workflow catalog",             note: "SOCMINT / DOMINT / FININT presets, multi-target tracking." },
  { phase: "Phase 7", status: "planned",  label: "ASHER + AUREON predictive bridge",   note: "Predicted source ranking, gap analysis, follow-up collection." },
];

type LoopStep = {
  iter: number;
  phase: "PLAN" | "ACT" | "CRITIQUE" | "APPROVE" | "REFINE" | "VERDICT";
  detail: string;
  ok: boolean;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

// Parse model output for structured workflow / steps / mermaid blocks
const parseWorkflow = (text: string): { steps: LoopStep[]; mermaid: string | null; verdict: string } => {
  const steps: LoopStep[] = [];
  let mermaid: string | null = null;
  let verdict = "";

  const mermMatch = text.match(/```mermaid\s+([\s\S]*?)```/i);
  if (mermMatch) mermaid = mermMatch[1].trim();

  const verdictMatch = text.match(/\b(MISSION_COMPLETE|RoE_VIOLATION|ITERATION_CAP)\b/);
  if (verdictMatch) verdict = verdictMatch[1];

  const stepRe = /\[?\s*(\d{1,2})\s*\]?[\s.:)-]*\s*(PLAN|ACT|CRITIQUE|APPROVE|REFINE|VERDICT)\b[\s—:-]*([^\n\[]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = stepRe.exec(text))) {
    const iter = parseInt(m[1], 10);
    const phase = m[2].toUpperCase() as LoopStep["phase"];
    const detail = m[3].trim().replace(/\s+/g, " ").slice(0, 280);
    if (detail) steps.push({ iter, phase, detail, ok: true });
  }
  return { steps, mermaid, verdict };
};

const AsherZacoonModule = () => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(TASK_SAMPLE); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const [target, setTarget] = useState("");
  const engagementValid = useMemo(() => target.trim().length > 0, [target]);

  const [stealthOn, setStealthOn] = useState(true);
  const [torOn, setTorOn] = useState(false);
  const [burnerOn, setBurnerOn] = useState(true);

  const [objective, setObjective] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<LoopStep[]>([]);
  const [verdict, setVerdict] = useState<string>("");
  const [mermaid, setMermaid] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const buildSystemPrompt = () => `You are ZACOON — the operator's autonomous OSINT + browser-automation co-pilot, fused with the AUREON / ASHER intelligence stack.

ACTIVE SESSION:
- Target: ${target || "(none)"}
- Stealth: ${stealthOn ? "ON" : "OFF"} | TOR: ${torOn ? "ON" : "OFF"} | Burner: ${burnerOn ? "ON" : "OFF"}
- Objective: ${objective || "(awaiting)"}

OUTPUT CONTRACT (every reply must include all three sections):
1. Intelligence-Officer narrative (bold headers, tables when useful, no filler).
2. Numbered execution workflow — one phase per line, EXACT format:
     [01 PLAN] ...
     [01 ACT] ...
     [01 CRITIQUE] ...
     [01 APPROVE] ...
     [02 PLAN] ...
     ... ending with  [NN VERDICT] MISSION_COMPLETE | RoE_VIOLATION | ITERATION_CAP
3. A mermaid diagram of the flow inside a fenced \`\`\`mermaid block (graph TD or sequenceDiagram).

Use the AUREON + ASHER brain corpus injected below as ground truth. Cite specific brain names when leveraging them. Surgical, direct, no filler.`;

  const streamWithBrains = async (msgs: ChatMsg[]) => {
    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    try {
      const brainCtx = await buildBrainContext().catch(() => null);
      const brainContext = {
        prompt: buildSystemPrompt(),
        fileContents: brainCtx
          ? brainCtx.brains.map((b) => ({ name: `${b.category}::${b.name}`, content: b.content }))
          : [],
      };

      setChat((p) => [...p, { role: "assistant", content: "" }]);

      await streamChat({
        messages: msgs as any,
        mode: "default" as any,
        depth: "standard" as any,
        brainContext,
        signal: ac.signal,
        onDelta: (d) => {
          acc += d;
          setChat((p) => {
            const cp = [...p];
            cp[cp.length - 1] = { role: "assistant", content: acc };
            return cp;
          });
          const parsed = parseWorkflow(acc);
          if (parsed.steps.length) setSteps(parsed.steps);
          if (parsed.mermaid) setMermaid(parsed.mermaid);
          if (parsed.verdict) setVerdict(parsed.verdict);
        },
        onDone: () => { /* parsed live */ },
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error(err?.message || "Session failed");
    } finally {
      setStreaming(false);
    }
  };

  const runMission = async () => {
    if (!engagementValid || !objective.trim() || running) return;
    setRunning(true);
    setSteps([]); setVerdict(""); setMermaid(null);
    const userMsg: ChatMsg = { role: "user", content: `MISSION INTAKE — Target: ${target}\nObjective: ${objective}` };
    setChat([userMsg]);
    await streamWithBrains([userMsg]);
    setRunning(false);
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || streaming) return;
    setChatInput("");
    const next: ChatMsg[] = [...chat, { role: "user", content: text }];
    setChat(next);
    await streamWithBrains(next);
  };

  const stopStream = () => abortRef.current?.abort();

  const resetMission = () => {
    setSteps([]); setVerdict(""); setObjective("");
    setChat([]); setMermaid(null);
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
              <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">House of Asher · Classified-Ready OSINT Platform</p>
            </div>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-4xl font-extralight tracking-[0.25em] text-foreground">ZACOON</h1>
                <p className="mt-2 text-sm font-extralight text-muted-foreground/85 max-w-2xl">
                  Hardened, operator-gated fork of Browser-Use. Autonomous OSINT collection with stealth
                  browsing, TOR + dark-web access, court-admissible evidence chain, and a signed Rules of
                  Engagement that hard-binds every offensive verb.
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
              {["Browser-Use Fork", "Authorized Pentest", "Stealth Engine", "TOR + Dark Web", "Chain of Custody", "Autonomous Loop", "Self-Critique", "Self-Hostable"].map((t) => (
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

          {/* Target Site */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Target Site</p>
            <div className="rounded-xl border border-border/25 bg-card/40 backdrop-blur-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Gavel className="h-4 w-4 text-foreground/70 mt-0.5" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase mb-1.5">
                    How Zacoon Works
                  </p>
                  <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">
                    Paste a website URL below. Zacoon spins up an autonomous browser session against that
                    site and carries out the objective you give it — navigating pages, filling forms,
                    extracting data, and capturing evidence. Use it for OSINT collection, content scraping,
                    workflow automation, or — when you have written permission from the site owner —
                    authorized security testing.
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Target Website / URL</span>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1.5 w-full rounded-md border border-border/25 bg-background/40 px-3 py-2 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                />
              </label>

              <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.25em] uppercase">
                {engagementValid ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" strokeWidth={1.5} />
                    <span className="text-emerald-400/80">Target Locked — ready to launch mission</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400/80" strokeWidth={1.5} />
                    <span className="text-amber-400/80">No Target — paste a URL to begin</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Stealth Posture */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Stealth Posture</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { k: "Stealth Engine", v: stealthOn, set: setStealthOn, icon: Ghost,    note: "Fingerprint masking, residential proxies, behavioral mimicry, captcha solver." },
                  { k: "TOR Routing",    v: torOn,     set: setTorOn,     icon: Network,  note: "Triple-hop circuit, bridge mode, dark-web access." },
                  { k: "Burner Identity",v: burnerOn,  set: setBurnerOn,  icon: UserCheck,note: "Disposable persona, history, social footprint. Auto-burn on close." },
                ].map(({ k, v, set, icon: Icon, note }) => (
                  <button
                    key={k}
                    onClick={() => set(!v)}
                    className={`text-left rounded-lg border p-4 transition-colors ${
                      v ? "border-foreground/40 bg-foreground/10" : "border-border/25 bg-background/40 hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                      <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{k}</p>
                      <span className={`ml-auto text-[9px] font-light tracking-[0.25em] uppercase ${v ? "text-emerald-400/80" : "text-muted-foreground/60"}`}>
                        {v ? "On" : "Off"}
                      </span>
                    </div>
                    <p className="text-[10px] font-extralight text-muted-foreground/80 leading-relaxed">{note}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {STEALTH_CONTROLS.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="rounded-lg border border-border/20 bg-background/30 p-4">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                      <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                    </div>
                    <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{detail}</p>
                  </div>
                ))}
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

          {/* OSINT Workflows */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— OSINT Workflow Catalog</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {OSINT_WORKFLOWS.map(({ icon: Icon, code, label, detail }) => (
                <div key={code} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-5 hover:border-foreground/30 transition-colors">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                    <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{label}</p>
                    <span className="ml-auto text-[8px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">{code}</span>
                  </div>
                  <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* TOR + Dark Web */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— TOR &amp; Dark Web Module</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl divide-y divide-border/10">
              {TOR_CONTROLS.map(({ icon: Icon, k, v }) => (
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

          {/* Evidence Chain of Custody */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Evidence Chain of Custody</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EVIDENCE_CHAIN.map(({ icon: Icon, k, v }) => (
                <div key={k} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                    <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{k}</p>
                  </div>
                  <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{v}</p>
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

          {/* Attribution Avoidance */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Attribution Avoidance</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ATTRIBUTION_AVOIDANCE.map(({ icon: Icon, k, v }) => (
                <div key={k} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
                    <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{k}</p>
                  </div>
                  <p className="text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Government Integrations */}
          <section>
            <p className="mb-4 text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">— Government Database Bridges</p>
            <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-xl divide-y divide-border/10">
              {GOV_INTEGRATIONS.map(({ icon: Icon, k, v }) => (
                <div key={k} className="flex items-start gap-4 px-5 py-3">
                  <Icon className="h-3.5 w-3.5 text-foreground/70 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{k}</p>
                    <p className="mt-0.5 text-[11px] font-extralight text-muted-foreground/85 leading-relaxed">{v}</p>
                  </div>
                  <span className="text-[8px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">Authorized Operators</span>
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
                    ? `Target ${target} locked. Stealth ${stealthOn ? "on" : "off"} · TOR ${torOn ? "on" : "off"} · Burner ${burnerOn ? "on" : "off"}.`
                    : "Paste a target website URL above to arm Zacoon."}
                </p>
              </div>
              <FileBadge className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
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
