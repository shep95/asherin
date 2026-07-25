// zophielGhostChain.ts — thin client for the ported Zophiel v2 pipeline.
// Called by ZophielEngineView (ghostchain mode) AND by Asherin/Asher chat
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
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? "Ghost Chain failed");
  return data as GhostChainReport;
}
