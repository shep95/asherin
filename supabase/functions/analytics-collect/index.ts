// analytics-collect — the only writer of public.site_visit_events.
//
// The browser never writes to the ledger directly: it cannot see its own edge
// IP, cannot be trusted about whether it is a crawler, and must never be able
// to forge geography. This function terminates the request, reads what the
// edge already knows (address, country, region, city, user agent), derives a
// one-way visitor marker, and stores the derived facts only. The raw IP is
// never persisted.
//
// Actions:
//   view   — record a page view, return the row id
//   dwell  — attach time-on-page and load time to a previously returned id
//   goal   — mark a completed sign-up on a previously returned id
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Body {
  action?: "view" | "dwell" | "goal";
  id?: string;
  path?: string;
  referrer?: string | null;
  session?: string;
  timezone?: string | null;
  locale?: string | null;
  load_ms?: number | null;
  dwell_ms?: number | null;
  goal?: string | null;
}

/** Named crawlers and the company that operates them. Anything matching a
 *  generic bot token but no entry here is still flagged, just unnamed. */
const CRAWLERS: Array<[RegExp, string, string]> = [
  [/GPTBot/i, "GPTBot", "OpenAI"],
  [/OAI-SearchBot/i, "OAI-SearchBot", "OpenAI"],
  [/ChatGPT-User/i, "ChatGPT-User", "OpenAI"],
  [/ClaudeBot/i, "ClaudeBot", "Anthropic"],
  [/Claude-Web/i, "Claude-Web", "Anthropic"],
  [/anthropic-ai/i, "anthropic-ai", "Anthropic"],
  [/PerplexityBot/i, "PerplexityBot", "Perplexity"],
  [/Perplexity-User/i, "Perplexity-User", "Perplexity"],
  [/Google-Extended/i, "Google-Extended", "Google"],
  [/GoogleOther/i, "GoogleOther", "Google"],
  [/Googlebot/i, "Googlebot", "Google"],
  [/Google-CloudVertexBot/i, "Vertex Bot", "Google"],
  [/bingbot|BingPreview/i, "Bingbot", "Microsoft"],
  [/meta-externalagent|FacebookBot|facebookexternalhit/i, "Meta Agent", "Meta"],
  [/Applebot-Extended/i, "Applebot-Extended", "Apple"],
  [/Applebot/i, "Applebot", "Apple"],
  [/Amazonbot/i, "Amazonbot", "Amazon"],
  [/Bytespider|TikTokSpider/i, "Bytespider", "ByteDance"],
  [/CCBot/i, "CCBot", "Common Crawl"],
  [/cohere-ai|cohere-training-data-crawler/i, "Cohere Crawler", "Cohere"],
  [/Diffbot/i, "Diffbot", "Diffbot"],
  [/ImagesiftBot/i, "ImagesiftBot", "Hive"],
  [/Timpibot/i, "Timpibot", "Timpi"],
  [/YouBot/i, "YouBot", "You.com"],
  [/MistralAI-User/i, "MistralAI-User", "Mistral"],
  [/DuckAssistBot|DuckDuckBot/i, "DuckDuckBot", "DuckDuckGo"],
  [/YandexBot/i, "YandexBot", "Yandex"],
  [/Baiduspider/i, "Baiduspider", "Baidu"],
  [/AhrefsBot/i, "AhrefsBot", "Ahrefs"],
  [/SemrushBot/i, "SemrushBot", "Semrush"],
  [/PetalBot/i, "PetalBot", "Huawei"],
  [/Bytedance|TikTok/i, "TikTok Agent", "ByteDance"],
];

const GENERIC_BOT = /bot\b|crawler|spider|scrapy|curl\/|wget|headless|python-requests|axios\/|node-fetch|monitor|uptime|preview/i;

function classifyAgent(ua: string): { isBot: boolean; name: string | null; company: string | null } {
  for (const [re, name, company] of CRAWLERS) {
    if (re.test(ua)) return { isBot: true, name, company };
  }
  if (GENERIC_BOT.test(ua)) return { isBot: true, name: null, company: null };
  return { isBot: false, name: null, company: null };
}

function parseAgent(ua: string) {
  let browser = "unknown";
  if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/Edg\//.test(ua)) browser = "edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "opera";
  else if (/Chrome\//.test(ua)) browser = "chrome";
  else if (/Safari\//.test(ua)) browser = "safari";

  let os = "unknown";
  if (/Windows NT/.test(ua)) os = "windows";
  else if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) os = "macos";
  else if (/Android/.test(ua)) os = "android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "ios";
  else if (/CrOS/.test(ua)) os = "chromeos";
  else if (/Linux/.test(ua)) os = "linux";

  let device = "desktop";
  if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) device = "mobile";
  else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) device = "tablet";

  return { browser, os, device };
}

const SEARCH = /google\.|bing\.|duckduckgo\.|yahoo\.|yandex\.|baidu\.|ecosia\.|brave\./i;
const SOCIAL = /facebook\.|instagram\.|t\.co|twitter\.|x\.com|linkedin\.|reddit\.|youtube\.|tiktok\.|pinterest\.|discord\.|telegram\./i;
const AI_SURFACE = /chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft|gemini\.google/i;

function classifySource(host: string | null): string {
  if (!host) return "direct";
  if (AI_SURFACE.test(host)) return "ai assistant";
  if (SEARCH.test(host)) return "search";
  if (SOCIAL.test(host)) return "social";
  return "referral";
}

