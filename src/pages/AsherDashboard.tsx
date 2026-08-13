import { ADMIN_EMAIL } from "@/lib/adminEmail";
import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  Map as MapIcon, FileText, Crosshair, Radio, Satellite,
  BookOpen, Lock, Settings, User, LogOut, ArrowLeft, ShieldAlert,
  Brain, Database, Bookmark, Search, ChevronDown, ChevronRight, MessageSquare,
  Building2, Wrench, PenSquare, Activity, NotebookPen, Code2, Package, Moon,
  BrainCircuit, BarChart3, Workflow, Bot, Loader2, Calculator,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
// Eager: default tab (map) + chrome (banner, command bar) + lightweight shared pieces.
import IntelligenceMapModule from "@/components/asher/IntelligenceMapModule";
import ComingSoonModule from "@/components/asher/ComingSoonModule";
import AsherCommandCenter from "@/components/asher/AsherCommandCenter";
import AsherInvitationsBanner from "@/components/asher/AsherInvitationsBanner";
// Lazy: every other tab loads only when its `active` value is selected.
// Previously all 20+ modules shipped in the first chunk even though one renders at a time.
const AsherAzplenModule       = lazy(() => import("@/components/asher/AsherAzplenModule"));
const AsherZaliModule         = lazy(() => import("@/components/asher/AsherZaliModule"));
const AsherWhiteboardModule   = lazy(() => import("@/components/asher/AsherWhiteboardModule"));
const AsherNotebooksModule    = lazy(() => import("@/components/asher/AsherNotebooksModule"));
const AsherSettingsModule     = lazy(() => import("@/components/asher/AsherSettingsModule"));
const AsherAuditVault         = lazy(() => import("@/components/asher/AsherAuditVault"));
const AsherSavedTargets       = lazy(() => import("@/components/asher/AsherSavedTargets"));
const AsherZophielModule      = lazy(() => import("@/components/asher/AsherZophielModule"));
const AsherCommsModule        = lazy(() => import("@/components/asher/AsherCommsModule"));
const AsherOrganizationsModule= lazy(() => import("@/components/asher/AsherOrganizationsModule"));
const AsherCodeModule         = lazy(() => import("@/components/asher/AsherCodeModule"));
const VedicAstrologyView      = lazy(() => import("@/components/dashboard/VedicAstrologyView"));
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
const AsherPublishedTabRenderer = lazy(() => import("@/components/asher/AsherPublishedTabRenderer"));
const AsherBrainsModule       = lazy(() => import("@/components/asher/AsherBrainsModule"));
const AsherAureonDataModule   = lazy(() => import("@/components/asher/AsherAureonDataModule"));
const AsherZahtenModule       = lazy(() => import("@/components/asher/AsherZahtenModule"));
const AsherZacoonModule       = lazy(() => import("@/components/asher/AsherZacoonModule"));
const GematriaTab             = lazy(() => import("@/components/gematria/GematriaTab"));


import { isSuperOwner } from "@/lib/asherOrgs";

const AsherProfile = lazy(() => import("@/components/asher/AsherProfile"));
import { logAsherEvent } from "@/lib/asherAudit";
import { useAsherAutoLock } from "@/components/asher/useAsherAutoLock";

// Passcodes now live in the `ASHER_ACCESS_CODES_JSON` Supabase secret and are
// verified by the `verify-asher-passcode` edge function. The client no longer
// ships the codes in the bundle.
const ASHER_GATE_KEY = "asher_dashboard_unlocked";
const ASHER_OPERATOR_KEY = "asher_dashboard_operator";
const ASHER_LOCKOUT_KEY = "asher_dashboard_locked_until";

const AsherPasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem(ASHER_LOCKOUT_KEY);
      if (!raw) return null;
      const ts = Number(raw);
      return Number.isFinite(ts) && ts > Date.now() ? ts : null;
    } catch { return null; }
  });
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  // Tick once a second while a lockout is active so the countdown updates.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  // Auto-clear the lockout banner when it expires.
  useEffect(() => {
    if (lockedUntil && lockedUntil <= now) {
      setLockedUntil(null);
      try { sessionStorage.removeItem(ASHER_LOCKOUT_KEY); } catch {}
    }
  }, [lockedUntil, now]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || lockedUntil) return;
    setBusy(true);
    setError("");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-asher-passcode`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data?.ok && data?.operator) {
        try {
          sessionStorage.setItem(ASHER_GATE_KEY, "1");
          sessionStorage.setItem(ASHER_OPERATOR_KEY, data.operator);
          sessionStorage.removeItem(ASHER_LOCKOUT_KEY);
        } catch {}
        logAsherEvent("passcode_success", { operator: data.operator });
        onUnlock();
        return;
      }

      if (resp.status === 429 && data?.lockedUntil) {
        const ts = new Date(data.lockedUntil).getTime();
        if (Number.isFinite(ts)) {
          setLockedUntil(ts);
          try { sessionStorage.setItem(ASHER_LOCKOUT_KEY, String(ts)); } catch {}
        }
        setError(data?.message || "Gate locked. Too many failed attempts.");
        logAsherEvent("passcode_failure", { attempted_length: code.length, locked: true });
        setCode("");
        return;
      }

      logAsherEvent("passcode_failure", { attempted_length: code.length });
      const remaining = typeof data?.remainingAttempts === "number" ? data.remainingAttempts : null;
      setError(
        remaining !== null && remaining > 0
          ? `ACCESS DENIED — Invalid clearance code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "ACCESS DENIED — Invalid clearance code.",
      );
      setCode("");
    } catch (err) {
      console.error("[AsherPasscodeGate] verify failed:", err);
      setError("Gate unreachable. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - now) : 0;
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);
  const lockedLabel = lockedUntil
    ? `Locked — retry in ${remainingMin}:${String(remainingSec).padStart(2, "0")}`
    : null;

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

          <h1 className="text-2xl font-extralight tracking-[0.2em] zophiel-shimmer-text mb-2">ASHER</h1>
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
                disabled={busy || !!lockedUntil}
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                className="w-full rounded-lg border border-border/30 bg-background/40 px-4 py-3 text-sm font-light tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none transition-colors disabled:opacity-50"
                placeholder={lockedUntil ? "Gate locked" : "Enter clearance code"}
              />
            </div>

            {(error || lockedLabel) && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" strokeWidth={1.5} />
                <p className="text-[11px] font-light tracking-wide text-red-300">
                  {lockedLabel || error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !!lockedUntil || !code}
              className="w-full rounded-lg bg-foreground/90 px-4 py-3 text-xs font-light tracking-[0.2em] text-background hover:bg-foreground transition-colors uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Verifying…" : lockedUntil ? "Locked" : "Authenticate"}
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
  | "map" | "command" | "zophiel" | "azplen" | "zali" | "whiteboard" | "notebooks" | "targets" | "comms"
  | "theater" | "targeting" | "sigint" | "geoint" | "doctrine"
  | "audit" | "settings" | "profile" | "orgs" | "code" | "vedic" | "brains" | "aureondata" | "gematria"
  | string; // allow dynamic published-tab ids: `pub:<uuid>`

interface NavItem { id: AsherTab; label: string; icon: any; sub?: string; children?: NavItem[] }
interface NavBranch { id: string; label: string; items: NavItem[] }

interface PublishedTab { id: string; name: string; icon: string; entry_html: string }

const buildBranches = (superOwner: boolean, brainContributor: boolean, isPrimaryAdmin: boolean, publishedTabs: PublishedTab[], agentStore: { id: string; name: string; icon: string }[] = []): NavBranch[] => [
  ...(superOwner ? [{ id: "governance", label: "Organizations", items: [
    { id: "orgs" as AsherTab, label: "Org Management", icon: Building2, sub: "God-Mode" },
  ]}] : []),
  ...(isPrimaryAdmin ? [{ id: "analytics", label: "Analytics", items: [
    { id: "aureondata" as AsherTab, label: "Asherin Data", icon: BarChart3, sub: "Operator" },
  ]}] : []),
  { id: "ops", label: "Operations", items: [
    { id: "map",     label: "Intelligence Map", icon: MapIcon,  sub: "Primary" },
    { id: "targets", label: "Saved Targets",    icon: Bookmark, sub: "Live" },
  ]},
  { id: "ai", label: "AI & Reasoning", items: [
    { id: "command", label: "ASHER AI",       icon: Brain,    sub: "Live" },
    ...((superOwner || brainContributor) ? [{ id: "brains" as AsherTab, label: "ASHER BRAINS", icon: BrainCircuit, sub: superOwner ? "Sealed" : "Upload" }] : []),
    { id: "zophiel", label: "Zophiel Engine", icon: Search,   sub: "Live" },
    { id: "code",    label: "Asher IDE",      icon: Code2,    sub: "IDE" },
  ]},
  { id: "intel", label: "Intelligence", items: [
    { id: "azplen",    label: "Azplen Intel",    icon: Database, sub: "Live" },
    { id: "zali",      label: "ZANOEM Design",     icon: Wrench,   sub: "Live" },
    { id: "whiteboard",label: "Whiteboard",      icon: PenSquare, sub: "Live" },
    { id: "notebooks", label: "Notebooks",       icon: NotebookPen, sub: "Live" },
    { id: "gematria",  label: "Gematria",        icon: Calculator, sub: "Live" },
    { id: "vedic",     label: "Vedic Strategy",  icon: Moon,      sub: "Sidereal" },
    { id: "__automation" as AsherTab, label: "Automation", icon: Package, children: [
      { id: "zahten",  label: "Zahten Agents",   icon: Workflow,  sub: "Builder" },
      { id: "zacoon",  label: "Zacoon Browser",  icon: Bot,       sub: "Agent" },
    ]},
    { id: "__aureonIntel" as AsherTab, label: "Asherin Disciplines", icon: Satellite, children: [
      { id: "theater",   label: "Theater Brief",   icon: FileText },
      { id: "targeting", label: "Targeting Aid",   icon: Crosshair },
      { id: "sigint",    label: "SIGINT Fusion",   icon: Radio },
      { id: "geoint",    label: "GEOINT Layer",    icon: Satellite },
      { id: "doctrine",  label: "Doctrine Recall", icon: BookOpen },
    ]},
  ]},
  ...(publishedTabs.length ? [{ id: "custom", label: "Custom Tabs", items: publishedTabs.map((t) => ({
    id: `pub:${t.id}` as AsherTab,
    label: t.name,
    icon: Package,
    sub: "Custom",
  })) }] : []),
  ...(agentStore.length ? [{ id: "agentstore", label: "Deployed Agents", items: agentStore.map((a) => ({
    id: `agent:${a.id}` as AsherTab,
    label: a.name,
    icon: Package,
    sub: "Live",
  })) }] : []),
  { id: "comms", label: "Secure Comms", items: [
    { id: "comms", label: "Operator Comms", icon: MessageSquare, sub: "E2EE" },
  ]},
  { id: "vault", label: "Vault & System", items: [
    { id: "audit",    label: "Audit Vault", icon: Lock,     sub: "Live" },
    { id: "profile",  label: "Profile",     icon: User,     sub: "Live" },
    { id: "settings", label: "Settings",    icon: Settings },
  ]},
];

type AgentStoreEntry = { id: string; name: string; icon: string; entry_html: string | null; visibility: string };

const AsherDashboard = () => {
  const [active, setActive] = useState<AsherTab>("map");
  const [vedicOpen, setVedicOpen] = useState(false);
  const selectTab = (id: AsherTab) => {
    if (id === "vedic") { setVedicOpen(true); return; }
    setActive(id);
  };
  /* A geography answer IS a map request. When any operator tool resolves a
     place, the map surfaces itself — the operator never hunts for a tab. */
  useEffect(() => {
    const open = () => setActive("map");
    window.addEventListener("asher:open-map", open);
    return () => window.removeEventListener("asher:open-map", open);
  }, []);

  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({ ops: true, ai: true, intel: false, custom: true, agentstore: true, comms: true, vault: false, governance: true, analytics: true });
  const [publishedTabs, setPublishedTabs] = useState<PublishedTab[]>([]);
  const [agentStore, setAgentStore] = useState<AgentStoreEntry[]>([]);
  const [superOwner, setSuperOwner] = useState(false);
  const [brainContributor, setBrainContributor] = useState(false);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(ASHER_GATE_KEY) === "1"; } catch { return false; }
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  // Admin hard-coded bypass — admin should never see the clearance gate.
  useEffect(() => {
    const email = (user?.email || "").toLowerCase();
    if (email && email === ADMIN_EMAIL && !unlocked) {
      try {
        sessionStorage.setItem(ASHER_GATE_KEY, "1");
        sessionStorage.setItem(ASHER_OPERATOR_KEY, "ADMIN");
      } catch {}
      setUnlocked(true);
    }
  }, [user?.email, unlocked]);

  useEffect(() => { isSuperOwner().then(setSuperOwner); }, [user?.id]);
  useEffect(() => {
    const email = (user?.email || "").toLowerCase();
    setBrainContributor(email === ADMIN_EMAIL || email === "ekk447@gmail.com");
  }, [user?.email]);

  useEffect(() => { document.title = "Asher Dashboard — Defense Intelligence"; }, []);

  // Load published custom tabs visible to this operator (RLS handles filtering).
  useEffect(() => {
    if (!unlocked || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("asher_code_published_tabs")
        .select("id, name, icon, entry_html")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) setPublishedTabs(data as PublishedTab[]);
    })();
    return () => { cancelled = true; };
  }, [unlocked, user?.id]);

  // Load Agent Store (Zahten-published agents the operator can see — RLS does the visibility filtering).
  useEffect(() => {
    if (!unlocked || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("asher_agents" as any)
        .select("id, name, icon, entry_html, visibility")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled && data) setAgentStore(data as any);
    };
    load();
    const onUpd = () => load();
    window.addEventListener("asher-agents-updated", onUpd);
    return () => { cancelled = true; window.removeEventListener("asher-agents-updated", onUpd); };
  }, [unlocked, user?.id]);

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
          {buildBranches(superOwner, brainContributor, (user?.email || "").toLowerCase() === ADMIN_EMAIL, publishedTabs, agentStore).map((branch) => {
            const open = !!openBranches[branch.id];
            return (
              <div key={branch.id}>
                <button
                  onClick={() => toggleBranch(branch.id)}
                  onMouseEnter={() => setOpenBranches(prev => ({ ...prev, [branch.id]: true }))}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-foreground/5 rounded-md"
                >
                  {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">{branch.label}</span>
                </button>
                {open && (
                  <div className="mt-0.5 ml-2 border-l border-border/15 pl-2 space-y-0.5">
                    {branch.items.map((n) => {
                      const Icon = n.icon;
                      if (n.children && n.children.length) {
                        const subId = `${branch.id}::${n.id}`;
                        const subOpen = !!openBranches[subId];
                        return (
                          <div key={n.id}>
                            <button
                              onClick={() => toggleBranch(subId)}
                              onMouseEnter={() => setOpenBranches(prev => ({ ...prev, [subId]: true }))}
                              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                            >
                              {subOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                              <span className="flex-1 text-xs font-light tracking-wide">{n.label}</span>
                            </button>
                            {subOpen && (
                              <div className="mt-0.5 ml-3 border-l border-border/10 pl-2 space-y-0.5">
                                {n.children.map((c) => {
                                  const CIcon = c.icon;
                                  const cActive = active === c.id;
                                  return (
                                    <button
                                      key={c.id}
                                      onClick={() => selectTab(c.id)}
                                      onMouseEnter={() => { if (c.id !== "vedic") setActive(c.id); }}
                                      className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                                        cActive ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                      }`}
                                    >
                                      <CIcon className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                                      <span className="flex-1 text-[11px] font-light tracking-wide">{c.label}</span>
                                      {c.sub && <span className="text-[8px] font-light tracking-[0.2em] text-red-400/70 uppercase">{c.sub}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }
                      const isActive = active === n.id;
                      return (
                        <button
                          key={n.id}
                          onClick={() => selectTab(n.id)}
                          onMouseEnter={() => { if (n.id !== "vedic") setActive(n.id); }}
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
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin" />
            </div>
          }>
            {active === "orgs"      && <AsherOrganizationsModule />}
            {active === "map"       && <IntelligenceMapModule />}
            {active === "command"   && <AsherCommandCenter />}
            {active === "brains"    && <AsherBrainsModule />}
            {active === "aureondata"&& <AsherAureonDataModule />}
            {active === "zophiel"   && <AsherZophielModule />}
            {active === "azplen"    && <AsherAzplenModule />}
            {active === "zali"      && <AsherZaliModule />}
            {active === "whiteboard"&& <AsherWhiteboardModule />}
            {active === "notebooks" && <AsherNotebooksModule />}
            {/* Vedic Strategy renders as a popout dialog below */}
            {active === "zahten"    && <AsherZahtenModule />}
            {active === "zacoon"    && <AsherZacoonModule />}
            {active === "gematria"  && <GematriaTab />}

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
            {active === "code"      && <AsherCodeModule />}
            {typeof active === "string" && active.startsWith("pub:") && (() => {
              const tab = publishedTabs.find((t) => `pub:${t.id}` === active);
              return tab ? <AsherPublishedTabRenderer name={tab.name} entryHtml={tab.entry_html} /> : null;
            })()}
            {typeof active === "string" && active.startsWith("agent:") && (() => {
              const a = agentStore.find((x) => `agent:${x.id}` === active);
              return a ? <AsherPublishedTabRenderer name={a.name} entryHtml={a.entry_html || ""} /> : null;
            })()}
          </Suspense>
        </div>
      </main>

      <Dialog open={vedicOpen} onOpenChange={setVedicOpen}>
        <DialogContent className="p-0 gap-0 max-w-[min(1200px,95vw)] w-[95vw] h-[90vh] overflow-hidden bg-background border-border/30">
          <VisuallyHidden><DialogTitle>Vedic Strategy</DialogTitle></VisuallyHidden>
          <div className="h-full w-full overflow-auto">
            <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin" /></div>}>
              <VedicAstrologyView />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AsherDashboard;
