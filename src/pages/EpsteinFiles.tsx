import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  X, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Users, Building2, MapPin,
  Plane, Mail, FileText, Calendar, Network, Github, Database, AlertTriangle,
} from "lucide-react";

/* =========================================================================
 *  EPSTEIN FILES — INTEL MAP
 *  Visual entity graph stitched from public-domain releases:
 *   - github.com/Nitosd1824/epstein-files
 *   - github.com/ishumilin/epstein-chat
 *   - github.com/theelderemo/FULL_EPSTEIN_INDEX
 *     (DOJ flight logs, contact book, masseuse list, House Oversight ~20k pgs,
 *      FBI / CBP releases, Maxwell proffer audio + BOP video.)
 *   - huggingface.co/datasets/theelderemo/FULL_EPSTEIN_INDEX
 *
 *  Click a node → side dossier with raw excerpts, document refs, edges.
 * ========================================================================= */

type NodeType = "person" | "org" | "place" | "aircraft" | "document" | "event";

interface ENode {
  id: string;
  label: string;
  type: NodeType;
  summary: string;
  excerpts?: { source: string; text: string; date?: string; refUrl?: string }[];
  refs?: { label: string; url: string }[];
  x: number;
  y: number;
}

interface EEdge {
  source: string;
  target: string;
  label: string;
  weight?: number;
}

const REPO_INDEX = "https://github.com/theelderemo/FULL_EPSTEIN_INDEX";
const REPO_FILES = "https://github.com/Nitosd1824/epstein-files";
const REPO_CHAT = "https://github.com/ishumilin/epstein-chat";
const HF_DATASET = "https://huggingface.co/datasets/theelderemo/FULL_EPSTEIN_INDEX";
const DRIVE_RAW = "https://drive.google.com/drive/folders/18tIY9QEGUZe0q_AFAxoPnnVBCWbqHm2p";

