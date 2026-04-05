import { useSubscription, hasChatAccess, hasSearchAccess, hasProAccess, hasEnterpriseOnlyAccess } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardView } from "@/components/dashboard/types";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

// Views that require Enterprise access (Axrlen & Zeeion are enterprise-only)
const ENTERPRISE_VIEWS: DashboardView[] = ["zeeion", "axrlen"];

// Views that require Pro access
const PRO_VIEWS: DashboardView[] = [
  "zali", "community", "azplen", "elion", "nomad", "briefing",
  "teams", "notebooks", "geospatial", "plugins", "timeseries",
  "audit", "predictive", "security", "imagine-to-code", "tracker",
  "google", "pattern-analysis", "video-intelligence", "lavba", "cross",
  "zaplen",
];

// Views that require any paid plan (search-tier)
const SEARCH_VIEWS: DashboardView[] = ["search", "imagine-intelligence", "notebooks", "reverse-engineer"];

// Views that require any paid plan (chat-tier minimum)
const CHAT_VIEWS: DashboardView[] = ["chat", "pdf-generator", "slideshow"];

// Views that are always accessible to authenticated users
const PUBLIC_VIEWS: DashboardView[] = [
  "library", "snippets", "projects", "memory", "stats",
  "settings", "subscription", "persona-store",
  "self-learning", "self-access",
  "bug-reports", "ebook",
];

export function useAccess() {
  const { tierKey, isPastDue } = useSubscription();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const canAccess = (view: DashboardView): boolean => {
    if (isAdmin) return true;
    // If payment failed, only allow public views (settings, subscription, etc.)
    if (isPastDue) return PUBLIC_VIEWS.includes(view);
    if (PUBLIC_VIEWS.includes(view)) return true;
    if (ENTERPRISE_VIEWS.includes(view)) return hasEnterpriseOnlyAccess(tierKey);
    if (CHAT_VIEWS.includes(view)) return hasChatAccess(tierKey);
    if (SEARCH_VIEWS.includes(view)) return hasSearchAccess(tierKey);
    if (PRO_VIEWS.includes(view)) return hasProAccess(tierKey);
    // IDE, personas, etc. require aureon+ tier
    if (!PUBLIC_VIEWS.includes(view) && !CHAT_VIEWS.includes(view)) return hasSearchAccess(tierKey);
    return true;
  };

  return { canAccess, isAdmin, tierKey, isPastDue, hasChat: hasChatAccess(tierKey), hasSearch: hasSearchAccess(tierKey), hasPro: hasProAccess(tierKey), hasEnterprise: hasEnterpriseOnlyAccess(tierKey) };
}
