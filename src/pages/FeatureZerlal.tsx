import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Shield, Bug, Network, Eye, GitBranch, FileSearch, Activity, Database, Lock } from "lucide-react";

const FeatureZerlal = () => (
  <FeaturePageShell
    documentTitle="Zerlal — Cyber Intelligence Engine | Aureon"
    eyebrow="Cyber Intelligence"
    headline={<>Vulnerability Intelligence<br /><span className="text-muted-foreground">at Forensic Depth.</span></>}
    subheadline="Zerlal is a Pro-tier vulnerability intelligence platform. Multi-pass scanning, domain reconnaissance, exploit dossiers, sigma rules, STIX/TAXII feeds, and 19 device security audits — all in one operations console."
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: Bug, title: "Multi-Pass Scanning", description: "If a first pass returns fewer than 30 findings, Zerlal triggers a deep-dive automatically. No silent misses." },
      { icon: Network, title: "Domain Reconnaissance", description: "ELION/ZOHAR engine analyzes domain links across DNS, TLS, App, headers, content, and 7 more modules." },
      { icon: Shield, title: "Device Security Audits", description: "19 real-time browser-based audits across system, network, identity, and behavioral surfaces." },
      { icon: Eye, title: "Exploit Intelligence", description: "Adversarial dossiers with live takedown analysis and blast-radius modeling." },
      { icon: GitBranch, title: "Sigma Rule Engine", description: "Author and tune Sigma detection rules; ingest STIX/TAXII threat feeds and correlate with logs." },
      { icon: FileSearch, title: "Code Vulnerability Scanner", description: "Static analysis with chained-flow tracing, suggested fix diffs, and CWE/CVE compliance mapping." },
      { icon: Activity, title: "Cert Transparency Monitor", description: "Watch certificate transparency logs for newly issued certs across your watched domains." },
      { icon: Database, title: "Log Correlation", description: "Cross-source log correlation engine surfaces anomalies humans miss." },
      { icon: Lock, title: "Tor & WHOIS Intelligence", description: "Tor exit-node checks, WHOIS timeline reconstruction, and port scanner UI." },
    ]}
    useCases={[
      "Continuous vulnerability monitoring of production codebases and infrastructure",
      "Forensic-grade domain investigations across DNS, TLS, and content surfaces",
      "Red team operations with exploit dossier generation",
      "Compliance mapping (CWE, CVE, MITRE ATT&CK) for executive reporting",
      "Threat intelligence ingestion via STIX/TAXII with custom Sigma rules",
      "Pre-deployment security audits across 19 device surfaces",
    ]}
    ctaTitle="See Every Weakness Before They Do."
    ctaSubtitle="Zerlal is included in Aureon Pro ($740/mo)."
  />
);

export default FeatureZerlal;
