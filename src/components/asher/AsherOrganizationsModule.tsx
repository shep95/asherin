import { useEffect, useState } from "react";
import { Building2, Plus, Users, Network, ScrollText, ChevronRight, Mail, Copy, X, Check, Loader2 } from "lucide-react";
import {
  isSuperOwner, listOrgs, createOrg, listDepartments, createDepartment,
  listSections, createSection, listTeams, createTeam,
  listMemberships, listInvitations, createInvitation, revokeInvitation,
  listAudit, inviteLink, ROLE_LABEL,
  type AsherRole, type AsherClassification,
} from "@/lib/asherOrgs";
import { toast } from "sonner";

type Tab = "overview" | "structure" | "members" | "invites" | "audit";
type Org = { id: string; name: string; code: string | null; org_type: string | null; country: string | null; max_classification: string; status: string; created_at: string };
type Dept = { id: string; org_id: string; name: string; code: string | null; description: string | null };
type Section = { id: string; department_id: string; name: string };
type Team = { id: string; section_id: string; name: string; focus: string | null };

const ROLES: AsherRole[] = ["primary_admin","secondary_admin","dept_admin","officer","analyst"];
const CLASS: AsherClassification[] = ["UNCLASSIFIED","CUI","CONFIDENTIAL","SECRET","TOP_SECRET","TS_SCI"];

