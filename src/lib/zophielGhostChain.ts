// zophielGhostChain.ts — thin client for the ported Zophiel v2 pipeline.
// Called by ZophielEngineView (ghostchain mode) AND by Aureon/Asher chat
// handlers whenever they need to scrape/analyze a URL rather than a file.
//
// Upstream: supabase/functions/zophiel-ghostchain/index.ts
// Repo of origin: https://github.com/shep95/zophiel_search_engine.v2 (MIT)

import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

export interface GhostChainEntity {
  text: string;
  type: "person" | "organization" | "location";
  confidence: number;
}
export interface GhostChainSegment {
  text: string;
  entropy: number;
  selector: string;
  source: string;
}
export interface GhostChainReport {
  success: true;
  mode: "local" | "remote";
  target: string;
  title: string;
  snippet: string;
  keywords: string[];
  entities: GhostChainEntity[];
  links: string[];
  segments: GhostChainSegment[];
  /** Markdown-formatted intelligence report. Empty string when no Gemini key is available. */
  report: string;
  warnings: string[];
}

async function ghostChainError(error: unknown, data: unknown): Promise<Error> {
  let payload = data && typeof data === "object" ? data as { error?: string; message?: string; retryAfterMs?: number } : null;
  const context = error && typeof error === "object" && "context" in error ? (error as { context?: unknown }).context : null;
  if (!payload && context instanceof Response) {
    try {
      payload = await context.clone().json() as { error?: string; message?: string; retryAfterMs?: number };
    } catch { /* retain the transport error below */ }
  }
  const code = payload?.error || (error instanceof Error ? error.message : "Ghost Chain failed");
  const messages: Record<string, string> = {
    UPSTREAM_TIMEOUT: "The target did not respond in time. Try again shortly.",
    UPSTREAM_NETWORK: "The target could not be reached from the analysis network.",
    UPSTREAM_TOO_MANY_REDIRECTS: "The target is trapped in a redirect loop.",
    BLOCKED_HOST: "Private and local network addresses cannot be investigated.",
  };
  if (code.startsWith("UPSTREAM_HTTP_")) {
    const status = code.slice("UPSTREAM_HTTP_".length);
    return new Error(`The target refused the scan or is temporarily unavailable (HTTP ${status}).`);
  }
  if (code.startsWith("UNSUPPORTED_CONTENT_TYPE:")) {
    return new Error("This Ghost Chain scanner currently accepts web pages and plain-text URLs. Use Origin Upload for documents.");
  }
  if (payload?.retryAfterMs) return new Error(`The target is rate-limiting requests. Retry in ${Math.ceil(payload.retryAfterMs / 1000)} seconds.`);
  return new Error(messages[code] || payload?.message || code);
}

export async function ghostChainScrape(url: string, opts?: { forceLocal?: boolean; query?: string }): Promise<GhostChainReport> {
  const byok = getActiveIntelMapByok();
  const { data, error } = await supabase.functions.invoke("zophiel-ghostchain", {
    body: {
      url,
      ...(opts?.forceLocal ? { forceLocal: true } : {}),
      ...(opts?.query ? { query: opts.query } : {}),
      ...(byok ? { byok } : {}),
    },
  });
  if (error || !data?.success) throw await ghostChainError(error, data);
  return data as GhostChainReport;
}
