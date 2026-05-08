import { useState } from "react";
import { Check, X, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const tiers = [
  { id: "lifetime", name: "Lifetime", price: "$470", period: "one-time", highlight: true },
  { id: "chat", name: "Chat", price: "$47", period: "/month", highlight: false },
  { id: "aureon", name: "Aureon", price: "$199", period: "/month", highlight: false },
  { id: "pro", name: "Pro", price: "$740", period: "/month", highlight: false },
];

type Feature = {
  name: string;
  desc: string;
  chat: boolean | string;
  aureon: boolean | string;
  pro: boolean | string;
  lifetime: boolean | string;
};

const features: Feature[] = [
  { name: "Uncensored AI chat", desc: "Direct, unfiltered AI conversations. No corporate hedging — answers stay surgical and on-mission.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Messages per 3-hour window", desc: "How many messages you can send in a rolling 3-hour window. Unlimited on every paid tier.", chat: "Unlimited", aureon: "Unlimited", pro: "Unlimited", lifetime: "Unlimited" },
  { name: "Bring Your Own AI Key", desc: "Use your own AI provider keys (OpenAI, Anthropic, Google, etc.). You control cost, vendor, and model.", chat: "Required", aureon: "Required", pro: "Required", lifetime: "Required" },
  { name: "End-to-end encryption", desc: "All conversation data is encrypted in transit and at rest. Only you can read it.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Zophiel Search Engine", desc: "30-source OSINT search with veracity scoring and cross-validation. Goes far beyond Google.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Intelligence Notebooks", desc: "Run live SQL, transform data, and build reusable analytical notebooks inside your workspace.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "PDF Generator", desc: "Turn any conversation, briefing, or notebook into a polished, paginated PDF report.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Slideshow Generator", desc: "Auto-build slide decks from prompts or research. Editable, exportable, presentation-ready.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "E-Book Generator", desc: "Compile multi-chapter books from your text uploads — covers, chapters, and exports included.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Zahten Agent Forge", desc: "Build autonomous agents with scheduled triggers, webhook delivery, and sandboxed execution.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Guardian Vault", desc: "Centralized security command center: TOTP MFA, key rotation, audit log, and threat alerts.", chat: true, aureon: true, pro: true, lifetime: true },
  { name: "Aureon IDE", desc: "Full in-browser IDE with AI pair-programming, file management, and sandboxed execution.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Persistent memory", desc: "The AI remembers your context, preferences, and prior work across sessions.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Code Snippets Vault", desc: "Save, tag, and reuse code snippets across all your projects and conversations.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Custom Personas", desc: "Create AI assistants with custom system prompts, tone, and specialized expertise.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Vibe Imager", desc: "Generate images from natural language prompts with style and composition control.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Imagine To Code", desc: "Turn screenshots, mockups, or sketches directly into working frontend code.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Reverse Engineering", desc: "Deconstruct architectures from images, video, or binaries into structured specs.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "File Scrapper", desc: "Extract clean text from any unstructured file (PDF, DOCX, images, scans) into searchable TXT.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Cipher Toolkit", desc: "Encrypt, decrypt, hash, and analyze ciphers — classical to modern cryptographic tooling.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Whiteboard", desc: "Infinite canvas with Photoshop-style layers, snap grids, and AI-assisted diagramming.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "NOMAD Public Intelligence", desc: "30-source OSINT investigation suite with persistent dossier trees and 14-pass deep analysis.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Daily Intelligence Briefings", desc: "Automated morning briefings on the topics, entities, and markets you track.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "ZANOEM Design Lab", desc: "AI-powered design lab from concept to engineering spec — materials, cost, and feasibility.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Vedic Strategy", desc: "Vedic astrology engine with company, country, and leader charts plus Dasha analysis.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Memory Center", desc: "Manage long-term recall: edit, prune, and calibrate what the AI remembers about you.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Persona Store", desc: "Browse, install, and share AI personas built by you and the community.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Projects Workspace", desc: "Group conversations, files, and assets into focused project folders with shared context.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Library", desc: "Central knowledge repository — store and search every document the AI can read from.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "My Stats", desc: "Personal usage analytics: tokens, sessions, costs, and productivity over time.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Self-Access Learning", desc: "AI-guided learning paths that adapt to your skill level and stated goals.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Bug Reports", desc: "Private, RLS-protected support channel — reports go directly to the engineering team.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "Google Intelligence Suite", desc: "Live OAuth 2.0 modules for Gmail, Drive, Calendar, and Takeout uploads.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Azplen Data Intelligence", desc: "20-tab data intelligence suite for structured analysis, joins, and reporting.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Pattern Analysis Engine", desc: "Pro-tier forecasting that surfaces hidden patterns with Recharts visualizations.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Time-Series Intelligence", desc: "Detect trends, anomalies, and seasonality across any time-series data you upload.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Geospatial Analysis", desc: "Map, cluster, and analyze location-based data with overlays and heat maps.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Video Intelligence", desc: "Frame-by-frame video analysis: objects, faces, micro-expressions, and behavior.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Vibe Video", desc: "Generate short-form video from prompts with stylistic and motion control.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Cross — Live Screen Intelligence", desc: "Live screen recording (WebM) with 17 analytical modes for real-time analysis.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Lavba Strategy Engine", desc: "Canvas-based strategy engine with fractal pattern discovery for market and ops modeling.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Team Workspace (RBAC)", desc: "Role-based team workspaces with shared case files, permissions, and collaborative editing.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Plugin Marketplace", desc: "Install third-party plugins with a live execution engine. Extend Aureon however you need.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Security Dashboard", desc: "Real-time security posture: signins, key activity, anomaly alerts, and policy controls.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Audit Trail", desc: "Immutable log of every action across your workspace for compliance and forensics.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "Automated Agents", desc: "Scheduled autonomous tasks with multi-channel webhook delivery and retry logic.", chat: false, aureon: false, pro: true, lifetime: false },
  { name: "AXRLEN — Predictive Intelligence", desc: "Zophiel Engine module — included in Aureon, Lifetime, and Pro tiers. Predictive probabilistic scenarios with Monte Carlo modeling and multi-side research.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "ZEEION FI — Financial Intelligence", desc: "Zophiel Engine module — included in Aureon, Lifetime, and Pro tiers. Live-source financial tracking, dispute resolution, and workforce optimization analytics.", chat: false, aureon: true, pro: true, lifetime: true },
  { name: "ZERLAL — Cyber Security", desc: "Zophiel Engine module — included in every paid tier. Vulnerability scanning, infrastructure recon, exploit intelligence, and Cyber Kill Chain analysis.", chat: true, aureon: true, pro: true, lifetime: true },
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
              <div className="col-span-1">
                <FeatureLabel name={feature.name} desc={feature.desc} />
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
