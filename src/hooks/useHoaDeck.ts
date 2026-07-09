// useHoaDeck — single hook that powers the live /asherin-gov/dashboard.
//
// Loads the signed-in user's servers → members → channels → messages
// straight from Supabase (RLS enforced). Subscribes to realtime on
// hoa_messages + hoa_audit so every operator's transmission arrives without
// polling. All mutations write to the same tables so the mothership
// trigger fans them into the Aureon training bus automatically.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Narrow column lists cut wire payload ~40% and let PostgREST index-only scan.
const SERVER_COLS  = "id,code,name,country,description,is_mothership,icon_url,api_key_provider,api_key_hint,api_key_updated_at";
const CHANNEL_COLS = "id,server_id,name,kind,min_clearance,topic,compartments";
const MEMBER_COLS  = "id,server_id,user_id,handle,rank_label,role,clearance_rank";
const MESSAGE_COLS = "id,server_id,channel_id,author_id,author_handle,body,compartments,sealed,pinned,created_at";
const AUDIT_COLS   = "id,server_id,actor_id,actor_handle,action,target,detail,created_at";

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

  // Ref-based active id so `loadTop` never re-creates on server switch.
  const activeServerIdRef = useRef<string | null>(null);
  activeServerIdRef.current = activeServerId;

  const loadTop = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      // Only pull the server list up front. Members are scoped per-server
      // below to avoid an O(all-servers × all-members) fan-out.
      const { data: srvs, error: srvErr } = await supabase
        .from("hoa_servers")
        .select(SERVER_COLS)
        .order("is_mothership", { ascending: false })
        .order("code");
      if (srvErr) throw srvErr;
      const list = (srvs ?? []) as HoaServer[];
      setServers(list);
      if (list.length > 0 && !activeServerIdRef.current) {
        const preferred = list.find(s => s.is_mothership) ?? list[0];
        setActiveServerId(preferred.id);
      }
    } catch (e: any) { setError(e?.message ?? "load failed"); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void loadTop(); }, [loadTop]);

  // Channels + members for the active server. Depending on activeChannelId
  // here would re-fetch every channel row on every channel click; we only
  // seed the default channel once per server.
  useEffect(() => {
    if (!activeServerId) { setChannels([]); setMembers([]); return; }
    let cancelled = false;
    (async () => {
      const [{ data: chs }, { data: mems }] = await Promise.all([
        supabase.from("hoa_channels").select(CHANNEL_COLS).eq("server_id", activeServerId).order("kind").order("name"),
        supabase.from("hoa_members").select(MEMBER_COLS).eq("server_id", activeServerId),
      ]);
      if (cancelled) return;
      const chList = (chs ?? []) as HoaChannel[];
      setChannels(chList);
      setMembers((mems ?? []) as HoaMember[]);
      // Only seed the default channel; do not clobber a user selection.
      setActiveChannelId(prev => (prev && chList.some(c => c.id === prev)) ? prev : (chList[0]?.id ?? null));
    })();
    return () => { cancelled = true; };
  }, [activeServerId]);

  // Messages + audit + realtime for the active server
  useEffect(() => {
    if (!activeServerId) { setMessages([]); setAudit([]); return; }
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: aud }] = await Promise.all([
        supabase.from("hoa_messages").select(MESSAGE_COLS).eq("server_id", activeServerId).order("created_at", { ascending: true }).limit(500),
        supabase.from("hoa_audit").select(AUDIT_COLS).eq("server_id", activeServerId).order("created_at", { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setMessages((msgs ?? []) as HoaMessage[]);
      setAudit((aud ?? []) as HoaAudit[]);
    })();

    const channel = supabase
      .channel(`hoa:${activeServerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hoa_messages", filter: `server_id=eq.${activeServerId}` },
        (payload) => setMessages(prev => {
          const next = payload.new as HoaMessage;
          // Dedupe: our own insert can race with the realtime echo.
          if (prev.some(m => m.id === next.id)) return prev;
          return [...prev, next];
        }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hoa_audit", filter: `server_id=eq.${activeServerId}` },
        (payload) => setAudit(prev => {
          const next = payload.new as HoaAudit;
          if (prev.some(a => a.id === next.id)) return prev;
          return [next, ...prev].slice(0, 200);
        }))
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
