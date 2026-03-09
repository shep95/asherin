import { useState } from "react";
import { Gift, Mail, Calendar, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPublicPlans } from "@/config/subscriptionPlans";
import { TIERS, type TierKey } from "@/contexts/SubscriptionContext";

const plans = getPublicPlans().filter(p => p.id !== "lifetime");

const GiftSubscriptionSection = () => {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedTier, setSelectedTier] = useState(plans[0].id);
  const [duration, setDuration] = useState<1 | 3 | 6 | 12>(1);
  const [loading, setLoading] = useState(false);

  const selectedPlan = plans.find(p => p.id === selectedTier);
  const priceId = TIERS[selectedTier as TierKey]?.price_id;
  const basePrice = selectedPlan?.price === "Free" ? 0 : parseInt(selectedPlan?.price.replace(/[^0-9]/g, "") || "0");
  
  const discounts = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };
  const totalPrice = basePrice * duration * (1 - discounts[duration]);
  const savings = basePrice * duration - totalPrice;

  const handleGiftCheckout = async () => {
    if (!recipientEmail) {
      toast({ title: "Email required", description: "Please enter recipient's email", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: selectedPlan?.priceId,
          mode: "payment",
          isGift: true,
          giftRecipientEmail: recipientEmail,
          giftDurationMonths: duration,
        },
      });

      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create gift checkout", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Gift className="h-5 w-5 text-accent" />
        <h3 className="text-sm font-light text-foreground">Gift a Subscription</h3>
      </div>
      
      <p className="text-xs font-extralight text-muted-foreground">Give the power of Aureon to someone special. Extended durations receive automatic discounts.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            Recipient Email
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="friend@example.com"
            className="w-full rounded-lg border border-border/20 bg-background/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Select Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedTier(plan.id)}
                className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                  selectedTier === plan.id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border/20 bg-card/10 text-muted-foreground hover:border-accent/30"
                }`}
              >
                {plan.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([1, 3, 6, 12] as const).map((months) => (
              <button
                key={months}
                onClick={() => setDuration(months)}
                className={`relative rounded-lg border px-2 py-2 text-xs transition-all ${
                  duration === months
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border/20 bg-card/10 text-muted-foreground hover:border-accent/30"
                }`}
              >
                {months}mo
                {discounts[months] > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[9px] text-emerald-400">
                    <Sparkles className="h-2 w-2" />
                    -{(discounts[months] * 100).toFixed(0)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/10 bg-card/10 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${(basePrice * duration).toFixed(2)}</span>
          </div>
          {savings > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Duration Discount</span>
              <span className="text-emerald-400">-${savings.toFixed(2)}</span>
            </div>
          )}
          <div className="h-px bg-border/10 my-1.5" />
          <div className="flex items-center justify-between text-sm font-light">
            <span className="text-foreground">Total</span>
            <span className="text-accent">${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleGiftCheckout}
          disabled={loading || !recipientEmail}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-xs font-light text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Continue to Checkout"}
        </button>
      </div>
    </div>
  );
};

export default GiftSubscriptionSection;
