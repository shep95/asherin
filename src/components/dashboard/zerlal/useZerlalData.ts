import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ZerlalProject, ZerlalFinding, ZerlalScan } from "./types";

export const useZerlalProjects = () => {
  const [projects, setProjects] = useState<ZerlalProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("zerlal_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setProjects((data || []) as unknown as ZerlalProject[]);
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return { projects, loading, refetch: fetchProjects };
};

export const useZerlalFindings = (projectId?: string | null) => {
  const [findings, setFindings] = useState<ZerlalFinding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFindings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("zerlal_findings")
        .select("*")
        .eq("user_id", user.id)
        .order("cvss_score", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      // No limit - show ALL findings
      const { data, error } = await query;
      if (error) throw error;
      setFindings((data || []) as unknown as ZerlalFinding[]);
    } catch (e) {
      console.error("Failed to fetch findings:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchFindings(); }, [fetchFindings]);

  return { findings, loading, refetch: fetchFindings };
};

export const useZerlalScans = (projectId?: string | null) => {
  const [scans, setScans] = useState<ZerlalScan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("zerlal_scans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (projectId) query = query.eq("project_id", projectId);

      const { data, error } = await query;
      if (error) throw error;
      setScans((data || []) as unknown as ZerlalScan[]);
    } catch (e) {
      console.error("Failed to fetch scans:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  return { scans, loading, refetch: fetchScans };
};

export const useCreateProject = () => {
  const [creating, setCreating] = useState(false);

  const createProject = async (name: string, sourceType: string, repoUrl?: string): Promise<ZerlalProject | null> => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("zerlal_projects")
        .insert({
          user_id: user.id,
          name,
          source_type: sourceType,
          repo_url: repoUrl || null,
          status: "idle",
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ZerlalProject;
    } catch (e) {
      console.error("Failed to create project:", e);
      toast.error("Failed to create project");
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { createProject, creating };
};

export const useRunScan = () => {
  const [scanning, setScanning] = useState(false);

  const runScan = async (projectId: string, codeContent: string, fileName: string, scanProfile?: string, githubUrl?: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("zerlal-scan", {
        body: {
          project_id: projectId,
          scan_profile: scanProfile || "security-audit",
          code_content: codeContent,
          file_name: fileName,
          github_url: githubUrl || undefined,
        },
      });

      if (error) throw error;
      
      toast.success(`Scan complete: ${data.findings_count} vulnerabilities found`);
      return data;
    } catch (e) {
      console.error("Scan failed:", e);
      toast.error("Scan failed: " + (e instanceof Error ? e.message : "Unknown error"));
      return null;
    } finally {
      setScanning(false);
    }
  };

  return { runScan, scanning };
};

export const useUpdateFinding = () => {
  const updateFinding = async (findingId: string, updates: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from("zerlal_findings")
        .update(updates)
        .eq("id", findingId);

      if (error) throw error;
      toast.success("Finding updated");
      return true;
    } catch (e) {
      console.error("Failed to update finding:", e);
      toast.error("Failed to update finding");
      return false;
    }
  };

  const markFalsePositive = async (findingId: string) => {
    return updateFinding(findingId, { is_false_positive: true, status: "waived", waiver_reason: "Marked as false positive" });
  };

  const waiveFinding = async (findingId: string, reason: string) => {
    return updateFinding(findingId, { status: "waived", waiver_reason: reason });
  };

  const resolveFinding = async (findingId: string) => {
    return updateFinding(findingId, { status: "resolved", resolved_at: new Date().toISOString() });
  };

  const assignFinding = async (findingId: string, assignee: string) => {
    return updateFinding(findingId, { assignee, status: "in-progress" });
  };

  return { updateFinding, markFalsePositive, waiveFinding, resolveFinding, assignFinding };
};
