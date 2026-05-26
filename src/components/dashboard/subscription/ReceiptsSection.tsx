import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Receipt {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
}

const formatAmount = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents || 0) / 100);

const formatDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function ReceiptsSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("list-receipts");
      if (invokeErr) throw invokeErr;
      setReceipts((data?.receipts as Receipt[]) ?? []);
    } catch (e: any) {
      setError(e?.message || "Could not load receipts.");
      setReceipts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-light tracking-wide text-muted-foreground/60">
          All receipts from your subscriptions and purchases.
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
          title="Refresh receipts"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground/60">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3 text-[11px] font-light text-destructive/80">
          {error}
        </div>
      ) : receipts.length === 0 ? (
        <div className="rounded-lg border border-border/15 bg-card/5 p-6 text-center">
          <FileText className="h-4 w-4 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-[11px] font-extralight text-muted-foreground/60">
            No receipts yet. They'll appear here after your first payment.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/10 rounded-lg border border-border/15 bg-card/5 overflow-hidden">
          {receipts.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-foreground/[0.02] transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-light text-foreground tracking-wide truncate">
                    {r.number || r.id}
                  </p>
                  {r.status && (
                    <span
                      className={`text-[9px] font-light tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                        r.status === "paid"
                          ? "text-accent bg-accent/10"
                          : "text-muted-foreground/60 bg-foreground/5"
                      }`}
                    >
                      {r.status}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                  {formatDate(r.created)} ·{" "}
                  <span className="text-foreground/80">
                    {formatAmount(r.amount_paid || 0, r.currency)}
                  </span>
                  {r.description ? ` · ${r.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.hosted_invoice_url && (
                  <a
                    href={r.hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-border/15 px-2.5 py-1.5 text-[10px] font-light tracking-wide text-foreground/80 hover:bg-foreground/5 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> View
                  </a>
                )}
                {r.invoice_pdf && (
                  <a
                    href={r.invoice_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-[10px] font-light tracking-wide text-background hover:bg-foreground/90 transition-colors"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
