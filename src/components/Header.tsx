import { useState } from "react";
import { Menu, X } from "lucide-react";

const Header = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openAuth = (login: boolean) => {
    setIsLogin(login);
    setShowLogin(login);
    setShowSignup(!login);
    setMobileMenuOpen(false);
  };

  const closeAuth = () => { setShowLogin(false); setShowSignup(false); };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
      {/* Logo */}
      <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-2.5">
        <span className="text-base sm:text-lg font-extralight tracking-[0.25em] text-foreground">
          ZIALIEL
        </span>
      </div>

      {/* Desktop Auth buttons */}
      <div className="relative hidden sm:block">
        <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2">
          <button
            onClick={() => openAuth(true)}
            className="rounded-lg px-5 py-1.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10"
          >
            Log in
          </button>
          <button
            onClick={() => openAuth(false)}
            className="rounded-lg bg-foreground px-5 py-1.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90"
          >
            Sign up
          </button>
        </div>

        {/* Desktop Popout Auth Form */}
        {(showLogin || showSignup) && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeAuth} />
            <AuthForm isLogin={isLogin} setIsLogin={setIsLogin} />
          </>
        )}
      </div>

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="sm:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5"
      >
        {mobileMenuOpen ? (
          <X className="h-5 w-5 text-foreground" />
        ) : (
          <Menu className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-4 top-full z-50 mt-2 w-64 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-4 shadow-2xl sm:hidden">
            {!(showLogin || showSignup) ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => openAuth(true)}
                  className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left"
                >
                  Log in
                </button>
                <button
                  onClick={() => openAuth(false)}
                  className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90 text-center"
                >
                  Sign up
                </button>
              </div>
            ) : (
              <AuthForm isLogin={isLogin} setIsLogin={setIsLogin} mobile />
            )}
          </div>
        </>
      )}
    </header>
  );
};

const AuthForm = ({ isLogin, setIsLogin, mobile }: { isLogin: boolean; setIsLogin: (v: boolean) => void; mobile?: boolean }) => (
  <div className={mobile ? "" : "absolute right-0 top-full z-50 mt-3 w-80 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-6 shadow-2xl"}>
    <h2 className="mb-1 text-xl font-extralight tracking-wide text-foreground">
      {isLogin ? "Welcome back" : "Create account"}
    </h2>
    <p className="mb-5 text-sm font-extralight text-muted-foreground">
      {isLogin ? "Log in to your account" : "Sign up to get started"}
    </p>
    <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
      {!isLogin && (
        <div>
          <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Name</label>
          <input type="text" placeholder="Your name" className="w-full rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Email</label>
        <input type="email" placeholder="you@example.com" className="w-full rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-light tracking-wide text-muted-foreground">Password</label>
        <input type="password" placeholder="••••••••" className="w-full rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors" />
      </div>
      <button type="submit" className="w-full rounded-lg bg-foreground py-2.5 text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90">
        {isLogin ? "Log in" : "Sign up"}
      </button>
    </form>
    <p className="mt-4 text-center text-xs font-extralight text-muted-foreground">
      {isLogin ? "Don't have an account? " : "Already have an account? "}
      <button onClick={() => setIsLogin(!isLogin)} className="text-foreground underline underline-offset-2 hover:text-foreground/80">
        {isLogin ? "Sign up" : "Log in"}
      </button>
    </p>
  </div>
);

export default Header;
