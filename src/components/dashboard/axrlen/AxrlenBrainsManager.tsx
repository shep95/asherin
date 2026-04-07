import { useState, useEffect, useRef } from "react";
import { Brain, Plus, Trash2, Upload, Loader2, X, Check, ToggleLeft, ToggleRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AxrlenBrain {
  id: string;
  name: string;
  description: string;
  content: string;
  file_name: string;
  is_active: boolean;
  created_at: string;
}

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

const AxrlenBrainsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brains, setBrains] = useState<AxrlenBrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!showPanel) return;
    loadBrains();
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

  const handleFileUpload = async (fileList: FileList) => {
    if (!isAdmin) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
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
        if (row) setBrains(prev => [row as AxrlenBrain, ...prev]);
        toast({ title: `Brain "${name}" added` });
      } catch (err: any) {
        toast({ title: "Read failed", description: err.message, variant: "destructive" });
      }
    }
    setUploading(false);
  };

  const toggleBrain = async (brain: AxrlenBrain) => {
    if (!isAdmin) return;
    const newActive = !brain.is_active;
    await supabase.from("axrlen_brains").update({ is_active: newActive }).eq("id", brain.id);
    setBrains(prev => prev.map(b => b.id === brain.id ? { ...b, is_active: newActive } : b));
  };

  const deleteBrain = async (id: string) => {
    if (!isAdmin) return;
    await supabase.from("axrlen_brains").delete().eq("id", id);
    setBrains(prev => prev.filter(b => b.id !== id));
    toast({ title: "Brain deleted" });
  };

  if (!isAdmin) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
          showPanel
            ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
            : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
        }`}
      >
        <Brain className="h-3 w-3" /> Brains
      </button>

      {showPanel && (
        <div className="absolute right-0 top-10 z-50 w-[420px] max-h-[520px] overflow-y-auto rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl animate-fade-in">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv"
            className="hidden"
            onChange={e => {
              if (e.target.files) handleFileUpload(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Header */}
          <div className="p-4 border-b border-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-light text-foreground">AXRLEN Brains</h3>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 uppercase tracking-wider">Admin</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-violet-400 hover:bg-violet-500/10 transition-colors"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </button>
                <button onClick={() => setShowPanel(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/40 mt-1">Upload .txt/.md knowledge files. Active brains are injected into all AXRLEN sessions for all users.</p>
          </div>

          {/* Brain list */}
          <div className="p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : brains.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/40">No brains uploaded yet</p>
                <p className="text-[9px] text-muted-foreground/25 mt-1">Upload text files to give AXRLEN deep knowledge.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {brains.map(brain => (
                  <div key={brain.id} className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all border ${
                    brain.is_active ? "border-violet-500/20 bg-violet-500/5" : "border-transparent bg-foreground/[0.02]"
                  }`}>
                    <FileText className={`h-3.5 w-3.5 shrink-0 ${brain.is_active ? "text-violet-400" : "text-muted-foreground/30"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-light truncate ${brain.is_active ? "text-foreground" : "text-foreground/40"}`}>{brain.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-muted-foreground/30">{brain.file_name}</span>
                        <span className="text-[8px] text-muted-foreground/30">{(brain.content.length / 1000).toFixed(1)}k chars</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleBrain(brain)} className="p-1 rounded transition-colors" title={brain.is_active ? "Deactivate" : "Activate"}>
                        {brain.is_active
                          ? <ToggleRight className="h-4 w-4 text-violet-400" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground/30" />
                        }
                      </button>
                      <button
                        onClick={() => deleteBrain(brain.id)}
                        className="p-1 rounded text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
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

export default AxrlenBrainsManager;
