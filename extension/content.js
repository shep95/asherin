// ============================================================================
// AUREON CROSS — Content Script
// Instant pattern recognition overlay for trading tabs
// ============================================================================

(function () {
  "use strict";
  if (document.getElementById("aureon-cross-root")) return;

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

  // ── STATUS INDICATOR ──
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
        <button id="aureon-auto-btn" title="Toggle Autonomous" class="aureon-auto-off">🤖</button>
        <button id="aureon-min-btn" title="Minimize">_</button>
        <button id="aureon-close-btn" title="Close">×</button>
      </div>
    </div>
    <div id="aureon-auto-panel" class="aureon-auto-panel" style="display:none;">
      <div class="aureon-auto-header">
        <span>🤖 AUTONOMOUS MODE</span>
        <span id="aureon-auto-status" class="aureon-auto-status-badge">OFF</span>
      </div>
      <div class="aureon-auto-stats">
        <div><span>Trades today</span><span id="aureon-auto-trades">0/20</span></div>
        <div><span>Daily P&L</span><span id="aureon-auto-pnl">$0.00</span></div>
        <div><span>Status</span><span id="aureon-auto-state">Idle</span></div>
      </div>
      <div class="aureon-auto-controls">
        <button id="aureon-auto-toggle" class="aureon-auto-enable">ENABLE</button>
        <button id="aureon-auto-stop" class="aureon-auto-emergency">🚨 EMERGENCY STOP</button>
      </div>
      <div id="aureon-auto-approval" class="aureon-auto-approval" style="display:none;">
        <p id="aureon-auto-approval-text">Awaiting approval...</p>
        <div class="aureon-auto-approval-btns">
          <button id="aureon-auto-approve">✅ APPROVE</button>
          <button id="aureon-auto-reject">❌ REJECT</button>
        </div>
      </div>
    </div>
    <div class="aureon-chat-messages" id="aureon-msgs"></div>
    <div class="aureon-chat-input-area">
      <input class="aureon-chat-input" id="aureon-input" placeholder="Ask Aureon..." />
      <button class="aureon-chat-send" id="aureon-send">SEND</button>
    </div>
  `;
  root.appendChild(chat);

  const minBtn = chat.querySelector("#aureon-min-btn");
  const closeBtn = chat.querySelector("#aureon-close-btn");
  const autoBtn = chat.querySelector("#aureon-auto-btn");
  const autoPanel = chat.querySelector("#aureon-auto-panel");
  const autoToggle = chat.querySelector("#aureon-auto-toggle");
  const autoStopBtn = chat.querySelector("#aureon-auto-stop");
  const autoApproval = chat.querySelector("#aureon-auto-approval");
  const autoApproveBtn = chat.querySelector("#aureon-auto-approve");
  const autoRejectBtn = chat.querySelector("#aureon-auto-reject");

  minBtn.onclick = () => { isMinimized = !isMinimized; chat.classList.toggle("minimized", isMinimized); };
  closeBtn.onclick = () => { chat.style.display = "none"; };
  autoBtn.onclick = () => {
    const panel = autoPanel;
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  };

  // Autonomous controls
  autoToggle.onclick = () => {
    if (typeof AureonAutonomous !== "undefined") {
      if (AureonAutonomous.isEnabled()) {
        AureonAutonomous.disable();
        autoToggle.textContent = "ENABLE";
        autoToggle.className = "aureon-auto-enable";
        autoBtn.className = "aureon-auto-off";
        chat.querySelector("#aureon-auto-status").textContent = "OFF";
        addMsg("ai", "🤖 Autonomous mode DISABLED. Manual trading only.");
      } else {
        AureonAutonomous.enable();
        autoToggle.textContent = "DISABLE";
        autoToggle.className = "aureon-auto-disable";
        autoBtn.className = "aureon-auto-on";
        chat.querySelector("#aureon-auto-status").textContent = "ACTIVE";
        addMsg("ai", "🤖 Autonomous mode ENABLED. AI will execute trades automatically.");
      }
    }
  };

  autoStopBtn.onclick = () => {
    if (typeof AureonAutonomous !== "undefined") {
      AureonAutonomous.emergencyStop("Manual emergency stop");
      autoToggle.textContent = "ENABLE";
      autoToggle.className = "aureon-auto-enable";
      autoBtn.className = "aureon-auto-off";
      chat.querySelector("#aureon-auto-status").textContent = "🚨 STOPPED";
      chat.querySelector("#aureon-auto-status").style.color = "#ff4040";
      addMsg("ai", "🚨 EMERGENCY STOP activated. All autonomous trading halted.");
    }
  };

  autoApproveBtn.onclick = () => {
    if (typeof AureonAutonomous !== "undefined") {
      AureonAutonomous.approvePending();
      autoApproval.style.display = "none";
    }
  };

  autoRejectBtn.onclick = () => {
    if (typeof AureonAutonomous !== "undefined") {
      AureonAutonomous.rejectPending();
      autoApproval.style.display = "none";
      addMsg("ai", "Trade rejected.");
    }
  };

  // Hook autonomous status/notify callbacks
  if (typeof AureonAutonomous !== "undefined") {
    AureonAutonomous.onStatus((s, text) => {
      chat.querySelector("#aureon-auto-state").textContent = text;
      if (s === "approval") {
        autoApproval.style.display = "block";
        chat.querySelector("#aureon-auto-approval-text").textContent = text;
      }
    });
    AureonAutonomous.onNotify((msg) => {
      addMsg("ai", msg);
    });
  }

  // Periodic stats update
  setInterval(() => {
    if (typeof AureonAutonomous !== "undefined") {
      const st = AureonAutonomous.getState();
      const tradesEl = chat.querySelector("#aureon-auto-trades");
      const pnlEl = chat.querySelector("#aureon-auto-pnl");
      if (tradesEl) tradesEl.textContent = `${st.tradesExecutedToday}/${st.config.maxTradesPerDay}`;
      if (pnlEl) pnlEl.textContent = `$${st.dailyPnL.toFixed(2)}`;
    }
  }, 2000);

  makeDraggable(chat, chat.querySelector(".aureon-chat-header"));

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
      const canvases = document.querySelectorAll("canvas");
      let bestCanvas = null;
      let maxArea = 0;
      canvases.forEach((c) => {
        const a = c.width * c.height;
        if (a > maxArea) { maxArea = a; bestCanvas = c; }
      });
      if (bestCanvas && maxArea > 10000) {
        return bestCanvas.toDataURL("image/jpeg", 0.5);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function analyzeFrame() {
    const frame = captureFrame();
    if (!frame) return;

    frameCount++;
    updateStatus("", `SCANNING · F${frameCount}`);

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

      if (analysis.context) currentContext = analysis.context;

      // Show instant verdict
      if (analysis.quickVerdict && analysis.quickVerdict.action !== "NONE") {
        showVerdict(analysis.quickVerdict);

        // Feed to autonomous engine
        if (typeof AureonAutonomous !== "undefined" && AureonAutonomous.isEnabled()) {
          AureonAutonomous.processSignal(analysis.quickVerdict);
        }
      }

      // Show alerts
      if (analysis.alerts?.length) {
        analysis.alerts.forEach((a) => {
          if ((a.confidence || 0) >= 65) {
            showInstantAlert(a);
            previousAlerts.push({ type: a.type, title: a.title });

            // Feed high-confidence alerts to autonomous engine
            if (typeof AureonAutonomous !== "undefined" && AureonAutonomous.isEnabled() && (a.confidence || 0) >= 80) {
              AureonAutonomous.processSignal(a);
            }
          }
        });
        previousAlerts = previousAlerts.slice(-10);
      }

      updateStatus("", `WATCHING · F${frameCount}${typeof AureonAutonomous !== "undefined" && AureonAutonomous.isEnabled() ? " · 🤖 AUTO" : ""}`);
    } catch (e) {
      console.error("Aureon analysis error:", e);
    }
  }

  // ── INSTANT VERDICT BANNER ──
  function showVerdict(v) {
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

    // Parse the structured message for entry/SL/TP
    const msg = v.message || "";
    const el = document.createElement("div");
    el.className = `aureon-verdict ${info.cls}`;

    el.innerHTML = `
      <div class="aureon-verdict-top">
        <span class="aureon-verdict-emoji">${info.emoji}</span>
        <span class="aureon-verdict-action">${info.label}</span>
        <span class="aureon-verdict-conf">${v.confidence || 0}%</span>
        <button class="aureon-verdict-close" title="Dismiss">×</button>
      </div>
      <div class="aureon-verdict-msg">${escapeHtml(msg)}</div>
    `;

    el.querySelector(".aureon-verdict-close").onclick = () => el.remove();
    root.appendChild(el);

    // Voice for actionable signals
    if (["BUY_NOW", "SELL_NOW", "EXIT_NOW"].includes(v.action)) {
      speak(`${info.label}. ${v.confidence}% confidence.`, true);
    }

    const timeout = v.urgency === "immediate" ? 25000 : 12000;
    setTimeout(() => { if (el.parentElement) el.remove(); }, timeout);
  }

  // ── INSTANT ALERT (new format with entry/SL/TP) ──
  function showInstantAlert(alert) {
    const typeMap = {
      BUY: { cls: "aureon-alert-buy", label: "🟢 BUY" },
      SELL: { cls: "aureon-alert-sell", label: "🔴 SELL" },
      WARNING: { cls: "aureon-alert-warn", label: "⚠️ WARNING" },
      MONITOR: { cls: "aureon-alert-monitor", label: "👀 WATCH" },
      INFO: { cls: "aureon-alert-monitor", label: "ℹ️ INFO" },
    };

    const info = typeMap[alert.type] || typeMap.INFO;

    const el = document.createElement("div");
    el.className = `aureon-alert ${info.cls}`;

    // Build levels row
    let levelsHtml = "";
    if (alert.entry || alert.stopLoss || alert.takeProfit) {
      levelsHtml = `<div class="aureon-alert-levels">
        ${alert.entry ? `<div class="aureon-alert-level entry"><span>ENTRY</span><span>${escapeHtml(alert.entry)}</span></div>` : ""}
        ${alert.stopLoss ? `<div class="aureon-alert-level stop"><span>STOP</span><span>${escapeHtml(alert.stopLoss)}</span></div>` : ""}
        ${alert.takeProfit ? `<div class="aureon-alert-level target"><span>TARGET</span><span>${escapeHtml(alert.takeProfit)}</span></div>` : ""}
      </div>`;
    }

    el.innerHTML = `
      <div class="aureon-alert-header">
        <span class="aureon-alert-label">${info.label}</span>
        <span class="aureon-alert-conf">${alert.confidence || 0}%</span>
        <button class="aureon-alert-close">×</button>
      </div>
      <div class="aureon-alert-title">${escapeHtml(alert.title || "Signal")}</div>
      ${alert.reasoning?.length ? `<div class="aureon-alert-reason">${alert.reasoning.map(r => escapeHtml(r)).join(" · ")}</div>` : ""}
      ${levelsHtml}
      ${alert.validFor ? `<div class="aureon-alert-valid">Valid: ${escapeHtml(alert.validFor)}</div>` : ""}
    `;

    el.querySelector(".aureon-alert-close").onclick = () => el.remove();
    root.appendChild(el);

    // Stack multiple alerts
    const existing = root.querySelectorAll(".aureon-alert");
    let offset = 16;
    existing.forEach((a) => { a.style.top = offset + "px"; offset += a.offsetHeight + 8; });

    setTimeout(() => {
      if (el.parentElement) {
        el.style.animation = "aureon-slideIn 0.3s ease reverse";
        setTimeout(() => el.remove(), 300);
      }
    }, 15000);
  }

  // ── TOGGLE ──
  function toggleActive() {
    isActive = !isActive;

    if (isActive) {
      chat.style.display = "flex";
      chat.classList.remove("minimized");
      isMinimized = false;
      updateStatus("", "SCANNING · F0");

      captureInterval = setInterval(analyzeFrame, settings.frameRate * 1000);
      addMsg("ai", "Cross active. Pattern recognition engine online. Watching for signals.");
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
    if (e.ctrlKey && e.shiftKey && e.key === "A") {
      e.preventDefault();
      toggleActive();
    }
  });
})();
