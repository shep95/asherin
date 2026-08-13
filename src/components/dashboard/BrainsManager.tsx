import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, Plus, Trash2, Pencil, X, Check, FileText, Upload, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { validateFile, sanitizeDisplayName, MAX_FILE_SIZE_DISPLAY } from "@/lib/file-security";

export interface BrainEntry {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  file_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BrainFile {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
}

interface BrainsManagerProps {
  activeBrainId: string | null;
  onBrainChange: (brainId: string | null) => void;
}

const BrainsManager = ({ activeBrainId, onBrainChange }: BrainsManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brains, setBrains] = useState<BrainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formFiles, setFormFiles] = useState<BrainFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchBrains = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("brains")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setBrains((data as BrainEntry[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBrains(); }, [fetchBrains]);

  // When editing, load brain's files from library
  useEffect(() => {
    if (!editingId) return;
    const brain = brains.find(b => b.id === editingId);
    if (!brain) return;
    setFormName(brain.name);
    setFormDesc(brain.description);
    setFormPrompt(brain.system_prompt);
    // Load associated library files
    if (brain.file_ids.length > 0) {
      supabase.from("library_files").select("id, file_name, file_size, file_type, storage_path")
        .in("id", brain.file_ids)
        .then(({ data }) => setFormFiles((data as BrainFile[] | null) ?? []));
    } else {
      setFormFiles([]);
    }
  }, [editingId, brains]);

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormPrompt("");
    setFormFiles([]);
    setCreating(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!user || !formName.trim()) return;
    const fileIds = formFiles.map(f => f.id);

    if (editingId) {
      await supabase.from("brains").update({
        name: formName.trim(),
        description: formDesc.trim(),
        system_prompt: formPrompt.trim(),
        file_ids: fileIds,
      }).eq("id", editingId);
      toast({ title: "Brain updated" });
    } else {
      await supabase.from("brains").insert({
        user_id: user.id,
        name: formName.trim(),
        description: formDesc.trim(),
        system_prompt: formPrompt.trim(),
        file_ids: fileIds,
      });
      toast({ title: "Brain created" });
    }
    resetForm();
    fetchBrains();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("brains").delete().eq("id", id);
    if (activeBrainId === id) onBrainChange(null);
    setBrains(prev => prev.filter(b => b.id !== id));
    toast({ title: "Brain deleted" });
  };

  const handleFileUpload = async (fileList: FileList) => {
    if (!user) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const validation = await validateFile(file);
      if (!validation.valid) {
        toast({ title: "File rejected", description: `${sanitizeDisplayName(file.name)}: ${validation.error}`, variant: "destructive" });
        continue;
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("library").upload(path, file);
      if (uploadErr) { toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" }); continue; }
      const { data: row } = await supabase.from("library_files").insert({
        user_id: user.id,
        file_name: sanitizeDisplayName(file.name),
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        storage_path: path,
      }).select("id, file_name, file_size, file_type, storage_path").single();
      if (row) setFormFiles(prev => [...prev, row as BrainFile]);
    }
    setUploading(false);
  };

  const removeFileFromForm = (fileId: string) => {
    setFormFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isFormOpen = creating || editingId !== null;

  const activeBrain = brains.find(b => b.id === activeBrainId);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`p-1.5 rounded-md transition-colors ${
          activeBrainId 
            ? "text-violet-400 bg-violet-500/10 hover:bg-violet-500/20" 
            : "text-muted-foreground/50 hover:text-foreground"
        }`}
        title={activeBrain ? `Brain: ${activeBrain.name}` : "Brains"}
      >
        <Brain className="h-4 w-4" />
      </button>

      {/* Panel dropdown */}
      {showPanel && (
        <div className="absolute right-0 top-10 z-50 w-[380px] max-h-[520px] overflow-y-auto rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl animate-fade-in">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) handleFileUpload(e.target.files); e.target.value = ""; }} />

          <div className="p-4 border-b border-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-light text-foreground">Brains</h3>
              </div>
              <div className="flex items-center gap-1">
                {!isFormOpen && (
                  <button onClick={() => setCreating(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => { setShowPanel(false); resetForm(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1">Add prompts & files for asherin to reference.</p>
          </div>

          {/* Form (create/edit) */}
          {isFormOpen && (
            <div className="p-4 space-y-3 border-b border-border/20">
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Brain name…"
                className="w-full bg-transparent border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-violet-500/50"
              />
              <input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Short description (optional)…"
                className="w-full bg-transparent border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-violet-500/50"
              />
              <Textarea
                value={formPrompt}
                onChange={e => setFormPrompt(e.target.value)}
                placeholder="System prompt / instructions for asherin…"
                className="min-h-[100px] bg-transparent border-border/20 text-xs font-light resize-none focus:border-violet-500/50"
              />

              {/* Files */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-light text-muted-foreground">Reference Files</span>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 text-[10px] font-light text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload
                  </button>
                </div>
                {formFiles.length > 0 && (
                  <div className="space-y-1">
                    {formFiles.map(f => (
                      <div key={f.id} className="flex items-center gap-2 rounded-lg bg-foreground/5 px-2 py-1.5">
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-light text-foreground truncate flex-1">{f.file_name}</span>
                        <span className="text-[9px] text-muted-foreground/50">{formatSize(f.file_size)}</span>
                        <button onClick={() => removeFileFromForm(f.id)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-muted-foreground/30">Max {MAX_FILE_SIZE_DISPLAY} per file. Files are stored in your Library.</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!formName.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-500/20 text-violet-300 px-3 py-2 text-xs font-light hover:bg-violet-500/30 transition-colors disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  onClick={resetForm}
                  className="flex items-center gap-1.5 rounded-lg border border-border/20 px-3 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Active brain indicator */}
          {activeBrainId && activeBrain && (
            <div className="px-4 py-2 border-b border-border/20 bg-violet-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-3 w-3 text-violet-400" />
                  <span className="text-[10px] font-light text-violet-300">Active: {activeBrain.name}</span>
                </div>
                <button
                  onClick={() => onBrainChange(null)}
                  className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  Deactivate
                </button>
              </div>
            </div>
          )}

          {/* Brain list */}
          <div className="p-2">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : brains.length === 0 && !isFormOpen ? (
              <div className="text-center py-6">
                <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs font-extralight text-muted-foreground/50">No brains yet</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">Create one to give asherin custom context.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {brains.map(brain => (
                  <div
                    key={brain.id}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                      activeBrainId === brain.id 
                        ? "bg-violet-500/15 border border-violet-500/30" 
                        : "hover:bg-foreground/5 border border-transparent"
                    }`}
                    onClick={() => onBrainChange(activeBrainId === brain.id ? null : brain.id)}
                  >
                    <Brain className={`h-3.5 w-3.5 shrink-0 ${activeBrainId === brain.id ? "text-violet-400" : "text-muted-foreground/50"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-light text-foreground truncate">{brain.name}</p>
                      {brain.description && <p className="text-[10px] text-muted-foreground/50 truncate">{brain.description}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {brain.system_prompt && <span className="text-[9px] text-violet-400/50">Prompt</span>}
                        {brain.file_ids.length > 0 && <span className="text-[9px] text-violet-400/50">{brain.file_ids.length} file{brain.file_ids.length > 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingId(brain.id); }}
                        className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(brain.id); }}
                        className="p-1 rounded text-muted-foreground/50 hover:text-destructive transition-colors"
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
      )}
    </div>
  );
};

export default BrainsManager;
