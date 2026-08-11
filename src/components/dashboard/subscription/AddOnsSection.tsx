import { useState } from "react";
import { Loader2, Plus, Brain, Video, Search, Bot, Zap, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

const addOns = [
  { 
    id: "agents", 
    name: "Automated Agents", 
    price: 200, 
    icon: Bot, 
    description: "ai agents that can continue approved routine tasks",
    includedIn: "Add-on for any plan"
  },
  { 
    id: "custom-wallpapers", 
    name: "Custom Wallpapers", 
    price: 3.99, 
    icon: ImageIcon, 
    description: "Upload your own wallpapers for dashboard & landing page",
    includedIn: "Add-on for any plan"
  },
  { 
    id: "memory", 
    name: "Extended Memory", 
    price: 19, 
    icon: Brain, 
    description: "a larger context window for longer working sessions",
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
          priceCents: Math.round(addOn.price * 100),
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
    <div className="rounded-xl border border-border/15 bg-card/10 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3">
        <Zap className="h-4 w-4 text-muted-foreground/70" />
        <h3 className="text-xs font-light tracking-[0.12em] uppercase text-foreground/90">Add-Ons</h3>
      </div>

      <div className="px-5 pb-5 pt-0">
        {!subscribed && (
          <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-3 mb-4">
            <p className="text-[11px] text-amber-400/70 font-extralight">Subscribe to a base plan to unlock add-ons</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addOns.map((addon) => {
            const IconComponent = addon.icon;
            return (
              <div key={addon.id} className="rounded-lg border border-border/10 bg-card/5 p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.04] flex items-center justify-center shrink-0">
                    <IconComponent className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-light text-foreground">{addon.name}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">{addon.description}</p>
                    <p className="text-[9px] text-muted-foreground/35 mt-1">{addon.includedIn}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extralight text-accent/80">${addon.price}<span className="text-[10px] text-muted-foreground/40"> one-time</span></span>
                  <button
                    onClick={() => handleAddOnCheckout(addon)}
                    disabled={loading === addon.id || !subscribed}
                    className="flex items-center gap-1.5 rounded-lg border border-border/15 px-3 py-1.5 text-[10px] font-light text-foreground/70 hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AddOnsSection;
