import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import aureonLogo from "@/assets/aureon-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openAuth = (login: boolean) => {
    setIsLogin(login);
    setShowAuth(true);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: Logo + Pages dropdown */}
        <div className="hidden sm:flex items-center gap-2">
          <Link to="/" className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-2.5 flex items-center hover:bg-card/80 transition-colors">
            <span className="text-base sm:text-lg font-extralight tracking-[0.25em] text-foreground">
              AUREON
            </span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2 sm:py-2.5 flex items-center gap-1.5 text-sm font-light tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:bg-card/80 outline-none">
              Pages <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="w-72 bg-card/95 backdrop-blur-xl border-border/30 p-3 rounded-2xl shadow-2xl">
              {/* Intelligence Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Intelligence</p>
              <DropdownMenuItem asChild>
                <Link to="/feature/zophiel" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Zophiel Search</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/nomad" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">NOMAD OSINT</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/asha" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Asha Intelligence</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/predictive" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Predictive Intelligence</Link>
              </DropdownMenuItem>

              <div className="my-2 border-t border-border/15" />

              {/* Agents & Tools Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Agents & Tools</p>
              <DropdownMenuItem asChild>
                <Link to="/feature/personas" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">AI Personas</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/briefings" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Daily Briefings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/elion" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Elion / Zohar Toolkit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/tracker" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Location Tracker</Link>
              </DropdownMenuItem>

              <div className="my-2 border-t border-border/15" />

              {/* Creation Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Creation</p>
              <DropdownMenuItem asChild>
                <Link to="/feature/zali" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">ZALI Design Lab</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/imagine-to-code" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Imagine To Code</Link>
              </DropdownMenuItem>

              <div className="my-2 border-t border-border/15" />

              {/* Company Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Company</p>
              <DropdownMenuItem asChild>
                <Link to="/features" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">All Features</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/founder" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Founder</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/pricing" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Pricing</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/prompt-engineering" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Prompt Engineering</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/benchmarks" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Benchmarks</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/equity" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Equity Ownership</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile: just logo */}
        <Link to="/" className="sm:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2 flex items-center hover:bg-card/80 transition-colors">
          <span className="text-base font-extralight tracking-[0.25em] text-foreground">AUREON</span>
        </Link>

        {/* Right: Auth buttons */}
        <div className="hidden sm:block">
          <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2">
            {!loading && user ? (
              <Link to="/dashboard" className="rounded-lg bg-foreground px-5 py-1.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <button onClick={() => openAuth(true)} className="rounded-lg px-5 py-1.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Log in</button>
                <button onClick={() => openAuth(false)} className="rounded-lg bg-foreground px-5 py-1.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90">Sign up</button>
              </>
            )}
          </div>
        </div>

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5">
          {mobileMenuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
        </button>

        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute right-4 top-full z-50 mt-2 w-64 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-4 shadow-2xl sm:hidden">
              <div className="flex flex-col gap-2">
                <Link to="/features" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">All Features</Link>
                <div className="my-1 border-t border-border/20 mx-4" />
                <Link to="/feature/zophiel" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Zophiel Search</Link>
                <Link to="/feature/nomad" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">NOMAD OSINT</Link>
                <Link to="/feature/asha" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Asha Intelligence</Link>
                <Link to="/feature/briefings" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Daily Briefings</Link>
                <Link to="/feature/personas" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">AI Personas</Link>
                <Link to="/feature/zali" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">ZALI Design Lab</Link>
                <Link to="/feature/predictive" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Predictive Intelligence</Link>
                <Link to="/feature/elion" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Elion / Zohar Toolkit</Link>
                <Link to="/feature/tracker" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Location Tracker</Link>
                <Link to="/feature/imagine-to-code" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Imagine To Code</Link>
                <div className="my-1 border-t border-border/20 mx-4" />
                <Link to="/founder" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Founder</Link>
                <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Pricing</Link>
                <Link to="/prompt-engineering" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Prompt Engineering</Link>
                <Link to="/benchmarks" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Benchmarks</Link>
                <Link to="/equity" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Equity Ownership</Link>
                {!loading && user ? (
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90 text-center">
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <button onClick={() => openAuth(true)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Log in</button>
                    <button onClick={() => openAuth(false)} className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90 text-center">Sign up</button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {showAuth && (
        <AuthOverlay isLogin={isLogin} setIsLogin={setIsLogin} onClose={() => setShowAuth(false)} />
      )}
    </>
  );
};

const AuthOverlay = ({ isLogin, setIsLogin, onClose }: { isLogin: boolean; setIsLogin: (v: boolean) => void; onClose: () => void }) => {
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        window.location.href = "/dashboard";
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name }, emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        // Auto-confirm is enabled, so redirect to dashboard
        window.location.href = "/dashboard";
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
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
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-8 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
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
                  <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-border/40 bg-background/50 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
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
  );
};

export default Header;
