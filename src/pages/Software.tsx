import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import GeoBlock from "@/components/seo/GeoBlock";
import SiteFooter from "@/components/SiteFooter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import {
  MessageSquare, Search, Network, Shield, Hammer, Database,
  Layers, BookOpen, Sparkles, Eye, Code2, Globe, FlaskConical,
  Brain, LineChart, DollarSign, Map, Video, Bluetooth, Bot,
  FileText, Lock, Cpu, Zap, Users, Puzzle, Notebook, Rss,
  Image as ImageIcon, Command, Fingerprint, Radio, Compass,
} from "lucide-react";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card) / 0.95)",
  border: "1px solid hsl(var(--border) / 0.4)",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 300,
  backdropFilter: "blur(12px)",
};

type Tier = "aureon" | "pro";

type Product = {
  name: string;
  codename?: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  competitors?: string[];
  route?: string;
  tier: Tier;
  badge?: string;
};

/* ─────────────────────────────────────────────────────────────
   FULL SOFTWARE CATALOG — mirrors dashboard NAV_INTENTS
   tier: "aureon" = $18/mo · "pro" = $399/mo
   ───────────────────────────────────────────────────────────── */

const PRODUCTS: Product[] = [
  /* ═══════════════ CORE — ASHERIN $18 ═══════════════ */
  {
    name: "Asherin Chat",
    codename: "Flagship",
    tagline: "Conversational intelligence",
    description:
      "Multi-model consensus chat with reasoning visualization, vision, voice, uncensored responses, and persistent memory. Replaces ChatGPT, Claude, and Gemini in one surface.",
    icon: MessageSquare,
    features: [
      "Chat / Code / Research / Truth modes",
      "Multi-model consensus across 9+ providers",
      "Vision + voice + file attachments",
      "Persistent long-term memory",
      "Reasoning chain-of-thought view",
      "Response depth + determinism control",
      "60 messages / 3-hour window",
    ],
    competitors: ["ChatGPT Plus", "Claude Pro", "Gemini Advanced"],
    route: "/dashboard/chat",
    tier: "aureon",
    badge: "Flagship",
  },
  {
    name: "Zophiel Search",
    codename: "Full Engine",
    tagline: "OSINT-grade web search",
    description:
      "The complete Zophiel Search Intelligence tab — cross-validated intelligence search with Veracity Scores, dark-web and leak sweeps, dorking, archives, intel mapping and the V2 pipeline. Included with the $18 Asherin subscription (monthly and 6-month). Pro adds throughput and priority latency.",
    icon: Search,
    features: [
      "Real-time web search + source-credibility scoring",
      "Deep Search, Link Extract, Archives Harvester",
      "Dark Web, Leaks, Onion and GhostChain sweeps",
      "Dorking, XKeyscore operators, Data Engine",
      "Intel Map, URL/Domain mapping, Zophiel V2",
      "Citation-first answers",
    ],
    competitors: ["Perplexity", "Google", "Kagi"],
    route: "/dashboard/search",
    tier: "aureon",
  },
  {
    name: "File Scrapper",
    tagline: "Universal document extractor",
    description:
      "Pull every character of text from PDFs, images, spreadsheets, and archives. OCR + structural parsing.",
    icon: FileText,
    features: ["OCR on scans & images", "PDF / DOCX / XLSX / CSV parsing", "Table structure preservation", "Multi-file batch mode"],
    route: "/dashboard/file-scrapper",
    tier: "aureon",
  },
  {
    name: "Cipher Toolkit",
    tagline: "Client-side crypto workbench",
    description:
      "Encoding, hashing, symmetric + asymmetric encryption run entirely in your browser. Nothing leaves the tab.",
    icon: Lock,
    features: ["Base64 / hex / ROT / URL encoders", "SHA / BLAKE / Argon2 hashing", "AES-GCM & RSA-OAEP", "Key-pair generation"],
    route: "/dashboard/cipher",
    tier: "aureon",
  },
  {
    name: "Asherin IDE",
    codename: "Asher Code",
    tagline: "In-dashboard Monaco IDE",
    description:
      "BYOK across 9 providers, sandboxed publishing of custom tabs, project file management, ghost tabs, and inline edit.",
    icon: Code2,
    features: [
      "Monaco editor + Git integration",
      "BYOK: OpenAI, Anthropic, Gemini, Groq, xAI, DeepSeek, Mistral, Together, OpenRouter",
      "Inline Edit + Ghost Tabs + Fast Apply",
      "Project index + semantic search",
      "Checkpoints + version history",
    ],
    competitors: ["Cursor", "Replit", "Lovable"],
    route: "/dashboard/ide",
    tier: "aureon",
  },
  {
    name: "Asherin Whiteboard",
    tagline: "Infinite canvas + layers",
    description: "Photoshop-style layer stack on an infinite canvas with snap grids, freeform sketching, and live AI collaboration.",
    icon: Layers,
    features: ["Infinite pan + zoom", "Layer stack with blend modes", "Snap grids + smart guides", "AI object generation"],
    competitors: ["Miro", "FigJam", "Excalidraw"],
    route: "/dashboard/whiteboard",
    tier: "aureon",
  },
  {
    name: "Document Studio",
    tagline: "PDF / eBook / Slides generator",
    description: "Multi-session authoring pipeline. 500-word chapter pacing, AI-generated covers, one-click PDF/EPUB export.",
    icon: BookOpen,
    features: ["Long-form eBook mode", "Slide deck generator", "PDF layout engine", "AI cover art"],
    competitors: ["Sudowrite", "NovelAI", "Canva"],
    route: "/dashboard/pdf-generator",
    tier: "aureon",
  },
  {
    name: "Gematria Engine",
    tagline: "Numerological corpus matcher",
    description: "English Ordinal, Reduction, Reverse, and Chaldean value analysis with personal corpus matching and date fingerprints.",
    icon: Fingerprint,
    features: ["4 gematria systems", "Personal corpus matching", "Date fingerprint resonance", "World-event correlation"],
    route: "/dashboard/gematria",
    tier: "aureon",
  },
  {
    name: "Vedic Astrology",
    tagline: "Swiss-grade sidereal engine",
    description: "Swiss Ephemeris precision, full Vimshottari Dasha, compatibility, 27-nakshatra mythology matching, and local transits.",
    icon: Sparkles,
    features: ["Swiss Ephemeris (arcsecond)", "Full Dasha reading", "Compatibility engine", "27 nakshatra decoder", "Moon-driven local transits"],
    competitors: ["Astro-Seek", "AstroSage"],
    route: "/dashboard/vedic-astrology",
    tier: "aureon",
  },
  {
    name: "Zerlal Cyber",
    tagline: "Vulnerability & exploit intel",
    description: "Full-spectrum vulnerability scanning, domain recon, exploit intelligence, and Cyber Kill Chain analysis.",
    icon: Shield,
    features: ["Domain + subdomain recon", "CVE + exploit intelligence", "Cyber Kill Chain mapping", "Dark-web indicator sweep"],
    competitors: ["Tenable Nessus", "Qualys", "Rapid7"],
    route: "/dashboard/zerlal",
    tier: "aureon",
  },
  {
    name: "NOMAD OSINT",
    tagline: "30+ source dossier engine",
    description: "14-pass deep analysis with persistent dossier trees. Built for investigators, journalists, and analysts.",
    icon: Network,
    features: ["30+ live OSINT sources", "14-pass correlation engine", "Persistent dossier tree", "Entity + relationship graph"],
    competitors: ["Maltego", "Palantir Gotham"],
    route: "/dashboard/nomad",
    tier: "aureon",
  },
  {
    name: "Zaxin Tactical",
    tagline: "BLE + optical AR overlay",
    description: "Bluetooth Low Energy scanner with RSSI trilateration, GATT pull, hop graph, and tactical HUD.",
    icon: Bluetooth,
    features: ["BLE scanner + RSSI mapping", "GATT service enumeration", "Hop-graph visualization", "Web Mercator + Esri satellite map"],
    route: "/dashboard/zaxin",
    tier: "aureon",
  },
  {
    name: "ZANOEM Design Lab",
    codename: "ZALI",
    tagline: "First-principles universal design",
    description: "Generative material and assembly design with simulation-grade physics — FEA, thermal, and CFD hints.",
    icon: Hammer,
    features: ["Parametric CAD-class output", "FEA + thermal simulation", "Material property library", "Assembly + tolerance solver"],
    competitors: ["Fusion 360", "ANSYS", "Onshape"],
    route: "/dashboard/zali",
    tier: "aureon",
  },
  {
    name: "Media → Code",
    tagline: "Vision to production HTML",
    description: "Turn images and video into clean, semantic HTML/CSS embeds ready to ship.",
    icon: ImageIcon,
    features: ["Image → responsive HTML", "Video → embedded player", "Semantic markup output", "Tailwind class extraction"],
    route: "/dashboard/media2code",
    tier: "aureon",
  },
  {
    name: "Zahten Agent Forge",
    tagline: "Design + scaffold + harden agents",
    description: "Compose task-scoped agents from templates, harden their prompts, and deploy them into your workspace.",
    icon: Bot,
    features: ["Template-driven scaffolding", "Prompt hardening lint", "Tool-permission scoping", "One-click deploy to sidebar"],
    route: "/dashboard/zahten",
    tier: "aureon",
  },
  {
    name: "Briefings",
    tagline: "Daily intel digests",
    description: "Automated daily briefings across competitor, regulatory, and market signals — filtered to your industry.",
    icon: Rss,
    features: ["Industry-tuned feeds", "Competitor tracking", "Regulatory watch", "Signal-vs-noise summarization"],
    route: "/dashboard/briefing",
    tier: "aureon",
  },
  {
    name: "Snippets & Blocks",
    tagline: "Reusable code + prompt library",
    description: "Save, tag, and recall code blocks and prompt templates across every workspace.",
    icon: Puzzle,
    features: ["Tagged library", "Cross-workspace search", "Prompt + code blocks", "Keyboard-first insert"],
    route: "/dashboard/snippets",
    tier: "aureon",
  },
  {
    name: "Asherin Shield",
    tagline: "Browser privacy extension",
    description: "Tracker eviction, DoH audit, hardening, and storage forensics. Lives in your browser, not our servers.",
    icon: Globe,
    features: ["Tracker eviction", "DoH provider audit", "Storage forensics", "Extension hardening"],
    competitors: ["DuckDuckGo Privacy", "uBlock Origin"],
    tier: "aureon",
  },
  {
    name: "Asherin Maps",
    tagline: "Tactical satellite map + live parcel intel",
    description:
      "Satellite-first mapping with a scalable layer tree, live street-camera sweeps, fastest-route directions, explore/hiring nearby, and Zophiel parcel intelligence on any property you click.",
    icon: Map,
    features: [
      "Satellite imagery with resizable layer tree",
      "Live street-camera intelligence sweeps",
      "Fast-lane directions, explore + hiring nearby",
      "Parcel ownership, valuation, permits and risk overlay",
      "Find-My locating for your signed-in device fleet",
    ],
    route: "/dashboard/geospatial",
    tier: "aureon",
  },
  {
    name: "Google Cloud Intelligence",
    tagline: "Your linked accounts, read as intelligence",
    description:
      "Pair multiple Google accounts and every device signed into them. Gmail, Calendar, Drive and Meet become a single ledger with automated dossiers on anyone who contacts you, plus a live device mesh showing battery, link quality and last known position.",
    icon: Globe,
    features: [
      "Multi-account Google pairing (Gmail, Calendar, Drive, Meet)",
      "Automated contact intelligence dossiers",
      "Signed-in device mesh — battery, link, live location",
      "Always-on Sentinel alerts by email and push",
      "Meet Vault — recordings and transcripts, downloadable",
    ],
    route: "/dashboard/google",
    tier: "aureon",
  },

  /* ═══════════════ PRO — ASHERIN PRO $399 ═══════════════ */
  {
    name: "RAD — Research & Development",
    codename: "New",
    tagline: "Asherin Chat as an R&D partner",
    description:
      "A dedicated R&D workspace inside Asherin Chat. Frames every conversation as a research program: hypothesis → literature sweep → experiment design → simulation → report. Pulls Zophiel Pro sources, Azplen datasets, ZANOEM simulations, and Axrlen forecasts into one thread with citation-locked outputs.",
    icon: FlaskConical,
    features: [
      "Hypothesis → experiment → report workflow",
      "Live literature sweep via Zophiel Pro (deeper crawl, higher recall)",
      "Dataset attach from Azplen (CSV / API / SQL)",
      "Physics + material simulation call-outs to ZANOEM",
      "Scenario simulation via Axrlen Monte Carlo",
      "Citation-locked outputs (every claim traces to a source)",
      "Persistent lab notebook per project",
      "Export as whitepaper (PDF), slide deck, or executable notebook",
    ],
    route: "/dashboard/chat?mode=rad",
    tier: "pro",
    badge: "New",
  },
  {
    name: "Zophiel Pro",
    tagline: "30-source deep-crawl OSINT",
    description:
      "Everything in Zophiel Base plus deeper crawl, broader coverage, higher query throughput, and priority latency.",
    icon: Search,
    features: [
      "30+ live sources triangulated",
      "Veracity + provenance scoring",
      "Priority latency",
      "Higher query limits",
      "Sovereign Source Atlas access",
    ],
    competitors: ["Perplexity Pro", "Kagi Ultimate"],
    route: "/dashboard/search",
    tier: "pro",
  },
  {
    name: "Axrlen",
    tagline: "Predictive intelligence engine",
    description:
      "NEXUS-PRIME probabilistic scenario engine — live global event prediction, policy simulation, and market forecasting with Monte Carlo scenario trees.",
    icon: Brain,
    features: [
      "Monte Carlo scenario trees",
      "Policy + geopolitical simulation",
      "Market forecast module (price-action-first)",
      "Backtest harness",
      "Confidence bands + invalidation triggers",
    ],
    route: "/dashboard/axrlen",
    tier: "pro",
  },
  {
    name: "Azplen Foundry",
    tagline: "Data intelligence platform",
    description:
      "20-tab analytical workspace with entity resolution, workforce optimization, financial forensics, workflow automation, and flow visualizations.",
    icon: Database,
    features: [
      "Ingest CSV / API / SQL",
      "Entity resolution + graph joins",
      "Workflow automation engine",
      "Scenario + threat modeling",
      "Flow, Sankey, and geospatial visualization",
    ],
    competitors: ["Palantir Foundry", "Tableau"],
    route: "/dashboard/azplen",
    tier: "pro",
  },
  {
    name: "Zeeion Financial",
    tagline: "Cost + waste forensics",
    description: "Cost savings, efficiency scoring, and budget optimization with per-line forensic drill-down.",
    icon: DollarSign,
    features: ["Line-item cost forensics", "Efficiency scoring", "Budget optimization solver", "Vendor + contract analysis"],
    route: "/dashboard/zeeion",
    tier: "pro",
  },
  {
    name: "Pattern Engine",
    tagline: "Visual pattern recognition",
    description: "Recurring-pattern detection, anomaly surfacing, and forward forecasting across arbitrary time series.",
    icon: LineChart,
    features: ["Motif discovery", "Anomaly detection", "Multi-horizon forecast", "Regime-change alerts"],
    route: "/dashboard/pattern-analysis",
    tier: "pro",
  },
  {
    name: "Time-Series Forecasting",
    tagline: "Temporal analysis suite",
    description: "Full temporal analytics with ARIMA, Prophet, and neural ensembles plus anomaly detection.",
    icon: LineChart,
    features: ["Multi-model ensemble", "Anomaly detection", "Seasonality decomposition", "Confidence bands"],
    route: "/dashboard/timeseries",
    tier: "pro",
  },
  {
    name: "Video Intelligence",
    tagline: "FACS + deception analysis",
    description: "Image locus mapping and FACS-based behavioral video tracking with deception scoring and personality profiling.",
    icon: Video,
    features: ["FACS micro-expression tracking", "Deception scoring", "Personality profiling", "Frame-level annotation"],
    competitors: ["Google Vision", "AWS Rekognition"],
    route: "/dashboard/video-intelligence",
    tier: "pro",
  },
  {
    name: "Zacoon Phantom Grid",
    tagline: "Autonomous web operative",
    description: "Multi-cortex autonomous browser agent with adversarial awareness — recon, extract, and operate at scale.",
    icon: Compass,
    features: ["Multi-cortex planner", "Adversarial-aware browsing", "Recon → extract → report pipeline", "Human-in-the-loop checkpoints"],
    route: "/dashboard/zacoon",
    tier: "pro",
  },
  {
    name: "Cross Screen Intelligence",
    tagline: "Live screen + facial tracking",
    description: "Real-time on-screen intelligence with alerts, facial tracking, and event triggers.",
    icon: Eye,
    features: ["Live screen OCR + intel", "Facial tracking", "Trigger-based alerts", "Recording + replay"],
    route: "/dashboard/cross",
    tier: "pro",
  },
  {
    name: "Knowledge Vault (RAG)",
    tagline: "BYO corpus retrieval",
    description: "Upload files or connect APIs — Asherin retrieves them live during chat with citation-locked answers.",
    icon: Database,
    features: ["File + API ingest", "Vector + hybrid retrieval", "Citation-locked answers", "Per-project scoping"],
    route: "/dashboard/knowledge-vault",
    tier: "pro",
  },
  {
    name: "Intelligence Notebooks",
    tagline: "Shared analysis + SQL",
    description: "Collaborative analysis sessions with in-notebook SQL execution and shareable results.",
    icon: Notebook,
    features: ["SQL cells", "Markdown + chart cells", "Real-time collaboration", "Version history"],
    route: "/dashboard/notebooks",
    tier: "pro",
  },
  {
    name: "Plugin Marketplace",
    tagline: "Connectors + agent modules",
    description: "Extend Asherin with connectors, agent modules, and pre-built automations.",
    icon: Puzzle,
    features: ["Connector library", "Agent module store", "Sandboxed execution", "One-click install"],
    route: "/dashboard/plugins",
    tier: "pro",
  },
  {
    name: "Automated Agents",
    tagline: "Set-and-forget workers",
    description: "AI agents that run tasks on autopilot — scheduled, event-driven, or continuously.",
    icon: Cpu,
    features: ["Scheduled + event triggers", "Multi-step tool chains", "Failure retry + DLQ", "Per-agent audit log"],
    route: "/dashboard/zahten",
    tier: "pro",
  },
  {
    name: "Team Workspace",
    tagline: "Role-based collaboration",
    description: "Shared threads, shared outputs, admin controls, and role-based access.",
    icon: Users,
    features: ["Shared threads + outputs", "Role-based access", "Admin controls", "Team audit trail"],
    route: "/dashboard/teams",
    tier: "pro",
  },
  {
    name: "Guardian Vault",
    tagline: "Security command center",
    description: "Centralized MFA, secrets, and credential hygiene with rotation reminders.",
    icon: Lock,
    features: ["MFA + TOTP vault", "Secret storage (AES-256-GCM)", "Rotation reminders", "Breach monitoring"],
    route: "/dashboard/guardian-vault",
    tier: "pro",
  },
  {
    name: "Vibe Video",
    tagline: "Generative video pipeline",
    description: "Prompt-to-video with scene planning, shot list, and post-production hooks.",
    icon: Radio,
    features: ["Prompt → storyboard", "Shot list generator", "Scene + audio sync", "Export to editor"],
    route: "/dashboard/vibe-video",
    tier: "pro",
  },
];

