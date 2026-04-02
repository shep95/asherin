// ============================================================================
// AUREON CROSS — Autonomous Trading Engine
// Browser-level DOM automation for hands-free trade execution
// ============================================================================

const AureonAutonomous = (function () {
  "use strict";

  // ── STATE ──
  let enabled = false;
  let config = {
    maxTradeSize: 500,
    maxTradesPerDay: 20,
    maxDailyLoss: 1000,
    stopLossPercent: 10,
    emergencyStopLoss: 15,
    minConfidence: 80,
    cooldownMs: 120000, // 2 min between trades
    requireApprovalAbove: 1000,
    autoConfirmWallet: false,
    allowedTokens: [],  // empty = all allowed
  };
  let state = {
    tradesExecutedToday: 0,
    dailyPnL: 0,
    lastTradeTime: 0,
    consecutiveLosses: 0,
    positions: [],
    emergencyStopped: false,
    pendingApproval: null,
    tradeLog: [],
  };
  let statusCallback = null;
  let notifyCallback = null;

  // ── DEX SITE PROFILES ──
  const SITE_PROFILES = {
    uniswap: {
      match: /app\.uniswap/,
      swapButton: 'button[data-testid="swap-button"], button:has-text("Swap")',
      confirmButton: 'button[data-testid="confirm-swap-button"], button:has-text("Confirm")',
      inputField: 'input[data-testid="token-amount-input"], input[placeholder*="0"]',
      maxButton: 'button:has-text("Max"), button:has-text("MAX")',
      priceSelector: '[data-testid="swap-rate"]',
    },
    jupiter: {
      match: /jup\.ag/,
      swapButton: 'button:has-text("Swap"), button[class*="swap"]',
      confirmButton: 'button:has-text("Confirm")',
      inputField: 'input[placeholder*="0"], input[type="number"]',
      maxButton: 'button:has-text("MAX"), button:has-text("Half")',
      priceSelector: '.rate-display',
    },
    raydium: {
      match: /raydium\.io/,
      swapButton: 'button:has-text("Swap")',
      confirmButton: 'button:has-text("Confirm")',
      inputField: 'input[type="text"], input[placeholder*="0"]',
      maxButton: 'button:has-text("Max")',
      priceSelector: '.price',
    },
    generic: {
      match: /.*/,
      swapButton: 'button:has-text("Swap"), button:has-text("Buy"), button:has-text("Trade")',
      confirmButton: 'button:has-text("Confirm"), button:has-text("Approve"), button:has-text("OK")',
      inputField: 'input[type="number"], input[type="text"][placeholder*="0"]',
      maxButton: 'button:has-text("Max"), button:has-text("MAX")',
      priceSelector: '.price, [class*="price"]',
    },
  };

  // ── DETECT SITE PROFILE ──
  function detectProfile() {
    const url = window.location.href;
    for (const [name, profile] of Object.entries(SITE_PROFILES)) {
      if (name !== "generic" && profile.match.test(url)) return { name, ...profile };
    }
    return { name: "generic", ...SITE_PROFILES.generic };
  }

  // ── SAFE QUERY (handles :has-text pseudo) ──
  function safeQuery(selectorString) {
    const selectors = selectorString.split(", ");
    for (const sel of selectors) {
      try {
        // Handle custom :has-text() pseudo selector
        const hasTextMatch = sel.match(/^(.+?)?:has-text\("(.+?)"\)$/);
        if (hasTextMatch) {
          const [, tag, text] = hasTextMatch;
          const tagName = (tag || "*").trim();
          const elements = document.querySelectorAll(tagName);
          for (const el of elements) {
            if (el.textContent?.trim().toLowerCase().includes(text.toLowerCase()) && el.offsetParent !== null) {
              return el;
            }
          }
        } else {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return el;
        }
      } catch { /* skip invalid selector */ }
    }
    return null;
  }

  // ── SIMULATE HUMAN INTERACTION ──
  function humanDelay() {
    return new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  }

  async function humanClick(el) {
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await humanDelay();

    // Dispatch realistic mouse events
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() * 4 - 2);
    const y = rect.top + rect.height / 2 + (Math.random() * 4 - 2);

    for (const type of ["mouseover", "mouseenter", "mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }
    await humanDelay();
    return true;
  }

  async function humanType(el, text) {
    if (!el) return false;
    await humanClick(el);
    el.focus();

    // Clear existing value
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await humanDelay();

    // Type char by char
    for (const ch of text) {
      el.value += ch;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true }));
      await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ── SAFETY CHECKS ──
  function canTrade(signal) {
    if (state.emergencyStopped) return { ok: false, reason: "Emergency stop active" };
    if (!enabled) return { ok: false, reason: "Autonomous mode disabled" };
    if (state.tradesExecutedToday >= config.maxTradesPerDay) return { ok: false, reason: `Max daily trades (${config.maxTradesPerDay}) reached` };

    const now = Date.now();
    if (now - state.lastTradeTime < config.cooldownMs) {
      const remaining = Math.ceil((config.cooldownMs - (now - state.lastTradeTime)) / 1000);
      return { ok: false, reason: `Cooldown: ${remaining}s remaining` };
    }

    if (signal.confidence < config.minConfidence) return { ok: false, reason: `Confidence ${signal.confidence}% < min ${config.minConfidence}%` };
    if (state.consecutiveLosses >= 5) return { ok: false, reason: "5 consecutive losses — paused" };

    // Daily loss check
    if (Math.abs(state.dailyPnL) >= config.maxDailyLoss && state.dailyPnL < 0) {
      return { ok: false, reason: `Max daily loss ($${config.maxDailyLoss}) hit` };
    }

    return { ok: true };
  }

  // ── EXECUTE BUY ──
  async function executeBuy(signal) {
    const check = canTrade(signal);
    if (!check.ok) {
      log("BLOCKED", check.reason, signal);
      return { success: false, reason: check.reason };
    }

    const profile = detectProfile();
    log("EXECUTING", `BUY on ${profile.name}`, signal);
    updateStatus("executing", `Executing BUY...`);

    try {
      // 1. Find and fill input
      const input = safeQuery(profile.inputField);
      if (!input) throw new Error("Could not find amount input");

      const amount = calculateAmount(signal);
      await humanType(input, amount.toString());

      // 2. Click swap/buy button
      await humanDelay();
      const swapBtn = safeQuery(profile.swapButton);
      if (!swapBtn) throw new Error("Could not find Swap button");
      await humanClick(swapBtn);

      // 3. Wait for confirm modal
      await new Promise(r => setTimeout(r, 1500));
      const confirmBtn = safeQuery(profile.confirmButton);
      if (confirmBtn) {
        await humanClick(confirmBtn);
      }

      // 4. Record trade
      const trade = {
        action: "BUY",
        price: signal.price || signal.entry || "?",
        amount,
        confidence: signal.confidence,
        reason: signal.reason || signal.title || "Signal",
        stopLoss: signal.stopLoss || signal.stop,
        takeProfit: signal.takeProfit || signal.target,
        timestamp: Date.now(),
        status: "pending",
      };

      state.tradesExecutedToday++;
      state.lastTradeTime = Date.now();
      state.positions.push(trade);
      state.tradeLog.push(trade);

      log("SUCCESS", `BUY executed`, trade);
      updateStatus("active", `BUY executed at ${trade.price}`);
      notify(`🟢 AUTO-BUY executed\nPrice: ${trade.price}\nAmount: $${amount}\nConfidence: ${signal.confidence}%\nReason: ${trade.reason}`);

      return { success: true, trade };
    } catch (err) {
      log("ERROR", `BUY failed: ${err.message}`, signal);
      updateStatus("error", `BUY failed: ${err.message}`);
      notify(`❌ AUTO-BUY FAILED\n${err.message}`);
      return { success: false, reason: err.message };
    }
  }

  // ── EXECUTE SELL ──
  async function executeSell(signal) {
    const profile = detectProfile();
    log("EXECUTING", `SELL on ${profile.name}`, signal);
    updateStatus("executing", `Executing SELL...`);

    try {
      // 1. Click Max button to sell all
      const maxBtn = safeQuery(profile.maxButton);
      if (maxBtn) {
        await humanClick(maxBtn);
        await humanDelay();
      }

      // 2. Click swap/sell
      const swapBtn = safeQuery(profile.swapButton);
      if (!swapBtn) throw new Error("Could not find Swap button");
      await humanClick(swapBtn);

      // 3. Confirm
      await new Promise(r => setTimeout(r, 1500));
      const confirmBtn = safeQuery(profile.confirmButton);
      if (confirmBtn) {
        await humanClick(confirmBtn);
      }

      // 4. Record trade
      const trade = {
        action: "SELL",
        price: signal.price || "MARKET",
        reason: signal.reason || signal.title || "Exit signal",
        confidence: signal.confidence || 95,
        timestamp: Date.now(),
        status: "pending",
      };

      state.tradesExecutedToday++;
      state.lastTradeTime = Date.now();
      state.positions = [];
      state.tradeLog.push(trade);

      log("SUCCESS", `SELL executed`, trade);
      updateStatus("active", `SELL executed`);
      notify(`🔴 AUTO-SELL executed\nPrice: ${trade.price}\nReason: ${trade.reason}`);

      return { success: true, trade };
    } catch (err) {
      log("ERROR", `SELL failed: ${err.message}`, signal);
      updateStatus("error", `SELL failed: ${err.message}`);
      notify(`❌ AUTO-SELL FAILED\n${err.message}`);
      return { success: false, reason: err.message };
    }
  }

  // ── EMERGENCY STOP ──
  function emergencyStop(reason) {
    state.emergencyStopped = true;
    enabled = false;
    log("EMERGENCY", reason);
    updateStatus("stopped", `🚨 EMERGENCY STOP: ${reason}`);
    notify(`🚨 EMERGENCY STOP ACTIVATED\nReason: ${reason}\nAll trading halted.`);
  }

  // ── PROCESS AI SIGNAL ──
  async function processSignal(signal) {
    if (!enabled || state.emergencyStopped) return null;

    const action = signal.action || signal.quickVerdict?.action;
    if (!action || action === "NONE" || action === "HOLD" || action === "WAIT") return null;

    const confidence = signal.confidence || signal.quickVerdict?.confidence || 0;
    const normalizedSignal = {
      action,
      confidence,
      price: signal.entry || signal.price || signal.quickVerdict?.message?.match(/\$[\d.]+/)?.[0] || "?",
      reason: signal.title || signal.reason || signal.quickVerdict?.message || "AI signal",
      stopLoss: signal.stopLoss || signal.stop,
      takeProfit: signal.takeProfit || signal.target,
    };

    if (action === "BUY_NOW" || action === "BUY") {
      // Check if approval needed
      const amount = calculateAmount(normalizedSignal);
      if (amount > config.requireApprovalAbove) {
        state.pendingApproval = normalizedSignal;
        updateStatus("approval", `⏳ Approval needed: BUY $${amount}`);
        notify(`⏳ APPROVAL REQUIRED\nBUY $${amount}\nConfidence: ${confidence}%\nApprove in extension overlay.`);
        return { pending: true, signal: normalizedSignal };
      }
      return await executeBuy(normalizedSignal);
    }

    if (action === "SELL_NOW" || action === "SELL" || action === "EXIT_NOW") {
      return await executeSell(normalizedSignal);
    }

    return null;
  }

  // ── APPROVE PENDING ──
  async function approvePending() {
    if (!state.pendingApproval) return;
    const signal = state.pendingApproval;
    state.pendingApproval = null;
    return await executeBuy(signal);
  }

  function rejectPending() {
    state.pendingApproval = null;
    updateStatus("active", "Pending trade rejected");
  }

  // ── HELPERS ──
  function calculateAmount(signal) {
    return Math.min(config.maxTradeSize, config.maxTradeSize);
  }

  function log(level, msg, data) {
    const entry = { time: new Date().toISOString(), level, msg, data };
    console.log(`[AUREON AUTO] ${level}: ${msg}`, data || "");
    state.tradeLog.push(entry);
    if (state.tradeLog.length > 100) state.tradeLog = state.tradeLog.slice(-50);
  }

  function updateStatus(s, text) {
    if (statusCallback) statusCallback(s, text);
  }

  function notify(message) {
    if (notifyCallback) notifyCallback(message);
    // Also send to background for Telegram/push notification
    try {
      chrome.runtime.sendMessage({ type: "autonomousNotify", message });
    } catch { /* extension context may not be available */ }
  }

  // ── DAILY RESET (runs at midnight) ──
  function checkDailyReset() {
    const now = new Date();
    const lastTrade = state.lastTradeTime ? new Date(state.lastTradeTime) : null;
    if (!lastTrade || now.getDate() !== lastTrade.getDate()) {
      state.tradesExecutedToday = 0;
      state.dailyPnL = 0;
      state.consecutiveLosses = 0;
      log("RESET", "Daily counters reset");
    }
  }
  setInterval(checkDailyReset, 60000);

  // ── PUBLIC API ──
  return {
    enable() { enabled = true; state.emergencyStopped = false; updateStatus("active", "Autonomous mode ON"); },
    disable() { enabled = false; updateStatus("off", "Autonomous mode OFF"); },
    isEnabled() { return enabled && !state.emergencyStopped; },
    getState() { return { ...state, enabled, config }; },
    setConfig(newConfig) { config = { ...config, ...newConfig }; },
    getConfig() { return { ...config }; },
    processSignal,
    emergencyStop,
    approvePending,
    rejectPending,
    onStatus(cb) { statusCallback = cb; },
    onNotify(cb) { notifyCallback = cb; },
    getTradeLog() { return [...state.tradeLog]; },
  };
})();
