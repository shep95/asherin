import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Map as MapIcon, FileText, Crosshair, Radio, Satellite,
  BookOpen, Lock, Settings, User, LogOut, ArrowLeft, ShieldAlert,
  Brain, Database, Bookmark, Search, ChevronDown, ChevronRight, MessageSquare,
  Building2, Wrench, PenSquare, Activity, NotebookPen, Code2, Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import IntelligenceMapModule from "@/components/asher/IntelligenceMapModule";
import ComingSoonModule from "@/components/asher/ComingSoonModule";
import AsherCommandCenter from "@/components/asher/AsherCommandCenter";
import AsherAzplenModule from "@/components/asher/AsherAzplenModule";
import AsherZaliModule from "@/components/asher/AsherZaliModule";
import AsherWhiteboardModule from "@/components/asher/AsherWhiteboardModule";
import AsherAxrlenModule from "@/components/asher/AsherAxrlenModule";
import AsherNotebooksModule from "@/components/asher/AsherNotebooksModule";
import AsherSettingsModule from "@/components/asher/AsherSettingsModule";
import AsherAuditVault from "@/components/asher/AsherAuditVault";
import AsherSavedTargets from "@/components/asher/AsherSavedTargets";
import AsherZophielModule from "@/components/asher/AsherZophielModule";
import AsherCommsModule from "@/components/asher/AsherCommsModule";
import AsherOrganizationsModule from "@/components/asher/AsherOrganizationsModule";
import AsherInvitationsBanner from "@/components/asher/AsherInvitationsBanner";
import AsherCodeModule from "@/components/asher/AsherCodeModule";
import AsherPublishedTabRenderer from "@/components/asher/AsherPublishedTabRenderer";
import { isSuperOwner } from "@/lib/asherOrgs";

import AsherProfile from "@/components/asher/AsherProfile";
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
  | "map" | "command" | "zophiel" | "azplen" | "zali" | "whiteboard" | "axrlen" | "notebooks" | "targets" | "comms"
  | "theater" | "targeting" | "sigint" | "geoint" | "doctrine"
  | "audit" | "settings" | "profile" | "orgs" | "code"
  | string; // allow dynamic published-tab ids: `pub:<uuid>`

interface NavItem { id: AsherTab; label: string; icon: any; sub?: string }
interface NavBranch { id: string; label: string; items: NavItem[] }

const buildBranches = (superOwner: boolean): NavBranch[] => [
  ...(superOwner ? [{ id: "governance", label: "Organizations", items: [
    { id: "orgs" as AsherTab, label: "Org Management", icon: Building2, sub: "God-Mode" },
  ]}] : []),
  { id: "ops", label: "Operations", items: [
    { id: "map",     label: "Intelligence Map", icon: MapIcon,  sub: "Primary" },
    { id: "targets", label: "Saved Targets",    icon: Bookmark, sub: "Live" },
  ]},
  { id: "ai", label: "AI & Reasoning", items: [
    { id: "command", label: "ASHER AI",       icon: Brain,    sub: "Live" },
    { id: "zophiel", label: "Zophiel Engine", icon: Search,   sub: "Live" },
    { id: "axrlen",  label: "AXRLEN Predict", icon: Activity, sub: "Live" },
  ]},
  { id: "intel", label: "Intelligence", items: [
    { id: "azplen",    label: "Azplen Intel",    icon: Database, sub: "Live" },
    { id: "zali",      label: "ZALI Design",     icon: Wrench,   sub: "Live" },
    { id: "whiteboard",label: "Whiteboard",      icon: PenSquare, sub: "Live" },
    { id: "notebooks", label: "Notebooks",       icon: NotebookPen, sub: "Live" },
    { id: "theater",   label: "Theater Brief",   icon: FileText },
    { id: "targeting", label: "Targeting Aid",   icon: Crosshair },
    { id: "sigint",    label: "SIGINT Fusion",   icon: Radio },
    { id: "geoint",    label: "GEOINT Layer",    icon: Satellite },
    { id: "doctrine",  label: "Doctrine Recall", icon: BookOpen },
  ]},
  { id: "comms", label: "Secure Comms", items: [
    { id: "comms", label: "Operator Comms", icon: MessageSquare, sub: "E2EE" },
  ]},
  { id: "vault", label: "Vault & System", items: [
    { id: "audit",    label: "Audit Vault", icon: Lock,     sub: "Live" },
    { id: "profile",  label: "Profile",     icon: User,     sub: "Live" },
    { id: "settings", label: "Settings",    icon: Settings },
  ]},
];

