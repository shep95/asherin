// foldedToolsBridge — the rest of the software fold for Asherin chat.
//
// Earlier waves wired three sensors into the chat turn (geo, live dork,
// identity). Everything else in the platform was named in the prompt text but
// never actually reachable: the model could describe zerlal, the knowledge
// vault, briefings and notebooks, and it would describe them confidently
// without a single byte of live data behind the description. A tool that only
// exists in a system prompt is a tool that hallucinates.
//
// This module invokes the real edge functions. Three rules govern it:
//
//   1. NEVER fabricate a result. A 404 is reported as "offline", a non-2xx is
//      reported with its status, a timeout is reported as still-running. The
//      model is handed the failure verbatim so it says so out loud.
//   2. Mutating tools require an explicit imperative. "what's in my vault"
//      reads; only "vault agent: ..." writes. A read-shaped question must
//      never trigger a write-shaped invoke.
//   3. PII in recon output is masked before it enters the prompt. Chat is a
//      surface a third party can shoulder-read; an audit does not need the
//      whole mailbox to prove the mailbox is exposed.
//
// No secret value ever appears in the returned context. Keys are read from the
// environment inside this module and used only as request headers.

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * The exact service ids `google-data` dispatches on. Kept as a closed union so
 * a planner typo fails the typecheck instead of failing at runtime, mid-turn,
 * as an `Unknown service` throw the operator never sees.
 */
export type GoogleDataService =
  | "gmail_inbox"
  | "gmail_stats"
  | "gmail_forensics"
  | "calendar_events"
  | "contacts"
  | "drive_files";

/**
 * The `google-mesh` actions chat may fire. `send_draft` is deliberately absent:
 * mail leaves the account only from the Google surface, after an explicit
 * confirmation the chat turn cannot supply.
 */
export type GoogleMeshAction =
  | "status"
  | "search_mail"
  | "daily_digest"
  | "relationship_graph"
  | "commitments"
  | "pattern_map"
  | "attention_ledger"
  | "build_voiceprint"
  | "ghostwrite"
  | "dossier"
  | "meet_vault"
  | "sentinel"
  | "fit_location"
  | "audit_log";



export interface FoldedFile {
  name: string;
  type: string;
  base64: string;
  size?: number;
}

export interface FoldedPlan {
  /** Semantic read of the operator's knowledge vault. */
  vaultQuery?: string;
  /** Explicit vault-agent command (write-capable). */
  vaultCommand?: string;
  /** Domain for zerlal subdomain / attack-surface recon. */
  zerlalHost?: string;
  /** Equal-weight subdomain AND path audit for one host. */
  cyberMapHost?: string;
  /** AXRLEN probabilistic scenario run. */
  axrlen?: { region: string; predictionType: string };
  /** Daily/ad-hoc briefing subject. */
  briefingSubject?: string;
  /** Notebook cell uuid to execute. */
  notebookCellId?: string;
  /** Notebook intent present but no cell id supplied. */
  notebookNeedsCell?: boolean;
  /** Zahten procedure / scheduled agent uuid. */
  agentId?: string;
  agentNeedsId?: boolean;
  /**
   * Owned Google account service pull. Must be a service id google-data
   * actually implements — a friendly noun like "gmail" throws
   * `Unknown service` inside the function and the turn loses the leg.
   */
  googleService?: GoogleDataService;
  /**
   * google-mesh control-surface action. Read and compose only: `ghostwrite`
   * is preview-shaped here and `send_draft` is never planned from chat, so a
   * conversational turn can never put mail on the wire.
   */
  googleMesh?: {
    action: GoogleMeshAction;
    query?: string;
    /** Dossier subject — an address when one was given, otherwise a name. */
    email?: string;
    name?: string;
    to?: string;
    subject?: string;
    intent?: string;
  };

  /** Zophiel open-web sweep the operator explicitly asked for. */
  zophielQuery?: string;
  /** Design-lab analysis over text the operator supplied. */
  zali?: { analysisType: string; projectData: string };
  /** Coding-laws engine: read the ledger, or run a discovery pass. */
  codingLaws?: "read" | "run";
  /** Attached files to push through text extraction. */
  files?: FoldedFile[];
}

/**
 * One real invoke, as the transcript and Connect both see it. The tool card in
 * chat is built from this: organ + latency + a masked quote. Nothing here is
 * synthesised — a row exists only because an invoke returned or failed.
 */
export interface FoldedRow {
  organ: string;
  capability: string;
  ok: boolean;
  latencyMs: number;
  /** Short, PII-masked evidence line. Never a secret, never a full payload. */
  quote?: string;
}

export interface FoldedResult {
  context: string;
  fired: string[];
  offline: string[];
  /** Structured rows for the chat tool cards and the hand hints. */
  rows: FoldedRow[];
  /** Organ ids that actually ran this turn (deduped, routable only). */
  organs: string[];
}

import { emitPull } from "./connectPull.ts";
import { isRoutableOrgan } from "./organRouter.ts";

// ── PII masking ──────────────────────────────────────────────────────────────

