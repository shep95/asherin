import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import welcomeImg from "@/assets/welcome-silhouette.png.asset.json";

const STORAGE_PREFIX = "aureon_welcome_seen_";
const TRIAL_HOURS = 24;

/**
 * One-time welcome modal shown to brand-new accounts.
 * Announces the 24-hour full-access trial window.
 */
export default function NewAccountWelcomeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState("24h 00m");

  useEffect(() => {
    if (!user?.id || !user.created_at) return;
    const key = STORAGE_PREFIX + user.id;
    if (localStorage.getItem(key)) return;
    const created = new Date(user.created_at).getTime();
    const ageMs = Date.now() - created;
    // Only show for accounts < 24h old.
    if (ageMs < TRIAL_HOURS * 3600 * 1000) setOpen(true);
  }, [user?.id, user?.created_at]);

  useEffect(() => {
    if (!open || !user?.created_at) return;
    const created = new Date(user.created_at).getTime();
    const trialEnd = created + TRIAL_HOURS * 3600 * 1000;
    const tick = () => {
      const ms = Math.max(0, trialEnd - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${h}h ${String(m).padStart(2, "0")}m`);
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, [open, user?.created_at]);

  const dismiss = () => {
    if (user?.id) localStorage.setItem(STORAGE_PREFIX + user.id, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-2xl border border-white/10 bg-black/95 p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          <div className="hidden sm:block bg-neutral-200">
            <img
              src={welcomeImg.url}
              alt="Aureon initiation silhouette"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-8 space-y-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
                ◈ AUREON · INITIATION
              </p>
              <h2 className="mt-2 text-2xl font-extralight tracking-wide text-foreground">
                Welcome. Every door is open.
              </h2>
            </div>

            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              For the next <span className="text-foreground font-normal">24 hours</span>, you
              have full access to every module on Aureon — Pro, Aureon-tier, Enterprise.
              No paywalls. No gates. Explore everything.
            </p>

            <div className="rounded-md border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40">
                Trial Remaining
              </p>
              <p className="mt-1 text-lg font-light text-foreground tabular-nums">
                {countdown}
              </p>
            </div>

            <p className="text-xs font-extralight text-muted-foreground/80">
              When the window closes, premium modules return to their plan tiers.
              Continue any module by subscribing.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={dismiss}
                className="bg-foreground text-background hover:bg-foreground/90 font-light tracking-wide"
              >
                Begin
              </Button>
              <button
                onClick={() => { dismiss(); window.location.assign("/dashboard/subscription"); }}
                className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition"
              >
                View plans →
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
