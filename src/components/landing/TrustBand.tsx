import { Search, TrendingUp, Scale, ShieldAlert, FileSearch, Eye, Lock, Activity } from "lucide-react";

const USE_CASES = [
  { icon: Search, label: "OSINT" },
  { icon: TrendingUp, label: "Trading" },
  { icon: Scale, label: "Legal Discovery" },
  { icon: ShieldAlert, label: "Threat Intel" },
  { icon: FileSearch, label: "Forensics" },
  { icon: Eye, label: "Surveillance" },
  { icon: Lock, label: "Cyber Defense" },
  { icon: Activity, label: "Predictive Analytics" },
];

const TrustBand = () => {
  return (
    <div className="relative z-10 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[10px] font-medium tracking-[0.3em] text-muted-foreground/50 uppercase mb-8">
          Operators run Aureon for
        </p>

        {/* Marquee */}
        <div className="relative overflow-hidden mask-fade">
          <div className="flex gap-10 animate-marquee whitespace-nowrap">
            {[...USE_CASES, ...USE_CASES, ...USE_CASES].map((u, i) => {
              const Icon = u.icon;
              return (
                <div key={i} className="inline-flex items-center gap-2.5 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground/60" />
                  <span className="text-sm font-light tracking-[0.2em] text-foreground/80 uppercase">{u.label}</span>
                  <span className="text-foreground/20 text-lg leading-none">·</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Anchor testimonial */}
        <div className="mt-14 max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-border/30 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12 sm:py-12">
            <div className="absolute -top-3 left-8 px-3 py-1 rounded-full border border-border/30 bg-background/80 backdrop-blur text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70">
              Beta Operator
            </div>
            <p className="text-lg sm:text-2xl font-extralight leading-relaxed tracking-wide text-foreground/90 italic">
              "Every other model gave me caveats. Aureon gave me a forensic dossier — sourced, ranked,
              cross-validated, and ready to brief. Two hours of OSINT in twelve minutes."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-foreground/10 border border-border/30 flex items-center justify-center text-[10px] tracking-[0.2em] text-foreground/70">
                D.K.
              </div>
              <div>
                <p className="text-xs font-light tracking-wide text-foreground">Independent Investigator</p>
                <p className="text-[10px] tracking-wider text-muted-foreground/60 uppercase">Pro Tier · 6 months</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustBand;
