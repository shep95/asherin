// Single source of truth for in-app navigation: every dashboard view paired
// with a plain-language label, a codename subtitle, intent keywords, and the
// verb-first group it belongs to. Drives both the global Command Palette and
// the dashboard sidebar so users can navigate by intent, not by codename.

import type { DashboardView } from "@/components/dashboard/types";

export type IntentGroup = "Create" | "Analyze" | "Investigate" | "Build" | "Workspace" | "Account";

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

// WAVE 1 — tight sidebar. pages is a keep-stack room (chat-class). Folded tools
// still resolve as views so deep links keep working — they simply have no nav row.
export const NAV_INTENTS: NavIntent[] = [
  // WORKSPACE
  {
    view: "chat",
    label: "Chat",
    codename: "Asherin",
    blurb: "Ask for anything — search, maps, code, data, cyber all run from here",
    keywords: ["chat", "ask", "talk", "conversation", "prompt", "assistant"],
    group: "Workspace",
  },
  {
    view: "ghost-engine",
    label: "asherinx.eng",
    codename: "asherinx.eng",
    blurb: "Public-index search — eighteen open indexes asked in parallel, grouped by field site",
    keywords: ["asherinx", "eng", "engine", "osint", "public index", "wayback", "nvd", "search", "ghost"],
    group: "Workspace",
  },
  {
    view: "asherin-defender",
    label: "asherin.defender",
    codename: "asherin.defender",
    blurb: "Your own device — covert-camera law, wifi and bluetooth intel, bunker freeze",
    keywords: [
      "defender",
      "bunker",
      "counter surveillance",
      "camera",
      "wifi",
      "bluetooth",
      "spy",
      "keylogger",
      "poison",
      "protect",
    ],
    group: "Workspace",
  },
  {
    view: "asherin-arvision",
    label: "asherin.arvision",
    codename: "asherin.arvision",
    blurb: "Live camera HUD — frame intel, freeze, barcode, honest cannot-resolve",
    keywords: ["arvision", "ar", "vision", "camera", "hud", "freeze", "lens", "look", "see"],
    group: "Workspace",
  },
  {
    view: "asherin-eye",
    label: "asherin.eye",
    codename: "asherin.eye",
    blurb: "photoreal 3d globe with live public flights, ships, sats, quakes, radio and osm sites",
    keywords: ["eye", "globe", "cesium", "flights", "ships", "satellites", "earthquakes", "cockpit", "hud", "3d"],
    group: "Workspace",
  },
  {
    view: "pdf-generator",
    label: "pages",
    codename: "asherin.pages",
    blurb: "prompt a page. quiet file. you keep the pdf.",
    keywords: ["pages", "pdf", "typeset", "letter", "typst", "document", "pdf-generator"],
    group: "Workspace",
  },
  {
    view: "library",
    label: "Library",
    codename: "Library",
    blurb: "Saved files and references",
    keywords: ["library", "files", "storage", "documents"],
    group: "Workspace",
  },
  {
    view: "projects",
    label: "Projects",
    codename: "Projects",
    blurb: "Organize conversations into projects",
    keywords: ["project", "folder", "organize"],
    group: "Workspace",
  },
  {
    view: "memory",
    label: "Memory Center",
    codename: "Memory",
    blurb: "Long-term context and recall",
    keywords: ["memory", "remember", "context", "recall"],
    group: "Workspace",
  },
  {
    view: "guardian-vault",
    label: "Guardian Vault",
    codename: "Vault",
    blurb: "Passwords, TOTP, sessions, and activity — contents never enter chat",
    keywords: ["vault", "password", "secret", "mfa", "totp", "sessions", "activity"],
    group: "Workspace",
  },
  {
    view: "whiteboard",
    label: "Whiteboard",
    codename: "Canvas",
    blurb: "Infinite canvas with layers, snap grids, and freeform sketching",
    keywords: ["whiteboard", "canvas", "draw", "sketch", "diagram", "board"],
    group: "Workspace",
  },
  {
    view: "teams",
    label: "Team",
    codename: "Team",
    blurb: "Your company workspace — members, roles, invites, shared projects",
    keywords: ["team", "teams", "workspace", "members", "invite", "roles", "company", "org", "seats", "colleagues"],
    group: "Workspace",
  },

  // ACCOUNT
  {
    view: "settings",
    label: "Settings",
    codename: "Settings",
    keywords: ["settings", "preferences", "config", "options"],
    group: "Account",
  },
  {
    view: "subscription",
    label: "Subscribe or manage your plan",
    codename: "Subscription",
    keywords: ["billing", "subscription", "plan", "upgrade", "pricing", "manage"],
    group: "Account",
  },
  {
    view: "api-keys",
    label: "Connect",
    codename: "Connect",
    blurb: "Live capability pull-graph, bindings, and your encrypted provider keys (BYOK)",
    keywords: [
      "connect",
      "graph",
      "pulls",
      "bindings",
      "api",
      "api key",
      "byok",
      "keys",
      "provider",
      "openai",
      "anthropic",
      "gemini",
      "groq",
    ],
    group: "Account",
  },

  // ── FOLDED SOFTWARE ────────────────────────────────────────────────────
  // Rooms that already mount in the dashboard but had no row. Every one of
  // them speaks under one family name: asherin.<thing it does>. Grouped in
  // fours-to-eights so the eye never has to price a flat list of thirty.

  // INVESTIGATE
  {
    view: "search",
    label: "asherin.search",
    codename: "sourced search",
    blurb: "sourced search with credibility tiers",
    keywords: ["search", "zophiel", "osint", "web", "dark web", "leaks", "archives"],
    group: "Investigate",
  },
  {
    view: "zerlal",
    label: "asherin.cyber",
    codename: "domain + infra",
    blurb: "domain and infrastructure recon",
    keywords: ["cyber", "zerlal", "domain", "ports", "cve", "recon", "vulnerability"],
    group: "Investigate",
  },
  {
    view: "google",
    label: "asherin.google",
    codename: "your accounts",
    blurb: "your connected google accounts, read on request",
    keywords: ["google", "gmail", "calendar", "drive", "accounts", "mesh"],
    group: "Investigate",
  },
  {
    view: "knowledge-vault",
    label: "asherin.knowledge",
    codename: "private corpus",
    blurb: "private files asherin can cite",
    keywords: ["knowledge", "vault", "corpus", "rag", "documents", "cite"],
    group: "Investigate",
  },
  {
    view: "file-scrapper",
    label: "asherin.extract",
    codename: "document text",
    blurb: "pull text and tables out of documents",
    keywords: ["extract", "scrapper", "scraper", "parse", "pdf", "ocr", "file"],
    group: "Investigate",
  },
  {
    view: "briefing",
    label: "asherin.briefings",
    codename: "scheduled reading",
    blurb: "scheduled reading, sourced",
    keywords: ["briefing", "briefings", "daily", "digest", "news"],
    group: "Investigate",
  },

  // ANALYZE
  {
    view: "azplen",
    label: "asherin.data",
    codename: "datasets",
    blurb: "datasets, analysis and charts",
    keywords: ["data", "azplen", "dataset", "ontology", "chart", "table"],
    group: "Analyze",
  },

  // BUILD
  {
    view: "ide",
    label: "asherin.ide",
    codename: "editor",
    blurb: "read, edit and run code with diffs before apply",
    keywords: ["ide", "code", "editor", "repo", "git", "terminal"],
    group: "Build",
  },
  {
    view: "zahten",
    label: "asherin.agents",
    codename: "agent forge",
    blurb: "build and publish an agent",
    keywords: ["agent", "agents", "zahten", "forge", "workflow", "deploy"],
    group: "Build",
  },
  {
    view: "snippets",
    label: "asherin.snippets",
    codename: "saved code",
    blurb: "saved code you reuse",
    keywords: ["snippet", "snippets", "code", "reuse"],
    group: "Build",
  },
  {
    view: "zali",
    label: "asherin.design",
    codename: "design lab",
    blurb: "design exploration",
    keywords: ["design", "zali", "ui", "lab", "sketch"],
    group: "Build",
  },
  {
    view: "community",
    label: "asherin.community",
    codename: "shared room",
    blurb: "shared prompts and rooms",
    keywords: ["community", "forum", "shared", "people"],
    group: "Build",
  },
  {
    view: "bug-reports",
    label: "asherin.bugs",
    codename: "your reports",
    blurb: "what you reported, and its state",
    keywords: ["bug", "bugs", "report", "issue", "broken"],
    group: "Build",
  },

  // CREATE
  {
    view: "slideshow",
    label: "asherin.slides",
    codename: "decks",
    blurb: "prompt a deck, keep the file",
    keywords: ["slides", "slideshow", "deck", "presentation"],
    group: "Create",
  },
  {
    view: "ebook",
    label: "asherin.ebook",
    codename: "long form",
    blurb: "long-form writing to a finished file",
    keywords: ["ebook", "book", "chapters", "write"],
    group: "Create",
  },
  {
    view: "gematria",
    label: "asherin.gematria",
    codename: "letter values",
    blurb: "letter-value arithmetic and matches",
    keywords: ["gematria", "numerology", "letters", "values"],
    group: "Create",
  },
  {
    view: "vedic-astrology",
    label: "asherin.vedic",
    codename: "transits",
    blurb: "moon-driven transits and timing",
    keywords: ["vedic", "astrology", "transit", "dasha", "chart"],
    group: "Create",
  },
];

