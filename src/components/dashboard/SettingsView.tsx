import { useState, useEffect, useRef } from "react";
import { User, Shield, Palette, Loader2, Camera, Download, Trash2, AlertTriangle, FileText, ImageIcon, Check, Keyboard, GitBranch, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useGitHub } from "@/hooks/useGitHub";
import AIKeysSettings from "./AIKeysSettings";
import wallpaperDefault from "@/assets/hero-bg.png";
import wallpaperRaven from "@/assets/wallpaper-raven.png";
import wallpaperEclipse from "@/assets/wallpaper-eclipse.png";
import wallpaperGlitch from "@/assets/wallpaper-glitch.png";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import wallpaperSeraph from "@/assets/wallpaper-seraph.png";
import wallpaperProphet from "@/assets/wallpaper-prophet.png";
import wallpaperNexus from "@/assets/wallpaper-nexus.png";
import wallpaperSentinel from "@/assets/wallpaper-sentinel.png";
import wallpaperInferno from "@/assets/wallpaper-inferno.png";
import wallpaperSorrow from "@/assets/wallpaper-sorrow.png";
import wallpaperSilhouette from "@/assets/wallpaper-silhouette.png";
import wallpaperPhantom from "@/assets/wallpaper-phantom.png";
import wallpaperAbyss from "@/assets/wallpaper-abyss.png";

const WALLPAPERS = [
  { key: "default", label: "Original", src: wallpaperDefault },
  { key: "raven", label: "Raven", src: wallpaperRaven },
  { key: "eclipse", label: "Eclipse", src: wallpaperEclipse },
  { key: "glitch", label: "Glitch", src: wallpaperGlitch },
  { key: "aureon", label: "Aureon", src: wallpaperAureon },
  { key: "seraph", label: "Seraph", src: wallpaperSeraph },
  { key: "prophet", label: "Prophet", src: wallpaperProphet },
  { key: "nexus", label: "Nexus", src: wallpaperNexus },
  { key: "sentinel", label: "Sentinel", src: wallpaperSentinel },
  { key: "inferno", label: "Inferno", src: wallpaperInferno },
  { key: "sorrow", label: "Sorrow", src: wallpaperSorrow },
  { key: "silhouette", label: "Silhouette", src: wallpaperSilhouette },
  { key: "phantom", label: "Phantom", src: wallpaperPhantom },
  { key: "abyss", label: "Abyss", src: wallpaperAbyss },
];

