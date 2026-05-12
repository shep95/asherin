import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all active monitor rules
    const { data: rules, error: rulesError } = await supabase
      .from("asha_monitor_rules")
      .select("*")
      .eq("active", true);

    if (rulesError) throw new Error("Failed to fetch rules: " + rulesError.message);
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No active rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    let alertsCreated = 0;

    for (const rule of rules) {
      try {
        // Fetch user's datasets for context
        const { data: datasets } = await supabase
          .from("asha_datasets")
          .select("file_name, row_count, col_count, quality_score, schema, tags, description")
          .eq("user_id", rule.user_id)
          .eq("status", "ready")
          .limit(10);

        const datasetsContext = datasets?.map((d: any) =>
          `- ${d.file_name}: ${d.row_count} rows, quality ${d.quality_score}%`
        ).join("\n") || "No datasets";

        // Use AI to evaluate the rule against current data
        let shouldTrigger = false;
        let alertMessage = "";

        if (GEMINI_API_KEY) {
          const aiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `You are a monitoring rule evaluator. Evaluate if the following monitoring rule should trigger based on the available data.

RULE:
- Name: ${rule.name}
- Target: ${rule.target}
- Condition: ${rule.condition}
- Threshold: ${rule.threshold}

AVAILABLE DATA:
${datasetsContext}

Respond with EXACTLY this JSON format:
{"trigger": true/false, "reason": "one sentence explanation"}

If you cannot determine from the data, set trigger to false.
Return ONLY the JSON.` }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
              }),
            }
          );

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              shouldTrigger = result.trigger === true;
              alertMessage = result.reason || `Rule "${rule.name}" triggered`;
            }
          }
        } else {
          // Without AI, do simple checks
          // Check if quality score dropped below threshold for quality-related rules
          if (rule.condition.toLowerCase().includes("quality") || rule.condition.toLowerCase().includes("score")) {
            const threshold = parseFloat(rule.threshold) || 80;
            const lowQuality = datasets?.filter((d: any) => d.quality_score != null && d.quality_score < threshold);
            if (lowQuality && lowQuality.length > 0) {
              shouldTrigger = true;
              alertMessage = `${lowQuality.length} dataset(s) have quality below ${threshold}%: ${lowQuality.map((d: any) => d.file_name).join(", ")}`;
            }
          }
        }

        // Update last_checked timestamp
        await supabase
          .from("asha_monitor_rules")
          .update({ last_checked: new Date().toISOString() })
          .eq("id", rule.id);

        if (shouldTrigger) {
          // Determine severity based on rule condition keywords
          let severity = "info";
          const condLower = (rule.condition + " " + rule.name).toLowerCase();
          if (condLower.includes("critical") || condLower.includes("fraud") || condLower.includes("breach")) {
            severity = "critical";
          } else if (condLower.includes("drop") || condLower.includes("below") || condLower.includes("fail")) {
            severity = "warning";
          }

          // Create alert
          await supabase.from("asha_alerts").insert({
            user_id: rule.user_id,
            rule_id: rule.id,
            rule_name: rule.name,
            message: alertMessage,
            severity,
          });

          // Increment trigger count and update last_triggered
          await supabase
            .from("asha_monitor_rules")
            .update({
              trigger_count: rule.trigger_count + 1,
              last_triggered: new Date().toISOString(),
            })
            .eq("id", rule.id);

          alertsCreated++;
        }
      } catch (ruleError) {
        console.error(`Error evaluating rule ${rule.id}:`, ruleError);
        // Continue with next rule
      }
    }

    return new Response(JSON.stringify({
      processed: rules.length,
      alertsCreated,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asha-monitor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
