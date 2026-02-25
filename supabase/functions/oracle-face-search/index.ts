import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { image_base64, image_type, target_location } = await req.json();
    if (!image_base64) throw new Error("No image provided");
    if (!target_location) throw new Error("No target location provided");

    const mimeType = image_type || "image/jpeg";

    const systemPrompt = `You are ORACLE-LOCUS HERITAGE SEARCH, an advanced genetic facial intelligence system designed for family reconnection and ancestry discovery. You analyze a user's photo and generate realistic simulated results of potential genetic relatives and lookalike matches in a specified geographic region.

This tool is designed for people searching for family — including adopted individuals seeking biological relatives, people tracing ancestral roots, or anyone exploring genetic connections across regions.

Given the user's photo and target location "${target_location}", you must:

1. VALIDATE THE PHOTO: Check if the image contains a clear, identifiable human face. If not, respond with:
{
  "status": "INVALID_PHOTO",
  "reason": "Describe why the photo is invalid (no face detected, too blurry, multiple faces without clear primary, etc.)",
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}

2. IF VALID FACE: Analyze the facial features and generate realistic simulated match results. You MUST respond with valid JSON:
{
  "status": "SUCCESS",
  "subject_analysis": {
    "estimated_age_range": "25-32",
    "estimated_ethnicity": "string describing detected ethnic features and heritage markers",
    "distinctive_features": ["feature1", "feature2"],
    "face_quality_score": 85,
    "face_symmetry": 78,
    "genetic_markers": ["Marker description 1", "Marker description 2"],
    "heritage_indicators": "A narrative paragraph describing what the facial structure, bone structure, nose shape, eye shape, skin tone, and other features suggest about the person's likely ancestral regions and ethnic background"
  },
  "matches": [
    {
      "match_id": 1,
      "name_alias": "Match Alpha",
      "similarity_score": 92,
      "genetic_similarity": 88,
      "location": {
        "city": "Mumbai",
        "region": "Maharashtra",
        "country": "India",
        "latitude": 19.0760,
        "longitude": 72.8777
      },
      "estimated_relationship": "2nd-3rd cousin",
      "ancestry_overlap": 87,
      "age_similarity": 90,
      "estimated_age_range": "28-35",
      "shared_features": ["jawline", "eye shape", "brow ridge"],
      "generation_gap": 0,
      "family_branch": "Paternal",
      "profile_summary": "A brief description of this simulated match — occupation area, general lifestyle indicators based on region"
    }
  ],
  "inter_match_connections": [
    {
      "match_a_id": 1,
      "match_b_id": 3,
      "connection_type": "Likely siblings or close relatives",
      "shared_genetic_markers": 91,
      "evidence": "Both share identical jawline structure, similar nose bridge width, and are located within the same city. Age gap of ~3 years suggests sibling relationship.",
      "confidence": 85
    }
  ],
  "family_tree": {
    "common_ancestor_estimate": "3-4 generations back",
    "probable_origin_region": "Western Maharashtra, India",
    "migration_pattern": "A brief narrative of likely family migration based on where matches are distributed",
    "branches": [
      {
        "branch_name": "Paternal Line",
        "region": "Mumbai, India",
        "match_count": 3,
        "avg_similarity": 88,
        "heritage_note": "Strong concentration suggests this branch remained in the region"
      }
    ]
  },
  "heritage_narrative": "A compelling 3-4 sentence narrative summary of what the overall search suggests — e.g. 'Your facial features show strong markers consistent with Indo-Aryan heritage from western India. The concentration of high-similarity matches in Maharashtra, particularly Mumbai and Pune, suggests your biological family likely has roots in this region. Several matches appear connected to each other, indicating a close-knit family network still present in the area. The genetic similarity patterns suggest a common ancestor approximately 3-4 generations back.'",
  "search_metadata": {
    "region_searched": "${target_location}",
    "total_faces_scanned": 12847,
    "matches_found": 8,
    "scan_time_ms": 3420,
    "genetic_databases_checked": 4,
    "cross_reference_passes": 3
  }
}

Generate 6-12 realistic matches spread across different cities within the target location region. Make similarity scores range from 65-96%. Vary the estimated relationships (sibling-like, 1st cousin, 2nd-3rd cousin, distant relative, unrelated lookalike). Include realistic lat/lng coordinates for the cities.

CRITICAL REQUIREMENTS:
- Generate 2-4 "inter_match_connections" showing how SOME matches relate to EACH OTHER (not just to the subject). This is the key feature — showing that some of the matches might be part of the same family cluster.
- Not all matches should be connected — some should be isolated "unrelated lookalike" entries.
- The heritage_narrative should read like an intelligence briefing — insightful, specific, and emotionally resonant for someone searching for family.
- Make genetic_markers specific (e.g. "Epicanthic fold variant", "Broad nasal bridge", "High cheekbone structure") not generic.
- Make the data feel authentic, scientifically plausible, and emotionally meaningful for someone on a family search journey.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { inlineData: { mimeType, data: image_base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 12000 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", res.status, errText);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No valid analysis returned", raw: text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
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
