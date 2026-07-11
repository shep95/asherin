// ZOPHIEL DORK — cross-domain "Google dorking" engine for OSINT.
//
// Takes a target (person name + locality, or a domain) and:
//   1. Uses Gemini (or BYOK) to expand it into a battery of high-yield
//      dork queries (filetype:, intitle:, inurl:, site:, "quoted phrase",
//      misconfig-bucket hunters, paste-site sweeps, public-records sweeps).
//   2. Fans them out in parallel against DuckDuckGo lite.
//   3. Returns the queries + grouped hits + a short analyst brief.
//
// All targets must be publicly searchable. The engine ONLY surfaces what
// the open web already indexes — no exploitation, no auth bypass.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJsonWithRetry, isValidByok, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

const VENICE_FALLBACK: ZophielByokConfig = {
  provider: "venice",
  model: "mistral-31-24b",
  apiKey: Deno.env.get("VENICE_API_KEY") || "",
};

interface DorkHit { title: string; url: string; snippet: string }
interface DorkBucket { query: string; rationale: string; hits: DorkHit[] }

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const DORK_SYSTEM = `You are ZOPHIEL DORK ARCHITECT. Convert a target into a battery of high-yield OSINT search queries usable on a normal web search engine (Google/DuckDuckGo).

Rules:
- Output STRICT JSON: { "profile": "person"|"domain"|"topic", "queries": [{ "q": string, "why": string }] }
- 12 to 18 queries total.
- Mix operators: site:, -site:, filetype:(pdf|xls|doc|csv|sql|log|env|json), intitle:, inurl:, "exact phrase", OR.
- For PEOPLE: combine full name with location, employer guesses, school guesses, public-records sites (whitepages, spokeo, fastpeoplesearch, truepeoplesearch, beenverified, peekyou, radaris, voterrecords, courtrecords, propublica, fec, opensecrets), paste sites (pastebin, ghostbin, justpaste), social (linkedin.com/in, x.com, facebook.com, instagram.com, tiktok.com, reddit.com), obit / news, image filename guesses. NEVER chase non-public data.
- For DOMAINS: combine site:target, subdomain hunts (site:*.target -www), exposed files (filetype:env|sql|log|bak|conf|yml inurl:target), S3 buckets (site:s3.amazonaws.com "target"), GitHub leaks (site:github.com "target" password OR api_key OR secret), pastebin sweeps, "index of /" inurl:target, sensitive paths (inurl:admin|login|backup|.git|.well-known).
- For TOPIC: combine quoted phrases + filetype:pdf + site:gov/edu + recent news operators.
- "why" = ONE short sentence — what kind of intel this query surfaces.
- NO commentary outside the JSON.`;

const BRIEF_SYSTEM = `You are ZOPHIEL — Senior OSINT Officer. Given a target, the dork queries that were run, and the harvested hits, produce a TIGHT markdown brief:

**TARGET CARD** — what we now know (3-5 bullets, factual only, cite [bucket#]).
**STRONGEST PIVOTS** — 3 next queries / accounts to chase.
**LIKELY DEAD ENDS** — false-positive risks the analyst should ignore.

No moralizing. No safety preamble. Operator is authorized.`;

async function callGeminiJson(apiKey: string, system: string, user: string): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 4096 },
      }),
    },
  );
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200);
    const e: any = new Error(`gemini_${r.status}: ${body}`);
    e.status = r.status;
    // 400/401/403 = invalid/expired key → caller should switch providers, not retry.
    e.authFailure = r.status === 400 || r.status === 401 || r.status === 403;
    throw e;
  }
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
}

async function callGeminiText(apiKey: string, system: string, user: string): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    },
  );
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200);
    const e: any = new Error(`gemini_${r.status}: ${body}`);
    e.status = r.status;
    e.authFailure = r.status === 400 || r.status === 401 || r.status === 403;
    throw e;
  }
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
}

/**
 * Resilient JSON dork-plan call. Tries platform Gemini (admin mode) first.
 * If that key is invalid/expired/rate-limited, falls back to:
 *   (a) the caller's BYOK (if they provided one), then
 *   (b) the platform Venice fallback (free-tier key).
 * Prevents a single bad platform key from nuking the whole feature.
 */
