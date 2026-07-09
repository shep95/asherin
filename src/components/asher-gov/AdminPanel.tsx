// AdminPanel — owner-only administration modal for a sovereign server.
// Three tabs: API Key (BYOK) · Roles & Members · Activity Log (filterable).
// Fully responsive: full-screen sheet on mobile, floating panel on desktop.

import { useEffect, useMemo, useState } from "react";
import { X, Key, Shield, ScrollText, Loader2, Trash2, Plus, Search, RefreshCw, Copy, Check, Image as ImageIcon, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HoaServer, HoaMember, HoaAudit } from "@/hooks/useHoaDeck";
import IconUploader from "./IconUploader";
import ChannelsTab from "./ChannelsTab";

interface ServerRole {
  id: string; server_id: string; name: string; color: string;
  perm_send: boolean; perm_invite: boolean; perm_manage_roles: boolean;
  perm_manage_channels: boolean; perm_view_audit: boolean; perm_manage_api_key: boolean;
}
interface MemberRole { id: string; member_id: string; role_id: string; }

const PERM_LABELS: Array<[keyof ServerRole & string, string]> = [
  ["perm_send", "Send"], ["perm_invite", "Invite"], ["perm_manage_roles", "Manage roles"],
  ["perm_manage_channels", "Manage channels"], ["perm_view_audit", "View audit"], ["perm_manage_api_key", "Manage API key"],
];

const PROVIDERS = [
  { id: "openai",    label: "OpenAI",     hint: "sk-…" },
  { id: "anthropic", label: "Anthropic",  hint: "sk-ant-…" },
  { id: "lovable",   label: "Lovable AI", hint: "lov_…" },
  { id: "gemini",    label: "Gemini",     hint: "AI…" },
];

