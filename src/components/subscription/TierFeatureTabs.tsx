import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SUBSCRIPTION_PLANS } from "@/config/subscriptionPlans";

const CHAT_FEATURE_GROUPS = [
  {
    category: "AI Chat",
    features: [
      { name: "Direct-answer chat", desc: "Analytical answers without corporate hedging. Refusal behaviour follows the provider you route to — Venice mistral-31-24b by default, or your own key.", link: null },
      { name: "Unlimited messages", desc: "Bring your own AI key — message as much as you want.", link: null },
      { name: "Bring Your Own AI Key (required)", desc: "Connect your own keys from Google, OpenAI, Anthropic, xAI, Mistral, DeepSeek and more — required to use Aureon.", link: "/feature/byok" },
    ],
  },
  {
    category: "Search & Knowledge",
    features: [
      { name: "Zophiel Search Engine", desc: "Privacy-first search with source credibility tiers and page preview.", link: "/feature/zophiel" },
      { name: "Intelligence Notebooks", desc: "Collaborative notebooks for analysis sessions with versioning.", link: "/feature/notebooks" },
    ],
  },
  {
    category: "Creation",
    features: [
      { name: "PDF Generator", desc: "Generate professional PDF documents from conversations and data.", link: null },
      { name: "Slideshow Generator", desc: "AI-powered presentation creation from natural language prompts.", link: null },
      { name: "E-Book Generator", desc: "Multi-session text uploads compiled into chapters with AI cover art.", link: "/feature/ebook" },
    ],
  },
  {
    category: "Agents & Security",
    features: [
      { name: "Zahten Agent Forge", desc: "Autonomous agent builder — design, scaffold and harden production-grade automated agents.", link: null },
      { name: "Guardian Vault", desc: "Centralized security command center with TOTP MFA and credential hygiene.", link: null },
      { name: "ZERLAL Cyber Security", desc: "Domain reconnaissance, vulnerability scanning, and exploit intelligence — part of the Zophiel Engine.", link: "/feature/zerlal" },
      { name: "End-to-end encryption", desc: "Every message encrypted. Your data is never stored as training data.", link: null },
      { name: "Data sovereignty", desc: "Your data is never sold, shared, or used for model improvement.", link: null },
    ],
  },
];

const AUREON_FEATURE_GROUPS = [
  {
    category: "AI Engine",
    features: [
      { name: "Direct-answer chat", desc: "Analytical answers without corporate hedging. Refusal behaviour follows the provider you route to — Venice mistral-31-24b by default, or your own key.", link: null },
      { name: "Unlimited messages", desc: "Bring your own AI key — no throttling.", link: null },
      { name: "Persistent memory", desc: "Asherin remembers your context across every session.", link: null },
    ],
  },
  {
    category: "Development",
    features: [
      { name: "Asherin IDE", desc: "Full cloud development environment with AI chat, terminals, sessions, undo/redo and ZIP export.", link: "/feature/ide" },
      { name: "Code Snippets Vault", desc: "Save, tag, and organize reusable code fragments.", link: null },
      { name: "Imagine To Code", desc: "AI-powered pixel art & SVG editor — draw, upload images, or ask Asherin to design directly on the canvas.", link: "/feature/imagine-to-code" },
    ],
  },
  {
    category: "Creation & Vision",
    features: [
      
      { name: "Reverse Engineering Intelligence", desc: "Upload screenshots of any software or hardware system — Asherin deconstructs the architecture.", link: "/feature/reverse-engineer" },
      { name: "File Scrapper", desc: "Extract text from any document — PDF, DOCX, images and more.", link: "/feature/file-scrapper" },
      { name: "Whiteboard", desc: "Infinite canvas with Photoshop-style layers, dot/square snap grids and freeform sketching.", link: "/feature/whiteboard" },
      { name: "ZANOEM Design Lab", desc: "Universal design intelligence — first-principles design with FEA & thermal simulation.", link: "/feature/zali" },
    ],
  },
  {
    category: "Intelligence & Briefings",
    features: [
      { name: "Daily Intelligence Briefings", desc: "Personalized morning reports covering competitors, industry, and markets.", link: "/feature/briefings" },
      { name: "Vedic Strategy", desc: "Astro-temporal forecasting, dasha cycles, lagna relationship and timing intelligence.", link: "/feature/vedic" },
    ],
  },
  {
    category: "Agents & Security",
    features: [
      { name: "Zahten Agent Forge", desc: "Autonomous agent builder — design, scaffold and harden production-grade automated agents.", link: null },
      { name: "Guardian Vault", desc: "Centralized security command center with TOTP MFA and credential hygiene.", link: null },
    ],
  },
  {
    category: "Inherited from Chat",
    features: [
      { name: "Direct-answer chat", desc: "Analytical answers without corporate hedging. Refusal behaviour follows the provider you route to — Venice mistral-31-24b by default, or your own key.", link: null },
      { name: "Unlimited Messages", desc: "Bring your own AI key — message as much as you want.", link: null },
      { name: "Bring Your Own AI Key", desc: "Connect Google, OpenAI, Anthropic, xAI, Mistral, DeepSeek and more.", link: "/feature/byok" },
      { name: "End-to-end Encryption", desc: "Every message encrypted. Never used as training data.", link: null },
      { name: "Zophiel Search Engine", desc: "multi-engine OSINT search with veracity scoring.", link: "/feature/zophiel" },
      { name: "Intelligence Notebooks", desc: "Run live SQL and build reusable analytical notebooks.", link: "/feature/notebooks" },
      { name: "PDF Generator", desc: "Turn any conversation into a polished, paginated PDF.", link: null },
      { name: "Slideshow Generator", desc: "Auto-build editable slide decks from prompts.", link: null },
      { name: "E-Book Generator", desc: "Compile multi-chapter books from your text uploads.", link: "/feature/ebook" },
      { name: "Zahten Agent Forge", desc: "Autonomous agent foundry — design, scaffold, harden and deploy production-grade agents.", link: "/feature/zahten" },
      { name: "Guardian Vault", desc: "Centralized security command center with TOTP MFA.", link: null },
      { name: "ZERLAL Cyber Security", desc: "Domain reconnaissance, vulnerability scanning, and exploit intelligence — included with every paid tier.", link: "/feature/zerlal" },
    ],
  },
];

