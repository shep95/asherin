import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateSessionActivity } from "@/utils/sessionTracker";

/**
 * Tracks the user's current pathname into user_sessions on every route change,
 * so the analytics dashboard can compute "active sessions" by page.
 */
export default function RouteSessionTracker() {
  const location = useLocation();
  const { user, session } = useAuth();

  useEffect(() => {
    if (!user || !session) return;
    const sid = user.id + "_" + (session.access_token?.substring(0, 8) || "x");
    updateSessionActivity(user.id, sid, location.pathname);
  }, [location.pathname, user, session]);

  return null;
}
