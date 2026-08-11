import { useState, useEffect } from "react";
import { Gift, Mail, Calendar, Sparkles, CheckCircle2, XCircle, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPublicPlans } from "@/config/subscriptionPlans";
import { TIERS, type TierKey } from "@/contexts/SubscriptionContext";

const plans = getPublicPlans(); // Include lifetime
const ADDON_PRODUCTS = {
  "Memory Center": "prod_addon_memory",
  "Video Intelligence": "prod_addon_video",
  "OSINT Suite": "prod_addon_osint",
};

const GiftSubscriptionSection = () => {
  const { toast } = useToast();
  const [giftType, setGiftType] = useState<"plan" | "addon">("plan");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedTier, setSelectedTier] = useState(plans[0].id);
  const [selectedAddon, setSelectedAddon] = useState(Object.keys(ADDON_PRODUCTS)[0]);
  const [duration, setDuration] = useState<1 | 3 | 6 | 12>(1);
  const [loading, setLoading] = useState(false);
  const [emailValidation, setEmailValidation] = useState<{
    status: "idle" | "checking" | "valid" | "invalid";
    message?: string;
  }>({ status: "idle" });

  // Debounced email validation
  useEffect(() => {
    if (!recipientEmail) {
      setEmailValidation({ status: "idle" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      setEmailValidation({ status: "invalid", message: "Invalid email format" });
      return;
    }

    const timer = setTimeout(async () => {
      setEmailValidation({ status: "checking" });
      
      try {
        const { data, error } = await supabase.functions.invoke("validate-gift-email", {
          body: { email: recipientEmail },
        });

        if (error) throw error;

        if (data?.exists) {
          setEmailValidation({ status: "valid", message: "Account found ✓" });
        } else {
          setEmailValidation({ status: "invalid", message: "No Aureon account found" });
        }
      } catch (err) {
        setEmailValidation({ status: "invalid", message: "Unable to verify email" });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [recipientEmail]);

  const selectedPlan = plans.find(p => p.id === selectedTier);
  const priceId = TIERS[selectedTier as TierKey]?.price_id;
  const basePrice = selectedPlan?.price === "Free" ? 0 : parseInt(selectedPlan?.price.replace(/[^0-9]/g, "") || "0");
  
  const discounts = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };
  const isLifetime = selectedTier === "lifetime";
  const effectiveDuration = isLifetime ? 1 : duration;
  const totalPrice = basePrice * effectiveDuration * (1 - (isLifetime ? 0 : discounts[duration]));
  const savings = basePrice * effectiveDuration - totalPrice;

  const handleGiftCheckout = async () => {
    if (!recipientEmail || emailValidation.status !== "valid") {
      toast({ 
        title: "Invalid recipient", 
        description: "Please enter a valid Aureon account email", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      if (giftType === "addon") {
        const { data, error } = await supabase.functions.invoke("gift-addon", {
          body: {
            addonProductId: ADDON_PRODUCTS[selectedAddon as keyof typeof ADDON_PRODUCTS],
            recipientEmail,
          },
        });
        if (error) throw error;
        if (data?.url) window.open(data.url, "_blank");
      } else {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: {
            priceId,
            mode: isLifetime ? "payment" : "payment",
            isGift: true,
            giftRecipientEmail: recipientEmail,
            giftDurationMonths: isLifetime ? 0 : duration,
          },
        });
        if (error) throw error;
        if (data?.url) window.open(data.url, "_blank");
      }
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
      
      <p className="text-xs font-extralight text-muted-foreground">share a subscription with someone you know. longer terms use the listed term discount.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Gift Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setGiftType("plan")}
              className={`rounded-lg border px-3 py-2 text-xs transition-all flex items-center gap-2 justify-center ${
                giftType === "plan"
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border/20 bg-card/10 text-muted-foreground hover:border-accent/30"
              }`}
            >
              <Gift className="h-3.5 w-3.5" />
              Subscription Plan
            </button>
            <button
              onClick={() => setGiftType("addon")}
              className={`rounded-lg border px-3 py-2 text-xs transition-all flex items-center gap-2 justify-center ${
                giftType === "addon"
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border/20 bg-card/10 text-muted-foreground hover:border-accent/30"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Add-on Module
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            Recipient Email
          </label>
          <div className="relative">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full rounded-lg border border-border/20 bg-background/50 px-3 py-2 pr-8 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {emailValidation.status === "checking" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {emailValidation.status === "valid" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {emailValidation.status === "invalid" && (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
            </div>
          </div>
          {emailValidation.message && (
            <p className={`text-[10px] mt-1 ${
              emailValidation.status === "valid" ? "text-emerald-500" : "text-destructive"
            }`}>
              {emailValidation.message}
            </p>
          )}
        </div>

        {giftType === "plan" ? (
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Select Plan</label>
            <div className="grid grid-cols-2 gap-2">
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
        ) : (
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Select Add-on</label>
            <div className="grid grid-cols-1 gap-2">
              {Object.keys(ADDON_PRODUCTS).map((addon) => (
                <button
                  key={addon}
                  onClick={() => setSelectedAddon(addon)}
                  className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                    selectedAddon === addon
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border/20 bg-card/10 text-muted-foreground hover:border-accent/30"
                  }`}
                >
                  {addon}
                </button>
              ))}
            </div>
          </div>
        )}

        {giftType === "plan" && !isLifetime && (
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
                    <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] text-accent">
                      <Sparkles className="h-2 w-2" />
                      -{(discounts[months] * 100).toFixed(0)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border/10 bg-card/10 p-3 space-y-1.5">
          {giftType === "plan" && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">${(basePrice * effectiveDuration).toFixed(2)}</span>
              </div>
              {savings > 0 && !isLifetime && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Duration Discount</span>
                  <span className="text-accent">-${savings.toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-border/10 my-1.5" />
              <div className="flex items-center justify-between text-sm font-light">
                <span className="text-foreground">Total</span>
                <span className="text-accent">${totalPrice.toFixed(2)}</span>
              </div>
            </>
          )}
          {giftType === "addon" && (
            <div className="flex items-center justify-between text-sm font-light">
              <span className="text-foreground">{selectedAddon}</span>
              <span className="text-accent">One-time purchase</span>
            </div>
          )}
        </div>

        <button
          onClick={handleGiftCheckout}
          disabled={loading || emailValidation.status !== "valid"}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-xs font-light text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Continue to Checkout"}
        </button>
      </div>
    </div>
  );
};

export default GiftSubscriptionSection;
