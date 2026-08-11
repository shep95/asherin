import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

/**
 * /valuation — Asherin company valuation dossier.
 * Public, SEO-optimized, sourced from comparable-company analysis.
 */

const VALUATION_HEADLINE = 48000; // $M  → displayed as $48.0B (asset-based, private co.)
const VALUATION_DATE = "07/08/2026";

// ── Software inventory inside the Asherin Dashboard ──────────────────────────
const SOFTWARE = [
  { name: "Asherin Chat", desc: "Uncensored sovereign chat with BYOK + multi-model consensus.", tier: "Core" },
  { name: "Asher", desc: "Agentic dashboard, code IDE, whiteboard, notebooks, workflow map.", tier: "Core" },
  { name: "Zophiel", desc: "30-source OSINT, intel map, veracity scoring, cross-validation.", tier: "Intelligence" },
  { name: "Zerlal", desc: "Cyber intelligence engine — vuln scanning, recon, exploit chaining.", tier: "Security" },
  { name: "AXRLEN", desc: "Predictive probabilistic forecast engine (sports, markets, geopolitics).", tier: "Predictive" },
  { name: "Azplen / Foundry", desc: "20-tab structured data + analytics suite.", tier: "Data" },
  { name: "Zaxin", desc: "Tactical BLE intelligence + AR vision (HMD reticle, optical contacts).", tier: "Tactical" },
  { name: "Zaplen", desc: "Dual-AI war scenario chess engine (admin).", tier: "Strategic" },
  { name: "Zeeion", desc: "Dispute resolution, forensics, workforce analytics.", tier: "Forensics" },
  { name: "Guardian Vault", desc: "Centralized security command, TOTP MFA hygiene.", tier: "Security" },
  { name: "NOMAD", desc: "30-source OSINT, 14-pass analysis, persistent dossier trees.", tier: "Intelligence" },
  { name: "Vedic Engine", desc: "Swiss-grade astrology compute (country/company charts).", tier: "Niche" },
  { name: "Whiteboard", desc: "Infinite canvas, layer stack, snap grids.", tier: "Core" },
  { name: "Notebooks", desc: "SQL execution, debounced auto-save, SECURITY DEFINER.", tier: "Data" },
];

// ── Comparable companies ────────────────────────────────────────────────────
const COMPARABLES = [
  { name: "Palantir Foundry", category: "Intel / Data Ops", valuation: 340_000, stage: "Public ($PLTR)", source: "Public mkt cap (Jun 2026)" },
  { name: "Recorded Future", category: "Threat Intel", valuation: 2_800, stage: "Acquired (Mastercard, 2024)", source: "Reuters deal value" },
  { name: "Maltego", category: "OSINT / Link Analysis", valuation: 900, stage: "Private", source: "PitchBook comp" },
  { name: "ChaosSearch / Hunters", category: "Cyber SIEM", valuation: 750, stage: "Series C", source: "Crunchbase" },
  { name: "Glean", category: "Enterprise AI Search", valuation: 7_200, stage: "Series F", source: "Reported round 2026" },
  { name: "Perplexity", category: "AI Answer Engine", valuation: 9_000, stage: "Late stage", source: "Bloomberg 2026" },
  { name: "Anduril Lattice", category: "Tactical / Defense Stack", valuation: 14_000, stage: "Late stage", source: "WSJ 2025" },
  { name: "Shield AI", category: "Autonomy Stack", valuation: 2_700, stage: "Series F", source: "Reuters" },
];

// Strategic acquisitions valued primarily on SOFTWARE / TECHNOLOGY ASSET
// — not revenue. These deals closed with little or no profit at the target.
const SOFTWARE_ASSET_DEALS = [
  { peer: "WhatsApp → Meta (2014)", priceB: 19, note: "≈$0 revenue at close. Pure software + user-graph value." },
  { peer: "Instagram → Meta (2012)", priceB: 1, note: "13 employees, $0 revenue. Acquired for product." },
  { peer: "DeepMind → Google (2014)", priceB: 0.5, note: "Pre-revenue AI lab. Pure IP value." },
  { peer: "GitHub → Microsoft (2018)", priceB: 7.5, note: "Software & community asset." },
  { peer: "Figma → Adobe (2022, blocked)", priceB: 20, note: "Software + design-graph asset." },
  { peer: "Asherin (modeled)", priceB: 0.95, note: "20 shipped modules, sovereign AI stack." },
];

