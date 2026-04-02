// ============================================================================
// AUREON CROSS — Content Script
// Injects overlay UI directly into any trading tab
// ============================================================================

(function () {
  "use strict";
  if (document.getElementById("aureon-cross-root")) return; // Already injected

  // ── STATE ──
  let isActive = false;
  let isMinimized = false;
  let captureInterval = null;
  let frameCount = 0;
  let previousAlerts = [];
  let currentContext = {};
  let settings = { mode: "trading", sensitivity: "medium", frameRate: 3, quality: "medium" };

  // ── ROOT CONTAINER ──
  const root = document.createElement("div");
  root.id = "aureon-cross-root";
  document.body.appendChild(root);

  // ── VOICE ENGINE ──
  function speak(text, urgent) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = urgent ? 1.4 : 1.2;
    u.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find(v => v.lang.startsWith("en"));
    if (en) u.voice = en;
    window.speechSynthesis.speak(u);
  }

  // ── STATUS INDICATOR (bottom-left) ──
  const status = document.createElement("div");
  status.className = "aureon-status";
  status.innerHTML = `<span class="aureon-status-dot off"></span><span>AUREON CROSS</span>`;
  status.onclick = () => toggleActive();
  root.appendChild(status);

  function updateStatus(state, text) {
    const dot = status.querySelector(".aureon-status-dot");
    dot.className = "aureon-status-dot " + state;
    status.querySelector("span:last-child").textContent = text;
  }

  // ── CHAT BOX ──
  const chat = document.createElement("div");
  chat.className = "aureon-chat minimized";
  chat.innerHTML = `
    <div class="aureon-chat-header">
      <div>
        <span class="aureon-chat-header-title">⊕ AUREON</span>
        <span class="aureon-chat-header-status">Cross Vision</span>
      </div>
      <div class="aureon-chat-btns">
        <button id="aureon-min-btn" title="Minimize">_</button>
        <button id="aureon-close-btn" title="Close">×</button>
      </div>
    </div>
    <div class="aureon-chat-messages" id="aureon-msgs"></div>
    <div class="aureon-chat-input-area">
      <input class="aureon-chat-input" id="aureon-input" placeholder="Ask Aureon..." />
      <button class="aureon-chat-send" id="aureon-send">SEND</button>
    </div>
  `;
  root.appendChild(chat);

  // Chat toggle
  const minBtn = chat.querySelector("#aureon-min-btn");
  const closeBtn = chat.querySelector("#aureon-close-btn");
  minBtn.onclick = () => {
    isMinimized = !isMinimized;
    chat.classList.toggle("minimized", isMinimized);
  };
  closeBtn.onclick = () => { chat.style.display = "none"; };

  // Make chat draggable
  makeDraggable(chat, chat.querySelector(".aureon-chat-header"));

  // Chat input
  const chatInput = chat.querySelector("#aureon-input");
  const chatSend = chat.querySelector("#aureon-send");

  function addMsg(sender, text) {
    const msgs = document.getElementById("aureon-msgs");
    const div = document.createElement("div");
    div.className = `aureon-msg aureon-msg-${sender === "user" ? "user" : "ai"}`;
    div.innerHTML = `<div class="aureon-msg-bubble">${escapeHtml(text)}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    addMsg("user", text);

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "chat",
        message: text,
        context: JSON.stringify(currentContext),
      });
      addMsg("ai", resp.text || "...");

      // If analysis came back with alerts, show them
      if (resp.analysis?.quickVerdict && resp.analysis.quickVerdict.action !== "NONE") {
        showVerdict(resp.analysis.quickVerdict);
      }
    } catch (e) {
      addMsg("ai", "Connection lost. Check extension popup.");
    }
  }

  chatSend.onclick = sendChat;
  chatInput.onkeydown = (e) => { if (e.key === "Enter") sendChat(); };

  // ── SCREEN CAPTURE ──
  function captureFrame() {
    try {
      // Find the largest canvas on the page (likely the chart)
      const canvases = document.querySelectorAll("canvas");
      let bestCanvas = null;
      let maxArea = 0;
      canvases.forEach((c) => {
        const a = c.width * c.height;
        if (a > maxArea) { maxArea = a; bestCanvas = c; }
      });

      if (bestCanvas && maxArea > 10000) {
        // Capture just the chart canvas
        return bestCanvas.toDataURL("image/jpeg", 0.5);
      }

      // Fallback: capture visible viewport via html2canvas-like approach
      // We'll use a simple method — capture the body as a screenshot isn't possible from content script
      // Instead, we take the chart canvas data
      return null;
    } catch (e) {
      return null;
    }
  }

  async function analyzeFrame() {
    const frame = captureFrame();
    if (!frame) return;

    frameCount++;
    updateStatus("", `ANALYZING · F${frameCount}`);

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "analyze",
        frame: frame,
        context: JSON.stringify(currentContext),
        previousAlerts: previousAlerts.slice(-3),
        settings: settings,
      });

      if (resp.error) {
        updateStatus("paused", "ERROR");
        return;
      }

      const analysis = resp.analysis;
      if (!analysis) return;

      // Update context
      if (analysis.context) currentContext = analysis.context;

      // Quick verdict overlay
      if (analysis.quickVerdict && analysis.quickVerdict.action !== "NONE") {
        showVerdict(analysis.quickVerdict);
      }

      // Alerts
      if (analysis.alerts?.length) {
        analysis.alerts.forEach((a) => {
          if ((a.confidence || 0) >= 65) {
            showAlert(a);
            previousAlerts.push({ type: a.type, title: a.title });
          }
        });
        previousAlerts = previousAlerts.slice(-10);
      }

      updateStatus("", `WATCHING · F${frameCount}`);
    } catch (e) {
      console.error("Aureon analysis error:", e);
    }
  }

  // ── VERDICT BANNER ──
  function showVerdict(v) {
    // Remove old verdict
    const old = root.querySelector(".aureon-verdict");
    if (old) old.remove();

    const actionMap = {
      BUY_NOW: { cls: "aureon-verdict-buy", emoji: "🟢", label: "BUY NOW" },
      SELL_NOW: { cls: "aureon-verdict-sell", emoji: "🔴", label: "SELL NOW" },
      EXIT_NOW: { cls: "aureon-verdict-exit", emoji: "🚨", label: "EXIT NOW" },
      HOLD: { cls: "aureon-verdict-hold", emoji: "🔵", label: "HOLD" },
      WAIT: { cls: "aureon-verdict-wait", emoji: "⏳", label: "WAIT" },
    };

    const info = actionMap[v.action] || actionMap.HOLD;

    const el = document.createElement("div");
    el.className = `aureon-verdict ${info.cls}`;
    el.innerHTML = `
      <span class="aureon-verdict-emoji">${info.emoji}</span>
      <div>
        <div class="aureon-verdict-action">${info.label}</div>
        <div class="aureon-verdict-msg">${escapeHtml(v.message || "")}</div>
      </div>
      <span class="aureon-verdict-conf">${v.confidence || 0}%</span>
    `;
    el.onclick = () => el.remove();
    root.appendChild(el);

    // Voice
    if (["BUY_NOW", "SELL_NOW", "EXIT_NOW"].includes(v.action)) {
      speak(`${info.label}. ${v.message || ""}. ${v.confidence}% confidence.`, true);
    }

    // Auto-dismiss
    const timeout = v.urgency === "immediate" ? 20000 : 10000;
    setTimeout(() => { if (el.parentElement) el.remove(); }, timeout);
  }

  // ── ALERT POPUP ──
  function showAlert(alert) {
    const typeMap = {
      BUY: { cls: "aureon-alert-buy", emoji: "🟢 BUY SIGNAL" },
      SELL: { cls: "aureon-alert-sell", emoji: "🔴 SELL SIGNAL" },
      WARNING: { cls: "aureon-alert-warn", emoji: "⚠️ WARNING" },
      MONITOR: { cls: "aureon-alert-warn", emoji: "👀 MONITOR" },
      INFO: { cls: "aureon-alert-warn", emoji: "ℹ️ INFO" },
    };

    const info = typeMap[alert.type] || typeMap.INFO;

    const el = document.createElement("div");
    el.className = `aureon-alert ${info.cls}`;

    let levelsHtml = "";
    if (alert.entry || alert.stopLoss || alert.takeProfit) {
      levelsHtml = `<div class="aureon-alert-levels">
        ${alert.entry ? `<div class="aureon-alert-level"><strong>Entry</strong><br>${alert.entry}</div>` : ""}
        ${alert.stopLoss ? `<div class="aureon-alert-level"><strong>Stop</strong><br>${alert.stopLoss}</div>` : ""}
        ${alert.takeProfit ? `<div class="aureon-alert-level"><strong>Target</strong><br>${alert.takeProfit}</div>` : ""}
      </div>`;
    }

    let reasoningHtml = "";
    if (alert.reasoning?.length) {
      reasoningHtml = alert.reasoning.map((r) => `• ${escapeHtml(r)}`).join("<br>");
    }

    el.innerHTML = `
      <div class="aureon-alert-header">
        <span class="aureon-alert-title">${info.emoji}</span>
        <button class="aureon-alert-close">×</button>
      </div>
      <div class="aureon-alert-body">
        <strong>${escapeHtml(alert.title || "Signal")}</strong>
        ${reasoningHtml ? `<div style="margin-top:6px;opacity:0.85">${reasoningHtml}</div>` : ""}
        ${alert.confidence ? `<div style="margin-top:6px;font-size:11px">Confidence: <strong>${alert.confidence}%</strong>${alert.validFor ? ` · Valid: ${alert.validFor}` : ""}</div>` : ""}
      </div>
      ${levelsHtml}
    `;

    el.querySelector(".aureon-alert-close").onclick = () => el.remove();
    root.appendChild(el);

    // Stack alerts (offset downward if multiple)
    const existing = root.querySelectorAll(".aureon-alert");
    existing.forEach((a, i) => { a.style.top = `${16 + i * 10}px`; });

    // Auto-dismiss
    setTimeout(() => {
      if (el.parentElement) {
        el.style.animation = "aureon-slideIn 0.3s ease reverse";
        setTimeout(() => el.remove(), 300);
      }
    }, 12000);
  }

  // ── TOGGLE ACTIVE ──
  function toggleActive() {
    isActive = !isActive;

    if (isActive) {
      chat.style.display = "flex";
      chat.classList.remove("minimized");
      isMinimized = false;
      updateStatus("", "WATCHING · F0");

      captureInterval = setInterval(analyzeFrame, settings.frameRate * 1000);
      addMsg("ai", "Aureon Cross active. I'm watching your screen for trading signals. Ask me anything.");
    } else {
      if (captureInterval) clearInterval(captureInterval);
      captureInterval = null;
      updateStatus("off", "AUREON CROSS");
    }
  }

  // ── HELPERS ──
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function makeDraggable(el, handle) {
    let x = 0, y = 0, px = 0, py = 0;
    handle.onmousedown = (e) => {
      if (e.target.tagName === "BUTTON") return;
      e.preventDefault();
      px = e.clientX;
      py = e.clientY;
      document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
      document.onmousemove = (ev) => {
        x = px - ev.clientX;
        y = py - ev.clientY;
        px = ev.clientX;
        py = ev.clientY;
        el.style.top = (el.offsetTop - y) + "px";
        el.style.left = (el.offsetLeft - x) + "px";
        el.style.bottom = "auto";
        el.style.right = "auto";
      };
    };
  }

  // ── LOAD CONFIG ──
  chrome.runtime.sendMessage({ type: "getConfig" }, (data) => {
    if (data?.settings) settings = { ...settings, ...data.settings };
    if (data?.aureonEnabled) toggleActive();
  });

  // ── KEYBOARD SHORTCUT ──
  document.addEventListener("keydown", (e) => {
    // Ctrl+Shift+A to toggle Aureon
    if (e.ctrlKey && e.shiftKey && e.key === "A") {
      e.preventDefault();
      toggleActive();
    }
  });
})();
