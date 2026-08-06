/**
 * Google consent launcher.
 *
 * Google refuses to render accounts.google.com inside a frame — an embedded
 * navigation returns a bare "403. That's an error… you do not have access to
 * this page." Every Asherin surface runs inside the Lovable preview iframe, so
 * assigning `window.location.href = consentUrl` navigates the *frame* and the
 * user hits that 403 instead of the account chooser.
 *
 * The consent screen must therefore be reached in a top-level browsing
 * context. Three strategies, in descending preference:
 *
 *   1. A named popup — always top-level, keeps the app mounted behind it, and
 *      lets the popup report the outcome back to its opener.
 *   2. Top-frame navigation — used when the popup is blocked and the embedder
 *      permits top navigation by user activation.
 *   3. Same-frame navigation — the legacy path; correct when the app is not
 *      framed at all, and a last resort otherwise.
 */

export const GOOGLE_POPUP_NAME = "asherin-google-consent";

export type GoogleConsentResult =
  | { status: "connected"; email?: string }
  | { status: "failed"; message: string }
  | { status: "dismissed" }
  | { status: "navigated" };

const isFramed = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin top means we are definitively framed.
    return true;
  }
};

/**
 * Send the user through Google consent and resolve with the outcome.
 *
 * Resolves `navigated` when the whole document is being replaced — the caller
 * is about to unmount, so it must not show a "finished" state in that case.
 */
export function openGoogleConsent(url: string): Promise<GoogleConsentResult> {
  const popup = window.open(url, GOOGLE_POPUP_NAME, "width=520,height=680,noopener=no,noreferrer=no");

  if (!popup || popup.closed) {
    // Popup blocked. Escape the frame instead so Google is still top-level.
    if (isFramed()) {
      try {
        // Cross-origin top navigation is permitted with user activation, which
        // is present because this runs from a click handler.
        window.top!.location.href = url;
        return Promise.resolve({ status: "navigated" });
      } catch {
        /* embedder forbids it — fall through */
      }
    }
    window.location.href = url;
    return Promise.resolve({ status: "navigated" });
  }

  try {
    popup.focus();
  } catch {
    /* focus is a courtesy, never a failure */
  }

  return new Promise<GoogleConsentResult>((resolve) => {
    let settled = false;
    const finish = (result: GoogleConsentResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(watchdog);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      // The popup is same-origin on return; anything else is untrusted noise.
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== "asherin:google-consent") return;
      finish(
        payload.ok
          ? { status: "connected", email: payload.email }
          : { status: "failed", message: String(payload.message || "Google rejected the authorization.") },
      );
      try {
        popup.close();
      } catch {
        /* already closed */
      }
    };
    window.addEventListener("message", onMessage);

    // The user can close the popup without deciding; poll so the caller's
    // spinner is never orphaned.
    const watchdog = window.setInterval(() => {
      if (popup.closed) finish({ status: "dismissed" });
    }, 600);
  });
}

/** True when the current document is the consent popup reporting back. */
export function isConsentPopup(): boolean {
  try {
    return Boolean(window.opener) && window.name === GOOGLE_POPUP_NAME;
  } catch {
    return false;
  }
}

/** Report the exchange outcome to the opener and close the popup. */
export function reportConsentResult(result: { ok: boolean; email?: string; message?: string }): void {
  try {
    window.opener?.postMessage({ type: "asherin:google-consent", ...result }, window.location.origin);
  } catch {
    /* opener gone — closing still leaves the app in a sane state */
  }
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      /* browser refused; the callback hook already stripped the code */
    }
  }, 120);
}
