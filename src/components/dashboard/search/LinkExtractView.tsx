import { useState, useCallback } from "react";
import {
  Crosshair, Loader2, Globe, Link2, Sparkles, Shield, Zap,
  Server, Cpu, Plug, Network, Building2, AlertTriangle, ExternalLink,
  Copy, Check, ChevronRight, ChevronDown, KeyRound, Eye, EyeOff,
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
interface SecretHit { type: string; label: string; match: string; raw: string; source: string; severity: "critical" | "high" | "med" | "low"; context?: string; }
interface SecretScan {
  bundles_scanned: number;
  bundles: Array<{ source: string; size: number; hits: number }>;
  inline_scripts: number;
  total_bytes: number;
  secrets: SecretHit[];
  emails: string[];
  github_links: string[];
  developer_comments: string[];
  internal_codenames: string[];
  feature_flags: string[];
  truncated: boolean;
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
  huntsurface: { label: "HUNT SURFACE AUDIT", icon: "shield", tone: "warn" },
};

// Plain-language explanations — what each branch means in everyday words.
const BRANCH_GLOSSARY: Record<string, { plain: string; why: string; example: string }> = {
  domain: { plain: "The website's address book entry — who owns the name and which servers answer for it.", why: "If this record is weak or expired, attackers can hijack the site or redirect mail.", example: "Like the name on a mailbox and the postal route to reach it." },
  hosting: { plain: "The physical (or cloud) machines actually serving the site, plus the delivery network in front of them.", why: "Tells you how fast and resilient the site is, and which provider holds the keys.", example: "The building the shop is in, plus the delivery trucks that hand out copies." },
  stack: { plain: "The software bricks — frameworks, runtimes, libraries — used to build the site.", why: "Outdated bricks have known cracks (CVEs) attackers exploit.", example: "Like knowing whether a house is wood, brick, or steel — and how old." },
  security: { plain: "The locks, alarms, and headers protecting the site from common web attacks.", why: "Missing headers (CSP, HSTS, etc.) leave the front door unlocked.", example: "The deadbolts, security cameras, and alarm system on the building." },
  thirdparty: { plain: "Outside services the site loads — analytics, ads, fonts, chat widgets, payment scripts.", why: "Each one is a guest with keys; if any are compromised, your site is too.", example: "Contractors you let walk around inside your shop after hours." },
  network: { plain: "The pipes, peers and routes the site's traffic actually travels through.", why: "Reveals chokepoints, hidden providers and cross-border data paths.", example: "The highways and toll roads packets take to reach customers." },
  org: { plain: "The legal entity behind the site — company name, registration, key contacts.", why: "Useful for due diligence, sanctions checks, and accountability.", example: "The business license posted on the wall." },
  subdomains: { plain: "All the side-doors of the same brand — api.x.com, dev.x.com, mail.x.com, etc.", why: "Forgotten subdomains are the #1 way attackers slip in unnoticed.", example: "Side entrances and loading docks behind the main storefront." },
  threats: { plain: "Known public vulnerabilities (CVEs) tied to the exact software versions detected.", why: "If a CVE is known and unpatched, it's already a public exploit recipe.", example: "Recall notices on the specific car model you drive." },
  leaks: { plain: "Where credentials, keys, or customer data tend to leak for this kind of stack.", why: "Exposed secrets = instant account takeover and data theft.", example: "House keys accidentally left under the welcome mat." },
  people: { plain: "Public footprint of staff — email patterns, LinkedIn presence, role exposure.", why: "Phishers use this to impersonate or target employees with precision.", example: "The staff name-tags visible from the street window." },
  history: { plain: "How the site has changed over time — old stacks, dead pages, archive snapshots.", why: "Legacy code paths often stay live and unpatched in the background.", example: "Renovation history of a building — old wiring still in the walls." },
  attacksurface: { plain: "Every door, window, and vent the outside internet can actually touch.", why: "You can only defend what you can see; this maps it.", example: "A floor plan showing every entrance, including the ones you forgot." },
  peers: { plain: "Other sites running on the same shared infrastructure or stack.", why: "If a noisy neighbor gets compromised, you may bleed too.", example: "Tenants in the same office building sharing one front desk." },
  socialeng: { plain: "How easy it would be to trick staff or customers via fake emails, calls, or impersonation.", why: "Most breaches start with a convincing message, not a hack.", example: "How easy it is to phone the front desk and pretend to be the boss." },
  monitoring: { plain: "Whether changes to the site, certs, or DNS are being watched and alerted on.", why: "Silent changes are how attackers maintain footholds.", example: "Whether the security cameras are recording or just hanging there." },
  remediation: { plain: "Prioritised, plain-English fixes — what to patch first, second, third.", why: "Turns the audit into a real action plan, not just a scary list.", example: "A to-do list from the building inspector, ranked by danger." },
  underground: { plain: "Mentions of the brand or domain in public archives, leak indices and forums.", why: "Early-warning signal that someone is planning or selling access.", example: "Hearing your address being whispered about in the wrong neighborhood." },
  recon: { plain: "A baseline external sweep — DNS, WHOIS, GeoIP, banners, ports, basic crawl.", why: "The same first look any auditor (or attacker) would take.", example: "Walking around the building once and writing down everything visible." },
  huntsurface: { plain: "Deep self-audit checklist used by professional security researchers.", why: "Catches the subtle issues — takeovers, leaked JS secrets, open redirects, CORS gaps.", example: "A licensed home inspector with a thermal camera, not just a flashlight." },
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
  const [secrets, setSecrets] = useState<SecretScan | null>(null);

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

// ─── Intelligence Constellation (HUD-grade radial) ──────────────────────────
const WebDiagram = ({ blueprint }: { blueprint: Blueprint }) => {
  const branches = blueprint.branches;
  const n = branches.length;
  const VW = 900, VH = 560;
  const cx = VW / 2, cy = VH / 2;
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  // Two-ring layout: critical/warn outer, neutral/good inner — feels intelligence-grade
  const ringFor = (tone: string) => (tone === "critical" || tone === "warn" ? "outer" : "inner");
  const outer = branches.filter((b) => ringFor(b.tone) === "outer");
  const inner = branches.filter((b) => ringFor(b.tone) === "inner");
  const positions: Record<string, { x: number; y: number; ring: "inner" | "outer" }> = {};
  const place = (arr: Branch[], rx: number, ry: number, ring: "inner" | "outer", phase = 0) => {
    arr.forEach((b, i) => {
      const a = (Math.PI * 2 * i) / Math.max(arr.length, 1) - Math.PI / 2 + phase;
      positions[b.id] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, ring };
    });
  };
  place(outer, 360, 220, "outer", 0);
  place(inner, 200, 130, "inner", Math.PI / Math.max(inner.length, 1));

  const sel = selected ? branches.find((b) => b.id === selected) : null;
  const glossary = sel ? BRANCH_GLOSSARY[sel.id] : null;

  const toneColor = (t: string) =>
    t === "good" ? "rgb(110 231 183)" :
    t === "warn" ? "rgb(251 191 36)" :
    t === "critical" ? "rgb(248 113 113)" :
    "rgb(180 180 180)";

  // signal density score (0-100) — drives node radius
  const maxSignals = Math.max(...branches.map((b) => b.leaves.length), 1);
  const radiusFor = (b: Branch) => 22 + (b.leaves.length / maxSignals) * 12;

  return (
    <div className="rounded-2xl border border-border/15 bg-[radial-gradient(ellipse_at_center,hsl(var(--card)/0.35)_0%,hsl(var(--background))_70%)] backdrop-blur-sm overflow-hidden relative">
      {/* HUD top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/10 bg-background/40">
        <div className="flex items-center gap-3 text-[9px] font-mono tracking-[0.25em] text-muted-foreground/60 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
          <span>ZOPHIEL // CONSTELLATION</span>
          <span className="text-muted-foreground/30">|</span>
          <span>TGT {blueprint.target}</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono tracking-[0.25em] text-muted-foreground/40 uppercase">
          <span>NODES {branches.length}</span>
          <span>|</span>
          <span>EDGES {blueprint.edges?.length ?? 0}</span>
          <span>|</span>
          <span className="text-foreground/70">CLICK TO INSPECT</span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" style={{ maxHeight: 560 }}>
          <defs>
            <radialGradient id="hudGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.18" />
              <stop offset="60%" stopColor="hsl(var(--accent))" stopOpacity="0.04" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
            </radialGradient>
            <pattern id="hudGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.06" strokeWidth="0.5" />
            </pattern>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect x="0" y="0" width={VW} height={VH} fill="url(#hudGrid)" />

          {/* Crosshair guides */}
          <line x1={cx} y1="0" x2={cx} y2={VH} stroke="hsl(var(--border))" strokeOpacity="0.08" strokeDasharray="2 6" />
          <line x1="0" y1={cy} x2={VW} y2={cy} stroke="hsl(var(--border))" strokeOpacity="0.08" strokeDasharray="2 6" />

          {/* Concentric rings */}
          {[80, 160, 260, 380].map((r) => (
            <ellipse key={r} cx={cx} cy={cy} rx={r} ry={r * 0.62}
              fill="none" stroke="hsl(var(--border))" strokeOpacity="0.07" strokeWidth="0.5" />
          ))}

          {/* Scanning sweep */}
          <g opacity="0.35" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <line x1={cx} y1={cy} x2={cx + 380} y2={cy} stroke="hsl(var(--accent))" strokeOpacity="0.25" strokeWidth="0.6">
              <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="14s" repeatCount="indefinite" />
            </line>
          </g>

          {/* Corner brackets */}
          {[
            [16, 56, 1, 1], [VW - 16, 56, -1, 1],
            [16, VH - 16, 1, -1], [VW - 16, VH - 16, -1, -1],
          ].map(([x, y, dx, dy], i) => (
            <g key={i} stroke="hsl(var(--accent))" strokeOpacity="0.35" strokeWidth="1" fill="none">
              <path d={`M ${x} ${y} l ${14 * dx} 0 M ${x} ${y} l 0 ${14 * dy}`} />
            </g>
          ))}

          {/* Center core glow */}
          <circle cx={cx} cy={cy} r="160" fill="url(#hudGlow)" />

          {/* Edges */}
          {blueprint.edges?.map((e, i) => {
            const from = positions[e.from], to = positions[e.to];
            if (!from || !to) return null;
            const active = !selected || e.from === selected || e.to === selected;
            const hot = hover && (e.from === hover || e.to === hover);
            return (
              <line key={`e-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="hsl(var(--accent))"
                strokeOpacity={active ? (hot ? 0.55 : 0.18) : 0.04}
                strokeWidth={hot ? 1.2 : 0.7}
                strokeDasharray={hot ? "0" : "1 4"} />
            );
          })}

          {/* Spokes from core to nodes */}
          {branches.map((b) => {
            const p = positions[b.id];
            const dim = selected && selected !== b.id;
            return (
              <line key={`sp-${b.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
                stroke={toneColor(b.tone)} strokeOpacity={dim ? 0.05 : 0.22} strokeWidth="0.8" />
            );
          })}

          {/* Center target */}
          <g onClick={() => setSelected(null)} style={{ cursor: "pointer" }} filter="url(#softGlow)">
            <circle cx={cx} cy={cy} r="58" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeOpacity="0.55" strokeWidth="1.4" />
            <circle cx={cx} cy={cy} r="68" fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="2 5" />
            <circle cx={cx} cy={cy} r="78" fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.08" strokeWidth="0.6" />
            <text x={cx} y={cy - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontWeight="400" letterSpacing="3" fontFamily="monospace">// TARGET</text>
            <text x={cx} y={cy + 6} textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="500" letterSpacing="1">
              {blueprint.target.length > 24 ? blueprint.target.slice(0, 22) + "…" : blueprint.target}
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle" className="fill-emerald-400/70" fontSize="7" letterSpacing="2" fontFamily="monospace">● ACTIVE</text>
          </g>

          {/* Nodes */}
          {branches.map((b) => {
            const p = positions[b.id];
            const Icon = ICONS[b.icon] || Globe;
            const isSel = selected === b.id;
            const isHov = hover === b.id;
            const dim = selected && !isSel;
            const r = radiusFor(b);
            const tc = toneColor(b.tone);
            return (
              <g key={`n-${b.id}`}
                onMouseEnter={() => setHover(b.id)}
                onMouseLeave={() => setHover(null)}
                onClick={(ev) => { ev.stopPropagation(); setSelected(isSel ? null : b.id); }}
                style={{ cursor: "pointer", opacity: dim ? 0.3 : 1, transition: "opacity 220ms" }}
              >
                {(isSel || isHov) && (
                  <>
                    <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke={tc} strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="2 3">
                      {isSel && <animate attributeName="r" from={r + 4} to={r + 14} dur="1.8s" repeatCount="indefinite" />}
                      {isSel && <animate attributeName="stroke-opacity" from="0.55" to="0" dur="1.8s" repeatCount="indefinite" />}
                    </circle>
                    {/* Tick marks around active node */}
                    {[0, 90, 180, 270].map((deg) => (
                      <line key={deg}
                        x1={p.x + Math.cos((deg * Math.PI) / 180) * (r + 4)}
                        y1={p.y + Math.sin((deg * Math.PI) / 180) * (r + 4)}
                        x2={p.x + Math.cos((deg * Math.PI) / 180) * (r + 10)}
                        y2={p.y + Math.sin((deg * Math.PI) / 180) * (r + 10)}
                        stroke={tc} strokeOpacity="0.6" strokeWidth="1" />
                    ))}
                  </>
                )}
                {/* outer halo */}
                <circle cx={p.x} cy={p.y} r={r + 2} fill={tc} fillOpacity="0.04" />
                <circle cx={p.x} cy={p.y} r={r} fill="hsl(var(--card) / 0.85)" stroke={tc} strokeOpacity={isSel ? 0.95 : 0.55} strokeWidth={isSel ? 1.6 : 1} />
                {/* inner divider */}
                <line x1={p.x - r * 0.7} y1={p.y + 2} x2={p.x + r * 0.7} y2={p.y + 2} stroke={tc} strokeOpacity="0.18" strokeWidth="0.5" />

                <foreignObject x={p.x - 9} y={p.y - r * 0.65} width="18" height="18">
                  <div className="w-full h-full flex items-center justify-center pointer-events-none">
                    <Icon className="h-3.5 w-3.5" style={{ color: tc, opacity: 0.85 }} />
                  </div>
                </foreignObject>
                <text x={p.x} y={p.y + r * 0.55} textAnchor="middle" className="fill-foreground/90 pointer-events-none" fontSize="7.5" fontWeight="600" letterSpacing="1.4" fontFamily="monospace">
                  {b.label.split(" ")[0].slice(0, 10).toUpperCase()}
                </text>
                {/* signal HUD label */}
                <g pointerEvents="none">
                  <rect x={p.x - 22} y={p.y + r + 6} width="44" height="12" rx="2"
                    fill="hsl(var(--background) / 0.7)" stroke={tc} strokeOpacity="0.3" strokeWidth="0.5" />
                  <text x={p.x} y={p.y + r + 14.5} textAnchor="middle" className="fill-muted-foreground/80" fontSize="7" letterSpacing="1.2" fontFamily="monospace">
                    {String(b.leaves.length).padStart(2, "0")} SIG
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* HUD bottom strip */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-1.5 border-t border-border/10 bg-background/40 flex items-center justify-between text-[8px] font-mono tracking-[0.25em] text-muted-foreground/40 uppercase pointer-events-none">
          <span>SCAN: LIVE</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400/70" />NORMAL</span>
            <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-amber-400/70" />ELEVATED</span>
            <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-red-400/70" />CRITICAL</span>
          </div>
        </div>
      </div>

      {/* Inspector panel */}
      {sel && (
        <div className="border-t border-border/15 bg-background/70 backdrop-blur-md p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono tracking-[0.3em] text-muted-foreground/40">INSPECT //</span>
              <span className={`h-1.5 w-1.5 rounded-full ${(TONE_STYLES[sel.tone] || TONE_STYLES.neutral).dot}`} />
              <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/95 uppercase">{sel.label}</span>
              <span className="text-[9px] font-mono tracking-wider text-muted-foreground/50">[{String(sel.leaves.length).padStart(2, "0")} SIGNALS]</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/50 hover:text-foreground/80 transition uppercase">[ esc ]</button>
          </div>
          {glossary ? (
            <div className="space-y-2 text-[11px] font-extralight leading-relaxed">
              <p className="text-foreground/85"><span className="text-muted-foreground/40 font-mono uppercase tracking-[0.2em] text-[9px] mr-2">DEF</span>{glossary.plain}</p>
              <p className="text-foreground/75"><span className="text-muted-foreground/40 font-mono uppercase tracking-[0.2em] text-[9px] mr-2">IMPACT</span>{glossary.why}</p>
              <p className="text-muted-foreground/70 italic"><span className="text-muted-foreground/40 font-mono uppercase tracking-[0.2em] text-[9px] mr-2 not-italic">ANALOG</span>{glossary.example}</p>
            </div>
          ) : (
            <p className="text-[11px] font-extralight text-muted-foreground/60">No glossary entry — see the branch card below for raw signals.</p>
          )}
          {sel.leaves.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/10">
              <div className="text-[8px] font-mono uppercase tracking-[0.25em] text-muted-foreground/40 mb-1.5">// TOP SIGNALS</div>
              <ul className="space-y-1">
                {sel.leaves.slice(0, 3).map((l, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[11px]">
                    <span className="font-mono text-muted-foreground/40 text-[8px]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-extralight text-muted-foreground/60 truncate min-w-0 max-w-[35%]">{l.label}</span>
                    <span className="flex-1 border-b border-dotted border-border/15 mb-0.5" />
                    <span className="font-light text-foreground/85 truncate text-right max-w-[55%]" title={l.value}>{l.value}</span>
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
          <li key={i} className="relative flex items-start gap-2 text-[11px]">
            <span className="absolute -left-3 top-2 h-px w-2 bg-border/20" />
            <span className="font-extralight text-muted-foreground/60 tracking-wide shrink-0 max-w-[40%] break-words">
              {leaf.label}
            </span>
            <span className="font-light text-foreground/90 text-right flex-1 min-w-0 break-words whitespace-normal" title={leaf.value}>
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
          <li key={i} className="flex items-start gap-2 text-[10px]">
            <span className="font-extralight text-muted-foreground/60 tracking-wide shrink-0 max-w-[40%] break-words">
              {leaf.label}
            </span>
            <span className="font-light text-foreground/90 text-right flex-1 min-w-0 break-words whitespace-normal" title={leaf.value}>
              {leaf.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};


export default LinkExtractView;
