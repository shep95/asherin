import { Heart } from "lucide-react";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import ManageSubscriptionCard from "@/components/dashboard/subscription/ManageSubscriptionCard";

/**
 * Dashboard "Subscription" page.
 *
 * Renders the active monthly subscription model ($18 Aureon / $399 Aureon Pro)
 * plus the Enterprise contact card.
 */
const SubscriptionView = () => {
  return (
    <div data-humble-scope className="mx-auto h-full w-full max-w-6xl overflow-y-auto px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex items-center gap-3">
        <Heart className="h-5 w-5 text-foreground/80" />
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">
            ◈ Asherin · Subscription
          </p>
          <h1 className="mt-1 text-2xl font-extralight tracking-wide text-foreground">
            Asherin &amp; Asherin Pro.
          </h1>
          <p className="mt-1 text-sm font-extralight text-muted-foreground">
            Two monthly plans, and enterprise priced on request. Cancel whenever it stops being useful.
          </p>
        </div>
      </div>

      <ManageSubscriptionCard />
      <SubscriptionPlans />
    </div>
  );
};

export default SubscriptionView;
