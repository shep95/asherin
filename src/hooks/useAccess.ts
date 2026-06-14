import { ADMIN_EMAIL, isAdminEmail } from "@/lib/adminEmail";
import { useSubscription, hasChatAccess, hasSearchAccess, hasProAccess, hasEnterpriseOnlyAccess, hasAureonAccess } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardView } from "@/components/dashboard/types";

// Views that require Enterprise access (Axrlen & Zeeion are enterprise-only)
const ENTERPRISE_VIEWS: DashboardView[] = ["zeeion", "axrlen"];

// Views that require Pro access
const PRO_VIEWS: DashboardView[] = [
  "community", "azplen",
  "teams", "geospatial", "plugins", "timeseries",
  "audit", "predictive", "security", "tracker",
  "google", "pattern-analysis", "video-intelligence", "lavba", "cross",
  "zaplen",
];

// Views that require Aureon-tier ($199) — NOMAD, Briefings, ZANOEM Design Lab
const AUREON_VIEWS: DashboardView[] = ["nomad", "briefing", "zali", "notebooks"];

// Views that require any paid plan (search-tier)
const SEARCH_VIEWS: DashboardView[] = ["search", "imagine-intelligence", "file-scrapper", "cipher"];

// Views that require any paid plan (chat-tier minimum)
const CHAT_VIEWS: DashboardView[] = ["chat", "pdf-generator", "slideshow", "zahten"];

// Views that are always accessible to authenticated users
const PUBLIC_VIEWS: DashboardView[] = [
  "library", "snippets", "projects", "memory", "stats",
  "settings", "subscription", "persona-store",
  "self-learning", "self-access",
  "bug-reports", "ebook", "vedic-astrology",
];

export function useAccess() {
  const { tierKey, isPastDue } = useSubscription();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Donation Era: Aureon is fully free — every authenticated user gets every view.
  const canAccess = (_view: DashboardView): boolean => true;

  return { canAccess, isAdmin, tierKey, isPastDue, hasChat: true, hasSearch: true, hasAureon: true, hasPro: true, hasEnterprise: true };
}
