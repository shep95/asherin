import { isAdminEmail } from "@/lib/adminEmail";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardView } from "@/components/dashboard/types";

// Enterprise / Pro-only views
const ENTERPRISE_VIEWS: DashboardView[] = ["zeeion", "axrlen"];
const PRO_VIEWS: DashboardView[] = [
  "community", "azplen",
  "teams", "geospatial", "plugins", "timeseries",
  "audit", "predictive", "security", "tracker",
  "google", "pattern-analysis", "video-intelligence", "lavba", "cross",
  "zaplen", "zaxin", "zerlal",
];
const AUREON_VIEWS: DashboardView[] = ["nomad", "briefing", "zali", "notebooks"];
const SEARCH_VIEWS: DashboardView[] = ["search", "imagine-intelligence", "file-scrapper", "cipher"];
const CHAT_VIEWS: DashboardView[] = ["chat", "pdf-generator", "slideshow", "zahten", "ebook", "ide", "whiteboard", "media2code"];
const PUBLIC_VIEWS: DashboardView[] = [
  "library", "snippets", "projects", "memory", "stats",
  "settings", "api-keys", "subscription", "persona-store",
  "self-learning", "self-access",
  "bug-reports", "vedic-astrology",
];

const TRIAL_HOURS = 24;

// ── KILL SWITCH ──────────────────────────────────────────────────────────────
// Set to `false` to PAUSE all paywalls (every account gets full access,
// regardless of tier or trial age). Flip back to `true` to re-enable gating.
const GATING_ENABLED = false;

export function useAccess() {
  const { tierKey, isPastDue, loading: subLoading } = useSubscription();
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  // 24-hour free-trial window from account creation timestamp.
  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
  const trialActive = createdAt > 0 && (Date.now() - createdAt) < TRIAL_HOURS * 3600 * 1000;
  const trialEndsAt = createdAt > 0 ? createdAt + TRIAL_HOURS * 3600 * 1000 : 0;

  // Tier ladder: lifetime/monthly_pro/pro > monthly_aureon/aureon > chat > free
  const tier = tierKey;
  const hasChat = !!tier;
  const hasSearch = !!tier;
  const hasAureon = tier === "monthly_aureon" || tier === "aureon" || tier === "monthly_pro" || tier === "pro" || tier === "lifetime" || tier === "algorithm";
  const hasPro = tier === "monthly_pro" || tier === "pro" || tier === "lifetime" || tier === "algorithm";
  const hasEnterprise = tier === "monthly_pro" || tier === "pro" || tier === "lifetime" || tier === "algorithm";

  const canAccess = (view: DashboardView): boolean => {
    if (!GATING_ENABLED) return true; // ← paywalls paused
    if (isAdmin) return true;
    if (trialActive) return true;
    // Permissive while subscription state is still loading — avoids a 1s
    // paywall flash for paying users on reload.
    if (subLoading) return true;
    if (PUBLIC_VIEWS.includes(view)) return true;
    if (CHAT_VIEWS.includes(view)) return hasChat;
    if (SEARCH_VIEWS.includes(view)) return hasSearch;
    if (AUREON_VIEWS.includes(view)) return hasAureon;
    if (PRO_VIEWS.includes(view)) return hasPro;
    if (ENTERPRISE_VIEWS.includes(view)) return hasEnterprise;
    // Unknown views — allow (avoid accidental lock-out on new modules).
    return true;
  };

  return {
    canAccess, isAdmin, tierKey, isPastDue,
    hasChat, hasSearch, hasAureon, hasPro, hasEnterprise,
    trialActive, trialEndsAt,
  };
}
