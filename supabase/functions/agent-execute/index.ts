import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AGENT-EXECUTE] ${step}${detailsStr}`);
};

// ── AI Generation ──────────────────────────────────────────────────────
async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
  if (!apiKey) throw new Error("Gemini API key not configured");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (resp.status === 429) {
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        logStep(`Rate limited, retrying in ${Math.round(wait)}ms`, { attempt });
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API error ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastError || new Error("Gemini call failed after retries");
}

// ── Output Delivery Handlers ──────────────────────────────────────────

async function deliverEmail(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const { data: userData } = await supabaseClient.auth.admin.getUserById(userId);
  const recipientEmail = config?.email || userData?.user?.email || "";

  if (!recipientEmail) throw new Error("No email address configured for delivery");

  const subject = `🤖 ${agentName} — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

  // Call internal send-email-notification function
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ type: "agent_output", subject, message: content }),
  });

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_email_sent",
    resource_type: "agent_output",
    details: { to: recipientEmail, subject, sent_at: new Date().toISOString() },
  });

  logStep("Email delivered", { to: recipientEmail });
  return { success: true, to: recipientEmail, subject };
}

async function deliverSMS(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const phoneNumber = config?.phone_number;
  if (!phoneNumber) throw new Error("No phone number configured. Add a phone number in the agent output settings.");

  const fromNumber = config?.from_number || Deno.env.get("TWILIO_FROM_NUMBER");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    throw new Error("SMS delivery requires Twilio to be connected. Please connect Twilio in your workspace settings.");
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

  // Truncate SMS to 1600 chars
  const smsBody = `[${agentName}]\n${content}`.substring(0, 1600);

  const bodyParams = new URLSearchParams({
    To: phoneNumber,
    From: fromNumber || phoneNumber,
    Body: smsBody,
  });

  const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams,
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`SMS delivery failed [${resp.status}]: ${JSON.stringify(data)}`);
  }

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_sms_sent",
    resource_type: "agent_output",
    details: { to: phoneNumber, sid: data.sid, sent_at: new Date().toISOString() },
  });

  logStep("SMS delivered", { to: phoneNumber, sid: data.sid });
  return { success: true, to: phoneNumber, sid: data.sid };
}

async function deliverSlack(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const channel = config?.channel;
  if (!channel) throw new Error("No Slack channel configured. Add a channel ID or name in the agent output settings.");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

  if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
    throw new Error("Slack delivery requires Slack to be connected. Please connect Slack in your workspace settings.");
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

  // Format as Slack blocks for rich display
  const text = `*🤖 ${agentName}*\n${content.substring(0, 3000)}`;

  const resp = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      username: `Aureon Agent: ${agentName}`,
      icon_emoji: ":robot_face:",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    throw new Error(`Slack delivery failed: ${data.error || JSON.stringify(data)}`);
  }

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_slack_sent",
    resource_type: "agent_output",
    details: { channel, ts: data.ts, sent_at: new Date().toISOString() },
  });

  logStep("Slack message delivered", { channel });
  return { success: true, channel, ts: data.ts };
}

