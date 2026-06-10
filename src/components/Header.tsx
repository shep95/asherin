import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Search, ArrowUpRight, Target } from "lucide-react";
import aureonLogo from "@/assets/aureon-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminEmail";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import AuthOverlay from "@/components/AuthOverlay";
import ForumsDropdown from "@/components/forums/ForumsDropdown";

const Header = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAsherRoute = location.pathname.startsWith("/asher");
  const [showAuth, setShowAuth] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openAuth = (login: boolean) => {
    setIsLogin(login);
    setShowAuth(true);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 py-3 sm:py-4">
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + Pages dropdown */}
        <div
          className="hidden lg:flex items-center relative group/nav"
          onMouseLeave={() => setPagesOpen(false)}
        >
          {/* Aurora glow behind the cluster */}
          <div aria-hidden className="pointer-events-none absolute -inset-x-6 -inset-y-3 opacity-60 blur-2xl transition-opacity duration-700 group-hover/nav:opacity-100"
               style={{ background: "radial-gradient(60% 100% at 20% 50%, hsl(0 0% 100% / 0.08), transparent 70%)" }} />

          <div className="relative flex items-center rounded-full border border-foreground/15 bg-background/40 backdrop-blur-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-hidden">
            {/* Golden top hairline */}
            <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />

            <Link
              to="/"
              className="group/logo relative flex items-center gap-2.5 pl-5 pr-4 py-2.5 transition-all"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-foreground/80 shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-transform group-hover/logo:scale-125" />
              <span className="text-sm font-extralight tracking-[0.32em] text-foreground/95">
                AUREON
              </span>
              <span className="hidden md:inline text-[8px] font-mono tracking-[0.2em] text-foreground/40 translate-y-px">
                ◊
              </span>
            </Link>

            <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />

            <DropdownMenu open={pagesOpen} onOpenChange={setPagesOpen}>
              <DropdownMenuTrigger
                onMouseEnter={() => setPagesOpen(true)}
                className="group/btn relative px-4 py-2.5 flex items-center gap-1.5 text-[11px] font-light tracking-[0.22em] uppercase text-muted-foreground transition-all hover:text-foreground outline-none"
              >
                <span className="font-mono text-[8px] tracking-[0.15em] text-foreground/40">01</span>
                Pages
                <ChevronDown className="h-3 w-3 transition-transform" strokeWidth={1.5} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={12}
                onMouseEnter={() => setPagesOpen(true)}
                onMouseLeave={() => setPagesOpen(false)}
                className="w-72 max-h-[70vh] overflow-y-auto bg-background/80 backdrop-blur-2xl border border-foreground/15 p-3 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] animate-fade-in"
              >
                <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-foreground/50 uppercase">◈ Company</p>
                <DropdownMenuItem asChild>
                  <Link to="/founder" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Founder</Link>
                </DropdownMenuItem>
                {isAdminEmail(user?.email) && (
                  <>
                    <div className="my-2 border-t border-foreground/10" />
                    <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-foreground/50 uppercase">◈ Admin</p>
                    <DropdownMenuItem asChild>
                      <Link to="/analytics" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Analytics</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />

            <div className="relative">
              <ForumsDropdown />
            </div>
          </div>
        </div>

        {/* Mobile: just logo */}
        <Link to="/" className="lg:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2 flex items-center hover:bg-card/80 transition-colors">
          <span className="text-base font-extralight tracking-[0.25em] text-foreground">AUREON</span>
        </Link>

        {/* Right: Auth buttons */}
        <div className="hidden lg:block relative" data-header-right>
          <div aria-hidden className="pointer-events-none absolute -inset-x-6 -inset-y-3 opacity-60 blur-2xl"
               style={{ background: "radial-gradient(60% 100% at 80% 50%, hsl(0 0% 100% / 0.08), transparent 70%)" }} />
          <div className="relative flex items-center rounded-full border border-foreground/15 bg-background/40 backdrop-blur-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-hidden">
            <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />
            {isAsherRoute ? (
              <Link
                to={user ? "/asher-dashboard" : "/asher"}
                onClick={(e) => { if (!user) { e.preventDefault(); openAuth(false); } }}
                className="group flex items-center gap-2 px-5 py-2.5 text-[11px] font-light tracking-[0.25em] uppercase text-foreground/80 transition-colors hover:text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                Go to Asher
              </Link>
            ) : (
              <>
                <Link
                  to="/zophiel"
                  className="group flex items-center gap-2 px-4 py-2.5 text-[11px] font-light tracking-[0.22em] uppercase text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Zophiel</span>
                  <span className="hidden md:inline-block ml-1 rounded-sm border border-foreground/30 bg-foreground/5 px-1 text-[8px] tracking-[0.15em] text-foreground/70">FREE SOFTWARE</span>
                </Link>
                <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />
                <Link
                  to="/axrlen"
                  className="group flex items-center gap-2 px-4 py-2.5 text-[11px] font-light tracking-[0.22em] uppercase text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Target className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Axrlen</span>
                  <span className="hidden md:inline-block ml-1 rounded-sm border border-amber-300/40 bg-amber-300/10 px-1 text-[8px] tracking-[0.15em] text-amber-200/90">FREE · BYOK · BETA · PREDICTION AI MODEL</span>
                </Link>
                <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />

                {!loading && user ? (
                  <Link
                    to="/dashboard"
                    className="group relative flex items-center gap-2 px-5 py-2.5 text-[11px] font-light tracking-[0.22em] uppercase text-foreground transition-colors overflow-hidden"
                  >
                    <span className="font-mono text-[8px] tracking-[0.15em] text-foreground/40 relative z-10">02</span>
                    <span className="relative z-10">Dashboard</span>
                    <ArrowUpRight className="relative z-10 h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" strokeWidth={1.5} />
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  </Link>
                ) : (
                  <>
                    <button onClick={() => openAuth(true)} className="px-4 py-2.5 text-[11px] font-light tracking-[0.22em] uppercase text-muted-foreground transition-colors hover:text-foreground">Log in</button>
                    <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />
                    <button onClick={() => openAuth(false)} className="group relative flex items-center gap-2 px-5 py-2.5 text-[11px] font-light tracking-[0.22em] uppercase text-background overflow-hidden">
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground to-foreground" />
                      <span className="relative z-10">Sign up</span>
                      <ArrowUpRight className="relative z-10 h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>


        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5" aria-label="Toggle navigation menu">
          {mobileMenuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
        </button>

        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute right-4 top-full z-50 mt-2 w-64 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-4 shadow-2xl lg:hidden">
              <div className="flex flex-col gap-2">
                <Link to="/founder" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Founder</Link>
                <div className="my-1 border-t border-border/20 mx-4" />
                <Link to="/zophiel" onClick={() => setMobileMenuOpen(false)} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-light tracking-wide text-emerald-300 transition-colors hover:bg-emerald-400/20 text-center">Free AI Search</Link>
                <Link to="/axrlen" onClick={() => setMobileMenuOpen(false)} className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-light tracking-wide text-amber-200 transition-colors hover:bg-amber-300/20 text-center">AXRLEN · Free · BYOK · Beta · Prediction AI Model</Link>
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
        </div>
      </header>

      {showAuth && (
        <AuthOverlay isLogin={isLogin} setIsLogin={setIsLogin} onClose={() => setShowAuth(false)} />
      )}
    </>
  );
};

export default Header;
