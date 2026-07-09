// EmperorConsole — sovereign account provisioning for asherin.gov.
//
// Emperor (ashernewtonx@gmail.com / hoa_is_houseofasher) can mint:
//   • Presidents (owner)  → any server
//   • Citizens (operator|analyst|guest) → any server
//
// Presidents (server owners) can mint citizens for THEIR server only.
// Server-side edge function (hoa-provision-account) enforces both.
// This UI is gated so it only renders for authority holders.
//
// Responsive: full-screen sheet on mobile, floating panel on desktop.

import { useEffect, useMemo, useState } from "react";
import { X, Crown, UserPlus, Copy, Check, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HoaServer } from "@/hooks/useHoaDeck";

interface Provisioned {
  email: string; role: string; server: string;
  password?: string; created: boolean; at: number;
}

export default function EmperorConsole({
  open, onClose, servers, activeServerId, isEmperor, myPresidentServerIds, refresh,
}: {
  open: boolean;
  onClose: () => void;
  servers: HoaServer[];
  activeServerId: string | null;
  isEmperor: boolean;
  myPresidentServerIds: string[];   // servers where caller is owner (not emperor)
  refresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"owner"|"operator"|"analyst"|"guest">("operator");
  const [serverId, setServerId] = useState<string>(activeServerId ?? "");
  const [customPw, setCustomPw] = useState("");
  const [autoPw, setAutoPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Provisioned[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { if (open) setServerId(activeServerId ?? servers[0]?.id ?? ""); }, [open, activeServerId, servers]);

  // Which servers can this user provision to?
  const eligibleServers = useMemo(
    () => isEmperor ? servers : servers.filter(s => myPresidentServerIds.includes(s.id)),
    [isEmperor, myPresidentServerIds, servers],
  );

  // Non-emperors cannot mint owners
  const eligibleRoles = isEmperor
    ? (["owner","operator","analyst","guest"] as const)
    : (["operator","analyst","guest"] as const);

  useEffect(() => {
    if (!eligibleRoles.includes(role as any)) setRole(eligibleRoles[0]);
  }, [isEmperor]); // eslint-disable-line

  if (!open) return null;

  const submit = async () => {
    if (!email.trim() || !serverId) { toast.error("Email and server required"); return; }
    if (!autoPw && customPw.length < 12) { toast.error("Password must be ≥12 chars"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-provision-account", {
        body: {
          email: email.trim().toLowerCase(),
          handle: handle.trim() || undefined,
          role, server_id: serverId,
          password: autoPw ? undefined : customPw,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const srv = servers.find(s => s.id === serverId);
      const entry: Provisioned = {
        email: data.email, role, server: srv?.name ?? srv?.code ?? "?",
        password: data.generated_password, created: data.created, at: Date.now(),
      };
      setHistory(h => [entry, ...h].slice(0, 20));
      toast.success(data.created ? `Account minted for ${data.email}` : `${data.email} added to ${entry.server}`);
      setEmail(""); setHandle(""); setCustomPw("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "provisioning failed");
    } finally { setBusy(false); }
  };

  const copyPw = async (pw: string, key: string) => {
    try { await navigator.clipboard.writeText(pw); setCopied(key); setTimeout(() => setCopied(null), 1400); }
    catch { toast.error("copy failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-2xl bg-neutral-950 border border-amber-500/30 sm:rounded-lg shadow-2xl flex flex-col max-h-full"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-sm font-light tracking-widest uppercase text-foreground">
                {isEmperor ? "Emperor Console" : "President Console"}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
                Sovereign account provisioning
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Authority banner */}
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground border border-border/20 rounded px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
            <div>
              {isEmperor
                ? <>You hold Emperor authority. You may mint Presidents on any server and citizens anywhere.</>
                : <>You hold President authority on {myPresidentServerIds.length} server(s). You may mint citizens on those only.</>}
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Email</span>
              <input type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="president@nation.gov"
                     className="mt-1 w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground focus:border-amber-500/50 outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Handle (optional)</span>
              <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="auto from email"
                     className="mt-1 w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground focus:border-amber-500/50 outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Role</span>
              <select value={role} onChange={e => setRole(e.target.value as any)}
                      className="mt-1 w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground focus:border-amber-500/50 outline-none">
                {eligibleRoles.map(r => (
                  <option key={r} value={r}>{r === "owner" ? "President (owner)" : r}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Server</span>
              <select value={serverId} onChange={e => setServerId(e.target.value)}
                      className="mt-1 w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground focus:border-amber-500/50 outline-none">
                <option value="">— select —</option>
                {eligibleServers.map(s => (
                  <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Password */}
          <div className="border border-border/20 rounded p-3 space-y-2">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={autoPw} onChange={e => setAutoPw(e.target.checked)} className="accent-amber-500" />
              Auto-generate strong password (shown once, then destroyed)
            </label>
            {!autoPw && (
              <input type="text" value={customPw} onChange={e => setCustomPw(e.target.value)}
                     placeholder="min 12 chars"
                     className="w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground font-mono focus:border-amber-500/50 outline-none" />
            )}
          </div>

          <button onClick={submit} disabled={busy || !email || !serverId}
                  className="w-full py-3 border border-amber-500/50 text-amber-300 rounded text-xs tracking-widest uppercase hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {busy ? "Provisioning…" : "Mint account"}
          </button>

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Recent provisions</span>
                <button onClick={() => setHistory([])} className="text-[9px] text-muted-foreground hover:text-foreground uppercase tracking-widest">
                  <RefreshCw className="h-3 w-3 inline mr-1" />Clear
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="border border-border/20 rounded p-3 text-xs space-y-1 bg-black/30">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-foreground font-mono truncate">{h.email}</span>
                      <span className="text-[9px] uppercase tracking-widest text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                        {h.role === "owner" ? "President" : h.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {h.created ? "New account" : "Existing account added"} · {h.server}
                    </div>
                    {h.password && (
                      <div className="flex items-center gap-2 mt-1 bg-amber-500/5 border border-amber-500/30 rounded px-2 py-1.5">
                        <code className="text-[10px] text-amber-200 font-mono flex-1 truncate">{h.password}</code>
                        <button onClick={() => copyPw(h.password!, `${i}`)} className="text-amber-300 hover:text-amber-100 shrink-0">
                          {copied === `${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground italic">
                Passwords disappear when this panel closes. Deliver them out-of-band immediately.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
