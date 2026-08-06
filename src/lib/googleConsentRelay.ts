/**
 * Pre-render consent relay.
 *
 * The OAuth client registers exactly one redirect URI, so consent always
 * returns to the canonical origin — which is frequently *not* the origin the
 * user is signed in on (editor preview, preview subdomain, www vs apex).
 * `localStorage` is per-origin, so the returning document genuinely has no
 * session and cannot exchange the code; worse, the app's auth guard would
 * bounce it to the sign-in route and the code would be lost.
 *
 * This runs before React mounts: if this document is the consent popup and the
 * launching origin is carried in `state`, the code is handed to the opener —
 * which holds the session — and the popup closes. Nothing renders.
 */
import { GOOGLE_POPUP_NAME } from "@/lib/googleConsent";
import { isTrustedAppOrigin } from "@/lib/googleRedirect";

export function relayGoogleConsentIfPopup(): boolean {
  let opener: Window | null = null;
  try {
    if (window.name !== GOOGLE_POPUP_NAME) return false;
    opener = window.opener as Window | null;
    if (!opener) return false;
  } catch {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (!code && !error) return false;

  let target = "";
  if (state) {
    try {
      const parsed = JSON.parse(atob(state));
      if (typeof parsed?.origin === "string") target = parsed.origin;
    } catch {
      /* opaque state — fall through to the same-origin path */
    }
  }
  // Same origin means the mounted app can exchange the code itself.
  if (!target || target === window.location.origin || !isTrustedAppOrigin(target)) return false;

  // The URL must never keep a live authorization code, even for the instant
  // before this window closes.
  window.history.replaceState({}, "", window.location.pathname);

  try {
    opener.postMessage(
      error
        ? { type: "asherin:google-consent", ok: false, message: error }
        : { type: "asherin:google-consent-code", code, state },
      target,
    );
  } catch {
    return false;
  }

  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      /* browser refused — the blank document is harmless */
    }
  }, 120);
  return true;
}
