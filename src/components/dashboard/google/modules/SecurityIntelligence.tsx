import { useState, useEffect } from "react";
import {
  Lock, AlertTriangle, Mail, Share2, Globe, Shield,
  CheckCircle2, XCircle, ChevronRight, RefreshCw, FileText,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const SecurityIntelligence = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [securityEmails, setSecurityEmails] = useState<any[]>([]);
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emailData, fileData] = await Promise.all([
        fetchGoogleData("gmail_inbox", {
          maxResults: 15,
          q: "subject:(security alert OR password OR breach OR suspicious OR verification OR unauthorized) OR from:(security OR noreply)",
        }),
        fetchGoogleData("drive_files", { pageSize: 20 }),
      ]);
      setSecurityEmails(emailData.messages || []);
      setSharedFiles((fileData.files || []).filter((f: any) => f.shared));
    } catch (err) {
      console.error("Failed to fetch security data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = securityEmails.length > 0 || sharedFiles.length > 0;
  const unreadSecurity = securityEmails.filter((e) => e.isUnread).length;

  return (
    <div className="space-y-6">
      {/* Security Score */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
          <Shield className="h-7 w-7 text-foreground/70" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-light tracking-wide text-foreground">Security Intelligence</h3>
            {isConnected && (
              <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Sync
              </button>
            )}
          </div>
          {hasLive && (
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {unreadSecurity > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400">{unreadSecurity} unread alerts</span>
                )}
                {sharedFiles.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400">{sharedFiles.length} shared files</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Alerts from Email */}
      {securityEmails.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Security-Related Emails (Live)
          </h3>
          <div className="space-y-2">
            {securityEmails.map((e) => (
              <div key={e.id} className="flex items-start gap-2 py-1.5 rounded-lg bg-foreground/5 px-3">
                {e.isUnread ? (
                  <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-foreground/30 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-light text-foreground truncate block">{e.subject || "(No Subject)"}</span>
                  <span className="text-[10px] text-muted-foreground/50">{e.from?.replace(/<.*>/, "").trim()}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 shrink-0">
                  {e.date ? new Date(e.date).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Files Audit */}
      {sharedFiles.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Shared Files Audit (Live)
          </h3>
          <p className="text-[10px] font-extralight text-muted-foreground">
            {sharedFiles.length} files are currently shared — review for potential security risks
          </p>
          <div className="space-y-1.5">
            {sharedFiles.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <span className="text-xs font-light text-foreground truncate">{f.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">Shared</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasLive && isConnected && !loading && (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <Shield className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            No security alerts or shared files detected — your accounts look clean.
          </p>
        </div>
      )}
      {!isConnected && (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <Shield className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            Connect Google to scan for security alerts, shared files, and breach notifications.
          </p>
        </div>
      )}
    </div>
  );
};

export default SecurityIntelligence;