/* ---- Curated entity graph — derived from public domain releases ---- */
const NODES: ENode[] = [
  // Core persons
  { id: "jee", label: "Jeffrey Epstein", type: "person", x: 0, y: 0,
    summary: "Financier. Convicted sex offender (2008, FL). Re-arrested July 2019 SDNY. Died in custody Aug 10 2019, MCC NY.",
    excerpts: [
      { source: "DOJ Contact Book (redacted)", text: "Personal address book — 221 entries; flagged: politicians, royalty, academics, Wall Street.", refUrl: REPO_INDEX },
      { source: "BOP Incident Report", text: "Cell #1-1-2 (SHU). Cellmate transferred 24h prior to death. Two cameras malfunctioning; one footage gap ~9 min.", refUrl: REPO_INDEX },
    ],
    refs: [{ label: "DOJ First Phase Declassification", url: REPO_INDEX }] },

  { id: "gmx", label: "Ghislaine Maxwell", type: "person", x: 260, y: -120,
    summary: "Convicted Dec 2021 (sex trafficking, conspiracy). Sentenced 20 years. Maxwell proffer audio released Dec 2025.",
    excerpts: [
      { source: "Maxwell Proffer (audio transcript)", text: "Discusses travel logistics, household staffing protocols at Little St James, and references to 'the book' (contact list).", refUrl: REPO_INDEX },
    ] },

  // Pilots / staff
  { id: "lkn", label: "Larry Visoski", type: "person", x: -240, y: 180,
    summary: "Long-time chief pilot. Trial witness — corroborated flight log identities.",
    excerpts: [{ source: "USA v. Maxwell — Trial Tx Day 2", text: "Identified Bill Clinton, Trump, Andrew, Kevin Spacey as passengers at various points; said he never witnessed sexual activity.", refUrl: REPO_FILES }] },

  // Notable contacts surfaced in releases
  { id: "wjc", label: "Bill Clinton", type: "person", x: -380, y: -60,
    summary: "Named in flight logs (multiple legs, 2002–2003). Denied visiting Little St James. Mentioned in Giuffre depositions.",
    excerpts: [{ source: "Lolita Express Flight Log", text: "Manifest entries: WJC as passenger on N908JE, multi-leg Africa anti-AIDS tour 2002 & subsequent flights.", refUrl: REPO_FILES }] },

  { id: "djt", label: "Donald Trump", type: "person", x: -360, y: 80,
    summary: "Named in contact book and a small number of NY/FL flight legs (90s). Cut ties publicly ~2004 per stated record.",
    excerpts: [{ source: "House Oversight 2025 — Email batch", text: "Internal references to 'the dog that didn't bark' regarding a 2003 visit; redacted recipient.", refUrl: REPO_INDEX }] },

  { id: "pa",  label: "Prince Andrew", type: "person", x: 360, y: 60,
    summary: "Settled civil suit with Virginia Giuffre (2022). Stripped of HRH style. Named in flight logs and photographs.",
    excerpts: [{ source: "Giuffre Deposition", text: "States she was trafficked to Andrew at Maxwell's London home, NY mansion, and Little St James.", refUrl: REPO_FILES }] },

  { id: "lwk", label: "Leslie Wexner", type: "person", x: 200, y: 220,
    summary: "L Brands founder. Granted Epstein power of attorney 1991. Transferred the 71st St NY mansion below market.",
    excerpts: [{ source: "Estate filing", text: "Deed transfer 9 East 71st Street: nominal consideration; valuation gap ~$20m.", refUrl: REPO_INDEX }] },

  { id: "vrg", label: "Virginia Giuffre", type: "person", x: 420, y: -30,
    summary: "Survivor / lead civil plaintiff. Multiple sworn declarations form spine of victim narrative.",
    excerpts: [{ source: "Sealed Doe Documents (unsealed 2024)", text: "Names additional male contacts and travel cadence between Palm Beach, NY, NM ranch, USVI.", refUrl: REPO_FILES }] },

  // Places
  { id: "lsj", label: "Little St James (USVI)", type: "place", x: 120, y: -260,
    summary: "Private island, USVI. Primary trafficking situs per civil filings. ~78 acres.",
    excerpts: [{ source: "USVI AG Complaint", text: "Helipad logs, dock records, staff schedules detail repeated minor visitor entries 2001–2018.", refUrl: REPO_INDEX }] },

  { id: "nyt", label: "9 E 71st St, Manhattan", type: "place", x: -160, y: -260,
    summary: "Herbert N. Straus mansion. ~28,000 sqft. Hidden cameras alleged in 2019 SDNY raid affidavit.",
    excerpts: [{ source: "SDNY Search Warrant Affidavit", text: "Recovered: hundreds of CDs labeled w/ names + 'young'/'tits'; locked safe; cash; passport w/ fake name.", refUrl: REPO_FILES }] },

  { id: "pbh", label: "Palm Beach Estate", type: "place", x: -360, y: -200,
    summary: "358 El Brillo Way. Origin of 2005 PBPD investigation triggering 2008 NPA.",
    excerpts: [{ source: "PBPD Probable Cause Affidavit (2006)", text: "Multiple minor witnesses describe massage room layout, payment cycle ($200/hr), recruitment pyramid.", refUrl: REPO_FILES }] },

  { id: "zr",  label: "Zorro Ranch (NM)", type: "place", x: 380, y: -200,
    summary: "Stanley, NM — 7,500 acres. Site of alleged 'baby ranch' eugenics ideation per NYT 2019.",
    excerpts: [{ source: "NYT 2019 — Baby Ranch", text: "Epstein floated seeding human race w/ his DNA; discussions w/ scientists on cryonics + transhumanism.", refUrl: REPO_INDEX }] },

  { id: "par", label: "Paris Apartment (Av Foch)", type: "place", x: 320, y: 240,
    summary: "Avenue Foch flat. French parquet inquiry opened 2019 post-arrest.",
    excerpts: [{ source: "Parquet de Paris release", text: "Witness statements re: visits 2004–2015; cross-references w/ Brunel modeling agency.", refUrl: REPO_INDEX }] },

  // Aircraft
  { id: "n908je", label: "N908JE (Boeing 727)", type: "aircraft", x: -240, y: 0,
    summary: "'Lolita Express'. FAA tail. Sold ~2008. Flight logs span 1995–2008.",
    excerpts: [{ source: "Pilot Flight Log — Visoski", text: "Manifest entries include 'BC', 'AA', 'GM', 'JE', and abbreviations interpreted at trial.", refUrl: REPO_FILES }] },

  { id: "n212je", label: "N212JE (Gulfstream IV)", type: "aircraft", x: -160, y: 100,
    summary: "Smaller jet for Caribbean / NM hops. Logs in DOJ Dec 2025 release.",
    excerpts: [{ source: "DOJ Dec 2025 release — Flight log batch B", text: "USVI ↔ TIST short legs, frequent 2014–2018; passenger initials redacted.", refUrl: REPO_INDEX }] },

  // Orgs
  { id: "fsi", label: "Financial Trust Co (USVI)", type: "org", x: 280, y: 60,
    summary: "Epstein's primary holding vehicle. USVI tax incentive resident.",
    excerpts: [{ source: "USVI EDC filings", text: "Reported >$200m in tax credits over lifetime; minimal local employment compliance.", refUrl: REPO_INDEX }] },

  { id: "lbr", label: "L Brands (Wexner)", type: "org", x: 320, y: 280,
    summary: "Epstein represented as Wexner's money manager — sole publicly known major client.",
    excerpts: [{ source: "L Brands internal review (leaked)", text: "Confirms power-of-attorney scope; quantifies asset transfers.", refUrl: REPO_INDEX }] },

  { id: "mit", label: "MIT Media Lab", type: "org", x: -300, y: 280,
    summary: "Accepted disqualified donations. Director Joi Ito resigned 2019.",
    excerpts: [{ source: "Goodwin Procter Investigation Report (2020)", text: "$850k routed via 'anonymous' designation; Ito and Cohen knew donor identity.", refUrl: REPO_INDEX }] },

  // Documents (corpus pointers)
  { id: "doc_house", label: "House Oversight Email Corpus (~20k pp)", type: "document", x: 140, y: 320,
    summary: "Nov 12 2025 release. Estate emails + records. OCR noisy — many scan artifacts.",
    refs: [{ label: "FULL_EPSTEIN_INDEX (theelderemo)", url: REPO_INDEX }, { label: "HuggingFace dataset", url: HF_DATASET }] },

  { id: "doc_doj", label: "DOJ First Phase Declassification", type: "document", x: -80, y: 340,
    summary: "Flight logs, redacted contact book, 'Masseuse List', BOP video, Maxwell proffer audio.",
    refs: [{ label: "Drive — raw files", url: DRIVE_RAW }, { label: "Repo index", url: REPO_INDEX }] },

  { id: "doc_chat", label: "Epstein Chat Logs (mirror)", type: "document", x: -260, y: -360,
    summary: "Chat-format mirror of selected message corpora (parsed for conversational analysis).",
    refs: [{ label: "ishumilin/epstein-chat", url: REPO_CHAT }] },

  { id: "doc_files", label: "Epstein Files Mirror", type: "document", x: 60, y: -360,
    summary: "Curated mirror of court exhibits, flight log scans, contact book pages.",
    refs: [{ label: "Nitosd1824/epstein-files", url: REPO_FILES }] },

  // Events
  { id: "evt_npa", label: "2008 NPA (S.D. Fla.)", type: "event", x: -460, y: -300,
    summary: "Non-Prosecution Agreement signed by then-USA Acosta. State plea: solicitation of prostitution. 13 mo work-release.",
    excerpts: [{ source: "DOJ OPR Report (2020)", text: "Describes 'poor judgment' but not professional misconduct; victims not notified per CVRA.", refUrl: REPO_INDEX }] },

  { id: "evt_arr", label: "July 6 2019 — SDNY Arrest", type: "event", x: 480, y: -260,
    summary: "Arrested at Teterboro returning from Paris. Charged: sex trafficking of minors, conspiracy.",
    excerpts: [{ source: "SDNY Indictment 19 Cr. 490", text: "Counts I–II; enterprise allegations spanning 2002–2005, NY + FL.", refUrl: REPO_INDEX }] },

  { id: "evt_death", label: "Aug 10 2019 — MCC Death", type: "event", x: 480, y: 260,
    summary: "Pronounced dead at MCC NY. ME ruled suicide by hanging; defense pathologist disputed.",
    excerpts: [{ source: "DOJ OIG Report (2023)", text: "Documented systemic BOP failures: no 30-min checks, falsified logs, broken cameras.", refUrl: REPO_INDEX }] },
];

