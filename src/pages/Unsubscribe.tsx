import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    document.title = "Unsubscribe — Aureon AI";
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (res.ok && data.valid) setState({ kind: "ready" });
        else if (data.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid" });
      } catch {
        setState({ kind: "error", message: "Could not validate this link." });
      }
    })();
  }, [token]);

  async function confirm() {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (res.ok && (data.success || data.reason === "already_unsubscribed")) {
        setState({ kind: "done" });
      } else {
        setState({ kind: "error", message: data.error ?? "Something went wrong." });
      }
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-xs tracking-[0.3em] text-muted-foreground mb-6">AUREON</p>
        {state.kind === "loading" && <p className="text-muted-foreground">Validating…</p>}

        {state.kind === "ready" && (
          <>
            <h1 className="text-2xl font-semibold mb-3">Unsubscribe from emails</h1>
            <p className="text-muted-foreground mb-8">
              You'll stop receiving non-essential emails from Aureon AI. Account
              security emails will still be sent.
            </p>
            <button
              onClick={confirm}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
            >
              Confirm Unsubscribe
            </button>
          </>
        )}

        {state.kind === "submitting" && <p className="text-muted-foreground">Processing…</p>}

        {state.kind === "done" && (
          <>
            <h1 className="text-2xl font-semibold mb-3">You're unsubscribed.</h1>
            <p className="text-muted-foreground">We won't email you again about this.</p>
          </>
        )}

        {state.kind === "already" && (
          <>
            <h1 className="text-2xl font-semibold mb-3">Already unsubscribed.</h1>
            <p className="text-muted-foreground">No further action needed.</p>
          </>
        )}

        {state.kind === "invalid" && (
          <>
            <h1 className="text-2xl font-semibold mb-3">Invalid link</h1>
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="text-2xl font-semibold mb-3">Something went wrong</h1>
            <p className="text-muted-foreground">{state.message}</p>
          </>
        )}
      </div>
    </main>
  );
}
