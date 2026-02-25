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

    const systemPrompt = `You are ORACLE-LOCUS FACE SEARCH, an advanced facial intelligence system. You analyze a user's photo and generate realistic simulated results of potential lookalike matches in a specified geographic region.

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
    "estimated_ethnicity": "string describing detected ethnic features",
    "distinctive_features": ["feature1", "feature2"],
    "face_quality_score": 85,
    "face_symmetry": 78
  },
  "matches": [
    {
      "match_id": 1,
      "similarity_score": 92,
      "location": {
        "city": "Dublin",
        "region": "Leinster",
        "country": "Ireland",
        "latitude": 53.3498,
        "longitude": -6.2603
      },
      "estimated_relationship": "2nd-3rd cousin",
      "ancestry_overlap": 87,
      "age_similarity": 90,
      "shared_features": ["jawline", "eye shape"],
      "generation_gap": 0,
      "family_branch": "Paternal"
    }
  ],
  "family_tree": {
    "common_ancestor_estimate": "3-4 generations back",
    "branches": [
      {
        "branch_name": "Paternal Line",
        "region": "Dublin, Ireland",
        "match_count": 3,
        "avg_similarity": 88
      }
    ]
  },
  "search_metadata": {
    "region_searched": "${target_location}",
    "total_faces_scanned": 12847,
    "matches_found": 8,
    "scan_time_ms": 3420
  }
}

Generate 5-10 realistic matches spread across different cities within the target location region. Make similarity scores range from 70-95%. Vary the estimated relationships (sibling-like, 1st cousin, 2nd-3rd cousin, distant relative, unrelated lookalike). Include realistic lat/lng coordinates for the cities.

IMPORTANT: Generate plausible, varied results. Not all matches should be family - some should be "unrelated lookalike" with lower ancestry overlap. Make the data feel authentic.`;

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
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
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
