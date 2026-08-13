import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  hasPasswordIdentity,
  listVerifiedFactors,
  reauthenticateWithPassword,
  verifyTotpCode,
} from "@/lib/accountAssurance";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * Step-up gate for dangerous actions (password change, account delete, data
 * export, BYOK rotation, key material reset).
 *
 * Contract: `await stepUp("export your data")` resolves true ONLY after the
 * operator proved themselves in this moment — a TOTP code when a factor
 * exists, otherwise the current account password. Cancel resolves false, and
 * the caller must abort. Nothing is cached: every dangerous act asks again.
 */
type StepUpFn = (purpose: string) => Promise<boolean>;

const StepUpContext = createContext<StepUpFn>(async () => false);

export const useStepUp = () => useContext(StepUpContext);

interface Pending {
  purpose: string;
  resolve: (ok: boolean) => void;
}

export const StepUpProvider = ({ children }: { children: ReactNode }) => {
  const { user, refreshAssurance } = useAuth();
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<"totp" | "password" | "unavailable">("password");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openRef = useRef(false);

  const close = useCallback((ok: boolean) => {
    setPending((p) => { p?.resolve(ok); return null; });
    setValue("");
    setError(null);
    setBusy(false);
    openRef.current = false;
  }, []);

  const stepUp = useCallback<StepUpFn>(async (purpose) => {
    if (!user) return false;
    // Serialised on purpose: two overlapping challenges would let the second
    // resolve the first's promise.
    if (openRef.current) return false;
    openRef.current = true;

    const factors = await listVerifiedFactors().catch(() => []);
    if (factors.length > 0) {
      setFactorId(factors[0].id);
      setMode("totp");
    } else if (hasPasswordIdentity(user.identities as { provider: string }[] | undefined)) {
      setFactorId(null);
      setMode("password");
    } else {
      // OAuth-only account with no factor: there is nothing to challenge with.
      // Say so instead of pretending the action was verified.
      setFactorId(null);
      setMode("unavailable");
    }

    return new Promise<boolean>((resolve) => {
      setPending({ purpose, resolve });
    });
  }, [user]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !pending) return;
    setBusy(true);
    setError(null);

    if (mode === "totp" && factorId) {
      const reason = await verifyTotpCode(factorId, value);
      if (reason) { setError(reason); setValue(""); setBusy(false); return; }
      await refreshAssurance();
      close(true);
      return;
    }

    if (mode === "password" && user?.email) {
      const reason = await reauthenticateWithPassword(user.email, value);
      if (reason) { setError(reason); setValue(""); setBusy(false); return; }
      close(true);
      return;
    }

    setError("This account has no way to re-verify. Add an authenticator app first.");
    setBusy(false);
  };

  const ctx = useMemo(() => stepUp, [stepUp]);

  return (
    <StepUpContext.Provider value={ctx}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm your identity"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-card/60 p-7">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-[11px] font-extralight uppercase tracking-[0.22em]">
                confirm identity
              </span>
            </div>
            <h2 className="mt-3 text-base font-extralight tracking-wide text-foreground">
              Verify before you {pending.purpose}
            </h2>

            {mode === "unavailable" ? (
              <>
                <p className="mt-2 text-sm font-extralight text-muted-foreground">
                  This account signs in with a provider and has no authenticator
                  app enrolled, so there is nothing to re-verify against. Add an
                  authenticator app in Security first.
                </p>
                <button
                  onClick={() => close(false)}
                  className="mt-6 w-full rounded-xl border border-border/40 px-4 py-2.5 text-sm font-extralight text-foreground hover:bg-foreground/5"
                >
                  Close
                </button>
              </>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-3">
                <p className="text-sm font-extralight text-muted-foreground">
                  {mode === "totp"
                    ? "Enter the current 6-digit code from your authenticator app."
                    : "Enter your current account password."}
                </p>
                <input
                  autoFocus
                  type={mode === "totp" ? "text" : "password"}
                  inputMode={mode === "totp" ? "numeric" : undefined}
                  autoComplete={mode === "totp" ? "one-time-code" : "current-password"}
                  value={value}
                  onChange={(e) =>
                    setValue(mode === "totp" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)
                  }
                  placeholder={mode === "totp" ? "000000" : "••••••••"}
                  className={`w-full rounded-xl border border-border/40 bg-background/60 px-4 py-2.5 text-sm font-extralight text-foreground outline-none focus:border-primary/50 ${mode === "totp" ? "text-center tracking-[0.4em]" : ""}`}
                />
                {error && <p role="alert" className="text-xs font-extralight text-destructive">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="flex-1 rounded-xl border border-border/40 px-4 py-2.5 text-sm font-extralight text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || value.length === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/40 bg-foreground/5 px-4 py-2.5 text-sm font-extralight text-foreground hover:bg-foreground/10 disabled:opacity-40"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Verify
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </StepUpContext.Provider>
  );
};
