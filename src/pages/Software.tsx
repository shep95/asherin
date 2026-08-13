import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import GeoBlock from "@/components/seo/GeoBlock";
import SiteFooter from "@/components/SiteFooter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
  route?: string;
  tier: Tier;
  badge?: string;
};

/* ─────────────────────────────────────────────────────────────
   FULL SOFTWARE CATALOG — mirrors dashboard NAV_INTENTS
   tier: "aureon" = $18/mo · "pro" = $79/mo
   ───────────────────────────────────────────────────────────── */

const PRODUCTS: Product[] = [
  /* ═══════════════ CORE — ASHERIN $18 ═══════════════ */
  {
    name: "Asherin Chat",
    codename: "Flagship",
    tagline: "Conversational intelligence",
    description:
      "One chat surface with reasoning visualization, vision, voice, file attachments and persistent memory. Inference runs on Gemini by default, on Venice (mistral-31-24b) for accounts without a key, or on your own key if you bring one.",
    icon: MessageSquare,
    features: [
      "Chat / Code / Research / Truth modes",
      "Default routing: Gemini · platform fallback: Venice mistral-31-24b · BYOK: your provider",
      "Vision + voice + file attachments",
      "Persistent long-term memory",
      "Reasoning chain-of-thought view",
      "Response depth + determinism control",
      "60 messages / 3-hour window",
    ],
    route: "/dashboard/chat",
    tier: "aureon",
    badge: "Flagship",
  },
  {
    name: "Zophiel Search",
    codename: "Full Engine",
    tagline: "OSINT-grade web search",
    description:
      "The Zophiel Search Intelligence tab. It queries public search endpoints and open registries, ranks what comes back by source credibility, and cites every hit. Coverage is whatever those public endpoints return on the day — not a guaranteed source count. Included with the $18 Asherin subscription; Pro adds throughput and priority latency.",
    icon: Search,
    features: [
      "Live search across public engines (DuckDuckGo, Bing RSS, Mojeek) with credibility ranking",
      "Link extract, archive lookup (Wayback / public mirrors)",
      "Public breach-index and paste lookups — no dark-web full take",
      "Advanced search operators (dorking) with a live SERP fetch",
      "Entity graph from returned results; URL and domain mapping",
      "Citation-first answers — a claim with no fetched source is marked a gap",
    ],
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
    route: "/dashboard/ide",
    tier: "aureon",
  },
  {
    name: "Asherin Whiteboard",
    tagline: "Infinite canvas + layers",
    description: "Photoshop-style layer stack on an infinite canvas with snap grids, freeform sketching, and live AI collaboration.",
    icon: Layers,
    features: ["Infinite pan + zoom", "Layer stack with blend modes", "Snap grids + smart guides", "AI object generation"],
    route: "/dashboard/whiteboard",
    tier: "aureon",
  },
  {
    name: "Document Studio",
    tagline: "PDF / eBook / Slides generator",
    description: "Multi-session authoring pipeline. 500-word chapter pacing, AI-generated covers, one-click PDF/EPUB export.",
    icon: BookOpen,
    features: ["Long-form eBook mode", "Slide deck generator", "PDF layout engine", "AI cover art"],
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
    route: "/dashboard/vedic-astrology",
    tier: "aureon",
  },
  {
    name: "Zerlal Cyber",
    tagline: "Domain recon + public CVE index",
    description:
      "Passive domain reconnaissance and a public CVE lookup. It reads DNS, TLS, headers and subdomains, then matches disclosed software versions against public advisory indexes. It does not authenticate, exploit, or scan hosts, and it is not a credentialed scanner.",
    icon: Shield,
    features: [
      "DNS, TLS, header and subdomain recon (passive)",
      "Public CVE / advisory index lookup by product and version",
      "Kill-chain framing of what recon found",
      "Not a credentialed or exploit scanner — findings are inference from public surface",
    ],
    route: "/dashboard/zerlal",
    tier: "aureon",
  },
  
  {
    name: "Zaxin Tactical",
    tagline: "BLE field scout (browser Web Bluetooth)",
    description:
      "A browser BLE scout. It sees the devices the browser device picker and requestLEScan expose, reads a handful of GATT characteristics on a device you pair with, and plots coarse RSSI proximity. RSSI proximity is a log-distance estimate with metres of error, not trilateration, and the tab graph is BroadcastChannel between your own tabs, not a phone mesh.",
    icon: Bluetooth,
    features: [
      "Web Bluetooth picker + requestLEScan advertisement capture",
      "Three GATT reads on a paired device (device info / battery where exposed)",
      "Coarse RSSI proximity band — log-distance estimate, not trilateration",
      "Tab-to-tab BroadcastChannel graph — your own tabs, not a device mesh",
      "Esri satellite basemap for plotting what you observed",
    ],
    route: "/dashboard/zaxin",
    tier: "aureon",
  },
  {
    name: "ZANOEM Design Lab",
    codename: "ZALI",
    tagline: "Design lab workspace",
    description:
      "A generative design workspace for material choices, assembly layouts and parametric sketches, written up as an engineering brief. It reasons about physics in text and geometry; it does not run a solver. No FEA, thermal or CFD simulation ships here — take the brief to a real solver before you build.",
    icon: Hammer,
    features: [
      "Parametric sketch and assembly layout",
      "Material property library and selection rationale",
      "Tolerance and fit reasoning written as a brief",
      "No solver on board — not FEA, thermal or CFD",
    ],
    route: "/dashboard/zali",
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
    tier: "aureon",
  },
  {
    name: "Asherin Maps",
    tagline: "Tactical satellite map + live parcel intel",
    description:
      "Satellite-first mapping. On every fly it pulls public feeds in parallel and paints only what actually answered — public agency corridor cameras, OSM civic points, weather alerts, air quality and gauges. Property dossiers are public-index only; gaps are printed as gaps, never inferred.",
    icon: Map,
    features: [
      "Satellite imagery with a floating, resizable layer drawer",
      "Public agency highway / corridor camera stills — never private or doorbell cameras",
      "OSRM routing, explore nearby from OpenStreetMap",
      "Public-index property dossier: any field with no public record prints \"not in public index\"",
      "Public sensor sweep on fly (weather alerts, civic points, air quality, quake and gauge feeds)",
    ],
    route: "/dashboard/geospatial",
    tier: "aureon",
  },
  {
    name: "Google Cloud Intelligence",
    tagline: "Your linked accounts, read as intelligence",
    description:
      "Pair multiple Google accounts and read them as one ledger: Gmail, Calendar and Drive metadata, plus Meet links carried on your calendar events. Contact dossiers are built from public sources on request. Device battery and position are reported only by devices you have signed in and granted permission on — Asherin cannot poll a device that has not reported in.",
    icon: Globe,
    features: [
      "Multi-account Google pairing (Gmail, Calendar, Drive)",
      "Contact dossiers assembled from public sources, with per-claim provenance",
      "Device roster — battery and position from devices that opted in and reported; stale entries show their last report time",
      "Sentinel alerts by email and web push",
      "Meet links from your calendar events; a recording is listed only when Drive actually returns one",
    ],
    route: "/dashboard/google",
    tier: "aureon",
  },

  /* ═══════════════ PRO — ASHERIN PRO $79 ═══════════════ */
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
    tagline: "Pro throughput on the same engine",
    description:
      "The same full Zophiel engine that ships with the $18 Asherin subscription, running at Pro limits — deeper crawl depth per query, higher throughput, and priority latency.",
    icon: Search,
    features: [
      "Deeper crawl depth per query — source count is whatever answers live, not a fixed 30",
      "Credibility + provenance scoring on what was fetched",
      "Priority latency",
      "Higher query limits",
      "Sovereign Source Atlas access",
    ],
    route: "/dashboard/search",
    tier: "pro",
  },
  {
    name: "Asherin Engine",
    tagline: "Metadata index with a short full-take buffer",
    description:
      "The card catalog and the shelf behind it. Ghost indexes the shell around information — transport headers, DNS/ASN posture, redirect topology, EXIF capture fields, document producers, embedded authorship and timestamps — then builds three indexes over it: inverted facets, a shared-dimension graph, and a phonetic identity fold. Arm retention and each session's body is held in a self-expiring buffer, searchable by dictionary and bounded regex, then destroyed. Metadata makes bulk traffic queryable; the buffer makes the matching payloads retrievable.",
    icon: Fingerprint,
    features: [
      "Metadata index: EXIF device, software, authorship and GPS recovery",
      "PDF producer / creation-date recovery via trailer range reads",
      "DNS, ASN, TLS/HSTS/CSP posture and redirect topology",
      "Shared-dimension graph with keystone-node detection",
      "Timeline reconstruction + anomaly report (hardware-date paradoxes, GPS leakage, off-hours writes)",
      "Short full-take buffer — session bodies retained on a bounded, self-enforcing TTL",
      "Soft selection: dictionary, phrase and regex over buffered payloads with ReDoS refusal",
      "Per-session forensics: entropy, language tag, harvested addresses, phones, IPs and filenames",
      "Payload viewer with signed raw-byte download and one-click buffer purge",
      "Wired into Asherin Chat as a provenance substrate",
    ],
    route: "/dashboard/ghost-engine",
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
    name: "Zacoon Phantom Grid",
    tagline: "Autonomous web operative",
    description: "Multi-cortex autonomous browser agent with adversarial awareness — recon, extract, and operate at scale.",
    icon: Compass,
    features: ["Multi-cortex planner", "Adversarial-aware browsing", "Recon → extract → report pipeline", "Human-in-the-loop checkpoints"],
    route: "/dashboard/zacoon",
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
  
];

