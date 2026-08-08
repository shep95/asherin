import { IC_ANALYTIC_DOCTRINE } from "../_shared/icTradecraft.ts";

// Asher Eyes — Intelligence Dossier
// Scrapes text from the current Asher Eyes result set, builds an in-memory
// intelligence file, and answers operator questions with citations.
// Jargon Mode: every advanced term is written as `Term (plain-English description of what it is, does, and why it matters)`.
// GEMINI ONLY (per Asher Dashboard policy).

// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
const ALEPH = "https://search.libraryofleaks.org/api/2";
const UI = "https://search.libraryofleaks.org";

interface InItem {
  id: string;
  title?: string;
  schema?: string;
  source?: string;
  snippet?: string;
  body?: string;
  ui?: string;
  fileUrl?: string;
}

async function fetchBody(id: string): Promise<string> {
  try {
    const r = await fetch(`${ALEPH}/entities/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return "";
    const j = await r.json();
    const p = j?.properties || {};
    const arr = (k: string) => (Array.isArray(p[k]) ? p[k].join("\n") : (p[k] || ""));
    const raw = [arr("bodyText"), arr("bodyHtml"), arr("description"), arr("summary")]
      .filter(Boolean).join("\n\n");
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
  } catch { return ""; }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { question, items, deepRead, userKey } = await req.json() as {
      question: string;
      items: InItem[];
      deepRead?: number;
      userKey?: string;
    };
    if (!question?.trim() || !Array.isArray(items) || !items.length) {
      return new Response(JSON.stringify({ error: "question + items required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const key = userKey || GEMINI_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: "No Gemini key configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scrape ALL provided items (hard cap 200 to stay within Gemini context).
    const target = items.slice(0, deepRead ?? Math.min(items.length, 200));
    const bodies: string[] = new Array(target.length).fill("");
    const BATCH = 12;
    for (let i = 0; i < target.length; i += BATCH) {
      const slice = target.slice(i, i + BATCH);
      const out = await Promise.all(slice.map(async (it) => {
        if (it.body && it.body.length > 200) return it.body.slice(0, 8000);
        return await fetchBody(it.id);
      }));
      out.forEach((b, j) => { bodies[i + j] = b; });
    }

    // Auto-shrink per-doc body so the total prompt stays under Gemini's window.
    const perDocCap = target.length > 80 ? 2500 : target.length > 40 ? 4000 : target.length > 20 ? 6000 : 8000;

    const dossier = target.map((it, i) => {
      const ui = it.ui || `${UI}/entities/${it.id}`;
      const body = bodies[i] || it.snippet || "";
      return `### [${i + 1}] ${it.title || it.id}
- Schema: ${it.schema || "?"} · Source: ${it.source || "?"}
- URL: ${ui}
- Body: ${body.slice(0, perDocCap)}`;
    }).join("\n\n");

    const top = target;

    const system = `${IC_ANALYTIC_DOCTRINE}

You are ASHER EYES — Intelligence Dossier Analyst.
You have just scraped ${top.length} documents from a leaks index. Answer the operator's question using ONLY the provided dossier.

RULES:
1. Cite sources inline as [1], [2] matching the dossier order. Every factual claim needs a citation.
2. JARGON MODE: any time you use a technical term, security concept, framework, CVE, protocol, attack pattern, library, or acronym, write it as:
   **Term** (plain-English description of what it is, what it does, what its purpose is, and why it matters here)
   Example: "**SQL Injection** (a flaw where attacker text gets executed as database commands, letting them read or destroy data — matters here because the leaked code concatenates user input straight into queries)"
3. Be surgical. Use bold headers, bullets, and a final "## Sources" footer with clickable markdown links [1](url).
4. If the dossier does NOT contain the answer, say so directly — do not invent.
5. Intelligence Officer voice. No filler. No "Certainly". No moralizing.`;

    const userPrompt = `OPERATOR QUESTION:
${question.trim()}

DOSSIER (${top.length} documents):
${dossier}

Produce the intelligence answer now. Inline citations [n] required. Jargon Mode mandatory.`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      },
    );
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `Gemini ${r.status}`, detail: t.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await r.json();
    const answer = j?.candidates?.[0]?.content?.parts?.[0]?.text || "(no answer)";

    const sources = top.map((it, i) => ({
      n: i + 1,
      id: it.id,
      title: it.title || it.id,
      url: it.ui || `${UI}/entities/${it.id}`,
      schema: it.schema,
      source: it.source,
    }));

    return new Response(JSON.stringify({
      answer,
      sources,
      scraped: top.length,
      total_chars: bodies.reduce((s, b) => s + (b?.length || 0), 0),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
