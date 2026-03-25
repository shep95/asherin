import { useState, useCallback, useRef } from "react";
import { Upload, FileText, Image, X, Paperclip } from "lucide-react";

interface NomadFileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf", "text/plain", "text/csv",
  "application/json", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const NomadFileUpload = ({ onFilesSelected, disabled }: NomadFileUploadProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => ACCEPTED_TYPES.includes(f.type)).slice(0, 3);
    if (dropped.length > 0) {
      setFiles(dropped);
      onFilesSelected(dropped);
    }
  }, [onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 3);
    if (selected.length > 0) {
      setFiles(selected);
      onFilesSelected(selected);
    }
  }, [onFilesSelected]);

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    onFilesSelected(updated);
  };

  const getIcon = (type: string) => {
    if (type.startsWith("image/")) return Image;
    return FileText;
  };

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`transition-colors ${dragOver ? "border-accent/50 bg-accent/5" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-xl p-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-30"
          title="Attach files (images, PDFs, documents)"
        >
          <Paperclip className="h-4 w-4" />
        </button>
      </div>

      {files.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {files.map((f, i) => {
            const Icon = getIcon(f.type);
            return (
              <div key={i} className="flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/20 px-2 py-1 text-[9px] font-extralight text-accent">
                <Icon className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="hover:text-destructive transition-colors">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NomadFileUpload;
