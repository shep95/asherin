import { useEffect } from "react";
import { applySeoHead } from "@/lib/seoHead";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Brain, Code, Shield, Search, Eye, Newspaper, Users, Server,
  Lock, Zap, ArrowRight, MessageSquare, Layers, Database,
  Globe, Target, Download, RefreshCw, Check, Sparkles, FileText,
  Activity, Puzzle, ClipboardList, MapPin, TrendingUp, ArrowLeft,
} from "lucide-react";

/* ─── Tier config ─── */
const tiers = {
  aureon: { label: "Aureon — $199/mo", accent: "text-emerald-400/80", dot: "bg-emerald-400/70" },
  pro:    { label: "Pro — $740/mo", accent: "text-accent/80", dot: "bg-accent/70" },
} as const;

type Tier = keyof typeof tiers;

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  tier: Tier;
}

/* ─── Feature data ─── */
const features: Feature[] = [
  {
    icon: Brain,
    title: "Aureon AI Engine",
    description:
      "An uncensored, unfiltered intelligence engine powered by the Zophiel Ghost Chain Protocol — a multi-layer reasoning architecture that plans, critiques, and refines before responding. No corporate safety wrappers.",
    details: [
      "No refusals, no moralizing disclaimers",
      "Multi-step reasoning with internal chain-of-thought",
      "Calibration feedback loop — the AI adapts to you",
      "Context health tracking across long conversations",
      "Adjustable depth: shallow → standard → deep → expert",
    ],
    tier: "aureon",
  },
  {
    icon: Code,
    title: "Elite Coding Engine",
    description:
      "Production-grade code generation that outperforms leading models on real-world benchmarks. Multi-file architecture, debugging, refactoring — ships code that compiles on the first try.",
    details: [
      "Multi-file project awareness and architecture planning",
      "Inline code preview with syntax highlighting",
      "Debug, explain, optimize, and test — one click",
      "50+ languages and frameworks supported",
      "Copy-to-clipboard on every code block",
    ],
    tier: "aureon",
  },
  {
    icon: Shield,
    title: "End-to-End Encryption",
    description:
      "Every message is encrypted before it leaves your device. Your prompts are never stored as training data, never sold, and never used to improve any model. Privacy is the architecture.",
    details: [
      "Client-side encryption with per-user keys",
      "Zero-knowledge architecture — we can't read your data",
      "No prompt logging, no analytics on content",
      "Data deletion on demand — your data, your rules",
      "SOC 2 aligned security practices",
    ],
    tier: "aureon",
  },
  {
    icon: MessageSquare,
    title: "Multi-Persona System",
    description:
      "Switch between AI personalities tuned for different tasks. Create custom personas with specialized system prompts to shape how Aureon thinks, writes, and responds.",
    details: [
      "Built-in personas: Analyst, Coder, Writer, Strategist",
      "Unlimited custom personas with system prompts",
      "Persist across sessions via local storage",
      "One-click switch mid-conversation",
      "Persona context injected into every response",
    ],
    tier: "aureon",
  },
  {
    icon: Layers,
    title: "Persistent Memory",
    description:
      "Aureon remembers what matters across all sessions. The memory center stores facts, preferences, and context so you never repeat yourself. Your intelligence profile evolves with every interaction.",
    details: [
      "Cross-session memory with categorized entries",
      "Automatic trait inference from conversation patterns",
      "User Intelligence Profile — tone, depth, topic preferences",
      "Full CRUD management in memory center",
      "Context carries forward without manual re-prompting",
    ],
    tier: "aureon",
  },
  {
    icon: Lock,
    title: "Privacy-First Architecture",
    description:
      "No free tiers that harvest your data. No shadow training. No third-party analytics on your conversations. If you're not paying, you're the product — we don't operate that way.",
    details: [
      "Prompts never used for model training",
      "No third-party tracking or analytics on content",
      "Cancel anytime — one click, no questions",
      "Full data export for portability",
      "Account deletion permanently removes all data",
    ],
    tier: "aureon",
  },
  {
    icon: Search,
    title: "Zophiel Search Engine",
    description:
      "A privacy-first search intelligence engine with source credibility tiers. Every result ranked by reliability — academic papers, official docs, and verified sources surface first.",
    details: [
      "Source tiers: Verified → Established → Community → Unverified",
      "Instant answer cards for quick intelligence",
      "Full page preview without leaving the app",
      "Advanced search operators and filters",
      "Modes: Web, Academic, News, Code",
    ],
    tier: "aureon",
  },
  {
    icon: RefreshCw,
    title: "Live Web Search",
    description:
      "Real-time web search during any conversation. Current data, recent news, and up-to-the-minute information blended seamlessly into AI responses with source citations.",
    details: [
      "Contextually triggered real-time web search",
      "Source citations with clickable links",
      "Truth score indicators on every response",
      "Decode view — see reasoning behind any answer",
      "Follow-up suggestions generated from live data",
    ],
    tier: "aureon",
  },
  /* ─── Pro tier ─── */
  {
    icon: TrendingUp,
    title: "Predictive Intelligence",
    description:
      "AI-powered event forecasting that scans 100+ web sources for early signals — regulatory filings, insider activity, executive movements — and generates predictions with confidence scoring, reasoning chains, and estimated timelines.",
    details: [
      "Real-time signal detection across 100+ web sources",
      "19+ pre-configured signal definitions per event type",
      "Multi-factor confidence scoring model",
      "Full reasoning chain transparency for every prediction",
      "Event categories: regulatory, M&A, earnings, personnel, legal",
      "Historical backtesting for accuracy measurement",
    ],
    tier: "pro",
  },
  {
    icon: Newspaper,
    title: "Daily Intelligence Briefings",
    description:
      "Personalized AUREON MORNING BRIEFS synthesized from 100+ sources. AI-powered conversational onboarding extracts your business vectors — competitors, markets, tech stack — then delivers a structured report every morning.",
    details: [
      "Conversational profile setup — no forms",
      "Rolling 24–48 hour intelligence window",
      "Structured: Critical → Significant → Monitoring → Market Signals",
      "Unique headlines per briefing — never generic",
      "Download briefings as markdown files",
      "Configurable delivery time with timezone support",
    ],
    tier: "pro",
  },
  {
    icon: Download,
    title: "Conversation Export",
    description:
      "Download any conversation as structured markdown. Briefing reports fully exportable. Your intelligence output belongs to you — always.",
    details: [
      "One-click download of full chat history",
      "Briefing reports export as .md files",
      "Preserves formatting, timestamps, and roles",
      "Works for any conversation length",
    ],
    tier: "pro",
  },
  {
    icon: Eye,
    title: "NOMAD Public Intelligence Agent",
    description:
      "Forensic-grade OSINT investigations across 40+ sources. Feed it a name, company, or topic — receive a structured intelligence dossier with entity resolution, relationship mapping, confidence scores, and deep-dive analysis.",
    details: [
      "Multi-source intelligence: DDG, public records, news, social",
      "BLUF (Bottom Line Up Front) executive summaries",
      "0–100 confidence scoring with source correlation",
      "Entity resolution — connects aliases, roles, affiliations",
      "Risk matrices and relationship mapping",
      "Exports as structured intelligence reports",
    ],
    tier: "pro",
  },
  {
    icon: Database,
    title: "Azplen Data Intelligence",
    description:
      "Full data intelligence suite — ingest any dataset (CSV, JSON, Excel), analyze with natural language, branch data for experimentation, and generate executive reports with AI-powered insights. Guided prompt-based intake ensures forensic-grade research.",
    details: [
      "Guided prompt-based company intelligence intake",
      "Natural language queries across your datasets",
      "Data branching — experiment without touching production",
      "Graph visualization and relationship mapping",
      "Automated insight detection — trends, anomalies, correlations",
      "Executive report generation with scheduling",
      "Scenario simulation with Monte Carlo modeling",
    ],
    tier: "pro",
  },
  {
    icon: Target,
    title: "Company & Competitor Tracking",
    description:
      "Continuous monitoring of competitors, key markets, regulatory bodies, and tracked individuals. Intelligence surfaces automatically in daily briefings and NOMAD investigations.",
    details: [
      "Track unlimited competitors and market segments",
      "Regulatory body monitoring with policy change alerts",
      "Key person tracking — executives, investors, regulators",
      "Technology stack monitoring across competitors",
      "Investment and funding round detection",
    ],
    tier: "pro",
  },
  {
    icon: FileText,
    title: "Intelligence Notebooks",
    description:
      "Collaborative analysis notebooks with version control, cell-based editing, and scheduled execution. Write queries, build visualizations, add narrative text — then share with your team or schedule to run on autopilot.",
    details: [
      "Cell types: text, query, code, visualization, data source",
      "Full version history — revert to any previous state",
      "Clone & fork notebooks for experimentation",
      "Schedule notebooks to run weekly/daily with alerting",
      "Share with team — view, clone, edit, or admin permissions",
      "Export as structured intelligence reports",
    ],
    tier: "pro",
  },
  {
    icon: Users,
    title: "Team Workspace",
    description:
      "Create teams via email invite, assign roles (Owner / Admin / Analyst / Viewer), and collaborate on shared intelligence operations with row-level and column-level data security.",
    details: [
      "Create teams and invite Pro members via email",
      "Role-based access: Owner, Admin, Analyst, Viewer",
      "Row-level security — users see only data they're cleared for",
      "Column-level security — hide sensitive fields per user",
      "Data sensitivity tagging: Public / Internal / Confidential / Restricted",
      "Complete audit trail — who accessed what, when",
    ],
    tier: "pro",
  },
  {
    icon: Activity,
    title: "Time-Series Intelligence",
    description:
      "Advanced temporal analysis that auto-detects seasonality, extracts trends, forecasts future values with confidence intervals, and alerts on anomalies — all triggered automatically when AZPLEN detects time-series data.",
    details: [
      "Seasonality decomposition — weekly, monthly, annual patterns",
      "Trend extraction with R² goodness of fit",
      "Change point detection with probability scoring",
      "Forecasting with confidence intervals",
      "Cross-series correlation with lag detection",
      "Auto-alerts when values deviate beyond 2σ",
    ],
    tier: "pro",
  },
  {
    icon: MapPin,
    title: "Geospatial Intelligence",
    description:
      "Spatial-temporal analysis beyond pins on a map. Density heatmaps, route optimization, territory analysis, and location clustering — automatically triggered when datasets contain geographic data.",
    details: [
      "Interactive location mapping with data overlays",
      "Customer density heatmaps by region",
      "Logistics route analysis with efficiency scoring",
      "Sales territory mapping with performance metrics",
      "Geographic clustering and hotspot detection",
      "Geofencing alerts for movement tracking",
    ],
    tier: "pro",
  },
  {
    icon: Puzzle,
    title: "Plugin Marketplace",
    description:
      "Extend AZPLEN with third-party and first-party plugins — data connectors (Salesforce, HubSpot, Stripe), analysis modules (churn prediction, fraud detection), visualization plugins, and export integrations.",
    details: [
      "20+ plugins across 5 categories",
      "Data connectors: Salesforce, HubSpot, QuickBooks, Shopify, Stripe",
      "Analysis: Churn prediction, fraud detection, sentiment analysis",
      "Visualizations: Sankey diagrams, 3D scatter, force graphs",
      "Export: Tableau, Google Sheets, Airtable, Slack",
      "One-click install and uninstall",
    ],
    tier: "pro",
  },
  {
    icon: ClipboardList,
    title: "Audit Trail",
    description:
      "Complete access and activity logging for compliance. Every data access, team action, and configuration change is logged with timestamps, user IDs, and resource details.",
    details: [
      "Full audit log of all team and data actions",
      "Exportable for HIPAA, SOC2, GDPR compliance",
      "Alert on unusual access patterns",
      "Filter by action type, user, and date range",
      "Immutable log — entries cannot be modified or deleted",
    ],
    tier: "pro",
  },
];

