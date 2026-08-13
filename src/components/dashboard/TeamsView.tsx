/**
 * Asherin Team — your company workspace.
 *
 * Every action here is answered by the `team-manage` edge function, which
 * re-derives the caller's role from the database. Nothing on this screen is a
 * client-side permission: hidden buttons are a courtesy, the server is the law.
 *
 * Billing is the owner's alone. Members never see a card field, never receive
 * a Team invoice, and inherit Pro-class access purely from an active workspace.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePppQuote, quoteCents } from "@/hooks/usePppQuote";
import { formatUsd, TEAM_MIN_SEATS, type Term } from "@/lib/pricing/ppp";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
import { useIsV2 } from "@/lib/dashboardUiContext";
import { V2Action, v2ActionClass } from "@/components/dashboard/v2/V2PageShell";
  Building2, Briefcase, Globe, Lock, Server, FileText, Cpu, Layers, Shield,
  Users, Crown, Eye, UserPlus, Mail, Clock, Trash2, Check, X, Plus, Loader2,
  ArrowRightLeft, Minus, CreditCard, LogOut, Copy,
} from "lucide-react";

/* ─────────────────────────── shapes ─────────────────────────── */

interface Team {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  owner_id: string;
  seat_quantity: number;
  billing_status: string;
  billing_term: string | null;
  created_at: string;
}

interface Member {
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  joined_at: string;
  email: string | null;
  display_name: string | null;
  is_self: boolean;
}

interface Invite {
  id: string;
  team_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  team?: { id: string; name: string; description: string | null; icon: string | null } | null;
}

const TEAM_ICONS: { icon: React.ElementType; label: string }[] = [
  { icon: Building2, label: "building" },
  { icon: Briefcase, label: "briefcase" },
  { icon: Globe, label: "globe" },
  { icon: Lock, label: "lock" },
  { icon: Server, label: "server" },
  { icon: FileText, label: "filetext" },
  { icon: Cpu, label: "cpu" },
  { icon: Layers, label: "layers" },
  { icon: Shield, label: "shield" },
  { icon: Users, label: "users" },
];

const iconFor = (s: string | null) =>
  TEAM_ICONS.find((i) => i.label === s)?.icon ?? Building2;

const ROLE_ICON: Record<string, React.ElementType> = {
  owner: Crown, admin: Shield, member: Users, viewer: Eye,
};

/** What each role can actually do — mirrors the checks inside `team-manage`. */
const ROLE_MATRIX: { role: string; can: string[]; cannot: string[] }[] = [
  {
    role: "Owner",
    can: ["Billing, seats, and the card", "Delete the workspace", "Transfer ownership", "Everything an admin can do"],
    cannot: ["Leave before transferring the workspace"],
  },
  {
    role: "Admin",
    can: ["Invite, resend, revoke", "Change member and viewer roles", "Rename the workspace", "Manage Team Projects"],
    cannot: ["See the owner's card", "Cancel billing", "Delete the workspace", "Remove the owner"],
  },
  {
    role: "Member",
    can: ["Full Pro-class use while the team is active", "Create and edit in Team Projects"],
    cannot: ["Invite", "Change roles", "Touch billing"],
  },
  {
    role: "Viewer",
    can: ["Read Team Projects and shared outputs", "Keep their own private chats"],
    cannot: ["Create shared artefacts", "Invite", "Delete anything"],
  },
];

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [name, domain] = email.split("@");
  if (!domain) return "—";
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
}

/* ─────────────────────────── view ─────────────────────────── */

