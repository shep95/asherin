// Asherin kernel client (vessel side).
//
// The vessel never holds the kernel and never fakes it. Every call goes through
// the JWT-verified `asherin-kernel-proxy` edge function. When the kernel is not
// configured or is unreachable, callers get `{ ok: false, error: "kernel offline" }`
// and must SAY SO in the surface — never quietly substitute a local stand-in.

import { supabase } from "@/integrations/supabase/client";

export type PatternCard = {
  id?: string;
  title?: string;
  procedure?: string;
  [k: string]: unknown;
};

export type KernelResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "kernel offline" | "unauthorized" | "unknown tool" | string };

const OFFLINE: KernelResult<never> = { ok: false, error: "kernel offline" };

async function invoke(body: Record<string, unknown>): Promise<KernelResult<any>> {
  try {
    const { data, error } = await supabase.functions.invoke("asherin-kernel-proxy", { body });
    if (error) return OFFLINE;
    if (!data || data.ok !== true) {
      return { ok: false, error: typeof data?.error === "string" ? data.error : "kernel offline" };
    }
    return { ok: true, data };
  } catch {
    return OFFLINE;
  }
}

/** 3–7 thinking-pattern procedure cards for this turn. Procedures, not personas. */
export async function retrievePatterns(query: string, k = 5): Promise<KernelResult<PatternCard[]>> {
  if (!query.trim()) return { ok: true, data: [] };
  const res = await invoke({ op: "retrieve", query, k });
  if (!res.ok) return res;
  return { ok: true, data: Array.isArray(res.data.cards) ? (res.data.cards as PatternCard[]) : [] };
}

/** Run a kernel-owned operator tool. Refused server-side unless allow-listed. */
export async function runKernelTool(tool: string, args: Record<string, unknown> = {}): Promise<KernelResult<unknown>> {
  const res = await invoke({ op: "tool", tool, args });
  if (!res.ok) return res;
  return { ok: true, data: res.data.result };
}

export const KERNEL_OFFLINE_NOTICE = "kernel offline — that tool runs on the asherin kernel and it is not reachable right now. nothing was performed.";
