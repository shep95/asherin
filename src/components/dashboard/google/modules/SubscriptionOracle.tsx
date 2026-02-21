import { useState, useEffect } from "react";
import {
  CreditCard, DollarSign, AlertTriangle, TrendingUp, Calendar,
  Zap, RefreshCw,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const SubscriptionOracle = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchGoogleData("gmail_inbox", {
        maxResults: 20,
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

  const stats = hasLive
    ? [
        { label: "Payment Emails", value: String(emails.length) },
        { label: "Unread", value: String(emails.filter((e) => e.isUnread).length) },
        { label: "This Month", value: String(emails.filter((e) => {
            const d = new Date(e.date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length) },
        { label: "Sources", value: String(new Set(emails.map((e) => {
            const match = e.from?.match(/@([^\s>]+)/);
            return match?.[1] || "";
          }).filter(Boolean)).size) },
      ]
    : [
        { label: "Monthly Cost", value: "—" },
        { label: "Annual Cost", value: "—" },
        { label: "Active Subs", value: "—" },
        { label: "YoY Growth", value: "—" },
      ];

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
              {isConnected && (
                <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  Sync
                </button>
              )}
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
            <Calendar className="h-4 w-4" /> Recent Payment Emails (Live)
          </h3>
          <div className="space-y-1.5">
            {emails.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${e.isUnread ? "bg-accent" : "bg-muted-foreground/30"}`} />
                <span className="text-xs font-light text-foreground flex-1 truncate">{e.subject || "(No Subject)"}</span>
                <span className="text-[10px] text-muted-foreground/50 truncate max-w-[30%]">{e.from?.replace(/<.*>/, "").trim()}</span>
                <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0">
                  {e.date ? new Date(e.date).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                </span>
              </div>
            ))}
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
              `${new Set(emails.map((e) => e.from?.match(/@([^\s>]+)/)?.[1]).filter(Boolean)).size} unique payment sources detected`,
              emails.filter((e) => e.isUnread).length > 0
                ? `${emails.filter((e) => e.isUnread).length} unread payment notifications — review now`
                : "All payment notifications reviewed",
            ].map((p, i) => (
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
