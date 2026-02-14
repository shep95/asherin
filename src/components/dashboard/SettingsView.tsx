import { useState, useEffect } from "react";
import { User, Shield, Palette, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const SettingsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]).then(([settingsRes, profileRes]) => {
      setSettings(settingsRes.data);
      setProfile(profileRes.data);
      setDisplayName(profileRes.data?.display_name ?? "");
      setLoading(false);
    });
  }, [user]);

  const updateSetting = async (key: string, value: any) => {
    if (!user) return;
    await supabase.from("user_settings").update({ [key]: value }).eq("user_id", user.id);
    setSettings((prev: any) => ({ ...prev, [key]: value }));
    toast({ title: "Setting updated" });
  };

  const saveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    toast({ title: "Profile updated" });
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-extralight tracking-wide text-foreground">Settings</h2>
        <p className="text-sm font-extralight text-muted-foreground mt-1">Configure your Zialiel experience.</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-light text-foreground">Profile</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Display Name</label>
            <div className="flex gap-2 mt-1">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="flex-1 bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
              <button onClick={saveProfile} className="text-xs bg-foreground text-background px-3 py-2 rounded-lg">Save</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <p className="text-sm text-foreground/70 mt-1">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-light text-foreground">Response Preferences</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Response Length</label>
            <div className="flex gap-2 mt-2">
              {["concise", "balanced", "detailed"].map((len) => (
                <button
                  key={len}
                  onClick={() => updateSetting("response_length", len)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                    settings?.response_length === len ? "bg-foreground/10 border-foreground/30 text-foreground" : "border-border/20 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {len}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-light text-foreground">Privacy</h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-muted-foreground">Memory enabled</span>
            <button
              onClick={() => updateSetting("memory_enabled", !settings?.memory_enabled)}
              className={`w-10 h-5 rounded-full transition-colors ${settings?.memory_enabled ? "bg-foreground/30" : "bg-border/30"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-foreground transition-transform mx-0.5 ${settings?.memory_enabled ? "translate-x-5" : ""}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-muted-foreground">Web search enabled</span>
            <button
              onClick={() => updateSetting("web_search_enabled", !settings?.web_search_enabled)}
              className={`w-10 h-5 rounded-full transition-colors ${settings?.web_search_enabled ? "bg-foreground/30" : "bg-border/30"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-foreground transition-transform mx-0.5 ${settings?.web_search_enabled ? "translate-x-5" : ""}`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
