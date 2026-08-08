import { useEffect } from "react";
import { bootSentinel } from "@/lib/sentinel/alwaysOn";

/**
 * Mounts once inside the authenticated shell and hands control to the always-on
 * sentinel daemon. Renders nothing: protection should not depend on a tab being
 * open, a module being selected, or a button being pressed.
 */
const SentinelDaemon = () => {
  useEffect(() => { bootSentinel(); }, []);
  return null;
};

export default SentinelDaemon;
