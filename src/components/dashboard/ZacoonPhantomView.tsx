// ZACOON PHANTOM GRID — Aureon Dashboard Console (glass-morphic 3-zone)
// $79/mo Pro tier only. Mass-banned on aureonai.app for non-admins.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminEmail";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Radar, Brain, Send, Zap, Target, AlertTriangle, Check, Ghost } from "lucide-react";

type Phase = "RECON" | "NAVIGATE" | "ADVERSARIAL" | "SELF_CORRECT" | "SYNTHESIS" | "DISPATCH" | "CLOSE";
type EventType = "PLAN" | "EXECUTE" | "DETECT" | "ADAPT" | "ABORT" | "CONFIRM";
interface CortexEvent { ts_ms: number; phase: Phase; event_type: EventType; detail: string; data?: unknown }
type Mode = "recon" | "extract" | "forge" | "resilience_probe" | "browser";
type Risk = "stealth" | "standard" | "aggressive" | "forensic";

const MODE_OPTIONS: { id: Mode; label: string; blurb: string; icon: any }[] = [
  { id: "recon", label: "Phantom Recon", blurb: "Deep surface mapping w/ adversarial awareness", icon: Radar },
  { id: "extract", label: "Precision Extract", blurb: "Multi-pass structured harvest", icon: Target },
  { id: "forge", label: "Forge Blueprint", blurb: "Generate reusable scraper code", icon: Zap },
  { id: "browser", label: "Browser Task", blurb: "Single-target answer synthesis", icon: Ghost },
  { id: "resilience_probe", label: "Resilience Probe", blurb: "Analytical model (ownership required)", icon: ShieldAlert },
];

const EVENT_COLOR: Record<EventType, string> = {
  PLAN: "text-sky-300 border-sky-400/30 bg-sky-500/5",
  EXECUTE: "text-foreground/90 border-foreground/15 bg-foreground/5",
  DETECT: "text-amber-300 border-amber-400/30 bg-amber-500/5",
  ADAPT: "text-cyan-300 border-cyan-400/30 bg-cyan-500/5",
  ABORT: "text-red-300 border-red-400/30 bg-red-500/5",
  CONFIRM: "text-emerald-300 border-emerald-400/30 bg-emerald-500/5",
};

const RESTRICTED_HOSTS = new Set(["aureonai.app", "www.aureonai.app"]);

