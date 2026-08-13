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
  | "byok"
  | "slideshow"
  | "pdf_generator"
  | "ebook"
  | "google_intel"
  | "briefings"
  | "nomad"
  | "tracker"
  | "azplen"
  | "pattern_analysis"
  | "timeseries"
  | "geospatial"
  | "notebooks"
  | "zali"
  | "teams"
  | "community"
  | "security_dashboard"
  | "guardian_vault"
  | "plugins"
  | "audit"
  | "scenario_simulator"
  | "video_intelligence"
  
  | "zahten"
  | "file_scrapper"
  | "cipher"
  | "whiteboard"
  | "zeeion"
  | "axrlen"
  | "zerlal"
  | "cross"
  | "vedic"
  | "lavba";

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

const CHAT_FEATURES: FeatureId[] = [
  "chat", "encryption", "byok", "zophiel_search", "notebooks",
  "slideshow", "pdf_generator", "ebook", "zahten", "guardian_vault",
  // Zophiel Engine modules included in Chat tier
  "zerlal",
];

const AUREON_FEATURES: FeatureId[] = [
  ...CHAT_FEATURES,
  "ide", "memory", "personas", "code_snippets",
  "file_scrapper", "cipher", "whiteboard",
  "nomad", "briefings", "zali", "vedic",
  // Zophiel Engine modules included from Aureon tier and up
  "axrlen", "zeeion",
];

// Lifetime ($470 one-time) gets everything in Aureon ($199) and below.
const LIFETIME_FEATURES: FeatureId[] = [...AUREON_FEATURES];

const PRO_FEATURES: FeatureId[] = [
  ...AUREON_FEATURES,
  "google_intel", "tracker",
  "azplen", "pattern_analysis", "timeseries", "geospatial",
  "teams", "community", "security_dashboard", "plugins", "audit",
  "scenario_simulator", "video_intelligence",
  "zeeion", "axrlen", "zerlal", "cross", "lavba",
];

