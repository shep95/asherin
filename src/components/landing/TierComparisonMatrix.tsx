import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, Crown, ChevronDown } from "lucide-react";

interface Tier {
  key: string;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  cta: string;
  href: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  { key: "chat", name: "Chat", price: "$47", cadence: "one-time", blurb: "Uncensored core chat & basic tools", cta: "Start Chat", href: "/dashboard" },
  { key: "aureon", name: "Asherin", price: "$199", cadence: "one-time", blurb: "Full creation suite + Zophiel", cta: "Get Asherin", href: "/dashboard" },
  { key: "pro", name: "Pro", price: "$740", cadence: "one-time", blurb: "Pro intelligence, predictive, trading", cta: "Go Pro", href: "/dashboard" },
  { key: "lifetime", name: "Lifetime", price: "$470", cadence: "once", blurb: "Everything in Asherin ($199), forever, one payment", cta: "Claim Lifetime", href: "/dashboard", highlight: true },
];

interface Row {
  label: string;
  group: string;
  tiers: Record<string, true | false | string>;
}

// Lifetime = everything in the Asherin ($199 one-time) tier and below, forever, for a single one-time payment.
// Pro-only features stay Pro-only (predictive, trading, automated agents, ZERLAL, Azplen, Google Intelligence).
const ROWS: Row[] = [
  { group: "Core", label: "Uncensored chat", tiers: { chat: true, aureon: true, pro: true, lifetime: true } },
  { group: "Core", label: "Bring Your Own Key (all providers)", tiers: { chat: true, aureon: true, pro: true, lifetime: true } },
  { group: "Core", label: "Persistent memory & projects", tiers: { chat: "Limited", aureon: true, pro: true, lifetime: true } },
  { group: "Core", label: "Unlimited messages (BYOK)", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },

  { group: "Intelligence", label: "Zophiel Search Intelligence (full engine)", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Intelligence", label: "Dark web, leaks, dorking & intel mapping", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Intelligence", label: "Intelligence Briefings", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Intelligence", label: "Predictive Intelligence (Monte Carlo)", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },
  { group: "Intelligence", label: "Trading Intelligence", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },
  { group: "Intelligence", label: "Pattern Analysis & Forecasting", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },

  { group: "Creation", label: "E-book / PDF / Slideshow generators", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Creation", label: "Whiteboard (infinite canvas)", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Creation", label: "Asherin IDE & Imagine-to-Code", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Creation", label: "ZANOEM Design Lab (FEA / Thermal)", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },

  { group: "Agents", label: "Zahten Agent Forge", tiers: { chat: false, aureon: true, pro: true, lifetime: true } },
  { group: "Agents", label: "Automated Agents (scheduled)", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },
  { group: "Agents", label: "Voice Chat (ElevenLabs)", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },

  { group: "Security", label: "Guardian Vault", tiers: { chat: true, aureon: true, pro: true, lifetime: true } },
  { group: "Security", label: "ZERLAL Cyber Security", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },
  { group: "Security", label: "Azplen Data Intelligence", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },
  { group: "Security", label: "Google Intelligence Suite", tiers: { chat: false, aureon: false, pro: true, lifetime: false } },
];

const GROUPS = ["Core", "Intelligence", "Creation", "Agents", "Security"];

const Cell = ({ value }: { value: true | false | string }) => {
  if (value === true) return <Check className="h-3.5 w-3.5 mx-auto text-emerald-300/90" />;
  if (value === false) return <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/30" />;
  return <span className="text-[10px] tracking-wide text-foreground/70">{value}</span>;
};

const TierComparisonMatrix = () => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Core: true,
    Intelligence: true,
    Creation: false,
    Agents: false,
    Security: false,
  });

  return (
    <div className="relative">
      {/* Sticky tier header */}
      <div className="sticky top-16 z-30 -mx-2 sm:mx-0 mb-2 rounded-2xl border border-border/30 bg-background/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] sm:grid-cols-[2fr_repeat(4,1fr)] gap-1 p-2 sm:p-3">
          <div className="hidden sm:flex items-center px-2 text-[10px] font-medium tracking-[0.25em] text-muted-foreground/50 uppercase">
            What you get
          </div>
          {TIERS.map((t) => (
            <div
              key={t.key}
              className={`relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl transition-all ${
                t.highlight
                  ? "border border-foreground/25 bg-neutral-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "border border-border/20 bg-card/30"
              }`}
            >
              <span className="text-[10px] sm:text-xs font-light tracking-[0.2em] text-foreground uppercase">
                {t.name}
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className={`text-base sm:text-xl font-extralight tracking-wide ${t.highlight ? "text-foreground" : "text-foreground"}`}>
                  {t.price}
                </span>
                <span className="text-[9px] tracking-wider text-muted-foreground/60">{t.cadence}</span>
              </div>

              {t.highlight && (
                <span className="px-1 text-[9px] tracking-wide text-muted-foreground/70 normal-case text-center leading-snug">
                  Asherin, paid once.
                </span>
              )}

              <Link
                to={t.href}
                className={`mt-1 hidden sm:inline-flex w-full justify-center rounded-lg px-2 py-1 text-[10px] tracking-[0.2em] uppercase transition-colors ${
                  t.highlight
                    ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700"
                    : "bg-foreground/10 text-foreground/90 hover:bg-foreground/20 border border-border/20"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Group sections */}
      <div className="space-y-2">
        {GROUPS.map((group) => {
          const rows = ROWS.filter((r) => r.group === group);
          const open = openGroups[group];
          return (
            <div key={group} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md overflow-hidden">
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [group]: !s[group] }))}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-foreground/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-medium tracking-[0.3em] text-muted-foreground/60 uppercase">
                    {group}
                  </span>
                  <span className="text-[10px] tracking-wider text-muted-foreground/40">
                    {rows.length} unlocks
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <div className="divide-y divide-border/10">
                    {rows.map((r, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1.4fr_repeat(4,1fr)] sm:grid-cols-[2fr_repeat(4,1fr)] gap-1 px-2 sm:px-3 py-2.5 hover:bg-foreground/[0.025] transition-colors"
                      >
                        <div className="flex items-center px-2 text-[11px] sm:text-xs font-light tracking-wide text-foreground/85">
                          {r.label}
                        </div>
                        {TIERS.map((t) => (
                          <div
                            key={t.key}
                            className={`flex items-center justify-center rounded-lg py-1.5 ${
                              t.highlight ? "bg-foreground/[0.03]" : ""
                            }`}
                          >
                            <Cell value={r.tiers[t.key]} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile CTAs (sticky header has them on desktop) */}
      <div className="mt-6 grid grid-cols-2 sm:hidden gap-2">
        {TIERS.map((t) => (
          <Link
            key={t.key}
            to={t.href}
            className={`text-center rounded-lg px-3 py-2 text-[10px] tracking-[0.2em] uppercase ${
              t.highlight
                ? "bg-amber-300/20 text-amber-100 border border-amber-300/30"
                : "bg-foreground/10 text-foreground/90 border border-border/20"
            }`}
          >
            {t.cta}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TierComparisonMatrix;
