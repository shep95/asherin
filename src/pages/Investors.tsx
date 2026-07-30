import { useEffect } from "react";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowUpRight, Check } from "lucide-react";

/**
 * /investors — Public investor / angel intake page.
 * Opened 06/23/2026. Two slots. Up to 5% equity + 3% royalties per slot.
 */
const Investors = () => {
  useEffect(() => {
    document.title = "Investors · Asherin";
    const desc =
      "Asherin is accepting two public / angel investor slots as of 06/23/2026. Up to 5% equity and 3% royalties on all sales and subscriptions. Strong connections required.";
    let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!m) {
      m = document.createElement("meta");
      m.name = "description";
      document.head.appendChild(m);
    }
    m.content = desc;
  }, []);

  const requirements = [
    "Recurring monthly investment (not a one-time cheque)",
    "Verified network of high-influence connections (government, finance, media, defense, or family offices)",
    "Understands Asherin's mission — a sovereign intelligence stack, not 'another AI app'",
    "Capable of moving Asherin into foreign government infrastructure",
    "Long-horizon thesis — minimum 36-month conviction",
    "Passes Asherin's internal filtering process (we vet you, not the other way around)",
  ];

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-20">
        {/* HERO */}
        <header className="space-y-6">
          <div className="inline-block px-3 py-1 rounded-full border border-amber-400/40 bg-amber-400/5 text-[10px] font-light tracking-[0.25em] uppercase text-amber-300">
            ◈ Opened 06 / 23 / 2026
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05]">
            Asherin is now accepting
            <span className="block text-muted-foreground/70">public &amp; angel investors.</span>
          </h1>
          <p className="max-w-3xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            We do not accept anyone with money. You are filtered through our
            systems first. The question is not whether we will take your
            capital — it is whether you meet the requirements to sit at the
            table.
          </p>
        </header>

        {/* WHITELIST RATIONALE */}
        <section className="rounded-3xl border border-red-400/30 bg-red-500/[0.04] backdrop-blur-sm p-8 sm:p-10 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-red-300">
              ◈ Whitelist Policy
            </p>
          </div>
          <h2 className="text-3xl font-extralight tracking-tight">
            We whitelist investors first.
          </h2>
          <div className="space-y-3 text-base font-extralight leading-relaxed text-muted-foreground">
            <p>
              No venture capitalist will fund Aureon. Their portfolios are
              governed by <span className="text-foreground">woke agendas</span>,
              DEI mandates, and propaganda pipelines that we directly oppose.
              They do not invest in truth — they invest in narrative control.
            </p>
            <p>
              We refuse to let our infrastructure be governed by the same
              ideological filters that have captured every other tech platform.
              That is why every investor is vetted before a single term sheet
              is discussed.
            </p>
            <p className="text-foreground font-light">
              If you are aligned with the mainstream, you are not aligned with
              us.
            </p>
          </div>
        </section>

        {/* REQUIREMENTS */}
        <section className="rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-10 space-y-6">
          <div>
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Filter
            </p>
            <h2 className="mt-2 text-3xl font-extralight tracking-tight">
              Do you meet the requirements?
            </h2>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {requirements.map((r) => (
              <li
                key={r}
                className="flex items-start gap-3 rounded-2xl border border-border/30 bg-background/40 p-4"
              >
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-300" strokeWidth={1.5} />
                <span className="text-sm font-light leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* WHY WE NEED INVESTORS */}
        <section className="space-y-6">
          <div>
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Why we need investors
            </p>
            <h2 className="mt-2 text-3xl font-extralight tracking-tight">
              Servers and reach. Not one or the other.
            </h2>
          </div>
          <div className="rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-10 space-y-4 text-base font-extralight leading-relaxed text-muted-foreground">
            <p>
              The server cost to run Asherin at its current scale is heavy and
              growing. That alone would justify an investment round — but
              capital is not the bottleneck.
            </p>
            <p>
              We need an investor with <span className="text-foreground">strong connections</span>{" "}
              who understands what Asherin is and what we are forcing the world
              to see us as. Money keeps the lights on; relationships move
              Asherin to the next altitude.
            </p>
            <p>
              The requirement is a recurring monthly investment{" "}
              <span className="text-foreground">and</span> a verified network.
              Not one or the other. Cheque-only investors will be declined.
            </p>
          </div>
        </section>

        {/* TERMS */}
        <section className="space-y-6">
          <div>
            <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
              ◈ Terms
            </p>
            <h2 className="mt-2 text-3xl font-extralight tracking-tight">
              Two slots. Capped equity. Royalties on every sale.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { k: "Open slots", v: "2" },
              { k: "Equity per slot", v: "Up to 5%" },
              { k: "Total equity available", v: "20% (10% allocated to these 2 slots max)" },
              { k: "Royalties", v: "3% of all sales & subscriptions" },
              { k: "Contract", v: "Mutually agreed, written, signed" },
              { k: "Existing backer", v: "1 anchor investor (American legacy family)" },
            ].map((row) => (
              <div
                key={row.k}
                className="rounded-2xl border border-border/30 bg-background/40 p-5"
              >
                <div className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                  {row.k}
                </div>
                <div className="mt-2 text-xl font-light tracking-tight">{row.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* THESIS */}
        <section className="rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-10 space-y-4">
          <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Thesis
          </p>
          <h2 className="text-3xl font-extralight tracking-tight">
            Word of mouth. Then sovereign infrastructure.
          </h2>
          <div className="space-y-3 text-base font-extralight leading-relaxed text-muted-foreground">
            <p>
              Asherin has already operated alongside several influential
              families globally. The growth plan is word-of-mouth at the top —
              not paid acquisition — and the end-state placement is{" "}
              <span className="text-foreground">foreign government infrastructure</span>.
            </p>
            <p>
              Our internal read: the American government infrastructure stack
              is collapsing under its own oversaturation. The next decade
              belongs to sovereign nations that adopt a clean intelligence
              spine. Asherin is that spine.
            </p>
          </div>
        </section>

        {/* CONTACT */}
        <section className="rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-500/[0.06] via-card/30 to-card/20 shadow-[0_0_40px_-12px_rgba(251,191,36,0.25)] p-8 sm:p-12 space-y-6">
          <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-amber-300">
            ◈ Interested &amp; qualified?
          </p>
          <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-[1.15]">
            Contact Asher directly.
          </h2>
          <p className="text-base font-extralight text-muted-foreground max-w-2xl">
            If you meet the requirements above, reach Asher on X. Do not DM
            for "intro calls" or pitch decks — bring your thesis, your network,
            and your monthly figure.
          </p>
          <a
            href="https://x.com/shep_newton"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-foreground/40 bg-foreground text-background text-sm font-light tracking-[0.2em] uppercase transition-all hover:bg-foreground/90"
          >
            @shep_newton on X
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
          </a>
        </section>

        {/* DONATE */}
        <section className="rounded-3xl border border-border/30 bg-card/10 backdrop-blur-sm p-6 sm:p-8 text-center space-y-3">
          <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Not an investor?
          </p>
          <p className="text-sm font-extralight text-muted-foreground max-w-xl mx-auto">
            If you do not want to invest but still want to help cover Asherin's
            server cost, you can donate any amount:
          </p>
          <a
            href="https://buy.stripe.com/bJe5kFcti8ff0QA61Bfw40a"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-foreground/30 text-sm font-light tracking-[0.2em] uppercase transition-all hover:border-foreground/60 hover:text-foreground"
          >
            Donate to Asherin
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Investors;
