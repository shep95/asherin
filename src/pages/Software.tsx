import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import {
  MessageSquare, Search, Network, Shield, Hammer, Database,
  Layers, BookOpen, Sparkles, Eye, Code2, Globe,
} from "lucide-react";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card) / 0.95)",
  border: "1px solid hsl(var(--border) / 0.4)",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 300,
  backdropFilter: "blur(12px)",
};

type Product = {
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  competitors: string[];
  route?: string;
  badge?: string;
};

const PRODUCTS: Product[] = [
  {
    name: "Aureon Chat",
    tagline: "Conversational intelligence",
    description: "Multi-model consensus chat with reasoning visualization, vision, voice, and zero censorship. Replaces three paid tools with one free stack.",
    icon: MessageSquare,
    competitors: ["ChatGPT Plus", "Claude Pro", "Gemini Advanced"],
    route: "/dashboard/chat",
    badge: "Flagship",
  },
  {
    name: "Zophiel Search",
    tagline: "30-source OSINT engine",
    description: "Cross-validated intelligence search across 30 live sources with Veracity Scores and triangulated truth extraction.",
    icon: Search,
    competitors: ["Perplexity Pro", "Google", "Kagi"],
    route: "/dashboard/search",
  },
  {
    name: "NOMAD",
    tagline: "Persistent intelligence dossiers",
    description: "14-pass deep analysis with persistent dossier trees. Built for investigators, journalists, and analysts.",
    icon: Network,
    competitors: ["Maltego", "Palantir Gotham"],
    route: "/dashboard/nomad",
  },
  {
    name: "Zerlal",
    tagline: "Cyber intelligence engine",
    description: "Full-spectrum vulnerability scanning, domain recon, exploit intelligence, and Cyber Kill Chain analysis.",
    icon: Shield,
    competitors: ["Tenable Nessus", "Qualys", "Rapid7"],
    route: "/dashboard/security",
  },
  {
    name: "ZALI Design Lab",
    tagline: "FEA + thermal simulation",
    description: "Generative material and assembly design with simulation-grade physics. CAD-class output without the license.",
    icon: Hammer,
    competitors: ["Fusion 360", "ANSYS", "Onshape"],
    route: "/dashboard/zali",
  },
  {
    name: "Azplen Foundry",
    tagline: "Data intelligence suite",
    description: "20-tab analytical workspace with workforce optimization, financial forensics, and flow visualizations.",
    icon: Database,
    competitors: ["Palantir Foundry", "Tableau"],
    route: "/dashboard/azplen",
  },
  {
    name: "Aureon Whiteboard",
    tagline: "Infinite canvas + layers",
    description: "Photoshop-style layer stack on an infinite canvas with snap grids and live AI collaboration.",
    icon: Layers,
    competitors: ["Miro", "FigJam", "Excalidraw"],
    route: "/dashboard/whiteboard",
  },
  {
    name: "E-book Generator",
    tagline: "Long-form authoring",
    description: "Multi-session text uploads, 500 words/chapter pacing, and generated PNG covers. End-to-end publishing pipeline.",
    icon: BookOpen,
    competitors: ["Sudowrite", "NovelAI"],
    route: "/dashboard/ebook",
  },
  {
    name: "Vedic Astrology",
    tagline: "Swiss-grade chart engine",
    description: "Swiss Ephemeris precision, full dasha readings, compatibility, and 27-nakshatra mythology matching.",
    icon: Sparkles,
    competitors: ["Astro-Seek", "AstroSage"],
    route: "/dashboard/vedic-astrology",
  },
  {
    name: "Vision Intelligence",
    tagline: "Image + behavioral video",
    description: "Image locus mapping and FACS behavioral video tracking. Sees what other models miss.",
    icon: Eye,
    competitors: ["Google Vision", "AWS Rekognition"],
    route: "/dashboard/video-intelligence",
  },
  {
    name: "Asher Code IDE",
    tagline: "In-dashboard Monaco IDE",
    description: "BYOK across 9 providers, sandboxed publishing of custom tabs, and full project file management.",
    icon: Code2,
    competitors: ["Cursor", "Replit", "Lovable"],
    route: "/asher-dashboard",
  },
  {
    name: "Aureon Shield",
    tagline: "Browser privacy extension",
    description: "Tracker eviction, DoH audit, hardening, and storage forensics. Lives in your browser, not our servers.",
    icon: Globe,
    competitors: ["DuckDuckGo Privacy", "uBlock Origin"],
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
  { axis: "Reasoning", Aureon: 95, "GPT-5.5": 82, "Opus 4.8": 88, Gemini: 78 },
  { axis: "Coding", Aureon: 92, "GPT-5.5": 80, "Opus 4.8": 90, Gemini: 75 },
  { axis: "OSINT", Aureon: 98, "GPT-5.5": 45, "Opus 4.8": 50, Gemini: 60 },
  { axis: "Vision", Aureon: 90, "GPT-5.5": 78, "Opus 4.8": 72, Gemini: 85 },
  { axis: "Security", Aureon: 94, "GPT-5.5": 55, "Opus 4.8": 60, Gemini: 50 },
  { axis: "Long context", Aureon: 88, "GPT-5.5": 82, "Opus 4.8": 95, Gemini: 90 },
];

const PRICE_DATA = [
  { plan: "Aureon", cost: 18 },
  { plan: "Aureon Pro (full suite)", cost: 399 },
  { plan: "ChatGPT Plus", cost: 20 },
  { plan: "Claude Pro", cost: 20 },
  { plan: "Gemini Advanced", cost: 20 },
  { plan: "Perplexity Pro", cost: 20 },
  { plan: "Cursor Pro", cost: 20 },
  { plan: "Palantir Foundry", cost: 500 },
];


const ProductCard = ({ p }: { p: Product }) => {
  const Icon = p.icon;
  const inner = (
    <div className="group h-full rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5 hover:border-border/60 hover:bg-card/40 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-border/40 flex items-center justify-center group-hover:bg-foreground/[0.08] transition-colors">
          <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
        </div>
        {p.badge && (
          <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-foreground/60 px-2 py-1 rounded-full border border-border/40">
            {p.badge}
          </span>
        )}
      </div>
      <h3 className="text-lg font-light tracking-tight text-foreground mb-1">{p.name}</h3>
      <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
        {p.tagline}
      </p>
      <p className="text-xs font-extralight text-muted-foreground/90 leading-relaxed mb-4">
        {p.description}
      </p>
      <div className="pt-3 border-t border-border/20">
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
    </div>
  );
  return p.route ? <Link to={p.route} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
};

const Software = () => {
  // Head is centrally managed in <RouteSeo /> (entry for /software).
  // Inject page-specific CollectionPage + ItemList JSON-LD for richer SERP.
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
      name: "Aureon Software Catalog",
      description:
        "Every Aureon tool: OSINT search, predictive engines, IDE, whiteboard, e-book generator, file scrapper, and more. Core modules on the $18/month plan; full intelligence suite on Aureon Pro ($399/month).",
      url: "https://aureonai.app/software",
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
            offers: { "@type": "Offer", price: "18", priceCurrency: "USD" },
          },
        })),
      },

    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);




  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Hero */}
          <section className="text-center space-y-4">
            <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Software · {PRODUCTS.length} products · all free
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight">
              Every Aureon tool. Free for every user.
            </h1>
            <p className="max-w-2xl mx-auto text-sm sm:text-base font-extralight text-muted-foreground leading-relaxed">
              We rebuilt the entire stack — chat, search, OSINT, cyber, CAD, data,
              authoring, vision — and made it free. Below is the complete catalog and
              how it stacks up against the paid competition.
            </p>
          </section>

          {/* Product grid */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-light tracking-tight">Public software catalog</h2>
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                ◉ Click any card to launch
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRODUCTS.map((p) => <ProductCard key={p.name} p={p} />)}
            </div>
          </section>

          {/* Composite benchmark */}
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                ◈ Composite benchmark
              </p>
              <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight">
                Aureon vs the paid stack
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
                    <Bar dataKey="aureon"    name="Aureon"        fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                      <Radar name="Aureon"    dataKey="Aureon"    stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.35} />
                      <Radar name="GPT-5.5"   dataKey="GPT-5.5"   stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
                      <Radar name="Opus 4.8"  dataKey="Opus 4.8"  stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.18} />
                      <Radar name="Gemini"    dataKey="Gemini"    stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-4">
                  ◉ Competitor monthly cost vs Aureon (free)
                </p>
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={PRICE_DATA} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis type="number" tick={{ fontSize: 11, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="plan" width={140} tick={{ fontSize: 10, fontWeight: 300, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => v === 0 ? "Free" : `$${v}/mo`} />
                      <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* Closing CTA */}
          <section className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 text-center space-y-4">
            <h2 className="text-2xl font-extralight tracking-tight">No paywalls. No tiers. No limits.</h2>
            <p className="max-w-xl mx-auto text-sm font-extralight text-muted-foreground">
              Every product above is free for every authenticated user. We run on donations
              and conviction — not subscription extraction.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-foreground/30 bg-foreground/[0.04] text-xs font-light tracking-[0.2em] uppercase text-foreground hover:bg-foreground/10 transition-colors"
              >
                Launch dashboard
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
