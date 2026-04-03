import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SUBSCRIPTION_PLANS } from "@/config/subscriptionPlans";

const CHAT_FEATURE_GROUPS = [
  {
    category: "AI Chat",
    features: [
      { name: "Uncensored AI chat", desc: "No filters, no censorship — raw intelligence on any topic.", link: null },
      { name: "100 messages per 3-hour window", desc: "Automatic reset every 3 hours.", link: null },
    ],
  },
  {
    category: "Security & Flexibility",
    features: [
      { name: "End-to-end encryption", desc: "Every message encrypted. Your data is never stored as training data.", link: null },
      { name: "Data sovereignty", desc: "Your data is never sold, shared, or used for model improvement.", link: null },
      { name: "Bring Your Own AI Key", desc: "Connect your own API keys from Google, OpenAI, Claude, Meta, xAI, Mistral, DeepSeek & Venice.", link: "/feature/byok" },
    ],
  },
];

const AUREON_FEATURE_GROUPS = [
  {
    category: "AI Engine",
    features: [
      { name: "Uncensored AI responses", desc: "No filters, no censorship — raw intelligence on any topic.", link: null },
      { name: "Persistent memory", desc: "Aureon remembers your context across every session.", link: null },
      { name: "Multi-persona system", desc: "Switch between specialized AI personas for different workflows.", link: "/feature/personas" },
      { name: "Context intelligence", desc: "Automatic intent detection and adaptive response depth.", link: null },
    ],
  },
  {
    category: "Development",
    features: [
      { name: "Aureon IDE", desc: "Full cloud development environment with AI chat, terminals, and sessions.", link: "/feature/ide" },
      { name: "Elite coding engine", desc: "Multi-file architecture, debugging, and production-grade output.", link: null },
      { name: "Code Snippets Vault", desc: "Save, tag, and organize reusable code fragments.", link: null },
    ],
  },
  {
    category: "Search & Intelligence",
    features: [
      { name: "Zophiel Search Engine", desc: "Privacy-first search with source credibility tiers and page preview.", link: "/feature/zophiel" },
      { name: "Live web search", desc: "Real-time web search integrated directly into conversations.", link: null },
      { name: "IMAGINE INTELLIGENCE", desc: "Geo-intelligence analysis — identify locations, faces, and environmental context from images.", link: "/feature/imagine-intelligence" },
    ],
  },
  {
    category: "Creation",
    features: [
      { name: "Vibe Imager", desc: "Conversational AI image creation and editing — describe what you want, get instant results.", link: "/feature/vibe-imager" },
      { name: "Slideshow Generator", desc: "AI-powered presentation creation from natural language prompts.", link: null },
      { name: "PDF Generator", desc: "Generate professional PDF documents from conversations and data.", link: null },
    ],
  },
  {
    category: "Security & Flexibility",
    features: [
      { name: "End-to-end encryption", desc: "Every message encrypted. Your data is never stored as training data.", link: null },
      { name: "Data sovereignty", desc: "Your data is never sold, shared, or used for model improvement.", link: null },
      { name: "Bring Your Own AI Key", desc: "Use your preferred AI models from 8+ providers across all Aureon tools.", link: "/feature/byok" },
    ],
  },
];

