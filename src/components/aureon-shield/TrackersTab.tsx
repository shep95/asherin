import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldOff, RefreshCw } from "lucide-react";
import { getTrackerStats, resetTrackerStats, isTrackerHookActive } from "@/lib/aureonShield";

const Glass = ({ children, className = "" }: any) => (
  <div className={`rounded-2xl border border-border/35 bg-card/55 backdrop-blur-2xl shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)] ${className}`}>{children}</div>
);

export const TrackersTab = () => {
  const [stats, setStats] = useState(getTrackerStats());
  useEffect(() => {
    const h = () => setStats(getTrackerStats());
    window.addEventListener("aureon:trackers", h);
    const i = setInterval(h, 1500);
    return () => { window.removeEventListener("aureon:trackers", h); clearInterval(i); };
  }, []);

  return (
    <Glass className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><ShieldOff className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Tracker Interception Log</h2></div>
        <div className="flex items-center gap-2">
          {isTrackerHookActive() ? <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[9px] font-light">ARMED</Badge> : <Badge variant="outline" className="text-[9px] font-light">OFF — enable in Hardening</Badge>}
          <Button size="sm" variant="outline" className="border-border/40 bg-card/40" onClick={() => { resetTrackerStats(); setStats(getTrackerStats()); }}><RefreshCw className="h-3 w-3" /> Reset</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border border-border/30 bg-background/30 p-4">
          <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Blocked this session</div>
          <div className="mt-1 text-3xl font-extralight tracking-tight">{stats.count}</div>
        </div>
        <div className="rounded-xl border border-border/30 bg-background/30 p-4">
          <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Unique networks</div>
          <div className="mt-1 text-3xl font-extralight tracking-tight">{new Set(stats.hits.map((h) => h.domain)).size}</div>
        </div>
        <div className="rounded-xl border border-border/30 bg-background/30 p-4">
          <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Last hit</div>
          <div className="mt-1 text-sm font-light truncate">{stats.hits[0]?.domain || "—"}</div>
        </div>
        <div className="rounded-xl border border-border/30 bg-background/30 p-4">
          <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Estimated bandwidth saved</div>
          <div className="mt-1 text-sm font-light">{(stats.count * 4.2).toFixed(1)} KB</div>
        </div>
      </div>

      <div className="rounded-xl border border-border/30 bg-background/30 overflow-hidden">
        <div className="px-4 py-2 border-b border-border/30 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Recent intercepts</div>
        <div className="max-h-80 overflow-y-auto">
          {stats.hits.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground text-center">No trackers intercepted yet. Browse to a news site to see them light up.</div>
          ) : stats.hits.map((h, i) => (
            <div key={i} className="px-4 py-2 border-b border-border/20 flex items-center gap-3 text-[11px]">
              <span className="font-mono text-red-400 w-2 shrink-0">×</span>
              <span className="text-foreground/80 w-40 shrink-0 truncate">{h.domain}</span>
              <span className="font-mono text-muted-foreground truncate flex-1">{h.url}</span>
              <span className="text-muted-foreground/60 shrink-0">{new Date(h.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Glass>
  );
};
