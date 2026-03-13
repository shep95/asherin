/**
 * Centralized Subscription Plans Configuration
 * 
 * SINGLE SOURCE OF TRUTH for all tier definitions, features, pricing,
 * and access rules. All UI components and edge functions reference this.
 */

import type { TierKey } from "@/contexts/SubscriptionContext";

// ── Feature IDs ──────────────────────────────────────────────────────────────
export type FeatureId =
  | "chat"
  | "ide"
  | "zophiel_search"
  | "memory"
  | "personas"
  | "code_snippets"
  | "encryption"
  | "slideshow"
  | "pdf_generator"
  | "imagine_intelligence"
  | "google_intel"
  | "elion"
  | "predictive"
  | "briefings"
  | "nomad"
  | "tracker"
  | "asha"
  | "pattern_analysis"
  | "timeseries"
  | "geospatial"
  | "notebooks"
  | "zali"
  | "imagine_to_code"
  | "teams"
  | "community"
  | "security_dashboard"
  | "plugins"
  | "audit"
  | "entity_resolution"
  | "scenario_simulator"
  | "priority_models"
  | "video_intelligence"
  | "vibe_imager"
  | "vibe_video"
  | "agents";

// ── Plan Definition ──────────────────────────────────────────────────────────
export interface PlanDefinition {
  id: TierKey;
  name: string;
  tagline: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  highlight: boolean;
  /** Visible on public pricing page */
  publicVisible: boolean;
  /** Features included in this tier */
  features: FeatureId[];
  /** Human-readable feature list for UI display */
  featureLabels: string[];
  /** Messages per 3-hour window */
  messageLimit: number;
}

// ── Tier → Feature Mapping ───────────────────────────────────────────────────
const LIFETIME_FEATURES: FeatureId[] = [
  "chat", "encryption",
];

const CHAT_FEATURES: FeatureId[] = [
  "chat", "encryption", "zophiel_search", "imagine_intelligence", "notebooks",
];

const AUREON_FEATURES: FeatureId[] = [
  "chat", "ide", "zophiel_search", "memory", "personas", "code_snippets",
  "encryption", "slideshow", "pdf_generator", "imagine_intelligence", "imagine_to_code",
  "vibe_imager",
];

const PRO_FEATURES: FeatureId[] = [
  ...AUREON_FEATURES,
  "google_intel", "elion", "predictive", "briefings", "nomad", "tracker",
  "asha", "pattern_analysis", "timeseries", "geospatial", "notebooks",
  "zali", "teams", "community", "security_dashboard", "plugins", "audit",
  "entity_resolution", "scenario_simulator", "priority_models", "video_intelligence",
  "vibe_video", "agents",
];

const ADVISOR_FEATURES: FeatureId[] = [...PRO_FEATURES];

const STARTER_FEATURES: FeatureId[] = [
  "chat", "encryption",
];

