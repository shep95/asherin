// ZERLAL Background Scan Worker
// Runs every minute via pg_cron. For each non-terminal job, advances ONE step
// (plan → section[i] → ... → finalize → email). Safe to re-enter — state lives
// in `zerlal_background_jobs`. Survives WiFi drops, browser close, edge timeouts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_JOBS_PER_TICK = 4;
const MAX_ATTEMPTS = 5;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function callScan(body: Record<string, unknown>) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/zerlal-scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "apikey": SERVICE_ROLE,
      "x-internal-key": SERVICE_ROLE,
    },
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  let parsed: any = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: raw }; }
  if (!resp.ok) throw new Error(parsed?.error || `zerlal-scan ${resp.status}`);
  if (parsed?.error) throw new Error(parsed.error);
  return parsed;
}

async function sendCompletionEmail(job: any, success: boolean, errorMsg?: string) {
  try {
    const findings: any[] = Array.isArray(job.aggregated_findings) ? job.aggregated_findings : [];
    const sev = (s: string) => findings.filter(f => (f.severity || "").toLowerCase() === s).length;
    const topFindings = [...findings]
      .sort((a, b) => (b.cvss_score || 0) - (a.cvss_score || 0))
      .slice(0, 10)
      .map(f => ({
        title: f.title,
        severity: f.severity,
        file_path: f.file_path,
        line_number: f.line_number,
        cwe_id: f.cwe_id,
        cvss_score: f.cvss_score,
      }));

    const scanErrors: any[] = Array.isArray(job.scan_errors) ? job.scan_errors : [];
    const errorsForEmail = scanErrors.slice(0, 15).map((e: any) => ({
      phase: e.phase || "section",
      section: typeof e.section === "number" ? e.section : null,
      message: String(e.message || "").slice(0, 400),
    }));

    const templateData: Record<string, unknown> = success
      ? {
          projectName: job.project_name || "Untitled project",
          riskGrade: job.final_risk_grade || "F",
          findingsCount: job.findings_count || findings.length,
          criticalCount: sev("critical"),
          highCount: sev("high"),
          mediumCount: sev("medium"),
          lowCount: sev("low"),
          infoCount: sev("info"),
          durationSec: job.completed_at && job.created_at
            ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
            : undefined,
          scanProfile: job.scan_profile,
          summary: job.final_summary || job.first_pass_summary || "",
          completedAt: job.completed_at || new Date().toISOString(),
          findings: topFindings,
          errors: errorsForEmail,
          errorsCount: scanErrors.length,
          scanStatus: scanErrors.length > 0 ? "completed_with_errors" : "completed",
        }
      : {
          projectName: job.project_name || "Untitled project",
          riskGrade: "F",
          findingsCount: 0,
          summary: `Background scan failed: ${errorMsg || "Unknown error"}`,
          completedAt: new Date().toISOString(),
          findings: [],
          errors: [
            ...errorsForEmail,
            { phase: "fatal", section: null, message: String(errorMsg || "Unknown error").slice(0, 400) },
          ],
          errorsCount: scanErrors.length + 1,
          scanStatus: "failed",
        };

    await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "apikey": SERVICE_ROLE,
      },
      body: JSON.stringify({
        templateName: "zerlal-scan-report",
        recipientEmail: job.recipient_email,
        idempotencyKey: `zerlal-bg-${job.id}-${success ? "ok" : "fail"}`,
        templateData,
      }),
    });
    await admin
      .from("zerlal_background_jobs")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (e) {
    console.error("[BG-WORKER] Email send failed:", (e as Error).message);
  }
}

