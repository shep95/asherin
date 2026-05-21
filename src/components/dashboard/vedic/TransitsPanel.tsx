import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Orbit, ArrowRight, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, Building2, User2, Target, Gem, Heart, Activity } from "lucide-react";
import { computeTransitChart, computeFutureIngresses, type TransitChart, type SignIngress } from "@/lib/vedic/transits";
import { readTransit, type LifePrediction, type Verdict } from "@/lib/vedic/transitMeanings";
import { calculateSweVedicChart, type SweVedicPlanet } from "@/lib/vedic/sweChart";
import { computeSensitivePoints, whyTransitMatters, type SensitivePoints, type WhyReason } from "@/lib/vedic/sensitivePoints";
import { detectWindows, type KarmicWindow } from "@/lib/vedic/wealthSoulmateWindows";
import type { CompanyFoundation } from "@/data/vedic/companyCharts";

interface Props {
  natalAscendant: number;
  natalPlanets?: SweVedicPlanet[];
  lat: number;
  lon: number;
  chartKey: string | null;
  userChartName?: string;
  companyCharts?: CompanyFoundation[];
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
function monthLabel(d: Date) { return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; }
function midOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 15, 12, 0); }
function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0); }
function monthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59); }
function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
// ── Week helpers (Mon-anchored ISO-ish week) ──
function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0);
  const day = x.getDay();              // 0..6, Sun=0
  const offset = (day + 6) % 7;        // days since Monday
  x.setDate(x.getDate() - offset);
  return x;
}
function weekEnd(d: Date) {
  const s = weekStart(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59);
}
function midOfWeek(d: Date) {
  const s = weekStart(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 3, 12, 0);
}
function weekLabel(d: Date) {
  const s = weekStart(d), e = weekEnd(d);
  const sameMonth = s.getMonth() === e.getMonth();
  const sFmt = `${MONTH_NAMES[s.getMonth()].slice(0,3)} ${s.getDate()}`;
  const eFmt = sameMonth ? `${e.getDate()}` : `${MONTH_NAMES[e.getMonth()].slice(0,3)} ${e.getDate()}`;
  return `Week of ${sFmt}–${eFmt}, ${e.getFullYear()}`;
}

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

interface NatalRef {
  ascendant: number;
  lat: number;
  lon: number;
  label: string;
  kind: "user" | "company";
  key: string;
  points: SensitivePoints | null;
}