const TeamsView = () => {
  const v2 = useIsV2();
  const { user } = useAuth();
  const { toast } = useToast();
  const { checkSubscription } = useSubscription();
  const ppp = usePppQuote();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myInvites, setMyInvites] = useState<Invite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // create flow
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIcon, setNewIcon] = useState("building");
  const [newSeats, setNewSeats] = useState(TEAM_MIN_SEATS);
  const [term, setTerm] = useState<Term>("monthly");

  // invite flow
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  // destructive confirmations
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [seatDraft, setSeatDraft] = useState<number | null>(null);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("team-manage", { body });
    if (error) {
      let detail = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          const parsed = JSON.parse(await ctx.text());
          if (parsed?.error) detail = parsed.error;
        }
      } catch { /* keep the transport message */ }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await call({ action: "list" });
      setTeams(data.teams ?? []);
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
      setMyInvites(data.my_invites ?? []);
      setActiveId((prev) =>
        prev && (data.teams ?? []).some((t: Team) => t.id === prev)
          ? prev
          : (data.teams ?? [])[0]?.id ?? null,
      );
    } catch (e) {
      console.error("team list failed:", e);
      toast({ title: "Could not load workspaces", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, call, toast]);

  useEffect(() => { load(); }, [load]);

  // Returning from Stripe: confirm the container actually went active rather
  // than trusting the redirect flag.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("team_checkout") === "success") {
      toast({ title: "Payment received", description: "Confirming the workspace with billing…" });
      const timer = window.setTimeout(() => { load(); checkSubscription(); }, 2500);
      return () => window.clearTimeout(timer);
    }
    if (params.get("team_checkout") === "canceled") {
      toast({ title: "Checkout canceled", description: "No workspace was created." });
    }
  }, [toast, load, checkSubscription]);

  const active = useMemo(() => teams.find((t) => t.id === activeId) ?? null, [teams, activeId]);
  const roster = useMemo(
    () => members.filter((m) => m.team_id === activeId)
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0)),
    [members, activeId],
  );
  const pending = useMemo(() => invites.filter((i) => i.team_id === activeId), [invites, activeId]);
  const myRole = roster.find((m) => m.is_self)?.role ?? null;
  const isOwner = myRole === "owner";
  const isAdmin = isOwner || myRole === "admin";
  const occupied = roster.length + pending.length;
  const seatsFull = !!active && occupied >= active.seat_quantity;

  const workspaceCents = quoteCents(ppp, "team_workspace", term).cents;
  const seatCents = quoteCents(ppp, "team_seat", term).cents;
  const createTotal = workspaceCents + seatCents * newSeats;

  const run = useCallback(async (key: string, body: Record<string, unknown>, done?: string) => {
    setBusy(key);
    try {
      const data = await call(body);
      if (done) toast({ title: done });
      await load();
      await checkSubscription();
      return data;
    } catch (e) {
      toast({ title: "Rejected", description: (e as Error).message, variant: "destructive" });
      return null;
    } finally {
      setBusy(null);
    }
  }, [call, load, toast, checkSubscription]);

  const startCheckout = async () => {
    if (newName.trim().length < 2) {
      toast({ title: "Name the workspace", description: "Two characters or more.", variant: "destructive" });
      return;
    }
    setBusy("checkout");
    try {
      const { data, error } = await supabase.functions.invoke("team-checkout", {
        body: { name: newName.trim(), description: newDesc.trim(), icon: newIcon, seats: newSeats, term },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No checkout session was returned.");
      window.location.href = data.url;
    } catch (e) {
      toast({ title: "Checkout could not start", description: (e as Error).message, variant: "destructive" });
      setBusy(null);
    }
  };

  const sendInvite = async () => {
    const data = await run("invite", {
      action: "invite", team_id: activeId, email: inviteEmail.trim(), role: inviteRole,
    });
    if (!data) return;
    setInviteEmail("");
    setLastInviteLink(data.accept_url ?? null);
    toast({
      title: data.emailed ? "Invitation sent" : "Invitation created — email not delivered",
      description: data.emailed
        ? `Mail service accepted it (HTTP ${data.email_status}).`
        : "Copy the accept link below and send it yourself.",
      variant: data.emailed ? undefined : "destructive",
    });
  };

  /* ── render ── */

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  const invitePanel = myInvites.length > 0 && (
    <div className="mb-5 rounded-2xl border border-foreground/20 bg-foreground/[0.04] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">◈ Invitations</p>
      <div className="mt-3 space-y-2">
        {myInvites.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background/40 px-4 py-3">
            <div>
              <p className="text-sm font-light text-foreground">{inv.team?.name ?? "A workspace"}</p>
              <p className="text-[11px] font-extralight text-muted-foreground">
                Joining as {inv.role} · expires in {daysLeft(inv.expires_at)} days
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => run(`accept-${inv.id}`, { action: "accept", invite_id: inv.id }, "You are on the workspace")}
                disabled={busy === `accept-${inv.id}`}
                className="rounded-full bg-foreground px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-background disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => run(`decline-${inv.id}`, { action: "decline", invite_id: inv.id }, "Invitation declined")}
                disabled={busy === `decline-${inv.id}`}
                className="rounded-full border border-foreground/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-foreground/70 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (creating || teams.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="mx-auto w-full max-w-3xl p-5 sm:p-8">
          {invitePanel}
          {!v2 && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Asherin Team</p>
              <h2 className="mt-3 text-3xl font-extralight tracking-tight text-foreground">
                Your company workspace on asherin.
              </h2>
            </>
          )}
          <p className="mt-3 max-w-xl text-sm font-extralight leading-relaxed text-muted-foreground">
            One workspace fee, one price per occupied seat. You are billed as the owner — the people
            you invite never enter a card, and they work at Pro-class limits for as long as the
            workspace stays active. Guardian Vault items, provider keys, and private chats stay
            personal on every seat.
          </p>

          <div className="mt-7 rounded-2xl border border-foreground/10 bg-background/40 p-6 backdrop-blur-2xl">
            <label className="block text-[10px] uppercase tracking-[0.25em] text-foreground/50">Workspace name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Northwind Research"
              maxLength={60}
              className="mt-2 w-full rounded-xl border border-foreground/15 bg-background/60 px-4 py-3 text-sm font-light text-foreground outline-none focus:border-foreground/40"
            />

            <label className="mt-5 block text-[10px] uppercase tracking-[0.25em] text-foreground/50">Description</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What this team works on"
              maxLength={240}
              className="mt-2 w-full rounded-xl border border-foreground/15 bg-background/60 px-4 py-3 text-sm font-light text-foreground outline-none focus:border-foreground/40"
            />

            <label className="mt-5 block text-[10px] uppercase tracking-[0.25em] text-foreground/50">Mark</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEAM_ICONS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => setNewIcon(label)}
                  aria-pressed={newIcon === label}
                  className={`rounded-xl border p-2.5 transition-colors ${
                    newIcon === label ? "border-foreground/50 bg-foreground/10" : "border-foreground/10 hover:bg-foreground/5"
                  }`}
                >
                  <Icon className="h-4 w-4 text-foreground/70" />
                </button>
              ))}
            </div>

            <label className="mt-6 block text-[10px] uppercase tracking-[0.25em] text-foreground/50">Seats</label>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => setNewSeats((s) => Math.max(TEAM_MIN_SEATS, s - 1))}
                className="rounded-full border border-foreground/20 p-2 text-foreground/70 hover:bg-foreground/5"
                aria-label="Remove a seat"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center text-xl font-extralight text-foreground">{newSeats}</span>
              <button
                onClick={() => setNewSeats((s) => Math.min(500, s + 1))}
                className="rounded-full border border-foreground/20 p-2 text-foreground/70 hover:bg-foreground/5"
                aria-label="Add a seat"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-extralight text-muted-foreground">
                Minimum {TEAM_MIN_SEATS} — you plus one invite slot.
              </span>
            </div>

            <div role="radiogroup" aria-label="Billing term" className="mt-6 inline-flex rounded-full border border-foreground/15 bg-background/50 p-1">
              {(["monthly", "semiannual"] as const).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={term === t}
                  onClick={() => setTerm(t)}
                  className={`rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    term === t ? "bg-foreground text-background" : "text-foreground/60"
                  }`}
                >
                  {t === "monthly" ? "Monthly" : "6 months"}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
              <div className="flex items-center justify-between text-sm font-extralight text-muted-foreground">
                <span>Workspace</span><span>{formatUsd(workspaceCents)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm font-extralight text-muted-foreground">
                <span>{newSeats} seats × {formatUsd(seatCents)}</span><span>{formatUsd(seatCents * newSeats)}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-foreground/10 pt-3">
                <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/50">
                  {term === "monthly" ? "Per month" : "Charged once, covers 6 months"}
                </span>
                <span className="text-2xl font-extralight text-foreground">{formatUsd(createTotal)}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={startCheckout}
                disabled={busy === "checkout"}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-background disabled:opacity-60"
              >
                {busy === "checkout" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                Start the team — {formatUsd(createTotal)}
              </button>
              {teams.length > 0 && (
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-full border border-foreground/20 px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-foreground/70"
                >
                  Back
                </button>
              )}
            </div>
            <p className="mt-3 text-[11px] font-extralight text-muted-foreground/70">
              Seat changes later land on the same invoice as prorated lines.
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const ActiveIcon = iconFor(active?.icon ?? null);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* roster of workspaces */}
      {v2 && teams.length < 2 && (
        <V2Action>
          <button onClick={() => setCreating(true)} className={v2ActionClass}>
            <Plus className="h-3.5 w-3.5" /> new workspace
          </button>
        </V2Action>
      )}
      {(!v2 || teams.length > 1) && (
      <aside className="shrink-0 border-b border-foreground/10 p-3 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Workspaces</p>
          <button onClick={() => setCreating(true)} aria-label="Start a team" className="rounded-full p-1.5 hover:bg-foreground/5">
            <Plus className="h-3.5 w-3.5 text-foreground/60" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
          {teams.map((t) => {
            const Icon = iconFor(t.icon);
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`flex w-full min-w-[180px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  t.id === activeId ? "bg-foreground/10" : "hover:bg-foreground/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground/60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-light text-foreground">{t.name}</span>
                  <span className="block text-[10px] font-extralight text-muted-foreground">
                    {t.billing_status === "active" ? "active" : t.billing_status}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-4xl p-5 sm:p-8">
          {invitePanel}

          {active && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-foreground/15 bg-foreground/[0.04] p-3">
                    <ActiveIcon className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extralight tracking-tight text-foreground">{active.name}</h2>
                    <p className="mt-1 text-sm font-extralight text-muted-foreground">
                      {active.description || "No description."}
                    </p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/40">
                      {occupied} of {active.seat_quantity} seats · you are {myRole}
                    </p>
                  </div>
                </div>
                {active.billing_status !== "active" && (
                  <span className="rounded-full border border-foreground/30 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-foreground/70">
                    billing {active.billing_status}
                  </span>
                )}
              </div>

              {/* invite */}
              {isAdmin && (
                <section className="mt-8 rounded-2xl border border-foreground/10 bg-background/40 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Invite</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="min-w-0 flex-1 rounded-xl border border-foreground/15 bg-background/60 px-4 py-2.5 text-sm font-light text-foreground outline-none focus:border-foreground/40"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-xl border border-foreground/15 bg-background/60 px-3 py-2.5 text-sm font-light text-foreground outline-none"
                    >
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      onClick={sendInvite}
                      disabled={busy === "invite" || seatsFull || !inviteEmail.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-background disabled:opacity-50"
                    >
                      {busy === "invite" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      Invite
                    </button>
                  </div>
                  {seatsFull && (
                    <p className="mt-2 text-[11px] font-extralight text-foreground/70">
                      All {active.seat_quantity} seats are taken by members and pending invites.
                      {isOwner ? " Add a seat below to invite more." : " Ask the owner to add a seat."}
                    </p>
                  )}
                  {lastInviteLink && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(lastInviteLink); toast({ title: "Accept link copied" }); }}
                      className="mt-3 inline-flex items-center gap-2 text-[11px] font-extralight text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" /> Copy the accept link
                    </button>
                  )}
                </section>
              )}

              {/* roster */}
              <section className="mt-6 rounded-2xl border border-foreground/10 bg-background/40 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ People</p>
                <div className="mt-3 space-y-2">
                  {roster.map((m) => {
                    const RoleIcon = ROLE_ICON[m.role] ?? Users;
                    return (
                      <div key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-background/50 px-4 py-3">
                        <RoleIcon className="h-4 w-4 shrink-0 text-foreground/60" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-light text-foreground">
                            {m.display_name || m.email || "Member"}{m.is_self && " (you)"}
                          </p>
                          <p className="truncate text-[11px] font-extralight text-muted-foreground">
                            {maskEmail(m.email)} · {m.role}
                          </p>
                        </div>
                        {isAdmin && m.role !== "owner" && (
                          <select
                            value={m.role}
                            onChange={(e) => run(`role-${m.user_id}`, {
                              action: "change_role", team_id: active.id, user_id: m.user_id, role: e.target.value,
                            }, "Role updated")}
                            disabled={busy === `role-${m.user_id}`}
                            className="rounded-lg border border-foreground/15 bg-background/60 px-2 py-1.5 text-[11px] font-light text-foreground"
                          >
                            <option value="admin">admin</option>
                            <option value="member">member</option>
                            <option value="viewer">viewer</option>
                          </select>
                        )}
                        {isOwner && m.role !== "owner" && (
                          <button
                            onClick={() => run(`transfer-${m.user_id}`, {
                              action: "transfer_owner", team_id: active.id, user_id: m.user_id,
                            }, "Ownership transferred")}
                            title="Transfer ownership"
                            className="rounded-lg border border-foreground/15 p-1.5 text-foreground/60 hover:bg-foreground/5"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isAdmin && m.role !== "owner" && !m.is_self && (
                          <button
                            onClick={() => run(`rm-${m.user_id}`, {
                              action: "remove_member", team_id: active.id, user_id: m.user_id,
                            }, "Removed from the workspace")}
                            title="Remove"
                            className="rounded-lg border border-foreground/15 p-1.5 text-foreground/60 hover:bg-foreground/5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {pending.length > 0 && (
                  <>
                    <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Pending</p>
                    <div className="mt-3 space-y-2">
                      {pending.map((inv) => (
                        <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-foreground/15 px-4 py-3">
                          <Mail className="h-4 w-4 text-foreground/50" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-light text-foreground">{inv.email}</p>
                            <p className="text-[11px] font-extralight text-muted-foreground">
                              <Clock className="mr-1 inline h-3 w-3" />
                              {inv.role} · expires in {daysLeft(inv.expires_at)} days
                            </p>
                          </div>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => run(`resend-${inv.id}`, {
                                  action: "resend", team_id: active.id, invite_id: inv.id,
                                }, "Invitation refreshed")}
                                className="rounded-lg border border-foreground/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/70"
                              >
                                Resend
                              </button>
                              <button
                                onClick={() => run(`revoke-${inv.id}`, {
                                  action: "revoke", team_id: active.id, invite_id: inv.id,
                                }, "Invitation revoked")}
                                className="rounded-lg border border-foreground/15 p-1.5 text-foreground/60"
                                title="Revoke"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* billing — owner only */}
              {isOwner && (
                <section className="mt-6 rounded-2xl border border-foreground/10 bg-background/40 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Billing and seats</p>
                  <p className="mt-2 text-sm font-extralight text-muted-foreground">
                    {formatUsd(workspaceCents)} workspace + {formatUsd(seatCents)} per seat.
                    Seat changes are prorated onto this invoice.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setSeatDraft((d) => Math.max(Math.max(TEAM_MIN_SEATS, occupied), (d ?? active.seat_quantity) - 1))}
                      className="rounded-full border border-foreground/20 p-2 text-foreground/70"
                      aria-label="Remove a seat"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-xl font-extralight text-foreground">
                      {seatDraft ?? active.seat_quantity}
                    </span>
                    <button
                      onClick={() => setSeatDraft((d) => Math.min(500, (d ?? active.seat_quantity) + 1))}
                      className="rounded-full border border-foreground/20 p-2 text-foreground/70"
                      aria-label="Add a seat"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    {seatDraft != null && seatDraft !== active.seat_quantity && (
                      <button
                        onClick={async () => {
                          await run("seats", { action: "set_seats", team_id: active.id, seats: seatDraft }, "Seats updated");
                          setSeatDraft(null);
                        }}
                        disabled={busy === "seats"}
                        className="rounded-full bg-foreground px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-background disabled:opacity-50"
                      >
                        {busy === "seats" ? "Updating…" : `Set ${seatDraft} seats`}
                      </button>
                    )}
                  </div>

                  <div className="mt-6 border-t border-foreground/10 pt-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/50">Delete this workspace</p>
                    <p className="mt-1 text-[11px] font-extralight text-muted-foreground">
                      Cancels the subscription and detaches every member. Their personal chats, vault,
                      and keys stay with them.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={`Type "${active.name}" to confirm`}
                        className="min-w-0 flex-1 rounded-xl border border-foreground/15 bg-background/60 px-4 py-2.5 text-sm font-light text-foreground outline-none"
                      />
                      <button
                        onClick={async () => {
                          const done = await run("delete", {
                            action: "delete_workspace", team_id: active.id, confirm_name: deleteConfirm,
                          }, "Workspace deleted");
                          if (done) { setDeleteConfirm(""); setActiveId(null); }
                        }}
                        disabled={busy === "delete" || deleteConfirm !== active.name}
                        className="rounded-xl border border-foreground/30 px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-foreground disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {!isOwner && (
                <section className="mt-6 rounded-2xl border border-foreground/10 bg-background/40 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ Billing</p>
                  <p className="mt-2 text-sm font-extralight text-muted-foreground">
                    Asherin Team — billed to the workspace owner. You are not charged for this seat, and
                    your Pro-class access lasts as long as the workspace stays active.
                  </p>
                  <button
                    onClick={() => run("leave", { action: "leave", team_id: active.id }, "You left the workspace")}
                    disabled={busy === "leave"}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-foreground/70"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Leave workspace
                  </button>
                </section>
              )}

              {/* enforced role matrix */}
              <section className="mt-6 rounded-2xl border border-foreground/10 bg-background/40 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ What each role can do</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {ROLE_MATRIX.map((r) => (
                    <div key={r.role} className="rounded-xl border border-foreground/10 p-4">
                      <p className="text-sm font-light text-foreground">{r.role}</p>
                      <ul className="mt-2 space-y-1">
                        {r.can.map((c) => (
                          <li key={c} className="flex gap-2 text-[12px] font-extralight text-muted-foreground">
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-foreground/60" />{c}
                          </li>
                        ))}
                        {r.cannot.map((c) => (
                          <li key={c} className="flex gap-2 text-[12px] font-extralight text-muted-foreground/60">
                            <X className="mt-0.5 h-3 w-3 shrink-0 text-foreground/30" />{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] font-extralight text-muted-foreground/70">
                  Guardian Vault items, provider keys, connected mailboxes, private chats, memory, and
                  dashboard appearance stay account-scoped on every seat — a team never reads them.
                </p>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TeamsView;
