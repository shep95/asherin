// Centralized admin identity for client-side UI gating.
// NOTE: This is only used for cosmetic UI decisions (showing admin tabs, etc.).
// Real authorization is enforced server-side via the `is_admin_user(uuid)` SQL
// function and RLS policies — never trust this constant for security.
export const ADMIN_EMAIL = "ashernewtonx@gmail.com";

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL;
