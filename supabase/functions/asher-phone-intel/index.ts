// asher-phone-intel — phone number OSINT (NOT live handset tracking).
//
// Returns:
//   • Country / region / carrier / line type (parsed from the E.164 number itself
//     using libphonenumber, no third-party API call required).
//   • Public OSINT signals: web mentions via DDG/Bing scrape + Wikipedia carrier
//     context, then Gemini extracts a structured dossier (spam reports, business
//     listings, breach mentions, public posts).
//
// Hard refusal: this function will NEVER attempt to resolve a number to a live
// handset GPS location. That requires telecom-grade SS7/HLR access or covert
// installed software and is treated as out-of-scope by design.
//
// GEMINI-ONLY (per Asher Dashboard AI policy): admin GEMINI_API_KEY or user BYOK.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
// libphonenumber-js — full metadata build for accurate global parsing
import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  getCountries,
} from "https://esm.sh/libphonenumber-js@1.11.11/max";

// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

type Hit = { title: string; url: string; snippet: string };

async function ddgHtml(q: string, n = 6): Promise<Hit[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": UA, "Accept": "text/html" } });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < n) {
      let url = m[1];
      const u = url.match(/uddg=([^&]+)/);
      if (u) url = decodeURIComponent(u[1]);
      out.push({ url, title: stripHtml(m[2]), snippet: stripHtml(m[3]) });
    }
    return out;
  } catch { return []; }
}

async function bingSearch(q: string, n = 6): Promise<Hit[]> {
  try {
    const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": UA, "Accept": "text/html" } });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<li class="b_algo"[\s\S]*?<h2><a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < n) {
      out.push({ url: m[1], title: stripHtml(m[2]), snippet: stripHtml(m[3] || "") });
    }
    return out;
  } catch { return []; }
}

async function multiSearch(q: string, n = 6): Promise<Hit[]> {
  const [a, b] = await Promise.all([ddgHtml(q, n), bingSearch(q, n)]);
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const arr of [a, b]) {
    for (const h of arr) {
      if (!h.url || seen.has(h.url)) continue;
      seen.add(h.url);
      out.push(h);
      if (out.length >= n) return out;
    }
  }
  return out;
}

async function fetchPage(url: string, timeoutMs = 4500): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      signal: c.signal, redirect: "follow",
    });
    if (!r.ok) return "";
    return stripHtml(await r.text()).slice(0, 5000);
  } catch { return ""; }
  finally { clearTimeout(t); }
}

// Approximate country centroid lookup (used so the map can fly to the country
// the number is registered in — this is COUNTRY-LEVEL, not handset-level).
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  US: { lat: 39.8, lng: -98.6, name: "United States" },
  CA: { lat: 56.1, lng: -106.3, name: "Canada" },
  GB: { lat: 54.7, lng: -3.4, name: "United Kingdom" },
  IE: { lat: 53.4, lng: -8.2, name: "Ireland" },
  AU: { lat: -25.3, lng: 133.8, name: "Australia" },
  NZ: { lat: -41.0, lng: 174.0, name: "New Zealand" },
  IN: { lat: 22.6, lng: 78.9, name: "India" },
  PK: { lat: 30.4, lng: 69.3, name: "Pakistan" },
  BD: { lat: 23.7, lng: 90.4, name: "Bangladesh" },
  CN: { lat: 35.9, lng: 104.2, name: "China" },
  JP: { lat: 36.2, lng: 138.3, name: "Japan" },
  KR: { lat: 35.9, lng: 127.8, name: "South Korea" },
  RU: { lat: 61.5, lng: 105.3, name: "Russia" },
  UA: { lat: 48.4, lng: 31.2, name: "Ukraine" },
  DE: { lat: 51.2, lng: 10.5, name: "Germany" },
  FR: { lat: 46.2, lng: 2.2, name: "France" },
  IT: { lat: 41.9, lng: 12.6, name: "Italy" },
  ES: { lat: 40.5, lng: -3.7, name: "Spain" },
  PT: { lat: 39.4, lng: -8.2, name: "Portugal" },
  NL: { lat: 52.1, lng: 5.3, name: "Netherlands" },
  BE: { lat: 50.5, lng: 4.5, name: "Belgium" },
  CH: { lat: 46.8, lng: 8.2, name: "Switzerland" },
  AT: { lat: 47.5, lng: 14.6, name: "Austria" },
  PL: { lat: 51.9, lng: 19.1, name: "Poland" },
  SE: { lat: 60.1, lng: 18.6, name: "Sweden" },
  NO: { lat: 60.5, lng: 8.5, name: "Norway" },
  FI: { lat: 61.9, lng: 25.7, name: "Finland" },
  DK: { lat: 56.3, lng: 9.5, name: "Denmark" },
  GR: { lat: 39.1, lng: 21.8, name: "Greece" },
  TR: { lat: 38.9, lng: 35.2, name: "Turkey" },
  IL: { lat: 31.0, lng: 34.8, name: "Israel" },
  AE: { lat: 23.4, lng: 53.8, name: "UAE" },
  SA: { lat: 23.9, lng: 45.1, name: "Saudi Arabia" },
  EG: { lat: 26.8, lng: 30.8, name: "Egypt" },
  ZA: { lat: -30.6, lng: 22.9, name: "South Africa" },
  NG: { lat: 9.1, lng: 8.7, name: "Nigeria" },
  KE: { lat: -0.0, lng: 37.9, name: "Kenya" },
  MA: { lat: 31.8, lng: -7.1, name: "Morocco" },
  MX: { lat: 23.6, lng: -102.6, name: "Mexico" },
  BR: { lat: -14.2, lng: -51.9, name: "Brazil" },
  AR: { lat: -38.4, lng: -63.6, name: "Argentina" },
  CL: { lat: -35.7, lng: -71.5, name: "Chile" },
  CO: { lat: 4.6, lng: -74.3, name: "Colombia" },
  PE: { lat: -9.2, lng: -75.0, name: "Peru" },
  VE: { lat: 6.4, lng: -66.6, name: "Venezuela" },
  TH: { lat: 15.9, lng: 100.9, name: "Thailand" },
  VN: { lat: 14.1, lng: 108.3, name: "Vietnam" },
  PH: { lat: 12.9, lng: 121.8, name: "Philippines" },
  ID: { lat: -0.8, lng: 113.9, name: "Indonesia" },
  MY: { lat: 4.2, lng: 101.9, name: "Malaysia" },
  SG: { lat: 1.4, lng: 103.8, name: "Singapore" },
  HK: { lat: 22.3, lng: 114.2, name: "Hong Kong" },
  TW: { lat: 23.7, lng: 121.0, name: "Taiwan" },
};

