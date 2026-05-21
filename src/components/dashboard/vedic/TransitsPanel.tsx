import { useEffect, useMemo, useState } from "react";
import { Loader2, Orbit, ArrowRight, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { computeTransitChart, computeFutureIngresses, type TransitChart, type SignIngress } from "@/lib/vedic/transits";
import { readTransit, type LifePrediction, type Verdict } from "@/lib/vedic/transitMeanings";

interface Props {
  natalAscendant: number;
  lat: number;
  lon: number;
  chartKey: string | null;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}
function fmtDeg(deg: number) {
  const dInt = Math.floor(deg);
  const m = Math.floor((deg - dInt) * 60);
  return `${dInt}°${m.toString().padStart(2, "0")}'`;
}
function monthLabel(d: Date) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
function midOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 15, 12, 0);
}
function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0); }
function monthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59); }

const WEIGHT_RING: Record<"high" | "medium" | "low", string> = {
  high: "border-amber-400/50 bg-amber-400/[0.04]",
  medium: "border-border/30 bg-background/30",
  low: "border-border/20 bg-background/20",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  "yes-strong": "text-emerald-300 border-emerald-400/40 bg-emerald-400/[0.06]",
  "yes":        "text-emerald-200/90 border-emerald-300/30 bg-emerald-300/[0.04]",
  "possible":   "text-amber-200/90 border-amber-300/30 bg-amber-300/[0.04]",
  "delayed":    "text-orange-300/90 border-orange-400/30 bg-orange-400/[0.04]",
  "unlikely":   "text-red-300/90 border-red-400/30 bg-red-400/[0.04]",
};
const VERDICT_RANK: Record<Verdict, number> = { "yes-strong": 5, "yes": 4, "possible": 3, "delayed": 2, "unlikely": 1 };

