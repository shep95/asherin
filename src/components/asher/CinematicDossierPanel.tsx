import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Loader2, Shield, User, Users as UsersIcon, Building2, Home,
  DollarSign, Activity, Clock, AlertTriangle, TrendingUp, Network,
  Camera, ExternalLink, Radio, MapPin, FileWarning, Sparkles,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   CINEMATIC PROPERTY DOSSIER
   A classified file unsealing itself. Each layer fades in
   as the intel arrives — ownership → residents → thermal →
   temporal → social graph → financial → interior → prediction.
   ───────────────────────────────────────────────────────────── */

export interface DossierIntel {
  summary?: string;
  risk_score?: number;
  risk_label?: "GREEN" | "AMBER" | "RED";
  risk_rationale?: string;
  ownership?: {
    record_owner?: string | null;
    beneficial_owner?: string | null;
    llc_chain?: string[];
    registered_agent?: string | null;
    state_of_formation?: string | null;
    confidence?: number;
  };
  residents?: {
    occupants?: Array<{ name: string; role?: string; source?: string }>;
    known_associates?: string[];
    confidence?: number;
  };
  property_facts?: Record<string, string | null | undefined>;
  temporal_changes?: Array<{ year: string; change: string; permit_status?: string; flagged?: boolean }>;
  financial_forensics?: {
    liens?: string[];
    tax_status?: string;
    bankruptcy_filings?: string[];
    anomaly_flags?: string[];
    distress_score?: number;
  };
  social_graph?: {
    nodes?: Array<{ id: string; label: string; type?: string }>;
    edges?: Array<{ from: string; to: string; relation?: string }>;
  };
  neighborhood_patterns?: string[];
  prediction?: {
    transaction_probability_12mo?: number;
    horizon_months?: number;
    signal_class?: string;
    reasoning?: string;
  };
  interior_photos?: Array<{ url: string; source: string }>;
  citations?: Array<{ label: string; url: string; channel?: string }>;
}

interface Props {
  address: string | null;
  lat: number;
  lng: number;
  loading: boolean;
  intel: DossierIntel | null;
  error: string | null;
  sources: Array<{ title: string; url: string; channel?: string }>;
  onClose: () => void;
  onRescan: () => void;
}

const CHANNEL_STAGES = [
  { key: "reverse", label: "Reverse geocoding parcel", ms: 400 },
  { key: "ownership", label: "Tracing ownership chain", ms: 900 },
  { key: "residents", label: "Cross-referencing residency", ms: 700 },
  { key: "permits", label: "Auditing permit vs construction", ms: 600 },
  { key: "financial", label: "Financial forensics sweep", ms: 800 },
  { key: "social", label: "Mapping relationship spider", ms: 600 },
  { key: "listings", label: "Harvesting interior imagery", ms: 700 },
  { key: "predict", label: "Running prediction engine", ms: 500 },
];