const PRO_FEATURE_GROUPS = [
  {
    category: "Intelligence Suite",
    features: [
      { name: "Google Intelligence", desc: "Multi-account Google data analysis — email, calendar, contacts, YouTube, Chrome.", link: "/feature/google-intelligence" },
      { name: "Predictive Intelligence", desc: "AI-powered event forecasting with signal detection and confidence scoring.", link: "/feature/predictive" },
      { name: "Daily Intelligence Briefings", desc: "Personalized morning reports covering competitors, industry, and markets.", link: "/feature/briefings" },
      { name: "Pattern Analysis Engine", desc: "Detect hidden patterns and anomalies across datasets.", link: null },
    ],
  },
  {
    category: "OSINT & Investigation",
    features: [
      { name: "NOMAD Public Intelligence", desc: "OSINT agent across 40+ data sources with dossier output.", link: "/feature/nomad" },
      { name: "Elion / Zohar Toolkit", desc: "Domain forensics, security scoring, subdomain recon, and attack surface mapping.", link: "/feature/elion" },
      { name: "Company & Competitor Tracking", desc: "Monitor competitors, track changes, and forecast moves.", link: "/feature/tracker" },
    ],
  },
  {
    category: "Data Intelligence",
    features: [
      { name: "Azplen Intelligence Platform", desc: "Full data intelligence — ingest, analyze, branch, and visualize.", link: "/feature/azplen" },
      { name: "Intelligence Notebooks", desc: "Collaborative notebooks with versioning and AI-powered cells.", link: "/feature/notebooks" },
      { name: "Time-Series Intelligence", desc: "Temporal analysis and forecasting across any dataset.", link: null },
      { name: "Geospatial Analysis", desc: "Location intelligence and geographic data mapping.", link: null },
      { name: "Entity Resolution", desc: "AI-powered entity matching and relationship mapping.", link: null },
    ],
  },
  {
    category: "Creation & Media",
    features: [
      { name: "Imagine To Code", desc: "Pixel art & SVG editor with AUREON AI design partner.", link: "/feature/imagine-to-code" },
      { name: "Vibe Video", desc: "AI video generation — create videos from text prompts or edit existing footage.", link: "/feature/vibe-video" },
      { name: "Video Intelligence", desc: "Behavioral and deception analysis from video uploads.", link: "/feature/video-intelligence" },
      { name: "ZALI Design Lab", desc: "3D product design intelligence with material analysis and simulation.", link: "/feature/zali" },
    ],
  },
  {
    category: "Security & Operations",
    features: [
      { name: "Security Dashboard", desc: "WAF, honeypots, threat intelligence feeds, and behavioral analytics.", link: "/feature/security" },
      { name: "Scenario Simulator", desc: "Threat modeling and scenario simulation for risk assessment.", link: null },
      { name: "Audit Trail", desc: "Full compliance-grade audit logging of all platform activity.", link: null },
      { name: "Team Workspace", desc: "RBAC, email invites, and collaborative workspaces.", link: null },
      { name: "Plugin Marketplace", desc: "20+ plugins to extend Aureon's capabilities.", link: null },
    ],
  },
  {
    category: "AI Model Flexibility",
    features: [
      { name: "Bring Your Own AI Key", desc: "Connect API keys from Google, OpenAI, Anthropic, Meta, Venice, xAI, Mistral & DeepSeek.", link: "/feature/byok" },
      { name: "Multi-model switching", desc: "Switch between models per-provider from Settings — applied across all Aureon tools.", link: null },
      { name: "Fallback to Aureon default", desc: "If your key hits rate limits, Aureon's built-in engine takes over automatically.", link: null },
    ],
  },
];

interface TierFeatureTabsProps {
  compact?: boolean;
}

const TierFeatureTabs = ({ compact = false }: TierFeatureTabsProps) => {
  const [activeTab, setActiveTab] = useState<"chat" | "aureon" | "pro">("chat");

  const groups = activeTab === "chat" ? CHAT_FEATURE_GROUPS : activeTab === "aureon" ? AUREON_FEATURE_GROUPS : PRO_FEATURE_GROUPS;
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-1 w-fit mx-auto">
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-5 py-2.5 rounded-lg text-xs font-light tracking-wide transition-all ${
            activeTab === "chat"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          CHAT — $47/mo
        </button>
        <button
          onClick={() => setActiveTab("aureon")}
          className={`px-5 py-2.5 rounded-lg text-xs font-light tracking-wide transition-all ${
            activeTab === "aureon"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          AUREON — $199/mo
        </button>
        <button
          onClick={() => setActiveTab("pro")}
          className={`px-5 py-2.5 rounded-lg text-xs font-light tracking-wide transition-all ${
            activeTab === "pro"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          PRO — $740/mo
        </button>
      </div>

      {/* Tier Description */}
      <div className="text-center">
        <p className="text-sm font-extralight text-muted-foreground max-w-lg mx-auto">
          {plan?.description}
        </p>
        {activeTab === "aureon" && (
          <p className="text-[10px] tracking-wider text-foreground/50 uppercase mt-2">
            Includes everything in Chat +
          </p>
        )}
        {activeTab === "pro" && (
          <p className="text-[10px] tracking-wider text-accent/70 uppercase mt-2">
            Includes everything in Aureon +
          </p>
        )}
      </div>

      {/* Feature Groups */}
      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
        {groups.map((group) => (
          <div
            key={group.category}
            className="rounded-xl border border-border/15 bg-card/15 backdrop-blur-sm p-4 sm:p-5"
          >
            <h4 className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase mb-3">
              {group.category}
            </h4>
            <ul className="space-y-2.5">
              {group.features.map((feat) => (
                <li key={feat.name} className="flex items-start gap-2.5">
                  <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${activeTab === "pro" ? "text-accent" : "text-emerald-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-light text-foreground">{feat.name}</span>
                      {feat.link && (
                        <Link
                          to={feat.link}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                        >
                          Learn more <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                    {!compact && (
                      <p className="text-[11px] font-extralight text-muted-foreground/80 mt-0.5 leading-relaxed">
                        {feat.desc}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TierFeatureTabs;
