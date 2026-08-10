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

export const NAV_INTENTS: NavIntent[] = [
  // CREATE
  { view: "zali", label: "Universal Design Lab", codename: "ZANOEM", blurb: "First-principles design from atoms to universes", keywords: ["design", "engineer", "cad", "fea", "thermal", "material", "physics", "simulation"], group: "Create" },
  { view: "pdf-generator", label: "Create a Document", codename: "PDF / eBook / Slides", blurb: "Turn content into PDF, eBook, or slideshow", keywords: ["pdf", "ebook", "book", "slides", "slideshow", "presentation", "export", "document"], group: "Create" },

  // ANALYZE
  { view: "azplen", label: "Data Intelligence", codename: "Azplen", blurb: "Ingest, analyze, branch, and visualize datasets", keywords: ["data", "dataset", "csv", "analyze data", "spreadsheet", "intelligence", "foundry"], group: "Analyze", access: "pro" },
  { view: "zeeion", label: "Financial Intelligence", codename: "Zeeion", blurb: "Cost savings, efficiency scoring, budget optimization", keywords: ["money", "finance", "financial", "budget", "cost", "expense", "revenue", "savings"], group: "Analyze", access: "pro" },
  { view: "pattern-analysis", label: "Pattern Analysis", codename: "Pattern Engine", blurb: "Visual pattern recognition and forecasting", keywords: ["pattern", "forecast", "predict pattern", "trend", "anomaly"], group: "Analyze", access: "pro" },
  { view: "timeseries", label: "Time-Series Forecasting", codename: "Time-Series", blurb: "Temporal analysis with anomaly detection", keywords: ["time series", "timeseries", "forecast", "anomaly", "temporal"], group: "Analyze", access: "pro" },
  { view: "geospatial", label: "Asherin Maps", codename: "PropertyMap", blurb: "Click any property — Zophiel scrapes live ownership, valuation & risk intel", keywords: ["map", "geo", "location", "property", "land", "parcel", "real estate", "zophiel"], group: "Analyze", access: "pro" },
  { view: "video-intelligence", label: "Video Behavior Analysis", codename: "Video Intelligence", blurb: "Deception detection, personality profiling", keywords: ["video analyze", "behavior", "deception", "face", "facs", "micro expression"], group: "Analyze", access: "pro" },

  // INVESTIGATE
  { view: "search", label: "Search Intelligence", codename: "Zophiel", blurb: "Privacy-first source-credibility search", keywords: ["search", "research", "look up", "google", "find", "investigate", "osint"], group: "Investigate", access: "search" },
  { view: "ghost-engine", label: "Metadata Search", codename: "Asherin Engine", blurb: "Indexes the shell around information — headers, EXIF, producers, DNS/ASN — and never the content", keywords: ["ghost", "metadata", "meta data", "exif", "headers", "provenance", "forensics", "shell", "who made this", "when was this made", "forgery", "authenticity"], group: "Investigate", access: "pro" },
  { view: "nomad", label: "OSINT Investigation", codename: "NOMAD", blurb: "30+ source OSINT with AI correlation", keywords: ["osint", "investigate", "intelligence", "background check", "person", "dossier"], group: "Investigate" },
  { view: "zerlal", label: "Cyber Security", codename: "Zerlal", blurb: "Threat analysis, vulnerability detection, defense", keywords: ["security", "cyber", "vulnerability", "exploit", "hack", "threat", "scan", "pentest"], group: "Investigate" },
  { view: "zaxin", label: "Tactical BLE Discovery", codename: "Zaxin", blurb: "Bluetooth Low Energy scanner, hop graph, GATT pull, tactical HUD", keywords: ["zaxin", "bluetooth", "ble", "bleak", "scan", "rssi", "gatt", "hop", "tactical", "houseofasher"], group: "Investigate" },
  { view: "google", label: "Cloud Intelligence Mesh", codename: "Asherin Station", blurb: "Connected accounts run as a collection array — correspondent fusion, place cartography, attention ledger, commitments, exposure", keywords: ["google", "gmail", "email", "calendar", "voiceprint", "ghostwrite", "location history", "screentime", "attention", "commitments", "mesh"], group: "Investigate", access: "pro" },
  { view: "bulwark", label: "Counter-Surveillance", codename: "Bulwark", blurb: "Detects monitoring pressure on your comms and measures how legible this device is to a passive observer", keywords: ["surveillance", "counter surveillance", "tracking", "spy", "monitored", "wiretap", "subpoena", "fbi", "nsa", "tracked", "bug", "fingerprint", "bulwark", "privacy"], group: "Investigate", access: "pro" },
  { view: "geo-audit", label: "GEO Audit", codename: "Beacon", blurb: "Measures what generative engines receive from the published site and whether Asherin is retrieved for target prompts", keywords: ["seo", "geo", "generative engine optimization", "ranking", "search visibility", "citation", "crawler", "schema", "llm search"], group: "Investigate", access: "pro" },
  { view: "zacoon", label: "Phantom Grid Operative", codename: "Zacoon", blurb: "Multi-cortex autonomous web operative with adversarial awareness", keywords: ["zacoon", "phantom", "browser agent", "scrape agent", "autonomous", "recon extract", "operative", "grid"], group: "Investigate", access: "pro" },
  { view: "file-scrapper", label: "Extract Document Text", codename: "File Scrapper", blurb: "Pull all text from any document", keywords: ["scrape", "extract", "ocr", "pdf text", "document text"], group: "Investigate", access: "search" },
  { view: "cipher", label: "Cipher & Crypto Toolkit", codename: "Cipher", blurb: "Encoding, hashing, encryption — client-side", keywords: ["cipher", "encode", "decode", "hash", "encrypt", "base64", "rot13"], group: "Investigate", access: "search" },
  { view: "gematria", label: "Gematria Engine", codename: "Gematria", blurb: "English Ordinal, Reduction, Reverse & Chaldean value analysis with personal corpus matching", keywords: ["gematria", "numerology", "ordinal", "reduction", "chaldean", "value", "letter number", "cipher word"], group: "Investigate" },
  { view: "briefing", label: "Daily Intel Briefings", codename: "Briefings", blurb: "Competitor, regulatory, market signals", keywords: ["briefing", "daily", "news", "feed", "digest"], group: "Investigate" },
  { view: "cross", label: "Live Screen Intelligence", codename: "Cross", blurb: "Real-time screen analysis with alerts", keywords: ["screen", "live", "share screen", "monitor"], group: "Investigate", access: "pro", adminOnly: true },
  

  // BUILD
  { view: "ide", label: "Code IDE", codename: "Aureon IDE", blurb: "Browser IDE with project files and BYOK AI", keywords: ["ide", "code", "editor", "develop", "monaco", "programming"], group: "Build" },
  { view: "notebooks", label: "Intelligence Notebooks", codename: "Notebooks", blurb: "Shared analysis sessions with SQL execution", keywords: ["notebook", "sql", "jupyter", "analysis"], group: "Build", access: "pro" },
  { view: "zahten", label: "Agent Forge", codename: "Zahten", blurb: "Design, scaffold, and harden agents", keywords: ["forge", "agent builder", "scaffold"], group: "Build" },
  { view: "plugins", label: "Plugin Marketplace", codename: "Plugins", blurb: "Connectors and modules", keywords: ["plugin", "marketplace", "connector", "extension"], group: "Build", access: "pro" },
  { view: "snippets", label: "Code Snippets", codename: "Snippets", blurb: "Save and reuse code blocks", keywords: ["snippet", "code library", "save code"], group: "Build" },
  { view: "media2code", label: "Media to Code", codename: "Media → Code", blurb: "Turn images and video into clean HTML/CSS embeds", keywords: ["media", "image", "video", "embed", "html", "css", "visual", "convert"], group: "Build" },
  { view: "whiteboard", label: "Whiteboard", codename: "Canvas", blurb: "Infinite canvas with layers, snap grids, and freeform sketching", keywords: ["whiteboard", "canvas", "draw", "sketch", "diagram", "board"], group: "Build" },

  // WORKSPACE
  { view: "library", label: "Library", codename: "Library", blurb: "Saved files and references", keywords: ["library", "files", "storage", "documents"], group: "Workspace" },
  { view: "projects", label: "Projects", codename: "Projects", blurb: "Organize conversations into projects", keywords: ["project", "folder", "organize"], group: "Workspace" },
  { view: "memory", label: "Memory Center", codename: "Memory", blurb: "Long-term context and recall", keywords: ["memory", "remember", "context", "recall"], group: "Workspace" },
  { view: "teams", label: "Team Workspace", codename: "Teams", blurb: "Collaborate with role-based access", keywords: ["team", "collaborate", "share", "workspace"], group: "Workspace", access: "pro" },
  { view: "community", label: "Community", codename: "Community", blurb: "Ask, request, and vote on features", keywords: ["community", "forum", "vote"], group: "Workspace", access: "pro" },
  { view: "persona-store", label: "Persona Store", codename: "Personas", blurb: "Browse and configure AI personas", keywords: ["persona", "character", "personality"], group: "Workspace" },
  { view: "vedic-astrology", label: "Vedic Astrology", codename: "Vedic", blurb: "Sidereal chart calculations", keywords: ["astrology", "vedic", "horoscope", "chart"], group: "Workspace" },
  { view: "guardian-vault", label: "Guardian Vault", codename: "Vault", blurb: "Centralized security command center", keywords: ["vault", "password", "secret", "mfa", "totp"], group: "Workspace" },
  { view: "knowledge-vault", label: "Knowledge Vault (RAG)", codename: "Knowledge Vault", blurb: "Upload files or connect APIs — Aureon retrieves them live during chat", keywords: ["rag", "knowledge", "vault", "retrieval", "embeddings", "ingest", "upload", "api source"], group: "Workspace", access: "pro" },

  // ACCOUNT
  { view: "settings", label: "Settings", codename: "Settings", keywords: ["settings", "preferences", "config", "options"], group: "Account" },
  { view: "api-keys", label: "API Keys", codename: "API", blurb: "Add and manage your AI provider API keys (BYOK)", keywords: ["api", "api key", "byok", "keys", "provider", "openai", "anthropic", "gemini", "groq"], group: "Account" },
  { view: "subscription", label: "Subscribe or manage your plan", codename: "Subscription", keywords: ["billing", "subscription", "plan", "upgrade", "pricing", "manage"], group: "Account" },
  { view: "stats", label: "My Usage Stats", codename: "Stats", keywords: ["stats", "usage", "analytics"], group: "Account" },
  { view: "audit", label: "Audit Trail", codename: "Audit", keywords: ["audit", "log", "history", "trail"], group: "Account", access: "pro" },
  { view: "bug-reports", label: "Bug Reports", codename: "Bugs", keywords: ["bug", "report", "issue", "feedback"], group: "Account" },
  { view: "security", label: "Security Center", codename: "Security", keywords: ["security center"], group: "Account", access: "pro", adminOnly: true },
  { view: "self-access", label: "Self-Access Learning", codename: "Self-Access", keywords: ["self access", "learning"], group: "Account", adminOnly: true },
];

