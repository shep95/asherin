import { useState } from "react";
import {
  Shield, Bell, Activity, Search, Network, FolderArchive, Briefcase, Server,
  FileSearch, Cpu, Settings as SettingsIcon, Download, Database, Radar,
  ScrollText, Layers, Eye, Globe, AlertTriangle, CheckCircle2, Clock,
  Lightbulb, ChevronDown, ChevronUp, Zap, Ban, Skull, UserX, FileX,
  Terminal, FlaskConical, BookOpen, Workflow, BarChart3, Crosshair, Trash2,
} from "lucide-react";

type ZaxinScreen =
  | "overview" | "alerts" | "hunt" | "pcap" | "cases" | "grid" | "detections"
  | "zeek" | "endpoint" | "dashboards" | "downloads" | "config"
  | "response" | "osquery" | "strelka" | "sigma" | "cortex" | "grafana"
  | "attck" | "curator";

// Plain-English guide for each screen — "what this is, how to use it, what the data means"
const HELP: Record<ZaxinScreen, { what: string; how: string[]; legend: { term: string; means: string }[] }> = {
  overview: {
    what: "Your security command center at a glance. Think of it as the dashboard of your car — speed, fuel, warning lights — but for your network's safety.",
    how: [
      "Glance at the four big numbers up top to see if anything needs urgent attention.",
      "Red = stop and look. Green = healthy. Yellow = worth checking later.",
      "Click any tab on the left to dig deeper into that area.",
    ],
    legend: [
      { term: "Open Alerts", means: "Suspicious things the system flagged that nobody has investigated yet." },
      { term: "PCAP Captured", means: "How much raw network traffic has been recorded so you can replay it later (like a security camera for the network)." },
      { term: "Grid Nodes", means: "The servers that make up your defense system. All green = all healthy." },
      { term: "MITRE ATT&CK Coverage", means: "How well you're protected against known hacker techniques. Higher % = more attack types you'll detect." },
    ],
  },
  alerts: {
    what: "A live feed of suspicious activity on your network — like a smoke alarm log. Each line is something that tripped a detection rule.",
    how: [
      "Read top-to-bottom — newest alerts are at the top.",
      "Focus on red dots first (critical), then orange (high). Green/yellow can wait.",
      "Click any alert to see the full story and pivot to packet capture.",
    ],
    legend: [
      { term: "Signature", means: "The name of the rule that fired. Often starts with 'ET' (Emerging Threats) or 'Zeek'." },
      { term: "Source / Dest", means: "Source = where the traffic came from. Dest = where it was going. IP:port format." },
      { term: "Engine", means: "Which detector caught it — Suricata (network), Zeek (behavior), Wazuh (endpoint)." },
      { term: "Severity dots", means: "Red = critical, orange = high, yellow = medium, green = low/info." },
    ],
  },
  hunt: {
    what: "Threat hunting is searching the haystack for hidden needles. Instead of waiting for alarms, you ask questions like 'has anyone on my network talked to TOR?'",
    how: [
      "Type a query in the box (use the example as a template).",
      "Click 'Run Hunt' to search across all logs.",
      "Click 'Pivot to PCAP' on any result to grab the actual packets for forensics.",
    ],
    legend: [
      { term: "Lucene query", means: "A search language: field:value AND field2:value. Like Google search for security logs." },
      { term: "Aggregated results", means: "Grouped counts — shows you the most-talked-to IPs so you spot patterns fast." },
      { term: "Pivot", means: "Jump from a search result into the related raw data (packets, logs, files)." },
    ],
  },
  pcap: {
    what: "Full Packet Capture — every byte that crossed your network is saved like CCTV footage. You can rewind and watch any conversation.",
    how: [
      "Browse the flow list (each row is one conversation between two computers).",
      "Click a flow to download the .pcap file, then open it in Wireshark for byte-level inspection.",
      "Watch the storage bars on the right — when full, oldest flows get overwritten.",
    ],
    legend: [
      { term: "Flow ID", means: "A unique label for one back-and-forth conversation between two machines." },
      { term: "Proto", means: "The language the two machines were speaking (TLS = encrypted web, DNS = name lookups, TCP-SYN = scanning)." },
      { term: "Retention", means: "How many days of packets we keep before recycling the disk." },
    ],
  },
  cases: {
    what: "Where investigations live. When an alert turns into something real, you open a case — like a detective's folder — and track it to resolution.",
    how: [
      "Click a case to see all evidence, comments, and assigned analysts.",
      "Change status as you work: open → triage → investigating → containment → closed.",
      "Assign cases to teammates so nothing gets dropped.",
    ],
    legend: [
      { term: "Case ID", means: "Permanent reference number (year + sequence). Use it when emailing teammates." },
      { term: "Status", means: "Where the investigation is right now. 'Containment' = actively stopping the attack." },
      { term: "Owner", means: "The analyst responsible. 'Unassigned' means nobody's working it — claim it." },
    ],
  },
  grid: {
    what: "The health of every server in your defense grid. If a node goes down, you stop seeing traffic — so this page tells you the platform itself is alive.",
    how: [
      "All green checks = you're fully covered.",
      "If CPU or MEM stays above 90% for hours, that node needs more resources or it'll drop packets.",
      "Click a node name to SSH-style restart, drain, or update it.",
    ],
    legend: [
      { term: "Manager", means: "The brain — runs the web UI and pushes config to everyone else." },
      { term: "Search Node", means: "Stores and queries your logs (Elasticsearch). Heavy on disk and memory." },
      { term: "Forward Sensor", means: "Lightweight node that watches a network segment and ships data to the manager." },
      { term: "Heavy Node", means: "Sensor that also stores logs locally — used for remote sites." },
    ],
  },
  detections: {
    what: "The rulebook. Every rule here is a 'if you see X, raise an alert' instruction the engines follow 24/7.",
    how: [
      "Enable/disable rules to tune out noise from your environment.",
      "Watch 'Hits 24h' — a rule with thousands of hits is probably a false positive; tune or disable it.",
      "Add custom YARA or Sigma rules for threats specific to your business.",
    ],
    legend: [
      { term: "Suricata", means: "Network rules — match patterns in packet content (e.g., known malware signatures)." },
      { term: "Sigma", means: "Generic log rules — match suspicious sequences in Windows/Linux events." },
      { term: "YARA", means: "File-content rules — match malicious strings or bytes inside files seen on the wire." },
      { term: "SID", means: "Signature ID — the rule's unique number. Use it to look up details online." },
    ],
  },
  zeek: {
    what: "Zeek silently watches all traffic and writes a tidy diary of what happened — every connection, DNS lookup, file transfer, certificate. Pure context, no alerts.",
    how: [
      "Click any log to query it (e.g., 'show me every DNS lookup for *.ru today').",
      "Use this when you're investigating — Zeek tells you the 'who/what/when' without judging.",
      "Combine with Alerts: an alert says 'something bad happened'; Zeek shows you everything around it.",
    ],
    legend: [
      { term: "conn.log", means: "Every network connection — like a phone bill for your network." },
      { term: "dns.log", means: "Every name lookup (what domains were asked about)." },
      { term: "ssl.log / x509.log", means: "Encrypted connections and the certificates used." },
      { term: "notice.log", means: "Things Zeek thought were weird enough to highlight without firing a full alert." },
    ],
  },
  endpoint: {
    what: "Wazuh agents installed on your computers and servers — they report logins, file changes, malware, and odd behavior straight from the endpoint.",
    how: [
      "Green dot = agent is checking in. Orange = the host is generating alerts. Red = agent is silent (investigate).",
      "Install the agent on every laptop, server, and VM you own — coverage = visibility.",
      "Use FIM (File Integrity Monitoring) to detect unauthorized changes to critical files.",
    ],
    legend: [
      { term: "Last Seen", means: "How long ago the agent checked in. Anything over a few minutes is suspicious." },
      { term: "FIM", means: "File Integrity Monitoring — alerts when protected files are modified." },
      { term: "Version", means: "Wazuh agent version on the host. Keep them all on the same recent build." },
    ],
  },
  dashboards: {
    what: "Pre-built visual reports. Each card opens charts and graphs answering one question (e.g., 'is my DNS being abused?').",
    how: [
      "Click a card to open the full dashboard with charts you can zoom and filter.",
      "Bookmark the dashboards you check daily.",
      "Build your own for unique business questions.",
    ],
    legend: [
      { term: "MITRE Coverage", means: "Map of which hacker techniques your rules can detect — find the gaps." },
      { term: "JA3", means: "A fingerprint of how a client speaks TLS — useful for spotting malware that mimics browsers." },
      { term: "Top talkers", means: "Hosts pushing the most traffic — outliers may be data exfiltration." },
    ],
  },
  downloads: {
    what: "The official installer for the platform plus the cryptographic key to prove the file wasn't tampered with.",
    how: [
      "Download the latest ISO. This is what you flash to a USB to install on a new server.",
      "Always verify the SHA-256 hash matches before flashing — protects against supply-chain attacks.",
      "Import the GPG key once, then verify the .sig file shipped alongside each ISO.",
    ],
    legend: [
      { term: "ISO", means: "A complete operating system image — boot from it to install Security Onion fresh." },
      { term: "SHA-256", means: "A unique fingerprint of the file. If yours matches the official one, the file is intact." },
      { term: "GPG key", means: "Cryptographic proof of who signed the release. Without verifying, you could install a malicious copy." },
    ],
  },
  config: {
    what: "Knobs and switches. Tune how the platform watches your network, what rules to load, how long to keep data, and what external tools to plug in.",
    how: [
      "Set monitor interfaces to 'promisc' (promiscuous) so they see all traffic, not just their own.",
      "Enable rule sources cautiously — more rules = more noise. Start small, tune from alerts.",
      "Adjust retention based on disk size and compliance needs (some industries require 1 year+).",
    ],
    legend: [
      { term: "mgmt vs monitor", means: "Management = how you talk to the box. Monitor = the silent ear that sniffs traffic." },
      { term: "ET Open / Pro", means: "Emerging Threats rulesets. Open is free; Pro is paid with earlier coverage of new threats." },
      { term: "MISP / TheHive / Cortex", means: "Other tools we plug into — threat sharing, case management, automated enrichment." },
    ],
  },
  response: {
    what: "The trigger pulled. One-click containment actions that reach into your environment and STOP things — isolate a hacked laptop, block a malicious IP at the firewall, kill a process, disable a compromised account.",
    how: [
      "Pick the action card matching what you need to stop.",
      "Type the target (host name, IP, username, file hash, PID).",
      "Click the red button. The action is sent to your grid and logged forever in the audit table below — you can prove who did what, when.",
    ],
    legend: [
      { term: "Isolate Host", means: "Wazuh Active Response cuts the host off the network (only the manager can talk to it) so the attacker can't move laterally." },
      { term: "Block IP", means: "Pushes a firewall rule (pfSense/OPNsense/iptables/Palo Alto) to drop all traffic to/from the IP." },
      { term: "Kill Process", means: "Terminates a running PID on the endpoint via the Wazuh agent." },
      { term: "Disable User", means: "Locks the account in AD / LDAP / local OS so the attacker can't reuse the credentials." },
      { term: "Quarantine File", means: "Moves a file by SHA-256 to a sealed quarantine path on every endpoint that has it." },
      { term: "Audit Log", means: "Every action is stored in your private database — date, target, status, response payload. Forensic-grade chain of custody." },
    ],
  },
  osquery: {
    what: "Ask every computer in your fleet a SQL question right now — 'show me every running process,' 'list every user,' 'find every file matching this hash.' osquery turns the OS into a database you can query.",
    how: [
      "Pick a saved query (process list, open ports, USB devices, persistence keys) or type your own SQL.",
      "Pick which hosts to ask (all, a group, one).",
      "Run — results come back in seconds, sortable like a spreadsheet.",
    ],
    legend: [
      { term: "Pack", means: "A bundle of pre-written queries grouped by topic (e.g., 'incident-response', 'compliance', 'vuln-management')." },
      { term: "Distributed query", means: "A one-shot ad-hoc question — runs once and returns. Different from a 'scheduled query' that runs forever." },
      { term: "Fleet", means: "The osquery management server — the thing that pushes queries out and collects results." },
    ],
  },
  strelka: {
    what: "A file scanner on steroids. Every file Zeek extracts from network traffic (PDFs, Office docs, executables, scripts) gets ripped apart by Strelka — embedded objects, macros, exif, hashes, YARA matches.",
    how: [
      "Drop a file manually OR let Zeek auto-feed it from sensors.",
      "Read the scan tree — Strelka shows nested objects (a Word doc containing a macro that downloaded an EXE).",
      "Click any object to see YARA hits, hashes (MD5/SHA1/SHA256), and metadata.",
    ],
    legend: [
      { term: "Scanner", means: "A module that handles one file type (e.g., ScanPe for Windows EXEs, ScanPdf for PDFs)." },
      { term: "YARA hit", means: "A rule matched — the file contains a known-bad pattern." },
      { term: "IOC enrichment", means: "Strelka calls Cortex/VirusTotal automatically to score each artifact." },
    ],
  },
  sigma: {
    what: "Detection rules written in a vendor-neutral YAML format. Write the logic ONCE in Sigma; it compiles down to Elastic, Splunk, Suricata, Wazuh queries — no rewrites.",
    how: [
      "Browse the live SigmaHQ rule repository (8000+ public rules) by category.",
      "Enable a rule — Zaxin auto-converts it for every backend in your grid.",
      "Write your own rule in the editor; the converter shows the Elastic and Wazuh equivalents in real time.",
    ],
    legend: [
      { term: "Logsource", means: "The data source the rule expects (e.g., 'product: windows, service: security')." },
      { term: "Detection", means: "The match logic — fields and values that must appear." },
      { term: "Level", means: "Severity tag — informational, low, medium, high, critical." },
      { term: "Backend", means: "The query language Sigma is compiled to (Splunk SPL, Elastic ES|QL, etc.)." },
    ],
  },
  cortex: {
    what: "Auto-enrichment. When an IOC (an IP, a hash, a domain) lands in your case, Cortex runs it through 100+ analyzers (VirusTotal, AbuseIPDB, Shodan, Greynoise, MalwareBazaar) and stamps the result.",
    how: [
      "Configure analyzer API keys once (per service).",
      "Right-click any IOC in a Case to run an analyzer.",
      "Or build a Responder — auto-run analyzers on every new alert and tag the case.",
    ],
    legend: [
      { term: "Analyzer", means: "A read-only enrichment module (lookup-only, no changes)." },
      { term: "Responder", means: "An action module (block, isolate, notify) — read-write." },
      { term: "TAXII / MISP", means: "Threat-feed protocols Cortex can pull IOCs from for community sharing." },
    ],
  },
  grafana: {
    what: "Custom visual dashboards backed by your live telemetry. Build charts of anything Zeek/Suricata/Wazuh records — alerts per hour, top countries, JA3 fingerprints, DNS queries by domain.",
    how: [
      "Open a dashboard or import a community JSON.",
      "Pick a time range (last hour, 24h, 7d).",
      "Add a panel: pick the data source, write the query, choose the chart type.",
    ],
    legend: [
      { term: "Datasource", means: "Where Grafana pulls from — Elasticsearch (logs), Prometheus (metrics), Loki (lightweight logs)." },
      { term: "Panel", means: "One chart on a dashboard — line, bar, table, gauge, heatmap." },
      { term: "Annotation", means: "Vertical line on a chart marking an event (e.g., 'deploy', 'incident')." },
    ],
  },
  attck: {
    what: "The MITRE ATT&CK Navigator. A heatmap of every known attacker technique color-coded by your coverage — green = you'd detect it, red = you're blind, yellow = partial.",
    how: [
      "Each cell is one technique (e.g., T1059.001 = PowerShell). Click it for the full Wikipedia of the technique.",
      "Hover to see which of your Sigma/Suricata rules cover that technique.",
      "Export your coverage map as a layer JSON — share with auditors or board.",
    ],
    legend: [
      { term: "Tactic", means: "Why an attacker does something (Initial Access, Execution, Persistence, etc.)." },
      { term: "Technique", means: "How they do it (Phishing, PowerShell, Scheduled Task)." },
      { term: "Sub-technique", means: "A more specific variant (T1059.001 = PowerShell)." },
      { term: "Coverage", means: "Whether you'd detect this technique today (green/yellow/red)." },
    ],
  },
  curator: {
    what: "The janitor for your log indices. Decides what gets kept, what gets compressed, what gets deleted. Without curator, your disk fills up and the platform dies.",
    how: [
      "Set retention per index (e.g., conn.log 90 days, dns.log 30 days, http.log 7 days).",
      "Watch the disk meter — green = healthy, yellow = warm, red = full (oldest data starts auto-deleting).",
      "Force a snapshot before deleting if you need to archive to cold storage.",
    ],
    legend: [
      { term: "Hot / Warm / Cold", means: "Index temperature — hot = recent + searchable fast, warm = older + slower, cold = archived." },
      { term: "ILM policy", means: "Index Lifecycle Management — the rules that move indices through hot→warm→cold→delete." },
      { term: "Snapshot", means: "A point-in-time backup of an index — restorable later." },
    ],
  },
};

