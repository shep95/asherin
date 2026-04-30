import { supabase } from "@/integrations/supabase/client";
import type { AiMode } from "./types";

export interface CallAsherCodeArgs {
  mode: AiMode;
  byok?: { provider: string; model: string; apiKey?: string };
  // chat
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  // generate
  description?: string;
  language?: string;
  // explain / fix
  code?: string;
  error?: string;
  // inline
  before?: string;
  after?: string;
  path?: string;
  // shared
  contextFiles?: Array<{ path: string; content: string }>;
}

export interface CallAsherCodeResult {
  reply: string;
  provider: string;
  model: string;
  keySource: "request" | "stored" | "admin";
}

export async function callAsherCodeAi(args: CallAsherCodeArgs): Promise<CallAsherCodeResult> {
  const { data, error } = await supabase.functions.invoke("asher-code-ai", { body: args });
  if (error) throw new Error(error.message || "AI call failed");
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as CallAsherCodeResult;
}

// Extract first ```lang...``` block (or all content if none) — used for generate/fix.
export function extractCodeBlock(text: string): string {
  const m = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}
