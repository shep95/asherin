import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Handshake, Building2, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import LandingBackground from "@/components/LandingBackground";
import Header from "@/components/Header";

const equityData = [
  { name: "Asher Newton", value: 60 },
  { name: "Zorak", value: 20 },
  { name: "Crandel Trust Fund", value: 20 },
];

const COLORS = ["hsl(0,0%,100%)", "hsl(0,0%,55%)", "hsl(0,0%,30%)"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg border border-border/30 bg-card/80 backdrop-blur-md px-4 py-2 text-sm shadow-xl">
        <p className="font-light text-foreground">{payload[0].name}</p>
        <p className="text-lg font-extralight text-foreground">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const EquityOwnership = () => {
  useEffect(() => {
    document.title = "Equity Ownership — Aureon";
  }, []);

  return (
    <LandingBackground>

      <Header />

      {/* Hero */}
      <div className="relative z-10 flex min-h-[50vh] flex-col items-center justify-center px-6 text-center pt-20">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-extralight tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors mb-16 uppercase">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Equity Ownership
        </h1>
        <p className="mt-3 text-sm font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
          Aureon — Capital Structure
        </p>
      </div>

      {/* Equity Chart */}
      <div className="relative z-10 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <section className="flex flex-col lg:flex-row items-center gap-12">
            <div className="w-full max-w-sm aspect-square">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={equityData}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                    stroke="hsl(0,0%,8%)"
                    strokeWidth={2}
                  >
                    {equityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-6">
              {equityData.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-4">
                  <div className="h-4 w-4 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <div className="flex-1">
                    <p className="text-base font-light text-foreground">{entry.name}</p>
                    <p className="text-2xl font-extralight text-foreground">{entry.value}%</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Financials */}
      <div className="relative z-10 px-6 py-16">
        <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-light">Total Capital Raised</p>
            <p className="text-3xl font-extralight text-foreground">$55,000</p>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              Since March 2024 — divided between Bosley, Aureon, &amp; our Trading Algorithms.
            </p>
          </div>
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-light">Aureon Build &amp; Funding</p>
            <p className="text-3xl font-extralight text-foreground">~$5,000</p>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              Allocated directly to building and funding the Aureon platform.
            </p>
          </div>
        </div>
      </div>

      {/* Disclosure */}
      <div className="relative z-10 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 space-y-4">
            <h2 className="text-base font-light tracking-[0.15em] text-foreground uppercase">Disclosure</h2>
            <ul className="space-y-3 text-sm font-extralight text-muted-foreground leading-relaxed">
              <li>Equity may be condensed for additional equity ownership at the discretion of existing shareholders.</li>
              <li>Royalty structures and distributions <span className="text-foreground font-light">will not be disclosed</span>.</li>
              <li>All investment figures are cumulative since inception (Nov 18, 2025 · 8:38 AM · Cape Coral, FL).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Partnerships */}
      <div className="relative z-10 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
              Partnerships
            </h2>
            <p className="mt-3 text-sm font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
              Strategic Alliances
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <a
              href="https://bosley.app/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 space-y-3 transition-all hover:border-foreground/20 hover:bg-card/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-foreground" />
                  <h3 className="text-base font-light tracking-[0.15em] text-foreground uppercase">Bosley</h3>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
                A social media platform built to protect user privacy and freedom of speech. No surveillance, no censorship, no compromise.
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-light pt-2">Active Partner</p>
            </a>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 space-y-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-foreground" />
                <h3 className="text-base font-light tracking-[0.15em] text-foreground uppercase">Zorak</h3>
              </div>
              <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
                Investment firm backing Aureon's long-term vision. Strategic capital deployment and portfolio oversight across all ventures.
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-light pt-2">Investment Firm</p>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 space-y-3">
              <div className="flex items-center gap-3">
                <Handshake className="h-6 w-6 text-foreground" />
                <h3 className="text-base font-light tracking-[0.15em] text-foreground uppercase">Crandel Trust</h3>
              </div>
              <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
                Angel investor providing early-stage capital. Believed in Aureon's mission from day one and holds 20% equity.
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-light pt-2">Angel Investor</p>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="relative z-10 h-24" />
    </LandingBackground>
  );
};

export default EquityOwnership;
