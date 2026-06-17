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
    date: "2026-06-15",
    title: "Generational Leap in Reasoning & Coding",
    body:
      "On 06/15/2026 we added a new theory to Aureon based on #HouseOfAsher research, developer theories, and Asher's own work. We implemented it into Aureon and it worked very well — this theory would jump current AI models 7 generations ahead of current LLM capabilities. We implemented this theory alongside our coding theory and outperformed Opus 4.8 in coding and ChatGPT 5.5 in reasoning and thinking — by miles.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Breakthrough",
  },
  {
    date: "2026-06-09",
    title: "Coding Supremacy Theory Deployed",
    body:
      "On 06/09/2026 we added a new theory to Aureon based on #HouseOfAsher research and developer theories to beat the best models in coding — which we did by a landslide, putting our AI model 3 years ahead of current AI in the coding space.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Engine",
  },
  {
    date: "2026-06-17",
    title: "Global AI Provider Roster Expanded",
    body:
      "On 06/17/2026 we expanded Aureon's bring-your-own-key ecosystem to cover AI companies from India, the United States, the United Kingdom, Canada, Brazil, Australia, Nigeria, and Peru. Indian additions include Sarvam AI, Ola Krutrim, and TWO AI (SUTRA). We also added Cohere (Canada), IBM watsonx, Amazon Nova, NVIDIA Nemotron (US), Stability AI and Reka (UK), Maritaca Sabiá and Widelabs Amazônia (Brazil), Maincode Matrix and Leonardo (Australia), Awarri LAM-1 and Lelapa Vulavula (Nigeria), and Latam-GPT (Peru). Every provider now exposes both its newest flagship and its oldest publicly available API model, and Settings has a new search box so you can find any company by name or country.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-16",
    title: "Chinese Model Ecosystem Live",
    body:
      "On 06/16/2026 we added Chinese models to Aureon AI that you can bring with Chinese AI API keys. We added DeepSeek, Alibaba Qwen, Zhipu GLM, Moonshot Kimi, Baidu ERNIE, and MiniMax — all connectable via their API keys in Settings.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
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
    <div className="min-h-screen bg-background text-foreground">
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
