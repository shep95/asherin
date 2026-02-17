import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Handshake, Building2, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const equityData = [
  { name: "Asher Newton", value: 60 },
  { name: "Zorak", value: 20 },
  { name: "Crandel Trust Fund", value: 20 },
];

const COLORS = ["hsl(0,0%,100%)", "hsl(0,0%,55%)", "hsl(0,0%,30%)"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xl">
        <p className="font-light text-foreground">{payload[0].name}</p>
        <p className="text-lg font-extralight text-foreground">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const EquityOwnership = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extralight tracking-wide">Equity Ownership</h1>
            <p className="text-xs text-muted-foreground font-light">Aureon — Capital Structure</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Pie Chart */}
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

          {/* Legend */}
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

        {/* Financials */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-light">Total Capital Raised</p>
            <p className="text-3xl font-extralight text-foreground">$55,000</p>
            <p className="text-xs text-muted-foreground font-light">Since March 2024 — divided between Bosley, Aureon, &amp; our Trading Algorithms.</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-light">Aureon Build &amp; Funding</p>
            <p className="text-3xl font-extralight text-foreground">~$5,000</p>
            <p className="text-xs text-muted-foreground font-light">Allocated directly to building and funding the Aureon platform.</p>
          </div>
        </section>

        {/* Disclosure */}
        <section className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 space-y-4">
          <h2 className="text-sm font-light uppercase tracking-widest text-muted-foreground">Disclosure</h2>
          <ul className="space-y-3 text-sm font-light text-muted-foreground leading-relaxed">
            <li>Equity may be condensed for additional equity ownership at the discretion of existing shareholders.</li>
            <li>Royalty structures and distributions <span className="text-foreground font-normal">will not be disclosed</span>.</li>
            <li>All investment figures are cumulative since inception (March 2024).</li>
          </ul>
        </section>

        {/* Partnerships */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Handshake className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-light uppercase tracking-widest text-muted-foreground">Partnerships</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <a
              href="https://bosley.app/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 space-y-3 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-foreground/70" />
                  <h3 className="text-base font-light text-foreground">Bosley</h3>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                Core operational partner. Capital allocation and product development across the Bosley ecosystem.
              </p>
              <div className="pt-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-light">Active Partner</span>
              </div>
            </a>

            <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 space-y-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-foreground/70" />
                <h3 className="text-base font-light text-foreground">Trading Algorithms</h3>
              </div>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                Proprietary algorithmic trading systems. Revenue generated feeds directly into R&D and platform expansion.
              </p>
              <div className="pt-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-light">Revenue Engine</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-foreground/70" />
                <h3 className="text-base font-light text-foreground">Crandel Trust</h3>
              </div>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                Institutional capital partner holding 20% equity. Long-term alignment with Aureon's mission and growth trajectory.
              </p>
              <div className="pt-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-light">Equity Holder</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="pb-12 text-center">
          <p className="text-[10px] text-muted-foreground/50 font-light tracking-wide">© {new Date().getFullYear()} Aureon. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default EquityOwnership;
