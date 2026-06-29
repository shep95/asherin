// Single source of truth for the new-account free-trial window.
// Used by useAccess (gating) and NewAccountWelcomeModal (countdown).
export const TRIAL_HOURS = 24;
export const TRIAL_MS = TRIAL_HOURS * 3600 * 1000;

export function trialStateFor(createdAtIso: string | undefined | null) {
  if (!createdAtIso) return { active: false, ended: false, endsAt: 0, msLeft: 0 };
  const created = new Date(createdAtIso).getTime();
  if (!Number.isFinite(created) || created <= 0) {
    return { active: false, ended: false, endsAt: 0, msLeft: 0 };
  }
  const endsAt = created + TRIAL_MS;
  const msLeft = endsAt - Date.now();
  return { active: msLeft > 0, ended: msLeft <= 0, endsAt, msLeft: Math.max(0, msLeft) };
}