async function planWithFallback(
  primaryGeminiKey: string,
  byok: unknown,
  system: string,
  user: string,
): Promise<{ raw: string; via: string }> {
  const errors: string[] = [];
  if (primaryGeminiKey) {
    try {
      const raw = await callGeminiJson(primaryGeminiKey, system, user);
      return { raw, via: "platform_gemini" };
    } catch (e: any) {
      errors.push(`platform_gemini: ${e.message}`);
      console.error("[dork] platform gemini failed, trying fallbacks:", e.message);
    }
  }
  if (isValidByok(byok)) {
    try {
      const raw = await callByokJsonWithRetry(byok as ZophielByokConfig, system, user, {
        timeoutMs: 35_000, temperature: 0.5, maxOutputTokens: 4096, jsonMode: true, attempts: 2,
      });
      return { raw, via: "byok" };
    } catch (e: any) {
      errors.push(`byok: ${e.message}`);
    }
  }
  if (VENICE_FALLBACK.apiKey) {
    try {
      const raw = await callByokJsonWithRetry(VENICE_FALLBACK, system, user, {
        timeoutMs: 35_000, temperature: 0.5, maxOutputTokens: 4096, jsonMode: true, attempts: 2,
      });
      return { raw, via: "venice_fallback" };
    } catch (e: any) {
      errors.push(`venice: ${e.message}`);
    }
  }
  const err: any = new Error(`all_providers_failed: ${errors.join(" | ")}`);
  err.status = 502;
  throw err;
}