function riskColor(label?: string) {
  if (label === "RED") return { border: "border-red-500/40", bg: "bg-red-500/10", text: "text-red-300", dot: "bg-red-400" };
  if (label === "AMBER") return { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-300", dot: "bg-amber-400" };
  return { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-300", dot: "bg-emerald-400" };
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/* Social graph — force-free radial layout painted on canvas */
function SocialGraph({ nodes, edges }: { nodes: any[]; edges: any[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    if (!nodes.length) return;

    const cx = W / 2, cy = H / 2;
    const rMax = Math.min(W, H) / 2 - 24;
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      if (i === 0) { pos[n.id] = { x: cx, y: cy }; return; }
      const ang = ((i - 1) / Math.max(1, nodes.length - 1)) * Math.PI * 2;
      pos[n.id] = { x: cx + Math.cos(ang) * rMax, y: cy + Math.sin(ang) * rMax };
    });

    // edges
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 0.6;
    edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    // nodes
    nodes.forEach((n) => {
      const p = pos[n.id]; if (!p) return;
      const isCenter = n === nodes[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, isCenter ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isCenter ? "rgba(251,191,36,0.9)" : n.type === "llc" ? "rgba(96,165,250,0.85)" : "rgba(226,232,240,0.85)";
      ctx.fill();
      ctx.font = "9px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(226,232,240,0.75)";
      const label = (n.label || "").slice(0, 22);
      ctx.fillText(label, p.x + 8, p.y + 3);
    });
  }, [nodes, edges]);

  return <canvas ref={ref} className="w-full h-40" />;
}

/* Section wrapper with staggered reveal */
function Section({ delay, icon: Icon, title, children, accent }: {
  delay: number; icon: any; title: string; children: React.ReactNode; accent?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={`transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`h-3 w-3 ${accent || "text-muted-foreground/60"}`} strokeWidth={1.5} />
        <p className="text-[9px] font-medium tracking-[0.28em] text-muted-foreground/70 uppercase">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function CinematicDossierPanel({
  address, lat, lng, loading, intel, error, sources, onClose, onRescan,
}: Props) {
  const risk = riskColor(intel?.risk_label);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!loading) { setStage(CHANNEL_STAGES.length); return; }
    setStage(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1; setStage(i);
      if (i >= CHANNEL_STAGES.length - 1) clearInterval(id);
    }, 550);
    return () => clearInterval(id);
  }, [loading]);

  const factList = useMemo(() => {
    const pf = intel?.property_facts || {};
    const map: Array<[string, string | null | undefined]> = [
      ["Type", pf.type], ["Year", pf.year_built], ["Size", pf.size],
      ["Beds", pf.beds], ["Baths", pf.baths], ["Est. Value", pf.value_estimate],
      ["Last Sale", pf.last_sale_price], ["Sale Date", pf.last_sale_date],
    ];
    return map.filter(([, v]) => !!v);
  }, [intel]);

  return (
    <div className="absolute right-3 top-3 bottom-3 z-[1001] w-[420px] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
      {/* HEADER — classified strip */}
      <div className="border-b border-border/20 bg-gradient-to-r from-background/80 to-background/40">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${risk.dot} ${loading ? "animate-pulse" : ""}`} />
            <p className="text-[9px] font-medium tracking-[0.35em] text-muted-foreground uppercase">
              Classified Dossier
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onRescan} disabled={loading}
              className="text-[9px] tracking-[0.2em] uppercase px-2 py-1 rounded border border-border/25 text-muted-foreground hover:text-foreground hover:border-border/50 disabled:opacity-40">
              Re-Sweep
            </button>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-3 pt-2">
          <p className="text-sm font-light text-foreground truncate">{address || "Unresolved Parcel"}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 tracking-wide flex items-center gap-1 mt-0.5">
            <MapPin className="h-2.5 w-2.5" strokeWidth={1.5} />
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>
        {/* Risk meter */}
        {intel?.risk_score != null && (
          <div className={`mx-4 mb-3 rounded-lg border ${risk.border} ${risk.bg} px-3 py-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Shield className={`h-3 w-3 ${risk.text}`} strokeWidth={1.5} />
                <p className={`text-[10px] tracking-[0.25em] uppercase font-medium ${risk.text}`}>
                  Risk · {intel.risk_label ?? "—"}
                </p>
              </div>
              <p className={`text-lg font-light ${risk.text} tabular-nums`}>{intel.risk_score}</p>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-background/60 overflow-hidden">
              <div className={`h-full ${risk.dot} transition-all duration-1000`} style={{ width: `${intel.risk_score}%` }} />
            </div>
            {intel.risk_rationale && (
              <p className="text-[10px] text-foreground/70 font-light leading-snug mt-1.5">{intel.risk_rationale}</p>
            )}
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[11px]">
        {/* Loading — cinematic scan sequence */}
        {loading && (
          <div className="space-y-2 py-2">
            {CHANNEL_STAGES.map((s, i) => {
              const done = stage > i;
              const active = stage === i;
              return (
                <div key={s.key} className={`flex items-center gap-2 transition-opacity duration-300 ${i <= stage ? "opacity-100" : "opacity-30"}`}>
                  {done ? (
                    <span className="w-3 h-3 rounded-full bg-emerald-400/80 flex items-center justify-center text-[8px] text-black font-bold">✓</span>
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin text-amber-400" strokeWidth={1.5} />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-muted-foreground/25" />
                  )}
                  <span className={`text-[10px] font-light tracking-wide ${active ? "text-foreground" : done ? "text-muted-foreground/70" : "text-muted-foreground/40"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5" strokeWidth={1.5} />
            <p className="text-[10px] text-red-300/90 font-light leading-relaxed">{error}</p>
          </div>
        )}

        {/* Empty — no loading, no error, no intel yet */}
        {!loading && !error && !intel && (
          <div className="rounded-lg border border-border/20 bg-background/40 p-3">
            <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/70 mb-1">
              Standby
            </p>
            <p className="text-[11px] text-foreground/70 font-light leading-relaxed">
              No dossier synthesized for this parcel yet. Tap <span className="text-amber-300/90">Re-Sweep</span> to run the OSINT sweep, or pick another point on the map.
            </p>
          </div>
        )}

        {/* Intel */}
        {intel && !loading && (
          <>
            {/* Summary brief */}
            {intel.summary && (
              <Section delay={0} icon={Sparkles} title="Executive Brief" accent="text-foreground/70">
                <p className="pl-3 border-l border-foreground/20 text-[11px] text-foreground/85 font-light leading-relaxed">
                  {intel.summary}
                </p>
              </Section>
            )}

            {/* Ownership chain */}
            {intel.ownership && (intel.ownership.record_owner || intel.ownership.beneficial_owner || intel.ownership.llc_chain?.length) && (
              <Section delay={200} icon={User} title="Ownership Chain" accent="text-blue-400/70">
                <div className="rounded-lg border border-border/15 bg-background/40 p-2.5 space-y-1.5">
                  {intel.ownership.record_owner && (
                    <p><span className="text-muted-foreground/55">Record:</span> <span className="text-foreground/85">{intel.ownership.record_owner}</span></p>
                  )}
                  {intel.ownership.beneficial_owner && (
                    <p><span className="text-muted-foreground/55">Beneficial:</span> <span className="text-amber-300/90 font-medium">{intel.ownership.beneficial_owner}</span></p>
                  )}
                  {intel.ownership.registered_agent && (
                    <p><span className="text-muted-foreground/55">Agent:</span> {intel.ownership.registered_agent}</p>
                  )}
                  {intel.ownership.state_of_formation && (
                    <p><span className="text-muted-foreground/55">State:</span> {intel.ownership.state_of_formation}</p>
                  )}
                  {intel.ownership.llc_chain && intel.ownership.llc_chain.length > 0 && (
                    <div className="pt-1.5 mt-1.5 border-t border-border/10 space-y-1">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/55">Shell Trace</p>
                      {intel.ownership.llc_chain.map((c, i) => (
                        <p key={i} className="pl-2 border-l border-blue-400/30 text-[10.5px] text-foreground/80 font-light">{c}</p>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Residents */}
            {intel.residents && ((intel.residents.occupants?.length ?? 0) > 0 || (intel.residents.known_associates?.length ?? 0) > 0) && (
              <Section delay={400} icon={UsersIcon} title="Residency Layer">
                <div className="rounded-lg border border-border/15 bg-background/40 p-2.5 space-y-2">
                  {intel.residents.occupants?.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] text-foreground/70">
                        {o.name?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-foreground/90 font-light truncate">{o.name}</p>
                        {o.role && <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/55">{o.role}</p>}
                      </div>
                    </div>
                  ))}
                  {intel.residents.known_associates && intel.residents.known_associates.length > 0 && (
                    <div className="pt-1.5 border-t border-border/10">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/55 mb-1">Associates</p>
                      <div className="flex flex-wrap gap-1">
                        {intel.residents.known_associates.slice(0, 8).map((n, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-border/15 bg-background/50 text-foreground/75">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Property facts */}
            {factList.length > 0 && (
              <Section delay={600} icon={Home} title="Property Facts">
                <div className="grid grid-cols-2 gap-1.5">
                  {factList.map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border/10 bg-background/30 px-2 py-1.5">
                      <p className="text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground/55 mb-0.5">{k}</p>
                      <p className="text-[10.5px] text-foreground/90 font-light truncate" title={v || ""}>{v}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Temporal changes — time slider style */}
            {intel.temporal_changes && intel.temporal_changes.length > 0 && (
              <Section delay={800} icon={Clock} title="Temporal Changes · Permit Audit">
                <div className="rounded-lg border border-border/15 bg-background/40 p-2.5 space-y-1.5">
                  {intel.temporal_changes.map((tc, i) => {
                    const flag = tc.flagged || tc.permit_status === "UNPERMITTED";
                    return (
                      <div key={i} className={`flex items-start gap-2 rounded px-2 py-1.5 ${flag ? "border border-red-500/25 bg-red-500/5" : "border border-transparent"}`}>
                        <span className="text-[10px] tabular-nums text-muted-foreground/55 min-w-[30px]">{tc.year}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10.5px] font-light leading-snug ${flag ? "text-red-200/90" : "text-foreground/85"}`}>{tc.change}</p>
                          {tc.permit_status && (
                            <p className={`text-[8.5px] uppercase tracking-[0.2em] mt-0.5 ${flag ? "text-red-400/80" : "text-muted-foreground/55"}`}>
                              {tc.permit_status}
                            </p>
                          )}
                        </div>
                        {flag && <FileWarning className="h-3 w-3 text-red-400/80 flex-shrink-0" strokeWidth={1.5} />}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Financial forensics */}
            {intel.financial_forensics && (
              (intel.financial_forensics.liens?.length ?? 0) > 0 ||
              (intel.financial_forensics.bankruptcy_filings?.length ?? 0) > 0 ||
              (intel.financial_forensics.anomaly_flags?.length ?? 0) > 0 ||
              intel.financial_forensics.tax_status
            ) && (
              <Section delay={1000} icon={DollarSign} title="Financial Forensics" accent="text-amber-400/70">
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5 space-y-2">
                  {intel.financial_forensics.tax_status && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Tax Status</span>
                      <span className={`text-[10px] uppercase tracking-[0.2em] font-medium ${
                        intel.financial_forensics.tax_status === "delinquent" ? "text-red-300" : "text-emerald-300"
                      }`}>{intel.financial_forensics.tax_status}</span>
                    </div>
                  )}
                  {intel.financial_forensics.distress_score != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Distress</span>
                        <span className="text-[10px] text-amber-300 tabular-nums">{intel.financial_forensics.distress_score}</span>
                      </div>
                      <div className="h-1 rounded-full bg-background/60 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-1000"
                          style={{ width: `${intel.financial_forensics.distress_score}%` }} />
                      </div>
                    </div>
                  )}
                  {(intel.financial_forensics.anomaly_flags || []).map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-400/80 mt-1" strokeWidth={1.5} />
                      <p className="text-[10.5px] text-amber-100/85 font-light leading-snug flex-1">{a}</p>
                    </div>
                  ))}
                  {(intel.financial_forensics.liens || []).map((l, i) => (
                    <p key={`l${i}`} className="text-[10.5px] text-foreground/80 font-light pl-4 border-l border-amber-400/30">Lien · {l}</p>
                  ))}
                  {(intel.financial_forensics.bankruptcy_filings || []).map((b, i) => (
                    <p key={`b${i}`} className="text-[10.5px] text-foreground/80 font-light pl-4 border-l border-red-400/40">Bankruptcy · {b}</p>
                  ))}
                </div>
              </Section>
            )}

            {/* Social graph */}
            {intel.social_graph && (intel.social_graph.nodes?.length ?? 0) > 1 && (
              <Section delay={1200} icon={Network} title="Relationship Spider" accent="text-blue-400/70">
                <div className="rounded-lg border border-border/15 bg-background/40 overflow-hidden">
                  <SocialGraph nodes={intel.social_graph.nodes || []} edges={intel.social_graph.edges || []} />
                  <div className="border-t border-border/10 px-2 py-1.5 flex items-center gap-3 text-[9px] text-muted-foreground/60">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />Target</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />Entity</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-foreground/70" />Person</span>
                    <span className="ml-auto tabular-nums">{intel.social_graph.nodes?.length ?? 0}n / {intel.social_graph.edges?.length ?? 0}e</span>
                  </div>
                </div>
              </Section>
            )}

            {/* Interior reconstruction — real MLS photos */}
            {intel.interior_photos && intel.interior_photos.length > 0 && (
              <Section delay={1400} icon={Camera} title="Interior Reconstruction · MLS Harvest">
                <div className="grid grid-cols-3 gap-1">
                  {intel.interior_photos.slice(0, 9).map((p, i) => (
                    <a key={i} href={p.source} target="_blank" rel="noreferrer"
                      className="relative aspect-square rounded overflow-hidden border border-border/15 bg-background/40 group">
                      <img src={p.url} alt="interior" loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[7px] uppercase tracking-widest text-white/80 truncate">{hostOf(p.source)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {/* Neighborhood patterns */}
            {intel.neighborhood_patterns && intel.neighborhood_patterns.length > 0 && (
              <Section delay={1600} icon={Activity} title="Neighborhood Patterns">
                <div className="space-y-1">
                  {intel.neighborhood_patterns.map((p, i) => (
                    <div key={i} className="relative pl-3 text-[10.5px] text-foreground/80 font-light leading-snug">
                      <span className="absolute left-0 top-[6px] w-1 h-1 rounded-full bg-blue-400/60" />
                      {p}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Prediction Engine */}
            {intel.prediction && intel.prediction.transaction_probability_12mo != null && (
              <Section delay={1800} icon={TrendingUp} title="Prediction Engine" accent="text-emerald-400/70">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Txn probability {intel.prediction.horizon_months ?? 12}mo</p>
                    <p className="text-xl font-light text-emerald-300 tabular-nums">{intel.prediction.transaction_probability_12mo}%</p>
                  </div>
                  <div className="h-1 rounded-full bg-background/60 overflow-hidden">
                    <div className="h-full bg-emerald-400/80 transition-all duration-1000"
                      style={{ width: `${intel.prediction.transaction_probability_12mo}%` }} />
                  </div>
                  {intel.prediction.signal_class && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="uppercase tracking-[0.2em] text-muted-foreground/60">Signal</span>
                      <span className="uppercase tracking-[0.2em] text-emerald-300">{intel.prediction.signal_class.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {intel.prediction.reasoning && (
                    <p className="text-[10.5px] text-foreground/80 font-light leading-relaxed pt-1 border-t border-emerald-500/15">
                      {intel.prediction.reasoning}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Sources */}
            {sources.length > 0 && (
              <Section delay={2000} icon={Radio} title="Live Sources Scraped">
                <div className="flex flex-wrap gap-1">
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.title || s.url}
                      className="flex items-center gap-1 text-[9.5px] font-light px-1.5 py-0.5 rounded border border-border/15 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/40 transition-colors">
                      {s.channel && <span className="text-[7.5px] uppercase tracking-[0.18em] text-muted-foreground/50">{s.channel}</span>}
                      <ExternalLink className="h-2 w-2 opacity-60" strokeWidth={1.5} />
                      <span className="truncate max-w-[110px]">{hostOf(s.url)}</span>
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
