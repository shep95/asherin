import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { DollarSign, Search, BarChart3, Users, Scale, FileText, AlertTriangle, TrendingDown, Building2 } from "lucide-react";

const FeatureZeeion = () => (
  <FeaturePageShell
    documentTitle="Zeeion — Financial Forensics Engine | Aureon"
    eyebrow="Financial Intelligence"
    headline={<>Forensic Finance.<br /><span className="text-muted-foreground">Replacing Auditors.</span></>}
    subheadline="Zeeion is a Pro-tier financial intelligence platform for deep forensic analysis of waste, cost savings, and procurement fraud. Includes Government Workforce Optimization, dispute resolution, and trustless arbitration."
    tierLabel="Pro — $740/mo"
    capabilities={[
      { icon: DollarSign, title: "Waste & Savings Forensics", description: "Surface duplicate vendors, unused subscriptions, off-contract spend, and structural inefficiency." },
      { icon: Search, title: "Procurement Fraud Detection", description: "Behavioral anomaly detection across purchase orders, vendors, and approver chains." },
      { icon: BarChart3, title: "Expert Depth Modules", description: "Specialized forensics for healthcare claims, defense procurement, public budgets, and more." },
      { icon: Users, title: "Workforce Optimization", description: "'Drew's Vision' module — analyze government and enterprise workforces for AI-replaceability and structural redundancy." },
      { icon: Scale, title: "Dispute Resolution Engine", description: "Trustless engine designed to replace traditional courts and arbitration for commercial disputes." },
      { icon: FileText, title: "Executive Reporting", description: "Auto-generated forensic reports with chain-of-evidence, sources, and remediation playbooks." },
      { icon: AlertTriangle, title: "Risk Heatmaps", description: "Per-department, per-vendor, per-contract risk scoring with drill-down to source transactions." },
      { icon: TrendingDown, title: "Cost Containment Plays", description: "Quantified savings recommendations ranked by effort, impact, and political feasibility." },
      { icon: Building2, title: "Public Sector Mode", description: "Drop-in modules for federal, state, and municipal budget forensics." },
    ]}
    useCases={[
      "Replacing $500K/yr Big Four audit engagements with continuous AI forensics",
      "Government waste investigations with public-defensible chain of evidence",
      "M&A due diligence with full vendor and contract decomposition",
      "Trustless commercial arbitration replacing slow court proceedings",
      "Workforce restructuring analysis backed by quantified AI-replaceability scores",
    ]}
    ctaTitle="The End of the $500K Audit."
    ctaSubtitle="Zeeion is included in Aureon Pro ($740/mo)."
  />
);

export default FeatureZeeion;
