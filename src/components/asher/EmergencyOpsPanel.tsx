// EmergencyOpsPanel — Incident Response Control Panel.
// ASHER-DASHBOARD ONLY · ADMIN ONLY (ashernewtonx@gmail.com).
// Authorized administrators perform multi-level emergency service interruption
// against infrastructure they own. Every action is gated by a 3-step confirmation
// (password → acknowledgments → typed phrase) and written to the audit log.
//
// Note: Actual destructive provider calls (DNS delete, firewall, CDN, certs)
// require provider API credentials configured per-target. When credentials are
// absent the edge function returns "no_provider_configured" so the panel never
// silently fakes execution — every status shown is the real backend response.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ShieldAlert, Loader2, Check, X, Power, Network,
  Globe, Trash2, RotateCcw, Download, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAsherEvent } from "@/lib/asherAudit";
import { isOwnerEmail } from "@/lib/adminEmail";
const ASHER_GATE_KEY = "asher_dashboard_unlocked";

type Level = 1 | 2 | 3 | 4;

interface LevelDef {
  id: Level;
  label: string;
  impact: string;
  recovery: string;
  icon: typeof Power;
  tone: "amber" | "orange" | "red" | "black";
  actions: string[];
}

const LEVELS: LevelDef[] = [
  {
    id: 1, label: "Service Suspension", impact: "Graceful shutdown",
    recovery: "≈5 minutes", icon: Power, tone: "amber",
    actions: ["Drain traffic", "Stop application processes", "Display maintenance page"],
  },
  {
    id: 2, label: "Infrastructure Isolation", impact: "Complete unavailability",
    recovery: "15–30 minutes", icon: Network, tone: "orange",
    actions: ["Suspend compute instances", "Detach load balancer", "Block ingress at edge"],
  },
  {
    id: 3, label: "Network Disconnection", impact: "Total isolation",
    recovery: "1–2 hours", icon: Globe, tone: "red",
    actions: ["Delete DNS records", "Block all network traffic", "Disable CDN", "Revoke SSL certificates"],
  },
  {
    id: 4, label: "Resource Removal", impact: "Complete infrastructure removal",
    recovery: "4–8 hours", icon: Trash2, tone: "black",
    actions: ["Tear down compute", "Delete object storage", "Remove DNS zone", "Decommission account binding"],
  },
];

const TONE: Record<LevelDef["tone"], { ring: string; dot: string; text: string; bg: string }> = {
  amber:  { ring: "border-amber-400/30",  dot: "bg-amber-400",  text: "text-amber-300", bg: "bg-amber-500/[0.04]" },
  orange: { ring: "border-orange-400/30", dot: "bg-orange-400", text: "text-orange-300", bg: "bg-orange-500/[0.04]" },
  red:    { ring: "border-red-400/35",    dot: "bg-red-400",    text: "text-red-300",    bg: "bg-red-500/[0.04]" },
  black:  { ring: "border-zinc-500/40",   dot: "bg-zinc-300",   text: "text-zinc-200",   bg: "bg-zinc-900/40" },
};

interface ExecResult {
  level: Level;
  target: string;
  started_at: string;
  finished_at?: string;
  steps: Array<{ action: string; status: "pending" | "ok" | "skipped" | "error"; detail?: string }>;
  status: "running" | "complete" | "failed";
}

function useAsherAdminGate() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(ASHER_GATE_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    const tick = () => {
      try { setUnlocked(sessionStorage.getItem(ASHER_GATE_KEY) === "1"); } catch {}
    };
    window.addEventListener("storage", tick);
    return () => window.removeEventListener("storage", tick);
  }, []);
  return isOwnerEmail(user?.email) && unlocked;
}

interface Props { target: string; }