const HelpCard = ({ screen }: { screen: ZaxinScreen }) => {
  const [open, setOpen] = useState(true);
  const h = HELP[screen];
  return (
    <div className="rounded-lg border border-foreground/[0.08] bg-gradient-to-br from-foreground/[0.025] to-foreground/[0.005] backdrop-blur-md mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-foreground/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-foreground/60" />
          <span className="text-[10px] tracking-[0.18em] uppercase text-foreground/85">How to read this page</span>
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/[0.04]">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1">What this is</div>
            <p className="text-[11px] leading-relaxed text-foreground/75">{h.what}</p>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1">How to use it</div>
            <ul className="space-y-1">
              {h.how.map((step, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-foreground/75 flex gap-2">
                  <span className="text-foreground/40 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">What the data means</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {h.legend.map((l, i) => (
                <div key={i} className="text-[10px] leading-relaxed">
                  <span className="text-foreground/85 font-medium">{l.term}</span>
                  <span className="text-muted-foreground/60"> — {l.means}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const NAV: { id: ZaxinScreen; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "overview", label: "Overview", icon: Shield, group: "Monitor" },
  { id: "alerts", label: "Alerts", icon: Bell, group: "Monitor" },
  { id: "dashboards", label: "Dashboards", icon: Activity, group: "Monitor" },
  { id: "grafana", label: "Grafana", icon: BarChart3, group: "Monitor" },
  { id: "attck", label: "ATT&CK Navigator", icon: Crosshair, group: "Monitor" },

  { id: "hunt", label: "Hunt", icon: Search, group: "Investigate" },
  { id: "pcap", label: "PCAP", icon: Network, group: "Investigate" },
  { id: "zeek", label: "Zeek Logs", icon: ScrollText, group: "Investigate" },
  { id: "osquery", label: "osquery / Fleet", icon: Terminal, group: "Investigate" },
  { id: "strelka", label: "Strelka Files", icon: FlaskConical, group: "Investigate" },
  { id: "cases", label: "Cases (TheHive)", icon: Briefcase, group: "Investigate" },

  { id: "detections", label: "Detection Rules", icon: Radar, group: "Detect" },
  { id: "sigma", label: "Sigma Rules", icon: BookOpen, group: "Detect" },
  { id: "cortex", label: "Cortex Analyzers", icon: Workflow, group: "Detect" },
  { id: "endpoint", label: "Endpoint (Wazuh)", icon: Cpu, group: "Detect" },

  { id: "response", label: "Response & Containment", icon: Zap, group: "Respond" },

  { id: "grid", label: "Grid Nodes", icon: Server, group: "Operate" },
  { id: "curator", label: "Index Lifecycle", icon: Trash2, group: "Operate" },
  { id: "downloads", label: "ISO & Keys", icon: Download, group: "Operate" },
  { id: "config", label: "Configuration", icon: SettingsIcon, group: "Operate" },
];

const Stat = ({ label, value, sub, icon: Icon, tone = "default" }: {
  label: string; value: string; sub?: string; icon: React.ElementType; tone?: "default" | "alert" | "ok";
}) => (
  <div className="rounded-lg border border-border/[0.06] bg-foreground/[0.015] p-4 backdrop-blur-md">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40">{label}</span>
      <Icon className={`h-3.5 w-3.5 ${tone === "alert" ? "text-red-400/70" : tone === "ok" ? "text-emerald-400/70" : "text-foreground/40"}`} />
    </div>
    <div className="text-2xl font-extralight tracking-tight text-foreground/90">{value}</div>
    {sub && <div className="text-[9px] text-muted-foreground/40 mt-1.5 tracking-wider uppercase">{sub}</div>}
  </div>
);

const Panel = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border/[0.06] bg-foreground/[0.015] backdrop-blur-md">
    <div className="px-4 py-3 border-b border-border/[0.06]">
      <div className="text-[10px] tracking-[0.15em] uppercase text-foreground/80">{title}</div>
      {desc && <div className="text-[9px] text-muted-foreground/40 mt-1">{desc}</div>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Row = ({ cells, tone }: { cells: (string | React.ReactNode)[]; tone?: "critical" | "high" | "med" | "low" }) => {
  const dot =
    tone === "critical" ? "bg-red-400" :
    tone === "high" ? "bg-orange-400" :
    tone === "med" ? "bg-yellow-400" :
    tone === "low" ? "bg-emerald-400" : "bg-foreground/30";
  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] last:border-0 hover:bg-foreground/[0.02] transition-colors text-[10px] text-foreground/70">
      <div className="col-span-1 flex items-center"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} /></div>
      {cells.map((c, i) => (
        <div key={i} className={`col-span-${i === 0 ? 4 : 2} truncate`}>{c}</div>
      ))}
    </div>
  );
};

// ============================================================
// LIVE DATA LAYER
// ============================================================
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type IntelAlert = { sig: string; src: string; dst: string; eng: string; t: string; sev: "critical"|"high"|"med"|"low"; ref?: string };
type IntelDet = { rule: string; type: string; sid: string; hits: string; sev: "crit"|"high"|"med"|"low"; threat?: string; first?: string };
type IntelHost = { host: string; count: number; label: string };
type IntelRelease = { tag: string; name: string; publishedAt: string; htmlUrl: string; assets: { name: string; size: number; downloadUrl: string; downloads: number }[] };
type IntelMitre = { tactic: string; techniques: number };

interface IntelBundle {
  alerts: IntelAlert[];
  detections: IntelDet[];
  topHosts: IntelHost[];
  releases: IntelRelease[];
  mitre: IntelMitre[];
}

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zaxin-intel`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const useZaxinIntel = () => {
  const [data, setData] = useState<IntelBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${FN_BASE}?action=all`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      setFetchedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const i = setInterval(load, 5 * 60 * 1000); return () => clearInterval(i); }, []);
  return { data, loading, error, fetchedAt, refresh: load };
};

const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1024**2 ? `${(n/1024).toFixed(1)} KB` : n < 1024**3 ? `${(n/1024**2).toFixed(1)} MB` : `${(n/1024**3).toFixed(2)} GB`;
const timeAgo = (iso: string) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return iso;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const LoadingNote = () => (
  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest py-4 text-center">Fetching live intelligence…</div>
);
const ErrorNote = ({ msg, onRetry }: { msg: string; onRetry: () => void }) => (
  <div className="text-[10px] py-4 px-3 text-center">
    <div className="text-red-400/80">Live feed unavailable: {msg}</div>
    <button onClick={onRetry} className="mt-2 text-foreground/70 underline">Retry</button>
  </div>
);
const EmptyNote = ({ msg }: { msg: string }) => (
  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest py-6 text-center">{msg}</div>
);

// ============================================================
// SELF-HOSTED GRID CONFIG (localStorage) — no fake values
// ============================================================
interface GridCfg { url: string; apiKey: string; }
const GRID_KEY = "zaxin.gridCfg";
const loadGrid = (): GridCfg => {
  try { return JSON.parse(localStorage.getItem(GRID_KEY) || '{"url":"","apiKey":""}'); }
  catch { return { url: "", apiKey: "" }; }
};
const saveGrid = (c: GridCfg) => localStorage.setItem(GRID_KEY, JSON.stringify(c));

const GridNotConnected = ({ moduleName, what }: { moduleName: string; what: string }) => (
  <div className="rounded-lg border border-border/[0.08] bg-foreground/[0.015] p-8 text-center backdrop-blur-md">
    <Server className="h-6 w-6 text-foreground/30 mx-auto mb-3" />
    <div className="text-[11px] tracking-[0.15em] uppercase text-foreground/80 mb-1.5">{moduleName} requires a connected grid</div>
    <div className="text-[10px] text-muted-foreground/50 max-w-md mx-auto leading-relaxed mb-4">
      {what} The data here comes from your live, self-hosted Security Onion deployment. Connect your grid URL and API key in <span className="text-foreground/70">Configuration</span> to populate this view.
    </div>
    <div className="text-[9px] text-muted-foreground/30 uppercase tracking-widest">No simulated data is shown</div>
  </div>
);

// ============================================================
// SCREENS
// ============================================================
const OverviewScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => {
  const [caseCount, setCaseCount] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("zaxin_cases").select("id", { count: "exact", head: true }).neq("status", "closed");
      setCaseCount(count ?? 0);
    })();
  }, []);

  const grid = loadGrid();
  const gridConnected = Boolean(grid.url);
  const d = intel.data;
  const critCount = d?.alerts.filter(a => a.sev === "critical").length ?? 0;
  const totalAlerts = d?.alerts.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Live Threat Alerts" value={intel.loading ? "…" : String(totalAlerts)} sub={`${critCount} critical · URLhaus live`} icon={Bell} tone={critCount > 0 ? "alert" : "default"} />
        <Stat label="Active IOCs (24h)" value={intel.loading ? "…" : String(d?.detections.length ?? 0)} sub="ThreatFox live feed" icon={Radar} />
        <Stat label="Your Open Cases" value={caseCount === null ? "…" : String(caseCount)} sub="Live from your DB" icon={Briefcase} />
        <Stat label="Grid Connection" value={gridConnected ? "ON" : "OFF"} sub={gridConnected ? grid.url.replace(/^https?:\/\//, "") : "configure to connect"} icon={Server} tone={gridConnected ? "ok" : "default"} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Panel title="Live Threat Hosts" desc="ThreatFox — 3-day window">
          {intel.loading && <LoadingNote />}
          {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
          {!intel.loading && !intel.error && (d?.topHosts.length ? d.topHosts.slice(0, 6).map(h => (
            <div key={h.host} className="grid grid-cols-3 py-1.5 text-[10px] gap-2">
              <span className="text-foreground/80 font-mono truncate">{h.host}</span>
              <span className="text-muted-foreground/50 truncate">{h.label}</span>
              <span className="text-right text-foreground/60">{h.count}</span>
            </div>
          )) : <EmptyNote msg="No hosts in window" />)}
        </Panel>
        <Panel title="MITRE ATT&CK — Live" desc="Enterprise techniques per tactic">
          {intel.loading && <LoadingNote />}
          {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
          {d?.mitre.length ? (() => {
            const max = Math.max(...d.mitre.map(m => m.techniques), 1);
            return d.mitre.slice(0, 7).map(m => (
              <div key={m.tactic} className="py-1.5">
                <div className="flex justify-between text-[10px] text-foreground/70 mb-1">
                  <span className="capitalize">{m.tactic.replace(/-/g, " ")}</span>
                  <span className="text-muted-foreground/50">{m.techniques}</span>
                </div>
                <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                  <div className="h-full bg-foreground/40" style={{ width: `${(m.techniques / max) * 100}%` }} />
                </div>
              </div>
            ));
          })() : null}
        </Panel>
        <Panel title="Latest Release" desc="GitHub: Security-Onion-Solutions">
          {intel.loading && <LoadingNote />}
          {d?.releases.length ? (
            <div className="text-[10px] space-y-2">
              <div className="text-foreground/85 font-mono">{d.releases[0].tag}</div>
              <div className="text-muted-foreground/50">{d.releases[0].name}</div>
              <div className="text-muted-foreground/40 text-[9px] uppercase tracking-widest">Published {timeAgo(d.releases[0].publishedAt)}</div>
              <a href={d.releases[0].htmlUrl} target="_blank" rel="noreferrer" className="text-foreground/70 underline text-[10px]">Open on GitHub →</a>
            </div>
          ) : null}
        </Panel>
      </div>
      {intel.fetchedAt && (
        <div className="text-[8px] text-muted-foreground/30 uppercase tracking-widest text-right">
          Live data · last refresh {timeAgo(new Date(intel.fetchedAt).toISOString())} · auto-refresh 5m
        </div>
      )}
    </div>
  );
};

const AlertsScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => (
  <Panel title="Live Threat Alerts" desc="URLhaus recent malicious URL submissions — abuse.ch">
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
      <div className="col-span-1">Sev</div>
      <div className="col-span-4">Signature</div>
      <div className="col-span-2">Host</div>
      <div className="col-span-3">URL</div>
      <div className="col-span-1">Eng</div>
      <div className="col-span-1">Seen</div>
    </div>
    {intel.loading && <LoadingNote />}
    {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
    {!intel.loading && !intel.error && (intel.data?.alerts.length ? intel.data.alerts.map((a, i) => {
      const dot = a.sev === "critical" ? "bg-red-400" : a.sev === "high" ? "bg-orange-400" : a.sev === "med" ? "bg-yellow-400" : "bg-emerald-400";
      return (
        <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] text-[10px] text-foreground/70 hover:bg-foreground/[0.02]">
          <div className="col-span-1 flex items-center"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} /></div>
          <div className="col-span-4 truncate">{a.sig}</div>
          <div className="col-span-2 truncate font-mono text-foreground/80">{a.src}</div>
          <div className="col-span-3 truncate text-muted-foreground/50 font-mono">{a.dst}</div>
          <div className="col-span-1 text-muted-foreground/60">{a.eng}</div>
          <div className="col-span-1 text-muted-foreground/50">{timeAgo(a.t)}</div>
        </div>
      );
    }) : <EmptyNote msg="No alerts in feed" />)}
  </Panel>
);

const HuntScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => {
  const [q, setQ] = useState("");
  const filtered = intel.data?.detections.filter(d =>
    !q || d.rule.toLowerCase().includes(q.toLowerCase()) || d.type.toLowerCase().includes(q.toLowerCase()) || (d.threat ?? "").toLowerCase().includes(q.toLowerCase())
  ) ?? [];
  return (
    <div className="space-y-3">
      <Panel title="Threat Hunt" desc="Searches the live ThreatFox IOC feed (last 24h)">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search IOC / malware / threat type (e.g., emotet, ip:port, sha256)"
          className="w-full bg-background/40 border border-border/[0.08] rounded-md p-3 text-[11px] font-mono text-foreground/80 focus:outline-none focus:border-foreground/20"
        />
        <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground/50">
          <span>{filtered.length} of {intel.data?.detections.length ?? 0} live IOCs</span>
          <button onClick={intel.refresh} className="ml-auto px-2 py-0.5 rounded bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.1]">Refresh feed</button>
        </div>
      </Panel>
      <Panel title="Hunt Results">
        {intel.loading && <LoadingNote />}
        {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
        {!intel.loading && !intel.error && (filtered.length ? filtered.slice(0, 50).map((r, i) => (
          <div key={i} className="grid grid-cols-12 py-2 text-[10px] gap-2 border-b border-border/[0.04]">
            <div className="col-span-6 font-mono text-foreground/80 truncate">{r.rule}</div>
            <div className="col-span-2 text-muted-foreground/50">{r.type}</div>
            <div className="col-span-2 text-muted-foreground/50 truncate">{r.threat}</div>
            <div className="col-span-2 text-right text-foreground/60">{timeAgo(r.first ?? "")}</div>
          </div>
        )) : <EmptyNote msg="No matches" />)}
      </Panel>
    </div>
  );
};

const PcapScreen = () => (
  <GridNotConnected
    moduleName="Full Packet Capture"
    what="Stenographer indexes every packet that crosses your sensor — billions of bytes per day."
  />
);

const CasesScreen = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ title: "", severity: "med", summary: "" });
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("zaxin_cases").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) toast.error("Failed to load cases: " + error.message);
    setCases(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.title.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { toast.error("Sign in to create cases"); return; }
    const year = new Date().getFullYear();
    const code = `C-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const { error } = await supabase.from("zaxin_cases").insert({
      user_id: user.user.id, case_code: code, title: draft.title, summary: draft.summary, severity: draft.severity,
    });
    if (error) { toast.error(error.message); return; }
    setDraft({ title: "", severity: "med", summary: "" });
    setShowForm(false);
    toast.success(`Case ${code} created`);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("zaxin_cases").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("zaxin_cases").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-3">
      <Panel title="Your Investigation Cases" desc="Persisted in your private database — only you can read these">
        <div className="flex justify-between mb-3 text-[10px]">
          <span className="text-muted-foreground/50">{cases.length} cases</span>
          <button onClick={() => setShowForm(v => !v)} className="px-2.5 py-1 rounded bg-foreground/[0.08] text-foreground/80 hover:bg-foreground/[0.12]">
            {showForm ? "Cancel" : "+ New case"}
          </button>
        </div>
        {showForm && (
          <div className="border border-border/[0.08] rounded-md p-3 mb-3 bg-background/40 space-y-2">
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Case title" className="w-full bg-foreground/[0.04] rounded p-2 text-[11px] text-foreground/85 focus:outline-none" />
            <textarea value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} placeholder="What happened? (optional)" className="w-full bg-foreground/[0.04] rounded p-2 text-[11px] text-foreground/80 h-16 resize-none focus:outline-none" />
            <div className="flex gap-2 items-center">
              <select value={draft.severity} onChange={e => setDraft({ ...draft, severity: e.target.value })} className="bg-foreground/[0.04] rounded p-1.5 text-[10px] text-foreground/80 focus:outline-none">
                <option value="critical">Critical</option><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option>
              </select>
              <button onClick={create} className="ml-auto px-3 py-1.5 rounded bg-foreground/[0.1] text-foreground/85 hover:bg-foreground/[0.15] text-[10px]">Create case</button>
            </div>
          </div>
        )}
        {loading && <LoadingNote />}
        {!loading && !cases.length && <EmptyNote msg="No cases yet — create your first investigation above" />}
        {cases.map(c => {
          const dot = c.severity === "critical" ? "bg-red-400" : c.severity === "high" ? "bg-orange-400" : c.severity === "med" ? "bg-yellow-400" : "bg-emerald-400";
          return (
            <div key={c.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] text-[10px] text-foreground/70 hover:bg-foreground/[0.02]">
              <div className="col-span-1 flex items-center"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} /></div>
              <div className="col-span-6 truncate"><span className="text-muted-foreground/50 font-mono">{c.case_code}</span> — {c.title}</div>
              <div className="col-span-3">
                <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)} className="bg-foreground/[0.04] rounded px-1.5 py-0.5 text-[10px] text-foreground/80 focus:outline-none w-full">
                  <option value="open">Open</option><option value="triage">Triage</option><option value="investigating">Investigating</option><option value="containment">Containment</option><option value="closed">Closed</option>
                </select>
              </div>
              <div className="col-span-1 text-muted-foreground/50">{timeAgo(c.created_at)}</div>
              <div className="col-span-1 text-right"><button onClick={() => del(c.id)} className="text-muted-foreground/40 hover:text-red-400/80">×</button></div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
};

const GridScreen = () => (
  <GridNotConnected
    moduleName="Grid Nodes"
    what="Node health (CPU, memory, role, status) is reported by your live Salt-managed Security Onion grid."
  />
);

const DetectionsScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => (
  <Panel title="Live Detection IOCs" desc="ThreatFox IOC feed — abuse.ch (last 24h)">
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
      <div className="col-span-1">St</div>
      <div className="col-span-5">IOC / Malware</div>
      <div className="col-span-2">Type</div>
      <div className="col-span-2">Threat</div>
      <div className="col-span-1">Conf</div>
      <div className="col-span-1">Sev</div>
    </div>
    {intel.loading && <LoadingNote />}
    {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
    {!intel.loading && !intel.error && (intel.data?.detections.length ? intel.data.detections.map((r, i) => {
      const dot = r.sev === "crit" ? "bg-red-400" : r.sev === "high" ? "bg-orange-400" : r.sev === "med" ? "bg-yellow-400" : "bg-emerald-400";
      return (
        <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] text-[10px] text-foreground/70 hover:bg-foreground/[0.02]">
          <div className="col-span-1"><span className={`w-1.5 h-1.5 rounded-full inline-block ${dot}`} /></div>
          <div className="col-span-5 truncate font-mono">{r.rule}</div>
          <div className="col-span-2 text-muted-foreground/60">{r.type}</div>
          <div className="col-span-2 text-muted-foreground/50 truncate">{r.threat}</div>
          <div className="col-span-1">{r.hits}</div>
          <div className="col-span-1 uppercase text-[9px] text-foreground/60">{r.sev}</div>
        </div>
      );
    }) : <EmptyNote msg="No IOCs in feed" />)}
  </Panel>
);

const ZeekScreen = () => (
  <GridNotConnected
    moduleName="Zeek Logs"
    what="Zeek (conn, dns, http, ssl, files, notice, x509, weird) writes structured logs on each sensor in your grid."
  />
);

const EndpointScreen = () => (
  <GridNotConnected
    moduleName="Wazuh Endpoints"
    what="Endpoint telemetry (Windows/Linux/macOS agents, FIM, vulnerability scans) is reported by Wazuh managers in your grid."
  />
);

const DashboardsScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => {
  const max = Math.max(...(intel.data?.mitre.map(m => m.techniques) ?? [1]), 1);
  return (
    <Panel title="MITRE ATT&CK Coverage (Live)" desc="Enterprise tactic → technique counts from MITRE CTI repository">
      {intel.loading && <LoadingNote />}
      {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
      {intel.data?.mitre.length ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {intel.data.mitre.map(m => (
            <div key={m.tactic}>
              <div className="flex justify-between text-[10px] text-foreground/75 mb-1.5">
                <span className="capitalize">{m.tactic.replace(/-/g, " ")}</span>
                <span className="text-muted-foreground/50 font-mono">{m.techniques}</span>
              </div>
              <div className="h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden">
                <div className="h-full bg-foreground/45" style={{ width: `${(m.techniques / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
};

const DownloadsScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => (
  <div className="space-y-3">
    <Panel title="Security Onion — Live Releases" desc="GitHub API · Security-Onion-Solutions/securityonion">
      {intel.loading && <LoadingNote />}
      {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
      {intel.data?.releases.length ? intel.data.releases.map(r => (
        <div key={r.tag} className="border-b border-border/[0.04] py-3">
          <div className="flex items-baseline justify-between mb-1">
            <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="text-foreground/85 font-mono text-[11px] hover:underline">{r.tag}</a>
            <span className="text-muted-foreground/50 text-[9px] uppercase tracking-widest">{timeAgo(r.publishedAt)}</span>
          </div>
          <div className="text-muted-foreground/50 text-[10px] mb-2">{r.name}</div>
          {r.assets.length > 0 && (
            <div className="space-y-1 mt-2">
              {r.assets.map(a => (
                <div key={a.name} className="flex items-center justify-between text-[10px] py-1 pl-3 border-l border-border/[0.06]">
                  <div className="truncate">
                    <span className="text-foreground/75 font-mono">{a.name}</span>
                    <span className="text-muted-foreground/40 ml-2">{formatBytes(a.size)} · {a.downloads.toLocaleString()} downloads</span>
                  </div>
                  <a href={a.downloadUrl} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.1]">Download</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )) : <EmptyNote msg="No releases returned" />}
    </Panel>
  </div>
);

const ConfigScreen = () => {
  const [cfg, setCfg] = useState<GridCfg>(loadGrid());
  const save = () => { saveGrid(cfg); toast.success("Grid configuration saved"); };
  const clear = () => { setCfg({ url: "", apiKey: "" }); saveGrid({ url: "", apiKey: "" }); toast.success("Grid disconnected"); };
  const test = async () => {
    if (!cfg.url) { toast.error("Set a grid URL first"); return; }
    try {
      const r = await fetch(cfg.url, { method: "HEAD", mode: "no-cors" });
      toast.success("Reachable (CORS may hide details)");
    } catch (e) {
      toast.error("Could not reach grid: " + (e instanceof Error ? e.message : String(e)));
    }
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel title="Self-Hosted Grid Connection" desc="Points the PCAP / Zeek / Endpoint / Grid modules at your live deployment">
        <div className="space-y-2 text-[10px]">
          <div>
            <label className="text-muted-foreground/50 uppercase tracking-widest text-[9px] block mb-1">Grid base URL</label>
            <input value={cfg.url} onChange={e => setCfg({ ...cfg, url: e.target.value })} placeholder="https://so-manager.your-network.local" className="w-full bg-background/40 border border-border/[0.08] rounded p-2 text-[11px] font-mono text-foreground/85 focus:outline-none focus:border-foreground/20" />
          </div>
          <div>
            <label className="text-muted-foreground/50 uppercase tracking-widest text-[9px] block mb-1">API key (stored locally)</label>
            <input type="password" value={cfg.apiKey} onChange={e => setCfg({ ...cfg, apiKey: e.target.value })} placeholder="••••••••" className="w-full bg-background/40 border border-border/[0.08] rounded p-2 text-[11px] font-mono text-foreground/85 focus:outline-none focus:border-foreground/20" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="px-3 py-1.5 rounded bg-foreground/[0.1] text-foreground/85 hover:bg-foreground/[0.15]">Save</button>
            <button onClick={test} className="px-3 py-1.5 rounded bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.08]">Test reach</button>
            <button onClick={clear} className="ml-auto px-3 py-1.5 rounded bg-foreground/[0.05] text-muted-foreground/60 hover:text-red-400/80">Disconnect</button>
          </div>
          <div className="text-[9px] text-muted-foreground/40 leading-relaxed pt-2">
            Status: <span className={cfg.url ? "text-emerald-400/80" : "text-muted-foreground/50"}>{cfg.url ? "Configured" : "Not connected"}</span>. No simulated values are ever shown — modules requiring grid data display an empty state until you connect.
          </div>
        </div>
      </Panel>
      <Panel title="Live Public Feeds Used" desc="Read-only — no key required">
        <div className="space-y-2 text-[10px] text-foreground/75">
          <div className="flex justify-between border-b border-border/[0.04] py-1.5"><span>URLhaus (abuse.ch)</span><span className="text-emerald-400/70 uppercase text-[9px]">live</span></div>
          <div className="flex justify-between border-b border-border/[0.04] py-1.5"><span>ThreatFox (abuse.ch)</span><span className="text-emerald-400/70 uppercase text-[9px]">live</span></div>
          <div className="flex justify-between border-b border-border/[0.04] py-1.5"><span>MITRE ATT&CK CTI</span><span className="text-emerald-400/70 uppercase text-[9px]">live</span></div>
          <div className="flex justify-between py-1.5"><span>Security Onion releases (GitHub)</span><span className="text-emerald-400/70 uppercase text-[9px]">live</span></div>
        </div>
      </Panel>
    </div>
  );
};

// ============================================================
// RESPONSE & CONTAINMENT — one-click stop-it actions
// ============================================================
type ActionType = "isolate_host" | "block_ip" | "kill_process" | "disable_user" | "quarantine_file";

const ACTION_DEFS: { type: ActionType; label: string; icon: React.ElementType; targetLabel: string; targetPlaceholder: string; backend: string; danger: string }[] = [
  { type: "isolate_host",    label: "Isolate Host",     icon: Ban,    targetLabel: "Host / agent name", targetPlaceholder: "host-7821 or 10.0.4.22", backend: "Wazuh Active Response → firewall-drop on agent", danger: "Cuts the host off the network. Only the Wazuh manager can still talk to it." },
  { type: "block_ip",        label: "Block IP",         icon: Network, targetLabel: "IP or CIDR",        targetPlaceholder: "185.220.101.5 or 10.0.0.0/24", backend: "pfSense / OPNsense / iptables / Palo Alto API", danger: "Drops all traffic to/from the IP on the perimeter firewall." },
  { type: "kill_process",    label: "Kill Process",     icon: Skull,  targetLabel: "Host : PID",        targetPlaceholder: "host-7821:4488",        backend: "Wazuh AR → terminate-process on endpoint", danger: "Terminates the PID immediately. Unsaved work on that process is lost." },
  { type: "disable_user",    label: "Disable User",     icon: UserX,  targetLabel: "Username / SID",    targetPlaceholder: "DOMAIN\\jsmith",        backend: "AD / LDAP / local OS account lock", danger: "User cannot log in anywhere until re-enabled." },
  { type: "quarantine_file", label: "Quarantine File",  icon: FileX,  targetLabel: "SHA-256 hash",      targetPlaceholder: "a3f5e7…",               backend: "Wazuh AR → file-move to /quarantine on every endpoint", danger: "Moves the file by hash on every endpoint that has it." },
];

const ResponseScreen = () => {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [params, setParams] = useState<Record<string, string>>({});
  const grid = loadGrid();
  const gridConnected = Boolean(grid.url);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("zaxin_response_actions").select("*").order("created_at", { ascending: false }).limit(100);
    setActions(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fire = async (def: typeof ACTION_DEFS[number]) => {
    const target = (targets[def.type] || "").trim();
    if (!target) { toast.error(`Enter a ${def.targetLabel.toLowerCase()} first`); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in to fire response actions"); return; }
    if (!confirm(`Fire ${def.label} against ${target}?\n\n${def.danger}\n\nThis is logged in the audit trail.`)) return;
    setBusy(def.type);
    const reason = params[def.type] || "";
    const { data: ins, error: insErr } = await supabase.from("zaxin_response_actions")
      .insert({ user_id: u.user.id, action_type: def.type, target, params: { reason, backend: def.backend }, status: gridConnected ? "pending" : "queued_no_grid" })
      .select().single();
    if (insErr) { toast.error(insErr.message); setBusy(null); return; }

    if (!gridConnected) {
      toast.warning(`Action queued — connect your grid in Configuration to dispatch it.`);
      setBusy(null); setTargets({ ...targets, [def.type]: "" }); load(); return;
    }

    // Dispatch to user's grid
    try {
      const r = await fetch(`${grid.url.replace(/\/$/, "")}/connect/response/${def.type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": grid.apiKey },
        body: JSON.stringify({ target, reason, action_id: ins.id }),
      });
      const body = await r.text();
      const parsed = (() => { try { return JSON.parse(body); } catch { return { raw: body }; } })();
      await supabase.from("zaxin_response_actions").update({
        status: r.ok ? "executed" : "failed",
        response: parsed, error: r.ok ? null : `HTTP ${r.status}`,
        completed_at: new Date().toISOString(),
      }).eq("id", ins.id);
      r.ok ? toast.success(`${def.label} dispatched`) : toast.error(`Grid returned HTTP ${r.status}`);
    } catch (e: any) {
      await supabase.from("zaxin_response_actions").update({
        status: "failed", error: e?.message ?? String(e), completed_at: new Date().toISOString(),
      }).eq("id", ins.id);
      toast.error(`Grid unreachable: ${e?.message ?? e}`);
    }
    setBusy(null); setTargets({ ...targets, [def.type]: "" }); load();
  };

  return (
    <div className="space-y-3">
      {!gridConnected && (
        <div className="rounded-lg border border-yellow-500/[0.15] bg-yellow-500/[0.04] p-3 text-[10px] text-yellow-200/80 backdrop-blur-md">
          <AlertTriangle className="h-3 w-3 inline mr-1.5" /> Grid not connected — actions will be <span className="text-yellow-100/90 font-medium">queued in your audit log</span> but not dispatched. Connect a grid in Configuration to actually execute.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_DEFS.map(def => {
          const Icon = def.icon;
          return (
            <div key={def.type} className="rounded-lg border border-border/[0.08] bg-foreground/[0.015] p-4 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-red-500/[0.08] border border-red-500/[0.15] flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-red-400/80" />
                  </div>
                  <div className="text-[11px] tracking-[0.12em] uppercase text-foreground/90">{def.label}</div>
                </div>
              </div>
              <div className="text-[9px] text-muted-foreground/50 leading-relaxed mb-3">{def.backend}</div>
              <input
                value={targets[def.type] || ""}
                onChange={e => setTargets({ ...targets, [def.type]: e.target.value })}
                placeholder={def.targetPlaceholder}
                className="w-full bg-background/40 border border-border/[0.08] rounded p-2 text-[11px] font-mono text-foreground/85 mb-2 focus:outline-none focus:border-foreground/20"
              />
              <input
                value={params[def.type] || ""}
                onChange={e => setParams({ ...params, [def.type]: e.target.value })}
                placeholder="Reason / case ref (optional)"
                className="w-full bg-background/40 border border-border/[0.08] rounded p-2 text-[10px] text-foreground/75 mb-2 focus:outline-none focus:border-foreground/20"
              />
              <button
                onClick={() => fire(def)}
                disabled={busy === def.type}
                className="w-full px-3 py-2 rounded-md bg-red-500/[0.1] border border-red-500/[0.25] text-red-200/90 hover:bg-red-500/[0.18] disabled:opacity-50 text-[10px] tracking-[0.12em] uppercase transition-colors"
              >
                {busy === def.type ? "Dispatching…" : `Fire ${def.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <Panel title="Containment Audit Log" desc="Every action you've fired — private to your account, forensic-grade chain of custody">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
          <div className="col-span-1">St</div>
          <div className="col-span-3">Action</div>
          <div className="col-span-4">Target</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">When</div>
        </div>
        {loading && <LoadingNote />}
        {!loading && !actions.length && <EmptyNote msg="No actions fired yet" />}
        {actions.map(a => {
          const ok = a.status === "executed";
          const fail = a.status === "failed";
          const dot = ok ? "bg-emerald-400" : fail ? "bg-red-400" : "bg-yellow-400";
          return (
            <div key={a.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] text-[10px] text-foreground/70 hover:bg-foreground/[0.02]">
              <div className="col-span-1 flex items-center"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} /></div>
              <div className="col-span-3 truncate uppercase tracking-wide text-[9px]">{a.action_type.replace(/_/g, " ")}</div>
              <div className="col-span-4 truncate font-mono text-foreground/85">{a.target}</div>
              <div className="col-span-2 text-muted-foreground/60 text-[9px] uppercase">{a.status}</div>
              <div className="col-span-2 text-muted-foreground/50">{timeAgo(a.created_at)}</div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
};

// ============================================================
// MISSING STACK SCREENS (grid-backed — show empty state until grid is connected)
// ============================================================
const OsqueryScreen = () => (
  <GridNotConnected moduleName="osquery / Fleet" what="Distributed SQL queries across your endpoints (process lists, open ports, persistence keys) are issued by your Fleet server." />
);
const StrelkaScreen = () => (
  <GridNotConnected moduleName="Strelka File Scanning" what="Deep file analysis (YARA, embedded objects, hashes, metadata) runs on the Strelka cluster in your grid." />
);
const SigmaScreen = () => (
  <div className="space-y-3">
    <Panel title="Sigma Rules — Live Index" desc="Open-source detection rule repository (SigmaHQ)">
      <div className="text-[11px] text-foreground/75 leading-relaxed mb-3">
        Sigma is the vendor-neutral detection format used across the Security Onion stack. Once your grid is connected, Zaxin will sync the full SigmaHQ ruleset and convert each rule into the right backend (Elastic, Suricata, Wazuh) automatically.
      </div>
      <a href="https://github.com/SigmaHQ/sigma" target="_blank" rel="noreferrer" className="inline-block px-3 py-1.5 rounded bg-foreground/[0.06] text-foreground/85 text-[10px] hover:bg-foreground/[0.1]">Open SigmaHQ on GitHub →</a>
    </Panel>
    <GridNotConnected moduleName="Live rule sync" what="The compiled, per-backend rule deployment requires your grid's rule manager." />
  </div>
);
const CortexScreen = () => (
  <GridNotConnected moduleName="Cortex Analyzers" what="IOC enrichment (VirusTotal, AbuseIPDB, Shodan, Greynoise, MalwareBazaar) runs on your Cortex server with your private analyzer API keys." />
);
const GrafanaScreen = () => {
  const grid = loadGrid();
  if (!grid.url) return <GridNotConnected moduleName="Grafana" what="Custom visual dashboards live on your Grafana instance and pull from your Elasticsearch / Prometheus." />;
  const grafUrl = grid.url.replace(/\/$/, "") + "/grafana";
  return (
    <Panel title="Grafana — Embedded" desc={`Loaded from ${grafUrl}`}>
      <iframe src={grafUrl} className="w-full h-[600px] rounded border border-border/[0.08] bg-foreground/[0.01]" title="Grafana" />
      <div className="text-[9px] text-muted-foreground/40 mt-2">If the dashboard does not load, ensure your grid allows iframe embedding for this origin.</div>
    </Panel>
  );
};
const AttckScreen = ({ intel }: { intel: ReturnType<typeof useZaxinIntel> }) => {
  const max = Math.max(...(intel.data?.mitre.map(m => m.techniques) ?? [1]), 1);
  return (
    <div className="space-y-3">
      <Panel title="ATT&CK Navigator — Live MITRE Enterprise Matrix" desc="Live tactic → technique counts. Cell intensity = total techniques per tactic.">
        {intel.loading && <LoadingNote />}
        {intel.error && <ErrorNote msg={intel.error} onRetry={intel.refresh} />}
        {intel.data?.mitre.length ? (
          <div className="grid grid-cols-7 gap-1.5">
            {intel.data.mitre.map(m => {
              const intensity = m.techniques / max;
              return (
                <div key={m.tactic} className="rounded border border-border/[0.06] p-2" style={{ background: `rgba(239, 68, 68, ${0.05 + intensity * 0.25})` }}>
                  <div className="text-[8px] uppercase tracking-wider text-foreground/85 truncate capitalize">{m.tactic.replace(/-/g, " ")}</div>
                  <div className="text-[18px] font-extralight text-foreground/90 mt-1">{m.techniques}</div>
                  <div className="text-[8px] text-muted-foreground/50">techniques</div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="text-[9px] text-muted-foreground/40 mt-3 pt-3 border-t border-border/[0.06]">
          Source: MITRE CTI repository (live). Connect your grid to overlay YOUR detection coverage per technique.
        </div>
      </Panel>
    </div>
  );
};
const CuratorScreen = () => (
  <GridNotConnected moduleName="Index Lifecycle (Curator)" what="Retention policies, snapshot schedules, and disk-watermark management run on your Elasticsearch cluster." />
);

const ZaxinView = () => {
  const [screen, setScreen] = useState<ZaxinScreen>("overview");
  const intel = useZaxinIntel();
  const gridConnected = Boolean(loadGrid().url);

  const render = () => {
    switch (screen) {
      case "overview":   return <OverviewScreen intel={intel} />;
      case "alerts":     return <AlertsScreen intel={intel} />;
      case "hunt":       return <HuntScreen intel={intel} />;
      case "pcap":       return <PcapScreen />;
      case "cases":      return <CasesScreen />;
      case "grid":       return <GridScreen />;
      case "detections": return <DetectionsScreen intel={intel} />;
      case "zeek":       return <ZeekScreen />;
      case "endpoint":   return <EndpointScreen />;
      case "dashboards": return <DashboardsScreen intel={intel} />;
      case "downloads":  return <DownloadsScreen intel={intel} />;
      case "config":     return <ConfigScreen />;
      case "response":   return <ResponseScreen />;
      case "osquery":    return <OsqueryScreen />;
      case "strelka":    return <StrelkaScreen />;
      case "sigma":      return <SigmaScreen />;
      case "cortex":     return <CortexScreen />;
      case "grafana":    return <GrafanaScreen />;
      case "attck":      return <AttckScreen intel={intel} />;
      case "curator":    return <CuratorScreen />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-5 py-2.5 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Layers className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-[11px] font-light tracking-[0.12em] text-foreground/90 uppercase">Zaxin</h1>
            <p className="text-[8px] text-muted-foreground/30 tracking-[0.15em] uppercase">Network Defense & Threat Hunt Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${intel.error ? "bg-red-500/[0.06] border-red-500/[0.15]" : intel.loading ? "bg-yellow-500/[0.06] border-yellow-500/[0.15]" : "bg-emerald-500/[0.06] border-emerald-500/[0.12]"}`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${intel.error ? "bg-red-400" : intel.loading ? "bg-yellow-400" : "bg-emerald-400"}`} />
            <span className={`text-[9px] uppercase tracking-wider ${intel.error ? "text-red-400/80" : intel.loading ? "text-yellow-400/80" : "text-emerald-400/80"}`}>
              {intel.error ? "Feed Error" : intel.loading ? "Loading Feeds" : "Live Feeds Online"}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${gridConnected ? "bg-emerald-500/[0.06] border-emerald-500/[0.12]" : "bg-foreground/[0.03] border-border/[0.08]"}`}>
            <Server className={`h-2.5 w-2.5 ${gridConnected ? "text-emerald-400/80" : "text-muted-foreground/40"}`} />
            <span className={`text-[9px] uppercase tracking-wider ${gridConnected ? "text-emerald-400/80" : "text-muted-foreground/50"}`}>
              {gridConnected ? "Grid Connected" : "Grid Not Connected"}
            </span>
          </div>
          <button onClick={intel.refresh} className="p-2 rounded-lg hover:bg-foreground/[0.03] transition-colors" title="Refresh live feeds">
            <Bell className="h-3.5 w-3.5 text-muted-foreground/40" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left nav */}
        <div className="w-52 shrink-0 border-r border-border/[0.06] bg-background/60 backdrop-blur-md py-3 px-2 overflow-y-auto">
          {(["Monitor","Investigate","Detect","Respond","Operate"] as const).map(group => (
            <div key={group} className="mb-2">
              <div className="px-2.5 py-1 text-[8px] tracking-[0.2em] uppercase text-muted-foreground/30">{group}</div>
              {NAV.filter(n => n.group === group).map(item => (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] tracking-wide transition-all mb-0.5 ${
                    screen === item.id
                      ? "bg-foreground/[0.06] text-foreground/90"
                      : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.02]"
                  } ${item.id === "response" ? "border border-red-500/[0.15] bg-red-500/[0.04]" : ""}`}
                >
                  <item.icon className={`h-3 w-3 ${item.id === "response" ? "text-red-400/70" : ""}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="px-3 py-2 mt-3 border-t border-border/[0.06]">
            <div className="text-[8px] text-muted-foreground/20 tracking-wider uppercase text-center">Powered by AUREON</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <HelpCard screen={screen} />
          {render()}
        </div>
      </div>
    </div>
  );
};

export default ZaxinView;
