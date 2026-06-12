import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ScanProgress } from "./useZerlalData";
import type { ZerlalFinding } from "./types";

export interface NarrativeEntry {
  index: number;
  finding: Partial<ZerlalFinding> & {
    severity: string;
    title: string;
    file_path?: string | null;
    line_number?: number;
    code_snippet?: string;
    description?: string;
    impact?: string;
    suggested_fix?: string;
    cwe_id?: string;
    cvss_score?: number;
  };
  story: string;
  receivedAt: number;
}

export interface InputStats {
  fileName: string;
  fileCount: number;
  totalBytes: number;
  scanProfile: string;
  sourceType: string;
}

export interface ActiveScanState {
  projectId: string;
  projectName: string;
  startedAt: number;
  input: InputStats;
  progress: ScanProgress | null;
  liveFindings: NarrativeEntry[];
  status: "running" | "complete" | "failed";
  error?: string;
  finalCount?: number;
}

interface ScanContextValue {
  active: ActiveScanState | null;
  startScan: (args: {
    projectId: string;
    projectName: string;
    codeContent: string;
    fileName: string;
    scanProfile: string;
    sourceType: string;
    fileCount: number;
    githubUrl?: string;
  }) => void;
  cancelScan: () => void;
  clear: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

const severityStory = (sev: string) => {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return "This one bites first. Left as-is, an attacker walks straight in.";
  if (s === "high") return "Serious exposure. Treat this as a near-term breach risk.";
  if (s === "medium") return "Real weakness — exploitable when chained with anything else here.";
  if (s === "low") return "Minor surface, but it widens the blast radius if ignored.";
  return "Hygiene issue. Clean it up before it ages into a real bug.";
};

const buildStory = (f: NarrativeEntry["finding"]): string => {
  const where = f.file_path ? `${f.file_path}${f.line_number ? `:${f.line_number}` : ""}` : "an unspecified location";
  const why = f.impact || f.description || "creates an exploitable condition";
  const sev = severityStory(f.severity);
  return `Found in ${where}. ${why}. ${sev}`;
};

export const ScanProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<ActiveScanState | null>(null);
  const activeRef = useRef<ActiveScanState | null>(null);
  activeRef.current = active;
  const abortRef = useRef<AbortController | null>(null);
  const canceledRef = useRef<boolean>(false);