const BENCHMARK_DATA = [
  { metric: "Capability", aureon: 95, chatgpt: 78, claude: 82, gemini: 75, perplexity: 60 },
  { metric: "Sources", aureon: 92, chatgpt: 50, claude: 45, gemini: 70, perplexity: 88 },
  { metric: "Censorship-free", aureon: 98, chatgpt: 20, claude: 25, gemini: 18, perplexity: 35 },
  { metric: "Tool breadth", aureon: 96, chatgpt: 55, claude: 50, gemini: 65, perplexity: 30 },
  { metric: "Price/value", aureon: 100, chatgpt: 40, claude: 38, gemini: 45, perplexity: 50 },
];

const RADAR_DATA = [
  { axis: "Reasoning", Asherin: 95, "GPT-5.5": 82, "Opus 4.8": 88, Gemini: 78 },
  { axis: "Coding", Asherin: 92, "GPT-5.5": 80, "Opus 4.8": 90, Gemini: 75 },
  { axis: "OSINT", Asherin: 98, "GPT-5.5": 45, "Opus 4.8": 50, Gemini: 60 },
  { axis: "Vision", Asherin: 90, "GPT-5.5": 78, "Opus 4.8": 72, Gemini: 85 },
  { axis: "Security", Asherin: 94, "GPT-5.5": 55, "Opus 4.8": 60, Gemini: 50 },
  { axis: "Long context", Asherin: 88, "GPT-5.5": 82, "Opus 4.8": 95, Gemini: 90 },
];

