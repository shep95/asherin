import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import RootErrorBoundary, { attemptChunkRecovery } from "./components/RootErrorBoundary";
import "./index.css";
import { initDorkGuard } from "./lib/dorkGuard";
import { enforceCanonicalHost } from "./lib/canonicalHost";
import { relayGoogleConsentIfPopup } from "./lib/googleConsentRelay";
import { migrateLegacyStorageKeys } from "./lib/storageKeyMigration";

// Duplicate hostnames serving identical HTML let Google choose its own
// canonical. Send them to https://asherin.com before anything else runs, so a
// crawler on a duplicate host never gets a 200 with indexable content.
enforceCanonicalHost();

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

  // A rejected dynamic import outside a render pass never reaches a boundary;
  // catch it here so a stale deploy self-heals instead of blanking the tab.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason instanceof Error) attemptChunkRecovery(reason);
  });

  createRoot(document.getElementById("root")!).render(
    <RootErrorBoundary scope="root">
      <App />
    </RootErrorBoundary>
  );
}

