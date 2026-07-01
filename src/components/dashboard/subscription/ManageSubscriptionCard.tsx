import { useState } from "react";
import { Loader2, ShieldOff, RotateCcw, ExternalLink } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Manage / cancel the active subscription.
 *
 * Shows nothing when the user has no active subscription. Otherwise renders:
 *  - current period end (or scheduled cancel date)
 *  - Cancel at period end (with confirmation)
 *  - Resume subscription (undo a scheduled cancel)
 *  - Open Stripe billing portal (payment method, invoices)
 */
const ManageSubscriptionCard = () => {
  const {
    subscribed,
    subscriptionEnd,
    cancelAtPeriodEnd,
    cancelSubscription,
    reactivateSubscription,
    openPortal,
    checkoutLoading,
  } = useSubscription();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"cancel" | "resume" | "portal" | null>(null);

  if (!subscribed) return null;

  const endLabel = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
      })
    : "—";

  const handleCancel = async () => {
    setBusy("cancel");
    try {
      await cancelSubscription();
      toast({ title: "Cancellation scheduled", description: `Access continues until ${endLabel}.` });
    } catch (e: any) {
      toast({ title: "Could not cancel", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handleResume = async () => {
    setBusy("resume");
    try {
      await reactivateSubscription();
      toast({ title: "Subscription resumed", description: "Your plan will keep renewing." });
    } catch (e: any) {
      toast({ title: "Could not resume", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try { await openPortal(); }
    finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-border/15 bg-card/10 backdrop-blur-sm overflow-hidden mb-6">
      <div className="px-5 py-4 flex items-center gap-3">
        <ShieldOff className="h-4 w-4 text-muted-foreground/70" />
        <h3 className="text-xs font-light tracking-[0.12em] uppercase text-foreground/90">
          Manage Subscription
        </h3>
      </div>

      <div className="px-5 pb-5 pt-0 space-y-4">
        <div className="rounded-lg border border-border/10 bg-card/5 p-4">
          {cancelAtPeriodEnd ? (
            <p className="text-[12px] font-extralight text-amber-400/80">
              Cancellation scheduled — access ends on <span className="text-foreground">{endLabel}</span>.
            </p>
          ) : (
            <p className="text-[12px] font-extralight text-muted-foreground">
              Renews on <span className="text-foreground">{endLabel}</span>.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {cancelAtPeriodEnd ? (
            <button
              onClick={handleResume}
              disabled={busy !== null || checkoutLoading}
              className="flex items-center gap-2 rounded-lg border border-border/15 px-3 py-2 text-[11px] font-light text-foreground/80 hover:bg-foreground/5 transition-colors disabled:opacity-40"
            >
              {busy === "resume" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Resume subscription
            </button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={busy !== null || checkoutLoading}
                  className="flex items-center gap-2 rounded-lg border border-red-400/25 px-3 py-2 text-[11px] font-light text-red-300/90 hover:bg-red-400/5 transition-colors disabled:opacity-40"
                >
                  {busy === "cancel" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
                  Cancel subscription
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll keep full access until <span className="text-foreground">{endLabel}</span>. No further
                    charges will be made for this plan. Any add-ons continue to bill separately and can be
                    canceled from the billing portal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep plan</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>Confirm cancel</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <button
            onClick={handlePortal}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-lg border border-border/15 px-3 py-2 text-[11px] font-light text-foreground/80 hover:bg-foreground/5 transition-colors disabled:opacity-40"
          >
            {busy === "portal" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
            Billing portal
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageSubscriptionCard;
