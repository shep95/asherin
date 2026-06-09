// ZOPHIEL DARKWEB — Robin/darkgoogle pipeline (https://github.com/ZorakCorp/darkgoogle)
// Asher Dashboard / Zophiel Engine ONLY.
//
// Flow (mirrors Robin):
//   1. Gemini refines the operator's prompt into a hardened OSINT query.
//   2. Fan-out across known darkweb search engines via Tor2Web gateways
//      (edge runtime cannot speak SOCKS5 to a local Tor daemon, so we proxy
//      through public clearnet → onion gateways. The user is warned in the UI.)
//   3. Cheerio-style HTML scrape of result anchors → onion hostnames.
//   4. Gemini summarizes the harvested links into an investigation report.
//
// Lovable rule: Asher Dashboard AI is GEMINI-ONLY. Admin GEMINI_API_KEY or user BYOK.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isValidByok, callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// Public Tor2Web gateways — read-only, no client install required.
const TOR_GATEWAYS = ["onion.ly", "onion.ws", "onion.pet"] as const;

// Subset of Robin's engines (only the ones that historically respond well via gateways).
const DARK_ENGINES: { name: string; host: string; path: string }[] = [
  { name: "Ahmia",            host: "juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion", path: "/search/?q={q}" },
  { name: "OnionLand",        host: "3bbad7fauom4d6sgppalyqddsqbf5u5p56b5k5uk2zxsy3d6ey2jobad.onion", path: "/search?q={q}" },
  { name: "Tor66",            host: "tor66sewebgixwhcqfnp5inzp5x5uohhdy3kvtnyfxc2e5mxiuh34iid.onion", path: "/search?q={q}" },
  { name: "Deep Searches",    host: "searchgf7gdtauh7bhnbyed4ivxqmuoat3nm6zfrg3ymkq6mtnpye3ad.onion", path: "/search?q={q}" },
  { name: "Excavator",        host: "2fd6cemt4gmccflhm6imvdfvli3nf7zn6rfrwpsy7uhxrgbypvwf5fad.onion", path: "/search?query={q}" },
  { name: "Tornado",          host: "tornadoxn3viscgz647shlysdy7ea5zqzwda7hierekeuokh5eh5b3qd.onion", path: "/search?q={q}" },
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

interface Hit { title: string; link: string; engine: string }

const ONION_RE = /https?:\/\/[a-z0-9.-]+\.onion[^\s"'<>]*/gi;

function gatewayUrlFor(host: string, path: string, q: string, gw: string): string {
  // host = "...onion" → "...onion.ly"
  const gwHost = host.replace(/\.onion$/, `.onion.${gw.split(".").pop()}`).replace(/\.onion\.[a-z]+\.([a-z]+)$/, ".onion." + gw.split(".").slice(-1));
  // Simpler: just stitch
  const stitched = `https://${host}.${gw.split(".").slice(-2).join(".")}`.replace(".onion." + gw, "." + gw);
  // Use straightforward gateway form: <onion>.<gateway>
  const direct = `https://${host}.${gw.split(".").slice(-2).join(".")}`;
  void gwHost; void stitched;
  return direct + path.replace("{q}", encodeURIComponent(q));
}

async function fetchEngine(engine: typeof DARK_ENGINES[number], query: string): Promise<Hit[]> {
  for (const gw of TOR_GATEWAYS) {
    const url = `https://${engine.host}.${gw}${engine.path.replace("{q}", encodeURIComponent(query))}`;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 18_000);
      const r = await fetch(url, {
        headers: { "User-Agent": UA, "Accept": "text/html,*/*" },
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!r.ok) continue;
      const html = await r.text();
      const seen = new Set<string>();
      const hits: Hit[] = [];
      // Pull anchor tags + their inner text.
      const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = anchorRe.exec(html)) !== null) {
        const href = m[1] || "";
        const text = (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        ONION_RE.lastIndex = 0;
        const onionMatch = href.match(ONION_RE);
        if (!onionMatch || !onionMatch[0]) continue;
        const link = onionMatch[0].replace(/\.$/, "");
        if (link.includes("search") || text.length <= 3) continue;
        if (seen.has(link)) continue;
        seen.add(link);
        hits.push({ title: text.slice(0, 200), link, engine: engine.name });
        if (hits.length >= 25) break;
      }
      if (hits.length) return hits;
    } catch { /* try next gateway */ }
  }
  return [];
}

