// /asherin.gov/dashboard — Sovereign communications & coordination deck.
//
// Discord-parity layout adapted for government use:
//   Agencies (guilds) → Channels (text / voice / vault) → Transcript → Members
// Adds gov-specific primitives Discord does not have natively:
//   · Persistent classification banner (UNCLASS / CUI / CONFIDENTIAL / SECRET / TS)
//   · Per-channel minimum-clearance gate (channel is hidden below the operator's clearance)
//   · Encrypted "vault" channels (client-side sealed, message body redacted until unsealed)
//   · Immutable audit ledger (every send, join, unseal, broadcast)
//   · Emergency broadcast that pins across every visible channel
//   · Compartment tags (SCI-style handling caveats) on messages
//
// State is persisted to localStorage (`asherin.gov.dashboard.v1`) so the deck
// survives refresh. This is a frontend surface — no PII, no real classified
// data, seeded scenarios only.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Hash,
  Volume2,
  Lock,
  Radio,
  Search,
  Send,
  Users,
  Plus,
  AlertTriangle,
  Eye,
  EyeOff,
  Pin,
  ScrollText,
  ChevronLeft,
  Circle,
  Crown,
  Star,
} from "lucide-react";
import { getWallpaperSrc } from "@/lib/wallpapers";

// -----------------------------------------------------------------------------
// Clearance model
// -----------------------------------------------------------------------------
const CLEARANCE_LEVELS = ["UNCLASS", "CUI", "CONFIDENTIAL", "SECRET", "TS"] as const;
type Clearance = (typeof CLEARANCE_LEVELS)[number];
const clearanceRank = (c: Clearance) => CLEARANCE_LEVELS.indexOf(c);

