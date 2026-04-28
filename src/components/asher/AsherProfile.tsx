// AsherProfile — operator profile, clearance, session info, and recent activity.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Shield, Clock, Crosshair, Activity, Loader2 } from "lucide-react";

interface Stats {
  audit_count: number;
  saved_count: number;
  last_activity: string | null;
  failed_attempts_24h: number;
}

const AsherProfile = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ audit_count: 0, saved_count: 0, last_activity: null, failed_attempts_24h: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [audit, saved, last, failed] = await Promise.all([
        supabase.from("asher_audit_log").select("id", { count: "exact", head: true }),
        supabase.from("asher_saved_targets").select("id", { count: "exact", head: true }),
        supabase.from("asher_audit_log").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("asher_audit_log").select("id", { count: "exact", head: true }).eq("event_type", "passcode_failure").gte("created_at", since),
      ]);
      setStats({
        audit_count: audit.count ?? 0,
        saved_count: saved.count ?? 0,
        last_activity: last.data?.created_at ?? null,
        failed_attempts_24h: failed.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  // Mask email
  const maskEmail = (e?: string | null) => {
    if (!e) return "—";
    const [u, d] = e.split("@");
    if (!d) return "—";
    return `${u.slice(0, 2)}${"•".repeat(Math.max(2, u.length - 2))}@${d}`;
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase mb-2">Asher Module</p>
        <h2 className="text-3xl font-extralight tracking-wide text-foreground flex items-center gap-3 mb-6">
          <User className="h-6 w-6" strokeWidth={1.25} />
          Operator Profile
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card label="Identity" value={maskEmail(user?.email)} sub="Authenticated · session active" icon={User} />
          <Card label="Clearance Level" value="ASHER · LEVEL II" sub="Defense Intelligence · gated" icon={Shield} />
          <Card label="Session Started" value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"} sub="Auto-locks after 15m idle" icon={Clock} />
          <Card label="Last Activity" value={loading ? "…" : stats.last_activity ? new Date(stats.last_activity).toLocaleString() : "—"} sub="From audit vault" icon={Activity} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Stat label="Audit Events" value={stats.audit_count} loading={loading} />
          <Stat label="Saved Targets" value={stats.saved_count} loading={loading} />
          <Stat label="Failed Attempts (24h)" value={stats.failed_attempts_24h} loading={loading}
            tone={stats.failed_attempts_24h > 0 ? "warn" : "ok"} />
        </div>

        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5">
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-3">Operator Doctrine</p>
          <ul className="text-xs font-light text-muted-foreground/85 space-y-1.5 leading-relaxed">
            <li>• All map queries, target saves, and module accesses are written to your private audit vault.</li>
            <li>• Sessions auto-lock after <span className="text-foreground">15 minutes</span> of inactivity; clearance code re-entry required.</li>
            <li>• Saved targets are RLS-isolated to your account; only you and the system administrator can read them.</li>
            <li>• Outbound files and uploads are stripped of EXIF/GPS/XMP metadata before transit.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const Card = ({ label, value, sub, icon: Icon }: any) => (
  <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-4">
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase">{label}</p>
        <p className="text-sm font-light text-foreground mt-1 truncate">{value}</p>
        {sub && <p className="text-[10px] tracking-wide text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

const Stat = ({ label, value, loading, tone = "ok" }: { label: string; value: number; loading: boolean; tone?: "ok" | "warn" }) => (
  <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-4">
    <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase">{label}</p>
    {loading ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
    ) : (
      <p className={`text-2xl font-extralight tabular-nums mt-1 ${tone === "warn" ? "text-amber-400" : "text-foreground"}`}>{value}</p>
    )}
  </div>
);

export default AsherProfile;
