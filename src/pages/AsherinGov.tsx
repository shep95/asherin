// /asherin.gov — Government / sovereign-partner landing page.
// Public, SEO-lite (targeted, not aggressive), theme-matched to the Asherin
// dark aesthetic. Uses the aureon wallpaper as a fixed background.

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, Cpu, Lock, Radar, Building2, Scale, Eye, Zap, ArrowRight, LogIn, Terminal } from "lucide-react";
import { getWallpaperSrc } from "@/lib/wallpapers";
import { useAuth } from "@/contexts/AuthContext";

const CAPABILITIES = [
  {
    icon: Eye,
    tag: "OSINT",
    title: "Zophiel Intelligence Engine",
    body: "30-source open-source intelligence, veracity scoring, cross-jurisdictional link analysis. Whitelabel deployable behind an air-gapped perimeter.",
  },
  {
    icon: Radar,
    tag: "Predictive",
    title: "AXRLEN Forecast Engine",
    body: "Probabilistic scenario modeling for geopolitics, markets, and force posture. Country charts, event corpus, transit engine.",
  },
  {
    icon: Shield,
    tag: "Cyber",
    title: "Zerlal Vulnerability & Recon",
    body: "Vulnerability chaining, attack-surface recon, zero-day confidence scoring. Deployable as a sealed government instance.",
  },
  {
    icon: Cpu,
    tag: "Tactical",
    title: "Zaxin AR Vision & BLE Grid",
    body: "Optical + Bluetooth Low Energy overlay for tactical operators. Head-mounted reticle, precision GPS on Web Mercator, Esri satellite basemap.",
  },
  {
    icon: Lock,
    tag: "Sovereign",
    title: "Sovereign Vault (ZIAASSETS)",
    body: "AES-256-GCM chamber-scoped encrypted vault. Multi-rank RLS, audit ledger, per-chamber key material. Air-gap import supported.",
  },
  {
    icon: Scale,
    tag: "Legal",
    title: "Asherin Legal-Advisor Mode",
    body: "Deep multi-jurisdiction legal research inside Asherin chat — statutes, case law, treaties, and older laws that still supersede newer ones.",
  },
];

const WHITELABEL_TIERS = [
  {
    name: "Sovereign Instance",
    price: "Custom",
    seats: "Up to 250 operators",
    features: [
      "Fully whitelabeled UI (logo, palette, domain)",
      "Air-gapped or private-VPC deployment",
      "Dedicated key material (no shared tenancy)",
      "Choice of Asherin, Asher, Zophiel, AXRLEN, Zerlal, Zaxin, ZIAASSETS",
    ],
  },
  {
    name: "National Deployment",
    price: "Custom",
    seats: "Unlimited operators",
    features: [
      "Multi-agency federation with per-agency RLS",
      "Sovereign key custody (HSM-backed)",
      "On-premise inference option (BYO model)",
      "24/7 dedicated engineering liaison",
    ],
  },
  {
    name: "Allied Coalition",
    price: "Treaty-based",
    seats: "Cross-border",
    features: [
      "Multilateral data-sharing controls",
      "Per-partner intelligence firewalls",
      "Bilateral audit exports",
      "Joint whitelabel co-branding",
    ],
  },
];

