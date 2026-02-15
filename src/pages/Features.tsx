import heroBg from "@/assets/hero-bg.png";
import Header from "@/components/Header";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Brain, Code, Shield, Search, Eye, BarChart3, Newspaper, Users, Server,
  Lock, Zap, ArrowRight, MessageSquare, Layers, Database, Network,
  Globe, FileText, Cpu, Target, Fingerprint, Download, RefreshCw,
  Check,
} from "lucide-react";

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  tier: "individual" | "pro" | "enterprise";
}

const tierLabels: Record<string, { label: string; color: string }> = {
  individual: { label: "Aureon — $18/mo", color: "text-emerald-400/80" },
  pro: { label: "Aureon Pro — $74/mo", color: "text-accent/80" },
  enterprise: { label: "Enterprise — $5,000/wk", color: "text-amber-400/80" },
};

const FeatureCard = ({ icon: Icon, title, description, details, tier }: FeatureCardProps) => {
  const { label, color } = tierLabels[tier];
  const isEnterprise = tier === "enterprise";

  return (
    <div
      className={`rounded-2xl border backdrop-blur-md p-8 transition-all hover:bg-foreground/[0.02] ${
        isEnterprise
          ? "border-accent/20 bg-accent/5"
          : "border-border/20 bg-card/30"
      }`}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`rounded-xl p-2.5 ${isEnterprise ? "bg-accent/10" : "bg-foreground/5"}`}>
          <Icon className={`h-6 w-6 ${isEnterprise ? "text-accent" : "text-foreground"}`} />
        </div>
        <div>
          <h3 className="text-base font-light tracking-wide text-foreground">{title}</h3>
          <span className={`text-[10px] tracking-[0.2em] uppercase ${color}`}>{label}</span>
        </div>
      </div>
      <p className="text-sm font-extralight leading-relaxed text-muted-foreground mb-5">{description}</p>
      <ul className="space-y-2.5">
        {details.map((d) => (
          <li key={d} className="flex items-start gap-2.5 text-xs font-extralight text-foreground/80">
            <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isEnterprise ? "text-accent/70" : "text-emerald-400/70"}`} />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
};

const features: FeatureCardProps[] = [
  {
    icon: Brain,
    title: "Aureon AI Engine",
    description:
      "An uncensored, unfiltered intelligence engine that gives you direct answers without corporate safety wrappers. Powered by the Zophiel Ghost Chain Protocol — a multi-layer reasoning architecture that plans, critiques, and refines before responding.",
    details: [
      "No refusals, no moralizing disclaimers",
      "Multi-step reasoning with internal chain-of-thought",
      "Calibration feedback loop — the AI adapts to your preferences",
      "Context health tracking across long conversations",
      "Adjustable depth: shallow → standard → deep → expert",
    ],
    tier: "individual",
  },
  {
    icon: Code,
    title: "Elite Coding Engine",
    description:
      "Production-grade code generation that outperforms leading models on real-world benchmarks. Supports multi-file architecture, debugging, refactoring, and ships code that compiles on the first try.",
    details: [
      "Multi-file project awareness and architecture",
      "Inline code preview cards with syntax highlighting",
      "Debug, explain, optimize, and test — one click",
      "Supports 50+ languages and frameworks",
      "Code blocks with copy-to-clipboard on every response",
    ],
    tier: "individual",
  },
  {
    icon: Shield,
    title: "End-to-End Encryption",
    description:
      "Every message is encrypted before it leaves your device. Your prompts are never stored as training data, never sold, and never used to improve any model. Privacy isn't a feature — it's the architecture.",
    details: [
      "Client-side encryption with per-user keys",
      "Zero-knowledge architecture — we can't read your data",
      "No prompt logging, no analytics on content",
      "Data deletion on demand — your data, your rules",
      "SOC 2 aligned security practices",
    ],
    tier: "individual",
  },
  {
    icon: MessageSquare,
    title: "Multi-Persona System",
    description:
      "Switch between AI personalities tuned for different tasks. Create custom personas with specialized system prompts to shape how Aureon thinks, writes, and responds for your specific workflow.",
    details: [
      "Built-in personas: Analyst, Coder, Writer, Strategist",
      "Create unlimited custom personas with system prompts",
      "Personas persist across sessions via local storage",
      "One-click switch between personas mid-conversation",
      "Persona context injected into every response",
    ],
    tier: "individual",
  },
  {
    icon: Layers,
    title: "Persistent Memory",
    description:
      "Aureon remembers what matters across all your sessions. The memory center stores facts, preferences, and context so you never repeat yourself. Your intelligence profile evolves with every interaction.",
    details: [
      "Cross-session memory with categorized entries",
      "Automatic trait inference from conversation patterns",
      "User Intelligence Profile — tone, depth, and topic preferences",
      "Memory center with full CRUD management",
      "Context carries forward without manual re-prompting",
    ],
    tier: "individual",
  },
  {
    icon: Lock,
    title: "Privacy-First Architecture",
    description:
      "No free tiers that harvest your data. No shadow training. No third-party analytics on your conversations. Aureon is built on the principle that if you're not paying, you're the product.",
    details: [
      "Your prompts are never used for model training",
      "No third-party tracking or analytics on content",
      "Cancel anytime — one click, no questions",
      "Data export available for full portability",
      "Account deletion permanently removes all data",
    ],
    tier: "individual",
  },
  {
    icon: Search,
    title: "Zophiel Search Engine",
    description:
      "A privacy-first search intelligence engine with source credibility tiers. Every result is ranked by reliability — academic papers, official docs, and verified sources surface first. Includes instant answers and page previews.",
    details: [
      "Source credibility tiers: Verified → Established → Community → Unverified",
      "Instant answer cards for quick intelligence",
      "Full page preview panel without leaving the app",
      "Advanced search operators and filters",
      "Search mode selector: Web, Academic, News, Code",
    ],
    tier: "individual",
  },
  {
    icon: RefreshCw,
    title: "Live Web Search Integration",
    description:
      "Aureon can search the live web in real-time during any conversation. Get current data, recent news, and up-to-the-minute information blended seamlessly into AI responses.",
    details: [
      "Real-time web search triggered contextually",
      "Source citations with clickable links",
      "Truth score indicators on every response",
      "Decode view — see the reasoning behind any answer",
      "Follow-up suggestions generated from live data",
    ],
    tier: "individual",
  },
  {
    icon: Newspaper,
    title: "Daily Intelligence Briefings",
    description:
      "Personalized AUREON MORNING BRIEFS delivered at your chosen time. The system extracts your business vectors — competitors, markets, tech stack, regulatory bodies — through a conversational AI onboarding, then synthesizes a structured report from 100+ sources every morning.",
    details: [
      "AI-powered conversational profile setup",
      "Rolling 24–48 hour intelligence window",
      "Structured sections: Critical → Significant → Monitoring → Market Signals",
      "Unique headlines per briefing — no generic titles",
      "Download briefings as markdown files",
      "Configurable delivery time with timezone support",
    ],
    tier: "pro",
  },
  {
    icon: Download,
    title: "Conversation Export",
    description:
      "Download any conversation with Aureon as a structured markdown file. Briefing reports are also fully exportable. Your intelligence output belongs to you.",
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
    title: "NOMAD OSINT Agent",
    description:
      "A public intelligence agent that conducts automated OSINT investigations across 40+ data sources. Feed it a name, company, or topic and receive a structured intelligence dossier with entity resolution, relationship mapping, and source correlation.",
    details: [
      "Multi-source intelligence gathering: DDG, public records, news, social",
      "Structured dossier output with confidence ratings",
      "Entity resolution — connects aliases, roles, and affiliations",
      "Relationship mapping between people, orgs, and events",
      "Investigation history with re-run capability",
      "Exports as structured intelligence reports",
    ],
    tier: "enterprise",
  },
  {
    icon: Database,
    title: "Asha Data Intelligence Platform",
    description:
      "A full data intelligence suite — ingest any dataset (CSV, JSON, Excel), analyze with natural language queries, branch data for experimentation, and generate executive reports with AI-powered insights.",
    details: [
      "Drag-and-drop data ingestion with auto-schema detection",
      "Natural language queries — ask questions about your data",
      "Data branching — experiment without touching production data",
      "Graph visualization and relationship mapping",
      "Automated insight detection — trends, anomalies, correlations",
      "Executive report generation with scheduling",
      "Workflow automation with triggers and templates",
    ],
    tier: "enterprise",
  },
  {
    icon: Target,
    title: "Company & Competitor Tracking",
    description:
      "Set up continuous monitoring of your competitors, key markets, regulatory bodies, and tracked individuals. Intelligence is surfaced automatically in your daily briefings and NOMAD investigations.",
    details: [
      "Track unlimited competitors and market segments",
      "Regulatory body monitoring with policy change alerts",
      "Key person tracking — executives, investors, regulators",
      "Technology stack monitoring across competitors",
      "Investment and funding round detection",
    ],
    tier: "enterprise",
  },
  {
    icon: Users,
    title: "Team Workspace",
    description:
      "Unlimited seats for your entire organization. Shared conversation threads, collaborative intelligence, and unified billing under a single enterprise account.",
    details: [
      "Unlimited team members — no per-seat pricing",
      "Shared conversation threads and intelligence",
      "Centralized billing and usage analytics",
      "Role-based access control",
      "Team-wide memory and context sharing",
    ],
    tier: "enterprise",
  },
  {
    icon: Server,
    title: "Private Deployment",
    description:
      "For organizations that require maximum control, Aureon Enterprise can be deployed on-premise or in your private cloud. Full data sovereignty with zero external dependencies.",
    details: [
      "On-premise or private cloud deployment",
      "Full data sovereignty — nothing leaves your network",
      "Custom model fine-tuning available",
      "Dedicated engineering support — 24/7",
      "SLA-backed uptime guarantees",
    ],
    tier: "enterprise",
  },
];

const Features = () => {
  useEffect(() => {
    document.title = "Features — Aureon | AI Intelligence Platform Capabilities";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Explore Aureon's full feature set: uncensored AI engine, Zophiel search, NOMAD OSINT, Asha data intelligence, daily briefings, end-to-end encryption, and enterprise deployment."
      );
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="fixed inset-0 bg-black/80" />

      <Header />

      {/* JSON-LD structured data */}
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
              { "@type": "Offer", name: "Aureon Pro", price: "74", priceCurrency: "USD", billingDuration: "P1M" },
              { "@type": "Offer", name: "Enterprise", price: "5000", priceCurrency: "USD", billingDuration: "P1W" },
            ],
          }),
        }}
      />

      {/* Hero */}
      <header className="relative z-10 pt-32 pb-16 px-6 text-center">
        <p className="text-sm font-light tracking-[0.3em] text-muted-foreground uppercase mb-4">
          Features
        </p>
        <h1 className="max-w-4xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
          Every Tool In The Intelligence Arsenal.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          From uncensored AI to full OSINT investigations — here's exactly what you get at every tier. No vague promises. No hidden limitations.
        </p>
      </header>

      {/* Tier quick nav */}
      <nav className="relative z-10 px-6 pb-16" aria-label="Feature tiers">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-center gap-4">
          {[
            { label: "Aureon — $18/mo", anchor: "#individual", color: "border-emerald-400/30 text-emerald-400" },
            { label: "Pro — $74/mo", anchor: "#pro", color: "border-accent/30 text-accent" },
            { label: "Enterprise — $5K/wk", anchor: "#enterprise", color: "border-amber-400/30 text-amber-400" },
          ].map(({ label, anchor, color }) => (
            <a
              key={anchor}
              href={anchor}
              className={`rounded-xl border backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.15em] uppercase transition-all hover:bg-foreground/5 ${color}`}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* Individual Tier */}
      <section id="individual" className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Aureon Individual
            </h2>
            <p className="mt-2 text-sm font-extralight text-muted-foreground">
              $18/month — 60 messages per 3-hour window — Full AI access from day one.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.filter((f) => f.tier === "individual").map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Pro Tier */}
      <section id="pro" className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Aureon Pro
            </h2>
            <p className="mt-2 text-sm font-extralight text-muted-foreground">
              $74/month — 200 messages per 3-hour window — Everything in Individual plus enhanced intelligence.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.filter((f) => f.tier === "pro").map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Tier */}
      <section id="enterprise" className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Aureon Enterprise
            </h2>
            <p className="mt-2 text-sm font-extralight text-muted-foreground">
              $5,000/week — The complete intelligence platform. Everything in Pro plus the full suite.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.filter((f) => f.tier === "enterprise").map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Ready To Deploy Real Intelligence?
            </h2>
            <p className="mt-4 text-sm font-extralight text-muted-foreground">
              Pick your tier. Full access. No free-tier data harvesting.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/pricing"
                className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all"
              >
                View Pricing
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/pricing"
                className="group flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-8 py-3 text-sm font-light tracking-wide text-accent hover:bg-accent/20 transition-all"
              >
                Enterprise Access
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
    </div>
  );
};

export default Features;
