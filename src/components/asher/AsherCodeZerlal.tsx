// ZERLAL — Strategic Intelligence Audit Suite for Asher Code IDE
// 15 specialized panels powered by real Gemini analysis of the live codebase.
// All scans are LIVE — Gemini is invoked through the asher-code-ai edge function.
// No simulations. Results are streamed and persisted per-project in localStorage.

import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert, Target, Crosshair, Atom, FileWarning, Network, Lock, Eye,
  Bug, Activity, Skull, Cpu, Layers, FileSearch, BookCheck, ChevronDown,
  Loader2, RefreshCw, Download, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId: string;
  files: Array<{ path: string; content: string }>;
}

type PanelId =
  | "exploit_chain" | "nation_state" | "kill_chain" | "quantum" | "supply_chain"
  | "infra_topology" | "secrets" | "side_channel" | "dependency_cve"
  | "behavioral_anomaly" | "anti_forensics" | "memory_corruption"
  | "auth_surface" | "data_classification" | "compliance";

const PANELS: Array<{ id: PanelId; label: string; icon: any; brief: string; mode: string }> = [
  { id: "exploit_chain",       label: "Exploit Chain Map",        icon: Target,        brief: "Multi-step attack paths chaining 2+ vulnerabilities into RCE/privilege-escalation", mode: "exploit-chain" },
  { id: "nation_state",        label: "Nation-State Attribution", icon: Crosshair,     brief: "TTP fingerprinting against MITRE ATT&CK / APT clusters",                              mode: "apt-attribution" },
  { id: "kill_chain",          label: "Cyber Kill Chain",         icon: Skull,         brief: "Lockheed kill-chain mapping per discovered weakness",                                   mode: "kill-chain" },
  { id: "quantum",             label: "Quantum Audit",            icon: Atom,          brief: "Post-quantum cryptography readiness — RSA/ECC vs Kyber/Dilithium",                      mode: "quantum-audit" },
  { id: "supply_chain",        label: "Supply Chain",             icon: Network,       brief: "Transitive dependency risk, typosquatting, compromised maintainers",                    mode: "supply-chain" },
  { id: "infra_topology",      label: "Infrastructure Topology",  icon: Layers,        brief: "Service graph, trust boundaries, blast-radius modeling",                                mode: "infra-topology" },
  { id: "secrets",             label: "Secret Exposure",          icon: Lock,          brief: "Hardcoded keys, JWTs, AWS/GCP creds, .env leakage, history",                            mode: "secret-scan" },
  { id: "side_channel",        label: "Side-Channel Risk",        icon: Eye,           brief: "Timing oracles, cache attacks, error-message disclosure",                               mode: "side-channel" },
  { id: "dependency_cve",      label: "CVE Intelligence",         icon: Bug,           brief: "Known CVEs in declared deps + reachability analysis",                                   mode: "cve-intel" },
  { id: "behavioral_anomaly",  label: "Behavioral Anomaly",       icon: Activity,      brief: "Unusual code patterns indicating insider threat or backdoors",                          mode: "behavior-anomaly" },
  { id: "anti_forensics",      label: "Anti-Forensics",           icon: FileWarning,   brief: "Log tampering, evidence destruction routines, persistence mechanisms",                  mode: "anti-forensics" },
  { id: "memory_corruption",   label: "Memory Corruption",        icon: Cpu,           brief: "Buffer overflows, UAF, type confusion in WASM/native bridges",                          mode: "memory-corruption" },
  { id: "auth_surface",        label: "Auth Attack Surface",      icon: ShieldAlert,   brief: "Session, JWT, OAuth, MFA flow weakness mapping",                                        mode: "auth-surface" },
  { id: "data_classification", label: "Data Classification",      icon: FileSearch,    brief: "PII / PHI / PCI flows, residency, retention violations",                                mode: "data-classification" },
  { id: "compliance",          label: "Compliance Posture",       icon: BookCheck,     brief: "SOC2, ISO 27001, FedRAMP, HIPAA, PCI-DSS, GDPR, EU CRA, EO 14028",                       mode: "compliance" },
];

interface PanelResult {
  panelId: PanelId;
  startedAt: string;
  finishedAt?: string;
  output?: string;       // markdown
  findings?: number;     // headline count
  severity?: "critical" | "high" | "medium" | "low" | "info";
  error?: string;
}

