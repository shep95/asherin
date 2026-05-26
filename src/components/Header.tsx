import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Search, ArrowUpRight } from "lucide-react";
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
          className="hidden sm:flex items-center rounded-xl border border-border/30 bg-card/60 backdrop-blur-md"
          onMouseLeave={() => setPagesOpen(false)}
        >
          <Link to="/" className="px-4 sm:px-6 py-2 sm:py-2.5 flex items-center hover:bg-card/80 transition-colors rounded-l-xl">
            <span className="text-base sm:text-lg font-extralight tracking-[0.25em] text-foreground">
              AUREON
            </span>
          </Link>

          <div className="w-px h-5 bg-border/30" />

          <DropdownMenu open={pagesOpen} onOpenChange={setPagesOpen}>
            <DropdownMenuTrigger
              onMouseEnter={() => setPagesOpen(true)}
              className="px-4 py-2 sm:py-2.5 flex items-center gap-1.5 text-sm font-light tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:bg-card/80 outline-none rounded-r-xl"
            >
              Pages <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              onMouseEnter={() => setPagesOpen(true)}
              onMouseLeave={() => setPagesOpen(false)}
              className="w-72 max-h-[70vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/30 p-3 rounded-2xl shadow-2xl animate-fade-in"
            >
              {/* Intelligence Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Intelligence</p>
              <DropdownMenuItem asChild>
                <Link to="/llm-models" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">LLM Models</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/zophiel" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Zophiel Search</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/nomad" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">NOMAD Public Intelligence</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/asha" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Azplen Intelligence</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/predictive" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Predictive Intelligence</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/oracle-locus" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Oracle Locus</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ww3" className="cursor-pointer text-sm font-light tracking-wide rounded-lg text-destructive">WW3 Trajectory</Link>
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
                <Link to="/feature/zahten" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Zahten Agent Forge</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/vedic-astrology" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Vedic Astrology (Free)</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/notebooks" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Notebooks</Link>
              </DropdownMenuItem>

              <div className="my-2 border-t border-border/15" />

              <div className="my-2 border-t border-border/15" />

              {/* Creation Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Creation</p>
              <DropdownMenuItem asChild>
                <Link to="/whiteboard" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Whiteboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/zali" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">ZANOEM Design Lab</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/imagine-to-code" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Imagine To Code</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/feature/ide" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Aureon IDE</Link>
              </DropdownMenuItem>

              <div className="my-2 border-t border-border/15" />

              {/* Platform Branch */}
              <p className="px-2 pt-1 pb-1.5 text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">Platform</p>
              <DropdownMenuItem asChild>
                <Link to="/feature/byok" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">Bring Your Own AI Key</Link>
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
              <DropdownMenuItem asChild>
                <Link to="/openvpn" className="cursor-pointer text-sm font-light tracking-wide rounded-lg">OpenVPN · Free</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-border/30" />

          <ForumsDropdown />
        </div>

        {/* Mobile: just logo */}
        <Link to="/" className="sm:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-2 flex items-center hover:bg-card/80 transition-colors">
          <span className="text-base font-extralight tracking-[0.25em] text-foreground">AUREON</span>
        </Link>

        {/* Right: Auth buttons */}
        <div className="hidden sm:block" data-header-right>
          <div className="flex items-center rounded-xl border border-border/30 bg-card/60 backdrop-blur-md overflow-hidden">
            {isAsherRoute ? (
              <Link
                to={user ? "/asher-dashboard" : "/asher"}
                onClick={(e) => { if (!user) { e.preventDefault(); openAuth(false); } }}
                className="group flex items-center gap-2 px-5 py-2.5 text-xs font-light tracking-[0.25em] uppercase text-foreground/80 transition-colors hover:text-foreground hover:bg-card/80"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                Go to Asher
              </Link>
            ) : (
              <>
                <Link
                  to="/zophiel"
                  className="group flex items-center gap-2 px-4 py-2.5 text-xs font-light tracking-[0.22em] uppercase text-muted-foreground transition-colors hover:text-foreground hover:bg-card/80"
                >
                  <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Search</span>
                  <span className="hidden md:inline-block ml-1 rounded-sm border border-border/40 px-1 text-[8px] tracking-[0.15em] text-muted-foreground/70">FREE</span>
                </Link>
                <div className="w-px h-5 bg-border/30" />
                {!loading && user ? (
                  <Link
                    to="/dashboard"
                    className="group relative flex items-center gap-2 px-5 py-2.5 text-xs font-light tracking-[0.22em] uppercase text-foreground transition-colors hover:bg-card/80 overflow-hidden"
                  >
                    <span className="relative z-10">Dashboard</span>
                    <ArrowUpRight className="relative z-10 h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" strokeWidth={1.5} />
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  </Link>
                ) : (
                  <>
                    <button onClick={() => openAuth(true)} className="px-4 py-2.5 text-xs font-light tracking-[0.22em] uppercase text-muted-foreground transition-colors hover:text-foreground hover:bg-card/80">Log in</button>
                    <div className="w-px h-5 bg-border/30" />
                    <button onClick={() => openAuth(false)} className="group flex items-center gap-2 bg-foreground px-5 py-2.5 text-xs font-light tracking-[0.22em] uppercase text-background transition-colors hover:bg-foreground/90">
                      Sign up
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>


        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5" aria-label="Toggle navigation menu">
          {mobileMenuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
        </button>

        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute right-4 top-full z-50 mt-2 w-64 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-4 shadow-2xl sm:hidden">
              <div className="flex flex-col gap-2">
                <Link to="/zophiel" onClick={() => setMobileMenuOpen(false)} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-light tracking-wide text-emerald-300 transition-colors hover:bg-emerald-400/20 text-center">Free AI Search</Link>
                <Link to="/features" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">All Features</Link>
                <div className="my-1 border-t border-border/20 mx-4" />
                <Link to="/llm-models" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">LLM Models</Link>
                <Link to="/feature/zophiel" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Zophiel Search</Link>
                <Link to="/feature/nomad" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">NOMAD Public Intelligence</Link>
                <Link to="/feature/asha" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Azplen Intelligence</Link>
                <Link to="/feature/oracle-locus" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Oracle Locus</Link>
                <Link to="/feature/predictive" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Predictive Intelligence</Link>
                <Link to="/feature/briefings" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Daily Briefings</Link>
                <Link to="/feature/vedic" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Vedic Strategy</Link>
                <Link to="/feature/personas" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">AI Personas</Link>
                <Link to="/feature/zahten" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Zahten Agent Forge</Link>
                
                <Link to="/feature/notebooks" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Notebooks</Link>
                <Link to="/feature/zali" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">ZANOEM Design Lab</Link>
                <Link to="/feature/imagine-to-code" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Imagine To Code</Link>
                <Link to="/whiteboard" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Whiteboard</Link>
                <Link to="/feature/ide" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Aureon IDE</Link>
                <Link to="/feature/byok" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/10 text-left">Bring Your Own AI Key</Link>
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
        </div>
      </header>

      {showAuth && (
        <AuthOverlay isLogin={isLogin} setIsLogin={setIsLogin} onClose={() => setShowAuth(false)} />
      )}
    </>
  );
};

export default Header;
