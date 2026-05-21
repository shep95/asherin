import { useEffect, useMemo, useState } from "react";
import { Loader2, Orbit, ArrowRight, Calendar } from "lucide-react";
import { computeTransitChart, computeFutureIngresses, type TransitChart, type SignIngress } from "@/lib/vedic/transits";
import { readTransit } from "@/lib/vedic/transitMeanings";

interface Props {
  natalAscendant: number;
  lat: number;
  lon: number;
  chartKey: string | null;     // changes when active chart changes — triggers refresh
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });
}
function fmtDeg(deg: number) {
  const dInt = Math.floor(deg);
  const m = Math.floor((deg - dInt) * 60);
  return `${dInt}°${m.toString().padStart(2, "0")}'`;
}

const WEIGHT_RING: Record<"high" | "medium" | "low", string> = {
  high: "border-amber-400/50 bg-amber-400/[0.04]",
  medium: "border-border/30 bg-background/30",
  low: "border-border/20 bg-background/20",
};

const TransitsPanel = ({ natalAscendant, lat, lon, chartKey }: Props) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [chosen, setChosen] = useState<Date>(() => new Date());
  const [transit, setTransit] = useState<TransitChart | null>(null);
  const [loadingNow, setLoadingNow] = useState(false);
  const [ingresses, setIngresses] = useState<SignIngress[] | null>(null);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [horizonMonths, setHorizonMonths] = useState<12 | 24 | 36>(24);

  // Refresh "now" every 5 min so the live transit stays current.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 5 * 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Current/chosen transit chart
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
  }, [chosen, natalAscendant, lat, lon, chartKey, now]);

  // Future ingresses
  useEffect(() => {
    let cancelled = false;
    setIngresses(null);
    (async () => {
      setLoadingFuture(true);
      try {
        const list = await computeFutureIngresses(natalAscendant, lat, lon, {
          horizonDays: horizonMonths * 30,
          perPlanetLimit: horizonMonths >= 24 ? 6 : 4,
        });
        if (!cancelled) setIngresses(list);
      } finally {
        if (!cancelled) setLoadingFuture(false);
      }
    })();
    return () => { cancelled = true; };
  }, [natalAscendant, lat, lon, chartKey, horizonMonths]);

  const readings = useMemo(() => {
    if (!transit) return [];
    return transit.planets.map((p) => ({
      planet: p,
      reading: readTransit(p.name, p.natalHouse, p.retrograde),
    }));
  }, [transit]);

  const chosenISO = useMemo(() => {
    const y = chosen.getFullYear();
    const m = String(chosen.getMonth() + 1).padStart(2, "0");
    const d = String(chosen.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [chosen]);

  return (
    <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-border/15 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Orbit className="h-4 w-4 text-foreground/70" />
          <h3 className="text-sm font-light tracking-[0.15em] text-foreground uppercase">Current &amp; Future Transits</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Date</label>
          <input
            type="date"
            value={chosenISO}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split("-").map(Number);
              if (!y || !m || !d) return;
              setChosen(new Date(y, m - 1, d, chosen.getHours(), chosen.getMinutes()));
            }}
            className="bg-background/40 border border-border/30 rounded px-2 py-1 text-xs text-foreground font-light"
          />
          <button
            onClick={() => setChosen(new Date())}
            className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded border border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition"
          >
            Now
          </button>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
        Showing positions for {fmtDateTime(chosen)} · evaluated against your natal Ascendant
      </div>

      {loadingNow && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing transits…</div>
      )}

      {transit && (
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
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border/15 pt-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-foreground/70" />
          <h4 className="text-xs font-light tracking-[0.15em] text-foreground uppercase">Upcoming Sign Ingresses</h4>
        </div>
        <div className="flex items-center gap-1">
          {([12, 24, 36] as const).map((m) => (
            <button
              key={m}
              onClick={() => setHorizonMonths(m)}
              className={`text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded border transition ${horizonMonths === m ? "border-foreground/40 bg-foreground/[0.08] text-foreground" : "border-border/25 text-muted-foreground hover:text-foreground"}`}
            >
              {m === 12 ? "1 yr" : m === 24 ? "2 yr" : "3 yr"}
            </button>
          ))}
        </div>
      </div>

      {loadingFuture && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning future sky…</div>
      )}

      {ingresses && ingresses.length > 0 && (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {ingresses.map((ing, i) => {
            const r = readTransit(ing.planet, ing.natalHouse, ing.retrograde);
            return (
              <div key={`${ing.planet}-${i}`} className="rounded-md border border-border/20 bg-background/25 hover:bg-background/40 transition p-2.5">
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
                <p className="text-[10.5px] text-muted-foreground/80 font-light leading-relaxed mt-1">
                  {r.meaning}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {ingresses && ingresses.length === 0 && !loadingFuture && (
        <div className="text-[11px] text-muted-foreground/60 italic">No sign ingresses found in this window.</div>
      )}
    </div>
  );
};

export default TransitsPanel;
