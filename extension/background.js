// Aureon Cross — Background Service Worker
// Handles communication between content script and Aureon backend

const AUREON_API_BASE = "https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1";

// Allowed setting values (whitelist for backend validation)
const VALID_MODES = ["trading", "general", "analysis"];
const VALID_SENSITIVITIES = ["low", "medium", "high"];
const MAX_FRAME_RATE = 10;
const MIN_FRAME_RATE = 1;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "chat") {
    handleChat(message, sendResponse);
    return true;
  }
  if (message.type === "analyze") {
    handleAnalyze(message, sendResponse);
    return true;
  }
  if (message.type === "getConfig") {
    chrome.storage.local.get(["aureonToken", "aureonEnabled", "settings"], (data) => {
      sendResponse(data);
    });
    return true;
  }
  if (message.type === "saveConfig") {
    chrome.storage.local.set(message.data, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

// Input sanitization: strip control chars, limit length
function sanitizeInput(str, maxLen = 2000) {
  if (typeof str !== "string") return "";
  // Remove control characters except newlines/tabs
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.slice(0, maxLen);
}

// Validate and sanitize settings to prevent client-side tampering
function sanitizeSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return { mode: "trading", sensitivity: "medium" };
  }
  return {
    mode: VALID_MODES.includes(settings.mode) ? settings.mode : "trading",
    sensitivity: VALID_SENSITIVITIES.includes(settings.sensitivity) ? settings.sensitivity : "medium",
    frameRate: Math.min(MAX_FRAME_RATE, Math.max(MIN_FRAME_RATE, parseInt(settings.frameRate) || 3)),
    quality: settings.quality === "high" ? "high" : "medium",
  };
}

// Sanitize context — cap size and strip potential PII patterns
function sanitizeContext(ctx, maxLen = 4000) {
  if (typeof ctx !== "string") return "";
  let cleaned = ctx.slice(0, maxLen);
  // Strip control chars
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned;
}

async function handleChat(message, sendResponse) {
  try {
    const { aureonToken } = await chrome.storage.local.get("aureonToken");
    if (!aureonToken) {
      sendResponse({ text: "Please set your Aureon token in the extension popup first." });
      return;
    }

    const sanitizedMessage = sanitizeInput(message.message, 2000);
    const sanitizedContext = sanitizeContext(message.context, 4000);

    if (!sanitizedMessage.trim()) {
      sendResponse({ text: "Please enter a valid message." });
      return;
    }

    const resp = await fetch(`${AUREON_API_BASE}/cross-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aureonToken}`,
      },
      body: JSON.stringify({
        frame: null,
        context: sanitizedContext,
        chatMessage: sanitizedMessage,
        settings: sanitizeSettings(message.settings || { mode: "trading", sensitivity: "medium" }),
      }),
    });

    if (!resp.ok) {
      sendResponse({ text: "Analysis unavailable — check your connection." });
      return;
    }

    const data = await resp.json();
    const reply = data.observations?.join("\n") || data.quickVerdict?.message || "I'm watching. Nothing notable right now.";
    sendResponse({ text: reply, analysis: data });
  } catch (e) {
    sendResponse({ text: "Connection error. Retrying..." });
  }
}

async function handleAnalyze(message, sendResponse) {
  try {
    const { aureonToken } = await chrome.storage.local.get("aureonToken");
    if (!aureonToken) {
      sendResponse({ error: "No token" });
      return;
    }

    // Validate frame data — must be a data URL and within size limits (2MB max)
    const frame = message.frame;
    if (frame && (typeof frame !== "string" || !frame.startsWith("data:image/") || frame.length > 2 * 1024 * 1024)) {
      sendResponse({ error: "Invalid frame data" });
      return;
    }

    const resp = await fetch(`${AUREON_API_BASE}/cross-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aureonToken}`,
      },
      body: JSON.stringify({
        frame: frame || null,
        context: sanitizeContext(message.context, 4000),
        previousAlerts: Array.isArray(message.previousAlerts) ? message.previousAlerts.slice(-3) : [],
        settings: sanitizeSettings(message.settings),
      }),
    });

    if (!resp.ok) {
      sendResponse({ error: "API error" });
      return;
    }

    const data = await resp.json();
    sendResponse({ analysis: data });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}
