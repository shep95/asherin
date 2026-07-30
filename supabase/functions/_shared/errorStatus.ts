// Maps a thrown error to the HTTP status it actually deserves.
//
// Several functions funnel every failure — including "you are not signed in"
// and "you sent no payload" — through a single catch that answered 500. The
// dashboard then rendered "server error" for what is really a sign-in prompt
// or a bad request, which made healthy software look broken. Callers keep
// their existing catch block and just ask for the status.

const AUTH_PATTERNS = [
  /not authenticated/i,
  /auth failed/i,
  /auth error/i,
  /authentication error/i,
  /unauthorized/i,
  /missing sub claim/i,
  /invalid (jwt|token|claim)/i,
  /no session/i,
];

const BAD_REQUEST_PATTERNS = [
  /missing .*(payload|body|parameter|field)/i,
  /required/i,
  /invalid (input|body|payload|request)/i,
  /must be/i,
];

export function statusForError(e: unknown, fallback = 500): number {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (!msg) return fallback;
  if (AUTH_PATTERNS.some((r) => r.test(msg))) return 401;
  if (BAD_REQUEST_PATTERNS.some((r) => r.test(msg))) return 400;
  return fallback;
}
