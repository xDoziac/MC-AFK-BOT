"use strict";

const mineflayer = require("mineflayer");
const { addLog } = require("./logger");
const { state, pushError, clearAllTimers } = require("./state");
const { sendDiscordWebhook } = require("./modules/discord");
const { initAutoAuth } = require("./modules/autoAuth");
const { initMovement } = require("./modules/movement");
const { initChatMessages } = require("./modules/chatMessages");
const { initChatResponder } = require("./modules/chatResponder");
const { initCombat } = require("./modules/combat");
const { initAvoidMobs } = require("./modules/avoidMobs");
const { initBeds } = require("./modules/beds");

const SPAWN_TIMEOUT_MS = 150000; // Aternos servers can take 90-120s to finish spawning

let connectionTimeoutId = null;

function createBot(config) {
  if (state.isReconnecting === false && state.bot) {
    // Already have a live bot — don't spin up a duplicate ("ghost bot")
    // connection on top of it.
    addLog("[Bot] createBot() called while a bot already exists — ignoring.");
    return;
  }

  cleanupCurrentBot();
  state.manuallyStopped = false;

  addLog(`[Bot] Connecting to ${config.server.ip}:${config.server.port}...`);

  let bot;
  try {
    const requestedVersion = (config.server.version || "").trim();
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      password: config["bot-account"].password || undefined,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: requestedVersion || false, // false = auto-detect
      hideErrors: true, // we handle 'error' ourselves; avoid duplicate stack spam
      checkTimeoutInterval: 600000,
    });
  } catch (err) {
    addLog(`[Bot] Failed to create bot instance: ${err.message}`);
    pushError("create", err.message);
    scheduleReconnect(config);
    return;
  }

  state.bot = bot;
  attachLifecycleHandlers(bot, config);
  return bot;
}

function attachLifecycleHandlers(bot, config) {
  let spawnHandled = false;

  clearTimeout(connectionTimeoutId);
  connectionTimeoutId = setTimeout(() => {
    if (!state.connected) {
      addLog("[Bot] Timed out waiting for spawn — retrying.");
      safeEnd(bot);
      scheduleReconnect(config);
    }
  }, SPAWN_TIMEOUT_MS);

  bot.once("spawn", () => {
    if (spawnHandled) return; // some servers fire 'spawn' more than once
    spawnHandled = true;

    clearTimeout(connectionTimeoutId);
    state.connected = true;
    state.spawnedAt = Date.now();
    state.reconnectAttempts = 0;
    state.isReconnecting = false;

    addLog(`[Bot] Spawned on server (version ${bot.version}).`);

    if (config.discord?.events?.connect) {
      sendDiscordWebhook(config, `✅ **Connected** to \`${config.server.ip}\``, 0x4ade80);
    }

    initModules(bot, config);
  });

  bot.on("kicked", (reason) => {
    const reasonText = typeof reason === "object" ? JSON.stringify(reason) : String(reason);
    addLog(`[Bot] Kicked: ${reasonText}`);
    pushError("kicked", reasonText);

    if (/throttl|wait before reconnect|too fast|please wait/i.test(reasonText)) {
      state.wasThrottled = true;
      addLog("[Bot] Throttle kick detected — next reconnect will use a longer delay.");
    }

    if (config.discord?.events?.disconnect) {
      sendDiscordWebhook(config, `⚠️ **Kicked**: ${reasonText}`, 0xff0000);
    }
    // Intentionally do nothing else here — 'end' always fires right after
    // 'kicked' and is the single place reconnects are scheduled. Scheduling
    // from both events was the original cause of doubled/racing reconnects.
  });

  bot.on("end", (reason) => {
    addLog(`[Bot] Disconnected: ${reason || "unknown reason"}`);
    state.connected = false;
    state.bot = null;
    clearAllTimers();
    clearTimeout(connectionTimeoutId);

    if (config.discord?.events?.disconnect) {
      sendDiscordWebhook(config, `❌ **Disconnected**: ${reason || "unknown"}`, 0xf87171);
    }

    // This check was missing in the original bot: calling bot.end() from the
    // dashboard's Stop button still landed here and unconditionally
    // reconnected a few seconds later, so "Stop" never actually worked.
    if (state.manuallyStopped) {
      addLog("[Bot] Manual stop — not reconnecting.");
      return;
    }
    if (!config.utils["auto-reconnect"]) {
      addLog("[Bot] auto-reconnect is disabled in settings.json — staying disconnected.");
      return;
    }
    scheduleReconnect(config);
  });

  bot.on("error", (err) => {
    const message = err?.message || String(err);
    addLog(`[Bot] Error: ${message}`);
    pushError("error", message);
    // Deliberately not reconnecting here — 'end' fires after 'error' for
    // fatal cases and is the single source of truth for reconnects.
  });
}