// ── Plans Array ──────────────────────────────────────────────────────────────
export const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  {
    id: "algorithm",
    name: "AUREON ALGORITHM",
    tagline: "Entry Access",
    price: "$10",
    period: "one-time",
    description: "Direct access to the Aureon Algorithm LLM inside the Aureon Free chat — no AI key required. 20 messages per hour, 24/7. The simplest way to start using Aureon intelligence.",
    cta: "Get Algorithm Access",
    highlight: false,
    publicVisible: true,
    features: [],
    messageLimit: 20,
    featureLabels: [
      "Aureon Algorithm LLM access (no API key needed)",
      "20 messages per hour",
      "Live in the Aureon Free chat",
      "Switch to Bring-Your-Own-Key at any time",
      "No recurring billing",
    ],
  },
  {
    id: "lifetime",
    name: "AUREON LIFETIME",
    tagline: "One-Time Purchase",
    price: "$470",
    period: "one-time",
    description: "Lifetime access to everything in the Aureon $199 one-time tier and below — IDE, persistent memory, NOMAD, Briefings, ZANOEM Design Lab, Vedic Strategy, Zophiel Search, Notebooks, generators, Zahten and Guardian Vault. Unlimited messages. Bring your own AI key — one payment, forever.",
    cta: "Get Lifetime Access",
    highlight: true,
    publicVisible: true,
    features: LIFETIME_FEATURES,
    messageLimit: 999999,
    featureLabels: [
      "Lifetime access — one payment",
      "Unlimited messages (BYOK required)",
      "Everything in the Aureon $199 one-time tier and below",
      "Aureon IDE — full cloud development environment",
      "Persistent Memory",
      "Zophiel Search, Notebooks, PDF / Slideshow / E-Book",
      "Zahten Agent Forge & Guardian Vault",
      "ZERLAL — Cyber Security & vulnerability intelligence (Zophiel Engine)",
      "AXRLEN — Predictive Intelligence (Zophiel Engine)",
      "ZEEION FI — Financial Intelligence (Zophiel Engine)",
      "NOMAD Public Intelligence",
      "Daily Intelligence Briefings",
      "ZANOEM Design Lab",
      "Vedic Strategy",
      "Memory Center & Code Snippets Vault",
      "Projects, Library, My Stats, Self-Access Learning & Bug Reports",
      "End-to-end encryption",
    ],
  },
  {
    id: "chat",
    name: "AUREON CHAT",
    tagline: "Core Intelligence",
    price: "$47",
    period: "one-time",
    description: "Full AI chat plus Zophiel Search, Notebooks, PDF / Slideshow / E-Book generators, Zahten Agent Forge, and Guardian Vault. Bring your own AI key — unlimited messages.",
    cta: "Start With Chat",
    highlight: false,
    publicVisible: true,
    features: CHAT_FEATURES,
    messageLimit: 999999,
    featureLabels: [
      "Unlimited messages (BYOK required)",
      "Uncensored AI chat",
      "Bring Your Own AI Key (required)",
      "End-to-end encryption",
      "Zophiel Search Engine",
      "Intelligence Notebooks",
      "PDF, Slideshow & E-Book generators",
      "Zahten Agent Forge",
      "Guardian Vault",
      "ZERLAL — Cyber Security & vulnerability intelligence (Zophiel Engine)",
    ],
  },
  {
    id: "aureon",
    name: "AUREON",
    tagline: "Full AI Suite",
    price: "$199",
    period: "one-time",
    description: "Everything in Chat plus the Aureon IDE, persistent memory, Vibe Imager, File Scrapper, Cipher, Whiteboard, NOMAD Public Intelligence, Daily Intelligence Briefings, ZANOEM Design Lab, and Vedic Strategy.",
    cta: "Get Aureon",
    highlight: false,
    publicVisible: true,
    features: AUREON_FEATURES,
    messageLimit: 200,
    featureLabels: [
      "Everything in Chat (Zophiel Search, Notebooks, PDF / Slideshow / E-Book, Zahten Agent Forge, Guardian Vault)",
      "Unlimited messages (BYOK required)",
      "Zahten Agent Forge — autonomous agent builder",
      "Guardian Vault — security command center",
      "Aureon IDE — full cloud development environment",
      "Persistent Memory & Calibration",
      "Code Snippets Vault",
      "Vibe Imager — conversational AI image creation",
      "File Scrapper — extract text from any document",
      "File Scrapper — extract text from any document",
      "Cipher Toolkit — encoding, hashing, encryption",
      "Whiteboard — infinite canvas with layers",
      "ZERLAL — Cyber Security & vulnerability intelligence (Zophiel Engine)",
      "AXRLEN — Predictive Intelligence (Zophiel Engine)",
      "ZEEION FI — Financial Intelligence (Zophiel Engine)",
      "NOMAD Public Intelligence Agent",
      "Daily Intelligence Briefings",
      "ZANOEM Design Lab",
      "Vedic Strategy — astro-temporal forecasting & dasha analysis",
      "Memory Center — persistent long-term recall & calibration",
      "Code Snippets Vault — save, tag and reuse code",
      "Projects — organize work into dedicated workspaces",
      "Library — centralized knowledge & file repository",
      "My Stats — usage analytics & activity insights",
      "Self-Access Learning — personal training & knowledge base",
      "Bug Reports — private support & feedback channel",
    ],
  },
  {
    id: "pro",
    name: "AUREON PRO",
    tagline: "Maximum Intelligence",
    price: "$740",
    period: "one-time",
    description: "Everything in Aureon plus Google Intelligence, Azplen Data, team workspace, and every advanced module.",
    cta: "Go Pro",
    highlight: true,
    publicVisible: true,
    features: PRO_FEATURES,
    messageLimit: 200,
    featureLabels: [
      "Everything in Aureon — expanded",
      "Unlimited messages (BYOK required)",
      "Zahten Agent Forge & Guardian Vault",
      "Google Intelligence Suite",
      "Azplen Data Intelligence Platform",
      "Pattern Analysis Engine",
      "Time-Series Intelligence & forecasting",
      "Geospatial analysis & location mapping",
      "Video Intelligence — behavioral & deception analysis",
      "Video Intelligence — behavioral & deception analysis",
      "Cross — live screen intelligence",
      "Lavba Strategy Engine",
      "Team Workspace with RBAC & email invites",
      "Plugin Marketplace",
      "Security Dashboard — WAF, honeypots & threat intel",
      "Audit Trail for compliance",
      "Company & competitor tracking",
      "AXRLEN — Real-time global event prediction & policy simulation",
      "ZEEION FI — AI forensic financial intelligence platform",
    ],
  },
];

// ── Access Helpers ───────────────────────────────────────────────────────────

/** Donation Era: Aureon is fully free — every feature is unlocked for every user. */
export function tierHasFeature(_tierKey: TierKey | null, _feature: FeatureId): boolean {
  return true;
}

/** Get the plan definition for a tier */
export function getPlan(tierKey: TierKey): PlanDefinition | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === tierKey);
}

/** Get all publicly visible plans (for landing/pricing pages) */
export function getPublicPlans(): PlanDefinition[] {
  return SUBSCRIPTION_PLANS.filter(p => p.publicVisible);
}

