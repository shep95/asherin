import { useState } from "react";
import {
  MapPin, Navigation, Home, Building2, Coffee, Plane, TrendingUp,
  Clock, AlertTriangle, Sun, CloudRain, Compass, Target, Route,
} from "lucide-react";

const mockPredictions = [
  { day: "Monday", confidence: 94, schedule: [
    { time: "7:00–9:00", location: "Home", icon: Home },
    { time: "9:00–9:45", location: "Commute (Transit)", icon: Navigation },
    { time: "9:45–12:30", location: "Office", icon: Building2 },
    { time: "12:30–1:15", location: "Lunch Spot", icon: Coffee },
    { time: "1:15–6:30", location: "Office", icon: Building2 },
    { time: "6:30–7:45", location: "Gym", icon: Target },
    { time: "7:45–7:00", location: "Home", icon: Home },
  ]},
  { day: "Tuesday", confidence: 87, schedule: [
    { time: "7:00–9:00", location: "Home", icon: Home },
    { time: "9:00–6:00", location: "Office", icon: Building2 },
    { time: "6:00–7:30", location: "Home", icon: Home },
  ]},
  { day: "Wednesday", confidence: 91, schedule: [
    { time: "7:00–9:00", location: "Home", icon: Home },
    { time: "9:00–2:00", location: "Office", icon: Building2 },
    { time: "2:00–5:00", location: "Client Site", icon: Compass },
    { time: "5:00–7:00", location: "Home", icon: Home },
  ]},
  { day: "Saturday", confidence: 71, schedule: [
    { time: "10:00–11:30", location: "Gym (65%)", icon: Target },
    { time: "12:00–5:00", location: "Unpredictable (errands)", icon: Route },
    { time: "7:00–11:00", location: "Nightlife (40%)", icon: Coffee },
  ]},
];

const patterns = [
  { icon: Coffee, text: "You visit your favorite coffee shop 4.2× per week" },
  { icon: CloudRain, text: "Commute time increases by 12 min when it rains" },
  { icon: Sun, text: "You're 3× more likely to go to gym on sunny days" },
  { icon: Plane, text: "Next predicted vacation: June 2026 (annual pattern)" },
  { icon: Home, text: "Every 3rd Friday, you visit family (89% consistency)" },
];

const stats = [
  { label: "Total Locations", value: "142,847" },
  { label: "Countries", value: "14" },
  { label: "Total Distance", value: "287K km" },
  { label: "Prediction Accuracy", value: "91%" },
];

const LocationProphet = () => {
  const [selectedDay, setSelectedDay] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <MapPin className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Location Prophet</h2>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              Analyzes 5+ years of location history — predicts where you'll be next week with 95% accuracy.
              Maps your entire life journey and detects patterns you don't even know you have.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
            <p className="text-xl font-extralight text-foreground">{s.value}</p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Predictions */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <Compass className="h-4 w-4" /> Next 7 Days Prediction
        </h3>
        <div className="flex gap-2 flex-wrap">
          {mockPredictions.map((p, i) => (
            <button
              key={p.day}
              onClick={() => setSelectedDay(i)}
              className={`rounded-xl px-3 py-2 text-xs font-light transition-all ${
                selectedDay === i
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {p.day}
              <span className="ml-1.5 text-[10px] text-muted-foreground/50">{p.confidence}%</span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {mockPredictions[selectedDay].schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
              <s.icon className="h-4 w-4 text-foreground/50 shrink-0" />
              <span className="text-xs font-light text-muted-foreground w-24 shrink-0">{s.time}</span>
              <span className="text-xs font-light text-foreground">{s.location}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Discovered Patterns */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Discovered Patterns
        </h3>
        <div className="space-y-2">
          {patterns.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <p.icon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-xs font-extralight text-muted-foreground">{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder Map */}
      <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
        <MapPin className="h-10 w-10 text-muted-foreground/20 mx-auto" />
        <p className="text-sm font-extralight text-muted-foreground/50">
          Interactive location heatmap & route visualization
        </p>
        <p className="text-[10px] font-extralight text-muted-foreground/30">
          Connect Google account to populate with real location data
        </p>
      </div>
    </div>
  );
};

export default LocationProphet;
