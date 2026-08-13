import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import welcomeImg from "@/assets/welcome-silhouette.png.asset.json";

const STORAGE_PREFIX = "aureon_welcome_seen_";


/**
 * One-state welcome modal.
 *
 * There is no trial, so there is no countdown and no "your window closed"
 * panel. A new account sees what the platform is, what each plan costs, and
 * which modules stay open without a plan. Shown once per account.
 */

const CAPABILITIES = [
  { k: "01", t: "Asherin Chat", d: "Multi-model intelligence with consensus and BYOK." },
  { k: "02", t: "Zophiel Search", d: "Live public-engine search with credibility ranking and cited hits." },
  { k: "03", t: "Axrlen Predictions", d: "Real-time global event forecasting + Monte Carlo modeling." },
  { k: "04", t: "Zaxin BLE Scout", d: "Browser Web Bluetooth scan with coarse RSSI proximity — a field scout, not a mesh." },
  { k: "05", t: "Zerlal Cyber Recon", d: "Passive domain recon plus a public CVE index lookup. Not a credentialed scanner." },
  { k: "06", t: "Asher Code IDE", d: "In-dashboard Monaco IDE with 9-provider BYOK code generation." },
];

const PLANS = [
  { tier: "Asherin",     price: "$18",     per: "/mo", desc: "Chat, code, research and Zophiel Search. No trial — billing starts when you subscribe." },
  { tier: "Asherin Pro", price: "$79",    per: "/mo", desc: "Full intelligence suite — Azplen, Axrlen, Zaxin, Zerlal, Zeeion, Asherin Engine." },
  { tier: "Enterprise", price: "Custom",  per: "",    desc: "Dedicated capacity, SSO, org controls, SLA." },
];

export default function NewAccountWelcomeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { state, key } = useMemo(() => {
    if (!user?.id) return { state: null as null | "welcome", key: "" };
    return { state: "welcome" as const, key: STORAGE_PREFIX + user.id };
  }, [user?.id]);

  // Reset open whenever the identity (user/state) changes — prevents lingering
  // open=true from a prior account in the same tab.
  useEffect(() => {
    if (!state || !key) { setOpen(false); return; }
    if (localStorage.getItem(key)) { setOpen(false); return; }
    setOpen(true);
  }, [state, key]);


  const dismiss = () => {
    if (key) localStorage.setItem(key, "1");
    setOpen(false);
  };

  const goToPlans = () => {
    dismiss();
    window.location.assign("/dashboard/subscription");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-3xl border border-white/10 bg-black p-0 overflow-hidden">
        {/* Mobile: image as background wallpaper behind the panel */}
        <div className="relative sm:hidden">
          <img
            src={welcomeImg.url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
            style={{ filter: "grayscale(1) brightness(0.7) contrast(1.05)" }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.82) 60%, #000 100%)" }}
          />
          <div className="relative">
            <WelcomePanel onBegin={dismiss} onPlans={goToPlans} />
          </div>
        </div>

        {/* Desktop: side-by-side, image on the left, no blur */}
        <div className="hidden sm:grid sm:grid-cols-[260px_1fr]">
          <div className="relative bg-black">
            <img
              src={welcomeImg.url}
              alt="Asherin initiation silhouette"
              className="h-full w-full object-cover"
              style={{ filter: "grayscale(1) brightness(0.95) contrast(1.05)" }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%)" }}
            />
          </div>

          <WelcomePanel onBegin={dismiss} onPlans={goToPlans} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WelcomePanel({ onBegin, onPlans }: { onBegin: () => void; onPlans: () => void }) {
  return (
    <div className="p-7 space-y-5 max-h-[80vh] overflow-y-auto">
      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
          ◈ ASHERIN · INITIATION
        </p>
        <h2 className="mt-2 text-2xl font-extralight tracking-wide text-foreground">
          Welcome to Asherin.
        </h2>
      </div>

      <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
        There is no trial and no countdown. Library, projects, memory and settings stay open
        without a plan; the modules below unlock on the tier that covers them, and billing
        starts only when you subscribe.
      </p>

      <CapabilityGrid />

      <div className="pt-1">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
          ◈ Plans
        </p>
        <PlanList compact />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={onBegin}
          className="bg-foreground text-background hover:bg-foreground/90 font-light tracking-wide"
        >
          Begin
        </Button>
        <button
          onClick={onPlans}
          className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition"
        >
          View plans →
        </button>
      </div>
    </div>
  );
}

function CapabilityGrid() {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
        ◈ Capabilities
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CAPABILITIES.map((c) => (
          <div
            key={c.k}
            className="rounded-md border border-white/10 bg-white/[0.015] px-3 py-2"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] text-foreground/40">{c.k}</span>
              <span className="text-xs font-light tracking-wide text-foreground">{c.t}</span>
            </div>
            <p className="mt-0.5 text-[11px] font-extralight leading-snug text-muted-foreground">
              {c.d}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanList({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-1 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-3"} gap-2`}>
      {PLANS.map((p) => (
        <div
          key={p.tier}
          className="rounded-md border border-white/10 bg-white/[0.015] px-3 py-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-light tracking-wide text-foreground">{p.tier}</span>
            <span className="text-sm font-light text-foreground tabular-nums">
              {p.price}<span className="text-[10px] text-muted-foreground">{p.per}</span>
            </span>
          </div>
          {!compact && (
            <p className="mt-1 text-[11px] font-extralight leading-snug text-muted-foreground">
              {p.desc}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
