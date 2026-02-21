import { useState, useEffect } from "react";
import {
  MapPin, Navigation, Home, Building2, Coffee, Plane, TrendingUp,
  Clock, Sun, CloudRain, Compass, Target, Route, RefreshCw,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const LocationProphet = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const data = await fetchGoogleData("calendar_events", {
        timeMin: new Date(now.getTime() - 30 * 86400000).toISOString(),
        timeMax: new Date(now.getTime() + 7 * 86400000).toISOString(),
        maxResults: 100,
      });
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to fetch location data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = events.length > 0;
  const locatedEvents = events.filter((e) => e.location);
  const uniqueLocations = new Set(locatedEvents.map((e) => e.location));
  const upcomingWithLocation = events.filter((e) => new Date(e.start) > new Date() && e.location);

  const stats = hasLive
    ? [
        { label: "Events w/ Location", value: String(locatedEvents.length) },
        { label: "Unique Places", value: String(uniqueLocations.size) },
        { label: "Upcoming Locations", value: String(upcomingWithLocation.length) },
        { label: "Total Events", value: String(events.length) },
      ]
    : [
        { label: "Total Locations", value: "—" },
        { label: "Countries", value: "—" },
        { label: "Total Distance", value: "—" },
        { label: "Prediction Accuracy", value: "—" },
      ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <MapPin className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Location Prophet</h2>
              {isConnected && (
                <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  Sync
                </button>
              )}
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {isConnected
                ? "Live data connected — analyzing your calendar locations and movement patterns."
                : "Connect Google to analyze location history and predict where you'll be."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
            <p className="text-xl font-extralight text-foreground">{loading ? "…" : s.value}</p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Live Upcoming Locations */}
      {upcomingWithLocation.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Compass className="h-4 w-4" /> Upcoming Locations (Live)
          </h3>
          <div className="space-y-1.5">
            {upcomingWithLocation.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
                <MapPin className="h-4 w-4 text-foreground/50 shrink-0" />
                <span className="text-xs font-light text-muted-foreground w-32 shrink-0 truncate">
                  {new Date(e.start).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-xs font-light text-foreground truncate flex-1">{e.location}</span>
                <span className="text-[10px] text-muted-foreground/50 truncate max-w-[30%]">{e.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Frequent Locations */}
      {hasLive && locatedEvents.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Frequent Locations (Last 30 Days)
          </h3>
          <div className="space-y-2">
            {Array.from(
              locatedEvents.reduce((acc, e) => {
                const loc = e.location;
                acc.set(loc, (acc.get(loc) || 0) + 1);
                return acc;
              }, new Map<string, number>())
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([loc, count]) => (
                <div key={loc} className="flex items-center gap-3 py-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-xs font-extralight text-foreground flex-1 truncate">{loc}</span>
                  <span className="text-[10px] text-muted-foreground/50">{count}× visited</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {!hasLive && isConnected && !loading && (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <MapPin className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            No location data available — add locations to your calendar events to see insights here.
          </p>
        </div>
      )}
      {!isConnected && (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <MapPin className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            Connect Google to analyze location history and predict where you'll be.
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationProphet;
