import { useState, useCallback } from "react";
import {
  Crosshair, Loader2, Globe, Link2, Sparkles, Shield, Zap,
  Server, Cpu, Plug, Network, Building2, AlertTriangle, ExternalLink,
  Copy, Check, ChevronRight, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

// ─── Types ───────────────────────────────────────────────────────────────────
type Tone = "neutral" | "good" | "warn" | "critical";
interface Leaf { label: string; value: string; confidence?: "high" | "med" | "low"; }
interface Branch { id: string; label: string; icon: string; tone: Tone; leaves: Leaf[]; subdomains?: string[]; }
interface Edge { from: string; to: string; label?: string; }
interface Critical { branch: string; finding: string; severity: "high" | "med" | "low"; }
interface Blueprint {
  target: string;
  summary: string;
  score?: { security?: number; performance?: number; complexity?: number };
  branches: Branch[];
  edges: Edge[];
  criticals?: Critical[];
}

type SubState = { loading: boolean; blueprint?: Blueprint; error?: string };

const ICONS: Record<string, LucideIcon> = {
  globe: Globe, server: Server, cpu: Cpu, shield: Shield,
  plug: Plug, network: Network, building: Building2,
};

const TONE_STYLES: Record<Tone, { ring: string; dot: string; text: string; glow: string }> = {
  good:     { ring: "border-emerald-400/30", dot: "bg-emerald-400", text: "text-emerald-300/80", glow: "shadow-[0_0_20px_-8px] shadow-emerald-400/30" },
  neutral:  { ring: "border-border/30",      dot: "bg-muted-foreground/60", text: "text-muted-foreground/70", glow: "" },
  warn:     { ring: "border-amber-400/30",   dot: "bg-amber-400", text: "text-amber-300/80", glow: "shadow-[0_0_20px_-8px] shadow-amber-400/30" },
  critical: { ring: "border-red-400/40",     dot: "bg-red-400", text: "text-red-300/80", glow: "shadow-[0_0_20px_-8px] shadow-red-400/40" },
};

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

const SUBDOMAIN_BRANCH_META: Record<string, Pick<Branch, "label" | "icon" | "tone">> = {
  domain: { label: "DOMAIN & DNS", icon: "globe", tone: "neutral" },
  hosting: { label: "HOSTING & CDN", icon: "server", tone: "good" },
  stack: { label: "TECH STACK", icon: "cpu", tone: "neutral" },
  security: { label: "SECURITY POSTURE", icon: "shield", tone: "warn" },
  thirdparty: { label: "THIRD-PARTY", icon: "plug", tone: "neutral" },
  network: { label: "NETWORK TOPOLOGY", icon: "network", tone: "neutral" },
  org: { label: "ORG INTEL", icon: "building", tone: "neutral" },
  threats: { label: "THREAT & CVE EXPOSURE", icon: "shield", tone: "warn" },
  leaks: { label: "DATA LEAK SURFACE", icon: "shield", tone: "critical" },
  people: { label: "PERSONNEL EXPOSURE", icon: "building", tone: "neutral" },
  history: { label: "HISTORICAL EVOLUTION", icon: "globe", tone: "neutral" },
  attacksurface: { label: "ATTACK SURFACE", icon: "network", tone: "warn" },
  peers: { label: "PEER COMPARISON", icon: "network", tone: "neutral" },
  socialeng: { label: "SOCIAL-ENG RISK", icon: "building", tone: "warn" },
  monitoring: { label: "CHANGE MONITORING", icon: "network", tone: "neutral" },
  remediation: { label: "REMEDIATION ROADMAP", icon: "shield", tone: "good" },
  underground: { label: "UNDERGROUND MENTIONS", icon: "shield", tone: "neutral" },
  recon: { label: "RECON SWEEP", icon: "network", tone: "warn" },
  bugbounty: { label: "BUG BOUNTY SURFACE", icon: "shield", tone: "warn" },
};

const toTitle = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const toLeafValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Unknown";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const normalizeSubdomainBlueprint = (raw: unknown, host: string): Blueprint | null => {
  if (!isRecord(raw)) return null;
  if (Array.isArray(raw.branches) && raw.branches.length > 0) return raw as unknown as Blueprint;

  const branches = Object.entries(SUBDOMAIN_BRANCH_META)
    .map(([id, meta]) => {
      const section = raw[id];
      if (!isRecord(section)) return null;
      const leaves = Object.entries(section)
        .filter(([key]) => key !== "subdomains")
        .slice(0, 8)
        .map(([key, value]) => ({
          label: toTitle(key),
          value: toLeafValue(value),
          confidence: /unknown|likely|inferred/i.test(toLeafValue(value)) ? "med" : "high",
        })) as Leaf[];

      return leaves.length > 0 ? { id, ...meta, leaves } : null;
    })
    .filter(Boolean) as Branch[];

  if (!branches.length) return null;

  return {
    target: typeof raw.target === "string" ? raw.target : isRecord(raw.domain) && typeof raw.domain.name === "string" ? raw.domain.name : host,
    summary: typeof raw.summary === "string" ? raw.summary : `Branch intelligence mapped for ${isRecord(raw.domain) && typeof raw.domain.name === "string" ? raw.domain.name : host}.`,
    score: isRecord(raw.score) ? raw.score as Blueprint["score"] : undefined,
    branches,
    edges: Array.isArray(raw.edges) ? raw.edges as Edge[] : [
      { from: "domain", to: "hosting", label: "resolves" },
      { from: "hosting", to: "stack", label: "serves" },
      { from: "stack", to: "security", label: "exposes" },
      { from: "stack", to: "thirdparty", label: "loads" },
    ],
    criticals: Array.isArray(raw.criticals) ? raw.criticals as Critical[] : [],
  };
};

