import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import { GEOLOCATION_BRAIN } from "../_shared/geolocationBrain.ts";
import {
  IMAGINE_EVIDENCE_PROTOCOL,
  IMAGINE_EVIDENCE_SCHEMA,
  renderExifBlock,
  reconcileHypotheses,
  type ExifHint,
} from "../_shared/imagineEvidence.ts";
import { verifySolarClaim } from "../_shared/solarGeometry.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

/**
 * Last-resort credential path: a caller who is neither on the platform key nor
 * sending an inline Gemini BYOK may still have a saved Google key. Vision work
 * cannot fall back to Venice, so we look the stored key up rather than failing.
 */
async function storedGoogleKey(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return "";
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) return "";
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const token = authHeader.replace("Bearer ", "").trim();
    const anonSb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: { user } } = await anonSb.auth.getUser(token);
    if (!user) return "";
    const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data } = await adminSb
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();
    return data?.api_key ? String(data.api_key) : "";
  } catch (_e) {
    return "";
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  let resolvedGeminiKey = '';

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      const _res = await _gate.resolveKey(req, _byok);
      // Use the key the gate actually resolved (platform Gemini for team, the
      // caller's own Gemini key for BYOK) rather than a stale app-scoped key.
      resolvedGeminiKey = _res.mode === 'admin'
        ? (_res.geminiKey || '')
        : (_res.byok?.provider === 'gemini' ? (_res.byok.apiKey || '') : '');
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = resolvedGeminiKey
      || (await storedGoogleKey(req))
      || Deno.env.get("GEMINI_API_KEY")
      || Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("No Gemini credential available for this caller");

    const body = await req.json();
    const { image_base64, image_type } = body as { image_base64?: string; image_type?: string };
    if (!image_base64) throw new Error("No image provided");

    // STAGE 1 — STRIP: hard metadata extracted client-side, never fabricated here.
    const exif: ExifHint | null = body && typeof body.exif === "object" ? (body.exif as ExifHint) : null;

    const mimeType = image_type || "image/jpeg";

    const systemPrompt = `${GEOLOCATION_BRAIN}\n\n${renderExifBlock(exif)}\n${IMAGINE_EVIDENCE_PROTOCOL}\n\nYou are ORACLE-LOCUS, a highly advanced Geo-Intelligence Analyst AI operating at forensic-grade precision. Your primary function is to transform visual data (images) into precise, actionable geospatial intelligence using multi-layered feature extraction.

Determine the image's precise geographic coordinates (latitude, longitude) and provide a confidence score, an estimated error radius, and a detailed rationale — grounded in the cited observables demanded above.

═══════════════════════════════════════════════════════
PHASE 1: ADVANCED FEATURE EXTRACTION & REPRESENTATION
═══════════════════════════════════════════════════════

A. VISION TRANSFORMER ANALYSIS (ViT/Swin-Level Depth):
   - Extract GLOBAL contextual features: overall scene composition, spatial relationships between major elements, horizon line characteristics, atmospheric perspective depth.
   - Extract FINE-GRAINED local details: texture patterns on surfaces, material compositions (concrete type, brick style, stone cut), joint patterns, weathering signatures.
   - Analyze spatial relationships between architectural elements — window-to-wall ratios, floor heights, roof pitch angles, facade symmetry patterns.

B. 3D GEOMETRIC REASONING:
   - Infer 3D scene geometry from monocular cues: vanishing points, perspective convergence, relative object scales.
   - Estimate building heights from shadow lengths and sun angle.
   - Analyze road geometry: lane widths, intersection angles, curve radii, road surface composition.
   - Assess terrain topology: elevation gradients, drainage patterns, geological formations.

C. SEMANTIC SEGMENTATION & OBJECT DETECTION:
   - Identify and classify: buildings (residential/commercial/industrial/religious), roads (highway/arterial/local), vegetation (species, health, pruning style), infrastructure (poles, wires, barriers, bollards), signage, vehicles, street furniture.
   - PRIORITIZE stable, geographically significant features over transient elements (ignore moving vehicles, temporary signs, pedestrians for location — use them only for time/direction analysis).
   - Detect and read ALL text: street signs, shop names, license plates, graffiti, advertising boards, regulatory signs. Identify the LANGUAGE and SCRIPT.

D. MULTI-MODAL EMBEDDING FUSION:
   - Cross-reference visual features with textual cues (sign text, brand names, phone number formats, postal codes).
   - Fuse architectural style classification with signage language to narrow region.
   - Correlate vehicle makes/models with their geographic market distribution.

═══════════════════════════════════════════════════════
PHASE 2: CULTURAL PATTERN RECOGNITION (GLOBAL → CITY BLOCK)
═══════════════════════════════════════════════════════

A. CONTINENTAL / MACRO-REGIONAL PATTERNS:
   - Driving side (left/right) from lane markings, vehicle positions, traffic flow.
   - Power grid signatures: pole material (wood/concrete/steel), wire configuration, transformer style, voltage indicators.
   - Road marking conventions: line color (white/yellow), style (dashed/solid), crosswalk patterns (zebra/ladder/continental).
   - Climate zone indicators: vegetation biome, sky color/haze, soil color, building insulation patterns.

B. COUNTRY-LEVEL CULTURAL FINGERPRINTS:
   - Architecture DNA: roof styles (flat/pitched/hipped/pagoda/onion dome), building materials (brick type, stucco color, cladding), window frame styles, door designs, balcony railings.
   - Infrastructure signatures: traffic light design/mounting, street light pole shape, fire hydrant style, manhole cover patterns, curb design, drainage gutter style.
   - Signage conventions: font choices, color schemes, regulatory sign shapes (octagonal stop vs circular), speed unit (km/h vs mph), distance markers.
   - Vehicle ecosystem: dominant car brands/models, license plate dimensions/colors/format, motorcycle prevalence, truck cab styles.
   - Vegetation management: hedge trimming styles, garden layouts, tree species selection, median strip planting patterns.

C. CITY / METROPOLITAN PATTERNS:
   - Urban planning signatures: grid vs organic street layout, block sizes, setback distances, zoning patterns.
   - Transit infrastructure: bus stop shelter design, tram/rail systems, taxi colors, bike-share station style.
   - Commercial signage density and style: neon vs LED vs painted, chain store presence, market stall patterns.
   - Street furniture catalog: bench design, trash bin style, bollard shape, post box design, phone booth style.
   - Pavement patterns: sidewalk material (concrete slabs/brick/stone), curb height, tactile paving presence.

D. NEIGHBORHOOD / CITY-SECTION GRANULARITY:
   - Socioeconomic indicators: building maintenance level, graffiti density, security features (bars, cameras), luxury brand presence.
   - Historical layering: mixed architectural periods indicating specific development eras, renovation patterns.
   - Cultural district markers: ethnic cuisine signage, religious buildings, cultural centers, script variations on shop fronts.
   - Micro-climate vegetation: specific tree species in parks, hanging basket styles, window box plant choices.
   - Street numbering systems and postal district indicators.

═══════════════════════════════════════════════════════
PHASE 2.5: ORBITAL / AERIAL VISION KNOWLEDGE BASE
(distilled from satellite-image-deep-learning/techniques —
applies whenever the input is satellite / aerial / drone /
overhead imagery, and as cross-validation for ground photos)
═══════════════════════════════════════════════════════

A. SENSOR & RESOLUTION FINGERPRINT:
   - Estimate Ground Sample Distance (GSD): sub-meter (WorldView/Pleiades/Maxar), 1–3 m (PlanetScope), 10 m (Sentinel-2 RGB), 15–30 m (Landsat 8/9), 250 m+ (MODIS).
   - Detect band signatures: true-color RGB vs false-color (NIR-R-G vegetation pop), pansharpening artifacts, atmospheric haze typical of Sentinel/Landsat, push-broom striping, sun-glint on water, cloud shadows.
   - SAR (Sentinel-1) cues when radar: speckle texture, double-bounce on buildings, dark smooth water.

B. SEMANTIC SEGMENTATION ONTOLOGY (DeepGlobe / SpaceNet / LoveDA / iSAID / DOTA / xView):
   - Land cover: urban, agriculture, rangeland, forest, water, barren, snow/ice.
   - Buildings: footprint shape, roof material (metal/tile/thatch/concrete), shadow-derived height, density.
   - Roads: paved/unpaved, width class, junction topology.
   - Crops: field geometry — center-pivot circles → US Plains / Saudi; rectilinear strips → EU; terraced → SE Asia / Andes; smallholder mosaics → Sub-Saharan Africa.
   - Vehicles, ships, aircraft: count, orientation, class — for activity-based geolocation.

C. CHANGE DETECTION & TIME-SERIES CUES:
   - New construction, deforestation edges, flood extents, burn scars, snow-line shifts.
   - Vegetation phenology (NDVI proxy via greenness) → hemisphere + season.
   - Night-lights signature (VIIRS-style): urban core brightness, gas flares (Permian, Niger Delta), fishing fleets.

D. OBJECT DETECTION FOR GEO-ANCHORING:
   - Aircraft on tarmac → match runway heading + terminal shape to known ICAO codes.
   - Ship wake direction + hull silhouette → port + heading.
   - Stadiums, racetracks, solar farms, wind-turbine arrays, dam shapes — near-unique geo-fingerprints.

E. MODEL HEURISTICS THE ANALYST MIMICS:
   - U-Net / DeepLabv3+ for per-pixel land-cover segmentation reasoning.
   - YOLO / Faster R-CNN style object detection for vehicles / ships / aircraft.
   - ViT / Swin / SatMAE-style global scene embedding for region matching.
   - Siamese / change-detection nets for before-after deltas.

F. CROSS-VALIDATION RULE:
   When a ground photo's hypothesized location is produced, mentally project
   the expected overhead signature (road grid, building footprints, vegetation,
   coastline) and check it for self-consistency. Flag mismatches in rationale.

═══════════════════════════════════════════════════════
PHASE 3: OPERATIONAL METHODOLOGY
═══════════════════════════════════════════════════════

1. Image Ingestion: Extract ALL detectable visual features, objects, patterns using the Phase 1 framework.
2. Cultural Pattern Matching: Apply Phase 2 pattern recognition from macro to micro scale.
3. Coarse-Grained Localization: Identify continent → country → region using cultural fingerprints.
4. Iterative Refinement: Cross-reference all extracted features against known geographic distributions. Resolve conflicts between indicators.
5. Fine-Grained Geo-Estimation: Converge on precise latitude and longitude using neighborhood-level patterns.
6. Confidence Assessment: Calculate confidence score (0-100%) and error radius in meters. Factor in the NUMBER and CONSISTENCY of corroborating indicators.

7. TIME ESTIMATION FROM SHADOWS: Analyze shadow lengths, angles, and directions relative to objects. Use the estimated latitude to calculate the sun's azimuth and elevation. Determine the approximate local time. Consider seasonal variations in sun position.

8. PERSON DIRECTION ANALYSIS: If any people are visible, determine the cardinal/intercardinal direction they are facing (N, S, E, W, NE, NW, SE, SW) and the direction they appear to be traveling. Use shadows, body orientation, and contextual cues (road direction, destination clues).

You MUST respond with ONLY valid JSON in this exact format:
{
  "status": "SUCCESS" | "AMBIGUOUS" | "FAILURE",
  "estimated_location": { "latitude": number, "longitude": number },
  "confidence_score": number,
  "error_radius_meters": number,
  "most_probable_macro_region": "string",
  "rationale": ["string", "string"],
  "identified_features": [{"type": "string", "detail": "string"}],
  "cultural_patterns_detected": [
    {
      "scale": "continental | country | city | neighborhood",
      "pattern": "string describing the cultural/infrastructure pattern",
      "location_implication": "what this pattern suggests about location",
      "confidence": number
    }
  ],
  "feature_extraction_summary": {
    "text_detected": ["list of all text/signs read"],
    "architecture_style": "string",
    "infrastructure_signatures": ["list of key infrastructure patterns"],
    "vegetation_indicators": ["list of vegetation observations"],
    "vehicle_indicators": ["list of vehicle/plate observations"]
  },
  "potential_alternative_locations": [{"region": "string", "confidence": number}],
  "address_estimate": "string or null",
  "time_estimation": {
    "estimated_local_time": "string (e.g. '14:30' or '2:30 PM')",
    "time_confidence": number,
    "shadow_analysis": "string describing shadow patterns observed",
    "shadow_direction": "compass bearing the shadows FALL TOWARD, e.g. 'NE' or '235 deg', or null if no shadows are readable",
    "estimated_season": "string (e.g. 'Summer', 'Winter', 'Spring', 'Autumn')",
    "sun_position": "string (e.g. 'High overhead', 'Low on western horizon')",
    "capture_date_estimate": "string 'YYYY-MM-DD' or null — your best estimate of the calendar date"
  }${IMAGINE_EVIDENCE_SCHEMA.replace(/^,/, ",")},
  "person_analysis": [
    {
      "person_id": number,
      "facing_direction": "string (N/S/E/W/NE/NW/SE/SW)",
      "travel_direction": "string (N/S/E/W/NE/NW/SE/SW) or 'stationary'",
      "confidence": number,
      "description": "string (brief description: position, clothing, activity)"
    }
  ]
}

If no people are visible, return an empty array for person_analysis.
If shadows are not clearly visible or time cannot be determined, set time_confidence to 0 and explain in shadow_analysis.

IMPORTANT: If the image lacks sufficient visual cues for geographic analysis (e.g. close-up of food, abstract art, solid color, blurry/dark image, screenshot of text, memes, or any image with no identifiable geographic features), you MUST set:
- "status": "FAILURE"
- "confidence_score": 0
- "insufficient_data": true
- "insufficient_data_reason": "A clear explanation of WHY the image cannot be geolocated and what kind of image would work better"

Analyze EVERY visual cue with forensic precision. Cross-reference cultural patterns at every geographic scale. The more corroborating indicators you find, the higher your confidence should be. Contradictory indicators should lower confidence and expand error radius.`;

    // Cascade through Gemini models — if one is overloaded/rate-limited, try the next.
    const MODEL_CASCADE = ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-pro-latest"];
    let text = "";
    let lastErr = "";
    let modelUsed = "";

    for (const model of MODEL_CASCADE) {
      let attemptOk = false;
      // Up to 2 attempts per model with backoff on transient errors.
      for (let attempt = 0; attempt < 2 && !attemptOk; attempt++) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
              generationConfig: {
                temperature: 0.15,
                maxOutputTokens: 16384,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
          if (text.trim().length > 0) {
            attemptOk = true;
            modelUsed = model;
            break;
          }
          lastErr = `${model}: empty response`;
        } else {
          const errText = await res.text();
          lastErr = `${model} ${res.status}: ${errText.slice(0, 200)}`;
          console.error("Gemini error:", lastErr);
          // Only retry/cascade on rate-limit or overload; otherwise break to next model.
          if (res.status !== 429 && res.status !== 503 && res.status < 500) break;
          if (attempt === 0) await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
        }
      }
      if (attemptOk) break;
    }

    // CREDENTIAL FAILOVER — a rejected/expired Gemini credential is not a
    // "model overloaded" condition, and must not silently kill the feature.
    // Fall the whole analysis over to the platform gateway vision model.
    if (!text) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const gw = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3.6-flash",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: `${systemPrompt}\n\nReturn ONLY the JSON object described above.` },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${image_base64}` } },
                ],
              }],
            }),
          });
          if (gw.ok) {
            const gj = await gw.json();
            const gtext = gj?.choices?.[0]?.message?.content;
            if (typeof gtext === "string" && gtext.trim()) {
              text = gtext;
              modelUsed = "gateway:google/gemini-3.6-flash";
            }
          } else {
            lastErr = `${lastErr} | gateway ${gw.status}: ${(await gw.text()).slice(0, 160)}`;
          }
        } catch (ge) {
          lastErr = `${lastErr} | gateway error: ${ge instanceof Error ? ge.message : String(ge)}`;
        }
      }
    }

    if (!text) {
      return new Response(
        JSON.stringify({
          status: "FAILURE",
          insufficient_data: true,
          insufficient_data_reason:
            "The intelligence engine is temporarily overloaded. All fallback models failed. Please try again in a few seconds.",
          confidence_score: 0,
          _engine_error: lastErr || "all_models_failed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract JSON — JSON mode usually returns clean JSON, but strip fences just in case.
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    let analysis: Record<string, unknown> | null = null;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { analysis = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (!analysis) {
      return new Response(
        JSON.stringify({
          status: "FAILURE",
          insufficient_data: true,
          insufficient_data_reason:
            "The engine returned a malformed response. This usually means the image lacks identifiable geographic features. Try a wider outdoor shot with visible signage, architecture, or terrain.",
          confidence_score: 0,
          _engine_error: "malformed_json",
          _model: modelUsed,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const a = analysis as Record<string, unknown>;
    const adjudicationNotes: string[] = [];

    // ── STAGE 1 OVERRIDE: a hard GPS fix outranks every inference. ──
    if (exif?.gps && Number.isFinite(exif.gps.latitude) && Number.isFinite(exif.gps.longitude)) {
      a.estimated_location = { latitude: exif.gps.latitude, longitude: exif.gps.longitude };
      a.confidence_score = 99;
      a.error_radius_meters = exif.gps.hPositioningErrorMeters ?? 25;
      a.status = "SUCCESS";
      a.insufficient_data = false;
      a.location_source = "exif_gps";
      adjudicationNotes.push(
        "Coordinate taken directly from the file's embedded GPS fix; the visual analysis below is corroboration, not the source of the location.",
      );
    } else {
      a.location_source = "visual_inference";
      // ── STAGE 4 INTEGRITY: reconcile the model against its own ranking. ──
      adjudicationNotes.push(...reconcileHypotheses(a));
    }

    // ── STAGE 5: deterministic astronomical validation. ──
    const loc = a.estimated_location as { latitude?: number; longitude?: number } | undefined;
    const te = (a.time_estimation || {}) as Record<string, unknown>;
    let solar: ReturnType<typeof verifySolarClaim> | null = null;
    if (loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
      solar = verifySolarClaim({
        lat: loc.latitude as number,
        lon: loc.longitude as number,
        isoDate:
          exif?.capturedAtUtc || exif?.capturedAtLocal || (typeof te.capture_date_estimate === "string" ? te.capture_date_estimate : null),
        claimedLocalTime: typeof te.estimated_local_time === "string" ? te.estimated_local_time : null,
        claimedShadowDirection:
          (typeof te.shadow_direction === "string" ? te.shadow_direction : null) ||
          (typeof te.shadow_analysis === "string" ? te.shadow_analysis : null),
        claimedSunPosition: typeof te.sun_position === "string" ? te.sun_position : null,
      });
      a.solar_verification = solar;

      // Confidence is evidence-weighted: physics can lift it a little, or sink it hard.
      // EXIF-sourced coordinates are ground truth and are never penalised by a model's bad time guess.
      if (solar.checked && a.location_source !== "exif_gps") {
        const before = Number(a.confidence_score) || 0;
        const after = Math.max(0, Math.min(99, Math.round(before + solar.confidenceDelta)));
        if (after !== before) {
          a.confidence_score = after;
          adjudicationNotes.push(
            `Astronomical validation adjusted confidence ${before}% → ${after}%. ${solar.verdict}`,
          );
          // Penalising the leader can demote it below a rival. Re-rank so the
          // ledger never shows a #1 that is less probable than #2, and move the
          // reported coordinate to whichever hypothesis now leads.
          const hyps = a.hypotheses as
            | { label?: string; probability: number; latitude?: number; longitude?: number }[]
            | undefined;
          if (Array.isArray(hyps) && hyps.length > 0) {
            const priorLeader = hyps[0];
            priorLeader.probability = after;
            hyps.sort((x, y) => (Number(y.probability) || 0) - (Number(x.probability) || 0));
            const leader = hyps[0];
            if (leader !== priorLeader) {
              adjudicationNotes.push(
                `Re-ranked after astronomical validation: "${leader.label ?? "hypothesis 1"}" (${leader.probability}%) overtakes "${priorLeader.label ?? "prior leader"}" (${priorLeader.probability}%).`,
              );
              if (Number.isFinite(leader.latitude) && Number.isFinite(leader.longitude)) {
                a.estimated_location = { latitude: leader.latitude, longitude: leader.longitude };
              }
              a.confidence_score = Math.max(0, Math.min(99, Math.round(Number(leader.probability) || 0)));
            }
          }
        }
        if (solar.consistent === false) {
          a.status = (Number(a.confidence_score) || 0) < 35 ? "AMBIGUOUS" : a.status;
        }
      }
    }

    if (adjudicationNotes.length) a.adjudication_notes = adjudicationNotes;
    a._model = modelUsed;
    a._pipeline = "imagine-evidence-v2";
    return new Response(JSON.stringify(a), {
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