const GitHubSettings = () => {
  const { connection, loading, isConnected, connect, disconnect } = useGitHub();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!token || !owner || !repo) return;
    setConnecting(true);
    try {
      await connect(token, owner, repo, branch);
      setShowForm(false);
      setToken("");
      toast({ title: "GitHub connected", description: `${owner}/${repo}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    await disconnect();
    toast({ title: "GitHub disconnected" });
  };

  return (
    <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-light text-foreground">GitHub</h3>
        {isConnected && <span className="text-[10px] text-emerald-500 flex items-center gap-1 ml-auto"><Check className="h-3 w-3" /> Connected</span>}
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
      ) : isConnected ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/15 bg-card/10 p-3 space-y-1">
            <p className="text-xs font-light text-foreground">{connection?.repo_owner}/{connection?.repo_name}</p>
            <p className="text-[10px] text-muted-foreground/50">Branch: {connection?.branch}</p>
            {connection?.last_sync_at && <p className="text-[10px] text-muted-foreground/40">Last sync: {new Date(connection.last_sync_at).toLocaleString()}</p>}
          </div>
          <button onClick={handleDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-destructive/20 px-3 py-1.5 text-xs font-light text-destructive hover:bg-destructive/10 transition-colors">
            <X className="h-3 w-3" /> Disconnect
          </button>
        </div>
      ) : !showForm ? (
        <div className="space-y-2">
          <p className="text-xs font-extralight text-muted-foreground leading-relaxed">Connect a GitHub repository to import and export code from the IDE.</p>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg border border-border/20 bg-foreground/5 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/10 transition-colors">
            <GitBranch className="h-3.5 w-3.5" /> Connect GitHub
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input value={token} onChange={e => setToken(e.target.value)} placeholder="Personal Access Token" type="password" className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/40" />
          <div className="flex gap-2">
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" className="flex-1 bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/40" />
            <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="Repo name" className="flex-1 bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/40" />
          </div>
          <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch (main)" className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/40">Create a Fine-grained PAT at github.com → Settings → Developer settings → Personal access tokens. Grant "Contents" read/write.</p>
          <div className="flex gap-2">
            <button onClick={handleConnect} disabled={!token || !owner || !repo || connecting} className="inline-flex items-center gap-2 rounded-lg bg-foreground/10 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-30">
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Connect
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-border/20 px-4 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]).then(([settingsRes, profileRes]) => {
      setSettings(settingsRes.data);
      setProfile(profileRes.data);
      setDisplayName(profileRes.data?.display_name ?? user.user_metadata?.name ?? "");
      setAvatarUrl(profileRes.data?.avatar_url ?? null);
      setLoading(false);
    });
  }, [user]);

  const updateSetting = async (key: string, value: any) => {
    if (!user) return;
    const { error } = await supabase.from("user_settings").update({ [key]: value }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setSettings((prev: any) => ({ ...prev, [key]: value }));
    toast({ title: "Setting updated" });
  };

  const saveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setProfile((prev: any) => ({ ...prev, display_name: displayName.trim() }));
      toast({ title: "Profile saved", description: "Your display name has been updated." });
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from("avatars").remove([path]);
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error: updateErr } = await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (updateErr) {
      toast({ title: "Profile update failed", description: updateErr.message, variant: "destructive" });
    } else {
      setAvatarUrl(publicUrl);
      toast({ title: "Profile picture updated" });
    }
    setUploadingAvatar(false);
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

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-data`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aureon-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data exported successfully" });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== "DELETE MY ACCOUNT") return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Deletion failed");

      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      toast({ title: "Deletion failed", description: "Please try again.", variant: "destructive" });
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-xl font-extralight tracking-wide text-foreground">Settings</h2>
          <p className="text-sm font-extralight text-muted-foreground mt-1">Configure your Aureon experience.</p>
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
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="relative group shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-border/30 bg-card/30">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-foreground" /> : <Camera className="h-5 w-5 text-foreground" />}
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
                <input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                  className="flex-1 bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30 transition-colors" 
                />
                <button 
                  onClick={saveProfile} 
                  disabled={savingProfile || !displayName.trim()}
                  className="text-xs bg-foreground text-background px-3 py-2 rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {savingProfile ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <p className="text-sm text-foreground/70 mt-1">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Wallpaper */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-light text-foreground">Dashboard Wallpaper</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {WALLPAPERS.map((wp) => {
              const active = (localStorage.getItem("aureon_wallpaper") || "default") === wp.key;
              return (
                <button
                  key={wp.key}
                  onClick={() => {
                    localStorage.setItem("aureon_wallpaper", wp.key);
                    window.dispatchEvent(new Event("aureon-wallpaper-change"));
                    // Persist to DB
                    if (user) {
                      supabase.from("user_settings").update({ wallpaper: wp.key }).eq("user_id", user.id).then();
                    }
                    toast({ title: "Wallpaper updated", description: wp.label });
                  }}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-video group ${
                    active ? "border-foreground/50 ring-1 ring-foreground/20" : "border-border/20 hover:border-foreground/30"
                  }`}
                >
                  <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-background/60" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    {active && <Check className="h-4 w-4 text-foreground" />}
                    <span className="text-[10px] font-light text-foreground">{wp.label}</span>
                  </div>
                </button>
              );
            })}
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

        {/* GitHub Integration */}
        <GitHubSettings />

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

        {/* Keyboard Shortcuts */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-light text-foreground">Keyboard Shortcuts</h3>
          </div>
          <div className="space-y-1.5">
            {[
              { keys: "Ctrl+K", desc: "Open Command Palette" },
              { keys: "Ctrl+N", desc: "New Conversation" },
              { keys: "Enter", desc: "Send Message" },
              { keys: "Shift+Enter", desc: "New Line" },
              { keys: "Tab", desc: "Accept Autocomplete" },
              { keys: "Ctrl+1", desc: "Chat Mode" },
              { keys: "Ctrl+2", desc: "Code Mode" },
              { keys: "Ctrl+3", desc: "Research Mode" },
              { keys: "Ctrl+4", desc: "Truth Mode" },
              { keys: "Esc", desc: "Close Modal / Stop" },
              { keys: "↑ ↓", desc: "Navigate Command Palette" },
            ].map((s) => (
              <div key={s.keys} className="flex items-center justify-between py-1.5 px-1">
                <span className="text-xs font-light text-muted-foreground">{s.desc}</span>
                <kbd className="text-[10px] font-mono bg-secondary/40 border border-border/20 rounded-md px-2 py-0.5 text-muted-foreground">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </div>

        {/* GDPR / Data Rights */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-light text-foreground">Your Data Rights</h3>
          </div>

          <p className="text-xs font-extralight text-muted-foreground leading-relaxed">
            You have full control over your data. Download a copy, correct it, or permanently delete your account at any time.{" "}
            <Link to="/privacy" className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
              Read our Privacy Policy
            </Link>
          </p>

          <div className="rounded-lg border border-border/15 bg-card/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-light text-foreground">Download My Data</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              Export all your data — profile, conversations, memory, files, settings — as a machine-readable JSON file.
            </p>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-border/20 bg-foreground/5 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? "Exporting…" : "Export All Data"}
            </button>
          </div>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="text-xs font-light text-destructive">Delete My Account</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              Permanently delete your account and ALL associated data. This action is irreversible.
            </p>

            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-xs font-light text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Delete Account
              </button>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] text-destructive leading-relaxed">
                    Type <strong>DELETE MY ACCOUNT</strong> below to confirm.
                  </p>
                </div>
                <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE MY ACCOUNT" className="w-full bg-background/50 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/40" />
                <div className="flex gap-2">
                  <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE MY ACCOUNT" || deleting} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-light text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {deleting ? "Deleting…" : "Permanently Delete"}
                  </button>
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} className="rounded-lg border border-border/20 px-4 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
