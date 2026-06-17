import { useState } from "react";
import {
  Shield, Bell, Activity, Search, Network, FolderArchive, Briefcase, Server,
  FileSearch, Cpu, Settings as SettingsIcon, Download, Database, Radar,
  ScrollText, Layers, Eye, Globe, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";

type ZaxinScreen =
  | "overview" | "alerts" | "hunt" | "pcap" | "cases" | "grid" | "detections"
  | "zeek" | "endpoint" | "dashboards" | "downloads" | "config";

const NAV: { id: ZaxinScreen; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Shield },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "hunt", label: "Hunt", icon: Search },
  { id: "pcap", label: "PCAP", icon: Network },
  { id: "cases", label: "Cases", icon: Briefcase },
  { id: "grid", label: "Grid Nodes", icon: Server },
  { id: "detections", label: "Detection Rules", icon: Radar },
  { id: "zeek", label: "Zeek Logs", icon: ScrollText },
  { id: "endpoint", label: "Endpoint (Wazuh)", icon: Cpu },
  { id: "dashboards", label: "Dashboards", icon: Activity },
  { id: "downloads", label: "ISO & Keys", icon: Download },
  { id: "config", label: "Configuration", icon: SettingsIcon },
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

const OverviewScreen = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-3">
      <Stat label="Open Alerts" value="247" sub="+12 last hour" icon={Bell} tone="alert" />
      <Stat label="PCAP Captured" value="14.2 TB" sub="rolling 7d" icon={Network} />
      <Stat label="Grid Nodes" value="6 / 6" sub="all healthy" icon={Server} tone="ok" />
      <Stat label="Active Cases" value="9" sub="3 escalated" icon={Briefcase} />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <Panel title="Detection Engines">
        {[
          { name: "Suricata", v: "7.0.7", ok: true },
          { name: "Zeek", v: "6.0.4", ok: true },
          { name: "Stenographer", v: "1.0.1", ok: true },
          { name: "Wazuh Manager", v: "4.7.2", ok: true },
          { name: "Strelka", v: "0.24.04", ok: false },
        ].map(e => (
          <div key={e.name} className="flex items-center justify-between py-1.5 text-[10px]">
            <span className="text-foreground/70">{e.name} <span className="text-muted-foreground/40">{e.v}</span></span>
            {e.ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400/70" /> : <AlertTriangle className="h-3 w-3 text-yellow-400/70" />}
          </div>
        ))}
      </Panel>
      <Panel title="Top Source IPs">
        {[["185.220.101.47","TOR Exit","58"],["45.142.214.219","Scanner","41"],["103.97.177.21","C2 Suspected","27"],["94.156.71.205","Bruteforce","19"],["62.197.136.18","Recon","11"]].map(r => (
          <div key={r[0]} className="grid grid-cols-3 py-1.5 text-[10px] gap-2">
            <span className="text-foreground/80 font-mono">{r[0]}</span>
            <span className="text-muted-foreground/50">{r[1]}</span>
            <span className="text-right text-foreground/60">{r[2]}</span>
          </div>
        ))}
      </Panel>
      <Panel title="MITRE ATT&CK Coverage">
        {[["Initial Access","82%"],["Execution","91%"],["Persistence","74%"],["C2","88%"],["Exfiltration","69%"]].map(r => (
          <div key={r[0]} className="py-1.5">
            <div className="flex justify-between text-[10px] text-foreground/70 mb-1">
              <span>{r[0]}</span><span className="text-muted-foreground/50">{r[1]}</span>
            </div>
            <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
              <div className="h-full bg-foreground/40" style={{ width: r[1] }} />
            </div>
          </div>
        ))}
      </Panel>
    </div>
  </div>
);

const AlertsScreen = () => (
  <Panel title="NIDS Alerts" desc="Live Suricata + Zeek notice stream">
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
      <div className="col-span-1">Sev</div>
      <div className="col-span-4">Signature</div>
      <div className="col-span-2">Source</div>
      <div className="col-span-2">Dest</div>
      <div className="col-span-2">Engine</div>
      <div className="col-span-2">Time</div>
    </div>
    {[
      { sig: "ET MALWARE Cobalt Strike Beacon", src: "10.0.4.21", dst: "185.220.101.47:443", eng: "Suricata", t: "12s ago", tone: "critical" as const },
      { sig: "ET POLICY DNS Query to .onion", src: "10.0.2.88", dst: "1.1.1.1", eng: "Suricata", t: "41s ago", tone: "high" as const },
      { sig: "Zeek SSL::Invalid_Server_Cert", src: "10.0.7.10", dst: "94.156.71.205", eng: "Zeek", t: "1m ago", tone: "med" as const },
      { sig: "ET SCAN Nmap -sS Window 1024", src: "45.142.214.219", dst: "10.0.0.0/24", eng: "Suricata", t: "2m ago", tone: "med" as const },
      { sig: "Wazuh: SSH brute force attack", src: "62.197.136.18", dst: "10.0.1.5", eng: "Wazuh", t: "3m ago", tone: "high" as const },
      { sig: "ET INFO Suspicious User-Agent (curl)", src: "10.0.4.99", dst: "203.0.113.5", eng: "Suricata", t: "5m ago", tone: "low" as const },
    ].map((a, i) => (
      <Row key={i} tone={a.tone} cells={[a.sig, a.src, a.dst, a.eng, a.t]} />
    ))}
  </Panel>
);

