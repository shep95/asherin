import { Heart, Users } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import ManageSubscriptionCard from "@/components/dashboard/subscription/ManageSubscriptionCard";
import { useIsV2 } from "@/lib/dashboardUiContext";

/**
 * Dashboard "Subscription" page.
 *
 * Renders the active monthly subscription model ($18 Aureon / $79 Aureon Pro)
 * plus the Enterprise contact card.
 */
const SubscriptionView = () => {
  const v2 = useIsV2();
  const { team } = useSubscription();
  return (
    <div data-humble-scope className={`mx-auto h-full w-full max-w-6xl overflow-y-auto px-4 sm:px-8 ${v2 ? "py-6" : "py-10 sm:py-14"}`}>
      {!v2 && (
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
      )}

      {team && (
        <div className="mb-6 rounded-2xl border border-foreground/15 bg-foreground/[0.04] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Covered by a team</p>
          <div className="mt-2 flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 text-foreground/60" />
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              Asherin Team — <span className="text-foreground">{team.team_name}</span>. You hold the{" "}
              {team.team_role} seat.{" "}
              {team.is_owner
                ? "You are billed for the workspace and every occupied seat."
                : "Billed to the workspace owner — you are not charged for this seat, and Pro-class access lasts while the team stays active."}
              {!team.is_owner && " Any personal plan below is optional on top of it."}
            </p>
          </div>
        </div>
      )}

      <ManageSubscriptionCard />
      <SubscriptionPlans />
    </div>
  );
};

export default SubscriptionView;
