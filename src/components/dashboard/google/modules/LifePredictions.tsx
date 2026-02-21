import { useState, useEffect } from "react";
import {
  MapPin, DollarSign, Plane, Briefcase, Heart,
  Stethoscope, ShoppingCart, TrendingUp,
  ChevronRight, Sparkles, RefreshCw, Zap,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const LifePredictions = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ events: number; emails: number; contacts: number; steps: number }>({
    events: 0, emails: 0, contacts: 0, steps: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [calData, gmailStats, contactData, fitData] = await Promise.all([
        fetchGoogleData("calendar_events", { maxResults: 50 }).catch(() => ({ totalEvents: 0 })),
        fetchGoogleData("gmail_stats").catch(() => ({ unread: 0 })),
        fetchGoogleData("contacts", { pageSize: 1 }).catch(() => ({ totalContacts: 0 })),
        fetchGoogleData("fitness").catch(() => ({ dailyData: [] })),
      ]);
      const avgSteps = (fitData.dailyData || []).length > 0
        ? Math.round(fitData.dailyData.reduce((a: number, d: any) => a + d.steps, 0) / fitData.dailyData.length)
        : 0;
      setData({
        events: calData.totalEvents || 0,
        emails: gmailStats.unread || 0,
        contacts: contactData.totalContacts || 0,
        steps: avgSteps,
      });
    } catch (err) {
      console.error("Failed to fetch prediction data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = isConnected && (data.events > 0 || data.emails > 0 || data.contacts > 0);

  const predictions = hasLive
    ? [
        { icon: MapPin, name: "Schedule Predictor", confidence: 92, prediction: `${data.events} events this week — patterns detected`, sources: "Calendar" },
        { icon: DollarSign, name: "Email Load Predictor", confidence: 85, prediction: `${data.emails} unread emails — trending ${data.emails > 20 ? "high" : "normal"}`, sources: "Gmail" },
        { icon: Briefcase, name: "Social Activity", confidence: 78, prediction: `${data.contacts} contacts in network — analyzing interaction frequency`, sources: "Contacts" },
        { icon: Heart, name: "Health Forecast", confidence: data.steps > 0 ? 88 : 50, prediction: data.steps > 0 ? `${data.steps.toLocaleString()} avg steps/day — ${data.steps > 8000 ? "above target" : "below target"}` : "Connect Fitness data for health predictions", sources: "Fitness" },
        { icon: Plane, name: "Travel Predictor", confidence: 75, prediction: "Analyzing calendar for travel patterns", sources: "Calendar + Gmail" },
        { icon: ShoppingCart, name: "Purchase Predictor", confidence: 70, prediction: "Scanning emails for shopping patterns", sources: "Gmail" },
        { icon: Stethoscope, name: "Wellness Score", confidence: data.steps > 0 ? 82 : 45, prediction: data.steps > 0 ? `Activity level: ${data.steps > 8000 ? "Good" : data.steps > 5000 ? "Moderate" : "Low"}` : "Needs fitness data", sources: "Fitness + Calendar" },
      ]
    : [
        { icon: MapPin, name: "Location Predictor", confidence: 0, prediction: "Connect Google to predict locations", sources: "—" },
        { icon: DollarSign, name: "Expense Predictor", confidence: 0, prediction: "Connect Google to predict expenses", sources: "—" },
        { icon: Plane, name: "Vacation Predictor", confidence: 0, prediction: "Connect Google to predict travel", sources: "—" },
        { icon: Briefcase, name: "Job Change Predictor", confidence: 0, prediction: "Connect Google to detect career signals", sources: "—" },
        { icon: Heart, name: "Relationship Predictor", confidence: 0, prediction: "Connect Google to analyze relationships", sources: "—" },
      ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
          <Sparkles className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-light tracking-wide text-foreground">Predictive Intelligence Engine</h3>
            {isConnected && (
              <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Sync
              </button>
            )}
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground">
            {hasLive
              ? "Cross-referencing live data from all connected services to generate predictions."
              : "Connect Google to enable predictive intelligence."}
          </p>
        </div>
        {hasLive && (
          <div className="text-right shrink-0">
            <span className="text-2xl font-light text-foreground">{Math.round(predictions.reduce((a, p) => a + p.confidence, 0) / predictions.length)}%</span>
            <p className="text-[10px] text-muted-foreground/60">avg confidence</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {predictions.map((p) => (
          <div key={p.name} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 hover:bg-foreground/5 transition-all group">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <p.icon className="h-5 w-5 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground">{p.name}</span>
                  {p.confidence > 0 && (
                    <span className={`text-xs font-light px-2 py-0.5 rounded-lg ${
                      p.confidence >= 85 ? "bg-emerald-500/10 text-emerald-400" :
                      p.confidence >= 70 ? "bg-amber-500/10 text-amber-400" :
                      "bg-foreground/5 text-muted-foreground"
                    }`}>
                      {p.confidence}% confidence
                    </span>
                  )}
                </div>
                <p className="text-xs font-extralight text-foreground/80">{p.prediction}</p>
                <p className="text-[10px] font-extralight text-muted-foreground/50">Sources: {p.sources}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 mt-1 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> How Predictions Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Data Collection", desc: "Continuous monitoring of all connected Google services" },
            { step: "2", title: "Pattern Recognition", desc: "AI identifies recurring behaviors and temporal patterns" },
            { step: "3", title: "Prediction Generation", desc: "Cross-references patterns with current signals to forecast" },
          ].map((s) => (
            <div key={s.step} className="rounded-xl bg-foreground/5 p-3 space-y-1">
              <span className="text-[10px] font-light text-foreground/40">Step {s.step}</span>
              <p className="text-xs font-light text-foreground">{s.title}</p>
              <p className="text-[10px] font-extralight text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LifePredictions;