const LinkExtractView = () => {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [subStates, setSubStates] = useState<Record<string, SubState>>({});

  const fetchSubdomainBlueprint = useCallback(async (host: string) => {
    setSubStates((s) => ({ ...s, [host]: { loading: true } }));
    try {
      const byok = getActiveIntelMapByok();
      const { data, error: invokeError } = await supabase.functions.invoke(
        "zophiel-blueprint-extract",
        { body: { url: `https://${host}`, mode: "subdomain", ...(byok ? { byok } : {}) } },
      );
      console.log("[subdomain]", host, { invokeError, data });
      if (invokeError) throw new Error(invokeError.message || String(invokeError));
      if (data?.error) throw new Error(data.error);
      const normalized = normalizeSubdomainBlueprint(data?.blueprint, host);
      if (!normalized?.branches?.length) throw new Error("No branch intelligence returned");
      setSubStates((s) => ({ ...s, [host]: { loading: false, blueprint: normalized } }));
    } catch (err: unknown) {
      console.error("[subdomain] failed", host, err);
      setSubStates((s) => ({ ...s, [host]: { loading: false, error: getErrorMessage(err, "Failed to extract") } }));
    }
  }, []);

  const normalizeUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleExtract = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = normalizeUrl(url);
    if (!target || !URL_REGEX.test(target)) {
      setError("Enter a valid URL or domain (e.g. example.com)");
      return;
    }

    setExtracting(true);
    setError(null);
    setBlueprint(null);
    setSubStates({});

    try {
      const byok = getActiveIntelMapByok();
      const { data, error: invokeError } = await supabase.functions.invoke(
        "zophiel-blueprint-extract",
        { body: { url: target, ...(byok ? { byok } : {}) } },
      );
      if (invokeError) throw new Error(invokeError.message || String(invokeError));
      if (!data) throw new Error("No response from blueprint engine");
      if (data.error) throw new Error(data.error);
      if (!data.blueprint?.branches?.length) throw new Error("Engine returned empty blueprint");
      setBlueprint(data.blueprint as Blueprint);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to extract blueprint"));
    } finally {
      setExtracting(false);
    }
  }, [url]);

  const handleCopy = useCallback(() => {
    if (!blueprint) return;
    navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [blueprint]);

  const displayDomain = (() => {
    try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  })();

  return (
    <div className="w-full animate-fade-in space-y-4">
      {/* Hero / Input */}
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.04] via-card/30 to-card/10 backdrop-blur-xl px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <Crosshair className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-light tracking-wide text-foreground">Link Intelligence Blueprint</h2>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              Drop any URL. Get a visual blueprint web — infrastructure, stack, security, topology.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/30 bg-card/30 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase shrink-0">
            <Shield className="h-2.5 w-2.5" /> Local-Only
          </span>
        </div>

        <form onSubmit={handleExtract} className="mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 backdrop-blur-md px-3 py-2 focus-within:border-accent/40 transition-colors">
            <Link2 className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://example.com or example.com"
              className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
              disabled={extracting}
            />
            <button
              type="submit"
              disabled={extracting || !url.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-medium tracking-wide text-accent transition-colors"
            >
              {extracting ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />MAPPING</>) : (<><Crosshair className="h-3.5 w-3.5" />MAP IT</>)}
            </button>
          </div>
          {error && <p className="mt-2 text-[10px] font-light text-red-400/80">{error}</p>}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-extralight tracking-[0.12em] text-muted-foreground/40 uppercase">
          <span className="inline-flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Security tree</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Network className="h-2.5 w-2.5" /> Topology web</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> Visual only</span>
        </div>
      </div>

      {/* Loading */}
      {extracting && (
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/60 uppercase">
            Mapping infrastructure web for {displayDomain || "target"}…
          </p>
        </div>
      )}

      {/* Visual Blueprint */}
      {blueprint && !extracting && (
        <div className="space-y-4 animate-fade-in">
          {/* Header bar */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-3 flex items-center gap-3 flex-wrap">
            <Crosshair className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-accent/80 uppercase">Blueprint Map</span>
            <span className="text-[11px] font-light text-foreground/80 truncate">{blueprint.target}</span>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-light text-muted-foreground/60">
              {blueprint.score && (
                <>
                  <ScorePip label="SEC" value={blueprint.score.security} />
                  <ScorePip label="PERF" value={blueprint.score.performance} />
                  <ScorePip label="CPLX" value={blueprint.score.complexity} />
                </>
              )}
              <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-foreground/5 transition text-muted-foreground/50 hover:text-foreground/80" title="Copy JSON">
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
              <a href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-foreground/5 transition text-muted-foreground/50 hover:text-foreground/80" title="Visit URL">
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Summary visual line */}
          {blueprint.summary && (
            <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-sm px-5 py-3 text-[11px] font-extralight leading-relaxed text-muted-foreground/80">
              {blueprint.summary}
            </div>
          )}

          {/* Web Diagram — central node radiating to branches */}
          <WebDiagram blueprint={blueprint} />

          {/* Branches grid (the tree leaves) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blueprint.branches.map((b) => (
              <BranchCard
                key={b.id}
                branch={b}
                subStates={subStates}
                onFetchSubdomain={fetchSubdomainBlueprint}
              />
            ))}
          </div>

          {/* Criticals strip */}
          {blueprint.criticals && blueprint.criticals.length > 0 && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.03] backdrop-blur-sm px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3 w-3 text-red-400/80" />
                <span className="text-[10px] font-semibold tracking-[0.2em] text-red-300/80 uppercase">Critical Findings</span>
              </div>
              <ul className="space-y-1.5">
                {blueprint.criticals.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-light text-foreground/80">
                    <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${c.severity === "high" ? "bg-red-400" : c.severity === "med" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                    <span className="text-muted-foreground/50 uppercase tracking-wider text-[9px] mt-0.5">{c.branch}</span>
                    <span className="flex-1">{c.finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!blueprint && !extracting && !error && (
        <div className="rounded-2xl border border-dashed border-border/20 bg-card/10 px-5 py-10 text-center">
          <p className="text-[11px] font-extralight tracking-wide text-muted-foreground/50">
            Enter a URL above to map its infrastructure as a visual blueprint web.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Score pill ──────────────────────────────────────────────────────────────
const ScorePip = ({ label, value }: { label: string; value?: number }) => {
  if (typeof value !== "number") return null;
  const color = value >= 75 ? "text-emerald-300/80 border-emerald-400/30" : value >= 45 ? "text-amber-300/80 border-amber-400/30" : "text-red-300/80 border-red-400/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${color} bg-background/30 px-2 py-0.5 text-[9px] tracking-wider`}>
      {label} <strong className="font-semibold">{value}</strong>
    </span>
  );
};

// ─── Web Diagram (SVG radial) ────────────────────────────────────────────────
const WebDiagram = ({ blueprint }: { blueprint: Blueprint }) => {
  const branches = blueprint.branches;
  const n = branches.length;
  // viewBox 800x440, center node
  const cx = 400, cy = 220;
  const rx = 320, ry = 170; // ellipse radius

  const positions: Record<string, { x: number; y: number }> = {};
  branches.forEach((b, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    positions[b.id] = { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });

  return (
    <div className="rounded-2xl border border-border/15 bg-gradient-to-br from-card/20 via-card/10 to-background/0 backdrop-blur-sm p-2 overflow-hidden">
      <svg viewBox="0 0 800 440" className="w-full h-auto" style={{ maxHeight: 480 }}>
        {/* Subtle grid */}
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          </radialGradient>
          <pattern id="gridP" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.08" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="800" height="440" fill="url(#gridP)" />
        <circle cx={cx} cy={cy} r="120" fill="url(#centerGlow)" />

        {/* Edges from blueprint (between branches) */}
        {blueprint.edges?.map((e, i) => {
          const from = positions[e.from];
          const to = positions[e.to];
          if (!from || !to) return null;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2 - 20;
          return (
            <g key={`e-${i}`}>
              <path
                d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                fill="none"
                stroke="hsl(var(--accent))"
                strokeOpacity="0.18"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            </g>
          );
        })}

        {/* Spokes from center to each branch */}
        {branches.map((b) => {
          const p = positions[b.id];
          const tone = TONE_STYLES[b.tone] || TONE_STYLES.neutral;
          const stroke =
            b.tone === "good" ? "rgb(52 211 153 / 0.4)" :
            b.tone === "warn" ? "rgb(251 191 36 / 0.4)" :
            b.tone === "critical" ? "rgb(248 113 113 / 0.5)" :
            "hsl(var(--muted-foreground) / 0.25)";
          return (
            <line key={`s-${b.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke={stroke} strokeWidth="1.2" />
          );
        })}

        {/* Center node */}
        <g>
          <circle cx={cx} cy={cy} r="38" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeOpacity="0.5" strokeWidth="1.2" />
          <circle cx={cx} cy={cy} r="48" fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 4" />
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="500" letterSpacing="2">TARGET</text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontWeight="300">
            {blueprint.target.length > 22 ? blueprint.target.slice(0, 20) + "…" : blueprint.target}
          </text>
        </g>

        {/* Branch nodes */}
        {branches.map((b) => {
          const p = positions[b.id];
          const Icon = ICONS[b.icon] || Globe;
          const fill =
            b.tone === "good" ? "rgb(16 185 129 / 0.12)" :
            b.tone === "warn" ? "rgb(245 158 11 / 0.12)" :
            b.tone === "critical" ? "rgb(239 68 68 / 0.15)" :
            "hsl(var(--card) / 0.6)";
          const stroke =
            b.tone === "good" ? "rgb(52 211 153 / 0.5)" :
            b.tone === "warn" ? "rgb(251 191 36 / 0.5)" :
            b.tone === "critical" ? "rgb(248 113 113 / 0.6)" :
            "hsl(var(--border))";
          return (
            <g key={`n-${b.id}`}>
              <circle cx={p.x} cy={p.y} r="28" fill={fill} stroke={stroke} strokeWidth="1.2" />
              <foreignObject x={p.x - 9} y={p.y - 18} width="18" height="18">
                <div className="w-full h-full flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-foreground/80" />
                </div>
              </foreignObject>
              <text x={p.x} y={p.y + 8} textAnchor="middle" className="fill-foreground" fontSize="8" fontWeight="500" letterSpacing="1.5">
                {b.label.split(" ")[0]}
              </text>
              <text x={p.x} y={p.y + 44} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontWeight="300" letterSpacing="0.5">
                {b.leaves.length} signals
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Branch Card (the "tree" leaves) ─────────────────────────────────────────
const BranchCard = ({
  branch,
  subStates,
  onFetchSubdomain,
}: {
  branch: Branch;
  subStates: Record<string, SubState>;
  onFetchSubdomain: (host: string) => void;
}) => {
  const Icon = ICONS[branch.icon] || Globe;
  const tone = TONE_STYLES[branch.tone] || TONE_STYLES.neutral;
  const isSubdomainBranch =
    branch.id === "subdomains" && Array.isArray(branch.subdomains) && branch.subdomains.length > 0;
  const colSpanClass = isSubdomainBranch ? "md:col-span-2 lg:col-span-3" : "";

  return (
    <div className={`rounded-2xl border ${tone.ring} bg-card/30 backdrop-blur-sm p-4 ${tone.glow} transition-all hover:bg-card/40 ${colSpanClass}`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/10">
        <div className="h-7 w-7 rounded-lg bg-background/40 border border-border/20 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-foreground/70" />
        </div>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 uppercase truncate flex-1">
          {branch.label}
          {isSubdomainBranch && (
            <span className="ml-2 text-muted-foreground/50 font-light tracking-wider">
              {branch.subdomains!.length} mapped
            </span>
          )}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      </div>

      {/* Tree leaves */}
      <ul className="space-y-1.5 relative pl-3">
        <span className="absolute left-0 top-1 bottom-1 w-px bg-border/20" />
        {branch.leaves.map((leaf, i) => (
          <li key={i} className="relative flex items-baseline gap-2 text-[11px]">
            <span className="absolute -left-3 top-2 h-px w-2 bg-border/20" />
            <span className="font-extralight text-muted-foreground/60 tracking-wide truncate min-w-0 max-w-[50%]">
              {leaf.label}
            </span>
            <span className="flex-1 border-b border-dotted border-border/15 mb-0.5 mx-1" />
            <span className="font-light text-foreground/90 truncate text-right max-w-[55%]" title={leaf.value}>
              {leaf.value}
            </span>
          </li>
        ))}
      </ul>

      {/* Subdomain expandable branches */}
      {isSubdomainBranch && (
        <div className="mt-4 pt-3 border-t border-border/10 space-y-1.5">
          <div className="text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/50 uppercase mb-2">
            Branch Intelligence — click to expand
          </div>
          {branch.subdomains!.map((host) => (
            <SubdomainRow
              key={host}
              host={host}
              state={subStates[host]}
              onFetch={() => onFetchSubdomain(host)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Subdomain expandable row ────────────────────────────────────────────────
const SubdomainRow = ({
  host,
  state,
  onFetch,
}: {
  host: string;
  state?: SubState;
  onFetch: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (!state || state.error)) onFetch();
  };

  return (
    <div className="rounded-lg border border-border/15 bg-background/30">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/[0.03] transition-colors rounded-lg"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        )}
        <Network className="h-3 w-3 text-accent/70 shrink-0" />
        <span className="text-[11px] font-light text-foreground/85 truncate flex-1">{host}</span>
        {state?.loading && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
        {state?.error && <span className="text-[9px] text-red-400/80 uppercase tracking-wider">err</span>}
        {state?.blueprint && (
          <span className="text-[9px] text-emerald-400/70 uppercase tracking-wider">live</span>
        )}
      </button>

      {open && state?.error && (
        <div className="px-3 pb-2 text-[10px] text-red-400/70">{state.error}</div>
      )}

      {open && state?.blueprint && (
        <div className="p-3 border-t border-border/10 space-y-3">
          {state.blueprint.summary && (
            <div className="text-[10px] font-extralight leading-relaxed text-muted-foreground/75">
              {state.blueprint.summary}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {state.blueprint.branches
              .filter((b) => b.id !== "subdomains")
              .map((b) => (
                <NestedBranch key={b.id} branch={b} />
              ))}
          </div>
          {state.blueprint.criticals && state.blueprint.criticals.length > 0 && (
            <div className="rounded-lg border border-red-400/20 bg-red-500/[0.03] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-2.5 w-2.5 text-red-400/80" />
                <span className="text-[9px] font-semibold tracking-[0.2em] text-red-300/80 uppercase">
                  Criticals
                </span>
              </div>
              <ul className="space-y-1">
                {state.blueprint.criticals.map((c, i) => (
                  <li key={i} className="text-[10px] font-light text-foreground/80 flex items-start gap-2">
                    <span className={`mt-1 h-1 w-1 rounded-full shrink-0 ${c.severity === "high" ? "bg-red-400" : c.severity === "med" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                    <span className="text-muted-foreground/50 uppercase tracking-wider text-[8px] mt-0.5">{c.branch}</span>
                    <span className="flex-1">{c.finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Nested branch (compact, for inside subdomain expansion) ────────────────
const NestedBranch = ({ branch }: { branch: Branch }) => {
  const Icon = ICONS[branch.icon] || Globe;
  const tone = TONE_STYLES[branch.tone] || TONE_STYLES.neutral;
  return (
    <div className={`rounded-lg border ${tone.ring} bg-card/20 p-2.5`}>
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/10">
        <Icon className="h-3 w-3 text-foreground/70" />
        <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80 uppercase truncate flex-1">
          {branch.label}
        </span>
        <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
      </div>
      <ul className="space-y-1">
        {branch.leaves.map((leaf, i) => (
          <li key={i} className="flex items-baseline gap-2 text-[10px]">
            <span className="font-extralight text-muted-foreground/60 tracking-wide truncate max-w-[45%]">
              {leaf.label}
            </span>
            <span className="flex-1 border-b border-dotted border-border/15 mb-0.5 mx-1" />
            <span className="font-light text-foreground/90 truncate text-right max-w-[55%]" title={leaf.value}>
              {leaf.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};


export default LinkExtractView;
