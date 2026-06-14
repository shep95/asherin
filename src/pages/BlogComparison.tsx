import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { Check, X, Minus, ArrowRight } from "lucide-react";

/**
 * /blog/comparison — Aureon vs ChatGPT vs Claude
 * Long-form comparison guide. Targets the "uncensored ai" /
 * "aureon vs chatgpt" / "aureon vs claude" search intent.
 *
 * SEO: per-route title/description handled in RouteSeo. This page
 * additionally injects Article + FAQPage + BreadcrumbList JSON-LD
 * for rich SERP eligibility (article carousel + FAQ accordion).
 */

const PUBLISHED = "2026-06-14";
const URL_SELF = "https://aureonai.app/blog/comparison";

type Cell = "yes" | "no" | "partial" | string;
type Row = { feature: string; aureon: Cell; chatgpt: Cell; claude: Cell; note?: string };

const MATRIX: Row[] = [
  { feature: "Entry price",                        aureon: "$47 one-time", chatgpt: "$20 / month", claude: "$20 / month",  note: "Aureon entry is a single payment. ChatGPT Plus and Claude Pro bill every month." },
  { feature: "Uncensored responses",               aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Aureon refuses nothing legal; the others refuse a substantial share of legitimate queries." },
  { feature: "Bring-your-own-key (9 providers)",   aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Use Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, or Venice on your own bill." },
  { feature: "Multi-model consensus",              aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Five-phase cross-validation across models, 45% confidence threshold." },
  { feature: "Live 30-source OSINT search",        aureon: "yes",      chatgpt: "partial", claude: "no",       note: "ChatGPT browsing is limited to a handful of curated sources; Claude has no native web." },
  { feature: "Predictive intelligence engine",     aureon: "yes",      chatgpt: "no",      claude: "no",       note: "AXRLEN NEXUS-PRIME runs probabilistic scenarios with Monte Carlo modelling." },
  { feature: "Vulnerability & exploit analysis",   aureon: "yes",      chatgpt: "no",      claude: "no",       note: "ZERLAL fault-tolerant scanning with Cyber Kill Chain mapping." },
  { feature: "Full Monaco IDE inside chat",        aureon: "yes",      chatgpt: "partial", claude: "partial",  note: "Aureon ships a sandboxed-iframe IDE with BYOK across 9 providers." },
  { feature: "FEA / thermal simulation",           aureon: "yes",      chatgpt: "no",      claude: "no",       note: "ZALI Design Suite runs design-of-experiments and material selection." },
  { feature: "Infinite whiteboard",                aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Photoshop-style layer stack, dot/square snap grids." },
  { feature: "E-book generator",                   aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Multi-session text uploads, 500-word chapters, generated cover art." },
  { feature: "End-to-end encrypted vault",         aureon: "yes",      chatgpt: "no",      claude: "no",       note: "AES-256-GCM, chrooted file access, admin RLS partitions." },
  { feature: "Persistent intelligence graph",      aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Library + Project Folders + cross-session memory recall." },
  { feature: "Voice chat",                         aureon: "yes",      chatgpt: "yes",     claude: "no",       note: "Aureon uses ElevenLabs WebRTC with live audio visualisers." },
  { feature: "Image generation",                   aureon: "yes",      chatgpt: "yes",     claude: "no",       note: "Aureon Imagine module ships with persistent gallery." },
  { feature: "Vision (image + video) input",       aureon: "yes",      chatgpt: "yes",     claude: "yes",      note: "Aureon adds FACS behavioural video tracking." },
  { feature: "Lifetime licence option",            aureon: "yes",      chatgpt: "no",      claude: "no",       note: "$470 one-time, no recurring billing ever." },
  { feature: "No mandatory monthly subscription",  aureon: "yes",      chatgpt: "no",      claude: "no",       note: "Aureon never bills monthly. Pay once or use free. Competitors require ongoing subscriptions." },
];

const FAQ = [
  {
    q: "Is Aureon really uncensored?",
    a: "Aureon refuses no lawful request. For users without their own API key, requests are routed through Venice (an uncensored Mistral-based model). Users who bring their own key keep their full provider behaviour.",
  },
  {
    q: "How does Aureon compare to ChatGPT Plus on price?",
    a: "Aureon Chat is $47/month vs ChatGPT Plus at $20/month. The price gap reflects what Aureon includes for free that ChatGPT charges enterprise tiers for: multi-model consensus, predictive engines, OSINT search, IDE, FEA simulation, and an encrypted vault.",
  },
  {
    q: "Can I keep using Claude or GPT inside Aureon?",
    a: "Yes. Aureon's BYOK system supports nine providers — Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, and Venice. You pay only your provider's metered cost; Aureon does not mark up tokens.",
  },
  {
    q: "Does Aureon train on my conversations?",
    a: "No. Conversations are stored encrypted in your private workspace and never enter any model's training set.",
  },
  {
    q: "What is the multi-model consensus engine?",
    a: "A five-phase cross-validation pipeline that runs the same prompt across several frontier models, scores agreement, and returns answers only when confidence clears a 45% threshold. It catches the hallucinations a single model misses.",
  },
];

const Cell = ({ v }: { v: Cell }) => {
  if (v === "yes")
    return (
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> Yes
      </span>
    );
  if (v === "no")
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
        <X className="h-3.5 w-3.5" strokeWidth={1.5} /> No
      </span>
    );
  if (v === "partial")
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} /> Partial
      </span>
    );
  return <span className="font-mono text-xs text-foreground/85">{v}</span>;
};

const BlogComparison = () => {
  // Per-route head (title/description/canonical/og:*) lives in RouteSeo.
  // Here we inject Article + FAQPage + BreadcrumbList JSON-LD for rich SERP.
  useEffect(() => {
    const id = "blog-comparison-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Aureon vs ChatGPT vs Claude — Honest 2026 Comparison",
        description:
          "Side-by-side comparison of Aureon, ChatGPT Plus, and Claude Pro across price, censorship, BYOK, OSINT, IDE, simulation, and privacy.",
        url: URL_SELF,
        datePublished: PUBLISHED,
        dateModified: PUBLISHED,
        inLanguage: "en-US",
        author: { "@type": "Organization", name: "Aureon" },
        publisher: {
          "@type": "Organization",
          name: "Aureon",
          logo: { "@type": "ImageObject", url: "https://aureonai.app/favicon.png" },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": URL_SELF },
        image: "https://aureonai.app/og-image.png",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://aureonai.app/" },
          { "@type": "ListItem", position: 2, name: "Blog", item: "https://aureonai.app/blog" },
          { "@type": "ListItem", position: 3, name: "Aureon vs ChatGPT vs Claude", item: URL_SELF },
        ],
      },
    ]);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-16">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden>·</li>
            <li>Blog</li>
            <li aria-hidden>·</li>
            <li className="text-foreground">Aureon vs ChatGPT vs Claude</li>
          </ol>
        </nav>

        {/* HERO */}
        <article className="space-y-6">
          <header className="space-y-4">
            <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Comparison · Published {PUBLISHED}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight leading-[1.1]">
              Aureon vs ChatGPT vs Claude — the honest 2026 comparison
            </h1>
            <p className="max-w-3xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
              Three platforms, one prompt set, no marketing. Below is a feature-by-feature
              comparison of Aureon, ChatGPT Plus, and Claude Pro — covering price,
              censorship policy, bring-your-own-key support, OSINT, the built-in IDE,
              engineering simulation, and privacy.
            </p>
          </header>

          {/* TL;DR */}
          <aside className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-6 space-y-3">
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">◉ TL;DR</p>
            <p className="text-sm font-extralight leading-relaxed text-foreground/90">
              ChatGPT and Claude are excellent general-purpose chat products. Aureon
              is a different category: an operator stack that bundles uncensored
              chat, multi-model consensus, 30-source OSINT, predictive intelligence,
              a Monaco IDE, FEA simulation, an encrypted vault, and an infinite
              whiteboard — for a single subscription. If you only need conversation,
              ChatGPT Plus at $20/month is the cheaper pick. If you need to forecast,
              investigate, build, simulate, and ship — Aureon replaces three to five
              tools at $47/month.
            </p>
          </aside>

          {/* MATRIX */}
          <section aria-labelledby="matrix-heading" className="space-y-4">
            <h2 id="matrix-heading" className="text-2xl font-light tracking-tight">
              Feature-by-feature matrix
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card/10 backdrop-blur-sm">
              <table className="w-full text-sm font-extralight">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                    <th scope="col" className="text-left p-4">Capability</th>
                    <th scope="col" className="text-left p-4">Aureon</th>
                    <th scope="col" className="text-left p-4">ChatGPT Plus</th>
                    <th scope="col" className="text-left p-4">Claude Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((r) => (
                    <tr key={r.feature} className="border-b border-border/15 last:border-0 align-top">
                      <th scope="row" className="text-left p-4 font-light text-foreground/90">
                        <div>{r.feature}</div>
                        {r.note && (
                          <div className="mt-1 text-[11px] font-extralight text-muted-foreground/80 leading-relaxed">
                            {r.note}
                          </div>
                        )}
                      </th>
                      <td className="p-4"><Cell v={r.aureon} /></td>
                      <td className="p-4"><Cell v={r.chatgpt} /></td>
                      <td className="p-4"><Cell v={r.claude} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION: CENSORSHIP */}
          <section className="space-y-3">
            <h2 className="text-2xl font-light tracking-tight">Censorship and refusal rate</h2>
            <p className="text-sm font-extralight leading-relaxed text-foreground/85">
              ChatGPT and Claude both ship with reinforcement-learning safety layers
              that refuse a measurable share of lawful queries — security research,
              medical detail, geopolitical analysis, adult fiction, and competitive
              intelligence are common refusal categories. Aureon takes the opposite
              stance: every lawful request is answered. Users who bring their own
              provider key keep that provider's native behaviour; users without a key
              are routed through Venice, an uncensored Mistral-based model. The
              platform itself adds no refusal layer.
            </p>
          </section>

          {/* SECTION: PRICING */}
          <section className="space-y-3">
            <h2 className="text-2xl font-light tracking-tight">Pricing, plainly</h2>
            <p className="text-sm font-extralight leading-relaxed text-foreground/85">
              Aureon ships four tiers: Chat at $47/month, Aureon at $199/month, Pro
              at $740/month, and a $470 one-time Lifetime licence. ChatGPT Plus is
              $20/month and Claude Pro is $20/month. The honest read: Aureon is more
              expensive per month, but it bundles capabilities that ChatGPT and
              Claude either do not ship or gate behind enterprise contracts —
              multi-model consensus, OSINT search, the predictive engine, the IDE,
              FEA simulation, and the encrypted vault. If you currently pay for
              ChatGPT Plus plus a research tool plus a writing tool plus a code
              assistant, Aureon's entry tier usually comes out cheaper.
            </p>
          </section>

          {/* SECTION: WHEN NOT */}
          <section className="space-y-3">
            <h2 className="text-2xl font-light tracking-tight">When Aureon is not the right pick</h2>
            <p className="text-sm font-extralight leading-relaxed text-foreground/85">
              If you only need conversational AI for casual writing, brainstorming,
              or homework help, ChatGPT Plus or Claude Pro is the cheaper, simpler
              choice. Aureon is built for operators — analysts, traders, engineers,
              researchers, security teams — who need the full stack in one place.
              Buying Aureon to use only the chat module is overspend.
            </p>
          </section>

          {/* FAQ */}
          <section aria-labelledby="faq-heading" className="space-y-4">
            <h2 id="faq-heading" className="text-2xl font-light tracking-tight">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-border/30 bg-card/10 backdrop-blur-sm p-4 open:bg-card/20 transition-colors"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-light text-foreground/95">
                    <span>{f.q}</span>
                    <span className="ml-4 text-[10px] tracking-[0.25em] uppercase text-muted-foreground group-open:rotate-90 transition-transform">◉</span>
                  </summary>
                  <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight">
              See the stack for yourself
            </h2>
            <p className="text-sm font-extralight text-muted-foreground max-w-xl mx-auto">
              Every Aureon tool is free to try without a credit card. Bring your own
              key or use the free Venice routing. Cancel any time.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/software"
                className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 px-6 py-3 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
              >
                Browse the software catalog
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/benchmark"
                className="inline-flex items-center gap-2 rounded-full border border-border/40 px-6 py-3 text-xs font-light tracking-[0.22em] text-muted-foreground uppercase transition-all hover:text-foreground hover:border-foreground/40"
              >
                Read the coding benchmark
              </Link>
            </div>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};

export default BlogComparison;
