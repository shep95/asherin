import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const body = await req.json();

    // --- USER FEEDBACK ACTION ---
    if (body.action === "feedback") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No auth header");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) throw new Error("Unauthorized");

      const { analysis_id, correct, actual_latitude, actual_longitude, user_notes } = body;
      
      const update: Record<string, unknown> = {
        user_verified: true,
        user_correct: correct,
        user_notes: user_notes || null,
      };

      if (!correct && actual_latitude != null && actual_longitude != null) {
        update.actual_latitude = actual_latitude;
        update.actual_longitude = actual_longitude;
        // Calculate distance error
        const { data: analysis } = await supabase.from("oracle_analyses").select("latitude, longitude").eq("id", analysis_id).single();
        if (analysis?.latitude && analysis?.longitude) {
          const R = 6371;
          const dLat = (actual_latitude - analysis.latitude) * Math.PI / 180;
          const dLon = (actual_longitude - analysis.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(analysis.latitude * Math.PI/180) * Math.cos(actual_latitude * Math.PI/180) * Math.sin(dLon/2)**2;
          update.distance_error_km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }
      }

      await supabase.from("oracle_analyses").update(update).eq("id", analysis_id).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- CALIBRATION DATA ---
    if (body.action === "get-calibration") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No auth header");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) throw new Error("Unauthorized");

      const { data: verified } = await supabase
        .from("oracle_analyses")
        .select("confidence_score, user_correct, distance_error_km")
        .eq("user_id", user.id)
        .eq("user_verified", true)
        .limit(500);

      // Build calibration buckets
      const buckets: Record<string, { total: number; correct: number; avgError: number }> = {};
      for (const v of (verified || [])) {
        const bucket = `${Math.floor((v.confidence_score || 0) / 10) * 10}-${Math.floor((v.confidence_score || 0) / 10) * 10 + 10}`;
        if (!buckets[bucket]) buckets[bucket] = { total: 0, correct: 0, avgError: 0 };
        buckets[bucket].total++;
        if (v.user_correct) buckets[bucket].correct++;
        buckets[bucket].avgError += v.distance_error_km || 0;
      }
      for (const b of Object.values(buckets)) {
        b.avgError = b.total > 0 ? b.avgError / b.total : 0;
      }

      return new Response(JSON.stringify({ calibration: buckets, total_verified: verified?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- MAIN ANALYSIS ---
    const { image_base64, image_type } = body;
    if (!image_base64) throw new Error("No image provided");

    const mimeType = image_type || "image/jpeg";

    // STEP 1: Coarse-grained analysis (continent/country/region)
    const coarsePrompt = `You are ORACLE-LOCUS Phase 1: COARSE LOCALIZATION.

Analyze this image and identify ONLY the broad geographic region. Do NOT guess exact coordinates yet.

Focus on:
- Continent identification from climate, architecture, vegetation
- Country identification from signage language, driving side, vehicle types, road markings
- Region/state from regional architecture, landscape, vegetation zones
- Hemisphere from sun position, shadow direction, seasonal cues

Return ONLY valid JSON:
{
  "continent": "string",
  "country": "string", 
  "country_confidence": number (0-100),
  "region": "string (state/province/area)",
  "region_confidence": number (0-100),
  "climate_zone": "string (tropical/arid/temperate/continental/polar)",
  "driving_side": "left | right | unknown",
  "language_detected": "string or null",
  "key_indicators": ["string", "string"],
  "is_geolocatable": boolean,
  "rejection_reason": "string or null (if not geolocatable: explain why)"
}

If the image is a close-up, screenshot, meme, abstract, food photo, selfie without background, or lacks ANY outdoor/geographic features, set is_geolocatable to false.`;

    const coarseRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: coarsePrompt },
            { inlineData: { mimeType, data: image_base64 } },
          ] }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!coarseRes.ok) throw new Error(`Gemini API error: ${coarseRes.status}`);
    const coarseData = await coarseRes.json();
    const coarseText = coarseData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const coarseMatch = coarseText.match(/\{[\s\S]*\}/);
    let coarseResult: any = {};
    if (coarseMatch) {
      try { coarseResult = JSON.parse(coarseMatch[0]); } catch { /* fallback */ }
    }

    // Early exit: not geolocatable
    if (coarseResult.is_geolocatable === false) {
      const failResult = {
        status: "FAILURE",
        estimated_location: { latitude: 0, longitude: 0 },
        confidence_score: 0,
        error_radius_meters: 0,
        most_probable_macro_region: "Unknown",
        rationale: [],
        identified_features: [],
        potential_alternative_locations: [],
        address_estimate: null,
        time_estimation: { estimated_local_time: "Unknown", time_confidence: 0, shadow_analysis: "N/A", estimated_season: "Unknown", sun_position: "Unknown" },
        person_analysis: [],
        insufficient_data: true,
        insufficient_data_reason: coarseResult.rejection_reason || "The image does not contain sufficient geographic features for analysis.",
        refinement_steps: [{ phase: "coarse", result: coarseResult }],
      };

      // Save to DB
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        try {
          const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
          const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
          if (user) {
            await supabase.from("oracle_analyses").insert({
              user_id: user.id, status: "FAILURE", confidence_score: 0, insufficient_data: true,
              insufficient_data_reason: failResult.insufficient_data_reason,
              refinement_steps: failResult.refinement_steps,
            });
          }
        } catch { /* best effort */ }
      }

      return new Response(JSON.stringify(failResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 2: Fine-grained analysis with coarse context injected
    const finePrompt = `You are ORACLE-LOCUS Phase 2: FINE-GRAINED GEOLOCATION.

Phase 1 (Coarse Analysis) determined:
- Continent: ${coarseResult.continent || "Unknown"}
- Country: ${coarseResult.country || "Unknown"} (${coarseResult.country_confidence || 0}% confidence)
- Region: ${coarseResult.region || "Unknown"} (${coarseResult.region_confidence || 0}% confidence)
- Climate Zone: ${coarseResult.climate_zone || "Unknown"}
- Driving Side: ${coarseResult.driving_side || "Unknown"}
- Language Detected: ${coarseResult.language_detected || "None"}
- Key Indicators: ${(coarseResult.key_indicators || []).join(", ")}

NOW perform PRECISE geolocation. Using the coarse context above, narrow down to exact coordinates.

Analyze: street names, building numbers, business signs, landmarks, distinctive architecture, road style, utility infrastructure, vegetation species, soil color, atmospheric conditions, shadow angles and lengths, person orientations.

SHADOW TIME ESTIMATION: Analyze shadow lengths and angles. Given the estimated latitude (${coarseResult.region || coarseResult.country}), calculate the approximate sun azimuth and elevation. Cross-reference with known sun positions for this latitude and season. Do NOT just guess — reason through the geometry.

PERSON DIRECTION: For visible people, determine facing/travel direction using body orientation, shadow direction, contextual cues.

Return ONLY valid JSON:
{
  "status": "SUCCESS" | "AMBIGUOUS" | "FAILURE",
  "estimated_location": { "latitude": number, "longitude": number },
  "confidence_score": number (0-100),
  "error_radius_meters": number,
  "most_probable_macro_region": "string",
  "rationale": ["string reasoning step 1", "string reasoning step 2", ...],
  "identified_features": [{"type": "architecture|vegetation|infrastructure|signage|terrain|climate|vehicle", "detail": "string"}],
  "potential_alternative_locations": [{"region": "string", "confidence": number}],
  "address_estimate": "string or null",
  "time_estimation": {
    "estimated_local_time": "string (e.g. '14:30')",
    "time_confidence": number (0-100),
    "shadow_analysis": "string describing shadow geometry reasoning",
    "estimated_season": "string",
    "sun_position": "string",
    "sun_azimuth_estimate": number or null,
    "sun_elevation_estimate": number or null
  },
  "person_analysis": [
    {
      "person_id": number,
      "facing_direction": "N/S/E/W/NE/NW/SE/SW",
      "travel_direction": "N/S/E/W/NE/NW/SE/SW or stationary",
      "confidence": number,
      "description": "string"
    }
  ]
}

CRITICAL RULES:
- Your confidence_score must reflect ACTUAL certainty. If you're unsure of the country, cap at 30%. If unsure of city, cap at 50%.
- error_radius_meters should be honest: country-level = 500000+, city-level = 50000, street-level = 500, exact = 50
- Provide at least 3 rationale entries explaining your reasoning chain
- If no people visible, return empty array for person_analysis
- If shadows unclear, set time_confidence to 0`;

    const fineRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: finePrompt },
            { inlineData: { mimeType, data: image_base64 } },
          ] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!fineRes.ok) throw new Error(`Gemini API error: ${fineRes.status}`);
    const fineData = await fineRes.json();
    const fineText = fineData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = fineText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No valid analysis returned", raw: fineText }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Add refinement chain to response
    analysis.refinement_steps = [
      { phase: "coarse", result: coarseResult },
      { phase: "fine", result: { status: analysis.status, lat: analysis.estimated_location?.latitude, lon: analysis.estimated_location?.longitude, confidence: analysis.confidence_score } },
    ];

    // Confidence calibration: cap based on coarse confidence
    if (coarseResult.country_confidence < 50 && analysis.confidence_score > 40) {
      analysis.calibrated_confidence = Math.min(analysis.confidence_score, 40);
    } else if (coarseResult.region_confidence < 30 && analysis.confidence_score > 60) {
      analysis.calibrated_confidence = Math.min(analysis.confidence_score, 55);
    } else {
      analysis.calibrated_confidence = analysis.confidence_score;
    }

    // Save to DB (best effort)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (user) {
          const { data: saved } = await supabase.from("oracle_analyses").insert({
            user_id: user.id,
            status: analysis.status,
            latitude: analysis.estimated_location?.latitude,
            longitude: analysis.estimated_location?.longitude,
            confidence_score: analysis.confidence_score,
            calibrated_confidence: analysis.calibrated_confidence,
            error_radius_meters: analysis.error_radius_meters,
            macro_region: analysis.most_probable_macro_region,
            address_estimate: analysis.address_estimate,
            rationale: analysis.rationale,
            identified_features: analysis.identified_features,
            alternative_locations: analysis.potential_alternative_locations,
            time_estimation: analysis.time_estimation,
            person_analysis: analysis.person_analysis,
            insufficient_data: false,
            refinement_steps: analysis.refinement_steps,
          }).select("id").single();

          if (saved) analysis.analysis_id = saved.id;
        }
      } catch (e) {
        console.error("DB save error:", e);
      }
    }

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oracle-locus error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
