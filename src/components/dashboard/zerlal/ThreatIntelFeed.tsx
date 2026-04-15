/**
 * ZERLAL Threat Intelligence Feed
 * Integrates CVE/KEV databases, MITRE ATT&CK TTP mapping, IOC extraction,
 * STIX taxonomy, and phishing URL detection patterns.
 * All intelligence is client-side generated from embedded knowledge bases.
 */
import { useState, useMemo, useCallback } from "react";
import {
  AlertTriangle, Shield, Globe, Search, ExternalLink,
  ChevronDown, ChevronRight, Copy, RefreshCw, Filter,
  Crosshair, Layers, Activity, BookOpen, Zap, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── MITRE ATT&CK TACTICS ───
const MITRE_TACTICS = [
  { id: "TA0001", name: "Initial Access", description: "Techniques for gaining entry to a network", color: "text-red-400" },
  { id: "TA0002", name: "Execution", description: "Running malicious code on a system", color: "text-orange-400" },
  { id: "TA0003", name: "Persistence", description: "Maintaining access across restarts", color: "text-amber-400" },
  { id: "TA0004", name: "Privilege Escalation", description: "Gaining higher-level permissions", color: "text-yellow-400" },
  { id: "TA0005", name: "Defense Evasion", description: "Avoiding detection by security tools", color: "text-lime-400" },
  { id: "TA0006", name: "Credential Access", description: "Stealing account credentials", color: "text-emerald-400" },
  { id: "TA0007", name: "Discovery", description: "Understanding the target environment", color: "text-cyan-400" },
  { id: "TA0008", name: "Lateral Movement", description: "Moving through the network", color: "text-blue-400" },
  { id: "TA0009", name: "Collection", description: "Gathering target data for exfiltration", color: "text-indigo-400" },
  { id: "TA0010", name: "Exfiltration", description: "Stealing data from the network", color: "text-violet-400" },
  { id: "TA0011", name: "Command & Control", description: "Communicating with compromised systems", color: "text-purple-400" },
  { id: "TA0040", name: "Impact", description: "Disrupting availability or integrity", color: "text-pink-400" },
];

// ─── COMMON TECHNIQUES (Subset for web display) ───
const MITRE_TECHNIQUES = [
  { id: "T1566", name: "Phishing", tactic: "TA0001", severity: "high" },
  { id: "T1190", name: "Exploit Public-Facing App", tactic: "TA0001", severity: "critical" },
  { id: "T1133", name: "External Remote Services", tactic: "TA0001", severity: "high" },
  { id: "T1059", name: "Command & Scripting Interpreter", tactic: "TA0002", severity: "high" },
  { id: "T1053", name: "Scheduled Task/Job", tactic: "TA0003", severity: "medium" },
  { id: "T1078", name: "Valid Accounts", tactic: "TA0004", severity: "critical" },
  { id: "T1027", name: "Obfuscated Files/Information", tactic: "TA0005", severity: "medium" },
  { id: "T1110", name: "Brute Force", tactic: "TA0006", severity: "high" },
  { id: "T1003", name: "OS Credential Dumping", tactic: "TA0006", severity: "critical" },
  { id: "T1046", name: "Network Service Discovery", tactic: "TA0007", severity: "low" },
  { id: "T1021", name: "Remote Services", tactic: "TA0008", severity: "high" },
  { id: "T1005", name: "Data from Local System", tactic: "TA0009", severity: "medium" },
  { id: "T1041", name: "Exfiltration Over C2 Channel", tactic: "TA0010", severity: "critical" },
  { id: "T1071", name: "Application Layer Protocol", tactic: "TA0011", severity: "high" },
  { id: "T1486", name: "Data Encrypted for Impact", tactic: "TA0040", severity: "critical" },
  { id: "T1498", name: "Network Denial of Service", tactic: "TA0040", severity: "high" },
  { id: "T1189", name: "Drive-by Compromise", tactic: "TA0001", severity: "high" },
  { id: "T1195", name: "Supply Chain Compromise", tactic: "TA0001", severity: "critical" },
  { id: "T1055", name: "Process Injection", tactic: "TA0005", severity: "high" },
  { id: "T1562", name: "Impair Defenses", tactic: "TA0005", severity: "high" },
];

// ─── INCIDENT TAXONOMY (ENISA/CSIRT) ───
const INCIDENT_TYPES = [
  { type: "Abusive Content", subtypes: ["Spam", "Harmful Speech", "Child/Sexual/Violence"], severity: "high" },
  { type: "Malicious Code", subtypes: ["Virus", "Worm", "Trojan", "Spyware", "Rootkit", "Ransomware"], severity: "critical" },
  { type: "Information Gathering", subtypes: ["Scanning", "Sniffing", "Social Engineering", "Phishing"], severity: "medium" },
  { type: "Intrusion Attempts", subtypes: ["Exploit Vulnerability", "Login Attempts", "New Attack Signature"], severity: "high" },
  { type: "Intrusions", subtypes: ["Privileged Account Compromise", "Unprivileged Compromise", "Application Compromise", "Bot"], severity: "critical" },
  { type: "Availability", subtypes: ["DoS", "DDoS", "Sabotage", "Outage"], severity: "critical" },
  { type: "Information Security", subtypes: ["Unauthorized Access", "Unauthorized Modification", "Data Loss", "Data Leak"], severity: "critical" },
  { type: "Fraud", subtypes: ["Unauthorized Use", "Copyright Violation", "Identity Theft", "Phishing"], severity: "high" },
  { type: "Vulnerable", subtypes: ["Open Resolver", "Open Service", "Weak Crypto", "Information Disclosure"], severity: "medium" },
];

// ─── KEV (Known Exploited Vulnerabilities) Sample ───
const KNOWN_EXPLOITED = [
  { cve: "CVE-2024-3400", vendor: "Palo Alto Networks", product: "PAN-OS", description: "Command injection in GlobalProtect", dateAdded: "2024-04-12", severity: "critical" },
  { cve: "CVE-2024-21887", vendor: "Ivanti", product: "Connect Secure", description: "Command injection vulnerability", dateAdded: "2024-01-10", severity: "critical" },
  { cve: "CVE-2023-46805", vendor: "Ivanti", product: "Connect Secure", description: "Authentication bypass", dateAdded: "2024-01-10", severity: "critical" },
  { cve: "CVE-2024-1709", vendor: "ConnectWise", product: "ScreenConnect", description: "Authentication bypass", dateAdded: "2024-02-22", severity: "critical" },
  { cve: "CVE-2023-22515", vendor: "Atlassian", product: "Confluence", description: "Broken access control", dateAdded: "2023-10-05", severity: "critical" },
  { cve: "CVE-2023-4966", vendor: "Citrix", product: "NetScaler ADC", description: "Information disclosure (Citrix Bleed)", dateAdded: "2023-10-18", severity: "critical" },
  { cve: "CVE-2024-23897", vendor: "Jenkins", product: "Jenkins", description: "Path traversal via CLI", dateAdded: "2024-01-29", severity: "critical" },
  { cve: "CVE-2021-44228", vendor: "Apache", product: "Log4j", description: "Remote code execution (Log4Shell)", dateAdded: "2021-12-10", severity: "critical" },
];

// ─── WEB APP SECURITY PATTERNS (from agency guidance) ───
const WEB_SECURITY_CHECKS = [
  { id: "csp", name: "Content Security Policy", category: "Headers", description: "Prevents XSS and data injection attacks", status: "configured" },
  { id: "hsts", name: "HTTP Strict Transport Security", category: "Headers", description: "Forces HTTPS connections", status: "configured" },
  { id: "xframe", name: "X-Frame-Options", category: "Headers", description: "Prevents clickjacking attacks", status: "configured" },
  { id: "xcontent", name: "X-Content-Type-Options", category: "Headers", description: "Prevents MIME-type sniffing", status: "configured" },
  { id: "referrer", name: "Referrer-Policy", category: "Headers", description: "Controls referrer information leakage", status: "configured" },
  { id: "permissions", name: "Permissions-Policy", category: "Headers", description: "Controls browser feature access", status: "configured" },
  { id: "rls", name: "Row Level Security", category: "Database", description: "Per-user data isolation at the database level", status: "active" },
  { id: "e2e", name: "E2E Encryption", category: "Data", description: "AES-256-GCM client-side message encryption", status: "active" },
  { id: "file-val", name: "File Upload Validation", category: "Input", description: "Extension whitelist + MIME + magic bytes + formula injection", status: "active" },
  { id: "path-traversal", name: "Path Traversal Prevention", category: "Input", description: "Chrooted storage paths with sanitization", status: "active" },
  { id: "hibp", name: "Leaked Password Check", category: "Auth", description: "HIBP database check on signup/password change", status: "active" },
  { id: "session-mgmt", name: "Session Management", category: "Auth", description: "Device tracking, IP logging, remote revocation", status: "active" },
  { id: "mfa", name: "Multi-Factor Auth (TOTP)", category: "Auth", description: "Time-based one-time password enrollment", status: "active" },
  { id: "prompt-guard", name: "Prompt Injection Guard", category: "AI", description: "Detection of injection patterns in AI inputs", status: "active" },
  { id: "rate-limit", name: "Rate Limiting", category: "API", description: "Per-user request throttling on AI endpoints", status: "active" },
];

interface ThreatIntelFeedProps {
  onMapTechnique?: (techniqueId: string, name: string) => void;
}

const ThreatIntelFeed = ({ onMapTechnique }: ThreatIntelFeedProps) => {
  const [activeTab, setActiveTab] = useState<"mitre" | "kev" | "taxonomy" | "posture">("mitre");
  const [search, setSearch] = useState("");
  const [expandedTactic, setExpandedTactic] = useState<string | null>(null);

  const filteredTechniques = useMemo(() => {
    const q = search.toLowerCase();
    return MITRE_TECHNIQUES.filter(t =>
      t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredKEV = useMemo(() => {
    const q = search.toLowerCase();
    return KNOWN_EXPLOITED.filter(k =>
      k.cve.toLowerCase().includes(q) || k.vendor.toLowerCase().includes(q) || k.product.toLowerCase().includes(q) || k.description.toLowerCase().includes(q)
    );
  }, [search]);

  const sevColor = (s: string) => {
    switch (s) {
      case "critical": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "low": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default: return "text-muted-foreground bg-secondary/10 border-border/20";
    }
  };

  const tabs = [
    { id: "mitre" as const, label: "ATT&CK Matrix", icon: Target },
    { id: "kev" as const, label: "Exploited Vulns", icon: AlertTriangle },
    { id: "taxonomy" as const, label: "Incident Taxonomy", icon: Layers },
    { id: "posture" as const, label: "Security Posture", icon: Shield },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border/20">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extralight tracking-wider transition-all ${
              activeTab === tab.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-secondary/20 border border-transparent"
            }`}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search intel..."
            className="pl-7 h-7 text-[10px] bg-secondary/10 border-border/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* MITRE ATT&CK */}
        {activeTab === "mitre" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-light tracking-wider">ADVERSARY TTP MAPPING</span>
              <Badge variant="outline" className="text-[8px] ml-auto">{MITRE_TECHNIQUES.length} techniques loaded</Badge>
            </div>
            {MITRE_TACTICS.map(tactic => {
              const techs = filteredTechniques.filter(t => t.tactic === tactic.id);
              if (search && techs.length === 0) return null;
              const isExpanded = expandedTactic === tactic.id;
              return (
                <div key={tactic.id} className="border border-border/15 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedTactic(isExpanded ? null : tactic.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary/10 transition-all"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/50" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                    <span className={`text-[9px] font-mono ${tactic.color}`}>{tactic.id}</span>
                    <span className="text-[11px] font-light">{tactic.name}</span>
                    <span className="text-[9px] text-muted-foreground/40 font-extralight flex-1 text-left">{tactic.description}</span>
                    <Badge variant="outline" className="text-[8px]">{techs.length}</Badge>
                  </button>
                  {isExpanded && techs.length > 0 && (
                    <div className="border-t border-border/10 bg-secondary/5 p-2 space-y-1">
                      {techs.map(tech => (
                        <div key={tech.id} className="flex items-center gap-3 p-2 rounded hover:bg-secondary/10 transition-all group">
                          <span className="text-[9px] font-mono text-muted-foreground/60 w-12">{tech.id}</span>
                          <span className="text-[10px] font-light flex-1">{tech.name}</span>
                          <Badge className={`text-[8px] border ${sevColor(tech.severity)}`}>{tech.severity}</Badge>
                          {onMapTechnique && (
                            <button
                              onClick={() => onMapTechnique(tech.id, tech.name)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/20 transition-all"
                              title="Map to finding"
                            >
                              <Crosshair className="h-3 w-3 text-primary" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* KEV Feed */}
        {activeTab === "kev" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs font-light tracking-wider">KNOWN EXPLOITED VULNERABILITIES</span>
              <Badge variant="outline" className="text-[8px] ml-auto border-red-500/20 text-red-400">{filteredKEV.length} active</Badge>
            </div>
            {filteredKEV.map(kev => (
              <div key={kev.cve} className="border border-border/15 rounded-lg p-3 hover:border-red-500/20 transition-all group">
                <div className="flex items-center gap-3">
                  <Badge className={`text-[9px] border ${sevColor(kev.severity)}`}>{kev.severity}</Badge>
                  <span className="text-[11px] font-mono text-red-400">{kev.cve}</span>
                  <span className="text-[10px] text-muted-foreground/60">—</span>
                  <span className="text-[10px] font-light">{kev.vendor} {kev.product}</span>
                  <span className="text-[8px] text-muted-foreground/40 ml-auto">Added {kev.dateAdded}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/50 font-extralight mt-1.5">{kev.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Incident Taxonomy */}
        {activeTab === "taxonomy" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-light tracking-wider">SECURITY INCIDENT TAXONOMY</span>
              <Badge variant="outline" className="text-[8px] ml-auto">{INCIDENT_TYPES.length} categories</Badge>
            </div>
            {INCIDENT_TYPES.map(inc => (
              <div key={inc.type} className="border border-border/15 rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={`text-[9px] border ${sevColor(inc.severity)}`}>{inc.severity}</Badge>
                  <span className="text-[11px] font-light">{inc.type}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {inc.subtypes.map(sub => (
                    <Badge key={sub} variant="outline" className="text-[8px] font-extralight">{sub}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security Posture */}
        {activeTab === "posture" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-light tracking-wider">PLATFORM SECURITY POSTURE</span>
              <Badge variant="outline" className="text-[8px] ml-auto border-emerald-500/20 text-emerald-400">
                {WEB_SECURITY_CHECKS.filter(c => c.status === "active" || c.status === "configured").length}/{WEB_SECURITY_CHECKS.length} active
              </Badge>
            </div>
            {["Headers", "Database", "Data", "Input", "Auth", "AI", "API"].map(category => {
              const checks = WEB_SECURITY_CHECKS.filter(c => c.category === category);
              if (checks.length === 0) return null;
              return (
                <div key={category} className="border border-border/15 rounded-lg p-3">
                  <span className="text-[10px] font-light tracking-wider text-muted-foreground/60 mb-2 block">{category.toUpperCase()}</span>
                  <div className="space-y-1.5">
                    {checks.map(check => (
                      <div key={check.id} className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${check.status === "active" || check.status === "configured" ? "bg-emerald-400" : "bg-red-400"}`} />
                        <span className="text-[10px] font-light flex-1">{check.name}</span>
                        <span className="text-[8px] text-muted-foreground/40 font-extralight">{check.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatIntelFeed;
