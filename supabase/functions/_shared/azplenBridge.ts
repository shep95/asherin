// ═══════════════════════════════════════════════════════════════════════════
// AZPLEN CHAT BRIDGE — Asherin chat speaks for the whole ingest platform.
// ---------------------------------------------------------------------------
// An ingest platform that can only be operated through 40 tabs is a platform
// most operators never fully use. This bridge lets the operator ask the chat
// "what did I land, what is it, what can't I answer yet, what should I do
// next" and get an answer grounded in the actual Azplen tables — never in the
// model's imagination.
//
// Rules mirrored from the Substrate bridge:
//   • Pull, don't push. Fires only on an Azplen-shaped turn.
//   • Verified identity only. No JWT → no context, ever. RLS is enforced by
//     using the caller's own token, not the service role.
//   • Bounded: one indexed read per surface, hard row caps, no fan-out loops.
//   • Reads only. The bridge never mutates a case, dataset, or report.
//   • Every number injected is a real count from a real row.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { packCatalogue } from "./domainPacks.ts";

const AZPLEN_CUES =
  /\b(azplen|ingest|ingested|upload(ed)?|dataset|datasets|data ?set|my data|data quality|ontology|domain pack|pipeline|lineage|schema|columns?|case file|casefile|investigation|evidence|entities|entity resolution|hypothes[ei]s|collection plan|compliance|hipaa|phi\b|pci\b|gdpr|governance|data intelligence|what did i (upload|land|ingest))\b/i;

const EXPLICIT =
  /\b(azplen|domain pack|data intelligence platform|my datasets|what did i (upload|ingest|land))\b/i;

export interface AzplenIntent {
  active: boolean;
  explicit: boolean;
  /** Turn is asking what the platform can do, not what it holds. */
  capability: boolean;
}

export function classifyAzplenIntent(text: string): AzplenIntent {
  const t = String(text ?? "");
  const explicit = EXPLICIT.test(t);
  const active = explicit || AZPLEN_CUES.test(t);
  const capability = /\b(what can|capabilit|how does|support|handle|able to|can azplen|can it)\b/i.test(t) && active;
  return { active, explicit, capability };
}

interface DatasetRow {
  id: string;
  file_name: string;
  row_count: number | null;
  col_count: number | null;
  quality_score: number | null;
  status: string;
  created_at: string;
  session_id: string | null;
  domain_profile: Record<string, any> | null;
  issues: any[] | null;
}

export interface AzplenBundle {
  datasets: DatasetRow[];
  sessions: { id: string; name: string; company: string | null }[];
  insights: { title: string; description: string; type: string }[];
  entityCount: number;
  documentCount: number;
  caseCount: number;
  packMix: Record<string, number>;
  elapsedMs: number;
}

const cap = <T>(rows: T[] | null | undefined, n: number): T[] => (rows ?? []).slice(0, n);

