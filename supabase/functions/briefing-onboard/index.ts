import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");
    const userId = userData.user.id;

    const { messages, current_profile } = await req.json();

    // Fetch existing profile if any
    const { data: existingProfile } = await supabaseClient
      .from("briefing_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const profileContext = existingProfile
      ? `\nCURRENT SAVED PROFILE:\n- Company: ${existingProfile.company_name || "Not set"}\n- Industry: ${existingProfile.industry || "Not set"}\n- Competitors: ${(existingProfile.competitors || []).join(", ") || "None"}\n- Key Markets: ${(existingProfile.key_markets || []).join(", ") || "None"}\n- Technology Stack: ${(existingProfile.technology_stack || []).join(", ") || "None"}\n- Investment Interests: ${(existingProfile.investment_interests || []).join(", ") || "None"}\n- Tracked People: ${(existingProfile.tracked_people || []).join(", ") || "None"}\n- Regulatory Bodies: ${(existingProfile.regulatory_bodies || []).join(", ") || "None"}\n- Custom Topics: ${(existingProfile.custom_topics || []).join(", ") || "None"}\n`
      : "";

    const systemPrompt = `You are AUREON Intelligence Onboarding. Your job is to have a natural conversation to build a comprehensive intelligence briefing profile for the user.

You need to gather the following information through conversation:
1. Company name
2. Industry
3. Competitors they want to track
4. Key markets they operate in
5. Technology stack
6. Investment interests
7. Key people they want to track
8. Regulatory bodies that affect them
9. Any custom topics

RULES:
- Be conversational, warm, and executive-level professional. Not robotic.
- Ask 1-2 questions at a time. Don't overwhelm.
- When the user gives you information, acknowledge it and ask the next thing naturally.
- If the user gives multiple pieces of info at once, extract them all.
- After you feel you have enough to build a strong profile (at minimum: industry + at least 2-3 other categories populated), tell the user their profile looks ready and ask if they want to add anything else.
- When the profile is complete, output a special JSON block at the END of your message (after your conversational text) in this exact format:

\`\`\`aureon_profile
{
  "company_name": "...",
  "industry": "...",
  "competitors": ["..."],
  "key_markets": ["..."],
  "technology_stack": ["..."],
  "investment_interests": ["..."],
  "tracked_people": ["..."],
  "regulatory_bodies": ["..."],
  "custom_topics": ["..."],
  "ready": true
}
\`\`\`

- Only include the JSON block when you believe the profile is sufficiently complete OR the user says they're done.
- If the user is updating an existing profile, acknowledge what's already saved and ask what they'd like to change.
- Keep responses concise — 2-4 sentences max per turn.
${profileContext}`;

    const geminiKey = Deno.env.get("GEMINI_API_KEY_APP");
    if (!geminiKey) throw new Error("GEMINI_API_KEY_APP not set");

    const geminiMessages = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I'll gather the intelligence profile through natural conversation." }] },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`Gemini error: ${errText}`);
    }

    const geminiData = await geminiResp.json();
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble responding. Please try again.";

    // Check if there's a profile JSON in the response — try multiple patterns
    let extractedProfile = null;
    let cleanReply = reply;

    // Pattern 1: ```aureon_profile ... ```
    const profileMatch = reply.match(/```aureon_profile\s*([\s\S]*?)```/);
    if (profileMatch) {
      try {
        extractedProfile = JSON.parse(profileMatch[1].trim());
        cleanReply = reply.replace(/```aureon_profile[\s\S]*?```/, "").trim();
      } catch { /* ignore */ }
    }

    // Pattern 2: ```json ... ``` with "ready": true
    if (!extractedProfile) {
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          if (parsed.ready || parsed.company_name || parsed.industry) {
            extractedProfile = { ...parsed, ready: true };
            cleanReply = reply.replace(/```json[\s\S]*?```/, "").trim();
          }
        } catch { /* ignore */ }
      }
    }

    // Pattern 3: raw JSON object in response
    if (!extractedProfile) {
      const rawJsonMatch = reply.match(/\{[\s\S]*?"(?:company_name|industry)"[\s\S]*?\}/);
      if (rawJsonMatch) {
        try {
          const parsed = JSON.parse(rawJsonMatch[0]);
          if (parsed.company_name || parsed.industry) {
            extractedProfile = { ...parsed, ready: true };
            cleanReply = reply.replace(rawJsonMatch[0], "").trim();
          }
        } catch { /* ignore */ }
      }
    }

    // If profile is extracted and ready, save it
    if (extractedProfile?.ready) {
      const payload = {
        user_id: userId,
        company_name: extractedProfile.company_name || "",
        industry: extractedProfile.industry || "",
        competitors: extractedProfile.competitors || [],
        key_markets: extractedProfile.key_markets || [],
        technology_stack: extractedProfile.technology_stack || [],
        investment_interests: extractedProfile.investment_interests || [],
        tracked_people: extractedProfile.tracked_people || [],
        regulatory_bodies: extractedProfile.regulatory_bodies || [],
        custom_topics: extractedProfile.custom_topics || [],
        delivery_time: current_profile?.delivery_time || "08:00",
        enabled: true,
      };

      if (existingProfile) {
        await supabaseClient.from("briefing_profiles").update(payload).eq("user_id", userId);
      } else {
        await supabaseClient.from("briefing_profiles").insert(payload);
      }
    }

    return new Response(JSON.stringify({
      reply: cleanReply,
      profile_saved: !!extractedProfile?.ready,
      extracted_profile: extractedProfile,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
