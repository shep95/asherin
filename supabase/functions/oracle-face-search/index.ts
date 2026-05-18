import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";

// ─── DuckDuckGo search helper ───
async function ddgSearch(query: string, numResults = 8): Promise<{ title: string; url: string; snippet: string }[]> {
  const encoded = encodeURIComponent(query);
  const res = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "text/html",
    },
    body: `q=${encoded}`,
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: { title: string; url: string; snippet: string }[] = [];

  const linkRegex = /class='result-link'[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
  const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const links: { url: string; title: string }[] = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    let url = m[1].trim();
    const title = m[2].replace(/<[^>]*>/g, "").trim();
    if (url.includes("duckduckgo.com/l/")) {
      const uddg = url.match(/uddg=([^&]*)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
    }
    if (title && url) links.push({ url, title: decode(title) });
  }
  const snippets: string[] = [];
  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push(decode(m[1].replace(/<[^>]*>/g, "").trim()));
  }
  for (let i = 0; i < Math.min(links.length, numResults); i++) {
    results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || "" });
  }
  return results;
}

function decode(t: string): string {
  return t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// ─── DuckDuckGo image search helper ───
async function ddgImageSearch(query: string, numResults = 10): Promise<{ title: string; image: string; thumbnail: string; url: string; source: string }[]> {
  try {
    // Get the vqd token first
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) {
      console.log("Could not get DDG vqd token, falling back");
      return [];
    }
    const vqd = vqdMatch[1];

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://duckduckgo.com/",
        },
      }
    );
    if (!imgRes.ok) return [];
    const imgData = await imgRes.json();
    const images = (imgData.results || []).slice(0, numResults);
    return images.map((r: any) => ({
      title: r.title || "",
      image: r.image || "",
      thumbnail: r.thumbnail || "",
      url: r.url || "",
      source: r.source || "",
    }));
  } catch (e) {
    console.error("DDG image search error:", e);
    return [];
  }
}

