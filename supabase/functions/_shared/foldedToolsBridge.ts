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
  /** Owned Google account service pull. */
  googleService?: string;
  /** Design-lab analysis over text the operator supplied. */
  zali?: { analysisType: string; projectData: string };
  /** Coding-laws engine: read the ledger, or run a discovery pass. */
  codingLaws?: "read" | "run";
  /** Attached files to push through text extraction. */
  files?: FoldedFile[];
}

export interface FoldedResult {
  context: string;
  fired: string[];
  offline: string[];
}

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
      return { ok: false, status: 404, body, failure: `${fn} offline (404 — function not deployed)` };
    }
    if (!r.ok) {
      const msg = body?.error ? String(body.error).slice(0, 200) : `http ${r.status}`;
      return { ok: false, status: r.status, body, failure: `${fn} failed (${r.status}: ${msg})` };
    }
    return { ok: true, status: r.status, body };
  } catch (e) {
    const err = e as Error;
    if (err?.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        body: null,
        failure: `${fn} still running past ${Math.round(ceilingMs / 1000)}s — the run continues server-side; results land in its own module, not in this reply`,
      };
    }
    return { ok: false, status: 0, body: null, failure: `${fn} offline (${err?.message || "network error"})` };
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

  // Owned Google account — read only, and only the operator's own account.
  if (/\b(my)\s+(gmail|inbox|email|calendar|drive|photos|contacts|tasks)\b/i.test(raw)) {
    const svc = /gmail|inbox|email/i.test(raw)
      ? "gmail"
      : /calendar/i.test(raw)
        ? "calendar"
        : /drive/i.test(raw)
          ? "drive"
          : /photos/i.test(raw)
            ? "photos"
            : /contacts/i.test(raw)
              ? "contacts"
              : "tasks";
    plan.googleService = svc;
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
 * Runs every planned tool concurrently. Legs are independent — none reads
 * another's output — so a slow engine delays only itself, and each leg owns
 * its own failure text.
 */
export async function runFoldedTools(
  plan: FoldedPlan,
  auth: string | null,
): Promise<FoldedResult> {
  const fired: string[] = [];
  const offline: string[] = [];
  const parts: string[] = [];
  const started = Date.now();

  const legs: Array<[string, Promise<void>]> = [];

  const note = (fn: string, out: InvokeOutcome) => {
    fired.push(`${fn}(${out.status})`);
    if (out.failure) offline.push(out.failure);
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
  if (plan.briefingSubject) {
    legs.push(["generate-briefing", (async () => {
      const out = await invoke("generate-briefing", { subject: plan.briefingSubject }, auth, CEILING.heavy);
      note("generate-briefing", out);
      if (!out.ok) return;
      const b = out.body || {};
      parts.push(
        `BRIEFING — subject: ${plan.briefingSubject}`,
        `- sources checked: ${b.sources_checked ?? 0} | domains covered: ${b.domains_covered ?? 0}`,
        String(b.briefing ?? "").slice(0, 6000),
      );
    })()]);
  } 

  // ── Notebook ───────────────────────────────────────────────────────────
  if (plan.notebookCellId) {
    legs.push(["notebook-execute", (async () => {
      const out = await invoke("notebook-execute", { cellId: plan.notebookCellId }, auth, CEILING.medium);
      note("notebook-execute", out);
      if (!out.ok) return;
      parts.push(`NOTEBOOK CELL ${plan.notebookCellId} OUTPUT:`, JSON.stringify(out.body).slice(0, 3000));
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
  if (plan.googleService) {
    legs.push(["google-data", (async () => {
      const out = await invoke(
        "google-data",
        { service: plan.googleService, aggregate: true, params: {} },
        auth,
        CEILING.medium,
      );
      note("google-data", out);
      if (!out.ok) return;
      parts.push(
        `GOOGLE (${plan.googleService}) — operator's OWN connected account(s) only:`,
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
  };
}