const TransitsPanel = ({ natalAscendant, lat, lon, chartKey }: Props) => {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(() => midOfMonth(new Date()));
  const [transit, setTransit] = useState<TransitChart | null>(null);
  const [loadingNow, setLoadingNow] = useState(false);
  const [ingresses, setIngresses] = useState<SignIngress[] | null>(null);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [horizonMonths, setHorizonMonths] = useState<3 | 12 | 24>(12);

  const chosen = useMemo(() => midOfMonth(cursor), [cursor]);
  const isCurrentMonth = chosen.getFullYear() === today.getFullYear() && chosen.getMonth() === today.getMonth();

  // Transit chart for the chosen month
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingNow(true);
      try {
        const t = await computeTransitChart(chosen, natalAscendant, lat, lon);
        if (!cancelled) setTransit(t);
      } finally {
        if (!cancelled) setLoadingNow(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chosen, natalAscendant, lat, lon, chartKey]);

  // Future ingresses anchored at the chosen month start
  useEffect(() => {
    let cancelled = false;
    setIngresses(null);
    (async () => {
      setLoadingFuture(true);
      try {
        const list = await computeFutureIngresses(natalAscendant, lat, lon, {
          from: monthStart(chosen),
          horizonDays: horizonMonths * 31,
          perPlanetLimit: horizonMonths >= 12 ? 6 : 3,
        });
        if (!cancelled) setIngresses(list);
      } finally {
        if (!cancelled) setLoadingFuture(false);
      }
    })();
    return () => { cancelled = true; };
  }, [natalAscendant, lat, lon, chartKey, horizonMonths, chosen]);

  const readings = useMemo(() => {
    if (!transit) return [];
    return transit.planets.map((p) => ({ planet: p, reading: readTransit(p.name, p.natalHouse, p.retrograde) }));
  }, [transit]);

  // Aggregate: best verdict per life-question across all transits this month
  const monthForecast = useMemo(() => {
    const byQ = new Map<string, LifePrediction>();
    for (const r of readings) {
      for (const pred of r.reading.predictions) {
        const existing = byQ.get(pred.question);
        if (!existing || VERDICT_RANK[pred.verdict] > VERDICT_RANK[existing.verdict]) {
          byQ.set(pred.question, pred);
        }
      }
    }
    return Array.from(byQ.values());
  }, [readings]);

  const ingressesThisMonth = useMemo(() => {
    if (!ingresses) return [];
    const s = monthStart(chosen).getTime();
    const e = monthEnd(chosen).getTime();
    return ingresses.filter((i) => i.date.getTime() >= s && i.date.getTime() <= e);
  }, [ingresses, chosen]);
  const ingressesLater = useMemo(() => {
    if (!ingresses) return [];
    const e = monthEnd(chosen).getTime();
    return ingresses.filter((i) => i.date.getTime() > e);
  }, [ingresses, chosen]);

  const shiftMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 15));
  const shiftYear  = (delta: number) => setCursor(new Date(cursor.getFullYear() + delta, cursor.getMonth(), 15));

  return (
    <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 space-y-4">
      {/* Header + Month navigation */}
      <div className="flex items-center justify-between gap-3 border-b border-border/15 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Orbit className="h-4 w-4 text-foreground/70" />
          <h3 className="text-sm font-light tracking-[0.15em] text-foreground uppercase">Monthly Transit Forecast</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftYear(-1)} title="Previous year" className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => shiftMonth(-1)} title="Previous month" className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="px-3 py-1 rounded border border-foreground/30 bg-foreground/[0.05] min-w-[10rem] text-center">
            <div className="text-xs font-light tracking-[0.15em] text-foreground uppercase">{monthLabel(cursor)}</div>
            {isCurrentMonth && <div className="text-[9px] uppercase tracking-[0.2em] text-emerald-300/80">This Month</div>}
          </div>
          <button onClick={() => shiftMonth(1)} title="Next month" className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => shiftYear(1)} title="Next year" className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCursor(midOfMonth(new Date()))}
            className="ml-2 text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded border border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition"
          >
            Now
          </button>
        </div>
      </div>

      {/* Month forecast — specific life questions */}
      <div className="rounded-lg border border-border/25 bg-gradient-to-b from-foreground/[0.04] to-transparent p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
          <h4 className="text-xs font-light tracking-[0.15em] text-foreground uppercase">Forecast for {monthLabel(cursor)}</h4>
        </div>
        {loadingNow && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the sky…</div>
        )}
        {!loadingNow && monthForecast.length === 0 && (
          <div className="text-[11px] text-muted-foreground/60 italic">No major life-area activations this month. Background period — steady, integrative.</div>
        )}
        {!loadingNow && monthForecast.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {monthForecast.map((pred, i) => (
              <div key={i} className={`rounded-md border ${VERDICT_STYLE[pred.verdict]} p-2.5 space-y-1`}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="text-[12px] font-light text-foreground">{pred.question}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] font-medium">{pred.answer}</div>
                </div>
                <p className="text-[10.5px] leading-relaxed font-light text-muted-foreground/90">{pred.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed transit cards */}
      {transit && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 pt-1">
            Planet-by-planet · positions at {fmtDate(chosen)} (mid-month sample)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readings.map(({ planet, reading }) => (
              <div key={planet.name} className={`rounded-lg border ${WEIGHT_RING[reading.weight]} p-3 space-y-1.5`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-light text-foreground">
                    <span className="text-foreground/70 mr-1">{planet.symbol}</span>
                    {reading.headline}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 tabular-nums">
                    {planet.signName} · {fmtDeg(planet.degInSign)}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/85 font-light leading-relaxed">{reading.meaning}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-border/15">
                  <div className="text-[10px] font-light leading-relaxed">
                    <span className="text-emerald-400/80 uppercase tracking-[0.15em] mr-1">Favors</span>
                    <span className="text-muted-foreground/85">{reading.favors}</span>
                  </div>
                  <div className="text-[10px] font-light leading-relaxed">
                    <span className="text-red-400/80 uppercase tracking-[0.15em] mr-1">Watch</span>
                    <span className="text-muted-foreground/85">{reading.warns}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingresses */}
      <div className="flex items-center justify-between gap-3 border-t border-border/15 pt-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-foreground/70" />
          <h4 className="text-xs font-light tracking-[0.15em] text-foreground uppercase">Sign Ingresses from {monthLabel(cursor)}</h4>
        </div>
        <div className="flex items-center gap-1">
          {([3, 12, 24] as const).map((m) => (
            <button
              key={m}
              onClick={() => setHorizonMonths(m)}
              className={`text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded border transition ${horizonMonths === m ? "border-foreground/40 bg-foreground/[0.08] text-foreground" : "border-border/25 text-muted-foreground hover:text-foreground"}`}
            >
              {m === 3 ? "3 mo" : m === 12 ? "1 yr" : "2 yr"}
            </button>
          ))}
        </div>
      </div>

      {loadingFuture && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning the sky…</div>
      )}

      {!loadingFuture && ingressesThisMonth.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/70">Ingresses in {monthLabel(cursor)}</div>
          {ingressesThisMonth.map((ing, i) => <IngressRow key={`m-${i}`} ing={ing} />)}
        </div>
      )}

      {!loadingFuture && ingressesLater.length > 0 && (
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 pt-1">Beyond — next {horizonMonths === 3 ? "3 months" : horizonMonths === 12 ? "year" : "2 years"}</div>
          {ingressesLater.map((ing, i) => <IngressRow key={`l-${i}`} ing={ing} />)}
        </div>
      )}

      {!loadingFuture && ingresses && ingresses.length === 0 && (
        <div className="text-[11px] text-muted-foreground/60 italic">No sign ingresses found in this window.</div>
      )}
    </div>
  );
};

function IngressRow({ ing }: { ing: SignIngress }) {
  const r = readTransit(ing.planet, ing.natalHouse, ing.retrograde);
  return (
    <div className="rounded-md border border-border/20 bg-background/25 hover:bg-background/40 transition p-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-light">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground/60 tabular-nums w-24 text-[10px] uppercase tracking-wider">{fmtDate(ing.date)}</span>
          <span className="text-foreground/80">{ing.symbol} {ing.planet}{ing.retrograde && <span className="text-muted-foreground"> ʀ</span>}</span>
          <span className="text-muted-foreground/70 inline-flex items-center gap-1">
            {ing.fromSign} <ArrowRight className="h-3 w-3 inline" /> {ing.toSign}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
          enters your House {ing.natalHouse} · {r.headline.split("—")[1]?.trim() ?? ""}
        </span>
      </div>
      <p className="text-[10.5px] text-muted-foreground/80 font-light leading-relaxed mt-1">{r.meaning}</p>
    </div>
  );
}

export default TransitsPanel;