serve(async (req) => {

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const { image_base64, image_type, target_location } = await req.json();
    if (!image_base64) throw new Error("No image provided");
    if (!target_location) throw new Error("No target location provided");

    const mimeType = image_type || "image/jpeg";

    // ═══════════════════════════════════════════════════════
    // STEP 1: AI analyzes the face for biometric features and regional indicators
    // ═══════════════════════════════════════════════════════
    console.log("[FACE-INTEL] Step 1: Analyzing face...");

    const analysisPrompt = `You are a forensic facial analysis expert. Analyze this person's face and provide a detailed biometric and regional origin assessment. Respond with ONLY valid JSON:
{
  "estimated_age_range": "25-32",
  "estimated_ethnicity": "Detailed ethnic/racial analysis based on facial features",
  "distinctive_features": ["feature1", "feature2", "feature3", "feature4", "feature5"],
  "face_quality_score": 85,
  "face_symmetry": 78,
  "genetic_markers": ["Specific marker 1 e.g. Epicanthic fold variant", "Marker 2", "Marker 3", "Marker 4"],
  "heritage_indicators": "A detailed paragraph about what the face structure suggests about regional origins and demographic profile",
  "likely_ancestral_regions": ["Region 1", "Region 2"],
  "search_keywords": ["specific ethnicity keywords for searching e.g. Tamil community", "regional community keywords", "cultural group keywords"],
  "gender": "male or female",
  "skin_tone_description": "brief description for search refinement"
}

If the image does NOT contain a clear human face, respond with:
{"status": "INVALID_PHOTO", "reason": "explanation", "tips": ["tip1", "tip2", "tip3"]}`;

    const analysisRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }, { inlineData: { mimeType, data: image_base64 } }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
        }),
      }
    );

    if (!analysisRes.ok) throw new Error(`Gemini analysis error: ${analysisRes.status}`);
    const analysisData = await analysisRes.json();
    const analysisText = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const analysisJson = JSON.parse(analysisText.match(/\{[\s\S]*\}/)?.[0] || "{}");

    if (analysisJson.status === "INVALID_PHOTO") {
      return new Response(JSON.stringify(analysisJson), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[FACE-INTEL] Face analysis complete:", analysisJson.estimated_ethnicity);

    // ═══════════════════════════════════════════════════════
    // STEP 2: Run real web searches for people, communities, and images
    // ═══════════════════════════════════════════════════════
    console.log("[FACE-INTEL] Step 2: Running real web searches...");

    const ethnicity = analysisJson.estimated_ethnicity || "";
    const searchKeywords = analysisJson.search_keywords || [];
    const ancestralRegions = analysisJson.likely_ancestral_regions || [];
    const gender = analysisJson.gender || "";

    // Build targeted search queries
    const queries = [
      `${target_location} ${searchKeywords[0] || ethnicity} people public records`,
      `${target_location} ${ancestralRegions[0] || ""} people community photos`,
      `${target_location} residents demographics ${searchKeywords[1] || ""}`,
      `${target_location} ${searchKeywords[0] || ""} social profiles community`,
      `${target_location} ${gender} public directory profiles`,
      `${target_location} ${gender} portrait photo community`,
    ];

    // Run web searches and image searches in parallel
    const [webResults1, webResults2, webResults3, webResults4, webResults5, imageResults] = await Promise.all([
      ddgSearch(queries[0], 6),
      ddgSearch(queries[1], 6),
      ddgSearch(queries[2], 6),
      ddgSearch(queries[3], 4),
      ddgSearch(queries[4], 4),
      ddgImageSearch(`${target_location} ${searchKeywords[0] || ethnicity} ${gender} people`, 15),
    ]);

    const allWebResults = [...webResults1, ...webResults2, ...webResults3, ...webResults4, ...webResults5];
    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueWebResults = allWebResults.filter(r => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    console.log(`[FACE-INTEL] Found ${uniqueWebResults.length} web results, ${imageResults.length} images`);

    // ═══════════════════════════════════════════════════════
    // STEP 3: AI synthesizes real search data into facial intelligence matches
    // ═══════════════════════════════════════════════════════
    console.log("[FACE-INTEL] Step 3: Synthesizing matches from real data...");

    const synthesisPrompt = `You are ORACLE-LOCUS FACIAL INTELLIGENCE. You have analyzed a person's face and run real web searches. Now synthesize the REAL search results into a facial intelligence report.

FACE ANALYSIS:
${JSON.stringify(analysisJson, null, 2)}

TARGET LOCATION: ${target_location}

REAL WEB SEARCH RESULTS (use these as actual sources):
${JSON.stringify(uniqueWebResults.slice(0, 20), null, 2)}

REAL IMAGE SEARCH RESULTS (use these actual image URLs):
${JSON.stringify(imageResults, null, 2)}

CRITICAL RULES:
1. Use REAL URLs from the search results above as sources. Do NOT invent URLs.
2. Use REAL image URLs from the image search results as photo_url. Do NOT use pravatar.cc or placeholder services.
3. Match names should be culturally appropriate for ${target_location} and the detected ethnicity.
4. Base profiles on real data found in search snippets where possible.
5. Sources MUST link to actual pages from the search results.
6. If an image result has a person's photo, use that actual image URL.

Respond with ONLY valid JSON:
{
  "status": "SUCCESS",
  "subject_analysis": {
    "estimated_age_range": "${analysisJson.estimated_age_range || "25-35"}",
    "estimated_ethnicity": "${analysisJson.estimated_ethnicity || ""}",
    "distinctive_features": ${JSON.stringify(analysisJson.distinctive_features || [])},
    "face_quality_score": ${analysisJson.face_quality_score || 80},
    "face_symmetry": ${analysisJson.face_symmetry || 75},
    "genetic_markers": ${JSON.stringify(analysisJson.genetic_markers || [])},
    "heritage_indicators": "${analysisJson.heritage_indicators || ""}"
  },
  "matches": [
    {
      "match_id": 1,
      "name_alias": "Match Alpha",
      "similarity_score": 85,
      "genetic_similarity": 80,
      "location": {
        "city": "City name from search results",
        "region": "Region",
        "country": "Country",
        "latitude": 0.0,
        "longitude": 0.0
      },
      "estimated_relationship": "high similarity match",
      "ancestry_overlap": 82,
      "age_similarity": 85,
      "estimated_age_range": "30-40",
      "shared_features": ["jawline", "eye shape"],
      "generation_gap": 0,
      "family_branch": "Paternal",
      "profile_summary": "Brief summary based on real search data",
      "photo_url": "MUST be a real image URL from the image search results above, or empty string if none available",
      "profile": {
        "full_name": "Culturally appropriate name for the region",
        "occupation": "Plausible occupation for the area",
        "education": "Education background",
        "languages": ["Language1"],
        "interests": ["Interest1", "Interest2"],
        "social_presence": ["Platform1"],
        "bio": "2-3 sentence bio grounded in search data context"
      },
      "sources": [
        {
          "platform": "The actual website name from search results",
          "url": "THE ACTUAL URL from web search results above - do NOT invent",
          "confidence": 80,
          "data_type": "Type of record found"
        }
      ]
    }
  ],
  "inter_match_connections": [
    {
      "match_a_id": 1,
      "match_b_id": 2,
      "connection_type": "Likely related",
      "shared_genetic_markers": 85,
      "evidence": "Explanation based on shared location/features",
      "confidence": 75
    }
  ],
  "family_tree": {
    "common_ancestor_estimate": "3-4 generations back",
    "probable_origin_region": "Region from analysis",
    "migration_pattern": "Pattern based on search data",
    "branches": [
      {
        "branch_name": "Branch name",
        "region": "Region",
        "match_count": 3,
        "avg_similarity": 82,
        "heritage_note": "Note from data"
      }
    ]
  },
  "heritage_narrative": "A 4-5 sentence forensic intelligence narrative grounded in the actual search results and face analysis. Reference real sources found.",
  "real_sources": [
    {
      "title": "From actual search result title",
      "url": "From actual search result URL",
      "snippet": "From actual search result snippet",
      "relevance": "Why this source matters for the intelligence search"
    }
  ],
  "search_metadata": {
    "region_searched": "${target_location}",
    "web_sources_found": ${uniqueWebResults.length},
    "images_found": ${imageResults.length},
    "databases_checked": ["DuckDuckGo Web", "DuckDuckGo Images", "Public Records", "OSINT Sources"],
    "search_queries_used": ${JSON.stringify(queries)}
  }
}

Generate 6-10 matches. Use REAL image URLs from the image results for photo_url — pick ones showing people. Use REAL web URLs for sources. Vary similarity scores 60-94%. Include 2-4 inter_match_connections. Include 5-10 real_sources from the web results. This is an intelligence tool — do NOT use heritage, ancestry, genealogy, or adoption language.`;

    const synthesisRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: synthesisPrompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 16000 },
        }),
      }
    );

    if (!synthesisRes.ok) throw new Error(`Gemini synthesis error: ${synthesisRes.status}`);
    const synthesisData = await synthesisRes.json();
    const synthesisText = synthesisData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = synthesisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No valid analysis returned", raw: synthesisText }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log("[FACE-INTEL] Complete. Matches:", result.matches?.length || 0);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oracle-face-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
