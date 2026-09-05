import { useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
import { validateDisplayName } from "@/lib/auth/blockedNames";

interface AuthOverlayProps {
  isLogin: boolean;
  setIsLogin: (v: boolean) => void;
  onClose: () => void;
}

const AuthOverlay = ({ isLogin, setIsLogin, onClose }: AuthOverlayProps) => {
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  // Advisory only — public.tg_guard_display_name is the authoritative gate.
  const nameCheck = validateDisplayName(name);
  const nameError = !isLogin && nameTouched && nameCheck.ok === false ? nameCheck.reason : null;
  const { toast } = useToast();
  const location = useLocation();

  const getRedirectPath = () => {
    const next = new URLSearchParams(location.search).get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) return next;
    return location.pathname.startsWith("/asher") ? "/asher-dashboard" : "/dashboard";
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isLogin && nameCheck.ok === false) {
      // Surface the reason inline rather than round-tripping to the server for
      // a rejection we can already prove locally.
      setNameTouched(true);
      toast({ title: "Choose a different name", description: nameCheck.reason, variant: "destructive" });
      return;
    }
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        window.location.href = getRedirectPath();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { name: name.trim() },
          // Carry the intended destination (e.g. an OAuth consent URL) through
          // the confirmation link instead of dropping the user on the origin.
          emailRedirectTo: `${window.location.origin}${getRedirectPath()}`,
        },
      });
      setLoading(false);
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        window.location.href = getRedirectPath();
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    // Google matches redirect_uri as an exact registered string. Only the bare
    // origin is registered/allow-listed — appending a protected path such as
    // /dashboard produces `Error 400: redirect_uri_mismatch`. The intended
    // destination is carried in sessionStorage and applied once the session
    // actually exists (AuthContext, on SIGNED_IN / INITIAL_SESSION).
    try {
      sessionStorage.setItem("asherin:post_auth_redirect", getRedirectPath());
    } catch {
      /* private mode — falls back to the default landing behaviour */
    }
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setGoogleLoading(false);
    if (error) {
      toast({ title: "Google sign-in failed", description: String(error), variant: "destructive" });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "A password reset link has been sent." });
      setForgotMode(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border/30 p-8 shadow-2xl overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/wallpapers/auth-king.webp'), url('/wallpapers/auth-king.thumb.webp')",
          backgroundSize: "cover, cover",
          backgroundPosition: "center, center",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/88" aria-hidden="true" />
        <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>

        {forgotMode ? (
          <>
            <h2 className="mb-1 text-2xl font-extralight tracking-wide text-foreground">Reset password</h2>
            <p className="mb-6 text-sm font-extralight text-muted-foreground">Enter your email to receive a reset link</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Email</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-border/40 bg-background/50 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-foreground py-3 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90 disabled:opacity-50">
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-5 text-center text-xs font-extralight text-muted-foreground">
              <button onClick={() => setForgotMode(false)} className="text-foreground underline underline-offset-2 hover:text-foreground/80">Back to login</button>
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-2xl font-extralight tracking-wide text-foreground">
              {isLogin ? "Welcome back" : "Create account"}
            </h2>
            <p className="mb-6 text-sm font-extralight text-muted-foreground">
              {isLogin ? "Log in to your account" : "Sign up to get started"}
            </p>

            <button onClick={handleGoogleSignIn} disabled={googleLoading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/40 bg-background/30 py-3 text-sm font-light text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? "Connecting…" : `Continue with Google`}
            </button>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 border-t border-border/20" />
              <span className="text-xs font-extralight text-muted-foreground/50">or</span>
              <div className="flex-1 border-t border-border/20" />
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div>
                  <label htmlFor="signup-name" className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Name</label>
                  <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    placeholder="Your name"
                    maxLength={50}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? "signup-name-error" : undefined}
                    className={`w-full rounded-xl border bg-background/50 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors ${nameError ? "border-destructive/60 focus:border-destructive" : "border-border/40 focus:border-foreground/30"}`}
                  />
                  {nameError && (
                    <p id="signup-name-error" role="alert" className="mt-1.5 text-xs font-extralight text-destructive">
                      {nameError}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-border/40 bg-background/50 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-border/40 bg-background/50 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-foreground py-3 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90 disabled:opacity-50">
                {loading ? (isLogin ? "Logging in…" : "Signing up…") : (isLogin ? "Log in" : "Sign up")}
              </button>
            </form>

            {isLogin && (
              <p className="mt-4 text-center text-xs font-extralight text-muted-foreground">
                <button onClick={() => setForgotMode(true)} className="text-foreground underline underline-offset-2 hover:text-foreground/80">Forgot password?</button>
              </p>
            )}
            <p className="mt-4 text-center text-xs font-extralight text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-foreground underline underline-offset-2 hover:text-foreground/80">
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          </>
        )}
        </div>
      </div>
    </div>

  );
};

export default AuthOverlay;