const ZacoonPhantomView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = isAdminEmail(user?.email);
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const banned = RESTRICTED_HOSTS.has(host) && !isAdmin;

  const [mode, setMode] = useState<Mode>("recon");
  const [risk, setRisk] = useState<Risk>("standard");
  const [objective, setObjective] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [ownershipAtt, setOwnershipAtt] = useState(false);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<CortexEvent[]>([]);
  const [result, setResult] = useState<any>(null);
  const [analystQ, setAnalystQ] = useState("");
  const [analystChat, setAnalystChat] = useState<{ role: "op" | "ai"; text: string }[]>([]);
  const [analystBusy, setAnalystBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll live feed
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }, [events]);

  const dispatch = useCallback(async () => {
    if (running) return;
    if (!targetUrl.trim()) { toast({ title: "Target URL required", variant: "destructive" }); return; }
    if (mode === "resilience_probe" && !ownershipAtt) {
      toast({ title: "Ownership attestation required for Resilience Probe", variant: "destructive" });
      return;
    }
    setRunning(true); setEvents([]); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("zacoon-run", {
        body: {
          mode,
          objective: objective.trim(),
          target_url: targetUrl.trim(),
          risk_envelope: risk,
          ownership_attestation: ownershipAtt || undefined,
        },
      });
      if (error) throw error;
      if (data?.events) setEvents(data.events);
      if (data?.ok === false) {
        toast({ title: "Mission failed", description: data.error, variant: "destructive" });
      } else {
        setResult(data);
        toast({ title: "Mission Signal Package received", description: `${data.events?.length || 0} cortex events · ${Math.round((data.duration_ms || 0) / 1000)}s` });
      }
    } catch (e: any) {
      const msg = e?.context?.status === 402 ? "This module requires the $79/mo Pro plan."
        : e?.context?.status === 451 ? "Zacoon Phantom Grid is not available on this domain."
        : e?.message || "Dispatch failed";
      toast({ title: "Phantom Grid error", description: msg, variant: "destructive" });
    } finally { setRunning(false); }
  }, [running, mode, targetUrl, objective, risk, ownershipAtt, toast]);

  const askAnalyst = useCallback(async () => {
    if (!analystQ.trim() || analystBusy) return;
    const q = analystQ.trim();
    setAnalystChat((c) => [...c, { role: "op", text: q }]);
    setAnalystQ("");
    setAnalystBusy(true);
    try {
      const context = {
        mission_mode: mode,
        target_url: targetUrl,
        intel: result?.intel,
        output: result?.output,
        events: events.slice(-30),
      };
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            { role: "system", content: "You are the Sovereign Intelligence Analyst inside Zacoon Phantom Grid. You have direct read access to the operator's live mission state. Answer surgically, cite specific extractions, and flag any adversarial signals." },
            { role: "user", content: `Live mission state:\n${JSON.stringify(context, null, 2).slice(0, 40_000)}\n\nOperator question: ${q}` },
          ],
        },
      });
      if (error) throw error;
      const reply = data?.content || data?.message || data?.text || "(no response)";
      setAnalystChat((c) => [...c, { role: "ai", text: reply }]);
    } catch (e: any) {
      setAnalystChat((c) => [...c, { role: "ai", text: `Analyst offline: ${e?.message || "error"}` }]);
    } finally { setAnalystBusy(false); }
  }, [analystQ, analystBusy, mode, targetUrl, result, events]);

  const grouped = useMemo(() => events, [events]);

  if (banned) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-400/30 bg-red-500/[0.04] backdrop-blur-xl p-8 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto text-red-300 mb-3" />
          <h2 className="text-base font-light">Zacoon Phantom Grid is restricted on this domain</h2>
          <p className="mt-2 text-xs text-muted-foreground">Access from aureonai.app requires operator clearance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-gradient-to-br from-background via-background to-background/80">
      {/* Header */}
      <div className="border-b border-foreground/10 bg-background/40 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-foreground/10 to-foreground/[0.02] border border-foreground/15 flex items-center justify-center">
            <Ghost className="h-4 w-4 text-foreground/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">◈ Zacoon · Phantom Grid v3.0</div>
            <h1 className="text-sm sm:text-base font-light tracking-wide truncate">Operative Intelligence Console</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-foreground/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
            READY
          </div>
        </div>
      </div>

      {/* 3-Zone Console */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_340px] gap-3 p-3 h-[calc(100%-58px)] overflow-hidden">
        {/* ZONE A: Mission Architect */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl p-4 overflow-y-auto min-h-0">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-3">Zone A · Mission Architect</div>

          <label className="block text-[10px] uppercase tracking-widest text-foreground/50 mb-1.5">Mode</label>
          <div className="space-y-1.5 mb-4">
            {MODE_OPTIONS.map((m) => {
              const active = mode === m.id;
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`w-full text-left rounded-lg border p-2.5 transition backdrop-blur-sm ${active ? "border-foreground/40 bg-foreground/10" : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.05]"}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-foreground/70" />
                    <span className="text-xs font-light">{m.label}</span>
                  </div>
                  <div className="text-[10px] text-foreground/50 mt-0.5 pl-5.5 ml-0">{m.blurb}</div>
                </button>
              );
            })}
          </div>

          <label className="block text-[10px] uppercase tracking-widest text-foreground/50 mb-1.5">Risk Envelope</label>
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {(["stealth", "standard", "aggressive", "forensic"] as Risk[]).map((r) => (
              <button key={r} onClick={() => setRisk(r)}
                className={`rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-wider transition ${risk === r ? "border-foreground/40 bg-foreground/10" : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.05]"}`}>
                {r}
              </button>
            ))}
          </div>

          <label className="block text-[10px] uppercase tracking-widest text-foreground/50 mb-1.5">Target URL</label>
          <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://target.example"
            className="w-full rounded-md border border-foreground/10 bg-foreground/[0.02] backdrop-blur px-3 py-2 text-xs font-mono focus:border-foreground/30 outline-none mb-3" />

          <label className="block text-[10px] uppercase tracking-widest text-foreground/50 mb-1.5">Objective</label>
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)}
            placeholder="Declare mission intent — natural language."
            rows={4}
            className="w-full rounded-md border border-foreground/10 bg-foreground/[0.02] backdrop-blur px-3 py-2 text-xs focus:border-foreground/30 outline-none mb-3 resize-none" />

          {mode === "resilience_probe" && (
            <label className="flex items-start gap-2 mb-3 text-[10px] text-foreground/60">
              <input type="checkbox" checked={ownershipAtt} onChange={(e) => setOwnershipAtt(e.target.checked)} className="mt-0.5" />
              <span>I attest ownership or written authorization for this target.</span>
            </label>
          )}

          <button onClick={dispatch} disabled={running}
            className="w-full rounded-md bg-foreground/90 text-background hover:bg-foreground disabled:opacity-40 py-2.5 text-xs font-medium tracking-wide transition flex items-center justify-center gap-2">
            {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Dispatching…</> : <>◈ Dispatch Mission</>}
          </button>
          <div className="mt-2 text-[9px] font-mono text-foreground/40 text-center">$79/mo Pro tier required</div>
        </div>

        {/* ZONE B: Live Cortex Feed */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl flex flex-col overflow-hidden min-h-0">
          <div className="border-b border-foreground/10 px-4 py-2.5 flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40">Zone B · Live Cortex Feed</div>
            <div className="text-[10px] font-mono text-foreground/40">{events.length} events</div>
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            {events.length === 0 && !result && (
              <div className="text-center text-[11px] text-foreground/40 py-10">
                Standing by. Declare an objective and dispatch to see the agent's cognitive stream.
              </div>
            )}
            {grouped.map((e, i) => (
              <div key={i} className={`rounded-md border px-3 py-1.5 text-[11px] backdrop-blur-sm ${EVENT_COLOR[e.event_type]}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[9px] opacity-70 shrink-0">{String(e.ts_ms).padStart(6, "0")}ms</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest opacity-70 shrink-0">{e.phase}</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest shrink-0">{e.event_type}</span>
                  </div>
                </div>
                <div className="mt-0.5 font-light truncate">{e.detail}</div>
              </div>
            ))}

            {result && (
              <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.05] p-3 backdrop-blur">
                <div className="flex items-center gap-2 text-emerald-300 text-[10px] font-mono uppercase tracking-widest mb-2">
                  <Check className="h-3 w-3" /> Mission Signal Package
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-foreground/70 mb-3">
                  <div>Cert: <span className="text-foreground/90">{String(result.integrity_cert || "").slice(0, 16)}…</span></div>
                  <div>Duration: <span className="text-foreground/90">{Math.round((result.duration_ms || 0)/1000)}s</span></div>
                </div>
                <pre className="text-[10px] text-foreground/80 whitespace-pre-wrap break-words bg-background/40 rounded p-2 max-h-64 overflow-auto">
                  {JSON.stringify(result.intel, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* ZONE C: Sovereign Analyst */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl flex flex-col overflow-hidden min-h-0">
          <div className="border-b border-foreground/10 px-4 py-2.5 flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-foreground/60" />
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40">Zone C · Sovereign Analyst</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {analystChat.length === 0 && (
              <div className="text-center text-[11px] text-foreground/40 py-6">
                Contextualized to your live mission state. Ask about any extraction, threat signal, or adaptation.
              </div>
            )}
            {analystChat.map((m, i) => (
              <div key={i} className={`rounded-md border px-3 py-2 text-[11px] backdrop-blur-sm ${m.role === "op" ? "border-foreground/15 bg-foreground/[0.03] ml-4" : "border-foreground/10 bg-foreground/[0.06] mr-4"}`}>
                <div className="font-mono text-[9px] uppercase tracking-widest text-foreground/40 mb-1">
                  {m.role === "op" ? "Operator" : "Analyst"}
                </div>
                <div className="font-light whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {analystBusy && (
              <div className="flex items-center gap-2 text-[10px] text-foreground/50 px-3"><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</div>
            )}
          </div>
          <div className="border-t border-foreground/10 p-2 flex gap-2">
            <input value={analystQ} onChange={(e) => setAnalystQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAnalyst()}
              placeholder="Interrogate mission state…"
              className="flex-1 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-xs focus:border-foreground/30 outline-none" />
            <button onClick={askAnalyst} disabled={analystBusy || !analystQ.trim()}
              className="rounded-md border border-foreground/20 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 px-3 py-2 text-xs">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZacoonPhantomView;
