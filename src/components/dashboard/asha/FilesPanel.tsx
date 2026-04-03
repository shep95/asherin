import { useState, useEffect, useMemo } from "react";
import {
  FolderOpen, FolderClosed, FileText, Download, Loader2,
  ChevronRight, ChevronDown, Globe, Upload, Sparkles, Archive,
  File, Image, FileCode, Table2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";
import { useToast } from "@/hooks/use-toast";

interface FileEntry {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  source: "upload" | "webintel" | "generated";
  qualityScore?: number | null;
  rowCount?: number | null;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.includes("csv") || type.includes("xlsx") || type.includes("xls")) return Table2;
  if (type.includes("json") || type.includes("xml") || type.includes("sql")) return FileCode;
  return FileText;
};

const inferSource = (fileName: string, fileType: string, storagePath: string): "upload" | "webintel" | "generated" => {
  if (fileName.startsWith("webintel_") || storagePath.includes("webintel")) return "webintel";
  if (fileName.startsWith("report_") || fileName.startsWith("asha_report_")) return "generated";
  return "upload";
};

const sourceLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  upload: { label: "Uploads", icon: Upload, color: "text-blue-400" },
  webintel: { label: "Web Intelligence", icon: Globe, color: "text-emerald-400" },
  generated: { label: "Generated Reports", icon: Sparkles, color: "text-amber-400" },
};

const FilesPanel = () => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["upload", "webintel", "generated"]));
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();
  const { toast } = useToast();

  const loadFiles = async () => {
    if (!user || !activeSession) return;
    const [datasetsRes, docsRes] = await Promise.all([
      supabase
        .from("asha_datasets")
        .select("id, file_name, file_type, file_size, storage_path, created_at, quality_score, row_count")
        .eq("user_id", user.id)
        .eq("session_id", activeSession.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("asha_documents")
        .select("id, file_name, file_type, file_size, storage_path, created_at")
        .eq("user_id", user.id)
        .eq("session_id", activeSession.id)
        .order("created_at", { ascending: false }),
    ]);

    const allFiles: FileEntry[] = [];
    const seenPaths = new Set<string>();

    if (datasetsRes.data) {
      for (const d of datasetsRes.data) {
        seenPaths.add(d.storage_path);
        allFiles.push({
          id: d.id, fileName: d.file_name, fileType: d.file_type, fileSize: d.file_size,
          storagePath: d.storage_path, createdAt: d.created_at,
          source: inferSource(d.file_name, d.file_type, d.storage_path),
          qualityScore: d.quality_score, rowCount: d.row_count,
        });
      }
    }

    if (docsRes.data) {
      for (const d of docsRes.data) {
        if (seenPaths.has(d.storage_path)) continue;
        allFiles.push({
          id: d.id, fileName: d.file_name, fileType: d.file_type, fileSize: d.file_size,
          storagePath: d.storage_path, createdAt: d.created_at,
          source: inferSource(d.file_name, d.file_type, d.storage_path),
        });
      }
    }

    setFiles(allFiles);
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    loadFiles();
  }, [user, activeSession]);

  // Realtime subscriptions
  useEffect(() => {
    if (!activeSession) return;
    const ch1 = supabase
      .channel(`files-ds-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_datasets', filter: `session_id=eq.${activeSession.id}` }, () => loadFiles())
      .subscribe();
    const ch2 = supabase
      .channel(`files-docs-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_documents', filter: `session_id=eq.${activeSession.id}` }, () => loadFiles())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [activeSession, user]);

  const grouped = useMemo(() => {
    const map: Record<string, FileEntry[]> = { upload: [], webintel: [], generated: [] };
    for (const f of files) {
      map[f.source].push(f);
    }
    return map;
  }, [files]);

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const downloadFile = async (file: FileEntry) => {
    setDownloading(file.id);
    try {
      const { data, error } = await supabase.storage.from("asha-data").download(file.storagePath);
      if (error || !data) {
        toast({ title: "Download failed", description: error?.message || "File not found", variant: "destructive" });
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllAsZip = async () => {
    if (files.length === 0) return;
    setDownloadingAll(true);

    try {
      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const [source, entries] of Object.entries(grouped)) {
        if (entries.length === 0) continue;
        const folder = zip.folder(sourceLabels[source].label);
        if (!folder) continue;

        for (const file of entries) {
          try {
            const { data } = await supabase.storage.from("asha-data").download(file.storagePath);
            if (data) {
              folder.file(file.fileName, data);
            }
          } catch {
            // Skip failed files
          }
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeSession?.name || "azplen"}_files.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download complete", description: `${files.length} files packaged` });
    } catch {
      toast({ title: "ZIP creation failed", variant: "destructive" });
    } finally {
      setDownloadingAll(false);
    }
  };

  const totalSize = files.reduce((s, f) => s + f.fileSize, 0);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Files</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            {files.length} files · {formatSize(totalSize)}
          </p>
        </div>
        {files.length > 0 && (
          <button
            onClick={downloadAllAsZip}
            disabled={downloadingAll}
            className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-4 py-2 text-xs font-light text-foreground hover:bg-card/50 transition-colors disabled:opacity-50"
          >
            {downloadingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5 text-accent" />
            )}
            {downloadingAll ? "Packaging…" : "Download All as ZIP"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground/40 font-extralight">
            No files yet. Upload data in Ingest or run a Web Intelligence report.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Session root */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-card/20 border border-border/20">
            <FolderOpen className="h-4 w-4 text-accent" />
            <span className="text-sm font-light text-foreground">{activeSession?.name || "Session"}</span>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">{files.length} files</span>
          </div>

          {/* Source folders */}
          <div className="pl-4 space-y-0.5">
            {Object.entries(grouped).map(([source, entries]) => {
              if (entries.length === 0) return null;
              const isExpanded = expandedFolders.has(source);
              const meta = sourceLabels[source];
              const SourceIcon = meta.icon;

              return (
                <div key={source}>
                  {/* Folder header */}
                  <button
                    onClick={() => toggleFolder(source)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-foreground/5 transition-colors group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    {isExpanded ? (
                      <FolderOpen className={`h-4 w-4 ${meta.color}`} />
                    ) : (
                      <FolderClosed className={`h-4 w-4 ${meta.color}`} />
                    )}
                    <span className="text-xs font-light text-foreground">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground/40 ml-auto">{entries.length}</span>
                  </button>

                  {/* Files */}
                  {isExpanded && (
                    <div className="pl-8 space-y-0.5">
                      {entries.map((file) => {
                        const Icon = getFileIcon(file.fileType);
                        const isDownloading = downloading === file.id;

                        return (
                          <div
                            key={file.id}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-foreground/5 transition-colors group"
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-light text-foreground truncate">{file.fileName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground/40">{formatSize(file.fileSize)}</span>
                                {file.rowCount != null && (
                                  <span className="text-[10px] text-muted-foreground/40">{file.rowCount.toLocaleString()} rows</span>
                                )}
                                {file.qualityScore != null && (
                                  <span className={`text-[10px] ${file.qualityScore >= 90 ? "text-emerald-500/60" : file.qualityScore >= 75 ? "text-amber-500/60" : "text-destructive/60"}`}>
                                    {file.qualityScore}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => downloadFile(file)}
                              disabled={isDownloading}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-accent transition-all disabled:opacity-50"
                            >
                              {isDownloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesPanel;
