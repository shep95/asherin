import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Moon, Sparkles, MapPin, Save, Trash2, BookOpen, Calendar } from "lucide-react";
import * as Astronomy from "astronomy-engine";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import {
  nakshatras,
  rashis,
  getNakshatraFromDeg,
  getRashiFromDeg,
} from "@/data/nakshatraData";
import { supabase } from "@/integrations/supabase/client";
import { computeMahadasha, findCurrentDasha, type MahadashaPeriod } from "@/lib/vedic/dasha";
import { computeDignity, houseFromAsc, type PlanetName } from "@/lib/vedic/dignities";
import { generateReading, type PlacementInput } from "@/lib/vedic/readingEngine";
import { toast } from "sonner";

/**
 * VEDIC ASTROLOGY — Sidereal natal chart (Lahiri ayanamsa).
 * Self-contained: uses astronomy-engine for tropical positions, then
 * subtracts Lahiri ayanamsa to derive sidereal (Vedic) longitudes.
 * No WASM, no backend — pure client computation.
 */

interface Planet {
  name: string;
  symbol: string;
  body: Astronomy.Body | "Rahu" | "Ketu";
  trop: number;
  sid: number;
  retrograde: boolean;
}

const PLANET_DEFS: { name: string; symbol: string; body: Astronomy.Body | "Rahu" | "Ketu" }[] = [
  { name: "Sun", symbol: "☉", body: Astronomy.Body.Sun },
  { name: "Moon", symbol: "☽", body: Astronomy.Body.Moon },
  { name: "Mercury", symbol: "☿", body: Astronomy.Body.Mercury },
  { name: "Venus", symbol: "♀", body: Astronomy.Body.Venus },
  { name: "Mars", symbol: "♂", body: Astronomy.Body.Mars },
  { name: "Jupiter", symbol: "♃", body: Astronomy.Body.Jupiter },
  { name: "Saturn", symbol: "♄", body: Astronomy.Body.Saturn },
  { name: "Rahu", symbol: "☊", body: "Rahu" },
  { name: "Ketu", symbol: "☋", body: "Ketu" },
];

/**
 * Lahiri (Chitra Paksha) ayanamsa — Swiss Ephemeris reference epoch.
 * SE_SIDM_LAHIRI: at JD 2415020.0 (1900-Jan-0.5 UT) ayanamsa = 22°27'37.69" (22.46047°),
 * drifting at the IAU2006 mean precession rate ≈ 50.290966″/yr.
 * Matches `swe_get_ayanamsa_ut(JD, SE_SIDM_LAHIRI)` to within ~0.5″.
 */
function lahiriAyanamsa(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const t = (JD - 2415020.0) / 365.25; // tropical years since 1900.0
  return 22.46047 + (t * 50.290966) / 3600;
}

/** Mean obliquity of the ecliptic (Laskar 1986, in degrees). */
function meanObliquity(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  // arcseconds, IAU 1980 + Laskar high-order
  const eps =
    84381.448 -
    46.815 * T -
    0.00059 * T * T +
    0.001813 * T * T * T;
  return eps / 3600;
}

/**
 * True (osculating) lunar node — Meeus Astronomical Algorithms Ch. 47.
 * Adds the dominant nutation/perturbation term to the mean node so Rahu
 * matches Swiss Ephemeris's SE_TRUE_NODE within ~1 arcminute.
 */
function trueNodeLongitude(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  const meanNode =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60616000;
  // Meeus 47.7 — leading periodic term for true node
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const deg = Math.PI / 180;
  const corr =
    -1.4979 * Math.sin(2 * (D - F) * deg) -
    0.1500 * Math.sin(M * deg) -
    0.1226 * Math.sin(2 * D * deg) +
    0.1176 * Math.sin(2 * F * deg) -
    0.0801 * Math.sin(2 * (Mp - F) * deg);
  return ((meanNode + corr) % 360 + 360) % 360;
}

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function fmtDeg(deg: number): string {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.floor((mFloat - m) * 60);
  return `${d}° ${m.toString().padStart(2, "0")}' ${s.toString().padStart(2, "0")}"`;
}

/** Topocentric ecliptic longitude of a body — corrects for observer parallax. */
function topocentricEclLon(
  body: Astronomy.Body,
  time: Astronomy.AstroTime,
  observer: Astronomy.Observer,
): number {
  const geo = Astronomy.GeoVector(body, time, true);
  const obs = Astronomy.ObserverVector(time, observer, true);
  const topo = {
    x: geo.x - obs.x,
    y: geo.y - obs.y,
    z: geo.z - obs.z,
    t: time,
  } as Astronomy.Vector;
  return norm360(Astronomy.Ecliptic(topo).elon);
}

