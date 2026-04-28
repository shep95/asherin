import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Map as MapIcon, FileText, Crosshair, Radio, Satellite,
  BookOpen, Lock, Settings, User, LogOut, ArrowLeft, ShieldAlert,
  Brain, Database, Bookmark,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import IntelligenceMapModule from "@/components/asher/IntelligenceMapModule";
import ComingSoonModule from "@/components/asher/ComingSoonModule";
import AsherCommandCenter from "@/components/asher/AsherCommandCenter";
import AsherAzplenModule from "@/components/asher/AsherAzplenModule";
import AsherSettingsModule from "@/components/asher/AsherSettingsModule";
import AsherAuditVault from "@/components/asher/AsherAuditVault";
import AsherSavedTargets from "@/components/asher/AsherSavedTargets";
import { logAsherEvent } from "@/lib/asherAudit";
import { useAsherAutoLock } from "@/components/asher/useAsherAutoLock";

const ASHER_ACCESS_CODE = "Asher092625";
const ASHER_GATE_KEY = "asher_dashboard_unlocked";

const AsherPasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ASHER_ACCESS_CODE) {
      try { sessionStorage.setItem(ASHER_GATE_KEY, "1"); } catch {}
      logAsherEvent("passcode_success", {});
      onUnlock();
    } else {
      logAsherEvent("passcode_failure", { attempted_length: code.length });
      setError("ACCESS DENIED — Invalid clearance code.");
      setCode("");
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <p className="text-xs font-light tracking-[0.3em] text-muted-foreground/70 uppercase">
              Restricted Access
            </p>
          </div>

          <h1 className="text-2xl font-extralight tracking-[0.2em] text-foreground mb-2">ASHER</h1>
          <p className="text-xs font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-8">
            Defense Intelligence — Clearance Required
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase mb-2">
                Access Code
              </label>
              <input
                type="password"
                autoFocus
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                className="w-full rounded-lg border border-border/30 bg-background/40 px-4 py-3 text-sm font-light tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none transition-colors"
                placeholder="Enter clearance code"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" strokeWidth={1.5} />
                <p className="text-[11px] font-light tracking-wide text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-foreground/90 px-4 py-3 text-xs font-light tracking-[0.2em] text-background hover:bg-foreground transition-colors uppercase"
            >
              Authenticate
            </button>

            <button
              type="button"
              onClick={() => navigate("/asher")}
              className="w-full text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 hover:text-foreground transition-colors uppercase"
            >
              ← Return to Asher
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[9px] font-light tracking-[0.25em] text-muted-foreground/30 uppercase">
          Unauthorized access is monitored and logged
        </p>
      </div>
    </div>
  );
};

type AsherTab =
  | "map" | "command" | "azplen" | "targets" | "theater" | "targeting" | "sigint"
  | "geoint" | "doctrine" | "audit" | "settings" | "profile";

const NAV: { id: AsherTab; label: string; icon: any; sub?: string }[] = [
  { id: "map",       label: "Intelligence Map", icon: MapIcon,    sub: "Primary" },
  { id: "command",   label: "ASHER AI",         icon: Brain,      sub: "Live" },
  { id: "azplen",    label: "Azplen Intel",     icon: Database,   sub: "Live" },
  { id: "targets",   label: "Saved Targets",    icon: Bookmark,   sub: "Live" },
  { id: "theater",   label: "Theater Brief",    icon: FileText },
  { id: "targeting", label: "Targeting Aid",    icon: Crosshair },
  { id: "sigint",    label: "SIGINT Fusion",    icon: Radio },
  { id: "geoint",    label: "GEOINT Layer",     icon: Satellite },
  { id: "doctrine",  label: "Doctrine Recall",  icon: BookOpen },
  { id: "audit",     label: "Audit Vault",      icon: Lock,       sub: "Live" },
];

const AsherDashboard = () => {
  const [active, setActive] = useState<AsherTab>("map");
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(ASHER_GATE_KEY) === "1"; } catch { return false; }
  });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { document.title = "Asher Dashboard — Defense Intelligence"; }, []);

  // Auto-lock after 15 min of inactivity (only when unlocked)
  useAsherAutoLock(() => {
    try { sessionStorage.removeItem(ASHER_GATE_KEY); } catch {}
    setUnlocked(false);
  });

  // Log unlock + tab navigation
  useEffect(() => {
    if (unlocked) logAsherEvent("session_unlocked", {});
  }, [unlocked]);

  useEffect(() => {
    if (unlocked) logAsherEvent("module_open", { module: active });
  }, [active, unlocked]);

  if (!unlocked) {
    return <AsherPasscodeGate onUnlock={() => setUnlocked(true)} />;
  }

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
          {user && (
            <p className="px-3 pt-2 text-[9px] tracking-[0.2em] text-muted-foreground/40 uppercase">
              Operator · Authenticated
            </p>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="relative flex-1 overflow-hidden">
        {active === "map"       && <IntelligenceMapModule />}
        {active === "command"   && <AsherCommandCenter />}
        {active === "azplen"    && <AsherAzplenModule />}
        {active === "theater"   && <ComingSoonModule title="Theater Brief"   sub="Multi-source operational summary" />}
        {active === "targeting" && <ComingSoonModule title="Targeting Aid"   sub="Decision support for target packages" />}
        {active === "sigint"    && <ComingSoonModule title="SIGINT Fusion"   sub="Signal priority + intercept correlation" />}
        {active === "geoint"    && <ComingSoonModule title="GEOINT Layer"    sub="Imagery + geospatial intelligence overlays" />}
        {active === "doctrine"  && <ComingSoonModule title="Doctrine Recall" sub="Searchable doctrine + reference corpus" />}
        {active === "audit"     && <ComingSoonModule title="Audit Vault"     sub="Immutable chain-of-custody logs" />}
        {active === "settings"  && <AsherSettingsModule />}
        {active === "profile"   && <ComingSoonModule title="Profile"         sub="Operator credentials and clearances" />}
      </main>
    </div>
  );
};

export default AsherDashboard;
