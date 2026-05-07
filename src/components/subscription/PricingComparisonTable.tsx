import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";

const tiers = [
  { id: "lifetime", name: "Lifetime", price: "$740", period: "one-time", highlight: true },
  { id: "chat", name: "Chat", price: "$47", period: "/month", highlight: false },
  { id: "aureon", name: "Aureon", price: "$199", period: "/month", highlight: false },
  { id: "pro", name: "Pro", price: "$740", period: "/month", highlight: false },
];

const features = [
  { name: "Uncensored AI chat", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Messages per 3-hour window", chat: "Unlimited", aureon: "Unlimited", pro: "Unlimited", lifetime: "Unlimited" },
  { name: "Bring Your Own AI Key", chat: "Required", aureon: "Required", pro: "Required", lifetime: "Required" },
  { name: "End-to-end encryption", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Zophiel Search Engine", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Intelligence Notebooks", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "PDF Generator", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Slideshow Generator", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "E-Book Generator", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Zahten Agent Forge", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Guardian Vault", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Aureon IDE", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Persistent memory", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Code Snippets Vault", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Custom Personas", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Vibe Imager", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Imagine To Code", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Reverse Engineering", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "File Scrapper", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Cipher Toolkit", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Whiteboard", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "NOMAD Public Intelligence", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Daily Intelligence Briefings", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "ZANOEM Design Lab", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Vedic Strategy", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Memory Center", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Persona Store", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Projects Workspace", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Library", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "My Stats", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Self-Access Learning", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Bug Reports", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Google Intelligence Suite", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Azplen Data Intelligence", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Pattern Analysis Engine", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Time-Series Intelligence", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Geospatial Analysis", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Video Intelligence", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Vibe Video", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Cross — Live Screen Intelligence", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Lavba Strategy Engine", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Team Workspace (RBAC)", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Plugin Marketplace", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Security Dashboard", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Audit Trail", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Automated Agents", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "AXRLEN — Predictive Intelligence", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "ZEEION FI — Financial Intelligence", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "ZERLAL — Cyber Security", chat: false, aureon: false, pro: true, lifetime: false },
];

const PricingComparisonTable = () => {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header Row */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="col-span-1" />
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-xl border backdrop-blur-md p-6 text-center ${
                tier.highlight
                  ? "border-accent/30 bg-accent/5"
                  : "border-border/20 bg-card/30"
              }`}
            >
              <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase mb-2">
                {tier.id === "lifetime" ? "Best Value" : tier.id === "pro" ? "Full Suite" : ""}
              </p>
              <h3 className="text-lg font-light tracking-[0.15em] text-foreground mb-3">
                {tier.name}
              </h3>
              <div className="flex items-baseline justify-center gap-1 mb-4">
                <span className="text-3xl font-extralight tracking-tight text-foreground">
                  {tier.price}
                </span>
                <span className="text-sm text-muted-foreground font-extralight">
                  {tier.period}
                </span>
              </div>
              <Link
                to="/dashboard"
                className={`block w-full rounded-lg py-2.5 text-xs font-light tracking-wide transition-all ${
                  tier.highlight
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
              >
                Get Access
              </Link>
            </div>
          ))}
        </div>

        {/* Feature Rows */}
        <div className="space-y-2">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="grid grid-cols-5 gap-3 items-center rounded-lg border border-border/10 bg-card/10 backdrop-blur-sm p-4"
            >
              <div className="col-span-1 text-sm font-extralight text-foreground">
                {feature.name}
              </div>
              <div className="flex justify-center">
                {feature.lifetime === true ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : feature.lifetime === false ? (
                  <X className="h-4 w-4 text-muted-foreground/30" />
                ) : (
                  <span className="text-xs font-light text-foreground">{feature.lifetime}</span>
                )}
              </div>
              <div className="flex justify-center">
                {feature.chat === true ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : feature.chat === false ? (
                  <X className="h-4 w-4 text-muted-foreground/30" />
                ) : (
                  <span className="text-xs font-light text-foreground">{feature.chat}</span>
                )}
              </div>
              <div className="flex justify-center">
                {feature.aureon === true ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : feature.aureon === false ? (
                  <X className="h-4 w-4 text-muted-foreground/30" />
                ) : (
                  <span className="text-xs font-light text-foreground">{feature.aureon}</span>
                )}
              </div>
              <div className="flex justify-center">
                {feature.pro === true ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : feature.pro === false ? (
                  <X className="h-4 w-4 text-muted-foreground/30" />
                ) : (
                  <span className="text-xs font-light text-foreground">{feature.pro}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingComparisonTable;