const CLEARANCE_COLOR: Record<Clearance, string> = {
  UNCLASS: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  CUI: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  CONFIDENTIAL: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  SECRET: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  TS: "bg-red-500/15 text-red-300 border-red-500/30",
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type ChannelKind = "text" | "voice" | "vault" | "broadcast";

interface Channel {
  id: string;
  agencyId: string;
  name: string;
  kind: ChannelKind;
  minClearance: Clearance;
  compartments?: string[]; // e.g. ["NOFORN", "ORCON"]
  topic?: string;
}

interface Agency {
  id: string;
  code: string;   // 3-letter
  name: string;
  color: string;  // hex accent
}

interface Member {
  id: string;
  handle: string;
  rank: string;
  agencyId: string;
  clearance: Clearance;
  presence: "online" | "away" | "silent";
}

interface Message {
  id: string;
  channelId: string;
  authorId: string;
  ts: number;
  body: string;
  compartments?: string[];
  sealed?: boolean; // vault-channel messages start sealed
  pinned?: boolean;
}

interface AuditEntry {
  id: string;
  ts: number;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}

// -----------------------------------------------------------------------------
// Seed data (realistic scenarios — no live PII)
// -----------------------------------------------------------------------------
const AGENCIES: Agency[] = [
  { id: "def",  code: "DEF", name: "Department of Defense",       color: "#4a6a4a" },
  { id: "int",  code: "INT", name: "Intelligence Directorate",    color: "#8a6d3b" },
  { id: "sta",  code: "STA", name: "State & Diplomacy",           color: "#3b5a8a" },
  { id: "trs",  code: "TRS", name: "Treasury & Sanctions",        color: "#6b5a3b" },
  { id: "hls",  code: "HLS", name: "Homeland & Continuity",       color: "#7a3b3b" },
  { id: "jus",  code: "JUS", name: "Justice & Enforcement",       color: "#5a3b6b" },
];

const CHANNELS: Channel[] = [
  // DEF
  { id: "def-briefings",   agencyId: "def", name: "daily-briefings",       kind: "text",      minClearance: "CUI",         topic: "0600Z daily posture summary." },
  { id: "def-jocwatch",    agencyId: "def", name: "joc-watch",             kind: "text",      minClearance: "SECRET",      topic: "Joint Operations Center watch floor." },
  { id: "def-ops",         agencyId: "def", name: "ops-room-alpha",        kind: "voice",     minClearance: "SECRET" },
  { id: "def-vault",       agencyId: "def", name: "sealed-orders",         kind: "vault",     minClearance: "TS",          compartments: ["NOFORN", "ORCON"] },
  { id: "def-cast",        agencyId: "def", name: "emergency-broadcast",   kind: "broadcast", minClearance: "UNCLASS" },
  // INT
  { id: "int-osint",       agencyId: "int", name: "osint-desk",            kind: "text",      minClearance: "UNCLASS",     topic: "Zophiel OSINT feed handoff." },
  { id: "int-fusion",      agencyId: "int", name: "fusion-cell",           kind: "text",      minClearance: "SECRET",      topic: "All-source fusion analysts." },
  { id: "int-vault",       agencyId: "int", name: "hcs-vault",             kind: "vault",     minClearance: "TS",          compartments: ["HCS", "NOFORN"] },
  { id: "int-scif",        agencyId: "int", name: "scif-voice",            kind: "voice",     minClearance: "TS" },
  // STA
  { id: "sta-cables",      agencyId: "sta", name: "cable-traffic",         kind: "text",      minClearance: "CONFIDENTIAL", topic: "Post-to-post cable summaries." },
  { id: "sta-negot",       agencyId: "sta", name: "negotiations-room",     kind: "voice",     minClearance: "SECRET" },
  // TRS
  { id: "trs-sanctions",   agencyId: "trs", name: "sanctions-desk",        kind: "text",      minClearance: "CUI",         topic: "OFAC-style designation drafts." },
  { id: "trs-vault",       agencyId: "trs", name: "designation-vault",     kind: "vault",     minClearance: "SECRET" },
  // HLS
  { id: "hls-watch",       agencyId: "hls", name: "national-watch",        kind: "text",      minClearance: "CUI",         topic: "24/7 continuity watch floor." },
  { id: "hls-cast",        agencyId: "hls", name: "public-alert",          kind: "broadcast", minClearance: "UNCLASS" },
  // JUS
  { id: "jus-cases",       agencyId: "jus", name: "case-coordination",     kind: "text",      minClearance: "CUI",         topic: "Multi-district case sync." },
  { id: "jus-vault",       agencyId: "jus", name: "grand-jury-vault",      kind: "vault",     minClearance: "SECRET",      compartments: ["6E"] },
];

const MEMBERS: Member[] = [
  { id: "op-01", handle: "Sovereign.Actual",  rank: "Sovereign",        agencyId: "def", clearance: "TS",           presence: "online" },
  { id: "op-02", handle: "J3.Watch",          rank: "Watch Officer",    agencyId: "def", clearance: "SECRET",       presence: "online" },
  { id: "op-03", handle: "Zophiel.Analyst",   rank: "Senior Analyst",   agencyId: "int", clearance: "TS",           presence: "online" },
  { id: "op-04", handle: "Fusion.Lead",       rank: "Fusion Lead",      agencyId: "int", clearance: "SECRET",       presence: "away" },
  { id: "op-05", handle: "Cable.Desk",        rank: "Diplomatic",       agencyId: "sta", clearance: "CONFIDENTIAL", presence: "online" },
  { id: "op-06", handle: "Sanctions.Chief",   rank: "Designation Lead", agencyId: "trs", clearance: "SECRET",       presence: "silent" },
  { id: "op-07", handle: "Continuity.Watch",  rank: "NWO",              agencyId: "hls", clearance: "SECRET",       presence: "online" },
  { id: "op-08", handle: "Case.Coord",        rank: "Deputy AG",        agencyId: "jus", clearance: "SECRET",       presence: "online" },
  { id: "op-09", handle: "OSINT.Junior",      rank: "Analyst I",        agencyId: "int", clearance: "CUI",          presence: "online" },
];

const SEED_MESSAGES: Message[] = [
  { id: "m1", channelId: "def-briefings", authorId: "op-02", ts: Date.now() - 1000 * 60 * 42, body: "0600Z: three carrier groups on schedule, no new posture changes. All watch stations green.", pinned: true },
  { id: "m2", channelId: "def-briefings", authorId: "op-01", ts: Date.now() - 1000 * 60 * 30, body: "Acknowledge. Push AXRLEN 72h forecast to fusion-cell before 1200Z." },
  { id: "m3", channelId: "int-osint",     authorId: "op-09", ts: Date.now() - 1000 * 60 * 22, body: "Zophiel picked up 41 new mentions on the northern-border logistics query. Veracity median 0.71. Handing to fusion." },
  { id: "m4", channelId: "int-fusion",    authorId: "op-03", ts: Date.now() - 1000 * 60 * 18, body: "Correlated with sanctions-desk shipment manifest. Recommend a SECRET-level assessment before end of day." },
  { id: "m5", channelId: "sta-cables",    authorId: "op-05", ts: Date.now() - 1000 * 60 * 12, body: "Cable EMBASSY/2091 drafted. Awaiting sig from State POL/MIL before release." },
  { id: "m6", channelId: "trs-sanctions", authorId: "op-06", ts: Date.now() - 1000 * 60 * 9,  body: "Three shell entities queued for designation review. Vault entry created for evidentiary bundle." },
  { id: "m7", channelId: "hls-watch",     authorId: "op-07", ts: Date.now() - 1000 * 60 * 5,  body: "Continuity watch: no domestic red-flag. Weather advisory posted to public-alert broadcast." },
  { id: "m8", channelId: "jus-cases",     authorId: "op-08", ts: Date.now() - 1000 * 60 * 3,  body: "Multi-district sync at 1500Z. Case-coord channel will host." },
  { id: "m9", channelId: "def-vault",     authorId: "op-01", ts: Date.now() - 1000 * 60 * 55, body: "[SEALED] Directive 2026-07-09 alpha. Handling: NOFORN / ORCON. Unseal only in-role.", sealed: true, compartments: ["NOFORN","ORCON"] },
  { id: "m10", channelId: "int-vault",    authorId: "op-03", ts: Date.now() - 1000 * 60 * 48, body: "[SEALED] HCS bundle rev 4. Contains raw collection references. Unseal in briefing only.", sealed: true, compartments: ["HCS","NOFORN"] },
];

// -----------------------------------------------------------------------------
// Persistence
// -----------------------------------------------------------------------------
const STORAGE_KEY = "asherin.gov.dashboard.v1";

interface Persisted {
  messages: Message[];
  audit: AuditEntry[];
  operatorId: string;
  activeChannelId: string;
  banner: Clearance;
}

const loadState = (): Persisted => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed?.messages && parsed?.audit) return parsed;
    }
  } catch { /* ignore */ }
  return {
    messages: SEED_MESSAGES,
    audit: [
      { id: "a1", ts: Date.now() - 1000 * 60 * 60, actor: "SYSTEM", action: "DECK_INITIALIZED", target: "asherin.gov/dashboard" },
    ],
    operatorId: "op-01",
    activeChannelId: "def-briefings",
    banner: "SECRET",
  };
};

