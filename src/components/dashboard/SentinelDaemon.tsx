import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { bootSentinel } from "@/lib/sentinel/alwaysOn";

/**
 * Mounts once inside the app shell and hands control to the always-on sentinel
 * daemon. Renders nothing, sits above the router, and boots the moment a session
 * exists: protection must not depend on which page is open, which tab is
 * selected, or on the user remembering to press anything.
 *
 * Gated on an authenticated session so an anonymous visitor on the marketing
 * site is never asked for location or notification permission.
 */
const SentinelDaemon = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    bootSentinel();
  }, [user]);
  return null;
};

export default SentinelDaemon;
