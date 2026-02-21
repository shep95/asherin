import { useState, useEffect } from "react";
import {
  CreditCard, DollarSign, AlertTriangle, TrendingUp, Calendar,
  Zap, RefreshCw, Star, Mail, MailOpen, Clock,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const SubscriptionOracle = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("sub_oracle_read") || "[]")); } catch { return new Set(); }
  });
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("sub_oracle_starred") || "[]")); } catch { return new Set(); }
  });

  const persistRead = (s: Set<string>) => { localStorage.setItem("sub_oracle_read", JSON.stringify([...s])); };
  const persistStarred = (s: Set<string>) => { localStorage.setItem("sub_oracle_starred", JSON.stringify([...s])); };

  const toggleRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistRead(next);
      return next;
    });
  };

  const toggleStar = (id: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistStarred(next);
      return next;
    });
  };

  const markAllRead = () => {
    const all = new Set(emails.map(e => e.id));
    setReadIds(all);
    persistRead(all);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchGoogleData("gmail_inbox", {
        maxResults: 30,
        q: "subject:(subscription OR receipt OR payment OR invoice OR renewal OR billing)",
      });
      setEmails(data.messages || []);
    } catch (err) {
      console.error("Failed to fetch subscription data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = emails.length > 0;
  const unreadCount = emails.filter(e => !readIds.has(e.id)).length;
  const starredCount = emails.filter(e => starredIds.has(e.id)).length;

  const stats = hasLive
    ? [
        { label: "Payment Emails", value: String(emails.length) },
        { label: "Unread", value: String(unreadCount) },
        { label: "Starred", value: String(starredCount) },
        { label: "Sources", value: String(new Set(emails.map(e => {
            const match = e.from?.match(/@([^\s>]+)/);
            return match?.[1] || "";
          }).filter(Boolean)).size) },
      ]
    : [
        { label: "Monthly Cost", value: "—" },
        { label: "Annual Cost", value: "—" },
        { label: "Active Subs", value: "—" },
        { label: "Sources", value: "—" },
      ];

  const formatTimestamp = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <CreditCard className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Subscription Oracle</h2>
              <div className="flex items-center gap-2">
                {hasLive && unreadCount > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-[10px] font-light text-muted-foreground hover:bg-foreground/10 transition-all">
                    <MailOpen className="h-3 w-3" />
                    Mark All Read
                  </button>
                )}
                {isConnected && (
                  <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {isConnected
                ? "Live data connected — scanning your inbox for subscription receipts and payment confirmations."
                : "Connect Google to scan emails for subscriptions, track payments, and find hidden costs."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
            <p className="text-xl font-extralight text-foreground">{loading ? "…" : s.value}</p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Live Payment Emails */}
      {hasLive && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Subscription Emails (Live)
          </h3>
          <div className="space-y-1">
            {emails.map((e) => {
              const isRead = readIds.has(e.id);
              const isStarred = starredIds.has(e.id);
              return (
                <div key={e.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all ${isRead ? "bg-foreground/[0.02]" : "bg-foreground/5"}`}>
                  {/* Star */}
                  <button onClick={() => toggleStar(e.id)} className="shrink-0 p-0.5 hover:scale-110 transition-transform">
                    <Star className={`h-3.5 w-3.5 transition-colors ${isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`} />
                  </button>
                  {/* Read toggle */}
                  <button onClick={() => toggleRead(e.id)} className="shrink-0 p-0.5 hover:scale-110 transition-transform" title={isRead ? "Mark unread" : "Mark read"}>
                    {isRead
                      ? <MailOpen className="h-3.5 w-3.5 text-muted-foreground/30" />
                      : <Mail className="h-3.5 w-3.5 text-accent" />
                    }
                  </button>
                  {/* Subject */}
                  <span className={`text-xs flex-1 truncate ${isRead ? "font-extralight text-muted-foreground/70" : "font-light text-foreground"}`}>
                    {e.subject || "(No Subject)"}
                  </span>
                  {/* Sender */}
                  <span className="text-[10px] text-muted-foreground/50 truncate max-w-[25%] hidden sm:inline">
                    {e.from?.replace(/<.*>/, "").trim()}
                  </span>
                  {/* Timestamp */}
                  <span className="text-[10px] text-muted-foreground/40 shrink-0 flex items-center gap-1 w-16 justify-end" title={e.date ? new Date(e.date).toLocaleString() : ""}>
                    <Clock className="h-2.5 w-2.5" />
                    {formatTimestamp(e.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Data */}
      {!hasLive && isConnected && !loading && (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <CreditCard className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            No subscription or payment emails found in your inbox.
          </p>
        </div>
      )}

      {/* Insights */}
      {hasLive && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" /> Intelligence
          </h3>
          <div className="space-y-1.5">
            {[
              `Found ${emails.length} payment/subscription-related emails`,
              `${new Set(emails.map(e => e.from?.match(/@([^\s>]+)/)?.[1]).filter(Boolean)).size} unique payment sources detected`,
              starredCount > 0 ? `${starredCount} starred for follow-up` : null,
              unreadCount > 0
                ? `${unreadCount} unread payment notifications — review now`
                : "All payment notifications reviewed ✓",
            ].filter(Boolean).map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <Zap className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                <span className="text-[10px] font-extralight text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <CreditCard className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            Connect Google to scan for subscription and payment emails.
          </p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionOracle;