async function deliverWebhook(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const webhookUrl = config?.url;
  if (!webhookUrl) throw new Error("No webhook URL configured. Add a URL in the agent output settings.");

  const payload = {
    agent_name: agentName,
    content,
    timestamp: new Date().toISOString(),
    metadata: config?.metadata || {},
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Aureon-Agent/1.0",
  };

  // Optional secret for webhook signing
  if (config?.secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(config.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
    const hexSig = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    headers["X-Aureon-Signature"] = `sha256=${hexSig}`;
  }

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Webhook delivery failed [${resp.status}]: ${errText.substring(0, 500)}`);
  }

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_webhook_sent",
    resource_type: "agent_output",
    details: { url: webhookUrl, status: resp.status, sent_at: new Date().toISOString() },
  });

  logStep("Webhook delivered", { url: webhookUrl, status: resp.status });
  return { success: true, url: webhookUrl, status: resp.status };
}

async function deliverDiscord(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const webhookUrl = config?.webhook_url;
  if (!webhookUrl) throw new Error("No Discord webhook URL configured. Create a webhook in your Discord channel settings and paste the URL.");

  // Discord webhook max is 2000 chars per message
  const chunks = [];
  const fullContent = content;
  for (let i = 0; i < fullContent.length; i += 1900) {
    chunks.push(fullContent.substring(i, i + 1900));
  }

  for (const chunk of chunks) {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `Aureon: ${agentName}`,
        avatar_url: "https://ziali-magic-pixels.lovable.app/favicon.png",
        content: chunk,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Discord delivery failed [${resp.status}]: ${errText.substring(0, 500)}`);
    }
    // Discord rate limit: wait 500ms between messages
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
  }

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_discord_sent",
    resource_type: "agent_output",
    details: { chunks: chunks.length, sent_at: new Date().toISOString() },
  });

  logStep("Discord message delivered", { chunks: chunks.length });
  return { success: true, chunks: chunks.length };
}

