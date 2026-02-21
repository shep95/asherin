import {
  MapPin, DollarSign, Plane, Briefcase, Home, Heart,
  GraduationCap, Stethoscope, ShoppingCart, TrendingUp,
  ChevronRight, Sparkles, AlertTriangle,
} from "lucide-react";

const predictions = [
  {
    icon: MapPin, name: "Location Predictor", confidence: 95,
    prediction: "Next Monday 10am: Office (Manhattan)",
    sources: "Maps + Calendar + Patterns",
  },
  {
    icon: DollarSign, name: "Expense Predictor", confidence: 88,
    prediction: "You'll spend $1,847 next month",
    sources: "Bank + Subscriptions + Patterns",
  },
  {
    icon: Plane, name: "Vacation Predictor", confidence: 89,
    prediction: "Europe trip — June 15-25, 2026",
    sources: "Calendar + Maps + Email (bookings)",
  },
  {
    icon: Briefcase, name: "Job Change Predictor", confidence: 73,
    prediction: "Job hunting activity detected",
    sources: "Resume updates + Recruiter emails",
  },
  {
    icon: Home, name: "Move Predictor", confidence: 62,
    prediction: "Apartment searching detected — move in 3-6 months",
    sources: "Maps + Search (apartments) + Gmail",
  },
  {
    icon: Heart, name: "Relationship Predictor", confidence: 67,
    prediction: "Engagement probability: 67% in next 6 months",
    sources: "Calendar + Location + Photos",
  },
  {
    icon: GraduationCap, name: "Life Event Predictor", confidence: 81,
    prediction: "Promotion likely in Q2 2026",
    sources: "All data sources",
  },
  {
    icon: Stethoscope, name: "Health Event Predictor", confidence: 78,
    prediction: "Doctor appointment predicted in 2 weeks",
    sources: "Fit + Calendar + Search",
  },
  {
    icon: ShoppingCart, name: "Purchase Predictor", confidence: 87,
    prediction: "New phone purchase in next 3 months",
    sources: "Search + Gmail (shopping)",
  },
];

const LifePredictions = () => {
  return (
    <div className="space-y-6">
      {/* Prediction Accuracy Banner */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
          <Sparkles className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-light tracking-wide text-foreground">Predictive Intelligence Engine</h3>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Cross-referencing all data sources to forecast your life events with up to 95% accuracy.
            Predictions improve over time as more data is collected.
          </p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <span className="text-2xl font-light text-foreground">95%</span>
          <p className="text-[10px] text-muted-foreground/60">peak accuracy</p>
        </div>
      </div>

      {/* Predictions List */}
      <div className="space-y-3">
        {predictions.map((p) => (
          <div
            key={p.name}
            className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 hover:bg-foreground/5 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <p.icon className="h-5 w-5 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground">{p.name}</span>
                  <span className={`text-xs font-light px-2 py-0.5 rounded-lg ${
                    p.confidence >= 85 ? "bg-emerald-500/10 text-emerald-400" :
                    p.confidence >= 70 ? "bg-amber-500/10 text-amber-400" :
                    "bg-foreground/5 text-muted-foreground"
                  }`}>
                    {p.confidence}% confidence
                  </span>
                </div>
                <p className="text-xs font-extralight text-foreground/80">{p.prediction}</p>
                <p className="text-[10px] font-extralight text-muted-foreground/50">Sources: {p.sources}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 mt-1 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Prediction Methodology */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> How Predictions Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Data Collection", desc: "Continuous monitoring of all connected Google services and patterns" },
            { step: "2", title: "Pattern Recognition", desc: "AI identifies recurring behaviors, habits, and temporal patterns" },
            { step: "3", title: "Prediction Generation", desc: "Cross-references patterns with current signals to forecast events" },
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
