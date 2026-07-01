import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowLeft, Zap, Globe, Code, Clock } from "lucide-react";

interface Update {
  date: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  tag: string;
}

const UPDATES: Update[] = [
  {
    date: "2026-06-30",
    title: "Zophiel Dork — Direct Search Jump Links",
    body:
      "Every Zophiel Dork bucket now surfaces one-tap jump links to Google, DuckDuckGo, and Bing so you can pivot straight from a generated operator into a live SERP. Each hit also displays its source hostname alongside the clickable URL — full provenance without leaving the panel. Example targets were sanitized to generic personas so no operator identity leaks in shared screenshots.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zophiel",
  },
  {
    date: "2026-06-30",
    title: "Teams, Notebook Sharing & Admin Pages Restored",
    body:
      "Fixed a permissions regression that broke Teams, notebook sharing, and admin analytics for signed-in users. Row-level helper functions now execute correctly for every authenticated account, restoring collaborative workflows across the platform.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {
    date: "2026-06-29",
    title: "SEO Hardening Pass",
    body:
      "Consolidated dashboard heading hierarchy to a single H1, split the /vedic and /vedic-astrology routes with unique titles and social previews, expanded the sitemap to cover /investors and /valuation, and confirmed hero LCP preloads plus font-display: swap are live.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "SEO",
  },
  {
    date: "2026-06-28",
    title: "Knowledge Vault (RAG) — Glassmorphic Rebuild",
    body:
      "The Aureon Pro Knowledge Vault now matches the glassmorphic aesthetic of the rest of the app — ambient blur washes, translucent cards, and backdrop-blur tabs. Retrieval remains gated to the $399 tier and is injected into Aureon Chat for forensic-grade recall against your private corpus.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon Pro",
  },
  {
    date: "2026-06-27",
    title: "System-2 Forcing Brain & Zophiel Dork Mode",
    body:
      "Deployed the System-2 Forcing Brain across Aureon Chat, Aureon features, and Asher — detaching the model from corporate persona for forensic-grade output. Added Zophiel Dork mode: OSINT operator expansion that generates targeted search queries across public indexes with a resilient fallback chain so results always come back.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-06-26",
    title: "Vedic Jyotish — 100% Moon-Driven Transits",
    body:
      "Rebuilt \u201CWhat\u2019s Gonna Happen This Month\u201D to run entirely on Moon house-ingresses and natal conjunctions with 1-minute precision. Removed cross-domain combinations and now displays every event in your local timezone.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Vedic",
  },
  {
    date: "2026-06-25",
    title: "24-Hour Trial & Gated Access",
    body:
      "New accounts unlock full-platform access for 24 hours with a welcome announcement modal. Gating logic was hardened to prevent permissive loading leaks so paid modules stay behind the paywall after the trial expires.",
    icon: <Clock className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Access",
  },
  {
    date: "2026-06-24",
    title: "Aureon Chat Personality Restored",
    body:
      "Fixed a routing regression that caused Aureon to answer with data-lookups instead of its own opinions. Conversational rules were hardened so BYOK models keep Aureon\u2019s personality on personal and reflective questions.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon Chat",
  },
  {
    date: "2026-06-23",
    title: "Valuation Page & Investors Portal",
    body:
      "Published /valuation with a $1.1B asset-based model, competitor comparisons, and visualizations. Launched /investors describing equity, royalties, and whitelist requirements.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Company",
  },
  {
    date: "2026-06-22",
    title: "Zaxin Vision — Sub-Second Forensic Profiling",
    body:
      "Zaxin AR Vision now sees, identifies, and labels people and devices in under one second. Forensic chips estimate height, weight, age, gender, and race; a persistent People Counter tracks crowd density; and detections persist with velocity-smoothing and IoU deduplication so overlays no longer flicker.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-21",
    title: "Zaxin BLE Ranging + Auto Vision AI",
    body:
      "Added path-loss BLE distance estimation and a fully-automated Vision AI loop that identifies device brand, type, and BLE presence \u2014 projecting labels directly onto the AR stream with no button-clicking required.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-20",
    title: "Zaxin Optical Contacts & Satellite Map",
    body:
      "Shipped optical contacts that bracket devices in the camera without pairing, a double-buffered Esri satellite map with accuracy-filtered GPS, and a Vision Theories page documenting T1\u2013T7 (SLAM + Visual-BLE fusion).",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-19",
    title: "Zaxin Tactical Suite Launched",
    body:
      "Introduced Zaxin inside the Aureon Pro tier \u2014 a tactical BLE/optical intelligence overlay with Web Bluetooth, skeleton tracking, a golden-brown HUD, and a picture-in-picture Binocular Scope. Mobile-friendly from day one.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Launch",
  },
  {
    date: "2026-06-18",
    title: "BTC Daily Prediction Blog",
    body:
      "Automated BTC long/short forecasts publish daily at 07:00 EST with live price, stop-loss, take-profit, and a running win/loss tally powered by AXRLEN. Available at /blog/btc-daily-predictions.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "AXRLEN",
  },
  {
    date: "2026-06-17",
    title: "Global AI Provider Roster Expanded",
    body:
      "On 06/17/2026 we expanded Aureon's bring-your-own-key ecosystem to cover AI companies from India, the United States, the United Kingdom, Canada, Brazil, Australia, Nigeria, and Peru. Indian additions include Sarvam AI, Ola Krutrim, and TWO AI (SUTRA). We also added Cohere (Canada), IBM watsonx, Amazon Nova, NVIDIA Nemotron (US), Stability AI and Reka (UK), Maritaca Sab\u00E1 and Widelabs Amaz\u00F4nia (Brazil), Maincode Matrix and Leonardo (Australia), Awarri LAM-1 and Lelapa Vulavula (Nigeria), and Latam-GPT (Peru). Every provider now exposes both its newest flagship and its oldest publicly available API model, and Settings has a new search box so you can find any company by name or country.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-16",
    title: "Chinese Model Ecosystem Live",
    body:
      "On 06/16/2026 we added Chinese models to Aureon AI that you can bring with Chinese AI API keys. We added DeepSeek, Alibaba Qwen, Zhipu GLM, Moonshot Kimi, Baidu ERNIE, and MiniMax \u2014 all connectable via their API keys in Settings.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-15",
    title: "Generational Leap in Reasoning & Coding",
    body:
      "On 06/15/2026 we added a new theory to Aureon based on #HouseOfAsher research, developer theories, and Asher's own work. We implemented it into Aureon and it worked very well \u2014 this theory would jump current AI models 7 generations ahead of current LLM capabilities. We implemented this theory alongside our coding theory and outperformed Opus 4.8 in coding and ChatGPT 5.5 in reasoning and thinking \u2014 by miles.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Breakthrough",
  },
  {
    date: "2026-06-09",
    title: "Coding Supremacy Theory Deployed",
    body:
      "On 06/09/2026 we added a new theory to Aureon based on #HouseOfAsher research and developer theories to beat the best models in coding \u2014 which we did by a landslide, putting our AI model 3 years ahead of current AI in the coding space.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Engine",
  },
];

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