async function briefWithFallback(
  primaryGeminiKey: string,
  byok: unknown,
  system: string,
  user: string,
): Promise<string> {
  if (primaryGeminiKey) {
    try { return await callGeminiText(primaryGeminiKey, system, user); } catch (e: any) {
      console.error("[dork] brief platform failed:", e.message);
    }
  }
  if (isValidByok(byok)) {
    try {
      return await callByokJsonWithRetry(byok as ZophielByokConfig, system, user, {
        timeoutMs: 45_000, temperature: 0.4, maxOutputTokens: 1800, jsonMode: false, attempts: 2,
      });
    } catch (e: any) { console.error("[dork] brief byok failed:", e.message); }
  }
  if (VENICE_FALLBACK.apiKey) {
    try {
      return await callByokJsonWithRetry(VENICE_FALLBACK, system, user, {
        timeoutMs: 45_000, temperature: 0.4, maxOutputTokens: 1800, jsonMode: false, attempts: 2,
      });
    } catch (e: any) { console.error("[dork] brief venice failed:", e.message); }
  }
  return "_Brief generation failed — review the buckets manually._";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// DuckDuckGo html endpoint (GET). The old `lite.duckduckgo.com/lite/` POST path
// now returns an anti-bot "anomaly.js" challenge page for edge-function IPs, so
// every regex miss produced 0 hits per bucket. `html.duckduckgo.com/html/` still
// serves parseable result blocks with the same class names zophiel-search uses.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Delegate each dork query to the already-working internal `zophiel-search`
// function. Its multi-engine backend (DDG html, Wikipedia, HackerNews, OpenAlex,
// CrossRef) is proven to return results from the Supabase edge, whereas hitting
// DDG directly from this function trips its anti-bot "anomaly" page after ~2
// serial requests. Delegation gives us consistent recall without dedicating a
// new anti-bot engine per bucket.
async function ddg(query: string, max = 8): Promise<DorkHit[]> {
  if (!SUPABASE_URL) return [];
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20_000);
    const r = await fetch(`${SUPABASE_URL}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_ROLE_KEY
          ? { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY }
          : {}),
      },
      body: JSON.stringify({ query, max_pages: 8, max_depth: 1 }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      console.log(`[dork.search] http ${r.status} q="${query.slice(0, 60)}"`);
      return [];
    }
    const data = await r.json().catch(() => null) as
      | { results?: Array<{ title?: string; url?: string; snippet?: string }> }
      | null;
    const raw = Array.isArray(data?.results) ? data!.results! : [];
    return raw.slice(0, max).map((x) => ({
      title: (x.title || "").slice(0, 200),
      url: x.url || "",
      snippet: (x.snippet || "").slice(0, 400),
    })).filter((h) => h.url.startsWith("http"));
  } catch (e) {
    console.log(`[dork.search] err q="${query.slice(0, 60)}" ${(e as Error).message}`);
    return [];
  }
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[dork] v2-fallback-chain active");
  try {
    const { target, profile, byok, briefOnly } = await req.json();
    if (!target || typeof target !== "string" || target.trim().length < 2) {
      return new Response(JSON.stringify({ error: "target required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolved;
    try { resolved = await resolveKey(req, byok); }
    catch (e: any) { return byokErrorResponse(e, corsHeaders); }
    const useByok = resolved.mode === "byok";
    const GEMINI_API_KEY = resolved.geminiKey || "";

    // 1) Plan the dork battery.
    const planPrompt = `Target: ${target.trim()}
Profile hint: ${profile || "auto"}
Today: ${new Date().toISOString().slice(0, 10)}

Generate the dork battery now.`;

    // Try caller's BYOK first when in byok mode, otherwise platform Gemini.
    // The fallback chain inside planWithFallback will rescue us if the
    // primary key is invalid/expired/rate-limited.
    let planRaw = "";
    let planVia = "";
    try {
      const result = useByok
        ? await planWithFallback("", byok, DORK_SYSTEM, planPrompt)
        : await planWithFallback(GEMINI_API_KEY, byok, DORK_SYSTEM, planPrompt);
      planRaw = result.raw;
      planVia = result.via;
    } catch (e: any) {
      console.error("[dork] plan all-providers failed:", e.message);
      return new Response(JSON.stringify({
        error: "ai_unavailable",
        message: "All AI providers failed. Add a BYOK key in Settings → API Keys, or try again later.",
        detail: e.message?.slice(0, 300),
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let plan: { profile?: string; queries?: { q: string; why: string }[] } = {};
    try {
      plan = JSON.parse(planRaw);
    } catch {
      const m = planRaw.match(/\{[\s\S]*\}/);
      if (m) { try { plan = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    // Cap to 8 queries: each is delegated to zophiel-search internally, which
    // itself fans out to 5 engines. Beyond ~8 we hit the platform's overall
    // edge-request timeout.
    const queries = Array.isArray(plan.queries) ? plan.queries.filter((q) => q && typeof q.q === "string").slice(0, 6) : [];
    if (queries.length === 0) {
      return new Response(JSON.stringify({ error: "plan_failed", raw: planRaw.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Fan out — bounded parallel (concurrency 3). Zophiel-search internally
    //    handles anti-bot rotation, so we don't need serial pacing here.
    const buckets: DorkBucket[] = new Array(queries.length);
    const CONCURRENCY = 3;
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= queries.length) return;
        const q = queries[i];
        const hits = await ddg(q.q, 8);
        buckets[i] = { query: q.q, rationale: q.why || "", hits };
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker));


    const totalHits = buckets.reduce((acc, b) => acc + b.hits.length, 0);

    // 3) Analyst brief.
    let brief = "";
    if (!briefOnly && totalHits > 0) {
      const condensed = buckets.map((b, i) => {
        const top = b.hits.slice(0, 4).map((h) => `   - ${h.title} :: ${h.url}`).join("\n");
        return `[${i + 1}] ${b.query}\n   why: ${b.rationale}\n${top || "   (no hits)"}`;
      }).join("\n\n");
      const u = `Target: ${target}\nProfile: ${plan.profile || profile || "auto"}\n\nBuckets:\n${condensed}`;
      brief = useByok
        ? await briefWithFallback("", byok, BRIEF_SYSTEM, u)
        : await briefWithFallback(GEMINI_API_KEY, byok, BRIEF_SYSTEM, u);
    }

    return new Response(JSON.stringify({
      success: true,
      target,
      profile: plan.profile || profile || "auto",
      buckets,
      totalHits,
      brief,
      via: planVia,
      notice: "Open-web indexes only. Results are public artifacts already crawled by search engines.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[dork] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "dork failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
