import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listVerifiedFactors, verifyTotpCode, type VerifiedFactor } from "@/lib/accountAssurance";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Full-screen second-factor gate.
 *
 * Rendered INSTEAD of the dashboard whenever a verified factor exists and the
 * live session is still aal1. There is no "skip" and no timer that quietly
 * lets the operator through: the only exits are a valid code or signing out.
 */
const MfaChallenge = () => {
  const { refreshAssurance, signOut, user } = useAuth();
  const [factors, setFactors] = useState<VerifiedFactor[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    listVerifiedFactors()
      .then((f) => { if (alive) { setFactors(f); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !factors[0]) return;
    setBusy(true);
    setError(null);
    const reason = await verifyTotpCode(factors[0].id, code);
    if (reason) {
      setError(reason);
      setCode("");
      setBusy(false);
      inputRef.current?.focus();
      return;
    }
    await refreshAssurance();
    setBusy(false);
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-card/40 p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-[11px] font-extralight uppercase tracking-[0.22em]">
            second factor
          </span>
        </div>

        <h1 className="mt-4 text-lg font-extralight tracking-wide text-foreground">
          Confirm it's you
        </h1>
        <p className="mt-1 text-sm font-extralight text-muted-foreground">
          {user?.email
            ? `This account requires a second factor before the dashboard opens.`
            : `A second factor is required before the dashboard opens.`}
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> loading factors…
          </div>
        ) : factors.length === 0 ? (
          <p className="mt-6 text-sm font-extralight text-muted-foreground">
            No verified factor could be loaded. Sign out and back in, or contact
            support if this repeats.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Six digit authentication code"
              className="w-full rounded-xl border border-border/40 bg-background/60 px-4 py-3 text-center text-lg font-extralight tracking-[0.4em] text-foreground outline-none focus:border-primary/50"
            />
            {error && (
              <p role="alert" className="text-xs font-extralight text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/40 bg-foreground/5 px-4 py-3 text-sm font-extralight tracking-wide text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify
            </button>
          </form>
        )}

        <button
          onClick={() => { void signOut(); }}
          className="mt-6 w-full text-center text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default MfaChallenge;
