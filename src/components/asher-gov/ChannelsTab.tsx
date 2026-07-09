// ChannelsTab — Discord-style channel CRUD for the AdminPanel.
//
// Backed by three service-role actions on the hoa-admin edge function
// (create_channel / update_channel / delete_channel), each guarded by
// requireOwner(). Realtime is not required here — the mutation refetches
// the local list and toasts on success.

import { useEffect, useMemo, useState } from "react";
import { Hash, Volume2, Lock, Radio, Plus, Trash2, Loader2, Save, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Kind = "text" | "voice" | "vault" | "broadcast";
interface Channel {
  id: string; server_id: string; name: string; kind: Kind;
  min_clearance: number; topic: string | null; compartments: string[];
}

const KIND_META: Record<Kind, { Icon: typeof Hash; label: string; blurb: string }> = {
  text:      { Icon: Hash,    label: "Text",      blurb: "Standard chat channel." },
  voice:     { Icon: Volume2, label: "Voice",     blurb: "Secure SRTP voice room." },
  vault:     { Icon: Lock,    label: "Vault",     blurb: "Messages sealed by default." },
  broadcast: { Icon: Radio,   label: "Broadcast", blurb: "Every message is pinned across visible feeds." },
};
const CLEARANCE = ["UNCLASS", "CUI", "CONFIDENTIAL", "SECRET", "TS"];

export default function ChannelsTab({ serverId }: { serverId: string }) {
  const [rows, setRows] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("hoa_channels")
      .select("id, server_id, name, kind, min_clearance, topic, compartments")
      .eq("server_id", serverId).order("kind").order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Channel[]);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [serverId]);

  const grouped = useMemo(() => {
    const g: Record<Kind, Channel[]> = { text: [], voice: [], vault: [], broadcast: [] };
    for (const r of rows) g[r.kind].push(r);
    return g;
  }, [rows]);

  const del = async (c: Channel) => {
    if (!confirm(`Delete #${c.name}? All messages in it are permanently removed.`)) return;
    const { data, error } = await supabase.functions.invoke("hoa-admin", { body: { action: "delete_channel", channelId: c.id } });
    if (error || data?.error) { toast.error(data?.error ?? (error as Error).message); return; }
    toast.success(`#${c.name} deleted`);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-light text-foreground">Channels</div>
          <p className="text-[11px] text-muted-foreground/80">
            Create text, voice, vault and broadcast channels. Set the minimum clearance and topic exactly like a Discord channel — but every access is audit-logged.
          </p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> New channel
        </button>
      </div>

      {showNew && <ChannelForm serverId={serverId} onDone={() => { setShowNew(false); void load(); }} onCancel={() => setShowNew(false)} />}

      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-6"><Loader2 className="h-3 w-3 inline animate-spin mr-1" /> loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/70 border border-dashed border-border/30 rounded-md px-3 py-4 text-center">No channels yet.</div>
      ) : (
        (Object.keys(grouped) as Kind[]).map(k => grouped[k].length === 0 ? null : (
          <div key={k}>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-2">{KIND_META[k].label}</div>
            <div className="space-y-1.5">
              {grouped[k].map(c => (
                <div key={c.id}>
                  {editing?.id === c.id ? (
                    <ChannelForm
                      serverId={serverId} initial={c}
                      onDone={() => { setEditing(null); void load(); }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="rounded-md border border-border/30 bg-black/40 px-3 py-2 flex items-center gap-3 flex-wrap">
                      {(() => { const I = KIND_META[c.kind].Icon; return <I className="h-3.5 w-3.5 text-muted-foreground" />; })()}
                      <span className="text-xs font-light text-foreground">{c.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground tracking-widest uppercase">{CLEARANCE[c.min_clearance] ?? "?"}</span>
                      {c.compartments?.map(cp => (
                        <span key={cp} className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200">{cp}</span>
                      ))}
                      {c.topic && <span className="text-[10px] text-muted-foreground/70 truncate max-w-[280px]">{c.topic}</span>}
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => setEditing(c)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => del(c)} className="p-1 text-amber-300/80 hover:text-amber-300" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────
function ChannelForm({ serverId, initial, onDone, onCancel }: {
  serverId: string; initial?: Channel;
  onDone: () => void; onCancel: () => void;
}) {
  const [name, setName]     = useState(initial?.name ?? "");
  const [kind, setKind]     = useState<Kind>(initial?.kind ?? "text");
  const [minCl, setMinCl]   = useState<number>(initial?.min_clearance ?? 0);
  const [topic, setTopic]   = useState(initial?.topic ?? "");
  const [comps, setComps]   = useState((initial?.compartments ?? []).join(", "));
  const [busy, setBusy]     = useState(false);

  const submit = async () => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!clean) { toast.error("Channel name required"); return; }
    const compartments = comps.split(",").map(s => s.trim()).filter(Boolean).slice(0, 8);
    setBusy(true);
    try {
      const payload = initial
        ? { action: "update_channel", channelId: initial.id, name: clean, kind, minClearance: minCl, topic: topic.trim() || null, compartments }
        : { action: "create_channel", serverId, name: clean, kind, minClearance: minCl, topic: topic.trim() || null, compartments };
      const { data, error } = await supabase.functions.invoke("hoa-admin", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(initial ? `#${clean} updated` : `#${clean} created`);
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border border-foreground/30 bg-black/50 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="general" maxLength={40}
            className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs outline-none focus:border-foreground/50 font-mono" />
        </div>
        <div>
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Kind</label>
          <select value={kind} onChange={e => setKind(e.target.value as Kind)}
            className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs">
            {(Object.keys(KIND_META) as Kind[]).map(k => <option key={k} value={k}>{KIND_META[k].label}</option>)}
          </select>
          <div className="text-[10px] text-muted-foreground/60 mt-1">{KIND_META[kind].blurb}</div>
        </div>
        <div>
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Min clearance</label>
          <select value={minCl} onChange={e => setMinCl(Number(e.target.value))}
            className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs">
            {CLEARANCE.map((l, i) => <option key={i} value={i}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Compartments (comma)</label>
          <input value={comps} onChange={e => setComps(e.target.value)} placeholder="NUCFLASH, SIGINT"
            className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs outline-none focus:border-foreground/50" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Topic</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What is this channel for?"
            className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs outline-none focus:border-foreground/50" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-border/30 rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1">
          <X className="h-3 w-3" /> Cancel
        </button>
        <button onClick={submit} disabled={busy || !name.trim()}
          className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 disabled:opacity-40 flex items-center gap-1">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {initial ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );
}