/* ─── Feature Card ─── */
const FeatureCard = ({ icon: Icon, title, description, details, tier }: Feature) => {
  const { label, accent, dot } = tiers[tier];
  const isPro = tier === "pro";

  return (
    <div
      className={`group rounded-2xl border backdrop-blur-md p-8 transition-all duration-300 hover:border-border/40 ${
        isPro
          ? "border-accent/15 bg-accent/[0.03] hover:bg-accent/[0.06]"
          : "border-border/15 bg-card/20 hover:bg-card/30"
      }`}
    >
      <div className="flex items-start gap-4 mb-5">
        <div className={`rounded-xl p-2.5 ${isPro ? "bg-accent/10" : "bg-foreground/5"}`}>
          <Icon className={`h-5 w-5 ${isPro ? "text-accent" : "text-foreground/80"}`} />
        </div>
        <div>
          <h3 className="text-base font-light tracking-wide text-foreground">{title}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className={`text-[10px] tracking-[0.2em] uppercase ${accent}`}>{label}</span>
          </div>
        </div>
      </div>

      <p className="text-sm font-extralight leading-relaxed text-muted-foreground mb-6">
        {description}
      </p>

      <ul className="space-y-2.5">
        {details.map((d) => (
          <li key={d} className="flex items-start gap-2.5 text-xs font-extralight text-foreground/75">
            <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isPro ? "text-accent/60" : "text-emerald-400/60"}`} />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─── Tier Section ─── */
const TierSection = ({
  id, title, subtitle, tierKey,
}: {
  id: string; title: string; subtitle: string; tierKey: Tier;
}) => (
  <section id={id} className="relative z-10 px-6 pb-24">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.filter((f) => f.tier === tierKey).map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </div>
  </section>
);

/* ─── Page ─── */
const Features = () => {
  useEffect(() => {
    applySeoHead({
      title: "Features — Aureon | AI Intelligence Platform",
      description:
        "Uncensored AI, Zophiel search, NOMAD OSINT, Azplen data intelligence, daily briefings, end-to-end encryption, and private deployment.",
      path: "/features",
    });
  }, []);

  return (
    <LandingBackground>

      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Aureon",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description:
              "Uncensored AI intelligence platform with OSINT, data analytics, daily briefings, and end-to-end encryption.",
            offers: [
              { "@type": "Offer", name: "Aureon", price: "18", priceCurrency: "USD", billingDuration: "P1M" },
              { "@type": "Offer", name: "Pro", price: "399", priceCurrency: "USD", billingDuration: "P1M" },
            ],
          }),
        }}
      />

      {/* Hero */}
      <header className="relative z-10 flex flex-col items-center justify-center pt-8 pb-20 px-6 text-center">
        <p className="text-xs font-extralight tracking-[0.35em] text-muted-foreground/50 uppercase mb-5">
          Platform Capabilities
        </p>
        <h1 className="max-w-4xl text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Every Tool In The
          <br />
          <span className="text-muted-foreground">Intelligence Arsenal.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          From uncensored AI to forensic-grade OSINT investigations — here's exactly what you get at every tier. No vague promises. No hidden limitations.
        </p>
      </header>

      {/* Tier quick nav */}
      <nav className="relative z-10 px-6 pb-20" aria-label="Feature tiers">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-center gap-4">
          {[
            { label: "Aureon — $18/mo", anchor: "#aureon", border: "border-emerald-400/25", text: "text-emerald-400" },
            { label: "Pro — $399/mo", anchor: "#pro", border: "border-accent/25", text: "text-accent" },
          ].map(({ label, anchor, border, text }) => (
            <a
              key={anchor}
              href={anchor}
              className={`rounded-xl border backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.15em] uppercase transition-all hover:bg-foreground/5 ${border} ${text}`}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* Tier sections */}
      <TierSection
        id="aureon"
        title="Aureon"
        subtitle="$18/month — 60 messages per 3-hour window — Full AI, search, encryption, and memory from day one."
        tierKey="aureon"
      />

      <TierSection
        id="pro"
        title="Aureon Pro"
        subtitle="$399/month — 200 messages per 3-hour window — Everything in Aureon plus NOMAD Public Intelligence, daily briefings, and deep research."
        tierKey="pro"
      />


      {/* CTA */}
      <section className="relative z-10 px-6 pb-28">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md px-8 py-12 sm:px-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Ready To Deploy
              <br />
              <span className="text-muted-foreground">Real Intelligence?</span>
            </h2>
            <p className="mt-5 text-sm font-extralight text-muted-foreground">
              Pick your tier. Full access. No free-tier data harvesting.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/pricing"
                className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all"
              >
                View Pricing
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
            <nav className="flex items-center gap-6">
              <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link to="/privacy" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            </nav>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">
              © {new Date().getFullYear()} Zorak Corp
            </p>
          </div>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default Features;
