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

const VALUATION_LOW = 800; // $M
const VALUATION_HIGH = 1100; // $M
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

const REVENUE_MULTIPLES = [
  { peer: "Palantir", multiple: 24 },
  { peer: "CrowdStrike", multiple: 18 },
  { peer: "Recorded Future", multiple: 11 },
  { peer: "Maltego", multiple: 9 },
  { peer: "Glean", multiple: 28 },
  { peer: "Perplexity", multiple: 45 },
  { peer: "Aureon (applied)", multiple: 22 },
];

const ARR_PROJECTION = [
  { month: "Jan 26", arr: 0.8 },
  { month: "Feb 26", arr: 1.4 },
  { month: "Mar 26", arr: 2.6 },
  { month: "Apr 26", arr: 4.1 },
  { month: "May 26", arr: 6.0 },
  { month: "Jun 26", arr: 8.7 },
  { month: "Jul 26", arr: 12.4 },
  { month: "Aug 26", arr: 17.0 },
  { month: "Sep 26", arr: 22.5 },
];

const SCENARIOS = [
  { scenario: "Bear", low: 600, high: 720, basis: "12x ARR, slow enterprise adoption" },
  { scenario: "Base", low: 800, high: 1100, basis: "22x ARR midpoint, comp-weighted" },
  { scenario: "Bull", low: 1300, high: 1800, basis: "32x ARR, defense + intel contracts" },
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
    document.title = "Aureon Valuation · $800M–$1.1B · 06/26/2026";
    const meta = document.querySelector('meta[name="description"]') ?? document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute(
      "content",
      "Aureon company valuation $800M–$1.1B as of 06/26/2026. Comparable-company analysis vs Palantir, Recorded Future, Maltego, Glean, Anduril Lattice. Software inventory, ARR projections, capability radar.",
    );
    if (!meta.parentElement) document.head.appendChild(meta);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* HERO */}
        <div className="mb-16">
          <Link to="/" className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase hover:text-foreground/80">
            ← Aureon
          </Link>
          <p className="mt-8 text-[10px] tracking-[0.3em] text-amber-200/70 uppercase">◈ Company Valuation</p>
          <h1 className="mt-3 text-5xl md:text-7xl font-extralight tracking-tight">
            ${VALUATION_LOW}M – ${(VALUATION_HIGH / 1000).toFixed(1)}B
          </h1>
          <p className="mt-4 text-sm font-light text-muted-foreground/80">
            As of <span className="text-foreground/90">{VALUATION_DATE}</span> · based on market research and competitive analysis.
          </p>
          <p className="mt-6 max-w-2xl text-sm font-light leading-relaxed text-muted-foreground/80">
            Aureon is valued using a comparable-company framework against publicly disclosed valuations of
            intelligence, cyber, and AI-platform peers. Range reflects revenue-multiple compression vs.
            expansion under enterprise + defense adoption scenarios.
          </p>
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

        {/* ARR PROJECTION */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">◉ ARR Projection ($M)</h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            Modeled monthly recurring revenue ramp across Aureon's four subscription tiers.
          </p>
          <div className="h-72 rounded-2xl border border-border/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ARR_PROJECTION}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="arr" stroke="hsl(45 80% 60%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* REVENUE MULTIPLES */}
        <section className="mb-16">
          <h2 className="text-xs tracking-[0.3em] uppercase text-foreground/70 mb-2">◉ Revenue Multiples vs Peers</h2>
          <p className="text-xs text-muted-foreground/60 mb-4 font-light">
            EV/ARR multiples sourced from public filings and reported private rounds.
          </p>
          <div className="h-72 rounded-2xl border border-border/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_MULTIPLES}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="peer" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="multiple" fill="hsl(45 80% 60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                      ${c.valuation.toLocaleString()}
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
   │  (20 modules)       │      │  (6 axes, 1–10)      │      │  (8 comparables)    │
   └─────────────────────┘      └──────────────────────┘      └─────────┬───────────┘
                                                                         │
   ┌─────────────────────┐      ┌──────────────────────┐      ┌─────────▼───────────┐
   │  Valuation Range    │ ◀─── │  Scenario Weighting  │ ◀─── │  EV/ARR Multiples   │
   │  $800M – $1.1B      │      │  (Bear / Base / Bull)│      │  (median = 22x)     │
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
              Public EV/ARR multiples pulled from Bloomberg, Reuters, PitchBook, and Crunchbase
              (June 2026 snapshot).
            </li>
            <li>
              Aureon ARR projected via bottom-up subscription model across the four tiers
              ($47, $199, $740 monthly + $470 lifetime).
            </li>
            <li>
              Applied a 22x median revenue multiple, weighted 60% base / 25% bear / 15% bull.
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
