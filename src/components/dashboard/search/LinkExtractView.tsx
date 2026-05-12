import { useState, useCallback } from "react";
import {
  Crosshair, Loader2, Globe, Link2, Sparkles, Shield, Zap,
  Server, Cpu, Plug, Network, Building2, AlertTriangle, ExternalLink,
  Copy, Check, ChevronRight, ChevronDown, KeyRound, Eye, EyeOff, Database, Brain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import EmergencyOpsPanel from "@/components/asher/EmergencyOpsPanel";
import LinkExtractIntelPanel from "@/components/dashboard/search/LinkExtractIntelPanel";

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

interface ExposedFile { path: string; status: number; size: number; preview?: string; risk: "info" | "warn" | "critical" }
interface PageIdentity {
  title: string; description: string; canonical: string;
  ogTitle: string; ogDescription: string; ogImage: string; twitterCard: string;
  language: string; generator: string; socialLinks: string[]; schemaOrg: string[];
}
interface TechFingerprint {
  cms: string[]; frameworks: string[]; analytics: string[]; payments: string[];
  third_party_hosts: string[]; graphql_endpoints: string[]; websocket_endpoints: string[];
  api_endpoints: string[]; env_vars: string[]; source_maps: string[];
}
interface LinkInventory {
  internal: string[]; external: string[]; admin_paths: string[];
  document_links: string[]; image_count: number;
}
interface SubAudit { host: string; ip?: string; cname?: string; status?: number; server?: string; tech?: string[]; weaknesses: string[]; }
interface EmailInfra { mx_provider: string; mx_records: string[]; spf: string; spf_strict: boolean; dmarc: string; dmarc_policy: string; dkim_selectors_found: string[]; weaknesses: string[]; }
interface SecurityAudit { hsts_present: boolean; hsts_max_age?: number; hsts_includes_sub: boolean; hsts_preload: boolean; x_frame_options: string; clickjacking_risk: boolean; csp_present: boolean; csp_unsafe_inline: boolean; csp_unsafe_eval: boolean; csp_wildcard_hosts: string[]; csp_report_only: boolean; cors_acao: string; cors_wildcard_with_credentials: boolean; cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string }>; cookie_weak_count: number; mixed_content_resources: string[]; weaknesses: string[]; }
interface PageStructure { forms: Array<{ action: string; method: string; fields: string[]; hidden_fields: string[] }>; iframes: string[]; html_comments: string[]; noscript_blocks: number; hreflang: Array<{ lang: string; href: string }>; open_graph_full: Record<string, string>; twitter_full: Record<string, string>; jsonld_blocks: number; }
interface MobileAuthIntel { ios_app_link?: string; android_app_link?: string; app_bundle_ids: string[]; deep_link_schemes: string[]; oauth_providers: string[]; auth_provider_detected: string[]; session_recording_tools: string[]; ad_pixels: string[]; live_chat: string[]; consent_banner: string[]; ab_testing: string[]; }
interface CloudProbe { bucket_url: string; type: "s3" | "gcs" | "azure" | "firebase"; status: number; public_listing: boolean; risk: "info" | "warn" | "critical"; note: string; }
interface DependencyIntel { package_json_exposed: boolean; name?: string; version?: string; dependency_count: number; dev_dependency_count: number; outdated_warnings: string[]; notable: string[]; }
interface PerformanceIntel { ttfb_ms?: number; total_ms?: number; bytes_received?: number; http_protocol: string; compression: string; cache_control?: string; cdn_hint?: string; }
interface ReputationIntel { hibp_breach_count?: number; google_safebrowsing_hint: string; wayback_dead_pages_sampled: number; notes: string[]; }
interface ForensicsBundle {
  identity: PageIdentity | null;
  redirect: { hops: Array<{ url: string; status: number }>; finalUrl: string; responseMs: number } | null;
  tech: TechFingerprint | null;
  exposed: ExposedFile[];
  links: LinkInventory | null;
  archive: { first_seen?: string; last_seen?: string; snapshots?: number } | null;
  sub_audit: SubAudit[];
  email_infra?: EmailInfra | null;
  security_audit?: SecurityAudit | null;
  page_structure?: PageStructure | null;
  mobile_auth?: MobileAuthIntel | null;
  cloud_buckets?: CloudProbe[];
  dependencies?: DependencyIntel | null;
  performance?: PerformanceIntel | null;
  reputation?: ReputationIntel | null;
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
  const [forensics, setForensics] = useState<ForensicsBundle | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);

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
    setSecrets(null);
    setForensics(null);

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
      if (data.secrets) setSecrets(data.secrets as SecretScan);
      if (data.forensics) setForensics(data.forensics as ForensicsBundle);
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
    <div className="relative w-full animate-fade-in space-y-4">
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
              <button onClick={() => setIntelOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-border/30 bg-foreground/[0.03] px-2 py-1 text-[10px] font-light tracking-wider text-foreground/80 hover:bg-foreground/[0.06] transition" title="Intel Map + Brain Chat">
                <Brain className="h-3 w-3" /> INTEL + CHAT
              </button>
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

          {/* OPEN API KEYS — live JS-bundle secret scan */}
          <OpenApiKeysPanel
            secrets={secrets}
            target={blueprint.target}
            pullEnabled={typeof window !== "undefined" && window.location.pathname.startsWith("/asher-dashboard")}
          />


          {/* EMERGENCY OPS — Asher-dashboard / admin only (self-gates) */}
          {typeof window !== "undefined" && window.location.pathname.startsWith("/asher-dashboard") && (
            <EmergencyOpsPanel target={blueprint.target} />
          )}

          {/* FORENSIC INTELLIGENCE PANELS — Layers 1-12 */}
          <ForensicsPanels forensics={forensics} target={blueprint.target} />
          <LayerDiagram forensics={forensics} secrets={secrets} target={blueprint.target} />

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

      {/* Intel Map + Brain Chat side panel */}
      {intelOpen && blueprint && (
        <LinkExtractIntelPanel
          targetUrl={normalizeUrl(url)}
          dossier={{ blueprint, secrets, forensics }}
          onClose={() => setIntelOpen(false)}
        />
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


// ─── OPEN API KEYS PANEL ────────────────────────────────────────────────────
const SEV_STYLES: Record<SecretHit["severity"], { ring: string; chip: string; dot: string }> = {
  critical: { ring: "border-red-400/40",    chip: "bg-red-500/10 text-red-300 border-red-400/30",     dot: "bg-red-400" },
  high:     { ring: "border-orange-400/40", chip: "bg-orange-500/10 text-orange-300 border-orange-400/30", dot: "bg-orange-400" },
  med:      { ring: "border-amber-400/30",  chip: "bg-amber-500/10 text-amber-300 border-amber-400/30", dot: "bg-amber-400" },
  low:      { ring: "border-border/30",     chip: "bg-card/40 text-muted-foreground border-border/30",  dot: "bg-muted-foreground" },
};

type ProbeState = {
  loading?: boolean;
  result?: { ok: boolean; status: number; endpoint: string; summary: string; data: unknown; error?: string };
};

const OpenApiKeysPanel = ({ secrets, target, pullEnabled = false }: { secrets: SecretScan | null; target: string; pullEnabled?: boolean }) => {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showSidecar, setShowSidecar] = useState(false);
  const [probes, setProbes] = useState<Record<number, ProbeState>>({});

  const runProbe = useCallback(async (idx: number, hit: SecretHit) => {
    setProbes((p) => ({ ...p, [idx]: { loading: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("zophiel-key-probe", {
        body: { type: hit.type, key: hit.raw, hostHint: target },
      });
      if (error) throw error;
      setProbes((p) => ({ ...p, [idx]: { loading: false, result: data as ProbeState["result"] } }));
    } catch (e: any) {
      setProbes((p) => ({
        ...p,
        [idx]: {
          loading: false,
          result: { ok: false, status: 0, endpoint: "(invoke failed)", summary: e?.message || "probe failed", data: null, error: e?.message },
        },
      }));
    }
  }, [target]);


  if (!secrets) return null;

  const grouped = secrets.secrets.reduce<Record<string, SecretHit[]>>((acc, s, i) => {
    (acc[s.type] ||= []).push({ ...s, raw: s.raw, match: s.match, _idx: i } as SecretHit & { _idx: number });
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped);
  const totalSecrets = secrets.secrets.length;

  const sevOrder: SecretHit["severity"][] = ["critical", "high", "med", "low"];
  const sevCounts = sevOrder.reduce<Record<string, number>>((a, sv) => {
    a[sv] = secrets.secrets.filter((s) => s.severity === sv).length;
    return a;
  }, {});

  const copy = (i: number, raw: string) => {
    navigator.clipboard.writeText(raw);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1600);
  };

  return (
    <div className="rounded-2xl border border-red-400/25 bg-gradient-to-br from-red-500/[0.04] via-card/30 to-card/10 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/10 bg-background/40 flex-wrap">
        <div className="h-7 w-7 rounded-lg bg-red-500/15 border border-red-400/30 flex items-center justify-center">
          <KeyRound className="h-3.5 w-3.5 text-red-300" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-red-200/90 uppercase">Open API Keys</div>
          <div className="text-[9px] font-mono tracking-[0.18em] text-muted-foreground/60 uppercase truncate">
            JS-Bundle Secret Scan · {target}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/60 uppercase">
            {secrets.bundles_scanned} bundles · {secrets.inline_scripts} inline · {(secrets.total_bytes / 1024).toFixed(0)} KB
          </span>
          {sevOrder.map((sv) =>
            sevCounts[sv] > 0 ? (
              <span key={sv} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase ${SEV_STYLES[sv].chip}`}>
                <span className={`h-1 w-1 rounded-full ${SEV_STYLES[sv].dot}`} />
                {sv} {sevCounts[sv]}
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {totalSecrets === 0 ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.04] px-4 py-6 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] font-light text-emerald-300/90 tracking-wide">
              <Shield className="h-3.5 w-3.5" />
              No exposed API keys, tokens, or credentials detected in public JS bundles.
            </div>
            <div className="mt-1 text-[9px] font-mono tracking-[0.18em] text-muted-foreground/50 uppercase">
              Scanned {secrets.bundles_scanned} bundle{secrets.bundles_scanned === 1 ? "" : "s"} · keep monitoring on each deploy
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extralight text-muted-foreground/70 leading-relaxed max-w-2xl">
                Live extraction from this site's HTML and every JavaScript bundle it loads.
                Each match below is a real, observable string that any visitor can read in their browser.
                Rotate any key flagged here immediately and move it to a server-side proxy.
              </p>
              <button
                onClick={() => setShowSidecar((v) => !v)}
                className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/60 hover:text-foreground/90 uppercase border border-border/30 rounded-md px-2 py-1"
              >
                {showSidecar ? "Hide" : "Show"} Side Signals
              </button>
            </div>

            {/* Grouped secret hits */}
            <div className="space-y-3">
              {groupKeys.map((type) => {
                const items = grouped[type];
                const sev = items[0].severity;
                const styles = SEV_STYLES[sev];
                return (
                  <div key={type} className={`rounded-xl border ${styles.ring} bg-background/30`}>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/10">
                      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                      <span className="text-[10px] font-semibold tracking-[0.22em] text-foreground/90 uppercase">{items[0].label}</span>
                      <span className="text-[9px] font-mono tracking-wider text-muted-foreground/50 uppercase">[{items.length}× found]</span>
                      <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-mono tracking-[0.2em] uppercase ${styles.chip}`}>
                        {sev}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/10">
                      {items.map((s) => {
                        const idx = (s as SecretHit & { _idx: number })._idx;
                        const isOpen = !!revealed[idx];
                        return (
                          <li key={idx} className="px-3 py-2 flex items-start gap-3 text-[10px] font-mono">
                            <span className={`mt-1 h-1 w-1 rounded-full shrink-0 ${styles.dot}`} />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="font-mono text-foreground/95 break-all bg-background/60 border border-border/20 rounded px-1.5 py-0.5">
                                  {isOpen ? s.raw : s.match}
                                </code>
                                <button
                                  onClick={() => setRevealed((m) => ({ ...m, [idx]: !m[idx] }))}
                                  className="inline-flex items-center gap-1 text-[9px] tracking-wider text-muted-foreground/60 hover:text-foreground/80 uppercase"
                                  title={isOpen ? "Hide full value" : "Reveal full value"}
                                >
                                  {isOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  {isOpen ? "Hide" : "Reveal"}
                                </button>
                                <button
                                  onClick={() => copy(idx, s.raw)}
                                  className="inline-flex items-center gap-1 text-[9px] tracking-wider text-muted-foreground/60 hover:text-foreground/80 uppercase"
                                  title="Copy raw value"
                                >
                                  {copiedIdx === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  Copy
                                </button>
                                {pullEnabled && (
                                  <button
                                    onClick={() => void runProbe(idx, s)}
                                    disabled={probes[idx]?.loading}
                                    className="inline-flex items-center gap-1 text-[9px] tracking-wider text-cyan-300/80 hover:text-cyan-200 uppercase border border-cyan-400/30 rounded px-1.5 py-0.5 disabled:opacity-50"
                                    title="Authenticate with this key against the provider's API and pull live account data"
                                  >
                                    {probes[idx]?.loading
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <Database className="h-3 w-3" />}
                                    Pull Data
                                  </button>
                                )}
                              </div>
                              <div className="text-[9px] tracking-wide text-muted-foreground/50 break-all">
                                <span className="uppercase mr-1.5">src</span>
                                {s.source === "inline" ? "inline <script>" : s.source}
                              </div>
                              {s.context && (
                                <div className="text-[9px] tracking-wide text-muted-foreground/40 break-all italic">
                                  …{s.context}…
                                </div>
                              )}
                              {probes[idx]?.result && (
                                <div className={`mt-1 rounded-md border px-2 py-1.5 text-[9px] font-mono ${probes[idx]!.result!.ok ? "border-emerald-400/30 bg-emerald-500/[0.04] text-emerald-200/90" : "border-red-400/30 bg-red-500/[0.04] text-red-200/90"}`}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="tracking-[0.2em] uppercase">
                                      {probes[idx]!.result!.ok ? "Live Data" : "Probe Failed"} · {probes[idx]!.result!.status}
                                    </span>
                                    <span className="text-muted-foreground/50 truncate">{probes[idx]!.result!.endpoint}</span>
                                  </div>
                                  <div className="text-foreground/90 whitespace-pre-wrap break-all">
                                    {probes[idx]!.result!.summary}
                                  </div>
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-muted-foreground/60 uppercase tracking-wider">Raw response</summary>
                                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all text-foreground/80">
{typeof probes[idx]!.result!.data === "string"
  ? probes[idx]!.result!.data
  : JSON.stringify(probes[idx]!.result!.data, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              )}

                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Sidecar signals */}
        {showSidecar && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/10">
            <SignalList title="Emails" items={secrets.emails} />
            <SignalList title="GitHub Links" items={secrets.github_links} />
            <SignalList title="Internal Codenames" items={secrets.internal_codenames} />
            <SignalList title="Feature Flags" items={secrets.feature_flags} />
            <SignalList title="Developer Comments (TODO/FIXME)" items={secrets.developer_comments} full />
            <SignalList title="Bundles Scanned" items={secrets.bundles.map((b) => `${b.source} · ${(b.size/1024).toFixed(0)}KB · ${b.hits} hits`)} full />
          </div>
        )}
      </div>
    </div>
  );
};

const SignalList = ({ title, items, full }: { title: string; items: string[]; full?: boolean }) => (
  <div className="rounded-xl border border-border/20 bg-background/30 p-3">
    <div className="text-[9px] font-mono tracking-[0.22em] text-muted-foreground/70 uppercase mb-1.5">
      {title} <span className="text-muted-foreground/40">[{items.length}]</span>
    </div>
    {items.length === 0 ? (
      <div className="text-[10px] font-extralight text-muted-foreground/40 italic">none</div>
    ) : (
      <ul className={`space-y-0.5 text-[10px] font-mono text-foreground/80 ${full ? "" : "max-h-40 overflow-y-auto"}`}>
        {items.slice(0, full ? 200 : 30).map((it, i) => (
          <li key={i} className="break-all">{it}</li>
        ))}
      </ul>
    )}
  </div>
);



// ─── FORENSIC INTELLIGENCE PANELS (Layers 1-11) ─────────────────────────────
const SectionCard = ({ title, sub, tone = "neutral", children }: { title: string; sub?: string; tone?: Tone; children: React.ReactNode }) => {
  const t = TONE_STYLES[tone];
  return (
    <div className={`rounded-2xl border ${t.ring} bg-card/30 backdrop-blur-xl overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/10 bg-background/40">
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
        <span className="text-[10px] font-semibold tracking-[0.22em] text-foreground/90 uppercase">{title}</span>
        {sub && <span className="ml-auto text-[9px] font-mono tracking-wider text-muted-foreground/50 uppercase">{sub}</span>}
      </div>
      <div className="p-4 text-[11px] font-light text-foreground/85">{children}</div>
    </div>
  );
};

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-1 border-b border-border/5 last:border-0">
    <span className="text-[9px] font-mono tracking-[0.18em] text-muted-foreground/50 uppercase shrink-0 w-32">{k}</span>
    <span className="flex-1 break-all text-foreground/85">{v || <span className="italic text-muted-foreground/40">—</span>}</span>
  </div>
);

const ChipList = ({ items, tone = "neutral" }: { items: string[]; tone?: Tone }) => {
  if (!items?.length) return <span className="italic text-muted-foreground/40 text-[10px]">none</span>;
  const t = TONE_STYLES[tone];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className={`inline-flex items-center gap-1 rounded-full border ${t.ring} bg-background/40 px-2 py-0.5 text-[9px] font-mono tracking-wider text-foreground/85`}>
          <span className={`h-1 w-1 rounded-full ${t.dot}`} /> {it}
        </span>
      ))}
    </div>
  );
};

const ForensicsPanels = ({ forensics, target }: { forensics: ForensicsBundle | null; target: string }) => {
  if (!forensics) return null;
  const { identity, redirect, tech, exposed, links, archive, sub_audit, email_infra, security_audit, page_structure, mobile_auth, cloud_buckets, dependencies, performance, reputation } = forensics;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.06] via-card/30 to-card/10 backdrop-blur-xl px-5 py-3 flex items-center gap-3">
        <Crosshair className="h-3.5 w-3.5 text-accent" />
        <div>
          <div className="text-[11px] font-semibold tracking-[0.22em] text-accent/90 uppercase">Forensic Intelligence</div>
          <div className="text-[9px] font-mono tracking-[0.18em] text-muted-foreground/60 uppercase">Live Layered Audit · {target}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Page Identity */}
        {identity && (
          <SectionCard title="Page Identity" sub="Layer 0">
            <KV k="Title" v={identity.title} />
            <KV k="Description" v={identity.description} />
            <KV k="Canonical" v={identity.canonical} />
            <KV k="OG Title" v={identity.ogTitle} />
            <KV k="OG Image" v={identity.ogImage} />
            <KV k="Twitter Card" v={identity.twitterCard} />
            <KV k="Language" v={identity.language} />
            <KV k="Generator" v={identity.generator} />
            <KV k="Social Links" v={<ChipList items={identity.socialLinks} />} />
            <KV k="Schema.org" v={`${identity.schemaOrg.length} block(s)`} />
          </SectionCard>
        )}

        {/* Redirect Chain */}
        {redirect && (
          <SectionCard title="Redirect Chain & Response" sub="Layer 0">
            <KV k="Final URL" v={redirect.finalUrl} />
            <KV k="Response Time" v={`${redirect.responseMs} ms`} />
            <KV k="Hops" v={`${redirect.hops.length}`} />
            <ul className="mt-2 space-y-1 font-mono text-[10px]">
              {redirect.hops.map((h, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground/50">{i + 1}.</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${h.status >= 400 ? "bg-red-500/15 text-red-300" : h.status >= 300 ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{h.status}</span>
                  <span className="break-all text-foreground/80">{h.url}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Tech Fingerprint */}
        {tech && (
          <SectionCard title="Technology Fingerprint" sub="Layer 4" tone="warn">
            <KV k="CMS" v={<ChipList items={tech.cms} />} />
            <KV k="Frameworks" v={<ChipList items={tech.frameworks} />} />
            <KV k="Analytics" v={<ChipList items={tech.analytics} />} />
            <KV k="Payments" v={<ChipList items={tech.payments} />} />
            <KV k="3rd-Party Hosts" v={<ChipList items={tech.third_party_hosts} />} />
            <KV k="Env Vars" v={<ChipList items={tech.env_vars} tone="warn" />} />
            <KV k="GraphQL" v={<ChipList items={tech.graphql_endpoints} />} />
            <KV k="WebSocket" v={<ChipList items={tech.websocket_endpoints} />} />
            <KV k="API Routes" v={<ChipList items={tech.api_endpoints.slice(0, 12)} />} />
            <KV k="Source Maps" v={<ChipList items={tech.source_maps} tone="critical" />} />
          </SectionCard>
        )}

        {/* Exposed Files */}
        <SectionCard title="Exposed Files" sub={`Layer 5 · ${exposed.length} found`} tone={exposed.some(e => e.risk === "critical") ? "critical" : exposed.length ? "warn" : "good"}>
          {exposed.length === 0 ? (
            <div className="text-[10px] text-emerald-300/80 italic">No publicly exposed sensitive files detected.</div>
          ) : (
            <ul className="space-y-2">
              {exposed.map((f, i) => (
                <li key={i} className={`rounded-lg border ${f.risk === "critical" ? "border-red-400/30 bg-red-500/[0.05]" : f.risk === "warn" ? "border-amber-400/30 bg-amber-500/[0.05]" : "border-border/20 bg-background/30"} p-2`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[10px] font-mono text-foreground/95">{f.path}</code>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/60">[{f.status} · {f.size}B]</span>
                    <span className={`ml-auto text-[8px] font-mono uppercase tracking-[0.2em] ${f.risk === "critical" ? "text-red-300" : f.risk === "warn" ? "text-amber-300" : "text-muted-foreground/60"}`}>{f.risk}</span>
                  </div>
                  {f.preview && <pre className="mt-1 text-[9px] font-mono text-muted-foreground/70 max-h-24 overflow-auto whitespace-pre-wrap break-all">{f.preview}</pre>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Links Inventory */}
        {links && (
          <SectionCard title="Links & Paths Inventory" sub="Layer 8">
            <KV k="Internal" v={`${links.internal.length} paths`} />
            <KV k="External" v={`${links.external.length} URLs`} />
            <KV k="Documents" v={`${links.document_links.length} files`} />
            <KV k="Images" v={`${links.image_count}`} />
            <KV k="Admin Paths" v={<ChipList items={links.admin_paths} tone={links.admin_paths.length ? "warn" : "neutral"} />} />
            {links.document_links.length > 0 && (
              <details className="mt-2">
                <summary className="text-[9px] font-mono tracking-wider text-muted-foreground/60 uppercase cursor-pointer">Document Links</summary>
                <ul className="mt-1 space-y-0.5 max-h-40 overflow-auto text-[10px] font-mono">
                  {links.document_links.map((d, i) => <li key={i} className="break-all text-foreground/80">{d}</li>)}
                </ul>
              </details>
            )}
          </SectionCard>
        )}

        {/* Archive & Reputation */}
        {archive && (
          <SectionCard title="Wayback / Archive" sub="Layer 11">
            <KV k="First Seen" v={archive.first_seen} />
            <KV k="Last Seen" v={archive.last_seen} />
            <KV k="Snapshots" v={archive.snapshots ? `~${archive.snapshots.toLocaleString()}` : undefined} />
            <KV k="Archive URL" v={<a href={`https://web.archive.org/web/*/${target}`} target="_blank" rel="noreferrer" className="underline text-accent">browse history</a>} />
          </SectionCard>
        )}
      </div>

      {/* Layer 12 — Subdomain Audit */}
      {sub_audit && sub_audit.length > 0 && (
        <SectionCard title="Subdomain Map & Weaknesses" sub={`Layer 12 · ${sub_audit.length} audited`} tone="warn">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                <tr className="border-b border-border/15">
                  <th className="text-left py-1.5 pr-3">Host</th>
                  <th className="text-left py-1.5 pr-3">IP / CNAME</th>
                  <th className="text-left py-1.5 pr-3">Status</th>
                  <th className="text-left py-1.5 pr-3">Server</th>
                  <th className="text-left py-1.5">Weaknesses</th>
                </tr>
              </thead>
              <tbody>
                {sub_audit.map((s, i) => (
                  <tr key={i} className="border-b border-border/5 align-top">
                    <td className="py-1.5 pr-3 text-foreground/90 break-all">{s.host}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground/80 break-all">{s.ip || s.cname || "—"}</td>
                    <td className="py-1.5 pr-3">
                      {s.status ? (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${s.status >= 400 ? "bg-red-500/15 text-red-300" : s.status >= 300 ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{s.status}</span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground/70">{s.server || "—"}</td>
                    <td className="py-1.5">
                      {s.weaknesses.length === 0 ? (
                        <span className="text-emerald-300/70 italic">clean</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {s.weaknesses.map((w, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-amber-200/80">
                              <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Email Infra (SPF/DMARC/DKIM) */}
      {email_infra && (
        <SectionCard title="Email Infrastructure" sub="SPF · DMARC · DKIM" tone={email_infra.weaknesses.length ? "warn" : "good"}>
          <KV k="MX Provider" v={email_infra.mx_provider} />
          <KV k="MX Records" v={<ChipList items={email_infra.mx_records} />} />
          <KV k="SPF" v={email_infra.spf || "(missing)"} />
          <KV k="SPF Strict" v={email_infra.spf_strict ? "yes (-all)" : "no"} />
          <KV k="DMARC" v={email_infra.dmarc || "(missing)"} />
          <KV k="DMARC Policy" v={email_infra.dmarc_policy} />
          <KV k="DKIM Selectors" v={<ChipList items={email_infra.dkim_selectors_found} />} />
          {email_infra.weaknesses.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10px]">
              {email_infra.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-amber-200/80"><AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" /><span>{w}</span></li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {/* Security Audit deep-dive */}
      {security_audit && (
        <SectionCard title="Security Headers · CSP · CORS · Cookies" sub="Layer 6 deep-dive" tone={security_audit.weaknesses.length ? (security_audit.cors_wildcard_with_credentials ? "critical" : "warn") : "good"}>
          <KV k="HSTS" v={security_audit.hsts_present ? `max-age=${security_audit.hsts_max_age}${security_audit.hsts_includes_sub ? " +subdomains" : ""}${security_audit.hsts_preload ? " +preload" : ""}` : "missing"} />
          <KV k="X-Frame-Options" v={security_audit.x_frame_options} />
          <KV k="Clickjacking Risk" v={security_audit.clickjacking_risk ? "yes" : "no"} />
          <KV k="CSP" v={security_audit.csp_present ? (security_audit.csp_report_only ? "report-only" : "enforced") : "missing"} />
          <KV k="CSP unsafe-inline" v={security_audit.csp_unsafe_inline ? "yes" : "no"} />
          <KV k="CSP unsafe-eval" v={security_audit.csp_unsafe_eval ? "yes" : "no"} />
          <KV k="CSP wildcards" v={<ChipList items={security_audit.csp_wildcard_hosts} />} />
          <KV k="CORS Allow-Origin" v={security_audit.cors_acao} />
          <KV k="CORS * + credentials" v={security_audit.cors_wildcard_with_credentials ? "CRITICAL" : "no"} />
          <KV k="Cookies" v={`${security_audit.cookies.length} set, ${security_audit.cookie_weak_count} weak`} />
          <KV k="Mixed Content" v={`${security_audit.mixed_content_resources.length} HTTP resource(s)`} />
          {security_audit.weaknesses.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10px]">
              {security_audit.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-amber-200/80"><AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" /><span>{w}</span></li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {/* Page Structure */}
      {page_structure && (
        <SectionCard title="Page Structure · Forms · iFrames · Hreflang" sub="Layer 7">
          <KV k="Forms" v={`${page_structure.forms.length} found`} />
          <KV k="iFrames" v={<ChipList items={page_structure.iframes} />} />
          <KV k="HTML Comments" v={`${page_structure.html_comments.length} captured`} />
          <KV k="<noscript> blocks" v={page_structure.noscript_blocks} />
          <KV k="Hreflang" v={<ChipList items={page_structure.hreflang.map(h => `${h.lang}→${h.href}`)} />} />
          <KV k="JSON-LD blocks" v={page_structure.jsonld_blocks} />
          {page_structure.forms.length > 0 && (
            <div className="mt-2 space-y-1 text-[10px] font-mono">
              {page_structure.forms.slice(0, 6).map((f, i) => (
                <div key={i} className="text-muted-foreground/80">
                  <span className="text-accent/80">{f.method}</span> {f.action} — {f.fields.join(", ") || "(no named fields)"}
                  {f.hidden_fields.length > 0 && <span className="text-amber-300/70"> · hidden: {f.hidden_fields.join(", ")}</span>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Mobile / Auth / Tracking */}
      {mobile_auth && (
        <SectionCard title="Mobile · Auth · Tracking Surface" sub="Layer 9 / 10">
          <KV k="iOS App" v={mobile_auth.ios_app_link || "—"} />
          <KV k="Android App" v={mobile_auth.android_app_link || "—"} />
          <KV k="Bundle IDs" v={<ChipList items={mobile_auth.app_bundle_ids} />} />
          <KV k="Deep Link Schemes" v={<ChipList items={mobile_auth.deep_link_schemes} />} />
          <KV k="OAuth Providers" v={<ChipList items={mobile_auth.oauth_providers} />} />
          <KV k="Auth Provider" v={<ChipList items={mobile_auth.auth_provider_detected} />} />
          <KV k="Session Recording" v={<ChipList items={mobile_auth.session_recording_tools} />} />
          <KV k="Ad Pixels" v={<ChipList items={mobile_auth.ad_pixels} />} />
          <KV k="Live Chat" v={<ChipList items={mobile_auth.live_chat} />} />
          <KV k="Consent Banner" v={<ChipList items={mobile_auth.consent_banner} />} />
          <KV k="A/B Testing" v={<ChipList items={mobile_auth.ab_testing} />} />
        </SectionCard>
      )}

      {/* Cloud buckets */}
      {cloud_buckets && cloud_buckets.length > 0 && (
        <SectionCard title="Cloud Storage Exposure" sub={`${cloud_buckets.length} bucket(s) probed`} tone={cloud_buckets.some(b => b.risk === "critical") ? "critical" : cloud_buckets.some(b => b.risk === "warn") ? "warn" : "good"}>
          <ul className="space-y-1 text-[10px] font-mono">
            {cloud_buckets.map((b, i) => (
              <li key={i} className={`flex items-start gap-2 ${b.risk === "critical" ? "text-red-300" : b.risk === "warn" ? "text-amber-200/90" : "text-muted-foreground/80"}`}>
                <span className="px-1.5 py-0.5 rounded bg-card/40 border border-border/30 uppercase">{b.type}</span>
                <span className="break-all flex-1">{b.bucket_url}</span>
                <span className="opacity-70">[{b.status}]</span>
                <span className="opacity-90">{b.note}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Dependencies */}
      {dependencies && dependencies.package_json_exposed && (
        <SectionCard title="Dependency Intelligence" sub="package.json publicly exposed" tone={dependencies.outdated_warnings.length ? "warn" : "neutral"}>
          <KV k="Package" v={`${dependencies.name || "?"}@${dependencies.version || "?"}`} />
          <KV k="Dependencies" v={dependencies.dependency_count} />
          <KV k="Dev Dependencies" v={dependencies.dev_dependency_count} />
          <KV k="Notable" v={<ChipList items={dependencies.notable} />} />
          <KV k="Outdated Warnings" v={<ChipList items={dependencies.outdated_warnings} />} />
        </SectionCard>
      )}

      {/* Performance */}
      {performance && (
        <SectionCard title="Performance & Transport" sub="latency · CDN · compression">
          <KV k="TTFB" v={performance.ttfb_ms ? `${performance.ttfb_ms} ms` : "—"} />
          <KV k="Total" v={performance.total_ms ? `${performance.total_ms} ms` : "—"} />
          <KV k="Bytes" v={performance.bytes_received?.toLocaleString()} />
          <KV k="Protocol Hint" v={performance.http_protocol} />
          <KV k="Compression" v={performance.compression} />
          <KV k="Cache-Control" v={performance.cache_control} />
          <KV k="CDN Hint" v={performance.cdn_hint} />
        </SectionCard>
      )}

      {/* Reputation */}
      {reputation && (
        <SectionCard title="Breach & Reputation" sub="passive HIBP lookup" tone={(reputation.hibp_breach_count || 0) > 0 ? "critical" : "good"}>
          <KV k="HIBP Breaches" v={reputation.hibp_breach_count ?? "n/a"} />
          {reputation.notes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10px]">
              {reputation.notes.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-amber-200/80"><AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" /><span>{w}</span></li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
};

// ─── LAYER DIAGRAM (text layout 0-12) ───────────────────────────────────────
const LayerDiagram = ({ forensics, secrets, target }: { forensics: ForensicsBundle | null; secrets: SecretScan | null; target: string }) => {
  if (!forensics && !secrets) return null;
  const layers: Array<{ n: string; name: string; items: string[]; tone: Tone }> = [
    { n: "INPUT", name: "Raw URL", items: [target], tone: "neutral" },
    { n: "L0", name: "Page Identity", items: forensics?.identity ? [
      `title: ${forensics.identity.title || "—"}`,
      `canonical: ${forensics.identity.canonical || "—"}`,
      `lang: ${forensics.identity.language || "—"}`,
    ] : [], tone: "neutral" },
    { n: "L1", name: "Network & Server", items: forensics?.redirect ? [
      `final: ${forensics.redirect.finalUrl}`,
      `hops: ${forensics.redirect.hops.length}`,
      `latency: ${forensics.redirect.responseMs}ms`,
    ] : [], tone: "neutral" },
    { n: "L4", name: "Tech Fingerprint", items: forensics?.tech ? [
      ...forensics.tech.cms.map(s => `cms: ${s}`),
      ...forensics.tech.frameworks.slice(0, 4).map(s => `fw: ${s}`),
      ...forensics.tech.analytics.slice(0, 3).map(s => `analytics: ${s}`),
      ...forensics.tech.payments.map(s => `pay: ${s}`),
    ] : [], tone: "warn" },
    { n: "L5", name: "Exposed Files", items: (forensics?.exposed || []).map(e => `${e.path} [${e.status}]`), tone: forensics?.exposed.some(e => e.risk === "critical") ? "critical" : "warn" },
    { n: "L6", name: "JS Bundle Analysis", items: secrets ? [
      `bundles: ${secrets.bundles_scanned}`,
      `inline: ${secrets.inline_scripts}`,
      ...((forensics?.tech?.source_maps || []).slice(0, 3).map(m => `sourcemap: ${m}`)),
      ...((forensics?.tech?.env_vars || []).slice(0, 5).map(e => `env: ${e}`)),
    ] : [], tone: "warn" },
    { n: "L7", name: "Secrets Extraction", items: secrets?.secrets.slice(0, 8).map(s => `${s.label}: ${s.match}`) || [], tone: secrets?.secrets.length ? "critical" : "good" },
    { n: "L8", name: "Links & Paths", items: forensics?.links ? [
      `internal: ${forensics.links.internal.length}`,
      `external: ${forensics.links.external.length}`,
      ...forensics.links.admin_paths.slice(0, 5).map(a => `admin: ${a}`),
    ] : [], tone: forensics?.links?.admin_paths.length ? "warn" : "neutral" },
    { n: "L9", name: "Media & Files", items: forensics?.links ? [
      `images: ${forensics.links.image_count}`,
      `documents: ${forensics.links.document_links.length}`,
    ] : [], tone: "neutral" },
    { n: "L10", name: "Contact & Identity", items: [
      ...(secrets?.emails || []).slice(0, 5).map(e => `email: ${e}`),
      ...(forensics?.identity?.socialLinks || []).slice(0, 4).map(s => `social: ${s}`),
    ], tone: "neutral" },
    { n: "L11", name: "Archive & Reputation", items: forensics?.archive ? [
      `first: ${forensics.archive.first_seen || "—"}`,
      `last: ${forensics.archive.last_seen || "—"}`,
      `snapshots: ${forensics.archive.snapshots || "—"}`,
    ] : [], tone: "neutral" },
    { n: "L12", name: "Subdomains & Weaknesses", items: (forensics?.sub_audit || []).slice(0, 8).map(s =>
      `${s.host}${s.weaknesses.length ? ` ⚠ ${s.weaknesses.length}` : " ✓"}`
    ), tone: (forensics?.sub_audit || []).some(s => s.weaknesses.length) ? "warn" : "good" },
  ];

  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Network className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-semibold tracking-[0.22em] text-accent/90 uppercase">Layered Recon Diagram</span>
        <span className="ml-auto text-[9px] font-mono tracking-[0.18em] text-muted-foreground/50 uppercase">12-Layer Forensic Stack</span>
      </div>
      <div className="space-y-2">
        {layers.map((l, i) => {
          const t = TONE_STYLES[l.tone];
          return (
            <div key={i} className={`flex items-stretch gap-3 rounded-xl border ${t.ring} bg-background/30 overflow-hidden`}>
              <div className={`flex flex-col items-center justify-center px-3 py-2 ${t.glow} bg-background/60 border-r border-border/15 shrink-0 min-w-[80px]`}>
                <span className={`text-[9px] font-mono tracking-[0.18em] uppercase ${t.text}`}>{l.n}</span>
                <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-0.5">{l.name}</span>
              </div>
              <div className="flex-1 px-3 py-2 text-[10px] font-mono text-foreground/85">
                {l.items.length === 0 ? (
                  <span className="italic text-muted-foreground/40">no signals captured</span>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {l.items.map((it, j) => (
                      <span key={j} className="break-all">▸ {it}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LinkExtractView;
