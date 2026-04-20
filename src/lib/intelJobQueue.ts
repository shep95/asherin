/**
 * Client-side queue helper for heavy intelligence operations.
 * Coordinates concurrent users via the public.intel_job_queue table
 * + try_acquire_intel_slot / release_intel_slot / heartbeat_intel_slot RPCs.
 */
import { supabase } from "@/integrations/supabase/client";

export interface QueueProgress {
  status: "waiting" | "running" | "done" | "failed";
  position: number;       // 0 when running, 1+ when waiting
  runningCount: number;   // how many slots currently in use
  jobId: string;
}

export interface AcquireOptions {
  jobType: string;
  maxConcurrent?: number;          // default 2
  pollMs?: number;                 // default 2500
  timeoutMs?: number;              // total wait budget; default 4 min
  onProgress?: (p: QueueProgress) => void;
  signal?: AbortSignal;
}

/**
 * Enqueue + wait until a slot is acquired.
 * Returns { jobId, release, heartbeat } once running.
 */
export async function acquireIntelSlot(opts: AcquireOptions): Promise<{
  jobId: string;
  release: (success?: boolean) => Promise<void>;
  startHeartbeat: () => () => void; // returns stopper
}> {
  const {
    jobType,
    maxConcurrent = 2,
    pollMs = 2500,
    timeoutMs = 4 * 60 * 1000,
    onProgress,
    signal,
  } = opts;

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error("Not authenticated");

  // 1) Create the job row
  const { data: inserted, error: insErr } = await supabase
    .from("intel_job_queue")
    .insert({ user_id: user.id, job_type: jobType, status: "waiting" })
    .select("id")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message || "Failed to enqueue job");
  const jobId = inserted.id as string;

  const release = async (success = true) => {
    try {
      await supabase.rpc("release_intel_slot", { _job_id: jobId, _success: success });
    } catch (e) {
      console.warn("[intelQueue] release failed:", e);
    }
  };

  const startHeartbeat = () => {
    const iv = setInterval(() => {
      void supabase.rpc("heartbeat_intel_slot", { _job_id: jobId }).then(() => {}, () => {});
    }, 20_000);
    return () => clearInterval(iv);
  };

  // Cleanup on abort
  const onAbort = () => { release(false); };
  signal?.addEventListener("abort", onAbort);

  const start = Date.now();
  try {
    while (true) {
      if (signal?.aborted) throw new Error("Cancelled");
      if (Date.now() - start > timeoutMs) {
        await release(false);
        throw new Error("Queue wait timed out — please try again later");
      }

      const { data, error } = await supabase.rpc("try_acquire_intel_slot", {
        _job_id: jobId,
        _job_type: jobType,
        _max_concurrent: maxConcurrent,
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      const acquired = !!row?.acquired;
      const queuePos = Number(row?.queue_pos ?? 0);
      const runningCount = Number(row?.running_count ?? 0);

      onProgress?.({
        status: acquired ? "running" : "waiting",
        position: queuePos,
        runningCount,
        jobId,
      });

      if (acquired) {
        signal?.removeEventListener("abort", onAbort);
        return { jobId, release, startHeartbeat };
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }
  } catch (e) {
    signal?.removeEventListener("abort", onAbort);
    throw e;
  }
}