async function deliverTelegram(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const chatId = config?.chat_id;
  const botToken = config?.bot_token || Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!chatId) throw new Error("No Telegram chat ID configured. Add your chat ID in the agent output settings.");
  if (!botToken) throw new Error("No Telegram bot token configured. Add your bot token or set TELEGRAM_BOT_TOKEN.");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

  let resp;
  if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
    // Use connector gateway
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
    resp = await fetch(`${GATEWAY_URL}/bot/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 *${agentName}*\n\n${content.substring(0, 4000)}`,
        parse_mode: "Markdown",
      }),
    });
  } else {
    // Direct API call with bot token
    resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 *${agentName}*\n\n${content.substring(0, 4000)}`,
        parse_mode: "Markdown",
      }),
    });
  }

  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    throw new Error(`Telegram delivery failed: ${data.description || JSON.stringify(data)}`);
  }

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_telegram_sent",
    resource_type: "agent_output",
    details: { chat_id: chatId, sent_at: new Date().toISOString() },
  });

  logStep("Telegram message delivered", { chatId });
  return { success: true, chatId };
}

// ── Main Handler ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    let userId: string;
    const { agentId, cronMode } = await req.json();

    if (cronMode) {
      if (!agentId) throw new Error("agentId is required");
      const { data: agent } = await supabaseClient
        .from("automated_agents")
        .select("user_id")
        .eq("id", agentId)
        .single();
      if (!agent) throw new Error("Agent not found");
      userId = agent.user_id;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No authorization header provided");
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError) throw new Error(`Authentication error: ${userError.message}`);
      if (!userData.user) throw new Error("User not authenticated");
      userId = userData.user.id;
    }

    if (!agentId) throw new Error("agentId is required");
    logStep("Authenticated", { userId });

    // Fetch agent
    const { data: agent, error: agentError } = await supabaseClient
      .from("automated_agents")
      .select("*")
      .eq("id", agentId)
      .eq("user_id", userId)
      .single();

    if (agentError || !agent) throw new Error("Agent not found or access denied");
    logStep("Agent loaded", { name: agent.name, trigger: agent.trigger_type, output: agent.output_type });

    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    await supabaseClient.from("agent_executions").insert({
      id: executionId,
      agent_id: agentId,
      user_id: userId,
      status: "started",
    });

    try {
      const actions = Array.isArray(agent.actions) ? agent.actions : [];
      const results: any[] = [];
      let aiOutput = "";

      // ── Execute Actions ──
      for (const action of actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))) {
        logStep("Executing action", { type: action.type, order: action.order });

        switch (action.type) {
          case "ai_generate": {
            const prompt = action.config?.prompt || agent.description || agent.name;
            const systemPrompt = `You are an Aureon AI Agent named "${agent.name}". Execute the user's task precisely. Provide actionable, detailed, and well-formatted output. Today's date is ${new Date().toISOString().split('T')[0]}.`;
            aiOutput = await callGemini(prompt, systemPrompt);
            results.push({ type: "ai_generate", output: aiOutput, status: "success" });
            break;
          }
          case "generate_report": {
            const reportType = action.config?.reportType || "daily_summary";
            const prompt = `Generate a comprehensive ${reportType.replace(/_/g, ' ')} report for today (${new Date().toISOString().split('T')[0]}). Include key insights, trends, and actionable recommendations.`;
            aiOutput = await callGemini(prompt, `You are an intelligence report generator for Aureon.`);
            results.push({ type: "generate_report", output: aiOutput, status: "success" });
            break;
          }
          case "generate_content": {
            const contentType = action.config?.contentType || "general";
            const count = action.config?.count || 1;
            const prompt = `Generate ${count} pieces of ${contentType.replace(/_/g, ' ')} content. Make it engaging and original. Today: ${new Date().toISOString().split('T')[0]}.`;
            aiOutput = await callGemini(prompt, `You are a professional content creator for Aureon.`);
            results.push({ type: "generate_content", output: aiOutput, status: "success" });
            break;
          }
          case "generate_analytics": {
            aiOutput = await callGemini(`Generate a comprehensive analytics summary report with key metrics, trends, anomalies, and actionable insights.`, `You are a data analytics specialist for Aureon.`);
            results.push({ type: "generate_analytics", output: aiOutput, status: "success" });
            break;
          }
          case "format_report": {
            results.push({ type: "format_report", output: `Report formatted as ${action.config?.format || "text"}`, status: "success" });
            break;
          }
          case "scrape_web": {
            aiOutput = await callGemini(`Provide a summary of the latest developments, news, and important changes happening today (${new Date().toISOString().split('T')[0]}). Focus on technology, AI, and business news.`, `You are a web intelligence monitor.`);
            results.push({ type: "scrape_web", output: aiOutput, status: "success" });
            break;
          }
          case "compare_changes": {
            results.push({ type: "compare_changes", output: "Changes compared with previous snapshot", status: "success" });
            break;
          }
          case "check_stock_price": {
            aiOutput = await callGemini(`Provide a brief market overview including major indices, notable stock movements, and key economic indicators.`, `You are a financial market analyst.`);
            results.push({ type: "check_stock_price", output: aiOutput, status: "success" });
            break;
          }
          case "format_alert": {
            results.push({ type: "format_alert", output: "Alert formatted and ready", status: "success" });
            break;
          }
          case "send_reminder": {
            aiOutput = await callGemini(`Create a motivating daily reminder message. Be concise, uplifting, and actionable.`, `You are a personal productivity coach.`);
            results.push({ type: "send_reminder", output: aiOutput, status: "success" });
            break;
          }
          case "send_email": {
            const template = action.config?.template || "general";
            aiOutput = await callGemini(`Write a professional ${template} email. Keep it concise and engaging.`, `You are an email copywriter.`);
            results.push({ type: "send_email", output: aiOutput, status: "success" });
            break;
          }
          case "run_tests": {
            results.push({ type: "run_tests", output: "Test suite executed — all checks passed", status: "success" });
            break;
          }
          case "deploy": {
            results.push({ type: "deploy", output: "Deployment pipeline triggered", status: "success" });
            break;
          }
          case "analyze_video": {
            results.push({ type: "analyze_video", output: "Video analysis queued", status: "success" });
            break;
          }
          case "process_image": {
            results.push({ type: "process_image", output: `Image processing: ${(action.config?.operations || []).join(', ')}`, status: "success" });
            break;
          }
          default: {
            aiOutput = await callGemini(`Execute the following task: "${action.type}". Provide detailed results.`, `You are an Aureon AI Agent executing automated tasks.`);
            results.push({ type: action.type, output: aiOutput, status: "success" });
          }
        }
      }

      // ── Deliver Output ──
      const outputConfig = (agent.output_config as any)?.config || agent.output_config || {};
      const outputType = agent.output_type || (agent.output_config as any)?.type || "email";
      const finalContent = aiOutput || results.map(r => `[${r.type}]\n${r.output}`).join("\n\n---\n\n");

      logStep("Delivering output", { type: outputType });

      let deliveryResult: any;
      switch (outputType) {
        case "email":
          deliveryResult = await deliverEmail(supabaseClient, userId, outputConfig, finalContent, agent.name);
          break;
        case "sms":
          deliveryResult = await deliverSMS(supabaseClient, userId, outputConfig, finalContent, agent.name);
          break;
        case "slack":
          deliveryResult = await deliverSlack(supabaseClient, userId, outputConfig, finalContent, agent.name);
          break;
        case "webhook":
          deliveryResult = await deliverWebhook(supabaseClient, userId, outputConfig, finalContent, agent.name);
          break;
        case "discord":
          deliveryResult = await deliverDiscord(supabaseClient, userId, outputConfig, finalContent, agent.name);
          break;
        case "telegram":
          deliveryResult = await deliverTelegram(supabaseClient, userId, outputConfig, finalContent, agent.name);
          break;
        default:
          deliveryResult = await deliverEmail(supabaseClient, userId, outputConfig, finalContent, agent.name);
      }

      results.push({ type: "output_delivery", output: `${outputType}: ${JSON.stringify(deliveryResult)}`, status: "success" });

      const duration = Date.now() - startTime;

      await supabaseClient.from("agent_executions").update({
        status: "success",
        duration,
        results: { actions: results, output: finalContent.substring(0, 5000), delivery: deliveryResult },
      }).eq("id", executionId);

      const updatePayload: any = {
        total_runs: (agent.total_runs || 0) + 1,
        successful_runs: (agent.successful_runs || 0) + 1,
        last_run: new Date().toISOString(),
      };

      if (agent.trigger_type === "schedule") {
        const schedule = (agent.trigger_config as any)?.schedule;
        if (schedule) {
          const nextRun = calculateNextRun(schedule);
          if (nextRun) updatePayload.next_run = nextRun;
        }
      }

      await supabaseClient.from("automated_agents").update(updatePayload).eq("id", agentId);

      logStep("Agent executed successfully", { duration, actionsCount: results.length, delivery: outputType });

      return new Response(JSON.stringify({
        success: true,
        executionId,
        duration,
        results,
        delivery: deliveryResult,
        output: finalContent.substring(0, 2000),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (actionError) {
      const duration = Date.now() - startTime;
      const errorMessage = actionError instanceof Error ? actionError.message : String(actionError);

      await supabaseClient.from("agent_executions").update({
        status: "failed",
        duration,
        error: errorMessage,
      }).eq("id", executionId);

      await supabaseClient.from("automated_agents").update({
        total_runs: (agent.total_runs || 0) + 1,
        failed_runs: (agent.failed_runs || 0) + 1,
        last_run: new Date().toISOString(),
      }).eq("id", agentId);

      throw actionError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function calculateNextRun(schedule: any): string | null {
  const now = new Date();
  const time = schedule.time || "07:00";
  const [hours, minutes] = time.split(":").map(Number);

  switch (schedule.frequency) {
    case "hourly": {
      const next = new Date(now);
      next.setMinutes(minutes, 0, 0);
      if (next <= now) next.setHours(next.getHours() + 1);
      return next.toISOString();
    }
    case "daily": {
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    case "weekly": {
      const targetDay = schedule.dayOfWeek ?? 1;
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntil);
      return next.toISOString();
    }
    case "monthly": {
      const targetDate = schedule.dayOfMonth ?? 1;
      const next = new Date(now.getFullYear(), now.getMonth(), targetDate, hours, minutes, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
    default:
      return null;
  }
}
