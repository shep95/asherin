// useHoaDeck — single hook that powers the live /asherin-gov/dashboard.
//
// Loads the signed-in user's servers → members → channels → messages
// straight from Supabase (RLS enforced). Subscribes to realtime on
// hoa_messages + hoa_audit so every operator's transmission arrives without
// polling. All mutations write to the same tables so the mothership
// trigger fans them into the Aureon training bus automatically.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const CLEARANCE_LABELS = ["UNCLASS","CUI","CONFIDENTIAL","SECRET","TS"] as const;
export type ClearanceLabel = typeof CLEARANCE_LABELS[number];
export const rankToLabel = (n: number): ClearanceLabel => CLEARANCE_LABELS[Math.max(0, Math.min(4, n))];

export interface HoaServer {
  id: string; code: string; name: string; country: string | null;
  description: string | null; is_mothership: boolean;
  icon_url?: string | null;
  api_key_provider?: string | null;
  api_key_hint?: string | null;
  api_key_updated_at?: string | null;
}
export interface HoaChannel {
  id: string; server_id: string; name: string;
  kind: "text"|"voice"|"vault"|"broadcast";
  min_clearance: number; topic: string | null; compartments: string[];
}
export interface HoaMember {
  id: string; server_id: string; user_id: string; handle: string;
  rank_label: string; role: string; clearance_rank: number;
}
export interface HoaMessage {
  id: string; server_id: string; channel_id: string;
  author_id: string; author_handle: string; body: string;
  compartments: string[]; sealed: boolean; pinned: boolean; created_at: string;
}
export interface HoaAudit {
  id: string; server_id: string | null; actor_id: string | null;
  actor_handle: string | null; action: string; target: string | null;
  detail: string | null; created_at: string;
}

export function useHoaDeck() {
  const { user } = useAuth();
  const [servers,  setServers ] = useState<HoaServer[]>([]);
  const [members,  setMembers ] = useState<HoaMember[]>([]);
  const [channels, setChannels] = useState<HoaChannel[]>([]);
  const [messages, setMessages] = useState<HoaMessage[]>([]);
  const [audit,    setAudit   ] = useState<HoaAudit[]>([]);
  const [activeServerId,  setActiveServerId ] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);

  const loadTop = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const [{ data: srvs }, { data: mems }] = await Promise.all([
        supabase.from("hoa_servers").select("*").order("is_mothership", { ascending: false }).order("code"),
        supabase.from("hoa_members").select("*"),
      ]);
      setServers((srvs ?? []) as HoaServer[]);
      setMembers((mems ?? []) as HoaMember[]);
      if ((srvs ?? []).length > 0 && !activeServerId) {
        // Prefer the mothership if the user has access, else first.
        const preferred = srvs!.find(s => s.is_mothership) ?? srvs![0];
        setActiveServerId(preferred.id);
      }
    } catch (e: any) { setError(e?.message ?? "load failed"); }
    finally { setLoading(false); }
  }, [user, activeServerId]);

  useEffect(() => { void loadTop(); }, [loadTop]);

  // Channels for the active server
  useEffect(() => {
    if (!activeServerId) { setChannels([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("hoa_channels").select("*").eq("server_id", activeServerId).order("kind").order("name");
      if (!cancelled) {
        const list = (data ?? []) as HoaChannel[];
        setChannels(list);
        if (list.length > 0 && !list.some(c => c.id === activeChannelId)) {
          setActiveChannelId(list[0].id);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeServerId, activeChannelId]);

  // Messages + audit + realtime for the active server
  useEffect(() => {
    if (!activeServerId) { setMessages([]); setAudit([]); return; }
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: aud }] = await Promise.all([
        supabase.from("hoa_messages").select("*").eq("server_id", activeServerId).order("created_at", { ascending: true }).limit(500),
        supabase.from("hoa_audit").select("*").eq("server_id", activeServerId).order("created_at", { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setMessages((msgs ?? []) as HoaMessage[]);
      setAudit((aud ?? []) as HoaAudit[]);
    })();

    const channel = supabase
      .channel(`hoa:${activeServerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hoa_messages", filter: `server_id=eq.${activeServerId}` },
        (payload) => setMessages(prev => [...prev, payload.new as HoaMessage]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hoa_audit", filter: `server_id=eq.${activeServerId}` },
        (payload) => setAudit(prev => [payload.new as HoaAudit, ...prev].slice(0, 200)))
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeServerId]);

  const activeServer  = useMemo(() => servers.find(s => s.id === activeServerId)  ?? null, [servers, activeServerId]);
  const activeChannel = useMemo(() => channels.find(c => c.id === activeChannelId) ?? null, [channels, activeChannelId]);
  const myMembership  = useMemo(() =>
    activeServerId && user ? members.find(m => m.server_id === activeServerId && m.user_id === user.id) ?? null : null,
    [members, activeServerId, user]);
  const clearance = myMembership?.clearance_rank ?? -1;

  const canAccess = useCallback((c: HoaChannel | null) => {
    if (!c || !myMembership) return false;
    return myMembership.clearance_rank >= c.min_clearance;
  }, [myMembership]);

  const sendMessage = useCallback(async (body: string) => {
    if (!user || !activeServer || !activeChannel || !myMembership) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("hoa_messages").insert({
      server_id: activeServer.id,
      channel_id: activeChannel.id,
      author_id: user.id,
      author_handle: myMembership.handle,
      body: trimmed,
      compartments: activeChannel.compartments,
      sealed: activeChannel.kind === "vault",
      pinned: activeChannel.kind === "broadcast",
    });
    if (error) throw error;
    await supabase.from("hoa_audit").insert({
      server_id: activeServer.id,
      actor_id: user.id,
      actor_handle: myMembership.handle,
      action: activeChannel.kind === "broadcast" ? "BROADCAST_SENT" : "MSG_SENT",
      target: activeChannel.name,
    });
  }, [user, activeServer, activeChannel, myMembership]);

  const pushAudit = useCallback(async (action: string, target: string, detail?: string) => {
    if (!user || !activeServer || !myMembership) return;
    await supabase.from("hoa_audit").insert({
      server_id: activeServer.id, actor_id: user.id, actor_handle: myMembership.handle,
      action, target, detail: detail ?? null,
    });
  }, [user, activeServer, myMembership]);

  const switchServer  = useCallback((id: string) => { setActiveServerId(id); setActiveChannelId(null); }, []);
  const switchChannel = useCallback((id: string) => { setActiveChannelId(id); }, []);
  const refresh       = useCallback(async () => { await loadTop(); }, [loadTop]);

  return {
    user,
    loading, error,
    servers, members, channels, messages, audit,
    activeServer, activeChannel, myMembership, clearance,
    switchServer, switchChannel,
    canAccess, sendMessage, pushAudit,
    refresh,
  };
}
