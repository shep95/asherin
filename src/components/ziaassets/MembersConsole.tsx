import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Crown, UserCheck, UserX, Shield } from "lucide-react";
import { isOwnerEmail } from "@/lib/adminEmail";

const RANKS = ["emperor", "hand", "admin", "officer", "researcher", "worker", "initiate"] as const;
const STATUSES = ["active", "pending", "suspended", "revoked"] as const;

interface Row {
  id: string; user_id: string; codename: string; full_name: string | null;
  rank: typeof RANKS[number]; status: typeof STATUSES[number]; last_seen_at: string | null;
  created_at: string; mfa_enrolled: boolean;
}

export default function MembersConsole() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isEmperor = isOwnerEmail(user?.email);

  const load = async () => {
    const { data } = await supabase.from("ziaassets_members")
      .select("id, user_id, codename, full_name, rank, status, last_seen_at, created_at, mfa_enrolled")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  const setRank = async (r: Row, rank: string) => {
    setBusyId(r.id);
    const { error } = await supabase.from("ziaassets_members")
      .update({ rank: rank as Row["rank"] }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(`${r.codename} → ${rank}`); await load(); }
    setBusyId(null);
  };
  const setStatus = async (r: Row, status: string) => {
    setBusyId(r.id);
    const { error } = await supabase.from("ziaassets_members")
      .update({ status: status as Row["status"] }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(`${r.codename} → ${status}`); await load(); }
    setBusyId(null);
  };

  if (!isEmperor) {
    return (
      <Card className="p-6 bg-background/40 backdrop-blur border-white/10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>Only the Emperor may govern membership.</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-background/40 backdrop-blur border-white/10 flex items-center gap-2">
        <Crown className="w-5 h-5" />
        <div>
          <div className="font-semibold">Sovereign Roster</div>
          <div className="text-xs text-muted-foreground">Promote, demote, activate, suspend, or revoke members. All actions audited.</div>
        </div>
      </Card>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_140px_140px_120px_auto] gap-2 items-center p-3 rounded-md border border-white/10 bg-background/40">
            <div>
              <div className="font-mono text-sm">{r.codename} {r.mfa_enrolled && <Badge variant="outline" className="ml-1 text-[10px]">MFA</Badge>}</div>
              <div className="text-[11px] text-muted-foreground">{r.full_name || "—"} · joined {new Date(r.created_at).toLocaleDateString()} · last seen {r.last_seen_at ? new Date(r.last_seen_at).toLocaleString() : "never"}</div>
            </div>
            <Select value={r.rank} onValueChange={(v) => setRank(r, v)} disabled={busyId === r.id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANKS.map((rk) => <SelectItem key={rk} value={rk}>{rk}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={r.status} onValueChange={(v) => setStatus(r, v)} disabled={busyId === r.id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              {r.status === "active" ? <UserCheck className="w-4 h-4 text-emerald-500" /> : <UserX className="w-4 h-4 text-amber-500" />}
              <span className="text-xs">{r.status}</span>
            </div>
            <div className="flex gap-1">
              {r.status !== "active" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(r, "active")}>Activate</Button>
              )}
              {r.status === "active" && r.rank !== "emperor" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(r, "suspended")}>Suspend</Button>
              )}
            </div>
          </div>
        ))}
        {!rows.length && <div className="text-xs text-muted-foreground">No members yet.</div>}
      </div>
    </div>
  );
}
