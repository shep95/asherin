import { useEffect, useState, useRef } from "react";
import { Lock, Send, Plus, Shield, Users, UserPlus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateIdentity, hasIdentity, unlockIdentity, getLocalPublicKey, fingerprintPubkey,
} from "@/lib/asherCrypto";
import {
  uploadPublicKey, listOperators, listConversations, fetchMessages, decryptInbox,
  sendMessage, createDM, createGroup, addMembers, listMembers, updateOwnPresence, softDeleteMessage,
  type Operator, type Conversation, type DecryptedMessage,
} from "@/lib/asherComms";
import { toast } from "sonner";

const AsherCommsModule = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [ops, setOps] = useState<Operator[]>([]);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<DecryptedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [activeMembers, setActiveMembers] = useState<string[]>([]);
  const passRef = useRef<string>("");

  const activeConvObj = convs.find(c => c.id === activeConv) ?? null;
  const isOwner = !!activeConvObj && activeConvObj.created_by === userId;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      setNeedsBootstrap(!(await hasIdentity(data.user.id)));
    });
  }, []);

  const bootstrap = async () => {
    if (!userId || passphrase.length < 8) { toast.error("Passphrase ≥ 8 chars"); return; }
    setBusy(true);
    try {
      let pubJwk: JsonWebKey | null;
      let fp: string;
      if (needsBootstrap) {
        const id = await generateIdentity(userId, passphrase);
        pubJwk = id.publicKeyJwk; fp = id.fingerprint;
        await uploadPublicKey(pubJwk, fp);
      } else {
        await unlockIdentity(userId, passphrase);
        pubJwk = await getLocalPublicKey(userId);
        fp = pubJwk ? await fingerprintPubkey(pubJwk) : "";
        if (pubJwk) await uploadPublicKey(pubJwk, fp);
      }
      passRef.current = passphrase;
      setUnlocked(true);
      setNeedsBootstrap(false);
      await updateOwnPresence("online");
      const [o, c] = await Promise.all([listOperators(), listConversations()]);
      setOps(o); setConvs(c);
      toast.success("Comms unlocked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unlock");
    } finally { setBusy(false); }
  };

  // Load messages on conv change + realtime subscribe
  useEffect(() => {
    if (!activeConv || !userId) return;
    let mounted = true;
    const load = async () => {
      const raw = await fetchMessages(activeConv);
      const dec = await decryptInbox(userId, passRef.current, raw);
      if (mounted) setMsgs(dec);
    };
    load();
    const ch = supabase.channel(`asher-msgs-${activeConv}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "asher_messages", filter: `conversation_id=eq.${activeConv}` },
        () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [activeConv, userId]);

  const send = async () => {
    if (!activeConv || !draft.trim()) return;
    setBusy(true);
    try {
      await sendMessage({ conversation_id: activeConv, plaintext: draft.trim() });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally { setBusy(false); }
  };

  const startDM = async (other: Operator) => {
    if (!userId || other.user_id === userId) return;
    try {
      const id = await createDM(other.user_id);
      const cs = await listConversations();
      setConvs(cs);
      setActiveConv(id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "DM failed"); }
  };

  // Load members of active conversation
  useEffect(() => {
    if (!activeConv) { setActiveMembers([]); return; }
    listMembers(activeConv).then(setActiveMembers).catch(() => setActiveMembers([]));
  }, [activeConv]);

  const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const submitNewGroup = async () => {
    if (!groupName.trim()) { toast.error("Group name required"); return; }
    if (groupSelected.size === 0) { toast.error("Select at least one operator"); return; }
    setBusy(true);
    try {
      const id = await createGroup({
        name: groupName.trim(),
        member_ids: Array.from(groupSelected),
      });
      const cs = await listConversations();
      setConvs(cs);
      setActiveConv(id);
      setShowNewGroup(false);
      setGroupName("");
      setGroupSelected(new Set());
      toast.success("Group created — invites sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Group failed");
    } finally { setBusy(false); }
  };

  const submitAddMembers = async () => {
    if (!activeConv || addSelected.size === 0) return;
    setBusy(true);
    try {
      await addMembers(activeConv, Array.from(addSelected));
      const m = await listMembers(activeConv);
      setActiveMembers(m);
      setShowAddMembers(false);
      setAddSelected(new Set());
      toast.success(`Added ${addSelected.size} operator(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally { setBusy(false); }
  };


  if (!unlocked) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/80">ASHER Secure Comms</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            {needsBootstrap
              ? "Generate your end-to-end encryption identity. This passphrase seals your private key on this device — server never sees it."
              : "Enter your passphrase to unlock your encryption identity."}
          </p>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase (min 8 chars)"
            className="w-full px-3 py-2 rounded-lg bg-background/60 border border-border/30 text-sm text-foreground"
            onKeyDown={(e) => { if (e.key === "Enter") bootstrap(); }}
          />
          <button
            onClick={bootstrap}
            disabled={busy}
            className="mt-3 w-full py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground text-xs tracking-[0.2em] uppercase border border-border/30 transition-colors"
          >
            {needsBootstrap ? "Generate Identity" : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r border-border/15 flex flex-col">
        <div className="p-3 border-b border-border/15 flex items-center justify-between">
          <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/70">Conversations</p>
          <button
            onClick={() => setShowNewGroup(true)}
            title="New group chat"
            className="p-1 rounded hover:bg-foreground/10 text-foreground/70"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 && (
            <p className="p-4 text-[10px] text-muted-foreground">No conversations. Start a DM below.</p>
          )}
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConv(c.id)}
              className={`w-full text-left px-3 py-2 text-xs border-b border-border/10 hover:bg-foreground/5 ${activeConv === c.id ? "bg-foreground/10" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-foreground/50" />
                <span className="text-foreground">{c.name ?? (c.kind === "dm" ? "Direct Message" : "Channel")}</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 tracking-[0.15em] uppercase">{c.classification}</div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border/15">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3 w-3 text-foreground/60" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/60">Operators</p>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {ops.filter(o => o.user_id !== userId).map((o) => (
              <button
                key={o.id}
                onClick={() => startDM(o)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] text-foreground/80 hover:bg-foreground/5"
                title="Open DM"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${o.status === "online" ? "bg-emerald-400" : "bg-foreground/20"}`} />
                <span>{o.callsign}</span>
                <span className="ml-auto text-[9px] text-muted-foreground">{o.clearance}</span>
              </button>
            ))}
            {ops.filter(o => o.user_id !== userId).length === 0 && (
              <p className="text-[10px] text-muted-foreground px-2">No other operators yet. Admin must invite users.</p>
            )}
          </div>
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 flex flex-col">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Select a conversation or start a DM with an operator.
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-border/15 flex items-center gap-2 bg-card/20">
              <Lock className="h-3 w-3 text-emerald-400/70" />
              <span className="text-[11px] text-foreground/90">
                {activeConvObj?.name ?? (activeConvObj?.kind === "dm" ? "Direct Message" : "Conversation")}
              </span>
              <span className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase">
                · E2E · {activeMembers.length} member{activeMembers.length === 1 ? "" : "s"}
              </span>
              {activeConvObj && activeConvObj.kind !== "dm" && isOwner && (
                <button
                  onClick={() => { setAddSelected(new Set()); setShowAddMembers(true); }}
                  className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] uppercase tracking-[0.15em] text-foreground/80 hover:bg-foreground/10 border border-border/20"
                  title="Invite users to this group"
                >
                  <UserPlus className="h-3 w-3" /> Invite
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.map((m) => (
                <div key={m.id} className={`group max-w-xl ${m.sender_id === userId ? "ml-auto" : ""}`}>
                  <div className="flex items-start gap-1.5">
                    <div className={`flex-1 px-3 py-2 rounded-xl text-sm ${m.sender_id === userId ? "bg-foreground/10 text-foreground" : "bg-card/40 border border-border/15 text-foreground/90"}`}>
                      {m.body}
                    </div>
                    {m.sender_id === userId && (
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this message? It can be recovered for 30 days.")) return;
                          try {
                            await softDeleteMessage(m.id);
                            setMsgs(prev => prev.filter(x => x.id !== m.id));
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-destructive transition-opacity p-1 mt-1"
                        title="Delete message (recoverable 30d)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 tracking-[0.1em] uppercase">
                    {new Date(m.created_at).toLocaleTimeString()} · {m.classification}
                  </div>
                </div>
              ))}
              {msgs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8">No messages yet — encrypted channel ready.</p>
              )}
            </div>
            <div className="p-3 border-t border-border/15 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type encrypted message…"
                className="flex-1 px-3 py-2 rounded-lg bg-background/60 border border-border/30 text-sm text-foreground"
              />
              <button
                onClick={send}
                disabled={busy || !draft.trim()}
                className="p-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 border border-border/30 text-foreground"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/90 backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] tracking-[0.3em] uppercase text-foreground/80">New Group Chat</p>
              <button onClick={() => setShowNewGroup(false)} className="p-1 hover:bg-foreground/10 rounded">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Field Team Alpha)"
              className="w-full px-3 py-2 rounded-lg bg-background/60 border border-border/30 text-sm text-foreground mb-3"
            />
            <p className="text-[10px] tracking-[0.2em] uppercase text-foreground/60 mb-2">Invite Operators</p>
            <div className="max-h-60 overflow-y-auto space-y-1 mb-3 border border-border/15 rounded-lg p-2">
              {ops.filter(o => o.user_id !== userId).map((o) => (
                <label key={o.id} className="flex items-center gap-2 px-2 py-1 rounded text-[12px] hover:bg-foreground/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupSelected.has(o.user_id)}
                    onChange={() => toggleSet(groupSelected, o.user_id, setGroupSelected)}
                  />
                  <span className={`h-1.5 w-1.5 rounded-full ${o.status === "online" ? "bg-emerald-400" : "bg-foreground/20"}`} />
                  <span className="text-foreground/90">{o.callsign}</span>
                  <span className="ml-auto text-[9px] text-muted-foreground">{o.clearance}</span>
                </label>
              ))}
              {ops.filter(o => o.user_id !== userId).length === 0 && (
                <p className="text-[10px] text-muted-foreground p-2">No other operators available.</p>
              )}
            </div>
            <button
              onClick={submitNewGroup}
              disabled={busy}
              className="w-full py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground text-xs tracking-[0.2em] uppercase border border-border/30"
            >
              Create Group & Send Invites
            </button>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembers && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/90 backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] tracking-[0.3em] uppercase text-foreground/80">Invite to Group</p>
              <button onClick={() => setShowAddMembers(false)} className="p-1 hover:bg-foreground/10 rounded">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 mb-3 border border-border/15 rounded-lg p-2">
              {ops.filter(o => o.user_id !== userId && !activeMembers.includes(o.user_id)).map((o) => (
                <label key={o.id} className="flex items-center gap-2 px-2 py-1 rounded text-[12px] hover:bg-foreground/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addSelected.has(o.user_id)}
                    onChange={() => toggleSet(addSelected, o.user_id, setAddSelected)}
                  />
                  <span className={`h-1.5 w-1.5 rounded-full ${o.status === "online" ? "bg-emerald-400" : "bg-foreground/20"}`} />
                  <span className="text-foreground/90">{o.callsign}</span>
                  <span className="ml-auto text-[9px] text-muted-foreground">{o.clearance}</span>
                </label>
              ))}
              {ops.filter(o => o.user_id !== userId && !activeMembers.includes(o.user_id)).length === 0 && (
                <p className="text-[10px] text-muted-foreground p-2">All operators are already members.</p>
              )}
            </div>
            <button
              onClick={submitAddMembers}
              disabled={busy || addSelected.size === 0}
              className="w-full py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground text-xs tracking-[0.2em] uppercase border border-border/30 disabled:opacity-40"
            >
              Send {addSelected.size || ""} Invite{addSelected.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsherCommsModule;
