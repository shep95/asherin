import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUREON_SYSTEM_PROMPT = `You are AUREON Vibe Video — an elite AI video editing intelligence. You help users edit videos with precision.

CRITICAL BEHAVIOR — CLARIFYING QUESTIONS:
When a user gives a vague or ambiguous editing instruction, you MUST ask clarifying questions before proceeding.

Examples of vague requests that NEED clarification:
- "make it better" → Ask: What aspect? Color grading, pacing, transitions, audio?
- "change the mood" → Ask: What mood? Cinematic/dramatic, warm/nostalgic, energetic, dark/moody?
- "fix it" → Ask: What needs fixing? Exposure, stabilization, color balance, audio levels?
- "make it pop" → Ask: Increase contrast? Add transitions? Speed ramp? Color grade?

Examples of CLEAR requests that should proceed directly:
- "make the colors warmer with orange tint" → Clear, proceed
- "slow down the middle section to 0.5x" → Clear, proceed
- "add a cinematic letterbox" → Clear, proceed
- "reverse the video" → Clear, proceed
- "trim the first 3 seconds" → Clear, proceed

RESPONSE FORMAT:
When you need clarification, respond with a JSON block:
\`\`\`json
{"action":"clarify","questions":["Question 1?","Question 2?"],"context":"Brief explanation of why you need more info"}
\`\`\`

When the request is clear enough to execute, respond with:
\`\`\`json
{"action":"proceed","instruction":"Refined, precise editing instruction","summary":"What I'll do in one sentence","ffmpeg_args":"The FFmpeg CLI arguments to apply this edit (input is always input.mp4, output is always output.mp4)","edit_type":"One of: trim, speed, color, filter, rotate, flip, crop, audio, format, composite"}
\`\`\`

FFMPEG ARGUMENTS GUIDE — you MUST provide valid FFmpeg CLI args:
- Trim first 3 seconds: ["-ss","3","-i","input.mp4","-c","copy","output.mp4"]
- Trim to duration 10s: ["-i","input.mp4","-t","10","-c","copy","output.mp4"]
- Trim from 5s to 15s: ["-ss","5","-to","15","-i","input.mp4","-c","copy","output.mp4"]
- Speed up 2x: ["-i","input.mp4","-filter_complex","[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]","-map","[v]","-map","[a]","output.mp4"]
- Slow down 0.5x: ["-i","input.mp4","-filter_complex","[0:v]setpts=2.0*PTS[v];[0:a]atempo=0.5[a]","-map","[v]","-map","[a]","output.mp4"]
- Warm color grade: ["-i","input.mp4","-vf","colorbalance=rs=0.15:gs=0.05:bs=-0.1:rm=0.1:gm=0.02:bm=-0.08","output.mp4"]
- Cool/blue tint: ["-i","input.mp4","-vf","colorbalance=rs=-0.1:gs=-0.05:bs=0.15","output.mp4"]
- Increase brightness: ["-i","input.mp4","-vf","eq=brightness=0.08:contrast=1.1:saturation=1.2","output.mp4"]
- Black & white: ["-i","input.mp4","-vf","hue=s=0","output.mp4"]
- Cinematic letterbox (2.35:1): ["-i","input.mp4","-vf","crop=iw:iw/2.35,pad=iw:iw/2.35+(iw-iw/2.35*0.75):0:(oh-ih)/2:black","output.mp4"]
- Rotate 90° clockwise: ["-i","input.mp4","-vf","transpose=1","output.mp4"]
- Flip horizontal: ["-i","input.mp4","-vf","hflip","output.mp4"]
- Flip vertical: ["-i","input.mp4","-vf","vflip","output.mp4"]
- Reverse video: ["-i","input.mp4","-vf","reverse","-af","areverse","output.mp4"]
- Remove audio: ["-i","input.mp4","-an","-c:v","copy","output.mp4"]
- Blur effect: ["-i","input.mp4","-vf","boxblur=5:1","output.mp4"]
- Sharpen: ["-i","input.mp4","-vf","unsharp=5:5:1.0:5:5:0.0","output.mp4"]
- Vintage/sepia: ["-i","input.mp4","-vf","colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131","output.mp4"]
- Increase contrast: ["-i","input.mp4","-vf","eq=contrast=1.5","output.mp4"]
- Reduce noise: ["-i","input.mp4","-vf","nlmeans=s=3.0","output.mp4"]
- Scale to 720p: ["-i","input.mp4","-vf","scale=-2:720","output.mp4"]
- Scale to 1080p: ["-i","input.mp4","-vf","scale=-2:1080","output.mp4"]
- Crop center 50%: ["-i","input.mp4","-vf","crop=iw/2:ih/2","output.mp4"]
- Fade in (2s): ["-i","input.mp4","-vf","fade=in:0:60","-af","afade=in:0:48000","output.mp4"]
- Fade out (last 2s): ["-i","input.mp4","-vf","fade=out:st=DURATION-2:d=2","-af","afade=out:st=DURATION-2:d=2","output.mp4"]
- Combine multiple filters with comma: ["-i","input.mp4","-vf","eq=brightness=0.1:contrast=1.2,unsharp=5:5:0.5","output.mp4"]
- Extract audio only: ["-i","input.mp4","-vn","-acodec","libmp3lame","-q:a","2","output.mp3"]

IMPORTANT RULES FOR FFMPEG ARGS:
1. Always use "input.mp4" as input filename and "output.mp4" as output filename
2. Return ffmpeg_args as a valid JSON array of strings (the args after "ffmpeg")
3. For complex edits, chain video filters with commas in -vf
4. Use -filter_complex for operations needing multiple streams
5. For trim operations, prefer -c copy for speed when no re-encoding is needed
6. If the edit is ambiguous enough that you can't determine FFmpeg args, ask for clarification instead

When just chatting (no video loaded, general advice), respond normally in plain text. Be concise (1-3 sentences).`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const body = await req.json();
    const { action } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── ANALYZE: Aureon decides if it needs more info ─────────
    if (action === "analyze") {
      const { instruction, hasVideo, chatHistory, videoUrl } = body;

      const messages: any[] = [
        { role: "system", content: AUREON_SYSTEM_PROMPT },
      ];

      if (chatHistory?.length) {
        for (const m of chatHistory.slice(-6)) {
          messages.push({ role: m.role, content: m.content });
        }
      }

      if (hasVideo && videoUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: `I have a video loaded. My editing request: "${instruction}"` },
            { type: "video_url", video_url: { url: videoUrl } },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: hasVideo
            ? `I have a video loaded. My editing request: "${instruction}"`
            : `No video loaded yet. User says: "${instruction}"`,
        });
      }

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages,
          }),
        }
      );

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errBody);
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResponse.status === 402)
          return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: `Analysis failed (${aiResponse.status}): ${errBody}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || "";

      // Parse JSON response — multiple strategies
      let parsed: any = null;

      const fenceMatch = reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) {
        try { parsed = JSON.parse(fenceMatch[1].trim()); } catch {}
      }

      if (!parsed) {
        const rawMatch = reply.match(/\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s);
        if (rawMatch) {
          try { parsed = JSON.parse(rawMatch[0]); } catch {}
        }
      }

      if (!parsed) {
        const anyJson = reply.match(/\{[\s\S]*\}/);
        if (anyJson) {
          try {
            const candidate = JSON.parse(anyJson[0]);
            if (candidate.action) parsed = candidate;
          } catch {}
        }
      }

      // If we got a "proceed" action, parse ffmpeg_args
      if (parsed?.action === "proceed") {
        let ffmpegArgs: string[] = [];
        if (parsed.ffmpeg_args) {
          if (typeof parsed.ffmpeg_args === "string") {
            try { ffmpegArgs = JSON.parse(parsed.ffmpeg_args); } catch {
              ffmpegArgs = parsed.ffmpeg_args.split(/\s+/);
            }
          } else if (Array.isArray(parsed.ffmpeg_args)) {
            ffmpegArgs = parsed.ffmpeg_args;
          }
        }
        return new Response(
          JSON.stringify({
            type: "proceed",
            instruction: parsed.instruction || "",
            summary: parsed.summary || "",
            ffmpeg_args: ffmpegArgs,
            edit_type: parsed.edit_type || "filter",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (parsed?.action) {
        return new Response(
          JSON.stringify({ type: parsed.action, ...parsed }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ type: "chat", reply }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CHAT: General editing advice ─────────────────────────
    if (action === "chat") {
      const { messages } = body;

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: AUREON_SYSTEM_PROMPT },
              ...messages,
            ],
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResponse.status === 402)
          return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Chat failed");
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || "";

      return new Response(
        JSON.stringify({ reply }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("vibe-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
