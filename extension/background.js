// Asherin Cross — Background Service Worker
// Handles communication between content script and Asherin backend

const ASHERIN_API_BASE = "https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1";

// Allowed setting values (whitelist for backend validation)
const VALID_MODES = ["trading", "general", "analysis", "coding", "design"];
const VALID_SENSITIVITIES = ["low", "medium", "high"];
const MAX_FRAME_RATE = 10;
const MIN_FRAME_RATE = 1;
const VALID_MESSAGE_TYPES = new Set(["chat", "analyze", "getConfig", "saveConfig", "clearToken"]);

// ============================================================================
// SECURITY: AES-GCM token encryption at rest
// Token is encrypted using a per-install key stored in chrome.storage.session
// (session storage is cleared on browser restart, RAM-only, not on disk)
// ============================================================================

async function getOrCreateSessionKey() {
  const { _sessionKeyRaw } = await chrome.storage.session.get("_sessionKeyRaw");
  if (_sessionKeyRaw) {
    return crypto.subtle.importKey(
      "raw",
      new Uint8Array(_sessionKeyRaw),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  await chrome.storage.session.set({ _sessionKeyRaw: Array.from(new Uint8Array(raw)) });
  return key;
}

async function encryptToken(plain) {
  const key = await getOrCreateSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plain);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}

async function decryptToken(blob) {
  if (!blob || !blob.iv || !blob.ct) return null;
  try {
    const key = await getOrCreateSessionKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(blob.iv) },
      key,
      new Uint8Array(blob.ct)
    );
    return new TextDecoder().decode(pt);
  } catch {
    // Session key rotated (browser restart) — encrypted token unreadable, force re-entry
    return null;
  }
}

async function getStoredToken() {
  const { asherinTokenEnc } = await chrome.storage.local.get("asherinTokenEnc");
  return decryptToken(asherinTokenEnc);
}

async function setStoredToken(plain) {
  if (!plain || typeof plain !== "string") return;
  const enc = await encryptToken(plain.trim());
  await chrome.storage.local.set({ asherinTokenEnc: enc });
}

// ============================================================================
// SECURITY: sender validation — reject messages not from this extension's own
// content scripts / popup. Cross-extension messaging is disabled (no
// externally_connectable), so sender.id must equal our runtime id.
// ============================================================================

function isTrustedSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  // If sender has a tab/url, ensure it's an http(s) origin (defense in depth)
  if (sender.url) {
    try {
      const u = new URL(sender.url);
      if (!["https:", "http:", "chrome-extension:"].includes(u.protocol)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    sendResponse({ error: "Untrusted sender" });
    return false;
  }
  if (!message || typeof message.type !== "string" || !VALID_MESSAGE_TYPES.has(message.type)) {
    sendResponse({ error: "Invalid message" });
    return false;
  }

  if (message.type === "chat") {
    handleChat(message, sendResponse);
    return true;
  }
  if (message.type === "analyze") {
    handleAnalyze(message, sendResponse);
    return true;
  }
  if (message.type === "getConfig") {
    (async () => {
      const { asherinEnabled, settings } = await chrome.storage.local.get(["asherinEnabled", "settings"]);
      const token = await getStoredToken();
      sendResponse({ hasToken: !!token, asherinEnabled, settings });
    })();
    return true;
  }
  if (message.type === "saveConfig") {
    (async () => {
      const data = message.data || {};
      const toStore = {};
      if (data.settings) toStore.settings = sanitizeSettings(data.settings);
      if (typeof data.asherinEnabled === "boolean") toStore.asherinEnabled = data.asherinEnabled;
      if (Object.keys(toStore).length) await chrome.storage.local.set(toStore);
      if (data.asherinToken && typeof data.asherinToken === "string") {
        await setStoredToken(data.asherinToken);
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (message.type === "clearToken") {
    (async () => {
      await chrome.storage.local.remove("asherinTokenEnc");
      await chrome.storage.session.remove("_sessionKeyRaw");
      sendResponse({ ok: true });
    })();
    return true;
  }
});

// Input sanitization: strip control chars, limit length
function sanitizeInput(str, maxLen = 2000) {
  if (typeof str !== "string") return "";
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.slice(0, maxLen);
}

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return { mode: "trading", sensitivity: "medium", frameRate: 3, quality: "medium" };
  }
  return {
    mode: VALID_MODES.includes(settings.mode) ? settings.mode : "trading",
    sensitivity: VALID_SENSITIVITIES.includes(settings.sensitivity) ? settings.sensitivity : "medium",
    frameRate: Math.min(MAX_FRAME_RATE, Math.max(MIN_FRAME_RATE, parseInt(settings.frameRate) || 3)),
    quality: settings.quality === "high" ? "high" : "medium",
  };
}

function sanitizeContext(ctx, maxLen = 4000) {
  if (typeof ctx !== "string") return "";
  let cleaned = ctx.slice(0, maxLen);
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned;
}

async function handleChat(message, sendResponse) {
  try {
    const token = await getStoredToken();
    if (!token) {
      sendResponse({ text: "Session locked. Re-enter your Asherin token in the extension popup." });
      return;
    }

    const sanitizedMessage = sanitizeInput(message.message, 2000);
    const sanitizedContext = sanitizeContext(message.context, 4000);

    if (!sanitizedMessage.trim()) {
      sendResponse({ text: "Please enter a valid message." });
      return;
    }

    const resp = await fetch(`${ASHERIN_API_BASE}/cross-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
    const token = await getStoredToken();
    if (!token) {
      sendResponse({ error: "No token" });
      return;
    }

    const frame = message.frame;
    if (frame && (typeof frame !== "string" || !frame.startsWith("data:image/") || frame.length > 2 * 1024 * 1024)) {
      sendResponse({ error: "Invalid frame data" });
      return;
    }

    const resp = await fetch(`${ASHERIN_API_BASE}/cross-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