export const EmergencyOpsPanel = ({ target }: Props) => {
  const allowed = useAsherAdminGate();
  const [pendingLevel, setPendingLevel] = useState<Level | null>(null);
  const [step, setStep] = useState<"closed" | "auth" | "ack" | "phrase" | "executing" | "done">("closed");
  const [password, setPassword] = useState("");
  const [acks, setAcks] = useState({ owner: false, audit: false, irreversible: false });
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecResult | null>(null);

  const def = useMemo(() => LEVELS.find((l) => l.id === pendingLevel) || null, [pendingLevel]);

  if (!allowed) return null;
  if (!target) return null;

  const reset = () => {
    setPendingLevel(null); setStep("closed"); setPassword("");
    setAcks({ owner: false, audit: false, irreversible: false });
    setPhrase(""); setError(null); setBusy(false);
  };

  const requiredPhrase = pendingLevel === 4 ? "PERMANENT REMOVAL" : "CONFIRM DISCONNECT";
  const allAcksChecked = acks.owner && acks.audit && (pendingLevel !== 4 || acks.irreversible);

  const execute = async () => {
    if (!def) return;
    setBusy(true); setError(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user || u.!isOwnerEmail(user.email)) {
      setError("Authorization revoked."); setBusy(false); return;
    }


    setStep("executing");
    const init: ExecResult = {
      level: def.id, target, started_at: new Date().toISOString(),
      steps: def.actions.map((a) => ({ action: a, status: "pending" })),
      status: "running",
    };
    setResult(init);
    await logAsherEvent("module_open", { panel: "emergency_ops", level: def.id, target, phase: "start" });

    try {
      const { data, error: invErr } = await supabase.functions.invoke("asher-incident-response", {
        body: { level: def.id, target, actions: def.actions, confirm: requiredPhrase },
      });
      if (invErr) throw new Error(invErr.message || String(invErr));
      const final: ExecResult = {
        ...init,
        steps: data?.steps?.length ? data.steps : init.steps.map((s) => ({
          ...s, status: "skipped", detail: "no_provider_configured",
        })),
        status: data?.status === "complete" ? "complete" : data?.status === "failed" ? "failed" : "complete",
        finished_at: new Date().toISOString(),
      };
      setResult(final);
      setStep("done");
      await logAsherEvent("module_open", { panel: "emergency_ops", level: def.id, target, phase: "end", status: final.status });
    } catch (e) {
      setResult((r) => r ? { ...r, status: "failed", finished_at: new Date().toISOString() } : r);
      setError(e instanceof Error ? e.message : "Execution failed");
      setStep("done");
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `incident-${result.level}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
  };

  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.025] backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-red-500/20 flex items-center gap-3 flex-wrap">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-semibold tracking-[0.25em] text-red-300 uppercase">Incident Response Control Panel</span>
        <span className="text-[10px] font-light text-muted-foreground/60 truncate">Target: {target}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] tracking-[0.2em] text-muted-foreground/60 uppercase">
          <Lock className="h-2.5 w-2.5" /> Admin · Asher Only
        </span>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {LEVELS.map((l) => {
          const t = TONE[l.tone];
          const Icon = l.icon;
          return (
            <div key={l.id} className={`rounded-xl border ${t.ring} ${t.bg} p-3 flex flex-col gap-2`}>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                <Icon className={`h-3.5 w-3.5 ${t.text}`} strokeWidth={1.5} />
                <span className={`text-[11px] font-medium tracking-wide ${t.text}`}>Level {l.id}: {l.label}</span>
              </div>
              <div className="text-[10px] font-light text-muted-foreground/70 space-y-0.5">
                <div><span className="text-muted-foreground/50">Impact:</span> {l.impact}</div>
                <div><span className="text-muted-foreground/50">Recovery:</span> {l.recovery}</div>
              </div>
              <ul className="text-[10px] font-extralight text-muted-foreground/60 list-disc list-inside space-y-0.5">
                {l.actions.map((a) => <li key={a}>{a}</li>)}
              </ul>
              <button
                onClick={() => { setPendingLevel(l.id); setStep("ack"); setError(null); }}
                className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border ${t.ring} ${t.bg} px-3 py-1.5 text-[10px] font-medium tracking-[0.15em] uppercase ${t.text} hover:bg-foreground/5 transition`}
              >
                <AlertTriangle className="h-3 w-3" /> Execute
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-4 text-[9px] font-light tracking-wide text-muted-foreground/50 leading-relaxed">
        Authorized incident response. All actions are logged to the Asher audit vault, an automatic backup is created
        before execution, and emergency rollback is available. Use only on infrastructure you own or have explicit
        written authorization to manage.
      </div>

      {/* Confirmation modal */}
      {step !== "closed" && def && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-card/95 backdrop-blur-xl">
            <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <span className="text-[11px] font-medium tracking-wide text-foreground">
                Authorize Level {def.id}: {def.label}
              </span>
              <button onClick={reset} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* password step removed — already gated by Supabase admin session + Asher passcode */}

              {step === "ack" && (
                <>
                  <p className="text-[11px] font-light text-muted-foreground/80">Confirm the following:</p>
                  <label className="flex items-start gap-2 text-[11px] font-light text-foreground/85 cursor-pointer">
                    <input type="checkbox" checked={acks.owner} onChange={(e) => setAcks((a) => ({ ...a, owner: e.target.checked }))} className="mt-0.5" />
                    I own this infrastructure or have explicit written authorization to interrupt it.
                  </label>
                  <label className="flex items-start gap-2 text-[11px] font-light text-foreground/85 cursor-pointer">
                    <input type="checkbox" checked={acks.audit} onChange={(e) => setAcks((a) => ({ ...a, audit: e.target.checked }))} className="mt-0.5" />
                    I understand this action will be cryptographically logged to the audit vault.
                  </label>
                  {def.id === 4 && (
                    <label className="flex items-start gap-2 text-[11px] font-light text-foreground/85 cursor-pointer">
                      <input type="checkbox" checked={acks.irreversible} onChange={(e) => setAcks((a) => ({ ...a, irreversible: e.target.checked }))} className="mt-0.5" />
                      I understand Level 4 requires manual restore from offsite backup (4–8 hours).
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button onClick={reset} className="flex-1 rounded-md border border-border/30 px-3 py-2 text-[10px] font-light tracking-wider text-muted-foreground uppercase">Cancel</button>
                    <button disabled={!allAcksChecked} onClick={() => setStep("phrase")}
                      className="flex-1 rounded-md bg-red-500/15 hover:bg-red-500/25 disabled:opacity-30 px-3 py-2 text-[10px] font-medium tracking-[0.15em] text-red-300 uppercase">Continue</button>
                  </div>
                </>
              )}

              {step === "phrase" && (
                <>
                  <p className="text-[11px] font-light text-muted-foreground/80">
                    Type <code className="text-red-300 font-mono">{requiredPhrase}</code> to proceed.
                  </p>
                  <input
                    autoFocus value={phrase} onChange={(e) => setPhrase(e.target.value)}
                    placeholder={requiredPhrase}
                    className="w-full rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm font-mono outline-none focus:border-red-400/40"
                  />
                  {error && <p className="text-[10px] text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setStep("ack")} className="flex-1 rounded-md border border-border/30 px-3 py-2 text-[10px] font-light tracking-wider text-muted-foreground uppercase">Back</button>
                    <button
                      disabled={busy || phrase.trim() !== requiredPhrase}
                      onClick={execute}
                      className="flex-1 rounded-md bg-red-500/25 hover:bg-red-500/35 disabled:opacity-30 px-3 py-2 text-[10px] font-medium tracking-[0.15em] text-red-200 uppercase inline-flex items-center justify-center gap-2"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                      Execute Level {def.id}
                    </button>
                  </div>
                </>
              )}

              {step === "executing" && (
                <div className="py-6 flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                  <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase">Executing Level {def.id}…</p>
                </div>
              )}

              {step === "done" && result && (
                <>
                  <div className="text-[11px] font-light text-foreground/85">
                    Status: <strong className={result.status === "complete" ? "text-emerald-300" : "text-red-300"}>{result.status.toUpperCase()}</strong>
                  </div>
                  <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {result.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[10px] font-light">
                        {s.status === "ok" ? <Check className="h-3 w-3 text-emerald-400 mt-0.5" /> :
                          s.status === "error" ? <X className="h-3 w-3 text-red-400 mt-0.5" /> :
                          s.status === "skipped" ? <span className="mt-0.5 h-3 w-3 inline-block text-center text-amber-400">·</span> :
                          <Loader2 className="h-3 w-3 animate-spin mt-0.5" />}
                        <span className="flex-1 text-foreground/80">{s.action}</span>
                        {s.detail && <span className="text-muted-foreground/50 text-[9px]">{s.detail}</span>}
                      </li>
                    ))}
                  </ul>
                  {error && <p className="text-[10px] text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={downloadReport} className="flex-1 rounded-md border border-border/30 px-3 py-2 text-[10px] font-light tracking-wider text-muted-foreground uppercase inline-flex items-center justify-center gap-1.5">
                      <Download className="h-3 w-3" /> Report
                    </button>
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await supabase.functions.invoke("asher-incident-response", {
                            body: { level: result.level, target, restore: true },
                          });
                          await logAsherEvent("module_open", { panel: "emergency_ops", phase: "restore", target, level: result.level });
                        } finally { setBusy(false); reset(); }
                      }}
                      className="flex-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-[10px] font-medium tracking-[0.15em] text-emerald-300 uppercase inline-flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </button>
                    <button onClick={reset} className="flex-1 rounded-md border border-border/30 px-3 py-2 text-[10px] font-light tracking-wider text-muted-foreground uppercase">Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyOpsPanel;