const AsherinGov = () => {
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    document.title = "Asherin · Government & Sovereign Partners";
    const upsert = (sel: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };
    upsert('meta[name="description"]', { name: "description", content: "asherin provides ai, public-source research, security, mapping, and private deployment options for public institutions." });
    upsert('meta[property="og:title"]', { property: "og:title", content: "Asherin · Government Partners" });
    upsert('meta[property="og:description"]', { property: "og:description", content: "ai, public-source research, security, mapping, and private deployment options for public institutions." });
    upsert('meta[name="robots"]', { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" });
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://asherin.com/asherin.gov";
  }, []);

  const wallpaper = getWallpaperSrc("aureon");

  return (
    <div className="relative min-h-screen text-foreground overflow-x-hidden">
      {/* Asherin wallpaper — fixed, dimmed, degrades to solid bg if image fails */}
      <div
        className="fixed inset-0 -z-10 bg-background bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(to bottom, hsl(var(--background)/0.72), hsl(var(--background)/0.92)), url(${wallpaper})` }}
        aria-hidden
      />

      <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
        {/* Back link */}
        <Link to="/" className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase hover:text-foreground/80">
          ← Asherin
        </Link>

        {/* HERO */}
        <header className="mt-8 mb-20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] tracking-[0.3em] uppercase px-2 py-0.5 rounded-full border border-amber-300/40 text-amber-200/90">
              ◈ Asherin · Government
            </span>
            <span className="text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground/70">
              Sovereign Partners
            </span>
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl md:text-7xl font-extralight tracking-tight leading-[1.05]">
            Sovereign software.<br />
            <span className="text-amber-200/90">For sovereign partners.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg font-light leading-relaxed text-foreground/75">
            Asherin — the House Of Asher's civil-and-defense technology arm —
            partners with governments, ministries, and allied agencies to
            deploy sovereign AI, OSINT, cyber, tactical, and encrypted-vault
            software. Every deployment is whitelabelable, air-gap capable,
            and delivered with dedicated engineering liaison.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {/* Auth-aware primary CTA: authenticated operators drop straight
                into the Command Deck; unauthenticated visitors land on the
                sign-in surface with a next= redirect back to the deck. */}
            {authLoading ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-border/30 bg-background/30 px-5 py-3 text-sm tracking-wide text-muted-foreground/70">
                Checking session…
              </span>
            ) : user ? (
              <Link
                to="/asherin-gov/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-300/15 px-5 py-3 text-sm tracking-wide text-amber-100 hover:bg-amber-300/25 transition"
              >
                <Terminal className="h-4 w-4" /> Enter Command Deck <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/?next=/asherin-gov/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-300/15 px-5 py-3 text-sm tracking-wide text-amber-100 hover:bg-amber-300/25 transition"
              >
                <LogIn className="h-4 w-4" /> Sign in to Command Deck <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <a
              href="mailto:government@aureonai.app?subject=Asherin%20Government%20Inquiry"
              className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-5 py-3 text-sm tracking-wide text-foreground/80 hover:border-foreground/60 transition"
            >
              Partnership inquiry <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/software"
              className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-5 py-3 text-sm tracking-wide text-foreground/80 hover:border-foreground/50 transition"
            >
              Software catalog
            </Link>
          </div>
        </header>

        {/* CAPABILITIES */}
        <section className="mb-20">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-6">◉ Capabilities we deploy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITIES.map((c) => (
              <article key={c.title} className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-6 hover:border-amber-300/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground/45 mb-4">
                  <c.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {c.tag}
                </div>
                <h3 className="text-base font-light tracking-wide text-foreground mb-2">{c.title}</h3>
                <p className="text-[13px] font-light leading-relaxed text-foreground/65">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* WHITELABEL */}
        <section className="mb-20">
          <div className="mb-6">
            <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">◉ Whitelabel deployment tiers</h2>
            <p className="text-sm font-light text-foreground/60 max-w-2xl">
              Every Asherin engagement is bespoke. Pricing is a function of
              scope, sovereignty requirements, and integration depth — the
              tiers below outline typical shapes, not fixed SKUs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WHITELABEL_TIERS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-6 flex flex-col">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="text-lg font-light tracking-wide">{t.name}</h3>
                  <span className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80">{t.price}</span>
                </div>
                <p className="text-[11px] tracking-[0.2em] uppercase text-foreground/45 mb-4">{t.seats}</p>
                <ul className="space-y-2 text-[13px] font-light leading-relaxed text-foreground/70 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-amber-200/60 shrink-0">◆</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* GOVERNANCE / TRUST */}
        <section className="mb-20 rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-8">
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 rounded-lg border border-amber-300/40 bg-amber-300/5 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-amber-200" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-light tracking-wide mb-2">privately held, with clear accountability.</h2>
              <p className="text-sm font-light leading-relaxed text-foreground/70 max-w-3xl">
                asherin is privately held. its ownership structure and technical
                controls can be reviewed during procurement so a public institution
                can assess governance, data handling, and deployment responsibility
                before making a decision.
              </p>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] tracking-[0.15em] uppercase text-foreground/60">
                <div><div className="text-foreground/90 text-lg font-light mb-1">AES-256-GCM</div>Vault encryption</div>
                <div><div className="text-foreground/90 text-lg font-light mb-1">Air-Gap</div>Deploy option</div>
                <div><div className="text-foreground/90 text-lg font-light mb-1">BYO Model</div>Sovereign inference</div>
                <div><div className="text-foreground/90 text-lg font-light mb-1">RLS</div>Per-agency scoping</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.06] to-transparent p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-light tracking-wide mb-2">Ready to open a channel?</h2>
              <p className="text-sm font-light leading-relaxed text-foreground/70 max-w-2xl">
                Government inquiries are routed to the House Of Asher partner
                desk. First contact typically ends in a signed NDA and a
                capability walkthrough on your infrastructure of choice.
              </p>
            </div>
            <a
              href="mailto:government@aureonai.app?subject=Asherin%20Government%20Inquiry"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-300/15 px-5 py-3 text-sm tracking-wide text-amber-100 hover:bg-amber-300/25 transition shrink-0"
            >
              <Zap className="h-4 w-4" />
              government@aureonai.app
            </a>
          </div>
        </section>

        {/* footer */}
        <footer className="mt-16 pt-8 border-t border-foreground/10 flex flex-wrap justify-between gap-4 text-[10px] tracking-[0.25em] uppercase text-foreground/40">
          <span>asherin · public institutions desk</span>
          <Link to="/valuation" className="hover:text-foreground/70">Company Valuation →</Link>
        </footer>
      </div>
    </div>
  );
};

export default AsherinGov;
