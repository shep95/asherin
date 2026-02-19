import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Users, Mail, Shield, Crown, Eye, BarChart3, UserPlus, X, Check, Clock, Trash2,
  Building2, Briefcase, Globe, Lock, Server, FileText, Cpu, Layers, Pencil, Settings,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Team {
  id: string;
  name: string;
  description: string;
  icon: string;
  owner_id: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
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

const getTeamIcon = (iconStr: string) => {
  const found = TEAM_ICONS.find(i => i.label === iconStr);
  return found?.icon ?? Building2;
};

const roleIcons: Record<string, React.ElementType> = { owner: Crown, admin: Shield, analyst: BarChart3, viewer: Eye };
const roleColors: Record<string, string> = { owner: "text-foreground/80", admin: "text-foreground/60", analyst: "text-foreground/50", viewer: "text-muted-foreground" };

const TeamsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Record<string, TeamMember[]>>({});
  const [invites, setInvites] = useState<Record<string, TeamInvite[]>>({});
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIcon, setNewIcon] = useState("building");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIcon, setEditIcon] = useState("building");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [loading, setLoading] = useState(true);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    const { data: teamData } = await (supabase.from as any)("teams").select("*").order("created_at", { ascending: false });
    setTeams(teamData ?? []);

    const { data: myInvites } = await (supabase.from as any)("team_invites").select("*").eq("status", "pending");
    setPendingInvites(myInvites ?? []);

    if (teamData) {
      const memberMap: Record<string, TeamMember[]> = {};
      const inviteMap: Record<string, TeamInvite[]> = {};
      for (const team of teamData) {
        const { data: mems } = await (supabase.from as any)("team_members").select("*").eq("team_id", team.id);
        memberMap[team.id] = mems ?? [];
        const { data: invs } = await (supabase.from as any)("team_invites").select("*").eq("team_id", team.id).eq("status", "pending");
        inviteMap[team.id] = invs ?? [];
      }
      setMembers(memberMap);
      setInvites(inviteMap);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const createTeam = async () => {
    if (!user || !newName.trim()) return;
    const { data: team, error } = await (supabase.from as any)("teams").insert({ name: newName.trim(), description: newDesc.trim(), icon: newIcon, owner_id: user.id }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (team) {
      await (supabase.from as any)("team_members").insert({ team_id: team.id, user_id: user.id, role: "owner" });
      await (supabase.from as any)("audit_log").insert({ user_id: user.id, team_id: team.id, action: "team_created", resource_type: "team", resource_id: team.id });
      toast({ title: "Team created", description: `${team.name} is ready.` });
      setNewName(""); setNewDesc(""); setNewIcon("building"); setShowCreate(false);
      loadTeams();
    }
  };

  const updateTeam = async () => {
    if (!user || !selectedTeam || !editName.trim()) return;
    const { error } = await (supabase.from as any)("teams").update({ name: editName.trim(), description: editDesc.trim(), icon: editIcon }).eq("id", selectedTeam);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await (supabase.from as any)("audit_log").insert({ user_id: user.id, team_id: selectedTeam, action: "team_updated", resource_type: "team", resource_id: selectedTeam });
    toast({ title: "Team updated" });
    setShowEdit(false);
    loadTeams();
  };

  const deleteTeam = async () => {
    if (!user || !selectedTeam) return;
    // Delete members, invites, then team
    await (supabase.from as any)("team_invites").delete().eq("team_id", selectedTeam);
    await (supabase.from as any)("team_members").delete().eq("team_id", selectedTeam);
    const { error } = await (supabase.from as any)("teams").delete().eq("id", selectedTeam);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await (supabase.from as any)("audit_log").insert({ user_id: user.id, action: "team_deleted", resource_type: "team", resource_id: selectedTeam });
    toast({ title: "Team deleted" });
    setSelectedTeam(null);
    setShowDeleteConfirm(false);
    loadTeams();
  };

  const sendInvite = async () => {
    if (!user || !selectedTeam || !inviteEmail.trim()) return;
    const { error } = await (supabase.from as any)("team_invites").insert({ team_id: selectedTeam, email: inviteEmail.trim().toLowerCase(), role: inviteRole, invited_by: user.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await (supabase.from as any)("audit_log").insert({ user_id: user.id, team_id: selectedTeam, action: "invite_sent", resource_type: "invite", details: { email: inviteEmail.trim() } });
    toast({ title: "Invite sent", description: `Invited ${inviteEmail} as ${inviteRole}.` });
    setInviteEmail(""); setShowInvite(false);
    loadTeams();
  };

  const acceptInvite = async (invite: TeamInvite) => {
    if (!user) return;
    await (supabase.from as any)("team_invites").update({ status: "accepted" }).eq("id", invite.id);
    await (supabase.from as any)("team_members").insert({ team_id: invite.team_id, user_id: user.id, role: invite.role });
    await (supabase.from as any)("audit_log").insert({ user_id: user.id, team_id: invite.team_id, action: "invite_accepted", resource_type: "invite", resource_id: invite.id });
    toast({ title: "Joined team" });
    loadTeams();
  };

  const declineInvite = async (invite: TeamInvite) => {
    await (supabase.from as any)("team_invites").update({ status: "declined" }).eq("id", invite.id);
    toast({ title: "Invite declined" });
    loadTeams();
  };

  const removeMember = async (teamId: string, memberId: string) => {
    if (!user) return;
    await (supabase.from as any)("team_members").delete().eq("id", memberId);
    await (supabase.from as any)("audit_log").insert({ user_id: user.id, team_id: teamId, action: "member_removed", resource_type: "member", resource_id: memberId });
    toast({ title: "Member removed" });
    loadTeams();
  };

  const openEdit = () => {
    if (!activeTeam) return;
    setEditName(activeTeam.name);
    setEditDesc(activeTeam.description);
    setEditIcon(activeTeam.icon || "building");
    setShowEdit(true);
  };

  const activeTeam = teams.find(t => t.id === selectedTeam);
  const activeMembers = selectedTeam ? (members[selectedTeam] ?? []) : [];
  const activeInvites = selectedTeam ? (invites[selectedTeam] ?? []) : [];
  const isOwner = activeTeam?.owner_id === user?.id;

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="text-sm font-extralight tracking-widest text-muted-foreground animate-pulse">Loading teams…</div></div>;

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-border/20">
        <div>
          <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">TEAM WORKSPACE</h1>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Collaborative intelligence operations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-xs font-light transition-colors">
          <Plus className="h-4 w-4" /> Create Team
        </button>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="px-6 pt-4 space-y-2">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Pending Invitations</p>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border/20 bg-card/20 p-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-light text-foreground">Team invitation</p>
                  <p className="text-[10px] text-muted-foreground">Role: {inv.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => acceptInvite(inv)} className="rounded-lg bg-foreground/10 p-1.5 text-foreground/70 hover:bg-foreground/20 transition-colors"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => declineInvite(inv)} className="rounded-lg bg-foreground/5 p-1.5 text-muted-foreground hover:bg-foreground/10 transition-colors"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Team list */}
        <div className="w-64 border-r border-border/20 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {teams.length === 0 && (
                <p className="text-xs text-muted-foreground/50 text-center py-8">No teams yet. Create one to get started.</p>
              )}
              {teams.map(team => {
                const IconComp = getTeamIcon(team.icon);
                return (
                  <button key={team.id} onClick={() => setSelectedTeam(team.id)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-light transition-colors ${selectedTeam === team.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}>
                    <div className="flex items-center gap-2">
                      <IconComp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{team.name}</p>
                        <p className="text-[10px] text-muted-foreground/50">{(members[team.id] ?? []).length} members</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Team detail */}
        <ScrollArea className="flex-1">
          {activeTeam ? (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => { const IC = getTeamIcon(activeTeam.icon); return <IC className="h-5 w-5 text-muted-foreground" />; })()}
                  <div>
                    <h2 className="text-base font-extralight tracking-wide text-foreground">{activeTeam.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{activeTeam.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <>
                      <button onClick={openEdit} className="flex items-center gap-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground px-3 py-2 text-xs font-light transition-colors">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 rounded-xl bg-foreground/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 px-3 py-2 text-xs font-light transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </>
                  )}
                  <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground/70 px-4 py-2 text-xs font-light transition-colors">
                    <UserPlus className="h-4 w-4" /> Invite
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="space-y-3">
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Members ({activeMembers.length})</p>
                <div className="space-y-1">
                  {activeMembers.map(mem => {
                    const RoleIcon = roleIcons[mem.role] ?? Eye;
                    return (
                      <div key={mem.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-card/20 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-light text-foreground">{mem.user_id === user?.id ? "You" : mem.user_id.slice(0, 8)}</p>
                            <div className="flex items-center gap-1.5">
                              <RoleIcon className={`h-3 w-3 ${roleColors[mem.role]}`} />
                              <p className={`text-[10px] capitalize ${roleColors[mem.role]}`}>{mem.role}</p>
                            </div>
                          </div>
                        </div>
                        {mem.role !== "owner" && isOwner && (
                          <button onClick={() => removeMember(activeTeam.id, mem.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pending invites for this team */}
              {activeInvites.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Pending Invites</p>
                  {activeInvites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-card/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-light text-foreground">{inv.email}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{inv.role} · Pending</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Role permissions reference */}
              <div className="rounded-xl border border-border/10 bg-card/10 p-4 space-y-3">
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Role Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { role: "Owner", desc: "Full access, manage team, delete" },
                    { role: "Admin", desc: "Add users, configure data sources" },
                    { role: "Analyst", desc: "Query, analyze, create notebooks" },
                    { role: "Viewer", desc: "Read-only access to reports" },
                  ].map(r => (
                    <div key={r.role} className="rounded-lg bg-card/20 p-2.5">
                      <p className="text-[10px] font-medium text-foreground">{r.role}</p>
                      <p className="text-[10px] text-muted-foreground/70">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-extralight text-muted-foreground">Select a team or create a new one</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Create Team Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/90 backdrop-blur-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-extralight tracking-wide text-foreground">Create Team</h3>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Team name" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Icon</p>
              <div className="flex flex-wrap gap-2">
                {TEAM_ICONS.map(({ icon: IC, label }) => (
                  <button key={label} onClick={() => setNewIcon(label)}
                    className={`rounded-xl p-2.5 transition-colors ${newIcon === label ? "bg-foreground/15 text-foreground" : "bg-card/20 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`}>
                    <IC className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={createTeam} disabled={!newName.trim()} className="rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-xs font-light transition-colors disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/90 backdrop-blur-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-extralight tracking-wide text-foreground">Edit Team</h3>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Team name" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Icon</p>
              <div className="flex flex-wrap gap-2">
                {TEAM_ICONS.map(({ icon: IC, label }) => (
                  <button key={label} onClick={() => setEditIcon(label)}
                    className={`rounded-xl p-2.5 transition-colors ${editIcon === label ? "bg-foreground/15 text-foreground" : "bg-card/20 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`}>
                    <IC className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowEdit(false)} className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={updateTeam} disabled={!editName.trim()} className="rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-xs font-light transition-colors disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && activeTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border/20 bg-card/90 backdrop-blur-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-extralight tracking-wide text-foreground">Delete Team</h3>
            <p className="text-xs text-muted-foreground">Permanently delete <span className="text-foreground">{activeTeam.name}</span>? All members and invites will be removed. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={deleteTeam} className="rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 text-xs font-light transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/90 backdrop-blur-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-extralight tracking-wide text-foreground">Invite Team Member</h3>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" type="email" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <div className="flex gap-2">
              {["admin", "analyst", "viewer"].map(r => (
                <button key={r} onClick={() => setInviteRole(r)} className={`rounded-xl px-3 py-1.5 text-[10px] capitalize transition-colors ${inviteRole === r ? "bg-foreground/15 text-foreground" : "bg-card/20 text-muted-foreground hover:text-foreground"}`}>{r}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInvite(false)} className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={sendInvite} disabled={!inviteEmail.trim()} className="rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground/70 px-4 py-2 text-xs font-light transition-colors disabled:opacity-40">Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsView;