export default function AsherCodeZerlal({ projectId, files }: Props) {
  const storageKey = `asherCode.zerlal.${projectId}`;
  const [results, setResults] = useState<Record<PanelId, PanelResult | undefined>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {} as any; }
  });
  const [busy, setBusy] = useState<PanelId | null>(null);
  const [open, setOpen] = useState<PanelId | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(results)); }, [storageKey, results]);

  const filtered = useMemo(() => {
    if (!search.trim()) return PANELS;
    const q = search.toLowerCase();
    return PANELS.filter(p => p.label.toLowerCase().includes(q) || p.brief.toLowerCase().includes(q));
  }, [search]);

  async function runScan(panel: typeof PANELS[number]) {
    if (busy) return;
    if (!files.length) { toast.error("Open a project first"); return; }
    setBusy(panel.id);
    setResults(r => ({ ...r, [panel.id]: { panelId: panel.id, startedAt: new Date().toISOString() } }));

    // Build a compact codebase digest (cap each file to keep prompt size sane)
    const digest = files
      .slice(0, 80)
      .map(f => `\n\n--- FILE: ${f.path} ---\n${(f.content || "").slice(0, 6000)}`)
      .join("");

    const messages = [{
      role: "user",
      content: `ZERLAL ${panel.label} scan.\n\nObjective: ${panel.brief}.\n\nAnalyze the codebase below LIVE. Do not invent findings. If insufficient evidence exists, say so. Output structured Markdown:\n\n# ${panel.label}\n\n**Severity**: critical|high|medium|low|info\n**Findings**: <integer>\n\n## Executive Summary\n## Detailed Findings (each with file:line, evidence, exploit narrative, remediation)\n## Recommendations (prioritized)\n\nCodebase:\n${digest}`,
    }];

    try {
      const { data, error } = await supabase.functions.invoke("asher-code-ai", {
        body: { messages, mode: panel.mode, projectId, model: "google/gemini-2.5-pro" },
      });
      if (error) throw error;
      const text = (data as any)?.content || (data as any)?.message || JSON.stringify(data);
      const sevMatch = text.match(/\*\*Severity\*\*:\s*(critical|high|medium|low|info)/i);
      const findMatch = text.match(/\*\*Findings\*\*:\s*(\d+)/i);
      setResults(r => ({
        ...r,
        [panel.id]: {
          panelId: panel.id,
          startedAt: r[panel.id]?.startedAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          output: text,
          severity: (sevMatch?.[1]?.toLowerCase() as any) || "info",
          findings: findMatch ? parseInt(findMatch[1], 10) : 0,
        },
      }));
      toast.success(`${panel.label} complete`);
      setOpen(panel.id);
    } catch (e: any) {
      setResults(r => ({
        ...r,
        [panel.id]: { panelId: panel.id, startedAt: r[panel.id]?.startedAt || new Date().toISOString(), finishedAt: new Date().toISOString(), error: e?.message || "Scan failed" },
      }));
      toast.error(`${panel.label} failed: ${e?.message || "unknown"}`);
    } finally {
      setBusy(null);
    }
  }

  function exportReport() {
    const md = PANELS.map(p => {
      const r = results[p.id];
      if (!r?.output) return `# ${p.label}\n_No scan run._\n`;
      return `${r.output}\n\n---\n`;
    }).join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zerlal-report-${Date.now()}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function sevColor(s?: string) {
    switch (s) {
      case "critical": return "text-red-400 border-red-400/40";
      case "high":     return "text-orange-400 border-orange-400/40";
      case "medium":   return "text-yellow-400 border-yellow-400/40";
      case "low":      return "text-blue-400 border-blue-400/40";
      default:         return "text-muted-foreground/60 border-border/20";
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/15">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] tracking-[0.25em] uppercase font-light">ZERLAL Intelligence</span>
          <span className="text-[9px] text-muted-foreground/50">· LIVE Gemini · {files.length} files</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter panels…"
            className="bg-card/30 border border-border/20 rounded px-2 py-1 text-[10px] w-40 focus:outline-none focus:border-foreground/40"
          />
          <button onClick={exportReport} className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/30 hover:border-foreground/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 auto-rows-min">
        {filtered.map(panel => {
          const Icon = panel.icon;
          const r = results[panel.id];
          const isOpen = open === panel.id;
          const isBusy = busy === panel.id;
          return (
            <div key={panel.id} className="rounded border border-border/15 bg-card/30 overflow-hidden">
              <div className="flex items-start gap-2 p-2.5">
                <Icon className="h-3.5 w-3.5 mt-0.5 text-foreground/70 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-light tracking-wide truncate">{panel.label}</p>
                    {r?.severity && (
                      <span className={`text-[8px] uppercase tracking-[0.2em] border rounded px-1.5 py-0.5 ${sevColor(r.severity)}`}>
                        {r.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-snug line-clamp-2">{panel.brief}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      onClick={() => runScan(panel)}
                      disabled={isBusy || !!busy}
                      className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 disabled:opacity-40 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"
                    >
                      {isBusy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                      {r?.output ? "Re-scan" : "Run"}
                    </button>
                    {r?.output && (
                      <button
                        onClick={() => setOpen(isOpen ? null : panel.id)}
                        className="inline-flex items-center gap-1 rounded border border-border/20 bg-card/40 hover:border-foreground/30 px-2 py-1 text-[9px] uppercase tracking-[0.2em]"
                      >
                        <ChevronDown className={`h-2.5 w-2.5 transition ${isOpen ? "rotate-180" : ""}`} />
                        {isOpen ? "Hide" : "View"}
                      </button>
                    )}
                    {r?.findings != null && r.findings > 0 && (
                      <span className="text-[9px] text-muted-foreground/60">· {r.findings} findings</span>
                    )}
                    {r?.error && (
                      <span className="text-[9px] text-red-400/80 inline-flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> {r.error}</span>
                    )}
                  </div>
                </div>
              </div>
              {isOpen && r?.output && (
                <div className="border-t border-border/15 bg-background/40 p-2.5 max-h-72 overflow-auto">
                  <pre className="text-[10px] font-light leading-relaxed whitespace-pre-wrap text-foreground/85">{r.output}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