  const update = useCallback((patch: Partial<ActiveScanState>) => {
    setActive(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const pushFindings = useCallback((findings: any[]) => {
    if (!findings || findings.length === 0) return;
    setActive(prev => {
      if (!prev) return prev;
      const start = prev.liveFindings.length;
      const entries: NarrativeEntry[] = findings.map((f, i) => ({
        index: start + i + 1,
        finding: f,
        story: buildStory(f),
        receivedAt: Date.now(),
      }));
      return { ...prev, liveFindings: [...prev.liveFindings, ...entries] };
    });
  }, []);

  const callPhase = async (body: Record<string, unknown>, timeoutMs = 90_000) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const controller = abortRef.current ?? new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/zerlal-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await resp.text();
      let parsed: any = {};
      try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: raw }; }
      if (!resp.ok) throw new Error(parsed?.error || parsed?.message || `Status ${resp.status}`);
      if (parsed?.error) throw new Error(parsed.error);
      return parsed;
    } finally {
      clearTimeout(to);
    }
  };

  const sleepWithCountdown = async (seconds: number, onTick: (remaining: number) => void) => {
    for (let r = seconds; r > 0; r--) {
      if (canceledRef.current) throw new DOMException("Canceled", "AbortError");
      onTick(r);
      await new Promise(res => setTimeout(res, 1000));
    }
  };

  const runScanInternal = async (args: {
    projectId: string;
    codeContent: string;
    fileName: string;
    scanProfile: string;
    githubUrl?: string;
  }) => {
    const baseBody = {
      project_id: args.projectId,
      scan_profile: args.scanProfile,
      code_content: args.codeContent,
      file_name: args.fileName,
      github_url: args.githubUrl || undefined,
    };
    try {
      update({ progress: { phase: "planning", section: 0, totalSections: 1, percent: 4, message: "Unpacking source and detecting language…" } });
      const plan = await callPhase({ ...baseBody, mode: "plan" }, 90_000);
      const totalSections: number = plan.total_sections || 1;
      const breakSeconds: number = plan.break_seconds || 15;
      const profile = plan.provider_profile;
      const scanId: string = plan.scan_id;
      const providerLabel: string = profile?.provider_label || "auto";

      update({
        progress: {
          phase: "scanning",
          section: 0,
          totalSections,
          percent: 8,
          message: `Plan ready · ${totalSections} section${totalSections > 1 ? "s" : ""} via ${providerLabel}`,
          providerLabel,
          breakSeconds,
        },
      });

      let aggregated: any[] = [];
      let firstSummary = "";
      let firstRisk = "F";
      for (let i = 0; i < totalSections; i++) {
        const sectionPct = 10 + Math.floor((i / totalSections) * 75);
        update({
          progress: {
            phase: "scanning", section: i + 1, totalSections, percent: sectionPct,
            message: `Reading section ${i + 1} of ${totalSections} — walking call graph…`,
            providerLabel, breakSeconds, findingsSoFar: aggregated.length,
          },
        });
        const sec = await callPhase({
          ...baseBody, mode: "section", scan_id: scanId,
          section_index: i, total_sections: totalSections, provider_profile: profile,
        }, Math.max(120_000, (profile?.section_timeout_ms || 60_000) + 30_000));

        if (Array.isArray(sec.findings) && sec.findings.length > 0) {
          aggregated = aggregated.concat(sec.findings);
          pushFindings(sec.findings);
        }
        if (i === 0) { firstSummary = sec.summary || ""; firstRisk = sec.risk_grade || "F"; }
        const donePct = 10 + Math.floor(((i + 1) / totalSections) * 75);
        update({
          progress: {
            phase: "scanning", section: i + 1, totalSections, percent: donePct,
            message: `Section ${i + 1} done · ${aggregated.length} issue${aggregated.length === 1 ? "" : "s"} so far`,
            providerLabel, breakSeconds, findingsSoFar: aggregated.length,
          },
        });
        if (i < totalSections - 1) {
          await sleepWithCountdown(breakSeconds, remaining => {
            update({
              progress: {
                phase: "scanning", section: i + 1, totalSections, percent: donePct,
                message: `Cooling provider · resuming in ${remaining}s`,
                providerLabel, breakSeconds, breakRemaining: remaining,
                findingsSoFar: aggregated.length,
              },
            });
          });
        }
      }

      update({
        progress: {
          phase: "finalizing", section: totalSections, totalSections, percent: 92,
          message: "Deduplicating, scoring, writing report…",
          providerLabel, findingsSoFar: aggregated.length,
        },
      });
      const final = await callPhase({
        ...baseBody, mode: "finalize", scan_id: scanId,
        aggregated_findings: aggregated,
        first_pass_summary: firstSummary, first_pass_risk_grade: firstRisk,
        provider_profile: profile,
      }, 180_000);

      update({
        progress: {
          phase: "complete", section: totalSections, totalSections, percent: 100,
          message: `Scan complete · ${final.findings_count} vulnerabilities`,
          providerLabel, findingsSoFar: final.findings_count,
        },
        status: "complete",
        finalCount: final.findings_count,
      });
      toast.success(`Scan complete: ${final.findings_count} vulnerabilities`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      update({ status: "failed", error: msg });
      toast.error("Scan failed: " + msg);
    }
  };

  const startScan: ScanContextValue["startScan"] = useCallback(args => {
    setActive({
      projectId: args.projectId,
      projectName: args.projectName,
      startedAt: Date.now(),
      input: {
        fileName: args.fileName,
        fileCount: args.fileCount,
        totalBytes: args.codeContent?.length || 0,
        scanProfile: args.scanProfile,
        sourceType: args.sourceType,
      },
      progress: null,
      liveFindings: [],
      status: "running",
    });
    // fire and forget
    void runScanInternal({
      projectId: args.projectId,
      codeContent: args.codeContent,
      fileName: args.fileName,
      scanProfile: args.scanProfile,
      githubUrl: args.githubUrl,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = useCallback(() => setActive(null), []);

  return (
    <ScanContext.Provider value={{ active, startScan, clear }}>
      {children}
    </ScanContext.Provider>
  );
};

export const useActiveScan = () => {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useActiveScan must be used within ScanProvider");
  return ctx;
};
