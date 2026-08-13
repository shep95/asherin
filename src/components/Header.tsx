import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, ArrowUpRight } from "lucide-react";
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
                ASHERIN
              </span>
              <span className="hidden md:inline text-[8px] font-mono tracking-[0.2em] text-foreground/40 translate-y-px">
                ◊
              </span>
            </Link>

            <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />

            <Link
              to="/pricing"
              className="px-4 py-2.5 text-[11px] font-light tracking-[0.22em] uppercase text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>


            <span aria-hidden className="h-6 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />

            <div className="relative">
              <ForumsDropdown />
            </div>
          </div>
        </div>

        {/* Mobile: just logo */}
        <Link to="/" className="lg:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2 flex items-center hover:bg-card/80 transition-colors">
          <span className="text-base font-extralight tracking-[0.25em] text-foreground">ASHERIN</span>
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
            <div
              className="absolute right-4 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border/30 p-4 shadow-2xl lg:hidden animate-in slide-in-from-top-2 fade-in duration-200"
              style={{
                backgroundImage:
                  "url('/wallpapers/menu-abyss.webp'), url('/wallpapers/menu-abyss.thumb.webp')",
                backgroundSize: "cover, cover",
                backgroundPosition: "center, center",
              }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-black/85" aria-hidden="true" />
              <div className="relative flex flex-col gap-2">
                {!loading && user ? (
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-foreground px-4 py-3 min-h-[48px] flex items-center justify-center text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90">
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <button onClick={() => openAuth(false)} className="rounded-lg bg-foreground px-4 py-3 min-h-[48px] flex items-center justify-center text-sm font-light tracking-wide text-background transition-colors hover:bg-foreground/90">Sign up</button>
                    <button onClick={() => openAuth(true)} className="rounded-lg border border-foreground/20 px-4 py-3 min-h-[48px] flex items-center justify-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Log in</button>
                  </>
                )}
                <div className="my-1 border-t border-border/20 mx-4" />
                <Link to="/founder" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Founder</Link>
                <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Pricing</Link>
                <Link to="/benchmark" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Benchmark</Link>
                <Link to="/software" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Software</Link>
                <Link to="/whiteboard" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Whiteboard</Link>
                <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Blog</Link>
                <Link to="/updates" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-3 min-h-[48px] flex items-center text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10">Updates</Link>
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
