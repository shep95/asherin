import { useState } from "react";
import {
  Mail, Calendar, DollarSign, Cake, MapPin, Car, Cloud,
  Moon, UtensilsCrossed, Dumbbell, Brain, ToggleRight,
  ToggleLeft, ChevronRight, Zap,
} from "lucide-react";

interface Automation {
  icon: React.ElementType;
  name: string;
  desc: string;
  trigger: string;
  enabled: boolean;
}

const defaultAutomations: Automation[] = [
  { icon: Mail, name: "Email Auto-Responder", desc: "Auto-replies to emails from priority contacts in your style", trigger: "New email from priority contact", enabled: true },
  { icon: Calendar, name: "Smart Calendar Blocker", desc: "Auto-blocks focus time based on your productivity patterns", trigger: "Monday mornings reserved for deep work", enabled: true },
  { icon: DollarSign, name: "Bill Payment Reminder", desc: "Alerts 3 days before subscription charges", trigger: "3 days before subscription charge", enabled: true },
  { icon: Cake, name: "Birthday Auto-Greeter", desc: "Sends personalized birthday messages to contacts", trigger: "Friend's birthday detected", enabled: false },
  { icon: MapPin, name: "Location-Based Reminders", desc: "Triggers tasks at specific locations", trigger: "When near grocery store", enabled: false },
  { icon: Car, name: "Commute Optimizer", desc: "Suggests best departure time based on traffic + meetings", trigger: "Meeting in 2 hours", enabled: true },
  { icon: Cloud, name: "Weather-Based Suggester", desc: "Adjusts plans based on weather forecasts", trigger: "80% rain chance → bring umbrella", enabled: false },
  { icon: Moon, name: "Sleep Schedule Optimizer", desc: "Suggests optimal bedtime based on next-day schedule", trigger: "8am meeting → sleep by 10:30pm", enabled: true },
  { icon: UtensilsCrossed, name: "Meal Planning Assistant", desc: "Suggests meals based on your eating patterns", trigger: "Lunchtime on weekdays", enabled: false },
  { icon: Dumbbell, name: "Workout Scheduler", desc: "Suggests optimal workout times from fitness patterns", trigger: "Mon/Wed/Fri 6:30pm (your pattern)", enabled: true },
  { icon: Brain, name: "Stress Relief Trigger", desc: "Suggests breaks when high stress is detected", trigger: "Email volume + meeting density spike", enabled: true },
];

const AutomationSuite = () => {
  const [automations, setAutomations] = useState(defaultAutomations);

  const toggleAutomation = (name: string) => {
    setAutomations((prev) =>
      prev.map((a) => a.name === name ? { ...a, enabled: !a.enabled } : a)
    );
  };

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
          <Zap className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="space-y-1 flex-1">
          <h3 className="text-sm font-light tracking-wide text-foreground">Life Automation Suite</h3>
          <p className="text-[10px] font-extralight text-muted-foreground">
            {enabledCount} of {automations.length} automations active · Saves ~10+ hrs/week
          </p>
        </div>
      </div>

      {/* Daily Automation Preview */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground">Today's Automation Timeline</h3>
        <div className="space-y-2">
          {[
            { time: "6:30 AM", event: "Wake Up", detail: "Slept 7.8 hrs · Leave by 8:15am · 6 meetings today" },
            { time: "8:00 AM", event: "Email Priority", detail: "3 critical emails · Auto-draft ready for boss · 42 newsletters moved" },
            { time: "8:15 AM", event: "Commute Alert", detail: "L train (23 min) · Podcast downloaded · Coffee reminder" },
            { time: "12:00 PM", event: "Payment Alert", detail: "Netflix $15.99 tomorrow · Balance sufficient" },
            { time: "6:30 PM", event: "Workout Reminder", detail: "Upper body day · Equinox on 14th St" },
            { time: "10:00 PM", event: "Sleep Reminder", detail: "9am meeting tomorrow · Bed by 10:30pm" },
          ].map((item) => (
            <div key={item.time} className="flex gap-3 py-1.5">
              <span className="text-[10px] font-light text-foreground/40 w-16 shrink-0">{item.time}</span>
              <div className="w-px bg-foreground/10 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-light text-foreground">{item.event}</span>
                <p className="text-[10px] font-extralight text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automation Toggles */}
      <div className="space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground">All Automations</h3>
        <div className="space-y-2">
          {automations.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 hover:bg-foreground/5 transition-all"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <a.icon className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <span className="text-xs font-light text-foreground">{a.name}</span>
                <p className="text-[10px] font-extralight text-muted-foreground">{a.desc}</p>
                <p className="text-[9px] font-extralight text-muted-foreground/40">Trigger: {a.trigger}</p>
              </div>
              <button onClick={() => toggleAutomation(a.name)} className="shrink-0">
                {a.enabled ? (
                  <ToggleRight className="h-6 w-6 text-emerald-400" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-muted-foreground/30" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AutomationSuite;
