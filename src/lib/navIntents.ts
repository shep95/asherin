// Single source of truth for in-app navigation: every dashboard view paired
// with a plain-language label, a codename subtitle, intent keywords, and the
// verb-first group it belongs to. Drives both the global Command Palette and
// the dashboard sidebar so users can navigate by intent, not by codename.

import type { DashboardView } from "@/components/dashboard/types";

export type IntentGroup =
  | "Create"
  | "Analyze"
  | "Investigate"
  | "Build"
  | "Workspace"
  | "Account";

export interface NavIntent {
  /** Dashboard view id (preferred). */
  view?: DashboardView;
  /** Or an absolute app route for non-dashboard pages. */
  route?: string;
  /** Plain-language label — what the user wants to DO. */
  label: string;
  /** Codename / brand name shown as small subtitle. */
  codename?: string;
  /** One-line job description. */
  blurb?: string;
  /** Keyword synonyms used by the palette to match intent. */
  keywords: string[];
  /** Verb-first intent group. */
  group: IntentGroup;
  /** Optional access tag. */
  access?: "search" | "pro";
  /** Only admin sees this. */
  adminOnly?: boolean;
}

// WAVE 1 — tight sidebar. Only nine surfaces are navigable chrome. Every other
// capability is reached by asking for it in chat, which routes to the tool.
// Folded tools (search, zerlal, azplen, geospatial, google, zali, ide, zahten,
// briefing, notebooks, knowledge-vault, axrlen, ghost-engine, zeeion, gematria,
// vedic-astrology, pdf-generator, zaxin, zacoon, file-scrapper, teams,
// community, snippets, stats, audit, bug-reports) still resolve as views so
// deep links keep working — they simply have no nav row.
export const NAV_INTENTS: NavIntent[] = [
  // WORKSPACE
  { view: "chat", label: "Chat", codename: "Asherin", blurb: "Ask for anything — search, maps, code, data, cyber all run from here", keywords: ["chat", "ask", "talk", "conversation", "prompt", "assistant"], group: "Workspace" },
  { view: "library", label: "Library", codename: "Library", blurb: "Saved files and references", keywords: ["library", "files", "storage", "documents"], group: "Workspace" },
  { view: "projects", label: "Projects", codename: "Projects", blurb: "Organize conversations into projects", keywords: ["project", "folder", "organize"], group: "Workspace" },
  { view: "memory", label: "Memory Center", codename: "Memory", blurb: "Long-term context and recall", keywords: ["memory", "remember", "context", "recall"], group: "Workspace" },
  { view: "guardian-vault", label: "Guardian Vault", codename: "Vault", blurb: "Passwords, TOTP, sessions, and activity — contents never enter chat", keywords: ["vault", "password", "secret", "mfa", "totp", "sessions", "activity"], group: "Workspace" },
  { view: "whiteboard", label: "Whiteboard", codename: "Canvas", blurb: "Infinite canvas with layers, snap grids, and freeform sketching", keywords: ["whiteboard", "canvas", "draw", "sketch", "diagram", "board"], group: "Workspace" },

  // ACCOUNT
  { view: "settings", label: "Settings", codename: "Settings", keywords: ["settings", "preferences", "config", "options"], group: "Account" },
  { view: "subscription", label: "Subscribe or manage your plan", codename: "Subscription", keywords: ["billing", "subscription", "plan", "upgrade", "pricing", "manage"], group: "Account" },
  { view: "api-keys", label: "API Keys", codename: "API", blurb: "Add and manage your AI provider API keys (BYOK)", keywords: ["api", "api key", "byok", "keys", "provider", "openai", "anthropic", "gemini", "groq"], group: "Account" },
];

export const INTENT_GROUPS: IntentGroup[] = ["Workspace", "Account"];

export const INTENT_GROUP_BLURB: Record<IntentGroup, string> = {
  Create: "Make images, video, code, documents",
  Analyze: "Data, financial, patterns, geospatial",
  Investigate: "Search, OSINT, prediction, cyber",
  Build: "IDE, notebooks, agents, plugins",
  Workspace: "Chat, library, projects, memory, vault",
  Account: "Settings, billing, API keys",
};

/* ───────────────────────── Recents ───────────────────────── */

const RECENT_KEY = "aureon_recent_intents";
const RECENT_MAX = 6;

export function trackRecentIntent(viewOrRoute: string): void {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x !== viewOrRoute);
    filtered.unshift(viewOrRoute);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, RECENT_MAX)));
    window.dispatchEvent(new CustomEvent("aureon-recents-changed"));
  } catch { /* ignore */ }
}

export function getRecentIntents(): NavIntent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list
      .map((key) => NAV_INTENTS.find((i) => (i.view ?? i.route) === key))
      .filter((i): i is NavIntent => !!i);
  } catch {
    return [];
  }
}

/* ─────────────────────── Auto config ─────────────────────── */

export interface ChatConfigHint {
  mode?: "chat" | "code" | "research" | "truth";
  depth?: "concise" | "standard" | "detailed";
}

/** Infer chat mode/depth/persona from the user's first sentence. */
export function inferChatConfig(text: string): ChatConfigHint {
  const lower = text.toLowerCase();
  const out: ChatConfigHint = {};

  // MODE
  if (/\b(debug|refactor|implement|function|class|api|typescript|python|react|compile|build|error|stack trace)\b/.test(lower)) {
    out.mode = "code";
  } else if (/\b(research|sources?|study|cite|literature|paper|academic|investigate|find out|deep dive)\b/.test(lower)) {
    out.mode = "research";
  } else if (/\b(truth|uncensored|honest|raw|no filter|brutally|direct)\b/.test(lower)) {
    out.mode = "truth";
  }

  // DEPTH
  if (/\b(quick|short|brief|tldr|one line|summary|summari[sz]e|in a sentence)\b/.test(lower)) {
    out.depth = "concise";
  } else if (/\b(detailed|comprehensive|exhaustive|deep|long|full|thorough|step by step|walk me through)\b/.test(lower)) {
    out.depth = "detailed";
  }

  return out;
}
