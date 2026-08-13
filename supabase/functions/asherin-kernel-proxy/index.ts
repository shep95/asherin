// asherin-kernel-proxy
//
// The vessel (asherin.com) does not hold the kernel. The kernel is a separate
// runtime that owns thinking-pattern retrieval and the heavy operator tools
// (elite dork packs, search swarm, path maps). This function is the only door
// between them.
//
// Contract:
//   POST { op: "retrieve", query, k? }          -> { ok, cards: [...] }
//   POST { op: "tool", tool, args }             -> { ok, result }
//
// Rules that are not negotiable:
//   - The caller must present a valid Supabase user JWT. No anonymous reach.
//   - ASHERIN_KERNEL_URL / ASHERIN_KERNEL_TOKEN live only in edge secrets.
//     They are never returned, logged, or echoed into a response body.
//   - If the kernel is unset or unreachable we answer, verbatim,
//     { ok: false, error: "kernel offline", fake: false }.
//     We never synthesise cards, dorks, or tool output to look busy.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const KERNEL_OFFLINE = { ok: false, error: "kernel offline", fake: false } as const;

// Tools the vessel is allowed to ask the kernel to run. Anything else is
// refused here rather than forwarded, so a compromised client cannot use this
// proxy as a generic outbound request runner (SSRF).
const ALLOWED_TOOLS = new Set([
  "elite_dorks",
  "search_swarm",
  "zophiel_search",
  "dork