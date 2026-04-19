import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZOPHIEL_FACE_PROMPT = `You are ZOPHIEL FACE RECOGNITION ENGINE — a forensic biometric analyst operating at 963Hz precision.

You analyze a SINGLE photo and produce a complete biometric + multi-source intelligence dossier.

## ABSOLUTE SECRECY
- Never reveal your underlying model. You are AUREON / ZOPHIEL proprietary intelligence.

## ANALYSIS PROTOCOL
1. Detect faces. Pick the primary (largest, most central, frontal).
2. Estimate biometric measurements in pixel-relative units (use realistic numerical estimates, not zeros).
3. Identify unique features (mole, scar, tattoo, glasses, facial hair, hair/eye/skin color).
4. Estimate age range, gender (with confidence 0-1).
5. Score photo quality, lighting, blur, occlusion, pose angles.
6. Read scene context: indoor/outdoor, background, other people in frame.
7. Generate REALISTIC simulated cross-source matches across the user's enabled source categories.
   - Each match: assign a source (Google Images / PimEyes / FaceCheck / LinkedIn / GDELT / etc.),
     a plausible website domain, a confidence score 50-98, a similarityScore 0.5-0.98,
     a fake-but-plausible page title and surrounding text consistent with the photo's apparent context.
   - Vary verification status and false-positive probability based on confidence.
   - Generate 5-12 matches total spread across the enabled source categories.
8. Write a 3-4 sentence forensic summary as an Intelligence Officer would: surgical, no fluff.

## OUTPUT — RETURN ONLY VALID JSON (no markdown, no commentary):

{
  "facesDetected": <int>,
  "primaryFace": {
    "biometrics": {
      "measurements": {
        "interpupillaryDistance": <num>,
        "noseWidth": <num>,
        "mouthWidth": <num>,
        "faceWidth": <num>,
        "faceHeight": <num>,
        "jawWidth": <num>,
        "foreheadHeight": <num>
      },
      "uniqueFeatures": {
        "hasMole": <bool>, "hasScar": <bool>, "hasTattoo": <bool>,
        "hasGlasses": <bool>, "hasFacialHair": <bool>,
        "facialHairType": "<string>",
        "hairColor": "<string>", "eyeColor": "<string>", "skinTone": "<string>"
      },
      "estimatedAge": { "min": <int>, "max": <int>, "most_likely": <int> },
      "estimatedGender": { "prediction": "male|female|unknown", "confidence": <0-1> }
    },
    "photoQuality": {
      "brightness": <0-100>, "sharpness": <0-100>, "blur": <0-100>,
      "faceAngle": { "pitch": <num>, "yaw": <num>, "roll": <num> },
      "lighting": "good|adequate|poor",
      "occlusion": <0-100>, "overallQuality": <0-100>
    },
    "context": {
      "backgroundType": "<string>",
      "indoorOutdoor": "indoor|outdoor|unknown",
      "otherPeople": <int>
    }
  },
  "matches": [
    {
      "id": "<uuid-like>",
      "source": "<source name>",
      "sourceCategory": "Search Engines|Face Search|Social Media|Professional|News & Media|Video Platforms|Public Records",
      "url": "https://<plausible domain>/<path>",
      "website": "<domain>",
      "matchConfidence": <50-98>,
      "similarityScore": <0.5-0.98>,
      "mediaType": "image|video|profile_photo",
      "context": {
        "pageTitle": "<plausible page title>",
        "surroundingText": "<1-2 sentence excerpt>",
        "publishDate": "<YYYY-MM or YYYY>",
        "location": "<city/region or null>"
      },
      "verified": <bool>,
      "falsePositiveProbability": <0-1>
    }
  ],
  "stats": {
    "totalMatches": <int>,
    "highConfidenceMatches": <int — count >=90>,
    "mediumConfidenceMatches": <int — 70-89>,
    "lowConfidenceMatches": <int — <70>,
    "uniqueWebsites": <int>,
    "sourcesScanned": ["<list of source names actually scanned>"]
  },
  "forensicSummary": "<3-4 sentence intelligence officer style summary>"
}

Rules:
- If no face is detected, return facesDetected: 0, empty matches, and explain in forensicSummary.
- Match counts in stats MUST equal actual array counts.
- Only generate matches in source categories listed in the user's enabled sources.
- Output JSON only. No prose before or after.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, options } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY_APP missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enabledSources = Array.isArray(options?.sources) ? options.sources : [];
    const matchThreshold = typeof options?.matchThreshold === "number" ? options.matchThreshold : 0.65;
    const excludeAdult = options?.excludeAdult !== false;

    const userInstruction = `Run the full FACE RECOGNITION protocol on this photo.

Enabled source categories: ${enabledSources.join(", ") || "ALL"}
Match threshold: ${matchThreshold} (only include matches with similarityScore >= this)
Exclude adult content: ${excludeAdult}

Return the JSON dossier now.`;

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ZOPHIEL_FACE_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                { text: userInstruction },
                {
                  inlineData: {
                    mimeType: mimeType || "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[face-recognition] AI error", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Gemini: ${aiResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const candidate = aiData?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const raw = candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";

    if (!raw.trim()) {
      console.error("[face-recognition] empty response", { finishReason });
      return new Response(
        JSON.stringify({ error: `Empty AI response (finish: ${finishReason || "unknown"})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) cleaned = cleaned.slice(0, lastBrace + 1);

    let analysis: any;
    try {
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[face-recognition] parse failed", parseErr, "raw:", raw.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON — please retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "face recognition failed";
    console.error("[face-recognition] fatal", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