async function advanceJob(job: any) {
  const baseBody: Record<string, unknown> = {
    user_id_override: job.user_id,
    project_id: job.project_id,
    scan_profile: job.scan_profile,
    code_content: job.code_content,
    source_storage_path: job.source_storage_path,
    file_name: job.file_name,
    github_url: job.github_url || undefined,
    byok: job.byok || null,
  };

  await admin.from("zerlal_background_jobs")
    .update({ last_run_at: new Date().toISOString(), attempts: job.attempts + 1 })
    .eq("id", job.id);

  if (job.status === "pending") {
    const plan = await callScan({ ...baseBody, mode: "plan" });
    await admin.from("zerlal_background_jobs").update({
      status: "scanning",
      scan_id: plan.scan_id,
      provider_profile: plan.provider_profile,
      total_sections: plan.total_sections,
      current_section: 0,
      last_error: null,
    }).eq("id", job.id);
    return;
  }

  if (job.status === "scanning") {
    if (job.current_section >= job.total_sections) {
      await admin.from("zerlal_background_jobs").update({ status: "finalizing" }).eq("id", job.id);
      return;
    }
    try {
      const sec = await callScan({
        ...baseBody,
        mode: "section",
        scan_id: job.scan_id,
        section_index: job.current_section,
        total_sections: job.total_sections,
        provider_profile: job.provider_profile,
      });
      const newFindings = Array.isArray(sec.findings) ? sec.findings : [];
      const merged = [...(job.aggregated_findings || []), ...newFindings];
      const update: any = {
        aggregated_findings: merged,
        current_section: job.current_section + 1,
        last_error: null,
      };
      if (job.current_section === 0) {
        update.first_pass_summary = sec.summary || "";
        update.first_pass_risk_grade = sec.risk_grade || "F";
      }
      await admin.from("zerlal_background_jobs").update(update).eq("id", job.id);
    } catch (e) {
      // Don't fail the whole scan — record section error, skip section, continue
      const msg = (e as Error).message || String(e);
      console.error(`[BG-WORKER] Section ${job.current_section} error:`, msg);
      const existingErrors = Array.isArray(job.scan_errors) ? job.scan_errors : [];
      const newErrors = [
        ...existingErrors,
        { phase: "section", section: job.current_section, message: msg, at: new Date().toISOString() },
      ];
      await admin.from("zerlal_background_jobs").update({
        scan_errors: newErrors,
        current_section: job.current_section + 1,
        last_error: msg,
      }).eq("id", job.id);
    }
    return;
  }

  if (job.status === "finalizing") {
    const final = await callScan({
      ...baseBody,
      mode: "finalize",
      scan_id: job.scan_id,
      aggregated_findings: job.aggregated_findings,
      first_pass_summary: job.first_pass_summary,
      first_pass_risk_grade: job.first_pass_risk_grade,
      provider_profile: job.provider_profile,
    });
    const completedAt = new Date().toISOString();
    const finishedJob = {
      ...job,
      status: "completed",
      final_risk_grade: final.risk_grade || job.first_pass_risk_grade || "F",
      final_summary: final.summary || job.first_pass_summary || "",
      findings_count: final.findings_count ?? (job.aggregated_findings?.length || 0),
      completed_at: completedAt,
    };
    await admin.from("zerlal_background_jobs").update({
      status: "completed",
      final_risk_grade: finishedJob.final_risk_grade,
      final_summary: finishedJob.final_summary,
      findings_count: finishedJob.findings_count,
      completed_at: completedAt,
      last_error: null,
    }).eq("id", job.id);
    await sendCompletionEmail(finishedJob, true);
    return;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const results: any[] = [];

  try {
    const { data: jobs, error } = await admin
      .from("zerlal_background_jobs")
      .select("*")
      .in("status", ["pending", "scanning", "finalizing"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("last_run_at", { ascending: true, nullsFirst: true })
      .limit(MAX_JOBS_PER_TICK);

    if (error) throw error;

    for (const job of jobs || []) {
      try {
        await advanceJob(job);
        results.push({ id: job.id, status: "advanced" });
      } catch (e) {
        const msg = (e as Error).message || String(e);
        console.error(`[BG-WORKER] Job ${job.id} step failed:`, msg);
        const nextAttempts = job.attempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await admin.from("zerlal_background_jobs").update({
            status: "failed",
            last_error: msg,
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);
          await sendCompletionEmail(job, false, msg);
          results.push({ id: job.id, status: "failed", error: msg });
        } else {
          await admin.from("zerlal_background_jobs").update({ last_error: msg }).eq("id", job.id);
          results.push({ id: job.id, status: "retry-scheduled", error: msg });
        }
      }
      // Stop early if we're approaching edge timeout
      if (Date.now() - startedAt > 110_000) break;
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[BG-WORKER] Tick failed:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
