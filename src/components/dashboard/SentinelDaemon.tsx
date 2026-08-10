import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { bootSentinel } from "@/lib/sentinel/alwaysOn";
import { bootOpLayer } from "@/lib/op/opDaemon";

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
    // The OP layer arms itself the moment a session exists on ANY device:
    // protection is scoped to the account, so it must not wait for the
    // operator to open the panel that reports it.
    bootOpLayer();
  }, [user]);
  return null;
};

export default SentinelDaemon;
