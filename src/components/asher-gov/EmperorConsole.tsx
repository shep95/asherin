// EmperorConsole — sovereign account provisioning (simplified).
//
// One-screen form. Emperor mints Presidents + citizens on any server.
// Presidents mint citizens on their own server(s) only.
// Passwords are auto-generated, shown ONCE, then wiped from memory on close/reset.

import { useEffect, useMemo, useState } from "react";
import { X, Crown, UserPlus, Copy, Check, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HoaServer } from "@/hooks/useHoaDeck";

type Role = "owner" | "operator" | "analyst" | "guest";
type Result =
  | { kind: "created"; email: string; role: Role; server: string; password: string }
  | { kind: "existed"; email: string; role: Role; server: string };

const ROLE_LABEL: Record<Role, string> = {
  owner: "President (server owner)",
  operator: "Operator",
  analyst: "Analyst",
  guest: "Guest",
};

export default function EmperorConsole({
  open, onClose, servers, activeServerId, isEmperor, myPresidentServerIds, refresh,
}: {
  open: boolean;
  onClose: () => void;
  servers: HoaServer[];
  activeServerId: string | null;
  isEmperor: boolean;
  myPresidentServerIds: string[];
  refresh: () => Promise<void>;
}) {
  const eligibleServers = useMemo(
    () => (isEmperor ? servers : servers.filter(s => myPresidentServerIds.includes(s.id))),
    [isEmperor, myPresidentServerIds, servers],
  );
  const eligibleRoles: Role[] = isEmperor
    ? ["owner", "operator", "analyst", "guest"]
    : ["operator", "analyst", "guest"];

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [serverId, setServerId] = useState(activeServerId ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServerId(activeServerId ?? eligibleServers[0]?.id ?? "");
    if (!eligibleRoles.includes(role)) setRole(eligibleRoles[0]);
  }, [open, activeServerId]); // eslint-disable-line

  // Wipe secrets when the panel closes
  useEffect(() => {
    if (!open) { setResult(null); setEmail(""); setCopied(false); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { toast.error("Enter a valid email"); return; }
    if (!serverId) { toast.error("Choose a server"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-provision-account", {
        body: { email: clean, role, server_id: serverId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const srv = servers.find(s => s.id === serverId);
      const serverName = srv?.name ?? srv?.code ?? "server";
      setResult(
        data.created
          ? { kind: "created", email: data.email, role, server: serverName, password: data.generated_password }
          : { kind: "existed", email: data.email, role, server: serverName },
      );
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Provisioning failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setResult(null); setEmail(""); setCopied(false); };

  const copyBoth = async () => {
    if (result?.kind !== "created") return;
    try {
      await navigator.clipboard.writeText(`${result.email}\n${result.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { toast.error("Copy failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-neutral-950 border border-amber-500/30 sm:rounded-lg shadow-2xl flex flex-col max-h-full"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-sm font-light tracking-widest uppercase text-foreground">Provision Account</div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                {isEmperor ? "Emperor authority" : `President · ${myPresidentServerIds.length} server(s)`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {result ? (
            /* ─── Result panel ─── */
            result.kind === "created" ? (
              <div className="space-y-4">
                <div className="text-xs text-emerald-300 tracking-widest uppercase">Account minted</div>
                <div className="text-xs text-muted-foreground">
                  Deliver these credentials <span className="text-amber-300">out-of-band</span>. They disappear when this panel closes.
                </div>
                <div className="border border-amber-500/30 bg-amber-500/5 rounded p-3 space-y-2 font-mono text-xs">
                  <div><span className="text-muted-foreground">email </span>{result.email}</div>
                  <div><span className="text-muted-foreground">pass  </span>{result.password}</div>
                  <div className="text-[10px] text-muted-foreground non-mono">
                    {ROLE_LABEL[result.role]} · {result.server}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={copyBoth}
                          className="flex-1 py-2 border border-amber-500/50 text-amber-300 rounded text-xs tracking-widest uppercase hover:bg-amber-500/10 flex items-center justify-center gap-2">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy email + password"}
                  </button>
                  <button onClick={reset}
                          className="py-2 px-4 border border-border/40 rounded text-xs tracking-widest uppercase hover:bg-foreground/10">
                    Another
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-amber-300 tracking-widest uppercase">Existing account added</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-mono">{result.email}</span> already has an account.
                  They've been granted <span className="text-amber-300">{ROLE_LABEL[result.role]}</span> on{" "}
                  <span className="text-amber-300">{result.server}</span>. No new password issued —
                  they sign in with their existing credentials.
                </div>
                <button onClick={reset}
                        className="w-full py-2 border border-amber-500/50 text-amber-300 rounded text-xs tracking-widest uppercase hover:bg-amber-500/10">
                  Provision another
                </button>
              </div>
            )
          ) : (
            /* ─── Form ─── */
            <>
              <label className="block">
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Email</span>
                <input type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="person@nation.gov"
                       className="mt-1 w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground focus:border-amber-500/50 outline-none" />
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

              <div className="block">
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Role</span>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {eligibleRoles.map(r => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                            className={`text-[11px] tracking-wide uppercase py-2 rounded border transition ${
                              role === r
                                ? "border-amber-500/60 text-amber-200 bg-amber-500/10"
                                : "border-border/30 text-muted-foreground hover:border-border/60"
                            }`}>
                      {r === "owner" ? "President" : r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground leading-relaxed border border-border/20 rounded px-3 py-2">
                A strong password will be auto-generated and shown once. Deliver it out-of-band.
              </div>

              <button onClick={submit} disabled={busy || !email || !serverId}
                      className="w-full py-3 border border-amber-500/50 text-amber-300 rounded text-xs tracking-widest uppercase hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {busy ? "Provisioning…" : "Mint account"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
