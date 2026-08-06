import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initDorkGuard } from "./lib/dorkGuard";
import { relayGoogleConsentIfPopup } from "./lib/googleConsentRelay";
import { migrateLegacyStorageKeys } from "./lib/storageKeyMigration";

// Carry pre-rename `asherin_*` localStorage values over to `aureon_*` before
// anything reads them, so personas/preferences survive the rename.
migrateLegacyStorageKeys();

// Google-dork / recon hardening — noindex on sensitive routes, scrub
// OAuth/token query params, tighten referrer policy. Runs before render.
initDorkGuard();

// Google consent returns to one registered redirect origin, which is often not
// the origin the user is signed in on. When that happens the popup has no
// session and must hand the authorization code straight back to its opener —
// before the app mounts, so an auth guard can never redirect the code away.
const relayed = relayGoogleConsentIfPopup();

if (!relayed) {
  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