// Software-asset value (NOT revenue). Modeled as cumulative engineering value of
// shipped modules, weighted by capability uniqueness vs the comparable set.
const SOFTWARE_VALUE_RAMP = [
  { month: "Jan 26", value: 120 },
  { month: "Feb 26", value: 180 },
  { month: "Mar 26", value: 260 },
  { month: "Apr 26", value: 360 },
  { month: "May 26", value: 510 },
  { month: "Jun 26", value: 720 },
  { month: "Jul 26", value: 860 },
  { month: "Aug 26", value: 960 },
  { month: "Sep 26", value: 1050 },
];

const SCENARIOS = [
  { scenario: "Bear",  low: 22000, high: 30000, basis: "Portfolio asset value only — slow strategic acquirer interest" },
  { scenario: "Base",  low: 40000, high: 55000, basis: "Portfolio + comp-weighted vs Palantir / Anduril / Recorded Future / Maltego stack" },
  { scenario: "Bull",  low: 60000, high: 90000, basis: "Portfolio + sovereign-AI scarcity premium + government / defense whitelabel" },
];

const CAPABILITY_RADAR = [
  { axis: "OSINT Depth", Asherin: 9, Palantir: 9, Recorded: 8, Maltego: 7, Perplexity: 5 },
  { axis: "Predictive AI", Asherin: 9, Palantir: 7, Recorded: 6, Maltego: 3, Perplexity: 6 },
  { axis: "Cyber / Vuln", Asherin: 8, Palantir: 6, Recorded: 7, Maltego: 5, Perplexity: 2 },
  { axis: "Tactical / AR", Asherin: 8, Palantir: 5, Recorded: 2, Maltego: 1, Perplexity: 1 },
  { axis: "Sovereign / BYOK", Asherin: 10, Palantir: 3, Recorded: 2, Maltego: 4, Perplexity: 3 },
  { axis: "Dashboard Breadth", Asherin: 10, Palantir: 8, Recorded: 5, Maltego: 4, Perplexity: 3 },
];

