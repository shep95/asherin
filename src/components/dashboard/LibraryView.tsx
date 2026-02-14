import { FileText, Upload, Search, FolderOpen } from "lucide-react";

const LibraryView = () => (
  <div className="flex h-full items-center justify-center p-8">
    <div className="text-center max-w-md space-y-6">
      <div className="mx-auto w-16 h-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm flex items-center justify-center">
        <FolderOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-extralight tracking-wide text-foreground mb-2">Your Library</h2>
        <p className="text-sm font-extralight text-muted-foreground">
          Upload files that persist across all conversations. Build your personal knowledge base.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 text-left">
          <FileText className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-xs font-light text-foreground">Documents</p>
          <p className="text-[10px] text-muted-foreground mt-1">0 files</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 text-left">
          <Upload className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-xs font-light text-foreground">Upload</p>
          <p className="text-[10px] text-muted-foreground mt-1">Drag & drop</p>
        </div>
      </div>
      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-extralight text-muted-foreground/50">Search your library…</span>
      </div>
    </div>
  </div>
);

export default LibraryView;
