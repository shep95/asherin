import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import welcomeImg from "@/assets/welcome-silhouette.png.asset.json";

const STORAGE_PREFIX = "aureon_welcome_seen_";
const EXPIRED_PREFIX = "aureon_trial_expired_seen_";
const TRIAL_HOURS = 24;

/**
 * Two-state initiation modal.
 *   ACTIVE   → "Welcome. Every door is open." + capability grid + plan preview.
 *   EXPIRED  → "Your trial has ended." + full subscription pitch.
 * Right edge of the hero image fades into pure darkness for a cinematic seam.
 */

const CAPABILITIES = [
  { k: "01", t: "Aureon Chat", d: "Multi-model intelligence with consensus, BYOK, personas." },
  { k: "02", t: "Zophiel Search", d: "30-source OSINT with veracity scoring and cross-validation." },
  { k: "03", t: "Axrlen Predictions", d: "Real-time global event forecasting + Monte Carlo modeling." },
  { k: "04", t: "Zaxin Tactical AR", d: "BLE radar, AR vision, forensic profiling, satellite overlay." },
  { k: "05", t: "Zerlal Cyber Recon", d: "Vulnerability scanning, domain forensics, exploit intelligence." },
  { k: "06", t: "Asher Code IDE", d: "In-dashboard Monaco IDE with 9-provider BYOK code generation." },
];

const PLANS = [
  { tier: "Chat",    price: "$47",   per: "/mo",   desc: "Aureon Chat · Search · IDE · Whiteboard" },
  { tier: "Aureon",  price: "$199",  per: "/mo",   desc: "+ NOMAD · Briefings · Notebooks · ZALI" },
  { tier: "Pro",     price: "$740",  per: "/mo",   desc: "+ Zaxin · Zerlal · Axrlen · Zeeion · Teams" },
  { tier: "Lifetime",price: "$470",  per: " once", desc: "Everything, forever. One payment." },
];

export default function NewAccountWelcomeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState("24h 00m");

  const { state, key } = useMemo(() => {
    if (!user?.id || !user.created_at) return { state: null as null | "active" | "expired", key: "" };
    const ageMs = Date.now() - new Date(user.created_at).getTime();
    const trialMs = TRIAL_HOURS * 3600 * 1000;
    if (ageMs < trialMs) return { state: "active" as const, key: STORAGE_PREFIX + user.id };
    return { state: "expired" as const, key: EXPIRED_PREFIX + user.id };
  }, [user?.id, user?.created_at]);

  useEffect(() => {
    if (!state || !key) return;
    if (localStorage.getItem(key)) return;
    setOpen(true);
  }, [state, key]);

  useEffect(() => {
    if (!open || state !== "active" || !user?.created_at) return;
    const trialEnd = new Date(user.created_at).getTime() + TRIAL_HOURS * 3600 * 1000;
    const tick = () => {
      const ms = Math.max(0, trialEnd - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${h}h ${String(m).padStart(2, "0")}m`);
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, [open, state, user?.created_at]);

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
        <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr]">
          {/* Hero image with cinematic right-edge fade into the panel */}
          <div className="relative hidden sm:block bg-black">
            <img
              src={welcomeImg.url}
              alt="Aureon initiation silhouette"
              className="h-full w-full object-cover"
            />
            {/* Right-edge fade: blurred dark gradient that bleeds into the next column */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-32"
              style={{
                background: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 45%, #000 100%)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            />
            {/* Subtle top/bottom vignette for depth */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%)" }}
            />
          </div>

          {/* Body */}
          {state === "active" ? (
            <ActivePanel countdown={countdown} onBegin={dismiss} onPlans={goToPlans} />
          ) : (
            <ExpiredPanel onPlans={goToPlans} onDismiss={dismiss} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivePanel({ countdown, onBegin, onPlans }: { countdown: string; onBegin: () => void; onPlans: () => void }) {
  return (
    <div className="p-7 space-y-5 max-h-[80vh] overflow-y-auto">
      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
          ◈ AUREON · INITIATION
        </p>
        <h2 className="mt-2 text-2xl font-extralight tracking-wide text-foreground">
          Welcome. Every door is open.
        </h2>
      </div>

      <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
        For the next <span className="text-foreground font-normal">24 hours</span>, every
        module is unlocked — Chat, Aureon, Pro, Enterprise. No paywalls. Explore freely.
      </p>

      <div className="rounded-md border border-white/10 bg-white/[0.02] px-4 py-3">
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40">
          Trial Remaining
        </p>
        <p className="mt-1 text-lg font-light text-foreground tabular-nums">{countdown}</p>
      </div>

      <CapabilityGrid />

      <div className="pt-1">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
          ◈ When the window closes
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

function ExpiredPanel({ onPlans, onDismiss }: { onPlans: () => void; onDismiss: () => void }) {
  return (
    <div className="p-7 space-y-5 max-h-[80vh] overflow-y-auto">
      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
          ◈ AUREON · ACCESS TIERS
        </p>
        <h2 className="mt-2 text-2xl font-extralight tracking-wide text-foreground">
          Your trial window has closed.
        </h2>
        <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground">
          Continue with the tier that matches your operation. Free modules
          (library, projects, memory, settings) remain open without a plan.
        </p>
      </div>

      <CapabilityGrid />

      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
          ◈ Subscription Models
        </p>
        <PlanList />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={onPlans}
          className="bg-foreground text-background hover:bg-foreground/90 font-light tracking-wide"
        >
          Choose a Plan
        </Button>
        <button
          onClick={onDismiss}
          className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition"
        >
          Continue with free modules →
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
    <div className={`grid grid-cols-1 ${compact ? "sm:grid-cols-4" : "sm:grid-cols-2"} gap-2`}>
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