const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const PHONE_RE = /\b(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?(\d{4})\b/g;

/**
 * Masks mailbox locals and phone subscriber digits. The domain and the country
 * code survive because those are the parts an attack-surface finding is about;
 * the identifying half is what gets dropped.
 */
export function maskPii(text: string): string {
  return String(text || "")
    .replace(EMAIL_RE, (_m, first, domain) => `${first}***${domain}`)
    .replace(PHONE_RE, (m, cc, last4) => `${cc ? String(cc).trim() : ""}***-***-${last4}`.trim());
}

// ── Invoke helper ────────────────────────────────────────────────────────────

interface InvokeOutcome {
  ok: boolean;
  status: number;
  body: any;
  /** Wall time of the invoke, so a trace row reports what actually elapsed. */
  latencyMs?: number;
  /** Populated when the call could not produce a result at all. */
  failure?: string;
}

/**
 * One-shot invoke of a sibling edge function.
 *
 * The ceiling is a deliberate product decision, not a network setting: a chat
 * turn that never returns is a broken conversation. When a long engine exceeds
 * it we do not cancel the operator's intent silently — the engine keeps running
 * server-side and the model is told the run is still in flight, so the answer
 * points at the module instead of inventing the output.
 */
async function invoke(
  fn: string,
  payload: unknown,
  auth: string | null,
  ceilingMs: number,
): Promise<InvokeOutcome> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url) return { ok: false, status: 0, body: null, failure: "no-supabase-url" };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ceilingMs);
  const startedAt = Date.now();
  try {
    const r = await fetch(`${url}/functions/v1/${fn}`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(payload ?? {}),
    });
    const text = await r.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (r.status === 404) {
      return { ok: false, status: 404, body, latencyMs: Date.now() - startedAt, failure: `${fn} offline (404 — function not deployed)` };
    }
    if (!r.ok) {
      const msg = body?.error ? String(body.error).slice(0, 200) : `http ${r.status}`;
      return { ok: false, status: r.status, body, latencyMs: Date.now() - startedAt, failure: `${fn} failed (${r.status}: ${msg})` };
    }
    return { ok: true, status: r.status, body, latencyMs: Date.now() - startedAt };
  } catch (e) {
    const err = e as Error;
    if (err?.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        body: null,
        latencyMs: Date.now() - startedAt,
        failure: `${fn} still running past ${Math.round(ceilingMs / 1000)}s — the run continues server-side; results land in its own module, not in this reply`,
      };
    }
    return { ok: false, status: 0, body: null, latencyMs: Date.now() - startedAt, failure: `${fn} offline (${err?.message || "network error"})` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Intent detection ─────────────────────────────────────────────────────────

const HOST_RE = /\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})\b/i;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
// Words that end in a dot-suffix but are prose, not hosts.
const HOST_STOPLIST = new Set(["e.g", "i.e", "u.s", "u.k", "etc.al"]);

function firstHost(text: string): string | undefined {
  const m = text.match(HOST_RE);
  if (!m) return undefined;
  const host = m[1].toLowerCase();
  if (HOST_STOPLIST.has(host)) return undefined;
  // A bare "index.ts" or "package.json" is a filename, not a domain.
  if (/\.(ts|tsx|js|jsx|json|md|py|sql|css|html|yml|yaml|sh|txt|png|jpg|pdf)$/i.test(host)) return undefined;
  return host;
}

const AXRLEN_REGIONS = [
  "global", "united states", "usa", "us", "china", "russia", "europe", "middle east",
  "africa", "asia", "india", "israel", "iran", "ukraine", "taiwan", "latin america",
];

/**
 * Classifies a turn into concrete tool invocations.
 *
 * Every trigger below requires an imperative or an unambiguous possessive.
 * Broad nouns ("vault", "agent", "brief") are deliberately NOT triggers on
 * their own: a turn that merely mentions a subsystem must not spend the
 * operator's budget invoking it.
 */
