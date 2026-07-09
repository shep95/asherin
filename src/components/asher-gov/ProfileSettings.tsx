// ProfileSettings — user avatar + display name for asherin.gov
// Backed by public.profiles(user_id, display_name, avatar_url)

import { useEffect, useState } from "react";
import { X, User as UserIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import IconUploader from "./IconUploader";

export default function ProfileSettings({
  open, onClose, userId, defaultEmail,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaultEmail?: string | null;
}) {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("profiles").select("display_name,avatar_url").eq("user_id", userId).maybeSingle();
      if (cancelled) return;
      setDisplayName(data?.display_name ?? (defaultEmail?.split("@")[0] ?? ""));
      setAvatarUrl(data?.avatar_url ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, userId, defaultEmail]);

  const persistAvatar = async (url: string | null) => {
    const { error } = await supabase.from("profiles")
      .upsert({ user_id: userId, avatar_url: url, display_name: displayName || null }, { onConflict: "user_id" });
    if (error) throw error;
    setAvatarUrl(url);
  };

  const saveName = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles")
        .upsert({ user_id: userId, display_name: displayName.trim() || null, avatar_url: avatarUrl }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile updated");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-neutral-950 border border-border/40 sm:rounded-lg shadow-2xl flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div className="flex items-center gap-3">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-light tracking-widest uppercase">Profile</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">Profile picture</div>
                <IconUploader
                  kind="avatar" folderKey={userId} currentUrl={avatarUrl} size={72} shape="circle"
                  onUploaded={async (url) => { await persistAvatar(url); }}
                  onCleared={async () => { await persistAvatar(null); }}
                />
              </div>

              <label className="block">
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Display name</span>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                       maxLength={60} placeholder="how you appear on the deck"
                       className="mt-1 w-full bg-black/60 border border-border/30 rounded px-3 py-2 text-sm text-foreground focus:border-amber-500/50 outline-none" />
              </label>

              <button onClick={saveName} disabled={saving}
                      className="w-full py-2.5 border border-amber-500/50 text-amber-300 rounded text-xs tracking-widest uppercase hover:bg-amber-500/10 disabled:opacity-40 flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
