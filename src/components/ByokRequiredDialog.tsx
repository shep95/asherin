import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const BYOK_REQUIRED_EVENT = "aureon:byok-required";

export function triggerByokRequired(detail?: { source?: string; reason?: string }) {
  try {
    window.dispatchEvent(new CustomEvent(BYOK_REQUIRED_EVENT, { detail: detail || {} }));
  } catch { /* noop */ }
}

export default function ByokRequiredDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const navigate = useNavigate();
  const { subscribed } = useSubscription();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ reason?: string }>;
      // Paid subscribers: skip the dialog and route straight to the AI Keys tab
      // so they can hook up a key without an extra click.
      if (subscribed) {
        try {
          const url = "/dashboard?tab=settings&panel=ai-keys";
          if (!window.location.pathname.startsWith("/dashboard") ||
              !window.location.search.includes("panel=ai-keys")) {
            navigate(url);
          }
        } catch { /* noop */ }
        return;
      }
      setReason(ce.detail?.reason || "");
      setOpen(true);
    };
    window.addEventListener(BYOK_REQUIRED_EVENT, handler);
    return () => window.removeEventListener(BYOK_REQUIRED_EVENT, handler);
  }, [subscribed, navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md border-white/10 bg-zinc-950/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-zinc-300" />
            <DialogTitle className="text-zinc-100">Bring Your Own API Key</DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 pt-2 leading-relaxed">
            The ASHERIN LLM API is being overused right now. To continue without
            interruption, please connect your own API key and select a model in
            <span className="text-zinc-200"> Settings → AI Keys</span>.
            {reason ? <span className="block mt-2 text-xs text-zinc-500">{reason}</span> : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400">
            Dismiss
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              navigate("/dashboard?tab=settings&panel=ai-keys");
            }}
            className="bg-zinc-100 text-zinc-900 hover:bg-white"
          >
            Add API Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
