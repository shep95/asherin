import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UploadCloud, Download, FileLock2, Loader2, Trash2 } from "lucide-react";
import { encryptText, decryptText, encryptBytes, decryptBytes, sha256Hex, bytesToB64 } from "@/lib/ziaassets/crypto";
import { getSessionKey } from "@/lib/ziaassets/session";
import { toast } from "sonner";

interface VaultFile {
  id: string; folder_id: string | null; storage_path: string;
  filename_ct: string; filename_iv: string; display_name: string | null;
  mime: string | null; size_bytes: number | null; iv: string;
  min_rank: string; tags: string[]; uploaded_by: string; created_at: string;
}

const BUCKET = "ziaassets-vault";

export default function VaultView() {
  const { user } = useAuth();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ziaassets_vault_files")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setFiles((data ?? []) as VaultFile[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Decrypt filenames
  useEffect(() => {
    const key = getSessionKey();
    if (!key) return;
    (async () => {
      const next: Record<string, string> = { ...names };
      for (const f of files) {
        if (next[f.id]) continue;
        try { next[f.id] = await decryptText(key, f.filename_ct, f.filename_iv); }
        catch { next[f.id] = f.display_name ?? "encrypted-file"; }
      }
      setNames(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const upload = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const key = getSessionKey();
    if (!key) { toast.error("Vault locked."); return; }
    setBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const hash = await sha256Hex(buf);
        const { blob, iv } = await encryptBytes(key, buf);
        const { ciphertext: filename_ct, iv: filename_iv } = await encryptText(key, file.name);
        const path = `${user!.id}/${crypto.randomUUID()}.enc`;
        const encBlob = new Blob([bytesToB64(blob)], { type: "application/octet-stream" });
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, encBlob, {
          contentType: "application/octet-stream", upsert: false,
        });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("ziaassets_vault_files").insert({
          storage_path: path, filename_ct, filename_iv, mime: file.type || null,
          size_bytes: file.size, iv, sha256: hash, uploaded_by: user!.id,
          display_name: file.name.replace(/^.*\./, "*.") || null, // extension hint only
        });
        if (dbErr) throw dbErr;
      }
      toast.success("Encrypted upload complete.");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const download = async (f: VaultFile) => {
    const key = getSessionKey();
    if (!key) { toast.error("Vault locked."); return; }
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(f.storage_path);
      if (error) throw error;
      const b64 = await data.text();
      // decode base64 back to bytes
      const bin = atob(b64);
      const enc = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) enc[i] = bin.charCodeAt(i);
      const plain = await decryptBytes(key, enc, f.iv);
      const filename = names[f.id] ?? "download.bin";
      const blob = new Blob([new Uint8Array(plain)], { type: f.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (f: VaultFile) => {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    await supabase.from("ziaassets_vault_files").delete().eq("id", f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-background/40 backdrop-blur border-white/10 flex items-center gap-3">
        <FileLock2 className="w-5 h-5" />
        <div className="flex-1">
          <div className="font-semibold">Encrypted Vault</div>
          <div className="text-xs text-muted-foreground">All bytes AES-256-GCM encrypted before upload. Filename encrypted too.</div>
        </div>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UploadCloud className="w-4 h-4 mr-2" />}
          Upload
        </Button>
      </Card>

      <div className="space-y-2">
        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {!loading && !files.length && <div className="text-xs text-muted-foreground">Vault empty.</div>}
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3 rounded-md border border-white/10 bg-background/40">
            <FileLock2 className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{names[f.id] ?? "…decrypting"}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {(f.size_bytes ?? 0).toLocaleString()} bytes · {f.mime || "octet-stream"} · {new Date(f.created_at).toLocaleString()}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{f.min_rank}</Badge>
            <Button variant="ghost" size="icon" onClick={() => download(f)}><Download className="w-4 h-4" /></Button>
            {f.uploaded_by === user?.id && (
              <Button variant="ghost" size="icon" onClick={() => remove(f)}><Trash2 className="w-4 h-4" /></Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
