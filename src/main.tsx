import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initDorkGuard } from "./lib/dorkGuard";

// Google-dork / recon hardening — noindex on sensitive routes, scrub
// OAuth/token query params, tighten referrer policy. Runs before render.
initDorkGuard();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);

