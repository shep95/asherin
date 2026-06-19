// Single source of truth for cross-function constants.
// Importing from here prevents drift between authMiddleware and adminGate.

// Admin emails (lowercase, normalized). Override via env in staging/test.
const _adminEnv =
  (Deno.env.get("AUREON_ADMIN_EMAIL") ||
    "ashernewtonx@gmail.com,shepherdnewtonx@gmail.com,28numberofmoney@gmail.com").toLowerCase();

export const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  _adminEnv.split(",").map((s) => s.trim()).filter(Boolean),
);

export const isAdminEmail = (email: string | null | undefined): boolean =>
  !!email && ADMIN_EMAILS.has(email.toLowerCase());