const AsherDashboard = () => {
  const [active, setActive] = useState<AsherTab>("map");
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({ ops: true, ai: true, intel: false, comms: true, vault: false, governance: true });
  const [superOwner, setSuperOwner] = useState(false);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(ASHER_GATE_KEY) === "1"; } catch { return false; }
  });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { isSuperOwner().then(setSuperOwner); }, [user?.id]);

  useEffect(() => { document.title = "Asher Dashboard — Defense Intelligence"; }, []);

  useAsherAutoLock(() => {
    try { sessionStorage.removeItem(ASHER_GATE_KEY); } catch {}
    setUnlocked(false);
  });

  useEffect(() => { if (unlocked) logAsherEvent("session_unlocked", {}); }, [unlocked]);
  useEffect(() => { if (unlocked) logAsherEvent("module_open", { module: active }); }, [active, unlocked]);

  if (!unlocked) {
    return <AsherPasscodeGate onUnlock={() => setUnlocked(true)} />;
  }

  const handleLogout = async () => {
    await logAsherEvent("logout", {});
    try { sessionStorage.removeItem(ASHER_GATE_KEY); } catch {}
    await supabase.auth.signOut();
    navigate("/asher");
  };

  const toggleBranch = (id: string) => setOpenBranches((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
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

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {buildBranches(superOwner).map((branch) => {
            const open = !!openBranches[branch.id];
            return (
              <div key={branch.id}>
                <button
                  onClick={() => toggleBranch(branch.id)}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-foreground/5 rounded-md"
                >
                  {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">{branch.label}</span>
                </button>
                {open && (
                  <div className="mt-0.5 ml-2 border-l border-border/15 pl-2 space-y-0.5">
                    {branch.items.map((n) => {
                      const isActive = active === n.id;
                      const Icon = n.icon;
                      return (
                        <button
                          key={n.id}
                          onClick={() => setActive(n.id)}
                          className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                            isActive ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                          <span className="flex-1 text-xs font-light tracking-wide">{n.label}</span>
                          {n.sub && <span className="text-[8px] font-light tracking-[0.2em] text-red-400/70 uppercase">{n.sub}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border/15 px-3 py-3 space-y-0.5">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-light tracking-wide text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} /> Logout
          </button>
          <button onClick={() => navigate("/asher")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors uppercase">
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back to Asher
          </button>
          {user && (
            <p className="px-3 pt-2 text-[9px] tracking-[0.2em] text-muted-foreground/40 uppercase">
              Operator · Authenticated
            </p>
          )}
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden flex flex-col">
        <AsherInvitationsBanner />
        <div className="flex-1 overflow-hidden relative">
          {active === "orgs"      && <AsherOrganizationsModule />}
          {active === "map"       && <IntelligenceMapModule />}
          {active === "command"   && <AsherCommandCenter />}
          {active === "zophiel"   && <AsherZophielModule />}
          {active === "azplen"    && <AsherAzplenModule />}
          {active === "zali"      && <AsherZaliModule />}
          {active === "whiteboard"&& <AsherWhiteboardModule />}
          {active === "axrlen"    && <AsherAxrlenModule />}
          {active === "notebooks" && <AsherNotebooksModule />}
          {active === "targets"   && <AsherSavedTargets />}
          {active === "comms"     && <AsherCommsModule />}
          {active === "theater"   && <ComingSoonModule title="Theater Brief"   sub="Multi-source operational summary" />}
          {active === "targeting" && <ComingSoonModule title="Targeting Aid"   sub="Decision support for target packages" />}
          {active === "sigint"    && <ComingSoonModule title="SIGINT Fusion"   sub="Signal priority + intercept correlation" />}
          {active === "geoint"    && <ComingSoonModule title="GEOINT Layer"    sub="Imagery + geospatial intelligence overlays" />}
          {active === "doctrine"  && <ComingSoonModule title="Doctrine Recall" sub="Searchable doctrine + reference corpus" />}
          {active === "audit"     && <AsherAuditVault />}
          {active === "settings"  && <AsherSettingsModule />}
          {active === "profile"   && <AsherProfile />}
        </div>
      </main>
    </div>
  );
};

export default AsherDashboard;
