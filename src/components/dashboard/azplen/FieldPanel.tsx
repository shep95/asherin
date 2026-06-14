import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Smartphone, MapPin, Camera, Mic, FileText, Wifi, WifiOff } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Kind = "note" | "photo" | "audio" | "geo" | "interview";
interface Capture {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  lat?: number;
  lon?: number;
  syncedAt?: number;
  capturedAt: number;
}

const KEY = (sid: string) => `azplen:field:${sid}`;

const KIND: Record<Kind, { icon: typeof FileText; style: string }> = {
  note: { icon: FileText, style: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]" },
  photo: { icon: Camera, style: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]" },
  audio: { icon: Mic, style: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]" },
  geo: { icon: MapPin, style: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]" },
  interview: { icon: Mic, style: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]" },
};

/**
 * Mobile Field Collection — simulated mobile reader / capture surface.
 * Notes, photos, audio, geo-pins, interviews — captured offline-first,
 * synced to the active session.
 */
const FieldPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Capture[]>([]);
  const [online, setOnline] = useState(true);
  const [draft, setDraft] = useState<{ kind: Kind; title: string; body: string }>({ kind: "note", title: "", body: "" });

  useEffect(() => {
    if (!activeSession) return;
    try { setItems(JSON.parse(localStorage.getItem(KEY(activeSession.id)) || "[]")); } catch { setItems([]); }
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY(activeSession.id), JSON.stringify(items)), 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  // Auto-sync when "online"
  useEffect(() => {
    if (!online) return;
    const h = setInterval(() => {
      setItems(p => p.map(c => c.syncedAt ? c : { ...c, syncedAt: Date.now() }));
    }, 2000);
    return () => clearInterval(h);
  }, [online]);

  const pendingSync = useMemo(() => items.filter(c => !c.syncedAt).length, [items]);

  const capture = async () => {
    if (!draft.title.trim()) return;
    const base: Capture = {
      id: crypto.randomUUID(), kind: draft.kind, title: draft.title.trim(),
      body: draft.body.trim(), capturedAt: Date.now(),
    };
    if (draft.kind === "geo" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }));
        base.lat = pos.coords.latitude; base.lon = pos.coords.longitude;
      } catch { /* ignore — capture still saves */ }
    }
    setItems(p => [base, ...p]);
    setDraft({ kind: "note", title: "", body: "" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-amber-300/80 mt-1" />
          <div>
            <h2 className="text-xl font-extralight tracking-tight text-foreground">Field Capture</h2>
            <p className="text-xs font-extralight text-muted-foreground mt-1">
              Offline-first mobile collection. Notes, photos, audio, geo-pins, interviews.
            </p>
          </div>
        </div>
        <button onClick={() => setOnline(o => !o)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors
            ${online ? "border-emerald-300/25 bg-emerald-300/[0.05] text-emerald-200" : "border-rose-300/25 bg-rose-300/[0.05] text-rose-200"}`}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Online" : "Offline"}
          {pendingSync > 0 && <span className="font-mono text-[10px]">· {pendingSync} pending</span>}
        </button>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="flex gap-2">
          {(Object.keys(KIND) as Kind[]).map(k => {
            const I = KIND[k].icon;
            return (
              <button key={k} onClick={() => setDraft(d => ({ ...d, kind: k }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-mono uppercase tracking-wider transition-colors
                  ${draft.kind === k ? KIND[k].style : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
                <I className="h-3 w-3" /> {k}
              </button>
            );
          })}
        </div>
        <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Title"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-amber-300/40 font-extralight" />
        <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })}
          placeholder={draft.kind === "interview" ? "Interview transcript / quotes…" : "Body / observations…"} rows={3}
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight resize-none" />
        <button onClick={capture} className="rounded-lg bg-amber-300/10 border border-amber-300/20 px-4 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20">
          <Plus className="h-3 w-3 inline mr-1" /> Capture
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No field captures</p>}
        {items.map(c => {
          const I = KIND[c.kind].icon;
          return (
            <div key={c.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
              <div className="flex items-start gap-3">
                <I className="h-4 w-4 text-amber-300/70 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extralight text-foreground">{c.title}</span>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${KIND[c.kind].style}`}>{c.kind}</span>
                    {c.lat != null && c.lon != null && (
                      <span className="text-[10px] font-mono text-emerald-300/80">{c.lat.toFixed(4)}, {c.lon.toFixed(4)}</span>
                    )}
                  </div>
                  {c.body && <p className="text-xs text-muted-foreground font-extralight mt-1 whitespace-pre-wrap">{c.body}</p>}
                  <p className="text-[9px] text-muted-foreground/40 font-mono mt-2">
                    captured {new Date(c.capturedAt).toLocaleString()} ·
                    {c.syncedAt ? <span className="text-emerald-300/80"> synced</span> : <span className="text-amber-300/80"> pending sync</span>}
                  </p>
                </div>
                <button onClick={() => setItems(p => p.filter(x => x.id !== c.id))} className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FieldPanel;
