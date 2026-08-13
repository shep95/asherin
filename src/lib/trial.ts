// Single source of truth for the account trial window: there isn't one.
//
// Asherin publishes "no free trial" in the pricing FAQ and on every plan card.
// A 24-hour all-modules grant contradicted that in the product while the copy
// denied it, so operators saw doors open and then close with no explanation.
// The window is now zero everywhere; the shape of this module is kept so the
// gate in useAccess keeps compiling and simply never opens on a trial.
export const TRIAL_HOURS = 0;
export const TRIAL_MS = 0;

export function trialStateFor(_createdAtIso: string | undefined | null) {
  return { active: false, ended: false, endsAt: 0, msLeft: 0 };
}