export function planFoldedTools(text: string, files?: FoldedFile[]): FoldedPlan | null {
  const raw = String(text || "").trim();
  const lc = raw.toLowerCase();
  const plan: FoldedPlan = {};

  if (files?.length) plan.files = files.slice(0, 3);

  // Knowledge Vault — READ. Guardian Vault is a different subsystem and is
  // never touched here; its secrets must not reach a model prompt.
  if (
    /\b(in|from|search|check|look\s+in|what'?s\s+in)\s+(my|the)\s+(knowledge\s+)?vault\b/i.test(raw) ||
    /\bvault\b.*\b(about|regarding|on)\b/i.test(raw) ||
    /\b(my|our)\s+(files|notes|documents|docs)\s+(about|on|regarding)\b/i.test(raw)
  ) {
    plan.vaultQuery = raw.slice(0, 500);
  }

  // Knowledge Vault — WRITE. Explicit imperative only.
  const vaultCmd = raw.match(/\bvault\s+(?:agent|command)\s*[:\-]\s*(.+)$/i);
  if (vaultCmd) plan.vaultCommand = vaultCmd[1].trim().slice(0, 500);

  const host = firstHost(raw);

  // Equal-weight subdomain AND path audit.
  if (host && /\b(cyber\s*map|site\s*map\s*audit|map\s+the\s+(whole\s+)?site|subdomains?\s+and\s+paths|full\s+surface)\b/i.test(raw)) {
    plan.cyberMapHost = host;
  } else if (host && /\b(recon|reconnaissance|zerlal|attack\s*surface|subdomain|dns\s+audit|security\s+posture\s+of)\b/i.test(raw)) {
    plan.zerlalHost = host;
  }

  // AXRLEN scenarios.
  if (/\b(axrlen|scenario\s+(run|forecast)|probabilistic\s+(forecast|scenario)|geopolitical\s+forecast)\b/i.test(raw)) {
    const region = AXRLEN_REGIONS.find((r) => lc.includes(r)) || "global";
    const predictionType = /\bmarket|financial|price\b/i.test(raw) ? "market" : "comprehensive";
    plan.axrlen = { region, predictionType };
  }

  // Briefings.
  const brief = raw.match(/\b(?:brief\s+me\s+on|briefing\s+(?:on|about)|give\s+me\s+a\s+briefing\s+(?:on|about))\s+(.+)$/i);
  if (brief) plan.briefingSubject = brief[1].trim().slice(0, 200);
  else if (/\b(my\s+)?(daily|morning)\s+brief(ing)?\b/i.test(raw)) plan.briefingSubject = "daily";

  // Notebooks.
  if (/\b(run|execute)\s+(this\s+|the\s+)?(notebook|cell)\b/i.test(raw)) {
    const id = raw.match(UUID_RE);
    if (id) plan.notebookCellId = id[0];
    else plan.notebookNeedsCell = true;
  }

  // Zahten procedures / scheduled agents.
  if (/\b(run|execute|trigger)\s+(the\s+)?(agent|procedure|zahten)\b/i.test(raw)) {
    const id = raw.match(UUID_RE);
    if (id) plan.agentId = id[0];
    else plan.agentNeedsId = true;
  }

  // ── Owned Google account — the operator's own mailbox, nobody else's ────
  //
  // Two surfaces sit behind these triggers. `google-data` is the flat service
  // pull (a page of the inbox, the next events, the contact list). `google-mesh`
  // is the derived read: who is going quiet, what was promised, where the week
  // went. A turn can legitimately fire both, and they are independent legs.

  // Flat service pull. Only fires on an unambiguous possessive, so "email marketing
  // is broken" never opens the mailbox.
  if (/\bmy\s+(gmail|inbox|e-?mail|calendar|schedule|drive|contacts)\b/i.test(raw)) {
    plan.googleService = /gmail|inbox|e-?mail/i.test(raw)
      ? "gmail_inbox"
      : /calendar|schedule/i.test(raw)
        ? "calendar_events"
        : /drive/i.test(raw)
          ? "drive_files"
          : "contacts";
  }

  // Fused single-person read. Owned mailboxes only, and the trigger demands
  // the word "dossier" or an explicit "everything on X" so a passing mention
  // of a name never opens a profile.
  const dossier =
    raw.match(/\bdossier\s+(?:for|on|about)\s+(.+)$/i) ||
    raw.match(/\b(?:everything|what\s+do\s+(?:we|i)\s+have)\s+on\s+([^\s].{1,60})$/i) ||
    raw.match(/\bprofile\s+(?:for|on)\s+([^\s].{1,60})$/i);
  if (dossier) {
    const subject = dossier[1].trim().replace(/[?.!]+$/, "").slice(0, 120);
    const asEmail = subject.match(/[^\s<>,]+@[^\s<>,]+\.[^\s<>,]{2,}/);
    plan.googleMesh = asEmail
      ? { action: "dossier", email: asEmail[0] }
      : { action: "dossier", name: subject };
  }

  // Mail retrieval about a person or subject: "what did dana email me about",
  // "who emailed me about the lease", "search my mail for the invoice".
  const mailAbout =
    raw.match(/\bwhat\s+did\s+(.+?)\s+(?:e-?mail|write|send|say\s+to)\s+me\s+about\s+(.+)$/i) ||
    raw.match(/\bwhat\s+did\s+(.+?)\s+(?:e-?mail|write|send)\s+me\b(.*)$/i);
  const mailSearch = raw.match(/\b(?:search|find|look\s+through|check)\s+(?:my\s+)?(?:mail|gmail|inbox|e-?mails?)\s+(?:for|about)\s+(.+)$/i);
  const whoEmailed = /\bwho\s+(?:has\s+)?e-?mailed\s+me\b/i.test(raw);

  if (plan.googleMesh?.action === "dossier") {
    // already planned — a dossier ask must not degrade into a raw mail search
  } else if (mailSearch) {
    plan.googleMesh = { action: "search_mail", query: mailSearch[1].trim().slice(0, 200) };
  } else if (mailAbout) {
    // Gmail's own query grammar does the narrowing: a name goes to `from:`,
    // the remaining clause stays as free text. No result is ever synthesised
    // from the name alone.
    const who = mailAbout[1].trim().replace(/[^\w@.\-' ]/g, "").slice(0, 60);
    const about = (mailAbout[2] || "").trim().replace(/[?.!]+$/, "").slice(0, 120);
    plan.googleMesh = {
      action: "search_mail",
      query: [who ? `from:${who.includes(" ") ? `"${who}"` : who}` : "", about].filter(Boolean).join(" ").trim(),
    };
  } else if (whoEmailed) {
    plan.googleMesh = { action: "search_mail", query: "in:inbox newer_than:7d" };
  }

  // Derived mesh reads. Each needs its own imperative; none of them is the
  // default reading of a bare noun.
  if (!plan.googleMesh) {
    const meshAction: GoogleMeshAction | null =
      /\b(daily\s+digest|\bdigest\b|what'?s\s+on\s+my\s+plate|catch\s+me\s+up\s+on\s+(my\s+)?(mail|day)|brief\s+me\s+on\s+my\s+day)\b/i.test(raw)
        ? "daily_digest"
        : /\b(relationship\s+(graph|map)|who\s+(am\s+i|have\s+i)\s+(closest|lost\s+touch|gone\s+quiet)|who\s+is\s+going\s+quiet|going\s+dormant)\b/i.test(raw)
          ? "relationship_graph"
          : /\b(commitments?|what\s+did\s+i\s+promise|what\s+do\s+i\s+owe|open\s+obligations?|what'?s\s+overdue|anything\s+overdue|am\s+i\s+overdue)\b/i.test(raw)
            ? "commitments"
            : /\b(meet\s+(recordings?|transcripts?|vault)|recordings?\s+(of|from)\s+(my\s+)?meet(ings?)?)\b/i.test(raw)
              ? "meet_vault"
              : /\b(any\s+)?sentinel\b|\bany\s+alerts?\b|\bwhat\s+alerts?\b/i.test(raw)
                ? "sentinel"
                : /\b(fit\s+location|google\s+fit\s+location|location\s+history)\b/i.test(raw)
                  ? "fit_location"
                  : /\b(pattern\s+map|place\s+rhythm|where\s+do\s+i\s+(go|spend))\b/i.test(raw)
              ? "pattern_map"
              : /\b(attention\s+ledger|how\s+much\s+time\s+(did\s+i|do\s+i)\s+spend\s+in\s+meetings|meeting\s+load)\b/i.test(raw)
                ? "attention_ledger"
                : /\bbuild\s+(my\s+)?voice\s?print\b/i.test(raw)
                  ? "build_voiceprint"
                  : /\b(google\s+(audit|activity)\s+log|what\s+has\s+asherin\s+done\s+(to|with)\s+my\s+google)\b/i.test(raw)
                    ? "audit_log"
                    : /\b(google\s+(status|accounts?\s+connected)|which\s+google\s+accounts?\b)/i.test(raw)
                      ? "status"
                      : null;
    if (meshAction) plan.googleMesh = { action: meshAction };
  }

  // Ghostwriting. Preview only — the planner never asks the function to persist
  // a draft and has no path at all to a send.
  const ghost = raw.match(
    /\b(?:ghostwrite|draft|write)\s+(?:an?\s+)?(?:e-?mail|reply|message)\s+(?:to|for)\s+([^\s,]+@[^\s,]+)\s*(?:,|:|\s+)?\s*(?:saying|about|that|to)?\s*(.*)$/i,
  );
  if (ghost) {
    plan.googleMesh = {
      action: "ghostwrite",
      to: ghost[1].replace(/[.,;]+$/, ""),
      intent: (ghost[2] || raw).trim().slice(0, 1000),
    };
  }


  // Design lab.
  if (/\b(zali|dfm|design\s+for\s+manufactur|manufactur(ing|ability)\s+(review|check|assessment))\b/i.test(raw)) {
    const analysisType = /thermal/i.test(raw)
      ? "simulation_thermal"
      : /electric|circuit|spice/i.test(raw)
        ? "simulation_electrical"
        : /fluid|cfd|flow/i.test(raw)
          ? "simulation_fluids"
          : /vibrat|modal/i.test(raw)
            ? "simulation_vibration"
            : /chemical|corros/i.test(raw)
              ? "simulation_chemical"
              : /optimi[sz]/i.test(raw)
                ? "optimization"
                : /material/i.test(raw)
                  ? "material_trends"
                  : /manufactur|dfm/i.test(raw)
                    ? "manufacturing"
                    : "simulation_mechanical";
    plan.zali = { analysisType, projectData: raw.slice(0, 4000) };
  }

  // ── Zophiel open-web sweep ──────────────────────────────────────────────
  //
  // Explicit imperatives only. A passing mention of a topic must never open a
  // live sweep, so the trigger demands either the organ's name or an unmistakable
  // "search the open web for …" / "osint on …" phrasing.
  const zoph =
    raw.match(/\bzophiel\s*(?:search|sweep|on|for|:)?\s+(.{2,200})$/i) ||
    raw.match(/\bosint\s+(?:on|for|about)\s+(.{2,200})$/i) ||
    raw.match(/\b(?:search|sweep|scour)\s+(?:the\s+)?(?:open\s+web|web|internet)\s+(?:for|about|on)\s+(.{2,200})$/i);
  if (zoph) {
    const subject = zoph[1].trim().replace(/[?.!]+$/, "").slice(0, 200);
    if (subject) plan.zophielQuery = subject;
  }

  // Coding laws (IDE substrate).
  if (/\b(coding\s+laws?)\b/i.test(raw)) {
    plan.codingLaws = /\b(run|refresh|update|discover|regenerate)\b/i.test(raw) ? "run" : "read";
  }

  return Object.keys(plan).length ? plan : null;
}

// ── Execution ────────────────────────────────────────────────────────────────

const CEILING = {
  fast: 25_000,
  medium: 45_000,
  heavy: 75_000,
} as const;

/**
 * Which organ in Asherin Connect each edge function belongs to. A trace row
 * whose organ is guessed is worse than no row: the Connect graph would light a
 * node nothing ran on. Anything unmapped is traced under "chat" rather than
 * being invented into a subsystem.
 */
const ORGAN_OF: Record<string, string> = {
  "vault-retrieve": "knowledge-vault",
  "vault-agent": "knowledge-vault",
  "zerlal-domain-recon": "zerlal",
  "asherin-live-dork": "zophiel",
  "zophiel-search": "zophiel",
  "axrlen-analyze": "axrlen",
  "generate-briefing": "briefings",
  "notebook-execute": "notebooks",
  "agent-execute": "zahten",
  "google-data": "google",
  "google-mesh": "google",
  "zali-analyze": "zali",
  "coding-laws-engine": "ide",
  "scrapper-extract": "file-scrapper",
};

/** Trace context: who ran the turn, and which assistant message it belongs to. */
export interface FoldedTraceCtx {
  userId?: string | null;
  turnId?: string | null;
}

/**
 * Runs every planned tool concurrently. Legs are independent — none reads
 * another's output — so a slow engine delays only itself, and each leg owns
 * its own failure text.
 */
export async function runFoldedTools(
  plan: FoldedPlan,
  auth: string | null,
  trace?: FoldedTraceCtx,
): Promise<FoldedResult> {
  const fired: string[] = [];
  const offline: string[] = [];
  const rows: FoldedRow[] = [];
  const parts: string[] = [];
  const started = Date.now();

  const legs: Array<[string, Promise<void>]> = [];

  const note = (fn: string, out: InvokeOutcome, quote?: string) => {
    fired.push(`${fn}(${out.status})`);
    if (out.failure) offline.push(out.failure);
    const key = fn.split(":")[0];
    // An unmapped function is traced under "chat" rather than being invented
    // into a subsystem, and a retired id can never reach the graph at all.
    const mapped = ORGAN_OF[key] ?? "chat";
    const organ = isRoutableOrgan(mapped) ? mapped : "chat";
    const capability = fn.includes(":") ? fn.split(":").slice(1).join(":") : key;
    const evidence = out.failure ?? (quote ? maskPii(quote).slice(0, 180) : undefined);
    rows.push({
      organ,
      capability,
      ok: out.ok,
      latencyMs: out.latencyMs ?? 0,
      quote: evidence,
    });
    // One Connect row per real invoke, keyed to the assistant turn so the
    // transcript and the Connect log can never disagree about what ran. A
    // failed tool is written fail-red, never dropped or dressed as success.
    void emitPull(trace?.userId, {
      organ,
      capability,
      fromSurface: "chat",
      status: out.ok ? "ok" : "fail",
      latencyMs: out.latencyMs,
      quote: evidence ?? null,
      meta: trace?.turnId ? { turn_id: trace.turnId } : undefined,
    });
  };

  /**
   * Attaches the first live line an organ returned to its already-written row,
   * so the chat tool card quotes real bytes instead of a generic "ran ok".
   * Masked, clipped, and only ever applied to a row that exists.
   */
  const quoteRow = (fn: string, text: string) => {
    const key = fn.split(":")[0];
    const row = [...rows].reverse().find((r) => r.capability === key || r.capability === fn);
    if (row && !row.quote && text) row.quote = maskPii(text).replace(/\s+/g, " ").trim().slice(0, 180);
  };

  // ── Knowledge Vault read ───────────────────────────────────────────────
  if (plan.vaultQuery) {
    legs.push(["vault-retrieve", (async () => {
      const out = await invoke("vault-retrieve", { query: plan.vaultQuery, k: 6 }, auth, CEILING.fast);
      note("vault-retrieve", out);
      if (!out.ok) return;
      const matches: Array<{ sourceName: string; content: string; similarity: number }> = out.body?.matches ?? [];
      if (!matches.length) {
        parts.push("KNOWLEDGE VAULT: query ran, zero matching chunks. The vault holds nothing on this — say so; do not substitute general knowledge and call it a vault hit.");
        return;
      }
      parts.push(`KNOWLEDGE VAULT (${matches.length} chunk(s), operator's own files):`);
      quoteRow("vault-retrieve", `${matches.length} chunk(s) · ${String(matches[0]?.content || "").slice(0, 140)}`);
      matches.slice(0, 6).forEach((m, i) => {
        const sim = typeof m.similarity === "number" ? m.similarity.toFixed(2) : "?";
        parts.push(`[Vault ${i + 1} · ${m.sourceName || "source"} · sim=${sim}] ${String(m.content || "").slice(0, 1200)}`);
      });
    })()]);
  }

  // ── Knowledge Vault agent (write-capable) ──────────────────────────────
  if (plan.vaultCommand) {
    legs.push(["vault-agent", (async () => {
      const out = await invoke("vault-agent", { command: plan.vaultCommand }, auth, CEILING.medium);
      note("vault-agent", out);
      if (!out.ok) return;
      parts.push(`VAULT AGENT RESULT: ${JSON.stringify(out.body).slice(0, 1500)}`);
    })()]);
  }

  // ── Zerlal domain recon ────────────────────────────────────────────────
  const reconHost = plan.zerlalHost || plan.cyberMapHost;
  if (reconHost) {
    legs.push(["zerlal-domain-recon", (async () => {
      const out = await invoke("zerlal-domain-recon", { domain: reconHost }, auth, CEILING.heavy);
      note("zerlal-domain-recon", out);
      if (!out.ok) return;
      const b = out.body || {};
      parts.push(
        `ZERLAL RECON — ${reconHost}`,
        `- risk grade: ${b.risk_grade ?? "n/a"}`,
        `- findings: ${b.findings_count ?? 0}`,
        `- subdomains found: ${Array.isArray(b.subdomains_found) ? b.subdomains_found.length : (b.subdomains_found ?? 0)}${
          Array.isArray(b.subdomains_found) && b.subdomains_found.length
            ? ` → ${b.subdomains_found.slice(0, 30).join(", ")}`
            : ""
        }`,
        `- attack surface score: ${b.total_attack_surface_score ?? "n/a"} | zero-trust: ${b.zero_trust_score ?? "n/a"}`,
        `- summary: ${maskPii(Array.isArray(b.summary) ? b.summary.join(" · ") : String(b.summary ?? "")).slice(0, 1200)}`,
        `- scan id: ${b.scan_id ?? "n/a"} (full findings live in the Zerlal module)`,
      );
    })()]);
  }

  // ── Path half of the cyber map — equal weight to the subdomain half ────
  if (plan.cyberMapHost) {
    legs.push(["asherin-live-dork:path_map", (async () => {
      const out = await invoke("asherin-live-dork", { host: plan.cyberMapHost, mode: "path_map" }, auth, CEILING.medium);
      note("asherin-live-dork:path_map", out);
      if (!out.ok || !out.body?.ok) {
        if (out.ok) offline.push("asherin-live-dork path_map returned not-ok");
        return;
      }
      const pm = out.body.path_map || {};
      const inv: string[] = pm.path_inventory || [];
      const probes: Array<{ path: string; status: number | null }> = pm.seed_probe || [];
      parts.push(
        `PATH SURFACE — ${plan.cyberMapHost}`,
        `- robots.txt: ${pm.robots_status ?? "not fetched"}`,
        `- declared paths (${inv.length}): ${inv.slice(0, 40).join(", ") || "none"}`,
        `- probes: ${probes.length} tried, ${probes.filter((p) => p.status && p.status < 400).length} responded < 400`,
        ...probes.slice(0, 25).map((p) => `  · ${p.path} → ${p.status ?? "no-response"}`),
      );
    })()]);
  }

  // ── Zophiel open-web sweep ─────────────────────────────────────────────
  //
  // The engine roster in the context line is the set of engines that actually
  // tagged a returned hit. No fixed source count is ever asserted: if two
  // engines answered, the model is told two engines answered.
  if (plan.zophielQuery) {
    legs.push(["zophiel-search", (async () => {
      const out = await invoke("zophiel-search", { query: plan.zophielQuery, max_pages: 15, max_depth: 1 }, auth, CEILING.heavy);
      note("zophiel-search", out);
      if (!out.ok) return;
      const rows: Array<{ title?: string; url?: string; snippet?: string; engine?: string; engines?: string[] }> =
        out.body?.results ?? [];
      if (!rows.length) {
        parts.push(`ZOPHIEL SWEEP — "${plan.zophielQuery}": engines ran and returned zero hits. Say the open web returned nothing for this; do not substitute recalled knowledge and present it as a live hit.`);
        return;
      }
      const engines = [...new Set(rows.flatMap((r) => r.engines ?? (r.engine ? [r.engine] : [])))];
      parts.push(
        `ZOPHIEL SWEEP — "${plan.zophielQuery}" (${rows.length} live hits${engines.length ? `, engines that returned: ${engines.join(", ")}` : ""})`,
        "- cite these by number; anything not listed here is not a live hit.",
        ...rows.slice(0, 12).map((r, i) =>
          `[Z${i + 1}] ${r.title ?? "(untitled)"} — ${r.url ?? "no url"}\n    ${maskPii(String(r.snippet ?? "")).slice(0, 400)}`,
        ),
      );
    })()]);
  }

  // ── AXRLEN ─────────────────────────────────────────────────────────────
  if (plan.axrlen) {
    legs.push(["axrlen-analyze", (async () => {
      const out = await invoke("axrlen-analyze", plan.axrlen, auth, CEILING.heavy);
      note("axrlen-analyze", out);
      if (!out.ok) return;
      parts.push(`AXRLEN SCENARIO RUN (${plan.axrlen!.region} / ${plan.axrlen!.predictionType}):`);
      parts.push(JSON.stringify(out.body).slice(0, 4000));
    })()]);
  }

  // ── Briefing ───────────────────────────────────────────────────────────
  //
  // generate-briefing builds from the operator's saved briefing profile; it
  // does not accept a free-text subject. The subject is sent for forward
  // compatibility, but the context line says out loud what the run actually
  // covered so the model cannot present a profile briefing as a bespoke one.
  if (plan.briefingSubject) {
    legs.push(["generate-briefing", (async () => {
      const out = await invoke("generate-briefing", { subject: plan.briefingSubject }, auth, CEILING.heavy);
      note("generate-briefing", out);
      if (!out.ok) return;
      const b = out.body || {};
      parts.push(
        `BRIEFING RUN (asked subject: ${plan.briefingSubject})`,
        "- scope note: this engine runs the operator's saved briefing profile topics, not an arbitrary subject. If the requested subject is absent below, say the profile does not cover it and point to briefing settings.",
        `- sources checked: ${b.sources_checked ?? 0} | domains covered: ${b.domains_covered ?? 0}`,
        maskPii(String(b.briefing ?? "")).slice(0, 6000),
      );
    })()]);
  }

  // ── Notebook ───────────────────────────────────────────────────────────
  //
  // The executor needs cellType and content alongside the id; chat only ever
  // holds the id, so it runs the ownership-checked path and reports exactly
  // what came back rather than pretending a cell body was evaluated.
  if (plan.notebookCellId) {
    legs.push(["notebook-execute", (async () => {
      const out = await invoke("notebook-execute", { cellId: plan.notebookCellId }, auth, CEILING.medium);
      note("notebook-execute", out);
      if (!out.ok) return;
      const output = String(out.body?.output ?? "").trim();
      parts.push(
        `NOTEBOOK CELL ${plan.notebookCellId}:`,
        output
          ? output.slice(0, 3000)
          : "- the executor returned no output for this id alone (it needs the cell type and body, which chat does not hold). Tell the operator to run the cell from the Notebooks view; do not invent a result.",
      );
    })()]);
  } else if (plan.notebookNeedsCell) {
    parts.push("NOTEBOOK: execution needs a cell id. Ask the operator for the cell uuid, or tell them to run it from the Notebooks view — do not claim a cell was executed.");
  }

  // ── Zahten procedure / agent ───────────────────────────────────────────
  if (plan.agentId) {
    legs.push(["agent-execute", (async () => {
      const out = await invoke("agent-execute", { agentId: plan.agentId }, auth, CEILING.heavy);
      note("agent-execute", out);
      if (!out.ok) return;
      parts.push(`AGENT RUN ${plan.agentId}:`, JSON.stringify(out.body).slice(0, 3000));
    })()]);
  } else if (plan.agentNeedsId) {
    parts.push("AGENT EXECUTION: no agent id in the request. Ask which saved agent, by id — never guess one and never claim a run happened.");
  }

  // ── Owned Google account ───────────────────────────────────────────────
  //
  // Both Google legs share one failure doctrine: an unconnected account is a
  // product state, not an error to paper over. The model is told to ask for a
  // Tier-2 connect, and is told explicitly that inventing a ledger is not an
  // option — that sentence is the whole reason this branch exists.
  const googleNotConnected = (surface: string) =>
    parts.push(
      `${surface}: no Google account is connected to this operator (the function returned no_account).`,
      "- Tell them to connect Google from the Google surface at read tier (T2 — Gmail, Calendar, Contacts, Drive metadata).",
      "- Do NOT produce any mail, contact, event, file or relationship result. There is no ledger to read yet; a fabricated one is a lie.",
    );

  if (plan.googleService) {
    legs.push(["google-data", (async () => {
      const out = await invoke(
        "google-data",
        { service: plan.googleService, aggregate: true, params: {} },
        auth,
        CEILING.medium,
      );
      note("google-data", out);
      if (!out.ok) {
        const err = String(out.body?.error ?? "");
        if (/no_account|no google account|not connected/i.test(err)) googleNotConnected(`GOOGLE (${plan.googleService})`);
        return;
      }
      parts.push(
        `GOOGLE (${plan.googleService}) — operator's OWN connected account(s) only:`,
        maskPii(JSON.stringify(out.body).slice(0, 4000)),
      );
    })()]);
  }

  // ── Google Mesh (derived reads + draft preview) ────────────────────────
  if (plan.googleMesh) {
    const m = plan.googleMesh;
    legs.push([`google-mesh:${m.action}`, (async () => {
      const payload: Record<string, unknown> = { action: m.action };
      if (m.query) payload.query = m.query;
      if (m.action === "dossier") {
        if (m.email) payload.email = m.email;
        if (m.name) payload.name = m.name;
      }
      if (m.action === "ghostwrite") {
        payload.to = m.to;
        payload.intent = m.intent;
        if (m.subject) payload.subject = m.subject;
        // Preview contract: chat asks for the text, never for a stored draft,
        // and never for a send. Saving is an act the operator performs.
        payload.preview = true;
      }
      const out = await invoke(
        "google-mesh",
        payload,
        auth,
        m.action === "daily_digest" || m.action === "build_voiceprint" ? CEILING.heavy : CEILING.medium,
      );
      note(`google-mesh:${m.action}`, out);
      if (!out.ok) {
        const err = String(out.body?.error ?? "");
        if (err === "no_account") return void googleNotConnected(`GOOGLE MESH (${m.action})`);
        if (err === "tier_required" || err === "no_voiceprint") {
          parts.push(
            `GOOGLE MESH (${m.action}) refused: ${err} — ${String(out.body?.message ?? "").slice(0, 200)}`,
            "- Relay that requirement verbatim. Do not write the email as if the tier existed.",
          );
        }
        return;
      }
      if (m.action === "search_mail") {
        const hits: any[] = out.body?.hits ?? [];
        if (!hits.length) {
          parts.push(
            `GOOGLE MESH search_mail — query \`${out.body?.query ?? m.query}\` ran against the operator's own mailbox(es) and matched nothing.`,
            "- Say the search returned zero messages. Do not reconstruct what the message 'probably' said.",
          );
          return;
        }
        parts.push(`GOOGLE MESH search_mail — ${hits.length} real message(s) for \`${out.body?.query ?? m.query}\`:`);
        hits.slice(0, 8).forEach((h, i) => {
          parts.push(
            `[Mail ${i + 1}] from: ${maskPii(String(h.from ?? ""))} | date: ${h.date ?? "?"} | subject: ${String(h.subject ?? "(none)").slice(0, 160)}`,
            `    ${maskPii(String(h.snippet ?? "")).slice(0, 400)}`,
          );
        });
        return;
      }
      if (m.action === "ghostwrite") {
        parts.push(
          "GOOGLE MESH ghostwrite — DRAFT PREVIEW ONLY. Nothing was saved and nothing was sent.",
          maskPii(JSON.stringify(out.body).slice(0, 3000)),
          "- Show the draft, then say the operator sends it themselves from the Google surface.",
        );
        return;
      }
      if (m.action === "dossier") {
        const b: any = out.body ?? {};
        if (!b.found) {
          parts.push(
            `GOOGLE MESH dossier — \`${m.email ?? m.name}\` does not appear in the operator's connected mailboxes or contacts.`,
            "- Say there is no record in the owned accounts. Do not search the open web for this person and do not infer anything.",
          );
          return;
        }
        parts.push(
          `GOOGLE MESH dossier — fused from the operator's OWN mailboxes, contacts and calendar only:`,
          maskPii(JSON.stringify(b).slice(0, 4000)),
          b.uncertain ? `- Carry this caveat into the answer: ${b.uncertain}` : "",
          "- Do not add employer, location or history that is not in this payload.",
        );
        return;
      }
      if (m.action === "meet_vault") {
        const total = Number(out.body?.total ?? 0);
        parts.push(
          total
            ? `GOOGLE MESH meet records — ${total} file(s) already stored in Drive:`
            : "GOOGLE MESH meet records — none in Drive.",
          maskPii(JSON.stringify(out.body).slice(0, 3000)),
          total ? "" : "- Say plainly: none in Drive. Do not describe meetings that were never recorded.",
        );
        return;
      }
      if (m.action === "sentinel") {
        parts.push(
          `GOOGLE MESH sentinel — cadence: ${String(out.body?.cadence ?? "unknown")}.`,
          maskPii(JSON.stringify(out.body).slice(0, 3000)),
          "- Quote the cadence exactly. Never call this always-on unless the cadence says push.",
        );
        return;
      }
      if (m.action === "fit_location") {
        parts.push(
          "GOOGLE MESH fit location — Google Fit location history, which is NOT device locating, NOT Find Hub, NOT a live position:",
          maskPii(JSON.stringify(out.body).slice(0, 3000)),
          "- If unavailable, say it is not in Fit location history and stop there.",
        );
        return;
      }
      parts.push(
        `GOOGLE MESH ${m.action} — derived from the operator's OWN connected account(s):`,
        maskPii(JSON.stringify(out.body).slice(0, 4000)),
      );

    })()]);
  }


  // ── Design lab ─────────────────────────────────────────────────────────
  if (plan.zali) {
    legs.push(["zali-analyze", (async () => {
      const out = await invoke(
        "zali-analyze",
        { analysisType: plan.zali!.analysisType, projectData: plan.zali!.projectData },
        auth,
        CEILING.heavy,
      );
      note("zali-analyze", out);
      if (!out.ok) return;
      parts.push(
        `ZALI DESIGN-LAB (${plan.zali!.analysisType}) — model-estimated, not a certified solver run:`,
        JSON.stringify(out.body).slice(0, 3000),
      );
    })()]);
  }

  // ── Coding laws ────────────────────────────────────────────────────────
  if (plan.codingLaws === "run") {
    legs.push(["coding-laws-engine", (async () => {
      const out = await invoke("coding-laws-engine", {}, auth, CEILING.heavy);
      note("coding-laws-engine", out);
      if (!out.ok) return;
      parts.push("CODING LAWS ENGINE RUN:", JSON.stringify(out.body).slice(0, 2500));
    })()]);
  } else if (plan.codingLaws === "read") {
    parts.push("CODING LAWS: the operator asked about the laws ledger, not for a discovery pass. Answer from the IDE laws surface; say plainly that no engine run was triggered.");
  }

  // ── Attached files ─────────────────────────────────────────────────────
  for (const [idx, f] of (plan.files ?? []).entries()) {
    legs.push([`scrapper-extract:${f.name}`, (async () => {
      const out = await invoke(
        "scrapper-extract",
        {
          fileId: `chat-${Date.now()}-${idx}`,
          fileName: f.name,
          fileType: f.type,
          fileBase64: f.base64,
        },
        auth,
        CEILING.heavy,
      );
      note(`scrapper-extract:${f.name}`, out);
      const meta = `FILE METADATA — ${f.name} | type: ${f.type || "unknown"} | size: ${
        typeof f.size === "number" ? `${f.size} bytes` : "unknown"
      }`;
      if (!out.ok) {
        parts.push(meta, `- text extraction unavailable (${out.failure}). Describe only what the metadata supports.`);
        return;
      }
      const extracted = String(out.body?.extractedText ?? "");
      parts.push(
        meta,
        extracted
          ? `- extracted text (${extracted.length} chars):\n${maskPii(extracted.slice(0, 8000))}`
          : "- extraction returned no text. Say the file yielded no extractable text rather than guessing its contents.",
      );
    })()]);
  }

  const settled = await Promise.allSettled(legs.map(([, p]) => p));
  settled.forEach((s, i) => {
    if (s.status === "rejected") {
      const why = (s.reason as Error)?.message ?? String(s.reason);
      offline.push(`${legs[i][0]} crashed (${why})`);
    }
  });

  if (offline.length) {
    parts.push(
      "TOOL FAILURES THIS TURN — state these plainly to the operator; never substitute invented output for a failed tool:",
      ...offline.map((o) => `- ${o}`),
    );
  }

  return {
    context: parts.length
      ? `\n[ASHERIN TOOL RUN — ${legs.length} invoke(s), ${Date.now() - started}ms]\n${parts.join("\n")}\n`
      : "",
    fired,
    offline,
    rows,
    organs: [...new Set(rows.map((r) => r.organ))].filter((o) => o !== "chat"),
  };
}
