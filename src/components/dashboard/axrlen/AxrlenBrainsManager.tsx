import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Brain, Trash2, Upload, Loader2, X, ToggleLeft, ToggleRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { isOwnerEmail } from "@/lib/adminEmail";

interface AxrlenBrain {
  id: string;
  name: string;
  description: string;
  content: string;
  file_name: string;
  is_active: boolean;
  created_at: string;
}
const FILE_INPUT_ID = "axrlen-brains-upload";

const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  let text = "";
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(uint8);

  const textMatches = raw.match(/\(([^)]*)\)/g);
  if (textMatches) {
    const lines = textMatches
      .map((m) => m.slice(1, -1))
      .filter((t) => t.length > 1 && /[a-zA-Z]/.test(t));
    text = lines.join(" ");
  }

  const readable = raw.match(/[\x20-\x7E\n\r\t]{20,}/g);
  if (readable) {
    const extraText = readable
      .filter((s) => /[a-zA-Z]{3,}/.test(s) && !/^[%/\[\]<>{}]+$/.test(s.trim()))
      .join("\n");
    if (extraText.length > text.length) text = extraText;
  }

  return text || `[PDF file: ${file.name} - content could not be fully extracted client-side. For best results, upload as .txt or .md]`;
};

const readFileContent = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return extractTextFromPdf(file);
  return file.text();
};

const AxrlenBrainsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brains, setBrains] = useState<AxrlenBrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = isOwnerEmail(user?.email);

  useEffect(() => {
    if (!showPanel) return;
    loadBrains();
  }, [showPanel]);

  useEffect(() => {
    if (!showPanel) {
      setDragging(false);
    }
  }, [showPanel]);

  const loadBrains = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("axrlen_brains")
      .select("*")
      .order("created_at", { ascending: false });
    setBrains((data as AxrlenBrain[] | null) ?? []);
    setLoading(false);
  };

  const handleFileUpload = async (fileList: FileList | File[]) => {
    if (!isAdmin) return;

    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploading(true);

    for (const file of files) {
      try {
        const text = await readFileContent(file);
        const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");

        const { data: row, error } = await supabase
          .from("axrlen_brains")
          .insert({
            name,
            description: `Uploaded from ${file.name}`,
            content: text,
            file_name: file.name,
            is_active: true,
          })
          .select()
          .single();

        if (error) {
          toast({ title: "Upload failed", description: error.message, variant: "destructive" });
          continue;
        }

        if (row) setBrains((prev) => [row as AxrlenBrain, ...prev]);
        toast({ title: `Brain "${name}" added` });
      } catch (err: any) {
        toast({ title: "Read failed", description: err.message, variant: "destructive" });
      }
    }

    setUploading(false);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (panelRef.current && e.relatedTarget instanceof Node && panelRef.current.contains(e.relatedTarget)) {
      return;
    }

    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    if (e.dataTransfer.files.length > 0) {
      void handleFileUpload(e.dataTransfer.files);
    }
  }, [isAdmin]);

  const toggleBrain = async (brain: AxrlenBrain) => {
    if (!isAdmin) return;
    const newActive = !brain.is_active;
    await supabase.from("axrlen_brains").update({ is_active: newActive }).eq("id", brain.id);
    setBrains((prev) => prev.map((b) => (b.id === brain.id ? { ...b, is_active: newActive } : b)));
  };

  const deleteBrain = async (id: string) => {
    if (!isAdmin) return;
    await supabase.from("axrlen_brains").delete().eq("id", id);
    setBrains((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "Brain deleted" });
  };

  const openFilePicker = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!uploading) inputRef.current?.click();
  };

  if (!isAdmin) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setShowPanel((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
          showPanel
            ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
            : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
        }`}
      >
        <Brain className="h-3 w-3" /> Brains
      </button>

      {showPanel && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[999] pointer-events-none">
          <div className="absolute inset-0 pointer-events-auto bg-black/0" onClick={() => setShowPanel(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`pointer-events-auto fixed right-4 top-20 z-[1000] w-[420px] max-w-[calc(100vw-2rem)] max-h-[min(520px,calc(100vh-6rem))] overflow-y-auto rounded-xl border bg-card/95 backdrop-blur-xl shadow-2xl animate-fade-in transition-all ${
              dragging ? "border-violet-500/60 ring-2 ring-violet-500/20" : "border-border/30"
            }`}
          >
            <input
              ref={inputRef}
              id={FILE_INPUT_ID}
              type="file"
              multiple
              accept=".txt,.md,.json,.csv,.pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files) void handleFileUpload(e.target.files);
                e.target.value = "";
              }}
            />

            {dragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-violet-500/10 backdrop-blur-sm rounded-xl pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-violet-400 animate-bounce" />
                  <p className="text-xs text-violet-300 font-light">Drop files here</p>
                </div>
              </div>
            )}

            <div className="p-4 border-b border-border/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-light text-foreground">AXRLEN Brains</h3>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 uppercase tracking-wider">Admin</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={uploading}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                      uploading ? "text-muted-foreground/50 cursor-wait" : "text-violet-400 hover:bg-violet-500/10"
                    }`}
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPanel(false);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/40 mt-1">Drag & drop or upload .txt, .md, .pdf, .json, .csv files. Active brains inject into all AXRLEN sessions.</p>
            </div>

            <div className="p-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : brains.length === 0 ? (
                <button type="button" onClick={openFilePicker} className="block w-full text-center py-8">
                  <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground/40">No brains uploaded yet</p>
                  <p className="text-[9px] text-muted-foreground/25 mt-1">Click here or drag & drop files to add knowledge.</p>
                </button>
              ) : (
                <div className="space-y-1">
                  {brains.map((brain) => (
                    <div
                      key={brain.id}
                      className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all border ${
                        brain.is_active ? "border-violet-500/20 bg-violet-500/5" : "border-transparent bg-foreground/[0.02]"
                      }`}
                    >
                      <FileText className={`h-3.5 w-3.5 shrink-0 ${brain.is_active ? "text-violet-400" : "text-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-light truncate ${brain.is_active ? "text-foreground" : "text-foreground/40"}`}>{brain.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] text-muted-foreground/30">{brain.file_name}</span>
                          <span className="text-[8px] text-muted-foreground/30">{(brain.content.length / 1000).toFixed(1)}k chars</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleBrain(brain)}
                          className="p-1 rounded transition-colors"
                          title={brain.is_active ? "Deactivate" : "Activate"}
                        >
                          {brain.is_active ? <ToggleRight className="h-4 w-4 text-violet-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground/30" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteBrain(brain.id)}
                          className="p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default AxrlenBrainsManager;
