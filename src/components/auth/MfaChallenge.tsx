import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearUnverifiedFactors,
  listVerifiedFactors,
  verifyTotpCode,
  type VerifiedFactor,
} from "@/lib/accountAssurance";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Full-screen second-factor gate.
 *
 * Rendered INSTEAD of the dashboard whenever a factor the operator actually
 * finished verifying exists and the live session is still aal1. For that case
 * there is no skip and no timer: the only exits are a valid code or signing
 * out.
 *
 * If the screen loads and finds nothing verified, the wall was raised over a
 * half-finished enrollment. It sweeps those rows, re-reads assurance, and gets
 * out of the way — an operator who never turned on a second factor is never
 * asked to produce one, and never sent to support.
 */
const MfaChallenge = () => {
  const { refreshAssurance, signOut, user } = useAuth();
  const [factors, setFactors] = useState<VerifiedFactor[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [released, setReleased] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let f = await listVerifiedFactors().catch(() => [] as VerifiedFactor[]);
      if (f.length === 0) {
        // Release path: no verified factor means this wall should not exist.
        await clearUnverifiedFactors();
        f = await listVerifiedFactors().catch(() => [] as VerifiedFactor[]);
        if (f.length === 0) {
          // refreshAssurance flips mfaRequired to false and ProtectedRoute
          // renders the dashboard on the next paint.
          await refreshAssurance();
          if (alive) setReleased(true);
          return;
        }
      }
      if (alive) { setFactors(f); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [refreshAssurance]);

  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !codeFactor) return;
    setBusy(true);
    setError(null);
    const reason = await verifyTotpCode(codeFactor.id, code);
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

  // A passkey cannot be typed into a six-digit box. Only totp/phone factors
  // drive the code form; a passkey-only account is told the truth instead of
  // being shown a field that can never succeed.
  const codeFactor = factors.find((f) => f.type === "totp" || f.type === "phone") ?? null;

  if (released) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background">
        <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">
          ASHERIN
        </div>
      </div>
    );
  }

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
            ? `You turned on a second factor for ${user.email}. Enter the current code to open the dashboard.`
            : `You turned on a second factor. Enter the current code to open the dashboard.`}
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> loading factors…
          </div>
        ) : !codeFactor ? (
          <p className="mt-6 text-sm font-extralight text-muted-foreground">
            The only factor on this account is a passkey. Sign in again from the
            device that holds it.
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
