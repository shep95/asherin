// Zaxin Falcon Ops — hotlist manager + live sightings + convoy detector.
// Renders as a compact panel under the AR canvas. No external deps.
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ShieldAlert, Car, Users, ListChecks } from "lucide-react";
import {
  addHotlistPlate, listHotlist, removeHotlistPlate, warmHotlist,
  type HotlistEntry,
} from "@/lib/zaxin/falcon/hotlist";
import {
  detectConvoys, subscribeSightings, type ConvoyPair, type Sighting,
} from "@/lib/zaxin/falcon/sightings";

export default function FalconOpsPanel() {
  const [hotlist, setHotlist] = useState<HotlistEntry[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [convoys, setConvoys] = useState<ConvoyPair[]>([]);
  const [addPlate, setAddPlate] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addSeverity, setAddSeverity] = useState<HotlistEntry["severity"]>("alert");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshHotlist = useCallback(async () => {
    try { setHotlist(await listHotlist()); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);

  useEffect(() => {
    warmHotlist().then(refreshHotlist);
    const unsub = subscribeSightings((all) => {
      setSightings(all.slice(-40).reverse());
      setConvoys(detectConvoys().slice(0, 8));
    });
    return () => { unsub(); };
  }, [refreshHotlist]);

  const submitPlate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPlate.trim() || !addReason.trim()) return;
    setBusy(true); setErr(null);
    try {
      await addHotlistPlate(addPlate.trim(), addReason.trim(), addSeverity);
      setAddPlate(""); setAddReason("");
      await refreshHotlist();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const remove = async (h: string) => {
    try { await removeHotlistPlate(h); await refreshHotlist(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.05] flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5 text-amber-300/80" strokeWidth={1.5} />
        <p className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground">
          Falcon Ops · Hotlist · Convoy
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        {/* HOTLIST */}
        <section className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <ListChecks className="h-3 w-3 text-foreground/60" strokeWidth={1.5} />
            <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground">Local Hotlist ({hotlist.length})</p>
          </div>
          <form onSubmit={submitPlate} className="space-y-1.5 mb-2">
            <input
              value={addPlate} onChange={(e) => setAddPlate(e.target.value.toUpperCase())}
              placeholder="PLATE (e.g. 7ABC123)" maxLength={16}
              className="w-full text-[11px] font-mono bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-amber-300/40"
            />
            <input
              value={addReason} onChange={(e) => setAddReason(e.target.value)}
              placeholder="Reason (Stolen / BOLO / Person of Interest)" maxLength={120}
              className="w-full text-[10px] bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-amber-300/40"
            />
            <div className="flex items-center gap-1">
              <select
                value={addSeverity} onChange={(e) => setAddSeverity(e.target.value as HotlistEntry["severity"])}
                className="text-[10px] bg-black/40 border border-white/10 rounded px-2 py-1 flex-1"
              >
                <option value="watch">Watch</option>
                <option value="alert">Alert</option>
                <option value="critical">Critical</option>
              </select>
              <button
                type="submit" disabled={busy}
                className="text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-100 border border-amber-300/40 hover:bg-amber-500/30 disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" strokeWidth={1.5} /> Add
              </button>
            </div>
          </form>
          {err && <p className="text-[9px] text-rose-300/80 mb-1">{err}</p>}
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {hotlist.length === 0 && <p className="text-[9px] text-muted-foreground/60 italic">No plates on hotlist. Plates are stored as SHA-256 hashes on this device.</p>}
            {hotlist.map((h) => (
              <div key={h.plateHash} className="flex items-center justify-between gap-2 text-[10px] px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-foreground/90 truncate">{h.plaintext}</p>
                  <p className="text-[8px] text-muted-foreground truncate">{h.reason} · {h.severity}</p>
                </div>
                <button onClick={() => remove(h.plateHash)} className="text-muted-foreground hover:text-rose-300">
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SIGHTINGS */}
        <section className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Car className="h-3 w-3 text-foreground/60" strokeWidth={1.5} />
            <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground">Live Sightings ({sightings.length})</p>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {sightings.length === 0 && <p className="text-[9px] text-muted-foreground/60 italic">No confirmed plate reads yet. Point the camera at a visible plate.</p>}
            {sightings.map((s, i) => (
              <div key={`${s.plateHash}-${s.ts}-${i}`} className="text-[10px] px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-foreground/90">{s.plate}</p>
                  <p className="text-[8px] text-muted-foreground">
                    {[s.color, s.bodyClass].filter(Boolean).join(" · ") || "no fingerprint"}
                  </p>
                </div>
                <p className="text-[8px] text-muted-foreground/70 whitespace-nowrap">
                  {new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CONVOY */}
        <section className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="h-3 w-3 text-foreground/60" strokeWidth={1.5} />
            <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground">Co-Travel Pairs ({convoys.length})</p>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {convoys.length === 0 && <p className="text-[9px] text-muted-foreground/60 italic">Need ≥2 co-occurrences within 60s to flag a convoy pair.</p>}
            {convoys.map((p) => (
              <div key={`${p.a.hash}-${p.b.hash}`} className="text-[10px] px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
                <p className="font-mono text-foreground/90 truncate">{p.a.plate} ⇋ {p.b.plate}</p>
                <p className="text-[8px] text-muted-foreground">
                  {p.coOccurrences}× · last {new Date(p.lastTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
