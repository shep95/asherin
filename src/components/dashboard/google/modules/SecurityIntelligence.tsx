import {
  Lock, AlertTriangle, Mail, Share2, MapPin, User,
  Globe, CreditCard, Shield, CheckCircle2, XCircle,
  ChevronRight,
} from "lucide-react";

const securityFeatures = [
  { icon: Lock, name: "Password Strength Checker", desc: "Analyzes password security from password-reset emails", severity: "medium", stat: "3 weak passwords found" },
  { icon: AlertTriangle, name: "Data Breach Detector", desc: "Checks if your email appeared in known breaches", severity: "high", stat: "Your email in 3 breaches" },
  { icon: Mail, name: "Phishing Detector", desc: "Identifies phishing and scam emails in your inbox", severity: "high", stat: "7 phishing attempts blocked" },
  { icon: Share2, name: "File Sharing Auditor", desc: "Checks for publicly shared files on Drive", severity: "medium", stat: "12 files shared publicly" },
  { icon: MapPin, name: "Location Privacy Monitor", desc: "Monitors location data shared in photos and posts", severity: "low", stat: "47 photos with public GPS" },
  { icon: User, name: "Identity Theft Monitor", desc: "Watches for signs of identity theft", severity: "low", stat: "No threats detected" },
  { icon: Globe, name: "Account Takeover Detector", desc: "Detects unauthorized login attempts", severity: "medium", stat: "1 unknown device login" },
  { icon: CreditCard, name: "Fraud Detector", desc: "Identifies fraudulent or unusual charges", severity: "low", stat: "All clear" },
];

const SecurityIntelligence = () => {
  const criticalCount = securityFeatures.filter((f) => f.severity === "high").length;
  const warningCount = securityFeatures.filter((f) => f.severity === "medium").length;

  return (
    <div className="space-y-6">
      {/* Security Score */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
          <Shield className="h-7 w-7 text-foreground/70" />
        </div>
        <div className="space-y-1 flex-1">
          <h3 className="text-sm font-light tracking-wide text-foreground">Security Score</h3>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-light text-foreground">72</span>
            <span className="text-xs text-muted-foreground/60">/100</span>
            <div className="flex gap-2 ml-4">
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400">{criticalCount} critical</span>
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400">{warningCount} warnings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Active Alerts
        </h3>
        <div className="space-y-2">
          {[
            { text: "Your email found in 3 data breaches — change passwords immediately", severity: "critical" },
            { text: "7 phishing emails detected this month — review flagged messages", severity: "critical" },
            { text: "Login from unknown device (Moscow, Russia) — was this you?", severity: "warning" },
            { text: "12 Drive files are shared publicly — review permissions", severity: "warning" },
          ].map((alert, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              {alert.severity === "critical" ? (
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span className="text-[11px] font-extralight text-muted-foreground">{alert.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* All Features */}
      <div className="space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground">Security Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {securityFeatures.map((f) => (
            <div
              key={f.name}
              className="flex items-start gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 hover:bg-foreground/5 transition-all group"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                f.severity === "high" ? "bg-red-500/10" :
                f.severity === "medium" ? "bg-amber-500/10" : "bg-foreground/5"
              }`}>
                <f.icon className={`h-4 w-4 ${
                  f.severity === "high" ? "text-red-400" :
                  f.severity === "medium" ? "text-amber-400" : "text-foreground/70"
                }`} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <span className="text-xs font-light text-foreground">{f.name}</span>
                <p className="text-[10px] font-extralight text-muted-foreground">{f.desc}</p>
                <span className="text-[10px] font-light text-foreground/50">{f.stat}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/50 mt-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Connected Apps Audit */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <Globe className="h-4 w-4" /> Connected Apps Audit
        </h3>
        <p className="text-[10px] font-extralight text-muted-foreground">
          Apps connected via "Sign in with Google" — OAuth scope analysis & risk scoring
        </p>
        <div className="space-y-1.5">
          {[
            { name: "Spotify", scopes: "Email, Profile", risk: "Low" },
            { name: "Notion", scopes: "Email, Profile, Drive", risk: "Medium" },
            { name: "Unknown App", scopes: "Email, Calendar, Contacts", risk: "High" },
          ].map((app) => (
            <div key={app.name} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
              <span className="text-xs font-light text-foreground">{app.name}</span>
              <span className="text-[10px] text-muted-foreground">{app.scopes}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-lg ${
                app.risk === "High" ? "bg-red-500/10 text-red-400" :
                app.risk === "Medium" ? "bg-amber-500/10 text-amber-400" :
                "bg-emerald-500/10 text-emerald-400"
              }`}>{app.risk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityIntelligence;
