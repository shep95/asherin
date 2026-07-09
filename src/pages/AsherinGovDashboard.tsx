// /asherin-gov/dashboard — LIVE Sovereign Command Deck.
//
// Backed by Supabase (hoa_servers, hoa_channels, hoa_members, hoa_messages,
// hoa_audit, hoa_invites) with realtime. Every message a country's operator
// writes on their server is mirrored into the #houseofasher mothership feed
// via the DB trigger, so Aureon has full global signal.
//
// The Aureon Suite rail (previous work) still mounts inline.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, Hash, Volume2, Lock, Radio, Search, Send, Users, AlertTriangle,
  Eye, EyeOff, Pin, ScrollText, ChevronLeft, Circle, Crown, X, Plus, LogIn, Copy, Check, Loader2,
  Menu, Settings,
} from "lucide-react";
import { getWallpaperSrc } from "@/lib/wallpapers";
import { useAuth } from "@/contexts/AuthContext";
import { useHoaDeck, rankToLabel, CLEARANCE_LABELS, type HoaChannel } from "@/hooks/useHoaDeck";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import GovSuiteMount, { SUITES, type SuiteId } from "@/components/asher-gov/GovSuiteMount";
import AdminPanel from "@/components/asher-gov/AdminPanel";

const CLEARANCE_COLOR: Record<string,string> = {
  UNCLASS: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  CUI: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  CONFIDENTIAL: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  SECRET: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  TS: "bg-red-500/15 text-red-300 border-red-500/30",
};

const channelIcon = (kind: HoaChannel["kind"]) =>
  kind === "text" ? Hash : kind === "voice" ? Volume2 : kind === "vault" ? Lock : Radio;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ═════════════════════════════════════════════════════════════════════════
// Modals
// ═════════════════════════════════════════════════════════════════════════

function CreateServerModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [country, setCountry] = useState(""); const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (!code.trim() || !name.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-invite", {
        body: { action: "create_server", code: code.trim(), name: name.trim(), country: country.trim() || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sovereign server ${code.toUpperCase()} online`);
      onCreated(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "create failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-border/30 bg-black/85 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <div className="text-sm font-light tracking-widest uppercase">Establish sovereign server</div>
        </div>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          A country server. You become owner (TS clearance). Every message here is mirrored into the #houseofasher mothership so Aureon retains global signal.
        </p>
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Country code (3–8 chars)</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0,8))} placeholder="USA / JPN / DEU"
            className="w-full bg-black/40 border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-foreground/50 uppercase tracking-widest" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Server name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="United States Command"
            className="w-full bg-black/40 border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-foreground/50" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Country (optional)</label>
          <input value={country} onChange={e => setCountry(e.target.value)} placeholder="United States"
            className="w-full bg-black/40 border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-foreground/50" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-border/30 rounded-md text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={busy || !code.trim() || !name.trim()} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 disabled:opacity-40">
            {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Establish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ open, onClose, serverId, canInvite }: { open: boolean; onClose: () => void; serverId: string | null; canInvite: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roleGrant, setRoleGrant] = useState<"operator"|"analyst"|"guest">("operator");
  const [clearanceGrant, setClearanceGrant] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [mirror, setMirror] = useState(true);
  if (!open) return null;

  const create = async () => {
    if (!serverId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-invite", {
        body: { action: "create", serverId, roleGrant, clearanceGrant, maxUses, mirrorMothership: mirror },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCode(data.invite.code);
    } catch (e: any) { toast.error(e?.message ?? "invite failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-border/30 bg-black/85 p-6 space-y-4">
        <div className="flex items-center gap-2"><Users className="h-4 w-4" /><div className="text-sm font-light tracking-widest uppercase">Invite operator</div></div>
        {!canInvite ? (
          <p className="text-xs text-red-300">Only owners and operators can mint invites for this server.</p>
        ) : !code ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Role</label>
                <select value={roleGrant} onChange={e => setRoleGrant(e.target.value as any)} className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs">
                  <option value="operator">Operator</option>
                  <option value="analyst">Analyst</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Clearance</label>
                <select value={clearanceGrant} onChange={e => setClearanceGrant(Number(e.target.value))} className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs">
                  {CLEARANCE_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Max uses</label>
                <input type="number" min={1} max={500} value={maxUses} onChange={e => setMaxUses(Math.max(1, +e.target.value))} className="w-full mt-1 bg-black/40 border border-border/30 rounded-md px-2 py-1.5 text-xs" />
              </div>
              <label className="flex items-end gap-2 text-[11px] text-muted-foreground/80">
                <input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} />
                Mirror to #houseofasher
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-border/30 rounded-md text-muted-foreground">Cancel</button>
              <button onClick={create} disabled={busy} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 disabled:opacity-40">
                {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Mint Invite"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-[11px] text-muted-foreground/80">Share this code — the recipient redeems it in the deck's Join dialog.</div>
            <div className="flex items-center gap-2 rounded-md border border-foreground/30 bg-foreground/5 px-3 py-3 font-mono text-lg tracking-widest">
              {code}
              <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-auto text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-border/30 rounded-md">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JoinModal({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: () => void }) {
  const [code, setCode] = useState(""); const [handle, setHandle] = useState(""); const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hoa-invite", { body: { action: "accept", code: code.trim(), handle: handle.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Joined ${data.server?.name ?? "server"} · ${rankToLabel(data.clearance)}`);
      onJoined(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "join failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-border/30 bg-black/85 p-6 space-y-4">
        <div className="flex items-center gap-2"><LogIn className="h-4 w-4" /><div className="text-sm font-light tracking-widest uppercase">Redeem invite</div></div>
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Invite code</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXXXX"
            className="w-full bg-black/40 border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-foreground/50 font-mono tracking-widest" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Handle (optional)</label>
          <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="Fusion.Lead"
            className="w-full bg-black/40 border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-foreground/50" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-border/30 rounded-md text-muted-foreground">Cancel</button>
          <button onClick={submit} disabled={busy || !code.trim()} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10 disabled:opacity-40">
            {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Redeem"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Main deck
// ═════════════════════════════════════════════════════════════════════════

const AsherinGovDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const deck = useHoaDeck();

  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [unsealed, setUnsealed] = useState<Set<string>>(new Set());
  const [membersOpen, setMembersOpen] = useState(false);
  const [activeSuite, setActiveSuite] = useState<SuiteId | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showJoin,   setShowJoin  ] = useState(false);
  const [showAdmin,  setShowAdmin ] = useState(false);
  const [mobileNav,  setMobileNav ] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastNavRef = useRef<{ server?: string; channel?: string }>({});

  const wallpaper = getWallpaperSrc("aureon");

  useEffect(() => {
    document.title = "Command Deck · asherin.gov";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Sovereign command deck: live country servers, clearance-gated channels, encrypted vaults, immutable audit ledger, Aureon suite runtime.");
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.setAttribute("name","robots"); document.head.appendChild(robots); }
    robots.setAttribute("content","noindex, nofollow, noarchive");
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [deck.activeChannel?.id, deck.messages.length]);

  // Debounced navigation audit: only log distinct server/channel entries.
  useEffect(() => {
    if (!deck.activeServer || !deck.myMembership) return;
    const s = deck.activeServer.id, c = deck.activeChannel?.id;
    const last = lastNavRef.current;
    const t = window.setTimeout(() => {
      if (last.server !== s) { void deck.pushAudit("NAV_SERVER", deck.activeServer!.name); lastNavRef.current.server = s; }
      if (c && last.channel !== c) { void deck.pushAudit("NAV_CHANNEL", deck.activeChannel!.name); lastNavRef.current.channel = c; }
    }, 500);
    return () => window.clearTimeout(t);
  }, [deck.activeServer?.id, deck.activeChannel?.id, deck.myMembership?.id]);

  // ---------------- gate: signed out ----------------
  if (!authLoading && !user) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center text-foreground overflow-hidden">
        <div className="fixed inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} aria-hidden />
        <div className="fixed inset-0 -z-10 bg-black/80" aria-hidden />
        <div className="max-w-md text-center p-8 rounded-xl border border-border/30 bg-black/60 space-y-4">
          <Shield className="h-8 w-8 mx-auto text-foreground/80" />
          <div className="text-lg font-light tracking-widest uppercase">Sovereign Command Deck</div>
          <p className="text-sm font-light text-muted-foreground leading-relaxed">
            Sign in to reach your country's server. Members of the #houseofasher mothership see every server globally.
          </p>
          <button onClick={() => nav("/auth?next=/asherin-gov/dashboard")} className="px-4 py-2 text-xs tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10">
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  const clearanceLabel = deck.myMembership ? rankToLabel(deck.myMembership.clearance_rank) : "UNCLASS";
  const banner = deck.activeServer?.is_mothership ? "TS" : clearanceLabel;
  const canInvite = deck.myMembership && ["owner","operator"].includes(deck.myMembership.role);
  const isOwner = deck.myMembership?.role === "owner" || deck.myMembership?.role === "houseofasher";

  // Filter channels & members client-side (RLS already gate reads server-side)
  const activeChannel = deck.activeChannel;
  const visibleChannels = deck.channels;
  const activeServerMembers = deck.members.filter(m => m.server_id === deck.activeServer?.id);
  const channelMessages = deck.messages
    .filter(m => m.channel_id === activeChannel?.id)
    .filter(m => !search.trim() || m.body.toLowerCase().includes(search.toLowerCase()));

  const handleSend = async () => {
    if (!draft.trim() || !activeChannel) return;
    if (!deck.canAccess(activeChannel)) return;
    try { await deck.sendMessage(draft); setDraft(""); }
    catch (e: any) { toast.error(e?.message ?? "send failed"); }
  };

  const handleUnseal = async (msgId: string) => {
    setUnsealed(p => new Set(p).add(msgId));
    await deck.pushAudit("VAULT_UNSEALED", activeChannel?.name ?? "?", `msg=${msgId.slice(0,8)}`);
  };

  const openSuite = async (id: SuiteId) => {
    const suite = SUITES.find(s => s.id === id);
    if (!suite) return;
    if ((deck.myMembership?.clearance_rank ?? -1) < suite.minClearanceRank) {
      await deck.pushAudit("SUITE_DENIED", suite.label, "insufficient clearance");
      toast.error("Clearance below required level for this suite.");
      return;
    }
    setActiveSuite(id);
    await deck.pushAudit("SUITE_ENTER", suite.label);
  };

  return (
    <div className="relative min-h-screen w-full text-foreground overflow-hidden">
      <div className="fixed inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} aria-hidden />
      <div className="fixed inset-0 -z-10 bg-black/80 backdrop-blur-sm" aria-hidden />

      {/* Classification banner (top) */}
      <div className={`sticky top-0 z-40 border-b text-center text-[10px] tracking-[0.35em] uppercase font-semibold py-1.5 flex items-center justify-center gap-2 ${CLEARANCE_COLOR[banner] ?? CLEARANCE_COLOR.SECRET}`}>
        <button onClick={() => setMobileNav(v => !v)} className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md border border-current/30" aria-label="Toggle navigation">
          <Menu className="h-3.5 w-3.5" />
        </button>
        <span className="truncate">{banner === "TS" ? "TOP SECRET" : banner} // ASHERIN.GOV // {deck.activeServer?.is_mothership ? "#HOUSEOFASHER" : (deck.activeServer?.code ?? "NO SERVER")}</span>
      </div>

      <div className="flex h-[calc(100vh-28px)] relative">
        {/* Mobile backdrop */}
        {mobileNav && <div className="lg:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setMobileNav(false)} aria-hidden />}

        {/* SERVER RAIL */}
        <aside className={`w-16 shrink-0 border-r border-border/20 bg-black/60 lg:bg-black/40 flex-col items-center py-3 gap-2 overflow-y-auto
                           ${mobileNav ? "flex fixed z-40 h-full top-7" : "hidden lg:flex"}`}>
          <Link to="/asherin.gov" className="w-10 h-10 rounded-xl border border-border/30 bg-foreground/[0.03] flex items-center justify-center hover:bg-foreground/10 transition" title="Back to asherin.gov">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="w-8 h-px bg-border/30 my-1" />
          {deck.servers.map(s => {
            const active = s.id === deck.activeServer?.id;
            return (
              <button key={s.id} onClick={() => { deck.switchServer(s.id); setActiveSuite(null); }}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[10px] font-semibold tracking-widest transition relative
                  ${active ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:border-border/60"}
                  ${s.is_mothership ? "ring-1 ring-amber-500/40" : ""}`}
                title={`${s.name}${s.is_mothership ? " (mothership)" : ""}`}>
                {s.is_mothership ? <Crown className="h-4 w-4 text-amber-400" /> : s.code.slice(0,3)}
                {active && <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-foreground" />}
              </button>
            );
          })}
          <button onClick={() => setShowCreate(true)} className="w-10 h-10 rounded-xl border border-dashed border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/60" title="Establish sovereign server"><Plus className="h-4 w-4 mx-auto" /></button>
          <button onClick={() => setShowJoin(true)} className="w-10 h-10 rounded-xl border border-dashed border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/60" title="Redeem invite"><LogIn className="h-4 w-4 mx-auto" /></button>

          <div className="w-8 h-px bg-border/30 my-1" />
          <div className="text-[8px] tracking-[0.25em] uppercase text-muted-foreground/60">SUITE</div>
          {SUITES.map(s => {
            const active = activeSuite === s.id;
            const gated = (deck.myMembership?.clearance_rank ?? -1) < s.minClearanceRank;
            return (
              <button key={s.id} onClick={() => openSuite(s.id)} disabled={gated}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition relative
                  ${active ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:border-border/60"}
                  ${gated ? "opacity-30 cursor-not-allowed" : ""}`}
                title={`${s.label} — ${s.blurb}${gated ? " (clearance too low)" : ""}`}>
                <s.icon className="h-4 w-4" />
                {active && <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-foreground" />}
              </button>
            );
          })}
        </aside>

        {/* CHANNEL RAIL */}
        <aside className={`w-64 shrink-0 border-r border-border/20 bg-black/60 lg:bg-black/30 flex-col
                           ${mobileNav ? "flex fixed z-40 h-full top-7 left-16" : "hidden lg:flex"}`}>
          <div className="px-4 py-4 border-b border-border/20 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{deck.activeServer?.code ?? "—"}</div>
              <div className="text-sm font-light text-foreground mt-0.5 truncate">{deck.activeServer?.name ?? "Select a server"}</div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {canInvite && (
                <button onClick={() => setShowInvite(true)} className="text-[9px] tracking-widest uppercase border border-border/30 rounded px-2 py-1 hover:bg-foreground/10">Invite</button>
              )}
              {isOwner && (
                <button onClick={() => setShowAdmin(true)} className="text-[9px] tracking-widest uppercase border border-amber-500/40 text-amber-300 rounded px-2 py-1 hover:bg-amber-500/10 flex items-center gap-1 justify-center">
                  <Settings className="h-3 w-3" /> Admin
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {deck.loading && <div className="text-center text-xs text-muted-foreground py-8"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Loading…</div>}
            {(["text","voice","vault","broadcast"] as HoaChannel["kind"][]).map(kind => {
              const list = visibleChannels.filter(c => c.kind === kind);
              if (list.length === 0) return null;
              const label = { text: "Channels", voice: "Rooms", vault: "Vaults", broadcast: "Broadcast" }[kind];
              return (
                <div key={kind}>
                  <div className="px-2 pb-1 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">{label}</div>
                  {list.map(c => {
                    const Icon = channelIcon(c.kind);
                    const active = c.id === activeChannel?.id;
                    return (
                      <button key={c.id} onClick={() => { deck.switchChannel(c.id); setActiveSuite(null); }}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition
                          ${active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"}`}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-light">{c.name}</span>
                        <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded border ${CLEARANCE_COLOR[rankToLabel(c.min_clearance)]}`}>{rankToLabel(c.min_clearance)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {!deck.loading && visibleChannels.length === 0 && deck.activeServer && (
              <div className="px-2 py-4 text-[10.5px] font-light text-muted-foreground/70 border border-dashed border-border/30 rounded-md text-center">
                No channels visible at your clearance ({clearanceLabel}).
              </div>
            )}
          </div>
          <div className="border-t border-border/20 p-3">
            <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-1.5">Acting as</div>
            <div className="text-sm font-light text-foreground truncate">{deck.myMembership?.handle ?? user?.email?.split("@")[0] ?? "—"}</div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70">
              <span className={`inline-block px-1.5 py-0.5 rounded border ${CLEARANCE_COLOR[clearanceLabel]}`}>{clearanceLabel}</span>
              <span>{deck.myMembership?.rank_label ?? (deck.activeServer ? "Guest" : "—")}</span>
            </div>
          </div>
        </aside>

        {/* MAIN PANE */}
        <main className="flex-1 flex flex-col min-w-0">
          {activeSuite ? (() => {
            const suite = SUITES.find(s => s.id === activeSuite)!;
            return (
              <>
                <header className="border-b border-border/20 bg-black/20 px-5 py-3 flex items-center gap-3 min-w-0">
                  <suite.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-light text-foreground truncate">{suite.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-foreground/30 text-foreground/80 tracking-widest uppercase">Sovereign Runtime</span>
                    </div>
                    <div className="text-[11px] font-light text-muted-foreground/70 truncate">{suite.blurb}</div>
                  </div>
                  <button onClick={() => setActiveSuite(null)} className="ml-auto text-[10px] tracking-widest uppercase px-2 py-1.5 rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60 flex items-center gap-1">
                    <X className="h-3 w-3" /> Exit Suite
                  </button>
                </header>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <GovSuiteMount suite={activeSuite} operator={deck.myMembership?.handle ?? user?.email ?? "operator"} onAudit={(a,t,d) => deck.pushAudit(a,t,d)} />
                </div>
              </>
            );
          })() : activeChannel ? (
            <>
              <header className="border-b border-border/20 bg-black/20 px-5 py-3 flex items-center gap-3 min-w-0">
                {(() => { const Icon = channelIcon(activeChannel.kind); return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />; })()}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-light text-foreground truncate">{activeChannel.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${CLEARANCE_COLOR[rankToLabel(activeChannel.min_clearance)]}`}>{rankToLabel(activeChannel.min_clearance)}</span>
                    {activeChannel.compartments?.map(c => (
                      <span key={c} className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 tracking-wider">{c}</span>
                    ))}
                  </div>
                  {activeChannel.topic && <div className="text-[11px] font-light text-muted-foreground/70 truncate">{activeChannel.topic}</div>}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this channel"
                      className="bg-black/30 border border-border/30 rounded-md text-xs font-light text-foreground pl-7 pr-2 py-1.5 w-52 outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50" />
                  </div>
                  <button onClick={() => setShowAudit(v => !v)} className={`text-[10px] tracking-widest uppercase px-2 py-1.5 rounded-md border transition ${showAudit ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"}`}>
                    <ScrollText className="h-3.5 w-3.5 inline mr-1" />Audit
                  </button>
                  <button onClick={() => setMembersOpen(v => !v)} className={`text-[10px] tracking-widest uppercase px-2 py-1.5 rounded-md border transition ${membersOpen ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"}`}>
                    <Users className="h-3.5 w-3.5 inline mr-1" />{activeServerMembers.length}
                  </button>
                </div>
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {activeChannel.kind === "voice" && (
                  <div className="rounded-xl border border-border/30 bg-black/30 p-6 text-center">
                    <Volume2 className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
                    <div className="text-sm font-light text-foreground">Secure voice room</div>
                    <div className="text-[11px] text-muted-foreground/70 mt-1">Coordination surface. Voice routes over the sovereign SRTP mesh; join controls appear here once initiated.</div>
                  </div>
                )}
                {activeChannel.kind !== "voice" && channelMessages.length === 0 && (
                  <div className="text-center text-xs font-light text-muted-foreground/60 py-16">No traffic in this channel yet.</div>
                )}
                {activeChannel.kind !== "voice" && channelMessages.map(m => {
                  const author = activeServerMembers.find(u => u.user_id === m.author_id);
                  const sealed = m.sealed && !unsealed.has(m.id);
                  const authorClearance = author ? rankToLabel(author.clearance_rank) : "UNCLASS";
                  return (
                    <div key={m.id} className={`group flex gap-3 rounded-md px-2 py-1.5 hover:bg-foreground/[0.03] ${m.pinned ? "border-l-2 border-amber-500/60 pl-3" : ""}`}>
                      <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold text-foreground/80">
                        {m.author_handle.slice(0,2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-light text-foreground">{m.author_handle}</span>
                          {author?.role === "houseofasher" && <Crown className="h-3 w-3 text-amber-400" />}
                          {author && <span className={`text-[9px] px-1 py-0.5 rounded border ${CLEARANCE_COLOR[authorClearance]}`}>{authorClearance}</span>}
                          {m.pinned && <Pin className="h-3 w-3 text-amber-400" />}
                          <span className="text-[10px] text-muted-foreground/60">{fmtTime(m.created_at)}</span>
                          {m.compartments?.map(c => (
                            <span key={c} className="text-[9px] px-1 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 tracking-wider">{c}</span>
                          ))}
                        </div>
                        {sealed ? (
                          <div className="mt-1 flex items-center gap-3 rounded-md border border-dashed border-red-500/40 bg-red-500/5 px-3 py-2">
                            <Lock className="h-3.5 w-3.5 text-red-300 shrink-0" />
                            <div className="text-[11px] font-light text-red-200/90">Message sealed. Unsealing is written to the audit ledger.</div>
                            <button onClick={() => handleUnseal(m.id)} className="ml-auto text-[10px] tracking-widest uppercase px-2 py-1 rounded border border-red-500/40 text-red-200 hover:bg-red-500/10">
                              <Eye className="h-3 w-3 inline mr-1" />Unseal
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm font-light text-foreground/90 leading-relaxed whitespace-pre-wrap">
                            {m.body}
                            {m.sealed && (
                              <button onClick={() => setUnsealed(prev => { const n = new Set(prev); n.delete(m.id); return n; })} className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground">
                                <EyeOff className="h-3 w-3" />reseal
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeChannel.kind !== "voice" && (
                <div className="border-t border-border/20 bg-black/20 p-3">
                  {!deck.canAccess(activeChannel) ? (
                    <div className="flex items-center gap-2 text-xs font-light text-red-300 border border-red-500/30 bg-red-500/5 rounded-md px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5" /> Insufficient clearance to post here.
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 rounded-md border border-border/30 bg-black/40 focus-within:border-foreground/50 transition">
                        {activeChannel.kind === "broadcast" && (
                          <div className="px-3 pt-2 text-[10px] tracking-widest uppercase text-amber-300 flex items-center gap-1.5"><Radio className="h-3 w-3" /> Emergency broadcast · pins across visible feeds</div>
                        )}
                        {activeChannel.kind === "vault" && (
                          <div className="px-3 pt-2 text-[10px] tracking-widest uppercase text-red-300 flex items-center gap-1.5"><Lock className="h-3 w-3" /> Vault channel · outbound sealed by default · body stripped from Aureon feed until published</div>
                        )}
                        <textarea value={draft} onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                          rows={2} placeholder={`Transmit to #${activeChannel.name}`}
                          className="w-full bg-transparent px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none resize-none" />
                      </div>
                      <button onClick={handleSend} disabled={!draft.trim()} className="h-10 w-10 rounded-md border border-foreground/40 bg-foreground/5 hover:bg-foreground/15 disabled:opacity-40 flex items-center justify-center" aria-label="Send">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="mt-1.5 text-[10px] text-muted-foreground/60 flex items-center gap-3">
                    <span>Enter to send · Shift+Enter for newline</span>
                    <span className="ml-auto">All traffic mirrored to #houseofasher and audit-logged.</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md p-6 space-y-3">
                <Shield className="h-8 w-8 mx-auto text-foreground/60" />
                <div className="text-sm font-light tracking-widest uppercase">No server selected</div>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">Establish a sovereign server or redeem an invite. Every message you write here is mirrored to the #houseofasher mothership so the Aureon brain retains global signal.</p>
                <div className="flex gap-2 justify-center pt-2">
                  <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-foreground/50 rounded-md hover:bg-foreground/10">Establish</button>
                  <button onClick={() => setShowJoin(true)} className="px-3 py-1.5 text-[11px] tracking-widest uppercase border border-border/30 rounded-md">Redeem invite</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* MEMBERS RAIL */}
        {membersOpen && !activeSuite && deck.activeServer && (
          <aside className="hidden md:flex w-64 shrink-0 border-l border-border/20 bg-black/30 flex-col">
            <div className="px-4 py-3 border-b border-border/20 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Members · {activeServerMembers.length}</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {activeServerMembers.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/[0.04]">
                  <div className="w-7 h-7 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold">{m.handle.slice(0,2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-light text-foreground truncate flex items-center gap-1">{m.handle}{m.role === "houseofasher" && <Crown className="h-3 w-3 text-amber-400" />}</div>
                    <div className="text-[10px] text-muted-foreground/60 truncate">{m.rank_label}</div>
                  </div>
                  <span className={`text-[8px] px-1 py-0.5 rounded border ${CLEARANCE_COLOR[rankToLabel(m.clearance_rank)]}`}>{rankToLabel(m.clearance_rank)}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* AUDIT DRAWER */}
        {showAudit && !activeSuite && (
          <aside className="w-80 shrink-0 border-l border-border/20 bg-black/50 flex flex-col">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Immutable Audit Ledger</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {deck.audit.map(e => (
                <div key={e.id} className="rounded-md border border-border/20 bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <Circle className="h-1.5 w-1.5 fill-foreground/60 text-foreground/60" />
                    {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    <span className="ml-auto text-foreground/80 tracking-widest">{e.action}</span>
                  </div>
                  <div className="mt-1 text-xs font-light text-foreground/90">{e.actor_handle ?? "system"} <span className="text-muted-foreground">→</span> {e.target ?? "—"}</div>
                  {e.detail && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{e.detail}</div>}
                </div>
              ))}
              {deck.audit.length === 0 && <div className="text-center text-[11px] text-muted-foreground/60 py-8">No entries.</div>}
            </div>
          </aside>
        )}
      </div>

      {/* Classification banner (bottom) */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 border-t text-center text-[10px] tracking-[0.35em] uppercase font-semibold py-1 ${CLEARANCE_COLOR[banner] ?? CLEARANCE_COLOR.SECRET}`}>
        {banner === "TS" ? "TOP SECRET" : banner}
      </div>

      <CreateServerModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={deck.refresh} />
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} serverId={deck.activeServer?.id ?? null} canInvite={!!canInvite} />
      <JoinModal open={showJoin} onClose={() => setShowJoin(false)} onJoined={deck.refresh} />
    </div>
  );
};

export default AsherinGovDashboard;
