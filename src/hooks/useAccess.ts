import { useCallback, useMemo } from "react";
import { isAdminEmail } from "@/lib/adminEmail";
import { useSubscription, hasZophielAccess } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { trialStateFor } from "@/lib/trial";
import type { DashboardView } from "@/components/dashboard/types";

// Connected-account surfaces (Google Cloud Intelligence mesh). Included with
// the $18/mo Asherin subscription (monthly and 6-month terms) and above, but
// still evaluated ahead of the free trial: they read the operator's own linked
// accounts, so an unpaid trial never opens them.
export const CONNECTED_ACCOUNT_VIEWS: DashboardView[] = ["google"];
/** @deprecated retained for legacy imports — the mesh is no longer maximum-only. */
export const MAXIMUM_VIEWS: DashboardView[] = [];
// Strict Pro surfaces — evaluated BEFORE the trial window so a free 24h trial
// never opens them, keeping the client gate identical to the server gate
// (supabase/functions/_shared/proTierGate.ts).
const PRO_STRICT_VIEWS: DashboardView[] = ["ghost-engine"];
// Enterprise / Pro-only views
const ENTERPRISE_VIEWS: DashboardView[] = ["zeeion"];
const PRO_VIEWS: DashboardView[] = [
  "community", "azplen",
  "teams", "plugins", "timeseries",
  "audit", "predictive", "security", "tracker",
  "pattern-analysis", "video-intelligence", "lavba", "cross",
  "zaplen", "zaxin", "zerlal", "knowledge-vault", "zacoon", "bulwark", "geo-audit",
];
// Asherin ($18/mo, monthly + 6-month) and above. Asherin Maps (`geospatial`)
// ships with this tier alongside the Cloud Intelligence mesh above.
const AUREON_VIEWS: DashboardView[] = ["nomad", "briefing", "zali", "notebooks", "geospatial"];


// Zophiel Search Intelligence tab and its sibling search surfaces. Included
// with the $18/mo Asherin subscription (monthly + 6-month term) and above.
export const ZOPHIEL_VIEWS: DashboardView[] = ["search", "imagine-intelligence", "file-scrapper", "cipher"];
const SEARCH_VIEWS: DashboardView[] = ZOPHIEL_VIEWS;
const CHAT_VIEWS: DashboardView[] = ["chat", "pdf-generator", "slideshow", "zahten", "ebook", "ide", "whiteboard", "media2code"];
const PUBLIC_VIEWS: DashboardView[] = [
  "library", "snippets", "projects", "memory", "stats",
  "settings", "api-keys", "subscription", "persona-store",
  "self-learning", "self-access",
  "bug-reports", "vedic-astrology",
];

// ── KILL SWITCH ──────────────────────────────────────────────────────────────
// `true`  → paywalls enforced (admin + <24h trial bypass).
// `false` → paywalls paused (every account gets full access).
const GATING_ENABLED = true;

export function useAccess() {
  const { tierKey, isPastDue, loading: subLoading } = useSubscription();
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  const trial = useMemo(() => trialStateFor(user?.created_at), [user?.created_at]);
  const trialActive = trial.active;
  const trialEnded = trial.ended && !!user?.id;
  const trialEndsAt = trial.endsAt;

  const tier = tierKey;
  const hasChat = !!tier;
  // Zophiel Search Intelligence — bundled with the $18 Asherin subscription
  // (monthly + 6-month) and above; legacy chat holders retain their access.
  const hasSearch = hasZophielAccess(tier);
  const hasAureon = tier === "monthly_aureon" || tier === "aureon" || tier === "monthly_pro" || tier === "pro" || tier === "lifetime" || tier === "algorithm";
  const hasPro = tier === "monthly_pro" || tier === "pro" || tier === "lifetime" || tier === "algorithm";
  const hasMaximum = tier === "monthly_pro" || tier === "pro";
  const hasEnterprise = hasPro;

  const canAccess = useCallback((view: DashboardView): boolean => {
    if (!GATING_ENABLED) return true;
    if (isAdmin) return true;
    // Connected-account surfaces are evaluated before the trial and the
    // loading grace window: neither a 24h trial nor a slow subscription fetch
    // may open someone's linked Google mesh.
    if (CONNECTED_ACCOUNT_VIEWS.includes(view)) return hasAureon;
    if (PRO_STRICT_VIEWS.includes(view)) return hasPro;

    if (trialActive) return true;
    if (PUBLIC_VIEWS.includes(view)) return true;
    // Subscription still resolving — only forgive the flash for users who
    // already hold a tier (paid). Free / expired-trial users stay gated so
    // a slow network can't leak access.
    if (subLoading && !!tier) return true;
    if (CHAT_VIEWS.includes(view)) return hasChat;
    if (SEARCH_VIEWS.includes(view)) return hasSearch;
    if (AUREON_VIEWS.includes(view)) return hasAureon;
    if (PRO_VIEWS.includes(view)) return hasPro;
    if (ENTERPRISE_VIEWS.includes(view)) return hasEnterprise;
    // Unknown views default to the lowest paid tier — fail closed.
    return hasChat;
  }, [isAdmin, trialActive, subLoading, tier, hasChat, hasSearch, hasAureon, hasPro, hasMaximum, hasEnterprise]);

  return useMemo(() => ({
    canAccess, isAdmin, tierKey, isPastDue,
    hasChat, hasSearch, hasAureon, hasPro, hasMaximum, hasEnterprise,
    trialActive, trialEnded, trialEndsAt,
  }), [canAccess, isAdmin, tierKey, isPastDue, hasChat, hasSearch, hasAureon, hasPro, hasMaximum, hasEnterprise, trialActive, trialEnded, trialEndsAt]);

}
