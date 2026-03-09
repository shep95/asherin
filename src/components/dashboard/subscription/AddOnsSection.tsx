import { useState } from "react";
import { Package, Loader2, Plus, Brain, Video, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

const addOns = [
  { 
    id: "memory", 
    name: "Extended Memory", 
    price: 19, 
    icon: Brain, 
    description: "10x context window expansion",
    includedIn: "Included in Pro tier"
  },
  { 
    id: "video", 
    name: "Video Intelligence", 
    price: 59, 
    icon: Video, 
    description: "Advanced video analysis",
    includedIn: "Included in Pro tier"
  },
  { 
    id: "osint", 
    name: "OSINT Pro", 
    price: 79, 
    icon: Search, 
    description: "Professional investigation tools",
    includedIn: "Included in Aureon & Pro tiers"
  },
];

const AddOnsSection = () => {
  const { toast } = useToast();
  const { subscribed } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAddOnCheckout = async (addOn: typeof addOns[0]) => {
    if (!subscribed) {
      toast({ title: "Base subscription required", description: "Please subscribe to a plan first", variant: "destructive" });
      return;
    }

    setLoading(addOn.id);
    try {
      const { data, error } = await supabase.functions.invoke("addon-checkout", {
        body: {
          addonId: addOn.id,
          addonName: addOn.name,
          priceCents: addOn.price * 100,
        },
      });

      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-light text-foreground">Add-On Subscriptions</h3>
      </div>

      {!subscribed && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
          <p className="text-xs text-amber-400/80">Subscribe to a base plan to unlock add-ons</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addOns.map((addon) => (
          <div key={addon.id} className="rounded-lg border border-border/10 bg-card/10 p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{addon.icon}</span>
                <div>
                  <p className="text-xs font-light text-foreground">{addon.name}</p>
                  <p className="text-[10px] text-muted-foreground">{addon.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-light text-accent">${addon.price}/mo</span>
              <button
                onClick={() => handleAddOnCheckout(addon)}
                disabled={loading === addon.id || !subscribed}
                className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === addon.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddOnsSection;