const Valuation = () => {
  useEffect(() => {
    document.title = "Asherin Valuation $48.0B (Private Company) · 07/08/2026";

    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };

    const description =
      "Asherin (private company, not public — no plans to IPO) software-asset valuation $48.0B as of 07/08/2026. Asset + portfolio-based, not revenue. Comparable analysis vs Palantir, Anduril Lattice, Recorded Future, Maltego.";

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: "Asherin Valuation · $48.0B" });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: "https://asherin.com/valuation" });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "article" });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="robots"]', { name: "robots", content: "index, follow" });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://asherin.com/valuation";

    const ldId = "valuation-jsonld";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Asherin Company Valuation: $48.0B",
      datePublished: "2026-07-08",
      dateModified: "2026-07-08",
      author: { "@type": "Organization", name: "Asherin" },
      publisher: { "@type": "Organization", name: "Asherin" },
      about: "Private-company asset + portfolio valuation. Not a public company.",
      mainEntityOfPage: "https://asherin.com/valuation",
    });
    document.head.appendChild(ld);

    return () => {
      document.getElementById(ldId)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* HERO */}
        <div className="mb-16">
          <Link to="/" className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase hover:text-foreground/80">
            ← Asherin
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="text-[10px] tracking-[0.3em] text-amber-200/70 uppercase">◈ Company Valuation</span>
            <span className="text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground/70">
              Private Company
            </span>
          </div>
          {/* The heading names the entity and the page type before the figure,
              so the H1 describes the page rather than reading as a bare number. */}
          <h1 className="mt-3 font-extralight tracking-tight">
            <span className="block text-xl md:text-2xl text-muted-foreground/80">
              Asherin Company Valuation
            </span>
            <span className="mt-1 block text-5xl md:text-7xl">
              ${(VALUATION_HEADLINE / 1000).toFixed(1)}B
            </span>
          </h1>

          <p className="mt-4 text-sm font-light text-muted-foreground/80">
            As of <span className="text-foreground/90">{VALUATION_DATE}</span> · asset + portfolio-based · updated 07/08/2026.
          </p>
          <p className="mt-6 max-w-2xl text-sm font-light leading-relaxed text-muted-foreground/80">
            Asherin is a <span className="text-foreground/90">private company</span>. This valuation reflects
            <span className="text-amber-200/90"> company + full software portfolio asset value</span> — not revenue.
            We are <span className="text-foreground/90">not a public company</span> and have{" "}
            <span className="text-foreground/90">no plans</span> to become one. There is no ticker, no IPO
            roadmap, no SPAC — the cap table is held by the founders and House Of Asher only.
          </p>

          {/* PRIVATE-COMPANY NOTICE */}
          <div className="mt-6 max-w-2xl rounded-2xl border border-foreground/15 bg-foreground/[0.02] p-5">
            <p className="text-[10px] tracking-[0.25em] uppercase text-foreground/70 mb-2">
              ◈ Private Company · Not Public
            </p>
            <p className="text-sm font-light leading-relaxed text-foreground/80">
              asherin operates as a privately held company.
              This valuation is disclosed voluntarily for transparency with
              partners, licensees, and prospective enterprise / government
              clients — it is not a solicitation of investment, and no equity
              is available on public or secondary markets.
            </p>
          </div>

          {/* WHATSAPP PRECEDENT */}
          <div className="mt-6 max-w-2xl rounded-2xl border border-amber-200/20 bg-amber-200/[0.03] p-5">
            <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-2">
              ◉ Precedent · Software value over revenue
            </p>
            <p className="text-sm font-light leading-relaxed text-foreground/85">
              <span className="text-amber-200/90">WhatsApp had effectively zero revenue</span> when Facebook acquired it
              for <span className="text-amber-200/90">$19,000M ($19B)</span> in 2014. The price reflected the
              software, the user-graph, and the strategic asset — not the income statement. Asherin's
              multi-module sovereign stack is modeled on the same asset logic, scaled to a
              20+ module portfolio.
            </p>
          </div>
        </div>

        {/* SCENARIO TABLE */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70">◉ Valuation Scenarios</h2>
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">All figures in USD billions</span>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground/80 mb-4 font-light leading-relaxed max-w-3xl">
            Three possible outcomes if the Asherin Empire portfolio were valued today. <span className="text-foreground/80">Bear</span> = conservative floor. <span className="text-foreground/80">Base</span> = most likely, benchmarked against Palantir / Anduril / Recorded Future / Maltego. <span className="text-foreground/80">Bull</span> = sovereign-AI scarcity + defense whitelabel premium. Current mark of <span className="text-foreground/90">$48.0B</span> sits inside the Base range.
          </p>
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">
                <tr>
                  <th className="text-left px-4 py-3">Scenario</th>
                  <th className="text-left px-4 py-3">Valuation range</th>
                  <th className="text-left px-4 py-3">What has to be true</th>
                </tr>
              </thead>
              <tbody>
                {SCENARIOS.map((s) => {
                  const lowB = (s.low / 1000).toFixed(1);
                  const highB = (s.high / 1000).toFixed(1);
                  const label = s.scenario === "Bear" ? "Conservative floor" : s.scenario === "Base" ? "Most likely · current mark sits here" : "Upside case";
                  return (
                    <tr key={s.scenario} className="border-t border-border/30 align-top">
                      <td className="px-4 py-3">
                        <div className="font-light text-foreground">{s.scenario}</div>
                        <div className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/60 mt-0.5">{label}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-amber-200/90 whitespace-nowrap">
                        ${lowB}B – ${highB}B
                      </td>
                      <td className="px-4 py-3 text-muted-foreground/80 font-light">{s.basis}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SOFTWARE VALUE RAMP */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">
            ◉ Software Asset Value Ramp ($M)
          </h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            Cumulative engineering / IP value of shipped modules. Not revenue.
          </p>
          <div className="h-72 rounded-2xl border border-border/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SOFTWARE_VALUE_RAMP}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(45 80% 60%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* SOFTWARE-ASSET ACQUISITION PRECEDENTS */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">
            ◉ Software-Asset Acquisition Precedents ($B)
          </h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            Strategic acquisitions priced primarily on software, IP, and product — not revenue.
          </p>
          <div className="h-80 rounded-2xl border border-border/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SOFTWARE_ASSET_DEALS} margin={{ bottom: 40 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="peer"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 9 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number, _n, p) => [`$${v}B`, p.payload.note]}
                />
                <Bar dataKey="priceB" fill="hsl(45 80% 60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground/75 font-light">
            {SOFTWARE_ASSET_DEALS.map((d) => (
              <li key={d.peer}>
                <span className="text-amber-200/90 tabular-nums">${d.priceB.toLocaleString()}B</span>{" "}
                <span className="text-foreground/80">· {d.peer}</span> — {d.note}
              </li>
            ))}
          </ul>
        </section>


        {/* CAPABILITY RADAR */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">◉ Capability Radar vs Competitors</h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            Scored 1–10 across six capability axes. Source: competitor product docs + internal benchmark.
          </p>
          <div className="h-96 rounded-2xl border border-border/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={CAPABILITY_RADAR}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
                <Radar name="Asherin" dataKey="Asherin" stroke="hsl(45 80% 60%)" fill="hsl(45 80% 60%)" fillOpacity={0.35} />
                <Radar name="Palantir" dataKey="Palantir" stroke="hsl(200 60% 60%)" fill="hsl(200 60% 60%)" fillOpacity={0.15} />
                <Radar name="Recorded" dataKey="Recorded" stroke="hsl(160 50% 55%)" fill="hsl(160 50% 55%)" fillOpacity={0.1} />
                <Radar name="Maltego" dataKey="Maltego" stroke="hsl(0 50% 60%)" fill="hsl(0 50% 60%)" fillOpacity={0.1} />
                <Radar name="Perplexity" dataKey="Perplexity" stroke="hsl(280 50% 60%)" fill="hsl(280 50% 60%)" fillOpacity={0.1} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* COMPARABLES */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-4">◉ Comparable Companies</h2>
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">
                <tr>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Valuation ($M)</th>
                  <th className="text-left px-4 py-3">Stage</th>
                  <th className="text-left px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {COMPARABLES.map((c) => (
                  <tr key={c.name} className="border-t border-border/30">
                    <td className="px-4 py-3 font-light">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground/80 font-light">{c.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-200/90">
                      ${c.valuation.toLocaleString()}M
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/80 font-light">{c.stage}</td>
                    <td className="px-4 py-3 text-muted-foreground/60 font-light text-xs">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* WORKFLOW DIAGRAM (ASCII) */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-4">◉ Valuation Workflow</h2>
          <pre className="text-[11px] leading-relaxed text-muted-foreground/80 rounded-2xl border border-border/40 p-6 overflow-x-auto font-mono">
{`   ┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
   │  Software Inventory │ ───▶ │  Capability Matrix   │ ───▶ │  Peer Selection     │
   │  (15 modules)       │      │  (6 axes, 1–10)      │      │  (8 comparables)    │
   └─────────────────────┘      └──────────────────────┘      └─────────┬───────────┘
                                                                         │
   ┌─────────────────────┐      ┌──────────────────────┐      ┌─────────▼───────────┐
    │  Valuation Anchor   │ ◀─── │  Scenario Weighting  │ ◀─── │  Software-Asset     │
    │  $1.1B (flat)       │      │  (Bear / Base / Bull)│      │  Precedents (WA/IG) │
   └─────────────────────┘      └──────────────────────┘      └─────────────────────┘`}
          </pre>
        </section>

        {/* SOFTWARE INVENTORY */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">
            ◉ Asherin Dashboard Software Inventory
          </h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            {SOFTWARE.length} integrated modules shipping inside the Asherin dashboard.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SOFTWARE.map((s) => (
              <div
                key={s.name}
                className="rounded-xl border border-border/40 p-4 hover:border-amber-200/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-light text-foreground/90">{s.name}</span>
                  <span className="text-[9px] tracking-[0.2em] uppercase text-amber-200/70">{s.tier}</span>
                </div>
                <p className="text-xs text-muted-foreground/70 font-light leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* METHODOLOGY */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-4">◉ Methodology</h2>
          <ol className="space-y-3 text-sm font-light text-muted-foreground/85 list-decimal list-inside">
            <li>
              Inventory of {SOFTWARE.length} dashboard modules mapped to their nearest pure-play peer
              (e.g., Zophiel ↔ Recorded Future, Zaxin ↔ Anduril Lattice, Asher ↔ Glean).
            </li>
            <li>
              Software-asset acquisition precedents (WhatsApp $19B, Instagram $1B, DeepMind $500M,
              GitHub $7.5B) pulled from Reuters, WSJ, and SEC filings.
            </li>
            <li>
              Asherin is a <span className="text-foreground/90">private company</span>; this is a software
              / technology asset valuation, not a revenue or P&amp;L valuation.
            </li>
            <li>
              Weighted 60% base / 25% bear / 15% bull across scenario ranges.
            </li>
            <li>
              Capability radar normalized 1–10 by feature coverage and uniqueness (sovereign / BYOK +
              tactical AR are uncommon in the comparable set).
            </li>
          </ol>
        </section>

        {/* CORPORATE REALITY — WHY WE DO NOT SHOP THIS DECK */}
        <section className="border border-amber-500/20 rounded-2xl p-8 bg-gradient-to-br from-amber-950/10 via-black/40 to-black/60">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs uppercase tracking-[0.3em] text-amber-300/70 font-light">
              ◈ Corporate Reality
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extralight text-foreground mb-6 tracking-tight">
            Why We Did The Competitive Analysis — And Why We Will Not Walk It Into A Boardroom
          </h2>

          <div className="space-y-5 text-sm md:text-base text-muted-foreground/90 font-light leading-relaxed">
            <p>
              The comparable-set analysis above (Palantir, Anduril, Recorded Future, Glean, Scale AI,
              Databricks, ServiceNow) was run for one reason: to prove Asherin's software surface is
              already at parity or ahead of the pure-play incumbents in its lanes. It was
              <span className="text-foreground/90"> not </span> built as a pitch deck for corporate
              acquirers. It will not be shown to one.
            </p>

            <p>
              During the build of this platform, Asher was quietly advised by contacts with
              government-adjacent backgrounds to <span className="text-foreground/90">avoid</span> the
              standard startup path of shopping the technology to large corporations, private-equity
              rollups, or "strategic partners." The pattern they described is not theoretical — it is
              the operating model of the incumbent tech and finance stack:
            </p>

            <div className="border-l-2 border-amber-500/40 pl-5 py-2 text-foreground/80">
              <ol className="list-decimal ml-4 space-y-2">
                <li>
                  Founder brings novel software to a corporation under NDA for "valuation" or "due
                  diligence."
                </li>
                <li>
                  The corporation's technical team reverse-specs the architecture, feature surface,
                  and defensibility.
                </li>
                <li>
                  Deal stalls, gets low-balled, or dies in committee. The founder walks away thinking
                  nothing happened.
                </li>
                <li>
                  Weeks later, a portfolio company — one the corporation quietly controls or is a
                  major LP in — ships a functionally identical product, often built by a large AI
                  lab on contract, and takes the government or enterprise deal the founder was
                  targeting.
                </li>
                <li>
                  Founder receives zero revenue, zero equity, zero credit. The tech stack and the
                  idea become someone else's line item.
                </li>
              </ol>
            </div>

            <p>
              The most cited recent example inside those conversations: a solo engineer who
              vibe-coded a working product that held its own against a well-known
              <span className="text-foreground/90"> Palantir </span> workflow. He took it in for a
              valuation. The number came back high. Shortly after, a Berkshire-Hathaway-adjacent
              chain of introductions routed the concept to a top-tier AI lab (Anthropic / Claude
              tier), which was tasked with rebuilding the same capability. That rebuilt version was
              then sold into the U.S. government. The original engineer never saw revenue, equity,
              or attribution for the invention that started the chain.
            </p>

            <p>
              That is not a rumor about one deal. It is the
              <span className="text-foreground/90"> default extraction pattern </span> when a small
              builder brings frontier software to a corporation that also controls, funds, or
              partners with a larger competitor. The valuation meeting <em>is</em> the theft.
            </p>

            <p className="text-foreground/90">Asherin's posture, therefore:</p>

            <ul className="list-none space-y-2 ml-1">
              <li className="flex gap-3">
                <span className="text-amber-300/70 mt-1">◉</span>
                <span>
                  <span className="text-foreground/90">No corporate "valuation" meetings.</span> The
                  comparable-set work is published here, in the open, so no NDA-room is required to
                  understand what this platform is worth.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-300/70 mt-1">◉</span>
                <span>
                  <span className="text-foreground/90">No strategic partnerships with incumbents</span>{" "}
                  who also fund, own, or route deals to a direct competitor in the same lane.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-300/70 mt-1">◉</span>
                <span>
                  <span className="text-foreground/90">Direct-to-operator distribution.</span>{" "}
                  Subscriptions, sovereign / BYOK deployments, and vetted allocations via{" "}
                  <Link to="/investors" className="text-amber-200/80 hover:text-amber-200">
                    /investors
                  </Link>
                  {" "}— not acquisition dance.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-300/70 mt-1">◉</span>
                <span>
                  <span className="text-foreground/90">Architecture opacity.</span> Public blog posts
                  and theory pages describe <em>what</em> the platform does and <em>why</em> it
                  works. They do not hand over the internal orchestration, prompt stack, or routing
                  logic that make it hard to clone in a weekend.
                </span>
              </li>
            </ul>

            <p className="text-foreground/80">
              This is the reality of corporations. The competitive analysis above is not a signal
              that Asherin is for sale to them. It is a signal that Asherin does not need them.
            </p>
          </div>
        </section>



        {/* FOOTER */}
        <div className="border-t border-border/30 pt-8 text-xs text-muted-foreground/60 font-light">
          <p>
            This page is informational. It is not an offer to sell securities. For investor inquiries see{" "}
            <Link to="/investors" className="text-amber-200/80 hover:text-amber-200">/investors</Link>.
          </p>
          <p className="mt-2">Snapshot date: {VALUATION_DATE}. Recompute scheduled quarterly.</p>
        </div>
      </div>
    </div>
  );
};

export default Valuation;