export const INTENT_GROUPS: IntentGroup[] = ["Workspace", "Investigate", "Analyze", "Build", "Create", "Account"];

export const INTENT_GROUP_BLURB: Record<IntentGroup, string> = {
  Create: "make a file you keep",
  Analyze: "data, money, time, patterns",
  Investigate: "search, recon, your own accounts",
  Build: "code, agents, snippets",
  Workspace: "chat, maps, library, memory, vault",
  Account: "settings, billing, keys",
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
  } catch {
    /* ignore */
  }
}

export function getRecentIntents(): NavIntent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.map((key) => NAV_INTENTS.find((i) => (i.view ?? i.route) === key)).filter((i): i is NavIntent => !!i);
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
  if (
    /\b(debug|refactor|implement|function|class|api|typescript|python|react|compile|build|error|stack trace)\b/.test(
      lower,
    )
  ) {
    out.mode = "code";
  } else if (
    /\b(research|sources?|study|cite|literature|paper|academic|investigate|find out|deep dive)\b/.test(lower)
  ) {
    out.mode = "research";
  } else if (/\b(truth|uncensored|honest|raw|no filter|brutally|direct)\b/.test(lower)) {
    out.mode = "truth";
  }

  // DEPTH
  if (/\b(quick|short|brief|tldr|one line|summary|summari[sz]e|in a sentence)\b/.test(lower)) {
    out.depth = "concise";
  } else if (
    /\b(detailed|comprehensive|exhaustive|deep|long|full|thorough|step by step|walk me through)\b/.test(lower)
  ) {
    out.depth = "detailed";
  }

  return out;
}