const PRO_FEATURE_GROUPS = [
  {
    category: "Intelligence Suite",
    features: [
      { name: "Google Intelligence Suite", desc: "Multi-account Google data analysis — email, calendar, contacts, YouTube, Chrome.", link: "/feature/google-intelligence" },
      { name: "Pattern Analysis Engine", desc: "Detect hidden patterns and anomalies across datasets.", link: "/feature/pattern-analysis" },
      { name: "Company & Competitor Tracking", desc: "Monitor competitors, track changes, and forecast moves.", link: "/feature/tracker" },
    ],
  },
  {
    category: "Live Intelligence & Investigation",
    features: [
      { name: "Cross — Live Screen Intelligence", desc: "Real-time screen analysis with 17 analytical modes.", link: "/feature/cross" },
    ],
  },
  {
    category: "Data Intelligence",
    features: [
      { name: "Azplen Intelligence Platform", desc: "Full data intelligence — ingest, analyze, branch, and visualize.", link: "/feature/azplen" },
      { name: "Time-Series Intelligence", desc: "Temporal analysis and forecasting across any dataset.", link: null },
      { name: "Geospatial Analysis", desc: "Location intelligence and geographic data mapping.", link: null },
      
    ],
  },
  {
    category: "Specialized Modules",
    features: [
      { name: "AXRLEN", desc: "Real-time global event prediction and policy simulation engine.", link: "/feature/axrlen" },
      { name: "ZEEION FI", desc: "AI forensic financial intelligence and dispute resolution platform.", link: "/feature/zeeion" },
      { name: "ZERLAL", desc: "Domain reconnaissance, vulnerability scanning, and exploit intelligence.", link: "/feature/zerlal" },
    ],
  },
  {
    category: "Operations & Collaboration",
    features: [
      { name: "Security Dashboard", desc: "WAF, honeypots, threat intelligence feeds, and behavioral analytics.", link: "/feature/security" },
      { name: "Audit Trail", desc: "Full compliance-grade audit logging of all platform activity.", link: null },
      { name: "Team Workspace", desc: "RBAC, email invites, and collaborative workspaces.", link: null },
      { name: "Automated Agents", desc: "Scheduled tasks with multi-channel webhook delivery.", link: "/feature/automated-agents" },
      { name: "Zahten Agent Forge", desc: "Autonomous agent foundry — design, scaffold, harden and deploy production-grade agents with scheduled triggers and webhook delivery.", link: "/feature/zahten" },
    ],
  },
  {
    category: "Inherited from Asherin",
    features: [
      { name: "Asherin IDE", desc: "Full cloud development environment with AI chat, terminals and ZIP export.", link: "/feature/ide" },
      { name: "Persistent Memory", desc: "Asherin remembers your context across every session.", link: null },
      
      { name: "Imagine To Code", desc: "AI-powered pixel art & SVG editor that draws directly on canvas.", link: "/feature/imagine-to-code" },
      { name: "Reverse Engineering Intelligence", desc: "Deconstructs the architecture of any software/hardware screenshot.", link: "/feature/reverse-engineer" },
      { name: "File Scrapper", desc: "Extract clean text from PDF, DOCX, images and more.", link: "/feature/file-scrapper" },
      { name: "Whiteboard", desc: "Infinite canvas with Photoshop-style layers and snap grids.", link: "/feature/whiteboard" },
      { name: "ZANOEM Design Lab", desc: "First-principles design with FEA & thermal simulation.", link: "/feature/zali" },
      { name: "Daily Intelligence Briefings", desc: "Personalized morning reports on competitors, industry, markets.", link: "/feature/briefings" },
      { name: "Vedic Strategy", desc: "Astro-temporal forecasting, dasha cycles and timing intelligence.", link: "/feature/vedic" },
      { name: "Code Snippets Vault", desc: "Save, tag and organize reusable code fragments.", link: null },
      { name: "Memory Center", desc: "Manage long-term recall — edit, prune and calibrate AI memory.", link: null },
      { name: "Projects Workspace & Library", desc: "Group conversations, files and assets into focused project folders.", link: null },
      { name: "My Stats & Self-Access Learning", desc: "Personal analytics and AI-guided adaptive learning paths.", link: null },
      { name: "Bug Reports", desc: "Private RLS-protected support channel direct to engineering.", link: null },
    ],
  },
  {
    category: "Inherited from Chat",
    features: [
      { name: "Direct-answer chat", desc: "Analytical answers without corporate hedging. Refusal behaviour follows the provider you route to — Venice mistral-31-24b by default, or your own key.", link: null },
      { name: "Unlimited Messages", desc: "Bring your own AI key — message as much as you want.", link: null },
      { name: "Bring Your Own AI Key", desc: "Connect Google, OpenAI, Anthropic, xAI, Mistral, DeepSeek and more.", link: "/feature/byok" },
      { name: "End-to-end Encryption", desc: "Every message encrypted. Never used as training data.", link: null },
      { name: "Zophiel Search Engine", desc: "multi-engine OSINT search with veracity scoring.", link: "/feature/zophiel" },
      { name: "Intelligence Notebooks", desc: "Run live SQL and build reusable analytical notebooks.", link: "/feature/notebooks" },
      { name: "PDF Generator", desc: "Turn any conversation into a polished, paginated PDF.", link: null },
      { name: "Slideshow Generator", desc: "Auto-build editable slide decks from prompts.", link: null },
      { name: "E-Book Generator", desc: "Compile multi-chapter books from your text uploads.", link: "/feature/ebook" },
      { name: "Guardian Vault", desc: "Centralized security command center with TOTP MFA.", link: null },
      { name: "ZERLAL Cyber Security", desc: "Domain reconnaissance, vulnerability scanning, and exploit intelligence — included with every paid tier.", link: "/feature/zerlal" },
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
          onMouseEnter={() => setActiveTab("chat")}
          onFocus={() => setActiveTab("chat")}
          className={`px-5 py-2.5 rounded-lg text-xs font-light tracking-wide transition-all ${
            activeTab === "chat"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          CHAT — $47
        </button>
        <button
          onClick={() => setActiveTab("aureon")}
          onMouseEnter={() => setActiveTab("aureon")}
          onFocus={() => setActiveTab("aureon")}
          className={`px-5 py-2.5 rounded-lg text-xs font-light tracking-wide transition-all ${
            activeTab === "aureon"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          ASHERIN — $199
        </button>
        <button
          onClick={() => setActiveTab("pro")}
          onMouseEnter={() => setActiveTab("pro")}
          onFocus={() => setActiveTab("pro")}
          className={`px-5 py-2.5 rounded-lg text-xs font-light tracking-wide transition-all ${
            activeTab === "pro"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          PRO — $740
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
            Includes everything in Asherin +
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