/** Get plans visible in the dashboard subscription view */
export function getDashboardPlans(): PlanDefinition[] {
  return SUBSCRIPTION_PLANS.filter(p => p.publicVisible);
}

/** Map dashboard view IDs to feature IDs for gating */
export const VIEW_FEATURE_MAP: Record<string, FeatureId> = {
  search: "zophiel_search",
  google: "google_intel",
  briefing: "briefings",
  nomad: "nomad",
  tracker: "tracker",
  asha: "azplen",
  azplen: "azplen",
  "pattern-analysis": "pattern_analysis",
  timeseries: "timeseries",
  geospatial: "geospatial",
  notebooks: "notebooks",
  zali: "zali",
  ide: "ide",
  teams: "teams",
  community: "community",
  security: "security_dashboard",
  "guardian-vault": "guardian_vault",
  plugins: "plugins",
  audit: "audit",
  slideshow: "slideshow",
  "pdf-generator": "pdf_generator",
  ebook: "ebook",
  snippets: "code_snippets",
  "video-intelligence": "video_intelligence",
  
  // zahten intentionally omitted — always visible in sidebar; gating handled in Dashboard.tsx
  "file-scrapper": "file_scrapper",
  cipher: "cipher",
  whiteboard: "whiteboard",
  zeeion: "zeeion",
  axrlen: "axrlen",
  zerlal: "zerlal",
  cross: "cross",
  lavba: "lavba",
  // vedic-astrology intentionally omitted — always visible in sidebar; gating handled in Dashboard.tsx via useAccess
};

// ── "What Powers Each Tier" grid config ──────────────────────────────────────
export interface TierFeatureCard {
  label: string;
  desc: string;
  tier: "All tiers" | "Pro";
}

export const TIER_FEATURE_CARDS: TierFeatureCard[] = [
  { label: "Aureon AI", desc: "Uncensored intelligence engine with persistent memory and calibration.", tier: "All tiers" },
  { label: "Bring Your Own AI Key", desc: "Connect your own keys from Google, OpenAI, Anthropic, xAI, Mistral, DeepSeek and more.", tier: "All tiers" },
  { label: "End-to-End Encryption", desc: "Every message encrypted. Never stored as training data.", tier: "All tiers" },
  { label: "Zophiel Search", desc: "Privacy-first search with source credibility tiers and page preview.", tier: "All tiers" },
  { label: "Zahten Agent Forge", desc: "Autonomous agent builder — design, scaffold and harden production-grade automated agents.", tier: "All tiers" },
  { label: "Guardian Vault", desc: "Centralized security command center with TOTP MFA and credential hygiene.", tier: "All tiers" },
  { label: "Aureon IDE", desc: "Full cloud development environment with AI chat, terminals, sessions, undo/redo, and ZIP export.", tier: "Pro" },
  { label: "Imagine To Code", desc: "AI-powered pixel art & SVG editor — draw, upload images, or ask AUREON to design directly on the canvas.", tier: "Pro" },
  { label: "Google Intelligence", desc: "Multi-account Google data analysis — email, calendar, contacts, YouTube, Chrome, and more.", tier: "Pro" },
  { label: "NOMAD Public Intelligence", desc: "Public intelligence agent across 40+ data sources with dossier output.", tier: "All tiers" },
  { label: "Azplen Intelligence", desc: "Full data intelligence platform — ingest, analyze, branch, and visualize.", tier: "Pro" },
  { label: "Daily Briefings", desc: "Personalized intelligence briefings delivered every morning.", tier: "All tiers" },
  { label: "ZANOEM Design Lab", desc: "Universal design intelligence — first-principles design with FEA & thermal simulation.", tier: "All tiers" },
  { label: "Vedic Strategy", desc: "Astro-temporal forecasting, dasha cycles, lagna analysis and timing intelligence.", tier: "All tiers" },
  { label: "Video Intelligence", desc: "Behavioral analysis, deception detection, and personality profiling from video.", tier: "Pro" },
  { label: "Security Dashboard", desc: "WAF, honeypots, threat intelligence feeds, and behavioral analytics.", tier: "Pro" },
  { label: "AXRLEN", desc: "Real-time global event prediction and policy simulation engine.", tier: "Pro" },
  { label: "ZEEION FI", desc: "AI forensic financial intelligence and dispute resolution.", tier: "Pro" },
  { label: "ZERLAL", desc: "Domain reconnaissance, vulnerability scanning, and exploit intelligence.", tier: "Pro" },
];