/** Bounded pull of the caller's own Azplen state. Returns null when empty. */
export async function runAzplenPull(authHeader: string): Promise<AzplenBundle | null> {
  const started = Date.now();
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon || !authHeader) return null;

  // Caller's token → RLS applies. A bug here can never leak another tenant.
  const sb = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });

  const { data: userData } = await sb.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  const user = userData?.user;
  if (!user) return null;

  // One indexed read per surface, all in parallel, all bounded. allSettled so a
  // single missing table can never blank the whole context.
  const [dsRes, sesRes, insRes, entRes, docRes, caseRes] = await Promise.allSettled([
    sb.from("asha_datasets")
      .select("id,file_name,row_count,col_count,quality_score,status,created_at,session_id,domain_profile,issues")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
    sb.from("asha_sessions").select("id,name,company").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    sb.from("asha_insights").select("title,description,type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
    sb.from("asha_document_entities").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("asha_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("asha_queries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const datasets = dsRes.status === "fulfilled" ? cap((dsRes.value.data ?? []) as DatasetRow[], 25) : [];
  const sessions = sesRes.status === "fulfilled" ? cap((sesRes.value.data ?? []) as any[], 10) : [];
  const insights = insRes.status === "fulfilled" ? cap((insRes.value.data ?? []) as any[], 12) : [];
  const entityCount = entRes.status === "fulfilled" ? (entRes.value.count ?? 0) : 0;
  const documentCount = docRes.status === "fulfilled" ? (docRes.value.count ?? 0) : 0;
  const caseCount = caseRes.status === "fulfilled" ? (caseRes.value.count ?? 0) : 0;

  if (!datasets.length && !sessions.length && !insights.length && !entityCount && !documentCount) return null;

  const packMix: Record<string, number> = {};
  for (const d of datasets) {
    const pack = d.domain_profile?.packLabel ?? (d.status === "ready" ? "Unprofiled (pre-pack ingest)" : d.status);
    packMix[pack] = (packMix[pack] ?? 0) + 1;
  }

  return { datasets, sessions, insights, entityCount, documentCount, caseCount, packMix, elapsedMs: Date.now() - started };
}

/** Static capability sheet — answers "what can Azplen do" without a DB read. */
export function formatAzplenCapabilities(): string {
  const packs = packCatalogue();
  return [
    "### AZPLEN — DATA INTELLIGENCE INGEST (platform capability sheet)",
    "Azplen is a data intelligence ingest platform, not a financial sweep. Any source shape lands, is bound to real-world objects, is governed on arrival, and is converted into a decision set.",
    "Ingest pipeline: land → profile (types, grain, nulls, duplicates) → classify domain pack → bind columns to ontology objects → register sensitivity + regulation → emit contract findings → declare computable vs blocked KPIs → declare collection gaps.",
    "",
    "Domain packs installed:",
    ...packs.map((p) =>
      `- **${p.label}** — ${p.mission}\n  Objects: ${p.objects.join(", ")}\n  Standards: ${p.standards.join(", ")}\n  Regulation: ${p.regulations.join(", ")}\n  KPIs: ${p.kpis.join(", ")}`
    ),
    "",
    "Surfaces the operator can reach from chat: Ingest, Streams, Documents, Ledger, Data Quality, Domain Intelligence, Transform, Entity Resolution, Graph, Flows, Behavior, Canvas, Hypotheses, Contradictions, Red Team, Fusion, Threats, Forecasts, Anomalies, Evidence, Review Board, Library, Integrations, Reports.",
  ].join("\n");
}

export function formatAzplenContext(bundle: AzplenBundle | null): string {
  if (!bundle) return "";
  const lines: string[] = [
    "### AZPLEN PLATFORM STATE (live, caller-scoped — cite these figures, do not invent others)",
    `Sessions: ${bundle.sessions.length}${bundle.sessions.length ? ` (${bundle.sessions.map((s) => s.name).join(", ")})` : ""}`,
    `Datasets landed: ${bundle.datasets.length} | Documents: ${bundle.documentCount} | Extracted entities: ${bundle.entityCount} | Saved queries/cases: ${bundle.caseCount}`,
    `Domain mix: ${Object.entries(bundle.packMix).map(([k, v]) => `${k} ×${v}`).join(", ") || "none"}`,
    "",
    "Dataset ledger:",
  ];

  for (const d of bundle.datasets.slice(0, 12)) {
    const p = d.domain_profile;
    const issueCount = Array.isArray(d.issues) ? d.issues.length : 0;
    lines.push(
      `- ${d.file_name} — ${d.row_count ?? "?"} rows × ${d.col_count ?? "?"} cols, quality ${d.quality_score ?? "?"}/100, ${issueCount} issue(s), status ${d.status}` +
      (p
        ? `\n  Pack: ${p.packLabel} (${Math.round((p.confidence ?? 0) * 100)}%) | Risk ${p.riskScore}/100 ${p.riskGrade}` +
          `\n  Bindings: ${(p.bindings ?? []).map((b: any) => `${b.column}→${b.object}.${b.property}`).slice(0, 8).join(", ") || "none"}` +
          `\n  Sensitivity: ${(p.sensitivityClasses ?? []).join(", ") || "none"} | Regulation: ${(p.regulations ?? []).slice(0, 4).join("; ") || "none"}` +
          `\n  Findings: ${(p.findings ?? []).map((f: any) => f.code).join(", ") || "clean"}` +
          `\n  KPIs ready: ${(p.kpisReady ?? []).map((k: any) => k.name).join(", ") || "none"} | blocked: ${(p.kpisBlocked ?? []).map((k: any) => `${k.name}(needs ${k.missing.join("+")})`).join("; ") || "none"}` +
          `\n  Collection gaps: ${(p.collectionGaps ?? []).slice(0, 4).join("; ")}`
        : "\n  Pack: not profiled (ingested before the domain pack engine, or non-tabular). Re-run analysis to profile."),
    );
  }

  if (bundle.insights.length) {
    lines.push("", "Recent AI findings on landed data:");
    for (const i of bundle.insights.slice(0, 8)) lines.push(`- [${i.type}] ${i.title}: ${i.description}`);
  }

  lines.push(
    "",
    "Answering rules for this block: every claim must trace to a dataset name, column binding, finding code, or count above. If the operator asks something the landed data cannot answer, say which field or companion feed is missing (use the collection gaps) rather than estimating.",
  );
  return lines.join("\n");
}
