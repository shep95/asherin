import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Map as MapIcon, FileText, Crosshair, Radio, Satellite,
  BookOpen, Lock, Settings, User, LogOut, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import IntelligenceMapModule from "@/components/asher/IntelligenceMapModule";
import ComingSoonModule from "@/components/asher/ComingSoonModule";

type AsherTab =
  | "map" | "theater" | "targeting" | "sigint"
  | "geoint" | "doctrine" | "audit" | "settings" | "profile";

const NAV: { id: AsherTab; label: string; icon: any; sub?: string }[] = [
  { id: "map",       label: "Intelligence Map", icon: MapIcon,    sub: "Primary" },
  { id: "theater",   label: "Theater Brief",    icon: FileText },
  { id: "targeting", label: "Targeting Aid",    icon: Crosshair },
  { id: "sigint",    label: "SIGINT Fusion",    icon: Radio },
  { id: "geoint",    label: "GEOINT Layer",     icon: Satellite },
  { id: "doctrine",  label: "Doctrine Recall",  icon: BookOpen },
  { id: "audit",     label: "Audit Vault",      icon: Lock },
];

const AsherDashboard = () => {
  const [active, setActive] = useState<AsherTab>("map");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { document.title = "Asher Dashboard — Defense Intelligence"; }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/asher");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* SIDEBAR */}
      <aside className="flex h-full w-64 flex-col border-r border-border/20 bg-sidebar/80 backdrop-blur-xl">
        <div className="px-5 pt-5 pb-4 border-b border-border/15">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <p className="text-base font-extralight tracking-[0.3em] text-foreground">ASHER</p>
          </div>
          <p className="mt-1 text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase">Defense</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map((n) => {
            const isActive = active === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => setActive(n.id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                <span className="flex-1 text-sm font-light tracking-wide">{n.label}</span>
                {n.sub && <span className="text-[8px] font-light tracking-[0.2em] text-red-400/70 uppercase">{n.sub}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border/15 px-3 py-3 space-y-0.5">
          <button onClick={() => setActive("settings")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-light tracking-wide text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <Settings className="h-4 w-4" strokeWidth={1.5} /> Settings
          </button>
          <button onClick={() => setActive("profile")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-light tracking-wide text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <User className="h-4 w-4" strokeWidth={1.5} /> Profile
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-light tracking-wide text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" strokeWidth={1.5} /> Logout
          </button>
          <button onClick={() => navigate("/asher")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-light tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors uppercase">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Asher
          </button>
          {user && <p className="px-3 pt-2 text-[9px] tracking-wide text-muted-foreground/40 truncate">{user.email}</p>}
        </div>
      </aside>

      {/* MAIN */}
      <main className="relative flex-1 overflow-hidden">
        {active === "map"       && <IntelligenceMapModule />}
        {active === "theater"   && <ComingSoonModule title="Theater Brief"   sub="Multi-source operational summary" />}
        {active === "targeting" && <ComingSoonModule title="Targeting Aid"   sub="Decision support for target packages" />}
        {active === "sigint"    && <ComingSoonModule title="SIGINT Fusion"   sub="Signal priority + intercept correlation" />}
        {active === "geoint"    && <ComingSoonModule title="GEOINT Layer"    sub="Imagery + geospatial intelligence overlays" />}
        {active === "doctrine"  && <ComingSoonModule title="Doctrine Recall" sub="Searchable doctrine + reference corpus" />}
        {active === "audit"     && <ComingSoonModule title="Audit Vault"     sub="Immutable chain-of-custody logs" />}
        {active === "settings"  && <ComingSoonModule title="Settings"        sub="Operator preferences and runtime config" />}
        {active === "profile"   && <ComingSoonModule title="Profile"         sub="Operator credentials and clearances" />}
      </main>
    </div>
  );
};

export default AsherDashboard;
