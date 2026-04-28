import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";

interface AuditRow {
  id: string;
  event_type: string;
  detail: Record<string, any>;
  user_agent: string | null;
  created_at: string;
}

const eventColor = (e: string): string => {
  if (e.includes("failure")) return "text-red-400";
  if (e.includes("locked")) return "text-amber-400";
  if (e.includes("success") || e.includes("unlocked")) return "text-emerald-400";
  return "text-foreground/80";
};

const AsherAuditVault = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("asher_audit_log")
      .select("id,event_type,detail,user_agent,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setRows(data as unknown as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase mb-2">Asher Module</p>
            <h2 className="text-3xl font-extralight tracking-wide text-foreground flex items-center gap-3">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.25} />
              Audit Vault
            </h2>
            <p className="text-xs font-light text-muted-foreground/70 mt-2">
              Immutable chain-of-custody log of all operator actions in this Asher session.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/60 px-3 py-2 text-[11px] font-light tracking-wide text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-xs font-light tracking-wide">Loading audit log…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-10 text-center text-muted-foreground/60 text-sm font-light">
            No audit events recorded yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
            <table className="w-full text-xs font-light">
              <thead className="border-b border-border/20 bg-background/40">
                <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  <th className="px-4 py-3">Timestamp (UTC)</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/10 hover:bg-foreground/[0.02]">
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}</td>
                    <td className={`px-4 py-2.5 tracking-wide ${eventColor(r.event_type)}`}>{r.event_type}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70 font-mono text-[10px] truncate max-w-md">
                      {Object.keys(r.detail || {}).length ? JSON.stringify(r.detail) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[9px] font-light tracking-[0.25em] text-muted-foreground/40 uppercase text-center">
          Records are RLS-protected · only you and the system administrator can view your log
        </p>
      </div>
    </div>
  );
};

export default AsherAuditVault;