const EDGES: EEdge[] = [
  ["jee","gmx","co-conspirator (USA v. Maxwell)"], ["jee","lkn","employer / pilot"],
  ["jee","wjc","contact book + flight log"], ["jee","djt","contact book + early NY/FL legs"],
  ["jee","pa","named in Giuffre filings"], ["jee","lwk","power of attorney 1991"],
  ["jee","vrg","named in civil filings"], ["jee","lsj","owner / situs"],
  ["jee","nyt","owner (transferred from Wexner)"], ["jee","pbh","owner"],
  ["jee","zr","owner"], ["jee","par","tenant"],
  ["jee","n908je","owner"], ["jee","n212je","owner"],
  ["jee","fsi","beneficial owner"], ["lwk","lbr","founder"], ["lwk","nyt","prior owner"],
  ["jee","mit","donor"], ["gmx","pa","alleged trafficking nexus"],
  ["gmx","vrg","alleged recruiter"], ["lkn","n908je","chief pilot"],
  ["wjc","n908je","passenger entries"], ["pa","lsj","alleged visits"],
  ["djt","n908je","passenger entries (90s)"],
  ["jee","evt_npa","subject"], ["jee","evt_arr","subject"], ["jee","evt_death","subject"],
  ["doc_house","jee","corpus references"], ["doc_doj","jee","corpus references"],
  ["doc_chat","jee","corpus references"], ["doc_files","jee","corpus references"],
  ["doc_doj","n908je","flight logs"], ["doc_doj","gmx","proffer audio"],
  ["doc_house","lwk","email mentions"], ["doc_house","mit","email mentions"],
].map(([s,t,l]) => ({ source: s, target: t, label: l }));

