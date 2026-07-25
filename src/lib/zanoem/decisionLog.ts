// Shared helpers for the ZANOEM "You Decide" autopilot.
// - Detects whether ZANOEM's last response is asking the human to make a choice.
// - Extracts the candidate options (numbered/bulleted) so they can be shown to the user.
// - Persists each autopilot decision so the human can later review or override.
import { supabase } from "@/integrations/supabase/client";

export type ZanoemSurface = "asher_ide" | "asherin_ide" | "asher_zanoem";

export interface ZanoemOption {
  label: string;          // short label (first line of the option)
  excerpt?: string;       // optional fuller description (next 1-2 lines)
}

export interface ZanoemDecisionRow {
  id: string;
  user_id: string;
  surface: ZanoemSurface;
  project_ref: string | null;
  conversation_ref: string | null;
  round: number;
  trigger_excerpt: string;
  options: ZanoemOption[];
  chosen_option: string | null;
  rationale: string | null;
  reply_sent: string | null;
  status: "committed" | "overridden" | "reverted";
  overridden_at: string | null;
  override_choice: string | null;
  created_at: string;
  updated_at: string;
}

const DECISION_CUES = [
  "would you like", "do you want", "should i", "shall i",
  "which option", "which one", "which approach", "which would you",
  "let me know", "your preference", "your choice", "your call",
  "please confirm", "please choose", "please pick", "please select",
  "option a", "option 1", "recommendation:", "recommendations:",
  "which do you prefer", "what would you like", "what do you want",
  "next steps?", "proceed?", "continue?", "ready to proceed",
];

/** True if the assistant text is asking the human to make a choice/confirm/recommend.
 *  Only inspects the TAIL of the message (last ~800 chars, after any code fences)
 *  so a `?` buried in an explanation paragraph does not falsely trigger autopilot. */
export function needsHumanDecision(text: string): boolean {
  if (!text) return false;
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
  if (!stripped) return false;
  const tail = stripped.slice(-800);
  if (/\?\s*$/m.test(tail)) return true;
  const lower = tail.toLowerCase();
  return DECISION_CUES.some((c) => lower.includes(c));
}

/**
 * Pull a list of candidate options from the assistant text.
 * Recognises:
 *   - "Option A: ..." / "Option 1: ..."
 *   - "1. ..." / "1) ..." numbered lists
 *   - "- ..." / "* ..." bullets that follow a "options"/"recommendations" header
 * Returns at most 8 options.
 */
export function extractOptions(text: string): ZanoemOption[] {
  if (!text) return [];
  const stripped = text.replace(/```[\s\S]*?```/g, "");
  const lines = stripped.split(/\r?\n/);
  const opts: ZanoemOption[] = [];

  // Pass 1: explicit "Option X" labels
  const optionRe = /^\s*(?:\*\*)?\s*Option\s+([A-Z0-9]+)\s*[:.\-)]\s*(.+?)(?:\*\*)?\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    const m = optionRe.exec(lines[i]);
    if (m) {
      const label = `Option ${m[1]}: ${m[2].trim()}`;
      const next = (lines[i + 1] || "").trim();
      opts.push({ label: label.slice(0, 240), excerpt: next.slice(0, 240) || undefined });
    }
  }
  if (opts.length >= 2) return opts.slice(0, 8);
  opts.length = 0;

  // Pass 2: numbered list "1. ..." — but only when a decision heading is
  // nearby (within 5 lines above), so ordinary numbered plans don't get
  // treated as options for the user to pick.
  const numRe = /^\s*(\d+)[.)]\s+(.+)$/;
  const headingRe = /^\s*(?:\*\*)?\s*(options|recommendations|choices|alternatives|which|pick one|decide)\b/i;
  for (let i = 0; i < lines.length; i++) {
    const m = numRe.exec(lines[i]);
    if (!m) continue;
    let hasHeading = false;
    for (let j = Math.max(0, i - 5); j < i; j++) {
      if (headingRe.test(lines[j])) { hasHeading = true; break; }
    }
    if (hasHeading) opts.push({ label: m[2].trim().slice(0, 240) });
  }
  if (opts.length >= 2) return opts.slice(0, 8);
  opts.length = 0;

  // Pass 3: bullet list under a "options"/"recommendations" header
  let inSection = false;
  const bulletRe = /^\s*[-*•]\s+(.+)$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(options|recommendations|choices|alternatives)\s*:?\s*$/i.test(line)) { inSection = true; continue; }
    if (inSection) {
      const m = bulletRe.exec(line);
      if (m) opts.push({ label: m[1].trim().slice(0, 240) });
      else if (line === "") continue;
      else if (opts.length >= 2) break;
    }
  }
  return opts.slice(0, 8);
}