const HuntScreen = () => {
  const [q, setQ] = useState('event.dataset:"suricata.alert" AND destination.port:443');
  return (
    <div className="space-y-3">
      <Panel title="Threat Hunt Query" desc="Lucene-style — runs across Suricata/Zeek/Wazuh indices">
        <textarea
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full h-24 bg-background/40 border border-border/[0.08] rounded-md p-3 text-[11px] font-mono text-foreground/80 focus:outline-none focus:border-foreground/20 resize-none"
        />
        <div className="flex gap-2 mt-2">
          <button className="px-3 py-1.5 text-[10px] rounded-md bg-foreground/[0.08] text-foreground/80 hover:bg-foreground/[0.12]">Run Hunt</button>
          <button className="px-3 py-1.5 text-[10px] rounded-md bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08]">Save Query</button>
          <button className="px-3 py-1.5 text-[10px] rounded-md bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08]">Pivot to PCAP</button>
        </div>
      </Panel>
      <Panel title="Hunt Results" desc="Aggregated by destination.ip">
        {[["185.220.101.47",1284,"TOR exit"],["94.156.71.205",841,"Suspected C2"],["45.142.214.219",612,"Scanner"],["203.0.113.5",344,"Unknown"]].map(r => (
          <div key={r[0] as string} className="grid grid-cols-12 py-2 text-[10px] gap-2 border-b border-border/[0.04]">
            <div className="col-span-4 font-mono text-foreground/80">{r[0]}</div>
            <div className="col-span-2 text-right text-foreground/60">{r[1]}</div>
            <div className="col-span-6 text-muted-foreground/50">{r[2]}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
};

const PcapScreen = () => (
  <div className="grid grid-cols-3 gap-3">
    <div className="col-span-2">
      <Panel title="Full Packet Capture" desc="Stenographer indexed flows — pivot to download .pcap">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
          <div className="col-span-3">Flow ID</div>
          <div className="col-span-3">Source → Dest</div>
          <div className="col-span-2">Proto</div>
          <div className="col-span-2">Bytes</div>
          <div className="col-span-2">Duration</div>
        </div>
        {[
          ["F-8821a", "10.0.4.21 → 185.220.101.47:443", "TLS", "1.4 MB", "00:04:12"],
          ["F-8821b", "10.0.2.88 → 1.1.1.1:53", "DNS", "2.1 KB", "00:00:01"],
          ["F-8821c", "10.0.7.10 → 94.156.71.205:8443", "TLS", "847 KB", "00:02:30"],
          ["F-8821d", "45.142.214.219 → 10.0.0.0/24", "TCP-SYN", "12 KB", "00:00:18"],
        ].map(r => (
          <Row key={r[0]} cells={r} />
        ))}
      </Panel>
    </div>
    <Panel title="Storage">
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[10px] mb-1"><span className="text-foreground/70">PCAP Disk</span><span className="text-muted-foreground/50">14.2 / 32 TB</span></div>
          <div className="h-1 rounded-full bg-foreground/[0.04]"><div className="h-full bg-foreground/40" style={{ width: "44%" }} /></div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1"><span className="text-foreground/70">Elastic Hot</span><span className="text-muted-foreground/50">3.1 / 5 TB</span></div>
          <div className="h-1 rounded-full bg-foreground/[0.04]"><div className="h-full bg-foreground/40" style={{ width: "62%" }} /></div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1"><span className="text-foreground/70">Retention</span><span className="text-muted-foreground/50">28 days</span></div>
          <div className="h-1 rounded-full bg-foreground/[0.04]"><div className="h-full bg-foreground/40" style={{ width: "75%" }} /></div>
        </div>
      </div>
    </Panel>
  </div>
);

const CasesScreen = () => (
  <Panel title="Investigation Cases" desc="TheHive-compatible — multi-analyst collaboration">
    {[
      { id: "C-2026-018", title: "Possible Cobalt Strike beacon — workstation WS-21", own: "asher", st: "investigating", sev: "critical" as const },
      { id: "C-2026-017", title: "DNS exfiltration suspected on subnet 10.0.2.0/24", own: "kira", st: "triage", sev: "high" as const },
      { id: "C-2026-016", title: "Wazuh: privilege escalation on DB-PROD-03", own: "asher", st: "containment", sev: "critical" as const },
      { id: "C-2026-015", title: "Repeated nmap scans from 45.142.214.219", own: "unassigned", st: "open", sev: "med" as const },
      { id: "C-2026-014", title: "SSH brute force closed — 14 IPs blocked", own: "kira", st: "closed", sev: "low" as const },
    ].map(c => (
      <Row key={c.id} tone={c.sev} cells={[`${c.id} — ${c.title}`, c.own, c.st, "", ""]} />
    ))}
  </Panel>
);

const GridScreen = () => (
  <div className="grid grid-cols-3 gap-3">
    {[
      { name: "so-mgr-01", role: "Manager", cpu: 22, mem: 41, status: "healthy" },
      { name: "so-search-01", role: "Search Node", cpu: 64, mem: 78, status: "healthy" },
      { name: "so-search-02", role: "Search Node", cpu: 58, mem: 71, status: "healthy" },
      { name: "so-sensor-01", role: "Forward Sensor", cpu: 81, mem: 62, status: "healthy" },
      { name: "so-sensor-02", role: "Forward Sensor", cpu: 47, mem: 55, status: "healthy" },
      { name: "so-heavy-01", role: "Heavy Node", cpu: 33, mem: 49, status: "healthy" },
    ].map(n => (
      <div key={n.name} className="rounded-lg border border-border/[0.06] bg-foreground/[0.015] p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] text-foreground/90 font-mono">{n.name}</div>
            <div className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">{n.role}</div>
          </div>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" />
        </div>
        {[["CPU", n.cpu], ["MEM", n.mem]].map(([l, v]) => (
          <div key={l} className="mb-2">
            <div className="flex justify-between text-[9px] text-muted-foreground/50 mb-1"><span>{l}</span><span>{v}%</span></div>
            <div className="h-1 bg-foreground/[0.04] rounded-full"><div className="h-full bg-foreground/40 rounded-full" style={{ width: `${v}%` }} /></div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

const DetectionsScreen = () => (
  <Panel title="Detection Rules" desc="Suricata + Sigma + YARA — push to grid">
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
      <div className="col-span-1">St</div>
      <div className="col-span-4">Rule</div>
      <div className="col-span-2">Type</div>
      <div className="col-span-2">SID</div>
      <div className="col-span-2">Hits 24h</div>
      <div className="col-span-1">Sev</div>
    </div>
    {[
      ["ET MALWARE Cobalt Strike Beacon", "Suricata", "2025643", "84", "crit"],
      ["Sigma: Suspicious PowerShell EncodedCommand", "Sigma", "win-ps-001", "31", "high"],
      ["YARA: Mimikatz string match", "YARA", "yr-mimi-2", "4", "crit"],
      ["ET POLICY DNS Query to .onion", "Suricata", "2027865", "112", "med"],
      ["Sigma: New service installed via sc.exe", "Sigma", "win-svc-014", "7", "high"],
    ].map((r, i) => (
      <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] text-[10px] text-foreground/70 hover:bg-foreground/[0.02]">
        <div className="col-span-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /></div>
        <div className="col-span-4 truncate">{r[0]}</div>
        <div className="col-span-2 text-muted-foreground/60">{r[1]}</div>
        <div className="col-span-2 font-mono text-muted-foreground/50">{r[2]}</div>
        <div className="col-span-2">{r[3]}</div>
        <div className="col-span-1 text-foreground/60 uppercase text-[9px]">{r[4]}</div>
      </div>
    ))}
  </Panel>
);

const ZeekScreen = () => (
  <div className="grid grid-cols-2 gap-3">
    {[
      { log: "conn.log", rows: "2.1M", desc: "Connection summaries" },
      { log: "dns.log", rows: "418k", desc: "DNS queries & answers" },
      { log: "http.log", rows: "84k", desc: "HTTP transactions" },
      { log: "ssl.log", rows: "612k", desc: "TLS handshakes" },
      { log: "files.log", rows: "31k", desc: "Files seen on wire" },
      { log: "notice.log", rows: "1.2k", desc: "Suspicious notices" },
      { log: "x509.log", rows: "59k", desc: "Certificate metadata" },
      { log: "weird.log", rows: "412", desc: "Protocol anomalies" },
    ].map(l => (
      <div key={l.log} className="rounded-lg border border-border/[0.06] bg-foreground/[0.015] p-4 backdrop-blur-md flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono text-foreground/85">{l.log}</div>
          <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">{l.desc}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-extralight text-foreground/80">{l.rows}</div>
          <div className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">rows</div>
        </div>
      </div>
    ))}
  </div>
);

const EndpointScreen = () => (
  <Panel title="Wazuh Endpoint Agents">
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.08] text-[9px] uppercase tracking-wider text-muted-foreground/50">
      <div className="col-span-1">St</div>
      <div className="col-span-3">Host</div>
      <div className="col-span-2">OS</div>
      <div className="col-span-2">Version</div>
      <div className="col-span-2">Last Seen</div>
      <div className="col-span-2">FIM</div>
    </div>
    {[
      ["WS-21-DESIGN", "Win 11 24H2", "4.7.2", "3s", "ok"],
      ["WS-08-FIN", "Win 11 23H2", "4.7.2", "12s", "ok"],
      ["DB-PROD-03", "Ubuntu 22.04", "4.7.2", "5s", "alerts"],
      ["WEB-EDGE-01", "Debian 12", "4.7.2", "8s", "ok"],
      ["MAC-LAPTOP-44", "macOS 15.2", "4.7.2", "2m", "ok"],
    ].map((r, i) => (
      <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/[0.04] text-[10px] text-foreground/70 hover:bg-foreground/[0.02]">
        <div className="col-span-1"><span className={`w-1.5 h-1.5 rounded-full inline-block ${r[4] === "alerts" ? "bg-orange-400" : "bg-emerald-400"}`} /></div>
        <div className="col-span-3 font-mono">{r[0]}</div>
        <div className="col-span-2 text-muted-foreground/60">{r[1]}</div>
        <div className="col-span-2 text-muted-foreground/50 font-mono">{r[2]}</div>
        <div className="col-span-2">{r[3]}</div>
        <div className="col-span-2 uppercase text-[9px] text-foreground/60">{r[4]}</div>
      </div>
    ))}
  </Panel>
);

const DashboardsScreen = () => (
  <div className="grid grid-cols-3 gap-3">
    {[
      ["Alerts Overview", "Real-time NIDS/HIDS summary"],
      ["Network Traffic", "Bandwidth, protocols, top talkers"],
      ["DNS Anomalies", "Tunnels, DGAs, unusual TLDs"],
      ["TLS Inspector", "Self-signed, weak ciphers, JA3"],
      ["File Forensics", "MIME, magic bytes, YARA hits"],
      ["MITRE Coverage", "Technique mapping across logs"],
    ].map(d => (
      <div key={d[0]} className="rounded-lg border border-border/[0.06] bg-foreground/[0.015] p-4 backdrop-blur-md hover:bg-foreground/[0.03] transition-colors cursor-pointer">
        <Activity className="h-4 w-4 text-foreground/50 mb-3" />
        <div className="text-[11px] text-foreground/85">{d[0]}</div>
        <div className="text-[9px] text-muted-foreground/40 mt-1 uppercase tracking-wider">{d[1]}</div>
      </div>
    ))}
  </div>
);

const DownloadsScreen = () => (
  <div className="space-y-3">
    <Panel title="Security Onion ISO" desc="Official build — verified signatures">
      <div className="space-y-2 text-[10px]">
        {[
          ["securityonion-2.4.140-20250307.iso", "12.4 GB", "SHA-256 verified"],
          ["securityonion-2.4.130-20250115.iso", "12.1 GB", "SHA-256 verified"],
          ["securityonion-2.4.120-20241201.iso", "11.9 GB", "SHA-256 verified"],
        ].map(r => (
          <div key={r[0]} className="flex items-center justify-between border-b border-border/[0.04] py-2">
            <div>
              <div className="text-foreground/85 font-mono">{r[0]}</div>
              <div className="text-muted-foreground/40 text-[9px] mt-0.5">{r[2]}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground/50">{r[1]}</span>
              <button className="px-2.5 py-1 rounded-md bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.1]">Download</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
    <Panel title="GPG Signing Keys" desc="Verify ISO authenticity before flashing">
      <pre className="text-[9px] font-mono text-foreground/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`pub   rsa4096 2024-03-14 [SC]
      A1B2 C3D4 E5F6 7890 1234  5678 9ABC DEF0 1234 5678
uid   Security Onion Solutions <signing@securityonionsolutions.com>
sub   rsa4096 2024-03-14 [E]`}
      </pre>
    </Panel>
  </div>
);

const ConfigScreen = () => (
  <div className="grid grid-cols-2 gap-3">
    <Panel title="Sensor Interfaces">
      {[["eth0","mgmt","10.0.0.10/24"],["eth1","monitor","promisc"],["eth2","monitor","promisc"]].map(r => (
        <div key={r[0]} className="grid grid-cols-3 py-2 text-[10px] border-b border-border/[0.04]">
          <span className="font-mono text-foreground/80">{r[0]}</span>
          <span className="text-muted-foreground/60 uppercase tracking-wider text-[9px]">{r[1]}</span>
          <span className="font-mono text-muted-foreground/50 text-right">{r[2]}</span>
        </div>
      ))}
    </Panel>
    <Panel title="Ruleset Sources">
      {[["ET Open","enabled","daily"],["ET Pro","disabled","—"],["Snort Community","enabled","weekly"],["Custom Local","enabled","manual"]].map(r => (
        <div key={r[0]} className="grid grid-cols-3 py-2 text-[10px] border-b border-border/[0.04]">
          <span className="text-foreground/80">{r[0]}</span>
          <span className={`uppercase tracking-wider text-[9px] ${r[1] === "enabled" ? "text-emerald-400/70" : "text-muted-foreground/40"}`}>{r[1]}</span>
          <span className="text-muted-foreground/50 text-right uppercase text-[9px]">{r[2]}</span>
        </div>
      ))}
    </Panel>
    <Panel title="Retention Policies">
      <div className="text-[10px] text-foreground/70 space-y-2">
        <div className="flex justify-between"><span>Suricata alerts</span><span className="text-muted-foreground/50">365 days</span></div>
        <div className="flex justify-between"><span>Zeek logs</span><span className="text-muted-foreground/50">90 days</span></div>
        <div className="flex justify-between"><span>Full PCAP</span><span className="text-muted-foreground/50">30 days</span></div>
        <div className="flex justify-between"><span>Wazuh events</span><span className="text-muted-foreground/50">180 days</span></div>
      </div>
    </Panel>
    <Panel title="Integrations">
      {[["MISP","threat sharing","connected"],["TheHive","case mgmt","connected"],["Cortex","enrichment","disconnected"],["VirusTotal","intel API","connected"]].map(r => (
        <div key={r[0]} className="grid grid-cols-3 py-2 text-[10px] border-b border-border/[0.04]">
          <span className="text-foreground/80">{r[0]}</span>
          <span className="text-muted-foreground/50 uppercase tracking-wider text-[9px]">{r[1]}</span>
          <span className={`text-right uppercase text-[9px] ${r[2] === "connected" ? "text-emerald-400/70" : "text-muted-foreground/40"}`}>{r[2]}</span>
        </div>
      ))}
    </Panel>
  </div>
);

const ZaxinView = () => {
  const [screen, setScreen] = useState<ZaxinScreen>("overview");

  const render = () => {
    switch (screen) {
      case "overview": return <OverviewScreen />;
      case "alerts": return <AlertsScreen />;
      case "hunt": return <HuntScreen />;
      case "pcap": return <PcapScreen />;
      case "cases": return <CasesScreen />;
      case "grid": return <GridScreen />;
      case "detections": return <DetectionsScreen />;
      case "zeek": return <ZeekScreen />;
      case "endpoint": return <EndpointScreen />;
      case "dashboards": return <DashboardsScreen />;
      case "downloads": return <DownloadsScreen />;
      case "config": return <ConfigScreen />;
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/[0.06] border border-emerald-500/[0.12]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400/80 uppercase tracking-wider">Grid Online</span>
          </div>
          <button className="p-2 rounded-lg hover:bg-foreground/[0.03] transition-colors">
            <Bell className="h-3.5 w-3.5 text-muted-foreground/40" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left nav */}
        <div className="w-52 shrink-0 border-r border-border/[0.06] bg-background/60 backdrop-blur-md py-3 px-2 overflow-y-auto">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] tracking-wide transition-all mb-0.5 ${
                screen === item.id
                  ? "bg-foreground/[0.06] text-foreground/90"
                  : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.02]"
              }`}
            >
              <item.icon className="h-3 w-3" />
              <span>{item.label}</span>
            </button>
          ))}
          <div className="px-3 py-2 mt-3 border-t border-border/[0.06]">
            <div className="text-[8px] text-muted-foreground/20 tracking-wider uppercase text-center">Powered by AUREON</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{render()}</div>
      </div>
    </div>
  );
};

export default ZaxinView;
