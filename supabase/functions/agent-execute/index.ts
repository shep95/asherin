import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  resolveRetryPolicy, attemptStep, rollUpStatus, callChildTool,
  PROCEDURE_PACKS, DEFAULT_PACK, UNBOUND_STEPS, ANALYSIS_STEPS,
  type StepRecord, type RunAttemptCtx,
} from "../_shared/zahtenRuntime.ts";
import { emitPull } from "../_shared/connectPull.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

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

  // Store notification in audit_log for in-app visibility
  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_email_sent",
    resource_type: "agent_output",
    details: {
      to: recipientEmail,
      subject,
      body_preview: content.substring(0, 500),
      sent_at: new Date().toISOString(),
      delivery_method: "email",
    },
  });

  // Attempt actual email delivery via send-email-notification
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ type: "agent_output", subject, message: content }),
    });
    const emailResult = await emailResp.json();
    logStep("Email delivery attempted", { status: emailResp.status, result: emailResult });
  } catch (emailErr) {
    logStep("Email delivery call failed (non-fatal)", { error: String(emailErr) });
  }

  logStep("Email notification logged", { to: recipientEmail });
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

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured. Please ensure the workspace has the required connector setup.");
  }
  if (!TWILIO_API_KEY) {
    throw new Error("Twilio is not connected. Go to workspace settings and connect Twilio to enable SMS delivery.");
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

  // Truncate SMS to 1600 chars max
  const smsBody = `[${agentName}]\n${content}`.substring(0, 1600);

  // We need a "From" number — Twilio requires it. Check config or env.
  const fromNumber = config?.from_number || Deno.env.get("TWILIO_FROM_NUMBER");
  if (!fromNumber) {
    throw new Error("No 'From' phone number configured. Set a Twilio phone number in the agent config or TWILIO_FROM_NUMBER secret.");
  }

  const bodyParams = new URLSearchParams({
    To: phoneNumber,
    From: fromNumber,
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

  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured.");
  }
  if (!SLACK_API_KEY) {
    throw new Error("Slack is not connected. Go to workspace settings and connect Slack to enable Slack delivery.");
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
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
  if (!webhookUrl) throw new Error("No webhook URL configured.");

  // Validate URL
  try { new URL(webhookUrl); } catch { throw new Error(`Invalid webhook URL: ${webhookUrl}`); }

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

  // Consume body to prevent leak
  const respText = await resp.text();

  if (!resp.ok) {
    throw new Error(`Webhook delivery failed [${resp.status}]: ${respText.substring(0, 500)}`);
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
  if (!webhookUrl) throw new Error("No Discord webhook URL configured.");

  try { new URL(webhookUrl); } catch { throw new Error(`Invalid Discord webhook URL`); }

  // Discord max 2000 chars per message
  const chunks: string[] = [];
  const fullContent = `**🤖 ${agentName}**\n${content}`;
  for (let i = 0; i < fullContent.length; i += 1900) {
    chunks.push(fullContent.substring(i, i + 1900));
  }

  for (let i = 0; i < chunks.length; i++) {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `Aureon: ${agentName}`,
        content: chunks[i],
      }),
    });

    // Consume body
    await resp.text();

    if (!resp.ok) {
      throw new Error(`Discord delivery failed on chunk ${i + 1} [${resp.status}]`);
    }
    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
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
  if (!chatId) throw new Error("No Telegram chat ID configured.");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

  let resp: Response;
  if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
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
    const botToken = config?.bot_token || Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Telegram is not connected. Connect Telegram in workspace settings or provide a bot token.");
    }
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

