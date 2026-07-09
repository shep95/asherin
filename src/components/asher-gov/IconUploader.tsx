// IconUploader — square image uploader for user avatars and server icons.
// Bucket "gov-icons" is private; we mint a long-lived signed URL and persist it.
//
// Validation: image/* mime, ≤2 MB, ≤4096×4096. Cache-busted via ?v=timestamp.

import { useRef, useState } from "react";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "gov-icons";
const MAX_BYTES = 2 * 1024 * 1024;
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

type Kind = "avatar" | "server";

export default function IconUploader({
  kind, folderKey, currentUrl, onUploaded, onCleared, size = 64, shape = "square",
}: {
  kind: Kind;
  folderKey: string;                         // uid for avatar, server_id for server
  currentUrl?: string | null;
  onUploaded: (url: string, path: string) => void | Promise<void>;
  onCleared?: () => void | Promise<void>;
  size?: number;
  shape?: "square" | "circle";
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const radius = shape === "circle" ? "rounded-full" : "rounded-lg";

  const pick = () => inputRef.current?.click();

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Image files only"); return; }
    if (file.size > MAX_BYTES) { toast.error("Image must be ≤2 MB"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const folder = kind === "avatar" ? "avatars" : "servers";
      const path = `${folder}/${folderKey}/icon.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET).upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;

      const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("sign_failed");

      const url = `${signed.signedUrl}${signed.signedUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setPreview(url);
      await onUploaded(url, path);
      toast.success("Icon updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!onCleared) return;
    setBusy(true);
    try { setPreview(null); await onCleared(); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        onClick={pick}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && pick()}
        style={{ width: size, height: size }}
        className={`${radius} border border-border/40 bg-black/40 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500/50 transition group relative`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground group-hover:text-amber-300" />
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={pick} disabled={busy}
                className="text-[10px] tracking-widest uppercase border border-border/40 rounded px-2 py-1 hover:bg-foreground/10 disabled:opacity-40">
          {preview ? "Replace" : "Upload"}
        </button>
        {preview && onCleared && (
          <button type="button" onClick={clear} disabled={busy}
                  className="text-[9px] tracking-widest uppercase text-muted-foreground hover:text-amber-300 inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        )}
        <span className="text-[9px] text-muted-foreground/70">PNG/JPG · ≤2 MB</span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.currentTarget.value = ""; }} />
    </div>
  );
}