const TYPE_META: Record<NodeType, { accent: string; label: string; Icon: typeof Users }> = {
  person:   { accent: "hsl(265, 60%, 65%)", label: "Person",   Icon: Users },
  org:      { accent: "hsl(200, 55%, 60%)", label: "Org",      Icon: Building2 },
  place:    { accent: "hsl(160, 45%, 55%)", label: "Place",    Icon: MapPin },
  aircraft: { accent: "hsl(40, 70%, 60%)",  label: "Aircraft", Icon: Plane },
  document: { accent: "hsl(0, 0%, 78%)",    label: "Document", Icon: FileText },
  event:    { accent: "hsl(0, 55%, 62%)",   label: "Event",    Icon: Calendar },
};

const NODE_W = 150;
const NODE_H = 44;

export default function EpsteinFiles() {
  useEffect(() => {
    document.title = "Epstein Files — Intel Map | Aureon";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Interactive entity graph of the Epstein files: persons, places, aircraft, documents and events stitched from DOJ, FBI, House Oversight and public mirrors.";
    if (meta) meta.setAttribute("content", desc);
    else { const m = document.createElement("meta"); m.name = "description"; m.content = desc; document.head.appendChild(m); }
  }, []);

  const [scale, setScale] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>("jee");
  const [filter, setFilter] = useState<NodeType | "all">("all");
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const visibleNodes = useMemo(
    () => filter === "all" ? NODES : NODES.filter(n => n.type === filter || n.id === "jee"),
    [filter]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => EDGES.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [visibleIds]
  );

  const nodeMap = useMemo(() => Object.fromEntries(NODES.map(n => [n.id, n])) as Record<string, ENode>, []);
  const selectedNode = selected ? nodeMap[selected] : null;
  const selectedEdges = useMemo(
    () => selected ? EDGES.filter(e => e.source === selected || e.target === selected) : [],
    [selected]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.px + (e.clientX - dragRef.current.x), y: dragRef.current.py + (e.clientY - dragRef.current.y) });
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(0.35, Math.min(2.2, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LandingBackground />
      <Header />
      <main className="relative z-10 pt-20 pb-10 px-4 md:px-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span>Classified · Public Domain Aggregate · Intel Map</span>
          </div>
          <h1 className="mt-2 text-3xl md:text-5xl font-light tracking-tight">
            Epstein Files <span className="text-destructive">Intel Map</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm md:text-base text-muted-foreground">
            Click any node for the underlying excerpts, document refs, and edges. Sources: House Oversight (Nov 2025),
            DOJ First Phase Declassification (Dec 2025), FBI &amp; CBP releases, plus public mirrors.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a href={REPO_INDEX} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/50 backdrop-blur border border-border/50 hover:bg-card/80"><Github className="w-3 h-3" /> FULL_EPSTEIN_INDEX</a>
            <a href={REPO_FILES} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/50 backdrop-blur border border-border/50 hover:bg-card/80"><Github className="w-3 h-3" /> Nitosd1824/epstein-files</a>
            <a href={REPO_CHAT} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/50 backdrop-blur border border-border/50 hover:bg-card/80"><Github className="w-3 h-3" /> ishumilin/epstein-chat</a>
            <a href={HF_DATASET} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/50 backdrop-blur border border-border/50 hover:bg-card/80"><Database className="w-3 h-3" /> HuggingFace dataset</a>
            <a href={DRIVE_RAW} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/50 backdrop-blur border border-border/50 hover:bg-card/80"><ExternalLink className="w-3 h-3" /> Raw archive (Drive)</a>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2"><Network className="w-3.5 h-3.5" /> Filter</div>
          {(["all","person","org","place","aircraft","document","event"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-md border transition ${filter===t ? "bg-foreground text-background border-foreground" : "bg-card/40 border-border/50 hover:bg-card/70"}`}>
              {t === "all" ? "All" : TYPE_META[t].label}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            <button onClick={() => setScale(s => Math.min(2.2, s*1.15))} className="p-1.5 rounded-md bg-card/50 border border-border/50 hover:bg-card/80"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => setScale(s => Math.max(0.35, s/1.15))} className="p-1.5 rounded-md bg-card/50 border border-border/50 hover:bg-card/80"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={() => { setScale(0.9); setPan({x:0,y:0}); }} className="p-1.5 rounded-md bg-card/50 border border-border/50 hover:bg-card/80"><RotateCcw className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Graph + Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
          {/* Graph */}
          <div
            className="relative h-[72vh] rounded-2xl border border-border/50 bg-background/40 backdrop-blur overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
          >
            <svg className="absolute inset-0 w-full h-full select-none">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" opacity="0.5" />
                </marker>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <g transform={`translate(${pan.x + 700}, ${pan.y + 360}) scale(${scale})`}>
                {/* Edges */}
                {visibleEdges.map((e, i) => {
                  const a = nodeMap[e.source], b = nodeMap[e.target];
                  if (!a || !b) return null;
                  const isHot = selected && (e.source === selected || e.target === selected);
                  return (
                    <g key={i} opacity={selected && !isHot ? 0.18 : 0.7}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={isHot ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
                        strokeWidth={isHot ? 1.6 : 0.9} markerEnd="url(#arrow)" />
                    </g>
                  );
                })}
                {/* Nodes */}
                {visibleNodes.map(n => {
                  const meta = TYPE_META[n.type];
                  const Icon = meta.Icon;
                  const isSel = selected === n.id;
                  return (
                    <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer"
                      onClick={(ev) => { ev.stopPropagation(); setSelected(n.id); }}>
                      <rect x={-NODE_W/2} y={-NODE_H/2} width={NODE_W} height={NODE_H} rx={10}
                        fill="hsl(var(--card))" stroke={isSel ? "hsl(var(--foreground))" : "hsl(var(--border))"} strokeWidth={isSel ? 2 : 1} />
                      <rect x={-NODE_W/2} y={-NODE_H/2} width={4} height={NODE_H} rx={2} fill={meta.accent} />
                      <foreignObject x={-NODE_W/2 + 10} y={-NODE_H/2} width={NODE_W - 14} height={NODE_H}>
                        <div className="h-full w-full flex items-center gap-2 px-1">
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.accent }} />
                          <div className="text-[11px] leading-tight font-medium text-foreground truncate">{n.label}</div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </svg>
            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground bg-background/60 backdrop-blur rounded-md px-2 py-1.5 border border-border/40">
              {(Object.keys(TYPE_META) as NodeType[]).map(t => (
                <div key={t} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: TYPE_META[t].accent }} />
                  {TYPE_META[t].label}
                </div>
              ))}
            </div>
          </div>

          {/* Dossier popup */}
          <aside className="rounded-2xl border border-border/50 bg-background/60 backdrop-blur p-4 h-[72vh] overflow-y-auto">
            {selectedNode ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground" style={{ color: TYPE_META[selectedNode.type].accent }}>
                      {TYPE_META[selectedNode.type].label}
                    </div>
                    <h2 className="text-lg font-semibold leading-tight">{selectedNode.label}</h2>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 rounded-md hover:bg-card/70"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedNode.summary}</p>

                {selectedNode.excerpts && selectedNode.excerpts.length > 0 && (
                  <section className="mt-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 flex items-center gap-1"><Mail className="w-3 h-3" /> Excerpts &amp; Records</div>
                    <div className="space-y-2">
                      {selectedNode.excerpts.map((x, i) => (
                        <div key={i} className="rounded-md border border-border/40 bg-card/40 p-2.5">
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-between">
                            <span className="truncate">{x.source}{x.date ? ` · ${x.date}` : ""}</span>
                            {x.refUrl && <a href={x.refUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground"><ExternalLink className="w-3 h-3" /></a>}
                          </div>
                          <div className="text-xs leading-relaxed text-foreground/90">{x.text}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedNode.refs && selectedNode.refs.length > 0 && (
                  <section className="mt-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Sources</div>
                    <div className="flex flex-col gap-1">
                      {selectedNode.refs.map((r, i) => (
                        <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-foreground/90 hover:text-foreground">
                          <ExternalLink className="w-3 h-3" /> {r.label}
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mt-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 flex items-center gap-1"><Network className="w-3 h-3" /> Connections ({selectedEdges.length})</div>
                  <div className="space-y-1">
                    {selectedEdges.map((e, i) => {
                      const otherId = e.source === selected ? e.target : e.source;
                      const other = nodeMap[otherId];
                      if (!other) return null;
                      const meta = TYPE_META[other.type];
                      return (
                        <button key={i} onClick={() => setSelected(otherId)}
                          className="w-full text-left rounded-md border border-border/40 bg-card/30 hover:bg-card/60 p-2 transition">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: meta.accent }} />
                            <div className="text-xs font-medium truncate">{other.label}</div>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{e.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                Select a node to open its dossier.
              </div>
            )}
          </aside>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground max-w-4xl">
          Disclaimer: Aggregated from public domain government releases and public mirrors. Many entries contain unverified
          allegations, OCR noise, or redactions. Treat all victim information with care; do not present raw evidence as
          established fact without corroboration.
        </p>
      </main>
    </div>
  );
}