export const INTENT_GROUPS: IntentGroup[] = [
  "Create", "Analyze", "Investigate", "Build", "Workspace", "Account",
];

export const INTENT_GROUP_BLURB: Record<IntentGroup, string> = {
  Create: "Make images, video, code, documents",
  Analyze: "Data, financial, patterns, geospatial",
  Investigate: "Search, OSINT, prediction, cyber",
  Build: "IDE, notebooks, agents, plugins",
  Workspace: "Library, projects, memory, teams",
  Account: "Settings, billing, stats, audit",
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
  personaId?: string;
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

  // PERSONA (mirror existing TASK_PERSONA_MAP)
  const personaMap: { keywords: string[]; personaId: string }[] = [
    { keywords: ["review code", "debug", "refactor", "fix bug", "code audit", "codebase", "architecture"], personaId: "codeforge" },
    { keywords: ["ui", "design", "layout", "css", "responsive", "component", "animation", "pixel"], personaId: "uiforge" },
    { keywords: ["research", "sources", "study", "paper", "academic", "citation", "literature"], personaId: "researcher" },
    { keywords: ["strategy", "plan", "roadmap", "decision", "pros and cons", "trade-off", "long-term"], personaId: "strategist" },
    { keywords: ["analyze", "data", "metrics", "numbers", "statistics", "trend", "forecast"], personaId: "analyst" },
    { keywords: ["write", "blog", "article", "copy", "email", "story", "tone", "voice"], personaId: "writer" },
    { keywords: ["truth", "uncensored", "honest", "direct", "raw", "no filter"], personaId: "truth" },
    { keywords: ["code", "function", "api", "implement", "build", "develop", "script", "python", "typescript", "react"], personaId: "engineer" },
  ];
  const m = personaMap.find((p) => p.keywords.some((k) => lower.includes(k)));
  if (m) out.personaId = m.personaId;

  return out;
}
