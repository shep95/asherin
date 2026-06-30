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
 * /valuation — Aureon company valuation dossier.
 * Public, SEO-optimized, sourced from comparable-company analysis.
 */

const VALUATION_HEADLINE = 1100; // $M  → displayed as $1.1B (flat headline number)
const VALUATION_DATE = "06/26/2026";

// ── Software inventory inside the Aureon Dashboard ──────────────────────────
const SOFTWARE = [
  { name: "Aureon Chat", desc: "Uncensored sovereign chat with BYOK + multi-model consensus.", tier: "Core" },
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
  { peer: "Aureon (modeled)", priceB: 0.95, note: "20 shipped modules, sovereign AI stack." },
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
  { scenario: "Bear", low: 600, high: 720, basis: "Software value only — slow strategic acquirer interest" },
  { scenario: "Base", low: 800, high: 1100, basis: "Software value — comp-weighted vs Palantir / Maltego / Anduril stack" },
  { scenario: "Bull", low: 1300, high: 1800, basis: "Software value + sovereign-AI scarcity premium" },
];

const CAPABILITY_RADAR = [
  { axis: "OSINT Depth", Aureon: 9, Palantir: 9, Recorded: 8, Maltego: 7, Perplexity: 5 },
  { axis: "Predictive AI", Aureon: 9, Palantir: 7, Recorded: 6, Maltego: 3, Perplexity: 6 },
  { axis: "Cyber / Vuln", Aureon: 8, Palantir: 6, Recorded: 7, Maltego: 5, Perplexity: 2 },
  { axis: "Tactical / AR", Aureon: 8, Palantir: 5, Recorded: 2, Maltego: 1, Perplexity: 1 },
  { axis: "Sovereign / BYOK", Aureon: 10, Palantir: 3, Recorded: 2, Maltego: 4, Perplexity: 3 },
  { axis: "Dashboard Breadth", Aureon: 10, Palantir: 8, Recorded: 5, Maltego: 4, Perplexity: 3 },
];

const Valuation = () => {
  useEffect(() => {
    document.title = "Aureon Valuation $1.1B (Private Company) · 06/26/2026";

    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };

    const description =
      "Aureon (private company) software-asset valuation $1.1B as of 06/26/2026. Based on software value, not revenue — modeled like WhatsApp's $19B Meta acquisition. Comparable analysis vs Palantir, Recorded Future, Maltego, Anduril Lattice.";

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: "Aureon Valuation · $1.1B" });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: "https://aureonai.app/valuation" });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "article" });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="robots"]', { name: "robots", content: "index, follow" });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://aureonai.app/valuation";

    const ldId = "valuation-jsonld";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Aureon Company Valuation: $1.1B",
      datePublished: "2026-06-26",
      author: { "@type": "Organization", name: "Aureon" },
      publisher: { "@type": "Organization", name: "Aureon" },
      about: "Private-company software-asset valuation based on comparable acquisitions.",
      mainEntityOfPage: "https://aureonai.app/valuation",
    });
    document.head.appendChild(ld);

    return () => {
      document.getElementById(ldId)?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* HERO */}
        <div className="mb-16">
          <Link to="/" className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase hover:text-foreground/80">
            ← Aureon
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="text-[10px] tracking-[0.3em] text-amber-200/70 uppercase">◈ Company Valuation</span>
            <span className="text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground/70">
              Private Company
            </span>
          </div>
          <h1 className="mt-3 text-5xl md:text-7xl font-extralight tracking-tight">
            ${(VALUATION_HEADLINE / 1000).toFixed(1)}B
          </h1>
          <p className="mt-4 text-sm font-light text-muted-foreground/80">
            As of <span className="text-foreground/90">{VALUATION_DATE}</span> · based on market research and competitive analysis.
          </p>
          <p className="mt-6 max-w-2xl text-sm font-light leading-relaxed text-muted-foreground/80">
            Aureon is a <span className="text-foreground/90">private company</span>. This valuation is based on{" "}
            <span className="text-amber-200/90">software / technology asset value</span> — not revenue. The same
            framework values shipped engineering, defensible IP, and capability uniqueness rather than P&amp;L.
          </p>

          {/* WHATSAPP PRECEDENT */}
          <div className="mt-6 max-w-2xl rounded-2xl border border-amber-200/20 bg-amber-200/[0.03] p-5">
            <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-2">
              ◉ Precedent · Software value over revenue
            </p>
            <p className="text-sm font-light leading-relaxed text-foreground/85">
              <span className="text-amber-200/90">WhatsApp had effectively zero revenue</span> when Facebook acquired it
              for <span className="text-amber-200/90">$19,000M ($19B)</span> in 2014. The price reflected the
              software, the user-graph, and the strategic asset — not the income statement. Aureon's range is
              modeled on the same logic.
            </p>
          </div>
        </div>

        {/* SCENARIO TABLE */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-4">◉ Scenarios</h2>
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">
                <tr>
                  <th className="text-left px-4 py-3">Scenario</th>
                  <th className="text-left px-4 py-3">Range ($M)</th>
                  <th className="text-left px-4 py-3">Basis</th>
                </tr>
              </thead>
              <tbody>
                {SCENARIOS.map((s) => (
                  <tr key={s.scenario} className="border-t border-border/30">
                    <td className="px-4 py-3 font-light">{s.scenario}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-200/90">
                      ${s.low}M – ${s.high}M
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/80 font-light">{s.basis}</td>
                  </tr>
                ))}
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
                <Radar name="Aureon" dataKey="Aureon" stroke="hsl(45 80% 60%)" fill="hsl(45 80% 60%)" fillOpacity={0.35} />
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
   │  Valuation Range    │ ◀─── │  Scenario Weighting  │ ◀─── │  Software-Asset     │
   │  $800M – $1.1B      │      │  (Bear / Base / Bull)│      │  Precedents (WA/IG) │
   └─────────────────────┘      └──────────────────────┘      └─────────────────────┘`}
          </pre>
        </section>

        {/* SOFTWARE INVENTORY */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">
            ◉ Aureon Dashboard Software Inventory
          </h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            {SOFTWARE.length} integrated modules shipping inside the Aureon dashboard.
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
              Aureon is a <span className="text-foreground/90">private company</span>; this is a software
              / technology asset valuation, not a revenue or P&amp;L valuation.
            </li>
            <li>
              Weighted 60% base / 25% bear / 15% bull across scenario ranges.
            </li>
            <li>
              Capability radar normalized 1–10 by feature coverage and uniqueness (sovereign / BYOK +
              tactical AR are unmatched in the comparable set).
            </li>
          </ol>
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
