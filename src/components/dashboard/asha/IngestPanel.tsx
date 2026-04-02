import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, Image, FileCode, AlertTriangle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import IngestStatusBadge from "./IngestStatusBadge";
import { sanitizeDisplayName, MAX_FILE_SIZE, MAX_FILE_SIZE_DISPLAY } from "@/lib/file-security";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

interface AshaDataset {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: string;
  row_count: number | null;
  col_count: number | null;
  quality_score: number | null;
  schema: any[];
  issues: any[];
  created_at: string;
}

const fileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.includes("javascript") || type.includes("json") || type.includes("csv") || type.includes("xml")) return FileCode;
  return FileText;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const IngestPanel = () => {
  const [datasets, setDatasets] = useState<AshaDataset[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  // Load existing datasets scoped to session
  const loadDatasets = async () => {
    if (!user || !activeSession) return;
    const { data } = await supabase
      .from("asha_datasets")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: false });
    if (data) setDatasets(data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    loadDatasets();
  }, [user, activeSession]);

  // Realtime subscription for processing updates
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`ingest-rt-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_datasets', filter: `session_id=eq.${activeSession.id}` }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as any;
          setDatasets(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
        } else {
          loadDatasets();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession, user]);

  const ingestFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!user || !activeSession) return;
    const arr = Array.from(fileList);
    const validated: File[] = [];

    for (const file of arr) {
      // Basic size check only — accept any file type
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File rejected", description: `${sanitizeDisplayName(file.name)}: exceeds ${MAX_FILE_SIZE_DISPLAY}`, variant: "destructive" });
        continue;
      }
      if (file.size === 0) {
        toast({ title: "File rejected", description: `${sanitizeDisplayName(file.name)}: empty file`, variant: "destructive" });
        continue;
      }

      // Auto-extract ZIP files
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "zip") {
        try {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(file);
          const entries = Object.entries(zip.files);
          for (const [path, entry] of entries) {
            if (entry.dir || path.startsWith("__MACOSX") || path.startsWith(".")) continue;
            const blob = await entry.async("blob");
            if (blob.size === 0) continue;
            const fileName = path.split("/").pop() || path;
            const extracted = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
            validated.push(extracted);
          }
          toast({ title: "ZIP extracted", description: `${entries.filter(([p, e]) => !e.dir).length} files extracted from ${sanitizeDisplayName(file.name)}` });
        } catch {
          toast({ title: "ZIP extraction failed", description: `Could not extract ${sanitizeDisplayName(file.name)}, uploading as-is`, variant: "destructive" });
          validated.push(file);
        }
        continue;
      }

      // Duplicate detection
      const { data: existing } = await supabase
        .from("asha_datasets")
        .select("id, file_name")
        .eq("user_id", user.id)
        .eq("session_id", activeSession.id)
        .eq("file_name", sanitizeDisplayName(file.name))
        .eq("file_size", file.size);
      if (existing && existing.length > 0) {
        const proceed = window.confirm(`File "${sanitizeDisplayName(file.name)}" already exists in this session. Upload again?`);
        if (!proceed) continue;
      }
      validated.push(file);
    }

    if (validated.length === 0) return;

    for (const file of validated) {
      const safeName = sanitizeDisplayName(file.name);
      const storagePath = `${user.id}/${crypto.randomUUID()}_${safeName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("asha-data")
        .upload(storagePath, file);

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      // Create dataset record
      const { data: ds, error: insertError } = await supabase
        .from("asha_datasets")
        .insert({
          user_id: user.id,
          file_name: safeName,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          storage_path: storagePath,
          status: "analyzing",
          session_id: activeSession?.id || null,
        })
        .select()
        .single();

      if (insertError || !ds) {
        toast({ title: "Record creation failed", description: insertError?.message, variant: "destructive" });
        continue;
      }

      setDatasets((prev) => [ds as any, ...prev]);

      // Trigger analysis with timeout
      const { data: session } = await supabase.auth.getSession();
      const startTime = Date.now();
      const TIMEOUT = 5 * 60 * 1000; // 5 minutes

      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ datasetId: ds.id }),
      }).then(async (res) => {
        if (res.ok) {
          const result = await res.json();
          setDatasets((prev) => prev.map((d) =>
            d.id === ds.id
              ? { ...d, status: "ready", row_count: result.rowCount, col_count: result.colCount, quality_score: result.qualityScore, schema: result.schema, issues: result.issues }
              : d
          ));
        } else {
          setDatasets((prev) => prev.map((d) => d.id === ds.id ? { ...d, status: "error" } : d));
        }
      }).catch(() => {
        setDatasets((prev) => prev.map((d) => d.id === ds.id ? { ...d, status: "error" } : d));
      });

      // Timeout watchdog
      setTimeout(async () => {
        setDatasets((prev) => {
          const current = prev.find(d => d.id === ds.id);
          if (current && current.status === "analyzing") {
            supabase.from("asha_datasets").update({ status: "error" }).eq("id", ds.id);
            toast({ title: "Processing timeout", description: `"${safeName}" took too long. Click retry.`, variant: "destructive" });
            return prev.map(d => d.id === ds.id ? { ...d, status: "error" } : d);
          }
          return prev;
        });
      }, TIMEOUT);
    }
  }, [toast, user, activeSession]);

  const retryProcessing = async (datasetId: string) => {
    const ds = datasets.find(d => d.id === datasetId);
    if (!ds) return;
    setDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, status: "analyzing" } : d));
    await supabase.from("asha_datasets").update({ status: "analyzing" }).eq("id", datasetId);
    const { data: session } = await supabase.auth.getSession();
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ datasetId }),
    }).then(async (res) => {
      if (res.ok) {
        const result = await res.json();
        setDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, status: "ready", row_count: result.rowCount, col_count: result.colCount, quality_score: result.qualityScore, schema: result.schema, issues: result.issues } : d));
      } else {
        setDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, status: "error" } : d));
      }
    }).catch(() => {
      setDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, status: "error" } : d));
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files);
  };

  const removeFile = async (id: string) => {
    const ds = datasets.find((d) => d.id === id);
    if (ds) {
      await supabase.storage.from("asha-data").remove([ds.storage_path]);
      await supabase.from("asha_datasets").delete().eq("id", id);
    }
    setDatasets((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed transition-colors p-10 text-center ${
          dragOver ? "border-accent/50 bg-accent/5" : "border-border/30 bg-card/10 hover:border-border/50"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-light text-foreground">Drop files here or click to browse</p>
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          CSV, JSON, XLSX, XML, PDF, SQL — up to {MAX_FILE_SIZE_DISPLAY} per file
        </p>
        <p className="text-[10px] text-muted-foreground/30 mt-1">
          Files are validated, uploaded, and analyzed by Asha AI
        </p>
        <input ref={inputRef} type="file" multiple className="hidden" accept=".csv,.json,.jsonl,.xlsx,.xls,.xml,.pdf,.sql,.parquet,.geojson,.txt,.log,.yaml,.yml,.toml,.md,.markdown" onChange={(e) => { if (e.target.files) ingestFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* File cards */}
      {datasets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-light tracking-[0.1em] text-muted-foreground/60 uppercase">Landing Zone</h3>
          {datasets.map((file) => {
            const Icon = fileIcon(file.file_type);
            const isExpanded = expandedFile === file.id;
            return (
              <div key={file.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-foreground truncate">{file.file_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground/50">{formatSize(file.file_size)}</span>
                      {file.row_count != null && <span className="text-[10px] text-muted-foreground/50">{file.row_count.toLocaleString()} rows</span>}
                      {file.col_count != null && <span className="text-[10px] text-muted-foreground/50">{file.col_count} columns</span>}
                      {file.quality_score != null && (
                        <span className={`text-[10px] ${file.quality_score >= 90 ? "text-emerald-500/70" : file.quality_score >= 75 ? "text-amber-500/70" : "text-destructive/70"}`}>
                          {file.quality_score}% quality
                        </span>
                      )}
                    </div>
                  </div>
                  <IngestStatusBadge
                    status={file.status as any}
                    onRetry={() => retryProcessing(file.id)}
                  />
                  <div className="flex items-center gap-1">
                    {file.status === "ready" && (
                      <button onClick={() => setExpandedFile(isExpanded ? null : file.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                    <button onClick={() => removeFile(file.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && file.status === "ready" && (
                  <div className="border-t border-border/20 p-4 space-y-4">
                    {file.schema && file.schema.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-light tracking-[0.1em] text-muted-foreground/60 uppercase mb-2">Detected Schema</h4>
                        <div className="space-y-1">
                          {file.schema.map((col: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg bg-card/30 px-3 py-2 text-xs">
                              <span className="font-mono text-foreground w-28 truncate">{col.name}</span>
                              <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{col.type}</span>
                              <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{(col.role || "auto").replace("_", " ")}</span>
                              {col.isPII && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">PII ◇</span>}
                              {col.nullCount > 0 && <span className="text-[10px] text-muted-foreground/50">{col.nullCount} nulls</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {file.issues && file.issues.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-light tracking-[0.1em] text-muted-foreground/60 uppercase mb-2">Data Issues</h4>
                        <div className="space-y-1.5">
                          {file.issues.map((issue: any, i: number) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-card/30 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`h-3.5 w-3.5 ${issue.severity === "high" ? "text-destructive" : issue.severity === "medium" ? "text-amber-500" : "text-muted-foreground"}`} />
                                <span className="text-xs font-light text-foreground">{issue.description}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{issue.rowCount?.toLocaleString()} rows</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && datasets.length === 0 && (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground/40 font-extralight">Upload files to begin your intelligence analysis</p>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      )}
    </div>
  );
};

export default IngestPanel;
