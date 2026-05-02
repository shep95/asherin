import { useMemo, useState } from "react";
import { Calendar, Heart, Crown, Flame, DollarSign, Sparkles, GraduationCap, Plane, Skull, TrendingUp, TrendingDown, Briefcase, Baby, Star } from "lucide-react";
import { buildLifeTimeline, type LifeEvent, type EventCategory, type LifePhase } from "@/lib/vedic/lifeTimeline";
import type { SweVedicChart } from "@/lib/vedic/sweChart";

const CAT_ICON: Record<EventCategory, any> = {
  wealth: DollarSign, career: Briefcase, love: Heart, marriage: Heart,
  education: GraduationCap, health: TrendingDown, spiritual: Sparkles,
  travel: Plane, loss: Skull, power: Crown, milestone: Star, crisis: TrendingDown,
};

const FLAG_ICON = {
  soulmate: Heart, millionaire: DollarSign, billionaire: Crown, power_peak: Flame,
};

const PHASE_LABEL: Record<LifePhase, string> = {
  infancy: "Infancy", childhood: "Childhood", adolescence: "Adolescence",
  young_adult: "Young Adult", adult: "Adult", midlife: "Midlife", elder: "Elder",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

interface Props {
  chart: SweVedicChart;
  birthDate: string;   // "YYYY-MM-DD"
  birthTime: string;   // "HH:mm"
  tzOffset: number;
}

type FilterEra = "all" | "past" | "future";

export default function LifeTimelinePanel({ chart, birthDate, birthTime, tzOffset }: Props) {
  const [filter, setFilter] = useState<FilterEra>("all");
  const [catFilter, setCatFilter] = useState<EventCategory | "all">("all");

  const birth = useMemo(() => {
    const [y, mo, d] = birthDate.split("-").map(Number);
    const [h, mi] = birthTime.split(":").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - tzOffset * 3_600_000);
  }, [birthDate, birthTime, tzOffset]);

  const timeline = useMemo(() => buildLifeTimeline(chart, birth, { pastYears: 80, futureYears: 60, maxEvents: 100 }), [chart, birth]);

  const filtered = useMemo(() => {
    let arr = timeline.events;
    if (filter !== "all") arr = arr.filter((e) => e.era === filter);
    if (catFilter !== "all") arr = arr.filter((e) => e.category === catFilter);
    return arr;
  }, [timeline.events, filter, catFilter]);

  // group by phase for past, by year for future
  const pastByPhase = useMemo(() => {
    const map = new Map<LifePhase, LifeEvent[]>();
    for (const e of filtered.filter((x) => x.era === "past")) {
      const arr = map.get(e.phase) ?? [];
      arr.push(e);
      map.set(e.phase, arr);
    }
    return map;
  }, [filtered]);

  const future = useMemo(() => filtered.filter((e) => e.era === "future"), [filtered]);

  const counts = useMemo(() => ({
    soulmate: timeline.events.filter((e) => e.flags.includes("soulmate")).length,
    millionaire: timeline.events.filter((e) => e.flags.includes("millionaire")).length,
    billionaire: timeline.events.filter((e) => e.flags.includes("billionaire")).length,
    power: timeline.events.filter((e) => e.flags.includes("power_peak")).length,
  }), [timeline.events]);

  return (
    <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border/15 pb-3">
        <Calendar className="h-4 w-4 text-foreground/70" />
        <h3 className="text-sm font-light tracking-[0.15em] text-foreground uppercase">Life Timeline · Personal Predictions</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70 italic">
          Deterministic · Vimshottari math · No AI
        </span>
      </div>

      {/* SUMMARY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { k: "soulmate", n: counts.soulmate, label: "Soulmate Windows", Icon: FLAG_ICON.soulmate },
          { k: "millionaire", n: counts.millionaire, label: "Millionaire Windows", Icon: FLAG_ICON.millionaire },
          { k: "billionaire", n: counts.billionaire, label: "Billionaire Windows", Icon: FLAG_ICON.billionaire },
          { k: "power", n: counts.power, label: "Power Peaks", Icon: FLAG_ICON.power_peak },
        ].map(({ k, n, label, Icon }) => (
          <div key={k} className="rounded-lg border border-border/25 bg-background/30 p-3 flex items-center gap-3">
            <Icon className="h-4 w-4 text-foreground/70" />
            <div>
              <div className="text-2xl font-extralight text-foreground tabular-nums leading-none">{n}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border/25 overflow-hidden">
          {(["all", "past", "future"] as FilterEra[]).map((e) => (
            <button key={e} onClick={() => setFilter(e)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border-r border-border/20 last:border-r-0 ${filter === e ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {e}
            </button>
          ))}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as any)}
          className="rounded-md border border-border/25 bg-background/40 px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-foreground/40">
          <option value="all">All Categories</option>
          <option value="wealth">Wealth</option>
          <option value="career">Career</option>
          <option value="love">Love</option>
          <option value="marriage">Marriage</option>
          <option value="education">Education</option>
          <option value="health">Health</option>
          <option value="spiritual">Spiritual</option>
          <option value="travel">Travel</option>
          <option value="power">Power</option>
          <option value="milestone">Milestone</option>
          <option value="crisis">Crisis</option>
        </select>
        <span className="ml-auto text-[10px] text-muted-foreground/70 tabular-nums">
          {filtered.length} of {timeline.events.length} events
        </span>
      </div>

      {/* PAST — grouped by life phase */}
      {(filter === "all" || filter === "past") && pastByPhase.size > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-2">
            <Baby className="h-3.5 w-3.5" /> Past · By Life Phase
          </div>
          {(["infancy", "childhood", "adolescence", "young_adult", "adult", "midlife", "elder"] as LifePhase[])
            .filter((p) => pastByPhase.has(p))
            .map((p) => (
              <div key={p} className="rounded-lg border border-border/20 bg-background/25 p-3">
                <div className="text-[11px] uppercase tracking-wider text-foreground/85 mb-2 font-light">{PHASE_LABEL[p]}</div>
                <div className="space-y-1.5">
                  {pastByPhase.get(p)!.map((e, i) => <EventRow key={i} ev={e} />)}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* FUTURE — chronological */}
      {(filter === "all" || filter === "future") && future.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" /> Future · Chronological
          </div>
          <div className="space-y-1.5">
            {future.map((e, i) => <EventRow key={i} ev={e} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-xs text-muted-foreground/70 italic">No events match these filters.</div>
      )}
    </div>
  );
}

function EventRow({ ev }: { ev: LifeEvent }) {
  const Icon = CAT_ICON[ev.category];
  return (
    <div className="rounded border border-border/20 bg-background/30 p-2.5 flex gap-3">
      <div className="flex flex-col items-center min-w-[68px] pt-0.5 border-r border-border/15 pr-3">
        <Icon className="h-3.5 w-3.5 text-foreground/70 mb-1" />
        <div className="text-[10px] tabular-nums text-foreground/85 leading-tight">{fmtDate(ev.date)}</div>
        <div className="text-[9px] text-muted-foreground/70 mt-0.5">age {ev.ageYears.toFixed(0)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-foreground font-light">{ev.title}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{ev.category}</span>
          {ev.flags.map((f) => {
            const FI = FLAG_ICON[f];
            return <FI key={f} className="h-3 w-3 text-foreground/85" />;
          })}
          <span className="ml-auto text-[10px] tabular-nums text-foreground/70">{ev.intensity}</span>
        </div>
        <div className="text-[11px] text-muted-foreground/85 mt-0.5 leading-snug">{ev.description}</div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/55 mt-1 italic">
          {ev.dashaChain} · {fmtDate(ev.start)} → {fmtDate(ev.end)}
        </div>
        <div className="mt-1 h-0.5 rounded bg-foreground/10 overflow-hidden">
          <div className="h-full bg-foreground/55" style={{ width: `${ev.intensity}%` }} />
        </div>
      </div>
    </div>
  );
}
