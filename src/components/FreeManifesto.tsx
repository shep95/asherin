import { Heart, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

const STRIPE_DONATE = "https://buy.stripe.com/bJe5kFcti8ff0QA61Bfw40a";

const WALLETS = [
  { label: "Bitcoin", ticker: "BTC", address: "bc1qrft6m6pcq0czpn87xa8jg5y4l7x3scgrcd56ws" },
  { label: "Ethereum", ticker: "ETH", address: "0xa7bDbAA58f908007F1bED6f8AE6c582557B00c2B" },
  { label: "Solana", ticker: "SOL", address: "3pLLkv6fSrQA3JBhtP2V4BEikzMW2yQXt2wkGVacb4oC" },
  { label: "Hyperliquid", ticker: "HYPER", address: "0xa7bDbAA58f908007F1bED6f8AE6c582557B00c2B" },
  { label: "Arbitrum", ticker: "ARB", address: "0xa7bDbAA58f908007F1bED6f8AE6c582557B00c2B" },
];

interface Props {
  compact?: boolean;
}

/**
 * The Free Manifesto.
 *
 * Replaces every paywall, every subscription tier, every checkout button.
 * Aureon is free because Asher Newton is sick of corporations valuing
 * money over human life. If the software helped you, donate. If it didn't,
 * don't. Either way, the tool is yours.
 */
export default function FreeManifesto({ compact = false }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Manifesto */}
      <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 px-8 py-12 backdrop-blur-2xl sm:px-12 sm:py-16">
        <span aria-hidden className="absolute left-0 top-0 h-6 w-6 rounded-tl-3xl border-l border-t border-foreground/30" />
        <span aria-hidden className="absolute right-0 bottom-0 h-6 w-6 rounded-br-3xl border-r border-b border-foreground/20" />

        <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/40">
          ◈ The Manifesto
        </p>
        <h2 className={`mt-4 font-extralight tracking-tight text-foreground ${compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl md:text-6xl"} leading-[1.05]`}>
          Aureon is <span className="italic text-foreground">free</span>.
          <br />
          <span className="text-muted-foreground">Forever. For everyone.</span>
        </h2>

        <div className="mt-8 space-y-5 text-sm font-extralight leading-relaxed text-muted-foreground sm:text-base">
          <p>
            Asher is sick of how greedy AI companies have become — charging you for every prompt, every token,
            every breath. Corporations that value money over human life don't deserve to own intelligence.
          </p>
          <p className="text-foreground">
            So Aureon is free. No subscriptions. No tiers. No paywalls. No locked features. No data harvesting.
            Use every module, every engine, every tool — from day one, forever.
          </p>
          <p>
            If Aureon helps you — your work, your business, your family, your survival — and you can afford to
            give back, donations keep the servers running and the engineers fed. Stripe or crypto. Any amount.
            Or nothing at all. Either way, the tool is yours.
          </p>
        </div>

        <p className="mt-10 text-xs font-light tracking-[0.2em] text-foreground/60 uppercase">
          — Asher Newton, founder
        </p>
      </div>

      {/* Donate */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Stripe */}
        <a
          href={STRIPE_DONATE}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-foreground/15 bg-gradient-to-br from-foreground/[0.04] to-transparent p-8 backdrop-blur-2xl transition-all hover:border-foreground/30 hover:-translate-y-0.5"
        >
          <span aria-hidden className="absolute left-0 top-0 h-5 w-5 rounded-tl-3xl border-l border-t border-foreground/40" />
          <div>
            <div className="flex items-center gap-2 text-foreground">
              <Heart className="h-4 w-4" />
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase">◈ Card / Bank</p>
            </div>
            <h3 className="mt-5 text-2xl font-extralight tracking-tight text-foreground">
              Donate via Stripe
            </h3>
            <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
              Any amount. One-time or recurring. Apple Pay, Google Pay, every major card. Fully secure — no
              account required.
            </p>
          </div>
          <div className="mt-8 inline-flex items-center gap-2 text-xs font-light tracking-[0.2em] uppercase text-foreground transition-transform group-hover:translate-x-1">
            Open Donation Page
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
        </a>

        {/* Crypto */}
        <div className="relative overflow-hidden rounded-3xl border border-foreground/15 bg-gradient-to-br from-foreground/[0.04] to-transparent p-8 backdrop-blur-2xl">
          <span aria-hidden className="absolute right-0 bottom-0 h-5 w-5 rounded-br-3xl border-r border-b border-foreground/40" />
          <div className="flex items-center gap-2 text-foreground">
            <Heart className="h-4 w-4" />
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase">◈ Crypto Wallets</p>
          </div>
          <h3 className="mt-5 text-2xl font-extralight tracking-tight text-foreground">
            Donate with crypto
          </h3>
          <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
            Click any address to copy. Send any amount on the corresponding network — no KYC, no middleman.
          </p>

          <div className="mt-6 space-y-2">
            {WALLETS.map((w) => (
              <button
                key={w.label}
                onClick={() => copy(w.address)}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-left transition-all hover:border-foreground/25 hover:bg-background/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-light tracking-[0.2em] uppercase text-foreground">
                      {w.label}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/40">
                      {w.ticker}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {w.address}
                  </p>
                </div>
                {copied === w.address ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-foreground/40 transition-colors group-hover:text-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