export default function AsherOrganizationsModule() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  useEffect(() => { (async () => {
    const ok = await isSuperOwner();
    setAllowed(ok);
    if (ok) await refresh();
    setLoading(false);
  })(); }, []);

  const refresh = async () => {
    try {
      const data = await listOrgs();
      setOrgs(data as Org[]);
      if (!activeOrg && data.length) setActiveOrg(data[0] as Org);
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (allowed === false) return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm font-light tracking-[0.2em] text-foreground uppercase mb-2">Restricted</p>
        <p className="text-xs font-light text-muted-foreground">This module is reserved for the Super Owner.</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Org list */}
      <div className="w-64 border-r border-border/15 bg-sidebar/40 backdrop-blur-xl flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-border/15 flex items-center justify-between">
          <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Organizations</p>
          <button onClick={() => setShowCreateOrg(true)} className="p-1 rounded hover:bg-foreground/10" title="New organization">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {orgs.length === 0 && (
            <p className="text-[11px] text-muted-foreground/50 px-2 py-3">No organizations yet.</p>
          )}
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => { setActiveOrg(o); setTab("overview"); }}
              className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${activeOrg?.id === o.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-xs font-light truncate">{o.name}</span>
              </div>
              {o.code && <p className="text-[9px] tracking-[0.15em] text-muted-foreground/50 mt-0.5 ml-5 uppercase">{o.code}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeOrg ? (
          <>
            <header className="border-b border-border/15 px-6 py-4 bg-background/40">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extralight tracking-[0.2em] text-foreground uppercase">{activeOrg.name}</h2>
                  <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase mt-1">
                    {activeOrg.org_type || "Organization"} · Max {activeOrg.max_classification} {activeOrg.country && `· ${activeOrg.country}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {(["overview","structure","members","invites","audit"] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={`text-[10px] font-light tracking-[0.2em] uppercase px-3 py-1.5 rounded-md ${tab===t ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto">
              {tab === "overview"  && <OverviewTab org={activeOrg} />}
              {tab === "structure" && <StructureTab org={activeOrg} />}
              {tab === "members"   && <MembersTab org={activeOrg} />}
              {tab === "invites"   && <InvitesTab org={activeOrg} />}
              {tab === "audit"     && <AuditTab org={activeOrg} />}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <button onClick={() => setShowCreateOrg(true)} className="text-xs font-light tracking-[0.2em] text-foreground border border-border/30 rounded-md px-4 py-2 hover:bg-foreground/5 uppercase">+ Create First Organization</button>
            </div>
          </div>
        )}
      </div>

      {showCreateOrg && (
        <CreateOrgDialog onClose={() => setShowCreateOrg(false)} onCreated={async (org) => { setShowCreateOrg(false); await refresh(); setActiveOrg(org as Org); }} />
      )}
    </div>
  );
}

function OverviewTab({ org }: { org: Org }) {
  const [counts, setCounts] = useState({ depts: 0, members: 0, pending: 0 });
  useEffect(() => { (async () => {
    const [d, m, i] = await Promise.all([listDepartments(org.id), listMemberships(org.id), listInvitations(org.id)]);
    setCounts({ depts: d.length, members: m.length, pending: (i as any[]).filter(x => x.status === "pending").length });
  })(); }, [org.id]);
  return (
    <div className="p-6 grid grid-cols-3 gap-4">
      {[
        { label: "Departments", val: counts.depts, icon: Network },
        { label: "Members",     val: counts.members, icon: Users },
        { label: "Pending Invites", val: counts.pending, icon: Mail },
      ].map((s) => (
        <div key={s.label} className="rounded-xl border border-border/15 bg-card/30 backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <s.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[9px] tracking-[0.2em] text-muted-foreground/50 uppercase">Live</span>
          </div>
          <p className="text-2xl font-extralight">{s.val}</p>
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function StructureTab({ org }: { org: Org }) {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [sections, setSections] = useState<Record<string, Section[]>>({});
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [teams, setTeams] = useState<Record<string, Team[]>>({});
  const [showAddDept, setShowAddDept] = useState(false);

  const refresh = async () => setDepts(await listDepartments(org.id) as Dept[]);
  useEffect(() => { refresh(); }, [org.id]);

  const toggleDept = async (id: string) => {
    setOpenDept(openDept === id ? null : id);
    if (!sections[id]) setSections(prev => ({ ...prev, [id]: [] }));
    const data = await listSections(id);
    setSections(prev => ({ ...prev, [id]: data as Section[] }));
  };
  const toggleSection = async (id: string) => {
    setOpenSection(openSection === id ? null : id);
    const data = await listTeams(id);
    setTeams(prev => ({ ...prev, [id]: data as Team[] }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Departments → Sections → Teams</h3>
        <button onClick={() => setShowAddDept(true)} className="flex items-center gap-1.5 text-[10px] font-light tracking-[0.2em] uppercase border border-border/30 rounded-md px-3 py-1.5 hover:bg-foreground/5">
          <Plus className="h-3 w-3" /> Department
        </button>
      </div>
      <div className="space-y-2">
        {depts.length === 0 && <p className="text-xs text-muted-foreground/50">No departments yet.</p>}
        {depts.map((d) => (
          <div key={d.id} className="rounded-lg border border-border/15 bg-card/20">
            <button onClick={() => toggleDept(d.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-foreground/5">
              <div className="flex items-center gap-2">
                <ChevronRight className={`h-3 w-3 transition-transform ${openDept===d.id ? "rotate-90" : ""}`} />
                <Network className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm font-light">{d.name}</span>
                {d.code && <span className="text-[9px] tracking-[0.2em] text-muted-foreground/50 uppercase">{d.code}</span>}
              </div>
            </button>
            {openDept === d.id && (
              <div className="px-4 pb-3 pl-9 space-y-1.5">
                <SectionAdder deptId={d.id} onCreated={() => toggleDept(d.id)} />
                {(sections[d.id] || []).map((s) => (
                  <div key={s.id}>
                    <button onClick={() => toggleSection(s.id)} className="w-full flex items-center gap-2 text-left text-xs font-light text-muted-foreground hover:text-foreground py-1">
                      <ChevronRight className={`h-3 w-3 transition-transform ${openSection===s.id ? "rotate-90" : ""}`} />
                      ◇ {s.name}
                    </button>
                    {openSection === s.id && (
                      <div className="ml-5 mt-1 space-y-1">
                        <TeamAdder sectionId={s.id} onCreated={() => toggleSection(s.id)} />
                        {(teams[s.id] || []).map((t) => (
                          <div key={t.id} className="text-[11px] font-light text-muted-foreground/80">▸ {t.name}{t.focus && <span className="text-muted-foreground/50"> — {t.focus}</span>}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {showAddDept && (
        <SimpleDialog title="New Department" onClose={() => setShowAddDept(false)}>
          <DeptForm orgId={org.id} onDone={async () => { setShowAddDept(false); await refresh(); }} />
        </SimpleDialog>
      )}
    </div>
  );
}

function SectionAdder({ deptId, onCreated }: { deptId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; try { await createSection(deptId, name.trim()); setName(""); onCreated(); toast.success("Section added"); } catch (err: any) { toast.error(err.message); } }} className="flex items-center gap-2">
      <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="+ Add section…" className="flex-1 bg-background/40 border border-border/20 rounded px-2 py-1 text-[11px] font-light focus:outline-none focus:border-foreground/40" />
      {name && <button type="submit" className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 border border-border/30 rounded hover:bg-foreground/5">Add</button>}
    </form>
  );
}
function TeamAdder({ sectionId, onCreated }: { sectionId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; try { await createTeam(sectionId, name.trim()); setName(""); onCreated(); toast.success("Team added"); } catch (err: any) { toast.error(err.message); } }} className="flex items-center gap-2">
      <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="+ Add team…" className="flex-1 bg-background/40 border border-border/20 rounded px-2 py-1 text-[10px] font-light focus:outline-none focus:border-foreground/40" />
      {name && <button type="submit" className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 border border-border/30 rounded hover:bg-foreground/5">Add</button>}
    </form>
  );
}

function DeptForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [desc, setDesc] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await createDepartment(orgId, { name, code: code || undefined, description: desc || undefined }); toast.success("Department created"); onDone(); } catch (err: any) { toast.error(err.message); } finally { setBusy(false); } }} className="space-y-3">
      <Field label="Name"><input required value={name} onChange={(e)=>setName(e.target.value)} className={inputCls} /></Field>
      <Field label="Code (optional)"><input value={code} onChange={(e)=>setCode(e.target.value)} className={inputCls} placeholder="HUMINT, CYBER…" /></Field>
      <Field label="Description"><textarea value={desc} onChange={(e)=>setDesc(e.target.value)} rows={2} className={inputCls} /></Field>
      <button disabled={busy} className="w-full bg-foreground/90 text-background rounded-md py-2 text-xs tracking-[0.2em] uppercase hover:bg-foreground disabled:opacity-50">{busy ? "Creating…" : "Create Department"}</button>
    </form>
  );
}

function MembersTab({ org }: { org: Org }) {
  const [members, setMembers] = useState<any[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  useEffect(() => { (async () => {
    setMembers(await listMemberships(org.id));
    setDepts(await listDepartments(org.id) as Dept[]);
  })(); }, [org.id]);
  return (
    <div className="p-6">
      <h3 className="text-xs font-light tracking-[0.25em] text-muted-foreground/70 uppercase mb-4">Members ({members.length})</h3>
      {members.length === 0 && <p className="text-xs text-muted-foreground/50">No members yet. Invite from the Invites tab.</p>}
      <div className="space-y-2">
        {members.map((m) => {
          const dept = depts.find(d => d.id === m.department_id);
          return (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/15 bg-card/20 px-4 py-3">
              <div>
                <p className="text-sm font-light">{m.full_name || m.user_id.slice(0,8)}</p>
                <p className="text-[10px] tracking-[0.15em] text-muted-foreground/60 uppercase mt-0.5">
                  {ROLE_LABEL[m.role as AsherRole]} {dept && `· ${dept.name}`} {m.rank && `· ${m.rank}`}
                </p>
              </div>
              <span className="text-[9px] tracking-[0.2em] text-muted-foreground/50 uppercase">{m.clearance || "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InvitesTab({ org }: { org: Org }) {
  const [invites, setInvites] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const refresh = async () => setInvites(await listInvitations(org.id));
  useEffect(() => { refresh(); }, [org.id]);
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Invitations</h3>
        <button onClick={() => setShow(true)} className="flex items-center gap-1.5 text-[10px] font-light tracking-[0.2em] uppercase border border-border/30 rounded-md px-3 py-1.5 hover:bg-foreground/5">
          <Plus className="h-3 w-3" /> Invite
        </button>
      </div>
      <div className="space-y-2">
        {invites.length === 0 && <p className="text-xs text-muted-foreground/50">No invitations.</p>}
        {invites.map((i) => (
          <div key={i.id} className="rounded-lg border border-border/15 bg-card/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-light">{i.email}</p>
                <p className="text-[10px] tracking-[0.15em] text-muted-foreground/60 uppercase mt-0.5">
                  {ROLE_LABEL[i.role as AsherRole]} · {i.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {i.status === "pending" && (
                  <>
                    <button onClick={() => { navigator.clipboard.writeText(inviteLink(i.token)); toast.success("Invite link copied"); }} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 border border-border/30 rounded hover:bg-foreground/5 flex items-center gap-1"><Copy className="h-3 w-3" /> Copy Link</button>
                    <button onClick={async () => { await revokeInvitation(i.id, org.id); toast.success("Revoked"); refresh(); }} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10"><X className="h-3 w-3" /></button>
                  </>
                )}
                {i.status === "accepted" && <Check className="h-3.5 w-3.5 text-green-400" />}
              </div>
            </div>
          </div>
        ))}
      </div>
      {show && <SimpleDialog title="Invite Member" onClose={() => setShow(false)}><InviteForm orgId={org.id} onDone={async () => { setShow(false); refresh(); }} /></SimpleDialog>}
    </div>
  );
}

function InviteForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [email, setEmail] = useState(""); const [fullName, setFullName] = useState(""); const [role, setRole] = useState<AsherRole>("analyst");
  const [rank, setRank] = useState(""); const [position, setPosition] = useState(""); const [clearance, setClearance] = useState<AsherClassification>("UNCLASSIFIED");
  const [deptId, setDeptId] = useState<string>(""); const [secId, setSecId] = useState<string>(""); const [teamId, setTeamId] = useState<string>("");
  const [depts, setDepts] = useState<Dept[]>([]); const [sections, setSections] = useState<Section[]>([]); const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listDepartments(orgId).then(d => setDepts(d as Dept[])); }, [orgId]);
  useEffect(() => { setSecId(""); setTeamId(""); if (deptId) listSections(deptId).then(s => setSections(s as Section[])); else setSections([]); }, [deptId]);
  useEffect(() => { setTeamId(""); if (secId) listTeams(secId).then(t => setTeams(t as Team[])); else setTeams([]); }, [secId]);

  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try {
        const inv = await createInvitation({ org_id: orgId, email, full_name: fullName || undefined, role, rank: rank || undefined, position: position || undefined, clearance, department_id: deptId || null, section_id: secId || null, team_id: teamId || null });
        navigator.clipboard.writeText(inviteLink(inv.token)).catch(()=>{});
        toast.success("Invitation created — link copied");
        onDone();
      } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
    }} className="space-y-3">
      <Field label="Email"><input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className={inputCls} /></Field>
      <Field label="Full Name"><input value={fullName} onChange={(e)=>setFullName(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <select value={role} onChange={(e)=>setRole(e.target.value as AsherRole)} className={inputCls}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Clearance">
          <select value={clearance} onChange={(e)=>setClearance(e.target.value as AsherClassification)} className={inputCls}>
            {CLASS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rank"><input value={rank} onChange={(e)=>setRank(e.target.value)} className={inputCls} /></Field>
        <Field label="Position"><input value={position} onChange={(e)=>setPosition(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Department">
        <select value={deptId} onChange={(e)=>setDeptId(e.target.value)} className={inputCls}>
          <option value="">— None —</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {sections.length > 0 && (
        <Field label="Section">
          <select value={secId} onChange={(e)=>setSecId(e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      {teams.length > 0 && (
        <Field label="Team">
          <select value={teamId} onChange={(e)=>setTeamId(e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      <button disabled={busy} className="w-full bg-foreground/90 text-background rounded-md py-2 text-xs tracking-[0.2em] uppercase hover:bg-foreground disabled:opacity-50">{busy ? "Creating…" : "Generate Invite Link"}</button>
    </form>
  );
}

function AuditTab({ org }: { org: Org }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listAudit(org.id, 200).then(setRows); }, [org.id]);
  return (
    <div className="p-6">
      <h3 className="text-xs font-light tracking-[0.25em] text-muted-foreground/70 uppercase mb-4 flex items-center gap-2"><ScrollText className="h-3.5 w-3.5" /> Audit Log</h3>
      <div className="space-y-1.5">
        {rows.length === 0 && <p className="text-xs text-muted-foreground/50">No audit events.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded border border-border/10 bg-card/20 px-3 py-2 text-[11px] font-light flex items-center justify-between">
            <div>
              <span className="text-foreground tracking-wide">{r.action}</span>
              <span className="text-muted-foreground/60 ml-2">{r.target_type}</span>
            </div>
            <span className="text-muted-foreground/40 text-[10px]">{new Date(r.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateOrgDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (o: any) => void }) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [type, setType] = useState(""); const [country, setCountry] = useState("");
  const [maxClass, setMaxClass] = useState<AsherClassification>("SECRET"); const [busy, setBusy] = useState(false);
  return (
    <SimpleDialog title="New Organization" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const o = await createOrg({ name, code: code || undefined, org_type: type || undefined, country: country || undefined, max_classification: maxClass }); toast.success("Organization created"); onCreated(o); } catch (err: any) { toast.error(err.message); } finally { setBusy(false); } }} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e)=>setName(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code"><input value={code} onChange={(e)=>setCode(e.target.value)} className={inputCls} placeholder="DOD-3" /></Field>
          <Field label="Type"><input value={type} onChange={(e)=>setType(e.target.value)} className={inputCls} placeholder="Defense Agency" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country"><input value={country} onChange={(e)=>setCountry(e.target.value)} className={inputCls} placeholder="US" /></Field>
          <Field label="Max Classification">
            <select value={maxClass} onChange={(e)=>setMaxClass(e.target.value as AsherClassification)} className={inputCls}>
              {CLASS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <button disabled={busy} className="w-full bg-foreground/90 text-background rounded-md py-2 text-xs tracking-[0.2em] uppercase hover:bg-foreground disabled:opacity-50">{busy ? "Creating…" : "Create Organization"}</button>
      </form>
    </SimpleDialog>
  );
}

const inputCls = "w-full bg-background/40 border border-border/30 rounded px-3 py-2 text-xs font-light focus:outline-none focus:border-foreground/40";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase mb-1.5">{label}</label>
      {children}
    </div>
  );
}
function SimpleDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border/30 bg-background/95 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-foreground/10 rounded"><X className="h-3.5 w-3.5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
