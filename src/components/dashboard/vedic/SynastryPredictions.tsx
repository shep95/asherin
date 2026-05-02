import { useEffect, useMemo, useState } from "react";
import { Heart, Flame, Swords, Plane, DollarSign, AlertTriangle, Handshake, Sparkles, Loader2 } from "lucide-react";
import { buildSynastryTimeline, type SynastryEvent, type SynastryCategory } from "@/lib/vedic/synastry";
import type { SweVedicChart } from "@/lib/vedic/sweChart";

const CAT_ICON: Record<SynastryCategory, any> = {
  harmony: Handshake, passion: Flame, conflict: Swords, growth: Sparkles,
  separation: AlertTriangle, commitment: Heart, travel_together: Plane,
  wealth_together: DollarSign, trial: AlertTriangle,
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

interface Props {
  chartA: SweVedicChart;
  chartB: SweVedicChart;
  labelA: string;
  labelB: string;
}

type EraFilter = "all" | "past" | "future";

export default function SynastryPredictions({ chartA, chartB, labelA, labelB }: Props) {
  const [era, setEra] = useState<EraFilter>("all");
  const [computing, setComputing] = useState(true);
  const [events, setEvents] = useState<SynastryEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    setComputing(true);
    // Defer to next tick so the heavier compute doesn't block the panel render.
    const id = window.setTimeout(() => {
      const ev = buildSynastryTimeline(chartA, chartB, { pastYears: 30, futureYears: 30, maxEvents: 60 });
      if (!cancelled) {
        setEvents(ev);
        setComputing(false);
      }
    }, 30);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [chartA, chartB]);

  const filtered = useMemo(() => era === "all" ? events : events.filter((e) => e.era === era), [events, era]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [events]);

  return (
    <div className="rounded-xl border border-border/25 bg-background/40 backdrop-blur-xl p-4 space-y-3 mt-3">
      <div className="flex items-center gap-2 border-b border-border/15 pb-2">
        <Heart className="h-3.5 w-3.5 text-foreground/70" />
        <h4 className="text-xs font-light tracking-[0.15em] text-foreground uppercase">Relationship Predictions Timeline</h4>
        <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground/70 italic">Deterministic · No AI</span>
      </div>

      <div className="text-[10px] text-muted-foreground/85">
        <span className="text-foreground/85">{labelA}</span> ↔ <span className="text-foreground/85">{labelB}</span>
      </div>

      {computing ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing dasha-chain interactions…
        </div>
      ) : (
        <>
          {/* Category counts */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(counts).map(([k, n]) => {
              const Icon = CAT_ICON[k as SynastryCategory] ?? Sparkles;
              return (
                <div key={k} className="flex items-center gap-1 rounded border border-border/20 bg-background/25 px-2 py-1 text-[10px]">
                  <Icon className="h-3 w-3 text-foreground/65" />
                  <span className="text-foreground/85 capitalize">{k.replace("_", " ")}</span>
                  <span className="text-muted-foreground/70 tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>

          {/* Era filter */}
          <div className="flex rounded-md border border-border/25 overflow-hidden w-fit">
            {(["all", "past", "future"] as EraFilter[]).map((e) => (
              <button key={e} onClick={() => setEra(e)}
                className={`px-3 py-1 text-[10px] uppercase tracking-wider border-r border-border/20 last:border-r-0 ${era === e ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {e}
              </button>
            ))}
            <span className="px-3 py-1 text-[10px] text-muted-foreground/70 tabular-nums">{filtered.length} events</span>
          </div>

          {/* Events */}
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((e, i) => {
              const Icon = CAT_ICON[e.category];
              return (
                <div key={i} className="rounded border border-border/20 bg-background/25 p-2.5 flex gap-3">
                  <div className="flex flex-col items-center min-w-[68px] pt-0.5 border-r border-border/15 pr-3">
                    <Icon className="h-3.5 w-3.5 text-foreground/70 mb-1" />
                    <div className="text-[10px] tabular-nums text-foreground/85">{fmtDate(e.date)}</div>
                    <div className={`text-[9px] uppercase tracking-wider mt-0.5 ${e.era === "past" ? "text-muted-foreground/60" : "text-foreground/70"}`}>{e.era}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] text-foreground font-light">{e.title}</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{e.category.replace("_", " ")}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-foreground/70">{e.intensity}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground/85 mt-0.5 leading-snug">{e.description}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/55 mt-1 italic truncate">
                      {labelA}: {e.chainA} · {labelB}: {e.chainB}
                    </div>
                    <div className="mt-1 h-0.5 rounded bg-foreground/10 overflow-hidden">
                      <div className="h-full bg-foreground/55" style={{ width: `${e.intensity}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground/70 italic py-2">No events in this window.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
