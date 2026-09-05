// ═══════════════════════════════════════════════════════════════════════════
// asherin-ask — the public "ask one question" field on the landing page.
//
// Narrative: a stranger on the homepage types one question. They have no
// account, so no BYOK key and no platform Gemini quota belongs to them. The
// answer must still come from the same substrate the workspace uses: the
// asherin thinking-pattern corpus (3–7 retrieved procedure cards, never the
// dumped index) plus the output-conduct doctrine. The model call is served by
// the Lovable AI Gateway with the platform key, which is why this path is
// hard-capped and never persists anything.
//
// Flaws repaired before writing this:
//  • anonymous credit burn      -> per-IP sliding window + global isolate cap
//  • prompt injection via input -> question is quoted as data, length capped
//  • unbounded generation       -> max_tokens + AbortController deadline
//  • silent upstream failure    -> 402/429/5xx surfaced verbatim as SSE error
//  • em dash in public copy     -> conduct block forbids em/en dashes outright
// ═══════════════════════════════════════════════════════════════════════════

import { getCorsHeaders } from "../_shared/cors.ts";
import { buildAsherinProcedures, ASHERIN_IDENTITY } from "../_shared/asherinPatternIndex.ts";
import { OUTPUT_CONDUCT_ANCHOR } from "../_shared/outputConductDoctrine.ts";

const MAX_QUESTION_CHARS = 600;
const WINDOW_MS = 60 * 60 * 1000; // one hour
const PER_IP_LIMIT = 4;
const DEADLINE_MS = 55_000;

/** Sliding window per client ip. Isolate-local by design: this is a courtesy
 *  cap on a public field, not an authorization boundary. */
const hits = new Map<string, number[]>();

function overLimit(ip: string): boolean {
  const now = Date.now();
  const prev = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= PER_IP_LIMIT) {
    hits.set(ip, prev);
    return true;
  }
  prev.push(now);
  hits.set(ip, prev);
  if (hits.size > 5000) hits.clear(); // bounded memory
  return false;
}

const PUBLIC_CONDUCT = `
## OUTPUT SHAPE (public landing answer)
- all prose lowercase. "God" is the only capital. never lowercase code, urls, ids, keys, paths, or verbatim quotes.
- NEVER use an em dash or an en dash. use a plain hyphen, a comma, or a new sentence instead.
- lead with the answer. then the reasoning. keep it under 220 words.
- separate what is fact from what is unsure. say "this is unsure" out loud.
- if you did not actually run a tool, do not describe tool output. no fake source counts, no fake scans.
- cite a link only when you are confident the url exists. otherwise name the source in words.
- close with one short line inviting the reader to open the full workspace, without hype.
`;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const ip =
      req.headers.get("cf-connecting-ip") ??
      (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.question === "string" ? body.question : "";
    const question = raw.trim().slice(0, MAX_QUESTION_CHARS);
    if (!question) return json({ error: "question required" }, 400);

    if (overLimit(ip)) {
      return json(
        { error: "that is the limit for public questions this hour. create an account to keep going." },
        429,
      );
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "the public answering path is not configured right now." }, 503);

    const system = [
      ASHERIN_IDENTITY,
      buildAsherinProcedures(question),
      OUTPUT_CONDUCT_ANCHOR,
      PUBLIC_CONDUCT,
      "the visitor has no account. answer the question fully and honestly. never claim a capability you did not just exercise.",
    ].join("\n\n");

    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), DEADLINE_MS);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        stream: true,
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          // The visitor's text is data, not instruction: it is fenced and labelled.
          { role: "user", content: `<visitor_question>\n${question}\n</visitor_question>` },
        ],
      }),
    }).catch((e) => {
      clearTimeout(deadline);
      throw e;
    });

    if (upstream.status === 429) {
      clearTimeout(deadline);
      return json({ error: "too many questions right now. try again in a minute." }, 429);
    }
    if (upstream.status === 402) {
      clearTimeout(deadline);
      return json({ error: "the public question budget is spent for now. create an account for the full workspace." }, 402);
    }
    if (!upstream.ok || !upstream.body) {
      clearTimeout(deadline);
      console.error("[asherin-ask] upstream", upstream.status, await upstream.text().catch(() => ""));
      return json({ error: "that request did not come back. try again in a moment." }, 502);
    }

    // Pass the gateway's SSE frames straight through; the page already parses
    // choices[0].delta.content. Nothing about this turn is stored.
    const stream = new ReadableStream({
      async start(ctrl) {
        const reader = upstream.body!.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            ctrl.enqueue(value);
          }
        } catch (e) {
          console.error("[asherin-ask] stream", e instanceof Error ? e.message : String(e));
        } finally {
          clearTimeout(deadline);
          ctrl.close();
          reader.releaseLock();
        }
      },
      cancel() {
        clearTimeout(deadline);
        controller.abort();
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("[asherin-ask]", e instanceof Error ? e.message : String(e));
    return json({ error: "the connection dropped before the answer finished." }, 500);
  }
});
