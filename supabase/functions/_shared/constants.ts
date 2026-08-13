// Single source of truth for cross-function constants.
// Importing from here prevents drift between authMiddleware and adminGate.
//
// There is no address list here. Staff recognition is a SHA-256 digest match
// (see identityHash.ts) so no mailbox is ever committed to the repository or
// shipped in a bundle. Override the digest set with ASHERIN_STAFF_SHA256 —
// comma-separated sha256 hex of canonical addresses.

export {
  emailHash,
  canonicalizeEmail,
  isStaffEmail,
  isInternalProEmail,
  INTERNAL_PRO_PRODUCT_ID,
  STAFF_HASHES,
  INTERNAL_PRO_HASHES,
} from "./identityHash.ts";

import { isStaffEmail } from "./identityHash.ts";

/**
 * Staff identity check. Kept under the historical name so the ~15 functions
 * that gate internal surfaces do not each grow their own copy of the rule.
 * This grants internal UI and platform-key routing — NOT paid entitlement.
 */
export const isAdminEmail = (email: string | null | undefined): boolean => isStaffEmail(email);
