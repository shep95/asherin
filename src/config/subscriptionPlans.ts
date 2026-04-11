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
  | "azplen"
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
  | "agents"
   | "zeeion"
   | "axrlen"
   | "zerlal";

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
  "slideshow", "pdf_generator",
];

const AUREON_FEATURES: FeatureId[] = [
  "chat", "ide", "zophiel_search", "memory", "personas", "code_snippets",
  "encryption", "slideshow", "pdf_generator", "imagine_intelligence", "imagine_to_code",
  "vibe_imager",
];

const PRO_FEATURES: FeatureId[] = [
  ...AUREON_FEATURES,
  "google_intel", "elion", "predictive", "briefings", "nomad", "tracker",
  "azplen", "pattern_analysis", "timeseries", "geospatial", "notebooks",
  "zali", "teams", "community", "security_dashboard", "plugins", "audit",
  "entity_resolution", "scenario_simulator", "priority_models", "video_intelligence",
  "vibe_video", "agents",
];

const STARTER_FEATURES: FeatureId[] = [
  "chat", "encryption",
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
  asha: "azplen",
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
  zeeion: "zeeion",
  axrlen: "axrlen",
  zerlal: "zerlal",
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
  { label: "Azplen Intelligence", desc: "Full data intelligence platform — ingest, analyze, branch, and visualize.", tier: "Pro & Advisor" },
  { label: "Daily Briefings", desc: "Personalized intelligence briefings delivered every morning.", tier: "Pro & Advisor" },
  { label: "Elion / Zohar Toolkit", desc: "Domain forensics, security scoring, subdomain recon, and full attack surface mapping.", tier: "Pro & Advisor" },
  { label: "Security Dashboard", desc: "WAF, honeypots, threat intelligence feeds, and behavioral analytics.", tier: "Pro & Advisor" },
];
