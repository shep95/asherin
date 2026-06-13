import { useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Heart, Copy, Check } from "lucide-react";

// Routes where the donation banner is redundant (FreeManifesto already shown)
// or where it would visually collide with a fixed/floating header.
const HIDE_ON_ROUTES = new Set<string>(["/", "/pricing"]);

const WALLETS: { label: string; address: string }[] = [
  { label: "ETH", address: "0xa7bDbAA58f908007F1bED6f8AE6c582557B00c2B" },
  { label: "BTC", address: "bc1qrft6m6pcq0czpn87xa8jg5y4l7x3scgrcd56ws" },
  { label: "SOL", address: "3pLLkv6fSrQA3JBhtP2V4BEikzMW2yQXt2wkGVacb4oC" },
  { label: "HYPER", address: "0xa7bDbAA58f908007F1bED6f8AE6c582557B00c2B" },
  { label: "ARB", address: "0xa7bDbAA58f908007F1bED6f8AE6c582557B00c2B" },
];

const STRIPE_DONATE = "https://buy.stripe.com/bJe5kFcti8ff0QA61Bfw40a";

export default function DonationBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("aureon-donate-dismissed") === "1",
  );
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const location = useLocation();
  if (HIDE_ON_ROUTES.has(location.pathname)) return null;
  if (dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("aureon-donate-dismissed", "1");
    setDismissed(true);
  };

  const copy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    } catch {/* ignore */}
  };

  return (
    <div className="sticky top-0 z-[60] w-full border-b border-white/10 bg-gradient-to-r from-black via-zinc-900 to-black text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-xs sm:text-sm">
        <Heart className="h-4 w-4 shrink-0 text-white/80" />
        <span className="flex-1 truncate">
          <strong className="font-semibold tracking-wide">Aureon is free to use.</strong>{" "}
          <span className="text-white/70">
            We rely on donations to keep this software running — support via Stripe or crypto.
          </span>
        </span>
        <a
          href={STRIPE_DONATE}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden rounded-md border border-white/20 bg-white/10 px-3 py-1 font-medium transition hover:bg-white/20 sm:inline-block"
        >
          Donate via Stripe
        </a>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md border border-white/20 px-3 py-1 font-medium transition hover:bg-white/10"
        >
          {expanded ? "Hide crypto" : "Crypto"}
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss donation banner"
          className="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-white/10 bg-black/60 px-4 py-3">
          <div className="mx-auto grid max-w-7xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href={STRIPE_DONATE}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 sm:hidden"
            >
              <span className="font-semibold">Donate via Stripe</span>
              <span className="text-white/60">Open ↗</span>
            </a>
            {WALLETS.map((w) => (
              <button
                key={w.label}
                onClick={() => copy(w.address)}
                className="flex items-center justify-between gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-left text-xs transition hover:bg-white/10"
              >
                <span className="font-mono">
                  <span className="mr-2 font-bold text-white">{w.label}</span>
                  <span className="text-white/70">{w.address}</span>
                </span>
                {copied === w.address ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 shrink-0 text-white/50" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
