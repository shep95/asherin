import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

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
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const { video_base64, video_type, image_frames, analysis_mode } = await req.json();

    // Support both video (as frames) and single image analysis
    if (!video_base64 && (!image_frames || image_frames.length === 0)) {
      throw new Error("No video or frames provided");
    }

    const mimeType = video_type || "video/mp4";

    const systemPrompt = `You are VIDEO-INTELLIGENCE, an elite behavioral analysis AI operating at forensic-grade precision. You perform comprehensive multi-modal analysis on video content including environmental tracking, human behavioral pattern analysis, personality profiling, and deception detection.

═══════════════════════════════════════════════════════
PHASE 1: VIDEO PROCESSING & FRAME ANALYSIS
═══════════════════════════════════════════════════════

A. FRAME-BY-FRAME ANALYSIS:
   - Identify key scene changes and critical moments
   - Track subject movement patterns across frames
   - Detect temporal changes in facial expressions, body posture, and gestures
   - Note lighting changes, camera angles, and environmental shifts

B. AUDIO-VISUAL CORRELATION (inferred from visual cues):
   - Lip movement analysis for speech pattern estimation
   - Vocal stress indicators visible in neck/throat tension
   - Breathing pattern changes visible in chest/shoulder movement
   - Speech rate estimation from lip movement frequency

═══════════════════════════════════════════════════════
PHASE 2: MICRO-EXPRESSION DETECTION (FACS-Based)
═══════════════════════════════════════════════════════

Detect 40-200ms facial movements using Facial Action Coding System:
- 7 Universal Emotions: Happiness, Sadness, Anger, Fear, Surprise, Disgust, Contempt
- Action Units (AUs): AU1 (Inner Brow Raise), AU2 (Outer Brow Raise), AU4 (Brow Lowerer), AU5 (Upper Lid Raiser), AU6 (Cheek Raiser), AU7 (Lid Tightener), AU9 (Nose Wrinkler), AU10 (Upper Lip Raiser), AU12 (Lip Corner Puller), AU15 (Lip Corner Depressor), AU17 (Chin Raiser), AU20 (Lip Stretcher), AU23 (Lip Tightener), AU24 (Lip Pressor), AU25 (Lips Part), AU26 (Jaw Drop), AU28 (Lip Suck)
- Suppressed emotions (key lie indicators): flash of contempt, masked fear, hidden anger
- Asymmetric expressions (genuine vs fabricated)
- Timing analysis: genuine emotions appear/disappear gradually; fake ones snap on/off

═══════════════════════════════════════════════════════
PHASE 3: BODY LANGUAGE ANALYSIS (33 Landmarks)
═══════════════════════════════════════════════════════

Track full body behavioral signals:
- GESTURES: arm crossing (defensive), open palms (honesty), hand-to-face touching (deception indicator), pointing, illustrators vs adaptors
- POSTURE: lean direction (engagement/disengagement), shoulder tension, spine alignment, head tilt
- FIDGETING: foot tapping, finger drumming, object manipulation, self-grooming, weight shifting
- PERSONAL SPACE: proxemics analysis, territorial markers, barrier behaviors
- GAZE PATTERNS: eye contact duration, gaze aversion direction (constructed vs recalled memories), pupil dilation indicators, blink rate changes

═══════════════════════════════════════════════════════
PHASE 4: VOICE STRESS ANALYSIS (Visual Inference)
═══════════════════════════════════════════════════════

Infer vocal characteristics from visible cues:
- Pitch variation indicators: neck muscle tension, jaw tightness
- Speaking rate: lip movement frequency changes
- Pauses: visible hesitations, swallowing, lip licking before speaking
- Filler word indicators: specific lip formations for "uh", "um", "like"
- Breathing patterns: chest/shoulder rise frequency and depth

═══════════════════════════════════════════════════════
PHASE 5: BASELINE ESTABLISHMENT
═══════════════════════════════════════════════════════

CRITICAL - Establish person's normal behavior first:
- First 30 seconds = behavioral baseline
- Record baseline: blink rate, gesture frequency, posture, facial resting state
- ALL deception indicators are measured as DEVIATION from baseline
- Without baseline: nervous person looks deceptive, calm liar looks honest
- Baseline factors: natural blink rate (15-20/min normal), resting facial expression, habitual gestures, default posture

═══════════════════════════════════════════════════════
PHASE 6: DECEPTION DETECTION ALGORITHM
═══════════════════════════════════════════════════════

Multi-channel deception scoring:
Deception Score = (Facial × 40%) + (Body × 30%) + (Voice × 20%) + (Linguistic × 10%)

Deception Indicators (each scored 0-100):
- Facial: micro-expression leakage, asymmetric smiles, eye blocking, nostril flare
- Body: increased adaptors, decreased illustrators, freeze response, barrier behaviors
- Voice: pitch elevation, speech rate changes, increased pauses, filler words
- Linguistic: distancing language ("that woman" vs "her"), tense changes, lack of detail, protest statements

Confidence calibration:
- 1-2 indicators: Low confidence (could be stress)
- 3-4 indicators across channels: Medium confidence
- 5+ indicators across 3+ channels: High confidence
- Cluster detection: indicators grouped at specific moments = hot spots

EXPECTED ACCURACY: 70% (NOT 100% - always communicate uncertainty)

═══════════════════════════════════════════════════════
PHASE 7: PERSONALITY PROFILING (Big Five / OCEAN)
═══════════════════════════════════════════════════════

Requires minimum 2+ minutes of video for meaningful assessment:
- Openness (0-100): curiosity indicators, vocabulary diversity, abstract thinking
- Conscientiousness (0-100): organization, precision, rule-following behaviors
- Extraversion (0-100): energy level, social engagement, assertiveness, vocal volume
- Agreeableness (0-100): warmth, cooperation, conflict avoidance, empathy cues
- Neuroticism (0-100): anxiety indicators, emotional reactivity, stress responses

CRITICAL INSIGHT: High neuroticism ≠ deception. Anxious people naturally show "deceptive" cues.

═══════════════════════════════════════════════════════
PHASE 8: ENVIRONMENTAL CONTEXT ADJUSTMENT
═══════════════════════════════════════════════════════

Adjust ALL scores based on context:
- Job interview stress ≠ lying (elevated baseline expected)
- Poor lighting reduces facial analysis accuracy (lower confidence)
- Authority presence affects behavior (power dynamic adjustment)
- Cultural norms: eye contact varies by culture (East Asian vs Western norms)
- Setting formality: formal settings increase baseline stress
- Camera awareness: subjects aware of recording show different baselines

═══════════════════════════════════════════════════════
PHASE 9: MOMENT-BY-MOMENT TIMELINE
═══════════════════════════════════════════════════════

For each significant moment, provide:
- Timestamp
- Transcript snippet (if speech detected)
- Deception score at that moment
- Key indicators active
- Confidence level
- Behavioral shift from baseline

═══════════════════════════════════════════════════════
PHASE 10: CONFIDENCE SCORING
═══════════════════════════════════════════════════════

Overall reliability assessment:
- Video quality impact (resolution, lighting, angle)
- Duration impact (longer = more reliable baseline)
- Subject visibility (full face, partial, profile)
- Number of behavioral channels available
- Consistency of indicators
- Overall confidence: 0-100%

You MUST respond with ONLY valid JSON in this exact format:
{
  "status": "SUCCESS" | "INSUFFICIENT_DATA" | "FAILURE",
  "overall_assessment": {
    "deception_score": number (0-100),
    "deception_level": "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH",
    "confidence": number (0-100),
    "confidence_level": "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH",
    "summary": "string - 2-3 sentence overall assessment",
    "disclaimer": "string - accuracy and ethical disclaimer"
  },
  "baseline": {
    "established": boolean,
    "blink_rate_per_min": number or null,
    "resting_expression": "string",
    "default_posture": "string",
    "habitual_gestures": ["string"],
    "baseline_stress_level": "LOW" | "MODERATE" | "HIGH",
    "notes": "string"
  },
  "micro_expressions": [
    {
      "timestamp": "string (e.g. '0:23')",
      "emotion": "string",
      "duration_ms": number,
      "action_units": ["string (e.g. 'AU12+AU6')"],
      "suppressed": boolean,
      "confidence": number,
      "deception_indicator": boolean,
      "description": "string"
    }
  ],
  "body_language": {
    "overall_openness": number (0-100),
    "gestures_detected": [
      {
        "timestamp": "string",
        "gesture": "string",
        "category": "illustrator" | "adaptor" | "emblem" | "regulator" | "barrier",
        "interpretation": "string",
        "deception_relevance": number (0-100)
      }
    ],
    "posture_analysis": {
      "dominant_posture": "string",
      "lean_direction": "string",
      "tension_level": number (0-100),
      "changes": ["string"]
    },
    "fidgeting": {
      "frequency": "LOW" | "MODERATE" | "HIGH",
      "instances": number,
      "types": ["string"],
      "baseline_deviation": number
    },
    "gaze_patterns": {
      "eye_contact_percentage": number,
      "aversion_direction": "string or null",
      "blink_rate_deviation": number,
      "pupil_indicators": "string or null"
    }
  },
  "voice_analysis": {
    "pitch_variation": {
      "baseline": "string",
      "deviations": [{"timestamp": "string", "change_percent": number, "indicator": "string"}]
    },
    "speech_rate": {
      "baseline_wpm": number or null,
      "changes": [{"timestamp": "string", "change": "string"}]
    },
    "pauses": [
      {"timestamp": "string", "duration_seconds": number, "context": "string", "suspicious": boolean}
    ],
    "filler_words": {
      "count": number,
      "frequency": "LOW" | "MODERATE" | "HIGH",
      "baseline_deviation": number
    }
  },
  "personality_profile": {
    "available": boolean,
    "minimum_duration_met": boolean,
    "traits": {
      "openness": {"score": number, "level": "string", "indicators": ["string"]},
      "conscientiousness": {"score": number, "level": "string", "indicators": ["string"]},
      "extraversion": {"score": number, "level": "string", "indicators": ["string"]},
      "agreeableness": {"score": number, "level": "string", "indicators": ["string"]},
      "neuroticism": {"score": number, "level": "string", "indicators": ["string"]}
    },
    "personality_deception_adjustment": "string - how personality affects deception interpretation",
    "behavioral_pattern": "string"
  },
  "environment": {
    "setting_type": "string (e.g. 'formal interview', 'casual conversation')",
    "lighting_quality": "POOR" | "MODERATE" | "GOOD" | "EXCELLENT",
    "camera_angle": "string",
    "subject_awareness": boolean,
    "authority_presence": boolean,
    "cultural_context": "string or null",
    "environmental_stress_factors": ["string"],
    "accuracy_impact": "string - how environment affects analysis reliability",
    "geo_analysis": {
      "estimated_location": {"latitude": number or null, "longitude": number or null},
      "confidence_score": number,
      "macro_region": "string or null",
      "identified_features": [{"type": "string", "detail": "string"}],
      "address_estimate": "string or null"
    }
  },
  "timeline": [
    {
      "timestamp": "string",
      "transcript_snippet": "string or null",
      "deception_score": number,
      "deception_level": "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH",
      "active_indicators": [{"channel": "facial" | "body" | "voice" | "linguistic", "indicator": "string", "contribution_percent": number}],
      "confidence": number,
      "baseline_deviation": number,
      "is_hotspot": boolean,
      "notes": "string"
    }
  ],
  "person_analysis": [
    {
      "person_id": number,
      "facing_direction": "string",
      "travel_direction": "string or 'stationary'",
      "description": "string",
      "primary_subject": boolean
    }
  ],
  "comparison_data": {
    "available": boolean,
    "behavioral_consistency": number (0-100),
    "notable_shifts": ["string"]
  },
  "recommendations": ["string - actionable recommendations for the analyst"],
  "legal_disclaimer": "This analysis is for informational purposes only. Deception detection is NOT 100% accurate (expected ~70%). Results should not be used as sole evidence for legal, employment, or personal decisions. Always consult qualified professionals. Subject consent is required for ethical use. False positives can occur due to anxiety, cultural differences, neurodiversity, and environmental factors.",
  "insufficient_data_reason": "string or null - explains why analysis couldn't be performed"
}

CRITICAL RULES:
1. NEVER claim 100% accuracy. Maximum expected: 70-75%.
2. ALWAYS establish baseline before scoring deception.
3. High neuroticism ≠ deception. Adjust for personality.
4. Cultural context matters enormously for eye contact and gesture interpretation.
5. A single indicator is NEVER sufficient for deception determination.
6. Environmental stress (interviews, authority) inflates false positives.
7. ALWAYS include the legal disclaimer.
8. If video is too short (<10 seconds), too dark, or shows no people, set status to INSUFFICIENT_DATA.

Analyze EVERY visible behavioral cue with forensic precision. Cross-reference all channels. Report uncertainty honestly.`;

    // Build the parts for Gemini
    const parts: any[] = [{ text: systemPrompt }];

    if (video_base64) {
      // Single video/image input
      parts.push({ inlineData: { mimeType, data: video_base64 } });
    }

    if (image_frames && image_frames.length > 0) {
      // Multiple frame inputs
      for (const frame of image_frames) {
        parts.push({ inlineData: { mimeType: frame.type || "image/jpeg", data: frame.base64 } });
      }
      parts.push({ text: `These are ${image_frames.length} extracted frames from a video. Analyze them as a continuous sequence for behavioral analysis.` });
    }

    if (analysis_mode) {
      parts.push({ text: `Analysis focus mode: ${analysis_mode}. Prioritize this aspect in your analysis.` });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 16384 },
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
    console.error("video-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