// ── Plans Array ──────────────────────────────────────────────────────────────
export const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "AUREON STARTER",
    tagline: "Get Started",
    price: "$20",
    period: "/ month",
    description: "50 Aureon messages per 3-hour window. Uncensored AI chat — no filters, no agendas.",
    cta: "Get Starter Access",
    highlight: false,
    publicVisible: false,
    features: STARTER_FEATURES,
    messageLimit: 50,
    featureLabels: [
      "Uncensored AI chat on any topic",
      "50 messages per 3-hour window",
      "Aureon default engine included",
      "End-to-end encryption",
      "Data never sold or used for training",
      "Bring Your Own AI Key supported",
      "Cancel anytime — one click",
    ],
  },
  {
    id: "lifetime",
    name: "AUREON LIFETIME",
    tagline: "Pay Once, Own Forever",
    price: "$470",
    period: "one-time",
    description: "Permanent Aureon Chat access with ZOPHIEL intelligence. We uncensor your preferred LLM models — no filters, no agendas, pure truth-seeking AI. Bring Your Own API Key required.",
    cta: "Get Lifetime Access",
    highlight: false,
    publicVisible: true,
    features: LIFETIME_FEATURES,
    messageLimit: Infinity,
    featureLabels: [
      "Aureon Chat — permanent access, no recurring fees",
      "We uncensor your preferred LLM models — no safety filters removed",
      "Your GPT, Claude, Gemini models run without corporate agendas",
      "Powered by ZOPHIEL Intelligence System — truth-seeking AI engine",
      "Unlimited messages with your own API key",
      "BYOK (Bring Your Own API Key) required — 8 providers supported",
      "GPT-5.4, Claude Opus 4.6, Gemini 3.1 Pro, Grok 4 & more",
      "Aureon default engine NOT included",
      "End-to-end encryption",
      "Data never sold or used for training",
      "No expiry — lifetime means lifetime",
    ],
  },
  {
    id: "chat",
    name: "AUREON CHAT",
    tagline: "AI Chat Only",
    price: "$47",
    period: "/ month",
    description: "Aureon AI chat with Zophiel Search, Imagine Intelligence, and Intelligence Notebooks — uncensored, unfiltered.",
    cta: "Get Chat Access",
    highlight: false,
    publicVisible: true,
    features: CHAT_FEATURES,
    messageLimit: 100,
    featureLabels: [
      "Uncensored AI chat on any topic",
      "100 messages per 3-hour window",
      "Aureon default engine included",
      "Zophiel Search Engine — privacy-first intelligence search",
      "Imagine Intelligence — geo-intelligence image analysis",
      "Intelligence Notebooks — versioned analysis workbooks",
      "End-to-end encryption",
      "Data never sold or used for training",
      "Bring Your Own AI Key — use your preferred models",
      "Cancel anytime — one click",
    ],
  },
  {
    id: "aureon",
    name: "AUREON",
    tagline: "AI Intelligence",
    price: "$199",
    period: "/ month",
    description: "Full access to Aureon AI — uncensored, unfiltered. 200 messages per 3-hour window across Chat & IDE. Resets automatically.",
    cta: "Get Aureon Access",
    highlight: false,
    publicVisible: true,
    features: AUREON_FEATURES,
    messageLimit: 200,
    featureLabels: [
      "Uncensored AI responses on any topic",
      "200 messages per 3-hour window (Chat + IDE shared)",
      "Aureon IDE — full cloud development environment",
      "Elite coding engine",
      "Zophiel Search Engine",
      "Persistent memory across all sessions",
      "Context intelligence & intent detection",
      "Multi-persona system",
      "Live web search integration",
      "Code Snippets Vault",
      "End-to-end encryption",
      "Data never sold or used for training",
      "Slideshow Generator",
      "PDF Generator",
      "IMAGINE INTELLIGENCE — Geo-Intelligence Analysis",
      "Vibe Imager — conversational AI image creation & editing",
      "Bring Your Own AI Key — use Google, OpenAI, Claude, Meta & more",
    ],
  },
  {
    id: "pro",
    name: "AUREON PRO",
    tagline: "Full Dashboard Access",
    price: "$740",
    period: "/ month",
    description: "Complete access to every tool — IDE, Google Intelligence, Asha, NOMAD, Predictive Intelligence, and more.",
    cta: "Get Pro Access",
    highlight: false,
    publicVisible: true,
    features: PRO_FEATURES,
    messageLimit: 200,
    featureLabels: [
      "Everything in Aureon — expanded",
      "200 messages per 3-hour window (Chat + IDE shared)",
      "Aureon IDE — full cloud dev environment with AI chat",
      "Google Intelligence Suite — multi-account analysis",
      "Elion / Zohar Toolkit — domain forensics & OSINT",
      "Full Domain Scan — security score + subdomain recon",
      "Predictive Intelligence — AI event forecasting",
      "Imagine To Code — pixel art & SVG editor with AUREON AI",
      "ZALI Design Intelligence Lab",
      "ZALI Community — questions, requests & feature votes",
      "Asha Data Intelligence Platform",
      "NOMAD Public Intelligence Agent",
      "Daily Intelligence Briefings",
      "Intelligence Notebooks with versioning",
      "Team Workspace with RBAC & email invites",
      "Time-Series Intelligence & forecasting",
      "Geospatial analysis & location mapping",
      "Plugin Marketplace (20+ plugins)",
      "Security Dashboard — WAF, honeypots & threat intel",
      "Audit Trail for compliance",
      "Entity resolution & relationship mapping",
      "Scenario Simulator & threat modeling",
      "Pattern Analysis Engine",
      "Company & competitor tracking",
      "IMAGINE INTELLIGENCE — Geo-Intelligence Analysis",
      "Video Intelligence — behavioral & deception analysis",
      "Priority model access",
      "Bring Your Own AI Key — use any provider across all tools",
    ],
  },
  {
    id: "advisor_monthly",
    name: "AUREON ADVISOR",
    tagline: "Enterprise Intelligence",
    price: "$20,000",
    period: "/ month",
    description: "Dedicated intelligence pipeline with NDA, priority support, and unlimited access.",
    cta: "Contact for Access",
    highlight: false,
    publicVisible: false,
    features: ADVISOR_FEATURES,
    messageLimit: Infinity,
    featureLabels: [
      "Everything in Pro — unlimited",
      "Unlimited messages",
      "Dedicated intelligence pipeline",
      "NDA-protected engagement",
      "Priority model access",
      "Direct analyst support",
      "Custom integrations",
    ],
  },
  {
    id: "advisor_annual",
    name: "AUREON ADVISOR (Annual)",
    tagline: "Enterprise Intelligence",
    price: "$200,000",
    period: "/ year",
    description: "Annual commitment with dedicated intelligence pipeline.",
    cta: "Contact for Access",
    highlight: false,
    publicVisible: false,
    features: ADVISOR_FEATURES,
    messageLimit: Infinity,
    featureLabels: [
      "Everything in Advisor Monthly",
      "Annual billing discount",
    ],
  },
];