async function deliverWhatsApp(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  const phoneNumber = config?.phone_number;
  if (!phoneNumber) throw new Error("No WhatsApp phone number configured.");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    throw new Error("WhatsApp delivery requires Twilio to be connected (WhatsApp uses Twilio's API).");
  }

  const fromNumber = config?.from_number || Deno.env.get("TWILIO_WHATSAPP_NUMBER");
  if (!fromNumber) {
    throw new Error("No WhatsApp 'From' number configured. Set TWILIO_WHATSAPP_NUMBER secret (format: whatsapp:+14155238886).");
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
  const msgBody = `🤖 *${agentName}*\n\n${content}`.substring(0, 1600);

  const bodyParams = new URLSearchParams({
    To: phoneNumber.startsWith("whatsapp:") ? phoneNumber : `whatsapp:${phoneNumber}`,
    From: fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`,
    Body: msgBody,
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
    throw new Error(`WhatsApp delivery failed [${resp.status}]: ${JSON.stringify(data)}`);
  }

  await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_whatsapp_sent",
    resource_type: "agent_output",
    details: { to: phoneNumber, sid: data.sid, sent_at: new Date().toISOString() },
  });

  logStep("WhatsApp message delivered", { to: phoneNumber, sid: data.sid });
  return { success: true, to: phoneNumber, sid: data.sid };
}

async function deliverDatabase(
  supabaseClient: any,
  userId: string,
  config: any,
  content: string,
  agentName: string
) {
  // Store agent output directly in audit_log as a database record
  const { error } = await supabaseClient.from("audit_log").insert({
    user_id: userId,
    action: "agent_database_output",
    resource_type: "agent_output",
    details: {
      agent_name: agentName,
      content: content.substring(0, 10000),
      table: config?.table || "audit_log",
      stored_at: new Date().toISOString(),
    },
  });

  if (error) throw new Error(`Database storage failed: ${error.message}`);

  logStep("Output stored to database");
  return { success: true, stored: true };
}

// ── Main Handler ──────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Key gate — admin uses the platform key, others BYOK or free tier.
  // A scheduled run carries the service key, not a user JWT: gating it on the
  // request identity would make every cron agent fail with BYOK_REQUIRED, so
  // those runs are resolved later against the agent owner's email instead.
  let _cronMode = false;
  try {
    const _b = await req.clone().json().catch(() => ({} as any));
    _cronMode = !!(_b && typeof _b === 'object' && (_b as any).cronMode);
    if (!_cronMode) {
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    }
  } catch (_e) {
    const _gate = await import('../_shared/adminGate.ts');
    return _gate.byokErrorResponse(_e, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // Service-level client for DB operations
  const supabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    logStep("Function started");

    let userId: string;
    const { agentId, cronMode, executionId: resumeExecutionId, approve } = await req.json();

    if (cronMode) {
      // Called by scheduler with service key
      if (!agentId) throw new Error("agentId is required");
      const { data: agent } = await supabaseClient
        .from("automated_agents")
        .select("user_id")
        .eq("id", agentId)
        .single();
      if (!agent) throw new Error("Agent not found");
      userId = agent.user_id;
      // Resolve the owner's key entitlement before any model step runs, so a
      // scheduled run fails loudly here rather than half-way through delivery.
      const { data: owner } = await supabaseClient.auth.admin.getUserById(userId);
      const gate = await import("../_shared/adminGate.ts");
      try {
        await gate.resolveKeyForEmail(owner?.user?.email?.toLowerCase() ?? null, undefined);
      } catch (e) {
        return gate.byokErrorResponse(e, corsHeaders);
      }
    } else {
      // Called by user — verify JWT via getClaims
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
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

    const startTime = Date.now();
    const settings = (agent.settings ?? {}) as Record<string, any>;
    const policy = resolveRetryPolicy(settings);
    // Human-in-the-loop: the run pauses *before* the irreversible half — the
    // send — never after it. An approval that arrives once the email is gone
    // is theatre.
    const requireApproval = settings.requireApproval === true;

    const rawOutputConfig = agent.output_config as any;
    const outputConfig = rawOutputConfig?.config || rawOutputConfig || {};
    const outputType = agent.output_type || rawOutputConfig?.type || "email";

    // ── Resolve the run: fresh start, or resume a paused one ──────────────
    let executionId: string;
    let steps: StepRecord[] = [];
    let carriedContent = "";
    let resuming = false;

    if (resumeExecutionId) {
      const { data: prior } = await supabaseClient
        .from("agent_executions")
        .select("id,user_id,agent_id,status,results")
        .eq("id", resumeExecutionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!prior || prior.agent_id !== agentId) throw new Error("Run not found or access denied");
      if (prior.status !== "awaiting_approval") {
        throw new Error(`Run is ${prior.status}; only a run awaiting approval can be resumed`);
      }
      const checkpoint = (prior.results as any)?.checkpoint ?? {};
      steps = Array.isArray(checkpoint.steps) ? checkpoint.steps : [];
      carriedContent = String(checkpoint.content ?? "");
      executionId = prior.id;
      resuming = true;

      if (approve === false) {
        await supabaseClient.from("agent_executions").update({
          status: "failed",
          error: "held by operator — delivery was not sent",
          duration: Date.now() - startTime,
          results: { checkpoint: { steps, content: carriedContent }, actions: steps, hitl: "rejected" },
        }).eq("id", executionId);
        await supabaseClient.from("automated_agents").update({
          total_runs: (agent.total_runs || 0) + 1,
          failed_runs: (agent.failed_runs || 0) + 1,
          last_run: new Date().toISOString(),
        }).eq("id", agentId);
        void emitPull(userId, {
          organ: "zahten", capability: "hitl", fromSurface: "zahten", status: "fail",
          quote: agent.name, meta: { execution_id: executionId, decision: "rejected" },
        });
        return new Response(JSON.stringify({ success: false, executionId, status: "failed", held: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }
    } else {
      executionId = crypto.randomUUID();
      await supabaseClient.from("agent_executions").insert({
        id: executionId,
        agent_id: agentId,
        user_id: userId,
        status: "started",
      });
    }

    const ctx: RunAttemptCtx = { userId, agentName: agent.name, executionId };

    void emitPull(userId, {
      organ: "zahten",
      capability: resuming ? "hitl" : "run",
      fromSurface: cronMode ? "scheduler" : "zahten",
      status: "ok",
      quote: agent.name,
      meta: { execution_id: executionId, resumed: resuming, trigger: agent.trigger_type },
    });

    /** Commit progress so a crash resumes here instead of replaying side effects. */
    const commit = async (status: string, content: string) => {
      await supabaseClient.from("agent_executions").update({
        status,
        results: { checkpoint: { steps, content }, actions: steps },
      }).eq("id", executionId);
    };

    try {
      const actions = Array.isArray(agent.actions) ? agent.actions : [];
      let aiOutput = carriedContent;

      if (!resuming) {
        const ordered = [...actions].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

        for (let i = 0; i < ordered.length; i++) {
          const action = ordered[i];
          const type = String(action?.type ?? "unknown");
          const order = Number(action?.order ?? i + 1);
          logStep("Step", { type, order });

          // A step with no runner behind it says so. It never reports green.
          const unbound = UNBOUND_STEPS[type];
          if (unbound) {
            steps.push({ type, order, status: "skipped", output: unbound, attempts: 0, durationMs: 0 });
            await commit("running", aiOutput);
            continue;
          }

          const attempt = await attemptStep(ctx, type, policy, async () => {
            switch (type) {
              // ── Model steps: procedure text, never an identity ──────────
              case "ai_generate":
              case "generate_report":
              case "generate_content":
              case "generate_analytics":
              case "send_email":
              case "send_reminder":
              case "analyze":
              case "analyse":
              case "summarize":
              case "summarise":
              case "extract_data":
              case "classify":
              case "compare": {
                const cfg = action.config ?? {};
                const task =
                  cfg.prompt ??
                  (ANALYSIS_STEPS.has(type)
                    ? `Analyse the material below and report what it shows.\n\n${aiOutput || agent.description || agent.name}`
                    : null) ??
                  (type === "generate_report"
                    ? `Write a ${String(cfg.reportType ?? "daily summary").replace(/_/g, " ")} for ${new Date().toISOString().slice(0, 10)}.`
                    : type === "generate_content"
                      ? `Produce ${Number(cfg.count ?? 1)} pieces of ${String(cfg.contentType ?? "general").replace(/_/g, " ")} content.`
                      : type === "generate_analytics"
                        ? "Summarise the analytics for the current period."
                        : type === "send_email"
                          ? `Draft a ${String(cfg.template ?? "general")} email.`
                          : type === "send_reminder"
                            ? `Write the reminder for: ${agent.description || agent.name}.`
                            : agent.description || agent.name);
                const procedure = `${PROCEDURE_PACKS[type] ?? (ANALYSIS_STEPS.has(type) ? PROCEDURE_PACKS.analyze : DEFAULT_PACK)}\nToday is ${new Date().toISOString().slice(0, 10)}.`;
                const out = await callGemini(String(task), procedure);
                return { output: out, organ: undefined as string | undefined };
              }

              // ── Real tool steps: a live organ runs, or the step fails ───
              case "scrape_web":
              case "check_stock_price": {
                const cfg = action.config ?? {};
                const query = String(
                  cfg.query ?? cfg.url ??
                  (type === "check_stock_price"
                    ? `${cfg.symbol ?? "market"} price today`
                    : agent.description || agent.name),
                ).slice(0, 300);
                const raw = await callChildTool(ctx, "zophiel-search", "zophiel", { query, mode: "web", fast: true });
                const parsed = JSON.parse(raw);
                const hits = Array.isArray(parsed?.results) ? parsed.results : [];
                if (!hits.length) throw new Error(`no live result for "${query}"`);
                const lines = hits.slice(0, 8).map((h: any, n: number) =>
                  `${n + 1}. ${h.title ?? h.url ?? "untitled"} — ${String(h.snippet ?? h.description ?? "").slice(0, 220)}\n   ${h.url ?? ""}`,
                );
                return { output: `Live results for "${query}":\n${lines.join("\n")}`, organ: "zophiel" };
              }

              default: {
                // Unknown step types are not quietly handed to a model and
                // called done — the definition is wrong and should say so.
                // The message matches isPermanent(), so it is reported once
                // rather than retried into a backoff storm.
                throw new Error(`step type "${type}" has no runner in this deployment`);
              }
            }
          });

          if (attempt.error) {
            // A step with no runner did not break — it was never wired. That
            // is a skip the operator must see, not a red failure, and it does
            // not poison the steps that can still run.
            const unwired = /has no runner in this deployment/.test(attempt.error);
            steps.push({
              type, order, status: unwired ? "skipped" : "failed", output: "",
              attempts: attempt.attempts, durationMs: attempt.durationMs, error: attempt.error,
            });
            await commit("running", aiOutput);
            if (unwired) continue;
            // A hard failure stops the chain: later steps assume this one ran.
            break;
          }

          const value = attempt.value as { output: string; organ?: string };
          aiOutput = value.output || aiOutput;
          steps.push({
            type, order, status: "success", output: value.output.slice(0, 4000),
            attempts: attempt.attempts, durationMs: attempt.durationMs, organ: value.organ,
          });
          await commit("running", aiOutput);
        }
      }

      const finalContent = aiOutput ||
        steps.filter((s) => s.output).map((s) => `[${s.type}]\n${s.output}`).join("\n\n---\n\n");
      const producedSomething = steps.some((s) => s.status === "success");

      // ── HITL gate ────────────────────────────────────────────────────────
      if (requireApproval && !resuming && producedSomething) {
        await supabaseClient.from("agent_executions").update({
          status: "awaiting_approval",
          duration: Date.now() - startTime,
          results: { checkpoint: { steps, content: finalContent }, actions: steps, delivery_type: outputType },
        }).eq("id", executionId);
        void emitPull(userId, {
          organ: "zahten", capability: "hitl", fromSurface: "zahten", status: "skip",
          quote: agent.name, meta: { execution_id: executionId, decision: "pending", output: outputType },
        });
        logStep("Paused for approval", { executionId });
        return new Response(JSON.stringify({
          success: true, executionId, status: "awaiting_approval",
          awaitingApproval: true, steps, output: finalContent.slice(0, 2000),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }

      // ── Delivery ─────────────────────────────────────────────────────────
      let deliveryResult: any = null;
      let deliveryOk: boolean | null = null;

      if (producedSomething) {
        logStep("Delivering output", { type: outputType });
        const delivery = await attemptStep(ctx, `deliver:${outputType}`, policy, async () => {
          switch (outputType) {
            case "sms": return await deliverSMS(supabaseClient, userId, outputConfig, finalContent, agent.name);
            case "slack": return await deliverSlack(supabaseClient, userId, outputConfig, finalContent, agent.name);
            case "webhook": return await deliverWebhook(supabaseClient, userId, outputConfig, finalContent, agent.name);
            case "discord": return await deliverDiscord(supabaseClient, userId, outputConfig, finalContent, agent.name);
            case "telegram": return await deliverTelegram(supabaseClient, userId, outputConfig, finalContent, agent.name);
            case "whatsapp": return await deliverWhatsApp(supabaseClient, userId, outputConfig, finalContent, agent.name);
            case "database": return await deliverDatabase(supabaseClient, userId, outputConfig, finalContent, agent.name);
            default: return await deliverEmail(supabaseClient, userId, outputConfig, finalContent, agent.name);
          }
        });
        if (delivery.error) {
          deliveryOk = false;
          deliveryResult = { success: false, error: delivery.error };
          steps.push({
            type: `deliver:${outputType}`, order: 999, status: "failed", output: "",
            attempts: delivery.attempts, durationMs: delivery.durationMs, error: delivery.error,
          });
        } else {
          deliveryOk = true;
          deliveryResult = delivery.value;
          steps.push({
            type: `deliver:${outputType}`, order: 999, status: "success",
            output: `${outputType} delivered`, attempts: delivery.attempts, durationMs: delivery.durationMs,
          });
        }
      }

      const runStatus = rollUpStatus(steps, deliveryOk);
      const duration = Date.now() - startTime;
      const firstError = steps.find((s) => s.status === "failed")?.error ?? null;

      await supabaseClient.from("agent_executions").update({
        status: runStatus,
        duration,
        error: firstError,
        results: {
          checkpoint: { steps, content: finalContent },
          actions: steps,
          output: finalContent.substring(0, 5000),
          delivery: deliveryResult,
          delivery_type: outputType,
        },
      }).eq("id", executionId);

      const updatePayload: any = {
        total_runs: (agent.total_runs || 0) + 1,
        last_run: new Date().toISOString(),
      };
      // Only a clean run counts as a success. Partial and failed never do —
      // an inflated success rate is how automation loses money quietly.
      if (runStatus === "success") updatePayload.successful_runs = (agent.successful_runs || 0) + 1;
      if (runStatus === "failed") updatePayload.failed_runs = (agent.failed_runs || 0) + 1;

      if (agent.trigger_type === "schedule") {
        const schedule = (agent.trigger_config as any)?.schedule;
        if (schedule) {
          const nextRun = calculateNextRun(schedule);
          if (nextRun) updatePayload.next_run = nextRun;
        }
      }
      await supabaseClient.from("automated_agents").update(updatePayload).eq("id", agentId);

      void emitPull(userId, {
        organ: "zahten",
        capability: "run",
        fromSurface: cronMode ? "scheduler" : "zahten",
        status: runStatus === "success" ? "ok" : runStatus === "partial" ? "skip" : "fail",
        latencyMs: duration,
        quote: agent.name,
        meta: { execution_id: executionId, run_status: runStatus, steps: steps.length },
      });

      logStep("Run finished", { runStatus, duration, steps: steps.length });

      return new Response(JSON.stringify({
        success: runStatus !== "failed",
        status: runStatus,
        executionId,
        duration,
        steps,
        results: steps,
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
        results: { checkpoint: { steps, content: carriedContent }, actions: steps },
      }).eq("id", executionId);

      await supabaseClient.from("automated_agents").update({
        total_runs: (agent.total_runs || 0) + 1,
        failed_runs: (agent.failed_runs || 0) + 1,
        last_run: new Date().toISOString(),
      }).eq("id", agentId);

      void emitPull(userId, {
        organ: "zahten", capability: "run", fromSurface: cronMode ? "scheduler" : "zahten",
        status: "fail", latencyMs: duration, quote: agent.name,
        meta: { execution_id: executionId, error: errorMessage.slice(0, 120) },
      });

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
