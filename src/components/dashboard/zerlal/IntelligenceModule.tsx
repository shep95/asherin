import { Landmark, Package, Atom, Brain, Lock, Cpu, Siren, Crosshair, Scale, Server, GraduationCap } from "lucide-react";
import type { ZerlalScreen } from "./types";

interface IntelligenceModuleProps {
  screen: ZerlalScreen;
}

const moduleData: Record<string, { title: string; subtitle: string; icon: React.ElementType; features: { name: string; desc: string; status: "active" | "coming" }[] }> = {
  compliance: {
    title: "Regulatory Compliance Automation",
    subtitle: "Auto-map findings to CMMC 2.0, NIST SP 800-171/172, FedRAMP, DORA, NIS2, ISO 27001, SOC 2, PCI DSS, HIPAA, SEC, and False Claims Act Shield",
    icon: Landmark,
    features: [
      { name: "CMMC 2.0 Continuous Compliance Engine", desc: "Auto-maps findings to CMMC Level 1-3 controls, generates POA&M documents, tracks remediation against deadlines, maintains SPRS-ready reporting", status: "active" },
      { name: "NIST SP 800-171/172 Live Gap Tracker", desc: "Ingests every NIST publication update and surfaces which systems are non-compliant the day a new standard drops", status: "active" },
      { name: "Multi-Framework Simultaneous Mapping", desc: "Single findings mapped in real-time to CMMC, NIST CSF 2.0, FISMA, FedRAMP, DORA, NIS2, EU CRA, ISO 27001, SOC 2, PCI DSS, HIPAA, SWIFT CSP, SEC rules", status: "active" },
      { name: "False Claims Act Shield Module", desc: "Cryptographically signed, timestamped compliance attestation records that serve as legal evidence for DOJ FCA defense", status: "active" },
      { name: "Regulatory Change Alerting", desc: "Auto-monitors Federal Register, NIST, CISA, EU Official Journal, DoD DFARS — surfaces affected environments overnight", status: "active" },
    ],
  },
  "supply-chain": {
    title: "Supply Chain Intelligence",
    subtitle: "SBOM generation, foreign adversary detection, dependency propagation mapping, vendor risk scoring",
    icon: Package,
    features: [
      { name: "SBOM Generator & Analyzer", desc: "Auto-generate CycloneDX and SPDX SBOMs. Analyze vendor SBOMs for prohibited-country components and undisclosed origins", status: "active" },
      { name: "Foreign Adversary Component Detection", desc: "Cross-references dependencies against corporate ownership databases to detect components controlled by NDAA-prohibited entities", status: "active" },
      { name: "Dependency Chain Vulnerability Propagation", desc: "Maps every package importing a vulnerable library, every service calling those packages — generates blast radius visualization", status: "active" },
      { name: "Third-Party Vendor Risk Scanning", desc: "Pulls vendor SBOMs and security attestations, maintains live vendor risk score that updates when vendor pushes new code", status: "coming" },
      { name: "Transitive Dependency Time-Bomb Detection", desc: "Detects dependencies with scheduled EOL dates, maintainer abandonment signals, or declining commit activity", status: "active" },
    ],
  },
  quantum: {
    title: "Post-Quantum Cryptography Readiness",
    subtitle: "Cryptographic inventory, quantum vulnerability assessment, PQC migration roadmap, harvest-now-decrypt-later risk scoring",
    icon: Atom,
    features: [
      { name: "Cryptographic Inventory Scanner", desc: "Identifies every cryptographic primitive: algorithm, key length, library, version — complete crypto asset register", status: "active" },
      { name: "Quantum Vulnerability Assessment", desc: "Classifies crypto usage as Quantum-Safe, Quantum-Vulnerable, or Unknown — prioritized by data sensitivity", status: "active" },
      { name: "PQC Migration Roadmap Generator", desc: "Phased migration plan: which systems first, which NIST-approved PQC algorithms to adopt, estimated effort", status: "active" },
      { name: "Harvest-Now-Decrypt-Later Risk Scoring", desc: "Identifies data adversaries could harvest today to decrypt once quantum computers mature — assigns urgency scores", status: "active" },
    ],
  },
  "ai-security": {
    title: "AI System Security",
    subtitle: "Model scanning, prompt injection analysis, agent behavior auditing, training data lineage, shadow AI discovery",
    icon: Brain,
    features: [
      { name: "AI Model Security Scanning", desc: "Scans ONNX, PyTorch, TensorFlow, HuggingFace models for serialization exploits, embedded payloads, poisoning indicators", status: "active" },
      { name: "Prompt Injection Surface Analysis", desc: "Identifies injection vectors where attacker-controlled content could override system instructions or exfiltrate data", status: "active" },
      { name: "AI Agent Behavior Auditing", desc: "Monitors agent action logs, flags anomalous tool invocations, detects privilege escalation attempts by agents", status: "active" },
      { name: "Training Data Lineage Scanner", desc: "Flags PII, copyrighted material, data from prohibited jurisdictions, and data poisoning patterns in training datasets", status: "coming" },
      { name: "Shadow AI Discovery", desc: "Scans repositories for API calls to unauthorized AI services, credentials for unapproved AI platforms", status: "active" },
      { name: "OWASP Top 10 for LLMs", desc: "Prompt injection, insecure output handling, training data poisoning, model DoS, supply chain, sensitive disclosure, excessive agency", status: "active" },
    ],
  },
  "zero-trust": {
    title: "Zero-Trust Architecture Validation",
    subtitle: "Gap analysis against DoD ZTA and CISA ZTMM, identity audit, machine identity inventory, lateral movement path analysis",
    icon: Lock,
    features: [
      { name: "Zero-Trust Gap Analysis", desc: "Scans against DoD Zero Trust Reference Architecture and CISA Zero Trust Maturity Model for implicit trust, missing mTLS, overprivileged accounts", status: "active" },
      { name: "Identity & Access Control Audit", desc: "Hardcoded credentials, overpermissioned IAM roles, missing least privilege, JWT handling, OAuth misconfig, API auth bypasses", status: "active" },
      { name: "Machine Identity Inventory", desc: "Discovers every non-human identity: service accounts, API keys, certificates, tokens — maps permissions and flags excessive access", status: "active" },
      { name: "Lateral Movement Path Analysis", desc: "Identifies paths an attacker could use post-access, visualizes as attack graphs, prioritizes highest-value chokepoints", status: "coming" },
    ],
  },
  "ot-ics": {
    title: "Operational Technology & Critical Infrastructure",
    subtitle: "OT/ICS protocol analysis, firmware binary analysis, IT/OT convergence risk mapping, legacy system assessment",
    icon: Cpu,
    features: [
      { name: "OT/ICS Protocol Analysis", desc: "Analyzes Modbus, DNP3, IEC 61850, PROFINET, BACnet, OPC-UA for authentication gaps, unencrypted channels, hardcoded credentials", status: "active" },
      { name: "Firmware Binary Analysis", desc: "Decompiles firmware from embedded devices without source code — identifies hardcoded credentials, insecure boot, undocumented services", status: "active" },
      { name: "IT/OT Convergence Risk Mapping", desc: "Maps pathways between IT and OT environments, identifies cross-domain attack chains", status: "coming" },
      { name: "Legacy System Vulnerability Assessment", desc: "Specialized analysis for COBOL, Fortran, Ada and other legacy languages running government mainframes", status: "coming" },
      { name: "IoT Cyber Trust Mark Compliance", desc: "Scans IoT software and generates Cyber Trust Mark compliance reports automatically per Executive Order requirements", status: "active" },
    ],
  },
  incident: {
    title: "Incident Response Intelligence",
    subtitle: "Pre-incident forensic baseline, automated root cause analysis, patch window intelligence, MTTR analytics",
    icon: Siren,
    features: [
      { name: "Pre-Incident Forensic Baseline", desc: "Complete forensic baseline: dependency graph, cryptographic inventory, service map, known-good binary hashes — instant comparison during incidents", status: "active" },
      { name: "Automated Root Cause Analysis", desc: "Correlates attack vectors against findings database — answers 'Was this flagged? Was it remediated?' for regulatory reporting", status: "active" },
      { name: "Patch Window Intelligence", desc: "Tracks findings with public PoC code, estimates exploitability timelines, generates urgent remediation windows with business-impact context", status: "active" },
      { name: "Mean Time to Remediation Analytics", desc: "Tracks every finding from discovery to close — surfaces slowest teams, longest vulnerability classes, bottlenecks in patch cycle", status: "active" },
    ],
  },
  "threat-intel": {
    title: "Nation-State Threat Intelligence",
    subtitle: "MITRE ATT&CK mapping, STIX/TAXII feed integration, foreign adversary code signatures, sector-specific threat profiles",
    icon: Crosshair,
    features: [
      { name: "Threat Actor TTP Mapping", desc: "Maps findings to MITRE ATT&CK techniques and known threat actor playbooks — which nation-state groups exploit this class", status: "active" },
      { name: "Attribution-Grade Indicator Correlation", desc: "Integrates classified and unclassified threat intel feeds (STIX/TAXII) — escalates when matching active threat actor techniques", status: "active" },
      { name: "Foreign Adversary Code Signature Detection", desc: "Analyzes code for patterns consistent with known nation-state implants and backdoors via supply chain compromise", status: "coming" },
      { name: "Sector-Specific Threat Profiles", desc: "Defense Industrial Base, Energy & Utilities, Financial Services, Healthcare, Federal Civilian — different adversaries, different techniques", status: "active" },
    ],
  },
  governance: {
    title: "Governance, Explainability & Audit",
    subtitle: "Full AI decision explainability, immutable audit log, human override workflows, scan reproducibility, board-level reporting",
    icon: Scale,
    features: [
      { name: "Full AI Decision Explainability", desc: "Every finding includes reasoning chain, false positive rate, confidence interval — not a black box", status: "active" },
      { name: "Immutable Audit Log", desc: "Cryptographically chained, append-only log of every scan, finding, status change, API call — tamper-evident, FISMA/FedRAMP exportable", status: "active" },
      { name: "Human Override & Accountability Layer", desc: "Configurable human approval workflow for every automated action — governments need proof no autonomous action without authorization", status: "active" },
      { name: "Scan Reproducibility", desc: "Every scan precisely reproducible: same code state, same parameters, same output — required for legal proceedings", status: "active" },
      { name: "Board-Level Risk Reporting", desc: "One-click non-technical risk summary: posture grade, trend, top 5 risks in plain English, cost of inaction estimate", status: "active" },
    ],
  },
  deployment: {
    title: "Elite Deployment Architecture",
    subtitle: "Air-gapped, GovCloud, classified network kits, sovereign data residency, CAC/PIV authentication, C-ATO support",
    icon: Server,
    features: [
      { name: "Classified Network Deployment Kits", desc: "AWS GovCloud (IL2/4/5), Azure Government (SECRET, TS/SCI), on-premise air-gapped, JWICS-connected networks", status: "active" },
      { name: "Multi-Tenant Intelligence Sharing", desc: "Agencies share anonymized finding patterns without sharing classified code — collective detection improvement", status: "coming" },
      { name: "Sovereign Data Residency", desc: "Data never leaves customer's jurisdiction — scan telemetry, findings, code stays geofenced per data center", status: "active" },
      { name: "Continuous Authority to Operate (C-ATO)", desc: "Auto-updated risk registers, control validation evidence, deviation tracking — continuous ATO vs. painful annual renewal", status: "active" },
      { name: "CAC/PIV Authentication", desc: "Native Common Access Card and PIV hardware identity card authentication for federal agency compliance", status: "active" },
    ],
  },
  workforce: {
    title: "Economics & Workforce Augmentation",
    subtitle: "Junior analyst augmentation, CMMC assessment preparation, vCISO support packages",
    icon: GraduationCap,
    features: [
      { name: "Junior Analyst Augmentation Mode", desc: "Guided interface explaining every finding in educational context — turns a junior analyst into mid-level within weeks", status: "active" },
      { name: "CMMC Assessment Preparation Pack", desc: "Generates system security plan, network diagrams from code, control implementation statements, evidence artifacts for Level 2/3 assessment", status: "active" },
      { name: "vCISO Support Package", desc: "Multi-client dashboard, client-specific reporting, cross-client anonymized benchmarking, white-label reporting", status: "coming" },
    ],
  },
};

const IntelligenceModule = ({ screen }: IntelligenceModuleProps) => {
  const data = moduleData[screen];
  if (!data) return null;

  const Icon = data.icon;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 max-w-[900px] mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/[0.03] border border-border/[0.06] flex items-center justify-center">
            <Icon className="h-5 w-5 text-foreground/40" />
          </div>
          <div>
            <h2 className="text-sm font-light tracking-[0.1em] text-foreground/80 uppercase">{data.title}</h2>
            <p className="text-[10px] text-muted-foreground/35 mt-0.5 max-w-xl">{data.subtitle}</p>
          </div>
        </div>

        <div className="space-y-3">
          {data.features.map((f, i) => (
            <div key={i} className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4 hover:bg-foreground/[0.01] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[11px] text-foreground/60">{f.name}</h3>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      f.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-foreground/[0.03] text-muted-foreground/30"
                    }`}>
                      {f.status === "active" ? "Active" : "Coming Soon"}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/35 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntelligenceModule;
