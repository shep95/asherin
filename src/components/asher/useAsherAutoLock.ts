import { useEffect, useRef } from "react";
import { logAsherEvent } from "@/lib/asherAudit";

const ACTIVITY_KEY = "asher_last_activity";
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useAsherAutoLock(onLock: () => void) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const reset = () => {
      try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch {}
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        logAsherEvent("session_locked", { reason: "inactivity_15m" });
        onLock();
      }, TIMEOUT_MS) as unknown as number;
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_KEY) reset();
    };
    window.addEventListener("storage", onStorage);

    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      window.removeEventListener("storage", onStorage);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [onLock]);
}