const PRICE_DATA = [
  { plan: "Asherin", cost: 18 },
  { plan: "Asherin Pro (full suite)", cost: 399 },
  { plan: "ChatGPT Plus", cost: 20 },
  { plan: "Claude Pro", cost: 20 },
  { plan: "Gemini Advanced", cost: 20 },
  { plan: "Perplexity Pro", cost: 20 },
  { plan: "Cursor Pro", cost: 20 },
  { plan: "Palantir Foundry", cost: 500 },
];

const ProductCard = ({ p }: { p: Product }) => {
  const Icon = p.icon;
  const tierBadge =
    p.tier === "pro"
      ? { label: "Pro · $399", cls: "text-foreground bg-foreground/[0.08] border-foreground/40" }
      : { label: "Asherin · $18", cls: "text-muted-foreground bg-foreground/[0.03] border-border/40" };

  const inner = (
    <div className="group flex h-full flex-col rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5 hover:border-border/60 hover:bg-card/40 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-border/40 flex items-center justify-center group-hover:bg-foreground/[0.08] transition-colors">
          <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[9px] font-medium tracking-[0.2em] uppercase px-2 py-1 rounded-full border ${tierBadge.cls}`}>
            {tierBadge.label}
          </span>
          {p.badge && (
            <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-foreground/70 px-2 py-0.5 rounded-full border border-foreground/30">
              {p.badge}
            </span>
          )}
        </div>
      </div>

      <h3 className="text-lg font-light tracking-tight text-foreground mb-1">{p.name}</h3>
      <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
        {p.tagline}
        {p.codename && p.codename !== p.badge && <span className="text-foreground/40"> · {p.codename}</span>}
      </p>
      <p className="text-xs font-extralight text-muted-foreground/90 leading-relaxed mb-4">
        {p.description}
      </p>

      <div className="pt-3 border-t border-border/20 mt-auto space-y-3">
        <div>
          <p className="text-[9px] font-medium tracking-[0.25em] uppercase text-muted-foreground/70 mb-2">
            Capabilities
          </p>
          <ul className="space-y-1">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[11px] font-extralight text-muted-foreground/90 leading-relaxed">
                <span className="mt-1 h-1 w-1 rounded-full bg-foreground/40 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        {p.competitors && p.competitors.length > 0 && (
          <div>
            <p className="text-[9px] font-medium tracking-[0.25em] uppercase text-muted-foreground/70 mb-2">
              Replaces
            </p>
            <div className="flex flex-wrap gap-1.5">
              {p.competitors.map((c) => (
                <span
                  key={c}
                  className="text-[10px] font-light px-2 py-0.5 rounded-full bg-foreground/[0.04] border border-border/30 text-foreground/60"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
  return p.route ? <Link to={p.route} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
};

const Software = () => {
  const aureonProducts = PRODUCTS.filter((p) => p.tier === "aureon");
  const proProducts = PRODUCTS.filter((p) => p.tier === "pro");

  useEffect(() => {
    const id = "software-collection-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Asherin Software Catalog",
      description:
        "Every Asherin tool grouped by subscription tier. Core software on Asherin ($18/month); full intelligence + R&D suite on Asherin Pro ($399/month).",
      url: "https://asherin.com/software",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: PRODUCTS.length,
        itemListElement: PRODUCTS.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "SoftwareApplication",
            name: p.name,
            description: p.description,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: p.tier === "pro" ? "399" : "18",
              priceCurrency: "USD",
            },
          },
        })),
      },
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />
      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Hero */}
          <section className="text-center space-y-4">
            <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Software · {PRODUCTS.length} products · Asherin $18 / Pro $399
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight">
              Every Asherin tool. Grouped by tier.
            </h1>
            <p className="max-w-2xl mx-auto text-sm sm:text-base font-extralight text-muted-foreground leading-relaxed">
              {aureonProducts.length} tools ship in <strong className="text-foreground">Asherin ($18/month)</strong>.
              The full intelligence + R&amp;D suite — {proProducts.length} additional modules including
              <strong className="text-foreground"> RAD (Research &amp; Development with Asherin Chat)</strong> —
              ships in <strong className="text-foreground">Asherin Pro ($399/month)</strong>.
            </p>
          </section>

          {/* Extractable answer + sourced figures for generative engines. */}
          <div className="mx-auto max-w-3xl">
            <GeoBlock />
          </div>


          {/* RAD spotlight */}
          <section className="rounded-3xl border border-foreground/25 bg-foreground/[0.04] backdrop-blur-sm p-8 sm:p-10">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-foreground/[0.08] border border-foreground/25 flex items-center justify-center shrink-0">
                <FlaskConical className="h-6 w-6 text-foreground" strokeWidth={1.4} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-medium tracking-[0.25em] uppercase text-foreground/80 px-2 py-0.5 rounded-full border border-foreground/40">
                    New · Asherin Pro
                  </span>
                  <Command className="h-3 w-3 text-foreground/40" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight mb-3">
                  RAD — Research &amp; Development with Asherin Chat
                </h2>
                <p className="text-sm font-extralight text-muted-foreground leading-relaxed mb-5 max-w-3xl">
                  RAD turns Asherin Chat into a full research program manager. Every thread is scaffolded as a
                  scientific workflow — hypothesis, literature sweep, experiment design, simulation, and
                  citation-locked report — with the rest of the Asherin suite wired in as tools the chat can call.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 max-w-3xl">
                  {[
                    "Hypothesis → experiment → report workflow",
                    "Zophiel Pro deep literature sweep",
                    "Azplen dataset attach (CSV / API / SQL)",
                    "ZANOEM material + physics simulation calls",
                    "Axrlen Monte Carlo scenario runs",
                    "Citation-locked outputs (every claim traces)",
                    "Persistent lab notebook per project",
                    "Export whitepaper / slides / notebook",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-xs font-extralight text-muted-foreground">
                      <Zap className="mt-0.5 h-3 w-3 text-foreground/60 shrink-0" strokeWidth={1.5} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/dashboard/chat?mode=rad"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background text-xs font-light tracking-[0.2em] uppercase hover:bg-foreground/90 transition-colors"
                  >
                    Open RAD in Asherin Chat
                  </Link>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/40 text-xs font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Launch dashboard
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ASHERIN $18 tier */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                  ◉ Tier 1
                </p>
                <h2 className="text-2xl font-extralight tracking-tight mt-1">
                  Asherin — $18 / month <span className="text-muted-foreground/60 text-base">· {aureonProducts.length} tools</span>
                </h2>
                <p className="text-xs font-extralight text-muted-foreground mt-1">
                  Core intelligence: chat, search, code, whiteboard, docs, OSINT, cyber, design, and privacy.
                </p>
              </div>
              <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                60 messages / 3-hour window
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {aureonProducts.map((p) => <ProductCard key={p.name} p={p} />)}
            </div>
          </section>

          {/* ASHERIN PRO $399 tier */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                  ◉ Tier 2 · Full suite
                </p>
                <h2 className="text-2xl font-extralight tracking-tight mt-1">
                  Asherin Pro — $399 / month <span className="text-muted-foreground/60 text-base">· everything in Asherin + {proProducts.length} more</span>
                </h2>
                <p className="text-xs font-extralight text-muted-foreground mt-1">
                  Predictive intelligence, financial + data forensics, autonomous agents, R&amp;D workflows, and enterprise collaboration.
                </p>
              </div>
              <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                200 messages / 3-hour window
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {proProducts.map((p) => <ProductCard key={p.name} p={p} />)}
            </div>
          </section>

          {/* Composite benchmark */}
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                ◈ Composite benchmark
              </p>
              <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight">
                Asherin vs the paid stack
              </h2>
            </div>

            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
                ◉ Capability score · higher is better
              </p>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={BENCHMARK_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                    <Bar dataKey="aureon"    name="Asherin"        fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="chatgpt"   name="ChatGPT Plus"  fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="claude"    name="Claude Pro"    fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gemini"    name="Gemini Adv."   fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="perplexity" name="Perplexity"   fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
                  ◈ Model-vs-model radar
                </p>
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={RADAR_DATA}>
                      <PolarGrid stroke="hsl(var(--border) / 0.3)" />
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 300 }} />
                      <Radar name="Asherin"    dataKey="Asherin"    stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.35} />
                      <Radar name="GPT-5.5"   dataKey="GPT-5.5"   stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
                      <Radar name="Opus 4.8"  dataKey="Opus 4.8"  stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.18} />
                      <Radar name="Gemini"    dataKey="Gemini"    stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
                  ◉ Monthly cost · Asherin vs competitors
                </p>
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={PRICE_DATA} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis type="number" tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="plan" width={170} tick={{ fontSize: 10, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v}/mo`} />
                      <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* Closing CTA */}
          <section className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 text-center space-y-4">
            <h2 className="text-2xl font-extralight tracking-tight">Two plans. Every tool above.</h2>
            <p className="max-w-xl mx-auto text-sm font-extralight text-muted-foreground">
              Asherin is <strong className="text-foreground">$18/month</strong> for {aureonProducts.length} core tools.
              Asherin Pro is <strong className="text-foreground">$399/month</strong> for the full intelligence suite —
              including RAD, Axrlen, Azplen, Zeeion, Zacoon, and every Pro-tier module.
              Enterprise (SSO, audit, dedicated capacity) is custom-priced.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-foreground/30 bg-foreground/[0.04] text-xs font-light tracking-[0.2em] uppercase text-foreground hover:bg-foreground/10 transition-colors"
              >
                Launch dashboard
              </Link>
              <Link
                to="/dashboard/subscription"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/40 text-xs font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Compare plans
              </Link>
              <Link
                to="/benchmark"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/40 text-xs font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                See coding benchmark
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Software;
