import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import type { SearchResult } from "../types";

export type IntelAnalysisType =
  | "temporal"
  | "credibility"
  | "factcheck"
  | "narrative"
  | "investigative";

export function useIntelAnalysis<T = any>(type: IntelAnalysisType) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (query: string, results: SearchResult[]) => {
      setLoading(true);
      setError(null);
      try {
        const byok = getActiveIntelMapByok();
        const { data: res, error: invErr } = await supabase.functions.invoke(
          "zophiel-intel-analysis",
          {
            body: {
              type,
              query,
              results: results.slice(0, 20).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                source: r.source,
                tier: r.tier,
                publishDate: r.publishDate,
              })),
              ...(byok ? { byok } : {}),
            },
          },
        );
        if (invErr) throw invErr;
        if (!res?.success) throw new Error(res?.error || "Analysis failed");
        setData(res.analysis as T);
      } catch (e: any) {
        console.error(`[intel:${type}]`, e);
        setError(e?.message || "Analysis failed");
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  return { data, loading, error, run, reset: () => { setData(null); setError(null); } };
}
