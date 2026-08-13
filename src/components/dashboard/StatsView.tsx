import { useState, useEffect } from "react";
import { BarChart3, Clock, Zap, TrendingUp, MessageSquare, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsV2 } from "@/lib/dashboardUiContext";

const StatsView = () => {
  const v2 = useIsV2();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // maybeSingle(): a brand-new account has no usage_stats row yet, and
    // single() answers zero rows with HTTP 406 — an error the UI then renders
    // as a broken tab instead of an honest "no activity yet" zero state.
    supabase.from("usage_stats").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setStats(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user]);


  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const s = stats ?? {};
  const total = s.total_prompts ?? 0;
  const research = s.research_prompts ?? 0;
  const code = s.code_prompts ?? 0;
  const truth = s.truth_prompts ?? 0;
  const chat = s.chat_prompts ?? 0;
  const streak = s.streak_days ?? 0;
  const timeSaved = Math.round(total * 1.5); // ~1.5 min per prompt

  const statCards = [
    { label: "Prompts This Month", value: String(total), icon: MessageSquare, change: "" },
    { label: "Time Saved", value: `${timeSaved}m`, icon: Clock, change: `~$${Math.round(timeSaved * 0.83)} value` },
    { label: "Current Streak", value: `${streak} days`, icon: Zap, change: "" },
    { label: "Total Messages", value: String(total), icon: Star, change: "" },
  ];

  const topModes = [
    { name: "Research", pct: total > 0 ? Math.round((research / total) * 100) : 0 },
    { name: "Code", pct: total > 0 ? Math.round((code / total) * 100) : 0 },
    { name: "Truth", pct: total > 0 ? Math.round((truth / total) * 100) : 0 },
    { name: "Chat", pct: total > 0 ? Math.round((chat / total) * 100) : 0 },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
      {!v2 && (
        <div>
          <h2 className="text-xl font-extralight tracking-wide text-foreground">Your asherin stats</h2>
          <p className="text-sm font-extralight text-muted-foreground mt-1">Your own usage. Nothing is benchmarked against anyone.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((sc) => (
          <div key={sc.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <sc.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">{sc.label}</span>
            </div>
            <p className="text-2xl font-extralight text-foreground">{sc.value}</p>
            {sc.change && <p className="text-[10px] text-muted-foreground/60 mt-1">{sc.change}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">Mode Usage</span>
        </div>
        <div className="space-y-2">
          {topModes.map((m) => (
            <div key={m.name} className="flex items-center gap-2">
              <span className="text-xs font-light text-muted-foreground w-16">{m.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-border/30">
                <div className="h-full rounded-full bg-foreground/30" style={{ width: `${m.pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground/60 w-8 text-right">{m.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
};

export default StatsView;
