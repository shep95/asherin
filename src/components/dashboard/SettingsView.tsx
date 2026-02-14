import { useState, useEffect, useRef } from "react";
import { User, Shield, Palette, Loader2, Camera } from "lucide-react";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]).then(([settingsRes, profileRes]) => {
      setSettings(settingsRes.data);
      setProfile(profileRes.data);
      setDisplayName(profileRes.data?.display_name ?? "");
      setAvatarUrl(profileRes.data?.avatar_url ?? null);
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

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    // Remove old avatar if exists
    await supabase.storage.from("avatars").remove([path]);

    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
    toast({ title: "Profile picture updated" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
        return;
      }
      uploadAvatar(file);
    }
    e.target.value = "";
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto">
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
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative group shrink-0"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border/30 bg-card/30">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                  ) : (
                    <Camera className="h-5 w-5 text-foreground" />
                  )}
                </div>
              </button>
              <div>
                <p className="text-xs font-light text-foreground">Profile Picture</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Click to upload · Max 5MB</p>
              </div>
            </div>

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
    </div>
  );
};

export default SettingsView;