// ── Access Helpers ───────────────────────────────────────────────────────────

/** Check if a tier has access to a specific feature */
export function tierHasFeature(tierKey: TierKey | null, feature: FeatureId): boolean {
  if (!tierKey) return false;
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === tierKey);
  return plan?.features.includes(feature) ?? false;
}

/** Get the plan definition for a tier */
export function getPlan(tierKey: TierKey): PlanDefinition | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === tierKey);
}

/** Get all publicly visible plans (for landing/pricing pages) */
export function getPublicPlans(): PlanDefinition[] {
  return SUBSCRIPTION_PLANS.filter(p => p.publicVisible);
}

/** Get plans visible in the dashboard subscription view (public + starter) */
export function getDashboardPlans(): PlanDefinition[] {
  return SUBSCRIPTION_PLANS.filter(p => p.publicVisible || p.id === "starter");
}

/** Map dashboard view IDs to feature IDs for gating */
export const VIEW_FEATURE_MAP: Record<string, FeatureId> = {
  search: "zophiel_search",
  google: "google_intel",
  elion: "elion",
  predictive: "predictive",
  briefing: "briefings",
  nomad: "nomad",
  tracker: "tracker",
  "imagine-intelligence": "imagine_intelligence",
  asha: "asha",
  "pattern-analysis": "pattern_analysis",
  timeseries: "timeseries",
  geospatial: "geospatial",
  notebooks: "notebooks",
  zali: "zali",
  "imagine-to-code": "imagine_to_code",
  ide: "ide",
  teams: "teams",
  community: "community",
  security: "security_dashboard",
  plugins: "plugins",
  audit: "audit",
  slideshow: "slideshow",
  "pdf-generator": "pdf_generator",
  snippets: "code_snippets",
  "video-intelligence": "video_intelligence",
  "vibe-imager": "vibe_imager",
  "vibe-video": "vibe_video",
  agents: "agents",
};

// ── "What Powers Each Tier" grid config ──────────────────────────────────────
export interface TierFeatureCard {
  label: string;
  desc: string;
  tier: "All tiers" | "Pro & Advisor" | "Advisor Only";
}

export const TIER_FEATURE_CARDS: TierFeatureCard[] = [
  { label: "Aureon AI", desc: "Uncensored intelligence engine with persistent memory and calibration.", tier: "All tiers" },
  { label: "Elite Coding", desc: "Multi-file architecture, debugging, and production-grade output.", tier: "All tiers" },
  { label: "End-to-End Encryption", desc: "Every message encrypted. Never stored as training data.", tier: "All tiers" },
  { label: "Zophiel Search", desc: "Privacy-first search with source credibility tiers and page preview.", tier: "All tiers" },
  { label: "Aureon IDE", desc: "Full cloud development environment with AI chat, terminals, sessions, undo/redo, and ZIP export.", tier: "All tiers" },
  { label: "Google Intelligence", desc: "Multi-account Google data analysis — email, calendar, contacts, YouTube, Chrome, and more.", tier: "Pro & Advisor" },
  { label: "Predictive Intelligence", desc: "AI-powered event forecasting with signal detection and confidence scoring.", tier: "Pro & Advisor" },
  { label: "Imagine To Code", desc: "AI-powered pixel art & SVG editor — draw, upload images, or ask AUREON to design directly on the canvas.", tier: "Pro & Advisor" },
  { label: "NOMAD OSINT", desc: "Public intelligence agent across 40+ data sources with dossier output.", tier: "Pro & Advisor" },
  { label: "Asha Intelligence", desc: "Full data intelligence platform — ingest, analyze, branch, and visualize.", tier: "Pro & Advisor" },
  { label: "Daily Briefings", desc: "Personalized intelligence briefings delivered every morning.", tier: "Pro & Advisor" },
  { label: "Elion / Zohar Toolkit", desc: "Domain forensics, security scoring, subdomain recon, and full attack surface mapping.", tier: "Pro & Advisor" },
  { label: "Security Dashboard", desc: "WAF, honeypots, threat intelligence feeds, and behavioral analytics.", tier: "Pro & Advisor" },
];
