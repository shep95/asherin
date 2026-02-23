import { useSubscription, hasSearchAccess, hasProAccess } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardView } from "@/components/dashboard/types";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

// Views that require Pro access
const PRO_VIEWS: DashboardView[] = [
  "zali", "community", "asha", "elion", "nomad", "briefing",
  "teams", "notebooks", "geospatial", "plugins", "timeseries",
  "audit", "predictive", "security", "imagine-to-code", "tracker",
  "google", "pattern-analysis",
];

// Views that require any paid plan (search-tier)
const SEARCH_VIEWS: DashboardView[] = ["search", "oracle-locus"];

// Views that are always accessible to authenticated users
const PUBLIC_VIEWS: DashboardView[] = [
  "chat", "library", "snippets", "projects", "memory", "stats",
  "settings", "subscription", "persona-store", "ide",
  "pdf-generator", "slideshow", "self-learning", "self-access",
];

export function useAccess() {
  const { tierKey } = useSubscription();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const canAccess = (view: DashboardView): boolean => {
    if (isAdmin) return true;
    if (PUBLIC_VIEWS.includes(view)) return true;
    if (SEARCH_VIEWS.includes(view)) return hasSearchAccess(tierKey);
    if (PRO_VIEWS.includes(view)) return hasProAccess(tierKey);
    return true; // default allow for unknown views (chat fallback)
  };

  return { canAccess, isAdmin, tierKey, hasSearch: hasSearchAccess(tierKey), hasPro: hasProAccess(tierKey) };
}
