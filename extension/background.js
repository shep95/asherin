// Aureon Cross — Background Service Worker
// Handles communication between content script and Aureon backend

const AUREON_API_BASE = "https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "chat") {
    handleChat(message, sendResponse);
    return true; // async
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

async function handleChat(message, sendResponse) {
  try {
    const { aureonToken } = await chrome.storage.local.get("aureonToken");
    if (!aureonToken) {
      sendResponse({ text: "Please set your Aureon token in the extension popup first." });
      return;
    }

    const sanitizedMessage = sanitizeInput(message.message, 2000);
    const sanitizedContext = sanitizeInput(message.context, 4000);

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
        settings: { mode: "trading", sensitivity: "medium" },
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

    const resp = await fetch(`${AUREON_API_BASE}/cross-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aureonToken}`,
      },
      body: JSON.stringify({
        frame: message.frame,
        context: message.context,
        previousAlerts: message.previousAlerts || [],
        settings: message.settings || { mode: "trading", sensitivity: "medium" },
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
