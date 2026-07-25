import { useState, useCallback, useRef } from "react";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "./ZeeionView";

interface Props {
  onAnalysisComplete: (result: AnalysisResult) => void;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".pdf", ".json", ".xml"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ZeeionUpload = ({ onAnalysisComplete }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState("USD");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const validateFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast({ title: "Unsupported file type", description: `Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`, variant: "destructive" });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 50MB", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) setSelectedFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) setSelectedFile(file);
  };

  const processFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(10);
    setProgressLabel("Reading file data...");

    try {
      const reader = new FileReader();
      const fileContent = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        if (selectedFile.name.endsWith(".csv") || selectedFile.name.endsWith(".json") || selectedFile.name.endsWith(".xml")) {
          reader.readAsText(selectedFile);
        } else {
          reader.readAsDataURL(selectedFile);
        }
      });

      setProgress(20);
      setProgressLabel("ASHA extracting structured data...");

      await new Promise(r => setTimeout(r, 400));
      setProgress(35);
      setProgressLabel("ASHERIN analyzing financial patterns...");

      const { data, error } = await supabase.functions.invoke("zeeion-analyze", {
        body: {
          fileName: selectedFile.name,
          fileType: selectedFile.name.split(".").pop()?.toLowerCase(),
          fileContent: fileContent.substring(0, 100000),
          currency,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProgress(80);
      setProgressLabel("Generating insights...");

      await new Promise(r => setTimeout(r, 800));
      setProgress(100);
      setProgressLabel("Analysis complete");

      const result: AnalysisResult = {
        id: crypto.randomUUID(),
        fileName: selectedFile.name,
        uploadedAt: new Date(),
        status: "complete",
        ...data,
      };

      onAnalysisComplete(result);
      setSelectedFile(null);
      toast({ title: "Analysis complete", description: `${selectedFile.name} processed successfully.` });
    } catch (err: any) {
      console.error("Zeeion analysis error:", err);
      toast({ title: "Analysis failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-foreground/30 bg-foreground/[0.06]"
            : "border-border/[0.12] bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-border/[0.18]"
        }`}
      >
        <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPTED_EXTENSIONS.join(",")} onChange={handleFileSelect} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Upload className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-light text-foreground/70">Upload Financial Data</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">Drag & drop or click to browse</p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {["Excel", "CSV", "PDF", "JSON", "XML"].map(fmt => (
              <span key={fmt} className="px-2 py-0.5 rounded-md bg-foreground/[0.04] border border-border/[0.06] text-[8px] text-muted-foreground/40 tracking-wider uppercase">
                {fmt}
              </span>
            ))}
          </div>
          <p className="text-[8px] text-muted-foreground/30 mt-1">Max 50MB -- ASHA extracts structured data from any format</p>
        </div>
      </div>

      {/* Selected File */}
      {selectedFile && !uploading && (
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground/50" />
              <div>
                <p className="text-xs font-light text-foreground/70">{selectedFile.name}</p>
                <p className="text-[9px] text-muted-foreground/40">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={() => setSelectedFile(null)} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          </div>

          <div>
            <label className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-1 block">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-foreground/[0.04] border border-border/[0.08] rounded-xl px-3 py-2 text-[11px] text-foreground/70 focus:outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (&euro;)</option>
              <option value="GBP">GBP (&pound;)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
            </select>
          </div>

          <p className="text-[8px] text-muted-foreground/30">ASHA extracts structured data from any file type, then ASHERIN runs full financial analysis</p>

          <button
            onClick={processFile}
            className="w-full py-2.5 rounded-xl bg-foreground/[0.08] border border-border/[0.1] text-[11px] text-foreground/70 font-light tracking-wide hover:bg-foreground/[0.12] transition-all"
          >
            Analyze Financial Data
          </button>
        </div>
      )}

      {/* Processing */}
      {uploading && (
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-foreground/50 animate-spin" />
            <p className="text-xs font-light text-foreground/70">{progressLabel}</p>
          </div>
          <div className="w-full h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-foreground/20 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[9px] text-muted-foreground/30 text-center">ASHA + ASHERIN pipeline: extract → structure → analyze → report</p>
        </div>
      )}
    </div>
  );
};

export default ZeeionUpload;
