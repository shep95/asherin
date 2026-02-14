import { useState, useEffect, useRef } from "react";
import { FileText, Upload, Search, FolderOpen, Trash2, Image, FileCode, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { validateFile, buildStoragePath, sanitizeDisplayName, MAX_FILE_SIZE_DISPLAY } from "@/lib/file-security";

interface LibraryFile {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
}

const fileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.includes("javascript") || type.includes("typescript") || type.includes("json") || type.includes("html") || type.includes("css")) return FileCode;
  return FileText;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const LibraryView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("library_files").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setFiles(data ?? []); setLoading(false); });
  }, [user]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    const arr = Array.from(fileList);
    let successCount = 0;

    for (const file of arr) {
      // Security: validate file before upload
      const validation = await validateFile(file);
      if (!validation.valid) {
        toast({ title: "File rejected", description: `${sanitizeDisplayName(file.name)}: ${validation.error}`, variant: "destructive" });
        continue;
      }

      // Security: UUID-based storage path (original filename never used for storage)
      const path = buildStoragePath(user.id, file.name);
      const { error: uploadErr } = await supabase.storage.from("library").upload(path, file);
      if (uploadErr) {
        toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
        continue;
      }

      // Store sanitized display name in DB
      const { data: row } = await supabase.from("library_files").insert({
        user_id: user.id,
        file_name: sanitizeDisplayName(file.name),
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        storage_path: path,
      }).select().single();
      if (row) setFiles((prev) => [row, ...prev]);
      successCount++;
    }
    setUploading(false);
    if (successCount > 0) {
      toast({ title: `${successCount} file(s) uploaded` });
    }
  };

  const deleteFile = async (file: LibraryFile) => {
    await supabase.storage.from("library").remove([file.storage_path]);
    await supabase.from("library_files").delete().eq("id", file.id);
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const filtered = files.filter((f) => f.file_name.toLowerCase().includes(search.toLowerCase()));

  const docCount = files.filter((f) => !f.file_type.startsWith("image/")).length;
  const imgCount = files.filter((f) => f.file_type.startsWith("image/")).length;

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto">
    <div
      className={`max-w-3xl mx-auto p-6 space-y-6 ${dragOver ? "ring-2 ring-accent/50 ring-inset rounded-2xl" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extralight tracking-wide text-foreground">Your Library</h2>
          <p className="text-sm font-extralight text-muted-foreground mt-1">Upload files that persist across all conversations.</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">Max {MAX_FILE_SIZE_DISPLAY} per file · Only approved file types accepted</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 text-left">
          <FileText className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-xs font-light text-foreground">Documents</p>
          <p className="text-[10px] text-muted-foreground mt-1">{docCount} files</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 text-left">
          <Image className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-xs font-light text-foreground">Images</p>
          <p className="text-[10px] text-muted-foreground mt-1">{imgCount} files</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your library…"
          className="flex-1 bg-transparent text-xs font-extralight text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-extralight text-muted-foreground">{files.length === 0 ? "Drop files here or click Upload" : "No files match your search"}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((f) => {
            const Icon = fileIcon(f.file_type);
            return (
              <div key={f.id} className="group flex items-center gap-3 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light text-foreground truncate">{f.file_name}</p>
                  <p className="text-[10px] text-muted-foreground/50">{formatSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deleteFile(f)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
};

export default LibraryView;