function computeChart(birthUtc: Date, lat: number, lon: number) {
  const time = new Astronomy.AstroTime(birthUtc);
  const observer = new Astronomy.Observer(lat, lon, 0);
  const ayan = lahiriAyanamsa(birthUtc);

  const planets: Planet[] = [];
  for (const def of PLANET_DEFS) {
    if (def.body === "Rahu") {
      const trop = trueNodeLongitude(birthUtc);
      planets.push({ ...def, trop, sid: norm360(trop - ayan), retrograde: true });
    } else if (def.body === "Ketu") {
      const rahu = trueNodeLongitude(birthUtc);
      const trop = norm360(rahu + 180);
      planets.push({ ...def, trop, sid: norm360(trop - ayan), retrograde: true });
    } else {
      // Topocentric for Moon (parallax matters), geocentric for everything else.
      const trop =
        def.body === Astronomy.Body.Moon
          ? topocentricEclLon(Astronomy.Body.Moon, time, observer)
          : norm360(Astronomy.Ecliptic(Astronomy.GeoVector(def.body as Astronomy.Body, time, true)).elon);
      // Retrograde detection — sample +1 day delta in ecliptic longitude.
      let retrograde = false;
      if (def.body !== Astronomy.Body.Sun && def.body !== Astronomy.Body.Moon) {
        const t2 = new Astronomy.AstroTime(new Date(birthUtc.getTime() + 86400000));
        const eq2 = Astronomy.Ecliptic(Astronomy.GeoVector(def.body as Astronomy.Body, t2, true));
        const delta = norm360(eq2.elon - trop + 180) - 180;
        retrograde = delta < 0;
      }
      planets.push({ ...def, trop, sid: norm360(trop - ayan), retrograde });
    }
  }

  // Ascendant — Meeus AA Ch. 13.4 (corrected form, matches Swiss Ephemeris/Astro-Seek).
  // Asc = atan2( cos(LST),  -(sin(LST)·cos(ε) + tan(φ)·sin(ε)) )
  // This places Asc 90° east of MC (LST) in zodiacal order, which is the rising point.
  const gst = Astronomy.SiderealTime(time); // hours, GMST
  const lst = norm360((gst + lon / 15) * 15); // local sidereal time in degrees (= MC tropical)
  const lstRad = (lst * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const obliquity = (meanObliquity(birthUtc) * Math.PI) / 180;
  const ascRad = Math.atan2(
    Math.cos(lstRad),
    -(Math.sin(lstRad) * Math.cos(obliquity) + Math.tan(latRad) * Math.sin(obliquity)),
  );
  const ascTrop = norm360((ascRad * 180) / Math.PI);
  const ascSid = norm360(ascTrop - ayan);
  const mcSid = norm360(lst - ayan);

  return { planets, ascendant: ascSid, mc: mcSid, ayanamsa: ayan };
}

/* ── North-Indian style square wheel ───────────────────────── */
function VedicWheel({
  ascendant,
  planets,
  size = 420,
}: {
  ascendant: number;
  planets: Planet[];
  size?: number;
}) {
  const houses = useMemo(() => {
    const ascSign = Math.floor(ascendant / 30);
    const list: { house: number; signIndex: number; planets: Planet[] }[] = [];
    for (let i = 0; i < 12; i++) {
      const signIndex = (ascSign + i) % 12;
      const housePlanets = planets.filter(
        (p) => Math.floor(p.sid / 30) === signIndex,
      );
      list.push({ house: i + 1, signIndex, planets: housePlanets });
    }
    return list;
  }, [ascendant, planets]);

  const c = size / 2;
  const r = size / 2;

  // 12 diamond/triangle slots — North Indian layout coordinates as fractions of size.
  // Houses arranged: 1=top-center diamond, 2=top-left triangle, 3=left-top, 4=left-center, ...
  const SLOTS = [
    { x: 0.5, y: 0.25 }, // 1
    { x: 0.25, y: 0.12 }, // 2
    { x: 0.12, y: 0.25 }, // 3
    { x: 0.25, y: 0.5 }, // 4
    { x: 0.12, y: 0.75 }, // 5
    { x: 0.25, y: 0.88 }, // 6
    { x: 0.5, y: 0.75 }, // 7
    { x: 0.75, y: 0.88 }, // 8
    { x: 0.88, y: 0.75 }, // 9
    { x: 0.75, y: 0.5 }, // 10
    { x: 0.88, y: 0.25 }, // 11
    { x: 0.75, y: 0.12 }, // 12
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="select-none"
    >
      {/* Outer square */}
      <rect
        x={1}
        y={1}
        width={size - 2}
        height={size - 2}
        fill="none"
        stroke="hsl(var(--border) / 0.3)"
        strokeWidth={1}
      />
      {/* Diagonals */}
      <line x1={0} y1={0} x2={size} y2={size} stroke="hsl(var(--border) / 0.25)" />
      <line x1={size} y1={0} x2={0} y2={size} stroke="hsl(var(--border) / 0.25)" />
      {/* Inner diamond */}
      <polygon
        points={`${c},0 ${size},${c} ${c},${size} 0,${c}`}
        fill="none"
        stroke="hsl(var(--border) / 0.3)"
      />
      {/* Houses content */}
      {houses.map((h, i) => {
        const slot = SLOTS[i];
        const px = slot.x * size;
        const py = slot.y * size;
        return (
          <g key={i}>
            <text
              x={px}
              y={py - 32}
              textAnchor="middle"
              fontSize={9}
              fill="hsl(var(--muted-foreground) / 0.45)"
              fontWeight={300}
              letterSpacing="0.1em"
            >
              {rashis[h.signIndex].sanskrit} · H{h.house}
            </text>
            {h.planets.map((p, j) => (
              <text
                key={p.name}
                x={px}
                y={py - 14 + j * 12}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--foreground) / 0.85)"
                fontWeight={300}
              >
                {p.symbol} {p.name.slice(0, 2)}
                {p.retrograde ? "ʀ" : ""}
              </text>
            ))}
          </g>
        );
      })}
      {/* Ascendant marker */}
      <text
        x={c}
        y={size - 6}
        textAnchor="middle"
        fontSize={9}
        fill="hsl(var(--muted-foreground) / 0.5)"
        letterSpacing="0.15em"
      >
        ASC {fmtDeg(ascendant % 30)} {rashis[Math.floor(ascendant / 30)].name.toUpperCase()}
      </text>
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────── */
const VedicAstrologyView = () => {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("12:00");
  const [tzOffset, setTzOffset] = useState("0");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [chart, setChart] = useState<ReturnType<typeof computeChart> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const searchCity = async (q?: string) => {
    const query = (q ?? cityQuery).trim();
    if (query.length < 2) {
      setCityResults([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=0&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "en" }, signal: ctrl.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCityResults(
        (data as { display_name: string; lat: string; lon: string }[]).map((d) => ({
          label: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        })),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("City lookup failed");
    } finally {
      setSearching(false);
    }
  };

  // Debounced auto-search as the user types.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (cityQuery.trim().length < 2) {
      setCityResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void searchCity(cityQuery);
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityQuery]);

  const generateChart = () => {
    setError(null);
    try {
      if (!birthDate) throw new Error("Birth date required");
      const latNum = parseFloat(lat);
      const lonNum = parseFloat(lon);
      if (isNaN(latNum) || isNaN(lonNum)) throw new Error("Latitude / longitude required");

      const [y, m, d] = birthDate.split("-").map(Number);
      const [hh, mm] = birthTime.split(":").map(Number);
      const tz = parseFloat(tzOffset) || 0;
      const utcMs = Date.UTC(y, m - 1, d, hh - tz, mm);
      const result = computeChart(new Date(utcMs), latNum, lonNum);
      setChart(result);
    } catch (e) {
      setError((e as Error).message);
      setChart(null);
    }
  };

  const ascRashi = chart ? rashis[Math.floor(chart.ascendant / 30)] : null;
  const moonPlanet = chart?.planets.find((p) => p.name === "Moon");
  const moonNak = moonPlanet ? getNakshatraFromDeg(moonPlanet.sid) : null;

  return (
    <div
      className="h-full overflow-y-auto relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.78)), url(${wallpaperAureon})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-5xl mx-auto p-6 space-y-6 relative z-10">
        <div className="flex items-center gap-3 border-b border-border/15 pb-4">
          <div className="h-10 w-10 rounded-full border border-border/30 bg-background/40 backdrop-blur-md flex items-center justify-center">
            <Moon className="h-4 w-4 text-foreground/70" />
          </div>
          <div>
            <h2 className="text-xl font-extralight tracking-[0.15em] text-foreground uppercase">Vedic Astrology</h2>
            <p className="text-[11px] font-light tracking-[0.2em] text-muted-foreground/70 mt-1 uppercase">
              Sidereal Natal Chart · Lahiri Ayanamsa
            </p>
          </div>
        </div>

        {/* Input panel */}
        <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">Birth date</span>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">Birth time (local)</span>
              <input
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
                className="w-full rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">UTC offset (hrs)</span>
              <input
                type="number"
                step="0.5"
                value={tzOffset}
                onChange={(e) => setTzOffset(e.target.value)}
                placeholder="e.g. -5"
                className="w-full rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="flex gap-2">
              <input
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchCity()}
                placeholder="Search birth city…"
                className="flex-1 rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
              <button
                onClick={() => searchCity()}
                disabled={searching}
                className="rounded-md border border-border/30 bg-background/40 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Lat"
                className="rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
              <input
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="Lon"
                className="rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
            </div>
          </div>

          {cityResults.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border border-border/20 bg-background/30 p-1">
              {cityResults.map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setLat(c.lat.toFixed(4));
                    setLon(c.lon.toFixed(4));
                    setCityQuery(c.label);
                    setCityResults([]);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            {error && <span className="text-xs text-destructive font-light">{error}</span>}
            <button
              onClick={generateChart}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-foreground/20 bg-foreground/5 px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-foreground/10 transition"
            >
              <Sparkles className="h-3.5 w-3.5" /> Generate Chart
            </button>
          </div>
        </div>

        {/* Chart output */}
        {chart && (
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
            <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 flex justify-center">
              <VedicWheel ascendant={chart.ascendant} planets={chart.planets} />
            </div>

            <div className="space-y-4">
              {ascRashi && (
                <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4">
                  <div className="text-[10px] font-light text-muted-foreground uppercase tracking-wider mb-2">
                    Ascendant (Lagna)
                  </div>
                  <div className="text-lg font-extralight text-foreground">
                    {ascRashi.name} <span className="text-muted-foreground">· {ascRashi.sanskrit}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmtDeg(chart.ascendant % 30)} · ruled by {ascRashi.ruler}
                  </div>
                </div>
              )}

              {moonPlanet && moonNak && (
                <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4">
                  <div className="text-[10px] font-light text-muted-foreground uppercase tracking-wider mb-2">
                    Moon Nakshatra
                  </div>
                  <div className="text-lg font-extralight text-foreground">
                    {moonNak.nakshatra.name}{" "}
                    <span className="text-muted-foreground">· Pada {moonNak.pada}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Ruled by {moonNak.nakshatra.ruler} · Deity {moonNak.nakshatra.deity}
                  </div>
                  <div className="text-xs text-muted-foreground/80 mt-2 leading-relaxed font-light">
                    {moonNak.nakshatra.description}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/30 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4">
                <div className="text-[10px] font-light text-muted-foreground uppercase tracking-wider mb-3">
                  Planetary Positions (Sidereal · Lahiri)
                </div>
                <div className="space-y-1.5">
                  {chart.planets.map((p) => {
                    const r = getRashiFromDeg(p.sid);
                    const n = getNakshatraFromDeg(p.sid);
                    return (
                      <div
                        key={p.name}
                        className="grid grid-cols-[20px_60px_1fr_auto] items-center gap-3 text-xs font-light"
                      >
                        <span className="text-foreground/70">{p.symbol}</span>
                        <span className="text-foreground">
                          {p.name}
                          {p.retrograde && <span className="text-muted-foreground"> ʀ</span>}
                        </span>
                        <span className="text-muted-foreground">
                          {r.name} · {n.nakshatra.name} (Pada {n.pada})
                        </span>
                        <span className="text-muted-foreground/70 tabular-nums">
                          {fmtDeg(p.sid % 30)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-border/20 text-[10px] text-muted-foreground/60">
                  Ayanamsa: {chart.ayanamsa.toFixed(4)}°
                </div>
              </div>
            </div>
          </div>
        )}

        {!chart && (
          <div className="rounded-xl border border-dashed border-border/30 bg-background/40 backdrop-blur-xl p-10 text-center">
            <Moon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-light">
              Enter birth details and generate your sidereal Vedic chart.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VedicAstrologyView;
