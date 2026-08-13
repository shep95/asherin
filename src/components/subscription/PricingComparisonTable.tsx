import { useState } from "react";
import { Check, X, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const tiers = [
  { id: "aureon", name: "Asherin", price: "$18", period: "/month", highlight: false, tagline: "Core" },
  { id: "pro", name: "Asherin Pro", price: "$399", period: "/month", highlight: true, tagline: "Full Suite" },
  { id: "enterprise", name: "Enterprise", price: "Custom", period: "", highlight: false, tagline: "Org" },
];

type Cell = boolean | string;
type Feature = {
  name: string;
  desc: string;
  aureon: Cell;
  pro: Cell;
  enterprise: Cell;
};

const features: Feature[] = [
  // Core Chat + Modes
  { name: "Chat Mode", desc: "Conversational AI for general questions, research and synthesis.", aureon: true, pro: true, enterprise: true },
  { name: "Code Mode", desc: "Elite coding engine — architecture-level reasoning, multi-file edits, no circular debug loops.", aureon: true, pro: true, enterprise: true },
  { name: "Research Mode", desc: "Long-form research workflow with live citations and multi-source synthesis.", aureon: true, pro: true, enterprise: true },
  { name: "Truth Mode", desc: "Adversarial truth-extraction with cross-validation across multiple frontier models.", aureon: true, pro: true, enterprise: true },

  // Core Capabilities
  { name: "Direct answers", desc: "Analytical answers without corporate hedging. Model behaviour depends on the provider you route to — Gemini by default, Venice mistral-31-24b on the platform fallback, or your own key.", aureon: true, pro: true, enterprise: true },
  { name: "Elite coding engine", desc: "Production-grade code with full repository context, refactoring and verification.", aureon: true, pro: true, enterprise: true },
  { name: "Multi-language output", desc: "Generate output in any major spoken or programming language at identical quality.", aureon: true, pro: true, enterprise: true },
  { name: "Response depth control", desc: "Pick concise, standard or maximum-depth answers per turn.", aureon: true, pro: true, enterprise: true },

  // Zophiel Search
  { name: "Zophiel Search (Base)", desc: "Real-time web search with standard recency and basic query limits.", aureon: true, pro: false, enterprise: false },
  { name: "Zophiel Search (Pro)", desc: "Higher query limits, deeper crawling, broader source coverage and priority latency.", aureon: false, pro: true, enterprise: true },

  // Productivity
  { name: "Code snippets library", desc: "Save, tag and reuse code snippets across projects and conversations.", aureon: true, pro: true, enterprise: true },
  { name: "Keyboard shortcuts / command palette", desc: "⌘K command palette and full keyboard shortcut set.", aureon: true, pro: true, enterprise: true },

  // Workspace + Collaboration
  { name: "Team workspace", desc: "Asherin: limited workspace with basic sharing. Pro: full team workspace with shared threads, outputs, admin controls.", aureon: "Limited", pro: "Full", enterprise: "Full + SSO" },
  { name: "Basic sharing / collaboration", desc: "Share threads and outputs with teammates.", aureon: true, pro: true, enterprise: true },
  { name: "Admin controls", desc: "Workspace-level permissions, role-based access, member management.", aureon: false, pro: true, enterprise: true },

  // Memory + Privacy
  { name: "Persistent memory", desc: "Long-term recall across sessions. Standard limits on Asherin, expanded on Pro and Enterprise.", aureon: "Standard", pro: "Expanded", enterprise: "Unlimited" },
  { name: "End-to-end encryption", desc: "AES-256-GCM in transit and at rest. Only you can read your conversations.", aureon: true, pro: true, enterprise: true },
  { name: "Delete + export anytime", desc: "Export your entire workspace or wipe it permanently in one click.", aureon: true, pro: true, enterprise: true },

  // Usage
  { name: "Messages per 3-hour window", desc: "How many messages you can send in a rolling 3-hour window.", aureon: "60", pro: "200", enterprise: "Custom" },

  // Pro modules
  { name: "Azplen Data Intelligence Platform", desc: "Ingestion + analysis workflows, entity resolution, workflow automation, scenario simulation, threat modeling.", aureon: false, pro: true, enterprise: true },
  { name: "Intelligence Briefings (Advanced)", desc: "Daily briefings with industry customization.", aureon: false, pro: true, enterprise: true },
  { name: "AXRLEN — Predictive Intelligence", desc: "Predictive probabilistic scenarios with Monte Carlo modeling and multi-side research.", aureon: false, pro: true, enterprise: true },
  { name: "ZEEION FI — Financial Intelligence", desc: "Live-source financial tracking, dispute resolution and workforce optimization analytics.", aureon: false, pro: true, enterprise: true },
  { name: "ZERLAL — Cyber Security", desc: "Vulnerability scanning, infrastructure recon, exploit intelligence and Cyber Kill Chain analysis.", aureon: false, pro: true, enterprise: true },
  { name: "ZANOEM Design Lab", desc: "Generative material and assembly design written as an engineering brief. No solver on board — not FEA, thermal or CFD.", aureon: false, pro: true, enterprise: true },
  { name: "Automated Agents", desc: "Scheduled autonomous tasks with multi-channel webhook delivery and retry logic.", aureon: false, pro: true, enterprise: true },
  { name: "Asherin IDE", desc: "Full in-browser Monaco IDE with AI pair-programming and sandboxed execution.", aureon: false, pro: true, enterprise: true },

  // Enterprise-only
  { name: "SSO / SAML", desc: "Single sign-on via your corporate identity provider.", aureon: false, pro: false, enterprise: true },
  { name: "Org policy controls", desc: "Org-wide policy enforcement (model allowlists, redaction rules, retention).", aureon: false, pro: false, enterprise: true },
  { name: "Audit logs + retention controls", desc: "Immutable audit trail with configurable retention for compliance and forensics.", aureon: false, pro: false, enterprise: true },
  { name: "Dedicated capacity", desc: "Dedicated compute and rate limits, isolated from shared tiers.", aureon: false, pro: false, enterprise: true },
  { name: "Custom SLAs", desc: "Negotiated uptime, response-time and support SLAs.", aureon: false, pro: false, enterprise: true },
];

const FeatureLabel = ({ name, desc }: { name: string; desc: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="group inline-flex items-center gap-1.5 text-left text-sm font-extralight text-foreground hover:text-foreground/90 cursor-help focus:outline-none"
          aria-label={`${name} — tap for details`}
        >
          <span className="border-b border-dotted border-border/40 group-hover:border-border/70">
            {name}
          </span>
          <Info className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-72 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground/70 uppercase mb-2">
          {name}
        </p>
        <p className="text-xs font-extralight leading-relaxed text-foreground/90">
          {desc}
        </p>
      </PopoverContent>
    </Popover>
  );
};

const renderCell = (val: Cell, accent = false) => {
  if (val === true) return <Check className={`h-4 w-4 ${accent ? "text-accent" : "text-emerald-400"}`} />;
  if (val === false) return <X className="h-4 w-4 text-muted-foreground/30" />;
  return <span className="text-xs font-light text-foreground">{val}</span>;
};

const PricingComparisonTable = () => {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[760px]">
        {/* Header Row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
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
                {tier.tagline}
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
              {tier.id === "enterprise" ? (
                <a
                  href="mailto:asher@asherin.com?subject=Asherin%20Enterprise%20Inquiry"
                  className="block w-full rounded-lg py-2.5 text-xs font-light tracking-wide transition-all border border-foreground/30 text-foreground hover:bg-foreground/5"
                >
                  Contact sales
                </a>
              ) : (
                <Link
                  to="/dashboard"
                  className={`block w-full rounded-lg py-2.5 text-xs font-light tracking-wide transition-all ${
                    tier.highlight
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  }`}
                >
                  Subscribe
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Feature Rows */}
        <div className="space-y-2">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="grid grid-cols-4 gap-3 items-center rounded-lg border border-border/10 bg-card/10 backdrop-blur-sm p-4"
            >
              <div className="col-span-1">
                <FeatureLabel name={feature.name} desc={feature.desc} />
              </div>
              <div className="flex justify-center">{renderCell(feature.aureon)}</div>
              <div className="flex justify-center">{renderCell(feature.pro, true)}</div>
              <div className="flex justify-center">{renderCell(feature.enterprise)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingComparisonTable;
