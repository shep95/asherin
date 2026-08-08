// PlacesNearbyPanel — "what's around here" for Asherin Maps.
//
// Live OpenStreetMap POI search with the affordances people actually rate
// Google Maps for: category chips, open-now filtering, distance ordering,
// direct call / website links, one-tap routing and Street View hand-off.

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, Clock, Phone, Globe, Navigation, Eye, Utensils } from "lucide-react";
import { searchNearby, streetViewUrl, type Place, type PlaceCategory } from "@/lib/asher/places";
import { fmtDistance, type Units } from "@/lib/asher/directions";

interface Props {
  open: boolean;
  onClose: () => void;
  center: { lat: number; lng: number };
  units: Units;
  onResults: (places: Place[]) => void;
  onFocus: (p: Place) => void;
  onRoute: (p: Place) => void;
}

const CHIPS: Array<{ id: PlaceCategory; label: string }> = [
  { id: "restaurant", label: "Restaurants" },
  { id: "cafe", label: "Coffee" },
  { id: "fuel", label: "Fuel" },
  { id: "hotel", label: "Hotels" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "atm", label: "ATM / Bank" },
  { id: "parking", label: "Parking" },
  { id: "supermarket", label: "Groceries" },
  { id: "hospital", label: "Medical" },
  { id: "charging", label: "EV charging" },
];

const RADII = [500, 1000, 2000, 5000, 10000];

const PlacesNearbyPanel = ({ open, onClose, center, units, onResults, onFocus, onRoute }: Props) => {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("any");
  const [radiusM, setRadiusM] = useState(2000);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const run = useCallback(async (cat: PlaceCategory, query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const res = await searchNearby({
        center, query, category: cat, radiusM, openNowOnly, limit: 40, signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      setPlaces(res);
      onResultsRef.current(res);
      if (!res.length) setError("Nothing matched inside this radius. Widen it, or drop the open-now filter.");
    } catch (e: any) {
      if (!ctrl.signal.aborted) setError(e?.message || "Search failed.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, [center, radiusM, openNowOnly]);

  const runRef = useRef(run);
  runRef.current = run;

  /* Opening the panel IS the request. The old build rendered an empty shell
     and waited for a chip click, which reads as a dead tool. A broad sweep of
     the current anchor runs on open; chips then narrow it. */
  useEffect(() => {
    if (!open) return;
    runRef.current("any", "");
    // Keyed on `open` only — re-running on every parent repaint would hammer
    // the Overpass mirrors and trip their rate limiter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!open) return null;


  return (
    <div className="flex max-h-[calc(100vh-8rem)] w-[340px] flex-col overflow-hidden rounded-xl border border-[#c98b3a]/25 bg-card/95 backdrop-blur-xl shadow-[0_18px_50px_-12px_rgba(0,0,0,.85)]">
      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2.5">
        <Utensils className="h-4 w-4 text-[#c98b3a]" strokeWidth={1.6} />
        <p className="flex-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Explore nearby</p>
        <button onClick={onClose} aria-label="Close nearby search" className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 border-b border-border/15 px-3 py-2.5">
        <div className="flex items-center gap-1.5 rounded-md border border-border/25 bg-background/60 px-2 py-1.5">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setCategory("any"); run("any", q); } }}
            placeholder="Search this area…"
            className="flex-1 bg-transparent text-[11px] font-light text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCategory(c.id); setQ(""); run(c.id, ""); }}
              className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] transition-colors ${
                category === c.id ? "border-[#c98b3a]/50 bg-[#c98b3a]/10 text-[#e0a955]" : "border-border/25 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
            aria-label="Search radius"
            className="rounded border border-border/25 bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground outline-none"
          >
            {RADII.map((r) => <option key={r} value={r}>{fmtDistance(r, units)}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input type="checkbox" checked={openNowOnly} onChange={(e) => setOpenNowOnly(e.target.checked)} className="accent-[#c98b3a]" />
            Open now
          </label>
          <button
            onClick={() => run(category, q)}
            disabled={busy}
            className="ml-auto rounded-md border border-[#c98b3a]/40 bg-[#c98b3a]/10 px-2 py-1 text-[10px] text-[#e0a955] hover:bg-[#c98b3a]/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : "Search"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {busy && !places.length && (
          <div className="space-y-2 p-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-md bg-foreground/5 motion-reduce:animate-none" />)}
          </div>
        )}
        {error && <p role="alert" className="px-3 py-3 text-[10px] leading-snug text-amber-400">{error}</p>}

        {places.map((p) => (
          <div key={p.id} className="border-b border-border/10 px-3 py-2 hover:bg-foreground/5">
            <button onClick={() => onFocus(p)} className="w-full text-left">
              <p className="text-[12px] font-medium text-foreground">{p.name}</p>
              <p className="text-[10px] font-light text-muted-foreground">
                {p.category.replace(/_/g, " ")} · {fmtDistance(p.distanceM, units)}
                {p.cuisine ? ` · ${p.cuisine.replace(/;/g, ", ")}` : ""}
              </p>
              {p.address && <p className="mt-0.5 text-[10px] font-light text-muted-foreground/80">{p.address}</p>}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {p.openNow !== null && (
                <span className={`flex items-center gap-1 text-[9px] ${p.openNow ? "text-emerald-400" : "text-red-400"}`}>
                  <Clock className="h-2.5 w-2.5" />{p.openNow ? "Open now" : "Closed"}
                </span>
              )}
              {p.openNow === null && p.openingHours === undefined && (
                <span className="text-[9px] text-muted-foreground/60">Hours not published</span>
              )}
              {p.phone && (
                <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground">
                  <Phone className="h-2.5 w-2.5" />Call
                </a>
              )}
              {p.website && (
                <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground">
                  <Globe className="h-2.5 w-2.5" />Site
                </a>
              )}
              <button onClick={() => onRoute(p)} className="flex items-center gap-1 text-[9px] text-[#c98b3a] hover:text-[#e0a955]">
                <Navigation className="h-2.5 w-2.5" />Directions
              </button>
              <a
                href={streetViewUrl(p.lat, p.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground"
              >
                <Eye className="h-2.5 w-2.5" />Street view
              </a>
            </div>
          </div>
        ))}
      </div>

      <p className="border-t border-border/15 px-3 py-1.5 text-[9px] text-muted-foreground/60">
        Live OpenStreetMap / Overpass. Hours, phone and site appear only when the source publishes them.
      </p>
    </div>
  );
};

export default PlacesNearbyPanel;
