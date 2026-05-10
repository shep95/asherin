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

// Desktop-only: auto-open /openvpn in a new tab once per session
try {
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isDesktop && !sessionStorage.getItem("__openvpn_opened__") && window.location.pathname !== "/openvpn") {
    sessionStorage.setItem("__openvpn_opened__", "1");
    window.open("/openvpn", "_blank", "noopener,noreferrer");
  }
} catch {
  // ignore
}

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