const saveState = (s: Persisted) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
};

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const channelIcon = (kind: ChannelKind) => {
  switch (kind) {
    case "text":      return Hash;
    case "voice":     return Volume2;
    case "vault":     return Lock;
    case "broadcast": return Radio;
  }
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
const AsherinGovDashboard = () => {
  const [state, setState] = useState<Persisted>(loadState);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [unsealed, setUnsealed] = useState<Set<string>>(new Set());
  const [membersOpen, setMembersOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const wallpaper = getWallpaperSrc("aureon");
  const operator = MEMBERS.find(m => m.id === state.operatorId)!;
  const activeChannel = CHANNELS.find(c => c.id === state.activeChannelId)!;
  const activeAgency = AGENCIES.find(a => a.id === activeChannel.agencyId)!;

  useEffect(() => {
    document.title = "Command Deck · asherin.gov";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Sovereign command deck: agency channels, clearance-gated rooms, encrypted vaults, immutable audit ledger.");
    // Also inject noindex so this dashboard never surfaces publicly.
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow, noarchive");
  }, []);

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.activeChannelId, state.messages.length]);

  const pushAudit = (action: string, target: string, detail?: string) => {
    setState(s => ({
      ...s,
      audit: [
        { id: crypto.randomUUID(), ts: Date.now(), actor: operator.handle, action, target, detail },
        ...s.audit,
      ].slice(0, 500),
    }));
  };

  const canAccess = (c: Channel) =>
    clearanceRank(operator.clearance) >= clearanceRank(c.minClearance);

  const visibleChannels = useMemo(
    () => CHANNELS.filter(c => c.agencyId === activeAgency.id && canAccess(c)),
    [activeAgency.id, operator.clearance],
  );

  const channelMessages = useMemo(() => {
    const list = state.messages.filter(m => m.channelId === state.activeChannelId);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(m => m.body.toLowerCase().includes(q));
  }, [state.messages, state.activeChannelId, search]);

  const agencyMembers = MEMBERS.filter(m => m.agencyId === activeAgency.id);

  const handleSend = () => {
    const body = draft.trim();
    if (!body || !canAccess(activeChannel)) return;
    if (activeChannel.kind === "broadcast" && operator.clearance !== "TS" && operator.rank !== "Sovereign") {
      pushAudit("BROADCAST_DENIED", activeChannel.name, "operator lacks broadcast authority");
      return;
    }
    const msg: Message = {
      id: crypto.randomUUID(),
      channelId: activeChannel.id,
      authorId: operator.id,
      ts: Date.now(),
      body,
      compartments: activeChannel.compartments,
      sealed: activeChannel.kind === "vault",
      pinned: activeChannel.kind === "broadcast",
    };
    setState(s => ({ ...s, messages: [...s.messages, msg] }));
    pushAudit(activeChannel.kind === "broadcast" ? "BROADCAST_SENT" : "MSG_SENT", activeChannel.name);
    setDraft("");
  };

  const handleUnseal = (m: Message) => {
    setUnsealed(prev => new Set(prev).add(m.id));
    pushAudit("VAULT_UNSEALED", activeChannel.name, `msg=${m.id.slice(0,8)}`);
  };

  const switchAgency = (a: Agency) => {
    const firstVisible = CHANNELS.find(c => c.agencyId === a.id && canAccess(c));
    if (firstVisible) {
      setState(s => ({ ...s, activeChannelId: firstVisible.id }));
      pushAudit("AGENCY_ENTER", a.code);
    }
  };

  const switchChannel = (c: Channel) => {
    setState(s => ({ ...s, activeChannelId: c.id }));
    pushAudit("CHANNEL_ENTER", c.name);
  };

  const switchOperator = (id: string) => {
    const next = MEMBERS.find(m => m.id === id);
    if (!next) return;
    setState(s => ({ ...s, operatorId: id }));
    // Reset active channel if operator can no longer see current one
    const current = CHANNELS.find(c => c.id === state.activeChannelId);
    if (current && clearanceRank(next.clearance) < clearanceRank(current.minClearance)) {
      const first = CHANNELS.find(c => c.agencyId === current.agencyId && clearanceRank(next.clearance) >= clearanceRank(c.minClearance));
      if (first) setState(s => ({ ...s, activeChannelId: first.id, operatorId: id }));
    }
    pushAudit("OPERATOR_SWITCH", next.handle);
  };

  return (
    <div className="relative min-h-screen w-full text-foreground overflow-hidden">
      {/* Aureon wallpaper background */}
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${wallpaper})` }}
        aria-hidden
      />
      <div className="fixed inset-0 -z-10 bg-black/80 backdrop-blur-sm" aria-hidden />

      {/* Classification banner (top) */}
      <div className={`sticky top-0 z-40 border-b text-center text-[10px] tracking-[0.35em] uppercase font-semibold py-1.5 ${CLEARANCE_COLOR[state.banner]}`}>
        {state.banner === "TS" ? "TOP SECRET" : state.banner} // ASHERIN.GOV COMMAND DECK // HANDLE VIA APPROVED CHANNELS
      </div>

      <div className="flex h-[calc(100vh-28px)]">
        {/* AGENCY RAIL */}
        <aside className="w-16 shrink-0 border-r border-border/20 bg-black/40 flex flex-col items-center py-3 gap-2">
          <Link to="/asherin.gov" className="w-10 h-10 rounded-xl border border-border/30 bg-foreground/[0.03] flex items-center justify-center hover:bg-foreground/10 transition" title="Back to asherin.gov">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="w-8 h-px bg-border/30 my-1" />
          {AGENCIES.map(a => {
            const active = a.id === activeAgency.id;
            return (
              <button
                key={a.id}
                onClick={() => switchAgency(a)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[10px] font-semibold tracking-widest transition relative
                  ${active ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:border-border/60"}`}
                title={a.name}
                style={active ? { boxShadow: `inset 0 0 0 1px ${a.color}55` } : undefined}
              >
                {a.code}
                {active && <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-foreground" />}
              </button>
            );
          })}
        </aside>

        {/* CHANNEL RAIL */}
        <aside className="w-64 shrink-0 border-r border-border/20 bg-black/30 flex flex-col">
          <div className="px-4 py-4 border-b border-border/20">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{activeAgency.code}</div>
            <div className="text-sm font-light text-foreground mt-0.5">{activeAgency.name}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {(["text","voice","vault","broadcast"] as ChannelKind[]).map(kind => {
              const list = visibleChannels.filter(c => c.kind === kind);
              if (list.length === 0) return null;
              const groupLabel = { text: "Channels", voice: "Rooms", vault: "Vaults", broadcast: "Broadcast" }[kind];
              return (
                <div key={kind}>
                  <div className="px-2 pb-1 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">{groupLabel}</div>
                  {list.map(c => {
                    const Icon = channelIcon(c.kind);
                    const active = c.id === state.activeChannelId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => switchChannel(c)}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition
                          ${active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"}`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-light">{c.name}</span>
                        <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded border ${CLEARANCE_COLOR[c.minClearance]}`}>{c.minClearance}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {/* Hidden-channel hint */}
            {CHANNELS.filter(c => c.agencyId === activeAgency.id && !canAccess(c)).length > 0 && (
              <div className="px-2 py-2 text-[10px] font-light text-muted-foreground/60 border border-dashed border-border/30 rounded-md">
                {CHANNELS.filter(c => c.agencyId === activeAgency.id && !canAccess(c)).length} channel(s) hidden — clearance below required level.
              </div>
            )}
          </div>
          {/* Operator switcher (simulation aid) */}
          <div className="border-t border-border/20 p-3">
            <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-1.5">Acting as</div>
            <select
              value={operator.id}
              onChange={e => switchOperator(e.target.value)}
              className="w-full bg-black/40 border border-border/30 rounded-md text-xs font-light text-foreground px-2 py-1.5 outline-none focus:border-foreground/50"
            >
              {MEMBERS.map(m => (
                <option key={m.id} value={m.id}>{m.handle} · {m.clearance}</option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
              <span className={`inline-block h-2 w-2 rounded-full ${operator.presence === "online" ? "bg-emerald-400" : operator.presence === "away" ? "bg-amber-400" : "bg-muted-foreground/50"}`} />
              {operator.rank}
            </div>
          </div>
        </aside>

        {/* MAIN PANE */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <header className="border-b border-border/20 bg-black/20 px-5 py-3 flex items-center gap-3 min-w-0">
            {(() => { const Icon = channelIcon(activeChannel.kind); return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />; })()}
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-light text-foreground truncate">{activeChannel.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${CLEARANCE_COLOR[activeChannel.minClearance]}`}>{activeChannel.minClearance}</span>
                {activeChannel.compartments?.map(c => (
                  <span key={c} className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 tracking-wider">{c}</span>
                ))}
              </div>
              {activeChannel.topic && <div className="text-[11px] font-light text-muted-foreground/70 truncate">{activeChannel.topic}</div>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search this channel"
                  className="bg-black/30 border border-border/30 rounded-md text-xs font-light text-foreground pl-7 pr-2 py-1.5 w-52 outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50"
                />
              </div>
              <button
                onClick={() => setShowAudit(v => !v)}
                className={`text-[10px] tracking-widest uppercase px-2 py-1.5 rounded-md border transition ${showAudit ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"}`}
              >
                <ScrollText className="h-3.5 w-3.5 inline mr-1" />Audit
              </button>
              <button
                onClick={() => setMembersOpen(v => !v)}
                className={`text-[10px] tracking-widest uppercase px-2 py-1.5 rounded-md border transition ${membersOpen ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"}`}
              >
                <Users className="h-3.5 w-3.5 inline mr-1" />{agencyMembers.length}
              </button>
            </div>
          </header>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {activeChannel.kind === "voice" && (
              <div className="rounded-xl border border-border/30 bg-black/30 p-6 text-center">
                <Volume2 className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
                <div className="text-sm font-light text-foreground">Secure voice room</div>
                <div className="text-[11px] text-muted-foreground/70 mt-1">This is a coordination-only surface. Voice routes over the sovereign SRTP mesh; join controls appear here once initiated.</div>
                <button className="mt-4 px-4 py-2 text-xs tracking-widest uppercase border border-foreground/30 rounded-md hover:bg-foreground/10">Join Room</button>
              </div>
            )}
            {activeChannel.kind !== "voice" && channelMessages.length === 0 && (
              <div className="text-center text-xs font-light text-muted-foreground/60 py-16">No traffic in this channel yet.</div>
            )}
            {activeChannel.kind !== "voice" && channelMessages.map(m => {
              const author = MEMBERS.find(u => u.id === m.authorId);
              const sealed = m.sealed && !unsealed.has(m.id);
              return (
                <div key={m.id} className={`group flex gap-3 rounded-md px-2 py-1.5 hover:bg-foreground/[0.03] ${m.pinned ? "border-l-2 border-amber-500/60 pl-3" : ""}`}>
                  <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold text-foreground/80">
                    {author?.handle.slice(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-light text-foreground">{author?.handle ?? "unknown"}</span>
                      {author?.rank === "Sovereign" && <Crown className="h-3 w-3 text-amber-400" />}
                      <span className={`text-[9px] px-1 py-0.5 rounded border ${author ? CLEARANCE_COLOR[author.clearance] : ""}`}>{author?.clearance}</span>
                      {m.pinned && <Pin className="h-3 w-3 text-amber-400" />}
                      <span className="text-[10px] text-muted-foreground/60">{fmtTime(m.ts)}</span>
                      {m.compartments?.map(c => (
                        <span key={c} className="text-[9px] px-1 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 tracking-wider">{c}</span>
                      ))}
                    </div>
                    {sealed ? (
                      <div className="mt-1 flex items-center gap-3 rounded-md border border-dashed border-red-500/40 bg-red-500/5 px-3 py-2">
                        <Lock className="h-3.5 w-3.5 text-red-300 shrink-0" />
                        <div className="text-[11px] font-light text-red-200/90">Message sealed. Unsealing will be recorded in the audit ledger.</div>
                        <button
                          onClick={() => handleUnseal(m)}
                          className="ml-auto text-[10px] tracking-widest uppercase px-2 py-1 rounded border border-red-500/40 text-red-200 hover:bg-red-500/10"
                        >
                          <Eye className="h-3 w-3 inline mr-1" />Unseal
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-light text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {m.body}
                        {m.sealed && (
                          <button
                            onClick={() => setUnsealed(prev => { const n = new Set(prev); n.delete(m.id); return n; })}
                            className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground"
                          >
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

          {/* Composer */}
          {activeChannel.kind !== "voice" && (
            <div className="border-t border-border/20 bg-black/20 p-3">
              {!canAccess(activeChannel) ? (
                <div className="flex items-center gap-2 text-xs font-light text-red-300 border border-red-500/30 bg-red-500/5 rounded-md px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Insufficient clearance to post here.
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-md border border-border/30 bg-black/40 focus-within:border-foreground/50 transition">
                    {activeChannel.kind === "broadcast" && (
                      <div className="px-3 pt-2 text-[10px] tracking-widest uppercase text-amber-300 flex items-center gap-1.5">
                        <Radio className="h-3 w-3" /> Emergency broadcast · pins across visible feeds
                      </div>
                    )}
                    {activeChannel.kind === "vault" && (
                      <div className="px-3 pt-2 text-[10px] tracking-widest uppercase text-red-300 flex items-center gap-1.5">
                        <Lock className="h-3 w-3" /> Vault channel · outbound sealed by default
                      </div>
                    )}
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      rows={2}
                      placeholder={`Transmit to #${activeChannel.name}`}
                      className="w-full bg-transparent px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    className="h-10 w-10 rounded-md border border-foreground/40 bg-foreground/5 hover:bg-foreground/15 disabled:opacity-40 flex items-center justify-center"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="mt-1.5 text-[10px] text-muted-foreground/60 flex items-center gap-3">
                <span>Enter to send · Shift+Enter for newline</span>
                <span className="ml-auto">Every transmission is audit-logged.</span>
              </div>
            </div>
          )}
        </main>

        {/* MEMBERS RAIL */}
        {membersOpen && (
          <aside className="w-64 shrink-0 border-l border-border/20 bg-black/30 flex flex-col">
            <div className="px-4 py-3 border-b border-border/20 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Members · {agencyMembers.length}</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {agencyMembers.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/[0.04]">
                  <div className="relative">
                    <div className="w-7 h-7 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold">{m.handle.slice(0,2).toUpperCase()}</div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black ${m.presence === "online" ? "bg-emerald-400" : m.presence === "away" ? "bg-amber-400" : "bg-muted-foreground/60"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-light text-foreground truncate flex items-center gap-1">
                      {m.handle}
                      {m.rank === "Sovereign" && <Crown className="h-3 w-3 text-amber-400" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 truncate">{m.rank}</div>
                  </div>
                  <span className={`text-[8px] px-1 py-0.5 rounded border ${CLEARANCE_COLOR[m.clearance]}`}>{m.clearance}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* AUDIT DRAWER */}
        {showAudit && (
          <aside className="w-80 shrink-0 border-l border-border/20 bg-black/50 flex flex-col">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Immutable Audit Ledger</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {state.audit.map(e => (
                <div key={e.id} className="rounded-md border border-border/20 bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <Circle className="h-1.5 w-1.5 fill-foreground/60 text-foreground/60" />
                    {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    <span className="ml-auto text-foreground/80 tracking-widest">{e.action}</span>
                  </div>
                  <div className="mt-1 text-xs font-light text-foreground/90">{e.actor} <span className="text-muted-foreground">→</span> {e.target}</div>
                  {e.detail && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{e.detail}</div>}
                </div>
              ))}
              {state.audit.length === 0 && <div className="text-center text-[11px] text-muted-foreground/60 py-8">No entries.</div>}
            </div>
          </aside>
        )}
      </div>

      {/* Classification banner (bottom) */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 border-t text-center text-[10px] tracking-[0.35em] uppercase font-semibold py-1 ${CLEARANCE_COLOR[state.banner]}`}>
        {state.banner === "TS" ? "TOP SECRET" : state.banner}
      </div>
    </div>
  );
};

export default AsherinGovDashboard;
