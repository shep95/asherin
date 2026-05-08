import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto hard-refresh once per browser session on first app open (all devices)
try {
  if (!sessionStorage.getItem("__auto_refreshed__")) {
    sessionStorage.setItem("__auto_refreshed__", "1");
    window.location.reload();
  }
} catch {
  // sessionStorage unavailable — skip auto-refresh
}

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