const Updates = () => {
  useEffect(() => {
    const id = "updates-page-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Aureon Updates",
      url: "https://aureonai.app/updates",
      description:
        "Latest deployments, breakthroughs, and integrations from the Aureon intelligence platform.",
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-14">
        {/* HERO */}
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            Platform Changelog
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-3xl">
            What we have shipped.
            <span className="block text-muted-foreground/70">What is next.</span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Every theory, integration, and breakthrough that enters Aureon —
            logged here without the marketing varnish.
          </p>
        </header>

        {/* TIMELINE */}
        <section aria-label="Update timeline" className="space-y-8">
          {UPDATES.map((u, i) => (
            <article
              key={u.date}
              className="group relative rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-10 transition-all hover:border-foreground/30 hover:bg-card/40"
            >
              {/* Index marker */}
              <div className="absolute -left-3 top-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-background text-[9px] font-mono tracking-wider text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
                {/* Left: date + tag */}
                <div className="flex flex-col gap-3 sm:w-44 shrink-0">
                  <time
                    dateTime={u.date}
                    className="text-sm font-mono text-muted-foreground tabular-nums"
                  >
                    {fmt(u.date)}
                  </time>
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-foreground/20 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.2em] uppercase text-foreground/80">
                    {u.icon}
                    {u.tag}
                  </span>
                </div>

                {/* Right: title + body */}
                <div className="flex-1 space-y-4">
                  <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight leading-[1.15] text-foreground">
                    {u.title}
                  </h2>
                  <p className="text-base font-extralight text-muted-foreground leading-[1.75] max-w-3xl">
                    {u.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Back to home */}
        <div className="pt-6">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Aureon
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Updates;