export default function AdminPanel({
  open, onClose, server, members, refreshServers,
}: {
  open: boolean; onClose: () => void;
  server: HoaServer & { api_key_provider?: string | null; api_key_hint?: string | null; api_key_updated_at?: string | null };
  members: HoaMember[];
  refreshServers: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"identity"|"apikey"|"channels"|"roles"|"audit">("identity");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           className="w-full sm:max-w-3xl sm:h-[85vh] h-full flex flex-col rounded-none sm:rounded-xl border border-border/30 bg-black/90 overflow-hidden">
        <header className="px-5 py-3 border-b border-border/30 flex items-center gap-3 shrink-0">
          <Shield className="h-4 w-4 text-amber-400" />
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Sovereign administration</div>
            <div className="text-sm font-light truncate">{server.name} <span className="text-muted-foreground/60">· {server.code}</span></div>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex gap-1 px-3 pt-3 border-b border-border/20 overflow-x-auto shrink-0">
          {[
            { id: "identity", label: "Identity", Icon: ImageIcon },
            { id: "apikey",   label: "API Key",  Icon: Key },
            { id: "channels", label: "Channels", Icon: Hash },
            { id: "roles",    label: "Roles & Members", Icon: Shield },
            { id: "audit",    label: "Activity Log", Icon: ScrollText },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`px-3 py-2 text-[11px] tracking-widest uppercase border-b-2 transition flex items-center gap-1.5 shrink-0
                ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {tab === "identity" && <IdentityTab server={server} refreshServers={refreshServers} />}
          {tab === "apikey"   && <ApiKeyTab   server={server} refreshServers={refreshServers} />}
          {tab === "channels" && <ChannelsTab serverId={server.id} />}
          {tab === "roles"    && <RolesTab    server={server} members={members} />}
          {tab === "audit"    && <AuditTab    serverId={server.id} members={members} />}
        </div>
      </div>
    </div>
  );
}

// ─── IDENTITY TAB ─────────────────────────────────────────────────────────
function IdentityTab({ server, refreshServers }: {
  server: HoaServer & { icon_url?: string | null };
  refreshServers: () => Promise<void>;
}) {
  const persist = async (icon_url: string | null) => {
    const { error } = await supabase.from("hoa_servers").update({ icon_url }).eq("id", server.id);
    if (error) { toast.error(error.message); return; }
    toast.success(icon_url ? "Server icon updated" : "Server icon removed");
    await refreshServers();
  };
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <div className="text-xs font-light text-foreground mb-1">Server icon</div>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          Shown in the server rail and headers. Members see this whenever they see the server code. Square image works best; it renders at 40 px in the rail.
        </p>
      </div>
      <IconUploader
        kind="server" folderKey={server.id} currentUrl={server.icon_url ?? null} size={88} shape="square"
        onUploaded={(url) => persist(url)}
        onCleared={() => persist(null)}
      />
      <div className="text-[10.5px] text-muted-foreground/70 border border-border/20 rounded-md p-3 leading-relaxed">
        Only the server owner and Emperor can change this. Storage RLS blocks all other roles at the object layer, not just in the UI.
      </div>
    </div>
  );
}

// ─── API KEY TAB ──────────────────────────────────────────────────────────
function ApiKeyTab({ server, refreshServers }: {
  server: HoaServer & { api_key_provider?: string | null; api_key_hint?: string | null; api_key_updated_at?: string | null };
  refreshServers: () => Promise<void>;
}) {
  const [provider, setProvider] = useState<string>(server.api_key_provider ?? "openai");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setProvider(server.api_key_provider ?? "openai"); }, [server.api_key_provider]);

  const active = !!server.api_key_hint;

  const submit = async (action: "set_api_key"|"rotate_api_key"|"delete_api_key") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-admin", {
        body: action === "delete_api_key"
          ? { action, serverId: server.id }
          : { action, serverId: server.id, provider, apiKey: key },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(action === "delete_api_key" ? "API key revoked" : "API key stored (encrypted)");
      setKey("");
      await refreshServers();
    } catch (e) { toast.error((e as Error)?.message ?? "failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <div className="text-xs font-light text-foreground mb-1">Bring-your-own AI key</div>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          The key you set here powers every AI call for this server (Aureon chat, Zophiel search, IDE, cyber audit, forecast). It is AES-GCM encrypted with a per-instance secret and decrypted only inside sovereign edge functions — nobody, including other operators, can read it. The last 4 characters are shown for identification.
        </p>
      </div>

      <div className="rounded-md border border-border/30 bg-black/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
          <span className="text-muted-foreground">Status:</span>
          <span className="text-foreground">{active ? `Active · ${server.api_key_provider} · ****${server.api_key_hint}` : "No key configured"}</span>
          {server.api_key_updated_at && (
            <span className="ml-auto text-[10px] text-muted-foreground/60">Updated {new Date(server.api_key_updated_at).toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className={`text-left px-3 py-2 rounded-md border text-xs transition
                ${provider === p.id ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"}`}>
              <div className="font-light">{p.label}</div>
              <div className="text-[10px] text-muted-foreground/60 font-mono">{p.hint}</div>
            </button>
          ))}
        </div>

        <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}
          placeholder="Paste API key"
          className="w-full bg-black/40 border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-foreground/50 font-mono" />

        <div className="flex flex-wrap gap-2">
          <button onClick={() => submit(active ? "rotate_api_key" : "set_api_key")}
                  disabled={busy || key.length < 10}
                  className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 disabled:opacity-40 flex items-center gap-1.5">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? <RefreshCw className="h-3 w-3" /> : <Key className="h-3 w-3" />}
            {active ? "Rotate key" : "Store key"}
          </button>
          {active && (
            <button onClick={() => submit("delete_api_key")} disabled={busy}
                    className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-amber-500/40 text-amber-200 rounded-md hover:bg-amber-500/10 disabled:opacity-40 flex items-center gap-1.5">
              <Trash2 className="h-3 w-3" /> Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ROLES TAB ────────────────────────────────────────────────────────────
function RolesTab({ server, members }: { server: HoaServer; members: HoaMember[] }) {
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [assignments, setAssignments] = useState<MemberRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const serverMembers = useMemo(() => members.filter(m => m.server_id === server.id), [members, server.id]);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("hoa_server_roles").select("*").eq("server_id", server.id).order("created_at"),
      supabase.from("hoa_member_roles").select("id, member_id, role_id").eq("server_id", server.id),
    ]);
    setRoles((r ?? []) as ServerRole[]);
    setAssignments((a ?? []) as MemberRole[]);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [server.id]);

  const toggle = async (memberId: string, roleId: string, on: boolean) => {
    const { data, error } = await supabase.functions.invoke("hoa-admin", {
      body: { action: on ? "assign_role" : "unassign_role", memberId, roleId },
    });
    if (error || data?.error) { toast.error(data?.error ?? (error as Error).message); return; }
    await load();
  };
  const del = async (roleId: string) => {
    if (!confirm("Delete this role? Members lose it immediately.")) return;
    const { data, error } = await supabase.functions.invoke("hoa-admin", { body: { action: "delete_role", roleId } });
    if (error || data?.error) { toast.error(data?.error ?? (error as Error).message); return; }
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-light text-foreground">Custom roles</div>
          <p className="text-[11px] text-muted-foreground/80">Owners always have every permission. Create additional roles and assign them per member.</p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> New role
        </button>
      </div>

      {showNew && <NewRoleForm serverId={server.id} onDone={() => { setShowNew(false); void load(); }} />}

      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-6"><Loader2 className="h-3 w-3 inline animate-spin mr-1" /> loading…</div>
      ) : (
        <>
          <div className="space-y-2">
            {roles.length === 0 && <div className="text-[11px] text-muted-foreground/70 border border-dashed border-border/30 rounded-md px-3 py-4 text-center">No custom roles yet.</div>}
            {roles.map(r => (
              <div key={r.id} className="rounded-md border border-border/30 bg-black/40 px-3 py-2 flex items-center gap-3 flex-wrap">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.color }} />
                <span className="text-xs font-light text-foreground">{r.name}</span>
                <div className="flex gap-1 flex-wrap ml-2">
                  {PERM_LABELS.filter(([k]) => (r as any)[k]).map(([k, l]) => (
                    <span key={k} className="text-[9px] px-1.5 py-0.5 rounded border border-border/30 text-muted-foreground">{l}</span>
                  ))}
                </div>
                <button onClick={() => del(r.id)} className="ml-auto p-1 text-amber-300/70 hover:text-amber-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>

          {roles.length > 0 && (
            <div>
              <div className="text-xs font-light text-foreground mb-2">Assign to members</div>
              <div className="rounded-md border border-border/30 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-black/40 text-[10px] tracking-widest uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Member</th>{roles.map(r => <th key={r.id} className="px-2 py-2 text-center">{r.name}</th>)}</tr>
                  </thead>
                  <tbody>
                    {serverMembers.map(m => (
                      <tr key={m.id} className="border-t border-border/20">
                        <td className="px-3 py-1.5 text-foreground/90">{m.handle} <span className="text-muted-foreground/60 text-[10px]">· {m.role}</span></td>
                        {roles.map(r => {
                          const on = assignments.some(a => a.member_id === m.id && a.role_id === r.id);
                          return (
                            <td key={r.id} className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={on} onChange={e => void toggle(m.id, r.id, e.target.checked)} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewRoleForm({ serverId, onDone }: { serverId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#94a3b8");
  const [perms, setPerms] = useState<Record<string, boolean>>({ send: true });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-admin", {
        body: { action: "create_role", serverId, name: name.trim(), color, perms },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Role created");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border border-border/30 bg-black/40 p-3 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Role name"
          className="flex-1 min-w-[160px] bg-black/40 border border-border/30 rounded-md px-3 py-1.5 text-xs outline-none focus:border-foreground/50" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-12 h-8 rounded border border-border/30 bg-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {[["send","Send"],["invite","Invite"],["manage_roles","Manage roles"],["manage_channels","Manage channels"],["view_audit","View audit"],["manage_api_key","Manage API key"]].map(([k,l]) => (
          <label key={k} className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={!!perms[k]} onChange={e => setPerms(p => ({ ...p, [k]: e.target.checked }))} />
            {l}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy || !name.trim()} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 disabled:opacity-40">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
        </button>
      </div>
    </div>
  );
}

// ─── AUDIT TAB ────────────────────────────────────────────────────────────
function AuditTab({ serverId, members }: { serverId: string; members: HoaMember[] }) {
  const [entries, setEntries] = useState<HoaAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [q, setQ] = useState("");
  const [since, setSince] = useState<string>(""); // yyyy-mm-dd
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("hoa_audit").select("*").eq("server_id", serverId).order("created_at", { ascending: false }).limit(1000);
    if (actor !== "all") query = query.eq("actor_handle", actor);
    if (action !== "all") query = query.eq("action", action);
    if (since) query = query.gte("created_at", new Date(since).toISOString());
    const { data } = await query;
    setEntries((data ?? []) as HoaAudit[]);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [serverId, actor, action, since]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(e =>
      (e.action ?? "").toLowerCase().includes(needle) ||
      (e.target ?? "").toLowerCase().includes(needle) ||
      (e.detail ?? "").toLowerCase().includes(needle) ||
      (e.actor_handle ?? "").toLowerCase().includes(needle));
  }, [entries, q]);

  const uniqActions = useMemo(() => Array.from(new Set(entries.map(e => e.action))).sort(), [entries]);
  const serverMembers = members.filter(m => m.server_id === serverId);

  const exportCsv = async () => {
    const rows = [["time","actor","action","target","detail"], ...filtered.map(e => [
      e.created_at, e.actor_handle ?? "", e.action, e.target ?? "", (e.detail ?? "").replace(/"/g,'""'),
    ])];
    const csv = rows.map(r => r.map(f => `"${f}"`).join(",")).join("\n");
    await navigator.clipboard.writeText(csv);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select value={actor} onChange={e => setActor(e.target.value)} className="bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs">
          <option value="all">All actors</option>
          {serverMembers.map(m => <option key={m.id} value={m.handle}>{m.handle}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className="bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs">
          <option value="all">All actions</option>
          {uniqActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={since} onChange={e => setSince(e.target.value)}
          className="bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs" />
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            className="w-full bg-black/40 border border-border/30 rounded-md pl-7 pr-2 py-1.5 text-xs outline-none focus:border-foreground/50" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground/60">{filtered.length} entries {loading && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}</div>
        <button onClick={exportCsv} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-border/30 rounded hover:border-border/60 flex items-center gap-1">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} Copy CSV
        </button>
      </div>

      <div className="rounded-md border border-border/30 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-black/40 text-[10px] tracking-widest uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-t border-border/20 hover:bg-foreground/[0.03]">
                <td className="px-3 py-1.5 text-muted-foreground/80 font-mono text-[10px] whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-foreground/90">{e.actor_handle ?? "system"}</td>
                <td className="px-3 py-1.5 tracking-widest text-[10px]">{e.action}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{e.target ?? "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground/70">{e.detail ?? ""}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[11px] text-muted-foreground/60">No entries match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
