import { Heart } from "lucide-react";
import FreeManifesto from "@/components/FreeManifesto";

/**
 * Dashboard "Subscription" page.
 *
 * There are no subscriptions anymore. Aureon is fully free. This page now
 * serves as the in-app donation hub — Stripe + crypto — and explains why.
 */
const SubscriptionView = () => {
  return (
    <div className="mx-auto h-full w-full max-w-6xl overflow-y-auto px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex items-center gap-3">
        <Heart className="h-5 w-5 text-foreground/80" />
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
            ◈ Aureon Status
          </p>
          <h1 className="mt-1 text-2xl font-extralight tracking-wide text-foreground">
            You don't owe Aureon a cent.
          </h1>
          <p className="mt-1 text-sm font-extralight text-muted-foreground">
            Every module is unlocked. There is nothing to upgrade to. Donations keep the lights on.
          </p>
        </div>
      </div>

      <FreeManifesto />
    </div>
  );
};

export default SubscriptionView;