/** Timezone prefix → expected country. Deliberately partial: a zone that is
 *  not listed produces no claim rather than a guess. */
const TZ_COUNTRY: Record<string, string> = {
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Phoenix": "US",
  "America/Los_Angeles": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Detroit": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
  "America/Mexico_City": "MX", "America/Bogota": "CO", "America/Lima": "PE", "America/Santiago": "CL",
  "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "America/Caracas": "VE",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Lisbon": "PT", "Europe/Madrid": "ES",
  "Europe/Paris": "FR", "Europe/Brussels": "BE", "Europe/Amsterdam": "NL", "Europe/Berlin": "DE",
  "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Rome": "IT", "Europe/Prague": "CZ",
  "Europe/Warsaw": "PL", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI", "Europe/Athens": "GR", "Europe/Bucharest": "RO", "Europe/Budapest": "HU",
  "Europe/Kyiv": "UA", "Europe/Kiev": "UA", "Europe/Moscow": "RU", "Europe/Istanbul": "TR",
  "Africa/Cairo": "EG", "Africa/Lagos": "NG", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Accra": "GH",
  "Asia/Jerusalem": "IL", "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Colombo": "LK", "Asia/Dhaka": "BD", "Asia/Kathmandu": "NP",
  "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Jakarta": "ID", "Asia/Manila": "PH",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW",
  "Asia/Shanghai": "CN", "Asia/Seoul": "KR", "Asia/Tokyo": "JP",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
};

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    if (body.action === "dwell" || body.action === "goal") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad id" }, 400);
      const patch: Record<string, unknown> = {};
      if (body.action === "dwell") {
        const d = Number(body.dwell_ms);
        if (Number.isFinite(d) && d > 0 && d < 6 * 60 * 60 * 1000) patch.dwell_ms = Math.round(d);
        const l = Number(body.load_ms);
        if (Number.isFinite(l) && l > 0 && l < 120000) patch.load_ms = Math.round(l);
      } else {
        patch.goal = "signup";
      }
      if (Object.keys(patch).length) await db.from("site_visit_events").update(patch).eq("id", id);
      return json({ ok: true });
    }

    // --- view ---------------------------------------------------------------
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 300) : "/";
    const ua = req.headers.get("user-agent") ?? "";
    const fwd = req.headers.get("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";

    const crawler = classifyAgent(ua);
    const agent = parseAgent(ua);

    const salt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "asherin";
    // Stable across days so "returning" is real, but one-way: the ledger can
    // never be walked back to an address.
    const visitorHash = (await sha256(`${salt}|${ip}|${agent.browser}|${agent.os}|${agent.device}`)).slice(0, 32);
    const sessionRaw = typeof body.session === "string" ? body.session.slice(0, 64) : crypto.randomUUID();
    const sessionHash = (await sha256(`${salt}|${sessionRaw}`)).slice(0, 32);

    let referrerHost: string | null = null;
    if (body.referrer) {
      try {
        const h = new URL(body.referrer).hostname.toLowerCase();
        const self = (req.headers.get("origin") ?? "").toLowerCase();
        referrerHost = self.includes(h) ? null : h;
      } catch { /* malformed referrer stays null */ }
    }

    const country = req.headers.get("cf-ipcountry") || null;
    const region = req.headers.get("cf-region") || null;
    const city = req.headers.get("cf-ipcity") || null;

    // VPN suspicion is a heuristic, and it is labelled as one in the UI.
    let vpnSuspected = false;
    let vpnReason: string | null = null;
    const tz = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;
    const tzCountry = tz ? TZ_COUNTRY[tz] ?? null : null;
    if (country && tzCountry && country !== tzCountry) {
      vpnSuspected = true;
      vpnReason = `device clock says ${tzCountry}, connection exits in ${country}`;
    }

    const { data: prior } = await db
      .from("site_visit_events")
      .select("country, occurred_at")
      .eq("visitor_hash", visitorHash)
      .order("occurred_at", { ascending: false })
      .limit(1);

    const isNew = !prior || prior.length === 0;
    if (!isNew && country && prior[0].country && prior[0].country !== country) {
      const hoursSince = (Date.now() - new Date(prior[0].occurred_at as string).getTime()) / 3_600_000;
      if (hoursSince < 24) {
        vpnSuspected = true;
        vpnReason = `same device exited in ${prior[0].country} then ${country} within ${Math.max(1, Math.round(hoursSince))}h`;
      }
    }

    const { data, error } = await db
      .from("site_visit_events")
      .insert({
        visitor_hash: visitorHash,
        session_hash: sessionHash,
        path,
        referrer_host: referrerHost,
        source: classifySource(referrerHost),
        country,
        region,
        city,
        device_type: crawler.isBot ? "crawler" : agent.device,
        browser: crawler.isBot ? null : agent.browser,
        os: crawler.isBot ? null : agent.os,
        is_new: isNew,
        is_bot: crawler.isBot,
        bot_name: crawler.name,
        bot_company: crawler.company,
        vpn_suspected: vpnSuspected,
        vpn_reason: vpnReason,
        load_ms: Number.isFinite(Number(body.load_ms)) && Number(body.load_ms) > 0 ? Math.round(Number(body.load_ms)) : null,
        timezone: tz,
        locale: typeof body.locale === "string" ? body.locale.slice(0, 32) : null,
      })
      .select("id")
      .single();

    if (error) return json({ error: "not recorded" }, 500);
    return json({ id: data.id, bot: crawler.isBot });
  } catch {
    return json({ error: "not recorded" }, 500);
  }
});
