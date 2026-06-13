import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Radio, Pause, Play } from "lucide-react";

type Type = "rss" | "webhook" | "api" | "filesystem";
interface Stream { id: string; name: string; type: Type; endpoint: string; cadenceSec: number; active: boolean; lastTick?: number; events: number; }

const KEY = "azplen:streams:global";

const TYPE_BADGE: Record<Type, string> = {
  rss: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  webhook: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  api: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  filesystem: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
};

/**
 * Live Data Stream Ingestion — registry of always-on data sources
 * (RSS, webhooks, polled APIs, watched folders). The session is fed
 * continuously rather than via one-shot uploads.
 */
const StreamsPanel = () => {
  const [items, setItems] = useState<Stream[]>([]);
  const [draft, setDraft] = useState<Omit<Stream, "id" | "events">>({ name: "", type: "rss", endpoint: "", cadenceSec: 60, active: true });
  const tick = useRef<number | null>(null);

  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(items)), 300); return () => clearTimeout(h); }, [items]);

  // Simulated heartbeat — each active stream "ticks" on its cadence
  useEffect(() => {
    if (tick.current) window.clearInterval(tick.current);
    tick.current = window.setInterval(() => {
      const now = Date.now();
      setItems(prev => prev.map(s => {
        if (!s.active) return s;
        const due = !s.lastTick || (now - s.lastTick) >= s.cadenceSec * 1000;
        if (!due) return s;
        return { ...s, lastTick: now, events: s.events + Math.ceil(Math.random() * 3) };
      }));
    }, 1000);
    return () => { if (tick.current) window.clearInterval(tick.current); };
  }, []);

  const add = () => {
    if (!draft.name.trim() || !draft.endpoint.trim()) return;
    setItems(p => [...p, { ...draft, id: crypto.randomUUID(), events: 0 }]);
    setDraft({ name: "", type: "rss", endpoint: "", cadenceSec: 60, active: true });
  };
  const toggle = (id: string) => setItems(p => p.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const remove = (id: string) => setItems(p => p.filter(s => s.id !== id));

  const ago = (ts?: number) => !ts ? "—" : (() => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  })();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-extralight tracking-tight text-foreground">Live Streams</h2>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          Always-on data sources — RSS feeds, webhooks, polled APIs, watched folders.
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Stream name"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Type })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option value="rss">RSS</option><option value="webhook">Webhook</option>
            <option value="api">API poll</option><option value="filesystem">Folder</option>
          </select>
          <input value={draft.endpoint} onChange={e => setDraft({ ...draft, endpoint: e.target.value })} placeholder="URL or path"
            className="col-span-5 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight font-mono" />
          <input type="number" value={draft.cadenceSec} onChange={e => setDraft({ ...draft, cadenceSec: Math.max(5, parseInt(e.target.value) || 0) })}
            className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <button onClick={add} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider">cadence in seconds</p>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No streams registered</p>
        )}
        {items.map(s => (
          <div key={s.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Radio className={`h-4 w-4 ${s.active ? "text-emerald-300" : "text-muted-foreground/40"}`} />
                {s.active && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extralight text-foreground">{s.name}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${TYPE_BADGE[s.type]}`}>{s.type}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-mono mt-1 truncate">{s.endpoint}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">Events</p>
                <p className="text-sm font-extralight text-foreground">{s.events.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">Last</p>
                <p className="text-xs font-mono text-amber-200/80">{ago(s.lastTick)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">Cadence</p>
                <p className="text-xs font-mono text-foreground">{s.cadenceSec}s</p>
              </div>
              <button onClick={() => toggle(s.id)} className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]">
                {s.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => remove(s.id)} className="p-2 rounded text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StreamsPanel;