function initModules(bot, config) {
  // Each module is isolated in its own try/catch: a bug in one module (say,
  // beds) should never be able to take down anti-afk, chat, combat, etc.
  const modules = [
    ["autoAuth", () => initAutoAuth(bot, config)],
    ["movement", () => initMovement(bot, config)],
    ["chatMessages", () => initChatMessages(bot, config)],
    ["chatResponder", () =>
      initChatResponder(bot, config, (username, message) => {
        if (config.discord?.events?.chat) {
          sendDiscordWebhook(config, `💬 **${username}**: ${message}`, 0x7289da);
        }
      }),
    ],
    ["combat", () => initCombat(bot, config)],
    ["avoidMobs", () => initAvoidMobs(bot, config)],
    ["beds", () => initBeds(bot, config)],
  ];

  for (const [name, fn] of modules) {
    try {
      fn();
    } catch (err) {
      addLog(`[Modules] ${name} failed to initialize: ${err.message}`);
      pushError(`module:${name}`, err.message);
    }
  }
}

function getReconnectDelay(config) {
  if (state.wasThrottled) {
    state.wasThrottled = false;
    const delay = 60000 + Math.floor(Math.random() * 60000);
    addLog(`[Bot] Using extended throttle-recovery delay: ${Math.round(delay / 1000)}s`);
    return delay;
  }

  const base = config.utils["auto-reconnect-delay"] || 3000;
  const max = config.utils["max-reconnect-delay"] || 120000;
  const exponential = Math.min(base * Math.pow(2, state.reconnectAttempts), max);
  const jitter = Math.floor(Math.random() * 2000);
  return exponential + jitter;
}

function scheduleReconnect(config) {
  if (state.manuallyStopped) return;
  if (state.isReconnecting) {
    addLog("[Bot] Reconnect already scheduled — ignoring duplicate request.");
    return;
  }

  state.isReconnecting = true;
  state.reconnectAttempts++;
  const delay = getReconnectDelay(config);
  addLog(`[Bot] Reconnecting in ${Math.round(delay / 1000)}s (attempt #${state.reconnectAttempts}).`);

  setTimeout(() => {
    state.isReconnecting = false;
    if (!state.manuallyStopped) createBot(config);
  }, delay);
}

function safeEnd(bot) {
  try {
    bot.removeAllListeners();
    bot.end();
  } catch {
    /* bot may already be dead — nothing to do */
  }
}

function cleanupCurrentBot() {
  clearAllTimers();
  clearTimeout(connectionTimeoutId);
  if (state.bot) {
    safeEnd(state.bot);
    state.bot = null;
  }
  state.connected = false;
}

/** Called by the dashboard/console "stop" action. */
function stopBot() {
  state.manuallyStopped = true;
  cleanupCurrentBot();
  addLog("[Bot] Stopped manually.");
}

/** Called by the dashboard/console "start" action, or on process boot. */
function startBot(config) {
  if (state.bot) {
    addLog("[Bot] Start requested but a bot is already running.");
    return;
  }
  createBot(config);
}

module.exports = { createBot, startBot, stopBot };