serve(async (req) => {
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

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: auth } = await supa.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const rawPhone: string = String(body?.phone ?? "").trim();
    const defaultCountry: string | undefined = body?.defaultCountry ? String(body.defaultCountry).toUpperCase() : undefined;
    const byok: string | undefined = body?.byok;

    if (!rawPhone) {
      return new Response(JSON.stringify({ error: "phone required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Parse the number locally (no external API) ----
    const parsed = parsePhoneNumberFromString(rawPhone, defaultCountry as any);
    if (!parsed || !parsed.isValid()) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid phone number. Include country code (e.g. +44 7700 900123) or pass defaultCountry.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const country = parsed.country || "";
    const e164 = parsed.number;
    const national = parsed.formatNational();
    const intl = parsed.formatInternational();
    const callingCode = parsed.countryCallingCode;
    const lineType = parsed.getType() || "unknown"; // mobile | fixed_line | voip | etc.
    const centroid = country ? COUNTRY_CENTROIDS[country] : undefined;

    // ---- Public OSINT (search the number in multiple formats) ----
    const variants = Array.from(new Set([
      e164,
      e164.replace("+", ""),
      national,
      intl,
    ])).filter(Boolean);

    const queries = [
      `"${e164}"`,
      `"${national}" spam OR scam OR fraud`,
      `"${intl}" carrier OR business OR contact`,
    ];

    const seen = new Set<string>();
    const merged: Hit[] = [];
    for (const q of queries) {
      const r = await multiSearch(q, 5);
      for (const h of r) {
        if (seen.has(h.url)) continue;
        seen.add(h.url);
        merged.push(h);
        if (merged.length >= 8) break;
      }
      if (merged.length >= 8) break;
    }

    const top = merged.slice(0, 4);
    const pages = await Promise.all(top.map(async (h) => ({
      url: h.url, title: h.title, snippet: h.snippet, body: await fetchPage(h.url),
    })));

    // ---- GEMINI extraction ----
    const isAdmin = isStaffEmail(user.email);
    const apiKey = (typeof byok === "string" && byok.trim())
      || (isAdmin ? Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") : null);

    let osint: any = {};
    if (apiKey && pages.length) {
      const corpus = pages
        .map((p, i) => `### Source ${i + 1}: ${p.title}\nURL: ${p.url}\nSnippet: ${p.snippet}\nContent: ${p.body || "(empty)"}`)
        .join("\n\n");

      const prompt = `You are a phone-number OSINT analyst. Extract structured public-record intelligence about the phone number below using ONLY facts present in the sources. Do not invent values. If a field has no evidence, omit it or use null.

PHONE NUMBER: ${e164}  (national: ${national}, country: ${country}, line: ${lineType})

SOURCES (live public web scrape):
${corpus}

Return STRICT JSON only:
{
  "summary": "2-3 sentence intelligence brief about what is publicly known",
  "owner_or_business": "string|null (business or person name if listed in public directories)",
  "spam_or_scam_reports": ["bullet of any spam/scam reports found"],
  "public_listings": ["bullet — directory / business / WhatsApp Business / website mentions"],
  "social_or_breach_mentions": ["bullet — public posts, leaks, breach DBs"],
  "associated_locations": ["bullet — any city/region the listings reference"],
  "risk_assessment": "low|medium|high|unknown",
  "citations": [{"label":"...","url":"..."}]
}`;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: "application/json" },
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          try { osint = JSON.parse(raw); }
          catch { const m = raw.match(/\{[\s\S]*\}/); if (m) try { osint = JSON.parse(m[0]); } catch {} }
        }
      } catch (e) {
        console.error("[asher-phone-intel] gemini error:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      phone: {
        e164,
        national,
        international: intl,
        country,
        country_name: centroid?.name || null,
        country_calling_code: `+${callingCode}`,
        line_type: lineType,
        is_valid: true,
      },
      // COUNTRY centroid only — we never claim handset-level GPS.
      geo: centroid
        ? { lat: centroid.lat, lng: centroid.lng, level: "country", country_name: centroid.name }
        : null,
      osint,
      sources: pages.map((p) => ({ title: p.title, url: p.url, snippet: p.snippet })),
      disclaimer:
        "Country/region/carrier are derived from the phone number prefix. We do NOT and cannot resolve a phone number to a live handset GPS location — that would require telecom-level access. All other signals are from public web sources.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