/* The scored "capability" and radar charts are gone. They were invented
   numbers — no test produced a 98 for "censorship-free", and a peer price for
   an enterprise platform sold by quote was not a real list price. What is
   left is published list pricing only, which anyone can check. */
const PRICE_DATA = [
  { plan: "Asherin", cost: 18 },
  { plan: "Asherin Pro (full suite)", cost: 79 },
  { plan: "ChatGPT Plus", cost: 20 },
  { plan: "Claude Pro", cost: 20 },
  { plan: "Gemini Advanced", cost: 20 },
  { plan: "Perplexity Pro", cost: 20 },
  { plan: "Cursor Pro", cost: 20 },
];

const ProductCard = ({ p }: { p: Product }) => {
  const Icon = p.icon;
  const tierBadge =
    p.tier === "pro"
      ? { label: "Pro · $79", cls: "text-foreground bg-foreground/[0.08] border-foreground/40" }
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
        "Every Asherin tool grouped by subscription tier. Core software on Asherin ($18/month); full intelligence + R&D suite on Asherin Pro ($79/month).",
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
              price: p.tier === "pro" ? "79" : "18",
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
              ◈ Software · {PRODUCTS.length} products · Asherin $18 / Pro $79
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight">
              Every Asherin tool. Grouped by tier.
            </h1>
            <p className="max-w-2xl mx-auto text-sm sm:text-base font-extralight text-muted-foreground leading-relaxed">
              {aureonProducts.length} tools ship in <strong className="text-foreground">Asherin ($18/month)</strong>.
              The full intelligence + R&amp;D suite — {proProducts.length} additional modules including
              <strong className="text-foreground"> RAD (Research &amp; Development with Asherin Chat)</strong> —
              ships in <strong className="text-foreground">Asherin Pro ($79/month)</strong>.
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

          {/* ASHERIN PRO $79 tier */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                  ◉ Tier 2 · Full suite
                </p>
                <h2 className="text-2xl font-extralight tracking-tight mt-1">
                  Asherin Pro — $79 / month <span className="text-muted-foreground/60 text-base">· everything in Asherin + {proProducts.length} more</span>
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

          {/* PRICING COMPARISON — published list prices only. The scored
              capability bar and the model radar were removed: nobody ran that
              test, so the numbers were decoration pretending to be evidence. */}
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                ◈ Published list pricing
              </p>
              <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight">
                What each plan costs per month
              </h2>
              <p className="mx-auto max-w-2xl text-xs font-extralight text-muted-foreground">
                Vendor list prices as published by each vendor. This is a price comparison, not a
                capability benchmark — Asherin publishes no head-to-head capability scores because
                it has not run a measured head-to-head test.
              </p>
            </div>

            <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
                ◉ Monthly cost · list price
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
          </section>

          {/* Closing CTA */}
          <section className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 text-center space-y-4">
            <h2 className="text-2xl font-extralight tracking-tight">Two plans. Every tool above.</h2>
            <p className="max-w-xl mx-auto text-sm font-extralight text-muted-foreground">
              Asherin is <strong className="text-foreground">$18/month</strong> for {aureonProducts.length} core tools.
              Asherin Pro is <strong className="text-foreground">$79/month</strong> for the full intelligence suite —
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
