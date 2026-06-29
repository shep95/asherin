import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateSessionActivity } from "@/utils/sessionTracker";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the user's current pathname into user_sessions on every route change,
 * AND logs page_view_events with a duration so analytics can compute
 * average time spent per page/software.
 *
 * Perf notes:
 *  - All DB writes are deferred via requestIdleCallback so they never block
 *    a route transition's render. Navigation feel stays at frame budget.
 *  - The visibilitychange listener is now stored in a ref and removed on
 *    unmount (previously leaked one listener per app load).
 *  - finalize() short-circuits when no event is open, avoiding redundant work.
 */
export default function RouteSessionTracker() {
  const location = useLocation();
  const { user, session } = useAuth();
  const currentEvent = useRef<{ id: string; path: string; enteredAt: number } | null>(null);

  // Defer non-critical work off the navigation critical path.
  const defer = (fn: () => void) => {
    const ric: ((cb: () => void) => number) | undefined =
      (window as any).requestIdleCallback;
    if (ric) ric(fn);
    else setTimeout(fn, 0);
  };

  // Finalize duration when leaving a page (fire-and-forget).
  const finalize = () => {
    const ev = currentEvent.current;
    if (!ev) return;
    currentEvent.current = null;
    const seconds = Math.max(0, Math.round((Date.now() - ev.enteredAt) / 1000));
    if (seconds < 1) return;
    defer(() => {
      supabase
        .from("page_view_events")
        .update({ duration_seconds: seconds })
        .eq("id", ev.id)
        .then(() => {}, () => {});
    });
  };

  useEffect(() => {
    if (!user || !session) return;

    const sid = user.id + "_" + (session.access_token?.substring(0, 8) || "x");
    // Fire-and-forget; never await session activity from a route effect.
    defer(() => updateSessionActivity(user.id, sid, location.pathname));

    // Close out previous page event
    finalize();

    // Open a new page event off the critical path.
    const enteredAt = Date.now();
    defer(() => {
      supabase
        .from("page_view_events")
        .insert({
          user_id: user.id,
          path: location.pathname,
          entered_at: new Date(enteredAt).toISOString(),
          duration_seconds: 0,
        })
        .select("id")
        .single()
        .then(
          ({ data, error }) => {
            if (!error && data) {
              currentEvent.current = { id: data.id, path: location.pathname, enteredAt };
            }
          },
          () => {},
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user, session]);

  // Finalize on tab close / visibility change — with proper cleanup so we
  // don't leak handlers on hot reload or remount.
  useEffect(() => {
    const onUnload = () => finalize();
    const onVisibility = () => { if (document.hidden) finalize(); };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      finalize();
    };
  }, []);

  return null;
}
