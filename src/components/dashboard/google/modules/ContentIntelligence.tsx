import { useState, useEffect } from "react";
import {
  FolderOpen, FileText, HardDrive, Clock, Lock,
  ChevronRight, RefreshCw, Camera,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const ContentIntelligence = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [tab, setTab] = useState("documents");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fileData, aboutData] = await Promise.all([
        fetchGoogleData("drive_files", { pageSize: 20 }),
        fetchGoogleData("drive_about").catch(() => null),
      ]);
      setFiles(fileData.files || []);
      setStorageInfo(aboutData);
    } catch (err) {
      console.error("Failed to fetch drive data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = files.length > 0;
  const sharedFiles = files.filter((f) => f.shared);
  const docFiles = files.filter((f) => f.mimeType?.includes("document") || f.mimeType?.includes("spreadsheet") || f.mimeType?.includes("presentation") || f.mimeType?.includes("pdf"));
  const imageFiles = files.filter((f) => f.mimeType?.includes("image") || f.mimeType?.includes("video"));

  const formatSize = (bytes: string | number) => {
    const b = Number(bytes);
    if (!b) return "—";
    if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    return `${(b / 1e3).toFixed(0)} KB`;
  };

  const storageUsed = storageInfo?.storageQuota?.usage ? formatSize(storageInfo.storageQuota.usage) : "—";
  const storageLimit = storageInfo?.storageQuota?.limit ? formatSize(storageInfo.storageQuota.limit) : "—";

  const driveStats = hasLive
    ? [
        { label: "Total Files", value: String(files.length) },
        { label: "Shared", value: String(sharedFiles.length) },
        { label: "Storage Used", value: storageUsed },
        { label: "Storage Limit", value: storageLimit },
      ]
    : [
        { label: "Total Files", value: "—" },
        { label: "Shared", value: "—" },
        { label: "Storage", value: "—" },
        { label: "Public (Risk)", value: "—" },
      ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <FolderOpen className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Content Intelligence</h2>
              {isConnected && (
                <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  Sync
                </button>
              )}
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {isConnected
                ? "Live data connected — analyzing your Drive files, storage, and sharing patterns."
                : "Connect Google to unlock document intelligence and file organization."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {driveStats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-1">
            <span className="text-[10px] font-extralight text-muted-foreground">{s.label}</span>
            <span className="text-lg font-light text-foreground block">{loading ? "…" : s.value}</span>
          </div>
        ))}
      </div>

      {/* Live Files */}
      {hasLive && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" /> Recent Files (Live)
          </h3>
          <div className="space-y-1.5">
            {files.slice(0, 15).map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5 group">
                <FileText className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
                <span className="text-xs font-light text-foreground flex-1 truncate">{f.name}</span>
                {f.shared && <Lock className="h-3 w-3 text-amber-400/50 shrink-0" />}
                <span className="text-[10px] text-muted-foreground/50">
                  {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                </span>
                <span className="text-[10px] text-muted-foreground/30">{formatSize(f.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Type Breakdown */}
      {hasLive && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
            <HardDrive className="h-3.5 w-3.5" /> File Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Documents", count: docFiles.length },
              { label: "Images/Video", count: imageFiles.length },
              { label: "Shared", count: sharedFiles.length },
              { label: "Other", count: files.length - docFiles.length - imageFiles.length },
            ].map((cat) => (
              <div key={cat.label} className="rounded-xl bg-foreground/5 p-3 text-center">
                <span className="text-sm font-light text-foreground">{cat.count}</span>
                <p className="text-[9px] text-muted-foreground">{cat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentIntelligence;
