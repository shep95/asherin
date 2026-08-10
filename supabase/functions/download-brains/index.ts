import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

import { ASHER_LOGIC_BRAIN } from "../_shared/asherLogicBrain.ts";
import { BUTTERFLY_PROTOCOL_BRAIN } from "../_shared/butterflyProtocolBrain.ts";
import { COMEDY_BRAIN } from "../_shared/comedyBrain.ts";
import { EMOTIONAL_PERSONA_BRAIN } from "../_shared/emotionalPersonaBrain.ts";
import { NARRATIVE_FORGE_BRAIN } from "../_shared/narrativeForgeBrain.ts";
import { SYNTHESIS_ENGINE_BRAIN } from "../_shared/synthesisEngineBrain.ts";
import { fullThinkingPatternDatabaseMarkdown } from "../_shared/thinkingPatterns.ts";
import { fullPatternEngineMarkdown } from "../_shared/patternRecognitionEngine.ts";
import { fullDomainAtlasMarkdown } from "../_shared/domainAtlas.ts";
import { VISUAL_INTELLIGENCE_BRAIN } from "../_shared/visualIntelligenceBrain.ts";
import { SOCIAL_AWARENESS_BRAIN } from "../_shared/socialAwarenessBrain.ts";

import { DEEP_TRAINING_ARCHITECTURE_BRAIN } from "../_shared/deepTrainingArchitectureBrain.ts";
import { GEOLOCATION_BRAIN } from "../_shared/geolocationBrain.ts";

import { ADMIN_EMAILS as SHARED_ADMIN_EMAILS } from "../_shared/constants.ts";
const ADMIN_EMAILS = Array.from(SHARED_ADMIN_EMAILS);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const email = (user.email || "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const zip = new JSZip();
    const brains: Record<string, string> = {
      "AsherLogicBrain.md": ASHER_LOGIC_BRAIN,
      "ButterflyProtocolBrain.md": BUTTERFLY_PROTOCOL_BRAIN,
      "ComedyBrain.md": COMEDY_BRAIN,
      "EmotionalPersonaBrain.md": EMOTIONAL_PERSONA_BRAIN,
      "NarrativeForgeBrain.md": NARRATIVE_FORGE_BRAIN,
      "SynthesisEngineBrain.md": SYNTHESIS_ENGINE_BRAIN,
      "VisualIntelligenceBrain.md": VISUAL_INTELLIGENCE_BRAIN,
      "SocialAwarenessBrain.md": SOCIAL_AWARENESS_BRAIN,
      "DeepTrainingArchitectureBrain.md": DEEP_TRAINING_ARCHITECTURE_BRAIN,
      "GeolocationBrain.md": GEOLOCATION_BRAIN,
      "ThinkingPatternDatabase.md": fullThinkingPatternDatabaseMarkdown(),
      "PatternRecognitionEngine.md": fullPatternEngineMarkdown(),
    };
    for (const [name, content] of Object.entries(brains)) {
      zip.file(name, content);
    }
    zip.file("README.md", `# Aureon Chat Brains\n\nExported ${new Date().toISOString()}\n\nContains ${Object.keys(brains).length} cortical brain doctrines.\n`);

    const blob = await zip.generateAsync({ type: "uint8array" });
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="aureon-brains-${Date.now()}.zip"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