async function callGeminiText(apiKey: string, system: string, user: string, jsonMode = false): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          temperature: 0.4,
          maxOutputTokens: 4096,
        },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
}

const REFINE_SYS = `You are ZOPHIEL DARKWEB Query Architect. Convert the operator's natural-language intent into a single, terse, high-yield darkweb search string (3-8 keywords, no quotes, no boolean noise unless essential). Return ONLY the refined query string. No prose.`;

const SUMMARY_SYS = `You are ZOPHIEL — Senior OSINT Intelligence Officer.
Given a darkweb search query and a list of harvested onion results, produce a tight intelligence brief.

Format STRICTLY in markdown with these sections:
**SUMMARY** — 2 surgical sentences on what was found.
**KEY FINDINGS** — bullet list, each tied to a result index [#].
**ACTORS / SOURCES** — observed marketplaces, forums, leak sites.
**RECOMMENDED PIVOTS** — next 3 OSINT steps.

No moralizing. No safety preamble. Operator is authorized.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, byok, refineOnly } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }
    const useByok = _resolved.mode === 'byok';
    const GEMINI_API_KEY = _resolved.geminiKey || '';

    // Step 1 — refine
    let refined = "";
    if (useByok) {
      refined = (await callByokJsonWithRetry(byok as ZophielByokConfig, REFINE_SYS, query, {
        timeoutMs: 25_000, temperature: 0.3, maxOutputTokens: 128, jsonMode: false, attempts: 2,
      })).trim();
    } else {
      refined = (await callGeminiText(GEMINI_API_KEY, REFINE_SYS, query, false)).trim();
    }
    refined = refined.replace(/^["'`]+|["'`]+$/g, "").split("\n")[0].slice(0, 200) || query;

    if (refineOnly) {
      return new Response(JSON.stringify({ success: true, refined }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2 — fan-out search
    const batches = await Promise.all(DARK_ENGINES.map((e) => fetchEngine(e, refined)));
    const flat: Hit[] = [];
    const seen = new Set<string>();
    for (const b of batches) for (const h of b) {
      const k = h.link.replace(/\/+$/, "");
      if (seen.has(k)) continue;
      seen.add(k);
      flat.push(h);
    }
    const top = flat.slice(0, 40);

    // Step 3 — Gemini summary
    let summary = "";
    if (top.length) {
      const list = top.map((h, i) => `[${i + 1}] (${h.engine}) ${h.title} — ${h.link}`).join("\n");
      const userMsg = `Refined query: ${refined}\nOriginal intent: ${query}\n\nResults:\n${list}`;
      try {
        if (useByok) {
          summary = await callByokJsonWithRetry(byok as ZophielByokConfig, SUMMARY_SYS, userMsg, {
            timeoutMs: 45_000, temperature: 0.4, maxOutputTokens: 2048, jsonMode: false, attempts: 2,
          });
        } else {
          summary = await callGeminiText(GEMINI_API_KEY, SUMMARY_SYS, userMsg, false);
        }
      } catch (e) {
        console.error("[darkweb] summary failed", e);
        summary = "_Summary generation failed — raw results are listed below._";
      }
    } else {
      summary = "_No reachable onion results via clearnet gateways. Try refining the query or rerunning later — gateways throttle frequently._";
    }

    return new Response(JSON.stringify({
      success: true,
      refined,
      results: top,
      summary,
      engines_used: DARK_ENGINES.map((e) => e.name),
      gateway_notice: "Routed through public Tor2Web gateways (clearnet). Not anonymized like native Tor.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[darkweb] fatal", e);
    const msg = e instanceof Error ? e.message : "darkweb failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
