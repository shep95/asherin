import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Sparkles, Layers } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Domain = "financial" | "behavioral" | "communications" | "geospatial" | "regulatory" | "osint";
interface Signal {
  id: string;
  domain: Domain;
  text: string;
  weight: number; // 0..1
  timestamp: number;
}
interface FusedView {
  question: string;
  signals: string[]; // signal ids
  synthesis: string;
  confidence: number;
  updatedAt: number;
}

const KEY_S = (sid: string) => `azplen:fusion:signals:${sid}`;
const KEY_V = (sid: string) => `azplen:fusion:views:${sid}`;

const DOMAIN: Record<Domain, string> = {
  financial: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  behavioral: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  communications: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  geospatial: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  regulatory: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  osint: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};

/**
 * Intelligence Fusion — combine signals from multiple analytical domains
 * (financial + behavioral + communications + geospatial + regulatory + OSINT)
 * into unified, weighted assessments.
 */
const FusionPanel = () => {
  const { activeSession } = useAzplenSession();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [views, setViews] = useState<FusedView[]>([]);
  const [draftS, setDraftS] = useState<Omit<Signal, "id" | "timestamp">>({ domain: "financial", text: "", weight: 0.6 });
  const [draftV, setDraftV] = useState<{ question: string; selected: Set<string> }>({ question: "", selected: new Set() });

  useEffect(() => {
    if (!activeSession) return;
    try { setSignals(JSON.parse(localStorage.getItem(KEY_S(activeSession.id)) || "[]")); } catch {}
    try { setViews(JSON.parse(localStorage.getItem(KEY_V(activeSession.id)) || "[]")); } catch {}
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY_S(activeSession.id), JSON.stringify(signals)), 300);
    return () => clearTimeout(h);
  }, [signals, activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY_V(activeSession.id), JSON.stringify(views)), 300);
    return () => clearTimeout(h);
  }, [views, activeSession?.id]);

  const addSignal = () => {
    if (!draftS.text.trim()) return;
    setSignals(p => [{ ...draftS, id: crypto.randomUUID(), timestamp: Date.now() }, ...p]);
    setDraftS({ domain: "financial", text: "", weight: 0.6 });
  };
  const removeSignal = (id: string) => setSignals(p => p.filter(s => s.id !== id));
  const toggle = (id: string) => {
    const s = new Set(draftV.selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setDraftV({ ...draftV, selected: s });
  };

  const fuse = () => {
    if (!draftV.question.trim() || draftV.selected.size === 0) return;
    const used = signals.filter(s => draftV.selected.has(s.id));
    const domains = Array.from(new Set(used.map(s => s.domain)));
    const wSum = used.reduce((a, s) => a + s.weight, 0);
    const confidence = Math.min(1, (wSum / used.length) * (1 + 0.15 * (domains.length - 1)));
    const synth = `Signal fusion across ${domains.length} domain${domains.length > 1 ? "s" : ""} (${domains.join(", ")}) yields ${
      confidence > 0.75 ? "strong" : confidence > 0.5 ? "moderate" : "weak"
    } convergence on: "${draftV.question.trim()}". Cross-domain reinforcement is the basis of the assessment.`;
    setViews(p => [{
      question: draftV.question.trim(),
      signals: Array.from(draftV.selected),
      synthesis: synth,
      confidence,
      updatedAt: Date.now(),
    }, ...p]);
    setDraftV({ question: "", selected: new Set() });
  };

  const domainStats = useMemo(() => {
    const c: Record<Domain, number> = { financial: 0, behavioral: 0, communications: 0, geospatial: 0, regulatory: 0, osint: 0 };
    signals.forEach(s => c[s.domain]++);
    return c;
  }, [signals]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Intelligence Fusion</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Combine signals across financial, behavioral, communications, geospatial, regulatory, and OSINT domains.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {(Object.keys(DOMAIN) as Domain[]).map(d => (
          <div key={d} className={`rounded-lg border p-3 ${DOMAIN[d]}`}>
            <p className="text-[9px] font-mono uppercase tracking-wider truncate">{d}</p>
            <p className="text-lg font-extralight mt-0.5">{domainStats[d]}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 lg:col-span-6 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Signals</h3>
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <select value={draftS.domain} onChange={e => setDraftS({ ...draftS, domain: e.target.value as Domain })}
                className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
                {(Object.keys(DOMAIN) as Domain[]).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input value={draftS.text} onChange={e => setDraftS({ ...draftS, text: e.target.value })} placeholder="Signal…"
                className="col-span-7 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
              <input type="number" min={0} max={1} step={0.05} value={draftS.weight} onChange={e => setDraftS({ ...draftS, weight: parseFloat(e.target.value) || 0 })}
                className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
              <button onClick={addSignal} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
                <Plus className="h-3 w-3 mx-auto" />
              </button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {signals.map(s => (
              <label key={s.id} className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors
                ${draftV.selected.has(s.id) ? "border-amber-300/30 bg-amber-300/[0.05]" : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"}`}>
                <input type="checkbox" checked={draftV.selected.has(s.id)} onChange={() => toggle(s.id)} className="mt-1 accent-amber-300" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${DOMAIN[s.domain]}`}>{s.domain}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/60">w={s.weight.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-foreground font-extralight mt-1">{s.text}</p>
                </div>
                <button onClick={(e) => { e.preventDefault(); removeSignal(s.id); }} className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </label>
            ))}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-6 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Fused Assessments</h3>
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 space-y-2">
            <input value={draftV.question} onChange={e => setDraftV({ ...draftV, question: e.target.value })}
              placeholder="Question to fuse against — e.g. Is ACME engaged in sanctions evasion?"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <button onClick={fuse} disabled={!draftV.question.trim() || draftV.selected.size === 0}
              className="w-full rounded-lg bg-amber-300/10 border border-amber-300/20 py-2 text-xs text-amber-200 hover:bg-amber-300/20 disabled:opacity-30">
              <Layers className="h-3 w-3 inline mr-1" /> Fuse {draftV.selected.size} signal{draftV.selected.size !== 1 ? "s" : ""}
            </button>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {views.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No assessments yet</p>}
            {views.map((v, i) => (
              <div key={i} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-extralight text-foreground">{v.question}</h4>
                  <span className={`text-[10px] font-mono ${v.confidence > 0.75 ? "text-emerald-300" : v.confidence > 0.5 ? "text-amber-300" : "text-rose-300"}`}>
                    {Math.round(v.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-extralight mt-2 leading-relaxed">{v.synthesis}</p>
                <p className="text-[9px] text-muted-foreground/40 font-mono mt-2">{v.signals.length} signals · {new Date(v.updatedAt).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FusionPanel;