/** Build the autopilot reply ZANOEM will send to itself on the user's behalf. */
export function buildAutopilotReply(round: number, max: number): string {
  return [
    `[YOU DECIDE ZANOEM — autopilot round ${round}/${max}]`,
    "",
    "Decide on my behalf. Pick the best option from your recommendations and proceed.",
    "Rules:",
    "- Make every decision yourself using first-principles reasoning.",
    "- Choose the most production-ready, secure, and maintainable path.",
    "- Do NOT ask me any more questions in this round.",
    "- Continue building / writing / fixing until the task is complete.",
    "- After your work, append a single line on its own:",
    '  ZANOEM_DECISION: "<the option you picked>" — <one-sentence rationale>',
    "- If the task is functionally complete, also say 'AUTOPILOT COMPLETE'.",
  ].join("\n");
}

/**
 * Parse ZANOEM's response for a `ZANOEM_DECISION: "..."` self-report,
 * so the decision row can record what ZANOEM actually picked + why.
 */
export function parseDecisionMarker(text: string): { chosen: string | null; rationale: string | null } {
  if (!text) return { chosen: null, rationale: null };
  // Accept quoted OR unquoted values; non-greedy; no strict end anchor.
  const quoted = /ZANOEM_DECISION:\s*"([^"\n]{1,300})"\s*(?:[—\-:]\s*([^\n]{1,400}))?/i.exec(text);
  if (quoted) return { chosen: quoted[1].trim(), rationale: (quoted[2] || "").trim() || null };
  const unquoted = /ZANOEM_DECISION:\s*([^\n"—:]{1,300}?)\s*(?:[—:]\s+([^\n]{1,400}))?\s*(?:\n|$)/i.exec(text);
  if (!unquoted) return { chosen: null, rationale: null };
  return { chosen: unquoted[1].trim(), rationale: (unquoted[2] || "").trim() || null };
}

export interface LogDecisionInput {
  surface: ZanoemSurface;
  projectRef?: string | null;
  conversationRef?: string | null;
  round: number;
  triggerText: string;        // the assistant text that asked the question
  replySent: string;          // what we sent on user's behalf
  responseText?: string;      // what ZANOEM responded with (used to parse decision marker)
}

/** Insert a decision row. Best-effort — logging failures must not break the autopilot. */
export async function logDecision(input: LogDecisionInput): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const options = extractOptions(input.triggerText);
    const { chosen, rationale } = parseDecisionMarker(input.responseText || "");
    const row = {
      user_id: user.id,
      surface: input.surface,
      project_ref: input.projectRef ?? null,
      conversation_ref: input.conversationRef ?? null,
      round: input.round,
      trigger_excerpt: input.triggerText.slice(0, 4000),
      options: options as any,
      chosen_option: chosen,
      rationale,
      reply_sent: input.replySent.slice(0, 4000),
      status: "committed" as const,
    };
    const { data, error } = await supabase
      .from("zanoem_autopilot_decisions")
      .insert([row])
      .select("id")
      .single();
    if (error) { console.warn("[zanoem] decision log failed", error.message); return null; }
    return data?.id || null;
  } catch (e) {
    console.warn("[zanoem] decision log threw", e);
    return null;
  }
}

/** Update an existing decision row when the user overrides ZANOEM's choice. */
export async function overrideDecision(decisionId: string, newChoice: string): Promise<boolean> {
  const { error } = await supabase
    .from("zanoem_autopilot_decisions")
    .update({
      status: "overridden",
      overridden_at: new Date().toISOString(),
      override_choice: newChoice.slice(0, 4000),
    })
    .eq("id", decisionId);
  if (error) { console.warn("[zanoem] override failed", error.message); return false; }
  return true;
}

/** Fetch the most recent decisions for a project + surface. */
export async function listDecisions(
  surface: ZanoemSurface,
  projectRef?: string | null,
  limit = 50,
): Promise<ZanoemDecisionRow[]> {
  let q = supabase
    .from("zanoem_autopilot_decisions")
    .select("*")
    .eq("surface", surface)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (projectRef) q = q.eq("project_ref", projectRef);
  const { data, error } = await q;
  if (error) { console.warn("[zanoem] list decisions failed", error.message); return []; }
  return (data || []) as unknown as ZanoemDecisionRow[];
}