const TransitsPanel = ({ natalAscendant, natalPlanets, lat, lon, chartKey, userChartName, companyCharts }: Props) => {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(() => midOfMonth(new Date()));
  const [mode, setMode] = useState<"user" | string>("user"); // "user" or company symbol
  const [companyRef, setCompanyRef] = useState<NatalRef | null>(null);
  const [resolvingCompany, setResolvingCompany] = useState(false);

  const userRef: NatalRef = useMemo(() => ({
    ascendant: natalAscendant, lat, lon,
    label: userChartName || "Your Chart", kind: "user",
    key: `user:${chartKey ?? `${natalAscendant.toFixed(3)}:${lat}:${lon}`}`,
    points: natalPlanets ? computeSensitivePoints(natalPlanets, natalAscendant) : null,
  }), [natalAscendant, natalPlanets, lat, lon, chartKey, userChartName]);

  // Resolve company natal chart whenever mode changes to a company symbol
  useEffect(() => {
    if (mode === "user") { setCompanyRef(null); return; }
    const co = companyCharts?.find((c) => c.symbol === mode);
    if (!co) return;
    let cancelled = false;
    setResolvingCompany(true);
    (async () => {
      try {
        const c = await calculateSweVedicChart({
          birthDate: co.birthDate, birthTime: co.birthTime,
          tzOffset: co.tzOffset, lat: co.lat, lon: co.lon,
        });
        if (cancelled) return;
        setCompanyRef({
          ascendant: c.ascendant, lat: co.lat, lon: co.lon,
          label: `${co.name} (${co.symbol})`, kind: "company",
          key: `co:${co.symbol}`,
          points: computeSensitivePoints(c.planets, c.ascendant),
        });
      } finally {
        if (!cancelled) setResolvingCompany(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, companyCharts]);

  const activeRef: NatalRef = mode === "user" ? userRef : (companyRef ?? userRef);

  const [transit, setTransit] = useState<TransitChart | null>(null);
  const [loadingNow, setLoadingNow] = useState(false);
  const [horizonMonths, setHorizonMonths] = useState<3 | 12 | 24>(12);
  const [granularity, setGranularity] = useState<"week" | "month">("month");

  const chosen = useMemo(
    () => (granularity === "week" ? midOfWeek(cursor) : midOfMonth(cursor)),
    [cursor, granularity],
  );
  const periodStart = useMemo(() => (granularity === "week" ? weekStart(cursor) : monthStart(cursor)), [cursor, granularity]);
  const periodEnd   = useMemo(() => (granularity === "week" ? weekEnd(cursor)   : monthEnd(cursor)),   [cursor, granularity]);
  const periodLabel = granularity === "week" ? weekLabel(cursor) : monthLabel(cursor);
  const isCurrentPeriod = today.getTime() >= periodStart.getTime() && today.getTime() <= periodEnd.getTime();
  const isCurrentMonth = isCurrentPeriod;

  // ── Transit chart for chosen period — cache per (refKey, granularity, key) ──
  const transitCacheRef = useRef<Map<string, TransitChart>>(new Map());
  // Invalidate transit cache when active natal ref changes
  useEffect(() => { transitCacheRef.current.clear(); }, [activeRef.key]);

  useEffect(() => {
    if (mode !== "user" && !companyRef) return; // wait for company resolution
    const periodKey = granularity === "week"
      ? `w-${weekStart(cursor).toISOString().slice(0,10)}`
      : `m-${chosen.getFullYear()}-${chosen.getMonth()}`;
    const cacheKey = `${activeRef.key}:${periodKey}`;
    const cached = transitCacheRef.current.get(cacheKey);
    if (cached) { setTransit(cached); return; }
    let cancelled = false;
    setLoadingNow(true);
    (async () => {
      try {
        const t = await computeTransitChart(chosen, activeRef.ascendant, activeRef.lat, activeRef.lon);
        if (cancelled) return;
        transitCacheRef.current.set(cacheKey, t);
        setTransit(t);
      } finally {
        if (!cancelled) setLoadingNow(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chosen, activeRef.key, activeRef.ascendant, activeRef.lat, activeRef.lon, mode, companyRef]);

  // ── Ingresses — anchored at today, horizon auto-extended for chosen month ──
  // Cache key is independent of `chosen` so flipping months stays instant.
  const [ingresses, setIngresses] = useState<SignIngress[] | null>(null);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const ingressCacheRef = useRef<Map<string, SignIngress[]>>(new Map());

  // Horizon in days: cover horizonMonths AND enough to reach the chosen month
  const scanHorizonDays = useMemo(() => {
    const baseFromHorizon = horizonMonths * 31;
    const monthsToChosen = Math.max(0, monthsBetween(today, chosen));
    const needed = (monthsToChosen + 2) * 31; // +2 month buffer
    const raw = Math.max(baseFromHorizon, needed);
    // round up to nearest 90 days to avoid frequent refetches when scrolling
    return Math.ceil(raw / 90) * 90;
  }, [horizonMonths, today, chosen]);

  useEffect(() => {
    if (mode !== "user" && !companyRef) return;
    const key = `${activeRef.key}:${scanHorizonDays}`;
    const cached = ingressCacheRef.current.get(key);
    if (cached) { setIngresses(cached); return; }
    let cancelled = false;
    setLoadingFuture(true);
    (async () => {
      try {
        const list = await computeFutureIngresses(activeRef.ascendant, activeRef.lat, activeRef.lon, {
          from: monthStart(today),
          horizonDays: scanHorizonDays,
          perPlanetLimit: scanHorizonDays >= 365 ? 8 : 4,
        });
        if (cancelled) return;
        ingressCacheRef.current.set(key, list);
        setIngresses(list);
      } finally {
        if (!cancelled) setLoadingFuture(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeRef.key, activeRef.ascendant, activeRef.lat, activeRef.lon, scanHorizonDays, today, mode, companyRef]);
  // Clear ingress cache when natal ref changes
  useEffect(() => { ingressCacheRef.current.clear(); setIngresses(null); }, [activeRef.key]);

  const readings = useMemo(() => {
    if (!transit) return [];
    return transit.planets.map((p) => ({
      planet: p,
      reading: readTransit(p.name, p.natalHouse, p.retrograde),
      whys: whyTransitMatters(p.name, p.signIndex, activeRef.points),
    }));
  }, [transit, activeRef.points]);

  // Top-level chart-specific reasoning for this month — only the "high importance"
  // hits (UL / AK / DK / Moon-sign / Lagna activations). This is the "WHY before data."
  const topWhys = useMemo(() => {
    const out: Array<WhyReason & { planet: string; symbol: string; retrograde: boolean }> = [];
    for (const r of readings) {
      for (const w of r.whys) {
        if (w.importance === "high") {
          out.push({ ...w, planet: r.planet.name, symbol: r.planet.symbol, retrograde: r.planet.retrograde });
        }
      }
    }
    return out;
  }, [readings]);

  // ── WEALTH + SOULMATE WINDOWS — scan all upcoming ingresses ──
  const wealthWindows = useMemo(
    () => (ingresses ? detectWindows(ingresses, activeRef.points, "wealth", { clusterDays: 180, minScore: 4 }) : []),
    [ingresses, activeRef.points],
  );
  const soulmateWindows = useMemo(
    () => activeRef.kind === "user"
      ? (ingresses ? detectWindows(ingresses, activeRef.points, "soulmate", { clusterDays: 180, minScore: 3 }) : [])
      : [],
    [ingresses, activeRef.points, activeRef.kind],
  );
  const healthWindows = useMemo(
    () => (ingresses ? detectWindows(ingresses, activeRef.points, "health", { clusterDays: 120, minScore: 4 }) : []),
    [ingresses, activeRef.points],
  );

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
    const s = periodStart.getTime();
    const e = periodEnd.getTime();
    return ingresses.filter((i) => i.date.getTime() >= s && i.date.getTime() <= e);
  }, [ingresses, periodStart, periodEnd]);
  const ingressesLater = useMemo(() => {
    if (!ingresses) return [];
    const e = periodEnd.getTime();
    const horizonEndMs = today.getTime() + horizonMonths * 31 * 86400_000;
    return ingresses.filter((i) => {
      const t = i.date.getTime();
      return t > e && t <= horizonEndMs;
    });
  }, [ingresses, periodEnd, today, horizonMonths]);

  const shiftPeriod = (delta: number) => {
    if (granularity === "week") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 15));
    }
  };
  const shiftYear  = (delta: number) => setCursor(new Date(cursor.getFullYear() + delta, cursor.getMonth(), granularity === "week" ? cursor.getDate() : 15));
  const jumpToNow  = () => setCursor(granularity === "week" ? midOfWeek(new Date()) : midOfMonth(new Date()));

  const subjectLabel = activeRef.label;

  return (
    <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/15 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Orbit className="h-4 w-4 text-foreground/70" />
          <h3 className="text-sm font-light tracking-[0.15em] text-foreground uppercase">{granularity === "week" ? "Weekly" : "Monthly"} Transit Forecast</h3>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 ml-2 inline-flex items-center gap-1">
            {activeRef.kind === "user" ? <User2 className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
            {subjectLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Granularity toggle */}
          <div className="inline-flex items-center rounded border border-border/25 overflow-hidden mr-2">
            {(["week","month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  if (g === granularity) return;
                  setGranularity(g);
                  setCursor(g === "week" ? midOfWeek(cursor) : midOfMonth(cursor));
                }}
                className={`text-[10px] uppercase tracking-[0.15em] px-2 py-1 transition ${granularity === g ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {g}
              </button>
            ))}
          </div>
          <button onClick={() => shiftYear(-1)} title="Previous year" className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => shiftPeriod(-1)} title={`Previous ${granularity}`} className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="px-3 py-1 rounded border border-foreground/30 bg-foreground/[0.05] min-w-[12rem] text-center">
            <div className="text-xs font-light tracking-[0.15em] text-foreground uppercase">{periodLabel}</div>
            {isCurrentPeriod && <div className="text-[9px] uppercase tracking-[0.2em] text-emerald-300/80">This {granularity}</div>}
          </div>
          <button onClick={() => shiftPeriod(1)} title={`Next ${granularity}`} className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => shiftYear(1)} title="Next year" className="p-1.5 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={jumpToNow}
            className="ml-2 text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded border border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition"
          >
            Now
          </button>
        </div>
      </div>

      {/* Chart-source switcher */}
      {companyCharts && companyCharts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Chart Subject</span>
          <button
            onClick={() => setMode("user")}
            className={`text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded border transition inline-flex items-center gap-1.5 ${mode === "user" ? "border-foreground/40 bg-foreground/[0.08] text-foreground" : "border-border/25 text-muted-foreground hover:text-foreground"}`}
          >
            <User2 className="h-3 w-3" /> {userChartName || "Your Chart"}
          </button>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/25">
            <Building2 className="h-3 w-3 text-muted-foreground/80" />
            <select
              value={mode === "user" ? "" : mode}
              onChange={(e) => setMode(e.target.value || "user")}
              className="bg-transparent text-[11px] font-light text-foreground outline-none cursor-pointer max-w-[14rem]"
            >
              <option value="" className="bg-background">— Company chart —</option>
              {companyCharts.map((c) => (
                <option key={c.symbol} value={c.symbol} className="bg-background">{c.symbol} · {c.name}</option>
              ))}
            </select>
          </div>
          {resolvingCompany && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* WHY THIS MATTERS TO YOUR CHART — reasoning before data */}
      {!loadingNow && topWhys.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.04] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-amber-300/90" />
            <h4 className="text-xs font-light tracking-[0.15em] text-amber-200 uppercase">
              Why this matters to {activeRef.kind === "company" ? subjectLabel : "your chart"}
            </h4>
          </div>
          <p className="text-[10.5px] text-muted-foreground/80 italic leading-relaxed">
            Generic house-readings ignore your chart. These hits are sign-specific to {activeRef.kind === "company" ? "this company's" : "YOUR"} sensitive points — Lagna, Moon sign, Atmakaraka, Darakaraka, Upapada Lagna. Read these first; everything below is the supporting data.
          </p>
          <div className="space-y-1.5">
            {topWhys.map((w, i) => (
              <div key={i} className="rounded-md border border-amber-300/20 bg-background/30 p-2.5">
                <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                  <div className="text-[11px] font-light text-foreground">
                    <span className="text-foreground/70 mr-1">{w.symbol}</span>
                    {w.planet}{w.retrograde && <span className="text-muted-foreground"> ʀ</span>} on your <span className="text-amber-200">{w.pointLabel}</span> ({w.signName})
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-amber-300/80">High Impact</span>
                </div>
                <p className="text-[11.5px] leading-relaxed font-light text-foreground/90">{w.plain}</p>
                <p className="text-[10px] leading-relaxed font-light text-muted-foreground/55 italic mt-1">Nerd: {w.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WEALTH + SOULMATE WINDOWS — chart-specific big-money / soulmate timing */}
      {(wealthWindows.length > 0 || soulmateWindows.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {wealthWindows.length > 0 && (
            <WindowList
              title={`Wealth Windows · ${subjectLabel}`}
              subtitle={activeRef.kind === "company"
                ? "Periods when transiting benefics light up this company's dhana axis (lords of 2/5/9/11 + AK)."
                : "Periods when transiting benefics ignite YOUR personal wealth axis (lords of 2/5/9/11 + Atmakaraka). Translation: when the universe lines up your big-money channels."}
              icon={<Gem className="h-3.5 w-3.5 text-emerald-300/90" />}
              accent="emerald"
              windows={wealthWindows}
            />
          )}
          {soulmateWindows.length > 0 && (
            <WindowList
              title="Soulmate / Marriage Windows"
              subtitle="When Jupiter or Venus walks into the SPECIFIC signs your spouse-karmas live in. Plain-English: when 'meet your person' energy is actually on for you."
              icon={<Heart className="h-3.5 w-3.5 text-rose-300/90" />}
              accent="rose"
              windows={soulmateWindows}
            />
          )}
        </div>
      )}

      {/* HEALTH / SICKNESS WINDOWS */}
      {healthWindows.length > 0 && (
        <WindowList
          title={`Health & Sickness Windows · ${subjectLabel}`}
          subtitle="When malefics (Saturn, Mars, Rahu, Ketu) walk into the signs of your health-axis lords (6th = disease, 8th = chronic / surgery, 12th = hospital), Lagna (body), or Moon (mind). Plain-English: the months you're statistically most likely to get sick, injured, or run-down — and the windows that bless your immunity."
          icon={<Activity className="h-3.5 w-3.5 text-red-300/90" />}
          accent="red"
          windows={healthWindows}
        />
      )}



      {/* Month forecast */}
      <div className="rounded-lg border border-border/25 bg-gradient-to-b from-foreground/[0.04] to-transparent p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
          <h4 className="text-xs font-light tracking-[0.15em] text-foreground uppercase">
            Forecast for {periodLabel} · <span className="text-muted-foreground/80 normal-case tracking-normal">{subjectLabel}</span>
          </h4>
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
                  <div className="text-[12px] font-light text-foreground">
                    {activeRef.kind === "company"
                      ? pred.question
                          .replace(/^Will you /, `Will ${subjectLabel} `)
                          .replace(/your /gi, "its ")
                      : pred.question}
                  </div>
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
            Planet-by-planet · positions at {fmtDate(chosen)} (mid-month sample) · houses relative to {subjectLabel}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readings.map(({ planet, reading, whys }) => (
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
                {whys.length > 0 && (
                  <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.04] p-2 space-y-1.5">
                    {whys.map((w, i) => (
                      <div key={i} className="text-[10.5px] leading-relaxed font-light space-y-0.5">
                        <div>
                          <span className="text-amber-200/90 uppercase tracking-[0.15em] text-[9px] mr-1">Your {w.pointLabel}</span>
                          <span className="text-foreground/90">{w.plain}</span>
                        </div>
                        <p className="text-muted-foreground/55 italic text-[10px]">Nerd: {w.text}</p>
                      </div>
                    ))}
                  </div>
                )}
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
          <h4 className="text-xs font-light tracking-[0.15em] text-foreground uppercase">Sign Ingresses · {subjectLabel}</h4>
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

      {loadingFuture && !ingresses && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning the sky…</div>
      )}

      {ingressesThisMonth.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/70">Ingresses in {periodLabel}</div>
          {ingressesThisMonth.map((ing, i) => <IngressRow key={`m-${i}`} ing={ing} points={activeRef.points} />)}
        </div>
      )}

      {ingressesLater.length > 0 && (
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 pt-1">Beyond — through next {horizonMonths === 3 ? "3 months" : horizonMonths === 12 ? "year" : "2 years"}</div>
          {ingressesLater.map((ing, i) => <IngressRow key={`l-${i}`} ing={ing} points={activeRef.points} />)}
        </div>
      )}

      {!loadingFuture && ingresses && ingressesThisMonth.length === 0 && ingressesLater.length === 0 && (
        <div className="text-[11px] text-muted-foreground/60 italic">No sign ingresses found in this window.</div>
      )}
    </div>
  );
};

function IngressRow({ ing, points }: { ing: SignIngress; points: SensitivePoints | null }) {
  const r = readTransit(ing.planet, ing.natalHouse, ing.retrograde);
  const whys = whyTransitMatters(ing.planet, ing.toSignIndex, points);
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
          enters House {ing.natalHouse} · {r.headline.split("—")[1]?.trim() ?? ""}
        </span>
      </div>
      {whys.length > 0 && (
        <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.04] p-2 mt-1.5 space-y-1.5">
          {whys.map((w, i) => (
            <div key={i} className="text-[10.5px] leading-relaxed font-light space-y-0.5">
              <div>
                <span className="text-amber-200/90 uppercase tracking-[0.15em] text-[9px] mr-1">Hits your {w.pointLabel}</span>
                <span className="text-foreground/90">{w.plain}</span>
              </div>
              <p className="text-muted-foreground/55 italic text-[10px]">Nerd: {w.text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10.5px] text-muted-foreground/80 font-light leading-relaxed mt-1">{r.meaning}</p>
    </div>
  );
}

function fmtRange(a: Date, b: Date) {
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (sameMonth) return fmtDate(a);
  return `${fmtDate(a)} → ${fmtDate(b)}`;
}

const ACCENT: Record<"emerald" | "rose" | "red", { ring: string; chip: string; head: string; grade: string }> = {
  emerald: {
    ring: "border-emerald-400/30 bg-emerald-400/[0.04]",
    chip: "border-emerald-300/30 bg-emerald-300/[0.05] text-emerald-200",
    head: "text-emerald-200",
    grade: "text-emerald-300/90",
  },
  rose: {
    ring: "border-rose-400/30 bg-rose-400/[0.04]",
    chip: "border-rose-300/30 bg-rose-300/[0.05] text-rose-200",
    head: "text-rose-200",
    grade: "text-rose-300/90",
  },
  red: {
    ring: "border-red-400/30 bg-red-400/[0.04]",
    chip: "border-red-300/30 bg-red-300/[0.05] text-red-200",
    head: "text-red-200",
    grade: "text-red-300/90",
  },
};

type AccentKey = "emerald" | "rose" | "red";

function WindowList({
  title, subtitle, icon, accent, windows,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: AccentKey;
  windows: KarmicWindow[];
}) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-lg border ${a.ring} p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        {icon}
        <h4 className={`text-xs font-light tracking-[0.15em] uppercase ${a.head}`}>{title}</h4>
      </div>
      <p className="text-[10.5px] text-muted-foreground/80 italic leading-relaxed">{subtitle}</p>
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {windows.slice(0, 12).map((w, i) => (
          <WindowCard key={i} w={w} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function WindowCard({ w, accent }: { w: KarmicWindow; accent: AccentKey }) {
  const a = ACCENT[accent];
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border/25 bg-background/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-2.5 space-y-1.5 hover:bg-foreground/[0.03] transition rounded-md"
      >
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-[11px] font-light text-foreground flex-1">{w.headline}</div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] uppercase tracking-[0.2em] ${a.grade}`}>{w.grade}</span>
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/70 transition-transform ${open ? "rotate-90" : ""}`} />
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 tabular-nums flex items-center gap-2 flex-wrap">
          <span>{fmtRange(w.start, w.end)}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>score {w.score > 0 ? "+" : ""}{w.score}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="normal-case tracking-normal text-muted-foreground/60">{w.hits.length} activation{w.hits.length === 1 ? "" : "s"} — click to expand</span>
        </div>
      </button>
      {open && (
        <div className="space-y-2 p-2.5 pt-2 border-t border-border/15">
          {w.hits.map((h, j) => (
            <div key={j} className="text-[10.5px] leading-relaxed font-light space-y-1">
              <div>
                <span className="inline-block min-w-[5.5rem] tabular-nums text-[9px] uppercase tracking-wider text-muted-foreground/60">{fmtDate(h.date)}</span>
                <span className="text-foreground/85 mr-1">{h.symbol} {h.planet}{h.retrograde ? " ʀ" : ""}</span>
                <span className={`inline-block text-[9px] uppercase tracking-[0.15em] px-1 py-0.5 rounded border mr-1 ${a.chip}`}>→ {h.pointLabel}</span>
              </div>
              <p className="text-foreground/90 pl-[5.5rem]">{h.plain}</p>
              <p className="text-muted-foreground/55 pl-[5.5rem] text-[10px] italic">Nerd: {h.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TransitsPanel;
