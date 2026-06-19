// Centralized admin identity for client-side UI gating.
// NOTE: This is only used for cosmetic UI decisions (showing admin tabs, etc.).
// Real authorization is enforced server-side via the `is_admin_user(uuid)` SQL
// function and RLS policies — never trust these constants for security.

/** Primary admin (platform owner). Identity references throughout the codebase. */
export const ADMIN_EMAIL = "ashernewtonx@gmail.com";

/** All authorized admin emails. Add new admins here. */
export const ADMIN_EMAILS: readonly string[] = [
  "ashernewtonx@gmail.com",
  "shepherdnewtonx@gmail.com",
  "28numberofmoney@gmail.com",
];

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());
